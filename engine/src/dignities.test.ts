import { describe, expect, it } from "vitest";
import { computeDignities, dignityLordsAtDegree } from "./dignities.js";

/**
 * Dorothean PARTICIPATING (third) triplicity ruler tests.
 *
 * Each element has a day ruler, a night ruler, AND a participating ruler that
 * co-rules the triplicity in BOTH day and night charts. The participating ruler
 * earns a reduced +1 share (the (+3 / 0 / +1) convention — Robert Hand, *Night &
 * Day: Planetary Sect in Astrology*; cross-checked against Dorotheus via Anthony
 * Louis, "Triplicity: The Third Essential Dignity"). Longitudes are absolute
 * ecliptic degrees (Aries 0°=0, Taurus 0°=30, ...).
 */
describe("participating triplicity ruler (Dorothean third lord)", () => {
  it("Fire participating ruler is Saturn, co-ruling day AND night", () => {
    // Sagittarius 5.5° (lon 245.5) is Fire. Fire rulers: Sun (day) / Jupiter
    // (night) / SATURN (participating). At this degree Saturn holds no domicile,
    // exaltation, term, or face — so its ONLY essential dignity is the
    // participating triplicity (+1). Crucially the participating ruler does NOT
    // depend on sect: Saturn scores +1 by day AND by night. Without this rule
    // Saturn would be peregrine (-5) here.
    const day = computeDignities("Saturn", 245.5, "day");
    expect(day.triplicityParticipating).toBe(true);
    expect(day.peregrine).toBe(false);
    expect(day.score).toBe(1); // +1, sole dignity
    expect(day.labels).toEqual(["participating triplicity ruler (+1)"]);

    const night = computeDignities("Saturn", 245.5, "night");
    expect(night.triplicityParticipating).toBe(true);
    expect(night.score).toBe(1); // identical by night — participating co-rules both
  });

  it("participating +1 stacks with term and face (Saturn at Sagittarius 24°)", () => {
    // Sagittarius 24.5° (lon 264.5), day. Fire participating = Saturn (+1);
    // Sagittarius term 21–26 = Saturn (+2); 3rd face (20–30) = Saturn (+1).
    //   participating 1 + term 2 + face 1 = 4.
    const r = computeDignities("Saturn", 264.5, "day");
    expect(r.triplicityParticipating).toBe(true);
    expect(r.term).toBe(true);
    expect(r.face).toBe(true);
    expect(r.score).toBe(4);
    expect(r.labels).toEqual([
      "participating triplicity ruler (+1)",
      "term ruler (+2)",
      "face ruler (+1)",
    ]);
  });

  it("in-sect triplicity ruler keeps the full +3 and is NOT double-counted", () => {
    // Aries 2° (lon 2), day. Fire DAY triplicity = Sun (+3, the full share). The
    // participating ruler (Saturn) is a DIFFERENT planet, so the Sun never gets
    // both +3 and +1. Sun here: exaltation (+4) + day triplicity (+3) = 7.
    const sun = computeDignities("Sun", 2, "day");
    expect(sun.triplicity).toBe(true);
    expect(sun.triplicityParticipating).toBe(false); // never both
    expect(sun.score).toBe(7);
    expect(sun.labels).toEqual([
      "exaltation in Aries (+4)",
      "day triplicity ruler (+3)",
    ]);
  });

  it("Water DAY triplicity is Venus (Dorothean), not Mars", () => {
    // Cancer 2° (lon 92), DAY. The old table wrongly gave Water Mars by both day
    // and night; the correct Dorothean set is Venus (day) / Mars (night) / Moon
    // (participating). So Venus — not Mars — holds the Water day triplicity.
    const lords = dignityLordsAtDegree(92, "day");
    expect(lords.triplicity).toBe("Venus");
    expect(lords.triplicityParticipating).toBe("Moon");
    const lordsNight = dignityLordsAtDegree(92, "night");
    expect(lordsNight.triplicity).toBe("Mars");
    expect(lordsNight.triplicityParticipating).toBe("Moon");
  });

  it("exposes the participating ruler for every element via dignityLordsAtDegree", () => {
    // One representative degree per element (Aries/Taurus/Gemini/Cancer 5°).
    expect(dignityLordsAtDegree(5, "day").triplicityParticipating).toBe("Saturn"); // Fire
    expect(dignityLordsAtDegree(35, "day").triplicityParticipating).toBe("Mars"); // Earth
    expect(dignityLordsAtDegree(65, "day").triplicityParticipating).toBe("Jupiter"); // Air
    expect(dignityLordsAtDegree(95, "day").triplicityParticipating).toBe("Moon"); // Water
  });
});
