import { describe, expect, it } from "vitest";
import { buildChart } from "../src/chart.js";
import { judgeHorary, moonVoidStatus } from "../src/horary.js";
import type { PlanetPosition } from "../src/types.js";

function body(
  name: string,
  longitude: number,
  degInSign: number,
  speed: number,
): PlanetPosition {
  return { name, longitude, eclipticLatitude: 0, sign: "Aries", degInSign, retrograde: speed < 0, speed };
}

describe("judgeHorary", () => {
  it("assigns significators by sign rulership of the relevant houses", () => {
    const chart = buildChart("horary", {
      datetimeLocal: "2024-03-10T15:00:00",
      latitude: 51.5074,
      longitude: -0.1278,
      timezone: "Europe/London",
    });
    const j = judgeHorary(chart, 10); // a job question -> 10th house
    expect(typeof j.querentSignificator).toBe("string");
    expect(typeof j.quesitedSignificator).toBe("string");
    expect(typeof j.moonVoidOfCourse).toBe("boolean");
  });

  it("produces a calibrated aggregate: score, confidence band, lean, and testimonies", () => {
    const chart = buildChart("horary", {
      datetimeLocal: "2024-03-10T15:00:00",
      latitude: 51.5074,
      longitude: -0.1278,
      timezone: "Europe/London",
    });
    const j = judgeHorary(chart, 7);
    expect(typeof j.score).toBe("number");
    expect(["low", "medium", "high"]).toContain(j.confidence);
    expect(["favorable", "unfavorable", "uncertain"]).toContain(j.lean);
    expect(Array.isArray(j.testimonies)).toBe(true);
    expect(j.testimonies.length).toBeGreaterThan(0);
    // Lean is consistent with the sign of the score.
    if (j.score > 15) expect(j.lean).toBe("favorable");
    else if (j.score < -15) expect(j.lean).toBe("unfavorable");
    else expect(j.lean).toBe("uncertain");
    // The new significator-hint fields are always present (possibly null).
    expect("moonApplyingToQuesited" in j).toBe(true);
    expect("translationOfLight" in j).toBe(true);
    expect("collectionOfLight" in j).toBe(true);
  });

  it("detects translation of light and credits it in the score", () => {
    // Empirically exhibits Venus translating Mercury -> Saturn (10th-house matter).
    const chart = buildChart("horary", {
      datetimeLocal: "2026-03-01T11:00:00",
      latitude: 51.5,
      longitude: -0.12,
      timezone: "Europe/London",
    });
    const j = judgeHorary(chart, 10);
    expect(j.translationOfLight).not.toBeNull();
    expect(j.translationOfLight!.translator).toBe("Venus");
    expect(j.testimonies.some((t) => t.includes("Translation of light"))).toBe(true);
  });

  it("detects collection of light when both significators apply to a third planet", () => {
    const chart = buildChart("horary", {
      datetimeLocal: "2026-03-01T11:00:00",
      latitude: 51.5,
      longitude: -0.12,
      timezone: "Europe/London",
    });
    const j = judgeHorary(chart, 4);
    expect(j.collectionOfLight).not.toBeNull();
    expect(j.collectionOfLight!.collector).toBe("Jupiter");
  });

  it("throws on an out-of-range quesited house", () => {
    const chart = buildChart("horary", {
      datetimeLocal: "2024-03-10T15:00:00",
      latitude: 51.5074,
      longitude: -0.1278,
      timezone: "Europe/London",
    });
    expect(() => judgeHorary(chart, 1)).toThrow();
    expect(() => judgeHorary(chart, 13)).toThrow();
  });
});

describe("moonVoidStatus", () => {
  it("reports void when the Moon is late in its sign and its tightest applying aspect perfects beyond the sign", () => {
    // Moon at 28 deg Aries (2 deg of arc left in sign), applying conjunction to
    // the Sun with a ~7 deg orb -> perfects after the Moon has changed sign.
    const moon = body("Moon", 28, 28, 13);
    const sun = body("Sun", 35, 5, 1);
    const status = moonVoidStatus([moon, sun]);
    expect(status.void).toBe(true);
    expect(status.next).not.toBeNull();
    expect(status.next!.orb).toBeGreaterThan(30 - moon.degInSign);
  });

  it("reports not void when the Moon has ample arc left before its applying aspect perfects", () => {
    // Moon at 2 deg Aries (28 deg of arc left), applying conjunction to the Sun
    // with a ~7 deg orb -> perfects well within the sign.
    const moon = body("Moon", 2, 2, 13);
    const sun = body("Sun", 9, 9, 1);
    const status = moonVoidStatus([moon, sun]);
    expect(status.void).toBe(false);
    expect(status.next).not.toBeNull();
  });
});
