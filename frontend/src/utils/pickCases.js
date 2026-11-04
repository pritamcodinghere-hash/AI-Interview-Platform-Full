import testCases from "../data/testCases";

/**
 * Returns the full list of test cases for a question id.
 * Each entry: { input, expected }
 */
export function getCasesForQuestion(questionId) {
    if (questionId == null) return [];
    const cases = testCases[questionId];
    if (!Array.isArray(cases)) return [];
    return cases.map((c) => ({
        input: c.input ?? "",
        expected: c.expected ?? "",
    }));
}

/**
 * Sample cases shown in the problem description (LeetCode shows 1-2).
 */
export function getSampleCases(questionId, limit = 2) {
    return getCasesForQuestion(questionId).slice(0, limit);
}
