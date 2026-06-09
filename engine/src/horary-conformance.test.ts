import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runCompute } from "./cli.js";
import type { Lean } from "./types.js";

/**
 * CLASSICAL-CONFORMANCE INSTRUMENT for the horary verdict.
 *
 * WHAT THIS MEASURES (read this before trusting the number): this suite measures
 * CONFORMANCE TO DOCUMENTED PRACTITIONER VERDICTS, not accuracy-against-reality.
 * Each case is a real, citable horary chart (William Lilly's Christian Astrology
 * worked examples are the gold standard; a few well-documented modern cases from
 * Warnock/Renaissance Astrology and Anthony Louis round out the resolved-outcome
 * set) for which we know the date, place, the question, and the AUTHOR'S OWN
 * STATED VERDICT. We run that chart through Kairos and ask one thing: does
 * Kairos's lean SIGN (favorable / unfavorable / uncertain) match the lean the
 * practitioner published? See horary-conformance.cases.json for the per-case
 * source, a verbatim quote of the verdict, and the data.
 *
 * WHAT IT DOES NOT MEASURE: it validates the lean SIGN ONLY -- never the 20/40
 * confidence bands or the numeric score. Binary classical verdicts (yes/no) carry
 * no information about whether a "60% favorable" is better calibrated than a
 * "90% favorable"; calibration can only be tested against RESOLVED REAL OUTCOMES,
 * which is a separate, later corpus. Do not read the percentage below as accuracy.
 *
 * IN-SCOPE vs KNOWN-GAP (a hard separation, never blended): some cases are marked
 * inScope=false. These are KNOWN GAPS -- charts a practitioner judged with
 * machinery Kairos does not yet model (turning the chart, natural significators,
 * directional/where reasoning, mundane multi-house synthesis). A Kairos-vs-author
 * disagreement on a known-gap case is EXPECTED and is NOT evidence of a bug. The
 * aggregate agreement number is computed over inScope cases ONLY; out-of-scope
 * cases are tallied separately with their gapReason. We never report one blended
 * "X of N".
 *
 * WHAT THE NUMBER IS FOR: the in-scope agreement % is the SIGNAL a future
 * verdict-improving change should RAISE -- e.g. adding turning-the-chart, a proper
 * translation/denial spine, or natural significators should move currently-missed
 * in-scope cases into agreement. It is a moving target to improve, not a gate.
 *
 * REGRESSION PROTECTION (this is what the assertions actually enforce): like
 * horary-golden.test.ts, every case PINS Kairos's CURRENT live lean as
 * `kairosLean` in the JSON. The test asserts live === pinned. So this file does
 * NOT hard-fail when Kairos disagrees with the practitioner (disagreement is
 * data, printed in the report); it hard-fails only when a code change MOVES a
 * pinned Kairos lean -- which must then be re-baselined in the JSON, per chart,
 * on purpose. Determinism: every chart is a pure function of its
 * datetimeLocal+timezone+lat/lon+quesitedHouse via runCompute with the bundled
 * Moshier ephemeris; no `journal` field is passed, so nothing is logged.
 */

interface ConformanceCase {
  id: string;
  source: string;
  sourceQuote: string;
  question: string;
  datetimeLocal: string;
  latitude: number;
  longitude: number;
  timezone: string;
  quesitedHouse: number;
  lillyVerdict: "yes" | "no" | "qualified";
  expectedLean: Lean;
  kairosLean: Lean;
  inScope: boolean;
  gapReason: string | null;
  note: string;
}

const CORPUS = JSON.parse(
  readFileSync(fileURLToPath(new URL("./horary-conformance.cases.json", import.meta.url)), "utf8"),
) as { cases: ConformanceCase[] };

const CASES = CORPUS.cases;

/** Run a corpus chart through Kairos and return its live lean. No journaling. */
function liveLean(c: ConformanceCase): Lean {
  const result = runCompute({
    kind: "horary",
    quesitedHouse: c.quesitedHouse,
    moment: {
      datetimeLocal: c.datetimeLocal,
      latitude: c.latitude,
      longitude: c.longitude,
      timezone: c.timezone,
    },
  });
  return result.horary!.lean;
}

/** A condition bucket label for the DIAGNOSTIC-ONLY breakdown. Mutually exclusive,
 *  picked in classical priority order. Descriptive only -- N is far too small per
 *  bucket to gate on. */
function conditionBucket(c: ConformanceCase): string {
  const r = runCompute({
    kind: "horary",
    quesitedHouse: c.quesitedHouse,
    moment: {
      datetimeLocal: c.datetimeLocal,
      latitude: c.latitude,
      longitude: c.longitude,
      timezone: c.timezone,
    },
  });
  const j = r.horary!;
  if (j.perfection.broken.includes("prohibition")) return "prohibition";
  if (j.perfection.direct) return "direct perfection";
  if (j.perfection.indirectPath) return "translation/collection";
  if (j.moonVoidOfCourse) return "void Moon";
  return "no perfection";
}

describe("horary classical-conformance corpus", () => {
  it("runs deterministically: every chart resolves to a lean (pure function of the request)", () => {
    for (const c of CASES) {
      const a = liveLean(c);
      const b = liveLean(c);
      expect(a, `${c.id} must be deterministic`).toBe(b);
      expect(["favorable", "unfavorable", "uncertain"]).toContain(a);
    }
  });

  // The actual hard gate: a future code change that MOVES a Kairos lean must
  // re-baseline the pinned kairosLean in the JSON, per chart, on purpose. This is
  // regression protection, NOT a Kairos-vs-practitioner accuracy gate.
  it.each(CASES.map((c) => [c.id, c] as const))(
    "pinned kairosLean matches live: %s",
    (_id, c) => {
      expect(liveLean(c)).toBe(c.kairosLean);
    },
  );

  it("prints the conformance report (in-scope agreement segregated from known gaps)", () => {
    const inScope = CASES.filter((c) => c.inScope);
    const outOfScope = CASES.filter((c) => !c.inScope);

    // Sanity: the pinned kairosLean we report on equals the live lean (the gate
    // above guarantees this; we recompute here so the printed report can never
    // silently drift from what the engine returns).
    const agree = inScope.filter((c) => liveLean(c) === c.expectedLean);
    const disagree = inScope.filter((c) => liveLean(c) !== c.expectedLean);
    const pct = inScope.length === 0 ? 0 : (agree.length / inScope.length) * 100;

    const lines: string[] = [];
    lines.push("");
    lines.push("================ HORARY CLASSICAL-CONFORMANCE REPORT ================");
    lines.push("CONFORMANCE to documented practitioner verdicts -- NOT accuracy.");
    lines.push("Validates lean SIGN only; says NOTHING about the 20/40 confidence");
    lines.push("bands (calibration needs resolved real outcomes -- a later corpus).");
    lines.push(`Corpus size: ${CASES.length} cases  (${inScope.length} in-scope, ${outOfScope.length} known-gap)`);
    lines.push("");
    lines.push("---- IN-SCOPE AGREEMENT (the signal a future change should RAISE) ----");
    lines.push(
      `IN-SCOPE AGREEMENT = ${agree.length} / ${inScope.length} = ${pct.toFixed(1)}%  (Kairos lean === practitioner lean)`,
    );
    for (const c of inScope) {
      const live = liveLean(c);
      const mark = live === c.expectedLean ? "  OK " : "MISS ";
      lines.push(
        `  [${mark}] ${c.id}: practitioner=${c.lillyVerdict}->${c.expectedLean}  kairos=${live}`,
      );
    }
    lines.push("");
    lines.push("---- KNOWN GAPS (out of scope -- NOT counted as accuracy/error) ----");
    lines.push(`Known-gap count: ${outOfScope.length}`);
    for (const c of outOfScope) {
      lines.push(`  - ${c.id}: practitioner=${c.lillyVerdict}->${c.expectedLean}  kairos=${liveLean(c)}`);
      lines.push(`      gap: ${c.gapReason ?? "(unspecified)"}`);
    }
    lines.push("");
    lines.push("---- DIAGNOSTIC ONLY: per-condition breakdown (N too small to gate) ----");
    const buckets = new Map<string, { agree: number; total: number }>();
    for (const c of inScope) {
      const b = conditionBucket(c);
      const acc = buckets.get(b) ?? { agree: 0, total: 0 };
      acc.total += 1;
      if (liveLean(c) === c.expectedLean) acc.agree += 1;
      buckets.set(b, acc);
    }
    for (const [bucket, acc] of [...buckets.entries()].sort()) {
      lines.push(`  ${bucket}: ${acc.agree}/${acc.total} in-scope agree (diagnostic only)`);
    }
    lines.push("");
    lines.push("Sources (audit a few against the JSON's verbatim sourceQuote):");
    for (const c of CASES.slice(0, 3)) {
      lines.push(`  * ${c.id}`);
      lines.push(`      ${c.source}`);
      lines.push(`      verdict quote: "${c.sourceQuote}"`);
    }
    lines.push("====================================================================");
    lines.push("");

    // The printed report IS the deliverable of this instrument.
    console.log(lines.join("\n"));

    // The report must compute over a non-empty in-scope set and never blend the
    // two tallies. We assert structure, NOT a conformance threshold.
    expect(inScope.length).toBeGreaterThan(0);
    expect(agree.length + disagree.length).toBe(inScope.length);
    // Guard the hard separation: every case is exactly one of in-scope / known-gap.
    expect(inScope.length + outOfScope.length).toBe(CASES.length);
    // Every known-gap case must document WHY it is out of scope.
    for (const c of outOfScope) {
      expect(c.gapReason, `${c.id} is out-of-scope and must record a gapReason`).toBeTruthy();
    }
  });
});
