package com.aiml.interviewplatform.controller;

import com.aiml.interviewplatform.service.GeminiService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/learn")
public class LearnController {

    private final GeminiService geminiService;

    public LearnController(GeminiService geminiService) {
        this.geminiService = geminiService;
    }

    /**
     * Learn Hub AI tutor.
     * Payload: { question: "...", topic: "..." }
     * Response: { answer: "..." }
     */
    @PostMapping("/ask")
    public ResponseEntity<?> ask(@RequestBody Map<String, String> request) {
        String question = request == null ? null : request.get("question");
        if (question == null || question.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "question is required"));
        }
        try {
            String answer = geminiService.askTutor(question.trim());
            if (answer == null || answer.isBlank()) {
                answer = "I couldn't generate a response right now. Please try again.";
            }
            return ResponseEntity.ok(Map.of("answer", answer));
        } catch (Exception e) {
            return ResponseEntity.status(502)
                    .body(Map.of("message", "Could not reach the AI tutor. Please try again."));
        }
    }
}
