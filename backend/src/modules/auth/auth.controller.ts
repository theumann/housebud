import { Request, Response, NextFunction } from "express";
import { SignupSchema, LoginSchema } from "./auth.types";
import { signup, login } from "./auth.service";
import type { PrismaClient } from "@prisma/client";

export async function signupHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const prisma = (req as any).prisma as PrismaClient;
    const input = SignupSchema.parse(req.body);
    const result = await signup(prisma, input);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function loginHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const prisma = (req as any).prisma as PrismaClient;
    const input = LoginSchema.parse(req.body);
    const result = await login(prisma, input);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
