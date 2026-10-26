import { Request, Response, NextFunction } from "express";
import type { AuthRequest } from "../../middleware/authMiddleware";
import { SignupSchema, LoginSchema, ChangePasswordSchema } from "./auth.types";
import { signup, login, signupOptions, changePassword } from "./auth.service";

export async function signupHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const input = SignupSchema.parse(req.body);
    const prisma = req.prisma;
    const result = await signup(prisma, input);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export function signupOptionsHandler(req: Request, res: Response) {
  res.json(signupOptions());
}

export async function loginHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const input = LoginSchema.parse(req.body);
    const prisma = req.prisma;
    const result = await login(prisma, input);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function changePasswordHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const input = ChangePasswordSchema.parse(req.body);
    await changePassword(req.prisma, req.userId!, input);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
