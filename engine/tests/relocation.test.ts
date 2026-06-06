import { describe, expect, it } from "vitest";
import { buildChart, relocateChart } from "../src/chart.js";
import { runCompute } from "../src/cli.js";

const BIRTH = {
  datetimeLocal: "1990-05-21T14:30:00",
  latitude: 41.85,
  longitude: -87.65,
  timezone: "America/Chicago",
};
// Tokyo — far enough that houses/angles differ substantially.
const TOKYO = { latitude: 35.68, longitude: 139.69 };

describe("relocateChart", () => {
  it("keeps planet longitudes but recomputes houses for the new place", () => {
    const natal = buildChart("natal", BIRTH);
    const reloc = relocateChart(natal, TOKYO.latitude, TOKYO.longitude);

    // Same moment => identical longitudes (positions are location-independent).
    for (let i = 0; i < natal.planets.length; i++) {
      expect(reloc.planets[i].longitude).toBeCloseTo(natal.planets[i].longitude, 9);
    }
    // But the angles/houses move.
    expect(reloc.houses.ascendant).not.toBeCloseTo(natal.houses.ascendant, 1);
    // Every planet still has a 1..12 house.
    for (const p of reloc.planets) {
      expect(p.house).toBeGreaterThanOrEqual(1);
      expect(p.house).toBeLessThanOrEqual(12);
    }
    // Aspects are unchanged (same array reference content).
    expect(reloc.aspects.length).toBe(natal.aspects.length);
  });
});

describe("runCompute relocation", () => {
  it("attaches a relocation result with house shifts", () => {
    const result = runCompute({
      kind: "natal",
      moment: BIRTH,
      relocation: TOKYO,
    });
    expect(result.relocation).toBeTruthy();
    expect(result.relocation!.location.latitude).toBe(TOKYO.latitude);
    expect(Array.isArray(result.relocation!.houseShifts)).toBe(true);
    // Chicago -> Tokyo is a big move; at least one planet changes house.
    expect(result.relocation!.houseShifts.length).toBeGreaterThan(0);
    // Each shift genuinely differs.
    for (const s of result.relocation!.houseShifts) {
      expect(s.fromHouse).not.toBe(s.toHouse);
    }
  });

  it("omits relocation when none is requested", () => {
    const result = runCompute({ kind: "natal", moment: BIRTH });
    expect(result.relocation).toBeUndefined();
  });
});
