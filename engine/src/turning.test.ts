import { describe, expect, it } from "vitest";
import { runCompute } from "./cli.js";
import { derivedHouse } from "./houses.js";

/**
 * TURNING THE CHART (derived-house significators for third-party questions).
 *
 * Two contracts are pinned here:
 *  1. derivedHouse(from, count) maps a third party's concern onto its radix house
 *     by classical (1-based, inclusive, modulo-12) counting.
 *  2. A turned request (querentHouse set) reads the querent significator from the
 *     CHOSEN radix-house cusp ruler instead of the hard-coded 1st — and a default
 *     request (no querentHouse) is unchanged. The default-path invariance is what
 *     keeps the golden suite + conformance corpus green (turning is opt-in).
 */

const NEW_YORK = { latitude: 40.7128, longitude: -74.006, timezone: "America/New_York" };

describe("derivedHouse (turning-the-chart house arithmetic)", () => {
  it("a third party's concern maps onto its radix house (worked cases)", () => {
    // partner's lawsuit / long journey = 9th-from-7th = radix 3rd
    expect(derivedHouse(7, 9)).toBe(3);
    // partner's money = 2nd-from-7th = radix 8th
    expect(derivedHouse(7, 2)).toBe(8);
    // friend's job/career = 10th-from-11th = radix 8th
    expect(derivedHouse(11, 10)).toBe(8);
    // child's exam/study = 9th-from-5th = radix 1st
    expect(derivedHouse(5, 9)).toBe(1);
  });

  it("counting from the 1st is the identity (count === radix house)", () => {
    for (let n = 1; n <= 12; n++) {
      expect(derivedHouse(1, n)).toBe(n);
    }
  });

  it("the starting house itself is the 1st-from (inclusive counting)", () => {
    for (let from = 1; from <= 12; from++) {
      expect(derivedHouse(from, 1)).toBe(from);
    }
  });

  it("wraps modulo 12 (no house 0 or 13)", () => {
    // 7th-from-7th wraps past 12 back to radix 1
    expect(derivedHouse(7, 7)).toBe(1);
    // 12th-from-12th = the house before 12 = radix 11
    expect(derivedHouse(12, 12)).toBe(11);
    // 6th-from-10th = radix 3
    expect(derivedHouse(10, 6)).toBe(3);
    for (let from = 1; from <= 12; from++) {
      for (let count = 1; count <= 12; count++) {
        const h = derivedHouse(from, count);
        expect(h).toBeGreaterThanOrEqual(1);
        expect(h).toBeLessThanOrEqual(12);
      }
    }
  });
});

describe("turned horary request reads the chosen radix-house significators", () => {
  // Fixed, deterministic moment (a golden-suite chart). The default reading takes
  // the querent from the 1st cusp; turning to querentHouse=7 must take it from the
  // 7th cusp ruler instead, while the quesited house ruler is unaffected.
  const moment = { datetimeLocal: "2024-02-26T20:00:00", ...NEW_YORK };

  it("default (no querentHouse) reads the 1st-cusp ruler as the querent significator", () => {
    const j = runCompute({ kind: "horary", quesitedHouse: 3, moment }).horary!;
    expect(j.querentHouse).toBe(1);
    expect(j.quesitedHouse).toBe(3);
    expect(j.querentSignificator).toBe("Venus");
    expect(j.quesitedSignificator).toBe("Jupiter");
  });

  it("turned (querentHouse=7) reads the 7th-cusp ruler, quesited unchanged", () => {
    const turned = runCompute({
      kind: "horary",
      quesitedHouse: 3,
      querentHouse: 7,
      moment,
    }).horary!;
    expect(turned.querentHouse).toBe(7);
    expect(turned.quesitedHouse).toBe(3);
    // Mars rules the 7th cusp here — distinct from the default 1st-cusp Venus.
    expect(turned.querentSignificator).toBe("Mars");
    expect(turned.querentSignificator).not.toBe("Venus");
    // Quesited (3rd) significator is identical to the default reading.
    expect(turned.quesitedSignificator).toBe("Jupiter");
  });

  it("the querent almuten testimony names the turned house, not the 1st", () => {
    const turned = runCompute({
      kind: "horary",
      quesitedHouse: 3,
      querentHouse: 7,
      moment,
    }).horary!;
    // When the turned-house almuten differs from its ruler, the testimony must
    // reference the 7th (querent), never a hard-coded "1st".
    if (turned.querentAlmutenDiffersFromRuler) {
      expect(turned.testimonies.some((t) => t.includes("Almuten of the 7th (querent)"))).toBe(true);
      expect(turned.testimonies.some((t) => t.includes("Almuten of the 1st (querent)"))).toBe(false);
    }
  });
});
