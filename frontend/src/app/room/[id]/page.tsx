"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUserStore } from "@/store/userStore";
import { getSocket } from "@/lib/socket";
import Editor from "@monaco-editor/react";

// ─── Types ──────────────────────────────────────────────────────────
interface TestResult {
  testCase: number;
  status: string;
  passed: boolean;
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  expected: string;
  time: string | null;
  memory: number | null;
}

interface ExecuteResponse {
  passed: number;
  total: number;
  allPassed: boolean;
  results: TestResult[];
}

interface MatchOverData {
  winnerId: string;
  winnerUsername: string;
  newWinnerElo: number;
  newLoserElo: number;
  winnerGain: number;
  loserLoss: number;
  duration: number;
}

// ─── Hardcoded Problem ──────────────────────────────────────────────
const PROBLEM = {
  id: "two_sum",
  title: "1. Two Sum",
  difficulty: "Easy",
  description: `Given an array of integers \`nums\` and an integer \`target\`, return indices of the two numbers such that they add up to \`target\`.

You may assume that each input would have **exactly one solution**, and you may not use the same element twice.

You can return the answer in any order.`,
  examples: [
    {
      input: "nums = [2,7,11,15], target = 9",
      output: "[0,1]",
      explanation: "Because nums[0] + nums[1] == 9, we return [0, 1].",
    },
    {
      input: "nums = [3,2,4], target = 6",
      output: "[1,2]",
      explanation: "",
    },
    {
      input: "nums = [3,3], target = 6",
      output: "[0,1]",
      explanation: "",
    },
  ],
  constraints: [
    "2 ≤ nums.length ≤ 10⁴",
    "-10⁹ ≤ nums[i] ≤ 10⁹",
    "-10⁹ ≤ target ≤ 10⁹",
    "Only one valid answer exists.",
  ],
};

const DEFAULT_CODE = `#include <bits/stdc++.h>
using namespace std;

class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        // Write your solution here
        
    }
};`;

const LANGUAGES = [
  { label: "C++", value: "cpp" },
  { label: "Python", value: "python" },
  { label: "JavaScript", value: "javascript" },
  { label: "Java", value: "java" },
] as const;

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

// ─── Component ──────────────────────────────────────────────────────
export default function RoomPage() {
  const { id: roomId } = useParams<{ id: string }>();
  const router = useRouter();
  const user = useUserStore((s) => s.user);

  // Editor state
  const [code, setCode] = useState(DEFAULT_CODE);
  const [language, setLanguage] = useState("cpp");

  // Execution state
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [execResult, setExecResult] = useState<ExecuteResponse | null>(null);
  const [execError, setExecError] = useState("");
  const [consoleOpen, setConsoleOpen] = useState(false);

  // Opponent & Match state
  const [opponentTyping, setOpponentTyping] = useState(false);
  const [opponentProgress, setOpponentProgress] = useState<{ username: string; passed: number; total: number } | null>(null);
  const [matchOverData, setMatchOverData] = useState<MatchOverData | null>(null);
  
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Socket listeners ──
  useEffect(() => {
    const socket = getSocket();

    const onOpponentTyping = () => {
      setOpponentTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setOpponentTyping(false), 2000);
    };

    const onOpponentProgress = ({ username, passed, total }: { username: string; passed: number; total: number }) => {
      setOpponentProgress({ username, passed, total });
      if (progressTimeoutRef.current) clearTimeout(progressTimeoutRef.current);
      progressTimeoutRef.current = setTimeout(() => setOpponentProgress(null), 8000);
    };

    const onMatchOver = (data: MatchOverData) => {
      setMatchOverData(data);
    };

    socket.on("opponent_typing", onOpponentTyping);
    socket.on("opponent_progress", onOpponentProgress);
    socket.on("match_over", onMatchOver);

    return () => {
      socket.off("opponent_typing", onOpponentTyping);
      socket.off("opponent_progress", onOpponentProgress);
      socket.off("match_over", onMatchOver);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (progressTimeoutRef.current) clearTimeout(progressTimeoutRef.current);
    };
  }, []);

  // ── Debounced code_update emitter ──
  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (matchOverData) return; // Disable typing if match over
      
      const newCode = value ?? "";
      setCode(newCode);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const socket = getSocket();
        socket.emit("code_update", { roomId, userId: user?.id });
      }, 300);
    },
    [roomId, user, matchOverData]
  );

  // ── Execute code ──
  const executeCode = useCallback(
    async (isSubmit: boolean) => {
      if (isSubmit) setSubmitting(true);
      else setRunning(true);

      setExecResult(null);
      setExecError("");
      setConsoleOpen(true);

      try {
        const res = await fetch(`${BACKEND_URL}/api/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_code: code,
            language_id: language,
            problem_id: PROBLEM.id,
          }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || `Server returned ${res.status}`);
        }

        const data: ExecuteResponse = await res.json();
        setExecResult(data);

        // Emit run_tests so opponent sees progress
        const socket = getSocket();
        socket.emit("run_tests", {
          roomId,
          userId: user?.id,
          username: user?.username,
          passed: data.passed,
          total: data.total,
        });

        // ── Win Condition ──
        if (isSubmit && data.allPassed) {
          socket.emit("match_won", { roomId, userId: user?.id });
        }
      } catch (err: unknown) {
        setExecError(err instanceof Error ? err.message : "Execution failed");
      } finally {
        setRunning(false);
        setSubmitting(false);
      }
    },
    [code, language, roomId, user]
  );

  return (
    <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
      {/* ─── Match Over Modal ─── */}
      {matchOverData && (
        <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface border border-border shadow-2xl rounded-2xl overflow-hidden animate-slide-up">
            <div className="p-8 text-center space-y-6">
              {matchOverData.winnerId === user?.id ? (
                <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-success to-accent">Victory!</h2>
              ) : (
                <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-danger to-accent">Defeat</h2>
              )}
              <p className="text-muted text-sm font-medium">
                {matchOverData.winnerId === user?.id 
                  ? "You solved the problem first!" 
                  : `${matchOverData.winnerUsername} solved the problem first!`}
              </p>
              
              <div className="space-y-4 pt-4 border-t border-border">
                {/* Current Player Stats */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Your Rating</span>
                  {matchOverData.winnerId === user?.id ? (
                    <span className="font-mono text-success font-bold">
                      {matchOverData.newWinnerElo - matchOverData.winnerGain} ➔ {matchOverData.newWinnerElo} (+{matchOverData.winnerGain})
                    </span>
                  ) : (
                    <span className="font-mono text-danger font-bold">
                      {matchOverData.newLoserElo - matchOverData.loserLoss} ➔ {matchOverData.newLoserElo} ({matchOverData.loserLoss})
                    </span>
                  )}
                </div>
                
                {/* Opponent Stats */}
                <div className="flex items-center justify-between text-sm text-muted">
                  <span>Opponent Rating</span>
                  {matchOverData.winnerId !== user?.id ? (
                    <span className="font-mono">
                      {matchOverData.newWinnerElo - matchOverData.winnerGain} ➔ {matchOverData.newWinnerElo} (+{matchOverData.winnerGain})
                    </span>
                  ) : (
                    <span className="font-mono">
                      {matchOverData.newLoserElo - matchOverData.loserLoss} ➔ {matchOverData.newLoserElo} ({matchOverData.loserLoss})
                    </span>
                  )}
                </div>
                
                <div className="flex items-center justify-between text-sm text-muted">
                  <span>Duration</span>
                  <span className="font-mono">{Math.floor(matchOverData.duration / 60)}:{(matchOverData.duration % 60).toString().padStart(2, '0')}</span>
                </div>
              </div>
            </div>
            <div className="p-4 bg-background border-t border-border flex justify-center">
              <button 
                onClick={() => router.push("/dashboard")}
                className="w-full px-4 py-3 bg-gradient-to-r from-primary to-accent text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Top Bar ─── */}
      <header className="flex items-center justify-between px-5 py-3 bg-surface border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-sm font-bold">
            ⚔
          </div>
          <span className="font-semibold text-foreground text-sm">
            Room{" "}
            <span className="font-mono text-primary">{roomId}</span>
          </span>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-3">
          {/* Opponent progress badge */}
          {opponentProgress && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 animate-slide-up">
              <span className="text-xs font-medium text-primary">
                🎯 {opponentProgress.username} passed {opponentProgress.passed}/{opponentProgress.total} tests
              </span>
            </div>
          )}

          {/* Opponent typing badge */}
          {opponentTyping && !opponentProgress && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 animate-slide-up">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
              </span>
              <span className="text-xs text-accent font-medium">
                Opponent is typing...
              </span>
            </div>
          )}

          <span className="text-xs font-mono text-muted">
            {user?.username ?? "—"}
          </span>
        </div>
      </header>

      {/* ─── Split Pane ─── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 min-h-0">
        {/* ═══════ LEFT: Problem Description ═══════ */}
        <section className="overflow-y-auto border-r border-border p-6 lg:p-8 scrollbar-thin">
          <div className="flex items-center gap-3 mb-6">
            <h1 className="text-xl font-bold text-foreground">
              {PROBLEM.title}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-success/15 text-success border border-success/25">
              {PROBLEM.difficulty}
            </span>
          </div>

          <div className="prose-invert text-sm text-foreground/85 leading-relaxed mb-8 space-y-3">
            {PROBLEM.description.split("\n\n").map((p, i) => (
              <p key={i} dangerouslySetInnerHTML={{ __html: p.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs font-mono">$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>') }} />
            ))}
          </div>

          <div className="space-y-4 mb-8">
            {PROBLEM.examples.map((ex, i) => (
              <div key={i} className="bg-background border border-border rounded-xl p-4">
                <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
                  Example {i + 1}
                </div>
                <div className="space-y-1.5 font-mono text-sm">
                  <div>
                    <span className="text-muted">Input: </span>
                    <span className="text-foreground">{ex.input}</span>
                  </div>
                  <div>
                    <span className="text-muted">Output: </span>
                    <span className="text-foreground">{ex.output}</span>
                  </div>
                  {ex.explanation && (
                    <div>
                      <span className="text-muted">Explanation: </span>
                      <span className="text-foreground/70">{ex.explanation}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Constraints</h3>
            <ul className="space-y-1.5">
              {PROBLEM.constraints.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground/70">
                  <span className="text-primary mt-0.5">•</span>
                  <code className="font-mono text-xs bg-primary/5 px-1.5 py-0.5 rounded">{c}</code>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ═══════ RIGHT: Code Editor + Console ═══════ */}
        <section className="flex flex-col min-h-0">
          {/* Language selector */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-surface border-b border-border shrink-0">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.value}
                onClick={() => setLanguage(lang.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer border ${
                  language === lang.value
                    ? "bg-primary/15 text-primary border-primary/30"
                    : "bg-transparent text-muted border-transparent hover:text-foreground hover:bg-surface-hover"
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>

          {/* Monaco Editor */}
          <div className={`min-h-0 ${consoleOpen ? "flex-[3]" : "flex-1"}`}>
            <Editor
              height="100%"
              language={language}
              value={code}
              onChange={handleEditorChange}
              theme="vs-dark"
              options={{
                fontSize: 14,
                fontFamily: "var(--font-geist-mono), Menlo, monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                padding: { top: 16, bottom: 16 },
                lineNumbers: "on",
                renderLineHighlight: "line",
                cursorBlinking: "smooth",
                cursorSmoothCaretAnimation: "on",
                smoothScrolling: true,
                tabSize: 4,
                wordWrap: "on",
                automaticLayout: true,
                readOnly: !!matchOverData // Disable editor when match is over
              }}
            />
          </div>

          {/* ═══════ Console Output Panel ═══════ */}
          {consoleOpen && (
            <div className="flex-[2] border-t border-border flex flex-col min-h-0 bg-background">
              {/* Console header */}
              <div className="flex items-center justify-between px-4 py-2 bg-surface border-b border-border shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-foreground">Console</span>
                  {execResult && (
                    <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${
                      execResult.allPassed
                        ? "bg-success/15 text-success"
                        : "bg-danger/15 text-danger"
                    }`}>
                      {execResult.passed}/{execResult.total} passed
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setConsoleOpen(false)}
                  className="text-muted hover:text-foreground text-xs cursor-pointer transition-colors"
                >
                  ✕ Close
                </button>
              </div>

              {/* Console body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {(running || submitting) && (
                  <div className="flex items-center gap-2 text-sm text-muted">
                    <svg className="animate-spin h-4 w-4 text-primary" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {submitting ? "Submitting..." : "Running tests..."}
                  </div>
                )}

                {execError && (
                  <div className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg p-3 font-mono">
                    ❌ {execError}
                  </div>
                )}

                {execResult && execResult.results.map((r) => (
                  <div
                    key={r.testCase}
                    className={`rounded-lg border p-3 ${
                      r.passed
                        ? "bg-success/5 border-success/20"
                        : r.status === "Skipped"
                        ? "bg-muted/5 border-border"
                        : "bg-danger/5 border-danger/20"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold">
                        {r.passed ? "✅" : r.status === "Skipped" ? "⏭️" : "❌"}{" "}
                        Test Case {r.testCase}
                      </span>
                      <span className={`text-xs font-mono ${
                        r.passed ? "text-success" : r.status === "Skipped" ? "text-muted" : "text-danger"
                      }`}>
                        {r.status}
                        {r.time && ` · ${r.time}s`}
                      </span>
                    </div>

                    {/* Compile error */}
                    {r.compile_output && (
                      <pre className="text-xs font-mono text-danger/80 mt-2 whitespace-pre-wrap break-words">
                        {r.compile_output}
                      </pre>
                    )}

                    {/* Runtime error */}
                    {r.stderr && !r.compile_output && (
                      <pre className="text-xs font-mono text-danger/80 mt-2 whitespace-pre-wrap break-words">
                        {r.stderr}
                      </pre>
                    )}

                    {/* Wrong answer: show stdout vs expected */}
                    {!r.passed && !r.compile_output && !r.stderr && r.stdout && (
                      <div className="mt-2 space-y-1 text-xs font-mono">
                        <div><span className="text-muted">Output:   </span><span className="text-foreground">{r.stdout}</span></div>
                        <div><span className="text-muted">Expected: </span><span className="text-success">{r.expected}</span></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between px-4 py-3 bg-surface border-t border-border shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted font-mono">{language.toUpperCase()}</span>
              {consoleOpen && execResult && (
                <span className="text-xs text-muted">
                  {execResult.allPassed ? "🎉 All tests passed!" : `${execResult.passed}/${execResult.total} tests passed`}
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => executeCode(false)}
                disabled={running || submitting || !!matchOverData}
                className="px-5 py-2 rounded-xl text-sm font-medium cursor-pointer
                           bg-background border border-border text-foreground
                           hover:bg-surface-hover hover:border-border-hover
                           disabled:opacity-50 disabled:cursor-not-allowed
                           transition-all duration-200"
              >
                {running ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Running...
                  </span>
                ) : (
                  "▶ Run Code"
                )}
              </button>
              <button
                onClick={() => executeCode(true)}
                disabled={running || submitting || !!matchOverData}
                className="px-5 py-2 rounded-xl text-sm font-semibold text-white cursor-pointer
                           bg-gradient-to-r from-success to-success/80
                           hover:from-success hover:to-success
                           disabled:opacity-50 disabled:cursor-not-allowed
                           transition-all duration-300
                           shadow-lg shadow-success/20 hover:shadow-success/40"
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Submitting...
                  </span>
                ) : (
                  "Submit ✓"
                )}
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
