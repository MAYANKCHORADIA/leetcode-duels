import { Router } from "express";
import { executeCode } from "../controllers/executeController.js";

const router = Router();

router.post("/", executeCode);

export default router;
