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
});
