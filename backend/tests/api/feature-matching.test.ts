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

  describe("signup without the matching fields", () => {
    const body = {
      email: "sam@example.com",
      username: "samlee",
      password: "Password123!",
      firstName: "Sam",
      lastName: "Lee",
      birthDate: "2005-09-15",
      acceptNotice: true,
    };

    it("only asks for what households need while matching is off", async () => {
      const res = await request(ctx.app)
        .post("/auth/signup")
        .send(body)
        .expect(201);

      const me = await request(ctx.app)
        .get("/profile/me")
        .set(auth(res.body.token))
        .expect(200);
      expect(me.body.profile).toMatchObject({
        school: null,
        collegeYear: null,
        targetCity: null,
        targetState: null,
        targetZip: null,
      });
    });

    it("still requires them while matching is on", async () => {
      env.FEATURE_MATCHING = true;
      const res = await request(ctx.app).post("/auth/signup").send(body);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/school/);
    });

    it("gives someone without them an empty Matches once matching opens", async () => {
      const { token } = await request(ctx.app)
        .post("/auth/signup")
        .send(body)
        .then((r) => r.body);
      await signupUser(ctx);

      env.FEATURE_MATCHING = true;
      const app = createApp(ctx.prisma);
      const res = await request(app).get("/matches").set(auth(token));
      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
    });
  });
});
