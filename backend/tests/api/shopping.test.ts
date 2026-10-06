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

let ctx: TestContext;

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function householdWithRoommate() {
  const owner = await signupUser(ctx);
  const roommate = await signupUser(ctx);
  const house = await createHousehold(ctx, owner.token);
  await joinHouseholdByCode(ctx, roommate.token, house.joinCode);
  return { owner, roommate, house, base: `/households/${house.id}/shopping` };
}

async function addItem(
  token: string,
  base: string,
  body: { name: string; quantity?: string },
) {
  const res = await request(ctx.app)
    .post(`${base}/items`)
    .set(auth(token))
    .send(body);
  expect(res.status).toBe(201);
  return res.body;
}

describe.sequential("Shopping list", () => {
  beforeAll(() => {
    ctx = getTestContext();
  });
  afterEach(async () => {
    await resetDb(ctx.prisma);
  });
  afterAll(async () => {
    await ctx.prisma.$disconnect();
  });

  it("an item added by one member shows up for the others", async () => {
    const { owner, roommate, base } = await householdWithRoommate();

    const item = await addItem(owner.token, base, {
      name: "  Milk ",
      quantity: "2 L",
    });
    expect(item).toMatchObject({
      name: "Milk",
      quantity: "2 L",
      checkedAt: null,
      addedByUser: { id: owner.userId },
      checkedByUser: null,
    });

    const res = await request(ctx.app)
      .get(`${base}/items`)
      .set(auth(roommate.token));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(item.id);
  });

  it("stores an empty quantity as null", async () => {
    const { owner, base } = await householdWithRoommate();
    const item = await addItem(owner.token, base, {
      name: "Bread",
      quantity: "  ",
    });
    expect(item.quantity).toBeNull();
  });

  it("hides the list from non-members and former members with 404", async () => {
    const { roommate, house, base } = await householdWithRoommate();
    const stranger = await signupUser(ctx);

    const asStranger = await request(ctx.app)
      .get(`${base}/items`)
      .set(auth(stranger.token));
    expect(asStranger.status).toBe(404);

    await request(ctx.app)
      .post(`/households/${house.id}/leave`)
      .set(auth(roommate.token))
      .expect(200);
    const asFormer = await request(ctx.app)
      .post(`${base}/items`)
      .set(auth(roommate.token))
      .send({ name: "Eggs" });
    expect(asFormer.status).toBe(404);
  });

  it("returns 404 while the module is turned off", async () => {
    const { owner, roommate, house, base } = await householdWithRoommate();

    await request(ctx.app)
      .patch(`/households/${house.id}/settings`)
      .set(auth(owner.token))
      .send({ shoppingEnabled: false })
      .expect(200);

    const res = await request(ctx.app)
      .get(`${base}/items`)
      .set(auth(roommate.token));
    expect(res.status).toBe(404);

    await request(ctx.app)
      .patch(`/households/${house.id}/settings`)
      .set(auth(owner.token))
      .send({ shoppingEnabled: true })
      .expect(200);
    await request(ctx.app)
      .get(`${base}/items`)
      .set(auth(roommate.token))
      .expect(200);
  });

  it("checking off records who did it, unchecking clears it", async () => {
    const { owner, roommate, base } = await householdWithRoommate();
    const item = await addItem(owner.token, base, { name: "Coffee" });

    const checked = await request(ctx.app)
      .patch(`${base}/items/${item.id}`)
      .set(auth(roommate.token))
      .send({ checked: true });
    expect(checked.status).toBe(200);
    expect(checked.body.checkedAt).not.toBeNull();
    expect(checked.body.checkedByUser.id).toBe(roommate.userId);

    const again = await request(ctx.app)
      .patch(`${base}/items/${item.id}`)
      .set(auth(owner.token))
      .send({ checked: true });
    expect(again.body.checkedByUser.id).toBe(roommate.userId);

    const unchecked = await request(ctx.app)
      .patch(`${base}/items/${item.id}`)
      .set(auth(owner.token))
      .send({ checked: false });
    expect(unchecked.body).toMatchObject({
      checkedAt: null,
      checkedByUser: null,
    });
  });

  it("any member can remove an item", async () => {
    const { owner, roommate, base } = await householdWithRoommate();
    const item = await addItem(owner.token, base, { name: "Rice" });

    await request(ctx.app)
      .delete(`${base}/items/${item.id}`)
      .set(auth(roommate.token))
      .expect(204);

    const res = await request(ctx.app)
      .get(`${base}/items`)
      .set(auth(owner.token));
    expect(res.body).toEqual([]);
  });

  it("can't reach another household's items through its own id", async () => {
    const { owner, base } = await householdWithRoommate();
    const other = await signupUser(ctx);
    const otherHouse = await createHousehold(ctx, other.token);
    const otherItem = await addItem(
      other.token,
      `/households/${otherHouse.id}/shopping`,
      { name: "Not yours" },
    );

    const patch = await request(ctx.app)
      .patch(`${base}/items/${otherItem.id}`)
      .set(auth(owner.token))
      .send({ checked: true });
    expect(patch.status).toBe(404);

    const del = await request(ctx.app)
      .delete(`${base}/items/${otherItem.id}`)
      .set(auth(owner.token));
    expect(del.status).toBe(404);
  });

  it("clear-checked removes only checked items", async () => {
    const { owner, base } = await householdWithRoommate();
    const done = await addItem(owner.token, base, { name: "Apples" });
    const open = await addItem(owner.token, base, { name: "Pears" });
    await request(ctx.app)
      .patch(`${base}/items/${done.id}`)
      .set(auth(owner.token))
      .send({ checked: true })
      .expect(200);

    const res = await request(ctx.app)
      .post(`${base}/clear-checked`)
      .set(auth(owner.token));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ count: 1 });

    const list = await request(ctx.app)
      .get(`${base}/items`)
      .set(auth(owner.token));
    expect(list.body.map((i: { id: string }) => i.id)).toEqual([open.id]);
  });
});
