import { describe, it, expect } from "vitest";
import { judgeHorary } from "../src/horary.js";
import { buildChart } from "../src/chart.js";

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
