import prisma from "../config/db.js";

// POST /api/users — Create or fetch user
export const createOrFetchUser = async (req, res) => {
  try {
    const { username, collegeName, id } = req.body;

    if (!username || !collegeName) {
      return res.status(400).json({ error: "Username and college are required" });
    }

    // Use upsert to handle both cases:
    // - Better Auth already created the user (signUp) → update custom fields
    // - User exists from a previous login → just fetch
    const user = await prisma.user.upsert({
      where: { username },
      update: {
        collegeName,
      },
      create: {
        id: id,
        name: username,
        email: `${username}@dummy.local`,
        emailVerified: true,
        username,
        collegeName,
        eloRating: 1200,
        matchesPlayed: 0,
        matchesWon: 0,
      },
    });

    res.json(user);
  } catch (err) {
    console.error("Error in /api/users:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// GET /api/users/profile/:username — Profile & Match History
export const getUserProfile = async (req, res) => {
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
};

// GET /api/users/search — Search users by username
export const searchUsers = async (req, res) => {
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
};
