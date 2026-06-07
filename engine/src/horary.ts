import { almutenOfDegree } from "./almuten.js";
import { computeAspects } from "./aspects.js";
import { DEGREES_PER_SIGN, PLANETS, SIGN_COUNT, SIGN_RULER } from "./constants.js";
import { receptionBetween } from "./dignities.js";
import { houseOf } from "./houses.js";
import { detectBesieging, detectProhibition, detectRefranation } from "./perfection.js";
import type {
  Aspect,
  Chart,
  CollectionOfLight,
  Confidence,
  HoraryJudgment,
  Lean,
  PlanetPosition,
  Prohibition,
  Reception,
  Refranation,
  SolarPhase,
  TranslationOfLight,
} from "./types.js";

const SOFT_ASPECTS = new Set(["conjunction", "sextile", "trine"]);

function rulerOfCusp(cuspLongitude: number): string {
  const signIndex = Math.floor(cuspLongitude / DEGREES_PER_SIGN) % SIGN_COUNT;
  return SIGN_RULER[signIndex];
}

/** English ordinal for a house number, e.g. 1 -> "1st", 10 -> "10th". */
function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
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
  reception: Reception | null;
  querentSig: string;
  quesitedSig: string;
  querentDignity: number;
  quesitedDignity: number;
  querentSolar: SolarPhase;
  quesitedSolar: SolarPhase;
  querentRetro: boolean;
  quesitedRetro: boolean;
  moonVoid: boolean;
  prohibition: Prohibition | null;
  refranation: Refranation | null;
  besieging: Array<{ significator: string; planet: string }>;
}): { score: number; confidence: Confidence; lean: Lean; testimonies: string[] } {
  const t: string[] = [];
  let score = 0;

  const a = args.significatorAspect;
  if (a?.applying) {
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

  const r = args.reception;
  if (r?.kind === "mutual") {
    score += 15;
    t.push(
      `Significators in mutual reception ` +
        `(${args.querentSig} by ${r.bReceivesABy}, ${args.quesitedSig} by ${r.aReceivesBBy}) ` +
        `— can perfect through dignity exchange (+15)`,
    );
  } else if (r?.kind === "one-way") {
    score += 5;
    const who = r.aReceivesBBy ? args.querentSig : args.quesitedSig;
    const by = r.aReceivesBBy ?? r.bReceivesABy;
    t.push(`One-way reception (${who} receives the other by ${by}) (+5)`);
  }

  // Significator essential strength: a well-dignified significator helps, a
  // debilitated one (detriment/fall/peregrine) undermines its promise.
  for (const [label, dignity] of [
    [`Querent significator ${args.querentSig}`, args.querentDignity],
    [`Quesited significator ${args.quesitedSig}`, args.quesitedDignity],
  ] as [string, number][]) {
    if (dignity >= 4) {
      score += 5;
      t.push(`${label} well-dignified (dignity ${dignity >= 0 ? "+" : ""}${dignity}) (+5)`);
    } else if (dignity <= -5) {
      score -= 5;
      t.push(`${label} debilitated (dignity ${dignity}) (-5)`);
    }
  }

  // Solar condition of each significator: combust = hidden/weak, cazimi = strong.
  for (const [label, solar] of [
    [`Querent significator ${args.querentSig}`, args.querentSolar],
    [`Quesited significator ${args.quesitedSig}`, args.quesitedSolar],
  ] as [string, SolarPhase][]) {
    if (solar === "cazimi") {
      score += 5;
      t.push(`${label} cazimi — in the Sun's heart, greatly strengthened (+5)`);
    } else if (solar === "combust") {
      score -= 7;
      t.push(`${label} combust the Sun — hidden/weakened (-7)`);
    } else if (solar === "under-beams") {
      score -= 3;
      t.push(`${label} under the Sun's beams — weakened (-3)`);
    }
  }

  // A retrograde significator: hesitation, reversal, things going backward.
  for (const [label, retro] of [
    [`Querent significator ${args.querentSig}`, args.querentRetro],
    [`Quesited significator ${args.quesitedSig}`, args.quesitedRetro],
  ] as [string, boolean][]) {
    if (retro) {
      score -= 4;
      t.push(`${label} retrograde — hesitation or reversal (-4)`);
    }
  }

  // Perfection-breakers: even when the significators apply to perfection, the
  // matter can be cut off. These are strong denials that can overturn an
  // otherwise-favorable lean. The detectors already require an applying
  // significator aspect, so a breaker here means a real interception.
  if (args.prohibition) {
    score -= 25;
    t.push(
      `Prohibition: ${args.prohibition.prohibitor} perfects by ${args.prohibition.aspect} ` +
        `with ${args.prohibition.target} before the significators — the matter is cut off (-25)`,
    );
  }
  if (args.refranation) {
    score -= 22;
    t.push(
      `Refranation: ${args.refranation.planet} turns back (retrograde/stationing) before the ` +
        `significators perfect — the matter withdraws (-22)`,
    );
  }
  for (const b of args.besieging) {
    score -= 12;
    t.push(
      `${b.significator} significator ${b.planet} besieged between Mars and Saturn ` +
        `— hemmed by both malefics (-12)`,
    );
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

/** The Moon is void of course if it perfects no further major aspect to a
 *  classical planet before leaving its current sign.
 *
 *  Uses relative motion: time-to-perfection = orb / |moonSpeed - otherSpeed|,
 *  compared against time-to-sign-change = remaining arc / moonSpeed. This is the
 *  standard practical method and far tighter than the old orb-vs-arc heuristic.
 *  `next` is the soonest-perfecting applying aspect (by time, not just orb). */
export function moonVoidStatus(planets: PlanetPosition[]): { void: boolean; next: Aspect | null } {
  const moon = planets.find((p) => p.name === "Moon")!;
  const moonSpeed = Math.abs(moon.speed) || 13.2; // deg/day; guard against 0
  const degreesToSignEnd = DEGREES_PER_SIGN - moon.degInSign;
  const daysToSignChange = degreesToSignEnd / moonSpeed;

  // Restrict to the classical bodies (Moon + the 6 other traditional planets).
  const classicalNames = new Set(PLANETS.filter((d) => d.classical).map((d) => d.name));
  const classical = planets.filter((p) => classicalNames.has(p.name));
  const speedOf = (name: string): number => classical.find((p) => p.name === name)?.speed ?? 0;

  const aspectsWithMoon = computeAspects(classical).filter(
    (a) => (a.a === "Moon" || a.b === "Moon") && a.applying,
  );
  if (aspectsWithMoon.length === 0) {
    return { void: true, next: null };
  }

  // Days until each applying aspect perfects, by relative angular velocity.
  let next: Aspect | null = null;
  let soonestDays = Number.POSITIVE_INFINITY;
  for (const a of aspectsWithMoon) {
    const otherName = a.a === "Moon" ? a.b : a.a;
    const relSpeed = Math.abs(moonSpeed - speedOf(otherName)) || moonSpeed;
    const days = a.orb / relSpeed;
    if (days < soonestDays) {
      soonestDays = days;
      next = a;
    }
  }
  const isVoid = soonestDays > daysToSignChange;
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

  const significatorReception =
    sigA && sigB && sigA.name !== sigB.name
      ? receptionBetween(querentSig, sigA.longitude, quesitedSig, sigB.longitude)
      : null;
  const querentSignificatorDignity = sigA?.dignities?.score ?? 0;
  const quesitedSignificatorDignity = sigB?.dignities?.score ?? 0;

  // Perfection-breakers, over the classical bodies. Prohibition/refranation only
  // apply when there are two distinct significators that could perfect; the
  // detectors themselves require an applying significator aspect, so they return
  // null otherwise. Besieging is checked for each significator independently.
  const haveTwoSigs = !!(sigA && sigB && sigA.name !== sigB.name);
  const prohibition = haveTwoSigs
    ? detectProhibition(querentSig, quesitedSig, classical)
    : null;
  const refranation = haveTwoSigs
    ? detectRefranation(querentSig, quesitedSig, classical)
    : null;
  // Besieging is checked per significator, but when the querent and quesited
  // significator are the SAME planet (shared domicile ruler), one physical
  // affliction must not be counted twice — only push the quesited entry when it
  // is a distinct planet.
  const besieging: Array<{ significator: string; planet: string }> = [];
  if (sigA && detectBesieging(querentSig, classical)) {
    besieging.push({ significator: "querent", planet: querentSig });
  }
  if (sigB && quesitedSig !== querentSig && detectBesieging(quesitedSig, classical)) {
    besieging.push({ significator: "quesited", planet: quesitedSig });
  }

  // Almuten of the Ascendant (querent) and of the quesited-house cusp: the planet
  // with the most essential dignity over that degree — sometimes more dignified
  // than the simple domicile ruler, in which case it has the strongest say.
  const querentAlmutenFull = almutenOfDegree(chart.houses.cusps[0], chart.sect);
  const quesitedAlmutenFull = almutenOfDegree(chart.houses.cusps[quesitedHouse - 1], chart.sect);
  const querentAlmuten = { planet: querentAlmutenFull.planet, score: querentAlmutenFull.score };
  const quesitedAlmuten = { planet: quesitedAlmutenFull.planet, score: quesitedAlmutenFull.score };
  const querentAlmutenDiffersFromRuler = querentAlmuten.planet !== querentSig;
  const quesitedAlmutenDiffersFromRuler = quesitedAlmuten.planet !== quesitedSig;

  const { score, confidence, lean, testimonies } = aggregateTestimony({
    significatorAspect,
    moonApplyingToQuesited,
    translation: translationOfLight,
    collection: collectionOfLight,
    reception: significatorReception,
    querentSig,
    quesitedSig,
    querentDignity: querentSignificatorDignity,
    quesitedDignity: quesitedSignificatorDignity,
    querentSolar: sigA?.sunProximity?.state ?? "clear",
    quesitedSolar: sigB?.sunProximity?.state ?? "clear",
    querentRetro: sigA?.retrograde ?? false,
    quesitedRetro: sigB?.retrograde ?? false,
    moonVoid: moon.void,
    prohibition,
    refranation,
    besieging,
  });

  // Informational almuten testimonies: when the almuten of a cusp is NOT its
  // domicile ruler, name the planet that truly has the most say over the matter.
  // Neutral — does not flip the verdict (0 points).
  if (querentAlmutenDiffersFromRuler) {
    testimonies.push(
      `Almuten of the 1st (querent) is ${querentAlmuten.planet} ` +
        `(more dignified than ruler ${querentSig}) ` +
        `— ${querentAlmuten.planet} has the strongest say over the querent (0)`,
    );
  }
  if (quesitedAlmutenDiffersFromRuler) {
    testimonies.push(
      `Almuten of the ${ordinal(quesitedHouse)} is ${quesitedAlmuten.planet} ` +
        `(more dignified than ruler ${quesitedSig}) ` +
        `— ${quesitedAlmuten.planet} has the strongest say over the matter (0)`,
    );
  }

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
    significatorReception,
    querentSignificatorDignity,
    quesitedSignificatorDignity,
    querentAlmuten,
    quesitedAlmuten,
    querentAlmutenDiffersFromRuler,
    quesitedAlmutenDiffersFromRuler,
    prohibition,
    refranation,
    besieging,
    score,
    confidence,
    lean,
    testimonies,
  };
}
