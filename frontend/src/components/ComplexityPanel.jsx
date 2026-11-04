import { useState, useEffect } from "react";
import api from "../services/api";
import {
    isSolved,
    getBestSolutions,
    parseComplexity,
    recordComplexity,
} from "../utils/complexity";

/**
 * Complexity panel: shows solved status + best recorded complexity for the
 * current question, and analyzes the submitted code via
 * POST /api/gemini/complexity-only.
 */
function ComplexityPanel({ question, code, language }) {
    const [analysis, setAnalysis] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [tick, setTick] = useState(0); // refresh after external markSolved

    const title = question && typeof question === "object" ? question.title : null;
    const solved = title ? isSolved(title) : false;
    const best = title ? getBestSolutions()[title] : null;

    // Refresh when the editor's submit marks the question solved
    useEffect(() => {
        const id = setInterval(() => setTick((t) => t + 1), 1500);
        return () => clearInterval(id);
    }, []);

    const analyze = async () => {
        if (loading || !code?.trim()) return;
        setLoading(true);
        setError("");
        try {
            const res = await api.post(
                "/gemini/complexity-only",
                { code, language: language || "java" },
                { timeout: 60000 }
            );
            const text = res.data.analysis || res.data || "";
            setAnalysis(typeof text === "string" ? text : JSON.stringify(text));
            if (title) recordComplexity(title, text);
            setTick((t) => t + 1);
        } catch (e) {
            setError(e.response?.data?.message || "Could not analyze complexity.");
        } finally {
            setLoading(false);
        }
    };

    const parsed = parseComplexity(analysis);

    return (
        <div className="cxp" data-tick={tick}>
            <div className="cxp-head">
                <h3>📊 Complexity Tracker</h3>
                <span className={`cxp-badge ${solved ? "solved" : ""}`}>
                    {solved ? "✅ Solved" : "🔓 Unsolved"}
                </span>
            </div>

            {title && (
                <div className="cxp-title">{title}</div>
            )}

            {best && (
                <div className="cxp-best">
                    <span>Best so far</span>
                    <code>{best.time}</code>
                    {best.space && (
                        <>
                            <span>space</span>
                            <code>{best.space}</code>
                        </>
                    )}
                </div>
            )}

            <button className="cxp-btn" onClick={analyze} disabled={loading || !code?.trim()}>
                {loading ? "⏳ Analyzing…" : "🔍 Analyze my solution"}
            </button>

            {error && <div className="cxp-error">⚠️ {error}</div>}

            {analysis && !error && (
                <div className="cxp-result">
                    {parsed.time && <div className="cxp-line">⏱ Time: <b>{parsed.time}</b></div>}
                    {parsed.space && <div className="cxp-line">💾 Space: <b>{parsed.space}</b></div>}
                    <pre>{analysis}</pre>
                </div>
            )}
        </div>
    );
}

export default ComplexityPanel;
