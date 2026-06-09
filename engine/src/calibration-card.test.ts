import { describe, expect, it } from "vitest";
import {
  renderCalibrationCardMarkdown,
  renderCalibrationCardSvg,
} from "./calibration-card.js";
import type { CalibrationReport } from "./memory.js";

const NOTE = "Small samples are noisy — this is a personal pattern, not proof.";

/** A populated report: a few resolved readings across two bands. */
function populatedReport(): CalibrationReport {
  return {
    bands: [
      { confidence: "low", resolved: 2, correct: 1, hitRate: 0.5 },
      { confidence: "medium", resolved: 0, correct: 0, hitRate: null },
      { confidence: "high", resolved: 3, correct: 3, hitRate: 1 },
    ],
    overall: { resolved: 5, correct: 4, hitRate: 0.8 },
    unresolved: 2,
    total: 7,
    note: NOTE,
  };
}

/** An empty report: nothing directional has resolved yet. */
function emptyReport(): CalibrationReport {
  return {
    bands: [
      { confidence: "low", resolved: 0, correct: 0, hitRate: null },
      { confidence: "medium", resolved: 0, correct: 0, hitRate: null },
      { confidence: "high", resolved: 0, correct: 0, hitRate: null },
    ],
    overall: { resolved: 0, correct: 0, hitRate: null },
    unresolved: 0,
    total: 0,
    note: NOTE,
  };
}

describe("renderCalibrationCardMarkdown", () => {
  it("renders each band's hit-rate, the n, and the caveat for a populated report", () => {
    const md = renderCalibrationCardMarkdown(populatedReport());
    // Overall hit-rate and its sample size are present and prominent.
    expect(md).toContain("80%");
    expect(md).toContain("5");
    // Per-band hit-rates.
    expect(md).toContain("50%"); // low band
    expect(md).toContain("100%"); // high band
    // Sample sizes (n resolved) appear in the table.
    expect(md).toMatch(/Low \| 2/);
    expect(md).toMatch(/High \| 3/);
    // A band with no resolved samples shows an em-dash, not a fabricated rate.
    expect(md).toMatch(/Medium \| 0 \| —/);
    // The honest caveat is carried through verbatim.
    expect(md).toContain(NOTE);
  });

  it("renders the honest 'no outcomes yet' state for an empty report (never 100%/0%)", () => {
    const md = renderCalibrationCardMarkdown(emptyReport());
    expect(md.toLowerCase()).toContain("no resolved outcomes yet");
    // It must NOT present a misleading hit-rate for an empty sample.
    expect(md).not.toContain("100%");
    expect(md).not.toContain("0%");
    // The caveat is still present.
    expect(md).toContain(NOTE);
  });
});

describe("renderCalibrationCardSvg", () => {
  it("is well-formed, self-contained, and shows the n + caveat for a populated report", () => {
    const svg = renderCalibrationCardSvg(populatedReport());
    expect(svg.trimStart().startsWith("<svg")).toBe(true);
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
    // No external references — safe to embed. (The only URL allowed is the SVG
    // namespace declaration, which is an identifier, not a fetched resource.)
    const withoutNs = svg.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, "");
    expect(withoutNs).not.toMatch(/https?:/);
    expect(svg).not.toContain("<image");
    expect(svg).not.toMatch(/xlink:href|<use\b/);
    // Sample size and hit-rates are shown.
    expect(svg).toContain("n=5");
    expect(svg).toContain("80%");
    expect(svg).toContain("n=2");
    expect(svg).toContain("n=3");
    // Caveat carried through.
    expect(svg).toContain(NOTE);
    expectBalancedTags(svg);
  });

  it("renders the honest empty state with no misleading bars", () => {
    const svg = renderCalibrationCardSvg(emptyReport());
    expect(svg.trimStart().startsWith("<svg")).toBe(true);
    expect(svg).toContain("No resolved outcomes yet");
    expect(svg).not.toContain("100%");
    expect(svg).toContain(NOTE);
    expectBalancedTags(svg);
  });
});

/**
 * A light well-formedness check: every opened tag is closed (self-closing or
 * paired) and angle brackets balance. Enough to catch a broken/unclosed SVG
 * without pulling in an XML parser dependency.
 */
function expectBalancedTags(svg: string): void {
  const opens = (svg.match(/</g) ?? []).length;
  const closes = (svg.match(/>/g) ?? []).length;
  expect(opens).toBe(closes);
  // No stray unescaped ampersands (each & must start an entity).
  for (const amp of svg.matchAll(/&[^;]*/g)) {
    expect(amp[0]).toMatch(/^&(amp|lt|gt|quot|#\d+);/);
  }
}
