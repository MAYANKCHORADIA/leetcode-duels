import { Router } from "express";
import { sendFriendRequest, acceptFriendRequest, getFriends } from "../controllers/friendController.js";

const router = Router();

router.post("/request", sendFriendRequest);
router.post("/accept", acceptFriendRequest);
router.get("/:userId", getFriends);

export default router;
