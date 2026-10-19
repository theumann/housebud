import request from "supertest";
import { resetDb } from "../helpers/resetDb";
import type { TestContext } from "../helpers/testFactory";
import {
  signupUser,
  createHousehold,
  joinHouseholdByCode,
} from "../helpers/testFactory";
import { getTestContext } from "../helpers/testContext";
import { beforeAll, afterEach, afterAll, describe, it, expect } from "vitest";
import {
  splitEqually,
  suggestTransfers,
} from "../../src/modules/expenses/expenses.service";

let ctx: TestContext;

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

// An owner and two roommates, with expenses turned on.
async function household() {
  const owner = await signupUser(ctx);
  const sam = await signupUser(ctx);
  const alex = await signupUser(ctx);
  const house = await createHousehold(ctx, owner.token);
  await joinHouseholdByCode(ctx, sam.token, house.joinCode);
  await joinHouseholdByCode(ctx, alex.token, house.joinCode);
  await request(ctx.app)
    .patch(`/households/${house.id}/settings`)
    .set(auth(owner.token))
    .send({ expensesEnabled: true })
    .expect(200);
  return { owner, sam, alex, house, base: `/households/${house.id}/expenses` };
}

async function addExpense(
  token: string,
  base: string,
  body: Record<string, unknown>,
) {
  const res = await request(ctx.app)
    .post(`${base}/expenses`)
    .set(auth(token))
    .send({ description: "Groceries", spentOn: "2026-10-17", ...body });
  expect(res.status).toBe(201);
  return res.body;
}

async function overview(token: string, base: string) {
  const res = await request(ctx.app).get(base).set(auth(token));
  expect(res.status).toBe(200);
  return res.body;
}

const netOf = (body: any, userId: string) =>
  body.balances.find((b: any) => b.user.id === userId)?.netCents;

describe("splitEqually", () => {
  it("adds up to the total, leftover cents to the first ids", () => {
    expect(splitEqually(1000, ["c", "a", "b"])).toEqual([
      { userId: "a", amountCents: 334 },
      { userId: "b", amountCents: 333 },
      { userId: "c", amountCents: 333 },
    ]);
  });
});

describe("suggestTransfers", () => {
  it("settles everyone with debtor-to-creditor transfers", () => {
    const net = new Map([
      ["a", 6000],
      ["b", -4000],
      ["c", -2500],
      ["d", 500],
    ]);
    expect(suggestTransfers(net)).toEqual([
      { fromUserId: "b", toUserId: "a", amountCents: 4000 },
      { fromUserId: "c", toUserId: "a", amountCents: 2000 },
      { fromUserId: "c", toUserId: "d", amountCents: 500 },
    ]);
  });
});

describe.sequential("Expenses", () => {
  beforeAll(() => {
    ctx = getTestContext();
  });
  afterEach(async () => {
    await resetDb(ctx.prisma);
  });
  afterAll(async () => {
    await ctx.prisma.$disconnect();
  });

  it("splits an expense equally and shows who owes whom", async () => {
    const { owner, sam, alex, base } = await household();

    const expense = await addExpense(sam.token, base, {
      amountCents: 1000,
      paidByUserId: sam.userId,
      splitWith: [owner.userId, sam.userId, alex.userId],
    });
    expect(expense.paidBy.id).toBe(sam.userId);
    expect(
      expense.shares.reduce((t: number, s: any) => t + s.amountCents, 0),
    ).toBe(1000);

    const body = await overview(alex.token, base);
    expect(body.currency).toBe("USD");
    expect(body.expenses).toHaveLength(1);
    expect(netOf(body, sam.userId)).toBe(
      1000 -
        expense.shares.find((s: any) => s.user.id === sam.userId).amountCents,
    );
    expect(body.balances.reduce((t: number, b: any) => t + b.netCents, 0)).toBe(
      0,
    );
    expect(body.transfers).toHaveLength(2);
    expect(body.transfers.every((t: any) => t.toUserId === sam.userId)).toBe(
      true,
    );
  });

  it("leaves out members who aren't in the split", async () => {
    const { owner, sam, alex, base } = await household();

    await addExpense(owner.token, base, {
      description: "Roast chicken",
      amountCents: 2000,
      paidByUserId: owner.userId,
      splitWith: [owner.userId, sam.userId],
    });

    const body = await overview(owner.token, base);
    expect(netOf(body, owner.userId)).toBe(1000);
    expect(netOf(body, sam.userId)).toBe(-1000);
    expect(netOf(body, alex.userId)).toBe(0);
  });

  it("lets a member log an expense someone else paid", async () => {
    const { owner, sam, alex, base } = await household();

    const expense = await addExpense(alex.token, base, {
      amountCents: 900,
      paidByUserId: sam.userId,
      splitWith: [owner.userId, sam.userId, alex.userId],
    });
    expect(expense.paidBy.id).toBe(sam.userId);
    expect(expense.createdBy.id).toBe(alex.userId);
  });

  it("rejects a payer or sharer who isn't a current member", async () => {
    const { owner, sam, house, base } = await household();
    const stranger = await signupUser(ctx);

    const res = await request(ctx.app)
      .post(`${base}/expenses`)
      .set(auth(owner.token))
      .send({
        description: "Pizza",
        amountCents: 3000,
        spentOn: "2026-10-17",
        paidByUserId: owner.userId,
        splitWith: [owner.userId, stranger.userId],
      });
    expect(res.status).toBe(400);

    await request(ctx.app)
      .post(`/households/${house.id}/leave`)
      .set(auth(sam.token))
      .expect(200);
    const asPayer = await request(ctx.app)
      .post(`${base}/expenses`)
      .set(auth(owner.token))
      .send({
        description: "Pizza",
        amountCents: 3000,
        spentOn: "2026-10-17",
        paidByUserId: sam.userId,
        splitWith: [owner.userId],
      });
    expect(asPayer.status).toBe(400);
  });

  it("only the creator, payer or owner can change or delete an expense", async () => {
    const { owner, sam, alex, base } = await household();
    const expense = await addExpense(sam.token, base, {
      amountCents: 1200,
      paidByUserId: sam.userId,
      splitWith: [owner.userId, sam.userId, alex.userId],
    });

    await request(ctx.app)
      .patch(`${base}/expenses/${expense.id}`)
      .set(auth(alex.token))
      .send({ amountCents: 1500 })
      .expect(403);
    await request(ctx.app)
      .delete(`${base}/expenses/${expense.id}`)
      .set(auth(alex.token))
      .expect(403);

    const edited = await request(ctx.app)
      .patch(`${base}/expenses/${expense.id}`)
      .set(auth(owner.token))
      .send({ amountCents: 1500, splitWith: [sam.userId, alex.userId] })
      .expect(200);
    expect(edited.body.shares).toHaveLength(2);
    expect(edited.body.shares.map((s: any) => s.amountCents)).toEqual([
      750, 750,
    ]);

    await request(ctx.app)
      .delete(`${base}/expenses/${expense.id}`)
      .set(auth(sam.token))
      .expect(204);
    expect((await overview(alex.token, base)).expenses).toHaveLength(0);
  });

  it("a payment settles a balance", async () => {
    const { owner, sam, base } = await household();
    await addExpense(owner.token, base, {
      amountCents: 4000,
      paidByUserId: owner.userId,
      splitWith: [owner.userId, sam.userId],
    });

    const payment = await request(ctx.app)
      .post(`${base}/settlements`)
      .set(auth(sam.token))
      .send({
        fromUserId: sam.userId,
        toUserId: owner.userId,
        amountCents: 2000,
        paidOn: "2026-10-18",
      })
      .expect(201);
    expect(payment.body).toMatchObject({
      from: { id: sam.userId },
      to: { id: owner.userId },
      paidOn: "2026-10-18",
      canEdit: true,
    });

    const body = await overview(owner.token, base);
    expect(netOf(body, owner.userId)).toBe(0);
    expect(netOf(body, sam.userId)).toBe(0);
    expect(body.transfers).toEqual([]);
  });

  it("only the recorder, the two people in it or the owner can change a payment", async () => {
    const { owner, sam, alex, base } = await household();
    const payment = await request(ctx.app)
      .post(`${base}/settlements`)
      .set(auth(sam.token))
      .send({
        fromUserId: sam.userId,
        toUserId: owner.userId,
        amountCents: 500,
        paidOn: "2026-10-18",
      })
      .expect(201);

    await request(ctx.app)
      .delete(`${base}/settlements/${payment.body.id}`)
      .set(auth(alex.token))
      .expect(403);
    await request(ctx.app)
      .patch(`${base}/settlements/${payment.body.id}`)
      .set(auth(owner.token))
      .send({ amountCents: 700 })
      .expect(200);
    await request(ctx.app)
      .delete(`${base}/settlements/${payment.body.id}`)
      .set(auth(owner.token))
      .expect(204);
  });

  it("rejects a payment to yourself", async () => {
    const { sam, base } = await household();
    await request(ctx.app)
      .post(`${base}/settlements`)
      .set(auth(sam.token))
      .send({
        fromUserId: sam.userId,
        toUserId: sam.userId,
        amountCents: 500,
        paidOn: "2026-10-18",
      })
      .expect(400);
  });

  it("keeps a former member's open balance and lets it be settled", async () => {
    const { owner, sam, alex, house, base } = await household();
    await addExpense(owner.token, base, {
      amountCents: 3000,
      paidByUserId: owner.userId,
      splitWith: [owner.userId, sam.userId, alex.userId],
    });

    await request(ctx.app)
      .post(`/households/${house.id}/leave`)
      .set(auth(sam.token))
      .expect(200);

    let body = await overview(owner.token, base);
    const samBalance = body.balances.find((b: any) => b.user.id === sam.userId);
    expect(samBalance).toMatchObject({ status: "left", netCents: -1000 });

    await request(ctx.app)
      .post(`${base}/settlements`)
      .set(auth(owner.token))
      .send({
        fromUserId: sam.userId,
        toUserId: owner.userId,
        amountCents: 1000,
        paidOn: "2026-10-18",
      })
      .expect(201);

    body = await overview(owner.token, base);
    expect(netOf(body, sam.userId)).toBeUndefined();
  });

  it("links checked shopping items to the expense they were bought on", async () => {
    const { owner, sam, house, base } = await household();
    const shopping = `/households/${house.id}/shopping`;
    const milk = await request(ctx.app)
      .post(`${shopping}/items`)
      .set(auth(owner.token))
      .send({ name: "Milk" })
      .expect(201);
    const bread = await request(ctx.app)
      .post(`${shopping}/items`)
      .set(auth(owner.token))
      .send({ name: "Bread" })
      .expect(201);
    await request(ctx.app)
      .patch(`${shopping}/items/${milk.body.id}`)
      .set(auth(owner.token))
      .send({ checked: true })
      .expect(200);

    const unchecked = await request(ctx.app)
      .post(`${base}/expenses`)
      .set(auth(owner.token))
      .send({
        description: "Milk, Bread",
        amountCents: 700,
        spentOn: "2026-10-17",
        paidByUserId: owner.userId,
        splitWith: [owner.userId, sam.userId],
        shoppingItemIds: [milk.body.id, bread.body.id],
      });
    expect(unchecked.status).toBe(400);

    const expense = await addExpense(owner.token, base, {
      description: "Milk",
      amountCents: 300,
      paidByUserId: owner.userId,
      splitWith: [owner.userId, sam.userId],
      shoppingItemIds: [milk.body.id],
    });
    const item = await ctx.prisma.shoppingItem.findUniqueOrThrow({
      where: { id: milk.body.id },
    });
    expect(item.expenseId).toBe(expense.id);

    const again = await request(ctx.app)
      .post(`${base}/expenses`)
      .set(auth(owner.token))
      .send({
        description: "Milk",
        amountCents: 300,
        spentOn: "2026-10-17",
        paidByUserId: owner.userId,
        splitWith: [owner.userId],
        shoppingItemIds: [milk.body.id],
      });
    expect(again.status).toBe(400);
  });

  it("returns 404 to non-members and while the module is off", async () => {
    const { owner, sam, house, base } = await household();
    const stranger = await signupUser(ctx);

    await request(ctx.app).get(base).set(auth(stranger.token)).expect(404);

    await request(ctx.app)
      .patch(`/households/${house.id}/settings`)
      .set(auth(owner.token))
      .send({ expensesEnabled: false })
      .expect(200);
    await request(ctx.app).get(base).set(auth(sam.token)).expect(404);
  });

  it("uses the household's currency", async () => {
    const { owner, house, base } = await household();
    await request(ctx.app)
      .patch(`/households/${house.id}/settings`)
      .set(auth(owner.token))
      .send({ currency: "EUR" })
      .expect(200);
    expect((await overview(owner.token, base)).currency).toBe("EUR");

    await request(ctx.app)
      .patch(`/households/${house.id}/settings`)
      .set(auth(owner.token))
      .send({ currency: "euro" })
      .expect(400);
  });
});
