const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const dotenv = require("dotenv");
const { PrismaClient } = require("@prisma/client");

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);
const prisma = new PrismaClient();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const PORT = process.env.PORT || 8080;

// ─── Middleware ──────────────────────────────────────────────────────
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());

// ─── Socket.io Setup ────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// ─── In-memory Room Store ───────────────────────────────────────────
const rooms = new Map();

function generateRoomId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "";
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

// ─── Socket.io Events ──────────────────────────────────────────────
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
  socket.on("join_room", ({ roomId, user }) => {
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

    // Both players present → start match
    io.to(roomId).emit("match_start", {
      roomId,
      players: room.players.map((p) => ({
        id: p.id,
        username: p.username,
      })),
      config: room.config,
    });
    console.log(`🚀 Match started in room ${roomId}`);
  });

  // ── Disconnect ──
  socket.on("disconnect", () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// ─── REST Routes ────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.json({ status: "ok", message: "LeetCode Duels API is running 🚀" });
});

// ── Create or fetch user ──
app.post("/api/users", async (req, res) => {
  try {
    const { username, collegeName } = req.body;

    if (!username || !collegeName) {
      return res.status(400).json({ error: "username and collegeName are required" });
    }

    const user = await prisma.user.upsert({
      where: { username },
      update: {},
      create: { username, collegeName },
      select: { id: true, username: true, collegeName: true, eloRating: true, matchesPlayed: true, matchesWon: true },
    });

    return res.json(user);
  } catch (err) {
    console.error("Error in POST /api/users:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Start Server ───────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`🖥️  Server is running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
