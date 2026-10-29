import type { NextFunction, Response } from "express";
import type { AuthRequest } from "../../middleware/authMiddleware";
import { env } from "../../config/env";
import * as service from "./feedback.service";
import { CreateFeedbackSchema } from "./feedback.types";

export async function createFeedbackHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const input = CreateFeedbackSchema.parse(req.body);
    const result = await service.createFeedback(
      req.prisma,
      req.userId!,
      input,
      {
        userAgent: req.get("user-agent"),
        appVersion: env.APP_VERSION ?? undefined,
      },
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}
