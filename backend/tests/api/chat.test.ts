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

  describe("re-inviting former participants", () => {
    // Three people so the room stays active when one of them leaves.
    async function roomOfThree() {
      const owner = await signupUser(ctx, { displayName: "owner" });
      const member = await signupUser(ctx, { displayName: "member" });
      const target = await signupUser(ctx, { displayName: "target" });
      const { roomId } = await createRoom(ctx, owner.token, [
        member.userId,
        target.userId,
      ]);
      await respondToInvite(ctx.app, member.token, roomId, "accept");
      return { owner, member, target, roomId };
    }

    const invite = (token: string, roomId: string, userId: string) =>
      request(ctx.app)
        .post(`/chatrooms/${roomId}/invite`)
        .set("Authorization", `Bearer ${token}`)
        .send({ participantIds: [userId] });

    const statusOf = async (roomId: string, userId: string) =>
      (
        await ctx.prisma.chatRoomParticipant.findFirst({
          where: { chatRoomId: roomId, userId },
        })
      )?.status;

    it("someone who declined can be invited again, and accept", async () => {
      const { member, target, roomId } = await roomOfThree();
      await respondToInvite(ctx.app, target.token, roomId, "decline");

      const res = await invite(member.token, roomId, target.userId);
      expect(res.status).toBe(200);
      expect(await statusOf(roomId, target.userId)).toBe("pending");

      await respondToInvite(ctx.app, target.token, roomId, "accept");
      expect(await statusOf(roomId, target.userId)).toBe("accepted");
    });

    it("someone who left can be invited again", async () => {
      const { member, target, roomId } = await roomOfThree();
      await respondToInvite(ctx.app, target.token, roomId, "accept");
      await request(ctx.app)
        .post(`/chatrooms/${roomId}/leave`)
        .set("Authorization", `Bearer ${target.token}`)
        .expect(200);

      await invite(member.token, roomId, target.userId);
      expect(await statusOf(roomId, target.userId)).toBe("pending");
    });

    it("only the owner can bring back someone who was removed", async () => {
      const { owner, member, target, roomId } = await roomOfThree();
      await respondToInvite(ctx.app, target.token, roomId, "accept");
      await request(ctx.app)
        .post(`/chatrooms/${roomId}/kick`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ userId: target.userId })
        .expect(200);

      await invite(member.token, roomId, target.userId);
      expect(await statusOf(roomId, target.userId)).toBe("removed");

      await invite(owner.token, roomId, target.userId);
      expect(await statusOf(roomId, target.userId)).toBe("pending");
    });
  });

  describe("when the owner leaves", () => {
    const leave = (token: string, roomId: string) =>
      request(ctx.app)
        .post(`/chatrooms/${roomId}/leave`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

    const roleOf = async (roomId: string, userId: string) =>
      (
        await ctx.prisma.chatRoomParticipant.findFirst({
          where: { chatRoomId: roomId, userId },
        })
      )?.role;

    // first is invited and accepts before second.
    async function roomWithTwoMembers() {
      const owner = await signupUser(ctx, { displayName: "owner" });
      const first = await signupUser(ctx, { displayName: "first" });
      const second = await signupUser(ctx, { displayName: "second" });
      const { roomId } = await createRoom(ctx, owner.token, [first.userId]);
      await respondToInvite(ctx.app, first.token, roomId, "accept");
      await request(ctx.app)
        .post(`/chatrooms/${roomId}/invite`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ participantIds: [second.userId] })
        .expect(200);
      await respondToInvite(ctx.app, second.token, roomId, "accept");
      return { owner, first, second, roomId };
    }

    it("ownership passes to the longest-standing accepted participant", async () => {
      const { owner, first, second, roomId } = await roomWithTwoMembers();

      await leave(owner.token, roomId);

      expect(await roleOf(roomId, first.userId)).toBe("owner");
      expect(await roleOf(roomId, second.userId)).toBe("member");
      const room = await ctx.prisma.chatRoom.findUnique({
        where: { id: roomId },
      });
      expect(room?.createdByUserId).toBe(first.userId);
      expect(room?.isActive).toBe(true);
    });

    it("the new owner can do what only the owner can", async () => {
      const { owner, first, second, roomId } = await roomWithTwoMembers();
      await leave(owner.token, roomId);

      await request(ctx.app)
        .patch(`/chatrooms/${roomId}`)
        .set("Authorization", `Bearer ${first.token}`)
        .send({ name: "New name" })
        .expect(200);
      await request(ctx.app)
        .patch(`/chatrooms/${roomId}`)
        .set("Authorization", `Bearer ${second.token}`)
        .send({ name: "Not allowed" })
        .expect(403);
    });

    it("among people invited together, whoever accepted first takes over", async () => {
      const owner = await signupUser(ctx, { displayName: "owner" });
      const early = await signupUser(ctx, { displayName: "early" });
      const late = await signupUser(ctx, { displayName: "late" });
      // Invited in one go, so their invites carry the same time; late is
      // listed first.
      const { roomId } = await createRoom(ctx, owner.token, [
        late.userId,
        early.userId,
      ]);
      await respondToInvite(ctx.app, early.token, roomId, "accept");
      await respondToInvite(ctx.app, late.token, roomId, "accept");
      // early accepted a day before late.
      const participant = await ctx.prisma.chatRoomParticipant.findFirstOrThrow(
        { where: { chatRoomId: roomId, userId: early.userId } },
      );
      expect(participant.acceptedAt).not.toBeNull();
      await ctx.prisma.chatRoomParticipant.update({
        where: { id: participant.id },
        data: {
          acceptedAt: new Date(participant.acceptedAt!.getTime() - 86_400_000),
        },
      });

      await leave(owner.token, roomId);

      expect(await roleOf(roomId, early.userId)).toBe("owner");
      expect(await roleOf(roomId, late.userId)).toBe("member");
    });

    it("someone who left and came back counts from when they accepted again", async () => {
      const { owner, first, second, roomId } = await roomWithTwoMembers();
      await leave(first.token, roomId);
      await request(ctx.app)
        .post(`/chatrooms/${roomId}/invite`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ participantIds: [first.userId] })
        .expect(200);
      const reinvited = await ctx.prisma.chatRoomParticipant.findFirst({
        where: { chatRoomId: roomId, userId: first.userId },
      });
      expect(reinvited?.acceptedAt).toBeNull();
      await respondToInvite(ctx.app, first.token, roomId, "accept");

      await leave(owner.token, roomId);

      expect(await roleOf(roomId, second.userId)).toBe("owner");
      expect(await roleOf(roomId, first.userId)).toBe("member");
    });

    it("someone still invited doesn't take over", async () => {
      const owner = await signupUser(ctx, { displayName: "owner" });
      const member = await signupUser(ctx, { displayName: "member" });
      const pending = await signupUser(ctx, { displayName: "pending" });
      // pending is invited first, but hasn't accepted.
      const { roomId } = await createRoom(ctx, owner.token, [pending.userId]);
      await request(ctx.app)
        .post(`/chatrooms/${roomId}/invite`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ participantIds: [member.userId] })
        .expect(200);
      await respondToInvite(ctx.app, member.token, roomId, "accept");

      await leave(owner.token, roomId);

      expect(await roleOf(roomId, member.userId)).toBe("owner");
      expect(await roleOf(roomId, pending.userId)).toBe("member");
    });

    it("with nobody else accepted, nobody takes over and the room closes", async () => {
      const owner = await signupUser(ctx, { displayName: "owner" });
      const pending = await signupUser(ctx, { displayName: "pending" });
      const { roomId } = await createRoom(ctx, owner.token, [pending.userId]);

      await leave(owner.token, roomId);

      expect(await roleOf(roomId, pending.userId)).toBe("member");
      const room = await ctx.prisma.chatRoom.findUnique({
        where: { id: roomId },
      });
      expect(room?.isActive).toBe(false);
    });
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
