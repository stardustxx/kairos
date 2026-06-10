import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runCompute } from "./cli.js";
import { PLANETS } from "./constants.js";
import { nativeEphemeris } from "./ephemeris.js";
import type { EphemerisProvider } from "./ephemeris-provider.js";
import { setEphemerisProvider } from "./ephemeris-provider.js";
import { createWasmEphemeris } from "./ephemeris-wasm.js";
import type { ComputeResult } from "./types.js";

/**
 * NATIVE ↔ WASM EPHEMERIS PARITY.
 *
 * The browser bundle computes charts with `swisseph-wasm` instead of the
 * native `sweph` addon. Both are builds of the SAME Swiss Ephemeris source
 * version (2.10.03 — asserted below so a silent upstream bump reopens this
 * analysis), and the wasm provider runs in SEFLG_MOSEPH mode exactly like the
 * native default, so the only possible divergence is floating-point: the two
 * binaries link different libm implementations (host libm vs emscripten/musl),
 * whose sin/cos/atan2 results can differ in the last ulp.
 *
 * TOLERANCE: 1e-6 degrees (0.0036 arcsec) per planet longitude.
 *   - Observed max divergence on the pinned chart: ~9e-11 deg — four orders of
 *     magnitude of headroom for other hosts' libm.
 *   - Five orders of magnitude below the tightest classically meaningful
 *     boundary the engine evaluates (cazimi, 17' ≈ 0.283 deg), so a pass here
 *     means no classical threshold can flip between backends except for a
 *     chart sitting EXACTLY on a knife edge — which the verdict-identity check
 *     below covers for the golden chart.
 *   (The package also bundles real Swiss data files, but under MOSEPH they are
 *   never read, so there is no Moshier-vs-SWIEPH delta to account for.)
 *
 * VERDICT IDENTITY: the horary lean AND score for golden chart #1
 * (horary-golden.test.ts) must be IDENTICAL across backends — the verdict is
 * the product's payload, and threshold comparisons must not flip on libm dust.
 *
 * The wasm module runs fine under Node (its init reads the bundled data file
 * from disk instead of fetch), so this is a direct two-backend comparison, not
 * a proxy. The provider swap is module-level but vitest isolates test FILES in
 * separate workers, so restoring the native provider in afterAll keeps this
 * hermetic.
 */

// Golden chart #1: 2024-02-26T20:00 America/New_York, 10th house quesited.
const GOLDEN_REQUEST = {
  kind: "horary",
  quesitedHouse: 10,
  moment: {
    datetimeLocal: "2024-02-26T20:00:00",
    latitude: 40.7128,
    longitude: -74.006,
    timezone: "America/New_York",
  },
} as const;

const CLASSICAL = new Set(PLANETS.filter((p) => p.classical).map((p) => p.name));
const TOLERANCE_DEG = 1e-6;

/** Smallest angular difference between two longitudes, wrap-aware. */
function angularDelta(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

let wasmProvider: EphemerisProvider;
let nativeResult: ComputeResult;
let wasmResult: ComputeResult;

beforeAll(async () => {
  // Native first (the default provider), then swap to wasm and recompute.
  nativeResult = runCompute(GOLDEN_REQUEST);
  wasmProvider = await createWasmEphemeris();
  setEphemerisProvider(wasmProvider);
  wasmResult = runCompute(GOLDEN_REQUEST);
}, 30_000);

afterAll(() => {
  // nativeEphemeris is only null in the browser bundle; under Node it's real.
  setEphemerisProvider(nativeEphemeris!);
});

describe("native sweph vs swisseph-wasm parity (golden chart #1)", () => {
  it("both backends are the same Swiss Ephemeris source version", async () => {
    const { default: SwissEph } = await import("swisseph-wasm");
    const swe = new SwissEph();
    await swe.initSwissEph();
    const { default: sweph } = await import("sweph");
    expect(swe.version()).toBe("2.10.03");
    expect(sweph.version()).toBe("2.10.03");
  });

  it(`every classical planet longitude agrees within ${TOLERANCE_DEG} deg`, () => {
    const native = nativeResult.chart!.planets;
    const wasm = wasmResult.chart!.planets;
    for (const np of native) {
      if (!CLASSICAL.has(np.name)) continue;
      const wp = wasm.find((p) => p.name === np.name)!;
      expect(wp, `wasm chart missing ${np.name}`).toBeDefined();
      const delta = angularDelta(np.longitude, wp.longitude);
      expect(delta, `${np.name} longitude delta ${delta} deg`).toBeLessThanOrEqual(TOLERANCE_DEG);
    }
  });

  it("the chart angles (Asc/MC) agree within the same tolerance", () => {
    const nh = nativeResult.chart!.houses;
    const wh = wasmResult.chart!.houses;
    expect(angularDelta(nh.ascendant, wh.ascendant)).toBeLessThanOrEqual(TOLERANCE_DEG);
    expect(angularDelta(nh.mc, wh.mc)).toBeLessThanOrEqual(TOLERANCE_DEG);
    for (let i = 0; i < 12; i++) {
      expect(angularDelta(nh.cusps[i], wh.cusps[i])).toBeLessThanOrEqual(TOLERANCE_DEG);
    }
  });

  it("the horary lean and score are IDENTICAL across backends", () => {
    const nj = nativeResult.horary!;
    const wj = wasmResult.horary!;
    expect(wj.lean).toBe(nj.lean);
    expect(wj.score).toBe(nj.score);
    // The full testimony list riding along identically is the strongest
    // available signal that no threshold flipped anywhere in the judgment.
    expect(wj.testimonies).toEqual(nj.testimonies);
  });
});
