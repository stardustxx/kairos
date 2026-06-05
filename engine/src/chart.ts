import { resolveJulianDay } from "./time.js";
import { computePositions } from "./positions.js";
import { computeHouses } from "./houses.js";
import { computeAspects } from "./aspects.js";
import type { Chart, ChartKind, MomentInput } from "./types.js";

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
  return { kind, julianDayUt, utc, planets, houses, aspects };
}
