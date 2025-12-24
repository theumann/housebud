import { Response, NextFunction } from "express";
import { AuthRequest } from "../../middleware/authMiddleware";
import {
  CompatibilityAnswersUpdateSchema,
} from "./compatibility.types";
import {
  getActiveQuestions,
  getMyAnswers,
  updateMyAnswers,
} from "./compatibility.service";

export async function getQuestionsHandler(
  _req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const questions = await getActiveQuestions();
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
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await getMyAnswers(req.userId);
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
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const input = CompatibilityAnswersUpdateSchema.parse(req.body);

    const result = await updateMyAnswers(req.userId, input);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
