import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "../../src/generated/prisma/client";
import { eventDays } from "../../src/modules/calendar/calendar.service";

const day = (s: string) => new Date(`${s}T00:00:00.000Z`);
const ymd = (d: Date) => d.toISOString().slice(0, 10);

function event(
  startsOn: string,
  endsOn: string,
  repeat: { every: number; unit: string } | null = null,
  skipped: string[] = [],
) {
  return {
    startsOn: day(startsOn),
    endsOn: day(endsOn),
    repeatEvery: repeat?.every ?? null,
    repeatUnit: repeat?.unit ?? null,
    anchorDay: day(startsOn).getUTCDate(),
    skippedDates: skipped.map(day),
  } as CalendarEvent;
}

const days = (e: CalendarEvent, from: string, to: string) =>
  eventDays(e, day(from), day(to)).map(ymd);

describe("eventDays", () => {
  it("a one-day event is on its day", () => {
    expect(
      days(event("2026-10-22", "2026-10-22"), "2026-10-01", "2026-10-31"),
    ).toEqual(["2026-10-22"]);
  });

  it("an entry over several days is on each of them", () => {
    expect(
      days(event("2026-10-22", "2026-10-24"), "2026-10-01", "2026-10-31"),
    ).toEqual(["2026-10-22", "2026-10-23", "2026-10-24"]);
  });

  it("only the days inside the range, at either end", () => {
    const trip = event("2026-10-29", "2026-11-03");
    expect(days(trip, "2026-10-01", "2026-10-31")).toEqual([
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
    ]);
    expect(days(trip, "2026-11-01", "2026-11-30")).toEqual([
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
    ]);
  });

  it("nothing when the entry is outside the range", () => {
    expect(
      days(event("2026-09-01", "2026-09-02"), "2026-10-01", "2026-10-31"),
    ).toEqual([]);
  });

  it("a weekly event repeats, including one that started before the range", () => {
    expect(
      days(
        event("2026-09-24", "2026-09-24", { every: 1, unit: "week" }),
        "2026-10-01",
        "2026-10-31",
      ),
    ).toEqual([
      "2026-10-01",
      "2026-10-08",
      "2026-10-15",
      "2026-10-22",
      "2026-10-29",
    ]);
  });

  it("a repeat doesn't start before its first day", () => {
    expect(
      days(
        event("2026-10-15", "2026-10-15", { every: 1, unit: "week" }),
        "2026-10-01",
        "2026-10-31",
      ),
    ).toEqual(["2026-10-15", "2026-10-22", "2026-10-29"]);
  });

  it("skipped days are left out", () => {
    expect(
      days(
        event("2026-10-01", "2026-10-01", { every: 1, unit: "week" }, [
          "2026-10-08",
          "2026-10-22",
        ]),
        "2026-10-01",
        "2026-10-31",
      ),
    ).toEqual(["2026-10-01", "2026-10-15", "2026-10-29"]);
  });

  it("a monthly event on the 31st falls on the last day of short months", () => {
    expect(
      days(
        event("2027-01-31", "2027-01-31", { every: 1, unit: "month" }),
        "2027-01-01",
        "2027-05-31",
      ),
    ).toEqual([
      "2027-01-31",
      "2027-02-28",
      "2027-03-31",
      "2027-04-30",
      "2027-05-31",
    ]);
  });

  it("every 2 days, across a month end", () => {
    expect(
      days(
        event("2026-10-27", "2026-10-27", { every: 2, unit: "day" }),
        "2026-10-25",
        "2026-11-04",
      ),
    ).toEqual([
      "2026-10-27",
      "2026-10-29",
      "2026-10-31",
      "2026-11-02",
      "2026-11-04",
    ]);
  });
});
