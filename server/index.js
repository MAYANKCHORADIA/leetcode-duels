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

  // ── Code Update (typing indicator) ──
  socket.on("code_update", ({ roomId, userId }) => {
    socket.to(roomId).emit("opponent_typing", { userId });
  });

  // ── Run Tests (opponent progress) ──
  socket.on("run_tests", ({ roomId, userId, username, passed, total }) => {
    socket.to(roomId).emit("opponent_progress", { userId, username, passed, total });
  });

  // ── Disconnect ──
  socket.on("disconnect", () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// ─── Judge0 Config ──────────────────────────────────────────────────
const JUDGE0_API_URL = process.env.JUDGE0_API_URL || "https://judge0-ce.p.rapidapi.com";
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY || "";

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

// Helper: sleep
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper: submit a single test case to Judge0 and poll for result
async function submitToJudge0(sourceCode, languageId, stdin, expectedOutput) {
  const headers = {
    "Content-Type": "application/json",
    "X-RapidAPI-Key": JUDGE0_API_KEY,
    "X-RapidAPI-Host": new URL(JUDGE0_API_URL).hostname,
  };

  // Create submission
  const createRes = await fetch(`${JUDGE0_API_URL}/submissions?base64_encoded=false&wait=false`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      source_code: sourceCode,
      language_id: languageId,
      stdin,
      expected_output: expectedOutput,
    }),
  });

  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Judge0 submission failed: ${createRes.status} ${text}`);
  }

  const { token } = await createRes.json();

  // Poll for result (max ~10 seconds)
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    const pollRes = await fetch(
      `${JUDGE0_API_URL}/submissions/${token}?base64_encoded=false&fields=status,stdout,stderr,compile_output,message,time,memory`,
      { headers }
    );
    const result = await pollRes.json();

    // Status 1 = In Queue, 2 = Processing
    if (result.status && result.status.id > 2) {
      return result;
    }
  }

  return { status: { id: 5, description: "Execution Timeout" }, stdout: null, stderr: "Judge0 timed out after 10 seconds" };
}

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

    const langId = LANGUAGE_MAP[language_id] || language_id;
    const testCases = HIDDEN_TEST_CASES[problem_id || "two_sum"] || HIDDEN_TEST_CASES.two_sum;

    const results = [];
    let passed = 0;

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      try {
        const result = await submitToJudge0(source_code, langId, tc.input, tc.expected_output);

        const statusId = result.status?.id;
        const isPassed = statusId === 3; // 3 = Accepted
        if (isPassed) passed++;

        results.push({
          testCase: i + 1,
          status: result.status?.description || "Unknown",
          passed: isPassed,
          stdout: result.stdout?.trim() || null,
          stderr: result.stderr?.trim() || null,
          compile_output: result.compile_output?.trim() || null,
          expected: tc.expected_output,
          time: result.time,
          memory: result.memory,
        });

        // If compile error, skip remaining tests
        if (statusId === 6) {
          for (let j = i + 1; j < testCases.length; j++) {
            results.push({
              testCase: j + 1,
              status: "Skipped",
              passed: false,
              stdout: null,
              stderr: null,
              compile_output: result.compile_output?.trim() || null,
              expected: testCases[j].expected_output,
              time: null,
              memory: null,
            });
          }
          break;
        }
      } catch (err) {
        results.push({
          testCase: i + 1,
          status: "Error",
          passed: false,
          stdout: null,
          stderr: err.message,
          compile_output: null,
          expected: tc.expected_output,
          time: null,
          memory: null,
        });
      }
    }

    return res.json({
      passed,
      total: testCases.length,
      allPassed: passed === testCases.length,
      results,
    });
  } catch (err) {
    console.error("Error in POST /api/execute:", err);
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
