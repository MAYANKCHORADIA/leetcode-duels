"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

// Added dynamic backend URL
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

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
  loginCount?: number; // <--- Added this to fix the TypeScript error
  matchHistory: Match[];
}

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Replaced localhost with the dynamic BACKEND_URL
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
    return (
      <div className="flex-1 flex items-center justify-center h-screen bg-grid">
        <div className="animate-spin text-primary rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-screen bg-grid">
        <h1 className="text-2xl font-bold mb-4">User Not Found</h1>
        <button onClick={() => router.push("/dashboard")} className="px-4 py-2 bg-primary rounded-xl text-white font-semibold shadow-lg hover:bg-primary/90 transition-colors">
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-grid">
      {/* Navigation Bar */}
      <header className="w-full bg-surface border-b border-border p-4 px-6 flex justify-between items-center z-50">
        <div className="font-bold text-xl text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">LeetCode Duels</div>
        <div className="flex items-center gap-6">
          <button onClick={() => router.push("/dashboard")} className="text-sm font-semibold hover:text-primary transition-colors text-foreground/80">
            Dashboard
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-10 overflow-y-auto">
        <div className="w-full max-w-3xl animate-slide-up">
          {/* Profile Card */}
          <div className="bg-surface border border-border rounded-2xl p-8 mb-8 glow-purple flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-4xl font-bold text-white shadow-lg shadow-primary/20">
              {profile.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-foreground">
                {profile.username}
              </h1>
              <p className="text-muted text-sm mt-1 mb-4 flex items-center justify-center md:justify-start gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                {profile.collegeName}
              </p>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-6">
                <div>
                  <div className="text-sm text-muted uppercase tracking-wider mb-1">Elo Rating</div>
                  <div className="text-2xl font-bold font-mono text-primary">{profile.eloRating}</div>
                </div>
                <div>
                  <div className="text-sm text-muted uppercase tracking-wider mb-1">Matches</div>
                  <div className="text-2xl font-bold font-mono text-foreground">{profile.matchesPlayed}</div>
                </div>
                <div>
                  <div className="text-sm text-muted uppercase tracking-wider mb-1">Win Rate</div>
                  <div className="text-2xl font-bold font-mono text-foreground">
                    {profile.matchesPlayed > 0 ? Math.round((profile.matchesWon / profile.matchesPlayed) * 100) : 0}%
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted uppercase tracking-wider mb-1">Logins</div>
                  <div className="text-2xl font-bold font-mono text-accent">{profile.loginCount || 0}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Match History */}
          <h2 className="text-xl font-bold text-foreground mb-4 pl-2">Match History</h2>
          <div className="bg-surface border border-border rounded-2xl overflow-hidden glow-blue">
            {profile.matchHistory.length === 0 ? (
              <div className="p-8 text-center text-muted">No matches played yet.</div>
            ) : (
              <div className="divide-y divide-border">
                {profile.matchHistory.map((match) => (
                  <div key={match.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-foreground/[0.02] transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-2 h-12 rounded-full ${match.isWinner ? 'bg-success shadow-[0_0_10px_rgba(34,197,94,0.3)]' : 'bg-destructive/50'}`} />
                      <div>
                        <div className="font-semibold text-foreground flex items-center gap-2">
                          {match.isWinner ? (
                            <span className="text-success flex items-center gap-1">🏆 Victory</span>
                          ) : (
                            <span className="text-muted flex items-center gap-1">💀 Defeat</span>
                          )}
                          <span className="text-muted text-xs font-normal">vs</span>
                          <span className="text-accent cursor-pointer hover:underline" onClick={() => router.push(`/profile/${match.opponentName}`)}>
                            {match.opponentName}
                          </span>
                        </div>
                        <div className="text-sm text-muted mt-1">
                          {match.problemName} • {match.duration}s
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-muted font-mono bg-background px-3 py-1.5 rounded-lg border border-border text-right">
                      {new Date(match.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
