import prisma from "../config/db.js";

// POST /api/friends/request
export const sendFriendRequest = async (req, res) => {
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
};

// POST /api/friends/accept
export const acceptFriendRequest = async (req, res) => {
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
};

// GET /api/friends/:userId
export const getFriends = async (req, res) => {
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
};
