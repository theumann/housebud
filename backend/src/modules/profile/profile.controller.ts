import { Response, NextFunction } from "express";
import { AuthRequest } from "../../middleware/authMiddleware";
import { ProfileUpdateSchema } from "./profile.types";
import { getMyProfile, updateMyProfile } from "./profile.service";

export async function getMyProfileHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await getMyProfile(req.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateMyProfileHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const input = ProfileUpdateSchema.parse(req.body);

    const profile = await updateMyProfile(req.userId, input);
    res.json(profile);
  } catch (err) {
    next(err);
  }
}