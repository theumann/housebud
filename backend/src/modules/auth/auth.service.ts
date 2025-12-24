import { prisma } from "../../config/db";
import { SignupInput, LoginInput } from "./auth.types";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";

export async function signup(input: SignupInput) {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
  });
  if (existing) {
    const err: any = new Error("Email already in use");
    err.status = 400;
    throw err;
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      profile: {
        create: {
          firstName: input.firstName,
          lastName: input.lastName,
          nickname: input.nickname,
          birthDate: new Date(input.birthDate),
          school: input.school,
          collegeYear: input.collegeYear,
          targetCity: input.targetCity,
          targetState: input.targetState,
          targetZip: input.targetZip,
          originalCity: input.originalCity ?? null,
          originalState: input.originalState ?? null,
        },
      },
      settings: {
        create: {},
      },
    },
    include: {
      profile: true,
    },
  });

  const token = jwt.sign({ userId: user.id }, env.JWT_SECRET, {
    expiresIn: "7d",
  });

  return { token, user };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: { profile: true },
  });
  if (!user) {
    const err: any = new Error("Invalid credentials");
    err.status = 401;
    throw err;
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    const err: any = new Error("Invalid credentials");
    err.status = 401;
    throw err;
  }

  const token = jwt.sign({ userId: user.id }, env.JWT_SECRET, {
    expiresIn: "7d",
  });

  return { token, user };
}
