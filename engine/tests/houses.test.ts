import { describe, expect, it } from "vitest";
import { computeHouses, houseOf } from "../src/houses.js";

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

describe("houseOf", () => {
  // 12 evenly-spaced 30-deg cusps starting at 350 deg (1st cusp crosses 0 Aries).
  const cusps = Array.from({ length: 12 }, (_, i) => (350 + i * 30) % 360);

  it("handles the wraparound case where the 1st cusp is before 0 Aries", () => {
    // 1st house spans 350..20 deg; 5 deg falls inside it.
    expect(houseOf(5, cusps)).toBe(1);
    // 355 deg (just after the 1st cusp, before wrapping) is still house 1.
    expect(houseOf(355, cusps)).toBe(1);
  });

  it("assigns later longitudes to their houses", () => {
    expect(houseOf(25, cusps)).toBe(2); // 20..50
    expect(houseOf(185, cusps)).toBe(7); // 170..200
    expect(houseOf(340, cusps)).toBe(12); // 320..350
  });
});
