import sweph from "sweph";
import { PLANETS, SIGNS, CALC_FLAGS } from "./constants.js";
import type { PlanetPosition } from "./types.js";

export function computePositions(julianDayUt: number): PlanetPosition[] {
  return PLANETS.map((def) => {
    const res = sweph.calc_ut(julianDayUt, def.id, CALC_FLAGS);
    if (res.error && res.error.length > 0 && res.flag < 0) {
      throw new Error(`sweph.calc_ut failed for ${def.name}: ${res.error}`);
    }
    const longitude = res.data[0];
    const speed = res.data[3];
    const signIndex = Math.floor(longitude / 30) % 12;
    return {
      name: def.name,
      longitude,
      sign: SIGNS[signIndex],
      degInSign: longitude - signIndex * 30,
      retrograde: speed < 0,
      speed,
    };
  });
}
