package com.aiml.interviewplatform.service;

import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;

@Service
public class CodeExecutionService {

    private static final long CASE_TIMEOUT_MS = 3000;

    // ---------- legacy single-case execution (used by /api/compiler/run) ----------

    public String executeJava(String code, String input) throws Exception {
        Path dir = Files.createTempDirectory("compiler");
        try {
            Path src = dir.resolve("Main.java");
            Files.writeString(src, wrapLegacyJava(code));
            Process compile = new ProcessBuilder("javac", "-encoding", "UTF-8", src.toString())
                    .redirectErrorStream(true).start();
            String compileOut = readStream(compile.getInputStream());
            if (!compile.waitFor(15, TimeUnit.SECONDS) || compile.exitValue() != 0) {
                throw new RuntimeException("Compilation Error\n" + compileOut);
            }
            Process run = new ProcessBuilder("java", "-cp", dir.toString(), "Main")
                    .redirectErrorStream(true).start();
            if (input != null) {
                try (OutputStream os = run.getOutputStream()) {
                    os.write(input.getBytes());
                    os.flush();
                }
            }
            String out = readStream(run.getInputStream());
            if (!run.waitFor(5, TimeUnit.SECONDS)) { run.destroyForcibly(); throw new RuntimeException("Execution timed out"); }
            return out;
        } finally {
            deleteRecursively(dir);
        }
    }

    private String wrapLegacyJava(String code) {
        if (code.contains("class Main") || code.contains("public class Main")) return code;
        return "import java.util.*;\nimport java.io.*;\npublic class Main {\n" +
                "  public static void main(String[] a) throws Exception {\n" +
                "    BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n" +
                "    String line; StringBuilder sb = new StringBuilder();\n" +
                "    while ((line = br.readLine()) != null) sb.append(line).append('\\n');\n" +
                "    System.out.print(solution(sb.toString().trim()));\n" +
                "  }\n" +
                "  static String solution(String input) { return \"\"; }\n" +
                "}\n";
    }

    // ---------- batch execution (compile once, run all cases) ----------

    /**
     * Executes the submitted code against every test case.
     * Compiles once (for compiled languages), then runs each case with its input on stdin.
     * Returns one stdout string per test case (in order).
     */
    public List<String> executeBatch(String code, String language, List<String> inputs) throws Exception {
        String lang = language == null ? "java" : language.trim().toLowerCase();
        switch (lang) {
            case "python": case "python3": case "py":
                return runInterpreted("python", code, inputs, ".py");
            case "javascript": case "js": case "node":
                return runInterpreted("node", code, inputs, ".js");
            case "cpp": case "c++":
                return runCompiled(new String[]{"g++", "-O2", "-std=c++17", "-o"}, code, inputs, ".cpp", "sol");
            case "c":
                return runCompiled(new String[]{"gcc", "-O2", "-o"}, code, inputs, ".c", "sol");
            case "java":
            default:
                return runJavaBatch(code, inputs);
        }
    }

    private List<String> runInterpreted(String exe, String code, List<String> inputs, String ext) throws Exception {
        Path dir = Files.createTempDirectory("exec");
        try {
            Path src = dir.resolve("solution" + ext);
            Files.writeString(src, code);
            List<String> outputs = new ArrayList<>();
            for (String input : inputs) {
                outputs.add(runWithInput(exe, Collections.singletonList(src.toString()), input, dir));
            }
            return outputs;
        } finally {
            deleteRecursively(dir);
        }
    }

    private List<String> runCompiled(String[] compilerBase, String code, List<String> inputs, String ext, String binName) throws Exception {
        Path dir = Files.createTempDirectory("exec");
        try {
            Path src = dir.resolve("solution" + ext);
            Files.writeString(src, code);
            Path bin = dir.resolve(binName);
            List<String> cmd = new ArrayList<>(Arrays.asList(compilerBase));
            cmd.add(bin.toString());
            cmd.add(src.toString());
            Process compile = new ProcessBuilder(cmd).redirectErrorStream(true).start();
            String compileOut = readStream(compile.getInputStream());
            if (!compile.waitFor(20, TimeUnit.SECONDS) || compile.exitValue() != 0) {
                throw new RuntimeException("Compilation Error\n" + compileOut);
            }
            List<String> outputs = new ArrayList<>();
            for (String input : inputs) {
                outputs.add(runWithInput(bin.toString(), Collections.emptyList(), input, dir));
            }
            return outputs;
        } finally {
            deleteRecursively(dir);
        }
    }

    private List<String> runJavaBatch(String code, List<String> inputs) throws Exception {
        Path dir = Files.createTempDirectory("exec");
        try {
            Path src = dir.resolve("Solution.java");
            Files.writeString(src, ensureJavaClassName(code, "Solution"));
            Process compile = new ProcessBuilder("javac", "-encoding", "UTF-8", "-d", dir.toString(), src.toString())
                    .redirectErrorStream(true).start();
            String compileOut = readStream(compile.getInputStream());
            if (!compile.waitFor(20, TimeUnit.SECONDS) || compile.exitValue() != 0) {
                throw new RuntimeException("Compilation Error\n" + compileOut);
            }
            List<String> outputs = new ArrayList<>();
            for (String input : inputs) {
                outputs.add(runWithInput("java", Arrays.asList("-cp", dir.toString(), "Solution"), input, dir));
            }
            return outputs;
        } finally {
            deleteRecursively(dir);
        }
    }

    private String runWithInput(String exe, List<String> args, String input, Path workDir) throws Exception {
        List<String> cmd = new ArrayList<>();
        cmd.add(exe);
        cmd.addAll(args);
        ProcessBuilder pb = new ProcessBuilder(cmd);
        pb.directory(workDir.toFile());
        pb.redirectErrorStream(true);
        Process p = pb.start();

        // write input to stdin on a separate thread (large inputs can block)
        Thread writer = new Thread(() -> {
            try (OutputStream os = p.getOutputStream()) {
                if (input != null) os.write(input.getBytes());
                os.flush();
            } catch (IOException ignored) { }
        });
        writer.setDaemon(true);
        writer.start();

        Future<String> outFuture = EXECUTOR.submit(() -> readStream(p.getInputStream()));
        String out;
        try {
            if (!p.waitFor(CASE_TIMEOUT_MS, TimeUnit.MILLISECONDS)) {
                p.destroyForcibly();
                return "Runtime Error / Execution timed out (3s)";
            }
            out = outFuture.get(1, TimeUnit.SECONDS);
        } catch (TimeoutException e) {
            p.destroyForcibly();
            return "Runtime Error / Execution timed out (3s)";
        } finally {
            writer.interrupt();
        }
        if (p.exitValue() != 0 && (out == null || out.isBlank())) {
            return "Runtime Error (exit " + p.exitValue() + ")";
        }
        return out == null ? "" : out;
    }

    // ---------- helpers ----------

    private static final ExecutorService EXECUTOR = Executors.newCachedThreadPool(r -> {
        Thread t = new Thread(r, "exec-reader");
        t.setDaemon(true);
        return t;
    });

    private String ensureJavaClassName(String code, String className) {
        // If the code declares a different public class name, rewrite it to match the file name.
        java.util.regex.Matcher m = java.util.regex.Pattern
                .compile("public\\s+class\\s+(\\w+)").matcher(code);
        if (m.find() && !m.group(1).equals(className)) {
            return code.substring(0, m.start(1)) + className + code.substring(m.end(1));
        }
        if (!m.find()) {
            return "class " + className + " {\n" + code + "\n}";
        }
        return code;
    }

    private String readStream(InputStream is) throws IOException {
        StringBuilder sb = new StringBuilder();
        byte[] buf = new byte[8192];
        int n;
        while ((n = is.read(buf)) != -1) sb.append(new String(buf, 0, n));
        return sb.toString();
    }

    private void deleteRecursively(Path dir) {
        try {
            Files.walk(dir).sorted(Comparator.reverseOrder()).forEach(p -> {
                try { Files.deleteIfExists(p); } catch (IOException ignored) { }
            });
        } catch (IOException ignored) { }
    }
}
