import type { PrismaClient } from "../../generated/prisma/client";
import bcrypt from "bcrypt";
import { randomBytes, randomUUID } from "node:crypto";
import { env } from "../../config/env";
import { HttpError, notFound } from "../../errors/http.error";
import { issueAuthResponse } from "../auth/auth.utils";
import { generateUniqueJoinCode } from "../household/household.service";
import { splitEqually } from "../expenses/expenses.service";
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

  const household = await prisma.household.create({
    data: {
      name: "Maple Street House",
      joinCode: await generateUniqueJoinCode(prisma),
      createdByUserId: me,
      settings: { create: { expensesEnabled: true } },
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
          // Checked by the visitor, so they can try "I bought these".
          {
            name: "Pasta",
            addedByUserId: mate1,
            checkedAt: new Date(),
            checkedByUserId: me,
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

  // The visitor owes mate1 $12.50, so Dues has something to settle.
  const everyone = [me, mate1, mate2];
  const expenses = [
    {
      description: "Groceries",
      amountCents: 7350,
      paidBy: mate1,
      split: everyone,
      dayOffset: -5,
    },
    {
      description: "Internet",
      amountCents: 6000,
      paidBy: me,
      split: everyone,
      dayOffset: -12,
    },
    {
      description: "Pizza night",
      amountCents: 3600,
      paidBy: mate2,
      split: [me, mate2],
      dayOffset: -2,
    },
  ];
  for (const e of expenses) {
    await prisma.expense.create({
      data: {
        householdId: household.id,
        description: e.description,
        amountCents: e.amountCents,
        paidByUserId: e.paidBy,
        spentOn: day(e.dayOffset),
        createdByUserId: e.paidBy,
        shares: { create: splitEqually(e.amountCents, e.split) },
      },
    });
  }
  await prisma.settlement.create({
    data: {
      householdId: household.id,
      fromUserId: mate2,
      toUserId: me,
      amountCents: 1000,
      paidOn: day(-1),
      createdByUserId: mate2,
    },
  });

  // Rules everyone agreed to, and a new one from mate1 waiting for the
  // visitor, so House rules has a badge on arrival.
  const rules = [
    {
      title: "Quiet hours after 11pm",
      details: "Sunday to Thursday. Headphones for music and calls.",
      daysAgo: 25,
    },
    {
      title: "Dishes done the same day",
      details: "Nothing left in the sink overnight.",
      daysAgo: 20,
    },
    {
      title: "Tell the house before overnight guests",
      details: "A message in the household chat is enough.",
      daysAgo: 14,
    },
  ];
  for (const r of rules) {
    const adoptedAt = new Date(Date.now() - r.daysAgo * 24 * HOUR);
    const rule = await prisma.houseRule.create({
      data: {
        householdId: household.id,
        title: r.title,
        details: r.details,
        adoptedAt,
      },
    });
    await prisma.ruleProposal.create({
      data: {
        householdId: household.id,
        kind: "add",
        ruleId: rule.id,
        title: r.title,
        details: r.details,
        proposedByUserId: mate1,
        status: "adopted",
        decidedAt: adoptedAt,
        createdAt: new Date(adoptedAt.getTime() - 24 * HOUR),
        votes: {
          create: everyone.map((userId) => ({ userId, agree: true })),
        },
      },
    });
  }
  await prisma.ruleProposal.create({
    data: {
      householdId: household.id,
      kind: "add",
      title: "Label your food in the fridge",
      details: "Unlabelled food is fair game after three days.",
      reason: "My yogurt keeps disappearing!",
      proposedByUserId: mate1,
      createdAt: new Date(Date.now() - 5 * HOUR),
      votes: {
        create: [
          { userId: mate1, agree: true },
          { userId: mate2, agree: true },
        ],
      },
    },
  });

  // A weekly house meeting, a few events, a housemate away and the
  // visitor's guest, in the next two weeks.
  const entry = (input: {
    kind: "event" | "away" | "guest";
    title?: string;
    notes?: string;
    userId?: string;
    from: number;
    to?: number;
    startTime?: string;
    weekly?: boolean;
  }) => ({
    householdId: household.id,
    kind: input.kind,
    userId: input.userId ?? null,
    title: input.title ?? null,
    notes: input.notes ?? null,
    startsOn: day(input.from),
    endsOn: day(input.to ?? input.from),
    startTime: input.startTime ?? null,
    repeatEvery: input.weekly ? 1 : null,
    repeatUnit: input.weekly ? "week" : null,
    anchorDay: day(input.from).getUTCDate(),
    createdByUserId: input.userId ?? mate1,
  });
  await prisma.calendarEvent.createMany({
    data: [
      entry({
        kind: "event",
        title: "House meeting",
        notes: "Living room. Bring your chore swaps.",
        from: -4,
        startTime: "19:00",
        weekly: true,
      }),
      entry({ kind: "event", title: "Landlord inspection", from: 3 }),
      entry({ kind: "event", title: "Painting the hallway", from: 8, to: 9 }),
      entry({
        kind: "away",
        userId: mate2,
        notes: "Visiting family",
        from: 5,
        to: 7,
      }),
      entry({ kind: "guest", userId: me, title: "My cousin", from: 1, to: 2 }),
    ],
  });

  return issueAuthResponse(visitor, `${SANDBOX_LIFETIME_HOURS}h`);
}
