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
});
