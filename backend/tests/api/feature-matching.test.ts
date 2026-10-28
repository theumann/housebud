import request from "supertest";
import { resetDb } from "../helpers/resetDb";
import type { TestContext } from "../helpers/testFactory";
import { signupUser } from "../helpers/testFactory";
import { getTestContext } from "../helpers/testContext";
import { env } from "../../src/config/env";
import { createApp } from "../../src/app";
import {
  describe,
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
  it,
  expect,
} from "vitest";

let ctx: TestContext;

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe.sequential("FEATURE_MATCHING=false", () => {
  beforeAll(() => {
    ctx = getTestContext();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    env.FEATURE_MATCHING = false;
  });
  afterEach(() => {
    env.FEATURE_MATCHING = true;
  });
  afterAll(async () => {
    await ctx.prisma.$disconnect();
  });

  const matchingPaths = ["/matches", "/chatrooms", "/compatibility/questions"];

  it("the matching endpoints exist while it's on", async () => {
    env.FEATURE_MATCHING = true;
    const app = createApp(ctx.prisma);
    const { token } = await signupUser(ctx);

    for (const path of matchingPaths) {
      const res = await request(app).get(path).set(auth(token));
      expect(res.status, path).toBe(200);
    }
  });

  it("removes the matching endpoints and keeps households", async () => {
    // The routers are mounted when the app is created.
    const app = createApp(ctx.prisma);
    const { token } = await signupUser(ctx);

    for (const path of matchingPaths) {
      const res = await request(app).get(path).set(auth(token));
      expect(res.status, path).toBe(404);
    }

    await request(app).get("/households").set(auth(token)).expect(200);
    await request(app).get("/profile/me").set(auth(token)).expect(200);
  });
});
