import { faker } from "@faker-js/faker";
import type { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import { portraitPicker } from "./portraits";

// Every demo user's email ends with this. Reserved for examples (RFC 2606), so
// it can never reach a real inbox, and it's how --remove finds them again.
export const DEMO_EMAIL_DOMAIN = "demo.example.com";

// The staging database carries this as its Postgres comment (set once by hand,
// see CLAUDE.md). Production never gets it, so the demo seed can't run there.
export const STAGING_MARKER = "housebud:staging";

export function assertDemoTarget(
  nodeEnv: string | undefined,
  databaseComment: string | null,
) {
  if (nodeEnv === "production") {
    throw new Error("Refusing to seed demo users: NODE_ENV is production.");
  }
  if (databaseComment !== STAGING_MARKER) {
    throw new Error(
      `Refusing to seed demo users: this database isn't marked as staging (its comment must be "${STAGING_MARKER}").`,
    );
  }
}

export async function readDatabaseComment(prisma: PrismaClient) {
  const rows = await prisma.$queryRaw<{ comment: string | null }[]>`
    SELECT shobj_description(oid, 'pg_database') AS comment
    FROM pg_database
    WHERE datname = current_database()
  `;
  return rows[0]?.comment ?? null;
}

export async function removeDemoUsers(prisma: PrismaClient) {
  const { count } = await prisma.user.deleteMany({
    where: { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } },
  });
  return count;
}

// San Francisco: Matches only shows people whose target ZIP shares its first
// three digits, so demo viewers need a 941xx ZIP to see these users.
const SF_ZIPS = [
  "94102",
  "94103",
  "94107",
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
  "94127",
  "94131",
  "94132",
  "94133",
];

const SCHOOLS = [
  "SFSU",
  "USF",
  "UCSF",
  "UC Berkeley",
  "City College of San Francisco",
  "Academy of Art University",
  "California College of the Arts",
  "Golden Gate University",
];

const COLLEGE_YEARS = ["Freshman", "Sophomore", "Junior", "Senior"];

const HOMETOWNS: Array<[string, string]> = [
  ["Los Angeles", "CA"],
  ["San Diego", "CA"],
  ["Sacramento", "CA"],
  ["Fresno", "CA"],
  ["Portland", "OR"],
  ["Seattle", "WA"],
  ["Phoenix", "AZ"],
  ["Denver", "CO"],
  ["Austin", "TX"],
  ["Chicago", "IL"],
  ["New York", "NY"],
  ["Honolulu", "HI"],
];

const BIOS = [
  "Early riser, usually out for a run before class. I keep shared spaces tidy and I'm happy to split chores.",
  "Night owl and design student. Quiet during the week, up for a board game night on weekends.",
  "Nursing student with long shifts, so I value a calm place to come home to.",
  "I cook a lot and love sharing. Looking for roommates who don't mind the smell of garlic.",
  "Transfer student, new to the city. Into hiking, photography and finding the best burrito in the Mission.",
  "Engineering major. I work from home a couple of days a week, so a quiet afternoon matters to me.",
  "Big on recycling and splitting groceries. I have a very friendly (and very lazy) cat.",
  "Music student — I practice guitar, but with headphones after 9pm, promise.",
  "Grad school applicant, mostly studying. Happy to keep a shared calendar for bills and chores.",
  "Climbing gym regular, plant collector, terrible singer in the shower.",
  "I like a clean kitchen and a lively living room. Weekend brunch is non-negotiable.",
  "Business major, part-time barista. Coffee for the whole house is on me.",
  "Bookworm and introvert, but I'll always join a movie night.",
  "Soccer on Sundays, studying the rest of the week. Easygoing about most things except dishes in the sink.",
  "Art history major. I'd love roommates who are into museums and cheap concerts.",
];

function slug(s: string) {
  return s
    .normalize("NFD")
    .replace(/[^a-zA-Z]/g, "")
    .toLowerCase();
}

export async function seedDemoUsers(prisma: PrismaClient, count: number) {
  const questions = await prisma.compatibilityQuestion.findMany({
    where: { isActive: true },
    select: { id: true, type: true, options: true },
  });
  const answerable = questions
    .map((q) => ({
      id: q.id,
      options: Array.isArray(q.options) ? q.options.map(String) : [],
    }))
    .filter((q) => q.options.length > 0);
  if (answerable.length === 0) {
    throw new Error(
      "No compatibility questions with options found. Run seed:questions first.",
    );
  }

  const taken = new Set(
    (await prisma.user.findMany({ select: { username: true } })).map(
      (u) => u.username,
    ),
  );

  // Nobody logs in as a demo user: the password is random and thrown away.
  const passwordHash = await bcrypt.hash(randomUUID(), 10);

  const takePortrait = portraitPicker();

  for (let i = 0; i < count; i++) {
    // Name and photo from the same sex, so they match.
    const sex = faker.person.sexType();
    const firstName = faker.person.firstName(sex);
    const lastName = faker.person.lastName();
    let username = `${slug(firstName)}.${slug(lastName)}`;
    while (taken.has(username)) {
      username = `${slug(firstName)}.${slug(lastName)}${faker.number.int({ min: 2, max: 99 })}`;
    }
    taken.add(username);

    const avatarUrl = faker.datatype.boolean(0.6) ? takePortrait(sex) : null;

    const hometown = faker.helpers.maybe(
      () => faker.helpers.arrayElement(HOMETOWNS),
      { probability: 0.7 },
    );

    // 60–100% of the questions, so match scores look like real ones.
    const answered = faker.helpers.arrayElements(answerable, {
      min: Math.ceil(answerable.length * 0.6),
      max: answerable.length,
    });
    const answers: Prisma.CompatibilityAnswerCreateWithoutUserInput[] =
      answered.map((q) => ({
        question: { connect: { id: q.id } },
        value: faker.helpers.arrayElement(q.options),
      }));

    await prisma.user.create({
      data: {
        email: `${username}@${DEMO_EMAIL_DOMAIN}`,
        username,
        passwordHash,
        profile: {
          create: {
            firstName,
            lastName,
            displayName:
              faker.helpers.maybe(() => `${firstName} ${lastName[0]}.`, {
                probability: 0.4,
              }) ?? null,
            birthDate: faker.date.birthdate({ min: 18, max: 24, mode: "age" }),
            school: faker.helpers.arrayElement(SCHOOLS),
            collegeYear: faker.helpers.arrayElement(COLLEGE_YEARS),
            originalCity: hometown?.[0] ?? null,
            originalState: hometown?.[1] ?? null,
            targetCity: "San Francisco",
            targetState: "CA",
            targetZip: faker.helpers.arrayElement(SF_ZIPS),
            bio:
              faker.helpers.maybe(() => faker.helpers.arrayElement(BIOS), {
                probability: 0.75,
              }) ?? null,
            avatarUrl,
          },
        },
        settings: { create: {} },
        answers: { create: answers },
      },
    });
  }
}
