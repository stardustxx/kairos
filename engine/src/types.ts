import type { Sign } from "./constants.js";

export type ChartKind = "natal" | "transit" | "horary" | "electional";

/** A moment + place the engine can compute for. */
export interface MomentInput {
  /** Local civil datetime, ISO without offset, e.g. "1990-05-21T14:30:00". */
  datetimeLocal: string;
  latitude: number;
  longitude: number;
  /** IANA zone, e.g. "America/New_York". If omitted, derived from lat/lon. */
  timezone?: string;
  /** Single-letter house system code, default "P" (Placidus). */
  houseSystem?: string;
}

/** Optional caller preferences steering electional significator choice / weighting. */
export interface SignificatorHints {
  /** Override the auto-derived significator planet for the matter. */
  planet?: string;
  /** 0..1 bias toward benefics over the default (default 0.5). Reserved for future tuning. */
  beneficWeighting?: number;
}

/** Local-civil-time bounds (ISO without offset) for an electional search. */
export interface ElectionalWindow {
  startLocal: string;
  endLocal: string;
}

export interface ComputeRequest {
  kind: ChartKind;
  /** The chart's own moment. For "transit" this is "now"; natal supplied separately.
   *  Optional for "electional" (the window + location drive the search instead). */
  moment?: MomentInput;
  /** Required only for kind "transit": the natal chart to compare against. */
  natal?: MomentInput;
  /** Required for "horary"; reused by "electional" as the house of the matter (2..12). */
  quesitedHouse?: number;
  /** Required for kind "electional": local-time window to scan. */
  window?: ElectionalWindow;
  /** Required for kind "electional": scan interval in minutes (e.g. 15). */
  stepMinutes?: number;
  /** Required for kind "electional": place to cast each candidate chart for.
   *  `datetimeLocal` is ignored here — the window + stepMinutes drive the times. */
  location?: Omit<MomentInput, "datetimeLocal"> & { datetimeLocal?: string };
  /** Optional for kind "electional". */
  significatorHints?: SignificatorHints;
  /** Optional relocation: a place to recast the chart's houses/angles for, using
   *  the same moment (e.g. a natal chart relocated to where you live now). Only
   *  lat/lon (+ optional timezone/houseSystem) are used; datetime is ignored. */
  relocation?: Omit<MomentInput, "datetimeLocal"> & { datetimeLocal?: string };
}

export interface ElectionalCandidate {
  /** The candidate moment in local civil time (ISO without offset). */
  datetimeLocal: string;
  /** Numeric ranking score; higher is better. */
  score: number;
  /** Human-readable signals behind the score, e.g. "Moon in Taurus (benefic) +15". */
  reasons: string[];
}

export interface ElectionalResult {
  /** Best candidates, sorted descending by score (top N). */
  topMoments: ElectionalCandidate[];
  /** Total number of moments scanned. */
  candidatesEvaluated: number;
  /** Mean score across all scanned candidates — context for how good the best
   *  moment is relative to the window as a whole. */
  averageScore: number;
  /** Lowest and highest score seen across the window. */
  scoreRange: { min: number; max: number };
}

/** A planet's relationship to the Sun's rays (an accidental condition). */
export type SolarPhase = "cazimi" | "combust" | "under-beams" | "clear";

export interface SunProximity {
  state: SolarPhase;
  /** Angular distance from the Sun, in degrees (0..180). */
  distanceDeg: number;
}

/** A planet's essential dignity state at its position (classical Lilly points). */
export interface PlanetDignities {
  domicile: boolean; // in its own sign (+5)
  exaltation: boolean; // in its exaltation sign (+4)
  triplicity: boolean; // in-sect triplicity ruler of its element (+3)
  term: boolean; // ruler of its Egyptian term/bound (+2)
  face: boolean; // ruler of its face/decan (+1)
  detriment: boolean; // in the sign opposite its rulership (-5)
  fall: boolean; // in the sign opposite its exaltation (-4)
  peregrine: boolean; // no essential dignity and not in detriment/fall (-5)
  /** Net dignity score (positive = strong, negative = debilitated). */
  score: number;
  /** Human-readable contributing dignities/debilities, e.g. "domicile (+5)". */
  labels: string[];
}

export interface PlanetPosition {
  name: string;
  longitude: number; // ecliptic longitude 0..360
  sign: Sign;
  degInSign: number; // 0..30
  retrograde: boolean;
  speed: number; // degrees/day in longitude
  /** Essential dignity state. Attached by buildChart (needs chart sect); absent
   *  on bare position lists (e.g. transit natal-side planets). */
  dignities?: PlanetDignities;
  /** Relationship to the Sun's rays (cazimi/combust/under-beams/clear). Attached
   *  by buildChart for every body except the Sun itself. */
  sunProximity?: SunProximity;
  /** House (1..12) this body occupies. Attached by buildChart (needs houses);
   *  absent on bare position lists. */
  house?: number;
}

/** The Part of Fortune (Lot of Fortune) — a derived sensitive point. */
export interface PartOfFortune {
  longitude: number;
  sign: Sign;
  degInSign: number;
  /** House (1..12) it falls in. */
  house: number;
}

export interface Houses {
  system: string;
  cusps: number[]; // 12 cusp longitudes, index 0 = 1st house
  ascendant: number;
  mc: number;
}

export interface Aspect {
  a: string;
  b: string;
  type: string;
  orb: number; // degrees from exact
  applying: boolean;
  /**
   * ISO 8601 UTC datetime when the aspect perfects exactly, found by
   * root-finding on the bodies' real ephemeris motion. `null` when the aspect
   * does not perfect within the search window (e.g. already separated, or
   * stationary). Optional/additive: existing consumers are unaffected.
   */
  perfectsAtUtc?: string | null;
}

export interface Chart {
  kind: ChartKind;
  julianDayUt: number;
  utc: string;
  planets: PlanetPosition[];
  houses: Houses;
  aspects: Aspect[];
  /** Chart sect: "day" if the Sun is above the horizon, else "night". Drives
   *  triplicity rulership and the Part of Fortune formula. */
  sect: "day" | "night";
  /** The Part of Fortune for this chart. */
  partOfFortune: PartOfFortune;
  /** Tight aspects from planets to the angles (Ascendant/MC). `b` is "Ascendant"
   *  or "MC". A planet on an angle is a strong testimony. */
  angleAspects: Aspect[];
}

/** Two significators each dignifying the other's position — a perfecting aid. */
export interface Reception {
  /** "mutual" = both receive each other; "one-way" = only one receives. */
  kind: "mutual" | "one-way";
  /** Dignity by which a receives b (e.g. "domicile", "exaltation"), or null. */
  aReceivesBBy: string | null;
  /** Dignity by which b receives a, or null. */
  bReceivesABy: string | null;
}

/** A faster planet carrying light between the two significators. */
export interface TranslationOfLight {
  /** The planet translating the light. */
  translator: string;
  /** Significator it is separating from. */
  from: string;
  /** Significator it is applying to. */
  to: string;
  /** Aspect type of the applying (completing) contact. */
  aspect: string;
}

/** A heavier planet both significators apply to, gathering their light. */
export interface CollectionOfLight {
  /** The planet collecting the light. */
  collector: string;
  /** Aspect type the querent's significator makes to the collector. */
  fromQuerent: string;
  /** Aspect type the quesited's significator makes to the collector. */
  fromQuesited: string;
}

/** A third planet that perfects an aspect to a significator before the two
 *  significators perfect with each other, cutting the matter off. */
export interface Prohibition {
  /** The intervening planet that perfects first. */
  prohibitor: string;
  /** The significator it perfects with (the contact that intercepts). */
  target: string;
  /** Aspect type of the intercepting (completing) contact. */
  aspect: string;
}

/** A significator that withdraws (retrograde/stationing) before the perfecting
 *  aspect completes, drawing the matter back. */
export interface Refranation {
  /** The significator that turns back. */
  planet: string;
}

/** A significator hemmed bodily between the two malefics (Mars and Saturn). */
export interface Besieging {
  /** The two malefics besieging the planet — always ["Mars", "Saturn"]. */
  betweenOf: [string, string];
}

export type Confidence = "low" | "medium" | "high";
export type Lean = "favorable" | "unfavorable" | "uncertain";

export interface HoraryJudgment {
  querentSignificator: string;
  quesitedSignificator: string;
  /** House (1..12) the querent's significator planet occupies; 0 if not found. */
  querentSignificatorHouse: number;
  /** House (1..12) the quesited's significator planet occupies; 0 if not found. */
  quesitedSignificatorHouse: number;
  /** Major aspect forming between the two significators, if any. */
  significatorAspect: Aspect | null;
  moonVoidOfCourse: boolean;
  moonNextAspect: Aspect | null;
  /** Moon (always co-significator of the querent) applying to the quesited
   *  significator — a classic perfecting testimony. Null when none, or when the
   *  Moon is itself one of the significators. */
  moonApplyingToQuesited: Aspect | null;
  /** Perfection via a third planet carrying light between the significators. */
  translationOfLight: TranslationOfLight | null;
  /** Perfection via a third planet both significators apply to. */
  collectionOfLight: CollectionOfLight | null;
  /** Reception between the two significators (mutual reception can perfect a
   *  matter even without a direct aspect). Null when neither receives the other. */
  significatorReception: Reception | null;
  /** Essential dignity score of the querent's significator (planet strength). */
  querentSignificatorDignity: number;
  /** Essential dignity score of the quesited's significator. */
  quesitedSignificatorDignity: number;
  /** Almuten of the Ascendant — the planet with the most essential dignity over
   *  the 1st-house cusp degree. Often, but not always, the querent's domicile
   *  ruler; when it differs it has the strongest "say" over the querent. */
  querentAlmuten: { planet: string; score: number };
  /** Almuten of the quesited-house cusp degree — the most dignified planet over
   *  the matter, which can outrank the simple domicile-ruler significator. */
  quesitedAlmuten: { planet: string; score: number };
  /** True when the Ascendant's almuten is not the querent's domicile ruler. */
  querentAlmutenDiffersFromRuler: boolean;
  /** True when the quesited cusp's almuten is not the quesited domicile ruler. */
  quesitedAlmutenDiffersFromRuler: boolean;
  /** Prohibition: a third planet perfects with a significator before the two
   *  significators perfect, cutting the matter off. Null when none. A strong
   *  denial that can overturn an otherwise-favorable lean. */
  prohibition: Prohibition | null;
  /** Refranation: a significator withdraws (retrograde/stationing) before the
   *  perfecting aspect completes. Null when none. A strong withdrawal. */
  refranation: Refranation | null;
  /** Besieged significators: each significator hemmed bodily between Mars and
   *  Saturn. Empty when neither is besieged. A real affliction per significator. */
  besieging: Array<{ significator: string; planet: string }>;
  /** Aggregate testimony score (negative = unfavorable, positive = favorable).
   *  A calibration aid for the skill, NOT a verdict on its own. */
  score: number;
  /** Confidence band derived from testimony strength + agreement. */
  confidence: Confidence;
  /** Overall lean from the aggregated testimonies. */
  lean: Lean;
  /** Human-readable factors behind the score (parallels electional reasons). */
  testimonies: string[];
}

/** A planet that occupies a different house when the chart is relocated. */
export interface HouseShift {
  planet: string;
  /** House (1..12) at the original (e.g. birth) place. */
  fromHouse: number;
  /** House (1..12) at the relocation place. */
  toHouse: number;
}

/** A chart recast for a different place (same moment, new houses/angles). */
export interface RelocationResult {
  location: { latitude: number; longitude: number };
  /** The relocated chart: same planets/longitudes/aspects, but houses, sect,
   *  Part of Fortune, and each planet's house recomputed for the new place. */
  chart: Chart;
  /** Planets that change house between the original place and the relocation. */
  houseShifts: HouseShift[];
}

/**
 * Annual profection ("lord of the year"): from the natal Ascendant, advance one
 * whole sign per completed year of life. The sign reached is the profected
 * Ascendant; its house (counting from the natal 1st) is the activated topic of
 * the year; the domicile ruler of that sign is the Lord of the Year.
 */
export interface Profection {
  /** Completed years of life at the target moment (integer, floored). */
  age: number;
  /** Sign of the profected Ascendant for the year. */
  profectedSign: Sign;
  /** Profected house (1..12), counting from the natal 1st — the year's topic. */
  profectedHouse: number;
  /** Domicile ruler of the profected sign — the Lord of the Year. */
  lordOfYear: string;
  /** Where the Lord of the Year sits in the target (transit) chart, so the user
   *  can see where the year is "running". Absent if the lord is not found. */
  lordOfYearPosition?: { sign: Sign; house: number; retrograde: boolean };
}

export interface ComputeResult {
  /** Present for chart-based kinds (natal/transit/horary); absent for electional. */
  chart?: Chart;
  /** Present only when kind is "transit": aspects from transiting to natal planets. */
  transitAspects?: Aspect[];
  /** Present only when kind is "transit": the annual profection (lord of the
   *  year), derived from the natal Ascendant and age at the transit moment. */
  profection?: Profection;
  /** Present only when kind is "horary". */
  horary?: HoraryJudgment;
  /** Present only when kind is "electional". */
  electional?: ElectionalResult;
  /** Present when the request supplied a `relocation` place. */
  relocation?: RelocationResult;
}
