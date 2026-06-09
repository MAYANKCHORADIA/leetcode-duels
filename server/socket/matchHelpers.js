import prisma from "../config/db.js";

/**
 * Process match completion: calculate Elo, update DB, broadcast results.
 */
export async function processMatchOver(io, rooms, roomId, winnerId, loserId) {
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

/**
 * Generate a unique 6-character room ID.
 */
export function generateRoomId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "";
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}
