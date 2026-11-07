import { describe, it, expect } from "vitest";
import { ageOn } from "../../src/modules/auth/auth.types";

const day = (s: string) => new Date(`${s}T00:00:00Z`);

describe("ageOn", () => {
  it("counts a year only from the birthday on", () => {
    expect(ageOn("2008-11-07", day("2026-11-06"))).toBe(17);
    expect(ageOn("2008-11-07", day("2026-11-07"))).toBe(18);
    expect(ageOn("2008-11-07", day("2026-11-08"))).toBe(18);
  });

  it("compares the month first", () => {
    expect(ageOn("2008-12-01", day("2026-11-30"))).toBe(17);
    expect(ageOn("2008-01-31", day("2026-02-01"))).toBe(18);
  });

  it("puts a 29 February birthday on 1 March in other years", () => {
    expect(ageOn("2008-02-29", day("2026-02-28"))).toBe(17);
    expect(ageOn("2008-02-29", day("2026-03-01"))).toBe(18);
  });
});
