import { describe, it, expect } from "vitest";
import { sunProximity } from "../src/conditions.js";
import { buildChart } from "../src/chart.js";

describe("sunProximity", () => {
  it("classifies cazimi within ~17 arcminutes", () => {
    expect(sunProximity(100.1, 100).state).toBe("cazimi");
    expect(sunProximity(100, 100).state).toBe("cazimi");
  });

  it("classifies combust within ~8.5°", () => {
    expect(sunProximity(105, 100).state).toBe("combust");
    expect(sunProximity(95, 100).state).toBe("combust");
  });

  it("classifies under-the-beams within ~15°", () => {
    expect(sunProximity(112, 100).state).toBe("under-beams");
  });

  it("classifies a body well away from the Sun as clear", () => {
    const p = sunProximity(130, 100);
    expect(p.state).toBe("clear");
    expect(p.distanceDeg).toBeCloseTo(30, 5);
  });

  it("handles the 0/360 wraparound", () => {
    // 1° and 359° are 2° apart -> combust.
    expect(sunProximity(1, 359).state).toBe("combust");
  });
});

describe("buildChart solar proximity", () => {
  it("attaches sunProximity to every body except the Sun", () => {
    const chart = buildChart("horary", {
      datetimeLocal: "2026-03-01T11:00:00",
      latitude: 51.5,
      longitude: -0.12,
      timezone: "Europe/London",
    });
    const sun = chart.planets.find((p) => p.name === "Sun")!;
    expect(sun.sunProximity).toBeUndefined();
    for (const p of chart.planets) {
      if (p.name === "Sun") continue;
      expect(p.sunProximity).toBeTruthy();
      expect(["cazimi", "combust", "under-beams", "clear"]).toContain(p.sunProximity!.state);
    }
  });
});
