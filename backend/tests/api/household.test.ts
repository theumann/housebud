import request from "supertest";
import { resetDb } from "../helpers/resetDb";
import type { TestContext } from "../helpers/testFactory";
import {
  signupUser,
  createHousehold,
  inviteToHousehold,
  joinHouseholdByCode,
} from "../helpers/testFactory";
import { getTestContext } from "../helpers/testContext";
import { beforeAll, afterEach, afterAll, describe, it, expect } from "vitest";

let ctx: TestContext;

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe.sequential("Households", () => {
  beforeAll(() => {
    ctx = getTestContext();
  });
  afterEach(async () => {
    await resetDb(ctx.prisma);
  });
  afterAll(async () => {
    await ctx.prisma.$disconnect();
  });

  it("creator becomes owner and gets default settings", async () => {
    const owner = await signupUser(ctx);
    const house = await createHousehold(ctx, owner.token, "Maple St");

    expect(house.name).toBe("Maple St");
    expect(house.joinCode).toMatch(/^[A-Z2-9]{6}$/);
    expect(house.members).toHaveLength(1);
    expect(house.members[0].role).toBe("owner");
    expect(house.settings).toMatchObject({
      choresEnabled: true,
      shoppingEnabled: true,
      expensesEnabled: false,
      calendarEnabled: false,
    });
  });

  it("lists only households the user belongs to", async () => {
    const a = await signupUser(ctx);
    const b = await signupUser(ctx);
    await createHousehold(ctx, a.token, "A House");

    const res = await request(ctx.app).get("/households").set(auth(b.token));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("hides a household from non-members with 404", async () => {
    const owner = await signupUser(ctx);
    const stranger = await signupUser(ctx);
    const house = await createHousehold(ctx, owner.token);

    const res = await request(ctx.app)
      .get(`/households/${house.id}`)
      .set(auth(stranger.token));
    expect(res.status).toBe(404);
  });

  it("join by code adds the user as a member", async () => {
    const owner = await signupUser(ctx);
    const joiner = await signupUser(ctx);
    const house = await createHousehold(ctx, owner.token);

    const joined = await joinHouseholdByCode(ctx, joiner.token, house.joinCode);
    expect(joined.id).toBe(house.id);
    expect(joined.myRole).toBe("member");
    expect(joined.members).toHaveLength(2);
  });

  it("rejects an unknown join code", async () => {
    const user = await signupUser(ctx);
    const res = await request(ctx.app)
      .post("/households/join")
      .set(auth(user.token))
      .send({ joinCode: "ZZZZZZ" });
    expect(res.status).toBe(404);
  });

  it("email invite can be accepted by token", async () => {
    const owner = await signupUser(ctx);
    const invitee = await signupUser(ctx);
    const house = await createHousehold(ctx, owner.token);

    await inviteToHousehold(ctx, owner.token, house.id, invitee.body.email);

    const invite = await ctx.prisma.householdInvite.findFirst({
      where: { householdId: house.id },
    });
    expect(invite).toBeTruthy();

    const res = await request(ctx.app)
      .post("/households/invites/accept")
      .set(auth(invitee.token))
      .send({ token: invite!.token });

    expect(res.status).toBe(200);
    expect(res.body.members).toHaveLength(2);

    const used = await ctx.prisma.householdInvite.findUnique({
      where: { id: invite!.id },
    });
    expect(used!.acceptedAt).not.toBeNull();
  });

  it("rejects an expired invite", async () => {
    const owner = await signupUser(ctx);
    const invitee = await signupUser(ctx);
    const house = await createHousehold(ctx, owner.token);
    await inviteToHousehold(ctx, owner.token, house.id, invitee.body.email);

    const invite = await ctx.prisma.householdInvite.findFirst({
      where: { householdId: house.id },
    });
    await ctx.prisma.householdInvite.update({
      where: { id: invite!.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await request(ctx.app)
      .post("/households/invites/accept")
      .set(auth(invitee.token))
      .send({ token: invite!.token });
    expect(res.status).toBe(400);
  });

  it("rejects reusing an accepted invite", async () => {
    const owner = await signupUser(ctx);
    const invitee = await signupUser(ctx);
    const other = await signupUser(ctx);
    const house = await createHousehold(ctx, owner.token);
    await inviteToHousehold(ctx, owner.token, house.id, invitee.body.email);

    const invite = await ctx.prisma.householdInvite.findFirst({
      where: { householdId: house.id },
    });

    const first = await request(ctx.app)
      .post("/households/invites/accept")
      .set(auth(invitee.token))
      .send({ token: invite!.token });
    expect(first.status).toBe(200);

    const second = await request(ctx.app)
      .post("/households/invites/accept")
      .set(auth(other.token))
      .send({ token: invite!.token });
    expect(second.status).toBe(400);
  });

  it("only the owner can invite or change settings", async () => {
    const owner = await signupUser(ctx);
    const member = await signupUser(ctx);
    const house = await createHousehold(ctx, owner.token);
    await joinHouseholdByCode(ctx, member.token, house.joinCode);

    const invite = await request(ctx.app)
      .post(`/households/${house.id}/invites`)
      .set(auth(member.token))
      .send({ email: "someone@example.com" });
    expect(invite.status).toBe(403);

    const settings = await request(ctx.app)
      .patch(`/households/${house.id}/settings`)
      .set(auth(member.token))
      .send({ expensesEnabled: true });
    expect(settings.status).toBe(403);
  });

  it("owner can toggle modules on and off", async () => {
    const owner = await signupUser(ctx);
    const house = await createHousehold(ctx, owner.token);

    const res = await request(ctx.app)
      .patch(`/households/${house.id}/settings`)
      .set(auth(owner.token))
      .send({ expensesEnabled: true, choresEnabled: false });

    expect(res.status).toBe(200);
    expect(res.body.expensesEnabled).toBe(true);
    expect(res.body.choresEnabled).toBe(false);
    expect(res.body.shoppingEnabled).toBe(true);
  });

  it("regenerating the join code invalidates the old one", async () => {
    const owner = await signupUser(ctx);
    const joiner = await signupUser(ctx);
    const house = await createHousehold(ctx, owner.token);

    const res = await request(ctx.app)
      .post(`/households/${house.id}/join-code`)
      .set(auth(owner.token));
    expect(res.status).toBe(200);
    expect(res.body.joinCode).not.toBe(house.joinCode);

    const stale = await request(ctx.app)
      .post("/households/join")
      .set(auth(joiner.token))
      .send({ joinCode: house.joinCode });
    expect(stale.status).toBe(404);
  });

  it("a sole owner cannot leave, but can after transferring ownership", async () => {
    const owner = await signupUser(ctx);
    const member = await signupUser(ctx);
    const house = await createHousehold(ctx, owner.token);
    await joinHouseholdByCode(ctx, member.token, house.joinCode);

    const blocked = await request(ctx.app)
      .post(`/households/${house.id}/leave`)
      .set(auth(owner.token));
    expect(blocked.status).toBe(400);

    const transfer = await request(ctx.app)
      .post(`/households/${house.id}/members/${member.userId}/owner`)
      .set(auth(owner.token));
    expect(transfer.status).toBe(200);

    const left = await request(ctx.app)
      .post(`/households/${house.id}/leave`)
      .set(auth(owner.token));
    expect(left.status).toBe(200);

    const gone = await request(ctx.app)
      .get(`/households/${house.id}`)
      .set(auth(owner.token));
    expect(gone.status).toBe(404);
  });

  it("owner cannot transfer ownership to themselves", async () => {
    const owner = await signupUser(ctx);
    const house = await createHousehold(ctx, owner.token);

    const res = await request(ctx.app)
      .post(`/households/${house.id}/members/${owner.userId}/owner`)
      .set(auth(owner.token));
    expect(res.status).toBe(400);

    const after = await request(ctx.app)
      .get(`/households/${house.id}`)
      .set(auth(owner.token));
    expect(after.body.myRole).toBe("owner");
  });

  it("owner can remove a member, who then loses access", async () => {
    const owner = await signupUser(ctx);
    const member = await signupUser(ctx);
    const house = await createHousehold(ctx, owner.token);
    await joinHouseholdByCode(ctx, member.token, house.joinCode);

    const res = await request(ctx.app)
      .delete(`/households/${house.id}/members/${member.userId}`)
      .set(auth(owner.token));
    expect(res.status).toBe(200);

    const after = await request(ctx.app)
      .get(`/households/${house.id}`)
      .set(auth(member.token));
    expect(after.status).toBe(404);
  });

  it("rejects inviting someone who is already an active member", async () => {
    const owner = await signupUser(ctx);
    const member = await signupUser(ctx);
    const house = await createHousehold(ctx, owner.token);
    await joinHouseholdByCode(ctx, member.token, house.joinCode);

    const res = await request(ctx.app)
      .post(`/households/${house.id}/invites`)
      .set(auth(owner.token))
      .send({ email: member.body.email });
    expect(res.status).toBe(409);
  });

  it("only the owner can rename the household", async () => {
    const owner = await signupUser(ctx);
    const member = await signupUser(ctx);
    const house = await createHousehold(ctx, owner.token, "Old Name");
    await joinHouseholdByCode(ctx, member.token, house.joinCode);

    const denied = await request(ctx.app)
      .patch(`/households/${house.id}`)
      .set(auth(member.token))
      .send({ name: "Member Name" });
    expect(denied.status).toBe(403);

    const res = await request(ctx.app)
      .patch(`/households/${house.id}`)
      .set(auth(owner.token))
      .send({ name: "  New Name  " });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("New Name");
  });

  it("lists only pending invites, and only to the owner", async () => {
    const owner = await signupUser(ctx);
    const member = await signupUser(ctx);
    const acceptedInvitee = await signupUser(ctx);
    const house = await createHousehold(ctx, owner.token);
    await joinHouseholdByCode(ctx, member.token, house.joinCode);

    await inviteToHousehold(ctx, owner.token, house.id, "pending@example.com");
    await inviteToHousehold(ctx, owner.token, house.id, "expired@example.com");
    await inviteToHousehold(
      ctx,
      owner.token,
      house.id,
      acceptedInvitee.body.email,
    );

    await ctx.prisma.householdInvite.updateMany({
      where: { email: "expired@example.com" },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const toAccept = await ctx.prisma.householdInvite.findFirst({
      where: { email: acceptedInvitee.body.email },
    });
    await request(ctx.app)
      .post("/households/invites/accept")
      .set(auth(acceptedInvitee.token))
      .send({ token: toAccept!.token })
      .expect(200);

    const denied = await request(ctx.app)
      .get(`/households/${house.id}/invites`)
      .set(auth(member.token));
    expect(denied.status).toBe(403);

    const res = await request(ctx.app)
      .get(`/households/${house.id}/invites`)
      .set(auth(owner.token));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].email).toBe("pending@example.com");
    expect(res.body[0]).not.toHaveProperty("token");
  });

  it("owner can revoke an invite, which can then no longer be accepted", async () => {
    const owner = await signupUser(ctx);
    const invitee = await signupUser(ctx);
    const house = await createHousehold(ctx, owner.token);
    const created = await inviteToHousehold(
      ctx,
      owner.token,
      house.id,
      invitee.body.email,
    );
    const invite = await ctx.prisma.householdInvite.findUnique({
      where: { id: created.id },
    });

    const res = await request(ctx.app)
      .delete(`/households/${house.id}/invites/${created.id}`)
      .set(auth(owner.token));
    expect(res.status).toBe(200);

    const accept = await request(ctx.app)
      .post("/households/invites/accept")
      .set(auth(invitee.token))
      .send({ token: invite!.token });
    expect(accept.status).toBe(400);
  });

  it("cannot revoke another household's invite", async () => {
    const ownerA = await signupUser(ctx);
    const ownerB = await signupUser(ctx);
    const houseA = await createHousehold(ctx, ownerA.token);
    const houseB = await createHousehold(ctx, ownerB.token);
    const inviteB = await inviteToHousehold(
      ctx,
      ownerB.token,
      houseB.id,
      "someone@example.com",
    );

    const res = await request(ctx.app)
      .delete(`/households/${houseA.id}/invites/${inviteB.id}`)
      .set(auth(ownerA.token));
    expect(res.status).toBe(404);

    const stillThere = await ctx.prisma.householdInvite.findUnique({
      where: { id: inviteB.id },
    });
    expect(stillThere).not.toBeNull();
  });

  it("rejects a second pending invite to the same email", async () => {
    const owner = await signupUser(ctx);
    const house = await createHousehold(ctx, owner.token);
    await inviteToHousehold(ctx, owner.token, house.id, "twice@example.com");

    const res = await request(ctx.app)
      .post(`/households/${house.id}/invites`)
      .set(auth(owner.token))
      .send({ email: "twice@example.com" });
    expect(res.status).toBe(409);
  });

  it("lists my pending invites with household and inviter", async () => {
    const owner = await signupUser(ctx);
    const invitee = await signupUser(ctx);
    const pendingHouse = await createHousehold(ctx, owner.token, "Pending");
    const expiredHouse = await createHousehold(ctx, owner.token, "Expired");
    const declinedHouse = await createHousehold(ctx, owner.token, "Declined");
    const email = invitee.body.email;

    await inviteToHousehold(ctx, owner.token, pendingHouse.id, email);
    await inviteToHousehold(ctx, owner.token, pendingHouse.id, "x@example.com");
    const expired = await inviteToHousehold(
      ctx,
      owner.token,
      expiredHouse.id,
      email,
    );
    const declined = await inviteToHousehold(
      ctx,
      owner.token,
      declinedHouse.id,
      email,
    );

    await ctx.prisma.householdInvite.update({
      where: { id: expired.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await request(ctx.app)
      .post(`/households/invites/${declined.id}/decline`)
      .set(auth(invitee.token))
      .expect(200);

    const res = await request(ctx.app)
      .get("/households/invites/mine")
      .set(auth(invitee.token));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].household).toEqual({
      id: pendingHouse.id,
      name: "Pending",
    });
    expect(res.body[0].invitedByUser.id).toBe(owner.userId);
    expect(res.body[0]).not.toHaveProperty("token");
  });

  it("hides invites to households I already belong to", async () => {
    const owner = await signupUser(ctx);
    const member = await signupUser(ctx);
    const house = await createHousehold(ctx, owner.token);
    await inviteToHousehold(ctx, owner.token, house.id, member.body.email);
    await joinHouseholdByCode(ctx, member.token, house.joinCode);

    const res = await request(ctx.app)
      .get("/households/invites/mine")
      .set(auth(member.token));
    expect(res.body).toEqual([]);
  });

  it("accepting an invite by id joins the household", async () => {
    const owner = await signupUser(ctx);
    const invitee = await signupUser(ctx);
    const house = await createHousehold(ctx, owner.token);
    const invite = await inviteToHousehold(
      ctx,
      owner.token,
      house.id,
      invitee.body.email,
    );

    const res = await request(ctx.app)
      .post(`/households/invites/${invite.id}/accept`)
      .set(auth(invitee.token));
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(house.id);
    expect(res.body.myRole).toBe("member");

    const again = await request(ctx.app)
      .post(`/households/invites/${invite.id}/accept`)
      .set(auth(invitee.token));
    expect(again.status).toBe(400);

    const mine = await request(ctx.app)
      .get("/households/invites/mine")
      .set(auth(invitee.token));
    expect(mine.body).toEqual([]);
  });

  it("cannot accept or decline someone else's invite", async () => {
    const owner = await signupUser(ctx);
    const invitee = await signupUser(ctx);
    const other = await signupUser(ctx);
    const house = await createHousehold(ctx, owner.token);
    const invite = await inviteToHousehold(
      ctx,
      owner.token,
      house.id,
      invitee.body.email,
    );

    const accept = await request(ctx.app)
      .post(`/households/invites/${invite.id}/accept`)
      .set(auth(other.token));
    expect(accept.status).toBe(404);

    const decline = await request(ctx.app)
      .post(`/households/invites/${invite.id}/decline`)
      .set(auth(other.token));
    expect(decline.status).toBe(404);

    const members = await ctx.prisma.householdMember.count({
      where: { householdId: house.id },
    });
    expect(members).toBe(1);
  });

  it("declining an invite closes it and allows a fresh invite", async () => {
    const owner = await signupUser(ctx);
    const invitee = await signupUser(ctx);
    const house = await createHousehold(ctx, owner.token);
    const invite = await inviteToHousehold(
      ctx,
      owner.token,
      house.id,
      invitee.body.email,
    );
    const stored = await ctx.prisma.householdInvite.findUnique({
      where: { id: invite.id },
    });

    const res = await request(ctx.app)
      .post(`/households/invites/${invite.id}/decline`)
      .set(auth(invitee.token));
    expect(res.status).toBe(200);

    const byToken = await request(ctx.app)
      .post("/households/invites/accept")
      .set(auth(invitee.token))
      .send({ token: stored!.token });
    expect(byToken.status).toBe(400);

    const ownerView = await request(ctx.app)
      .get(`/households/${house.id}/invites`)
      .set(auth(owner.token));
    expect(ownerView.body).toEqual([]);

    await inviteToHousehold(ctx, owner.token, house.id, invitee.body.email);
  });

  it("requires authentication", async () => {
    const res = await request(ctx.app).get("/households");
    expect(res.status).toBe(401);
  });
});
