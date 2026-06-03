import { ASPECTS } from "./constants.js";
import type { Aspect, PlanetPosition } from "./types.js";

/** Smallest angular distance (0..180) between two ecliptic longitudes. */
function separation(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export function computeAspects(planets: PlanetPosition[]): Aspect[] {
  const out: Aspect[] = [];
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const A = planets[i];
      const B = planets[j];
      const sepNow = separation(A.longitude, B.longitude);
      for (const def of ASPECTS) {
        const orb = Math.abs(sepNow - def.angle);
        if (orb > def.orb) continue;
        // Step both bodies forward one day; see if orb shrinks -> applying.
        const sepNext = separation(A.longitude + A.speed, B.longitude + B.speed);
        const orbNext = Math.abs(sepNext - def.angle);
        out.push({
          a: A.name,
          b: B.name,
          type: def.name,
          orb,
          applying: orbNext < orb,
        });
      }
    }
  }
  return out;
}

/** Aspects between two distinct sets of bodies (e.g. transiting vs natal). */
export function computeCrossAspects(
  transiting: PlanetPosition[],
  natal: PlanetPosition[],
): Aspect[] {
  const out: Aspect[] = [];
  for (const T of transiting) {
    for (const N of natal) {
      const sepNow = separation(T.longitude, N.longitude);
      for (const def of ASPECTS) {
        const orb = Math.abs(sepNow - def.angle);
        if (orb > def.orb) continue;
        // Natal points are fixed; only the transiting body moves.
        const sepNext = separation(T.longitude + T.speed, N.longitude);
        out.push({
          a: `t.${T.name}`,
          b: `n.${N.name}`,
          type: def.name,
          orb,
          applying: Math.abs(sepNext - def.angle) < orb,
        });
      }
    }
  }
  return out;
}
