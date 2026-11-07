import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import {
  SignupInput,
  LoginInput,
  ChangePasswordInput,
  MIN_SIGNUP_AGE,
  NOTICE_VERSION,
  ageOn,
} from "./auth.types";
import bcrypt from "bcrypt";
import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env";
import { issueAuthResponse } from "./auth.utils";
import { AuthError } from "../../errors/auth.error";
import { badRequest, conflict, forbidden } from "../../errors/http.error";
import {
  checkLoginAllowed,
  checkSignupAllowed,
  recordAuthFailure,
} from "./auth.throttle";

// Trimmed and case-insensitive, since people type codes from a message.
function signupCodeMatches(given: string | undefined) {
  if (!env.SIGNUP_CODE) return true;
  const digest = (s: string) =>
    createHash("sha256").update(s.trim().toLowerCase()).digest();
  return timingSafeEqual(digest(given ?? ""), digest(env.SIGNUP_CODE));
}

export function signupOptions() {
  return {
    codeRequired: Boolean(env.SIGNUP_CODE),
    demoAvailable: env.DEMO_SANDBOX,
  };
}

export async function signup(
  prisma: PrismaClient,
  input: SignupInput,
  ip: string,
) {
  await checkSignupAllowed(prisma, ip);

  // Before anything else, so without a code signup reveals nothing, not even
  // whether an email already has an account.
  if (!signupCodeMatches(input.signupCode)) {
    await recordAuthFailure(prisma, "signup", ip);
    throw forbidden("A valid invite code is required to sign up");
  }

  if (ageOn(input.birthDate, new Date()) < MIN_SIGNUP_AGE) {
    throw badRequest(
      `You must be ${MIN_SIGNUP_AGE} or older to sign up for HouseBud.`,
    );
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
        noticeVersion: NOTICE_VERSION,
        noticeAcceptedAt: new Date(),
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
      await recordAuthFailure(prisma, "signup", ip);
      // Which one: asked of the database, since err.meta's shape changes
      // between Prisma versions (Prisma 7 dropped meta.target)
      const usernameTaken = await prisma.user.findUnique({
        where: { username },
        select: { id: true },
      });
      throw conflict(
        usernameTaken
          ? "That username is taken"
          : "An account with this email already exists",
      );
    }
    throw err;
  }
}

export async function login(
  prisma: PrismaClient,
  input: LoginInput,
  ip: string,
) {
  const identifier = input.identifier.toLowerCase();
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: identifier }, { username: identifier }],
    },
    include: { profile: true },
  });

  // The user id, so guesses by email and by username count together.
  const account = user?.id ?? identifier;
  // Checked before the password, so a correct guess past the limit is refused too.
  await checkLoginAllowed(prisma, ip, account);

  const ok = user && (await bcrypt.compare(input.password, user.passwordHash));
  if (!ok) {
    await recordAuthFailure(prisma, "login", ip, account);
    throw new AuthError("Invalid credentials");
  }
  return issueAuthResponse(user);
}

export async function acceptNotice(prisma: PrismaClient, userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { noticeVersion: NOTICE_VERSION, noticeAcceptedAt: new Date() },
  });
}

// 403, not 401, for a wrong current password: the user is logged in, and a
// 401 would read as an expired session.
export async function changePassword(
  prisma: PrismaClient,
  userId: string,
  input: ChangePasswordInput,
) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const ok = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!ok) {
    throw forbidden("Current password is incorrect");
  }
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(input.newPassword, 10) },
  });
}
