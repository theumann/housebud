import request from "supertest";
import { resetDb } from "../helpers/resetDb";
import type { TestContext } from "../helpers/testFactory";
import {
  signupUser,
  createHousehold,
  joinHouseholdByCode,
} from "../helpers/testFactory";
import { getTestContext } from "../helpers/testContext";
import { nextDueDate } from "../../src/modules/chores/chores.service";
import { beforeAll, afterEach, afterAll, describe, it, expect } from "vitest";

let ctx: TestContext;

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const day = (s: string) => new Date(`${s}T00:00:00.000Z`);

async function householdOf(size: number) {
  const users = [];
  for (let i = 0; i < size; i++) users.push(await signupUser(ctx));
  const house = await createHousehold(ctx, users[0].token);
  for (const u of users.slice(1)) {
    await joinHouseholdByCode(ctx, u.token, house.joinCode);
  }
  return { users, house, base: `/households/${house.id}/chores` };
}

const weekly = { every: 1, unit: "week" } as const;

async function createChore(
  token: string,
  base: string,
  body: {
    name?: string;
    repeat?: { every: number; unit: string } | null;
    dueDate?: string;
    rotation?: string[];
  },
) {
  const res = await request(ctx.app)
    .post(base)
    .set(auth(token))
    .send({ name: "Trash", repeat: weekly, dueDate: "2026-10-05", ...body });
  expect(res.status).toBe(201);
  return res.body;
}

async function complete(
  token: string,
  base: string,
  choreId: string,
  completedOn: string,
) {
  const res = await request(ctx.app)
    .post(`${base}/${choreId}/complete`)
    .set(auth(token))
    .send({ completedOn });
  expect(res.status).toBe(200);
  return res.body.chore;
}

async function history(token: string, base: string) {
  const res = await request(ctx.app)
    .get(`${base}/completions`)
    .set(auth(token));
  expect(res.status).toBe(200);
  return res.body;
}

describe("nextDueDate", () => {
  const next = (
    due: string,
    repeat: { every: number; unit: "day" | "week" | "month" | "quarter" },
    completedOn: string,
    anchorDay = day(due).getUTCDate(),
  ) => nextDueDate(day(due), repeat, anchorDay, day(completedOn));

  it("keeps the schedule when done on time, late or early", () => {
    expect(next("2026-10-05", weekly, "2026-10-05")).toEqual(day("2026-10-12"));
    expect(next("2026-10-05", weekly, "2026-10-07")).toEqual(day("2026-10-12"));
    expect(next("2026-10-10", weekly, "2026-10-08")).toEqual(day("2026-10-17"));
  });

  it("skips occurrences that were missed entirely", () => {
    expect(next("2026-10-01", weekly, "2026-10-20")).toEqual(day("2026-10-22"));
  });

  it("counts days, across month ends", () => {
    const everyOtherDay = { every: 2, unit: "day" } as const;
    expect(next("2026-10-31", everyOtherDay, "2026-10-31")).toEqual(
      day("2026-11-02"),
    );
  });

  it("monthly chores fall back to short months' last day, then return", () => {
    const monthly = { every: 1, unit: "month" } as const;
    expect(next("2026-01-31", monthly, "2026-01-31")).toEqual(
      day("2026-02-28"),
    );
    expect(next("2026-02-28", monthly, "2026-02-28", 31)).toEqual(
      day("2026-03-31"),
    );
  });

  it("quarters are three months", () => {
    const quarterly = { every: 1, unit: "quarter" } as const;
    expect(next("2026-11-30", quarterly, "2026-11-30")).toEqual(
      day("2027-02-28"),
    );
    expect(next("2027-02-28", quarterly, "2027-02-28", 30)).toEqual(
      day("2027-05-30"),
    );
  });
});

describe.sequential("Chores", () => {
  beforeAll(() => {
    ctx = getTestContext();
  });
  afterEach(async () => {
    await resetDb(ctx.prisma);
  });
  afterAll(async () => {
    await ctx.prisma.$disconnect();
  });

  it("a new chore is up for the first person in the rotation", async () => {
    const { users, base } = await householdOf(2);
    const [a, b] = users;

    const chore = await createChore(a.token, base, {
      rotation: [b.userId, a.userId],
    });
    expect(chore).toMatchObject({
      name: "Trash",
      repeat: weekly,
      dueDate: "2026-10-05",
      rotation: [b.userId, a.userId],
      assigneeUserId: b.userId,
    });

    const list = await request(ctx.app).get(base).set(auth(b.token));
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
  });

  it("a chore without a rotation is unassigned", async () => {
    const { users, base } = await householdOf(1);
    const chore = await createChore(users[0].token, base, {});
    expect(chore.rotation).toEqual([]);
    expect(chore.assigneeUserId).toBeNull();
  });

  it("rejects a rotation with non-members or duplicates", async () => {
    const { users, base } = await householdOf(1);
    const stranger = await signupUser(ctx);

    const withStranger = await request(ctx.app)
      .post(base)
      .set(auth(users[0].token))
      .send({
        name: "Dishes",
        repeat: { every: 1, unit: "day" },
        dueDate: "2026-10-05",
        rotation: [users[0].userId, stranger.userId],
      });
    expect(withStranger.status).toBe(400);

    const duplicate = await request(ctx.app)
      .post(base)
      .set(auth(users[0].token))
      .send({
        name: "Dishes",
        repeat: { every: 1, unit: "day" },
        dueDate: "2026-10-05",
        rotation: [users[0].userId, users[0].userId],
      });
    expect(duplicate.status).toBe(400);
  });

  it("completing moves the due date on schedule and passes the turn", async () => {
    const { users, base } = await householdOf(2);
    const [a, b] = users;
    const chore = await createChore(a.token, base, {
      rotation: [a.userId, b.userId],
    });

    const afterA = await complete(a.token, base, chore.id, "2026-10-07");
    expect(afterA).toMatchObject({
      dueDate: "2026-10-12",
      assigneeUserId: b.userId,
      rotation: [b.userId, a.userId],
    });

    const afterB = await complete(b.token, base, chore.id, "2026-10-12");
    expect(afterB).toMatchObject({
      dueDate: "2026-10-19",
      assigneeUserId: a.userId,
    });
  });

  it("the turn passes on from the assignee even if someone else did it", async () => {
    const { users, base } = await householdOf(3);
    const [a, b, c] = users;
    const chore = await createChore(a.token, base, {
      rotation: [a.userId, b.userId, c.userId],
    });

    const after = await complete(c.token, base, chore.id, "2026-10-05");
    expect(after.assigneeUserId).toBe(b.userId);

    const history = await request(ctx.app)
      .get(`${base}/completions`)
      .set(auth(a.token));
    expect(history.status).toBe(200);
    expect(history.body).toEqual([
      expect.objectContaining({
        choreId: chore.id,
        choreName: "Trash",
        doneByUserId: c.userId,
        dueDate: "2026-10-05",
        completedOn: "2026-10-05",
      }),
    ]);
  });

  it("a one-off chore disappears once done but stays in the history", async () => {
    const { users, base } = await householdOf(1);
    const chore = await createChore(users[0].token, base, {
      name: "Fix shelf",
      repeat: null,
    });

    expect(await complete(users[0].token, base, chore.id, "2026-10-05")).toBe(
      null,
    );

    const list = await request(ctx.app).get(base).set(auth(users[0].token));
    expect(list.body).toEqual([]);
    const history = await request(ctx.app)
      .get(`${base}/completions`)
      .set(auth(users[0].token));
    expect(history.body).toHaveLength(1);

    const again = await request(ctx.app)
      .post(`${base}/${chore.id}/complete`)
      .set(auth(users[0].token))
      .send({ completedOn: "2026-10-05" });
    expect(again.status).toBe(404);
  });

  it("skips members who left the household", async () => {
    const { users, house, base } = await householdOf(3);
    const [a, b, c] = users;
    const chore = await createChore(a.token, base, {
      rotation: [b.userId, c.userId, a.userId],
    });

    await request(ctx.app)
      .post(`/households/${house.id}/leave`)
      .set(auth(b.token))
      .expect(200);

    const [listed] = (await request(ctx.app).get(base).set(auth(a.token))).body;
    expect(listed.rotation).toEqual([c.userId, a.userId]);
    expect(listed.assigneeUserId).toBe(c.userId);

    const after = await complete(c.token, base, chore.id, "2026-10-05");
    expect(after.assigneeUserId).toBe(a.userId);
    const next = await complete(a.token, base, chore.id, "2026-10-12");
    expect(next.assigneeUserId).toBe(c.userId);
  });

  it("editing the rotation puts its first member up next", async () => {
    const { users, base } = await householdOf(2);
    const [a, b] = users;
    const chore = await createChore(a.token, base, {
      rotation: [a.userId, b.userId],
    });

    const res = await request(ctx.app)
      .patch(`${base}/${chore.id}`)
      .set(auth(b.token))
      .send({
        name: "Recycling",
        repeat: { every: 2, unit: "week" },
        rotation: [b.userId],
      });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      name: "Recycling",
      repeat: { every: 2, unit: "week" },
      dueDate: "2026-10-05",
      rotation: [b.userId],
      assigneeUserId: b.userId,
    });
  });

  it("any member can delete a chore", async () => {
    const { users, base } = await householdOf(2);
    const chore = await createChore(users[0].token, base, {});

    await request(ctx.app)
      .delete(`${base}/${chore.id}`)
      .set(auth(users[1].token))
      .expect(204);
    const list = await request(ctx.app).get(base).set(auth(users[0].token));
    expect(list.body).toEqual([]);
  });

  it("hides chores from non-members and from other households", async () => {
    const { users, base } = await householdOf(1);
    const stranger = await signupUser(ctx);
    const chore = await createChore(users[0].token, base, {});

    const asStranger = await request(ctx.app)
      .get(base)
      .set(auth(stranger.token));
    expect(asStranger.status).toBe(404);

    const strangerHouse = await createHousehold(ctx, stranger.token);
    const crossHousehold = await request(ctx.app)
      .delete(`/households/${strangerHouse.id}/chores/${chore.id}`)
      .set(auth(stranger.token));
    expect(crossHousehold.status).toBe(404);
  });

  it("returns 404 while the module is turned off", async () => {
    const { users, house, base } = await householdOf(1);
    await request(ctx.app)
      .patch(`/households/${house.id}/settings`)
      .set(auth(users[0].token))
      .send({ choresEnabled: false })
      .expect(200);

    const res = await request(ctx.app).get(base).set(auth(users[0].token));
    expect(res.status).toBe(404);
  });

  it("a monthly chore keeps its day of the month through short months", async () => {
    const { users, base } = await householdOf(1);
    const token = users[0].token;
    const chore = await createChore(token, base, {
      repeat: { every: 1, unit: "month" },
      dueDate: "2026-01-31",
    });
    expect(chore.repeat).toEqual({ every: 1, unit: "month" });

    const feb = await complete(token, base, chore.id, "2026-01-31");
    expect(feb.dueDate).toBe("2026-02-28");
    const mar = await complete(token, base, chore.id, "2026-02-28");
    expect(mar.dueDate).toBe("2026-03-31");
  });

  it("undo puts the due date and the turn back", async () => {
    const { users, base } = await householdOf(2);
    const [a, b] = users;
    const chore = await createChore(a.token, base, {
      rotation: [a.userId, b.userId],
    });
    await complete(a.token, base, chore.id, "2026-10-05");

    const [done] = await history(b.token, base);
    expect(done.undoable).toBe(true);
    const res = await request(ctx.app)
      .post(`${base}/completions/${done.id}/undo`)
      .set(auth(b.token));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      dueDate: "2026-10-05",
      assigneeUserId: a.userId,
    });
    expect(await history(a.token, base)).toEqual([]);
  });

  it("only a chore's latest completion can be undone", async () => {
    const { users, base } = await householdOf(1);
    const token = users[0].token;
    const chore = await createChore(token, base, {});
    await complete(token, base, chore.id, "2026-10-05");
    await complete(token, base, chore.id, "2026-10-12");

    const [latest, earlier] = await history(token, base);
    expect(latest.undoable).toBe(true);
    expect(earlier.undoable).toBe(false);

    const res = await request(ctx.app)
      .post(`${base}/completions/${earlier.id}/undo`)
      .set(auth(token));
    expect(res.status).toBe(409);
  });

  it("undoing a one-off chore puts it back on the list", async () => {
    const { users, base } = await householdOf(1);
    const token = users[0].token;
    const chore = await createChore(token, base, { repeat: null });
    await complete(token, base, chore.id, "2026-10-05");

    const [done] = await history(token, base);
    await request(ctx.app)
      .post(`${base}/completions/${done.id}/undo`)
      .set(auth(token))
      .expect(200);

    const list = await request(ctx.app).get(base).set(auth(token));
    expect(list.body.map((c: { id: string }) => c.id)).toEqual([chore.id]);
  });

  it("start shows who's on it; only they can stop it, and done clears it", async () => {
    const { users, base } = await householdOf(2);
    const [a, b] = users;
    const chore = await createChore(a.token, base, {});

    const started = await request(ctx.app)
      .post(`${base}/${chore.id}/start`)
      .set(auth(b.token));
    expect(started.status).toBe(200);
    expect(started.body.startedByUserId).toBe(b.userId);
    expect(started.body.startedAt).not.toBeNull();

    const startAgain = await request(ctx.app)
      .post(`${base}/${chore.id}/start`)
      .set(auth(a.token));
    expect(startAgain.status).toBe(409);
    const stopByOther = await request(ctx.app)
      .post(`${base}/${chore.id}/stop`)
      .set(auth(a.token));
    expect(stopByOther.status).toBe(403);

    const stopped = await request(ctx.app)
      .post(`${base}/${chore.id}/stop`)
      .set(auth(b.token));
    expect(stopped.body).toMatchObject({
      startedAt: null,
      startedByUserId: null,
    });

    await request(ctx.app)
      .post(`${base}/${chore.id}/start`)
      .set(auth(a.token))
      .expect(200);
    const done = await complete(b.token, base, chore.id, "2026-10-05");
    expect(done.startedByUserId).toBeNull();
  });
});
