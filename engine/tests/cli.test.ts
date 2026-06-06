import { describe, expect, it } from "vitest";
import { runCompute } from "../src/cli.js";

describe("runCompute", () => {
  it("computes a natal chart from a request object", () => {
    const result = runCompute({
      kind: "natal",
      moment: {
        datetimeLocal: "1990-05-21T14:30:00",
        latitude: 40.7128,
        longitude: -74.006,
        timezone: "America/New_York",
      },
    });
    expect(result.chart!.kind).toBe("natal");
    expect(result.chart!.planets.length).toBe(11);
    expect(result.horary).toBeUndefined();
  });

  it("attaches transit cross-aspects when natal is supplied", () => {
    const result = runCompute({
      kind: "transit",
      moment: {
        datetimeLocal: "2026-06-02T09:00:00",
        latitude: 40.7128,
        longitude: -74.006,
        timezone: "America/New_York",
      },
      natal: {
        datetimeLocal: "1990-05-21T14:30:00",
        latitude: 40.7128,
        longitude: -74.006,
        timezone: "America/New_York",
      },
    });
    expect(Array.isArray(result.transitAspects)).toBe(true);
  });

  it("attaches a horary judgment for horary requests", () => {
    const result = runCompute({
      kind: "horary",
      quesitedHouse: 10,
      moment: {
        datetimeLocal: "2024-03-10T15:00:00",
        latitude: 51.5074,
        longitude: -0.1278,
        timezone: "Europe/London",
      },
    });
    expect(result.horary).toBeTruthy();
    expect(typeof result.horary!.querentSignificator).toBe("string");
  });
});
