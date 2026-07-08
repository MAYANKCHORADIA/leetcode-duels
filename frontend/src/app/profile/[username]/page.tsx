"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft } from "lucide-react";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

interface Match {
  id: string;
  problemName: string;
  duration: number;
  createdAt: string;
  opponentName: string;
  isWinner: boolean;
}

interface UserProfile {
  id: string;
  username: string;
  collegeName: string;
  eloRating: number;
  matchesPlayed: number;
  matchesWon: number;
  loginCount?: number;
  matchHistory: Match[];
}

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/users/profile/${username}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data) => {
        setProfile(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [username]);

  if (loading) {
    return <LoadingSpinner message="Loading profile..." />;
  }

  if (!profile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-screen gap-4">
        <h1 className="text-2xl font-semibold text-foreground">
          User Not Found
        </h1>
        <Button
          onClick={() => router.push("/dashboard")}
          className="cursor-pointer"
        >
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const winRate =
    profile.matchesPlayed > 0
      ? Math.round((profile.matchesWon / profile.matchesPlayed) * 100)
      : 0;

  return (
    <div className="h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 overflow-y-auto px-4 py-10">
        <div className="w-full max-w-5xl mx-auto animate-slide-up flex flex-col gap-8">
          {/* Profile Card */}
          <Card className="glow-primary">
            <CardContent className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left p-8">
              <Avatar className="w-20 h-20">
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-semibold">
                  {profile.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1">
                <h1 className="text-2xl font-semibold text-foreground font-mono">
                  {profile.username}
                </h1>
                <p className="text-sm font-medium text-muted-foreground mt-1 flex items-center justify-center md:justify-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-success" />
                  {profile.collegeName}
                </p>

                <div className="flex flex-wrap items-center justify-center md:justify-start gap-6 mt-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Elo Rating
                    </p>
                    <p className="text-xl font-semibold font-mono text-primary">
                      {profile.eloRating}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Matches
                    </p>
                    <p className="text-xl font-semibold font-mono text-foreground">
                      {profile.matchesPlayed}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Win Rate
                    </p>
                    <p className="text-xl font-semibold font-mono text-foreground">
                      {winRate}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Logins
                    </p>
                    <p className="text-xl font-semibold font-mono text-accent">
                      {profile.loginCount || 0}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Match History */}
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold text-foreground pl-1">
              Match History
            </h2>

            <Card>
              {profile.matchHistory.length === 0 ? (
                <CardContent className="py-12 text-center text-muted-foreground">
                  No matches played yet.
                </CardContent>
              ) : (
                <div className="divide-y divide-border">
                  {profile.matchHistory.map((match) => (
                    <div
                      key={match.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-1 h-12 rounded-full ${
                            match.isWinner
                              ? "bg-success"
                              : "bg-destructive/50"
                          }`}
                        />
                        <div>
                          <div className="flex items-center gap-2 text-sm font-semibold">
                            {match.isWinner ? (
                              <Badge
                                variant="secondary"
                                className="text-success"
                              >
                                🏆 Victory
                              </Badge>
                            ) : (
                              <Badge variant="secondary">💀 Defeat</Badge>
                            )}
                            <span className="text-muted-foreground font-normal">
                              vs
                            </span>
                            <button
                              className="font-mono text-accent hover:underline cursor-pointer"
                              onClick={() =>
                                router.push(
                                  `/profile/${match.opponentName}`
                                )
                              }
                            >
                              {match.opponentName}
                            </button>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {match.problemName} • {match.duration}s
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="font-mono text-sm shrink-0">
                        {new Date(match.createdAt).toLocaleDateString()}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
