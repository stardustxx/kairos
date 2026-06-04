import type { Sign } from "./constants.js";

export type ChartKind = "natal" | "transit" | "horary";

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

export interface ComputeRequest {
  kind: ChartKind;
  /** The chart's own moment. For "transit" this is "now"; natal supplied separately. */
  moment: MomentInput;
  /** Required only for kind "transit": the natal chart to compare against. */
  natal?: MomentInput;
  /** Required only for kind "horary": the house of the matter asked about (2..12). */
  quesitedHouse?: number;
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
}

export interface Chart {
  kind: ChartKind;
  julianDayUt: number;
  utc: string;
  planets: PlanetPosition[];
  houses: Houses;
  aspects: Aspect[];
}

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
}

export interface ComputeResult {
  chart: Chart;
  /** Present only when kind is "transit": aspects from transiting to natal planets. */
  transitAspects?: Aspect[];
  /** Present only when kind is "horary". */
  horary?: HoraryJudgment;
}
