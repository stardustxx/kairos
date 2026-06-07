/*
 * index.ts — public library entry point for the Kairos engine.
 *
 *   import { runCompute } from "kairos";
 *   const result = runCompute({ kind: "horary", quesitedHouse: 10, moment: {...} });
 */

export { computeAngleAspects, computeAspects, computeCrossAspects } from "./aspects.js";
export { buildChart, relocateChart } from "./chart.js";
export { runCompute } from "./cli.js";
export { sunProximity } from "./conditions.js";
export { computeDignities, receptionBetween } from "./dignities.js";
export { searchElectionalMoments } from "./electional.js";
export { judgeHorary, moonVoidStatus } from "./horary.js";
export type {
  CalibrationBand,
  CalibrationReport,
  JournalEntry,
  Outcome,
  Profile,
  ProfilePlace,
} from "./memory.js";
export {
  appendJournal,
  clearProfile,
  computeCalibration,
  loadJournal,
  loadProfile,
  memoryHome,
  recordOutcome,
  saveProfile,
} from "./memory.js";

export type {
  Aspect,
  Chart,
  ChartKind,
  CollectionOfLight,
  ComputeRequest,
  ComputeResult,
  Confidence,
  ElectionalCandidate,
  ElectionalResult,
  ElectionalWindow,
  HoraryJudgment,
  HouseShift,
  Houses,
  Lean,
  MomentInput,
  PartOfFortune,
  PlanetDignities,
  PlanetPosition,
  Reception,
  RelocationResult,
  SignificatorHints,
  SolarPhase,
  SunProximity,
  TranslationOfLight,
} from "./types.js";
