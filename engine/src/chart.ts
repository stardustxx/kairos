import { resolveJulianDay } from "./time.js";
import { computePositions } from "./positions.js";
import { computeHouses } from "./houses.js";
import { computeAspects } from "./aspects.js";
import type { Chart, ChartKind, MomentInput } from "./types.js";

export function buildChart(kind: ChartKind, moment: MomentInput): Chart {
  const { julianDayUt, utc } = resolveJulianDay(moment);
  const planets = computePositions(julianDayUt);
  const houses = computeHouses(
    julianDayUt,
    moment.latitude,
    moment.longitude,
    moment.houseSystem ?? "P",
  );
  const aspects = computeAspects(planets);
  return { kind, julianDayUt, utc, planets, houses, aspects };
}
