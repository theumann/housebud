import request from "supertest";
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
});
