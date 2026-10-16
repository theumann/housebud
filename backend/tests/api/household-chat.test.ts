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

  describe("unread count", () => {
    async function unread(token: string, householdId: string) {
      const res = await request(ctx.app)
        .get("/households")
        .set(auth(token))
        .expect(200);
      return res.body.find((h: { id: string }) => h.id === householdId)
        .unreadMessages;
    }

    async function markRead(token: string, base: string, upTo: string) {
      await request(ctx.app)
        .post(`${base}/read`)
        .set(auth(token))
        .send({ upTo })
        .expect(204);
    }

    it("counts messages from others, not your own", async () => {
      const { owner, roommate, house, base } = await householdWithRoommate();
      await send(owner.token, base, "one");
      await send(owner.token, base, "two");
      await send(roommate.token, base, "mine");

      expect(await unread(roommate.token, house.id)).toBe(2);
      expect(await unread(owner.token, house.id)).toBe(1);
    });

    it("reading up to a message clears it and everything before it", async () => {
      const { owner, roommate, house, base } = await householdWithRoommate();
      await send(owner.token, base, "one");
      await tick();
      const second = await send(owner.token, base, "two");
      await tick();
      await send(owner.token, base, "three");

      await markRead(roommate.token, base, second.createdAt);
      expect(await unread(roommate.token, house.id)).toBe(1);
    });

    it("never moves the read point backwards or past now", async () => {
      const { owner, roommate, house, base } = await householdWithRoommate();
      const first = await send(owner.token, base, "one");
      await tick();
      const second = await send(owner.token, base, "two");

      await markRead(roommate.token, base, second.createdAt);
      await markRead(roommate.token, base, first.createdAt);
      expect(await unread(roommate.token, house.id)).toBe(0);

      const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await markRead(roommate.token, base, future);
      await tick();
      await send(owner.token, base, "three");
      expect(await unread(roommate.token, house.id)).toBe(1);
    });

    it("doesn't count messages from before you joined", async () => {
      const { owner, house, base } = await householdWithRoommate();
      await send(owner.token, base, "before");
      await tick();

      const newcomer = await signupUser(ctx);
      await joinHouseholdByCode(ctx, newcomer.token, house.joinCode);
      expect(await unread(newcomer.token, house.id)).toBe(0);

      await send(owner.token, base, "after");
      expect(await unread(newcomer.token, house.id)).toBe(1);
    });

    it("is 0 while the chat is turned off", async () => {
      const { owner, roommate, house, base } = await householdWithRoommate();
      await send(owner.token, base, "hello");

      await request(ctx.app)
        .patch(`/households/${house.id}/settings`)
        .set(auth(owner.token))
        .send({ chatEnabled: false })
        .expect(200);
      expect(await unread(roommate.token, house.id)).toBe(0);
    });

    it("can't be marked by non-members", async () => {
      const { base } = await householdWithRoommate();
      const stranger = await signupUser(ctx);
      await request(ctx.app)
        .post(`${base}/read`)
        .set(auth(stranger.token))
        .send({ upTo: new Date().toISOString() })
        .expect(404);
    });
  });
});
