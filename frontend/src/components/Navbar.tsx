"use client";

import { useRouter, usePathname } from "next/navigation";
import { useUserStore } from "@/store/userStore";
import { Button } from "@/components/ui/button";
import { Swords, Trophy, User, LogOut } from "lucide-react";

const NAV_LINKS = [
  { label: "Dashboard", href: "/dashboard", icon: Swords },
  { label: "Leaderboard", href: "/leaderboard", icon: Trophy },
] as const;

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const user = useUserStore((s) => s.user);

  return (
    <header className="w-full bg-card border-b border-border px-6 py-3 flex items-center justify-between z-50 shrink-0">
      {/* Logo */}
      <button
        onClick={() => router.push("/dashboard")}
        className="flex items-center gap-2 cursor-pointer"
      >
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-semibold text-sm">
          ⚔
        </div>
        <span className="text-lg font-semibold text-foreground">
          LeetCode <span className="text-primary">Duels</span>
        </span>
      </button>

      {/* Nav Links + Actions */}
      <div className="flex items-center gap-2">
        {NAV_LINKS.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;
          return (
            <Button
              key={link.href}
              variant={isActive ? "secondary" : "ghost"}
              size="sm"
              onClick={() => router.push(link.href)}
              className="cursor-pointer"
            >
              <Icon className="size-4" />
              {link.label}
            </Button>
          );
        })}

        {user && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/profile/${user.username}`)}
            className="cursor-pointer"
          >
            <User className="size-4" />
            <span className="font-mono text-sm">{user.username}</span>
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            useUserStore.getState().clearUser();
            router.replace("/");
          }}
          className="text-destructive hover:text-destructive cursor-pointer"
        >
          <LogOut className="size-4" />
        </Button>
      </div>
    </header>
  );
}
