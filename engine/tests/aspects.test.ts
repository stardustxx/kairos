import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { computeAngleAspects, computeAspects, computeCrossAspects } from "../src/aspects.js";
import { buildChart } from "../src/chart.js";
import { computePositions } from "../src/positions.js";
import { julianDayToUtcString, resolveJulianDay } from "../src/time.js";
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

describe("computeCrossAspects", () => {
  it("labels transiting/natal aspects and detects an applying conjunction", () => {
    // Transiting Sun at 10 deg moving 1/day toward fixed natal Mars at 14 deg:
    // separation 4 deg shrinking -> applying conjunction within orb.
    const transiting = [p("Sun", 10, 1)];
    const natal = [p("Mars", 14, 0)];
    const aspects = computeCrossAspects(transiting, natal);
    const conj = aspects.find((a) => a.type === "conjunction");
    expect(conj).toBeTruthy();
    expect(conj!.a).toBe("t.Sun");
    expect(conj!.b).toBe("n.Mars");
    expect(conj!.orb).toBeCloseTo(4, 5);
    expect(conj!.applying).toBe(true);
  });
});

describe("julianDayToUtcString", () => {
  it("round-trips a known UT Julian Day to an ISO UTC string", () => {
    // J2000 = 2000-01-01 12:00 UT.
    const iso = julianDayToUtcString(2451545.0);
    const dt = DateTime.fromISO(iso, { zone: "utc" });
    expect(dt.year).toBe(2000);
    expect(dt.month).toBe(1);
    expect(dt.day).toBe(1);
    expect(dt.hour).toBe(12);
    expect(dt.minute).toBe(0);
    expect(iso).toMatch(/(\+00:00|Z)$/);
  });
});

describe("computeAspects perfection timing (real ephemeris)", () => {
  it("annotates in-orb aspects with a perfectsAtUtc within the search window", () => {
    // A real chart so the bodies have genuine ephemeris motion.
    const moment = {
      datetimeLocal: "1990-05-21T14:30:00",
      latitude: 40.7128,
      longitude: -74.006,
      timezone: "America/New_York",
    };
    const { julianDayUt } = resolveJulianDay(moment);
    const planets = computePositions(julianDayUt);
    const aspects = computeAspects(planets, julianDayUt);
    expect(aspects.length).toBeGreaterThan(0);
    for (const a of aspects) {
      // Field is always present (may be null if it doesn't perfect in window).
      expect("perfectsAtUtc" in a).toBe(true);
      if (a.perfectsAtUtc != null) {
        const t = DateTime.fromISO(a.perfectsAtUtc, { zone: "utc" }).toMillis();
        const chartMs = DateTime.fromISO(
          resolveJulianDay(moment).utc,
          { zone: "utc" },
        ).toMillis();
        // Within ±30 hours of the chart moment (the default window).
        expect(Math.abs(t - chartMs)).toBeLessThanOrEqual(31 * 3600 * 1000);
      }
    }
  });

  it("finds the exact Moon/Sun applying-aspect perfection time in the future", () => {
    const moment = {
      datetimeLocal: "1990-05-21T14:30:00",
      latitude: 40.7128,
      longitude: -74.006,
      timezone: "America/New_York",
    };
    const { julianDayUt, utc } = resolveJulianDay(moment);
    const planets = computePositions(julianDayUt);
    const aspects = computeAspects(planets, julianDayUt);
    const applyingTimed = aspects.filter(
      (a) => a.applying && a.perfectsAtUtc != null,
    );
    // At least one applying aspect should resolve to a future perfection time.
    expect(applyingTimed.length).toBeGreaterThan(0);
    const chartMs = DateTime.fromISO(utc, { zone: "utc" }).toMillis();
    for (const a of applyingTimed) {
      const t = DateTime.fromISO(a.perfectsAtUtc!, { zone: "utc" }).toMillis();
      expect(t).toBeGreaterThanOrEqual(chartMs - 60_000); // applying => not in the past
    }
  });

  it("omits perfectsAtUtc entirely when called without a chartJd (legacy mode)", () => {
    const aspects = computeAspects([p("Sun", 10, 1), p("Mars", 14, 0.5)]);
    const conj = aspects.find((a) => a.type === "conjunction")!;
    expect("perfectsAtUtc" in conj).toBe(false);
  });
});

describe("buildChart wires perfection timing into chart aspects", () => {
  it("populates perfectsAtUtc on chart.aspects", () => {
    const chart = buildChart("natal", {
      datetimeLocal: "1990-05-21T14:30:00",
      latitude: 40.7128,
      longitude: -74.006,
      timezone: "America/New_York",
    });
    expect(chart.aspects.length).toBeGreaterThan(0);
    for (const a of chart.aspects) {
      expect("perfectsAtUtc" in a).toBe(true);
    }
  });
});

describe("computeCrossAspects perfection timing", () => {
  it("annotates transit-to-natal aspects with perfectsAtUtc", () => {
    const transitMoment = {
      datetimeLocal: "2024-06-01T12:00:00",
      latitude: 40.7128,
      longitude: -74.006,
      timezone: "America/New_York",
    };
    const natalMoment = {
      datetimeLocal: "1990-05-21T14:30:00",
      latitude: 40.7128,
      longitude: -74.006,
      timezone: "America/New_York",
    };
    const t = resolveJulianDay(transitMoment);
    const n = resolveJulianDay(natalMoment);
    const transiting = computePositions(t.julianDayUt);
    const natal = computePositions(n.julianDayUt);
    const aspects = computeCrossAspects(transiting, natal, t.julianDayUt);
    for (const a of aspects) {
      expect("perfectsAtUtc" in a).toBe(true);
    }
  });

  it("omits perfectsAtUtc in legacy mode (no chartJd)", () => {
    const transiting = [p("Sun", 10, 1)];
    const natal = [p("Mars", 14, 0)];
    const aspects = computeCrossAspects(transiting, natal);
    const conj = aspects.find((a) => a.type === "conjunction")!;
    expect("perfectsAtUtc" in conj).toBe(false);
    expect(conj.applying).toBe(true);
  });
});

describe("computeAngleAspects", () => {
  it("finds tight aspects from planets to the Ascendant and MC", () => {
    // Ascendant 0° Aries, MC ~270° (Capricorn). Mars at 2° Aries conjuncts Asc;
    // Venus at 272° squares nothing but trines/sextiles can be checked.
    const planets = [p("Mars", 2, 0.5), p("Sun", 90, 1), p("Saturn", 180, 0.03)];
    const aspects = computeAngleAspects(planets, 0, 270);
    const marsAsc = aspects.find((a) => a.a === "Mars" && a.b === "Ascendant");
    expect(marsAsc).toBeTruthy();
    expect(marsAsc!.type).toBe("conjunction");
    expect(marsAsc!.orb).toBeCloseTo(2, 1);
    // Sun at 90° squares the Ascendant at 0°.
    const sunAsc = aspects.find((a) => a.a === "Sun" && a.b === "Ascendant");
    expect(sunAsc!.type).toBe("square");
    // Saturn at 180° opposes the Ascendant.
    const satAsc = aspects.find((a) => a.a === "Saturn" && a.b === "Ascendant");
    expect(satAsc!.type).toBe("opposition");
  });

  it("respects the tight 5° angle orb", () => {
    // 7° off a conjunction is within the 8° planet orb but beyond the 5° angle orb.
    const aspects = computeAngleAspects([p("Mars", 7, 0.5)], 0, 270);
    expect(aspects.find((a) => a.b === "Ascendant")).toBeUndefined();
  });
});

describe("buildChart angle aspects", () => {
  it("attaches an angleAspects array to every chart", () => {
    const chart = buildChart("natal", {
      datetimeLocal: "1990-05-21T14:30:00",
      latitude: 40.71,
      longitude: -74.01,
      timezone: "America/New_York",
    });
    expect(Array.isArray(chart.angleAspects)).toBe(true);
    for (const a of chart.angleAspects) {
      expect(["Ascendant", "MC"]).toContain(a.b);
      expect(a.orb).toBeLessThanOrEqual(5);
    }
  });
});
