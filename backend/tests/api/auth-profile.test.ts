import request from "supertest";
import { resetDb } from "../helpers/resetDb";
import type { TestContext } from "../helpers/testFactory";
import { createTestContext } from "../helpers/testFactory";
import { describe, beforeAll, beforeEach, afterAll, it, expect } from "vitest";

let ctx: TestContext;

describe.sequential("Auth + Profile (smoke)", () => {
    beforeAll(() => {
        ctx = createTestContext();
    });

    beforeEach(async () => {
        await resetDb(ctx.prisma);
  });

  afterAll(async () => {
    await ctx.prisma.$disconnect();
  });


  it("signup -> login -> get profile/me", async () => {
    const email = "john@example.com";
    const password = "Password123!";

    const signup = await request(ctx.app).post("/auth/signup").send({
      email,
      password,
      firstName: "John",
      lastName: "Doe",
      nickname: "JD",
      birthDate: "2005-09-15",
      school: "SFSU",
      collegeYear: "Freshman",
      targetCity: "San Francisco",
      targetState: "CA",
      targetZip: "94110",
    });

    expect(signup.status).toBe(201);
    expect(signup.body.token).toBeTruthy();

    const login = await request(ctx.app).post("/auth/login").send({ email, password });
    expect(login.status).toBe(200);
    const token = login.body.token;
    expect(token).toBeTruthy();

    const me = await request(ctx.app)
      .get("/profile/me")
      .set("Authorization", `Bearer ${token}`);

    expect(me.status).toBe(200);
    expect(me.body.profile).toHaveProperty("nickname");
    expect(me.body.profile.nickname).toBe("JD");
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
      nickname: "AB",
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
