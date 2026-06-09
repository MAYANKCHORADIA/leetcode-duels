import { Router } from "express";
import { createOrFetchUser, getUserProfile, searchUsers } from "../controllers/userController.js";

const router = Router();

router.post("/", createOrFetchUser);
router.get("/profile/:username", getUserProfile);
router.get("/search", searchUsers);

export default router;
