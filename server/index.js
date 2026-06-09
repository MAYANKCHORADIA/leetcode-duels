import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";

// Config
import prisma from "./config/db.js";
import { auth, toNodeHandler } from "./config/auth.js";

// Routes
import userRoutes from "./routes/userRoutes.js";
import executeRoutes from "./routes/executeRoutes.js";
import leaderboardRoutes from "./routes/leaderboardRoutes.js";
import friendRoutes from "./routes/friendRoutes.js";

// Socket
import initializeSocket from "./socket/socketHandler.js";

// ─── Load Env ───────────────────────────────────────────────────────
dotenv.config();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const PORT = process.env.PORT || 8080;

// ─── Express & HTTP Server ──────────────────────────────────────────
const app = express();
const server = http.createServer(app);

// ─── Middleware ──────────────────────────────────────────────────────
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());

// ─── Auth Handler ───────────────────────────────────────────────────
app.all("/api/auth/*path", toNodeHandler(auth));

// ─── API Routes ─────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.json({ status: "ok", message: "LeetCode Duels API is running 🚀" });
});

app.use("/api/users", userRoutes);
app.use("/api/execute", executeRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/friends", friendRoutes);

// ─── Socket.io ──────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

initializeSocket(io);

// ─── Start Server ───────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`🖥️  Server is running on http://localhost:${PORT}`);
});

// ─── Graceful Shutdown ──────────────────────────────────────────────
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
