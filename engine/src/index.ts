/*
 * index.ts — public library entry point for the Kairos engine.
 *
 *   import { runCompute } from "kairos";
 *   const result = runCompute({ kind: "horary", quesitedHouse: 10, moment: {...} });
 */

export type { AlmutenContribution, AlmutenResult } from "./almuten.js";
export { almutenOfDegree } from "./almuten.js";
export type { AntisciaContact } from "./antiscia.js";
export { antisciaContacts, antiscion, contraAntiscion } from "./antiscia.js";
export { computeAngleAspects, computeAspects, computeCrossAspects } from "./aspects.js";
export { buildChart, relocateChart } from "./chart.js";
export { runCompute } from "./cli.js";
export { sunProximity } from "./conditions.js";
export type { DignityLords } from "./dignities.js";
export { computeDignities, receptionBetween } from "./dignities.js";
export { searchElectionalMoments } from "./electional.js";
export type { FixedStar, StarContact, StarTone } from "./fixedstars.js";
export {
  FIXED_STARS,
  precessedLongitude,
  signOfLongitude,
  starContacts,
} from "./fixedstars.js";
export { judgeHorary, moonVoidStatus } from "./horary.js";
export { computeHouses, derivedHouse, houseOf } from "./houses.js";
export type { LotInputs } from "./lots.js";
export { computeLots } from "./lots.js";
export type {
  CalibrationBand,
  CalibrationReport,
  JournalEntry,
  Outcome,
  Profile,
  ProfileListing,
  ProfilePlace,
  ProfileRef,
} from "./memory.js";
export {
  activeSlug,
  appendJournal,
  clearProfile,
  computeCalibration,
  createProfile,
  listProfiles,
  loadJournal,
  loadProfile,
  memoryHome,
  recordOutcome,
  removeProfile,
  saveProfile,
  setActive,
} from "./memory.js";
export { detectBesieging, detectProhibition, detectRefranation } from "./perfection.js";
export { annualProfection, completedYearsBetween } from "./profections.js";
export type { TimingUnit } from "./timing.js";
export { estimateTiming } from "./timing.js";

export type {
  Aspect,
  Besieging,
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
  Lot,
  MomentInput,
  PartOfFortune,
  PerfectionBreaker,
  PerfectionSynthesis,
  PlanetDignities,
  PlanetPosition,
  Profection,
  Prohibition,
  Reception,
  Refranation,
  RelocationResult,
  Sect,
  SignificatorHints,
  SolarPhase,
  SunProximity,
  Timing,
  TranslationOfLight,
} from "./types.js";
