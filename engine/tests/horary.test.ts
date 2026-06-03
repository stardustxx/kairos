import { describe, it, expect } from "vitest";
import { judgeHorary, moonVoidStatus } from "../src/horary.js";
import { buildChart } from "../src/chart.js";
import type { PlanetPosition } from "../src/types.js";

function body(
  name: string,
  longitude: number,
  degInSign: number,
  speed: number,
): PlanetPosition {
  return { name, longitude, sign: "Aries", degInSign, retrograde: speed < 0, speed };
}

describe("judgeHorary", () => {
  it("assigns significators by sign rulership of the relevant houses", () => {
    const chart = buildChart("horary", {
      datetimeLocal: "2024-03-10T15:00:00",
      latitude: 51.5074,
      longitude: -0.1278,
      timezone: "Europe/London",
    });
    const j = judgeHorary(chart, 10); // a job question -> 10th house
    expect(typeof j.querentSignificator).toBe("string");
    expect(typeof j.quesitedSignificator).toBe("string");
    expect(typeof j.moonVoidOfCourse).toBe("boolean");
  });

  it("throws on an out-of-range quesited house", () => {
    const chart = buildChart("horary", {
      datetimeLocal: "2024-03-10T15:00:00",
      latitude: 51.5074,
      longitude: -0.1278,
      timezone: "Europe/London",
    });
    expect(() => judgeHorary(chart, 1)).toThrow();
    expect(() => judgeHorary(chart, 13)).toThrow();
  });
});

describe("moonVoidStatus", () => {
  it("reports void when the Moon is late in its sign and its tightest applying aspect perfects beyond the sign", () => {
    // Moon at 28 deg Aries (2 deg of arc left in sign), applying conjunction to
    // the Sun with a ~7 deg orb -> perfects after the Moon has changed sign.
    const moon = body("Moon", 28, 28, 13);
    const sun = body("Sun", 35, 5, 1);
    const status = moonVoidStatus([moon, sun]);
    expect(status.void).toBe(true);
    expect(status.next).not.toBeNull();
    expect(status.next!.orb).toBeGreaterThan(30 - moon.degInSign);
  });

  it("reports not void when the Moon has ample arc left before its applying aspect perfects", () => {
    // Moon at 2 deg Aries (28 deg of arc left), applying conjunction to the Sun
    // with a ~7 deg orb -> perfects well within the sign.
    const moon = body("Moon", 2, 2, 13);
    const sun = body("Sun", 9, 9, 1);
    const status = moonVoidStatus([moon, sun]);
    expect(status.void).toBe(false);
    expect(status.next).not.toBeNull();
  });
});
