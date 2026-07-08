"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUserStore } from "@/store/userStore";
import { useRoomStore } from "@/store/roomStore";
import { getSocket } from "@/lib/socket";
import { authClient } from "@/lib/authClient";
import Editor from "@monaco-editor/react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Swords,
  Flag,
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
  ArrowRight,
} from "lucide-react";

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

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

// ─── Component ──────────────────────────────────────────────────────
export default function RoomPage() {
  const { id: roomId } = useParams<{ id: string }>();
  const router = useRouter();

  const { data, isPending } = authClient.useSession();
  const user = useUserStore((s) => s.user);
  const setUser = useUserStore((s) => s.setUser);
  const problem = useRoomStore((s) => s.problem);

  useEffect(() => {
    if (!problem) router.replace("/dashboard");
  }, [problem, router]);

  // ── Sync Session to Local Store ──
  useEffect(() => {
    if (data?.user && !user) {
      setUser(data.user as any);
    }
  }, [data, user, setUser]);

  // ── Handle Unauthorized State (Redirect) ──
  useEffect(() => {
    if (!isPending && !data?.session && !user) {
      router.replace("/");
    }
  }, [isPending, data, user, router]);

  // Editor state
  const [code, setCode] = useState(DEFAULT_CODE);
  const [language, setLanguage] = useState("cpp");

  // Execution state
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [execResult, setExecResult] = useState<ExecuteResponse | null>(null);
  const [execError, setExecError] = useState("");
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [showForfeitModal, setShowForfeitModal] = useState(false);

  // Opponent & Match state
  const [opponentTyping, setOpponentTyping] = useState(false);
  const [opponentProgress, setOpponentProgress] = useState<{
    username: string;
    passed: number;
    total: number;
  } | null>(null);
  const [matchOverData, setMatchOverData] = useState<MatchOverData | null>(
    null
  );

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // ── Socket listeners ──
  useEffect(() => {
    const socket = getSocket();

    const onOpponentTyping = () => {
      setOpponentTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(
        () => setOpponentTyping(false),
        2000
      );
    };

    const onOpponentProgress = ({
      username,
      passed,
      total,
    }: {
      username: string;
      passed: number;
      total: number;
    }) => {
      setOpponentProgress({ username, passed, total });
      if (progressTimeoutRef.current)
        clearTimeout(progressTimeoutRef.current);
      progressTimeoutRef.current = setTimeout(
        () => setOpponentProgress(null),
        8000
      );
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
      if (progressTimeoutRef.current)
        clearTimeout(progressTimeoutRef.current);
    };
  }, []);

  // ── Debounced code_update emitter ──
  const handleEditorChange = useCallback(
    (val: string | undefined) => {
      if (matchOverData) return;
      const newVal = val || "";
      setCode(newVal);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const socket = getSocket();
        socket.emit("code_update", { roomId, userId: user?.id });
      }, 300);
    },
    [roomId, user, matchOverData]
  );

  const handleForfeit = useCallback(() => {
    const socket = getSocket();
    socket.emit("forfeit_match", { roomId, userId: user?.id });
    setShowForfeitModal(false);
  }, [roomId, user]);

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
            problem_id: problem?.id || "two_sum",
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
        setExecError(
          err instanceof Error ? err.message : "Execution failed"
        );
      } finally {
        setRunning(false);
        setSubmitting(false);
      }
    },
    [code, language, roomId, user]
  );

  // ── Loading / Auth Guards ──
  if (isPending) return <LoadingSpinner message="Loading session..." />;
  if (!isPending && !data?.session && !user) return null;

  const isWinner = matchOverData?.winnerId === user?.id;

  return (
    <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
      {/* ─── Forfeit Confirmation Dialog ─── */}
      <Dialog
        open={showForfeitModal && !matchOverData}
        onOpenChange={setShowForfeitModal}
      >
        <DialogContent className="sm:max-w-sm text-center">
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>
            <DialogDescription>
              You will instantly lose Elo rating and the match will end.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-4 justify-center pt-4">
            <Button
              variant="destructive"
              onClick={handleForfeit}
              className="flex-1 cursor-pointer"
            >
              Yes, Forfeit
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowForfeitModal(false)}
              className="flex-1 cursor-pointer"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Match Over Dialog ─── */}
      <Dialog open={!!matchOverData} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <div className="text-center flex flex-col gap-6">
            <h2
              className={`text-2xl font-semibold ${
                isWinner ? "text-success" : "text-destructive"
              }`}
            >
              {isWinner ? "🏆 Victory!" : "💀 Defeat"}
            </h2>
            <p className="text-sm font-medium text-muted-foreground">
              {isWinner
                ? "You solved the problem first!"
                : `${matchOverData?.winnerUsername} solved the problem first!`}
            </p>

            {matchOverData && (
              <div className="flex flex-col gap-3 pt-4 border-t border-border text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Your Rating</span>
                  {isWinner ? (
                    <span className="font-mono font-semibold text-success">
                      {matchOverData.newWinnerElo -
                        matchOverData.winnerGain}{" "}
                      → {matchOverData.newWinnerElo} (+
                      {matchOverData.winnerGain})
                    </span>
                  ) : (
                    <span className="font-mono font-semibold text-destructive">
                      {matchOverData.newLoserElo -
                        matchOverData.loserLoss}{" "}
                      → {matchOverData.newLoserElo} (
                      {matchOverData.loserLoss})
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Opponent Rating</span>
                  {!isWinner ? (
                    <span className="font-mono">
                      {matchOverData.newWinnerElo -
                        matchOverData.winnerGain}{" "}
                      → {matchOverData.newWinnerElo} (+
                      {matchOverData.winnerGain})
                    </span>
                  ) : (
                    <span className="font-mono">
                      {matchOverData.newLoserElo -
                        matchOverData.loserLoss}{" "}
                      → {matchOverData.newLoserElo} (
                      {matchOverData.loserLoss})
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Duration</span>
                  <span className="font-mono">
                    {Math.floor(matchOverData.duration / 60)}:
                    {(matchOverData.duration % 60)
                      .toString()
                      .padStart(2, "0")}
                  </span>
                </div>
              </div>
            )}

            <Button
              onClick={() => router.push("/dashboard")}
              className="w-full cursor-pointer"
              size="lg"
            >
              Return to Dashboard
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Top Bar ─── */}
      <header className="flex items-center justify-between px-6 py-3 bg-card border-b border-border shrink-0 z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold">
              ⚔
            </div>
            <span className="text-sm font-semibold text-foreground">
              Room{" "}
              <span className="font-mono text-primary">{roomId}</span>
            </span>
          </div>

          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowForfeitModal(true)}
            className="cursor-pointer"
          >
            <Flag className="size-4" />
            Forfeit
          </Button>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-3">
          {opponentProgress && (
            <Badge
              variant="secondary"
              className="animate-slide-up text-primary"
            >
              🎯 {opponentProgress.username} passed{" "}
              {opponentProgress.passed}/{opponentProgress.total} tests
            </Badge>
          )}

          {opponentTyping && !opponentProgress && (
            <Badge
              variant="secondary"
              className="animate-slide-up text-accent"
            >
              <span className="relative flex size-2 mr-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex rounded-full size-2 bg-accent" />
              </span>
              Opponent typing...
            </Badge>
          )}

          <span className="font-mono text-sm text-muted-foreground">
            {user?.username ?? "—"}
          </span>
        </div>
      </header>

      {/* ─── Split Pane ─── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 min-h-0">
        {/* ═══════ LEFT: Problem Description ═══════ */}
        <section className="overflow-y-auto border-r border-border p-6 lg:p-8">
          {problem ? (
            <>
              <div className="flex items-center gap-3 mb-6">
                <h1 className="text-xl font-semibold text-foreground">
                  {problem.title}
                </h1>
                <Badge
                  variant="outline"
                  className={
                    problem.difficulty === "Easy"
                      ? "text-success border-success/30"
                      : problem.difficulty === "Medium"
                      ? "text-warning border-warning/30"
                      : "text-destructive border-destructive/30"
                  }
                >
                  {problem.difficulty}
                </Badge>
              </div>

              <div className="text-sm text-foreground/85 leading-relaxed flex flex-col gap-3">
                {problem.description
                  .split("\n\n")
                  .map((p: string, i: number) => (
                    <p
                      key={i}
                      dangerouslySetInnerHTML={{
                        __html: p
                          .replace(
                            /`([^`]+)`/g,
                            '<code class="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-sm font-mono">$1</code>'
                          )
                          .replace(
                            /\*\*([^*]+)\*\*/g,
                            "<strong>$1</strong>"
                          ),
                      }}
                    />
                  ))}
              </div>
            </>
          ) : (
            <div className="text-muted-foreground text-sm flex items-center justify-center h-full">
              Loading problem...
            </div>
          )}
        </section>

        {/* ═══════ RIGHT: Code Editor + Console ═══════ */}
        <section className="flex flex-col min-h-0">
          {/* Language selector */}
          <div className="flex items-center gap-2 px-4 py-2 bg-card border-b border-border shrink-0">
            {LANGUAGES.map((lang) => (
              <Button
                key={lang.value}
                variant={language === lang.value ? "secondary" : "ghost"}
                size="xs"
                onClick={() => setLanguage(lang.value)}
                className="cursor-pointer"
              >
                {lang.label}
              </Button>
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
                readOnly: !!matchOverData,
              }}
            />
          </div>

          {/* ═══════ Console Output Panel ═══════ */}
          {consoleOpen && (
            <div className="flex-[2] border-t border-border flex flex-col min-h-0 bg-background">
              {/* Console header */}
              <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-foreground">
                    Console
                  </span>
                  {execResult && (
                    <Badge
                      variant={
                        execResult.allPassed ? "outline" : "destructive"
                      }
                      className={
                        execResult.allPassed
                          ? "text-success border-success/30"
                          : ""
                      }
                    >
                      <span className="font-mono">
                        {execResult.passed}/{execResult.total} passed
                      </span>
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setConsoleOpen(false)}
                  className="cursor-pointer"
                >
                  <X className="size-4" />
                </Button>
              </div>

              {/* Console body */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                {(running || submitting) && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin text-primary" />
                    {submitting ? "Submitting..." : "Running tests..."}
                  </div>
                )}

                {execError && (
                  <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3 font-mono">
                    ❌ {execError}
                  </div>
                )}

                {execResult &&
                  execResult.results.map((r) => (
                    <div
                      key={r.testCase}
                      className={`rounded-lg border p-3 ${
                        r.passed
                          ? "bg-success/5 border-success/20"
                          : r.status === "Skipped"
                          ? "bg-muted/5 border-border"
                          : "bg-destructive/5 border-destructive/20"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold flex items-center gap-1">
                          {r.passed ? (
                            <CheckCircle2 className="size-4 text-success" />
                          ) : (
                            <XCircle className="size-4 text-destructive" />
                          )}
                          Test Case {r.testCase}
                        </span>
                        <span
                          className={`text-sm font-mono ${
                            r.passed
                              ? "text-success"
                              : r.status === "Skipped"
                              ? "text-muted-foreground"
                              : "text-destructive"
                          }`}
                        >
                          {r.status}
                          {r.time && ` · ${r.time}s`}
                        </span>
                      </div>

                      {/* Compile error */}
                      {r.compile_output && (
                        <pre className="text-sm font-mono text-destructive/80 mt-2 whitespace-pre-wrap break-words">
                          {r.compile_output}
                        </pre>
                      )}

                      {/* Runtime error */}
                      {r.stderr && !r.compile_output && (
                        <pre className="text-sm font-mono text-destructive/80 mt-2 whitespace-pre-wrap break-words">
                          {r.stderr}
                        </pre>
                      )}

                      {/* Wrong answer */}
                      {!r.passed &&
                        !r.compile_output &&
                        !r.stderr &&
                        r.stdout && (
                          <div className="mt-2 flex flex-col gap-1 text-sm font-mono">
                            <div>
                              <span className="text-muted-foreground">
                                Output:{" "}
                              </span>
                              <span className="text-foreground">
                                {r.stdout}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">
                                Expected:{" "}
                              </span>
                              <span className="text-success">
                                {r.expected}
                              </span>
                            </div>
                          </div>
                        )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between px-4 py-3 bg-card border-t border-border shrink-0">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="font-mono">
                {language.toUpperCase()}
              </Badge>
              {consoleOpen && execResult && (
                <span className="text-sm text-muted-foreground">
                  {execResult.allPassed
                    ? "🎉 All tests passed!"
                    : `${execResult.passed}/${execResult.total} tests passed`}
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => executeCode(false)}
                disabled={running || submitting || !!matchOverData}
                className="cursor-pointer"
              >
                {running ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="size-4" />
                    Run Code
                  </>
                )}
              </Button>
              <Button
                size="sm"
                onClick={() => executeCode(true)}
                disabled={running || submitting || !!matchOverData}
                className="cursor-pointer bg-success text-white hover:bg-success/80"
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4" />
                    Submit
                  </>
                )}
              </Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
