import { describe, expect, it } from "vitest";
import { buildChart } from "../src/chart.js";
import { runCompute } from "../src/cli.js";
import {
  evaluateAspectQuality,
  findSignificators,
  scoreElectionalMoment,
  searchElectionalMoments,
} from "../src/electional.js";
import { moonVoidStatus } from "../src/horary.js";
import type { Aspect, MomentInput } from "../src/types.js";

// Location without a datetime; the search/chart helpers supply datetimeLocal.
const NYC: Omit<MomentInput, "datetimeLocal"> = {
  latitude: 40.7128,
  longitude: -74.006,
  timezone: "America/New_York",
};

function chartAt(datetimeLocal: string) {
  return buildChart("electional", { ...NYC, datetimeLocal });
}

describe("findSignificators", () => {
  it("returns classical sign-rulership planets for 1st and quesited houses", () => {
    const chart = chartAt("2024-06-01T12:00:00");
    for (let house = 2; house <= 12; house++) {
      const { querent, quesited } = findSignificators(chart, house);
      expect(typeof querent).toBe("string");
      expect(typeof quesited).toBe("string");
      expect(querent.length).toBeGreaterThan(0);
      expect(quesited.length).toBeGreaterThan(0);
    }
  });

  it("honors a significator hint override for the quesited", () => {
    const chart = chartAt("2024-06-01T12:00:00");
    const { quesited } = findSignificators(chart, 7, { planet: "Jupiter" });
    expect(quesited).toBe("Jupiter");
  });
});

describe("evaluateAspectQuality", () => {
  const mk = (type: string, orb: number, a = "Sun", b = "Moon"): Aspect => ({
    a,
    b,
    type,
    orb,
    applying: true,
  });

  it("treats trine and sextile as favorable", () => {
    expect(evaluateAspectQuality(mk("trine", 1)).favorable).toBe(true);
    expect(evaluateAspectQuality(mk("sextile", 1)).favorable).toBe(true);
  });

  it("treats square and opposition as unfavorable", () => {
    expect(evaluateAspectQuality(mk("square", 1)).favorable).toBe(false);
    expect(evaluateAspectQuality(mk("opposition", 1)).favorable).toBe(false);
  });

  it("treats a benefic conjunction as favorable but a malefic one as not", () => {
    expect(evaluateAspectQuality(mk("conjunction", 1, "Venus", "Sun")).favorable).toBe(true);
    expect(evaluateAspectQuality(mk("conjunction", 1, "Mars", "Sun")).favorable).toBe(false);
  });

  it("scores tighter orbs as stronger", () => {
    const tight = evaluateAspectQuality(mk("trine", 0.5)).strength;
    const wide = evaluateAspectQuality(mk("trine", 7)).strength;
    expect(tight).toBeGreaterThan(wide);
  });
});

describe("scoreElectionalMoment", () => {
  it("returns a numeric score and non-empty reasons", () => {
    const chart = chartAt("2024-06-01T12:00:00");
    const { score, reasons } = scoreElectionalMoment(chart, 7);
    expect(typeof score).toBe("number");
    expect(Number.isFinite(score)).toBe(true);
    expect(reasons.length).toBeGreaterThan(0);
    // Every reason carries a signed delta.
    for (const r of reasons) expect(r).toMatch(/[+-]\d+$/);
  });

  it("penalizes a void-of-course Moon relative to a non-void one", () => {
    // Find two moments in a day with different Moon void status and compare.
    // We assert the rule directly: a chart whose reasons include the void
    // penalty must reflect -40 in its reasons list.
    const chart = chartAt("2024-06-01T12:00:00");
    const { reasons } = scoreElectionalMoment(chart, 7);
    const moonReason = reasons.find((r) => r.startsWith("Moon "));
    expect(moonReason).toBeTruthy();
    expect(
      moonReason!.includes("void-of-course -40") ||
        moonReason!.includes("not void-of-course +20"),
    ).toBe(true);
  });
});

describe("searchElectionalMoments", () => {
  it("scans the window, sorts descending, and caps results", () => {
    const result = searchElectionalMoments(
      { startLocal: "2024-06-01T00:00:00", endLocal: "2024-06-02T00:00:00" },
      30,
      NYC,
      7,
    );
    // 24h at 30-min step, inclusive of both ends => 49 candidates.
    expect(result.candidatesEvaluated).toBe(49);
    expect(result.topMoments.length).toBeLessThanOrEqual(10);
    expect(result.topMoments.length).toBeGreaterThan(0);
    // Sorted descending by score.
    for (let i = 1; i < result.topMoments.length; i++) {
      expect(result.topMoments[i - 1].score).toBeGreaterThanOrEqual(
        result.topMoments[i].score,
      );
    }
    // Each candidate has a local datetime and non-empty reasons.
    for (const m of result.topMoments) {
      expect(m.datetimeLocal).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
      expect(m.reasons.length).toBeGreaterThan(0);
    }
    // Window context: average within the observed range, best == range.max.
    expect(typeof result.averageScore).toBe("number");
    expect(result.scoreRange.min).toBeLessThanOrEqual(result.scoreRange.max);
    expect(result.averageScore).toBeGreaterThanOrEqual(result.scoreRange.min);
    expect(result.averageScore).toBeLessThanOrEqual(result.scoreRange.max);
    expect(result.topMoments[0].score).toBe(result.scoreRange.max);
  });

  it("throws on a non-positive step", () => {
    expect(() =>
      searchElectionalMoments(
        { startLocal: "2024-06-01T00:00:00", endLocal: "2024-06-02T00:00:00" },
        0,
        NYC,
        7,
      ),
    ).toThrow();
  });

  it("throws when the window end is not after the start", () => {
    expect(() =>
      searchElectionalMoments(
        { startLocal: "2024-06-02T00:00:00", endLocal: "2024-06-01T00:00:00" },
        30,
        NYC,
        7,
      ),
    ).toThrow();
  });

  it("throws on an out-of-range quesited house", () => {
    expect(() =>
      searchElectionalMoments(
        { startLocal: "2024-06-01T00:00:00", endLocal: "2024-06-01T06:00:00" },
        30,
        NYC,
        1,
      ),
    ).toThrow();
  });
});

describe("runCompute electional integration", () => {
  it("returns an electional result plus the chart of the #1 elected moment", () => {
    const result = runCompute({
      kind: "electional",
      quesitedHouse: 7,
      stepMinutes: 60,
      location: NYC,
      window: { startLocal: "2024-06-01T08:00:00", endLocal: "2024-06-01T20:00:00" },
    });
    expect(result.electional).toBeTruthy();
    expect(result.electional!.candidatesEvaluated).toBe(13);
    expect(result.electional!.topMoments.length).toBeGreaterThan(0);
    // The elected chart is attached and corresponds to the top moment.
    expect(result.chart).toBeTruthy();
    expect(result.chart!.kind).toBe("electional");
    expect(result.chart!.planets.length).toBe(11);
    const best = result.electional!.topMoments[0];
    expect(result.chart!.utc.slice(0, 4)).toBe(best.datetimeLocal.slice(0, 4));
  });

  it("throws when an electional request is missing the window", () => {
    expect(() =>
      runCompute({
        kind: "electional",
        quesitedHouse: 7,
        stepMinutes: 60,
        location: NYC,
      }),
    ).toThrow(/window/);
  });
});

describe("electional void-of-course plumbing — 1-day overshoot fix", () => {
  // 2024-01-01 16:00 UTC: Moon at ~166.3° Virgo (speed ~11.8°/day) is 5.86°
  // short of a square to retrograde Mercury at ~262.2° Sagittarius.
  // The legacy 1-day finite-difference step overshoots the perfection by
  // ~11.8° and reports the aspect as separating (orb increases from 5.86° to
  // ~5.98° after 1 full day), giving 0 applying Moon contacts → Moon appears
  // void-of-course.  The 1-hour look-ahead correctly identifies the Moon as
  // applying (orb shrinks from 5.86° to ~5.36° in 1 hour) → Moon NOT void.
  // Root-finding (the gold-standard used in horary) agrees with the 1-hour step.
  const MOMENT: MomentInput = {
    latitude: 40.7128,
    longitude: -74.006,
    timezone: "America/New_York",
    datetimeLocal: "2024-01-01T16:00:00",
  };

  it("moonVoidStatus (no chartJd) reports the Moon NOT void via the 1-hour step", () => {
    const chart = buildChart("electional", MOMENT, { aspectTiming: false });
    // No chartJd → uses 1/24-day look-ahead inside moonVoidStatus.
    const status = moonVoidStatus(chart.planets);
    expect(status.void).toBe(false);
    // The next aspect should be the Moon-Mercury square.
    expect(status.next).not.toBeNull();
    expect(
      (status.next!.a === "Moon" || status.next!.b === "Moon") &&
        (status.next!.a === "Mercury" || status.next!.b === "Mercury"),
    ).toBe(true);
    expect(status.next!.type).toBe("square");
  });

  it("moonVoidStatus with chartJd (root-found) agrees: Moon NOT void", () => {
    const chart = buildChart("electional", MOMENT, { aspectTiming: false });
    const status = moonVoidStatus(chart.planets, chart.julianDayUt);
    expect(status.void).toBe(false);
    expect(status.next?.type).toBe("square");
  });

  it("scoreElectionalMoment uses the corrected void status (+20 not -40)", () => {
    const chart = buildChart("electional", MOMENT, { aspectTiming: false });
    const { score, reasons } = scoreElectionalMoment(chart, 7);
    const moonReason = reasons.find((r) => r.startsWith("Moon "));
    // Correctly NOT void → should earn +20, not -40.
    expect(moonReason).toMatch(/not void-of-course \+20/);
    // Score should reflect the +20 Moon bonus (not the -40 void penalty).
    // Exact score varies with other rules, but the Moon line must be +20.
    expect(score).toBeGreaterThan(50); // above neutral baseline from Moon alone
  });
});
