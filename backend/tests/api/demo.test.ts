import request from "supertest";
import { resetDb } from "../helpers/resetDb";
import type { TestContext } from "../helpers/testFactory";
import { createQuestion, signupUser } from "../helpers/testFactory";
import { getTestContext } from "../helpers/testContext";
import { env } from "../../src/config/env";
import {
  SANDBOX_EMAIL_DOMAIN,
  SANDBOX_HOURLY_CAP,
} from "../../src/modules/demo/demo.types";
import { seedDemoUsers } from "../../scripts/demo-users";
import { countActiveSandboxes } from "../../src/modules/demo/demo.service";
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

describe.sequential("Demo sandbox", () => {
  beforeAll(() => {
    ctx = getTestContext();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    env.DEMO_SANDBOX = true;
  });
  afterEach(() => {
    env.DEMO_SANDBOX = false;
  });
  afterAll(async () => {
    await ctx.prisma.$disconnect();
  });

  async function withDemoUsers() {
    await createQuestion(ctx, { code: "Q1", text: "Q1", options: ["A", "B"] });
    await seedDemoUsers(ctx.prisma, 4);
  }

  it("doesn't exist unless DEMO_SANDBOX is on", async () => {
    env.DEMO_SANDBOX = false;
    await withDemoUsers();
    const res = await request(ctx.app).post("/demo/sandbox");
    expect(res.status).toBe(404);
    expect(await ctx.prisma.user.count()).toBe(4);
  });

  it("needs the seeded demo users", async () => {
    const res = await request(ctx.app).post("/demo/sandbox");
    expect(res.status).toBe(503);
  });

  it("logs the visitor into their own household with chores, shopping, chat and expenses", async () => {
    await withDemoUsers();

    const res = await request(ctx.app).post("/demo/sandbox");
    expect(res.status).toBe(201);
    const token = res.body.token;
    expect(res.body.user.email).toMatch(`@${SANDBOX_EMAIL_DOMAIN}`);

    const households = await request(ctx.app)
      .get("/households")
      .set(auth(token))
      .expect(200);
    expect(households.body).toHaveLength(1);
    const id = households.body[0].id;

    const household = await request(ctx.app)
      .get(`/households/${id}`)
      .set(auth(token))
      .expect(200);
    expect(household.body.members).toHaveLength(3);

    const chores = await request(ctx.app)
      .get(`/households/${id}/chores`)
      .set(auth(token))
      .expect(200);
    expect(chores.body.length).toBeGreaterThanOrEqual(5);

    const shopping = await request(ctx.app)
      .get(`/households/${id}/shopping/items`)
      .set(auth(token))
      .expect(200);
    expect(shopping.body.length).toBeGreaterThan(0);

    const chat = await request(ctx.app)
      .get(`/households/${id}/chat/messages`)
      .set(auth(token))
      .expect(200);
    expect(chat.body.length).toBeGreaterThan(0);

    const expenses = await request(ctx.app)
      .get(`/households/${id}/expenses`)
      .set(auth(token))
      .expect(200);
    expect(expenses.body.expenses.length).toBeGreaterThan(0);
    const mine = expenses.body.balances.find(
      (b: { user: { id: string } }) => b.user.id === res.body.user.id,
    );
    expect(mine.netCents).toBeLessThan(0);
  });

  it("gives every visitor a separate sandbox", async () => {
    await withDemoUsers();
    const a = await request(ctx.app).post("/demo/sandbox").expect(201);
    const b = await request(ctx.app).post("/demo/sandbox").expect(201);

    const ha = await request(ctx.app)
      .get("/households")
      .set(auth(a.body.token));
    const hb = await request(ctx.app)
      .get("/households")
      .set(auth(b.body.token));
    expect(ha.body[0].id).not.toBe(hb.body[0].id);
  });

  it("keeps sandbox visitors out of everyone else's matches", async () => {
    await withDemoUsers();
    const sandbox = await request(ctx.app).post("/demo/sandbox").expect(201);
    const real = await signupUser(ctx, { targetZip: "94110" });

    const matches = await request(ctx.app)
      .get("/matches?page=1")
      .set(auth(real.token))
      .expect(200);
    const ids = matches.body.items.map((m: { userId: string }) => m.userId);
    expect(ids).not.toContain(sandbox.body.user.id);
    expect(ids.length).toBeGreaterThan(0);
  });

  it("removes sandboxes older than a day, with their household", async () => {
    await withDemoUsers();
    const old = await request(ctx.app).post("/demo/sandbox").expect(201);
    const oldId = old.body.user.id;
    await ctx.prisma.user.update({
      where: { id: oldId },
      data: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    });

    await request(ctx.app).post("/demo/sandbox").expect(201);

    expect(await ctx.prisma.user.findUnique({ where: { id: oldId } })).toBe(
      null,
    );
    expect(await ctx.prisma.household.count()).toBe(1);
    // The demo users themselves stay.
    expect(
      await ctx.prisma.user.count({
        where: { email: { endsWith: "@demo.example.com" } },
      }),
    ).toBe(4);
  });

  it("counts only sandboxes from the last 24 hours as active", async () => {
    await withDemoUsers();
    const a = await request(ctx.app).post("/demo/sandbox").expect(201);
    await request(ctx.app).post("/demo/sandbox").expect(201);
    expect(await countActiveSandboxes(ctx.prisma)).toBe(2);

    await ctx.prisma.user.update({
      where: { id: a.body.user.id },
      data: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    });
    expect(await countActiveSandboxes(ctx.prisma)).toBe(1);
  });

  it("refuses more than the hourly cap", async () => {
    await withDemoUsers();
    await ctx.prisma.user.createMany({
      data: Array.from({ length: SANDBOX_HOURLY_CAP }, (_, i) => ({
        email: `visitor-cap${i}@${SANDBOX_EMAIL_DOMAIN}`,
        username: `visitor-cap${i}`,
        passwordHash: "x",
      })),
    });
    const res = await request(ctx.app).post("/demo/sandbox");
    expect(res.status).toBe(429);
  });
});
