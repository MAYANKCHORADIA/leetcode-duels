"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/userStore";
import { useRoomStore } from "@/store/roomStore";
import { getSocket } from "@/lib/socket";
import FriendsSidebar from "@/components/FriendsSidebar";
import Navbar from "@/components/Navbar";
import LoadingSpinner from "@/components/LoadingSpinner";
import { authClient } from "@/lib/authClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Swords,
  Rocket,
  Trophy,
  Copy,
  Check,
  ArrowLeft,
  Loader2,
  X,
} from "lucide-react";

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
  const [view, setView] = useState<View>("dashboard");
  const [incomingChallenge, setIncomingChallenge] = useState<{
    roomId: string;
    challenger: string;
  } | null>(null);
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

    const onMatchStart = ({
      roomId,
      problem,
    }: {
      roomId: string;
      problem: any;
    }) => {
      setRoomState(roomId, problem);
      router.push(`/room/${roomId}`);
    };

    const onRoomError = ({ message }: { message: string }) => {
      setError(message);
      setIsJoining(false);
    };

    const onChallengeReceived = ({
      roomId,
      challenger,
    }: {
      roomId: string;
      challenger: string;
    }) => {
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
    setTimeout(() => setIsJoining(false), 3000);
  }, [user, joinRoomId, isJoining]);

  const handleChallenge = useCallback(
    (friendId: string) => {
      if (!user) return;
      const currentUser = user;
      const socket = getSocket();

      const onRoomCreated = (roomId: string) => {
        socket.emit("send_challenge", {
          friendId,
          roomId,
          challenger: currentUser.username,
        });
        socket.off("room_created", onRoomCreated);
      };
      socket.on("room_created", onRoomCreated);

      socket.emit("create_room", {
        difficulty,
        topic,
        timeLimit,
        user: { id: currentUser.id, username: currentUser.username },
      });
    },
    [user, difficulty, topic, timeLimit]
  );

  const copyRoomId = useCallback(() => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [roomId]);

  // ── Loading / Auth Guards ──
  if (isPending) return <LoadingSpinner message="Loading session..." />;
  if (!isPending && !data?.session && !user) return null;
  if (!user) return null;

  return (
    <div className="h-screen flex flex-col">
      <Navbar />

      <div className="flex-1 flex overflow-hidden">
        {view === "dashboard" && (
          <FriendsSidebar currentUser={user} onChallenge={handleChallenge} />
        )}

        <main className="flex-1 overflow-y-auto px-4 py-10 flex flex-col items-center">
          <div className="w-full max-w-5xl mx-auto">
            {/* ═══════ DASHBOARD VIEW ═══════ */}
            {view === "dashboard" && (
              <div className="animate-slide-up flex flex-col gap-6">
                {/* User Info Card */}
                <Card className="glow-primary">
                  <CardContent className="flex items-center justify-between">
                    <div>
                      <h1 className="text-xl font-semibold text-foreground">
                        Welcome back,{" "}
                        <span className="text-primary font-mono">
                          {user.username}
                        </span>
                      </h1>
                      <p className="text-sm font-medium text-muted-foreground mt-1">
                        {user.collegeName}
                      </p>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                      <div className="text-2xl font-semibold font-mono text-foreground">
                        {user.eloRating}
                      </div>
                      <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                        Elo Rating
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push("/leaderboard")}
                        className="cursor-pointer"
                      >
                        <Trophy className="size-4" />
                        View Leaderboard
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Card
                    className="group cursor-pointer hover:border-primary/50 transition-all"
                    onClick={() => setShowModal(true)}
                  >
                    <CardContent className="p-6">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Swords className="size-6 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-1">
                        Create Room
                      </h3>
                      <p className="text-sm font-medium text-muted-foreground">
                        Set the rules. Challenge a friend.
                      </p>
                    </CardContent>
                  </Card>

                  <Card
                    className="group cursor-pointer hover:border-accent/50 transition-all"
                    onClick={() => setView("joining")}
                  >
                    <CardContent className="p-6">
                      <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Rocket className="size-6 text-accent" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-1">
                        Join Room
                      </h3>
                      <p className="text-sm font-medium text-muted-foreground">
                        Got a code? Jump into a duel.
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Embedded Chat */}
                <Card className="overflow-hidden glow-primary">
                  <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
                    <span className="text-lg">💬</span>
                    <h3 className="text-sm font-semibold text-foreground">
                      Global Chat
                    </h3>
                    <span className="text-sm text-muted-foreground ml-auto">
                      Powered by Rocket.Chat
                    </span>
                  </div>
                  <iframe
                    src="http://localhost:3000/channel/general?layout=embedded"
                    width="100%"
                    height="400"
                    style={{ border: "none", display: "block" }}
                    allow="camera; microphone"
                  />
                </Card>
              </div>
            )}

            {/* ═══════ WAITING LOBBY ═══════ */}
            {view === "waiting" && (
              <div className="flex justify-center animate-slide-up">
                <Card className="w-full max-w-md text-center glow-primary-lg">
                  <CardContent className="p-8 flex flex-col items-center gap-6">
                    {/* Pulsing ring */}
                    <div className="relative w-24 h-24">
                      <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-pulse-ring" />
                      <div className="absolute inset-2 rounded-full border-2 border-primary/20 animate-pulse-ring [animation-delay:0.5s]" />
                      <div className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center">
                        <Swords className="size-8 text-primary animate-float" />
                      </div>
                    </div>

                    <div>
                      <h2 className="text-xl font-semibold text-foreground mb-2">
                        Waiting for Opponent...
                      </h2>
                      <p className="text-sm font-medium text-muted-foreground">
                        Share the room code with your challenger
                      </p>
                    </div>

                    {/* Room ID display */}
                    <div className="w-full bg-background border border-border rounded-xl p-4">
                      <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">
                        Room Code
                      </p>
                      <p className="text-2xl font-semibold font-mono tracking-widest text-foreground">
                        {roomId}
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      className="w-full cursor-pointer"
                      onClick={copyRoomId}
                    >
                      {copied ? (
                        <>
                          <Check className="size-4" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="size-4" /> Copy Room Code
                        </>
                      )}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setView("dashboard");
                        setRoomId("");
                      }}
                      className="cursor-pointer"
                    >
                      <ArrowLeft className="size-4" />
                      Back to Dashboard
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ═══════ JOIN ROOM VIEW ═══════ */}
            {view === "joining" && (
              <div className="flex justify-center animate-slide-up">
                <Card className="w-full max-w-md glow-primary">
                  <CardHeader>
                    <CardTitle>Join a Room</CardTitle>
                    <CardDescription>
                      Enter the room code shared by your opponent
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <Input
                      type="text"
                      placeholder="e.g. A3B7K9"
                      value={joinRoomId}
                      onChange={(e) =>
                        setJoinRoomId(
                          e.target.value.toUpperCase().slice(0, 6)
                        )
                      }
                      className="text-center text-2xl font-mono tracking-widest"
                      maxLength={6}
                    />

                    {error && (
                      <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2">
                        {error}
                      </div>
                    )}

                    <Button
                      onClick={handleJoinRoom}
                      disabled={joinRoomId.length < 6 || isJoining}
                      className="w-full cursor-pointer"
                      size="lg"
                    >
                      {isJoining ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Joining...
                        </>
                      ) : (
                        "Join Duel →"
                      )}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setView("dashboard");
                        setJoinRoomId("");
                        setError("");
                      }}
                      className="cursor-pointer"
                    >
                      <ArrowLeft className="size-4" />
                      Back to Dashboard
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ═══════ CREATE ROOM MODAL ═══════ */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create a Room</DialogTitle>
            <DialogDescription>
              Configure your duel settings, then create the room.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-5 pt-2">
            {/* Difficulty */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-foreground">
                Difficulty
              </label>
              <div className="grid grid-cols-3 gap-2">
                {DIFFICULTIES.map((d) => (
                  <Button
                    key={d}
                    variant={difficulty === d ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDifficulty(d)}
                    className={`cursor-pointer ${
                      difficulty === d
                        ? d === "Easy"
                          ? "bg-success text-white hover:bg-success/80"
                          : d === "Medium"
                          ? "bg-warning text-white hover:bg-warning/80"
                          : "bg-destructive text-white hover:bg-destructive/80"
                        : ""
                    }`}
                  >
                    {d}
                  </Button>
                ))}
              </div>
            </div>

            {/* Topic */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-foreground">
                Topic
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                {TOPICS.map((t) => (
                  <Button
                    key={t}
                    variant={topic === t ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTopic(t)}
                    className="cursor-pointer justify-start"
                  >
                    {t}
                  </Button>
                ))}
              </div>
            </div>

            {/* Time Limit */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-foreground">
                Time Limit
              </label>
              <div className="grid grid-cols-3 gap-2">
                {TIME_LIMITS.map((t) => (
                  <Button
                    key={t}
                    variant={timeLimit === t ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTimeLimit(t)}
                    className="cursor-pointer"
                  >
                    {t} min
                  </Button>
                ))}
              </div>
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2">
                {error}
              </div>
            )}

            <Button
              onClick={handleCreateRoom}
              className="w-full cursor-pointer"
              size="lg"
            >
              <Swords className="size-4" />
              Create Room
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════ INCOMING CHALLENGE DIALOG ═══════ */}
      <Dialog
        open={!!incomingChallenge}
        onOpenChange={() => setIncomingChallenge(null)}
      >
        <DialogContent className="sm:max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2">
              <Swords className="size-5 text-primary" />
              Challenge Received
            </DialogTitle>
            <DialogDescription>
              <span className="text-primary font-semibold font-mono">
                {incomingChallenge?.challenger}
              </span>{" "}
              has challenged you to a duel!
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-4 justify-center pt-4">
            <Button
              onClick={() => {
                const socket = getSocket();
                socket.emit("join_room", {
                  roomId: incomingChallenge!.roomId,
                  user: { id: user.id, username: user.username },
                });
                setIncomingChallenge(null);
                setIsJoining(true);
              }}
              className="flex-1 cursor-pointer"
            >
              Accept
            </Button>
            <Button
              variant="destructive"
              onClick={() => setIncomingChallenge(null)}
              className="flex-1 cursor-pointer"
            >
              Decline
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
