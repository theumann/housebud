import { Router } from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import {
  getMyProfileHandler,
  updateMyProfileHandler,
} from "./profile.controller";

const router = Router();

// All profile routes require auth
router.get("/me", authMiddleware, getMyProfileHandler);
router.patch("/me", authMiddleware, updateMyProfileHandler);

export default router;
