import { describe, expect, it } from "vitest";
import { runCompute } from "../src/cli.js";
import { validateRequest } from "../src/validate.js";

const GOOD_MOMENT = {
  datetimeLocal: "1990-05-21T14:30:00",
  latitude: 40.71,
  longitude: -74.01,
  timezone: "America/New_York",
};

describe("validateRequest", () => {
  it("accepts a well-formed request", () => {
    expect(() => validateRequest({ kind: "natal", moment: GOOD_MOMENT })).not.toThrow();
  });

  it("rejects an unknown kind", () => {
    // @ts-expect-error testing a bad kind at runtime
    expect(() => validateRequest({ kind: "tarot", moment: GOOD_MOMENT })).toThrow(/kind must be one of/);
  });

  it("rejects out-of-range latitude/longitude with a clear message", () => {
    expect(() =>
      runCompute({ kind: "natal", moment: { ...GOOD_MOMENT, latitude: 999 } }),
    ).toThrow(/latitude must be a number in \[-90, 90\]/);
    expect(() =>
      runCompute({ kind: "natal", moment: { ...GOOD_MOMENT, longitude: 400 } }),
    ).toThrow(/longitude must be a number in \[-180, 180\]/);
  });

  it("rejects a malformed datetimeLocal", () => {
    expect(() =>
      runCompute({ kind: "natal", moment: { ...GOOD_MOMENT, datetimeLocal: "May 21 1990" } }),
    ).toThrow(/datetimeLocal must be local ISO/);
  });

  it("validates relocation coordinates too", () => {
    expect(() =>
      runCompute({ kind: "natal", moment: GOOD_MOMENT, relocation: { latitude: 91, longitude: 0 } }),
    ).toThrow(/relocation: latitude/);
  });
});
