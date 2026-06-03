import { describe, it, expect } from "vitest";
import { computeAspects } from "../src/aspects.js";
import type { PlanetPosition } from "../src/types.js";

function p(name: string, longitude: number, speed: number): PlanetPosition {
  return { name, longitude, sign: "Aries", degInSign: 0, retrograde: speed < 0, speed };
}

describe("computeAspects", () => {
  it("detects a conjunction within orb", () => {
    const aspects = computeAspects([p("Sun", 10, 1), p("Mars", 14, 0.5)]);
    const conj = aspects.find((a) => a.type === "conjunction");
    expect(conj).toBeTruthy();
    expect(conj!.orb).toBeCloseTo(4, 5);
  });

  it("marks a faster body catching a slower one as applying", () => {
    // Sun at 10 deg moving 1/day, Mars at 14 deg moving 0.5/day:
    // separation 4 deg shrinking toward 0 -> applying conjunction.
    const aspects = computeAspects([p("Sun", 10, 1), p("Mars", 14, 0.5)]);
    const conj = aspects.find((a) => a.type === "conjunction")!;
    expect(conj.applying).toBe(true);
  });

  it("ignores pairs outside any orb", () => {
    const aspects = computeAspects([p("Sun", 10, 1), p("Mars", 47, 0.5)]);
    expect(aspects.length).toBe(0);
  });
});
