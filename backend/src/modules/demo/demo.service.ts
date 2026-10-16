import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { randomBytes, randomUUID } from "node:crypto";
import { env } from "../../config/env";
import { HttpError, notFound } from "../../errors/http.error";
import { issueAuthResponse } from "../auth/auth.utils";
import { generateUniqueJoinCode } from "../household/household.service";
import {
  DEMO_EMAIL_DOMAIN,
  SANDBOX_EMAIL_DOMAIN,
  SANDBOX_HOURLY_CAP,
  SANDBOX_LIFETIME_HOURS,
} from "./demo.types";

const HOUR = 60 * 60 * 1000;

// Calendar day `offset` days from today, as chores store it (@db.Date).
function day(offset: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function chore(input: {
  name: string;
  repeat: { every: number; unit: "day" | "week" | "month" } | null;
  dueIn: number;
  rotation: string[];
  createdByUserId: string;
}) {
  const dueDate = day(input.dueIn);
  return {
    name: input.name,
    repeatEvery: input.repeat?.every ?? null,
    repeatUnit: input.repeat?.unit ?? null,
    dueDate,
    anchorDay: dueDate.getUTCDate(),
    rotation: input.rotation,
    createdByUserId: input.createdByUserId,
  };
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const sandboxEmail = { endsWith: `@${SANDBOX_EMAIL_DOMAIN}` };

// Sandboxes still in use: replacing the demo users would take their housemates.
export function countActiveSandboxes(prisma: PrismaClient) {
  return prisma.user.count({
    where: {
      email: sandboxEmail,
      createdAt: { gte: new Date(Date.now() - SANDBOX_LIFETIME_HOURS * HOUR) },
    },
  });
}

export async function removeExpiredSandboxes(prisma: PrismaClient) {
  const expired = await prisma.user.findMany({
    where: {
      email: sandboxEmail,
      createdAt: { lt: new Date(Date.now() - SANDBOX_LIFETIME_HOURS * HOUR) },
    },
    select: { id: true },
  });
  const ids = expired.map((u) => u.id);
  if (ids.length === 0) return 0;

  // Households and rooms only lose their creator when a user is deleted, so
  // remove the ones the visitor created first; everything else cascades.
  await prisma.$transaction([
    prisma.household.deleteMany({ where: { createdByUserId: { in: ids } } }),
    prisma.chatRoom.deleteMany({ where: { createdByUserId: { in: ids } } }),
    prisma.user.deleteMany({ where: { id: { in: ids } } }),
  ]);
  return ids.length;
}

export async function createSandbox(prisma: PrismaClient) {
  if (!env.DEMO_SANDBOX) throw notFound();

  await removeExpiredSandboxes(prisma);

  const lastHour = await prisma.user.count({
    where: {
      email: sandboxEmail,
      createdAt: { gte: new Date(Date.now() - HOUR) },
    },
  });
  if (lastHour >= SANDBOX_HOURLY_CAP) {
    throw new HttpError(
      429,
      "The demo is busy right now. Please try again in a few minutes.",
    );
  }

  const demoUsers = await prisma.user.findMany({
    where: { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } },
    select: { id: true },
  });
  if (demoUsers.length < 2) {
    throw new HttpError(503, "The demo isn't set up yet.");
  }
  const [mate1, mate2] = shuffle(demoUsers).map((u) => u.id);

  // Answers to every question, so Matches shows real scores.
  const questions = await prisma.compatibilityQuestion.findMany({
    where: { isActive: true },
    select: { id: true, options: true },
  });
  const answers = questions.flatMap((q) => {
    const options = Array.isArray(q.options) ? q.options.map(String) : [];
    if (options.length === 0) return [];
    const value = options[Math.floor(Math.random() * options.length)];
    return [{ questionId: q.id, value }];
  });

  const handle = randomBytes(6).toString("hex");
  const visitor = await prisma.user.create({
    data: {
      email: `visitor-${handle}@${SANDBOX_EMAIL_DOMAIN}`,
      username: `visitor-${handle}`,
      // Nobody logs in with a password: the visitor gets a token below.
      passwordHash: await bcrypt.hash(randomUUID(), 10),
      profile: {
        create: {
          firstName: "Demo",
          lastName: "Visitor",
          birthDate: new Date("2004-06-15"),
          school: "SFSU",
          collegeYear: "Junior",
          targetCity: "San Francisco",
          targetState: "CA",
          targetZip: "94110",
          bio: "Trying out HouseBud.",
        },
      },
      settings: { create: {} },
      answers: { create: answers },
    },
  });
  const me = visitor.id;

  // The same states as the dev seed's household: overdue, due today and
  // started, upcoming, rotating, monthly, one-off, with some history, plus a
  // short chat. Members joined before its messages, or the chat would hide them.
  const joinedAt = new Date(Date.now() - 30 * 24 * HOUR);

  await prisma.household.create({
    data: {
      name: "Maple Street House",
      joinCode: await generateUniqueJoinCode(prisma),
      createdByUserId: me,
      settings: { create: {} },
      members: {
        create: [
          { userId: me, role: "owner", status: "active", joinedAt },
          { userId: mate1, role: "member", status: "active", joinedAt },
          { userId: mate2, role: "member", status: "active", joinedAt },
        ],
      },
      chores: {
        create: [
          {
            ...chore({
              name: "Take out trash",
              repeat: { every: 1, unit: "week" },
              dueIn: -2,
              rotation: [mate1, me],
              createdByUserId: me,
            }),
            completions: {
              create: {
                doneByUserId: me,
                dueDate: day(-9),
                completedOn: day(-9),
                previousRotationIndex: 1,
              },
            },
          },
          {
            ...chore({
              name: "Clean bathroom",
              repeat: { every: 1, unit: "week" },
              dueIn: 0,
              rotation: [me, mate1, mate2],
              createdByUserId: mate1,
            }),
            startedAt: new Date(Date.now() - HOUR),
            startedByUserId: mate2,
          },
          {
            ...chore({
              name: "Vacuum living room",
              repeat: { every: 2, unit: "week" },
              dueIn: 3,
              rotation: [mate2, me],
              createdByUserId: mate2,
            }),
            completions: {
              create: {
                doneByUserId: mate2,
                dueDate: day(-11),
                completedOn: day(-10),
                previousRotationIndex: 1,
              },
            },
          },
          chore({
            name: "Water the plants",
            repeat: { every: 3, unit: "day" },
            dueIn: 1,
            rotation: [mate1, mate2, me],
            createdByUserId: mate1,
          }),
          chore({
            name: "Pay internet bill",
            repeat: { every: 1, unit: "month" },
            dueIn: 10,
            rotation: [me],
            createdByUserId: me,
          }),
          chore({
            name: "Fix the shelf",
            repeat: null,
            dueIn: 5,
            rotation: [],
            createdByUserId: mate2,
          }),
        ],
      },
      shoppingItems: {
        create: [
          { name: "Milk", quantity: "2 L", addedByUserId: me },
          { name: "Eggs", quantity: "x12", addedByUserId: mate1 },
          { name: "Dish soap", addedByUserId: mate2 },
          { name: "Tortillas", addedByUserId: mate1 },
          {
            name: "Coffee",
            addedByUserId: mate2,
            checkedAt: new Date(),
            checkedByUserId: mate1,
          },
          {
            name: "Toilet paper",
            quantity: "x8",
            addedByUserId: me,
            checkedAt: new Date(),
            checkedByUserId: mate2,
          },
        ],
      },
      messages: {
        create: [
          {
            senderUserId: mate1,
            text: "Welcome to the house! Chores and the shopping list are in the tabs above.",
            createdAt: new Date(Date.now() - 26 * HOUR),
          },
          {
            senderUserId: mate2,
            text: "Heads up, the trash is overdue. Whose turn is it?",
            createdAt: new Date(Date.now() - 3 * HOUR),
          },
          {
            senderUserId: mate2,
            text: "I'm on the bathroom now.",
            createdAt: new Date(Date.now() - HOUR),
          },
        ],
      },
    },
  });

  return issueAuthResponse(visitor, `${SANDBOX_LIFETIME_HOURS}h`);
}
