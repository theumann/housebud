import { Request, Response, NextFunction } from "express";
import { SignupSchema, LoginSchema } from "./auth.types";
import { signup, login } from "./auth.service";

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
