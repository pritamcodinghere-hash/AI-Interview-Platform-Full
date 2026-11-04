import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import Editor from "@monaco-editor/react";

import Navbar from "../components/Navbar";
import api from "../services/api";
import questions from "../data/questions";
import mcqBank from "../data/mcqBank";
import { getCasesForQuestion } from "../utils/pickCases";

import "../styles/WeeklyTest.css";

const MCQ_MINUTES_DEFAULT = 15;
const MAX_WARNINGS_DEFAULT = 5;

function fmt(sec) {
    const s = Math.max(0, sec);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function WeeklyTest() {
    // phases: setup | test | result
    const [phase, setPhase] = useState("setup");
    const [difficulty, setDifficulty] = useState("Medium");
    const [config, setConfig] = useState(null);
    const [error, setError] = useState("");

    // test state
    const [deadline, setDeadline] = useState(0); // ms epoch
    const [remaining, setRemaining] = useState(0); // seconds (coding phase)
    const [section, setSection] = useState("coding"); // coding | mcq
    const [warnings, setWarnings] = useState(0);
    const [maxWarnings, setMaxWarnings] = useState(MAX_WARNINGS_DEFAULT);
    const [mcqLeft, setMcqLeft] = useState(MCQ_MINUTES_DEFAULT * 60); // seconds
    const [submitting, setSubmitting] = useState(false);

    // coding
    const [codingQ, setCodingQ] = useState(null);
    const [code, setCode] = useState("");
    const [lang, setLang] = useState("java");
    const [runResult, setRunResult] = useState(null);
    const [running, setRunning] = useState(false);

    // mcq
    const [mcqAnswers, setMcqAnswers] = useState({}); // id -> index
    const [mcqIndex, setMcqIndex] = useState(0);

    // result
    const [result, setResult] = useState(null);

    const phaseRef = useRef(phase);
    useEffect(() => { phaseRef.current = phase; }, [phase]);
    const warnedRef = useRef(false);
    const submitRef = useRef(null);
    const finishRef = useRef(null);

    // ---------- finish / submit ----------
    const finish = async (reason) => {
        if (submitting) return;
        setSubmitting(true);
        const answered = Object.keys(mcqAnswers).length;
        let correct = 0;
        mcqBank.forEach((q) => {
            if (mcqAnswers[q.id] === q.answer) correct++;
        });
        const payload = {
            reason: reason || "submitted",
            difficulty,
            mcqAnswered: answered,
            mcqCorrect: correct,
            mcqTotal: mcqBank.length,
            codingPassed: runResult?.passed ?? null,
            codingTotal: runResult?.total ?? null,
            codingQuestion: codingQ?.title || null,
            warnings,
        };
        try {
            const res = await api.post("/weekly-test/submit", payload, { timeout: 30000 });
            setResult({ ...payload, ...res.data });
        } catch {
            setResult(payload);
        } finally {
            setPhase("result");
            setSubmitting(false);
            window.scrollTo({ top: 0 });
        }
    };

    // Keep callbacks in refs so timer/proctor effects always see the latest closure.
    useEffect(() => {
        submitRef.current = finish;
        finishRef.current = finish;
    });

    useEffect(() => {
        api.get("/weekly-test/config")
            .then((res) => setConfig(res.data))
            .catch(() => setConfig(null));
    }, []);

    // ---------- timer (coding round counts down for the whole test phase) ----------
    useEffect(() => {
        if (phase !== "test") return undefined;
        const tick = () => {
            const left = Math.ceil((deadline - Date.now()) / 1000);
            setRemaining(left);
            if (left <= 0 && section === "coding") {
                setSection("mcq"); // coding time over → MCQ round
            }
        };
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [phase, section, deadline]);

    // MCQ countdown
    useEffect(() => {
        if (phase !== "test" || section !== "mcq") return undefined;
        const id = setInterval(() => {
            setMcqLeft((v) => {
                if (v <= 1) {
                    clearInterval(id);
                    finishRef.current?.();
                    return 0;
                }
                return v - 1;
            });
        }, 1000);
        return () => clearInterval(id);
    }, [phase, section]);

    // ---------- proctoring: tab-switch warning ----------
    const raiseWarning = useCallback(async () => {
        if (phaseRef.current !== "test") return;
        try {
            const res = await api.post("/weekly-test/warning", {});
            setWarnings(res.data.warnings ?? 0);
            if (res.data.maxWarnings) setMaxWarnings(res.data.maxWarnings);
            if (res.data.exceeded) submitRef.current?.("Auto-submitted: warning limit exceeded");
        } catch {
            // offline proctoring fallback
            setWarnings((w) => {
                const next = w + 1;
                if (next >= maxWarnings) submitRef.current?.("Auto-submitted: warning limit exceeded");
                return next;
            });
        }
    }, [maxWarnings]);

    useEffect(() => {
        const onVis = () => {
            if (document.hidden && phaseRef.current === "test") {
                if (warnedRef.current) return;
                warnedRef.current = true;
                raiseWarning();
                setTimeout(() => { warnedRef.current = false; }, 1200);
            }
        };
        document.addEventListener("visibilitychange", onVis);
        return () => document.removeEventListener("visibilitychange", onVis);
    }, [raiseWarning]);

    // ---------- start ----------
    const startTest = async () => {
        setError("");
        try {
            const res = await api.post("/weekly-test/start", { difficulty });
            setDeadline(res.data.deadline);
            setRemaining(Math.ceil((res.data.deadline - Date.now()) / 1000));
            setMaxWarnings(res.data.maxWarnings || MAX_WARNINGS_DEFAULT);
            setWarnings(0);
            setSection("coding");
            setMcqLeft((config?.mcqMinutes || MCQ_MINUTES_DEFAULT) * 60);
            setMcqAnswers({});
            setMcqIndex(0);
            setRunResult(null);
            setResult(null);

            const pool = questions.filter(
                (q) => q.difficulty === difficulty && getCasesForQuestion(q.id).length > 0
            );
            const pick = pool[Math.floor(Math.random() * pool.length)] || questions[0];
            setCodingQ(pick);
            setCode("");
            setPhase("test");
            window.scrollTo({ top: 0 });
        } catch (e) {
            setError(e.response?.data?.message || "Could not start the test. Is the backend running?");
        }
    };

    // ---------- coding run (grades against real test cases) ----------
    const runCoding = async () => {
        if (running || !codingQ) return;
        setRunning(true);
        try {
            const cases = getCasesForQuestion(codingQ.id).slice(0, 5);
            const res = await api.post(
                "/submission",
                { code, language: lang, questionTitle: codingQ.title, testCases: cases },
                { timeout: 90000 }
            );
            setRunResult(res.data);
        } catch (e) {
            setRunResult({ error: e.response?.data?.message || e.message });
        } finally {
            setRunning(false);
        }
    };

    // ---------- render: SETUP ----------
    if (phase === "setup") {
        const mins = difficulty === "Easy" ? 15 : difficulty === "Hard" ? 50 : 25;
        const mcqMins = config?.mcqMinutes || MCQ_MINUTES_DEFAULT;
        return (
            <div className="page-shell">
                <Navbar />
                <div className="page-container wt-page">
                    <div className="page-header">
                        <div className="page-header-left">
                            <span className="badge-soft badge-blue">🗓️ Weekly Test</span>
                            <h1 className="page-title">Weekly Coding Test</h1>
                            <p className="page-subtitle">
                                Timed coding + MCQ proctored exam. Switching tabs raises warnings — 5 warnings auto-submits.
                            </p>
                        </div>
                        <div className="page-actions">
                            <Link to="/dashboard" className="btn-ghost">Dashboard</Link>
                        </div>
                    </div>

                    <div className="wt-setup glass fade-up">
                        <h2>Choose your difficulty</h2>
                        <div className="wt-diff-row">
                            {["Easy", "Medium", "Hard"].map((d) => (
                                <button
                                    key={d}
                                    className={`wt-diff ${d.toLowerCase()} ${difficulty === d ? "sel" : ""}`}
                                    onClick={() => setDifficulty(d)}
                                >
                                    {d === "Easy" ? "🌱" : d === "Medium" ? "🔥" : "💀"} {d}
                                </button>
                            ))}
                        </div>

                        <div className="wt-rules">
                            <div className="wt-rule"><b>{mins} min</b><span>Coding round</span></div>
                            <div className="wt-rule"><b>{mcqMins} min</b><span>MCQ round</span></div>
                            <div className="wt-rule"><b>{config?.maxWarnings || MAX_WARNINGS_DEFAULT}</b><span>Warnings allowed</span></div>
                            <div className="wt-rule"><b>1</b><span>Coding problem</span></div>
                            <div className="wt-rule"><b>{mcqBank.length}</b><span>MCQ questions</span></div>
                        </div>

                        <p className="wt-note">
                            ⚠️ The timer starts immediately. Leaving this tab counts as a warning. Your code is
                            graded against real test cases on the backend.
                        </p>

                        {error && <div className="wt-error">⚠️ {error}</div>}

                        <button className="btn-grad wt-start" onClick={startTest}>
                            🚀 Start Test — {difficulty}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ---------- render: RESULT ----------
    if (phase === "result") {
        const mcqPct = result?.mcqTotal ? Math.round((result.mcqCorrect / result.mcqTotal) * 100) : 0;
        const codingOk = result?.codingTotal != null && result?.codingPassed === result?.codingTotal;
        return (
            <div className="page-shell">
                <Navbar />
                <div className="page-container wt-page">
                    <div className="page-header">
                        <div className="page-header-left">
                            <span className="badge-soft badge-blue">🏁 Result</span>
                            <h1 className="page-title">Weekly Test Submitted</h1>
                            <p className="page-subtitle">{result?.reason || "Submitted successfully"}</p>
                        </div>
                    </div>

                    <div className="wt-result glass fade-up">
                        <div className="wt-result-grid">
                            <div className="wt-res-card">
                                <span className="wt-res-num">{result?.mcqCorrect ?? 0}/{result?.mcqTotal ?? 0}</span>
                                <span className="wt-res-label">MCQ correct ({mcqPct}%)</span>
                            </div>
                            <div className="wt-res-card">
                                <span className={`wt-res-num ${codingOk ? "good" : ""}`}>
                                    {result?.codingPassed ?? "–"}/{result?.codingTotal ?? "–"}
                                </span>
                                <span className="wt-res-label">Coding test cases</span>
                            </div>
                            <div className="wt-res-card">
                                <span className={`wt-res-num ${result?.warnings > 0 ? "warn" : ""}`}>
                                    {result?.warnings ?? 0}
                                </span>
                                <span className="wt-res-label">Warnings</span>
                            </div>
                        </div>

                        {result?.codingQuestion && (
                            <p className="wt-note">Problem attempted: <b>{result.codingQuestion}</b></p>
                        )}

                        <div className="wt-result-actions">
                            <button className="btn-grad" onClick={() => setPhase("setup")}>🔁 Retake (new attempt)</button>
                            <Link to="/dashboard" className="btn-ghost">Back to Dashboard</Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ---------- render: TEST ----------
    const codingQs = codingQ ? getCasesForQuestion(codingQ.id) : [];
    const mcq = mcqBank[mcqIndex];
    const answeredCount = Object.keys(mcqAnswers).length;

    return (
        <div className="page-shell">
            <Navbar />
            <div className="page-container wt-page">
                <div className="wt-bar glass">
                    <div className={`wt-timer ${remaining <= 60 ? "danger" : ""}`}>
                        ⏱ Coding: {fmt(remaining)}
                    </div>
                    <div className={`wt-timer ${mcqLeft <= 60 && section === "mcq" ? "danger" : ""}`}>
                        📝 MCQ: {fmt(mcqLeft)}
                    </div>
                    <div className={`wt-warnings ${warnings > 0 ? "hot" : ""}`}>
                        ⚠️ {warnings}/{maxWarnings}
                    </div>
                    <div className="wt-section-tabs">
                        <button className={section === "coding" ? "active" : ""} onClick={() => setSection("coding")}>
                            💻 Coding
                        </button>
                        <button className={section === "mcq" ? "active" : ""} onClick={() => setSection("mcq")}>
                            📝 MCQ ({answeredCount}/{mcqBank.length})
                        </button>
                    </div>
                    <button className="wt-finish" onClick={() => finish("submitted")} disabled={submitting}>
                        {submitting ? "Submitting…" : "🏁 Finish & Submit"}
                    </button>
                </div>

                {section === "coding" ? (
                    <div className="wt-coding fade-up">
                        <div className="wt-problem glass">
                            <div className="wt-problem-head">
                                <h2>{codingQ?.title || "Loading problem…"}</h2>
                                <span className={`wt-diff-tag ${difficulty.toLowerCase()}`}>{difficulty}</span>
                            </div>
                            <p>{codingQ?.problem}</p>
                            {codingQ?.input && (<><b>Input</b><pre>{codingQ.input}</pre></>)}
                            {codingQ?.output && (<><b>Output</b><pre>{codingQ.output}</pre></>)}
                            {codingQ?.constraints?.length > 0 && (
                                <>
                                    <b>Constraints</b>
                                    <ul>{codingQ.constraints.map((c) => <li key={c}>{c}</li>)}</ul>
                                </>
                            )}
                            <div className="wt-sample">
                                <b>Sample cases ({codingQs.length} total)</b>
                                {codingQs.slice(0, 2).map((c, i) => (
                                    <div key={i} className="wt-sample-case">
                                        <span>Case {i + 1}</span>
                                        <code>in: {c.input}</code>
                                        <code>out: {c.expected}</code>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="wt-editor glass">
                            <div className="wt-editor-head">
                                <select value={lang} onChange={(e) => setLang(e.target.value)}>
                                    <option value="java">Java</option>
                                    <option value="cpp">C++</option>
                                    <option value="python">Python</option>
                                    <option value="javascript">JavaScript</option>
                                </select>
                                <button onClick={runCoding} disabled={running || !code.trim()}>
                                    {running ? "⏳ Running…" : "▶ Run (first 5 cases)"}
                                </button>
                            </div>
                            <Editor
                                height="420px"
                                language={lang}
                                theme="vs-dark"
                                value={code}
                                onChange={(v) => setCode(v || "")}
                                options={{ fontSize: 14, minimap: { enabled: false }, automaticLayout: true, scrollBeyondLastLine: false }}
                            />
                            {runResult && (
                                <div className={`wt-run-result ${runResult.error ? "bad" : runResult.passed === runResult.total ? "good" : "mid"}`}>
                                    {runResult.error
                                        ? `⚠️ ${runResult.error}`
                                        : `✅ ${runResult.passed} / ${runResult.total} test cases passed`}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="wt-mcq glass fade-up">
                        <div className="wt-mcq-head">
                            <h2>📝 MCQ {mcqIndex + 1} / {mcqBank.length}</h2>
                            <span className="wt-mcq-topic">{mcq.topic}</span>
                        </div>

                        <p className="wt-mcq-q">{mcq.question}</p>

                        <div className="wt-mcq-opts">
                            {mcq.options.map((opt, i) => (
                                <button
                                    key={i}
                                    className={`wt-mcq-opt ${mcqAnswers[mcq.id] === i ? "sel" : ""}`}
                                    onClick={() => setMcqAnswers((a) => ({ ...a, [mcq.id]: i }))}
                                >
                                    <span className="wt-opt-key">{String.fromCharCode(65 + i)}</span>
                                    {opt}
                                </button>
                            ))}
                        </div>

                        <div className="wt-mcq-nav">
                            <button onClick={() => setMcqIndex((i) => Math.max(0, i - 1))} disabled={mcqIndex === 0}>
                                ← Prev
                            </button>
                            <button
                                className="wt-clear"
                                onClick={() => setMcqAnswers((a) => {
                                    const n = { ...a };
                                    delete n[mcq.id];
                                    return n;
                                })}
                            >
                                Clear
                            </button>
                            {mcqIndex < mcqBank.length - 1 ? (
                                <button className="btn-grad" onClick={() => setMcqIndex((i) => i + 1)}>
                                    Next →
                                </button>
                            ) : (
                                <button className="btn-grad" onClick={() => finish("submitted")}>
                                    🏁 Finish Test
                                </button>
                            )}
                        </div>

                        <div className="wt-mcq-dots">
                            {mcqBank.map((q) => (
                                <button
                                    key={q.id}
                                    className={`wt-dot ${mcqAnswers[q.id] != null ? "done" : ""} ${mcqIndex === mcqBank.indexOf(q) ? "cur" : ""}`}
                                    onClick={() => setMcqIndex(mcqBank.indexOf(q))}
                                    title={`Q${q.id}`}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default WeeklyTest;
