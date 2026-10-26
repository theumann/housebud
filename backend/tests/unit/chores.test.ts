import { describe, expect, it } from "vitest";
import type { Chore } from "../../src/generated/prisma/client";
import {
  nextDueDate,
  repeatOf,
  step,
  turnOrder,
} from "../../src/modules/chores/chores.service";

const day = (s: string) => new Date(`${s}T00:00:00.000Z`);
const ymd = (d: Date) => d.toISOString().slice(0, 10);

describe("step", () => {
  it("moves by days and weeks", () => {
    expect(ymd(step(day("2026-10-20"), { every: 3, unit: "day" }, 20))).toBe(
      "2026-10-23",
    );
    expect(ymd(step(day("2026-10-20"), { every: 2, unit: "week" }, 20))).toBe(
      "2026-11-03",
    );
  });

  it("crosses a month and a year end", () => {
    expect(ymd(step(day("2026-12-28"), { every: 1, unit: "week" }, 28))).toBe(
      "2027-01-04",
    );
    expect(ymd(step(day("2026-12-15"), { every: 1, unit: "month" }, 15))).toBe(
      "2027-01-15",
    );
  });

  it("falls back to the last day of a short month, then returns to the anchor", () => {
    const monthly = { every: 1, unit: "month" } as const;
    const feb = step(day("2027-01-31"), monthly, 31);
    expect(ymd(feb)).toBe("2027-02-28");
    const mar = step(feb, monthly, 31);
    expect(ymd(mar)).toBe("2027-03-31");
    expect(ymd(step(mar, monthly, 31))).toBe("2027-04-30");
  });

  it("lands on Feb 29 in a leap year", () => {
    expect(ymd(step(day("2028-01-31"), { every: 1, unit: "month" }, 31))).toBe(
      "2028-02-29",
    );
  });

  it("moves a quarter as three calendar months", () => {
    const quarterly = { every: 1, unit: "quarter" } as const;
    const feb = step(day("2026-11-30"), quarterly, 30);
    expect(ymd(feb)).toBe("2027-02-28");
    expect(ymd(step(feb, quarterly, 30))).toBe("2027-05-30");
  });
});

describe("nextDueDate", () => {
  const weekly = { every: 1, unit: "week" } as const;

  it("done on the day: the next occurrence", () => {
    expect(
      ymd(nextDueDate(day("2026-10-19"), weekly, 19, day("2026-10-19"))),
    ).toBe("2026-10-26");
  });

  it("done early: still the next occurrence after the due date", () => {
    expect(
      ymd(nextDueDate(day("2026-10-19"), weekly, 19, day("2026-10-15"))),
    ).toBe("2026-10-26");
  });

  it("done late: keeps the weekday instead of restarting from the done date", () => {
    expect(
      ymd(nextDueDate(day("2026-10-19"), weekly, 19, day("2026-10-22"))),
    ).toBe("2026-10-26");
  });

  it("skips occurrences that were missed entirely", () => {
    expect(
      ymd(nextDueDate(day("2026-10-05"), weekly, 5, day("2026-10-22"))),
    ).toBe("2026-10-26");
  });

  it("done on the next occurrence's day counts for that one too", () => {
    expect(
      ymd(nextDueDate(day("2026-10-19"), weekly, 19, day("2026-10-26"))),
    ).toBe("2026-11-02");
  });

  it("monthly on the 31st keeps its anchor through short months", () => {
    const monthly = { every: 1, unit: "month" } as const;
    expect(
      ymd(nextDueDate(day("2027-01-31"), monthly, 31, day("2027-03-05"))),
    ).toBe("2027-03-31");
  });
});

describe("repeatOf", () => {
  it("reads the stored columns", () => {
    expect(repeatOf({ repeatEvery: 2, repeatUnit: "week" })).toEqual({
      every: 2,
      unit: "week",
    });
  });

  it("is null for a one-off chore", () => {
    expect(repeatOf({ repeatEvery: null, repeatUnit: null })).toBeNull();
  });
});

describe("turnOrder", () => {
  const chore = (rotation: string[], rotationIndex: number) =>
    ({ rotation, rotationIndex }) as Chore;
  const members = (...ids: string[]) => new Set(ids);

  it("starts with whoever's turn it is", () => {
    expect(
      turnOrder(chore(["a", "b", "c"], 1), members("a", "b", "c")),
    ).toEqual(["b", "c", "a"]);
  });

  it("skips members who left, passing their turn on", () => {
    expect(turnOrder(chore(["a", "b", "c"], 1), members("a", "c"))).toEqual([
      "c",
      "a",
    ]);
  });

  it("wraps around when the last in line has left", () => {
    expect(turnOrder(chore(["a", "b", "c"], 2), members("a", "b"))).toEqual([
      "a",
      "b",
    ]);
  });

  it("is empty when nobody in the rotation is still a member", () => {
    expect(turnOrder(chore(["a", "b"], 0), members("c"))).toEqual([]);
  });

  it("is empty for a chore without a rotation", () => {
    expect(turnOrder(chore([], 0), members("a"))).toEqual([]);
  });
});
