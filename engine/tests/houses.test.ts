import { describe, it, expect } from "vitest";
import { computeHouses } from "../src/houses.js";

describe("computeHouses", () => {
  it("returns 12 cusps plus ascendant and MC", () => {
    const jd = 2451545.0;
    const h = computeHouses(jd, 40.7128, -74.006, "P");
    expect(h.cusps.length).toBe(12);
    expect(h.system).toBe("P");
    expect(h.ascendant).toBeGreaterThanOrEqual(0);
    expect(h.ascendant).toBeLessThan(360);
    expect(h.cusps[0]).toBeCloseTo(h.ascendant, 6); // 1st cusp == ascendant
    expect(h.mc).toBeGreaterThanOrEqual(0);
    expect(h.mc).toBeLessThan(360);
  });
});
