import request from "supertest";
import { resetDb } from "../helpers/resetDb";
import type { TestContext } from "../helpers/testFactory";
import {
  signupUser,
  createRoom,
  listRooms,
  sendMessage,
  respondToInvite,
} from "../helpers/testFactory";
import { getTestContext } from "../helpers/testContext";
import { beforeAll, afterEach, afterAll, describe, it, expect } from "vitest";

let ctx: TestContext;

describe.sequential("Chat", () => {
  beforeAll(() => {
    ctx = getTestContext();
  });
  afterEach(async () => {
    await resetDb(ctx.prisma);
  });
  afterAll(async () => {
    await ctx.prisma.$disconnect();
  });

  it("create room -> invitee sees pending invite -> accept -> appears in rooms", async () => {
    const owner = await signupUser(ctx, { displayName: "owner" });
    const invitee = await signupUser(ctx, { displayName: "invitee" });

    const created = await createRoom(
      ctx,
      owner.token,
      [invitee.userId],
      "Test Room",
    );
    expect(created.roomId).toBeTruthy();

    // invitee should see invite
    const before = await listRooms(ctx, invitee.token);
    expect(before.invites.some((r: any) => r.id === created.roomId)).toBe(true);

    // accept
    const acceptRes = await request(ctx.app)
      .post(`/chatrooms/${created.roomId}/accept`)
      .set("Authorization", `Bearer ${invitee.token}`);
    expect(acceptRes.status).toBe(200);

    const after = await listRooms(ctx, invitee.token);
    expect(after.invites.some((r: any) => r.id === created.roomId)).toBe(false);
    expect(after.rooms.some((r: any) => r.id === created.roomId)).toBe(true);
  });

  it("send message -> message appears in GET messages", async () => {
    const owner = await signupUser(ctx, { displayName: "owner" });
    const invitee = await signupUser(ctx, { displayName: "invitee" });

    const created = await createRoom(
      ctx,
      owner.token,
      [invitee.userId],
      "Msg Room",
    );

    // accept invitee so both can read
    await request(ctx.app)
      .post(`/chatrooms/${created.roomId}/accept`)
      .set("Authorization", `Bearer ${invitee.token}`);

    await sendMessage(ctx, owner.token, created.roomId, "hello there");

    const msgs = await request(ctx.app)
      .get(`/chatrooms/${created.roomId}/messages`)
      .set("Authorization", `Bearer ${invitee.token}`);

    expect(msgs.status).toBe(200);
    expect(Array.isArray(msgs.body)).toBe(true);
    expect(msgs.body.some((m: any) => m.text === "hello there")).toBe(true);
  });

  it("GET messages with ?after returns only newer messages", async () => {
    const owner = await signupUser(ctx, { displayName: "owner" });
    const invitee = await signupUser(ctx, { displayName: "invitee" });
    const created = await createRoom(ctx, owner.token, [invitee.userId]);
    await request(ctx.app)
      .post(`/chatrooms/${created.roomId}/accept`)
      .set("Authorization", `Bearer ${invitee.token}`);

    await sendMessage(ctx, owner.token, created.roomId, "older");
    await sendMessage(ctx, owner.token, created.roomId, "newer");

    // Pin timestamps so the test doesn't depend on messages landing in different milliseconds.
    const now = Date.now();
    await ctx.prisma.chatMessage.updateMany({
      where: { text: "older" },
      data: { createdAt: new Date(now - 60_000) },
    });
    await ctx.prisma.chatMessage.updateMany({
      where: { text: "newer" },
      data: { createdAt: new Date(now) },
    });

    const all = await request(ctx.app)
      .get(`/chatrooms/${created.roomId}/messages`)
      .set("Authorization", `Bearer ${invitee.token}`);
    expect(all.body.map((m: any) => m.text)).toEqual(["older", "newer"]);

    const since = new Date(now - 30_000).toISOString();
    const recent = await request(ctx.app)
      .get(`/chatrooms/${created.roomId}/messages`)
      .query({ after: since })
      .set("Authorization", `Bearer ${invitee.token}`);
    expect(recent.status).toBe(200);
    expect(recent.body.map((m: any) => m.text)).toEqual(["newer"]);
  });

  it("room names are limited to 40 characters on create and rename", async () => {
    const owner = await signupUser(ctx, { displayName: "owner" });
    const invitee = await signupUser(ctx, { displayName: "invitee" });

    const tooLong = await request(ctx.app)
      .post("/chatrooms")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ participantIds: [invitee.userId], name: "x".repeat(41) });
    expect(tooLong.status).not.toBe(201);
    expect(await ctx.prisma.chatRoom.count()).toBe(0);

    const { roomId } = await createRoom(
      ctx,
      owner.token,
      [invitee.userId],
      "x".repeat(40),
    );

    const renameTooLong = await request(ctx.app)
      .patch(`/chatrooms/${roomId}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "y".repeat(41) });
    expect(renameTooLong.status).not.toBe(200);

    const room = await ctx.prisma.chatRoom.findUnique({
      where: { id: roomId },
    });
    expect(room?.name).toBe("x".repeat(40));
  });

  it("room details list participants with their status", async () => {
    const owner = await signupUser(ctx, { displayName: "owner" });
    const accepted = await signupUser(ctx, { displayName: "accepted" });
    const pending = await signupUser(ctx, { displayName: "pending" });
    const declined = await signupUser(ctx, { displayName: "declined" });
    const { roomId } = await createRoom(ctx, owner.token, [
      accepted.userId,
      pending.userId,
      declined.userId,
    ]);
    await respondToInvite(ctx.app, accepted.token, roomId, "accept");
    await respondToInvite(ctx.app, declined.token, roomId, "decline");

    const res = await request(ctx.app)
      .get(`/chatrooms/${roomId}`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(res.status).toBe(200);

    const statusOf = (userId: string) =>
      res.body.participants.find((p: any) => p.userId === userId)?.status;
    expect(statusOf(owner.userId)).toBe("accepted");
    expect(statusOf(accepted.userId)).toBe("accepted");
    expect(statusOf(pending.userId)).toBe("pending");
    expect(statusOf(declined.userId)).toBe("declined");
    expect(res.body.participants).toHaveLength(4);
  });

  it("re-inviting someone who declined leaves them declined", async () => {
    const owner = await signupUser(ctx, { displayName: "owner" });
    const invitee = await signupUser(ctx, { displayName: "invitee" });
    const { roomId } = await createRoom(ctx, owner.token, [invitee.userId]);
    await respondToInvite(ctx.app, invitee.token, roomId, "decline");

    await request(ctx.app)
      .post(`/chatrooms/${roomId}/invite`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ participantIds: [invitee.userId] });

    const participant = await ctx.prisma.chatRoomParticipant.findFirst({
      where: { chatRoomId: roomId, userId: invitee.userId },
    });
    expect(participant?.status).toBe("declined");
  });

  describe("forming a household from a room", () => {
    const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

    async function roomWithMembers() {
      const owner = await signupUser(ctx, { displayName: "owner" });
      const accepted = await signupUser(ctx, { displayName: "accepted" });
      const pending = await signupUser(ctx, { displayName: "pending" });
      const { roomId } = await createRoom(ctx, owner.token, [
        accepted.userId,
        pending.userId,
      ]);
      await respondToInvite(ctx.app, accepted.token, roomId, "accept");
      return { owner, accepted, pending, roomId };
    }

    it("owner forms a household and accepted participants get invites", async () => {
      const { owner, accepted, pending, roomId } = await roomWithMembers();

      const res = await request(ctx.app)
        .post(`/chatrooms/${roomId}/household`)
        .set(auth(owner.token))
        .send({ name: "Room House" });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe("Room House");
      expect(res.body.sourceChatRoomId).toBe(roomId);
      expect(res.body.members).toHaveLength(1);
      expect(res.body.members[0].userId).toBe(owner.userId);

      const acceptedInbox = await request(ctx.app)
        .get("/households/invites/mine")
        .set(auth(accepted.token));
      expect(acceptedInbox.body).toHaveLength(1);
      expect(acceptedInbox.body[0].household.id).toBe(res.body.id);

      const pendingInbox = await request(ctx.app)
        .get("/households/invites/mine")
        .set(auth(pending.token));
      expect(pendingInbox.body).toEqual([]);

      const joined = await request(ctx.app)
        .post(`/households/invites/${acceptedInbox.body[0].id}/accept`)
        .set(auth(accepted.token));
      expect(joined.status).toBe(200);
      expect(joined.body.members).toHaveLength(2);

      const details = await request(ctx.app)
        .get(`/chatrooms/${roomId}`)
        .set(auth(accepted.token));
      expect(details.body.household).toEqual({
        id: res.body.id,
        name: "Room House",
      });
    });

    it("only the room owner can form a household", async () => {
      const { accepted, roomId } = await roomWithMembers();

      const res = await request(ctx.app)
        .post(`/chatrooms/${roomId}/household`)
        .set(auth(accepted.token))
        .send({ name: "Not Mine" });
      expect(res.status).toBe(403);
    });

    it("a room can form only one household", async () => {
      const { owner, roomId } = await roomWithMembers();
      await request(ctx.app)
        .post(`/chatrooms/${roomId}/household`)
        .set(auth(owner.token))
        .send({ name: "First" })
        .expect(201);

      const again = await request(ctx.app)
        .post(`/chatrooms/${roomId}/household`)
        .set(auth(owner.token))
        .send({ name: "Second" });
      expect(again.status).toBe(409);
    });

    it("rejects a room where nobody else has accepted yet", async () => {
      const owner = await signupUser(ctx, { displayName: "owner" });
      const invitee = await signupUser(ctx, { displayName: "invitee" });
      const { roomId } = await createRoom(ctx, owner.token, [invitee.userId]);

      const res = await request(ctx.app)
        .post(`/chatrooms/${roomId}/household`)
        .set(auth(owner.token))
        .send({ name: "Lonely House" });
      expect(res.status).toBe(400);
    });

    it("room details show no household before one is formed", async () => {
      const { owner, roomId } = await roomWithMembers();
      const details = await request(ctx.app)
        .get(`/chatrooms/${roomId}`)
        .set(auth(owner.token));
      expect(details.body.household).toBeNull();
    });
  });
});
