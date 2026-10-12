import { Request, Response, NextFunction } from "express";
import { createSandbox } from "./demo.service";

export async function createSandboxHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await createSandbox(req.prisma);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}
