import prisma from "../config/db.js";
import { processMatchOver, generateRoomId } from "./matchHelpers.js";

// In-memory stores
const rooms = new Map();
const connectedUsers = new Map(); // userId -> socket.id

/**
 * Initialize all Socket.io event handlers.
 * @param {import("socket.io").Server} io
 */
export default function initializeSocket(io) {
  io.on("connection", (socket) => {
    console.log(`⚡ Client connected: ${socket.id}`);

    // ── Create Room ──
    socket.on("create_room", ({ difficulty, topic, timeLimit, user }) => {
      let roomId = generateRoomId();
      while (rooms.has(roomId)) roomId = generateRoomId();

      rooms.set(roomId, {
        config: { difficulty, topic, timeLimit },
        players: [{ socketId: socket.id, ...user }],
      });

      socket.join(roomId);
      socket.emit("room_created", { roomId });
      console.log(`🏠 Room ${roomId} created by ${user.username}`);
    });

    // ── Join Room ──
    socket.on("join_room", async ({ roomId, user }) => {
      const room = rooms.get(roomId);

      if (!room) {
        socket.emit("room_error", { message: "Room not found. Check the ID and try again." });
        return;
      }

      if (room.players.length >= 2) {
        socket.emit("room_error", { message: "Room is already full." });
        return;
      }

      room.players.push({ socketId: socket.id, ...user });
      socket.join(roomId);
      console.log(`🤝 ${user.username} joined room ${roomId}`);

      try {
        const difficulty = room.config?.difficulty || "Easy";
        const topic = room.config?.topic || "Arrays";
        
        const matchingProblems = await prisma.problem.findMany({
          where: { difficulty, topic }
        });

        let selectedProblem;
        if (matchingProblems.length > 0) {
          const randomIndex = Math.floor(Math.random() * matchingProblems.length);
          selectedProblem = matchingProblems[randomIndex];
        } else {
          selectedProblem = await prisma.problem.findFirst();
        }

        const problemData = selectedProblem ? {
          id: selectedProblem.id,
          title: selectedProblem.title,
          description: selectedProblem.description,
          difficulty: selectedProblem.difficulty,
          topic: selectedProblem.topic
        } : {
          id: "placeholder",
          title: "No Match Found",
          description: "We couldn't find a problem matching those parameters in the DB.",
          difficulty: difficulty,
          topic: topic
        };

        // Both players present → start match
        room.startTime = Date.now();
        io.to(roomId).emit("match_start", {
          roomId,
          players: room.players.map((p) => ({
            id: p.id,
            username: p.username,
          })),
          config: room.config,
          problem: problemData,
        });
        console.log(`🚀 Match started in room ${roomId} with problem ${problemData.id}`);
      } catch (err) {
        console.error("Match start error:", err);
        socket.emit("room_error", { message: "Internal server error starting the match." });
      }
    });

    // ── Code Update (typing indicator) ──
    socket.on("code_update", ({ roomId, userId }) => {
      socket.to(roomId).emit("opponent_typing", { userId });
    });

    // ── Run Tests (opponent progress) ──
    socket.on("run_tests", ({ roomId, userId, username, passed, total }) => {
      socket.to(roomId).emit("opponent_progress", { userId, username, passed, total });
    });

    // ── Match Won ──
    socket.on("match_won", async ({ roomId, userId }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      const loser = room.players.find(p => p.id !== userId);
      if (!loser) return;
      await processMatchOver(io, rooms, roomId, userId, loser.id);
    });

    // ── Forfeit Match ──
    socket.on("forfeit_match", async ({ roomId, userId }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      const winner = room.players.find(p => p.id !== userId);
      if (!winner) return;
      await processMatchOver(io, rooms, roomId, winner.id, userId);
    });

    // ── User Identity & Challenges ──
    socket.on("identify", (userId) => {
      if (userId) connectedUsers.set(userId, socket.id);
    });
    
    socket.on("send_challenge", ({ friendId, roomId, challenger }) => {
      const friendSocketId = connectedUsers.get(friendId);
      if (friendSocketId) {
        io.to(friendSocketId).emit("challenge_received", { roomId, challenger });
      }
    });

    // ── Disconnect ──
    socket.on("disconnect", () => {
      for (const [key, value] of connectedUsers.entries()) {
        if (value === socket.id) connectedUsers.delete(key);
      }
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });
}
