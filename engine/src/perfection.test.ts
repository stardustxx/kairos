import { describe, expect, it } from "vitest";
import { DEGREES_PER_SIGN, SIGN_COUNT, SIGNS } from "./constants.js";
import { judgeHorary } from "./horary.js";
import {
  detectBesieging,
  detectEnclosure,
  detectProhibition,
  detectRefranation,
  prohibitsDelivery,
} from "./perfection.js";
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
    eclipticLatitude: 0,
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

describe("prohibitsDelivery (Moon-sequence prohibition of a translation's carry)", () => {
  // Verified doctrine (Warnock 2004 / 1999 corpus cases): the MOON striking the
  // CARRIER by square/opposition before the carrier's delivering aspect perfects
  // intercepts the light. Soft rays and conjunctions deliberately do not fire
  // (see the scope note in perfection.ts).

  it("fires when the Moon squares the carrier before delivery", () => {
    // Carrier Mercury (100°, 1.2°/day) delivers a conjunction to Saturn (104°,
    // 0.03): orb 4° / rel 1.17 ≈ 3.4 days. The Moon at 4° (separation 96°,
    // closing through the 90° square: orb 6° / rel 11.8 ≈ 0.51 days — wide
    // enough that the one-day applying step does not overshoot) strikes the
    // carrier first.
    const planets = [
      planet("Mercury", 100, 1.2),
      planet("Saturn", 104, 0.03),
      planet("Moon", 4, 13.0),
    ];
    const hit = prohibitsDelivery("Mercury", "Saturn", planets);
    expect(hit).toEqual({ interceptor: "Moon", aspect: "square" });
  });

  it("does NOT fire on a soft Moon contact (sextile/trine assist, not hinder)", () => {
    // Moon at 34° (separation 66°, closing through the 60° sextile, orb 6°,
    // genuinely applying) — perfects long before delivery, but a soft ray is
    // assistance, not interception.
    const planets = [
      planet("Mercury", 100, 1.2),
      planet("Saturn", 104, 0.03),
      planet("Moon", 34, 13.0),
    ];
    expect(prohibitsDelivery("Mercury", "Saturn", planets)).toBeNull();
  });

  it("does NOT fire on a Moon CONJUNCTION with the carrier (deferred doctrine)", () => {
    // Moon at 93° applies a conjunction to Mercury (orb 7°, ≈0.59d, well before
    // the 3.4d delivery) — bodily union can hand light along the relay, so it is
    // deliberately not counted until a corpus case attests either reading.
    const planets = [
      planet("Mercury", 100, 1.2),
      planet("Saturn", 104, 0.03),
      planet("Moon", 93, 13.0),
    ];
    expect(prohibitsDelivery("Mercury", "Saturn", planets)).toBeNull();
  });

  it("does NOT fire when the Moon's ray perfects only AFTER the delivery", () => {
    // Delivery is fast: Mercury → Sun conjunction orb 0.2° / rel 0.5 = 0.4 days.
    // The Moon's square (orb 6° / rel 11.5 ≈ 0.52 days) lands after the light
    // has already arrived — no interception.
    const planets = [
      planet("Mercury", 100, 1.5),
      planet("Sun", 100.2, 1.0),
      planet("Moon", 4, 13.0),
    ];
    expect(prohibitsDelivery("Mercury", "Sun", planets)).toBeNull();
  });

  it("returns null when carrier and destination have no applying aspect", () => {
    // Mercury ahead of Saturn and faster — pulling away, nothing to deliver.
    const planets = [
      planet("Mercury", 104, 1.2),
      planet("Saturn", 100, 0.03),
      planet("Moon", 12, 13.0),
    ];
    expect(prohibitsDelivery("Mercury", "Saturn", planets)).toBeNull();
  });
});

describe("detectEnclosure (besieging/aiding by body or ray)", () => {
  it("flags a malefic enclosure when Mars and Saturn hem a planet by RAY (no bodies adjacent)", () => {
    // Sun at 100°. Mars at 10° squares it from behind (sep -90), Saturn at 190°
    // squares it from ahead (sep +90) — both partile squares, one each side, with
    // no other body or ray intervening. The Sun is besieged by the rays of the
    // two malefics, though neither is bodily near (so detectBesieging is null).
    const planets = [
      planet("Sun", 100, 1.0),
      planet("Mars", 10, 0.5),
      planet("Saturn", 190, 0.03),
      planet("Moon", 300, 13.0), // far, no aspect
    ];
    expect(detectBesieging("Sun", planets)).toBeNull(); // not BODILY besieged
    const e = detectEnclosure("Sun", planets);
    expect(e).not.toBeNull();
    expect(e?.kind).toBe("malefic");
    expect(e?.betweenOf.slice().sort()).toEqual(["Mars", "Saturn"]);
    expect(e?.by).toEqual(["ray", "ray"]);
  });

  it("flags a benefic enclosure when Jupiter and Venus hem a planet by body/ray", () => {
    // Mars at 100°. Venus at 99° sits bodily just behind (conjunction by BODY),
    // Jupiter at 160° trines/sextiles it from ahead. Mars is shielded between the
    // two benefics ("aided") — a protection.
    const planets = [
      planet("Mars", 100, 0.5),
      planet("Venus", 99, 1.1), // bodily behind
      planet("Jupiter", 160, 0.08), // sextile ahead (60°)
      planet("Moon", 300, 13.0),
    ];
    const e = detectEnclosure("Mars", planets);
    expect(e).not.toBeNull();
    expect(e?.kind).toBe("benefic");
    expect(e?.betweenOf.slice().sort()).toEqual(["Jupiter", "Venus"]);
    expect(e?.by).toEqual(["body", "ray"]);
  });

  it("a LOOSER neutral body on a side does not intervene (malefic enclosure survives)", () => {
    // Sun at 100°, Mars square behind (10°, gap 0), Saturn square ahead (190°,
    // gap 0). The Moon at 98° is bodily behind but LOOSER (gap 2) than Mars'
    // partile square (gap 0), and Venus at 101.5° is bodily ahead but looser
    // (gap 1.5) than Saturn's partile square (gap 0). Neither out-tights its
    // malefic, so neither intervenes: the besieging stands.
    const planets = [
      planet("Sun", 100, 1.0),
      planet("Mars", 10, 0.5), // square behind, gap 0
      planet("Saturn", 190, 0.03), // square ahead, gap 0
      planet("Moon", 98, 13.0), // bodily behind, gap 2 (looser than Mars)
      planet("Venus", 101.5, 1.1), // bodily ahead, gap 1.5 (looser than Saturn)
    ];
    const e = detectEnclosure("Sun", planets);
    expect(e?.kind).toBe("malefic");
  });

  it("returns null when a tighter body INTERVENES, breaking a clean malefic pair", () => {
    // Sun at 100°, Mars squares from behind (10°, gap 0), Saturn squares from
    // ahead but 3° off exact (193°, gap 3). Jupiter at 100.5° sits bodily ahead
    // (conjunction, gap 0.5) — TIGHTER than Saturn's 3°-off square — so the
    // tightest touch ahead is Jupiter, not Saturn. The flankers are now Mars
    // (behind) and Jupiter (ahead): neither a pure malefic nor pure benefic pair,
    // so no enclosure. The intervening body genuinely breaks the besieging.
    const planets = [
      planet("Sun", 100, 1.0),
      planet("Mars", 10, 0.5), // square behind, gap 0
      planet("Saturn", 193, 0.03), // square ahead, gap 3
      planet("Jupiter", 100.5, 0.08), // bodily ahead, gap 0.5 — intervenes
    ];
    expect(detectEnclosure("Sun", planets)).toBeNull();
  });

  it("returns null on a clean chart with no flanking pair", () => {
    const planets = [
      planet("Sun", 100, 1.0),
      planet("Mars", 5, 0.5), // 95° away, no aspect within orb of a square (gap 5 < orb but ahead?)
      planet("Saturn", 300, 0.03),
      planet("Venus", 250, 1.1),
      planet("Jupiter", 30, 0.08),
    ];
    // Mars at 5° is 95° from the Sun: 5° off a square — within the Sun-Mars orb,
    // but it is the only flanker on its side and there is no second flanker of a
    // matching pair on the other side, so no enclosure.
    const e = detectEnclosure("Sun", planets);
    // Whatever the behind side resolves to, the ahead side has no Mars/Saturn or
    // Jupiter/Venus partner forming a pure pair, so the result is null.
    expect(e).toBeNull();
  });

  it("does not count an opposition as a flanking contact", () => {
    // An opposition is a confrontation across the chart, not a flank — its "side"
    // is arbitrary near 180°, so it must not act as a hemming contact. Here only
    // Mars truly flanks (behind); Saturn merely opposes, so there is no enclosure.
    const planets = [
      planet("Sun", 100, 1.0),
      planet("Mars", 95, 0.5), // bodily just behind
      planet("Saturn", 280, 0.03), // exact opposition (180°), not a side
    ];
    expect(detectEnclosure("Sun", planets)).toBeNull();
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

  it("a significator besieged BY RAY (not bodily) pushes the -12 affliction", () => {
    // Querent Sun at 250° (Sagittarius). Mars at 160° squares it from behind
    // (sep -90), Saturn at 340° squares it from ahead (sep +90) — both partile,
    // one each side, nothing intervening. Neither malefic is bodily near (so
    // detectBesieging is null), but the Sun is besieged by their RAYS: a -12
    // affliction reported once under `enclosures`. Filler bodies are parked so
    // they make no interfering aspect to either significator.
    const planets = [
      planet("Sun", 250, 1.0),
      planet("Saturn", 340, 0.03),
      planet("Mars", 160, 0.5),
      planet("Moon", 60, 13.0),
      planet("Mercury", 50, 1.2),
      planet("Venus", 70, 1.1),
      planet("Jupiter", 80, 0.08),
    ];
    const j = judgeHorary(chartOf(planets, equalCusps(ascLeo)), 7);
    // Not BODILY besieged (the existing detector stays null) ...
    expect(j.besieging).toEqual([]);
    // ... but flagged as a malefic ray-enclosure.
    expect(j.enclosures.some((e) => e.planet === "Sun" && e.enclosure.kind === "malefic")).toBe(true);
    const ray = j.testimonies.find((s) => s.includes("besieged by the rays of"));
    expect(ray).toBeDefined();
    expect(ray).toContain("(-12)");
    // Scored once; invariant holds.
    expect(j.testimonies.filter((s) => s.includes("besieged")).length).toBe(1);
    expect(sumTestimonyWeights(j.testimonies)).toBe(j.score);
  });

  it("a benefic-enclosed significator pushes the +10 protection", () => {
    // Querent Sun at 250°. Venus at 160° sextiles/squares from behind, Jupiter at
    // 340° from ahead — the Sun is enclosed between the two benefics ("aided").
    // Venus 160° => sep -90 (square ray); Jupiter 340° => sep +90 (square ray).
    // Both within the enclosure cap, one each side, nothing intervening => +10.
    const planets = [
      planet("Sun", 250, 1.0),
      planet("Venus", 160, 1.1),
      planet("Jupiter", 340, 0.08),
      planet("Saturn", 70, 0.03),
      planet("Mars", 60, 0.5),
      planet("Moon", 50, 13.0),
      planet("Mercury", 40, 1.2),
    ];
    const j = judgeHorary(chartOf(planets, equalCusps(ascLeo)), 7);
    expect(j.enclosures.some((e) => e.planet === "Sun" && e.enclosure.kind === "benefic")).toBe(true);
    const shield = j.testimonies.find((s) => s.includes("shielded by both benefics"));
    expect(shield).toBeDefined();
    expect(shield).toContain("(+10)");
    // The synthesis surfaces the shield in its summary.
    expect(j.perfection.summary).toContain("shielded by both benefics");
    expect(sumTestimonyWeights(j.testimonies)).toBe(j.score);
  });

  it("does NOT double-count when a significator is besieged by BOTH body and ray", () => {
    // Querent Sun at 100° hemmed BODILY: Mars at 95° behind, Saturn at 105° ahead
    // (within 7°, opposite sides) => detectBesieging flags. The same geometry is
    // also a ray/body enclosure, but the engine must report the affliction ONCE
    // (strongest form = the body-besieging entry), never -24. So `besieging` holds
    // it, `enclosures` is empty for the Sun, and exactly one -12 appears.
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
    expect(j.besieging.some((b) => b.planet === "Sun")).toBe(true);
    // The Sun is NOT additionally listed under enclosures (no double-count).
    expect(j.enclosures.some((e) => e.planet === "Sun")).toBe(false);
    // Exactly one besieging testimony, exactly one -12 from it.
    const besiegedTestimonies = j.testimonies.filter((s) => s.includes("besieged"));
    expect(besiegedTestimonies).toHaveLength(1);
    expect(sumTestimonyWeights(j.testimonies)).toBe(j.score);
  });

  // ============================================================================
  // CATEGORICAL DENIAL SPINE (Lilly CA Bk. III): a SURVIVING denial suppresses the
  // perfection. When the perfecting aspect is prohibited (unreceived) or refraned
  // before it completes, with no sound translation/collection rescue, the matter
  // does NOT perfect — so it earns NONE of the positive perfection points.
  // ============================================================================

  it("surviving denial: a DIRECT perfection + unreceived prohibition is suppressed → unfavorable", () => {
    // Sun (querent) & Saturn (quesited) apply to a DIRECT conjunction (the +40 soft
    // perfection) at 250° & 256° (Sagittarius). The Moon, 7° behind the Sun, perfects
    // with it first — an UNRECEIVED prohibition (the Moon neither rules nor exalts in
    // Sagittarius), with no translation/collection rescue. Classically the matter is
    // categorically denied: the +40 must be SUPPRESSED to (0), the -25 prohibition
    // dominates, the score goes negative, and the lean is unfavorable.
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
    // The denial survives (unreceived prohibition, no rescue).
    expect(j.prohibition?.receivesTarget).toBe(false);
    expect(j.prohibition?.mutualReception).toBe(false);
    expect(j.perfection.indirectPath).toBeNull();
    // The +40 soft-perfection line is SUPPRESSED — shown as a (0) suppressed line,
    // and the un-suppressed "+40" perfection credit is gone.
    expect(j.testimonies.some((s) => s.includes("Significators perfect by applying"))).toBe(false);
    const suppressed = j.testimonies.find(
      (s) => s.startsWith("Significators apply by conjunction") && s.includes("suppressed"),
    );
    expect(suppressed).toBeDefined();
    expect(suppressed).toContain("(0)");
    expect(suppressed).toContain("prohibited before it completes");
    // The -25 denial is kept and now dominates: negative score, unfavorable lean.
    expect(j.testimonies.some((s) => s.includes("the matter is cut off") && s.includes("(-25)"))).toBe(
      true,
    );
    expect(j.score).toBeLessThan(0);
    expect(j.lean).toBe("unfavorable");
    // The synthesis records the categorical denial.
    expect(j.perfection.summary).toContain("categorically denied");
    // INVARIANT: score == sum of the (adjusted) signed testimony weights — the
    // suppressed line contributes 0, so the sum still reconstructs the live score.
    expect(sumTestimonyWeights(j.testimonies)).toBe(j.score);
  });

  it("RECEIVED prohibition is NOT a surviving denial: the same direct perfection stays favorable", () => {
    // Identical geometry, but in Cancer: Sun & Saturn apply to a conjunction at
    // 100° & 106°, and the Moon (93°) prohibits — BUT the Moon RULES Cancer, so it
    // RECEIVES the Sun by domicile. Reception nullifies the denial (the matter
    // perfects with labour), so this is NOT a surviving denial: the +40 direct
    // perfection is KEPT (not suppressed) and the lean stays favorable, exactly as
    // before the denial-spine change.
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
    expect(j.prohibition?.receivesTarget).toBe(true);
    // The +40 direct perfection is KEPT (not suppressed) and earns its credit.
    expect(j.testimonies.some((s) => s.includes("Significators perfect by applying"))).toBe(true);
    expect(j.testimonies.some((s) => s.includes("suppressed"))).toBe(false);
    // No -25 denial; the +5 perfects-with-labour testimony stands instead.
    expect(j.testimonies.some((s) => s.includes("(-25)"))).toBe(false);
    expect(j.testimonies.some((s) => s.includes("perfects with labour"))).toBe(true);
    expect(j.lean).toBe("favorable");
    expect(sumTestimonyWeights(j.testimonies)).toBe(j.score);
  });

  it("a RESCUED prohibition (sound carrier survives) is NOT a surviving denial — no suppression", () => {
    // Sun (querent) & Saturn (quesited) apply to a conjunction at 250° & 256°; the
    // Moon prohibits the Sun unreceived. BUT Jupiter (sound, ahead of both at
    // 259°, stationary) is applied to by BOTH significators, collecting their
    // light — a sound indirect carrier that RESCUES the matter. (A heavier body
    // both sigs approach is COLLECTION — the lighter-planet gate means slow
    // Jupiter can no longer be mislabeled a translator here.) A rescued matter is
    // not a surviving denial: the +40 must NOT be suppressed, and the +12
    // indirect-recovery credit applies.
    const planets = [
      planet("Sun", 250, 1.0),
      planet("Saturn", 256, 0.03),
      planet("Moon", 243, 13.0),
      // Jupiter ahead of both, slow — both Sun (applying +) and Saturn apply to it.
      planet("Jupiter", 259, 0.0),
      planet("Mercury", 200, 1.2),
      planet("Venus", 202, 1.1),
      planet("Mars", 204, 0.5),
    ];
    const j = judgeHorary(chartOf(planets, equalCusps(ascLeo)), 7);
    // A sound indirect path survives (collection through Jupiter).
    expect(j.perfection.indirectPath).toBe("Jupiter");
    // Because the matter is RESCUED, the perfection is NOT suppressed.
    expect(j.testimonies.some((s) => s.includes("Significators perfect by applying"))).toBe(true);
    expect(j.testimonies.some((s) => s.includes("suppressed"))).toBe(false);
    // The indirect-recovery credit is present.
    expect(j.testimonies.some((s) => s.startsWith("Indirect recovery"))).toBe(true);
    expect(sumTestimonyWeights(j.testimonies)).toBe(j.score);
  });

  it("besieging is an AFFLICTION, not a denial — a direct perfection stays additive (not suppressed)", () => {
    // Querent Sun at 100° applies to a DIRECT conjunction with quesited Saturn at
    // 105° (Saturn is also a flanking malefic), and Mars at 95° hems the Sun from
    // behind — the Sun is besieged between Mars & Saturn. Besieging is an affliction
    // (-12), NOT a categorical denial: the +40 perfection must remain additive
    // (NOT suppressed), so the score is +40 + ... - 12, still net positive.
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
    expect(j.besieging.some((b) => b.planet === "Sun")).toBe(true);
    expect(j.prohibition).toBeNull();
    expect(j.refranation).toBeNull();
    // The direct +40 perfection is KEPT (additive), NOT suppressed by the affliction.
    expect(j.testimonies.some((s) => s.includes("Significators perfect by applying"))).toBe(true);
    expect(j.testimonies.some((s) => s.includes("suppressed"))).toBe(false);
    // The -12 besieging affliction is present and additive.
    expect(j.testimonies.some((s) => s.includes("besieged") && s.includes("(-12)"))).toBe(true);
    expect(sumTestimonyWeights(j.testimonies)).toBe(j.score);
  });
});

describe("heavier-collector gate (Lilly CA pp. 110-111)", () => {
  // Collection of light is by a MORE PONDEROUS (heavier/slower) planet that BOTH
  // significators apply to. Only a body slower than both significators qualifies as
  // a collector — a swift body between slower ones is NOT a collector.
  // Ascendant Leo (135°): querent = Sun, equal 7th in Aquarius: quesited = Saturn.
  const ascLeoGate = 135;

  function sumWeights(testimonies: string[]): number {
    let total = 0;
    for (const s of testimonies) {
      const m = s.match(/\(([+-]?\d+)\)\s*$/);
      if (m) total += Number(m[1]);
    }
    return total;
  }

  it("a slow Jupiter that both significators apply to still collects", () => {
    // Sun (querent, 1.0 deg/day) and Saturn (quesited, 0.03 deg/day) both apply to
    // Jupiter (0.0 deg/day, stationary) just ahead of them. Jupiter (|0.0|) is
    // slower than both significators → passes the heavier gate → collection fires.
    // Geometry: Sun 248°, Saturn 253°, Jupiter 258° (stationary, 0.0).
    // Sun–Jupiter: 10° gap, Sun (1.0) faster → applies conjunction ✓
    // Saturn–Jupiter: 5° gap, Jupiter stationary, Saturn (0.03) closes → applies ✓
    const planets = [
      planet("Sun", 248, 1.0),
      planet("Saturn", 253, 0.03),
      planet("Jupiter", 258, 0.0), // stationary — slower than both → valid collector
      planet("Moon", 50, 13.0),
      planet("Mercury", 150, 1.2),
      planet("Venus", 160, 1.1),
      planet("Mars", 170, 0.5),
    ];
    const j = judgeHorary(chartOf(planets, equalCusps(ascLeoGate)), 7);
    expect(j.collectionOfLight).not.toBeNull();
    expect(j.collectionOfLight?.collector).toBe("Jupiter");
    expect(j.testimonies.some((s) => s.includes("Collection of light by Jupiter"))).toBe(true);
    expect(sumWeights(j.testimonies)).toBe(j.score);
  });

  it("a fast Mercury between slower significators does NOT collect", () => {
    // Sun (querent, 1.0 deg/day) and Saturn (quesited, 0.03 deg/day) — Mercury
    // (1.5 deg/day) is faster than both. Geometrically both significators might
    // apply to Mercury, but Mercury fails the heavier-collector gate because it is
    // swifter than the significators → collection does NOT fire.
    const planets = [
      planet("Sun", 100, 1.0),
      planet("Saturn", 200, 0.03),
      planet("Mercury", 260, 1.5), // faster than Sun (1.0) → fails heavier gate
      planet("Moon", 50, 13.0),
      planet("Venus", 150, 1.1),
      planet("Mars", 170, 0.45),
      planet("Jupiter", 300, 0.08),
    ];
    const j = judgeHorary(chartOf(planets, equalCusps(ascLeoGate)), 7);
    // Mercury is faster than Sun → it cannot be a collector.
    expect(j.collectionOfLight?.collector).not.toBe("Mercury");
    expect(j.testimonies.some((s) => s.includes("Collection of light by Mercury"))).toBe(false);
    expect(sumWeights(j.testimonies)).toBe(j.score);
  });

  it("Jupiter at speed 0.0 (stationary) collects — the perfection-refine rescue fixture", () => {
    // Sun (querent) and Saturn (quesited) apply to a conjunction; Moon prohibits.
    // Jupiter at 259° with speed 0.0 is the slowest possible body (|0.0| < |1.0|
    // and |0.0| < |0.03|) — the rescue fixture must still detect collection through
    // it after the heavier gate is applied.
    const planets = [
      planet("Sun", 250, 1.0),
      planet("Saturn", 256, 0.03),
      planet("Moon", 243, 13.0),
      planet("Jupiter", 259, 0.0), // stationary — slower than both sigs → valid collector
      planet("Mercury", 200, 1.2),
      planet("Venus", 202, 1.1),
      planet("Mars", 204, 0.5),
    ];
    const j = judgeHorary(chartOf(planets, equalCusps(ascLeoGate)), 7);
    expect(j.collectionOfLight).not.toBeNull();
    expect(j.collectionOfLight?.collector).toBe("Jupiter");
    expect(j.perfection.indirectPath).toBe("Jupiter");
    expect(sumWeights(j.testimonies)).toBe(j.score);
  });
});
