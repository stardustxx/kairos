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

/** Sum the signed `(±N)` suffixes of a judgment's testimony lines — the
 *  sensitivity-diagnostic invariant: the score IS the sum of displayed weights. */
function sumOfDisplayedWeights(testimonies: string[]): number {
  let sum = 0;
  for (const line of testimonies) {
    const m = line.match(/\(([+-]?\d+)\)\s*$/);
    if (m) sum += Number.parseInt(m[1], 10);
  }
  return sum;
}

function judgeAt(
  datetimeLocal: string,
  latitude: number,
  longitude: number,
  timezone: string,
  quesitedHouse: number,
) {
  const chart = buildChart("horary", { datetimeLocal, latitude, longitude, timezone });
  return judgeHorary(chart, quesitedHouse);
}

describe("void-of-course exception signs (Lilly, CA p. 122)", () => {
  it("mitigates a void Moon in Cancer — 'somewhat she performs' halves the debit to -15", () => {
    // London, Moon 27.8 Cancer, genuinely void (chartJd-verified: no in-orb
    // aspect perfects before the Moon leaves Cancer).
    const j = judgeAt("2024-08-03T08:00:00", 51.5074, -0.1278, "Europe/London", 2);
    expect(j.moonVoidOfCourse).toBe(true);
    expect(j.testimonies).toContain(
      "Moon void of course, but in Cancer — somewhat she performs (Lilly's exception) (-15)",
    );
    expect(j.testimonies.some((t) => t.includes("little is likely to come"))).toBe(false);
    expect(sumOfDisplayedWeights(j.testimonies)).toBe(j.score);
  });

  it("does not mitigate a void Moon in Aries — the full -30 stands", () => {
    // London, Moon 27.0 Aries, genuinely void; Aries is not among Lilly's
    // exception signs (Taurus/Cancer/Sagittarius/Pisces).
    const j = judgeAt("2024-08-23T20:00:00", 51.5074, -0.1278, "Europe/London", 2);
    expect(j.moonVoidOfCourse).toBe(true);
    expect(j.testimonies).toContain(
      "Moon void of course — little is likely to come of the matter (-30)",
    );
    expect(j.testimonies.some((t) => t.includes("somewhat she performs"))).toBe(false);
    expect(sumOfDisplayedWeights(j.testimonies)).toBe(j.score);
  });
});

describe("perfection by location (Lilly CA pp. 125-127, 444-445; Bonatti p. 33)", () => {
  it("credits the quesited's ruler in the querent's house (+12, the stronger direction)", () => {
    // Warnock's 2001 'He Got the Job!' chart: Saturn (10th ruler, dignity +3,
    // direct, clear of the Sun) sits in the querent's 1st house.
    const j = judgeAt("2001-02-18T10:20:00", 38.9167, -77.05, "America/New_York", 10);
    expect(j.quesitedSignificator).toBe("Saturn");
    expect(j.quesitedSignificatorHouse).toBe(1);
    expect(j.testimonies).toContain(
      "Quesited significator Saturn in the querent's 1st house — the matter comes to the querent (perfection by location) (+12)",
    );
    expect(sumOfDisplayedWeights(j.testimonies)).toBe(j.score);
  });

  it("credits the querent's ruler in the quesited's house (+10) and surfaces it in the synthesis when nothing else perfects", () => {
    // Bevan's 1995 physiotherapy-exam chart (Oslo): Mars (querent, dignity +1,
    // direct, clear) sits in the quesited 10th. The significators only separate
    // and the Mercury translation fails (carrier combust), so the location
    // testimony is the surviving perfection story named by the synthesis.
    const j = judgeAt("1995-06-08T17:30:00", 59.9167, 10.7167, "Europe/Oslo", 10);
    expect(j.querentSignificator).toBe("Mars");
    expect(j.querentSignificatorHouse).toBe(10);
    expect(j.testimonies).toContain(
      "Querent significator Mars in the quesited's 10th house — the querent goes to the matter (perfection by location) (+10)",
    );
    expect(j.perfection.summary).toContain(
      "the querent pursues the matter by position: the querent's ruler sits in the quesited's house",
    );
    expect(sumOfDisplayedWeights(j.testimonies)).toBe(j.score);
  });

  it("does not fire when neither significator occupies the other party's house", () => {
    // NYC chart with distinct significators (Mars querent in 5, Venus quesited
    // in 6, quesited house 7) and no cross-placement.
    const j = judgeAt("2024-05-06T20:00:00", 40.7128, -74.006, "America/New_York", 7);
    expect(j.querentSignificator).not.toBe(j.quesitedSignificator);
    expect(j.testimonies.some((t) => t.includes("perfection by location"))).toBe(false);
    expect(sumOfDisplayedWeights(j.testimonies)).toBe(j.score);
  });

  it("does not fire when querent and quesited share the same significator (no self-placement credit)", () => {
    // London chart where Saturn rules BOTH the 1st and the quesited 2nd and sits
    // in the 2nd, well disposed — the cross-placement doctrine presupposes two
    // parties, so the shared ruler earns nothing.
    const j = judgeAt("2024-01-01T08:00:00", 51.5074, -0.1278, "Europe/London", 2);
    expect(j.querentSignificator).toBe("Saturn");
    expect(j.quesitedSignificator).toBe("Saturn");
    expect(j.quesitedSignificatorHouse).toBe(2);
    expect(j.testimonies.some((t) => t.includes("perfection by location"))).toBe(false);
    expect(sumOfDisplayedWeights(j.testimonies)).toBe(j.score);
  });

  it("gates an ill-disposed located significator (Bonatti's well-disposed condition)", () => {
    // Louis's 2008 Athens pregnancy chart: Mars (5th ruler) IS in the querent's
    // 1st house but in Cancer, its fall (dignity -4) — location only carries a
    // matter the located planet is fit to carry, so no credit.
    const j = judgeAt("2008-05-02T10:25:00", 37.9838, 23.7275, "Europe/Athens", 5);
    expect(j.quesitedSignificator).toBe("Mars");
    expect(j.quesitedSignificatorHouse).toBe(1);
    expect(j.quesitedSignificatorDignity).toBeLessThan(0);
    expect(j.testimonies.some((t) => t.includes("perfection by location"))).toBe(false);
    expect(sumOfDisplayedWeights(j.testimonies)).toBe(j.score);
  });
});
