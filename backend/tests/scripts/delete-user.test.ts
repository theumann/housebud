import request from "supertest";
import { resetDb } from "../helpers/resetDb";
import type { TestContext } from "../helpers/testFactory";
import {
  signupUser,
  createHousehold,
  joinHouseholdByCode,
} from "../helpers/testFactory";
import { getTestContext } from "../helpers/testContext";
import { deleteAccount, planDeletion } from "../../scripts/accounts";
import { describe, beforeAll, beforeEach, afterAll, it, expect } from "vitest";

let ctx: TestContext;

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function turnOnExpenses(token: string, householdId: string) {
  await request(ctx.app)
    .patch(`/households/${householdId}/settings`)
    .set(auth(token))
    .send({ expensesEnabled: true })
    .expect(200);
}

async function balances(token: string, householdId: string) {
  const res = await request(ctx.app)
    .get(`/households/${householdId}/expenses`)
    .set(auth(token))
    .expect(200);
  return Object.fromEntries(
    res.body.balances.map((b: any) => [b.user.id, b.netCents]),
  );
}

describe.sequential("delete-user", () => {
  beforeAll(() => {
    ctx = getTestContext();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
  });
  afterAll(async () => {
    await ctx.prisma.$disconnect();
  });

  it("only plans: nothing changes until deleteAccount", async () => {
    const sam = await signupUser(ctx);
    await createHousehold(ctx, sam.token);

    const plan = await planDeletion(ctx.prisma, sam.userId);

    expect(plan.mode).toBe("delete");
    expect(plan.deleteHouseholds).toHaveLength(1);
    expect(await ctx.prisma.user.count()).toBe(1);
    expect(await ctx.prisma.household.count()).toBe(1);
  });

  it("deletes someone alone in their household, with the household and invitations to them", async () => {
    const owner = await signupUser(ctx);
    const sam = await signupUser(ctx, { email: "sam@example.com" });
    const solo = await createHousehold(ctx, sam.token, "Solo");
    await request(ctx.app)
      .post("/feedback")
      .set(auth(sam.token))
      .send({ message: "Hi", page: "/household" })
      .expect(201);
    const other = await createHousehold(ctx, owner.token, "Other");
    await request(ctx.app)
      .post(`/households/${other.id}/invites`)
      .set(auth(owner.token))
      .send({ email: "sam@example.com" })
      .expect(201);

    await deleteAccount(ctx.prisma, await planDeletion(ctx.prisma, sam.userId));

    expect(
      await ctx.prisma.user.findUnique({ where: { id: sam.userId } }),
    ).toBeNull();
    expect(
      await ctx.prisma.household.findUnique({ where: { id: solo.id } }),
    ).toBeNull();
    expect(await ctx.prisma.householdInvite.count()).toBe(0);
    expect(await ctx.prisma.feedback.count()).toBe(0);
    expect(await ctx.prisma.household.count()).toBe(1);
    await request(ctx.app)
      .post("/auth/login")
      .send({ identifier: "sam@example.com", password: "Password123!" })
      .expect(401);
  });

  it("hands a sole owner's household to the longest-standing member", async () => {
    const owner = await signupUser(ctx);
    const first = await signupUser(ctx);
    const second = await signupUser(ctx);
    const house = await createHousehold(ctx, owner.token);
    await joinHouseholdByCode(ctx, first.token, house.joinCode);
    await joinHouseholdByCode(ctx, second.token, house.joinCode);

    const plan = await planDeletion(ctx.prisma, owner.userId);
    expect(plan.mode).toBe("delete");
    expect(plan.keepHouseholds[0].newOwner?.userId).toBe(first.userId);
    await deleteAccount(ctx.prisma, plan);

    const members = await ctx.prisma.householdMember.findMany({
      where: { householdId: house.id },
    });
    expect(Object.fromEntries(members.map((m) => [m.userId, m.role]))).toEqual({
      [first.userId]: "owner",
      [second.userId]: "member",
    });
  });

  it("anonymizes someone with shared expenses, so housemates' balances don't change", async () => {
    const owner = await signupUser(ctx);
    const sam = await signupUser(ctx, { email: "sam@example.com" });
    const alex = await signupUser(ctx);
    const house = await createHousehold(ctx, owner.token);
    await joinHouseholdByCode(ctx, sam.token, house.joinCode);
    await joinHouseholdByCode(ctx, alex.token, house.joinCode);
    await turnOnExpenses(owner.token, house.id);
    const base = `/households/${house.id}/expenses`;
    await request(ctx.app)
      .post(`${base}/expenses`)
      .set(auth(sam.token))
      .send({
        description: "Groceries",
        spentOn: "2026-10-17",
        amountCents: 3000,
        paidByUserId: sam.userId,
        splitWith: [owner.userId, sam.userId, alex.userId],
      })
      .expect(201);
    await request(ctx.app)
      .post(`/households/${house.id}/chat/messages`)
      .set(auth(sam.token))
      .send({ text: "Bought groceries" })
      .expect(201);
    const before = await balances(owner.token, house.id);

    const plan = await planDeletion(ctx.prisma, sam.userId);
    expect(plan).toMatchObject({
      mode: "anonymize",
      sharedExpenses: 1,
      payments: 0,
    });
    await deleteAccount(ctx.prisma, plan);

    expect(await balances(owner.token, house.id)).toEqual(before);
    const user = await ctx.prisma.user.findUniqueOrThrow({
      where: { id: sam.userId },
      include: { profile: true, householdMemberships: true },
    });
    expect(user).toMatchObject({
      email: `deleted-${sam.userId}@deleted.invalid`,
      username: `deleted-${sam.userId.slice(0, 8)}`,
      isActive: false,
      profile: null,
    });
    expect(user.householdMemberships.map((m) => m.status)).toEqual(["left"]);
    expect(await ctx.prisma.householdMessage.count()).toBe(0);
    await request(ctx.app)
      .post("/auth/login")
      .send({ identifier: "sam@example.com", password: "Password123!" })
      .expect(401);
  });

  it("deletes outright when the money history stays inside a household that goes too", async () => {
    const sam = await signupUser(ctx);
    const alex = await signupUser(ctx);
    const house = await createHousehold(ctx, sam.token);
    await joinHouseholdByCode(ctx, alex.token, house.joinCode);
    await turnOnExpenses(sam.token, house.id);
    await request(ctx.app)
      .post(`/households/${house.id}/expenses/settlements`)
      .set(auth(sam.token))
      .send({
        fromUserId: alex.userId,
        toUserId: sam.userId,
        amountCents: 500,
        paidOn: "2026-10-18",
      })
      .expect(201);
    await request(ctx.app)
      .post(`/households/${house.id}/leave`)
      .set(auth(alex.token))
      .expect(200);

    const plan = await planDeletion(ctx.prisma, sam.userId);
    expect(plan.mode).toBe("delete");
    await deleteAccount(ctx.prisma, plan);

    expect(await ctx.prisma.household.count()).toBe(0);
    expect(await ctx.prisma.settlement.count()).toBe(0);
    expect(await ctx.prisma.user.count()).toBe(1);
  });
});
