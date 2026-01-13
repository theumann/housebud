import "dotenv/config";
import { createPrisma } from "../src/config/prisma";
import { faker } from "@faker-js/faker";
import { Prisma } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = createPrisma();

type SeedPlan = {
  totalUsers: number;
  chatrooms: number;
  maxMessagesPerRoom: number; // inclusive
  answerBuckets: Array<{
    pct: number; // 0..1
    // fraction of active questions answered
    min: number; // 0..1
    max: number; // 0..1
  }>;
};

const PLAN_100: SeedPlan = {
  totalUsers: 100,
  chatrooms: 30,
  maxMessagesPerRoom: 101,
  answerBuckets: [
    { pct: 0.2, min: 0.0, max: 0.0 },      // 0 answers
    { pct: 0.2, min: 0.01, max: 0.19 },    // >0 but <20%
    { pct: 0.4, min: 0.2, max: 0.8 },      // 20%–80%
    { pct: 0.2, min: 0.81, max: 1.0 },     // 80%–100%
  ],
};

async function ensurePersonalUsers(password: string) {
  const passwordHash = await bcrypt.hash(password, 10);

  const users = [
    {
      email: "me1@bunkbuddy.dev",
      firstName: "Me",
      lastName: "One",
      username: "me1",
      displayName: "Me1",
      school: "USF",
      collegeYear: "Freshman",
      targetCity: "San Francisco",
      targetState: "CA",
      targetZip: "94110",
    },
    {
      email: "me2@bunkbuddy.dev",
      firstName: "Me",
      lastName: "Two",
      username: "me2",
      displayName: "Me2",
      school: "SFSU",
      collegeYear: "Sophomore",
      targetCity: "San Francisco",
      targetState: "CA",
      targetZip: "94114",
    },
    {
      email: "me3@bunkbuddy.dev",
      firstName: "Me",
      lastName: "Three",
      username: "me3",
      displayName: "Me3",
      school: "whoKnows",
      collegeYear: "Junior",
      targetCity: "randomCity",
      targetState: "randomState",
      targetZip: "78000",
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        passwordHash,
      },
      create: {
        email: u.email,
        username: u.username.toLowerCase(),
        passwordHash,
        profile: {
          create: {
            firstName: u.firstName,
            lastName: u.lastName,
            displayName: u.displayName,
            birthDate: new Date("2004-01-01"),
            school: u.school,
            collegeYear: u.collegeYear,
            targetCity: u.targetCity,
            targetState: u.targetState,
            targetZip: u.targetZip,
            bio: "Seeded personal user",
            avatarUrl: null,
          },
        },
      },
    });
  }
}

function pickBucket(plan: SeedPlan): { min: number; max: number } {
  const r = faker.number.float({ min: 0, max: 1 });
  let acc = 0;
  for (const b of plan.answerBuckets) {
    acc += b.pct;
    if (r <= acc) return { min: b.min, max: b.max };
  }
  return { min: plan.answerBuckets.at(-1)!.min, max: plan.answerBuckets.at(-1)!.max };
}

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function sample<T>(arr: T[]) {
  return arr[Math.floor(faker.number.float({ min: 0, max: 1 }) * arr.length)];
}

function sampleMany<T>(arr: T[], count: number): T[] {
  const copy = [...arr];
  faker.helpers.shuffle(copy);
  return copy.slice(0, Math.min(count, copy.length));
}

async function getActiveQuestions() {
  // Only active questions count for coverage/scoring
  const questions = await prisma.compatibilityQuestion.findMany({
    where: { isActive: true },
    select: { id: true, code: true, type: true, options: true },
    orderBy: [{ category: "asc" }, { orderIndex: "asc" }],
  });

  // For JSON columns, options will be `unknown` in TS; normalize to string[] | null
  return questions.map((q) => {
    const raw = q.options as unknown;
    const options = Array.isArray(raw) ? raw.map(String) : null;
    return { ...q, options };
  });
}

async function createUsersWithProfiles(targetCount: number) {
  const existing = await prisma.user.findMany({ select: { id: true, email: true } });
  const existingEmails = new Set(existing.map((u) => u.email.toLowerCase()));

  const toCreate: Prisma.UserCreateInput[] = [];
  while (toCreate.length < targetCount) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const email = faker.internet.email({ firstName, lastName }).toLowerCase();

    if (existingEmails.has(email)) continue;
    existingEmails.add(email);

    // Keep target zip/city relatively consistent to create meaningful matches.
    const targetCity = "San Francisco";
    const targetState = "CA";
    const targetZip = faker.helpers.arrayElement([
      "94102","94103","94105","94107","94108","94109","94110","94112","94114","94115","94116","94117","94118","94121","94122","94123","94124","94127","94129","94130","94131","94132","94133","94134"
    ]);

    const username = `user${existingEmails.size + toCreate.length + 1}`;
    const displayName = faker.internet.username({ firstName, lastName }).slice(0, 20);

    toCreate.push({
      email,
      username, // required, deterministic
      passwordHash: "SEEDED_DEV_USER", // you can overwrite later; or hash if you want
      profile: {
        create: {
          firstName,
          lastName,
          displayName, // cosmetic only
          birthDate: faker.date.birthdate({ min: 18, max: 24, mode: "age" }),
          school: faker.helpers.arrayElement(["USF", "UCSF", "SFSU"]),
          collegeYear: faker.helpers.arrayElement(["Freshman", "Sophomore", "Junior", "Senior", "Grad"]),
          targetCity,
          targetState,
          targetZip,
          bio: faker.helpers.maybe(() => faker.lorem.sentences({ min: 1, max: 2 }), { probability: 0.6 }) ?? null,
          avatarUrl: faker.helpers.maybe(() => faker.image.avatar(), { probability: 0.5 }) ?? null,
        },
      },
    });
  }

  // Create sequentially to keep it simple and avoid nested createMany limitations.
  const createdIds: string[] = [];
  for (const u of toCreate) {
    const created = await prisma.user.create({
      data: u,
      select: { id: true },
    });
    createdIds.push(created.id);
  }

  // Return all users (including pre-existing) so chat seeding can include them too.
  const all = await prisma.user.findMany({ select: { id: true } });
  return all.map((u) => u.id);
}

async function seedCompatibilityAnswersForUsers(userIds: string[], activeQuestions: Awaited<ReturnType<typeof getActiveQuestions>>) {
  if (activeQuestions.length === 0) {
    console.log("No active questions found. Skipping answers seeding.");
    return;
  }

  // Clear only seeded answers? You said DB is empty now, so we’ll just insert.
  // If you want rerunnable behavior later, we can delete answers for users we created.
  for (const userId of userIds) {
    const bucket = pickBucket(PLAN_100);

    const fraction = bucket.min === bucket.max
      ? bucket.min
      : faker.number.float({ min: bucket.min, max: bucket.max });

    const count = clampInt(fraction * activeQuestions.length, 0, activeQuestions.length);

    if (count === 0) continue;

    const chosen = sampleMany(activeQuestions, count);

    // Create answers
    const rows: Prisma.CompatibilityAnswerCreateManyInput[] = [];
    for (const q of chosen) {
      if (q.type === "free_text") {
        // optional; your matching ignores it; but you may still want to show it.
        rows.push({
          userId,
          questionId: q.id,
          value: faker.lorem.sentences({ min: 1, max: 2 }),
        });
        continue;
      }

      // single_choice expected for MVP
      const opts = q.options ?? [];
      if (opts.length === 0) continue;

      rows.push({
        userId,
        questionId: q.id,
        value: sample(opts),
      });
    }

    if (rows.length > 0) {
      await prisma.compatibilityAnswer.createMany({ data: rows });
    }
  }
}

async function seedChatroomsAndMessages(userIds: string[], plan: SeedPlan) {
  // Track constraints locally
  const acceptedRoomsCount = new Map<string, number>(); // userId -> count
  const ownsRoom = new Set<string>();

  function canJoin(userId: string) {
    return (acceptedRoomsCount.get(userId) ?? 0) < 3;
  }

  function markAccepted(userId: string) {
    acceptedRoomsCount.set(userId, (acceptedRoomsCount.get(userId) ?? 0) + 1);
  }

  function canOwn(userId: string) {
    return !ownsRoom.has(userId);
  }

  const createdRoomIds: string[] = [];

  for (let i = 0; i < plan.chatrooms; i++) {
    // Pick an owner who can own and can join
    const possibleOwners = userIds.filter((id) => canOwn(id) && canJoin(id));
    if (possibleOwners.length === 0) break;

    const ownerId = sample(possibleOwners);
    ownsRoom.add(ownerId);
    markAccepted(ownerId);

    // Pick 1–4 other participants (some accepted, some pending)
    const possibleOthers = userIds.filter((id) => id !== ownerId && canJoin(id));
    const others = sampleMany(possibleOthers, faker.number.int({ min: 1, max: 4 }));

    // Decide how many accepted initially (need at least 2 accepted for messages)
    const acceptedCount = faker.helpers.arrayElement([1, 2, 2, 3]); // bias toward having at least 2
    const acceptedOthers = others.slice(0, Math.min(acceptedCount - 1, others.length)); // minus owner
    const pendingOthers = others.slice(acceptedOthers.length);

    // mark accepted users against 3-room cap
    for (const uid of acceptedOthers) markAccepted(uid);

    const roomName = faker.helpers.maybe(
      () => faker.company.catchPhrase().slice(0, 60),
      { probability: 0.25 }
    ) ?? null;

    const room = await prisma.chatRoom.create({
      data: {
        name: roomName,
        createdByUserId: ownerId,
        isActive: true,
        participants: {
          create: [
            { userId: ownerId, role: "owner", status: "accepted" },
            ...acceptedOthers.map((uid) => ({ userId: uid, role: "member", status: "accepted" as const })),
            ...pendingOthers.map((uid) => ({ userId: uid, role: "member", status: "pending" as const })),
          ],
        },
      },
      select: { id: true },
    });

    createdRoomIds.push(room.id);

    // Messages: only from accepted participants
    const acceptedSenders = [ownerId, ...acceptedOthers];
    const messagesToCreate = faker.number.int({ min: 0, max: plan.maxMessagesPerRoom });

    if (messagesToCreate > 0 && acceptedSenders.length >= 2) {
      const msgRows: Prisma.ChatMessageCreateManyInput[] = [];

      // spread message timestamps over last 14 days
      for (let m = 0; m < messagesToCreate; m++) {
        const senderUserId = sample(acceptedSenders);
        msgRows.push({
          chatRoomId: room.id,
          senderUserId,
          text: faker.lorem.sentence({ min: 4, max: 14 }),
          createdAt: faker.date.recent({ days: 14 }),
        });
      }

      await prisma.chatMessage.createMany({ data: msgRows });
    }
  }

  console.log(`Seeded ${createdRoomIds.length} chatrooms.`);
}

async function main() {
  await ensurePersonalUsers("Password123!");
  
  faker.seed(42); // deterministic-ish runs

  const activeQuestions = await getActiveQuestions();

  // If DB is empty, create 100 users. If you already made 2–3 users, this will create up to 100 total new ones.
  // You asked for "100 users" — we’ll interpret it as "seed 100 new users", while keeping manual users intact.
  const beforeCount = await prisma.user.count();
  const targetNew = PLAN_100.totalUsers; // new users
  console.log(`Users before seed: ${beforeCount}. Seeding ${targetNew} new users...`);

  const allUserIds = await createUsersWithProfiles(targetNew);

  // Answers for everyone (including your manual users), or only seeded users?
  // Safer: only for newly created users. If you want manual users included, tell me.
  // For now, apply to all users because you said you don’t care about preserving/curating them.
  await seedCompatibilityAnswersForUsers(allUserIds, activeQuestions);

  await seedChatroomsAndMessages(allUserIds, PLAN_100);

  console.log("✅ Seed complete.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
