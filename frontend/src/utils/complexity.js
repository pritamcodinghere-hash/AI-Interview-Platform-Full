const SOLVED_KEY = "aip.solvedTitles";
const BEST_KEY = "aip.bestSolutions";

/**
 * Rank of common complexity classes — lower is better.
 * Used to keep the *best* solution recorded per question.
 */
export const CX_RANK = {
    "O(1)": 1,
    "O(log n)": 2,
    "O(log n)^2": 3,
    "O(sqrt n)": 4,
    "O(n)": 5,
    "O(n log n)": 6,
    "O(n log n)^2": 7,
    "O(n^2)": 8,
    "O(n^2 log n)": 9,
    "O(n^3)": 10,
    "O(n^4)": 11,
    "O(2^n)": 12,
    "O(2^n * n)": 13,
    "O(3^n)": 14,
    "O(n!)": 15,
    "O(n^n)": 16,
};

function readJson(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        const val = JSON.parse(raw);
        return val == null ? fallback : val;
    } catch {
        return fallback;
    }
}

function writeJson(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        /* storage full / unavailable — tracking is best-effort */
    }
}

export function getSolvedTitles() {
    const v = readJson(SOLVED_KEY, []);
    return Array.isArray(v) ? v : [];
}

export function isSolved(title) {
    if (!title) return false;
    return getSolvedTitles().includes(title);
}

export function getBestSolutions() {
    const v = readJson(BEST_KEY, {});
    return v && typeof v === "object" ? v : {};
}

/**
 * Marks a question as solved (all test cases passed).
 */
export function markSolved(title) {
    if (!title) return;
    const solved = getSolvedTitles();
    if (!solved.includes(title)) {
        solved.push(title);
        writeJson(SOLVED_KEY, solved);
    }
}

/** Extracts "O(...)" classes from a complexity analysis string. */
export function parseComplexity(analysis) {
    const text = String(analysis || "");
    const time = text.match(/Time:\s*(O\([^)\n]*\))/i)?.[1] || null;
    const space = text.match(/Space:\s*(O\([^)\n]*\))/i)?.[1] || null;
    return { time, space };
}

export function rankOf(cls) {
    if (!cls) return null;
    const normalized = cls.replace(/\s+/g, "").toLowerCase();
    for (const [key, rank] of Object.entries(CX_RANK)) {
        if (key.replace(/\s+/g, "").toLowerCase() === normalized) return rank;
    }
    return null;
}

/**
 * Records the analyzed complexity for a question, keeping the best
 * (lowest-ranked) time complexity seen so far.
 * Returns { time, space, best }.
 */
export function recordComplexity(title, analysis) {
    const { time, space } = parseComplexity(analysis);
    if (!title || !time) return { time, space, best: time };

    const best = getBestSolutions();
    const prevRank = best[title] ? rankOf(best[title].time) : null;
    const newRank = rankOf(time);
    const improved = prevRank == null || (newRank != null && newRank < prevRank);

    if (improved) {
        best[title] = { time, space, at: Date.now() };
        writeJson(BEST_KEY, best);
    }
    return { time, space, best: improved ? time : best[title]?.time || time };
}
