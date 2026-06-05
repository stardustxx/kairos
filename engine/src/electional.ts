import { DateTime } from "luxon";
import { SIGN_RULER, DEGREES_PER_SIGN, SIGN_COUNT } from "./constants.js";
import { buildChart } from "./chart.js";
import { computeAspects } from "./aspects.js";
import { houseOf } from "./houses.js";
import { moonVoidStatus } from "./horary.js";
import type {
  Aspect,
  Chart,
  ElectionalCandidate,
  ElectionalResult,
  ElectionalWindow,
  MomentInput,
  SignificatorHints,
} from "./types.js";

const BENEFICS = new Set(["Venus", "Jupiter"]);
const MALEFICS = new Set(["Mars", "Saturn"]);
const ANGULAR_HOUSES = new Set([1, 4, 7, 10]);

// Signs traditionally read as fortunate / where benefics or the Moon do well.
const BENEFIC_SIGNS = new Set(["Taurus", "Cancer", "Sagittarius", "Pisces"]);
// Signs of detriment/fall for the Moon (used for a mild penalty).
const MOON_WEAK_SIGNS = new Set(["Capricorn", "Scorpio"]);

const MAX_RESULTS = 10;
const MAX_CANDIDATES = 10_000; // safety cap; large window + tiny step is gated here.

function rulerOfCusp(cuspLongitude: number): string {
  const signIndex = Math.floor(cuspLongitude / DEGREES_PER_SIGN) % SIGN_COUNT;
  return SIGN_RULER[signIndex];
}

/**
 * Identify the querent (1st-house ruler) and quesited (`quesitedHouse` ruler)
 * significators by classical sign rulership, mirroring horary. A caller hint can
 * override the quesited significator.
 */
export function findSignificators(
  chart: Chart,
  quesitedHouse: number,
  hints?: SignificatorHints,
): { querent: string; quesited: string } {
  const querent = rulerOfCusp(chart.houses.cusps[0]);
  const quesited =
    hints?.planet ?? rulerOfCusp(chart.houses.cusps[quesitedHouse - 1]);
  return { querent, quesited };
}

/**
 * Classify an aspect's quality for electional purposes.
 *  - trine / sextile: favorable (soft)
 *  - conjunction: favorable only between/with benefics, else unfavorable
 *  - square / opposition: unfavorable (hard)
 * `strength` scales 0..1 with orb tightness within the aspect's allowed orb
 * (we approximate the orb cap from the aspect type).
 */
export function evaluateAspectQuality(aspect: Aspect): {
  favorable: boolean;
  strength: number;
} {
  const orbCap =
    aspect.type === "sextile" ? 4 : aspect.type === "square" ? 7 : 8;
  const strength = Math.max(0, 1 - aspect.orb / orbCap);

  let favorable: boolean;
  if (aspect.type === "trine" || aspect.type === "sextile") {
    favorable = true;
  } else if (aspect.type === "conjunction") {
    const benefic = BENEFICS.has(aspect.a) || BENEFICS.has(aspect.b);
    const malefic = MALEFICS.has(aspect.a) || MALEFICS.has(aspect.b);
    favorable = benefic && !malefic;
  } else {
    favorable = false; // square / opposition
  }
  return { favorable, strength };
}

/**
 * Score a single candidate chart against traditional electional rules. Returns
 * a numeric score (baseline 50; higher is better) plus the human-readable
 * reasons that produced it. Each contributing rule pushes a "Reason ±N" string.
 */
export function scoreElectionalMoment(
  chart: Chart,
  quesitedHouse: number,
  hints?: SignificatorHints,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 50; // neutral baseline

  const add = (delta: number, why: string) => {
    score += delta;
    reasons.push(`${why} ${delta >= 0 ? "+" : ""}${delta}`);
  };

  const planets = chart.planets;
  const moon = planets.find((p) => p.name === "Moon")!;

  // --- Moon: the primary timer ---
  const moonStatus = moonVoidStatus(planets);
  if (moonStatus.void) {
    add(-40, "Moon void-of-course");
  } else {
    add(20, "Moon not void-of-course");
  }

  const moonHouse = houseOf(moon.longitude, chart.houses.cusps);
  if (BENEFIC_SIGNS.has(moon.sign)) {
    add(15, `Moon in ${moon.sign} (benefic sign)`);
  } else if (MOON_WEAK_SIGNS.has(moon.sign)) {
    add(-10, `Moon in ${moon.sign} (weak sign)`);
  }
  if (ANGULAR_HOUSES.has(moonHouse)) {
    add(10, `Moon angular (house ${moonHouse})`);
  }

  // --- Benefics / malefics by house placement ---
  for (const name of ["Venus", "Jupiter"]) {
    const planet = planets.find((p) => p.name === name);
    if (!planet) continue;
    const house = houseOf(planet.longitude, chart.houses.cusps);
    if (ANGULAR_HOUSES.has(house)) {
      add(25, `${name} angular (house ${house}, benefic)`);
    }
    if (BENEFIC_SIGNS.has(planet.sign)) {
      add(10, `${name} in strong sign ${planet.sign}`);
    }
  }
  for (const name of ["Mars", "Saturn"]) {
    const planet = planets.find((p) => p.name === name);
    if (!planet) continue;
    const house = houseOf(planet.longitude, chart.houses.cusps);
    if (ANGULAR_HOUSES.has(house)) {
      add(-15, `${name} angular (house ${house}, malefic)`);
    }
  }

  // --- Significators and their mutual aspect ---
  const { querent, quesited } = findSignificators(chart, quesitedHouse, hints);
  const sigA = planets.find((p) => p.name === querent);
  const sigB = planets.find((p) => p.name === quesited);
  if (sigA && sigB && sigA.name !== sigB.name) {
    const between = computeAspects([sigA, sigB]);
    const applying = between.filter((a) => a.applying);
    const chosen =
      (applying.length ? applying : between).sort((x, y) => x.orb - y.orb)[0] ??
      null;
    if (chosen) {
      const { favorable, strength } = evaluateAspectQuality(chosen);
      if (favorable && chosen.applying) {
        // Base 30, bonused up to +15 more for a tight orb (strength 0..1).
        const points = Math.round(30 + 15 * strength);
        add(
          points,
          `Significators ${querent}/${quesited} applying ${chosen.type} (favorable, orb ${chosen.orb.toFixed(1)})`,
        );
      } else if (!favorable) {
        const malefic = MALEFICS.has(chosen.a) || MALEFICS.has(chosen.b);
        const penalty = malefic ? -35 : -30;
        add(
          penalty,
          `Significators ${querent}/${quesited} ${chosen.type} (hard)`,
        );
      } else {
        // favorable but separating
        add(-10, `Significators ${querent}/${quesited} separating`);
      }
    } else {
      add(-10, `Significators ${querent}/${quesited} non-aspecting`);
    }
  }

  return { score, reasons };
}

/**
 * Scan a local-time window in `stepMinutes` increments, score each moment as an
 * electional chart, and return the top moments plus the count evaluated.
 * Reuses horary-style chart construction (Regiomontanus houses) per candidate.
 */
export function searchElectionalMoments(
  window: ElectionalWindow,
  stepMinutes: number,
  // datetimeLocal (if present) is ignored: each candidate's time is supplied by
  // the scan. Accept it optionally so a full MomentInput is also assignable.
  location: Omit<MomentInput, "datetimeLocal"> & { datetimeLocal?: string },
  quesitedHouse: number,
  hints?: SignificatorHints,
): ElectionalResult {
  if (!Number.isFinite(stepMinutes) || stepMinutes <= 0) {
    throw new Error(`stepMinutes must be a positive number, got ${stepMinutes}`);
  }
  if (quesitedHouse < 2 || quesitedHouse > 12) {
    throw new Error(`quesitedHouse must be 2..12, got ${quesitedHouse}`);
  }

  const zone =
    location.timezone ??
    // Defer to resolveJulianDay's own lat/lon lookup for the actual cast;
    // here we only need a zone to iterate local wall-clock times consistently.
    undefined;

  const start = DateTime.fromISO(window.startLocal, zone ? { zone } : undefined);
  const end = DateTime.fromISO(window.endLocal, zone ? { zone } : undefined);
  if (!start.isValid || !end.isValid) {
    throw new Error(
      `Invalid electional window "${window.startLocal}".."${window.endLocal}"`,
    );
  }
  if (end <= start) {
    throw new Error("electional window endLocal must be after startLocal");
  }

  const candidates: ElectionalCandidate[] = [];
  let cursor = start;
  let evaluated = 0;
  while (cursor <= end) {
    if (evaluated >= MAX_CANDIDATES) {
      throw new Error(
        `electional search exceeded ${MAX_CANDIDATES} candidates; widen stepMinutes or narrow the window`,
      );
    }
    const datetimeLocal = cursor.toISO({
      includeOffset: false,
      suppressMilliseconds: true,
    })!;
    // Skip exact aspect-perfection root-finding: scoring only needs aspect type
    // + applying/separating, and the timing pass dominates per-candidate cost.
    const chart = buildChart(
      "electional",
      { ...location, datetimeLocal },
      { aspectTiming: false },
    );
    const { score, reasons } = scoreElectionalMoment(chart, quesitedHouse, hints);
    candidates.push({ datetimeLocal, score, reasons });
    evaluated++;
    cursor = cursor.plus({ minutes: stepMinutes });
  }

  const topMoments = candidates
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS);

  return { topMoments, candidatesEvaluated: evaluated };
}
