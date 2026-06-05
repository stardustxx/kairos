import { describe, it, expect } from "vitest";
import { buildChart } from "../src/chart.js";

describe("buildChart", () => {
  it("assembles positions, houses, and aspects for a moment", () => {
    const chart = buildChart("natal", {
      datetimeLocal: "1990-05-21T14:30:00",
      latitude: 40.7128,
      longitude: -74.006,
      timezone: "America/New_York",
    });
    expect(chart.planets.length).toBe(11);
    expect(chart.houses.cusps.length).toBe(12);
    expect(Array.isArray(chart.aspects)).toBe(true);
    expect(chart.utc.endsWith("Z")).toBe(true);
    expect(chart.julianDayUt).toBeGreaterThan(2447000);
  });

  it("annotates exact perfection time by default but omits it when aspectTiming is false", () => {
    const moment = {
      datetimeLocal: "1990-05-21T14:30:00",
      latitude: 40.7128,
      longitude: -74.006,
      timezone: "America/New_York",
    };
    const withTiming = buildChart("natal", moment);
    const withoutTiming = buildChart("natal", moment, { aspectTiming: false });

    // Same set of aspects either way (type/applying unaffected).
    expect(withoutTiming.aspects.length).toBe(withTiming.aspects.length);
    expect(withoutTiming.aspects.length).toBeGreaterThan(0);

    // Default path populates perfectsAtUtc on at least one in-orb aspect.
    expect(withTiming.aspects.some((a) => typeof a.perfectsAtUtc === "string")).toBe(true);
    // Opt-out path never sets it.
    expect(withoutTiming.aspects.every((a) => a.perfectsAtUtc === undefined)).toBe(true);
  });
});
