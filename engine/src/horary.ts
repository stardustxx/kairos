import { almutenOfDegree } from "./almuten.js";
import { computeAspects } from "./aspects.js";
import { DEGREES_PER_SIGN, PLANETS, rulerOfLongitude } from "./constants.js";
import { receptionBetween } from "./dignities.js";
import { houseOf } from "./houses.js";
import {
  detectBesieging,
  detectEnclosure,
  detectProhibition,
  detectRefranation,
  prohibitsDelivery,
} from "./perfection.js";
import { estimateTiming } from "./timing.js";
import type {
  Aspect,
  Chart,
  CollectionOfLight,
  Confidence,
  Enclosure,
  HoraryJudgment,
  Lean,
  PerfectionBreaker,
  PerfectionSynthesis,
  PlanetPosition,
  Prohibition,
  Reception,
  Refranation,
  SolarPhase,
  Timing,
  TranslationOfLight,
} from "./types.js";

const SOFT_ASPECTS = new Set(["conjunction", "sextile", "trine"]);

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
/** A carrier (translator/collector) is "impeded" when it is itself combust or
 *  besieged — an indirect perfection cannot deliver through a damaged carrier. */
interface CarrierSoundness {
  /** True when the carrier is combust or besieged, so it cannot deliver. */
  impeded: boolean;
  /** Plain-language reason ("combust" / "besieged …"), or null when sound. */
  reason: string | null;
}

function aggregateTestimony(args: {
  significatorAspect: Aspect | null;
  moonApplyingToQuesited: Aspect | null;
  translation: TranslationOfLight | null;
  collection: CollectionOfLight | null;
  /** Soundness of the translation's carrier; null when there is no translation. */
  translationCarrier: CarrierSoundness | null;
  /** Soundness of the collection's carrier; null when there is no collection. */
  collectionCarrier: CarrierSoundness | null;
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
  enclosures: Array<{ significator: string; planet: string; enclosure: Enclosure }>;
}): {
  score: number;
  confidence: Confidence;
  lean: Lean;
  perfection: PerfectionSynthesis;
  testimonies: string[];
} {
  const t: string[] = [];
  let score = 0;

  // CATEGORICAL DENIAL SPINE (Lilly CA Bk. III). Perfection-or-denial is
  // categorical: if the perfecting aspect is PROHIBITED (an unreceived prohibition)
  // or REFRANED before it completes, and NO sound translation/collection rescues
  // the matter, then the matter never comes together — so it earns NONE of the
  // positive perfection testimony. A flat additive score would let a single +40
  // perfection outweigh a -25 denial, which is classically wrong: a surviving
  // denial means the matter does not perfect at all.
  //
  // Decide this BEFORE emitting the significator-perfection and Moon-applies lines,
  // so those positive points can be SUPPRESSED (rewritten to "(0)") when a denial
  // survives. The score then goes negative on the denial debit alone, the lean
  // turns unfavorable, and the score STILL equals the sum of the displayed
  // (adjusted) testimony weights — the sensitivity invariant is preserved.
  //
  // A RECEIVED prohibition is NOT a denial (the matter perfects with labour); a
  // sound indirect carrier RESCUES the matter (the +12 recovery path), so neither
  // is a surviving denial. Besieging is an AFFLICTION, not a denial — it stays
  // additive and never suppresses.
  const prohibitionReceived =
    !!args.prohibition &&
    (args.prohibition.receivesTarget || args.prohibition.mutualReception);
  // Preview the sound indirect carrier (translation/collection) WITHOUT mutating
  // score — the testimony-emitting blocks below own the actual scoring. The matter
  // is rescued only when a SOUND carrier survives that is not the prohibitor itself
  // (the prohibitor carrying its own light is abscission, not a rescue).
  let soundCarrierPreview: string | null = null;
  if (args.translation && !args.translationCarrier?.impeded) {
    soundCarrierPreview = args.translation.translator;
  } else if (args.collection && !args.collectionCarrier?.impeded) {
    soundCarrierPreview = args.collection.collector;
  }
  const rescued =
    !!soundCarrierPreview &&
    (!args.prohibition || soundCarrierPreview !== args.prohibition.prohibitor);
  const denyingProhibition = !!args.prohibition && !prohibitionReceived;
  const survivingDenial = (denyingProhibition || !!args.refranation) && !rescued;

  const a = args.significatorAspect;
  if (a?.applying) {
    if (SOFT_ASPECTS.has(a.type)) {
      if (survivingDenial) {
        t.push(
          `Significators apply by ${a.type}, but suppressed: the matter is prohibited before ` +
            `it completes — it earns nothing (0)`,
        );
      } else {
        score += 40;
        t.push(`Significators perfect by applying ${a.type} (+40)`);
      }
    } else if (a.type === "square") {
      if (survivingDenial) {
        t.push(
          `Significators apply by square, but suppressed: the matter is prohibited before ` +
            `it completes — it earns nothing (0)`,
        );
      } else {
        score += 8;
        t.push(`Significators apply by square — perfection with friction (+8)`);
      }
    } else {
      // An applying OPPOSITION is a negative testimony (regret), not a perfection
      // credit — it stays even under a surviving denial.
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
    if (survivingDenial) {
      // The Moon's applying testimony to the quesited is also a perfection signal;
      // when the matter is denied before completion it likewise earns nothing.
      t.push(
        `Moon applies by ${m.type} to the quesited, but suppressed: the matter is prohibited ` +
          `before it completes — it earns nothing (0)`,
      );
    } else if (SOFT_ASPECTS.has(m.type)) {
      score += 20;
      t.push(`Moon (co-significator of querent) applies by ${m.type} to the quesited (+20)`);
    } else {
      score += 5;
      t.push(`Moon applies by ${m.type} to the quesited — testimony with difficulty (+5)`);
    }
  }

  // Indirect perfection only DELIVERS if the carrying/gathering planet is itself
  // sound. A combust or besieged carrier is impeded — suppress the positive
  // testimony and note the impedance instead. Track the FIRST sound carrier so
  // the synthesis (and any prohibition rescue) can name the surviving path.
  let soundIndirectCarrier: string | null = null;
  if (args.translation) {
    if (args.translationCarrier?.impeded) {
      t.push(
        `Translation of light by ${args.translation.translator} ` +
          `(${args.translation.from} → ${args.translation.to}) FAILS — the carrier is ` +
          `impeded (${args.translationCarrier.reason}); the light is not delivered (0)`,
      );
    } else {
      score += 18;
      soundIndirectCarrier = args.translation.translator;
      t.push(
        `Translation of light by ${args.translation.translator} ` +
          `(${args.translation.from} → ${args.translation.to}) (+18)`,
      );
    }
  }
  if (args.collection) {
    if (args.collectionCarrier?.impeded) {
      t.push(
        `Collection of light by ${args.collection.collector} FAILS — the collector is ` +
          `impeded (${args.collectionCarrier.reason}); the light is not gathered (0)`,
      );
    } else {
      score += 15;
      if (!soundIndirectCarrier) soundIndirectCarrier = args.collection.collector;
      t.push(`Collection of light by ${args.collection.collector} (+15)`);
    }
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
  // A prohibition only DENIES when there is no reception (Lilly CA, Bonatti). When
  // the prohibitor RECEIVES the significator it intercepts (by domicile/exaltation,
  // or in mutual reception), the matter is NOT cut off — it perfects with labour.
  // Treat that as a small positive instead of the -25 denial, and do NOT mark it as
  // a perfection-breaker below. (`prohibitionReceived` is computed at the top of
  // this function, where it also gates the categorical denial-spine suppression.)
  if (args.prohibition && prohibitionReceived) {
    score += 5;
    const how = args.prohibition.mutualReception
      ? "mutual reception"
      : `receives ${args.prohibition.target} by domicile/exaltation`;
    t.push(
      `Prohibition by ${args.prohibition.prohibitor}, but ${args.prohibition.prohibitor} ` +
        `${how} — not cut off, perfects with labour (+5)`,
    );
  } else if (args.prohibition) {
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
  // Enclosure by BODY or RAY, with nothing intervening (Lilly, CA Bk. 1). The
  // caller has already excluded any significator counted under body-besieging
  // above, so a malefic enclosure here is a distinct ray-affliction reported
  // once (same -12 weight, strongest form). A benefic enclosure (between Jupiter
  // and Venus) is a real RESCUE — the significator is shielded by both fortunes.
  const beneficEnclosed: string[] = [];
  for (const e of args.enclosures) {
    const [b1, b2] = e.enclosure.betweenOf;
    if (e.enclosure.kind === "malefic") {
      score -= 12;
      t.push(
        `${e.significator} significator ${e.planet} besieged by the rays of ` +
          `${b1} and ${b2} — hemmed by both malefics (-12)`,
      );
    } else {
      score += 10;
      if (!beneficEnclosed.includes(e.planet)) beneficEnclosed.push(e.planet);
      t.push(
        `${e.significator} significator ${e.planet} enclosed between ${b1} and ` +
          `${b2} — shielded by both benefics (+10)`,
      );
    }
  }

  // INDIRECT RESCUE: when the significators are PROHIBITED directly but a SOUND
  // translation/collection of light survives, the matter can still come together
  // indirectly — keep the prohibition debit but add a partial recovery. Guard
  // against double-counting the SAME light: if the prohibitor IS the carrier, the
  // intercepting body and the "rescuing" body are one planet — that is abscission
  // (a cutting-off), not a rescue, so award no recovery.
  // A RECEIVED prohibition is not a denial at all, so there is nothing to rescue —
  // reception nullifying the denial is a DIFFERENT mechanism from a third-planet
  // translation rescue. Only a denying (unreceived) prohibition opens the rescue.
  let rescuePath: string | null = null;
  if (
    args.prohibition &&
    !prohibitionReceived &&
    soundIndirectCarrier &&
    soundIndirectCarrier !== args.prohibition.prohibitor
  ) {
    rescuePath = soundIndirectCarrier;
    score += 12;
    t.push(
      `Indirect recovery: though prohibited directly, ${rescuePath} carries the light ` +
        `between the significators — the matter can still come together that way (+12)`,
    );
  }

  if (args.moonVoid) {
    score -= 30;
    t.push("Moon void of course — little is likely to come of the matter (-30)");
  }

  // SYNTHESIS: a coherent perfection picture. There is a DIRECT perfection when
  // the significators apply to a soft (or square) aspect and nothing breaks it.
  const breakers: PerfectionBreaker[] = [];
  // A RECEIVED prohibition does NOT break perfection (the matter perfects with
  // labour), so it must not appear among the breakers — only a denying one does.
  if (args.prohibition && !prohibitionReceived) breakers.push("prohibition");
  if (args.refranation) breakers.push("refranation");
  // Besieging (an affliction breaker) covers BOTH body-besieging and a malefic
  // enclosure by ray; either hems a significator between the infortunes. Pushed
  // once regardless of how many significators are afflicted.
  const maleficEnclosed = args.enclosures.some((e) => e.enclosure.kind === "malefic");
  if (args.besieging.length > 0 || maleficEnclosed) breakers.push("besieging");

  const sa = args.significatorAspect;
  const directlyApplies = !!sa?.applying && sa.type !== "opposition";
  const direct = directlyApplies && breakers.length === 0;
  // A surviving indirect path needs a SOUND carrier that is not itself a DENYING
  // prohibitor — if the carrier IS the prohibitor that is abscission (the same
  // light cutting the matter off), so no path survives through it. A RECEIVED
  // prohibition denies nothing, so its prohibitor does not abscind the path.
  const denyingProhibitor = prohibitionReceived ? undefined : args.prohibition?.prohibitor;
  const indirectPath =
    soundIndirectCarrier && soundIndirectCarrier !== denyingProhibitor
      ? soundIndirectCarrier
      : null;

  let summary: string;
  if (direct) {
    // A square perfects directly too, but classically "the hard way" — name the
    // friction rather than presenting it as a clean, easy perfection.
    summary =
      sa && !SOFT_ASPECTS.has(sa.type)
        ? `Direct perfection by ${sa.type}, but with friction — it completes the hard way.`
        : `Direct perfection: the significators apply to ${sa?.type} and nothing breaks it.`;
  } else if (breakers.length > 0 && rescuePath) {
    summary =
      `Direct perfection is broken (${breakers.join(", ")}), ` +
      `but a sound indirect path survives through ${rescuePath}.`;
  } else if (breakers.length > 0) {
    summary = `Direct perfection is broken (${breakers.join(", ")}) with no surviving indirect path.`;
    // A SURVIVING DENIAL (unreceived prohibition or refranation, with no rescue) is
    // categorical: the matter does not perfect, so the perfection testimony was
    // suppressed above. Besieging alone is an affliction, not a denial — it does not
    // trigger this note.
    if (survivingDenial) {
      // Only claim "suppressed perfection" when there was a positive perfection
      // signal to suppress (an applying soft/square significator aspect, or the
      // Moon applying to the quesited). When the sole applying aspect was an
      // opposition (a negative testimony, never suppressed), say plainly it is
      // denied without overstating a perfection that never existed.
      const hadPositivePerfection =
        (!!a?.applying && (SOFT_ASPECTS.has(a.type) || a.type === "square")) ||
        !!args.moonApplyingToQuesited;
      summary += hadPositivePerfection
        ? " The matter is categorically denied — it does not perfect, so the perfection testimony is suppressed and earns nothing."
        : " The matter is denied — a surviving prohibition or refranation cuts it off before it could complete.";
    }
  } else if (indirectPath) {
    summary = `No direct perfection, but the light is carried indirectly through ${indirectPath}.`;
  } else if (directlyApplies) {
    // Applying but the synthesis treats opposition-only as not a clean perfection.
    summary = "The significators apply, but only by a difficult aspect.";
  } else {
    summary = "No perfection: the significators neither perfect directly nor through a sound carrier.";
  }

  // Benefic enclosure is a mitigation, not a perfection mechanism — append it to
  // the synthesis summary so the shield is surfaced alongside the perfection
  // picture without altering the direct/broken/indirectPath logic above.
  if (beneficEnclosed.length > 0) {
    const names = beneficEnclosed.join(" and ");
    const verb = beneficEnclosed.length > 1 ? "are" : "is";
    summary += ` ${names} ${verb} enclosed between Jupiter and Venus — shielded by both benefics.`;
  }

  const perfection: PerfectionSynthesis = { direct, broken: breakers, indirectPath, summary };

  const lean: Lean = score > 15 ? "favorable" : score < -15 ? "unfavorable" : "uncertain";

  const strength = Math.abs(score);
  let confidence: Confidence = "low";
  if (strength >= 40) confidence = "high";
  else if (strength >= 20) confidence = "medium";
  // A void Moon contradicting a favorable lean caps confidence — mixed signals.
  if (args.moonVoid && lean === "favorable") confidence = "low";

  return { score, confidence, lean, perfection, testimonies: t };
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

/**
 * Soundness of an indirect-perfection carrier (translator/collector). The light
 * is only delivered if the carrying planet is itself sound — a combust or
 * besieged carrier is impeded and cannot carry the matter to completion. The
 * carrier's combustion is read from its attached sunProximity; besieging is
 * detected over the same classical bodies.
 */
function carrierSoundness(
  carrier: string,
  classical: PlanetPosition[],
): CarrierSoundness {
  const body = classical.find((p) => p.name === carrier);
  if (body?.sunProximity?.state === "combust") {
    return { impeded: true, reason: "combust" };
  }
  if (detectBesieging(carrier, classical)) {
    return { impeded: true, reason: "besieged between Mars and Saturn" };
  }
  return { impeded: false, reason: null };
}

export function judgeHorary(
  chart: Chart,
  quesitedHouse: number,
  querentHouse = 1,
): HoraryJudgment {
  if (quesitedHouse < 2 || quesitedHouse > 12) {
    throw new Error(`quesitedHouse must be 2..12, got ${quesitedHouse}`);
  }
  if (querentHouse < 1 || querentHouse > 12) {
    throw new Error(`querentHouse must be 1..12, got ${querentHouse}`);
  }
  // Significators flow from the chosen houses: by default the querent is the 1st
  // (the asker), but a turned chart reads the querent from another radix house
  // (the third party the matter is about). Everything downstream — reception,
  // almuten, perfection, dignity — derives from these two significators.
  const querentSig = rulerOfLongitude(chart.houses.cusps[querentHouse - 1]);
  const quesitedSig = rulerOfLongitude(chart.houses.cusps[quesitedHouse - 1]);

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
  const querentBodyBesieged = !!(sigA && detectBesieging(querentSig, classical));
  const quesitedBodyBesieged = !!(
    sigB &&
    quesitedSig !== querentSig &&
    detectBesieging(quesitedSig, classical)
  );
  if (querentBodyBesieged) {
    besieging.push({ significator: "querent", planet: querentSig });
  }
  if (quesitedBodyBesieged) {
    besieging.push({ significator: "quesited", planet: quesitedSig });
  }

  // Enclosure by BODY or RAY (Lilly CA Bk. 1): a significator hemmed between
  // Mars & Saturn (besieged, an affliction) or shielded between Jupiter & Venus
  // (aided, a protection). NO DOUBLE-COUNT: a significator already flagged under
  // body-besieging above is the strongest-form report, so suppress its malefic
  // ray-enclosure (a benefic enclosure could still be reported, but a body
  // cannot be enclosed by both pairs at once — the flankers are a single pair).
  const enclosures: Array<{ significator: string; planet: string; enclosure: Enclosure }> = [];
  if (sigA && !querentBodyBesieged) {
    const e = detectEnclosure(querentSig, classical);
    if (e) enclosures.push({ significator: "querent", planet: querentSig, enclosure: e });
  }
  if (sigB && quesitedSig !== querentSig && !quesitedBodyBesieged) {
    const e = detectEnclosure(quesitedSig, classical);
    if (e) enclosures.push({ significator: "quesited", planet: quesitedSig, enclosure: e });
  }

  // Almuten of the Ascendant (querent) and of the quesited-house cusp: the planet
  // with the most essential dignity over that degree — sometimes more dignified
  // than the simple domicile ruler, in which case it has the strongest say.
  const querentAlmutenFull = almutenOfDegree(chart.houses.cusps[querentHouse - 1], chart.sect);
  const quesitedAlmutenFull = almutenOfDegree(chart.houses.cusps[quesitedHouse - 1], chart.sect);
  const querentAlmuten = { planet: querentAlmutenFull.planet, score: querentAlmutenFull.score };
  const quesitedAlmuten = { planet: quesitedAlmutenFull.planet, score: quesitedAlmutenFull.score };
  const querentAlmutenDiffersFromRuler = querentAlmuten.planet !== querentSig;
  const quesitedAlmutenDiffersFromRuler = quesitedAlmuten.planet !== quesitedSig;

  // Soundness of each indirect-perfection carrier — a combust or besieged carrier
  // cannot deliver, so its positive testimony is suppressed downstream.
  let translationCarrier = translationOfLight
    ? carrierSoundness(translationOfLight.translator, classical)
    : null;
  // A sound translator can still be PROHIBITED mid-carry: if a third planet's
  // applying aspect with the carrier perfects before the carrier reaches the
  // destination significator, the light is intercepted and never delivered (the
  // "Moon-sequence" prohibition — verified against Warnock's 2004 marriage
  // horary in the conformance corpus). Collection is left to the combust/
  // besieged checks only: it has two converging legs and no verified corpus
  // case yet, so we stay conservative there.
  if (translationOfLight && translationCarrier && !translationCarrier.impeded) {
    const intercepted = prohibitsDelivery(
      translationOfLight.translator,
      translationOfLight.to,
      classical,
    );
    if (intercepted) {
      translationCarrier = {
        impeded: true,
        reason:
          `intercepted — ${intercepted.interceptor} perfects ${intercepted.aspect} with ` +
          `${translationOfLight.translator} before the light reaches ${translationOfLight.to}`,
      };
    }
  }
  const collectionCarrier = collectionOfLight
    ? carrierSoundness(collectionOfLight.collector, classical)
    : null;

  const { score, confidence, lean, perfection, testimonies } = aggregateTestimony({
    significatorAspect,
    moonApplyingToQuesited,
    translation: translationOfLight,
    collection: collectionOfLight,
    translationCarrier,
    collectionCarrier,
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
    enclosures,
  });

  // Timing narrative: when the significators form an applying perfection, turn
  // it into a plain-language "when". The moving (faster) significator is the one
  // whose motion carries the aspect to exact, so it sets the unit. Descriptive
  // only — never folded into the score.
  let timing: Timing | null = null;
  if (significatorAspect?.applying && sigA && sigB) {
    const movingPlanet =
      Math.abs(sigA.speed) >= Math.abs(sigB.speed) ? sigA : sigB;
    timing = estimateTiming(significatorAspect, movingPlanet);
  }

  // Informational almuten testimonies: when the almuten of a cusp is NOT its
  // domicile ruler, name the planet that truly has the most say over the matter.
  // Neutral — does not flip the verdict (0 points).
  if (querentAlmutenDiffersFromRuler) {
    testimonies.push(
      `Almuten of the ${ordinal(querentHouse)} (querent) is ${querentAlmuten.planet} ` +
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
    querentHouse,
    quesitedHouse,
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
    enclosures,
    timing,
    score,
    confidence,
    lean,
    perfection,
    testimonies,
  };
}
