import { describe, expect, it } from "vitest";
import { buildChart } from "../src/chart.js";
import { computeDignities, receptionBetween } from "../src/dignities.js";

// Longitude helper: sign index (0=Aries) * 30 + degrees.
function lon(signIndex: number, deg: number): number {
  return signIndex * 30 + deg;
}
const ARIES = 0, TAURUS = 1, GEMINI = 2, CANCER = 3, LEO = 4, PISCES = 11;

describe("computeDignities", () => {
  it("scores domicile (+5)", () => {
    const d = computeDignities("Mars", lon(ARIES, 5), "day"); // Mars rules Aries
    expect(d.domicile).toBe(true);
    expect(d.score).toBeGreaterThanOrEqual(5);
  });

  it("scores exaltation (+4) and stacks with triplicity by sect", () => {
    // Sun at 2° Aries: exalted (+4) and the day triplicity ruler of Fire (+3),
    // with no term/face there (term 0-6 = Jupiter, face 0-10 = Mars).
    const day = computeDignities("Sun", lon(ARIES, 2), "day");
    expect(day.exaltation).toBe(true);
    expect(day.triplicity).toBe(true);
    expect(day.score).toBe(7);
    // At night the Fire triplicity ruler is Jupiter, so the Sun loses the +3.
    const night = computeDignities("Sun", lon(ARIES, 2), "night");
    expect(night.triplicity).toBe(false);
    expect(night.score).toBe(4);
  });

  it("scores detriment and fall together (Mercury in Pisces = -9)", () => {
    const d = computeDignities("Mercury", lon(PISCES, 20), "day");
    expect(d.detriment).toBe(true); // Mercury rules Virgo, opposite is Pisces
    expect(d.fall).toBe(true); // Mercury exalted in Virgo, falls in Pisces
    expect(d.score).toBe(-9);
  });

  it("marks a planet with no dignity as peregrine (-5)", () => {
    // The Moon at 15° Leo: not ruler/exalted/triplicity/term/face there.
    const d = computeDignities("Moon", lon(LEO, 15), "day");
    expect(d.peregrine).toBe(true);
    expect(d.score).toBe(-5);
  });

  it("credits term and face rulers", () => {
    // 2° Aries: Egyptian term ruler is Jupiter (0-6), face ruler is Mars (0-10).
    expect(computeDignities("Jupiter", lon(ARIES, 2), "day").term).toBe(true);
    expect(computeDignities("Mars", lon(ARIES, 2), "day").face).toBe(true);
  });
});

describe("receptionBetween", () => {
  it("detects mutual reception by domicile (Venus in Aries, Mars in Taurus)", () => {
    // Venus in Aries (Mars's sign); Mars in Taurus (Venus's sign).
    const r = receptionBetween("Venus", lon(ARIES, 10), "Mars", lon(TAURUS, 10));
    expect(r).not.toBeNull();
    expect(r!.kind).toBe("mutual");
    expect(r!.aReceivesBBy).toBe("domicile");
    expect(r!.bReceivesABy).toBe("domicile");
  });

  it("returns null when neither planet dignifies the other", () => {
    // Saturn in Gemini, Mars in Cancer: neither rules/exalts the other's sign.
    const r = receptionBetween("Saturn", lon(GEMINI, 5), "Mars", lon(CANCER, 5));
    expect(r).toBeNull();
  });
});

describe("buildChart enrichment", () => {
  it("attaches sect, a Part of Fortune, and dignities to classical planets", () => {
    const chart = buildChart("horary", {
      datetimeLocal: "2026-03-01T11:00:00",
      latitude: 51.5,
      longitude: -0.12,
      timezone: "Europe/London",
    });
    expect(["day", "night"]).toContain(chart.sect);
    expect(chart.partOfFortune.longitude).toBeGreaterThanOrEqual(0);
    expect(chart.partOfFortune.longitude).toBeLessThan(360);
    expect(chart.partOfFortune.house).toBeGreaterThanOrEqual(1);
    expect(chart.partOfFortune.house).toBeLessThanOrEqual(12);
    // The seven classical planets carry dignities; outer points do not.
    const venus = chart.planets.find((p) => p.name === "Venus")!;
    expect(venus.dignities).toBeTruthy();
    expect(typeof venus.dignities!.score).toBe("number");
    const pluto = chart.planets.find((p) => p.name === "Pluto")!;
    expect(pluto.dignities).toBeUndefined();
    // Every body gets a house placement (1..12).
    for (const p of chart.planets) {
      expect(p.house).toBeGreaterThanOrEqual(1);
      expect(p.house).toBeLessThanOrEqual(12);
    }
  });
});
