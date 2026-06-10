/*
 * ephemeris-wasm.ts — the WebAssembly ephemeris backend (swisseph-wasm).
 *
 * `swisseph-wasm` (GPL-3.0-or-later, AGPL-compatible) is the Swiss Ephemeris
 * 2.10.03 C library compiled to wasm — the SAME source version as the native
 * `sweph` addon — so positions agree to libm rounding (~1e-10°; pinned by
 * ephemeris-parity.test.ts). It runs in both the browser and Node (the parity
 * test exercises it under Node).
 *
 * We deliberately run it with SEFLG_MOSEPH, mirroring the native engine's
 * default, so a chart computed in the browser is the same chart the CLI/MCP
 * engine computes. The package also preloads real Swiss data files
 * (sepl/semo/seas_18.se1, 1800–2400 AD) into its emscripten FS — its module
 * init requires fetching that ~12 MB swisseph.data bundle — but under MOSEPH
 * those files are never read.
 */
import SwissEph from "swisseph-wasm";
import type { EphemerisProvider } from "./ephemeris-provider.js";

// Swiss Ephemeris ABI flag values (identical in sweph and swisseph-wasm).
const SEFLG_MOSEPH = 4;
const SEFLG_SPEED = 256;
const SE_GREG_CAL = 1;

/** The wrapper implements houses_ex2 but omits it from its .d.ts. */
interface SwissEphWithHouses extends SwissEph {
  houses_ex2(
    tjdUt: number,
    iflag: number,
    geolat: number,
    geolon: number,
    hsys: string,
  ): { cusps: Float64Array; ascmc: Float64Array };
}

/** Load + initialize the wasm module and adapt it to the engine's provider
 *  seam. Async: compiles the wasm and fetches its preloaded data bundle. */
export async function createWasmEphemeris(): Promise<EphemerisProvider> {
  const swe = new SwissEph() as SwissEphWithHouses;
  await swe.initSwissEph();
  return {
    // Moshier, matching the native default (no KAIROS_SWIEPH upgrade path here).
    calcFlags: SEFLG_MOSEPH | SEFLG_SPEED,
    houseFlags: SEFLG_MOSEPH,
    julday(year, month, day, hour, gregflag) {
      // The wrapper's julday is Gregorian-only; the engine only ever passes
      // SE_GREG_CAL. Guard the assumption instead of silently mis-converting.
      if (gregflag !== SE_GREG_CAL) {
        throw new Error(`wasm ephemeris julday supports only the Gregorian calendar (got flag ${gregflag})`);
      }
      return swe.julday(year, month, day, hour);
    },
    revjul(tjd, gregflag) {
      return swe.revjul(tjd, gregflag);
    },
    calc_ut(tjdUt, ipl, iflag) {
      // The wrapper throws on hard failure (retflag < 0), so reaching here
      // means success; normalize to the sweph result shape.
      const data = swe.calc_ut(tjdUt, ipl, iflag);
      return { flag: iflag, error: "", data: Array.from(data) };
    },
    houses_ex2(tjdUt, iflag, geolat, geolon, hsys) {
      const { cusps, ascmc } = swe.houses_ex2(tjdUt, iflag, geolat, geolon, hsys);
      // The wrapper returns the raw C layout: cusps[0] unused, cusps[1..12]
      // are the 12 cusps. Native sweph returns houses[0..11]; normalize.
      return {
        error: "",
        data: { houses: Array.from(cusps).slice(1, 13), points: Array.from(ascmc) },
      };
    },
  };
}
