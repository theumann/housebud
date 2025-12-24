import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { getMatchesHandler } from "./matches.controller";

const router = Router();

router.get("/", authMiddleware, getMatchesHandler);

export default router;
