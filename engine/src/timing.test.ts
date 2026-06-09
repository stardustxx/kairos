import { describe, expect, it } from "vitest";
import { DEGREES_PER_SIGN, SIGN_COUNT, SIGNS } from "./constants.js";
import { judgeHorary } from "./horary.js";
import { estimateTiming } from "./timing.js";
import type { Aspect, Chart, PlanetPosition } from "./types.js";

/**
 * Minimal planet fixture. estimateTiming only reads longitude (for the sign),
 * speed, and house; sign/degInSign are derived from longitude so the body is
 * internally consistent. Pass an explicit house when exercising angularity.
 */
function planet(
  name: string,
  longitude: number,
  speed: number,
  house?: number,
): PlanetPosition {
  const lon = ((longitude % 360) + 360) % 360;
  const si = Math.floor(lon / DEGREES_PER_SIGN) % SIGN_COUNT;
  return {
    name,
    longitude: lon,
    eclipticLatitude: 0,
    sign: SIGNS[si],
    degInSign: lon - si * DEGREES_PER_SIGN,
    retrograde: false,
    speed,
    house,
  };
}

/** An applying aspect with a given orb (and optional exact perfection time). */
function applyingAspect(orb: number, perfectsAtUtc?: string | null): Aspect {
  const a: Aspect = { a: "Sun", b: "Saturn", type: "conjunction", orb, applying: true };
  if (perfectsAtUtc !== undefined) a.perfectsAtUtc = perfectsAtUtc;
  return a;
}

// Longitudes per modality (quadruplicity): movable/cardinal = Aries (0°),
// fixed = Taurus (30°), common/mutable = Gemini (60°).
const ARIES = 5; // movable
const TAURUS = 35; // fixed
const GEMINI = 65; // common

describe("estimateTiming unit selection by sign modality", () => {
  it("movable (cardinal) sign => days", () => {
    const t = estimateTiming(applyingAspect(4), planet("Sun", ARIES, 1.0));
    expect(t.unit).toBe("days");
  });

  it("common (mutable) sign => weeks", () => {
    const t = estimateTiming(applyingAspect(4), planet("Sun", GEMINI, 1.0));
    expect(t.unit).toBe("weeks");
  });

  it("fixed sign => months", () => {
    const t = estimateTiming(applyingAspect(4), planet("Sun", TAURUS, 1.0));
    expect(t.unit).toBe("months");
  });
});

describe("estimateTiming angularity refinement", () => {
  it("an angular house hastens the matter one unit faster", () => {
    // Fixed sign base = months; angular house (10) shifts one step faster = weeks.
    const t = estimateTiming(applyingAspect(3), planet("Sun", TAURUS, 1.0, 10));
    expect(t.unit).toBe("weeks");
  });

  it("a cadent house delays the matter one unit slower", () => {
    // Fixed sign base = months; cadent house (6) shifts one step slower = years.
    const t = estimateTiming(applyingAspect(3), planet("Sun", TAURUS, 1.0, 6));
    expect(t.unit).toBe("years");
  });

  it("a succedent house leaves the modality unit unchanged", () => {
    const t = estimateTiming(applyingAspect(3), planet("Sun", TAURUS, 1.0, 11));
    expect(t.unit).toBe("months");
  });
});

describe("estimateTiming amount & degreesToPerfection", () => {
  it("degreesToPerfection equals the aspect orb", () => {
    const t = estimateTiming(applyingAspect(4.2), planet("Sun", ARIES, 1.0));
    expect(t.degreesToPerfection).toBe(4.2);
  });

  it("amount is the rounded degrees-to-perfection", () => {
    const t = estimateTiming(applyingAspect(4.2), planet("Sun", ARIES, 1.0));
    expect(t.amount).toBe(4);
    expect(t.text).toBe("about 4 days");
  });

  it("an in-orb applying aspect is at least one whole unit (never zero)", () => {
    const t = estimateTiming(applyingAspect(0.2), planet("Sun", ARIES, 1.0));
    expect(t.amount).toBe(1);
    // Singular unit form, not "1 days".
    expect(t.text).toBe("about 1 day");
  });
});

describe("estimateTiming surfaces perfectsAtUtc", () => {
  it("includes a readable absolute date in text when perfectsAtUtc is present", () => {
    const t = estimateTiming(
      applyingAspect(4, "2026-07-14T09:30:00.000Z"),
      planet("Sun", ARIES, 1.0),
    );
    expect(t.perfectsAtUtc).toBe("2026-07-14T09:30:00.000Z");
    expect(t.text).toContain("perfects on 2026-07-14");
    expect(t.text).toBe("about 4 days (perfects on 2026-07-14)");
  });

  it("omits the perfection clause when perfectsAtUtc is absent/null", () => {
    const t = estimateTiming(applyingAspect(4, null), planet("Sun", ARIES, 1.0));
    expect(t.perfectsAtUtc).toBeNull();
    expect(t.text).toBe("about 4 days");
  });
});

/**
 * Build a synthetic horary Chart from a planet list and explicit cusps. Mirrors
 * the helper in perfection.test.ts — only the fields judgeHorary reads need be
 * present.
 */
function chartOf(planets: PlanetPosition[], cusps: number[]): Chart {
  const asc = cusps[0];
  const mc = cusps[9];
  return {
    kind: "horary",
    julianDayUt: 2451545,
    utc: "2000-01-01T12:00:00Z",
    planets,
    houses: { system: "R", cusps, ascendant: asc, mc },
    aspects: [],
    sect: "day",
    partOfFortune: { longitude: 0, sign: SIGNS[0], degInSign: 0, house: 1 },
    lots: [],
    angleAspects: [],
    fixedStars: [],
    antiscia: [],
  };
}

/** Twelve equal cusps starting at `ascLon` (30° apart). */
function equalCusps(ascLon: number): number[] {
  return Array.from({ length: 12 }, (_, i) => (((ascLon + i * 30) % 360) + 360) % 360);
}

describe("judgeHorary timing wiring", () => {
  // Ascendant Leo (135°) => querent significator Sun; 7th cusp Aquarius (315°)
  // => quesited significator Saturn.
  const ascLeo = 135;

  it("attaches timing when the significators form an applying perfection", () => {
    // Sun (querent, in Aries 5°, fast) & Saturn (quesited, 6° ahead, in orb of
    // conjunction) apply and close. The faster significator (Sun) sets the unit;
    // in a movable sign that is days.
    const planets = [
      planet("Sun", 5, 1.0),
      planet("Saturn", 11, 0.03),
      planet("Moon", 200, 13.0),
      planet("Mercury", 250, 1.2),
      planet("Venus", 260, 1.1),
      planet("Mars", 270, 0.5),
      planet("Jupiter", 300, 0.08),
    ];
    const j = judgeHorary(chartOf(planets, equalCusps(ascLeo)), 7);
    expect(j.significatorAspect?.applying).toBe(true);
    expect(j.timing).not.toBeNull();
    expect(j.timing?.unit).toBe("days");
    expect(j.timing?.degreesToPerfection).toBe(j.significatorAspect?.orb);
  });

  it("yields null timing when there is no applying significator aspect", () => {
    // Sun & Saturn are 105° apart — between the square (90) and trine (120),
    // 15° off either, which exceeds their moiety orb of (15+9)/2 = 12. So no
    // major aspect between them, no applying perfection, and therefore no timing.
    const planets = [
      planet("Sun", 5, 1.0),
      planet("Saturn", 110, 0.03),
      planet("Moon", 200, 13.0),
      planet("Mercury", 250, 1.2),
      planet("Venus", 260, 1.1),
      planet("Mars", 270, 0.5),
      planet("Jupiter", 300, 0.08),
    ];
    const j = judgeHorary(chartOf(planets, equalCusps(ascLeo)), 7);
    expect(j.significatorAspect?.applying ?? false).toBe(false);
    expect(j.timing).toBeNull();
  });
});
