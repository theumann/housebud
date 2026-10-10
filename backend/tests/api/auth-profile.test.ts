import request from "supertest";
import jwt from "jsonwebtoken";
import { resetDb } from "../helpers/resetDb";
import { describe, beforeAll, beforeEach, afterAll, it, expect } from "vitest";
import type { TestContext } from "../helpers/testFactory";
import { getTestContext } from "../helpers/testContext";

let ctx: TestContext;

describe.sequential("Auth + Profile (smoke)", () => {
  beforeAll(() => {
    ctx = getTestContext();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
  });
  afterAll(async () => {
    await ctx.prisma.$disconnect();
  });

  it("signup -> login WITH USERNAME -> get profile/me", async () => {
    const email = "jdoe@example.com";
    const username = "johndoe";
    const identifier = username;
    const password = "Password123!";

    const signup = await request(ctx.app).post("/auth/signup").send({
      email,
      password,
      firstName: "John",
      lastName: "Doe",
      username,
      displayName: "JDD",
      birthDate: "2005-09-15",
      school: "SFSU",
      collegeYear: "Freshman",
      targetCity: "San Francisco",
      targetState: "CA",
      targetZip: "94110",
    });

    expect(signup.status).toBe(201);
    expect(signup.body.token).toBeTruthy();

    const login = await request(ctx.app)
      .post("/auth/login")
      .send({ identifier, password });
    expect(login.status).toBe(200);
    const token = login.body.token;
    expect(token).toBeTruthy();

    const me = await request(ctx.app)
      .get("/profile/me")
      .set("Authorization", `Bearer ${token}`);

    expect(me.status).toBe(200);
    expect(me.body.profile).toHaveProperty("displayName");
    expect(me.body.profile.displayName).toBe("JDD");
    expect(me.body.profile.targetZip).toBe("94110");
  });

  it("signup -> login WITH EMAIL -> get profile/me", async () => {
    const email = "jdoe@example.com";
    const username = "johndoe";
    const identifier = email;
    const password = "Password123!";

    const signup = await request(ctx.app).post("/auth/signup").send({
      email,
      password,
      firstName: "John",
      lastName: "Doe",
      username,
      displayName: "JDD",
      birthDate: "2005-09-15",
      school: "SFSU",
      collegeYear: "Freshman",
      targetCity: "San Francisco",
      targetState: "CA",
      targetZip: "94110",
    });

    expect(signup.status).toBe(201);
    expect(signup.body.token).toBeTruthy();

    const login = await request(ctx.app)
      .post("/auth/login")
      .send({ identifier, password });
    expect(login.status).toBe(200);
    const token = login.body.token;
    expect(token).toBeTruthy();

    const me = await request(ctx.app)
      .get("/profile/me")
      .set("Authorization", `Bearer ${token}`);

    expect(me.status).toBe(200);
    expect(me.body.profile).toHaveProperty("displayName");
    expect(me.body.profile.displayName).toBe("JDD");
    expect(me.body.profile.targetZip).toBe("94110");
  });

  it("PATCH /profile/me updates avatarUrl", async () => {
    // Create user via signup
    const email = "a@example.com";
    const password = "Password123!";

    const signup = await request(ctx.app).post("/auth/signup").send({
      email,
      password,
      firstName: "A",
      lastName: "B",
      username: "abc",
      displayName: "ABC",
      birthDate: "2005-09-15",
      school: "SFSU",
      collegeYear: "Freshman",
      targetCity: "San Francisco",
      targetState: "CA",
      targetZip: "94110",
    });

    const token = signup.body.token;

    const patch = await request(ctx.app)
      .patch("/profile/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ avatarUrl: "https://example.com/a.png" });

    expect(patch.status).toBe(200);
    expect(patch.body.avatarUrl).toBe("https://example.com/a.png");
  });

  const signupBody = (overrides: Record<string, string> = {}) => ({
    email: "sam@example.com",
    password: "Password123!",
    firstName: "Sam",
    lastName: "Lee",
    username: "samlee",
    displayName: "Sam",
    birthDate: "2005-09-15",
    school: "SFSU",
    collegeYear: "Freshman",
    targetCity: "San Francisco",
    targetState: "CA",
    targetZip: "94110",
    ...overrides,
  });

  it("signup without a display name (the form sends an empty string)", async () => {
    const signup = await request(ctx.app)
      .post("/auth/signup")
      .send(signupBody({ displayName: "" }));
    expect(signup.status).toBe(201);

    const me = await request(ctx.app)
      .get("/profile/me")
      .set("Authorization", `Bearer ${signup.body.token}`);
    expect(me.body.profile.displayName).toBeNull();
  });

  it("signup with a taken email or username returns 409, not 500", async () => {
    await request(ctx.app).post("/auth/signup").send(signupBody()).expect(201);

    const sameEmail = await request(ctx.app)
      .post("/auth/signup")
      .send(signupBody({ username: "other", email: "SAM@example.com" }));
    expect(sameEmail.status).toBe(409);
    expect(sameEmail.body.error).toBe(
      "An account with this email already exists",
    );

    const sameUsername = await request(ctx.app)
      .post("/auth/signup")
      .send(signupBody({ email: "other@example.com", username: "SamLee" }));
    expect(sameUsername.status).toBe(409);
    expect(sameUsername.body.error).toBe("That username is taken");
  });

  it("login with a wrong password or an unknown account gives the same 401", async () => {
    await request(ctx.app).post("/auth/signup").send(signupBody()).expect(201);

    const wrongPassword = await request(ctx.app)
      .post("/auth/login")
      .send({ identifier: "samlee", password: "not-the-password" });
    const unknownUser = await request(ctx.app)
      .post("/auth/login")
      .send({ identifier: "nobody@example.com", password: "not-the-password" });

    // Same answer for both, so login doesn't reveal which accounts exist.
    for (const res of [wrongPassword, unknownUser]) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: "Invalid credentials" });
    }
  });

  it("protected routes reject a missing, made-up, foreign or expired token", async () => {
    const signup = await request(ctx.app)
      .post("/auth/signup")
      .send(signupBody())
      .expect(201);
    const me = await request(ctx.app)
      .get("/profile/me")
      .set("Authorization", `Bearer ${signup.body.token}`)
      .expect(200);
    const userId = me.body.profile.userId;

    const tokens = {
      madeUp: "not-a-jwt",
      foreign: jwt.sign({ userId }, "some-other-secret"),
      expired: jwt.sign({ userId }, process.env.JWT_SECRET!, {
        expiresIn: -10,
      }),
    };

    const none = await request(ctx.app).get("/profile/me");
    expect(none.status).toBe(401);

    for (const token of Object.values(tokens)) {
      const res = await request(ctx.app)
        .get("/profile/me")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(401);
    }
  });

  it("signup with invalid input returns 400 naming the field", async () => {
    const cases: Array<[Record<string, string>, string]> = [
      [{ email: "not-an-email" }, "email"],
      [{ password: "short" }, "password"],
      [{ username: "ab" }, "username"],
    ];
    for (const [overrides, field] of cases) {
      const res = await request(ctx.app)
        .post("/auth/signup")
        .send(signupBody(overrides));
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(new RegExp(`^${field}: `));
    }

    const missing = await request(ctx.app)
      .post("/auth/signup")
      .send({ email: "x@example.com" });
    expect(missing.status).toBe(400);
    expect(missing.body.error).toContain("password");
  });
});
