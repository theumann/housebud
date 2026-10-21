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

// An owner and two roommates; the calendar is on by default.
async function household() {
  const owner = await signupUser(ctx);
  const sam = await signupUser(ctx);
  const alex = await signupUser(ctx);
  const house = await createHousehold(ctx, owner.token);
  await joinHouseholdByCode(ctx, sam.token, house.joinCode);
  await joinHouseholdByCode(ctx, alex.token, house.joinCode);
  return { owner, sam, alex, house, base: `/households/${house.id}/calendar` };
}

function addEntry(token: string, base: string, body: Record<string, unknown>) {
  return request(ctx.app).post(`${base}/events`).set(auth(token)).send(body);
}

async function add(token: string, base: string, body: Record<string, unknown>) {
  const res = await addEntry(token, base, body);
  expect(res.status).toBe(201);
  return res.body as { id: string; canEdit: boolean; userId: string | null };
}

type Occurrence = {
  date: string;
  kind: string;
  id: string;
  title: string | null;
  startTime: string | null;
  user: { id: string } | null;
  canEdit: boolean;
  overdue: boolean;
};

async function list(
  token: string,
  base: string,
  from: string,
  to: string,
  today?: string,
) {
  const res = await request(ctx.app)
    .get(base)
    .query({ from, to, ...(today && { today }) })
    .set(auth(token));
  expect(res.status).toBe(200);
  return res.body.occurrences as Occurrence[];
}

const dates = (occurrences: Occurrence[], kind?: string) =>
  occurrences.filter((o) => !kind || o.kind === kind).map((o) => o.date);

describe.sequential("Calendar", () => {
  beforeAll(() => {
    ctx = getTestContext();
  });
  afterEach(async () => {
    await resetDb(ctx.prisma);
  });
  afterAll(async () => {
    await ctx.prisma.$disconnect();
  });

  it("lists events, multi-day ones on each day, in order within a day", async () => {
    const h = await household();
    await add(h.owner.token, h.base, {
      kind: "event",
      title: "House meeting",
      startsOn: "2026-11-03",
      startTime: "19:00",
      endTime: "20:00",
    });
    await add(h.sam.token, h.base, {
      kind: "event",
      title: "Painting the hallway",
      startsOn: "2026-11-02",
      endsOn: "2026-11-04",
    });
    await add(h.alex.token, h.base, {
      kind: "away",
      startsOn: "2026-11-03",
      notes: "Back Sunday",
    });

    const all = await list(h.sam.token, h.base, "2026-11-01", "2026-11-30");
    expect(dates(all)).toEqual([
      "2026-11-02",
      "2026-11-03",
      "2026-11-03",
      "2026-11-03",
      "2026-11-04",
    ]);
    // Away first, then all-day, then timed.
    expect(
      all.filter((o) => o.date === "2026-11-03").map((o) => o.kind),
    ).toEqual(["away", "event", "event"]);
    expect(all[3]).toMatchObject({
      title: "House meeting",
      startTime: "19:00",
    });
    expect(all[1].user?.id).toBe(h.alex.userId);

    // Only the days asked for.
    const one = await list(h.sam.token, h.base, "2026-11-04", "2026-11-04");
    expect(one.map((o) => o.title)).toEqual(["Painting the hallway"]);
  });

  it("repeats events with the chore rules, and skips one occurrence", async () => {
    const h = await household();
    const weekly = await add(h.owner.token, h.base, {
      kind: "event",
      title: "Trash night",
      startsOn: "2026-11-02",
      repeat: { every: 1, unit: "week" },
    });
    await add(h.owner.token, h.base, {
      kind: "event",
      title: "Rent",
      startsOn: "2026-10-31",
      repeat: { every: 1, unit: "month" },
    });

    const nov = await list(h.sam.token, h.base, "2026-11-01", "2026-12-31");
    expect(nov.filter((o) => o.title === "Rent").map((o) => o.date)).toEqual([
      "2026-11-30",
      "2026-12-31",
    ]);
    expect(
      nov.filter((o) => o.title === "Trash night").map((o) => o.date),
    ).toHaveLength(9);

    const skip = await request(ctx.app)
      .post(`${h.base}/events/${weekly.id}/skip`)
      .set(auth(h.owner.token))
      .send({ date: "2026-11-09" });
    expect(skip.status).toBe(200);
    const after = await list(h.sam.token, h.base, "2026-11-01", "2026-11-20");
    expect(dates(after)).toEqual(["2026-11-02", "2026-11-16"]);

    const notAnOccurrence = await request(ctx.app)
      .post(`${h.base}/events/${weekly.id}/skip`)
      .set(auth(h.owner.token))
      .send({ date: "2026-11-10" });
    expect(notAnOccurrence.status).toBe(400);

    // Moving the series clears its skips.
    const moved = await request(ctx.app)
      .put(`${h.base}/events/${weekly.id}`)
      .set(auth(h.owner.token))
      .send({
        kind: "event",
        title: "Trash night",
        startsOn: "2026-11-03",
        repeat: { every: 1, unit: "week" },
      });
    expect(moved.status).toBe(200);
    expect(moved.body.skippedDates).toEqual([]);
  });

  it("rejects entries that don't add up", async () => {
    const h = await household();
    const cases = [
      {
        kind: "event",
        title: "x",
        startsOn: "2026-11-05",
        endsOn: "2026-11-04",
      },
      {
        kind: "event",
        title: "x",
        startsOn: "2026-11-05",
        endsOn: "2026-11-06",
        startTime: "10:00",
      },
      {
        kind: "event",
        title: "x",
        startsOn: "2026-11-05",
        startTime: "10:00",
        endTime: "09:00",
      },
      {
        kind: "event",
        title: "x",
        startsOn: "2026-11-05",
        endsOn: "2026-11-06",
        repeat: { every: 1, unit: "week" },
      },
      { kind: "event", title: "", startsOn: "2026-11-05" },
      { kind: "event", title: "x", startsOn: "2026-11-05", startTime: "25:00" },
    ];
    for (const body of cases) {
      const res = await addEntry(h.owner.token, h.base, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }

    const tooLong = await request(ctx.app)
      .get(h.base)
      .query({ from: "2026-11-01", to: "2027-01-15" })
      .set(auth(h.owner.token));
    expect(tooLong.status).toBe(400);
  });

  it("lets the creator or the owner change an event, nobody else", async () => {
    const h = await household();
    const event = await add(h.sam.token, h.base, {
      kind: "event",
      title: "Movie night",
      startsOn: "2026-11-06",
    });
    const asAlex = await list(h.alex.token, h.base, "2026-11-06", "2026-11-06");
    expect(asAlex[0].canEdit).toBe(false);
    const asOwner = await list(
      h.owner.token,
      h.base,
      "2026-11-06",
      "2026-11-06",
    );
    expect(asOwner[0].canEdit).toBe(true);

    const update = {
      kind: "event",
      title: "Movie night (moved)",
      startsOn: "2026-11-07",
    };
    const byAlex = await request(ctx.app)
      .put(`${h.base}/events/${event.id}`)
      .set(auth(h.alex.token))
      .send(update);
    expect(byAlex.status).toBe(403);
    const deleteByAlex = await request(ctx.app)
      .delete(`${h.base}/events/${event.id}`)
      .set(auth(h.alex.token));
    expect(deleteByAlex.status).toBe(403);

    const bySam = await request(ctx.app)
      .put(`${h.base}/events/${event.id}`)
      .set(auth(h.sam.token))
      .send(update);
    expect(bySam.status).toBe(200);

    const kindChange = await request(ctx.app)
      .put(`${h.base}/events/${event.id}`)
      .set(auth(h.sam.token))
      .send({ kind: "away", startsOn: "2026-11-07" });
    expect(kindChange.status).toBe(400);

    const byOwner = await request(ctx.app)
      .delete(`${h.base}/events/${event.id}`)
      .set(auth(h.owner.token));
    expect(byOwner.status).toBe(204);
  });

  it("keeps away and guest entries with the person they're about", async () => {
    const h = await household();
    const mine = await add(h.sam.token, h.base, {
      kind: "guest",
      title: "My sister",
      startsOn: "2026-11-07",
      endsOn: "2026-11-08",
    });
    expect(mine.userId).toBe(h.sam.userId);

    // Only the owner adds one for someone else.
    const forOther = await addEntry(h.alex.token, h.base, {
      kind: "away",
      userId: h.sam.userId,
      startsOn: "2026-11-10",
    });
    expect(forOther.status).toBe(403);
    const byOwner = await add(h.owner.token, h.base, {
      kind: "away",
      userId: h.alex.userId,
      startsOn: "2026-11-10",
    });
    expect(byOwner.userId).toBe(h.alex.userId);

    // Alex can change the entry about them; Sam can't.
    const update = { kind: "away", startsOn: "2026-11-11" };
    const bySam = await request(ctx.app)
      .put(`${h.base}/events/${byOwner.id}`)
      .set(auth(h.sam.token))
      .send(update);
    expect(bySam.status).toBe(403);
    const byAlex = await request(ctx.app)
      .put(`${h.base}/events/${byOwner.id}`)
      .set(auth(h.alex.token))
      .send(update);
    expect(byAlex.status).toBe(200);
    expect(byAlex.body.userId).toBe(h.alex.userId);

    // Once Alex leaves, their entry goes with them.
    await request(ctx.app)
      .post(`/households/${h.house.id}/leave`)
      .set(auth(h.alex.token))
      .expect(200);
    const left = await list(h.sam.token, h.base, "2026-11-01", "2026-11-30");
    expect(left.map((o) => o.kind)).toEqual(["guest", "guest"]);
  });

  it("puts chores on their due days, with turns and overdue ones on today", async () => {
    const h = await household();
    const chores = `/households/${h.house.id}/chores`;
    await request(ctx.app)
      .post(chores)
      .set(auth(h.owner.token))
      .send({
        name: "Trash",
        repeat: { every: 1, unit: "week" },
        dueDate: "2026-11-02",
        rotation: [h.sam.userId, h.alex.userId],
      })
      .expect(201);
    await request(ctx.app)
      .post(chores)
      .set(auth(h.owner.token))
      .send({
        name: "Fix the shelf",
        repeat: null,
        dueDate: "2026-10-28",
        rotation: [],
      })
      .expect(201);

    const ahead = await list(
      h.owner.token,
      h.base,
      "2026-11-01",
      "2026-11-20",
      "2026-10-25",
    );
    const trash = ahead.filter((o) => o.title === "Trash");
    expect(trash.map((o) => o.date)).toEqual([
      "2026-11-02",
      "2026-11-09",
      "2026-11-16",
    ]);
    expect(trash.map((o) => o.user?.id)).toEqual([
      h.sam.userId,
      h.alex.userId,
      h.sam.userId,
    ]);
    expect(trash.every((o) => !o.canEdit)).toBe(true);

    // Seen on Nov 10, both are overdue: they sit on today, and Trash carries
    // on from the next week.
    const late = await list(
      h.owner.token,
      h.base,
      "2026-11-01",
      "2026-11-20",
      "2026-11-10",
    );
    expect(
      late.map((o) => [o.title, o.date, o.overdue, o.user?.id ?? null]),
    ).toEqual([
      ["Fix the shelf", "2026-11-10", true, null],
      ["Trash", "2026-11-10", true, h.sam.userId],
      ["Trash", "2026-11-16", false, h.alex.userId],
    ]);

    // No chores on the calendar while chores are off.
    await request(ctx.app)
      .patch(`/households/${h.house.id}/settings`)
      .set(auth(h.owner.token))
      .send({ choresEnabled: false })
      .expect(200);
    expect(
      await list(h.owner.token, h.base, "2026-11-01", "2026-11-20"),
    ).toEqual([]);
  });

  it("is 404 for non-members and while the calendar is off", async () => {
    const h = await household();
    const outsider = await signupUser(ctx);
    const res = await request(ctx.app)
      .get(h.base)
      .query({ from: "2026-11-01", to: "2026-11-30" })
      .set(auth(outsider.token));
    expect(res.status).toBe(404);

    await request(ctx.app)
      .patch(`/households/${h.house.id}/settings`)
      .set(auth(h.owner.token))
      .send({ calendarEnabled: false })
      .expect(200);
    const off = await addEntry(h.sam.token, h.base, {
      kind: "away",
      startsOn: "2026-11-10",
    });
    expect(off.status).toBe(404);
  });

  it("404s an event from another household", async () => {
    const h = await household();
    const other = await household();
    const event = await add(other.owner.token, other.base, {
      kind: "event",
      title: "Theirs",
      startsOn: "2026-11-06",
    });
    const res = await request(ctx.app)
      .delete(`${h.base}/events/${event.id}`)
      .set(auth(h.owner.token));
    expect(res.status).toBe(404);
  });
});
