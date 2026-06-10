import { existsSync, readdirSync } from "node:fs";
import sweph from "sweph";
import type { EphemerisProvider } from "./ephemeris-provider.js";

/**
 * Ephemeris flag resolution.
 *
 * By default the engine uses the Moshier analytical ephemeris (SEFLG_MOSEPH),
 * which needs no data files and is accurate for the modern era. Full Swiss
 * Ephemeris precision (SEFLG_SWIEPH) requires the `.se1` data files.
 *
 * SWIEPH is OPT-IN via two environment variables:
 *   - KAIROS_SWIEPH=1          enables the upgrade attempt
 *   - KAIROS_EPHE_PATH=/dir    points at the directory holding the .se1 files
 *
 * If SWIEPH is requested but the path is missing/inaccessible, the resolver
 * logs a one-line note to stderr and gracefully falls back to Moshier — it
 * NEVER throws. stderr (not stdout) is used by design so the CLI's stdout JSON
 * stays clean and the fallback is observable in logs without crashing.
 */

const MOSEPH = sweph.constants.SEFLG_MOSEPH;
const SWIEPH = sweph.constants.SEFLG_SWIEPH;
const SPEED = sweph.constants.SEFLG_SPEED;

type Env = Record<string, string | undefined>;

/**
 * Decide whether SWIEPH is requested AND usable. Side effect: when usable,
 * calls sweph.set_ephe_path() so subsequent calc_ut/houses_ex2 calls find the
 * data files. Returns the base ephemeris flag (without SPEED).
 */
/** True if `dir` contains at least one Swiss Ephemeris `.se1` data file. */
function hasEphemerisFiles(dir: string): boolean {
  try {
    return readdirSync(dir).some((f) => f.toLowerCase().endsWith(".se1"));
  } catch {
    return false;
  }
}

function resolveBaseFlag(env: Env): number {
  if (env.KAIROS_SWIEPH !== "1") return MOSEPH;

  const path = env.KAIROS_EPHE_PATH;
  if (!path || !existsSync(path)) {
    console.error(
      "[kairos] KAIROS_SWIEPH enabled but KAIROS_EPHE_PATH not found or inaccessible; falling back to Moshier ephemeris.",
    );
    return MOSEPH;
  }

  // A directory that exists but holds no .se1 files would otherwise select
  // SWIEPH and surface an opaque sweph runtime error on the first calc. Verify
  // the data is actually present so we can fall back gracefully instead.
  if (!hasEphemerisFiles(path)) {
    console.error(
      `[kairos] KAIROS_SWIEPH enabled but no .se1 ephemeris files found in ${path}; falling back to Moshier ephemeris.`,
    );
    return MOSEPH;
  }

  sweph.set_ephe_path(path);
  return SWIEPH;
}

/** Calculation flags for sweph.calc_ut (always includes SEFLG_SPEED). */
export function resolveCalcFlags(env: Env = process.env): number {
  return resolveBaseFlag(env) | SPEED;
}

/** House-computation flags for sweph.houses_ex2 (no speed needed). */
export function resolveHouseFlags(env: Env = process.env): number {
  return resolveBaseFlag(env);
}

/**
 * The NATIVE ephemeris backend: a passthrough to the `sweph` addon with the
 * env-resolved flags attached. This is the default provider under Node (see
 * ephemeris-provider.ts) — registered at module load, exactly as the old
 * constants.ts module-load flag resolution behaved, so Node behavior is
 * unchanged. Typed nullable because the browser bundle swaps this module for a
 * stub exporting null (scripts/build-web.mjs).
 */
export const nativeEphemeris: EphemerisProvider | null = {
  calcFlags: resolveCalcFlags(),
  houseFlags: resolveHouseFlags(),
  julday: sweph.julday,
  revjul: sweph.revjul,
  calc_ut: sweph.calc_ut,
  houses_ex2: sweph.houses_ex2,
};
