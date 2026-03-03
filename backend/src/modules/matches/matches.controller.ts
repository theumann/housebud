import { Response, NextFunction } from "express";
import { AuthRequest } from "../../middleware/authMiddleware";
import { getMatchesForUser } from "./matches.service";
import type { PrismaClient } from "@prisma/client";

export async function getMatchesHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const prisma = (req as any).prisma as PrismaClient;
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const pageParam = req.query.page as string | undefined;
    const limitParam = req.query.limit as string | undefined;

    const page = pageParam ? parseInt(pageParam, 10) : 1;
    const limit = limitParam ? parseInt(limitParam, 10) : 20;

    const result = await getMatchesForUser(prisma, req.userId, page, limit);

    res.json(result);
  } catch (err) {
    next(err);
  }
}
