import { Response, NextFunction } from "express";
import { AuthRequest } from "../../middleware/authMiddleware";
import type { PrismaClient } from "@prisma/client";
import {
  CompatibilityAnswersUpdateSchema,
} from "./compatibility.types";
import {
  getActiveQuestions,
  getMyAnswers,
  updateMyAnswers,
} from "./compatibility.service";

export async function getQuestionsHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const prisma = (req as any).prisma as PrismaClient;
    const questions = await getActiveQuestions(prisma);
    res.json(questions);
  } catch (err) {
    next(err);
  }
}

export async function getMyAnswersHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const prisma = (req as any).prisma as PrismaClient;
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await getMyAnswers(prisma, req.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateMyAnswersHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const prisma = (req as any).prisma as PrismaClient;
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const input = CompatibilityAnswersUpdateSchema.parse(req.body);

    const result = await updateMyAnswers(prisma, req.userId, input);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
