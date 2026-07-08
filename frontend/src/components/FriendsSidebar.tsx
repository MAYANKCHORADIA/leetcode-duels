"use client";

import { useState, useEffect } from "react";
import { User } from "@/store/userStore";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Search, UserPlus, Swords, Check } from "lucide-react";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

interface Friendship {
  id: string;
  status: string;
  type: "INCOMING" | "OUTGOING";
  user: User;
}

export default function FriendsSidebar({
  currentUser,
  onChallenge,
}: {
  currentUser: User;
  onChallenge: (friendId: string) => void;
}) {
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);

  const fetchFriends = () => {
    fetch(`${BACKEND_URL}/api/friends/${currentUser.id}`)
      .then((res) => res.json())
      .then(setFriends)
      .catch(console.error);
  };

  useEffect(() => {
    fetchFriends();
    const interval = setInterval(fetchFriends, 10000);
    return () => clearInterval(interval);
  }, [currentUser.id]);

  const searchUsers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) return;
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/users/search?q=${search}`
      );
      const data = await res.json();
      setSearchResults(data.filter((u: User) => u.id !== currentUser.id));
    } catch (err) {
      console.error(err);
    }
  };

  const sendRequest = async (addresseeId: string) => {
    try {
      await fetch(`${BACKEND_URL}/api/friends/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesterId: currentUser.id,
          addresseeId,
        }),
      });
      fetchFriends();
      setSearch("");
      setSearchResults([]);
    } catch (err) {
      console.error(err);
    }
  };

  const acceptRequest = async (requesterId: string) => {
    try {
      await fetch(`${BACKEND_URL}/api/friends/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesterId,
          addresseeId: currentUser.id,
        }),
      });
      fetchFriends();
    } catch (err) {
      console.error(err);
    }
  };

  const acceptedFriends = friends.filter((f) => f.status === "ACCEPTED");
  const pendingIncoming = friends.filter(
    (f) => f.status === "PENDING" && f.type === "INCOMING"
  );

  return (
    <aside className="w-72 border-r border-border bg-card p-4 h-full overflow-y-auto hidden lg:flex flex-col gap-6 z-10">
      <h2 className="text-lg font-semibold text-foreground">Friends</h2>

      {/* Search */}
      <form onSubmit={searchUsers} className="flex gap-2">
        <Input
          type="text"
          placeholder="Search users..."
          className="font-mono text-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button type="submit" variant="secondary" size="icon" className="cursor-pointer shrink-0">
          <Search className="size-4" />
        </Button>
      </form>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            Results
          </h3>
          <div className="flex flex-col gap-2">
            {searchResults.map((u) => {
              const f = friends.find((f) => f.user.id === u.id);
              return (
                <div
                  key={u.id}
                  className="flex items-center justify-between p-3 bg-background border border-border rounded-lg"
                >
                  <span className="font-mono text-sm font-medium text-foreground">
                    {u.username}
                  </span>
                  {!f && (
                    <Button
                      variant="default"
                      size="xs"
                      onClick={() => sendRequest(u.id)}
                      className="cursor-pointer"
                    >
                      <UserPlus className="size-3" />
                      Add
                    </Button>
                  )}
                  {f?.status === "PENDING" && (
                    <Badge variant="secondary">Pending</Badge>
                  )}
                  {f?.status === "ACCEPTED" && (
                    <Badge variant="outline" className="text-success border-success/30">
                      Friend
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Pending Requests */}
      {pendingIncoming.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            Friend Requests
          </h3>
          <div className="flex flex-col gap-2">
            {pendingIncoming.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between p-3 bg-background border border-border rounded-lg"
              >
                <span className="font-mono text-sm font-medium text-foreground">
                  {f.user?.username}
                </span>
                <Button
                  variant="default"
                  size="xs"
                  onClick={() => acceptRequest(f.user.id)}
                  className="cursor-pointer bg-success text-success-foreground hover:bg-success/80"
                >
                  <Check className="size-3" />
                  Accept
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      <Separator />

      {/* Friends List */}
      <section className="flex flex-col gap-2 flex-1">
        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          Friends List
          <span className="w-2 h-2 rounded-full bg-success" />
        </h3>
        {acceptedFriends.length === 0 ? (
          <div className="text-sm text-muted-foreground bg-background border border-dashed border-border rounded-lg p-4 text-center">
            No friends yet. Search above to add some!
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {acceptedFriends.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between p-3 bg-background border border-border rounded-lg hover:border-primary/30 transition-colors"
              >
                <span className="font-mono text-sm font-medium text-foreground">
                  {f.user?.username}
                </span>
                <Button
                  variant="default"
                  size="xs"
                  onClick={() => onChallenge(f.user.id)}
                  className="cursor-pointer"
                >
                  <Swords className="size-3" />
                  Challenge
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </aside>
  );
}
