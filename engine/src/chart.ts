import { computeAspects } from "./aspects.js";
import { sunProximity } from "./conditions.js";
import { DEGREES_PER_SIGN, PLANETS, SIGN_COUNT, SIGNS } from "./constants.js";
import { computeDignities } from "./dignities.js";
import { computeHouses, houseOf } from "./houses.js";
import { computePositions } from "./positions.js";
import { resolveJulianDay } from "./time.js";
import type { Chart, ChartKind, MomentInput, PartOfFortune } from "./types.js";

const CLASSICAL = new Set(PLANETS.filter((d) => d.classical).map((d) => d.name));

function norm360(x: number): number {
  return ((x % 360) + 360) % 360;
}

function partOfFortune(
  asc: number,
  sun: number,
  moon: number,
  sect: "day" | "night",
  cusps: number[],
): PartOfFortune {
  // Day: Asc + Moon - Sun. Night: Asc + Sun - Moon.
  const lon = norm360(sect === "day" ? asc + moon - sun : asc + sun - moon);
  const si = Math.floor(lon / DEGREES_PER_SIGN) % SIGN_COUNT;
  return {
    longitude: lon,
    sign: SIGNS[si],
    degInSign: lon - si * DEGREES_PER_SIGN,
    house: houseOf(lon, cusps),
  };
}

export interface BuildChartOptions {
  /**
   * When true (default), aspects are annotated with their exact perfection time
   * (perfectsAtUtc) via ephemeris root-finding — accurate but ~10-20x more
   * ephemeris calls per aspect. Set false for bulk scans (e.g. electional) that
   * only need aspect type + applying/separating, not the exact timing.
   */
  aspectTiming?: boolean;
}

export function buildChart(
  kind: ChartKind,
  moment: MomentInput,
  options: BuildChartOptions = {},
): Chart {
  const { aspectTiming = true } = options;
  const { julianDayUt, utc } = resolveJulianDay(moment);
  const planets = computePositions(julianDayUt);
  // Default house system: Regiomontanus ("R") for horary, Placidus ("P") otherwise.
  // An explicit moment.houseSystem always overrides the default.
  const defaultHouseSystem = kind === "horary" ? "R" : "P";
  const houses = computeHouses(
    julianDayUt,
    moment.latitude,
    moment.longitude,
    moment.houseSystem ?? defaultHouseSystem,
  );
  // Passing julianDayUt enables exact-perfection root-finding; omit it to use the
  // cheap finite-difference applying/separating path (no perfectsAtUtc).
  const aspects = aspectTiming
    ? computeAspects(planets, julianDayUt)
    : computeAspects(planets);

  // Sect: the Sun above the horizon (houses 7..12) = a day chart.
  const sun = planets.find((p) => p.name === "Sun")!;
  const moon = planets.find((p) => p.name === "Moon")!;
  const sunHouse = houseOf(sun.longitude, houses.cusps);
  const sect: "day" | "night" = sunHouse >= 7 && sunHouse <= 12 ? "day" : "night";

  // Attach essential dignities to the seven classical planets (the only bodies
  // with traditional rulerships); outer points have no essential dignity. Solar
  // proximity (combust/cazimi/under-beams) is geometric — attach to every body
  // except the Sun itself.
  for (const p of planets) {
    p.house = houseOf(p.longitude, houses.cusps);
    if (CLASSICAL.has(p.name)) {
      p.dignities = computeDignities(p.name, p.longitude, sect);
    }
    if (p.name !== "Sun") {
      p.sunProximity = sunProximity(p.longitude, sun.longitude);
    }
  }

  const fortune = partOfFortune(houses.ascendant, sun.longitude, moon.longitude, sect, houses.cusps);

  return { kind, julianDayUt, utc, planets, houses, aspects, sect, partOfFortune: fortune };
}

/**
 * Recast a chart's houses/angles for a different place, keeping the same moment
 * (so the planets' longitudes and aspects are unchanged). Re-houses every body,
 * recomputes sect, triplicity-dependent dignities, and the Part of Fortune for
 * the new location. This is the classical "relocated chart."
 */
export function relocateChart(
  chart: Chart,
  latitude: number,
  longitude: number,
  houseSystem?: string,
): Chart {
  const houses = computeHouses(
    chart.julianDayUt,
    latitude,
    longitude,
    houseSystem ?? chart.houses.system,
  );
  const sun = chart.planets.find((p) => p.name === "Sun")!;
  const moon = chart.planets.find((p) => p.name === "Moon")!;
  const sunHouse = houseOf(sun.longitude, houses.cusps);
  const sect: "day" | "night" = sunHouse >= 7 && sunHouse <= 12 ? "day" : "night";

  const planets = chart.planets.map((p) => {
    const np = { ...p };
    np.house = houseOf(p.longitude, houses.cusps);
    // Triplicity (and thus the dignity score) depends on sect, which can flip
    // with relocation; sunProximity is geometric and is left untouched.
    if (CLASSICAL.has(p.name)) np.dignities = computeDignities(p.name, p.longitude, sect);
    return np;
  });

  const fortune = partOfFortune(houses.ascendant, sun.longitude, moon.longitude, sect, houses.cusps);
  return { ...chart, planets, houses, sect, partOfFortune: fortune };
}
