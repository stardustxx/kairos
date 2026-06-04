import { describe, it, expect } from "vitest";
import { computePositions } from "../src/positions.js";

describe("computePositions", () => {
  it("places the Sun near 280.37 Capricorn at J2000 noon UT", () => {
    const jd = 2451545.0;
    const planets = computePositions(jd);
    const sun = planets.find((p) => p.name === "Sun")!;
    expect(sun.longitude).toBeCloseTo(280.369, 2);
    expect(sun.sign).toBe("Capricorn");
    expect(sun.degInSign).toBeCloseTo(10.369, 2);
    expect(sun.retrograde).toBe(false);
  });

  it("returns every planet in the constants list", () => {
    const planets = computePositions(2451545.0);
    expect(planets.map((p) => p.name)).toContain("Pluto");
    expect(planets.length).toBe(11);
  });
});
