"use client";

import { useState, useEffect } from "react";
import { User } from "@/store/userStore";

interface Friendship {
  id: string;
  status: string;
  type: "INCOMING" | "OUTGOING";
  user: User;
}

export default function FriendsSidebar({ currentUser, onChallenge }: { currentUser: User, onChallenge: (friendId: string) => void }) {
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);

  const fetchFriends = () => {
    fetch(`http://localhost:8080/api/friends/${currentUser.id}`)
      .then(res => res.json())
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
      const res = await fetch(`http://localhost:8080/api/users/search?q=${search}`);
      const data = await res.json();
      setSearchResults(data.filter((u: User) => u.id !== currentUser.id));
    } catch (err) {
      console.error(err);
    }
  };

  const sendRequest = async (addresseeId: string) => {
    try {
      await fetch("http://localhost:8080/api/friends/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesterId: currentUser.id, addresseeId })
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
      await fetch("http://localhost:8080/api/friends/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesterId, addresseeId: currentUser.id })
      });
      fetchFriends();
    } catch (err) {
      console.error(err);
    }
  };

  const acceptedFriends = friends.filter(f => f.status === "ACCEPTED");
  const pendingIncoming = friends.filter(f => f.status === "PENDING" && f.type === "INCOMING");

  return (
    <div className="w-80 border-r border-border bg-surface border-opacity-50 p-4 h-full overflow-y-auto hidden lg:block scrollbar-thin z-10 transition-all">
      <h2 className="text-xl font-bold text-foreground mb-4">Friends & Social</h2>
      
      <form onSubmit={searchUsers} className="mb-6 flex gap-2">
        <input 
          type="text" 
          placeholder="Search users..." 
          className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary/50"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="submit" className="bg-primary/20 text-primary px-3 rounded-lg hover:bg-primary/30 text-sm font-semibold transition-colors">Find</button>
      </form>

      {searchResults.length > 0 && (
        <div className="mb-6 animate-fade-in">
          <h3 className="text-xs text-muted uppercase tracking-wider mb-2 font-semibold">Results</h3>
          <div className="space-y-2">
            {searchResults.map(u => {
              const f = friends.find(f => f.user.id === u.id);
              return (
                <div key={u.id} className="flex items-center justify-between p-2 bg-background border border-border rounded-lg text-sm">
                  <span className="font-semibold text-foreground/90">{u.username}</span>
                  {!f && (
                    <button onClick={() => sendRequest(u.id)} className="text-xs font-semibold bg-primary text-white px-2 py-1 rounded hover:opacity-90">Add</button>
                  )}
                  {f?.status === 'PENDING' && <span className="text-xs font-semibold text-muted">Pending</span>}
                  {f?.status === 'ACCEPTED' && <span className="text-xs font-semibold text-success">Friend</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {pendingIncoming.length > 0 && (
        <div className="mb-6 animate-fade-in">
          <h3 className="text-xs text-muted uppercase tracking-wider mb-2 font-semibold">Friend Requests</h3>
          <div className="space-y-2">
            {pendingIncoming.map(f => (
              <div key={f.id} className="flex items-center justify-between p-2 bg-background border border-border rounded-lg text-sm">
                <span className="font-semibold text-foreground/90">{f.user?.username}</span>
                <button onClick={() => acceptRequest(f.user.id)} className="text-xs font-semibold bg-success text-white px-3 py-1 rounded hover:opacity-90">Accept</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-xs text-muted uppercase tracking-wider mb-2 font-semibold flex items-center gap-2">
          Friends List <span className="w-2 h-2 rounded-full bg-success shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
        </h3>
        {acceptedFriends.length === 0 ? (
          <div className="text-sm text-muted bg-background/50 border border-border border-dashed rounded-lg p-4 text-center">No friends yet. Add some to start challenging!</div>
        ) : (
           <div className="space-y-2">
            {acceptedFriends.map(f => (
              <div key={f.id} className="flex items-center justify-between p-2.5 bg-background border border-border rounded-lg text-sm hover:border-primary/30 transition-colors">
                <span className="font-semibold text-foreground/90">{f.user?.username}</span>
                <button 
                  onClick={() => onChallenge(f.user.id)} 
                  className="text-xs font-bold px-2 py-1 rounded-md bg-accent text-white hover:opacity-90 transition-opacity flex items-center gap-1 shadow-md shadow-accent/20"
                >
                  Challenge
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
