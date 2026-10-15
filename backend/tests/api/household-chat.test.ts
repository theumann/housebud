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
  return { owner, roommate, house, base: `/households/${house.id}/chat` };
}

const tick = () => new Promise((r) => setTimeout(r, 5));

async function texts(token: string, base: string) {
  const res = await request(ctx.app)
    .get(`${base}/messages`)
    .set(auth(token))
    .expect(200);
  return res.body.map((m: { text: string }) => m.text);
}

async function send(token: string, base: string, text: string) {
  const res = await request(ctx.app)
    .post(`${base}/messages`)
    .set(auth(token))
    .send({ text });
  expect(res.status).toBe(201);
  return res.body;
}

describe.sequential("Household chat", () => {
  beforeAll(() => {
    ctx = getTestContext();
  });
  afterEach(async () => {
    await resetDb(ctx.prisma);
  });
  afterAll(async () => {
    await ctx.prisma.$disconnect();
  });

  it("a message sent by one member shows up for the others, oldest first", async () => {
    const { owner, roommate, base } = await householdWithRoommate();

    const first = await send(owner.token, base, "  Who took my milk? ");
    expect(first).toMatchObject({
      text: "Who took my milk?",
      sender: { id: owner.userId },
    });
    await send(roommate.token, base, "Not me");

    const res = await request(ctx.app)
      .get(`${base}/messages`)
      .set(auth(roommate.token));
    expect(res.status).toBe(200);
    expect(res.body.map((m: { text: string }) => m.text)).toEqual([
      "Who took my milk?",
      "Not me",
    ]);
  });

  it("with `after`, returns only messages from that time on", async () => {
    const { owner, base } = await householdWithRoommate();
    const first = await send(owner.token, base, "one");
    await new Promise((r) => setTimeout(r, 5));
    const second = await send(owner.token, base, "two");

    const res = await request(ctx.app)
      .get(`${base}/messages`)
      .query({ after: second.createdAt })
      .set(auth(owner.token));
    expect(res.status).toBe(200);
    const ids = res.body.map((m: { id: string }) => m.id);
    expect(ids).toContain(second.id);
    expect(ids).not.toContain(first.id);
  });

  it("a member who joins later only sees messages from then on", async () => {
    const { owner, house, base } = await householdWithRoommate();
    await send(owner.token, base, "before");
    await tick();

    const newcomer = await signupUser(ctx);
    await joinHouseholdByCode(ctx, newcomer.token, house.joinCode);
    await send(owner.token, base, "after");

    expect(await texts(newcomer.token, base)).toEqual(["after"]);
    expect(await texts(owner.token, base)).toEqual(["before", "after"]);

    // An early `after` doesn't reach past the join either.
    const res = await request(ctx.app)
      .get(`${base}/messages`)
      .query({ after: new Date(0).toISOString() })
      .set(auth(newcomer.token));
    expect(res.body.map((m: { text: string }) => m.text)).toEqual(["after"]);
  });

  it("someone who leaves and rejoins only sees messages since rejoining", async () => {
    const { owner, roommate, house, base } = await householdWithRoommate();
    await send(roommate.token, base, "while a member");
    await request(ctx.app)
      .post(`/households/${house.id}/leave`)
      .set(auth(roommate.token))
      .expect(200);
    await send(owner.token, base, "while away");
    await tick();

    await joinHouseholdByCode(ctx, roommate.token, house.joinCode);
    await send(owner.token, base, "welcome back");

    expect(await texts(roommate.token, base)).toEqual(["welcome back"]);
  });

  it("entering the join code again doesn't hide an active member's history", async () => {
    const { roommate, house, base } = await householdWithRoommate();
    await send(roommate.token, base, "hello");
    await tick();

    await joinHouseholdByCode(ctx, roommate.token, house.joinCode);

    expect(await texts(roommate.token, base)).toEqual(["hello"]);
  });

  it("rejects empty and whitespace-only messages", async () => {
    const { owner, base } = await householdWithRoommate();
    const res = await request(ctx.app)
      .post(`${base}/messages`)
      .set(auth(owner.token))
      .send({ text: "   " });
    expect(res.status).toBe(400);
  });

  it("does not show another household's messages", async () => {
    const { owner, base } = await householdWithRoommate();
    await send(owner.token, base, "ours");

    const other = await signupUser(ctx);
    const otherHouse = await createHousehold(ctx, other.token);
    const res = await request(ctx.app)
      .get(`/households/${otherHouse.id}/chat/messages`)
      .set(auth(other.token));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("hides the chat from non-members and former members with 404", async () => {
    const { owner, roommate, house, base } = await householdWithRoommate();
    await send(owner.token, base, "hello");
    const stranger = await signupUser(ctx);

    await request(ctx.app)
      .get(`${base}/messages`)
      .set(auth(stranger.token))
      .expect(404);

    await request(ctx.app)
      .post(`/households/${house.id}/leave`)
      .set(auth(roommate.token))
      .expect(200);
    await request(ctx.app)
      .get(`${base}/messages`)
      .set(auth(roommate.token))
      .expect(404);
    const asFormer = await request(ctx.app)
      .post(`${base}/messages`)
      .set(auth(roommate.token))
      .send({ text: "still here?" });
    expect(asFormer.status).toBe(404);
  });

  it("returns 404 while the module is turned off", async () => {
    const { owner, roommate, house, base } = await householdWithRoommate();

    await request(ctx.app)
      .patch(`/households/${house.id}/settings`)
      .set(auth(owner.token))
      .send({ chatEnabled: false })
      .expect(200);
    await request(ctx.app)
      .get(`${base}/messages`)
      .set(auth(roommate.token))
      .expect(404);

    await request(ctx.app)
      .patch(`/households/${house.id}/settings`)
      .set(auth(owner.token))
      .send({ chatEnabled: true })
      .expect(200);
    await request(ctx.app)
      .get(`${base}/messages`)
      .set(auth(roommate.token))
      .expect(200);
  });
});
