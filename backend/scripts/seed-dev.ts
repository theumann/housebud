import "dotenv/config";
import { createPrisma } from "../src/config/prisma";
import { faker } from "@faker-js/faker";
import { Prisma } from "@prisma/client";
import bcrypt from "bcrypt";

// Fake users, chats and messages must never reach production. Checking the
// host (not just NODE_ENV) also catches a local shell that has production
// credentials in DATABASE_URL.
function assertLocalDatabase() {
  const url = process.env.DATABASE_URL;
  const host = url ? new URL(url).hostname : "";
  if (
    process.env.NODE_ENV === "production" ||
    !["localhost", "127.0.0.1"].includes(host)
  ) {
    throw new Error(
      `Refusing to seed fake data: database host "${host || "unset"}", NODE_ENV "${process.env.NODE_ENV ?? ""}". seed-dev only runs against a local database.`,
    );
  }
}

assertLocalDatabase();

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
    { pct: 0.2, min: 0.0, max: 0.0 }, // 0 answers
    { pct: 0.2, min: 0.01, max: 0.19 }, // >0 but <20%
    { pct: 0.4, min: 0.2, max: 0.8 }, // 20%–80%
    { pct: 0.2, min: 0.81, max: 1.0 }, // 80%–100%
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
      displayName: "", // Cards should display first and last name if displayName is empty
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
    {
      email: "me4@bunkbuddy.dev",
      firstName: "Me",
      lastName: "Four",
      username: "me4",
      displayName: "Me4",
      school: "UCSF",
      collegeYear: "Senior",
      targetCity: "San Francisco",
      targetState: "CA",
      targetZip: "94117",
    },
    {
      email: "me5@bunkbuddy.dev",
      firstName: "Me",
      lastName: "Five",
      username: "me5",
      displayName: "Me5",
      school: "USF",
      collegeYear: "Sophomore",
      targetCity: "San Francisco",
      targetState: "CA",
      targetZip: "94122",
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
  return {
    min: plan.answerBuckets.at(-1)!.min,
    max: plan.answerBuckets.at(-1)!.max,
  };
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
  const existing = await prisma.user.findMany({
    select: { id: true, email: true, username: true },
  });
  const existingEmails = new Set(existing.map((u) => u.email.toLowerCase()));
  const existingUsernames = new Set(
    existing
      .map((u) => u.username?.toLowerCase())
      .filter((u): u is string => Boolean(u)),
  );

  // Deterministic username allocator: always find the next free userN.
  let nextUserNumber = 1;
  for (const uname of existingUsernames) {
    const match = /^user(\d+)$/.exec(uname);
    if (!match) continue;
    const n = Number(match[1]);
    if (Number.isFinite(n) && n >= nextUserNumber) nextUserNumber = n + 1;
  }

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
      "94102",
      "94103",
      "94105",
      "94107",
      "94108",
      "94109",
      "94110",
      "94112",
      "94114",
      "94115",
      "94116",
      "94117",
      "94118",
      "94121",
      "94122",
      "94123",
      "94124",
      "94127",
      "94129",
      "94130",
      "94131",
      "94132",
      "94133",
      "94134",
    ]);

    let username = `user${nextUserNumber}`;
    while (existingUsernames.has(username)) {
      nextUserNumber += 1;
      username = `user${nextUserNumber}`;
    }
    existingUsernames.add(username);
    nextUserNumber += 1;
    const displayName = faker.internet
      .username({ firstName, lastName })
      .slice(0, 20);

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
          collegeYear: faker.helpers.arrayElement([
            "Freshman",
            "Sophomore",
            "Junior",
            "Senior",
            "Grad",
          ]),
          targetCity,
          targetState,
          targetZip,
          bio:
            faker.helpers.maybe(
              () => faker.lorem.sentences({ min: 1, max: 2 }),
              { probability: 0.6 },
            ) ?? null,
          avatarUrl:
            faker.helpers.maybe(() => faker.image.avatar(), {
              probability: 0.5,
            }) ?? null,
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

async function seedCompatibilityAnswersForUsers(
  userIds: string[],
  activeQuestions: Awaited<ReturnType<typeof getActiveQuestions>>,
) {
  if (activeQuestions.length === 0) {
    console.log("No active questions found. Skipping answers seeding.");
    return;
  }

  // Clear only seeded answers? You said DB is empty now, so we’ll just insert.
  // If you want rerunnable behavior later, we can delete answers for users we created.
  for (const userId of userIds) {
    const bucket = pickBucket(PLAN_100);

    const fraction =
      bucket.min === bucket.max
        ? bucket.min
        : faker.number.float({ min: bucket.min, max: bucket.max });

    const count = clampInt(
      fraction * activeQuestions.length,
      0,
      activeQuestions.length,
    );

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
      await prisma.compatibilityAnswer.createMany({
        data: rows,
        skipDuplicates: true,
      });
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
    const possibleOthers = userIds.filter(
      (id) => id !== ownerId && canJoin(id),
    );
    const others = sampleMany(
      possibleOthers,
      faker.number.int({ min: 1, max: 4 }),
    );

    // Decide how many accepted initially (need at least 2 accepted for messages)
    const acceptedCount = faker.helpers.arrayElement([1, 2, 2, 3]); // bias toward having at least 2
    const acceptedOthers = others.slice(
      0,
      Math.min(acceptedCount - 1, others.length),
    ); // minus owner
    const pendingOthers = others.slice(acceptedOthers.length);

    // mark accepted users against 3-room cap
    for (const uid of acceptedOthers) markAccepted(uid);

    const roomName =
      faker.helpers.maybe(() => faker.company.catchPhrase().slice(0, 60), {
        probability: 0.25,
      }) ?? null;

    const room = await prisma.chatRoom.create({
      data: {
        name: roomName,
        createdByUserId: ownerId,
        isActive: true,
        participants: {
          create: [
            { userId: ownerId, role: "owner", status: "accepted" },
            ...acceptedOthers.map((uid) => ({
              userId: uid,
              role: "member",
              status: "accepted" as const,
            })),
            ...pendingOthers.map((uid) => ({
              userId: uid,
              role: "member",
              status: "pending" as const,
            })),
          ],
        },
      },
      select: { id: true },
    });

    createdRoomIds.push(room.id);

    // Messages: only from accepted participants
    const acceptedSenders = [ownerId, ...acceptedOthers];
    const messagesToCreate = faker.number.int({
      min: 0,
      max: plan.maxMessagesPerRoom,
    });

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

const PERSONAL_USERNAMES = ["me1", "me2", "me3", "me4", "me5"] as const;
type PersonalUsername = (typeof PERSONAL_USERNAMES)[number];
const SEEDED_HOUSEHOLD_NAME = "Seeded Test household";

async function personalUserIds() {
  const users = await prisma.user.findMany({
    where: { username: { in: [...PERSONAL_USERNAMES] } },
    select: { id: true, username: true },
  });
  return Object.fromEntries(users.map((u) => [u.username, u.id])) as Record<
    PersonalUsername,
    string
  >;
}

async function createRoomWithMessages(
  ownerId: string,
  memberIds: string[],
  name: string | null,
) {
  const room = await prisma.chatRoom.create({
    data: {
      name,
      createdByUserId: ownerId,
      isActive: true,
      participants: {
        create: [
          { userId: ownerId, role: "owner", status: "accepted" },
          ...memberIds.map((userId) => ({
            userId,
            role: "member",
            status: "accepted" as const,
          })),
        ],
      },
    },
    select: { id: true },
  });

  const senders = [ownerId, ...memberIds];
  await prisma.chatMessage.createMany({
    data: Array.from({ length: faker.number.int({ min: 5, max: 20 }) }, () => ({
      chatRoomId: room.id,
      senderUserId: sample(senders),
      text: faker.lorem.sentence({ min: 4, max: 14 }),
      createdAt: faker.date.recent({ days: 7 }),
    })),
  });
}

// Fixed situations on the "me" users, for manual testing (and me1's room for
// the chatrooms e2e spec). Returns the Faker users involved, which are kept
// out of the random rooms so the 3-room and one-owned-room limits hold.
async function seedPersonalRooms(
  me: Record<PersonalUsername, string>,
  fakerIds: string[],
) {
  const me3Rooms = await prisma.chatRoomParticipant.count({
    where: { userId: me.me3, status: "accepted" },
  });
  if (me3Rooms > 0) {
    console.log("Personal rooms already seeded; skipping.");
    return [];
  }

  const [f1, f2, f3, f4, f5] = sampleMany(fakerIds, 5);

  // me3 is at the 3-room limit: owns one room, member of two.
  await createRoomWithMessages(me.me3, [f1, f2], "me3's room");
  await createRoomWithMessages(f3, [me.me3], null);
  await createRoomWithMessages(f4, [me.me3, f1], null);

  // me1 (the e2e user) is a member of exactly one room.
  await createRoomWithMessages(f5, [me.me1], null);

  console.log("Seeded personal rooms: me3 in 3, me1 in 1.");
  return [f1, f2, f3, f4, f5];
}

// A calendar day relative to the day the seed runs (local time), stored as
// UTC midnight like the app's chore dates.
function seedDay(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function choreData(input: {
  name: string;
  repeat: { every: number; unit: "day" | "week" | "month" | "quarter" } | null;
  dueInDays: number;
  rotation: string[];
  createdByUserId: string;
}) {
  const dueDate = seedDay(input.dueInDays);
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

// me4 (owner) and me5 already share a household, with chores in every state
// (overdue, today, started, upcoming, monthly, one-off), some history, and a
// shopping list. Dates are relative to the seed day. The e2e smoke test
// (household-seed.spec.ts) checks these exact names.
async function seedTestHousehold(me: Record<PersonalUsername, string>) {
  const existing = await prisma.household.findFirst({
    where: {
      name: SEEDED_HOUSEHOLD_NAME,
      members: { some: { userId: me.me4 } },
    },
  });
  if (existing) {
    console.log(`"${SEEDED_HOUSEHOLD_NAME}" already exists; skipping.`);
    return;
  }

  await prisma.household.create({
    data: {
      name: SEEDED_HOUSEHOLD_NAME,
      // Same alphabet as real join codes (no 0/O, 1/I).
      joinCode: faker.string.fromCharacters(
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
        6,
      ),
      createdByUserId: me.me4,
      settings: { create: {} },
      members: {
        create: [
          { userId: me.me4, role: "owner", status: "active" },
          { userId: me.me5, role: "member", status: "active" },
        ],
      },
      chores: {
        create: [
          {
            ...choreData({
              name: "Take out trash",
              repeat: { every: 1, unit: "week" },
              dueInDays: -2,
              rotation: [me.me5, me.me4],
              createdByUserId: me.me4,
            }),
            completions: {
              create: {
                doneByUserId: me.me4,
                dueDate: seedDay(-9),
                completedOn: seedDay(-9),
                previousRotationIndex: 1,
              },
            },
          },
          {
            ...choreData({
              name: "Clean bathroom",
              repeat: { every: 1, unit: "week" },
              dueInDays: 0,
              rotation: [me.me4, me.me5],
              createdByUserId: me.me4,
            }),
            startedAt: new Date(Date.now() - 60 * 60 * 1000),
            startedByUserId: me.me5,
          },
          {
            ...choreData({
              name: "Vacuum living room",
              repeat: { every: 2, unit: "week" },
              dueInDays: 3,
              rotation: [me.me5, me.me4],
              createdByUserId: me.me5,
            }),
            completions: {
              create: {
                doneByUserId: me.me5,
                dueDate: seedDay(-11),
                completedOn: seedDay(-10),
                previousRotationIndex: 1,
              },
            },
          },
          choreData({
            name: "Pay internet bill",
            repeat: { every: 1, unit: "month" },
            dueInDays: 10,
            rotation: [me.me4],
            createdByUserId: me.me4,
          }),
          choreData({
            name: "Fix the shelf",
            repeat: null,
            dueInDays: 5,
            rotation: [],
            createdByUserId: me.me5,
          }),
        ],
      },
      shoppingItems: {
        create: [
          { name: "Milk", quantity: "2 L", addedByUserId: me.me4 },
          { name: "Eggs", quantity: "x12", addedByUserId: me.me5 },
          { name: "Dish soap", addedByUserId: me.me5 },
          {
            name: "Coffee",
            addedByUserId: me.me5,
            checkedAt: new Date(),
            checkedByUserId: me.me4,
          },
          {
            name: "Toilet paper",
            quantity: "x8",
            addedByUserId: me.me4,
            checkedAt: new Date(),
            checkedByUserId: me.me5,
          },
        ],
      },
    },
  });
  console.log(
    `Seeded "${SEEDED_HOUSEHOLD_NAME}" (me4 owner, me5 member) with chores and a shopping list.`,
  );
}

async function main() {
  await ensurePersonalUsers("Password123!");

  faker.seed(42); // deterministic-ish runs

  const activeQuestions = await getActiveQuestions();

  // If DB is empty, create 100 users. If you already made 2–3 users, this will create up to 100 total new ones.
  // You asked for "100 users" — we’ll interpret it as "seed 100 new users", while keeping manual users intact.
  const beforeCount = await prisma.user.count();
  const targetNew = PLAN_100.totalUsers; // new users
  console.log(
    `Users before seed: ${beforeCount}. Seeding ${targetNew} new users...`,
  );

  const allUserIds = await createUsersWithProfiles(targetNew);

  // Answers for everyone (including your manual users), or only seeded users?
  // Safer: only for newly created users. If you want manual users included, tell me.
  // For now, apply to all users because you said you don’t care about preserving/curating them.
  await seedCompatibilityAnswersForUsers(allUserIds, activeQuestions);

  // The "me" users only get the fixed rooms below, never random ones.
  const me = await personalUserIds();
  const personalIds = new Set<string>(Object.values(me));
  const fakerIds = allUserIds.filter((id) => !personalIds.has(id));
  const usedInPersonalRooms = new Set(await seedPersonalRooms(me, fakerIds));

  await seedChatroomsAndMessages(
    fakerIds.filter((id) => !usedInPersonalRooms.has(id)),
    PLAN_100,
  );
  await seedTestHousehold(me);

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
