/*
 * perfection.ts — classical perfection-breakers (denials).
 *
 * Even when the two significators apply to a perfecting aspect, the matter can
 * still be CUT OFF before completion. Three classical breakers are detected here:
 *
 *   - prohibition: a THIRD planet perfects an aspect to one significator BEFORE
 *     the two significators perfect with each other, intercepting the matter.
 *   - refranation: a significator that should complete the aspect turns
 *     retrograde (or is withdrawing) while the aspect is still applying, so it
 *     draws back before perfection.
 *   - besieging: a significator hemmed between the two malefics (Mars and
 *     Saturn), one ahead and one behind by longitude — a real affliction.
 *
 * All functions are pure over a list of PlanetPosition and the two significator
 * names. Timing is by relative angular velocity (time = orb / |speedA - speedB|),
 * the standard practical method, so these work on bare position lists without an
 * ephemeris lookup.
 */
import { computeAspects, operativeOrb } from "./aspects.js";
import { ASPECTS, signedSeparation } from "./constants.js";
import { receivesByDomicileOrExaltation } from "./dignities.js";
import type {
  Besieging,
  Enclosure,
  PlanetPosition,
  Prohibition,
  Refranation,
} from "./types.js";

/**
 * Days until an applying aspect between two bodies perfects, by relative angular
 * velocity: time = orb / |speedA - speedB|. Returns +Infinity when the bodies
 * are not converging (the aspect is separating, not applying). `orb` is the
 * aspect's current distance-from-exact in degrees.
 */
function daysToPerfection(
  speedA: number,
  speedB: number,
  orb: number,
): number {
  const relSpeed = Math.abs(speedA - speedB);
  if (relSpeed === 0) return Number.POSITIVE_INFINITY;
  return orb / relSpeed;
}

/** Look up a planet by name in a position list. */
function byName(planets: PlanetPosition[], name: string): PlanetPosition | undefined {
  return planets.find((p) => p.name === name);
}

/**
 * Prohibition of a DELIVERY LEG: a translation of light only completes when the
 * carrier actually reaches the destination significator. If a third planet's
 * applying aspect WITH THE CARRIER perfects before the carrier's own delivering
 * aspect to the destination does, the intervening contact intercepts the light
 * the carrier holds — the classical "Moon-sequence" prohibition (Lilly's
 * prohibition applied to the translation chain; cf. Warnock/Louis on intervening
 * lunar aspects). The light is diverted mid-carry and never arrives.
 *
 * Timing is the same relative-angular-velocity method as detectProhibition.
 * Returns the soonest interceptor, or null when the delivery leg is clear (or
 * when carrier and destination have no applying aspect at all — then there is
 * no delivery to prohibit; findTranslation should not have fired).
 *
 * SCOPE — exactly what the corpus evidence supports, no further:
 * - Only the MOON intercepts. The attested doctrine ("Moon-sequence"
 *   prohibition, Warnock 2004 / Louis) is about the Moon's own order of
 *   aspects: she strikes the carrier before the carrier delivers. A generic
 *   any-interceptor race would kill virtually every slow-carrier translation
 *   (Jupiter delivering to Saturn takes months — some fast body always perfects
 *   a contact with it first), which contradicts classical practice.
 * - Only a CORRUPTING RAY breaks the carry: the Moon striking the carrier by
 *   square or opposition corrupts the light mid-transfer — the verified cases
 *   are an OPPOSITION (Warnock 2004) and a SQUARE (Warnock 1999). A soft ray
 *   perfecting first is read as assistance, not hindrance (consistent with
 *   benefic enclosure). A bodily CONJUNCTION with the carrier is deliberately
 *   NOT counted: classically ambiguous — the Moon conjoining a carrier can hand
 *   her light along the relay rather than cut it (abscission-by-conjunction is
 *   attested against significators, not carriers) — and no corpus case attests
 *   either reading yet.
 * Generalizing any restriction awaits corpus evidence.
 */
const CORRUPTING_RAYS = new Set(["square", "opposition"]);

export function prohibitsDelivery(
  carrier: string,
  destination: string,
  planets: PlanetPosition[],
): { interceptor: string; aspect: string } | null {
  const C = byName(planets, carrier);
  const D = byName(planets, destination);
  if (!C || !D || carrier === destination) return null;

  const legAspects = computeAspects([C, D]).filter((a) => a.applying);
  if (legAspects.length === 0) return null;
  const leg = legAspects.sort((x, y) => x.orb - y.orb)[0];
  const legDays = daysToPerfection(C.speed, D.speed, leg.orb);
  if (!Number.isFinite(legDays)) return null;

  let best: { interceptor: string; aspect: string } | null = null;
  let bestDays = legDays;
  const moon = byName(planets, "Moon");
  if (moon && carrier !== "Moon" && destination !== "Moon") {
    const contacts = computeAspects([moon, C]).filter(
      (a) => a.applying && CORRUPTING_RAYS.has(a.type),
    );
    for (const asp of contacts) {
      const days = daysToPerfection(moon.speed, C.speed, asp.orb);
      if (Number.isFinite(days) && days < bestDays) {
        bestDays = days;
        best = { interceptor: "Moon", aspect: asp.type };
      }
    }
  }
  return best;
}

/**
 * Prohibition: a third planet perfects an aspect to sigA or sigB BEFORE the two
 * significators perfect with each other, cutting the matter off. Compares the
 * relative-speed time-to-perfection of each third-planet applying aspect against
 * the significators' own applying aspect. Returns the soonest-perfecting
 * prohibitor, or null when none beats the significators (or they do not apply).
 *
 * The returned prohibition is ANNOTATED with reception: per Lilly CA / Bonatti, a
 * prohibition only DENIES when there is no reception. `receivesTarget` is true
 * when the prohibitor receives (by domicile or exaltation) the significator whose
 * light it intercepts; `mutualReception` is true when the two also receive each
 * other. With reception the matter is not cut off — it perfects with labour.
 */
export function detectProhibition(
  sigA: string,
  sigB: string,
  planets: PlanetPosition[],
): Prohibition | null {
  const A = byName(planets, sigA);
  const B = byName(planets, sigB);
  if (!A || !B || sigA === sigB) return null;

  // The significators' own applying aspect must exist for it to be prohibited.
  const sigAspects = computeAspects([A, B]).filter((a) => a.applying);
  if (sigAspects.length === 0) return null;
  const sigAspect = sigAspects.sort((x, y) => x.orb - y.orb)[0];
  const sigDays = daysToPerfection(A.speed, B.speed, sigAspect.orb);
  if (!Number.isFinite(sigDays)) return null;

  let best: { prohibitor: PlanetPosition; target: PlanetPosition; aspect: string } | null = null;
  let bestDays = sigDays;
  for (const target of [A, B]) {
    for (const T of planets) {
      if (T.name === sigA || T.name === sigB) continue;
      const between = computeAspects([T, target]).filter((a) => a.applying);
      for (const asp of between) {
        const days = daysToPerfection(T.speed, target.speed, asp.orb);
        if (Number.isFinite(days) && days < bestDays) {
          bestDays = days;
          best = { prohibitor: T, target, aspect: asp.type };
        }
      }
    }
  }
  if (!best) return null;

  // Reception annotation: the prohibitor RECEIVES the target it intercepts when it
  // is the domicile/exaltation lord of the sign that target sits in. Mutual when
  // the target ALSO receives the prohibitor. These STRONG receptions nullify the
  // denial (term/face deliberately excluded).
  const receivesTarget =
    receivesByDomicileOrExaltation(best.prohibitor.name, best.target.longitude) !== null;
  const targetReceivesProhibitor =
    receivesByDomicileOrExaltation(best.target.name, best.prohibitor.longitude) !== null;
  const mutualReception = receivesTarget && targetReceivesProhibitor;

  return {
    prohibitor: best.prohibitor.name,
    target: best.target.name,
    aspect: best.aspect,
    receivesTarget,
    mutualReception,
  };
}

/**
 * Refranation: one of the two significators that should complete the perfecting
 * aspect is retrograde (or stationing retrograde — slowing toward a station),
 * so it withdraws before the aspect perfects. Conservative: only flags when the
 * significators have an applying aspect AND a significator is retrograde or
 * effectively backing out of it. Returns the withdrawing planet, or null.
 */
export function detectRefranation(
  sigA: string,
  sigB: string,
  planets: PlanetPosition[],
): Refranation | null {
  const A = byName(planets, sigA);
  const B = byName(planets, sigB);
  if (!A || !B || sigA === sigB) return null;

  // Only meaningful while the significators are still applying to perfection.
  const applying = computeAspects([A, B]).some((a) => a.applying);
  if (!applying) return null;

  // A significator that is retrograde — or stationing RETROGRADE (very slow and
  // moving backward, i.e. about to turn retrograde) — withdraws before the aspect
  // completes. A station-DIRECT significator (slow but positive speed) is about to
  // move forward and PERFECT, not refrane, so it must not flag. Threshold is tight.
  const STATION_SPEED = 0.05; // deg/day
  for (const planet of [A, B]) {
    const stationingRetrograde = planet.speed < 0 && Math.abs(planet.speed) <= STATION_SPEED;
    if (planet.retrograde || stationingRetrograde) {
      return { planet: planet.name };
    }
  }
  return null;
}

/**
 * Besieging: a planet hemmed between Mars and Saturn — within a moderate orb
 * (~7°) of BOTH malefics, one ahead and one behind by longitude. Body-besieging:
 * the planet sits bodily between the two malefics. Returns the besieging pair, or
 * null when the planet is not so hemmed (or a malefic is absent).
 */
export function detectBesieging(
  planet: string,
  planets: PlanetPosition[],
): Besieging | null {
  const BESIEGE_ORB = 7;
  const P = byName(planets, planet);
  const mars = byName(planets, "Mars");
  const saturn = byName(planets, "Saturn");
  if (!P || !mars || !saturn) return null;
  // A malefic cannot besiege itself.
  if (planet === "Mars" || planet === "Saturn") return null;

  const toMars = signedSeparation(P.longitude, mars.longitude);
  const toSaturn = signedSeparation(P.longitude, saturn.longitude);

  // Both malefics within orb...
  if (Math.abs(toMars) > BESIEGE_ORB || Math.abs(toSaturn) > BESIEGE_ORB) {
    return null;
  }
  // ...and on opposite sides (one ahead, one behind): the planet is between them.
  if (Math.sign(toMars) === Math.sign(toSaturn)) return null;
  if (toMars === 0 || toSaturn === 0) return null;

  return { betweenOf: ["Mars", "Saturn"] };
}

/** A body's "touch" on the enclosed planet: how it reaches it (body or ray), on
 *  which side (behind = -1 / ahead = +1 by longitude), and how tight (the gap in
 *  degrees from exact — 0 = partile). The TIGHTEST touch on a side is the one
 *  that "hems" from that side; a looser touch behind a tighter one intervenes. */
interface Touch {
  name: string;
  side: -1 | 1;
  by: "body" | "ray";
  gap: number;
}

/**
 * The nearest hemming body on each zodiacal side of `planet`, by BODY or RAY.
 * For every OTHER body we test whether it touches `planet`: bodily (within the
 * pair's conjunction orb) or by a Ptolemaic ray (separation within orb of a
 * sextile/square/trine/opposition). The body's SIDE is the sign of its signed
 * separation from the planet (behind / ahead); its GAP is how far off exact the
 * tightest such contact is. The returned pair is the single TIGHTEST touch on
 * each side — i.e. the bodies that actually enclose the planet, with anything
 * looser behind them counted as intervening.
 *
 * Orbs reuse the moiety doctrine: a body↔planet contact is in orb when within
 * operativeOrb(body, planet) of the aspect angle — the same per-pair orb the
 * aspect engine uses, so no new orb constant is introduced.
 */
function enclosingBodies(
  planet: string,
  planets: PlanetPosition[],
): { behind: Touch | null; ahead: Touch | null } {
  const P = byName(planets, planet);
  if (!P) return { behind: null, ahead: null };

  // Conservative enclosure cap. The moiety pair-orb is reused, but CLAMPED to a
  // fixed maximum so a luminary's wide orb (the Sun's full orb is 15°, giving
  // Sun-pair orbs up to ~11°) cannot flag a very loose ray as a hemming contact.
  // 6° matches the tightness of the existing body-besieging orb (7°) and keeps
  // ray-enclosure on par with bodily enclosure, per Lilly's tight reading.
  const ENCLOSURE_ORB_CAP = 6;

  let behind: Touch | null = null;
  let ahead: Touch | null = null;

  for (const B of planets) {
    if (B.name === planet) continue;
    const sep = signedSeparation(P.longitude, B.longitude);
    if (sep === 0) continue; // exactly conjunct — no "side"
    const side: -1 | 1 = sep < 0 ? -1 : 1;
    const orb = Math.min(operativeOrb(P.name, B.name), ENCLOSURE_ORB_CAP);
    const absSep = Math.abs(sep);

    // Tightest in-orb contact across the five Ptolemaic angles (conjunction =
    // bodily; the rest = ray). Pick the smallest gap-from-exact within orb.
    let best: { by: "body" | "ray"; gap: number; angle: number } | null = null;
    for (const def of ASPECTS) {
      const gap = Math.abs(absSep - def.angle);
      if (gap > orb) continue;
      const by: "body" | "ray" = def.angle === 0 ? "body" : "ray";
      if (!best || gap < best.gap) best = { by, gap, angle: def.angle };
    }
    if (!best) continue;
    // An opposition is a confrontation ACROSS the chart, not a flank — its "side"
    // via signedSeparation is arbitrary near 180° (179.5° ahead vs 180.5° flip on
    // a hair). Lilly's besieging is by the two FLANKING bodies/rays, so an
    // opposition ray is not counted as a hemming contact.
    if (best.angle === 180) continue;

    const touch: Touch = { name: B.name, side, by: best.by, gap: best.gap };
    if (side < 0) {
      if (!behind || touch.gap < behind.gap) behind = touch;
    } else {
      if (!ahead || touch.gap < ahead.gap) ahead = touch;
    }
  }

  return { behind, ahead };
}

/**
 * Enclosure of `planet` between two flanking bodies — one behind, one ahead by
 * longitude — each touching by BODY or RAY, with NOTHING intervening (the pair
 * are the TIGHTEST touch on their respective sides). Two cases:
 *   - malefic: the flankers are Mars & Saturn (besieged — an affliction).
 *   - benefic: the flankers are Jupiter & Venus (aided — a protection).
 * Returns the strongest applicable enclosure (malefic preferred when both could
 * apply, since an affliction governs the verdict), or null.
 *
 * Source: William Lilly, Christian Astrology (1647), Bk. 1 — a planet "besieged"
 * sits between the two infortunes Saturn & Mars "by body or aspect, no other
 * planet interposing his body or ray"; the benefic counterpart ("aid"), a planet
 * enclosed between the two fortunes Jupiter & Venus, signifies ease/assistance.
 * https://astrologyclub.org/besieged-aided-planet/
 */
export function detectEnclosure(
  planet: string,
  planets: PlanetPosition[],
): Enclosure | null {
  // A malefic/benefic cannot enclose itself as the named pair member.
  const { behind, ahead } = enclosingBodies(planet, planets);
  if (!behind || !ahead) return null;

  const pair = (a: string, b: string): boolean =>
    (behind.name === a && ahead.name === b) || (behind.name === b && ahead.name === a);

  if (pair("Mars", "Saturn")) {
    return {
      kind: "malefic",
      betweenOf: [behind.name, ahead.name],
      by: [behind.by, ahead.by],
    };
  }
  if (pair("Jupiter", "Venus")) {
    return {
      kind: "benefic",
      betweenOf: [behind.name, ahead.name],
      by: [behind.by, ahead.by],
    };
  }
  return null;
}
