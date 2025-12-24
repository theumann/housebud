import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import {
  getQuestionsHandler,
  getMyAnswersHandler,
  updateMyAnswersHandler,
} from "./compatibility.controller";

const router = Router();

// You *could* allow questions without auth, but for now we keep everything under auth.
router.get("/questions", authMiddleware, getQuestionsHandler);
router.get("/answers/me", authMiddleware, getMyAnswersHandler);
router.put("/answers/me", authMiddleware, updateMyAnswersHandler);

export default router;
