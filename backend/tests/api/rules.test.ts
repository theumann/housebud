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

// An owner and two roommates; house rules are on by default.
async function household() {
  const owner = await signupUser(ctx);
  const sam = await signupUser(ctx);
  const alex = await signupUser(ctx);
  const house = await createHousehold(ctx, owner.token);
  await joinHouseholdByCode(ctx, sam.token, house.joinCode);
  await joinHouseholdByCode(ctx, alex.token, house.joinCode);
  return { owner, sam, alex, house, base: `/households/${house.id}/rules` };
}

async function propose(
  token: string,
  base: string,
  body: Record<string, unknown>,
) {
  const res = await request(ctx.app)
    .post(`${base}/proposals`)
    .set(auth(token))
    .send(body);
  expect(res.status).toBe(201);
  return res.body as { id: string; status: string; ruleId: string | null };
}

function answer(
  token: string,
  base: string,
  proposalId: string,
  body: Record<string, unknown>,
) {
  return request(ctx.app)
    .post(`${base}/proposals/${proposalId}/vote`)
    .set(auth(token))
    .send(body);
}

async function overview(token: string, base: string) {
  const res = await request(ctx.app).get(base).set(auth(token));
  expect(res.status).toBe(200);
  return res.body;
}

async function pendingRules(token: string, householdId: string) {
  const res = await request(ctx.app).get("/households").set(auth(token));
  expect(res.status).toBe(200);
  return res.body.find((h: any) => h.id === householdId).pendingRules;
}

// Proposes a rule and has the other two agree.
async function adoptRule(
  h: Awaited<ReturnType<typeof household>>,
  title: string,
) {
  const p = await propose(h.owner.token, h.base, { kind: "add", title });
  await answer(h.sam.token, h.base, p.id, { agree: true }).expect(200);
  const res = await answer(h.alex.token, h.base, p.id, { agree: true });
  expect(res.body.status).toBe("adopted");
  return res.body.ruleId as string;
}

describe.sequential("House rules", () => {
  beforeAll(() => {
    ctx = getTestContext();
  });
  afterEach(async () => {
    await resetDb(ctx.prisma);
  });
  afterAll(async () => {
    await ctx.prisma.$disconnect();
  });

  it("adopts a proposal straight away in a one-person household", async () => {
    const owner = await signupUser(ctx);
    const house = await createHousehold(ctx, owner.token);
    const base = `/households/${house.id}/rules`;

    const p = await propose(owner.token, base, {
      kind: "add",
      title: "Quiet hours after 11pm",
      details: "Weeknights",
    });
    expect(p.status).toBe("adopted");

    const body = await overview(owner.token, base);
    expect(body.rules).toEqual([
      expect.objectContaining({
        title: "Quiet hours after 11pm",
        details: "Weeknights",
      }),
    ]);
    expect(body.proposals).toHaveLength(0);
    expect(body.history[0].status).toBe("adopted");
  });

  it("adopts a rule once everyone agrees", async () => {
    const h = await household();
    const p = await propose(h.sam.token, h.base, {
      kind: "add",
      title: "Label your food",
      reason: "My yogurt keeps disappearing",
    });
    expect(p.status).toBe("open");

    let body = await overview(h.owner.token, h.base);
    expect(body.rules).toHaveLength(0);
    expect(body.proposals[0]).toMatchObject({
      title: "Label your food",
      reason: "My yogurt keeps disappearing",
      myAnswer: false,
      canWithdraw: true,
    });
    expect(body.proposals[0].agreed.map((u: any) => u.id)).toEqual([
      h.sam.userId,
    ]);
    expect(body.proposals[0].waitingOn.map((u: any) => u.id).sort()).toEqual(
      [h.owner.userId, h.alex.userId].sort(),
    );
    expect(await pendingRules(h.owner.token, h.house.id)).toBe(1);
    expect(await pendingRules(h.sam.token, h.house.id)).toBe(0);

    const first = await answer(h.owner.token, h.base, p.id, { agree: true });
    expect(first.body.status).toBe("open");
    const last = await answer(h.alex.token, h.base, p.id, { agree: true });
    expect(last.body.status).toBe("adopted");

    body = await overview(h.alex.token, h.base);
    expect(body.rules.map((r: any) => r.title)).toEqual(["Label your food"]);
    expect(body.proposals).toHaveLength(0);
    expect(await pendingRules(h.owner.token, h.house.id)).toBe(0);
  });

  it("changes and removes rules through proposals", async () => {
    const h = await household();
    const ruleId = await adoptRule(h, "Quiet hours after 11pm");

    const change = await propose(h.alex.token, h.base, {
      kind: "change",
      ruleId,
      title: "Quiet hours after midnight on weekends",
    });
    let body = await overview(h.owner.token, h.base);
    expect(body.proposals[0]).toMatchObject({
      kind: "change",
      rule: { id: ruleId, title: "Quiet hours after 11pm" },
    });
    await answer(h.owner.token, h.base, change.id, { agree: true });
    await answer(h.sam.token, h.base, change.id, { agree: true });
    body = await overview(h.owner.token, h.base);
    expect(body.rules).toEqual([
      expect.objectContaining({
        id: ruleId,
        title: "Quiet hours after midnight on weekends",
      }),
    ]);

    const remove = await propose(h.sam.token, h.base, {
      kind: "remove",
      ruleId,
    });
    await answer(h.owner.token, h.base, remove.id, { agree: true });
    await answer(h.alex.token, h.base, remove.id, { agree: true });
    body = await overview(h.owner.token, h.base);
    expect(body.rules).toHaveLength(0);
    // The history keeps the removed rule's text.
    expect(body.history[0]).toMatchObject({
      kind: "remove",
      status: "adopted",
      title: "Quiet hours after midnight on weekends",
    });
  });

  it("rejects a change that changes nothing", async () => {
    const h = await household();
    const ruleId = await adoptRule(h, "No smoking indoors");
    const res = await request(ctx.app)
      .post(`${h.base}/proposals`)
      .set(auth(h.sam.token))
      .send({ kind: "change", ruleId, title: "No smoking indoors" });
    expect(res.status).toBe(400);
  });

  it("one no declines a proposal", async () => {
    const h = await household();
    const p = await propose(h.owner.token, h.base, {
      kind: "add",
      title: "No guests on weeknights",
    });
    await answer(h.sam.token, h.base, p.id, { agree: true }).expect(200);
    const no = await answer(h.alex.token, h.base, p.id, {
      agree: false,
      reason: "My partner visits on Tuesdays",
    });
    expect(no.body.status).toBe("declined");

    const body = await overview(h.owner.token, h.base);
    expect(body.rules).toHaveLength(0);
    expect(body.proposals).toHaveLength(0);
    expect(body.history[0]).toMatchObject({
      status: "declined",
      declinedBy: {
        user: expect.objectContaining({ id: h.alex.userId }),
        reason: "My partner visits on Tuesdays",
      },
    });

    // Decided: no more answers.
    const late = await answer(h.owner.token, h.base, p.id, { agree: true });
    expect(late.status).toBe(409);
  });

  it("allows one answer per person and one open proposal per rule", async () => {
    const h = await household();
    const ruleId = await adoptRule(h, "Dishes done the same day");

    const p = await propose(h.sam.token, h.base, { kind: "remove", ruleId });
    const twice = await answer(h.sam.token, h.base, p.id, { agree: true });
    expect(twice.status).toBe(409);

    const second = await request(ctx.app)
      .post(`${h.base}/proposals`)
      .set(auth(h.alex.token))
      .send({ kind: "change", ruleId, title: "Dishes done by morning" });
    expect(second.status).toBe(409);
  });

  it("keeps one answer when the same person answers twice at once", async () => {
    const h = await household();
    const p = await propose(h.owner.token, h.base, {
      kind: "add",
      title: "Lights off when you leave",
    });

    const results = await Promise.all([
      answer(h.sam.token, h.base, p.id, { agree: true }),
      answer(h.sam.token, h.base, p.id, { agree: false }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);

    const view = await overview(h.alex.token, h.base);
    // Whichever answer landed first counts: still open with Sam's agree, or
    // declined.
    const open = view.proposals.find((x: any) => x.id === p.id);
    if (open) {
      expect(open.agreed).toHaveLength(2);
    } else {
      expect(view.history[0]).toMatchObject({ id: p.id, status: "declined" });
    }
  });

  it("lets the proposer or the owner withdraw, nobody else", async () => {
    const h = await household();
    const p1 = await propose(h.sam.token, h.base, {
      kind: "add",
      title: "Shared streaming account",
    });
    const forbidden = await request(ctx.app)
      .post(`${h.base}/proposals/${p1.id}/withdraw`)
      .set(auth(h.alex.token));
    expect(forbidden.status).toBe(403);

    const bySam = await request(ctx.app)
      .post(`${h.base}/proposals/${p1.id}/withdraw`)
      .set(auth(h.sam.token));
    expect(bySam.body.status).toBe("withdrawn");

    const p2 = await propose(h.alex.token, h.base, {
      kind: "add",
      title: "Thermostat at 20°C",
    });
    const byOwner = await request(ctx.app)
      .post(`${h.base}/proposals/${p2.id}/withdraw`)
      .set(auth(h.owner.token));
    expect(byOwner.body.status).toBe("withdrawn");
  });

  it("adopts a proposal that was only waiting on someone who left", async () => {
    const h = await household();
    const p = await propose(h.owner.token, h.base, {
      kind: "add",
      title: "Bins out on Sunday night",
    });
    await answer(h.sam.token, h.base, p.id, { agree: true });

    await request(ctx.app)
      .post(`/households/${h.house.id}/leave`)
      .set(auth(h.alex.token))
      .expect(200);

    const body = await overview(h.owner.token, h.base);
    expect(body.rules.map((r: any) => r.title)).toEqual([
      "Bins out on Sunday night",
    ]);
  });

  it("asks newcomers to agree to the rules, again after rejoining", async () => {
    const h = await household();
    await adoptRule(h, "Quiet hours after 11pm");

    // Founding members voted on it; nobody needs to agree separately.
    expect((await overview(h.owner.token, h.base)).needsMyAgreement).toBe(
      false,
    );

    const newbie = await signupUser(ctx);
    await joinHouseholdByCode(ctx, newbie.token, h.house.joinCode);
    expect((await overview(newbie.token, h.base)).needsMyAgreement).toBe(true);
    expect(await pendingRules(newbie.token, h.house.id)).toBe(1);
    expect(
      (await overview(h.owner.token, h.base)).notAgreed.map((u: any) => u.id),
    ).toEqual([newbie.userId]);

    await request(ctx.app)
      .post(`${h.base}/agree`)
      .set(auth(newbie.token))
      .expect(204);
    expect((await overview(newbie.token, h.base)).needsMyAgreement).toBe(false);
    expect(await pendingRules(newbie.token, h.house.id)).toBe(0);
    expect((await overview(h.owner.token, h.base)).notAgreed).toHaveLength(0);

    await request(ctx.app)
      .post(`/households/${h.house.id}/leave`)
      .set(auth(newbie.token))
      .expect(200);
    await joinHouseholdByCode(ctx, newbie.token, h.house.joinCode);
    expect((await overview(newbie.token, h.base)).needsMyAgreement).toBe(true);
  });

  it("makes a newcomer a voter on proposals still open", async () => {
    const h = await household();
    const p = await propose(h.owner.token, h.base, {
      kind: "add",
      title: "Clean the bathroom weekly",
    });
    await answer(h.sam.token, h.base, p.id, { agree: true });

    const newbie = await signupUser(ctx);
    await joinHouseholdByCode(ctx, newbie.token, h.house.joinCode);
    expect(await pendingRules(newbie.token, h.house.id)).toBe(1);

    const alex = await answer(h.alex.token, h.base, p.id, { agree: true });
    expect(alex.body.status).toBe("open");
    const last = await answer(newbie.token, h.base, p.id, { agree: true });
    expect(last.body.status).toBe("adopted");
  });

  it("is 404 for non-members and while the module is off", async () => {
    const h = await household();
    const outsider = await signupUser(ctx);
    await request(ctx.app).get(h.base).set(auth(outsider.token)).expect(404);

    await request(ctx.app)
      .patch(`/households/${h.house.id}/settings`)
      .set(auth(h.owner.token))
      .send({ rulesEnabled: false })
      .expect(200);
    await request(ctx.app).get(h.base).set(auth(h.sam.token)).expect(404);
    expect(await pendingRules(h.sam.token, h.house.id)).toBe(0);
  });

  it("404s a proposal from another household", async () => {
    const h = await household();
    const other = await signupUser(ctx);
    const otherHouse = await createHousehold(ctx, other.token);
    const p = await propose(other.token, `/households/${otherHouse.id}/rules`, {
      kind: "add",
      title: "Other house rule",
    });
    // A one-person household adopts at once; withdraw needs an open one.
    expect(p.status).toBe("adopted");
    const res = await request(ctx.app)
      .post(`${h.base}/proposals`)
      .set(auth(h.owner.token))
      .send({ kind: "remove", ruleId: p.ruleId });
    expect(res.status).toBe(404);
  });
});
