/*
 * conditions.ts — accidental conditions relative to the Sun.
 *
 * A planet too close to the Sun is weakened ("burnt"): combust within ~8.5°,
 * "under the beams" within ~15°, but exactly in the Sun's heart (~17 arcminutes)
 * it is cazimi — strengthened and protected instead.
 */
import type { SunProximity, SolarPhase } from "./types.js";

const CAZIMI_DEG = 17 / 60; // 17 arcminutes ≈ 0.2833°
const COMBUST_DEG = 8.5;
const UNDER_BEAMS_DEG = 15;

/** Smallest angular distance (0..180) between two ecliptic longitudes. */
function separation(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** Classify a body's relationship to the Sun's rays by angular distance. */
export function sunProximity(planetLongitude: number, sunLongitude: number): SunProximity {
  const distanceDeg = separation(planetLongitude, sunLongitude);
  let state: SolarPhase = "clear";
  if (distanceDeg <= CAZIMI_DEG) state = "cazimi";
  else if (distanceDeg <= COMBUST_DEG) state = "combust";
  else if (distanceDeg <= UNDER_BEAMS_DEG) state = "under-beams";
  return { state, distanceDeg };
}
