"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUserStore } from "@/store/userStore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import LoadingSpinner from "@/components/LoadingSpinner";
import { ArrowLeft, AlertTriangle, RefreshCw } from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────
interface GlobalUser {
  id: string;
  username: string;
  collegeName: string;
  eloRating: number;
  matchesPlayed: number;
  matchesWon: number;
}

interface CollegeData {
  collegeName: string;
  avgElo: number;
  studentCount: number;
}

type ViewType = "global" | "college";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

function getRankDisplay(index: number) {
  if (index === 0) return "🏆";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";
  return `#${index + 1}`;
}

export default function LeaderboardPage() {
  const [view, setView] = useState<ViewType>("global");
  const [globalData, setGlobalData] = useState<GlobalUser[]>([]);
  const [collegeData, setCollegeData] = useState<CollegeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { user } = useUserStore();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    const fetchData = async () => {
      try {
        const endpoint =
          view === "global"
            ? "/api/leaderboard/global"
            : "/api/leaderboard/college";
        const res = await fetch(`${BACKEND_URL}${endpoint}`);

        if (!res.ok) throw new Error("Failed to fetch leaderboard data");
        const data = await res.json();

        if (active) {
          if (view === "global") setGlobalData(data);
          else setCollegeData(data);
        }
      } catch (err: unknown) {
        if (active)
          setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchData();
    return () => {
      active = false;
    };
  }, [view]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      <main className="w-full max-w-5xl mx-auto px-6 py-12 flex flex-col gap-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex flex-col gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors mb-2"
            >
              <ArrowLeft className="size-4 mr-1" />
              Back to Dashboard
            </Link>
            <h1 className="text-2xl font-semibold text-foreground">
              Leaderboard
            </h1>
            <p className="text-sm font-medium text-muted-foreground">
              See who ranks at the top of the duels ladder.
            </p>
          </div>

          {/* Toggle */}
          <div className="flex bg-card border border-border p-1 rounded-xl self-start md:self-auto shrink-0">
            <Button
              variant={view === "global" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("global")}
              className="cursor-pointer"
            >
              🌍 Global
            </Button>
            <Button
              variant={view === "college" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("college")}
              className="cursor-pointer"
            >
              🎓 College
            </Button>
          </div>
        </header>

        {/* Table Card */}
        <Card className="min-h-96 flex flex-col">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
              <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm font-medium text-primary animate-pulse">
                Fetching Rankings...
              </p>
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-center px-4 gap-4">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="size-8 text-destructive" />
              </div>
              <h3 className="text-xl font-semibold text-foreground">
                Failed to load data
              </h3>
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setView(view)}
                className="cursor-pointer"
              >
                <RefreshCw className="size-4" />
                Try Again
              </Button>
            </div>
          ) : (
            <CardContent className="p-0">
              <div className="w-full overflow-x-auto">
                {view === "global" ? (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-6 py-4 text-sm font-medium text-muted-foreground">
                          Rank
                        </th>
                        <th className="px-6 py-4 text-sm font-medium text-muted-foreground">
                          User
                        </th>
                        <th className="px-6 py-4 text-sm font-medium text-muted-foreground">
                          College
                        </th>
                        <th className="px-6 py-4 text-sm font-medium text-muted-foreground">
                          Rating
                        </th>
                        <th className="px-6 py-4 text-sm font-medium text-muted-foreground text-right">
                          W/L
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {globalData.map((usr, i) => (
                        <tr
                          key={usr.id}
                          className={`group hover:bg-muted/30 transition-colors ${
                            usr.id === user?.id ? "bg-primary/5" : ""
                          }`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`font-mono text-sm font-medium ${
                                i < 3
                                  ? "text-xl"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {getRankDisplay(i)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
                                {usr.username.charAt(0).toUpperCase()}
                              </div>
                              <span
                                className={`font-mono text-sm font-semibold ${
                                  usr.id === user?.id
                                    ? "text-primary"
                                    : "text-foreground group-hover:text-primary transition-colors"
                                }`}
                              >
                                {usr.username}
                                {usr.id === user?.id && (
                                  <Badge
                                    variant="secondary"
                                    className="ml-2 text-primary"
                                  >
                                    You
                                  </Badge>
                                )}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            {usr.collegeName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge
                              variant="secondary"
                              className="font-mono font-semibold"
                            >
                              {usr.eloRating}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                            <div className="flex flex-col items-end">
                              <span className="font-semibold font-mono text-foreground">
                                {usr.matchesWon}
                                <span className="text-muted-foreground font-normal mx-1">
                                  /
                                </span>
                                {usr.matchesPlayed - usr.matchesWon}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {usr.matchesPlayed > 0
                                  ? Math.round(
                                      (usr.matchesWon /
                                        usr.matchesPlayed) *
                                        100
                                    )
                                  : 0}
                                % Win Rate
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {globalData.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-6 py-12 text-center text-muted-foreground"
                          >
                            No players have joined the ladder yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-6 py-4 text-sm font-medium text-muted-foreground">
                          Rank
                        </th>
                        <th className="px-6 py-4 text-sm font-medium text-muted-foreground">
                          College
                        </th>
                        <th className="px-6 py-4 text-sm font-medium text-muted-foreground">
                          Avg Rating
                        </th>
                        <th className="px-6 py-4 text-sm font-medium text-muted-foreground text-right">
                          Active Players
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {collegeData.map((col, i) => (
                        <tr
                          key={col.collegeName}
                          className={`group hover:bg-muted/30 transition-colors ${
                            col.collegeName === user?.collegeName
                              ? "bg-accent/5"
                              : ""
                          }`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`font-mono text-sm font-medium ${
                                i < 3
                                  ? "text-xl"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {getRankDisplay(i)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-sm shrink-0">
                                🎓
                              </div>
                              <span
                                className={`font-semibold text-sm ${
                                  col.collegeName === user?.collegeName
                                    ? "text-accent"
                                    : "text-foreground group-hover:text-accent transition-colors"
                                }`}
                              >
                                {col.collegeName}
                                {col.collegeName === user?.collegeName && (
                                  <Badge
                                    variant="secondary"
                                    className="ml-2 text-accent"
                                  >
                                    Your College
                                  </Badge>
                                )}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge
                              variant="secondary"
                              className="font-mono font-semibold"
                            >
                              {col.avgElo}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-muted-foreground">
                            {col.studentCount}{" "}
                            {col.studentCount === 1
                              ? "Student"
                              : "Students"}
                          </td>
                        </tr>
                      ))}
                      {collegeData.length === 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-6 py-12 text-center text-muted-foreground"
                          >
                            No colleges are on the ladder yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      </main>
    </div>
  );
}
