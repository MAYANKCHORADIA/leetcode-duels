"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/userStore";
import { useRoomStore } from "@/store/roomStore";
import { getSocket } from "@/lib/socket";
import FriendsSidebar from "@/components/FriendsSidebar";
import { authClient } from "@/lib/authClient";

// ─── Constants ──────────────────────────────────────────────────────
const DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;
const TOPICS = [
  "Arrays",
  "Strings",
  "Linked Lists",
  "Trees",
  "Graphs",
  "Dynamic Programming",
  "Binary Search",
  "Stack & Queue",
  "Greedy",
  "Math",
] as const;
const TIME_LIMITS = [15, 30, 45] as const;

type View = "dashboard" | "waiting" | "joining";

export default function DashboardPage() {
  const { data, isPending } = authClient.useSession();
  const user = useUserStore((s) => s.user);
  const setUser = useUserStore((s) => s.setUser);
  const setRoomState = useRoomStore((s) => s.setRoomState);
  const router = useRouter();

  // ── UI State ──
  const [view, setView] = useState<"dashboard" | "waiting" | "joining">("dashboard");
  const [incomingChallenge, setIncomingChallenge] = useState<{ roomId: string, challenger: string } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  // ── Create Room Form ──
  const [difficulty, setDifficulty] = useState<string>(DIFFICULTIES[0]);
  const [topic, setTopic] = useState<string>(TOPICS[0]);
  const [timeLimit, setTimeLimit] = useState<number>(TIME_LIMITS[1]);

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


  // ── Socket listeners ──
  useEffect(() => {
    const socket = getSocket();

    const onRoomCreated = ({ roomId }: { roomId: string }) => {
      setRoomId(roomId);
      setShowModal(false);
      setView("waiting");
    };

    const onMatchStart = ({ roomId, problem }: { roomId: string, problem: any }) => {
      setRoomState(roomId, problem);
      router.push(`/room/${roomId}`);
    };

    const onRoomError = ({ message }: { message: string }) => {
      setError(message);
      setIsJoining(false);
    };

    const onChallengeReceived = ({ roomId, challenger }: { roomId: string, challenger: string }) => {
      setIncomingChallenge({ roomId, challenger });
    };

    if (user) {
      socket.emit("identify", user.id);
    }

    socket.on("room_created", onRoomCreated);
    socket.on("room_error", onRoomError);
    socket.on("match_start", onMatchStart);
    socket.on("challenge_received", onChallengeReceived);

    return () => {
      socket.off("room_created", onRoomCreated);
      socket.off("room_error", onRoomError);
      socket.off("match_start", onMatchStart);
      socket.off("challenge_received", onChallengeReceived);
    };
  }, [user, router, setRoomState]);

  // ── Actions ──
  const handleCreateRoom = useCallback(() => {
    if (!user) return;
    setError("");
    const socket = getSocket();
    socket.emit("create_room", {
      difficulty,
      topic,
      timeLimit,
      user: { id: user.id, username: user.username },
    });
  }, [user, difficulty, topic, timeLimit]);

  const handleJoinRoom = useCallback(() => {
    if (!user || !joinRoomId.trim() || isJoining) return;
    setError("");
    setIsJoining(true);
    const socket = getSocket();
    socket.emit("join_room", {
      roomId: joinRoomId.trim().toUpperCase(),
      user: { id: user.id, username: user.username },
    });
    // Auto-reset joining state after a delay in case of network miss
    setTimeout(() => setIsJoining(false), 3000);
  }, [user, joinRoomId, isJoining]);

  const handleChallenge = useCallback((friendId: string) => {
    if (!user) return;
    const currentUser = user;
    const socket = getSocket();
    
    // We must listen for the room creation response exactly once for this challenge
    const onRoomCreated = (roomId: string) => {
       socket.emit("send_challenge", { friendId, roomId, challenger: currentUser.username });
       socket.off("room_created", onRoomCreated);
    };
    socket.on("room_created", onRoomCreated);

    socket.emit("create_room", {
      difficulty,
      topic,
      timeLimit,
      user: { id: currentUser.id, username: currentUser.username },
    });
  }, [user, difficulty, topic, timeLimit]);

  const copyRoomId = useCallback(() => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [roomId]);

  // Handle Loading Session State
  if (isPending) {
    return (
      <div className="h-screen flex items-center justify-center bg-grid">
        <div className="animate-spin text-primary rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Handle Unauthorized State (Render)
  if (!isPending && !data?.session && !user) {
    return null;
  }

  // Double check user hydration
  if (!user) return null;

  return (
    <div className="h-screen flex flex-col bg-grid">
      {/* Navigation Bar */}
      <header className="w-full bg-surface border-b border-border p-4 px-6 flex justify-between items-center z-50">
        <div className="font-bold text-xl text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">LeetCode Duels</div>
        <div className="flex items-center gap-6">
          <button onClick={() => router.push(`/profile/${user.username}`)} className="text-sm font-semibold hover:text-primary transition-colors text-foreground/80">
            Profile
          </button>
          <button onClick={() => { useUserStore.getState().clearUser(); router.replace("/") }} className="text-sm font-semibold text-destructive hover:text-destructive/80 transition-colors">
            Logout
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {view === "dashboard" && <FriendsSidebar currentUser={user} onChallenge={handleChallenge} />}
        
        <main className="flex-1 overflow-y-auto px-4 py-10 flex flex-col items-center relative">
          {/* Ambient glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-primary/5 blur-[150px] pointer-events-none" />

          {/* ═══════════════ DASHBOARD VIEW ═══════════════ */}
          {view === "dashboard" && (
            <div className="relative w-full max-w-2xl animate-slide-up">
              {/* User Info Card */}
              <div className="bg-surface border border-border rounded-2xl p-6 mb-8 glow-purple">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-xl font-bold text-foreground">
                      Welcome back,{" "}
                      <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                        {user.username}
                      </span>
                    </h1>
                    <p className="text-muted text-sm mt-1">{user.collegeName}</p>
                  </div>
              <div className="text-right flex flex-col items-end">
                <div className="text-3xl font-bold font-mono bg-gradient-to-b from-foreground to-muted bg-clip-text text-transparent">
                  {user.eloRating}
                </div>
                <div className="text-xs text-muted uppercase tracking-wider mb-2">
                  Elo Rating
                </div>
                <button
                  onClick={() => router.push("/leaderboard")}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors cursor-pointer shadow-sm"
                >
                  🏆 View Leaderboard
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => setShowModal(true)}
              className="group relative bg-surface border border-border rounded-2xl p-6
                         hover:border-primary/50 hover:bg-surface-hover
                         transition-all duration-300 cursor-pointer text-left"
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <span className="text-2xl">⚔️</span>
                </div>
                <h3 className="font-semibold text-foreground mb-1">
                  Create Room
                </h3>
                <p className="text-sm text-muted">
                  Set the rules. Challenge a friend.
                </p>
              </div>
            </button>

            <button
              onClick={() => setView("joining")}
              className="group relative bg-surface border border-border rounded-2xl p-6
                         hover:border-accent/50 hover:bg-surface-hover
                         transition-all duration-300 cursor-pointer text-left"
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <span className="text-2xl">🚀</span>
                </div>
                <h3 className="font-semibold text-foreground mb-1">
                  Join Room
                </h3>
                <p className="text-sm text-muted">
                  Got a code? Jump into a duel.
                </p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════ WAITING LOBBY ═══════════════ */}
      {view === "waiting" && (
        <div className="relative w-full max-w-md text-center animate-slide-up">
          <div className="bg-surface border border-border rounded-2xl p-10 glow-purple-lg">
            {/* Pulsing ring */}
            <div className="relative w-24 h-24 mx-auto mb-8">
              <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-pulse-ring" />
              <div className="absolute inset-2 rounded-full border-2 border-primary/20 animate-pulse-ring [animation-delay:0.5s]" />
              <div className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-3xl animate-float">⚔️</span>
              </div>
            </div>

            <h2 className="text-xl font-bold text-foreground mb-2">
              Waiting for Opponent...
            </h2>
            <p className="text-sm text-muted mb-8">
              Share the room code with your challenger
            </p>

            {/* Room ID display */}
            <div className="bg-background border border-border rounded-xl p-4 mb-6">
              <div className="text-xs text-muted uppercase tracking-wider mb-2">
                Room Code
              </div>
              <div className="text-3xl font-bold font-mono tracking-[0.3em] text-foreground">
                {roomId}
              </div>
            </div>

            <button
              onClick={copyRoomId}
              className="w-full py-3 rounded-xl font-medium text-sm cursor-pointer
                         bg-primary/10 text-primary border border-primary/20
                         hover:bg-primary/20 transition-all duration-200"
            >
              {copied ? "✓ Copied!" : "📋 Copy Room Code"}
            </button>

            <button
              onClick={() => {
                setView("dashboard");
                setRoomId("");
              }}
              className="mt-4 text-sm text-muted hover:text-foreground transition-colors cursor-pointer"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════ JOIN ROOM VIEW ═══════════════ */}
      {view === "joining" && (
        <div className="relative w-full max-w-md animate-slide-up">
          <div className="bg-surface border border-border rounded-2xl p-8 glow-purple">
            <h2 className="text-xl font-bold text-foreground mb-2">
              Join a Room
            </h2>
            <p className="text-sm text-muted mb-6">
              Enter the room code shared by your opponent
            </p>

            <input
              type="text"
              placeholder="e.g. A3B7K9"
              value={joinRoomId}
              onChange={(e) =>
                setJoinRoomId(e.target.value.toUpperCase().slice(0, 6))
              }
              className="w-full px-4 py-4 bg-background border border-border rounded-xl
                         text-foreground text-center text-2xl font-mono tracking-[0.3em]
                         placeholder:text-muted/30 placeholder:text-lg placeholder:tracking-normal
                         outline-none focus:border-primary focus:ring-1 focus:ring-primary/30
                         transition-all duration-200 mb-4"
              maxLength={6}
            />

            {error && (
              <div className="text-danger text-sm bg-danger/10 border border-danger/20 rounded-lg px-4 py-2 mb-4">
                {error}
              </div>
            )}

            <button
              onClick={handleJoinRoom}
              disabled={joinRoomId.length < 6 || isJoining}
              className="w-full py-3 rounded-xl font-semibold text-white cursor-pointer
                         bg-gradient-to-r from-primary to-accent
                         hover:from-primary-hover hover:to-accent
                         disabled:opacity-40 disabled:cursor-not-allowed
                         transition-all duration-300
                         shadow-lg shadow-primary/20 hover:shadow-primary/40"
            >
              {isJoining ? "Joining..." : "Join Duel →"}
            </button>

            <button
              onClick={() => {
                setView("dashboard");
                setJoinRoomId("");
                setError("");
              }}
              className="mt-4 w-full text-sm text-muted hover:text-foreground transition-colors cursor-pointer"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════ CREATE ROOM MODAL ═══════════════ */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          onClick={() => setShowModal(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Modal */}
          <div
            className="relative bg-surface border border-border rounded-2xl p-8 w-full max-w-lg animate-slide-up glow-purple-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-foreground">
                Create a Room
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center
                           text-muted hover:text-foreground hover:border-border-hover transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Difficulty */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-foreground/80 mb-2.5">
                Difficulty
              </label>
              <div className="grid grid-cols-3 gap-2">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer border ${
                      difficulty === d
                        ? d === "Easy"
                          ? "bg-success/15 text-success border-success/30"
                          : d === "Medium"
                          ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
                          : "bg-danger/15 text-danger border-danger/30"
                        : "bg-background border-border text-muted hover:text-foreground hover:border-border-hover"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Topic */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-foreground/80 mb-2.5">
                Topic
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                {TOPICS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTopic(t)}
                    className={`py-2 px-3 rounded-xl text-sm transition-all duration-200 cursor-pointer border text-left ${
                      topic === t
                        ? "bg-primary/15 text-primary border-primary/30"
                        : "bg-background border-border text-muted hover:text-foreground hover:border-border-hover"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Time Limit */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-foreground/80 mb-2.5">
                Time Limit
              </label>
              <div className="grid grid-cols-3 gap-2">
                {TIME_LIMITS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTimeLimit(t)}
                    className={`py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer border ${
                      timeLimit === t
                        ? "bg-primary/15 text-primary border-primary/30"
                        : "bg-background border-border text-muted hover:text-foreground hover:border-border-hover"
                    }`}
                  >
                    {t} min
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="text-danger text-sm bg-danger/10 border border-danger/20 rounded-lg px-4 py-2 mb-4">
                {error}
              </div>
            )}

            <button
              onClick={handleCreateRoom}
              className="w-full py-3 rounded-xl font-semibold text-white cursor-pointer
                         bg-gradient-to-r from-primary to-accent
                         hover:from-primary-hover hover:to-accent
                         transition-all duration-300
                         shadow-lg shadow-primary/20 hover:shadow-primary/40"
            >
              Create Room ⚔️
            </button>
          </div>
        </div>
      )}
        </main>
      </div>

      {/* Incoming Challenge Modal */}
      {incomingChallenge && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in px-4">
          <div className="bg-surface p-8 rounded-2xl border border-primary/50 text-center max-w-sm w-full glow-purple">
            <h3 className="text-xl text-foreground font-bold mb-2">⚔️ Challenge Received</h3>
            <p className="text-muted text-sm mb-6"><span className="text-primary font-semibold">{incomingChallenge.challenger}</span> has challenged you to a duel!</p>
            <div className="flex gap-4 justify-center">
              <button onClick={() => {
                const socket = getSocket();
                socket.emit("join_room", { roomId: incomingChallenge.roomId, user: {id: user.id, username: user.username} });
                setIncomingChallenge(null);
                setIsJoining(true); // show joining state temporarily until match_start redirects
              }} className="bg-primary text-white font-semibold flex-1 py-2.5 rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">Accept</button>
              <button onClick={() => setIncomingChallenge(null)} className="bg-destructive/10 text-destructive border border-destructive/20 font-semibold flex-1 py-2.5 rounded-xl hover:bg-destructive/20 transition-colors">Decline</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
