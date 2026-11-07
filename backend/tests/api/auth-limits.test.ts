import request from "supertest";
import { describe, beforeAll, beforeEach, it, expect } from "vitest";
import { env } from "../../src/config/env";
import { AUTH_LIMITS } from "../../src/modules/auth/auth.throttle";
import { resetDb } from "../helpers/resetDb";
import {
  createHousehold,
  signupUser,
  type TestContext,
} from "../helpers/testFactory";
import { getTestContext } from "../helpers/testContext";

let ctx: TestContext;

// X-Real-IP stands in for the visitor's address, as Railway's edge sets it.
const login = (identifier: string, password: string, ip = "203.0.113.1") =>
  request(ctx.app)
    .post("/auth/login")
    .set("X-Real-IP", ip)
    .send({ identifier, password });

const signupBody = (n: number) => ({
  email: `limit${n}@example.com`,
  username: `limit${n}`,
  password: "Password123!",
  firstName: "Sam",
  lastName: "Lee",
  birthDate: "2005-09-15",
  school: "USF",
  collegeYear: "Freshman",
  targetCity: "San Francisco",
  targetState: "CA",
  targetZip: "94117",
});

const signup = (body: object, ip = "203.0.113.1") =>
  request(ctx.app).post("/auth/signup").set("X-Real-IP", ip).send(body);

const join = (token: string, joinCode: string, ip = "203.0.113.1") =>
  request(ctx.app)
    .post("/households/join")
    .set("Authorization", `Bearer ${token}`)
    .set("X-Real-IP", ip)
    .send({ joinCode });

async function failLogins(identifier: string, times: number, ip?: string) {
  for (let i = 0; i < times; i++) {
    await login(identifier, "wrong-password", ip).expect(401);
  }
}

describe.sequential("Login, signup and join-code limits", () => {
  beforeAll(() => {
    ctx = getTestContext();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
  });

  describe("per account", () => {
    const { max } = AUTH_LIMITS.loginPerAccount;

    it("refuses the right password too once an account has too many failures, with Retry-After", async () => {
      const { body } = await signupUser(ctx);
      await failLogins(body.username, max);

      const res = await login(body.username, body.password);
      expect(res.status).toBe(429);
      expect(res.body.error).toBe(
        "Too many failed attempts. Please try again in 15 minutes.",
      );
      const retryAfter = Number(res.headers["retry-after"]);
      expect(retryAfter).toBeGreaterThan(14 * 60);
      expect(retryAfter).toBeLessThanOrEqual(15 * 60);
    });

    it("counts failures by email and by username together, from any address", async () => {
      const { body } = await signupUser(ctx);
      for (let i = 0; i < max; i++) {
        await login(
          i % 2 ? body.email.toUpperCase() : body.username,
          "wrong-password",
          `198.51.100.${i}`,
        ).expect(401);
      }

      await login(body.email, body.password, "192.0.2.77").expect(429);
    });

    it("leaves other accounts on the same address alone", async () => {
      const victim = await signupUser(ctx);
      const other = await signupUser(ctx);
      await failLogins(victim.body.username, max);

      await login(other.body.username, other.body.password).expect(200);
    });

    it("doesn't count successful logins, and forgets failures after the window", async () => {
      const { body } = await signupUser(ctx);
      for (let i = 0; i < max + 2; i++) {
        await login(body.username, body.password).expect(200);
      }

      await failLogins(body.username, max);
      await login(body.username, body.password).expect(429);

      await ctx.prisma.authFailure.updateMany({
        data: { createdAt: new Date(Date.now() - 16 * 60 * 1000) },
      });
      await login(body.username, body.password).expect(200);
    });

    it("limits guesses at an account that doesn't exist the same way", async () => {
      await failLogins("nobody@example.com", max);

      await login("nobody@example.com", "wrong-password").expect(429);
    });
  });

  describe("per address", () => {
    it("refuses every login from an address with too many failures, but not from others", async () => {
      const { body } = await signupUser(ctx);
      const { max } = AUTH_LIMITS.loginPerIp;
      // Spread over many accounts, so no account limit is reached.
      for (let i = 0; i < max; i++) {
        await login(`nobody${i}@example.com`, "wrong-password").expect(401);
      }

      const blocked = await login(body.username, body.password);
      expect(blocked.status).toBe(429);
      expect(blocked.body.error).toMatch(/^Too many failed attempts/);

      await login(body.username, body.password, "203.0.113.2").expect(200);
    });

    it("counts by X-Real-IP, not X-Forwarded-For", async () => {
      const { body } = await signupUser(ctx);
      const { max } = AUTH_LIMITS.loginPerIp;
      // On Railway X-Forwarded-For ends with a CDN server's address; a
      // different value on each request must not spread the count.
      for (let i = 0; i < max; i++) {
        await request(ctx.app)
          .post("/auth/login")
          .set("X-Forwarded-For", `198.51.100.${i}`)
          .send({ identifier: `nobody${i}@example.com`, password: "wrong" })
          .expect(401);
      }

      await request(ctx.app)
        .post("/auth/login")
        .set("X-Forwarded-For", "192.0.2.1")
        .send({ identifier: body.username, password: body.password })
        .expect(429);
      // With X-Real-IP, as Railway sends it, that's someone else.
      await login(body.username, body.password, "203.0.113.9").expect(200);
    });

    it("refuses signups from an address after too many failed ones", async () => {
      const { max } = AUTH_LIMITS.signupPerIp;
      await signup(signupBody(0)).expect(201);
      for (let i = 0; i < max; i++) {
        // Same email, other username: 409
        await signup({ ...signupBody(0), username: `taken${i}` }).expect(409);
      }

      const blocked = await signup(signupBody(1));
      expect(blocked.status).toBe(429);
      expect(blocked.headers["retry-after"]).toBeDefined();
      // Refused before anything is created.
      expect(
        await ctx.prisma.user.count({ where: { username: "limit1" } }),
      ).toBe(0);

      await signup(signupBody(1), "203.0.113.2").expect(201);
    });

    it("counts wrong invite codes as failed signups", async () => {
      env.SIGNUP_CODE = "Maple-Street";
      try {
        const { max } = AUTH_LIMITS.signupPerIp;
        for (let i = 0; i < max; i++) {
          await signup({ ...signupBody(i), signupCode: `guess${i}` }).expect(
            403,
          );
        }

        await signup({
          ...signupBody(99),
          signupCode: "Maple-Street",
        }).expect(429);
      } finally {
        env.SIGNUP_CODE = null;
      }
    });

    it("doesn't count successful signups", async () => {
      for (let i = 0; i < AUTH_LIMITS.signupPerIp.max + 2; i++) {
        await signup(signupBody(i)).expect(201);
      }
    });
  });
  describe("household join codes", () => {
    it("refuses a user's joins after too many wrong codes, the right code included", async () => {
      const owner = await signupUser(ctx);
      const house = await createHousehold(ctx, owner.token);
      const guesser = await signupUser(ctx);
      const { max } = AUTH_LIMITS.joinPerAccount;
      for (let i = 0; i < max; i++) {
        // From different addresses: the limit follows the user.
        await join(guesser.token, `ZZZZZ${i}`, `198.51.100.${i}`).expect(404);
      }

      const blocked = await join(guesser.token, house.joinCode);
      expect(blocked.status).toBe(429);
      expect(blocked.body.error).toMatch(/^Too many failed attempts/);
      expect(blocked.headers["retry-after"]).toBeDefined();

      // Someone else on the same address still joins.
      const other = await signupUser(ctx);
      await join(other.token, house.joinCode).expect(200);
    });

    it("refuses joins from an address after too many wrong codes from it", async () => {
      const owner = await signupUser(ctx);
      const house = await createHousehold(ctx, owner.token);
      const { max } = AUTH_LIMITS.joinPerIp;
      // Spread over users, so no user reaches their own limit.
      const guessers = await Promise.all(
        Array.from({ length: Math.ceil(max / 5) }, () => signupUser(ctx)),
      );
      for (let i = 0; i < max; i++) {
        await join(guessers[i % guessers.length].token, `ZZZZZ${i}`).expect(
          404,
        );
      }

      const newcomer = await signupUser(ctx);
      await join(newcomer.token, house.joinCode).expect(429);
      await join(newcomer.token, house.joinCode, "203.0.113.2").expect(200);
    });

    it("doesn't count successful joins", async () => {
      const owner = await signupUser(ctx);
      const joiner = await signupUser(ctx);
      for (let i = 0; i < AUTH_LIMITS.joinPerAccount.max + 2; i++) {
        const house = await createHousehold(ctx, owner.token, `House ${i}`);
        await join(joiner.token, house.joinCode).expect(200);
      }
    });
  });
});
