import { resolveJulianDay } from "./time.js";
import { computePositions } from "./positions.js";
import { computeHouses } from "./houses.js";
import { computeAspects } from "./aspects.js";
import type { Chart, ChartKind, MomentInput } from "./types.js";

export function buildChart(kind: ChartKind, moment: MomentInput): Chart {
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
  const aspects = computeAspects(planets);
  return { kind, julianDayUt, utc, planets, houses, aspects };
}
