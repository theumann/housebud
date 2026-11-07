import request from "supertest";
import { describe, beforeAll, beforeEach, it, expect } from "vitest";
import { NOTICE_VERSION } from "../../src/modules/auth/auth.types";
import { resetDb } from "../helpers/resetDb";
import { signupUser, type TestContext } from "../helpers/testFactory";
import { getTestContext } from "../helpers/testContext";

let ctx: TestContext;

const body = (overrides: Record<string, unknown> = {}) => ({
  email: "sam@example.com",
  username: "samlee",
  password: "Password123!",
  firstName: "Sam",
  lastName: "Lee",
  birthDate: "2005-09-15",
  school: "USF",
  collegeYear: "Freshman",
  targetCity: "San Francisco",
  targetState: "CA",
  targetZip: "94117",
  acceptNotice: true,
  ...overrides,
});

// "YYYY-MM-DD", `years` years before today (UTC).
function yearsAgo(years: number, dayOffset = 0) {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  d.setUTCDate(d.getUTCDate() + dayOffset);
  return d.toISOString().slice(0, 10);
}

const me = (token: string) =>
  request(ctx.app).get("/profile/me").set("Authorization", `Bearer ${token}`);

describe.sequential("Signup rules: minimum age and the tester notice", () => {
  beforeAll(() => {
    ctx = getTestContext();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
  });

  describe("minimum age", () => {
    it("refuses anyone under 18, the day before their 18th birthday included", async () => {
      const res = await request(ctx.app)
        .post("/auth/signup")
        .send(body({ birthDate: yearsAgo(18, 1) }));
      expect(res.status).toBe(400);
      expect(res.body.error).toBe(
        "You must be 18 or older to sign up for HouseBud.",
      );
      expect(await ctx.prisma.user.count()).toBe(0);
    });

    it("only takes birth dates as YYYY-MM-DD, so the age can be checked", async () => {
      const res = await request(ctx.app)
        .post("/auth/signup")
        .send(body({ birthDate: "2010/01/01" }));
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/^birthDate: /);
    });

    it("accepts someone on their 18th birthday", async () => {
      await request(ctx.app)
        .post("/auth/signup")
        .send(body({ birthDate: yearsAgo(18) }))
        .expect(201);
    });
  });

  describe("tester notice", () => {
    it("can't sign up without accepting it", async () => {
      for (const acceptNotice of [undefined, false]) {
        const res = await request(ctx.app)
          .post("/auth/signup")
          .send(body({ acceptNotice }));
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/^acceptNotice: /);
      }
      expect(await ctx.prisma.user.count()).toBe(0);
    });

    it("records the version accepted at signup", async () => {
      const res = await request(ctx.app)
        .post("/auth/signup")
        .send(body())
        .expect(201);

      const user = await ctx.prisma.user.findUniqueOrThrow({
        where: { username: "samlee" },
      });
      expect(user.noticeVersion).toBe(NOTICE_VERSION);
      expect(user.noticeAcceptedAt).toBeInstanceOf(Date);
      expect(res.body.user.noticeAccepted).toBe(true);
      expect((await me(res.body.token)).body.noticeAccepted).toBe(true);
    });

    it("tells the app at login whether to ask, so it doesn't wait for a reload", async () => {
      const { userId, body: account } = await signupUser(ctx);
      const login = () =>
        request(ctx.app)
          .post("/auth/login")
          .send({ identifier: account.username, password: account.password })
          .expect(200);

      await ctx.prisma.user.update({
        where: { id: userId },
        data: { noticeVersion: null },
      });
      expect((await login()).body.user.noticeAccepted).toBe(false);

      await ctx.prisma.user.update({
        where: { id: userId },
        data: { noticeVersion: NOTICE_VERSION },
      });
      expect((await login()).body.user.noticeAccepted).toBe(true);
    });

    it("asks again after a new version, until accepted", async () => {
      const { token, userId } = await signupUser(ctx);
      // An account from before the notice, or one that accepted an older version.
      for (const noticeVersion of [null, NOTICE_VERSION - 1]) {
        await ctx.prisma.user.update({
          where: { id: userId },
          data: { noticeVersion },
        });
        expect((await me(token)).body.noticeAccepted).toBe(false);
      }

      await request(ctx.app)
        .post("/auth/notice")
        .set("Authorization", `Bearer ${token}`)
        .expect(204);
      expect((await me(token)).body.noticeAccepted).toBe(true);
    });

    it("needs a login to accept it", async () => {
      await request(ctx.app).post("/auth/notice").expect(401);
    });
  });
});
