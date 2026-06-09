import { Router } from "express";
import { getGlobalLeaderboard, getCollegeLeaderboard } from "../controllers/leaderboardController.js";

const router = Router();

router.get("/global", getGlobalLeaderboard);
router.get("/college", getCollegeLeaderboard);

export default router;
