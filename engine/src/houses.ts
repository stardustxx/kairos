import sweph from "sweph";
import { HOUSE_FLAGS } from "./constants.js";
import type { Houses } from "./types.js";

export function computeHouses(
  julianDayUt: number,
  latitude: number,
  longitude: number,
  system = "P",
): Houses {
  const res = sweph.houses_ex2(julianDayUt, HOUSE_FLAGS, latitude, longitude, system);
  if (res.error && res.error.length > 0) {
    throw new Error(`sweph.houses_ex2 failed: ${res.error}`);
  }
  const cusps = res.data.houses.slice(0, 12);
  // points array order: [ascendant, mc, armc, vertex, ...]
  const ascendant = res.data.points[0];
  const mc = res.data.points[1];
  return { system, cusps, ascendant, mc };
}

/**
 * Derived ("turned") house: the radix house number reached by counting `count`
 * houses from radix house `from`, both 1-based and inclusive of the starting
 * house (classical turning-the-chart counting). E.g. the 9th-from-7th (a third
 * party's long journeys / lawsuits) is `derivedHouse(7, 9) = 3`; the 2nd-from-7th
 * (their money) is `derivedHouse(7, 2) = 8`. Wraps modulo 12.
 */
export function derivedHouse(from: number, count: number): number {
  return ((from - 1 + (count - 1)) % 12 + 12) % 12 + 1;
}

/** House number 1..12 that a longitude falls in, given the cusps. */
export function houseOf(longitude: number, cusps: number[]): number {
  for (let i = 0; i < 12; i++) {
    const start = cusps[i];
    const end = cusps[(i + 1) % 12];
    const span = (end - start + 360) % 360;
    const offset = (longitude - start + 360) % 360;
    if (offset < span) return i + 1;
  }
  return 12;
}
