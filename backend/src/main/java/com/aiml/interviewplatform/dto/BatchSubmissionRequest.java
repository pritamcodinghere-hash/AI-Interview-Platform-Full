package com.aiml.interviewplatform.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public class BatchSubmissionRequest {

    @NotBlank
    private String code;

    private String language;

    private String questionTitle;

    @Valid
    @NotEmpty
    private List<TestCase> testCases;

    public static class TestCase {
        private String input;
        private String expected;

        public String getInput() { return input; }
        public void setInput(String input) { this.input = input; }
        public String getExpected() { return expected; }
        public void setExpected(String expected) { this.expected = expected; }
    }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }
    public String getQuestionTitle() { return questionTitle; }
    public void setQuestionTitle(String questionTitle) { this.questionTitle = questionTitle; }
    public List<TestCase> getTestCases() { return testCases; }
    public void setTestCases(List<TestCase> testCases) { this.testCases = testCases; }
}
