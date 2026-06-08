/*
 * perfection-refine.test.ts — translation/collection interplay with the
 * perfection-breakers (Feature D).
 *
 * These exercise the COHERENT perfection picture:
 *   - an impeded (combust/besieged) carrier cannot deliver the indirect
 *     perfection, so its +18/+15 is suppressed and an impedance note is pushed;
 *   - a direct prohibition with a SOUND surviving translation/collection earns a
 *     +12 indirect recovery and sets perfection.indirectPath;
 *   - when the prohibitor IS the translator the light is one body — that is
 *     abscission, not rescue, so NO recovery is awarded;
 *   - a clean perfecting chart reports perfection.direct === true, broken === [].
 */
import { describe, expect, it } from "vitest";
import { DEGREES_PER_SIGN, SIGN_COUNT, SIGNS } from "./constants.js";
import { judgeHorary } from "./horary.js";
import type { Chart, PlanetPosition, SolarPhase } from "./types.js";

/** Minimal planet fixture (same shape as perfection.test.ts), with an optional
 *  solar phase so a carrier can be made combust deterministically. */
function planet(
  name: string,
  longitude: number,
  speed: number,
  opts: { retrograde?: boolean; solar?: SolarPhase } = {},
): PlanetPosition {
  const lon = ((longitude % 360) + 360) % 360;
  const si = Math.floor(lon / DEGREES_PER_SIGN) % SIGN_COUNT;
  const p: PlanetPosition = {
    name,
    longitude: lon,
    sign: SIGNS[si],
    degInSign: lon - si * DEGREES_PER_SIGN,
    retrograde: opts.retrograde ?? false,
    speed,
  };
  if (opts.solar) {
    p.sunProximity = { state: opts.solar, distanceDeg: opts.solar === "combust" ? 5 : 20 };
  }
  return p;
}

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

function equalCusps(ascLon: number): number[] {
  return Array.from({ length: 12 }, (_, i) => (((ascLon + i * 30) % 360) + 360) % 360);
}

/** Engine invariant (shared with perfection.test.ts): the aggregate score equals
 *  the sum of the trailing "(±N)" weights embedded in the testimony strings. */
function sumTestimonyWeights(testimonies: string[]): number {
  let total = 0;
  for (const s of testimonies) {
    const m = s.match(/\(([+-]?\d+)\)\s*$/);
    if (m) total += Number(m[1]);
  }
  return total;
}

// Ascendant Leo (135°) => querent significator Sun; equal 7th cusp in Aquarius
// (315°) => quesited significator Saturn.
const ascLeo = 135;

describe("impeded carrier suppresses indirect perfection (Feature D rule 1)", () => {
  it("a combust translator does NOT deliver: +18 suppressed, impedance noted", () => {
    // Significators Sun (querent) and Saturn (quesited) are far apart and NOT
    // applying to each other (Sun 100°, Saturn 250° => no aspect), so there is no
    // direct perfection and no prohibition to confuse the picture. Mercury
    // translates: it has SEPARATED from Saturn (just past a trine) and is APPLYING
    // to the Sun. But Mercury is combust, so the light is not delivered.
    //
    // Geometry: Saturn 250°, Sun 100°. Mercury at 109° → 9° ahead of the Sun
    // (applying conjunction as Mercury is slower... use Mercury behind so it
    // applies). Put Mercury at 94° applying to Sun conjunction (Sun faster pulls
    // away? Sun 1.0 > Mercury — make Mercury faster). Mercury 1.4 deg/day, Sun
    // 1.0: Mercury at 94° is 6° behind and closing => applying conjunction to Sun.
    // Mercury–Saturn: Saturn at 250°, Mercury 94°, trine is 120° => exact at 130°
    // or 10°; 94 vs 250 separation 156°, not a trine. Use a sextile (60°): Saturn
    // 250°, sextile points 190°/310°. Not matching. Simplify: place Saturn so a
    // clean separating trine to Mercury exists. Saturn at 214° → Mercury 94°:
    // separation 120° (trine). Mercury faster & moving away from Saturn (since
    // Mercury at 94 increasing, Saturn ahead at 214: gap 120 growing => separating
    // trine). Good: Mercury separates from Saturn-trine, applies to Sun-conjunction.
    const planets = [
      planet("Sun", 100, 1.0),
      planet("Saturn", 214, 0.03),
      planet("Mercury", 94, 1.4, { solar: "combust" }),
      planet("Moon", 30, 13.0),
      planet("Venus", 320, 1.1),
      planet("Mars", 20, 0.5),
      planet("Jupiter", 300, 0.08),
    ];
    const j = judgeHorary(chartOf(planets, equalCusps(ascLeo)), 7);
    expect(j.translationOfLight).not.toBeNull();
    expect(j.translationOfLight?.translator).toBe("Mercury");
    // No +18 awarded; a FAILS/impeded note is present instead.
    const fail = j.testimonies.find((s) => s.includes("Translation") && s.includes("FAILS"));
    expect(fail).toBeDefined();
    expect(fail).toContain("combust");
    expect(j.testimonies.some((s) => s.includes("Translation") && s.includes("(+18)"))).toBe(false);
    // The impeded carrier yields no surviving indirect path.
    expect(j.perfection.indirectPath).toBeNull();
    // Score invariant still holds (the suppressed line carries a (0) weight).
    expect(sumTestimonyWeights(j.testimonies)).toBe(j.score);
  });
});

describe("indirect rescue from prohibition (Feature D rule 2)", () => {
  it("prohibition + a sound translation yields +12 recovery and sets indirectPath", () => {
    // Sun (querent) & Saturn (quesited) apply to a conjunction (100° & 106°),
    // closing slowly. The Moon at 93° (7° behind the Sun) perfects with the Sun
    // first => prohibition. Mercury TRANSLATES soundly: separating from Saturn,
    // applying to the Sun, and is NOT combust/besieged. Because the prohibitor
    // (Moon) is NOT the translator (Mercury), the matter can still come together
    // indirectly => +12 recovery, perfection.indirectPath === "Mercury".
    //
    // Mercury geometry: applying-conjunction to Sun (Mercury 95°, faster 1.5),
    // separating trine from Saturn. Saturn 106°, trine points 226°/-14°(346°);
    // pick Saturn-trine via the OTHER significator path — translation needs
    // Mercury aspecting BOTH significators. Mercury 95° to Sun 100°: conjunction
    // applying. Mercury 95° to Saturn 106°: 11° — not a major aspect. Need
    // Mercury to also aspect Saturn. Place Mercury so it sextiles Saturn while
    // conjoining the Sun is impossible (Sun & Saturn only 6° apart). Instead make
    // the translation run the OTHER direction: Mercury separating from the Sun,
    // applying to Saturn. Mercury just past the Sun (102°, moving 1.5 > Sun 1.0,
    // so pulling ahead = separating conjunction from Sun) and applying to Saturn
    // (106°, conjunction, Mercury closing). 102→106 gap 4°, Mercury faster closes
    // => applying conjunction to Saturn. Sun–Mercury: 100 vs 102, Mercury ahead &
    // faster => separating. Translation: from Sun → to Saturn by Mercury. Sound.
    const planets = [
      planet("Sun", 100, 1.0),
      planet("Saturn", 106, 0.03),
      planet("Moon", 93, 13.0), // prohibitor: perfects with the Sun first
      planet("Mercury", 102, 1.5), // sound translator Sun → Saturn
      planet("Venus", 300, 1.1),
      planet("Mars", 20, 0.5),
      planet("Jupiter", 320, 0.08),
    ];
    const j = judgeHorary(chartOf(planets, equalCusps(ascLeo)), 7);
    expect(j.prohibition).not.toBeNull();
    expect(j.translationOfLight?.translator).toBe("Mercury");
    expect(j.prohibition?.prohibitor).not.toBe("Mercury");
    // The +12 recovery is present and named.
    const recovery = j.testimonies.find((s) => s.includes("Indirect recovery"));
    expect(recovery).toBeDefined();
    expect(recovery).toContain("Mercury");
    expect(recovery).toContain("(+12)");
    expect(j.perfection.indirectPath).toBe("Mercury");
    expect(j.perfection.broken).toContain("prohibition");
    expect(j.perfection.direct).toBe(false);
    expect(sumTestimonyWeights(j.testimonies)).toBe(j.score);
  });

  it("when the prohibitor IS the translator there is NO recovery (abscission)", () => {
    // Same prohibition, but now the SAME planet (the Moon) is both the prohibitor
    // AND the translator. One light cutting the matter off is abscission, not a
    // rescue: no +12 recovery, and the synthesis records the prohibition with no
    // surviving indirect path through that body.
    //
    // Moon at 99° translates Sun → Saturn: it has just SEPARATED from the Sun
    // (Moon 99°, Sun 100° — a 1° conjunction the fast Moon is leaving) and is
    // APPLYING to Saturn (99° → 106°, 7° closing conjunction). That same Moon→
    // Saturn contact perfects long before the slow Sun⇄Saturn conjunction, so the
    // Moon is ALSO the prohibitor targeting Saturn — one light, hence abscission.
    const planets = [
      planet("Sun", 100, 1.0),
      planet("Saturn", 106, 0.03),
      planet("Moon", 99, 13.0), // both prohibitor (→Saturn) and translator
      planet("Mercury", 300, 1.2),
      planet("Venus", 320, 1.1),
      planet("Mars", 20, 0.5),
      planet("Jupiter", 240, 0.08),
    ];
    const j = judgeHorary(chartOf(planets, equalCusps(ascLeo)), 7);
    expect(j.prohibition).not.toBeNull();
    expect(j.translationOfLight?.translator).toBe("Moon");
    // The prohibitor and translator are the SAME body.
    expect(j.prohibition?.prohibitor).toBe(j.translationOfLight?.translator);
    // No recovery testimony, no surviving indirect path.
    expect(j.testimonies.some((s) => s.includes("Indirect recovery"))).toBe(false);
    expect(j.perfection.indirectPath).toBeNull();
    expect(j.perfection.broken).toContain("prohibition");
    expect(sumTestimonyWeights(j.testimonies)).toBe(j.score);
  });
});

describe("synthesis field for a clean perfecting chart (Feature D rule 3)", () => {
  it("reports perfection.direct === true with empty broken[]", () => {
    // Sun (querent) & Saturn (quesited) apply to a sextile (Sun 100°, Saturn 162°
    // => 62° apart, closing as the Sun gains on slow Saturn) with no third-planet
    // interception, no retrograde/stationing significator, and no besieging.
    // Filler bodies sit at longitudes that make NO major aspect to either
    // significator (Sun 100°, Saturn 162°), so nothing intercepts or besieges.
    const planets = [
      planet("Sun", 100, 1.0),
      planet("Saturn", 162, 0.03), // applying sextile to the Sun
      planet("Moon", 240, 13.0),
      planet("Mercury", 270, 1.2),
      planet("Venus", 320, 1.1),
      planet("Mars", 20, 0.5),
      planet("Jupiter", 330, 0.08),
    ];
    const j = judgeHorary(chartOf(planets, equalCusps(ascLeo)), 7);
    expect(j.significatorAspect?.applying).toBe(true);
    expect(j.prohibition).toBeNull();
    expect(j.refranation).toBeNull();
    expect(j.besieging).toEqual([]);
    expect(j.perfection.direct).toBe(true);
    expect(j.perfection.broken).toEqual([]);
    expect(j.perfection.summary).toContain("Direct perfection");
    expect(sumTestimonyWeights(j.testimonies)).toBe(j.score);
  });
});
