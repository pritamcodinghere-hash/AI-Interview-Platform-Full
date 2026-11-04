import { useState } from "react";
import api from "../services/api";
import { getCasesForQuestion } from "../utils/pickCases";
import { markSolved } from "../utils/complexity";

/**
 * LeetCode-style bottom test panel.
 * Tabs: Test Results (expected vs my output, N/M counts) and Console.
 * NOTE: parent passes `key={question.id}` so state resets per question.
 */
function CodingBottomPanel({ question, code, language, output, input, setInput }) {
    const [tab, setTab] = useState("tests");
    const [results, setResults] = useState(null); // { passed, total, results: [...] }
    const [running, setRunning] = useState(false);
    const [error, setError] = useState("");
    const [selected, setSelected] = useState(0);

    const questionId = question && typeof question === "object" ? question.id : null;
    const cases = questionId != null ? getCasesForQuestion(questionId) : [];

    const runTests = async () => {
        if (running || !questionId || cases.length === 0) return;
        setRunning(true);
        setError("");
        setTab("tests");
        try {
            const res = await api.post(
                "/submission",
                {
                    code,
                    language,
                    questionTitle: question.title || `Question ${questionId}`,
                    testCases: cases,
                },
                { timeout: 120000 }
            );
            setResults(res.data);
            const idx = res.data.results.findIndex((r) => !r.passed);
            setSelected(idx === -1 ? 0 : idx);
            if (res.data.total > 0 && res.data.passed === res.data.total) {
                markSolved(question.title || `Question ${questionId}`);
            }
        } catch (e) {
            setError(e.response?.data?.message || e.message || "Submission failed");
        } finally {
            setRunning(false);
        }
    };

    const current = results?.results?.[selected];
    const passedCount = results?.passed ?? 0;
    const totalCount = results?.total ?? cases.length;

    return (
        <div className="cbp">
            <div className="cbp-head">
                <div className="cbp-tabs">
                    <button
                        className={`cbp-tab ${tab === "tests" ? "active" : ""}`}
                        onClick={() => setTab("tests")}
                    >
                        🧪 Test Results
                    </button>
                    <button
                        className={`cbp-tab ${tab === "console" ? "active" : ""}`}
                        onClick={() => setTab("console")}
                    >
                        🖥️ Console
                    </button>
                </div>

                <div className="cbp-head-right">
                    {results && tab === "tests" && (
                        <span className={`cbp-score ${passedCount === totalCount ? "all-pass" : "some-fail"}`}>
                            {passedCount} / {totalCount} passed
                        </span>
                    )}
                    <button className="cbp-run" onClick={runTests} disabled={running || cases.length === 0}>
                        {running ? "⏳ Running…" : "▶ Run Test Cases"}
                    </button>
                </div>
            </div>

            {tab === "tests" && (
                <div className="cbp-body">
                    {cases.length === 0 && (
                        <p className="cbp-empty">No test cases found for this question.</p>
                    )}

                    {cases.length > 0 && !results && !running && (
                        <div className="cbp-empty">
                            <p>
                                {cases.length} test cases loaded — press <b>▶ Run Test Cases</b> to check
                                your solution against all of them.
                            </p>
                            <ul className="cbp-case-list">
                                {cases.slice(0, 2).map((c, i) => (
                                    <li key={i}>
                                        <b>Case {i + 1}</b> — input: <code>{c.input}</code> → expected:{" "}
                                        <code>{c.expected}</code>
                                    </li>
                                ))}
                                {cases.length > 2 && (
                                    <li className="cbp-muted">… and {cases.length - 2} more cases</li>
                                )}
                            </ul>
                        </div>
                    )}

                    {running && (
                        <div className="cbp-empty cbp-loading">
                            <span className="cbp-spinner" /> Compiling once and running {cases.length} test
                            cases…
                        </div>
                    )}

                    {error && <div className="cbp-error">⚠️ {error}</div>}

                    {results && !running && (
                        <div className="cbp-results">
                            <div className="cbp-case-tabs">
                                {results.results.map((r, i) => (
                                    <button
                                        key={i}
                                        className={`cbp-case-tab ${r.passed ? "pass" : "fail"} ${
                                            selected === i ? "sel" : ""
                                        }`}
                                        onClick={() => setSelected(i)}
                                    >
                                        {r.passed ? "✅" : "❌"} {i + 1}
                                    </button>
                                ))}
                            </div>

                            {current && (
                                <div className="cbp-compare">
                                    <div className="cbp-col">
                                        <h4>Expected Output</h4>
                                        <pre>{current.expected}</pre>
                                    </div>
                                    <div className={`cbp-col ${current.passed ? "ok" : "bad"}`}>
                                        <h4>
                                            My Output {current.passed ? "✅" : "❌"}
                                        </h4>
                                        <pre>{current.actual || "(no output)"}</pre>
                                    </div>
                                </div>
                            )}

                            <div className="cbp-input-row">
                                <span>Input:</span>
                                <code>{current?.input}</code>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {tab === "console" && (
                <div className="cbp-body cbp-console">
                    <div className="cbp-stdin">
                        <label htmlFor="cbp-stdin">Custom Input (stdin)</label>
                        <textarea
                            id="cbp-stdin"
                            rows={3}
                            value={input}
                            onChange={(e) => setInput?.(e.target.value)}
                            placeholder="Enter input passed to your program on stdin…"
                        />
                    </div>
                    <pre>{output || "Run your code with ▶ Run to see output here."}</pre>
                </div>
            )}
        </div>
    );
}

export default CodingBottomPanel;
