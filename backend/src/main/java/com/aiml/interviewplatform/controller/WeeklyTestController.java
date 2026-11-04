package com.aiml.interviewplatform.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.*;

/**
 * Weekly Coding Test API.
 *
 * The test itself (questions + MCQs) is served from the frontend data files
 * (mcqBank.js / questions.js); this controller manages attempt metadata:
 * start time, progress heartbeat, warnings, and final submission.
 *
 * Rules enforced here:
 *  - Easy 15 / Medium 25 / Hard 50 minutes for the coding round
 *  - + 15 minutes for MCQs
 *  - MAX_WARNINGS = 5 proctor violations → auto-submit
 */
@RestController
@RequestMapping("/api/weekly-test")
public class WeeklyTestController {

    public static final int MAX_WARNINGS = 5;
    public static final int EASY_MINUTES = 15;
    public static final int MEDIUM_MINUTES = 25;
    public static final int HARD_MINUTES = 50;
    public static final int MCQ_MINUTES = 15;

    /** In-memory attempt state per user (single-node dev server). */
    private static final Map<String, Attempt> ATTEMPTS = new ConcurrentHashMapSafe();

    public static class Attempt {
        public String username;
        public String difficulty;
        public long startedAt;
        public long deadline;
        public int warnings;
        public boolean submitted;
        public Map<String, Object> result;
    }

    /** Simple thread-safe map wrapper. */
    private static class ConcurrentHashMapSafe extends HashMap<String, Attempt> {
        @Override public synchronized Attempt put(String k, Attempt v) { return super.put(k, v); }
        @Override public synchronized Attempt get(Object k) { return super.get(k); }
        @Override public synchronized Attempt remove(Object k) { return super.remove(k); }
    }

    @GetMapping("/config")
    public ResponseEntity<?> config() {
        return ResponseEntity.ok(Map.of(
                "maxWarnings", MAX_WARNINGS,
                "easyMinutes", EASY_MINUTES,
                "mediumMinutes", MEDIUM_MINUTES,
                "hardMinutes", HARD_MINUTES,
                "mcqMinutes", MCQ_MINUTES,
                "weekOf", weekId()
        ));
    }

    @PostMapping("/start")
    public ResponseEntity<?> start(@RequestBody(required = false) Map<String, String> body,
                                   Authentication auth) {
        if (auth == null) return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
        String difficulty = body == null || body.get("difficulty") == null
                ? "Medium" : body.get("difficulty");

        int minutes;
        switch (difficulty.toLowerCase()) {
            case "easy": minutes = EASY_MINUTES; break;
            case "hard": minutes = HARD_MINUTES; break;
            default: minutes = MEDIUM_MINUTES;
        }

        Attempt a = new Attempt();
        a.username = auth.getName();
        a.difficulty = difficulty;
        a.startedAt = System.currentTimeMillis();
        a.deadline = a.startedAt + minutes * 60_000L;
        a.warnings = 0;
        a.submitted = false;
        ATTEMPTS.put(auth.getName(), a);

        return ResponseEntity.ok(Map.of(
                "startedAt", a.startedAt,
                "deadline", a.deadline,
                "minutes", minutes,
                "maxWarnings", MAX_WARNINGS,
                "weekOf", weekId()
        ));
    }

    @PostMapping("/warning")
    public ResponseEntity<?> warning(@RequestBody(required = false) Map<String, String> body,
                                     Authentication auth) {
        if (auth == null) return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
        Attempt a = ATTEMPTS.get(auth.getName());
        if (a == null || a.submitted) {
            return ResponseEntity.badRequest().body(Map.of("message", "No active test"));
        }
        a.warnings++;
        boolean exceeded = a.warnings >= MAX_WARNINGS;
        if (exceeded) {
            a.submitted = true;
        }
        return ResponseEntity.ok(Map.of(
                "warnings", a.warnings,
                "maxWarnings", MAX_WARNINGS,
                "exceeded", exceeded
        ));
    }

    @GetMapping("/status")
    public ResponseEntity<?> status(Authentication auth) {
        if (auth == null) return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
        Attempt a = ATTEMPTS.get(auth.getName());
        if (a == null) {
            return ResponseEntity.ok(Map.of("active", false));
        }
        boolean expired = System.currentTimeMillis() > a.deadline;
        return ResponseEntity.ok(Map.of(
                "active", !a.submitted && !expired,
                "difficulty", a.difficulty,
                "startedAt", a.startedAt,
                "deadline", a.deadline,
                "warnings", a.warnings,
                "maxWarnings", MAX_WARNINGS,
                "expired", expired,
                "submitted", a.submitted
        ));
    }

    @PostMapping("/submit")
    public ResponseEntity<?> submit(@RequestBody(required = false) Map<String, Object> payload,
                                    Authentication auth) {
        if (auth == null) return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
        Attempt a = ATTEMPTS.get(auth.getName());
        if (a == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "No active test to submit"));
        }
        a.submitted = true;
        a.result = payload == null ? Map.of() : payload;
        return ResponseEntity.ok(Map.of(
                "submitted", true,
                "warnings", a.warnings,
                "weekOf", weekId()
        ));
    }

    /** ISO-ish week id so results group by week (e.g. "2026-W45"). */
    private String weekId() {
        LocalDate d = LocalDate.now();
        int week = d.get(java.time.temporal.WeekFields.ISO.weekOfWeekBasedYear());
        return d.getYear() + "-W" + String.format("%02d", week);
    }
}
