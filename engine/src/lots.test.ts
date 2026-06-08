import { describe, expect, it } from "vitest";
import type { LotInputs } from "./lots.js";
import { computeLots } from "./lots.js";

// Whole-sign-style cusps (each house = one 30° sign starting at 0° Aries) so the
// house derivation is deterministic and easy to read.
const CUSPS = Array.from({ length: 12 }, (_, i) => i * 30);

function norm360(x: number): number {
  return ((x % 360) + 360) % 360;
}

// A minimal set of point longitudes shared by the day and night charts. Chosen
// so the hand arithmetic in the comments below is easy to follow.
//   Asc = 100, Sun = 50, Moon = 80, Mercury = 40, Venus = 200,
//   Mars = 300, Jupiter = 250, Saturn = 330
const BASE = {
  ascendant: 100,
  sun: 50,
  moon: 80,
  mercury: 40,
  venus: 200,
  mars: 300,
  jupiter: 250,
  saturn: 330,
  cusps: CUSPS,
};

// Fortune by sect (computed the same way chart.ts does), supplied to computeLots.
// Day:   Asc + Moon - Sun = 100 + 80 - 50 = 130
// Night: Asc + Sun - Moon = 100 + 50 - 80 = 70
const FORTUNE_DAY = norm360(BASE.ascendant + BASE.moon - BASE.sun); // 130
const FORTUNE_NIGHT = norm360(BASE.ascendant + BASE.sun - BASE.moon); // 70

const dayInputs: LotInputs = { ...BASE, fortune: FORTUNE_DAY, sect: "day" };
const nightInputs: LotInputs = { ...BASE, fortune: FORTUNE_NIGHT, sect: "night" };

function lot(lots: ReturnType<typeof computeLots>, name: string) {
  const l = lots.find((x) => x.name === name);
  if (!l) throw new Error(`lot ${name} not found`);
  return l;
}

describe("computeLots — Spirit mirrors Fortune across the Ascendant by day", () => {
  it("Spirit - Asc = -(Fortune - Asc) in a day chart", () => {
    const lots = computeLots(dayInputs);
    const spirit = lot(lots, "Spirit");
    // Spirit (day) = Asc + Sun - Moon = 100 + 50 - 80 = 70
    expect(spirit.longitude).toBeCloseTo(70, 9);
    // Mirror property: equal and opposite arc from the Ascendant.
    const spiritArc = spirit.longitude - BASE.ascendant; // 70 - 100 = -30
    const fortuneArc = FORTUNE_DAY - BASE.ascendant; // 130 - 100 = +30
    expect(spiritArc).toBeCloseTo(-fortuneArc, 9);
  });

  it("the night reversal flips Spirit (and Fortune) about the Ascendant", () => {
    // With the same longitudes, the night formula swaps Sun/Moon:
    // Spirit (night) = Asc + Moon - Sun = 130, Fortune (night) = 70 — exactly
    // the day values swapped.
    const lots = computeLots(nightInputs);
    const spirit = lot(lots, "Spirit");
    expect(spirit.longitude).toBeCloseTo(130, 9);
    expect(spirit.longitude).toBeCloseTo(FORTUNE_DAY, 9);
    expect(FORTUNE_NIGHT).toBeCloseTo(70, 9);
    // Still a mirror, now on the other side of the Ascendant.
    const spiritArc = spirit.longitude - BASE.ascendant; // +30
    const fortuneArc = FORTUNE_NIGHT - BASE.ascendant; // -30
    expect(spiritArc).toBeCloseTo(-fortuneArc, 9);
  });
});

describe("computeLots — dependent lot spot check (Eros)", () => {
  it("Eros by day = Asc + Venus - Spirit (hand arithmetic)", () => {
    const lots = computeLots(dayInputs);
    const spirit = lot(lots, "Spirit"); // 70 (see above)
    const eros = lot(lots, "Eros");
    // Eros (day) = Asc + Venus - Spirit = 100 + 200 - 70 = 230
    expect(eros.longitude).toBeCloseTo(230, 9);
    expect(eros.longitude).toBeCloseTo(
      norm360(BASE.ascendant + BASE.venus - spirit.longitude),
      9,
    );
    // 230° = 20° Scorpio (sign index 7), 8th whole-sign house.
    expect(eros.sign).toBe("Scorpio");
    expect(eros.degInSign).toBeCloseTo(20, 9);
    expect(eros.house).toBe(8);
  });

  it("Eros by night reverses to Asc + Spirit - Venus", () => {
    const lots = computeLots(nightInputs);
    const spirit = lot(lots, "Spirit"); // 130
    const eros = lot(lots, "Eros");
    // Eros (night) = Asc + Spirit - Venus = 100 + 130 - 200 = 30
    expect(eros.longitude).toBeCloseTo(30, 9);
    expect(eros.longitude).toBeCloseTo(
      norm360(BASE.ascendant + spirit.longitude - BASE.venus),
      9,
    );
  });
});

describe("computeLots — all seven dependent lots present and sect-aware", () => {
  it("returns Spirit, Eros, Necessity, Courage, Victory, Nemesis in order", () => {
    const lots = computeLots(dayInputs);
    expect(lots.map((l) => l.name)).toEqual([
      "Spirit",
      "Eros",
      "Necessity",
      "Courage",
      "Victory",
      "Nemesis",
    ]);
  });

  it("Fortune-keyed lots reverse correctly between day and night", () => {
    const day = computeLots(dayInputs);
    const night = computeLots(nightInputs);
    // Necessity (day) = Asc + Fortune - Mercury = 100 + 130 - 40 = 190
    expect(lot(day, "Necessity").longitude).toBeCloseTo(190, 9);
    // Necessity (night) = Asc + Mercury - Fortune = 100 + 40 - 70 = 70
    expect(lot(night, "Necessity").longitude).toBeCloseTo(70, 9);
    // Courage (day) = Asc + Fortune - Mars = 100 + 130 - 300 = -70 -> 290
    expect(lot(day, "Courage").longitude).toBeCloseTo(290, 9);
    // Nemesis (day) = Asc + Fortune - Saturn = 100 + 130 - 330 = -100 -> 260
    expect(lot(day, "Nemesis").longitude).toBeCloseTo(260, 9);
    // Victory (day) = Asc + Jupiter - Spirit = 100 + 250 - 70 = 280
    expect(lot(day, "Victory").longitude).toBeCloseTo(280, 9);
  });
});
