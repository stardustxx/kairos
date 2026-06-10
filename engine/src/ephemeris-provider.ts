/*
 * ephemeris-provider.ts — the seam between the classical engine and the
 * ephemeris backend.
 *
 * The engine's math (dignities, aspects, perfection, horary scoring) is pure
 * TypeScript; the only native-code dependency is the ephemeris itself. This
 * module holds a swappable, module-level provider so the SAME engine code runs
 * against either backend:
 *
 *   - Node (default): the native `sweph` addon, registered below by importing
 *     ./ephemeris.js. Behavior is unchanged from the pre-seam engine.
 *   - Browser: the `swisseph-wasm` build, registered by initBrowserEngine()
 *     (see browser.ts). The web bundle swaps ./ephemeris.js for a null stub at
 *     build time (scripts/build-web.mjs), so neither `sweph` nor `node:fs` is
 *     ever bundled.
 *
 * The interface mirrors the exact slice of the `sweph` API the engine uses —
 * same shapes, same Swiss Ephemeris ABI flag semantics — so the native
 * provider is a passthrough and introduces zero behavior change.
 */
import { nativeEphemeris } from "./ephemeris.js";

/** Result of calc_ut, shaped like sweph's `Calc`. */
export interface EpheCalcResult {
  /** Status flag; negative means hard failure. */
  flag: number;
  /** Error/warning message; empty when clean. */
  error: string;
  /** [longitude, latitude, distance, lonSpeed, latSpeed, distSpeed]. */
  data: number[];
}

/** Result of houses_ex2, shaped like sweph's `HousesEx` (12-house systems). */
export interface EpheHousesResult {
  /** Error message; empty when clean. */
  error: string;
  data: {
    /** The 12 house cusp longitudes, cusp 1 first. */
    houses: number[];
    /** [ascendant, mc, armc, vertex, ...]. */
    points: number[];
  };
}

export interface EphemerisProvider {
  /** Calculation flags for calc_ut (base ephemeris flag | SEFLG_SPEED). */
  calcFlags: number;
  /** House-computation flags for houses_ex2 (base ephemeris flag only). */
  houseFlags: number;
  julday(year: number, month: number, day: number, hour: number, gregflag: number): number;
  revjul(tjd: number, gregflag: number): { year: number; month: number; day: number; hour: number };
  calc_ut(tjdUt: number, ipl: number, iflag: number): EpheCalcResult;
  houses_ex2(
    tjdUt: number,
    iflag: number,
    geolat: number,
    geolon: number,
    hsys: string,
  ): EpheHousesResult;
}

// Module-level provider, defaulting to the native sweph backend under Node.
// In the browser bundle the import above resolves to a stub exporting null,
// and initBrowserEngine() must register the wasm provider before computing.
let provider: EphemerisProvider | null = nativeEphemeris;

/** Swap the active ephemeris backend (used by the browser entry point). */
export function setEphemerisProvider(p: EphemerisProvider): void {
  provider = p;
}

/** The active ephemeris backend. Throws when none is initialized (browser
 *  bundle before initBrowserEngine() resolves). */
export function ephemeris(): EphemerisProvider {
  if (!provider) {
    throw new Error(
      "No ephemeris provider is initialized — in the browser, await initBrowserEngine() first.",
    );
  }
  return provider;
}
