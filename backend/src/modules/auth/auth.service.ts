import { Prisma, type PrismaClient } from "@prisma/client";
import { SignupInput, LoginInput } from "./auth.types";
import bcrypt from "bcrypt";
import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env";
import { issueAuthResponse } from "./auth.utils";
import { AuthError } from "../../errors/auth.error";
import { conflict, forbidden } from "../../errors/http.error";

// Trimmed and case-insensitive, since people type codes from a message.
function signupCodeMatches(given: string | undefined) {
  if (!env.SIGNUP_CODE) return true;
  const digest = (s: string) =>
    createHash("sha256").update(s.trim().toLowerCase()).digest();
  return timingSafeEqual(digest(given ?? ""), digest(env.SIGNUP_CODE));
}

export function signupOptions() {
  return { codeRequired: Boolean(env.SIGNUP_CODE) };
}

export async function signup(prisma: PrismaClient, input: SignupInput) {
  // Before anything else, so without a code signup reveals nothing, not even
  // whether an email already has an account.
  if (!signupCodeMatches(input.signupCode)) {
    throw forbidden("A valid invite code is required to sign up");
  }

  const email = input.email.toLowerCase();
  const username = input.username.toLowerCase();
  const passwordHash = await bcrypt.hash(input.password, 10);

  try {
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
  } catch (err) {
    // email and username are unique; a taken one is the user's mistake, not a 500
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const fields = String(err.meta?.target ?? "");
      throw conflict(
        fields.includes("username")
          ? "That username is taken"
          : "An account with this email already exists",
      );
    }
    throw err;
  }
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
