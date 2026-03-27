"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/userStore";
import { authClient } from "@/lib/authClient";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

export default function OnboardingPage() {
  const [username, setUsername] = useState("");
  const [collegeName, setCollegeName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const setUser = useUserStore((s) => s.setUser);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!username.trim() || !collegeName.trim()) {
      setError("Both fields are required.");
      return;
    }

    setLoading(true);
    try {
      const cleanUsername = username.trim();
      const cleanCollege = collegeName.trim();
      const fakeEmail = `${cleanUsername}@dummy.local`;
      const fakePassword = `secure_${cleanUsername}_123`;

      // 1. Try signing in
      let authRes: any = await authClient.signIn.email({
        email: fakeEmail,
        password: fakePassword,
      });

      // 2. If user doesn't exist, sign up
      if (authRes.error) {
        authRes = await authClient.signUp.email({
          email: fakeEmail,
          password: fakePassword,
          name: cleanUsername,
          username: cleanUsername,
          collegeName: cleanCollege,
        });

        if (authRes.error) {
          throw new Error(authRes.error.message || "Failed to enter arena.");
        }
      }

      // 3. Fetch full extended user from backend
      const res = await fetch(`${BACKEND_URL}/api/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: cleanUsername,
          collegeName: cleanCollege,
          id: authRes.data.user.id
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Something went wrong fetching profile");
      }

      const dbUser = await res.json();
      setUser(dbUser);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Network error. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-12">
      {/* Ambient glow */}
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />

      <div className="relative w-full max-w-md animate-slide-up">
        {/* Logo / Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-lg">
              ⚔
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-muted bg-clip-text text-transparent">
              LeetCode Duels
            </h1>
          </div>
          <p className="text-muted text-sm">
            Challenge your friends. Code under pressure. Climb the ranks.
          </p>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-surface border border-border rounded-2xl p-8 glow-purple space-y-6"
        >
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-foreground/80 mb-2"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="e.g. code_ninja"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground
                         placeholder:text-muted/50 outline-none
                         focus:border-primary focus:ring-1 focus:ring-primary/30
                         transition-all duration-200"
            />
          </div>

          <div>
            <label
              htmlFor="college"
              className="block text-sm font-medium text-foreground/80 mb-2"
            >
              College Name
            </label>
            <input
              id="college"
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="e.g. MIT, Stanford, IIT Bombay"
              value={collegeName}
              onChange={(e) => setCollegeName(e.target.value)}
              className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground
                         placeholder:text-muted/50 outline-none
                         focus:border-primary focus:ring-1 focus:ring-primary/30
                         transition-all duration-200"
            />
          </div>

          {error && (
            <div className="text-danger text-sm bg-danger/10 border border-danger/20 rounded-lg px-4 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-white
                       bg-gradient-to-r from-primary to-primary-hover
                       hover:from-primary-hover hover:to-accent
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-300 cursor-pointer
                       shadow-lg shadow-primary/20 hover:shadow-primary/40"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Entering the Arena...
              </span>
            ) : (
              "Enter the Arena →"
            )}
          </button>
        </form>

        <p className="text-center text-muted/50 text-xs mt-6">
          Your Elo rating starts at 1200. Climb the leaderboard!
        </p>
      </div>
    </main>
  );
}
