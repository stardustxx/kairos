import {
  ASPECTS,
  DEFAULT_PLANET_ORB,
  PLANET_ORB,
  separation,
  signedSeparation,
} from "./constants.js";
import { longitudeAtJd } from "./positions.js";
import { julianDayToUtcString } from "./time.js";
import type { Aspect, PlanetPosition } from "./types.js";

/** Full orb of a single body (Lilly's moiety table), with a small default for
 *  non-classical points (modern planets, Node, Part of Fortune). */
function planetOrb(name: string): number {
  return PLANET_ORB[name] ?? DEFAULT_PLANET_ORB;
}

/**
 * Operative orb for a PAIR of bodies = the mean of their two full orbs
 * (equivalently the sum of their moieties = half-orbs). Per Lilly, an aspect is
 * in orb when |separation - aspectAngle| <= operativeOrb; this single per-pair
 * orb governs ALL five Ptolemaic aspects. E.g. operativeOrb("Sun","Moon")
 * = (15 + 12) / 2 = 13.5; operativeOrb("Mercury","Venus") = 7;
 * operativeOrb("Saturn","Mars") = (9 + 7.5) / 2 = 8.25.
 */
export function operativeOrb(nameA: string, nameB: string): number {
  return (planetOrb(nameA) + planetOrb(nameB)) / 2;
}

const CONVERGENCE_DEG = 0.001; // ~3.6 arcsec; far tighter than any orb
const MAX_ITERS = 60;

/**
 * Root-find the Julian Day at which the (signed) separation between two bodies
 * equals one of the canonical aspect angles, via bisection.
 *
 * `lonAt(jd)` returns the two longitudes at a trial time. For a same-aspect the
 * target separation magnitude is `aspectAngle`; because signed separation can
 * approach the angle from either side (e.g. +120 or -120 for a trine), we build
 * an error function whose sign flips at perfection and bracket a root in the
 * search window.
 *
 * Returns the converged JD, or null if no sign change is bracketed within the
 * window (aspect does not perfect there — already separated, or stationary).
 *
 * Cost: O(iterations) ephemeris lookups (~10-20 calls of 11 planets each).
 */
function findAspectPerfectionJd(
  lonAt: (jd: number) => { lon1: number; lon2: number },
  aspectAngle: number,
  chartJd: number,
  maxHourOffset: number,
): number | null {
  // Error function: distance-from-aspect, signed so it crosses zero at
  // perfection. We use the magnitude of signed separation minus the angle,
  // which is continuous away from the 0/180 wrap that signedSeparation handles.
  const err = (jd: number): number => {
    const { lon1, lon2 } = lonAt(jd);
    return Math.abs(signedSeparation(lon1, lon2)) - aspectAngle;
  };

  const lo = chartJd - maxHourOffset / 24;
  const hi = chartJd + maxHourOffset / 24;

  // Sample the window to find a sub-interval that brackets a sign change.
  // A coarse scan avoids missing roots when the endpoints share a sign but a
  // perfection occurs in between (common for fast bodies / near-stations).
  const SAMPLES = 48;
  let prevJd = lo;
  let prevErr = err(lo);
  let aJd = NaN;
  let bJd = NaN;
  for (let i = 1; i <= SAMPLES; i++) {
    const jd = lo + ((hi - lo) * i) / SAMPLES;
    const e = err(jd);
    if (prevErr === 0) {
      return prevJd;
    }
    if (Math.sign(e) !== Math.sign(prevErr)) {
      aJd = prevJd;
      bJd = jd;
      break;
    }
    prevJd = jd;
    prevErr = e;
  }
  if (Number.isNaN(aJd)) return null;

  // Bisection on the bracketed sub-interval.
  let fa = err(aJd);
  for (let i = 0; i < MAX_ITERS; i++) {
    const mid = (aJd + bJd) / 2;
    const fm = err(mid);
    if (Math.abs(fm) < CONVERGENCE_DEG) return mid;
    if (Math.sign(fm) === Math.sign(fa)) {
      aJd = mid;
      fa = fm;
    } else {
      bJd = mid;
    }
  }
  return (aJd + bJd) / 2;
}

/**
 * Compute aspects among a single set of bodies. When `chartJd` is supplied, each
 * in-orb aspect is annotated with `perfectsAtUtc` (the exact UTC time it
 * perfects) and the `applying` flag is derived from real ephemeris motion via
 * root-finding rather than a one-day finite difference. Without `chartJd` the
 * legacy one-day-step behaviour is used and `perfectsAtUtc` is omitted.
 *
 * `maxHourOffset` bounds the perfection search window (default ±30h covers
 * mutual aspects of the classical planets, including near-stations).
 */
export function computeAspects(
  planets: PlanetPosition[],
  chartJd?: number,
  maxHourOffset = 30,
): Aspect[] {
  const out: Aspect[] = [];
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const A = planets[i];
      const B = planets[j];
      const sepNow = separation(A.longitude, B.longitude);
      const pairOrb = operativeOrb(A.name, B.name);
      for (const def of ASPECTS) {
        const orb = Math.abs(sepNow - def.angle);
        if (orb > pairOrb) continue;

        let applying: boolean;
        let perfectsAtUtc: string | null | undefined;

        if (chartJd != null) {
          // Real-motion timing: look the two bodies up at trial times.
          // Only the pair in contact is computed (not the full planet set) —
          // the same per-body sweph lookup, so the longitudes are identical.
          const lonAt = (jd: number) => ({
            lon1: longitudeAtJd(A.name, jd),
            lon2: longitudeAtJd(B.name, jd),
          });
          const jd = findAspectPerfectionJd(lonAt, def.angle, chartJd, maxHourOffset);
          perfectsAtUtc = jd != null ? julianDayToUtcString(jd) : null;
          // Applying iff perfection lies in the future of the chart moment.
          // Fall back to the finite-difference test if the root wasn't found.
          if (jd != null) {
            applying = jd >= chartJd;
          } else {
            const sepNext = separation(A.longitude + A.speed, B.longitude + B.speed);
            applying = Math.abs(sepNext - def.angle) < orb;
          }
        } else {
          // Legacy: step both bodies forward one day; orb shrinks -> applying.
          const sepNext = separation(A.longitude + A.speed, B.longitude + B.speed);
          applying = Math.abs(sepNext - def.angle) < orb;
        }

        const aspect: Aspect = { a: A.name, b: B.name, type: def.name, orb, applying };
        if (chartJd != null) aspect.perfectsAtUtc = perfectsAtUtc ?? null;
        out.push(aspect);
      }
    }
  }
  return out;
}

/**
 * Aspects between two distinct sets of bodies (e.g. transiting vs natal).
 * When `chartJd` is supplied, in-orb aspects gain exact `perfectsAtUtc` timing
 * (natal points are treated as fixed; only the transiting body moves) and a
 * motion-derived `applying` flag. A wider default window (±7 days) suits the
 * slower relative motion of transit-to-natal contacts.
 */
export function computeCrossAspects(
  transiting: PlanetPosition[],
  natal: PlanetPosition[],
  chartJd?: number,
  maxHourOffset = 24 * 7,
): Aspect[] {
  const out: Aspect[] = [];
  for (const T of transiting) {
    for (const N of natal) {
      const sepNow = separation(T.longitude, N.longitude);
      const pairOrb = operativeOrb(T.name, N.name);
      for (const def of ASPECTS) {
        const orb = Math.abs(sepNow - def.angle);
        if (orb > pairOrb) continue;

        let applying: boolean;
        let perfectsAtUtc: string | null | undefined;

        if (chartJd != null) {
          // Natal longitude is fixed; only the transiting body is looked up.
          const natalLon = N.longitude;
          const lonAt = (jd: number) => ({
            lon1: longitudeAtJd(T.name, jd),
            lon2: natalLon,
          });
          const jd = findAspectPerfectionJd(lonAt, def.angle, chartJd, maxHourOffset);
          perfectsAtUtc = jd != null ? julianDayToUtcString(jd) : null;
          if (jd != null) {
            applying = jd >= chartJd;
          } else {
            const sepNext = separation(T.longitude + T.speed, natalLon);
            applying = Math.abs(sepNext - def.angle) < orb;
          }
        } else {
          // Legacy: natal points are fixed; only the transiting body moves.
          const sepNext = separation(T.longitude + T.speed, N.longitude);
          applying = Math.abs(sepNext - def.angle) < orb;
        }

        const aspect: Aspect = {
          a: `t.${T.name}`,
          b: `n.${N.name}`,
          type: def.name,
          orb,
          applying,
        };
        if (chartJd != null) aspect.perfectsAtUtc = perfectsAtUtc ?? null;
        out.push(aspect);
      }
    }
  }
  return out;
}

/**
 * Aspects from each planet to the chart's angles (Ascendant, MC). A planet
 * closely aspecting an angle is one of the strongest testimonies of strength and
 * visibility. Angles are treated as fixed points; `applying` is approximated
 * from the planet's own motion toward the angle.
 *
 * ANGLE-ASPECT ORB DECISION: an angle (Asc/MC) is a calculated cusp, not a body,
 * so it has no light/moiety of its own. We therefore allow only the ASPECTING
 * PLANET'S moiety (half its full orb) as the orb — the planet alone projects its
 * ray onto the angle. This keeps the moiety doctrine consistent (a Sun-angle
 * contact gets 7.5°, a Saturn-angle 4.5°, Mercury-angle 3.5°) instead of the old
 * flat 5° per aspect, and it preserves the classical instinct that angle orbs are
 * tighter than full planet-pair orbs (half, by construction).
 */
export function computeAngleAspects(
  planets: PlanetPosition[],
  ascendant: number,
  mc: number,
): Aspect[] {
  const angles = [
    { name: "Ascendant", lon: ascendant },
    { name: "MC", lon: mc },
  ];
  const out: Aspect[] = [];
  for (const P of planets) {
    const moiety = planetOrb(P.name) / 2;
    for (const ang of angles) {
      const sepNow = separation(P.longitude, ang.lon);
      for (const def of ASPECTS) {
        const orb = Math.abs(sepNow - def.angle);
        if (orb > moiety) continue;
        const sepNext = separation(P.longitude + P.speed, ang.lon);
        out.push({
          a: P.name,
          b: ang.name,
          type: def.name,
          orb,
          applying: Math.abs(sepNext - def.angle) < orb,
        });
      }
    }
  }
  return out;
}
