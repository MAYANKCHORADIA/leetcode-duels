const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const dotenv = require("dotenv");
const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

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
    room.startTime = Date.now();
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
    try {
      const room = rooms.get(roomId);
      if (!room || room.status === "completed") return;

      room.status = "completed"; // Prevent duplicate processing

      const winnerData = room.players.find((p) => p.id === userId);
      const loserData = room.players.find((p) => p.id !== userId);

      if (!winnerData || !loserData) return;

      // Fetch current stats from DB
      const winner = await prisma.user.findUnique({ where: { id: winnerData.id } });
      const loser = await prisma.user.findUnique({ where: { id: loserData.id } });

      if (!winner || !loser) return;

      // Calculate Elo changes (K=32)
      const K = 32;
      const expectedWinner = 1 / (1 + Math.pow(10, (loser.eloRating - winner.eloRating) / 400));
      const expectedLoser = 1 / (1 + Math.pow(10, (winner.eloRating - loser.eloRating) / 400));

      const newWinnerElo = winner.eloRating + Math.round(K * (1 - expectedWinner));
      const newLoserElo = loser.eloRating + Math.round(K * (0 - expectedLoser));

      const winnerGain = newWinnerElo - winner.eloRating;
      const loserLoss = newLoserElo - loser.eloRating;

      const duration = room.startTime ? Math.floor((Date.now() - room.startTime) / 1000) : 0;

      // Prisma Transaction: Atomically update both users and create match history
      await prisma.$transaction([
        prisma.user.update({
          where: { id: winner.id },
          data: {
            eloRating: newWinnerElo,
            matchesPlayed: { increment: 1 },
            matchesWon: { increment: 1 },
          },
        }),
        prisma.user.update({
          where: { id: loser.id },
          data: {
            eloRating: newLoserElo,
            matchesPlayed: { increment: 1 },
          },
        }),
        prisma.matchHistory.create({
          data: {
            winnerId: winner.id,
            loserId: loser.id,
            problemName: room.config?.topic || "Two Sum",
            duration: duration,
          },
        }),
      ]);

      // Broadcast match over
      io.to(roomId).emit("match_over", {
        winnerId: winner.id,
        winnerUsername: winner.username,
        newWinnerElo,
        newLoserElo,
        winnerGain,
        loserLoss,
        duration,
      });

      console.log(`🏆 Match Over in ${roomId} - Winner: ${winner.username}`);
      rooms.delete(roomId);
    } catch (err) {
      console.error("Error processing match_won:", err);
    }
  });

  // ── Disconnect ──
  socket.on("disconnect", () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// ─── Judge0 Batch Config ──────────────────────────────────────────────
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || "";
const JUDGE0_HOST = "judge0-ce.p.rapidapi.com";
const JUDGE0_URL = "https://" + JUDGE0_HOST;

const LANGUAGE_MAP = {
  cpp: 54,       // C++ (GCC 9.2.0)
  python: 71,    // Python (3.8.1)
  javascript: 63,// JavaScript (Node.js 12.14.0)
  java: 62,      // Java (OpenJDK 13.0.1)
};

// Hidden test cases per problem (keyed by problem_id)
const HIDDEN_TEST_CASES = {
  two_sum: [
    { input: "4\n2 7 11 15\n9", expected_output: "0 1" },
    { input: "3\n3 2 4\n6", expected_output: "1 2" },
    { input: "2\n3 3\n6", expected_output: "0 1" },
    { input: "5\n1 5 3 7 2\n9", expected_output: "1 4" },
    { input: "4\n-1 -2 -3 -4\n-6", expected_output: "1 3" },
  ],
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

// ── Execute code against test cases ──
app.post("/api/execute", async (req, res) => {
  try {
    const { source_code, language_id, problem_id } = req.body;

    if (!source_code || !language_id) {
      return res.status(400).json({ error: "source_code and language_id are required" });
    }

    const langId = LANGUAGE_MAP[language_id] || LANGUAGE_MAP.python;
    const testCases = HIDDEN_TEST_CASES[problem_id || "two_sum"] || HIDDEN_TEST_CASES.two_sum;

    const submissions = testCases.map(tc => ({
      language_id: langId,
      source_code,
      stdin: tc.input,
      expected_output: tc.expected_output
    }));

    const headers = {
      "Content-Type": "application/json",
      "X-RapidAPI-Key": RAPIDAPI_KEY,
      "X-RapidAPI-Host": JUDGE0_HOST,
    };

    // 1. Submit the batch
    const batchCreateRes = await fetch(`${JUDGE0_URL}/submissions/batch?base64_encoded=false`, {
      method: "POST",
      headers,
      body: JSON.stringify({ submissions }),
    });

    if (!batchCreateRes.ok) {
      const text = await batchCreateRes.text();
      throw new Error(`Judge0 batch submission failed: ${batchCreateRes.status} ${text}`);
    }

    const tokensArray = await batchCreateRes.json();
    const tokens = tokensArray.map(t => t.token).join(",");

    // 2. Poll for results (Max 5 attempts, 1.5s interval)
    let finalResults = [];
    let isFinished = false;

    for (let attempts = 0; attempts < 5; attempts++) {
      await sleep(1500);
      const pollRes = await fetch(`${JUDGE0_URL}/submissions/batch?tokens=${tokens}&base64_encoded=false&fields=status,stdout,stderr,compile_output,expected_output,time,memory`, {
        headers
      });

      if (!pollRes.ok) continue;

      const data = await pollRes.json();
      const polledSubmissions = data.submissions;
      
      const allDone = polledSubmissions.every(s => s.status && s.status.id >= 3);
      if (allDone) {
        finalResults = polledSubmissions;
        isFinished = true;
        break;
      }
    }

    // fallback if timed out
    if (!isFinished) {
      const pollRes = await fetch(`${JUDGE0_URL}/submissions/batch?tokens=${tokens}&base64_encoded=false&fields=status,stdout,stderr,compile_output,expected_output,time,memory`, {
        headers
      }).catch(() => null);
      if (pollRes && pollRes.ok) {
        const data = await pollRes.json();
        finalResults = data.submissions;
      }
    }

    let passedCount = 0;
    const results = [];

    // 3. Evaluate and Respond
    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const resultObj = finalResults[i] || { status: { id: 5, description: "Execution Timeout" } };
      
      const isPassed = resultObj.status?.id === 3;
      if (isPassed) passedCount++;

      results.push({
        testCase: i + 1,
        status: resultObj.status?.description || "Unknown",
        passed: isPassed,
        stdout: resultObj.stdout?.trim() || null,
        stderr: resultObj.stderr?.trim() || null,
        compile_output: resultObj.compile_output?.trim() || null,
        expected: tc.expected_output,
        time: resultObj.time || null,
        memory: resultObj.memory || null,
      });

      if (!isPassed) {
        // Break on first failure and mock remaining tests
        for (let j = i + 1; j < testCases.length; j++) {
          results.push({
            testCase: j + 1,
            status: "Skipped",
            passed: false,
            stdout: null,
            stderr: null,
            compile_output: null,
            expected: testCases[j].expected_output,
            time: null,
            memory: null,
          });
        }
        break;
      }
    }

    return res.json({
      passed: passedCount,
      total: testCases.length,
      allPassed: passedCount === testCases.length,
      results,
    });
  } catch (err) {
    console.error("Error in POST /api/execute:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Leaderboard: Global ──
app.get("/api/leaderboard/global", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { eloRating: "desc" },
      take: 50,
      select: { id: true, username: true, collegeName: true, eloRating: true, matchesPlayed: true, matchesWon: true },
    });
    return res.json(users);
  } catch (err) {
    console.error("Error fetching global leaderboard:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Leaderboard: College ──
app.get("/api/leaderboard/college", async (req, res) => {
  try {
    const colleges = await prisma.user.groupBy({
      by: ["collegeName"],
      _avg: { eloRating: true },
      _count: { id: true },
      orderBy: {
        _avg: { eloRating: "desc" },
      },
      take: 50,
    });
    // Format the response
    const formatted = colleges.map((c) => ({
      collegeName: c.collegeName,
      avgElo: Math.round(c._avg.eloRating),
      studentCount: c._count.id,
    }));
    return res.json(formatted);
  } catch (err) {
    console.error("Error fetching college leaderboard:", err);
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
