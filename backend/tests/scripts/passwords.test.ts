import request from "supertest";
import { resetDb } from "../helpers/resetDb";
import type { TestContext } from "../helpers/testFactory";
import { signupUser } from "../helpers/testFactory";
import { getTestContext } from "../helpers/testContext";
import { findUser, resetPassword } from "../../scripts/passwords";
import { describe, beforeAll, beforeEach, afterAll, it, expect } from "vitest";

let ctx: TestContext;

describe.sequential("reset-password", () => {
  beforeAll(() => {
    ctx = getTestContext();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
  });
  afterAll(async () => {
    await ctx.prisma.$disconnect();
  });

  it("finds a user by email or username, ignoring case and spaces", async () => {
    await signupUser(ctx, { email: "sam@example.com", username: "sam" });

    expect((await findUser(ctx.prisma, " Sam@Example.com "))?.username).toBe(
      "sam",
    );
    expect((await findUser(ctx.prisma, "SAM"))?.email).toBe("sam@example.com");
    expect(await findUser(ctx.prisma, "nobody@example.com")).toBeNull();
  });

  it("replaces the password: the new one logs in, the old one doesn't", async () => {
    await signupUser(ctx, { username: "sam", password: "Password123!" });
    const user = await findUser(ctx.prisma, "sam");

    const password = await resetPassword(ctx.prisma, user!.id);
    expect(password.length).toBeGreaterThanOrEqual(8);

    await request(ctx.app)
      .post("/auth/login")
      .send({ identifier: "sam", password: "Password123!" })
      .expect(401);
    await request(ctx.app)
      .post("/auth/login")
      .send({ identifier: "sam", password })
      .expect(200);
  });
});
