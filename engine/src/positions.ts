import { degInSignOf, PLANETS, SIGNS, signIndexOf } from "./constants.js";
import { ephemeris } from "./ephemeris-provider.js";
import type { PlanetPosition } from "./types.js";

/**
 * Ecliptic longitude of a single named body at an arbitrary Universal Time
 * Julian Day. Used by aspect-perfection root-finding, which samples the
 * ephemeris at many trial times but only ever needs the one or two bodies in
 * contact — computing just the body asked for keeps the search several times
 * cheaper than a full all-planet pass while returning the identical longitude
 * (each sweph calc_ut call is independent per body).
 */
export function longitudeAtJd(name: string, julianDayUt: number): number {
  const def = PLANETS.find((p) => p.name === name);
  if (!def) throw new Error(`unknown body for ephemeris lookup: ${name}`);
  const ephe = ephemeris();
  const res = ephe.calc_ut(julianDayUt, def.id, ephe.calcFlags);
  if (res.error && res.error.length > 0 && res.flag < 0) {
    throw new Error(`sweph.calc_ut failed for ${name}: ${res.error}`);
  }
  return res.data[0];
}

export function computePositions(julianDayUt: number): PlanetPosition[] {
  const ephe = ephemeris();
  return PLANETS.map((def) => {
    const res = ephe.calc_ut(julianDayUt, def.id, ephe.calcFlags);
    // sweph sets `error` on non-fatal warnings too; only flag < 0 is a hard failure.
    if (res.error && res.error.length > 0 && res.flag < 0) {
      throw new Error(`sweph.calc_ut failed for ${def.name}: ${res.error}`);
    }
    const longitude = res.data[0];
    // sweph returns ecliptic latitude in data[1]; we keep it so solar-proximity
    // (combust/cazimi/under-beams) can use the TRUE angular separation from the
    // Sun, not just the longitude difference. A body within arcminutes of the
    // Sun in longitude can still be several degrees off in latitude (the Moon up
    // to ~5.1°), nowhere near the Sun's body. The Sun's own latitude is ~0.
    const eclipticLatitude = res.data[1];
    const speed = res.data[3];
    return {
      name: def.name,
      longitude,
      eclipticLatitude,
      sign: SIGNS[signIndexOf(longitude)],
      degInSign: degInSignOf(longitude),
      retrograde: speed < 0,
      speed,
    };
  });
}
