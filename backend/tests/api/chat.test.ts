import request from "supertest";
import { resetDb } from "../helpers/resetDb";
import type { TestContext } from "../helpers/testFactory";
import {
  signupUser,
  createRoom,
  listRooms,
  sendMessage,
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
});
