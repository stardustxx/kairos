/*
 * antiscia.ts — antiscia and contra-antiscia, the "shadow" reflections of a
 * point across the solstitial and equinoctial axes.
 *
 * The antiscion mirrors a longitude across the 0° Cancer / 0° Capricorn
 * (solstice) axis: points equidistant from that axis share the same declination
 * and are read as a hidden conjunction. The contra-antiscion mirrors across the
 * 0° Aries / 0° Libra (equinox) axis. Two bodies are in antiscia contact when
 * one sits within a tight orb (default 1°) of the other's antiscion (or
 * contra-antiscion).
 *
 *   antiscion(lon)      = (180 - lon) mod 360
 *   contraAntiscion(lon) = (360 - lon) mod 360
 *
 * Worked example: 10° Gemini = 70° -> antiscion 110° = 20° Cancer;
 *                                       contra-antiscion 290° = 20° Capricorn.
 */
import { separation } from "./constants.js";
import type { PlanetPosition } from "./types.js";

function norm360(x: number): number {
  return ((x % 360) + 360) % 360;
}

/** Antiscion of a longitude: mirror across the 0°Cancer/0°Capricorn axis. */
export function antiscion(longitude: number): number {
  return norm360(180 - longitude);
}

/** Contra-antiscion of a longitude: mirror across the 0°Aries/0°Libra axis. */
export function contraAntiscion(longitude: number): number {
  return norm360(360 - longitude);
}

export interface AntisciaContact {
  a: string;
  b: string;
  kind: "antiscia" | "contra-antiscia";
  /** Orb (degrees) between body `a` and `b`'s (contra-)antiscion. */
  orb: number;
}

/**
 * Antiscia / contra-antiscia contacts among the given bodies: a hit is logged
 * when one planet sits within `orb` (default 1°) of another planet's antiscion
 * (antiscia) or contra-antiscion (contra-antiscia). Symmetric pairs are reported
 * once (each unordered pair, per kind).
 */
export function antisciaContacts(planets: PlanetPosition[], orb = 1): AntisciaContact[] {
  const out: AntisciaContact[] = [];
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const A = planets[i];
      const B = planets[j];
      // The relation is symmetric: A near antiscion(B) iff B near antiscion(A),
      // since antiscion is an involution. Test once per unordered pair.
      const antiOrb = separation(A.longitude, antiscion(B.longitude));
      if (antiOrb <= orb) {
        out.push({ a: A.name, b: B.name, kind: "antiscia", orb: antiOrb });
      }
      const contraOrb = separation(A.longitude, contraAntiscion(B.longitude));
      if (contraOrb <= orb) {
        out.push({ a: A.name, b: B.name, kind: "contra-antiscia", orb: contraOrb });
      }
    }
  }
  out.sort((x, y) => x.orb - y.orb);
  return out;
}
