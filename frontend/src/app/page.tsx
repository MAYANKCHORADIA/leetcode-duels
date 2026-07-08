"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/userStore";
import { authClient } from "@/lib/authClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

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
        } as any);

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
          id: authRes.data.user.id,
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
      <div className="relative w-full max-w-md animate-slide-up">
        {/* Logo / Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-semibold text-lg">
              ⚔
            </div>
            <h1 className="text-2xl font-semibold text-foreground">
              LeetCode Duels
            </h1>
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            Challenge your friends. Code under pressure. Climb the ranks.
          </p>
        </div>

        {/* Card */}
        <Card className="glow-primary">
          <CardHeader>
            <CardTitle>Enter the Arena</CardTitle>
            <CardDescription>
              Sign in with your username and college to get started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="username"
                  className="text-sm font-medium text-foreground"
                >
                  Username
                </label>
                <Input
                  id="username"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="e.g. code_ninja"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="font-mono"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor="college"
                  className="text-sm font-medium text-foreground"
                >
                  College Name
                </label>
                <Input
                  id="college"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="e.g. MIT, Stanford, IIT Bombay"
                  value={collegeName}
                  onChange={(e) => setCollegeName(e.target.value)}
                />
              </div>

              {error && (
                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full cursor-pointer"
                size="lg"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    Entering the Arena...
                  </span>
                ) : (
                  "Enter the Arena →"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-muted-foreground text-sm mt-6">
          Your Elo rating starts at 1200. Climb the leaderboard!
        </p>
      </div>
    </main>
  );
}
