import sweph from "sweph";
import { CALC_FLAGS, DEGREES_PER_SIGN, PLANETS, SIGN_COUNT, SIGNS } from "./constants.js";
import type { PlanetPosition } from "./types.js";

/**
 * Compute all planet positions at an arbitrary Universal Time Julian Day.
 * Thin alias of computePositions, named for clarity in timing/root-finding code
 * that queries the ephemeris at trial times rather than the chart moment.
 */
export function computePositionsAtJd(julianDayUt: number): PlanetPosition[] {
  return computePositions(julianDayUt);
}

export function computePositions(julianDayUt: number): PlanetPosition[] {
  return PLANETS.map((def) => {
    const res = sweph.calc_ut(julianDayUt, def.id, CALC_FLAGS);
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
    const signIndex = Math.floor(longitude / DEGREES_PER_SIGN) % SIGN_COUNT;
    return {
      name: def.name,
      longitude,
      eclipticLatitude,
      sign: SIGNS[signIndex],
      degInSign: longitude - signIndex * DEGREES_PER_SIGN,
      retrograde: speed < 0,
      speed,
    };
  });
}
