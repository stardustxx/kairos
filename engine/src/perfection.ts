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
import { computeAspects } from "./aspects.js";
import type { Besieging, PlanetPosition, Prohibition, Refranation } from "./types.js";

/** Signed shortest angular path from lon1 to lon2, in (-180, 180]. Positive =
 *  lon2 is ahead of lon1 in the direction of increasing longitude. */
function signedSeparation(lon1: number, lon2: number): number {
  let d = (lon2 - lon1) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

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
 * Prohibition: a third planet perfects an aspect to sigA or sigB BEFORE the two
 * significators perfect with each other, cutting the matter off. Compares the
 * relative-speed time-to-perfection of each third-planet applying aspect against
 * the significators' own applying aspect. Returns the soonest-perfecting
 * prohibitor, or null when none beats the significators (or they do not apply).
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

  let best: Prohibition | null = null;
  let bestDays = sigDays;
  for (const target of [A, B]) {
    for (const T of planets) {
      if (T.name === sigA || T.name === sigB) continue;
      const between = computeAspects([T, target]).filter((a) => a.applying);
      for (const asp of between) {
        const days = daysToPerfection(T.speed, target.speed, asp.orb);
        if (Number.isFinite(days) && days < bestDays) {
          bestDays = days;
          best = { prohibitor: T.name, target: target.name, aspect: asp.type };
        }
      }
    }
  }
  return best;
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
