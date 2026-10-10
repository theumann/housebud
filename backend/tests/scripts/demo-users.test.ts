import { resetDb } from "../helpers/resetDb";
import type { TestContext } from "../helpers/testFactory";
import { createQuestion, signupUser } from "../helpers/testFactory";
import { getTestContext } from "../helpers/testContext";
import {
  DEMO_EMAIL_DOMAIN,
  STAGING_MARKER,
  assertDemoTarget,
  removeDemoUsers,
  seedDemoUsers,
} from "../../scripts/demo-users";
import { portraitPicker, portraitUrl } from "../../scripts/portraits";
import { describe, beforeAll, beforeEach, afterAll, it, expect } from "vitest";

let ctx: TestContext;

describe("assertDemoTarget", () => {
  it("runs only on a database marked as staging", () => {
    expect(() => assertDemoTarget(undefined, STAGING_MARKER)).not.toThrow();
    expect(() => assertDemoTarget(undefined, null)).toThrow(/staging/);
    expect(() => assertDemoTarget(undefined, "housebud:production")).toThrow(
      /staging/,
    );
  });

  it("refuses NODE_ENV=production even on a staging-marked database", () => {
    expect(() => assertDemoTarget("production", STAGING_MARKER)).toThrow(
      /production/,
    );
  });
});

describe("portraitPicker", () => {
  it("hands out each portrait of a sex once, then null", () => {
    const take = portraitPicker();
    const urls: string[] = [];
    for (let url = take("female"); url !== null; url = take("female")) {
      expect(url).toContain("/female/256/");
      urls.push(url);
    }
    expect(urls.length).toBeGreaterThan(20);
    expect(new Set(urls).size).toBe(urls.length);
    expect(take("male")).toContain("/male/256/");
  });
});

describe.sequential("demo users", () => {
  beforeAll(() => {
    ctx = getTestContext();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
  });
  afterAll(async () => {
    await ctx.prisma.$disconnect();
  });

  it("refuses to seed without compatibility questions", async () => {
    await expect(seedDemoUsers(ctx.prisma, 1)).rejects.toThrow(
      /seed:questions/,
    );
  });

  it("creates San Francisco users with answers, and removes only them", async () => {
    for (const code of ["Q1", "Q2", "Q3", "Q4", "Q5"]) {
      await createQuestion(ctx, { code, text: code, options: ["A", "B"] });
    }
    const real = await signupUser(ctx);

    await seedDemoUsers(ctx.prisma, 5);

    const demo = await ctx.prisma.user.findMany({
      where: { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } },
      include: { profile: true, answers: true },
    });
    expect(demo).toHaveLength(5);
    for (const u of demo) {
      expect(u.profile?.targetZip.startsWith("941")).toBe(true);
      expect(u.answers.length).toBeGreaterThanOrEqual(3);
      expect(u.answers.every((a) => ["A", "B"].includes(a.value))).toBe(true);
    }

    expect(await removeDemoUsers(ctx.prisma)).toBe(5);
    const left = await ctx.prisma.user.findMany({ select: { id: true } });
    expect(left.map((u) => u.id)).toEqual([real.userId]);
  });

  it("gives some users a Faker portrait, each used once", async () => {
    await createQuestion(ctx, { code: "Q1", text: "Q1", options: ["A", "B"] });

    await seedDemoUsers(ctx.prisma, 20);

    const urls = (
      await ctx.prisma.userProfile.findMany({ select: { avatarUrl: true } })
    )
      .map((p) => p.avatarUrl)
      .filter((u): u is string => u !== null);
    // ~60% get one; none at all out of 20 would mean photos are off.
    expect(urls.length).toBeGreaterThan(0);
    expect(new Set(urls).size).toBe(urls.length);
    for (const url of urls) {
      expect(url).toMatch(
        /^https:\/\/cdn\.jsdelivr\.net\/gh\/faker-js\/assets-person-portrait\/(female|male)\/256\/\d+\.jpg$/,
      );
    }
    expect(portraitUrl("male", 7)).toContain("/male/256/7.jpg");
  });
});
