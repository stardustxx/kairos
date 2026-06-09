/*
 * conditions.ts — accidental conditions relative to the Sun.
 *
 * A planet too close to the Sun is weakened ("burnt"): combust within ~8.5°,
 * "under the beams" within ~15°, but exactly in the Sun's heart (~17 arcminutes)
 * it is cazimi — strengthened and protected instead.
 */
import type { SolarPhase, SunProximity } from "./types.js";

const CAZIMI_DEG = 17 / 60; // 17 arcminutes ≈ 0.2833°
const COMBUST_DEG = 8.5;
const UNDER_BEAMS_DEG = 15;

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/** Smallest difference (0..180) between two ecliptic longitudes. */
function longitudeDelta(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * TRUE angular separation between a body and the Sun, in degrees.
 *
 * Combustion/cazimi/under-the-beams are a body's nearness to the Sun's actual
 * disc, which is a separation on the sphere — NOT a difference in ecliptic
 * longitude alone. A body within arcminutes of the Sun in longitude can be 1–5°
 * away in ecliptic latitude (the Moon up to ~5.1°; Mercury/Venus/Mars several
 * degrees), i.e. nowhere near the Sun's body. The Sun's own ecliptic latitude
 * is ~0 by definition, so the great-circle distance between the body (lon, lat)
 * and the Sun (sunLon, 0) is:
 *
 *   cos(d) = cos(lat) · cos(lon − sunLon)   ⇒   d = acos(cos(lat)·cos(Δlon))
 *
 * which reduces to |Δlon| when lat = 0 (the Sun, and bodies on the ecliptic).
 */
function angularSeparationFromSun(
  planetLongitude: number,
  planetLatitude: number,
  sunLongitude: number,
): number {
  const dLon = longitudeDelta(planetLongitude, sunLongitude) * DEG2RAD;
  const lat = planetLatitude * DEG2RAD;
  const cosD = Math.cos(lat) * Math.cos(dLon);
  // Clamp for float safety before acos.
  return Math.acos(Math.min(1, Math.max(-1, cosD))) * RAD2DEG;
}

/**
 * Classify a body's relationship to the Sun's rays by TRUE angular distance to
 * the Sun's body (great-circle separation across longitude AND latitude), not by
 * ecliptic-longitude difference alone. `planetLatitude` is the body's ecliptic
 * latitude (PlanetPosition.eclipticLatitude); the Sun's is ~0. Passing 0 reduces
 * exactly to the old longitude-only behaviour.
 */
export function sunProximity(
  planetLongitude: number,
  sunLongitude: number,
  planetLatitude = 0,
): SunProximity {
  const distanceDeg = angularSeparationFromSun(planetLongitude, planetLatitude, sunLongitude);
  let state: SolarPhase = "clear";
  if (distanceDeg <= CAZIMI_DEG) state = "cazimi";
  else if (distanceDeg <= COMBUST_DEG) state = "combust";
  else if (distanceDeg <= UNDER_BEAMS_DEG) state = "under-beams";
  return { state, distanceDeg };
}
