import type { PrismaClient } from "@prisma/client";
import { SignupInput, LoginInput } from "./auth.types";
import bcrypt from "bcrypt";
import { issueAuthResponse } from "./auth.utils";
import { AuthError } from "../../errors/auth.error";

export async function signup(prisma: PrismaClient, input: SignupInput) {
  const email = input.email.toLowerCase();
  const username = input.username.toLowerCase();
  const passwordHash = await bcrypt.hash(input.password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      username,
      passwordHash,
      profile: {
        create: {
          firstName: input.firstName,
          lastName: input.lastName,
          displayName: input.displayName ?? null,
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
  return issueAuthResponse(user);
}

export async function login(prisma: PrismaClient, input: LoginInput) {
  const identifier = input.identifier.toLowerCase();
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: identifier }, { username: identifier }],
    },
    include: { profile: true },
  });

  if (!user) {
    throw new AuthError("Invalid credentials");
  }

  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) {
    throw new AuthError("Invalid credentials");
  }
  return issueAuthResponse(user);
}
