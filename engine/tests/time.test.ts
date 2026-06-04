import { describe, it, expect } from "vitest";
import { resolveJulianDay } from "../src/time.js";

describe("resolveJulianDay", () => {
  it("converts a known NYC local time to the correct UTC and JD", () => {
    // 2000-01-01 07:00 EST = 2000-01-01 12:00 UTC. JD(2000-01-01 12:00 UT) = 2451545.0
    const r = resolveJulianDay({
      datetimeLocal: "2000-01-01T07:00:00",
      latitude: 40.7128,
      longitude: -74.006,
      timezone: "America/New_York",
    });
    expect(r.utc).toBe("2000-01-01T12:00:00.000Z");
    expect(r.julianDayUt).toBeCloseTo(2451545.0, 5);
  });

  it("derives the timezone from lat/lon when not given", () => {
    const r = resolveJulianDay({
      datetimeLocal: "2000-01-01T07:00:00",
      latitude: 40.7128,
      longitude: -74.006,
    });
    expect(r.utc).toBe("2000-01-01T12:00:00.000Z");
  });
});
