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

const { betterAuth } = require("better-auth");
const { prismaAdapter } = require("better-auth/adapters/prisma");
const { toNodeHandler } = require("better-auth/node");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const PORT = process.env.PORT || 8080;

const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  baseURL: "http://localhost:8080",
  trustedOrigins: [FRONTEND_URL],
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      username: { type: "string", required: true },
      collegeName: { type: "string", required: true },
      eloRating: { type: "number", required: false, defaultValue: 1200 },
      matchesPlayed: { type: "number", required: false, defaultValue: 0 },
      matchesWon: { type: "number", required: false, defaultValue: 0 },
    }
  }
});



// ─── Middleware ──────────────────────────────────────────────────────
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());

app.all("/api/auth/*path", toNodeHandler(auth));

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
const connectedUsers = new Map(); // userId -> socket.id

// Helper for Match Over
async function processMatchOver(roomId, winnerId, loserId) {
  try {
    const room = rooms.get(roomId);
    if (!room || room.status === "completed") return;

    room.status = "completed"; // Prevent duplicate processing

    const winnerData = room.players.find((p) => p.id === winnerId);
    const loserData = room.players.find((p) => p.id === loserId);

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
    const newLoserElo = Math.max(0, loser.eloRating + Math.round(K * (0 - expectedLoser)));

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
    console.error("Error processing match over:", err);
  }
}

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
    await processMatchOver(roomId, userId, loser.id);
  });

  // ── Forfeit Match ──
  socket.on("forfeit_match", async ({ roomId, userId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const winner = room.players.find(p => p.id !== userId);
    if (!winner) return;
    await processMatchOver(roomId, winner.id, userId);
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

// Hidden test cases moved to database

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── REST Routes ────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.json({ status: "ok", message: "LeetCode Duels API is running 🚀" });
});

// ── Create or fetch user ──
app.post("/api/users", async (req, res) => {
  try {
    const { username, collegeName, id } = req.body;

    if (!username || !collegeName) {
      return res.status(400).json({ error: "Username and college are required" });
    }

    let user = await prisma.user.findUnique({ where: { username } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          id: id,                    // Sync ID with Better Auth
          name: username,            // Sync Name with Better Auth
          email: `${username}@dummy.local`,
          emailVerified: true,
          username,
          collegeName,
          eloRating: 1200,
          matchesPlayed: 0,
          matchesWon: 0,
        },
      });
    }

    res.json(user);
  } catch (err) {
    console.error("Error in /api/users:", err);
    res.status(500).json({ error: "Internal server error" });
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
    
    // Fetch problem from database to retrieve its test cases
    const problem = await prisma.problem.findUnique({
      where: { id: problem_id }
    });

    if (!problem || !problem.testCases) {
      return res.status(404).json({ error: "Problem not found or has no test cases." });
    }

    const testCases = problem.testCases;

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

// ── Profile & Match History ──
app.get("/api/users/profile/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const matchHistory = await prisma.matchHistory.findMany({
      where: {
        OR: [{ winnerId: user.id }, { loserId: user.id }]
      },
      orderBy: { createdAt: "desc" },
      take: 20
    });

    const opponentIds = matchHistory.map(m => m.winnerId === user.id ? m.loserId : m.winnerId);
    const opponents = await prisma.user.findMany({ where: { id: { in: opponentIds } } });

    const populatedHistory = matchHistory.map(m => {
      const isWinner = m.winnerId === user.id;
      const opponentId = isWinner ? m.loserId : m.winnerId;
      const opponent = opponents.find(u => u.id === opponentId);
      return {
        ...m,
        opponentName: opponent ? opponent.username : "Unknown",
        isWinner
      };
    });

    res.json({ ...user, matchHistory: populatedHistory });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Social & Friends ──
app.get("/api/users/search", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    const users = await prisma.user.findMany({
      where: { username: { contains: q, mode: "insensitive" } },
      take: 10
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/friends/request", async (req, res) => {
  try {
    const { requesterId, addresseeId } = req.body;
    if (requesterId === addresseeId) return res.status(400).json({ error: "Cannot add yourself" });
    
    // Check existing
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId, addresseeId },
          { requesterId: addresseeId, addresseeId: requesterId }
        ]
      }
    });
    
    if (existing) return res.status(400).json({ error: "Friendship already exists" });

    const friend = await prisma.friendship.create({
      data: { requesterId, addresseeId }
    });
    res.json(friend);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/friends/accept", async (req, res) => {
  try {
    const { requesterId, addresseeId } = req.body;
    const friend = await prisma.friendship.update({
      where: { requesterId_addresseeId: { requesterId, addresseeId } },
      data: { status: "ACCEPTED" }
    });
    res.json(friend);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/friends/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const friendships = await prisma.friendship.findMany({
      where: { OR: [{ requesterId: userId }, { addresseeId: userId }] }
    });

    const relatedUserIds = friendships.map(f => f.requesterId === userId ? f.addresseeId : f.requesterId);
    const users = await prisma.user.findMany({
      where: { id: { in: relatedUserIds } },
      select: { id: true, username: true, eloRating: true, collegeName: true }
    });

    const friendsList = friendships.map(f => {
      const isRequester = f.requesterId === userId;
      const relatedId = isRequester ? f.addresseeId : f.requesterId;
      const user = users.find(u => u.id === relatedId);

      return {
        ...f,
        user,
        type: isRequester ? "OUTGOING" : "INCOMING"
      };
    });

    res.json(friendsList);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
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
