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
}

export interface PlanetPosition {
  name: string;
  longitude: number; // ecliptic longitude 0..360
  sign: Sign;
  degInSign: number; // 0..30
  retrograde: boolean;
  speed: number; // degrees/day in longitude
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

export interface ComputeResult {
  /** Present for chart-based kinds (natal/transit/horary); absent for electional. */
  chart?: Chart;
  /** Present only when kind is "transit": aspects from transiting to natal planets. */
  transitAspects?: Aspect[];
  /** Present only when kind is "horary". */
  horary?: HoraryJudgment;
  /** Present only when kind is "electional". */
  electional?: ElectionalResult;
}
