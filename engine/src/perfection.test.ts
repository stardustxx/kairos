import { describe, expect, it } from "vitest";
import { DEGREES_PER_SIGN, SIGN_COUNT, SIGNS } from "./constants.js";
import { judgeHorary } from "./horary.js";
import { detectBesieging, detectProhibition, detectRefranation } from "./perfection.js";
import type { Chart, PlanetPosition } from "./types.js";

/**
 * Minimal planet fixtures. The perfection detectors only read name, longitude,
 * speed, and retrograde; sign/degInSign are derived from longitude so the bodies
 * are internally consistent. Speeds are in degrees/day (Moon ~13, Mercury/Venus
 * ~1.2, Mars ~0.5, the outers slower) so relative-velocity timing is realistic.
 */
function planet(
  name: string,
  longitude: number,
  speed: number,
  retrograde = false,
): PlanetPosition {
  const lon = ((longitude % 360) + 360) % 360;
  const si = Math.floor(lon / DEGREES_PER_SIGN) % SIGN_COUNT;
  return {
    name,
    longitude: lon,
    sign: SIGNS[si],
    degInSign: lon - si * DEGREES_PER_SIGN,
    retrograde,
    speed,
  };
}

describe("detectProhibition", () => {
  it("flags a third planet that perfects with a significator first", () => {
    // Significators Sun (querent) and Saturn (quesited) apply to a conjunction,
    // 6° apart and closing slowly (Sun 1.0, Saturn 0.03 => rel ~0.97 deg/day,
    // ~6.2 days to perfect). A fast Moon at 2° behind the Sun, closing at ~12
    // deg/day, perfects with the Sun in ~0.17 days — long before the
    // significators. That is prohibition.
    const planets = [
      planet("Sun", 100, 1.0),
      planet("Saturn", 106, 0.03),
      // Moon 7° behind the Sun (out of conjunction orb to Saturn at 13°), so it
      // applies only to the Sun and perfects there first.
      planet("Moon", 93, 13.0),
      planet("Mars", 250, 0.5), // far away, irrelevant
    ];
    const p = detectProhibition("Sun", "Saturn", planets);
    expect(p).not.toBeNull();
    expect(p?.prohibitor).toBe("Moon");
    expect(p?.target).toBe("Sun");
    expect(p?.aspect).toBe("conjunction");
  });

  it("returns null when no third planet beats the significators", () => {
    // Significators close fast; the only other body is far out of orb.
    const planets = [
      planet("Sun", 100, 1.0),
      planet("Saturn", 102, 0.03), // 2° apart, applying conjunction
      planet("Moon", 200, 13.0), // 100° from both — no aspect at all
    ];
    expect(detectProhibition("Sun", "Saturn", planets)).toBeNull();
  });

  it("returns null when the significators do not even apply", () => {
    // Separating significators (Sun ahead and pulling away) cannot be prohibited.
    const planets = [
      planet("Sun", 104, 1.0),
      planet("Saturn", 100, 0.03), // Sun separating from Saturn
      planet("Moon", 102, 13.0),
    ];
    expect(detectProhibition("Sun", "Saturn", planets)).toBeNull();
  });
});

describe("detectRefranation", () => {
  it("flags a retrograde significator while the aspect is still applying", () => {
    // Mercury (retrograde at 55°) and Venus (50°, direct, faster) apply to a
    // conjunction — Venus is catching up so the aspect is still applying — but
    // Mercury is backing out and will withdraw before perfection: refranation.
    const planets = [
      planet("Mercury", 55, -0.8, true), // retrograde significator
      planet("Venus", 50, 1.0), // applying toward Mercury from behind
    ];
    const r = detectRefranation("Mercury", "Venus", planets);
    expect(r).not.toBeNull();
    expect(r?.planet).toBe("Mercury");
  });

  it("returns null when both significators are direct and applying cleanly", () => {
    const planets = [
      planet("Mercury", 55, 0.9),
      planet("Venus", 50, 1.2), // catching up, both direct
    ];
    expect(detectRefranation("Mercury", "Venus", planets)).toBeNull();
  });

  it("returns null when the significators are not applying", () => {
    // Even a retrograde significator is not a refranation if nothing is forming.
    const planets = [
      planet("Mercury", 50, -0.8, true),
      planet("Venus", 200, 1.0), // far away, no applying aspect
    ];
    expect(detectRefranation("Mercury", "Venus", planets)).toBeNull();
  });

  it("does NOT flag a station-direct significator (about to move forward, not withdraw)", () => {
    // Mercury is near-stationary but with POSITIVE speed: stationing direct, so it
    // is about to go forward and complete the aspect — that is not refranation.
    const planets = [
      planet("Mercury", 55, 0.02), // |speed| <= 0.05 but DIRECT
      planet("Venus", 50, 1.0),
    ];
    expect(detectRefranation("Mercury", "Venus", planets)).toBeNull();
  });

  it("flags a station-retrograde significator (slow and backing up)", () => {
    const planets = [
      planet("Mercury", 55, -0.02), // near-stationary AND moving backward
      planet("Venus", 50, 1.0),
    ];
    const r = detectRefranation("Mercury", "Venus", planets);
    expect(r?.planet).toBe("Mercury");
  });
});

describe("detectBesieging", () => {
  it("flags a planet hemmed bodily between Mars and Saturn", () => {
    // Venus at 100°, Mars at 95° (behind), Saturn at 105° (ahead): within 7° of
    // both, on opposite sides => besieged.
    const planets = [
      planet("Venus", 100, 1.0),
      planet("Mars", 95, 0.5),
      planet("Saturn", 105, 0.03),
    ];
    const b = detectBesieging("Venus", planets);
    expect(b).not.toBeNull();
    expect(b?.betweenOf).toEqual(["Mars", "Saturn"]);
  });

  it("returns null when both malefics are on the same side", () => {
    // Mars and Saturn both ahead of Venus — not hemmed.
    const planets = [
      planet("Venus", 100, 1.0),
      planet("Mars", 103, 0.5),
      planet("Saturn", 105, 0.03),
    ];
    expect(detectBesieging("Venus", planets)).toBeNull();
  });

  it("returns null when a malefic is out of orb", () => {
    const planets = [
      planet("Venus", 100, 1.0),
      planet("Mars", 95, 0.5),
      planet("Saturn", 130, 0.03), // 30° away — too far
    ];
    expect(detectBesieging("Venus", planets)).toBeNull();
  });

  it("does not flag a malefic as besieged by itself", () => {
    const planets = [
      planet("Mars", 100, 0.5),
      planet("Saturn", 105, 0.03),
    ];
    expect(detectBesieging("Mars", planets)).toBeNull();
  });
});

/**
 * Build a synthetic horary Chart from a planet list and explicit cusps. Only the
 * fields judgeHorary reads need to be present; aspects/angleAspects/partOfFortune
 * are filled minimally. Cusps are chosen so the 1st-house ruler is the querent
 * significator and the quesited-house ruler is the quesited significator.
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
    partOfFortune: {
      longitude: 0,
      sign: SIGNS[0],
      degInSign: 0,
      house: 1,
    },
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

describe("judgeHorary applies perfection-breaker debits", () => {
  // Ascendant in Leo (135°) => querent significator Sun. The 7th cusp lands in
  // Aquarius (315°) => quesited significator Saturn. (Equal houses keep this
  // deterministic.) Both rule by domicile so the significators are Sun & Saturn.
  const ascLeo = 135;

  // Sum the trailing "(±N)" weights embedded in the testimony strings. The
  // aggregate score is exactly this sum, so parsing it confirms each pushed
  // testimony (including a breaker's debit) actually contributed to the score.
  function sumTestimonyWeights(testimonies: string[]): number {
    let total = 0;
    for (const s of testimonies) {
      const m = s.match(/\(([+-]?\d+)\)\s*$/);
      if (m) total += Number(m[1]);
    }
    return total;
  }

  it("prohibition WITHOUT reception cuts off otherwise-applying significators (-25)", () => {
    // Sun (querent) & Saturn (quesited) apply to conjunction at 250° & 256°
    // (Sagittarius). The other bodies are parked around 220-226°, making no aspect
    // to either significator. Moon 7° behind the Sun (243°, Sagittarius) applies to
    // it and perfects first => prohibition. The Moon neither rules (Jupiter) nor
    // exalts in Sagittarius, so it does NOT receive the Sun — a clean no-reception
    // prohibition. The -25 testimony must be present and part of the score.
    const planets = [
      planet("Sun", 250, 1.0),
      planet("Saturn", 256, 0.03),
      planet("Moon", 243, 13.0),
      planet("Mercury", 220, 1.2),
      planet("Venus", 222, 1.1),
      planet("Mars", 224, 0.5),
      planet("Jupiter", 226, 0.08),
    ];
    const j = judgeHorary(chartOf(planets, equalCusps(ascLeo)), 7);
    expect(j.prohibition).not.toBeNull();
    expect(j.prohibition?.prohibitor).toBe("Moon");
    expect(j.prohibition?.receivesTarget).toBe(false);
    expect(j.prohibition?.mutualReception).toBe(false);
    const breaker = j.testimonies.find((s) => s.includes("Prohibition"));
    expect(breaker).toBeDefined();
    expect(breaker).toContain("(-25)");
    // The received-prohibition (+5) testimony must NOT appear; this denies.
    expect(j.testimonies.some((s) => s.includes("perfects with labour"))).toBe(false);
    // The perfection is marked broken-by-prohibition.
    expect(j.perfection.broken).toContain("prohibition");
    // The -25 is genuinely summed into the aggregate score (engine invariant:
    // score == sum of the signed weights in the testimonies).
    expect(sumTestimonyWeights(j.testimonies)).toBe(j.score);
    expect(j.testimonies.filter((s) => s.includes("Prohibition")).length).toBe(1);
  });

  it("prohibition WITH reception is not a denial — perfects with labour (+5), not broken", () => {
    // Same geometry, but in Cancer: Sun (querent) & Saturn (quesited) apply to a
    // conjunction at 100° & 106° (Cancer). Moon 7° behind the Sun at 93° (Cancer)
    // applies to it and perfects first => prohibition. BUT the Moon RULES Cancer,
    // so the Moon RECEIVES the Sun by domicile: classically the matter is NOT cut
    // off — it perfects with labour. The -25 must NOT be applied; instead a +5
    // "perfects with labour" testimony, and the perfection is NOT broken-by-
    // prohibition. Other bodies parked at 70-76° make no interfering aspect.
    const planets = [
      planet("Sun", 100, 1.0),
      planet("Saturn", 106, 0.03),
      planet("Moon", 93, 13.0),
      planet("Mercury", 70, 1.2),
      planet("Venus", 72, 1.1),
      planet("Mars", 74, 0.5),
      planet("Jupiter", 76, 0.08),
    ];
    const j = judgeHorary(chartOf(planets, equalCusps(ascLeo)), 7);
    expect(j.prohibition).not.toBeNull();
    expect(j.prohibition?.prohibitor).toBe("Moon");
    expect(j.prohibition?.target).toBe("Sun");
    // The Moon rules Cancer, so it receives the Sun by domicile.
    expect(j.prohibition?.receivesTarget).toBe(true);
    // No -25 denial; instead the +5 "perfects with labour" testimony.
    expect(j.testimonies.some((s) => s.includes("(-25)"))).toBe(false);
    const received = j.testimonies.find((s) => s.includes("perfects with labour"));
    expect(received).toBeDefined();
    expect(received).toContain("(+5)");
    // A received prohibition does NOT break perfection.
    expect(j.perfection.broken).not.toContain("prohibition");
    // Invariant: score == sum of the signed testimony weights, with the +5 folded in.
    expect(sumTestimonyWeights(j.testimonies)).toBe(j.score);
  });

  it("a clean chart with no breakers reports none and no breaker testimonies", () => {
    // Significators far apart and not hemmed; no third-planet interception.
    const planets = [
      planet("Sun", 100, 1.0),
      planet("Saturn", 200, 0.03),
      planet("Moon", 50, 13.0),
      planet("Mercury", 95, 1.2),
      planet("Venus", 250, 1.1),
      planet("Mars", 20, 0.5),
      planet("Jupiter", 300, 0.08),
    ];
    const j = judgeHorary(chartOf(planets, equalCusps(ascLeo)), 7);
    expect(j.prohibition).toBeNull();
    expect(j.refranation).toBeNull();
    expect(j.besieging).toEqual([]);
    expect(j.testimonies.some((s) => s.includes("Prohibition"))).toBe(false);
    expect(j.testimonies.some((s) => s.includes("besieged"))).toBe(false);
  });

  it("a besieged significator pushes a -12 affliction testimony", () => {
    // Saturn (quesited) is one of the malefics, so besiege the querent Sun:
    // Mars behind (95°) and Saturn ahead (105°) hem the Sun at 100°. Because
    // Saturn here doubles as the quesited significator, the chart still resolves;
    // the Sun is besieged between the two malefics.
    const planets = [
      planet("Sun", 100, 1.0),
      planet("Mars", 95, 0.5),
      planet("Saturn", 105, 0.03),
      planet("Moon", 40, 13.0),
      planet("Mercury", 200, 1.2),
      planet("Venus", 250, 1.1),
      planet("Jupiter", 300, 0.08),
    ];
    const j = judgeHorary(chartOf(planets, equalCusps(ascLeo)), 7);
    expect(j.besieging.some((b) => b.planet === "Sun" && b.significator === "querent")).toBe(true);
    expect(j.testimonies.some((s) => s.includes("Sun") && s.includes("besieged") && s.includes("-12"))).toBe(
      true,
    );
  });

  it("counts a besieged shared significator only once (no -24 double-count)", () => {
    // Ascendant Taurus (30°) => querent significator Venus. With equal houses the
    // 6th cusp falls in Libra (180°) => quesited significator is ALSO Venus. If
    // Venus is besieged, the affliction must be scored once, not once per role.
    const planets = [
      planet("Venus", 100, 1.0), // the shared significator, hemmed below
      planet("Mars", 95, 0.5),
      planet("Saturn", 105, 0.03),
      planet("Sun", 200, 1.0),
      planet("Moon", 40, 13.0),
      planet("Mercury", 220, 1.2),
      planet("Jupiter", 300, 0.08),
    ];
    const j = judgeHorary(chartOf(planets, equalCusps(30)), 6);
    expect(j.besieging).toHaveLength(1);
    expect(j.besieging[0]).toEqual({ significator: "querent", planet: "Venus" });
    const besiegedTestimonies = j.testimonies.filter((s) => s.includes("besieged"));
    expect(besiegedTestimonies).toHaveLength(1);
  });
});
