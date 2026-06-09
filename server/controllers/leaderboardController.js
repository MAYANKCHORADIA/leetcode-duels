import prisma from "../config/db.js";

// GET /api/leaderboard/global
export const getGlobalLeaderboard = async (req, res) => {
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
};

// GET /api/leaderboard/college
export const getCollegeLeaderboard = async (req, res) => {
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
};
