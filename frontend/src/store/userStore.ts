import { create } from "zustand";

export interface User {
  id: string;
  username: string;
  collegeName: string;
  eloRating: number;
  matchesPlayed?: number;
  matchesWon?: number;
}

interface UserState {
  user: User | null;
  setUser: (user: User) => void;
  clearUser: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),
}));
