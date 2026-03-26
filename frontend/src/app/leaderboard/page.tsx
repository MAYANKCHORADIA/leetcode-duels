"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUserStore } from "@/store/userStore";

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

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

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
        const endpoint = view === "global" ? "/api/leaderboard/global" : "/api/leaderboard/college";
        const res = await fetch(`${BACKEND_URL}${endpoint}`);
        
        if (!res.ok) throw new Error("Failed to fetch leaderboard data");
        const data = await res.json();
        
        if (active) {
          if (view === "global") setGlobalData(data);
          else setCollegeData(data);
        }
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchData();
    return () => { active = false; };
  }, [view]);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col items-center">
      {/* Background gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/20 blur-[120px] rounded-full pointer-events-none" />

      {/* Main Content */}
      <main className="w-full max-w-5xl px-6 py-12 lg:py-20 relative z-10 flex flex-col gap-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <Link 
              href="/dashboard"
              className="inline-flex items-center text-sm font-medium text-muted hover:text-primary transition-colors mb-2"
            >
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Dashboard
            </Link>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground">
              Leader<span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">board</span>
            </h1>
            <p className="text-muted md:text-lg">See who ranks at the top of the duels ladder.</p>
          </div>

          {/* Toggle Switch */}
          <div className="flex bg-surface border border-border p-1.5 rounded-xl self-start md:self-auto shrink-0 shadow-sm">
            <button
              onClick={() => setView("global")}
              className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${
                view === "global" 
                  ? "bg-primary text-white shadow-md shadow-primary/20" 
                  : "text-muted hover:text-foreground hover:bg-surface-hover"
              }`}
            >
              🌍 Global
            </button>
            <button
              onClick={() => setView("college")}
              className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${
                view === "college" 
                  ? "bg-accent text-white shadow-md shadow-accent/20" 
                  : "text-muted hover:text-foreground hover:bg-surface-hover"
              }`}
            >
              🎓 College
            </button>
          </div>
        </header>

        {/* Dynamic Table Card */}
        <div className="bg-surface/50 backdrop-blur-md border border-border shadow-2xl rounded-2xl overflow-hidden min-h-[400px] flex flex-col">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in duration-300">
              <span className="relative flex h-16 w-16 mb-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40 opacity-75" />
                <span className="relative inline-flex rounded-full h-16 w-16 bg-gradient-to-br from-primary to-accent opacity-20" />
                <svg className="absolute inset-0 m-auto animate-spin h-8 w-8 text-primary" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </span>
              <p className="text-primary font-semibold tracking-wide animate-pulse">Fetching Rankings...</p>
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center mb-4">
                <span className="text-2xl">⚠️</span>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Failed to load data</h3>
              <p className="text-danger/80">{error}</p>
              <button 
                onClick={() => setView(view)} 
                className="mt-6 px-4 py-2 bg-surface-hover border border-border text-sm font-medium rounded-lg hover:border-primary/50 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              {view === "global" ? (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface border-b border-border">
                      <th className="px-6 py-4 text-xs font-semibold text-muted tracking-wider uppercase">Rank</th>
                      <th className="px-6 py-4 text-xs font-semibold text-muted tracking-wider uppercase">User</th>
                      <th className="px-6 py-4 text-xs font-semibold text-muted tracking-wider uppercase">College</th>
                      <th className="px-6 py-4 text-xs font-semibold text-muted tracking-wider uppercase">Rating</th>
                      <th className="px-6 py-4 text-xs font-semibold text-muted tracking-wider uppercase text-right">W/L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {globalData.map((usr, i) => (
                      <tr 
                        key={usr.id}
                        className={`group hover:bg-surface-hover/50 transition-colors duration-200 ${usr.id === user?.id ? 'bg-primary/5' : ''}`}
                      >
                        <td className="px-6 py-5 whitespace-nowrap">
                          <div className="flex items-center">
                            {i === 0 && <span className="text-2xl mr-2 drop-shadow-md">🏆</span>}
                            {i === 1 && <span className="text-2xl mr-2 drop-shadow-md">🥈</span>}
                            {i === 2 && <span className="text-2xl mr-2 drop-shadow-md">🥉</span>}
                            {i > 2 && <span className="text-muted font-mono font-medium ml-2 mr-2">#{i + 1}</span>}
                          </div>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                              {usr.username.charAt(0).toUpperCase()}
                            </div>
                            <span className={`font-semibold ${usr.id === user?.id ? 'text-primary' : 'text-foreground group-hover:text-primary transition-colors'}`}>
                              {usr.username}
                              {usr.id === user?.id && <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">You</span>}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap text-sm text-foreground/80">
                          {usr.collegeName}
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                            {usr.eloRating}
                          </span>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap text-sm text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-semibold text-foreground">
                              {usr.matchesWon} <span className="text-muted font-normal text-xs mx-1">/</span> {usr.matchesPlayed - usr.matchesWon}
                            </span>
                            <span className="text-xs text-muted">
                              {usr.matchesPlayed > 0 ? Math.round((usr.matchesWon / usr.matchesPlayed) * 100) : 0}% Win Rate
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {globalData.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-muted">
                          No players have joined the ladder yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left border-collapse animate-in fade-in duration-300">
                  <thead>
                    <tr className="bg-surface border-b border-border">
                      <th className="px-6 py-4 text-xs font-semibold text-muted tracking-wider uppercase">Rank</th>
                      <th className="px-6 py-4 text-xs font-semibold text-muted tracking-wider uppercase">College</th>
                      <th className="px-6 py-4 text-xs font-semibold text-muted tracking-wider uppercase">Avg Rating</th>
                      <th className="px-6 py-4 text-xs font-semibold text-muted tracking-wider uppercase text-right">Active Players</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {collegeData.map((col, i) => (
                      <tr 
                        key={col.collegeName}
                        className={`group hover:bg-surface-hover/50 transition-colors duration-200 ${col.collegeName === user?.collegeName ? 'bg-accent/5' : ''}`}
                      >
                        <td className="px-6 py-5 whitespace-nowrap">
                           <div className="flex items-center">
                            {i === 0 && <span className="text-2xl mr-2 drop-shadow-md">🏆</span>}
                            {i === 1 && <span className="text-2xl mr-2 drop-shadow-md">🥈</span>}
                            {i === 2 && <span className="text-2xl mr-2 drop-shadow-md">🥉</span>}
                            {i > 2 && <span className="text-muted font-mono font-medium ml-2 mr-2">#{i + 1}</span>}
                          </div>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent/20 to-primary/20 border border-accent/30 flex items-center justify-center text-xs font-bold text-accent shrink-0">
                              🎓
                            </div>
                            <span className={`font-semibold ${col.collegeName === user?.collegeName ? 'text-accent' : 'text-foreground group-hover:text-accent transition-colors'}`}>
                              {col.collegeName}
                              {col.collegeName === user?.collegeName && <span className="ml-2 text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full font-medium">Your College</span>}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-mono font-bold bg-accent/10 text-accent border border-accent/20">
                            {col.avgElo}
                          </span>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap text-sm text-right font-medium text-foreground/80">
                          {col.studentCount} {col.studentCount === 1 ? 'Student' : 'Students'}
                        </td>
                      </tr>
                    ))}
                    {collegeData.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-muted">
                          No colleges are on the ladder yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
