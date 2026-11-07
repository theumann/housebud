import type { PrismaClient } from "../../generated/prisma/client";
import { HttpError } from "../../errors/http.error";

// Counted in the database, like the feedback and demo limits, so they hold
// with more than one backend instance. Only failures count: a household
// signing up together from one dorm network isn't slowed down.
const MINUTE = 60 * 1000;
export const AUTH_LIMITS = {
  loginPerAccount: { max: 10, windowMs: 15 * MINUTE },
  // Higher: students share addresses (campus Wi-Fi, phone carriers).
  loginPerIp: { max: 30, windowMs: 15 * MINUTE },
  signupPerIp: { max: 10, windowMs: 60 * MINUTE },
  // Household join codes (POST /households/join): per user and per address.
  joinPerAccount: { max: 10, windowMs: 60 * MINUTE },
  joinPerIp: { max: 30, windowMs: 60 * MINUTE },
};
const KEEP_MS = 24 * 60 * MINUTE;

type Limit = { max: number; windowMs: number };
type Kind = "login" | "signup" | "join";

export class TooManyAttemptsError extends HttpError {
  retryAfterSeconds: number;

  constructor(retryAfterMs: number) {
    const minutes = Math.max(1, Math.ceil(retryAfterMs / MINUTE));
    super(
      429,
      `Too many failed attempts. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    );
    this.retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  }
}

// Milliseconds until the oldest failure in the window expires, or 0 when
// under the limit.
async function waitFor(
  prisma: PrismaClient,
  where: { kind: Kind; ip?: string; account?: string },
  limit: Limit,
) {
  const recent = await prisma.authFailure.findMany({
    where: {
      ...where,
      createdAt: { gte: new Date(Date.now() - limit.windowMs) },
    },
    orderBy: { createdAt: "desc" },
    take: limit.max,
    select: { createdAt: true },
  });
  if (recent.length < limit.max) return 0;
  return (
    recent[limit.max - 1].createdAt.getTime() + limit.windowMs - Date.now()
  );
}

export async function checkLoginAllowed(
  prisma: PrismaClient,
  ip: string,
  account: string,
) {
  const wait = Math.max(
    await waitFor(
      prisma,
      { kind: "login", account },
      AUTH_LIMITS.loginPerAccount,
    ),
    await waitFor(prisma, { kind: "login", ip }, AUTH_LIMITS.loginPerIp),
  );
  if (wait > 0) throw new TooManyAttemptsError(wait);
}

export async function checkJoinAllowed(
  prisma: PrismaClient,
  ip: string,
  userId: string,
) {
  const wait = Math.max(
    await waitFor(
      prisma,
      { kind: "join", account: userId },
      AUTH_LIMITS.joinPerAccount,
    ),
    await waitFor(prisma, { kind: "join", ip }, AUTH_LIMITS.joinPerIp),
  );
  if (wait > 0) throw new TooManyAttemptsError(wait);
}

export async function checkSignupAllowed(prisma: PrismaClient, ip: string) {
  const wait = await waitFor(
    prisma,
    { kind: "signup", ip },
    AUTH_LIMITS.signupPerIp,
  );
  if (wait > 0) throw new TooManyAttemptsError(wait);
}

export async function recordAuthFailure(
  prisma: PrismaClient,
  kind: Kind,
  ip: string,
  account?: string,
) {
  await prisma.$transaction([
    prisma.authFailure.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - KEEP_MS) } },
    }),
    prisma.authFailure.create({ data: { kind, ip, account } }),
  ]);
}
