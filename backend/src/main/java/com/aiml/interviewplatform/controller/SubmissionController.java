package com.aiml.interviewplatform.controller;

import com.aiml.interviewplatform.dto.BatchSubmissionRequest;
import com.aiml.interviewplatform.dto.SubmissionResponse;
import com.aiml.interviewplatform.dto.TestCaseResult;
import com.aiml.interviewplatform.entity.CodingSubmission;
import com.aiml.interviewplatform.service.CodeExecutionService;
import com.aiml.interviewplatform.service.CodingSubmissionService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/submission")
public class SubmissionController {

    private final CodeExecutionService codeExecutionService;
    private final CodingSubmissionService submissionService;

    public SubmissionController(CodeExecutionService codeExecutionService,
                                CodingSubmissionService submissionService) {
        this.codeExecutionService = codeExecutionService;
        this.submissionService = submissionService;
    }

    /**
     * Normalizes an output string for comparison:
     * trims, and strips whitespace around , [ ] ( ) { } and ->.
     * Quotes are intentionally NOT stripped.
     */
    static String norm(String s) {
        if (s == null) return "";
        String t = s.trim();
        t = t.replaceAll("\\s*([,\\[\\](){}])\\s*", "$1");
        t = t.replaceAll("\\s*->\\s*", "->");
        return t;
    }

    /**
     * Batch submission: compiles once, runs every test case, grades with norm().
     * Payload: { code, language, questionTitle, testCases: [{ input, expected }] }
     */
    @PostMapping
    public ResponseEntity<?> submit(@RequestBody BatchSubmissionRequest request,
                                    Authentication authentication) {
        if (request == null || request.getCode() == null || request.getCode().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Code is required"));
        }
        if (request.getTestCases() == null || request.getTestCases().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "At least one test case is required"));
        }
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
        }

        List<String> inputs = new ArrayList<>();
        List<String> expecteds = new ArrayList<>();
        for (BatchSubmissionRequest.TestCase tc : request.getTestCases()) {
            inputs.add(tc.getInput() == null ? "" : tc.getInput());
            expecteds.add(tc.getExpected() == null ? "" : tc.getExpected());
        }

        List<String> actuals;
        try {
            actuals = codeExecutionService.executeBatch(request.getCode(), request.getLanguage(), inputs);
        } catch (Exception e) {
            // Compilation failure — every case fails with the compiler message.
            String msg = e.getMessage() == null ? "Compilation Error" : e.getMessage();
            List<TestCaseResult> results = new ArrayList<>();
            for (int i = 0; i < inputs.size(); i++) {
                results.add(new TestCaseResult(inputs.get(i), expecteds.get(i), msg, false));
            }
            return ResponseEntity.ok(new SubmissionResponse(0, inputs.size(), results));
        }

        List<TestCaseResult> results = new ArrayList<>();
        int passed = 0;
        for (int i = 0; i < inputs.size(); i++) {
            String actual = actuals.get(i);
            boolean ok = norm(actual).equals(norm(expecteds.get(i)));
            if (ok) passed++;
            results.add(new TestCaseResult(inputs.get(i), expecteds.get(i), actual, ok));
        }

        // Persist a summary of the attempt (best-effort).
        try {
            CodingSubmission submission = new CodingSubmission();
            submission.setUsername(authentication.getName());
            submission.setQuestion(request.getQuestionTitle() != null ? request.getQuestionTitle() : "Unknown");
            submission.setLanguage(request.getLanguage() != null ? request.getLanguage() : "java");
            submission.setCode(request.getCode());
            submission.setPassed(passed);
            submission.setTotal(inputs.size());
            submission.setScore(inputs.size() == 0 ? 0 : (passed * 100) / inputs.size());
            submissionService.saveSubmission(submission);
        } catch (Exception ignored) {
            // Never fail the submission because of persistence issues.
        }

        return ResponseEntity.ok(new SubmissionResponse(passed, inputs.size(), results));
    }
}
