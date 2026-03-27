import { create } from 'zustand';

export interface Problem {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  topic: string;
}

interface RoomState {
  roomId: string;
  problem: Problem | null;
  setRoomState: (roomId: string, problem: Problem) => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  roomId: "",
  problem: null,
  setRoomState: (roomId, problem) => set({ roomId, problem }),
}));
