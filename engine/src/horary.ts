import { SIGN_RULER, PLANETS, DEGREES_PER_SIGN, SIGN_COUNT } from "./constants.js";
import { computeAspects } from "./aspects.js";
import { houseOf } from "./houses.js";
import type {
  Aspect,
  Chart,
  CollectionOfLight,
  Confidence,
  HoraryJudgment,
  Lean,
  PlanetPosition,
  TranslationOfLight,
} from "./types.js";

const SOFT_ASPECTS = new Set(["conjunction", "sextile", "trine"]);

function rulerOfCusp(cuspLongitude: number): string {
  const signIndex = Math.floor(cuspLongitude / DEGREES_PER_SIGN) % SIGN_COUNT;
  return SIGN_RULER[signIndex];
}

/** Find the aspect between two named bodies in an aspect list, if any. */
function aspectBetween(aspects: Aspect[], n1: string, n2: string): Aspect | null {
  return (
    aspects.find(
      (a) => (a.a === n1 && a.b === n2) || (a.a === n2 && a.b === n1),
    ) ?? null
  );
}

/**
 * Translation of light: a third planet separating from one significator and
 * applying to the other, carrying the light between them so the matter perfects
 * indirectly. Returns the first such translator found, or null.
 */
function findTranslation(
  aspects: Aspect[],
  querentSig: string,
  quesitedSig: string,
  bodies: PlanetPosition[],
): TranslationOfLight | null {
  for (const T of bodies) {
    if (T.name === querentSig || T.name === quesitedSig) continue;
    const toQuerent = aspectBetween(aspects, T.name, querentSig);
    const toQuesited = aspectBetween(aspects, T.name, quesitedSig);
    if (!toQuerent || !toQuesited) continue;
    // Separating from one significator, applying to the other = translating.
    if (!toQuerent.applying && toQuesited.applying) {
      return { translator: T.name, from: querentSig, to: quesitedSig, aspect: toQuesited.type };
    }
    if (!toQuesited.applying && toQuerent.applying) {
      return { translator: T.name, from: quesitedSig, to: querentSig, aspect: toQuerent.type };
    }
  }
  return null;
}

/**
 * Collection of light: a third (typically heavier) planet that BOTH
 * significators apply to, gathering their light so the matter perfects through
 * an intermediary. Returns the first such collector found, or null.
 */
function findCollection(
  aspects: Aspect[],
  querentSig: string,
  quesitedSig: string,
  bodies: PlanetPosition[],
): CollectionOfLight | null {
  for (const T of bodies) {
    if (T.name === querentSig || T.name === quesitedSig) continue;
    const fromQuerent = aspectBetween(aspects, T.name, querentSig);
    const fromQuesited = aspectBetween(aspects, T.name, quesitedSig);
    if (fromQuerent?.applying && fromQuesited?.applying) {
      return {
        collector: T.name,
        fromQuerent: fromQuerent.type,
        fromQuesited: fromQuesited.type,
      };
    }
  }
  return null;
}

/**
 * Aggregate the testimonies into a calibrated score, confidence band, and lean.
 * This is a transparent heuristic over the classical perfection signals — a
 * calibration aid for the skill, not an oracle.
 */
function aggregateTestimony(args: {
  significatorAspect: Aspect | null;
  moonApplyingToQuesited: Aspect | null;
  translation: TranslationOfLight | null;
  collection: CollectionOfLight | null;
  moonVoid: boolean;
}): { score: number; confidence: Confidence; lean: Lean; testimonies: string[] } {
  const t: string[] = [];
  let score = 0;

  const a = args.significatorAspect;
  if (a && a.applying) {
    if (SOFT_ASPECTS.has(a.type)) {
      score += 40;
      t.push(`Significators perfect by applying ${a.type} (+40)`);
    } else if (a.type === "square") {
      score += 8;
      t.push(`Significators apply by square — perfection with friction (+8)`);
    } else {
      score -= 8;
      t.push(`Significators apply by opposition — perfection but regret (-8)`);
    }
  } else if (a) {
    t.push(`Significators only separating (${a.type}) — the matter is past, not forming (0)`);
  } else {
    t.push("No direct aspect between the significators (0)");
  }

  const m = args.moonApplyingToQuesited;
  if (m) {
    if (SOFT_ASPECTS.has(m.type)) {
      score += 20;
      t.push(`Moon (co-significator of querent) applies by ${m.type} to the quesited (+20)`);
    } else {
      score += 5;
      t.push(`Moon applies by ${m.type} to the quesited — testimony with difficulty (+5)`);
    }
  }

  if (args.translation) {
    score += 18;
    t.push(
      `Translation of light by ${args.translation.translator} ` +
        `(${args.translation.from} → ${args.translation.to}) (+18)`,
    );
  }
  if (args.collection) {
    score += 15;
    t.push(`Collection of light by ${args.collection.collector} (+15)`);
  }
  if (args.moonVoid) {
    score -= 30;
    t.push("Moon void of course — little is likely to come of the matter (-30)");
  }

  const lean: Lean = score > 15 ? "favorable" : score < -15 ? "unfavorable" : "uncertain";

  const strength = Math.abs(score);
  let confidence: Confidence = "low";
  if (strength >= 40) confidence = "high";
  else if (strength >= 20) confidence = "medium";
  // A void Moon contradicting a favorable lean caps confidence — mixed signals.
  if (args.moonVoid && lean === "favorable") confidence = "low";

  return { score, confidence, lean, testimonies: t };
}

/** The Moon is void of course if it forms no further major aspect before
 *  leaving its current sign. Traditionally only the 7 classical planets count.
 *
 *  NOTE: v1 approximation — this compares the tightest applying aspect's current
 *  orb to the Moon's remaining arc in its sign, not the exact relative-motion
 *  perfection time. */
export function moonVoidStatus(planets: PlanetPosition[]): { void: boolean; next: Aspect | null } {
  const moon = planets.find((p) => p.name === "Moon")!;
  const degreesToSignEnd = DEGREES_PER_SIGN - moon.degInSign;
  // Restrict to the classical bodies (Moon + the 6 other traditional planets).
  const classicalNames = new Set(PLANETS.filter((d) => d.classical).map((d) => d.name));
  const classical = planets.filter((p) => classicalNames.has(p.name));
  // Find the Moon's next applying major aspect to any classical body.
  const aspectsWithMoon = computeAspects(classical).filter(
    (a) => (a.a === "Moon" || a.b === "Moon") && a.applying,
  );
  if (aspectsWithMoon.length === 0) {
    return { void: true, next: null };
  }
  // Approximate degrees until exact for the tightest applying aspect.
  const next = aspectsWithMoon.reduce((best, a) => (a.orb < best.orb ? a : best));
  const isVoid = next.orb > degreesToSignEnd;
  return { void: isVoid, next };
}

export function judgeHorary(chart: Chart, quesitedHouse: number): HoraryJudgment {
  if (quesitedHouse < 2 || quesitedHouse > 12) {
    throw new Error(`quesitedHouse must be 2..12, got ${quesitedHouse}`);
  }
  const querentSig = rulerOfCusp(chart.houses.cusps[0]);
  const quesitedSig = rulerOfCusp(chart.houses.cusps[quesitedHouse - 1]);

  const sigA = chart.planets.find((p) => p.name === querentSig);
  const sigB = chart.planets.find((p) => p.name === quesitedSig);
  let significatorAspect: Aspect | null = null;
  if (sigA && sigB && sigA.name !== sigB.name) {
    const between = computeAspects([sigA, sigB]);
    const applying = between.filter((a) => a.applying);
    significatorAspect =
      (applying.length ? applying : between).sort((x, y) => x.orb - y.orb)[0] ?? null;
  }

  const querentSignificatorHouse = sigA ? houseOf(sigA.longitude, chart.houses.cusps) : 0;
  const quesitedSignificatorHouse = sigB ? houseOf(sigB.longitude, chart.houses.cusps) : 0;

  const moon = moonVoidStatus(chart.planets);

  // Aspects among the classical bodies, for co-significator / translation /
  // collection testimonies.
  const classicalNames = new Set(PLANETS.filter((d) => d.classical).map((d) => d.name));
  const classical = chart.planets.filter((p) => classicalNames.has(p.name));
  const classicalAspects = computeAspects(classical);

  // Moon as co-significator of the querent: its applying aspect to the quesited
  // significator. Skip when the Moon is itself one of the significators (already
  // captured by significatorAspect).
  let moonApplyingToQuesited: Aspect | null = null;
  if (querentSig !== "Moon" && quesitedSig !== "Moon" && sigB) {
    const moonToQuesited = aspectBetween(classicalAspects, "Moon", quesitedSig);
    moonApplyingToQuesited = moonToQuesited?.applying ? moonToQuesited : null;
  }

  const translationOfLight =
    sigA && sigB && sigA.name !== sigB.name
      ? findTranslation(classicalAspects, querentSig, quesitedSig, classical)
      : null;
  const collectionOfLight =
    sigA && sigB && sigA.name !== sigB.name
      ? findCollection(classicalAspects, querentSig, quesitedSig, classical)
      : null;

  const { score, confidence, lean, testimonies } = aggregateTestimony({
    significatorAspect,
    moonApplyingToQuesited,
    translation: translationOfLight,
    collection: collectionOfLight,
    moonVoid: moon.void,
  });

  return {
    querentSignificator: querentSig,
    quesitedSignificator: quesitedSig,
    querentSignificatorHouse,
    quesitedSignificatorHouse,
    significatorAspect,
    moonVoidOfCourse: moon.void,
    moonNextAspect: moon.next,
    moonApplyingToQuesited,
    translationOfLight,
    collectionOfLight,
    score,
    confidence,
    lean,
    testimonies,
  };
}
