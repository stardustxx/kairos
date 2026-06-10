import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runCompute } from "./cli.js";
import type { Confidence, HoraryJudgment, Lean } from "./types.js";

/**
 * WEIGHT-SENSITIVITY DIAGNOSTIC for the horary verdict (READ-ONLY).
 *
 * This is NOT a gate and it does NOT change production scoring. It answers two
 * questions, to de-risk the upcoming denial-spine re-derivation:
 *
 *  1. WHICH VERDICTS ARE FRAGILE? For every corpus + golden chart it computes
 *     the MARGIN = distance from the live score to the nearest lean cutoff
 *     (±15) and the nearest confidence band (20 / 40), and flags any chart
 *     within ~5 points of a boundary as NEAR-BOUNDARY (most likely to be wrong
 *     when a weight moves).
 *
 *  2. WHICH WEIGHTS ARE LOAD-BEARING vs INERT? It perturbs each scoring weight
 *     in aggregateTestimony (engine/src/horary.ts) by ±10 / ±25 %, one at a
 *     time, re-scores every chart, and counts how many verdicts FLIP lean or
 *     confidence. A ranked table (weight -> #lean-flips, #confidence-flips)
 *     separates the 3–4 weights that actually move verdicts from the inert ones.
 *
 * HOW IT STAYS READ-ONLY: aggregateTestimony is effectively a pure function of
 * its testimony inputs, and the live engine already emits every fired weight as
 * a signed `(+NN)` / `(-NN)` suffix on an identifiable testimony line. So this
 * file recovers each chart's per-weight contribution by parsing the live
 * testimony strings (verified below to reconstruct the engine's score EXACTLY),
 * then re-scores with a perturbed copy of one weight. No production scoring code
 * is touched, and the lean / confidence formulas are re-derived here from score
 * + void-Moon exactly as the engine computes them (asserted to match live).
 *
 * If aggregateTestimony's weights or its lean/confidence formula change, the
 * "reconstruction matches the live engine" assertions below will fail loudly —
 * that is the contract that keeps this diagnostic honest.
 */

const LONDON = { latitude: 51.5074, longitude: -0.1278, timezone: "Europe/London" };
const NEW_YORK = { latitude: 40.7128, longitude: -74.006, timezone: "America/New_York" };

/** The lean cutoff: |score| > 15 leans, else uncertain (see horary.ts). */
const LEAN_CUTOFF = 15;
/** Confidence bands on |score| (see horary.ts): >=40 high, >=20 medium. */
const CONF_BANDS = [20, 40] as const;
/** A verdict is "near-boundary" when its score is within this many points of a
 *  lean cutoff or a confidence band — the fragile, most-likely-wrong verdicts. */
const NEAR = 5;

interface ChartRef {
  id: string;
  quesitedHouse: number;
  moment: { datetimeLocal: string; latitude: number; longitude: number; timezone: string };
}

const GOLDEN: ChartRef[] = (
  [
    ["golden-direct-trine", NEW_YORK, "2024-02-26T20:00:00", 10],
    ["golden-prohib-refran", NEW_YORK, "2024-08-01T20:00:00", 2],
    ["golden-deadband", LONDON, "2024-02-21T20:00:00", 2],
    ["golden-combust", NEW_YORK, "2024-05-06T20:00:00", 7],
    ["golden-void-scorpio", LONDON, "2024-03-01T20:00:00", 2],
    ["golden-translation", LONDON, "2024-01-16T08:00:00", 10],
    ["golden-collection", LONDON, "2024-02-21T20:00:00", 7],
    ["golden-prohib-rescue", LONDON, "2024-08-11T20:00:00", 10],
    ["golden-besieging", LONDON, "2028-04-15T12:00:00", 7],
    ["golden-mixed-2nd", NEW_YORK, "2024-02-06T08:00:00", 2],
    ["golden-prohibited-sextile", LONDON, "2026-05-11T20:00:00", 7],
    ["golden-trine-translation", NEW_YORK, "2027-05-21T08:00:00", 10],
  ] as const
).map(([id, place, datetimeLocal, quesitedHouse]) => ({
  id,
  quesitedHouse,
  moment: { datetimeLocal, ...place },
}));

interface ConformanceCase {
  id: string;
  datetimeLocal: string;
  latitude: number;
  longitude: number;
  timezone: string;
  quesitedHouse: number;
}

const CORPUS_CASES = (
  JSON.parse(
    readFileSync(fileURLToPath(new URL("./horary-conformance.cases.json", import.meta.url)), "utf8"),
  ) as { cases: ConformanceCase[] }
).cases.map(
  (c): ChartRef => ({
    id: c.id,
    quesitedHouse: c.quesitedHouse,
    moment: {
      datetimeLocal: c.datetimeLocal,
      latitude: c.latitude,
      longitude: c.longitude,
      timezone: c.timezone,
    },
  }),
);

const CHARTS: ChartRef[] = [...CORPUS_CASES, ...GOLDEN];

/**
 * The named scoring weights of aggregateTestimony. The key is a stable label and
 * the value is the magnitude the live engine applies; perturbing one of these is
 * exactly what a re-derivation would do. We classify each live testimony line to
 * one of these keys (or null for the 0-weight narrative lines) so a perturbed
 * weight re-scores only the lines it fired on.
 */
type WeightKey =
  | "softPerfection" // +40 applying conjunction/sextile/trine
  | "squareApply" // +8 applying square (friction)
  | "oppositionApply" // -8 applying opposition (regret)
  | "moonSoft" // +20 Moon applies soft to quesited
  | "moonHard" // +5 Moon applies hard to quesited
  | "translation" // +18 translation of light
  | "collection" // +15 collection of light
  | "receptionMutual" // +15 mutual reception
  | "receptionOneWay" // +5 one-way reception
  | "dignityStrong" // +5 well-dignified significator
  | "dignityWeak" // -5 debilitated significator
  | "cazimi" // +5 cazimi
  | "combust" // -7 combust
  | "underBeams" // -3 under the Sun's beams
  | "retrograde" // -4 retrograde significator
  | "prohibitionDeny" // -25 denying (unreceived) prohibition
  | "prohibitionReceived" // +5 received prohibition (perfects with labour)
  | "refranation" // -22 refranation
  | "besieging" // -12 body-besieged OR malefic ray-enclosure
  | "beneficEnclosure" // +10 enclosed between Jupiter & Venus
  | "indirectRecovery" // +12 prohibited directly but a sound carrier rescues
  | "locationMatterComes" // +15 quesited's ruler in the querent's house (perfection by location)
  | "locationQuerentGoes" // +10 querent's ruler in the quesited's house (perfection by location)
  | "voidMoon" // -30 Moon void of course
  | "voidMoonMitigated"; // -15 void Moon in Taurus/Cancer/Sagittarius/Pisces (Lilly's exception)

/** Classify a single live testimony line to the weight key it represents, or
 *  null when it is a 0-weight narrative/almuten line. Matched on the stable
 *  prose the engine emits (see horary.ts), independent of the numeric suffix. */
function classify(line: string): WeightKey | null {
  if (line.startsWith("Significators perfect by applying")) return "softPerfection";
  if (line.startsWith("Significators apply by square")) return "squareApply";
  if (line.startsWith("Significators apply by opposition")) return "oppositionApply";
  if (line.startsWith("Moon (co-significator of querent) applies")) return "moonSoft";
  if (line.startsWith("Moon applies by") && line.includes("testimony with difficulty"))
    return "moonHard";
  if (line.startsWith("Translation of light") && !line.includes("FAILS")) return "translation";
  if (line.startsWith("Collection of light") && !line.includes("FAILS")) return "collection";
  if (line.startsWith("Significators in mutual reception")) return "receptionMutual";
  if (line.startsWith("One-way reception")) return "receptionOneWay";
  if (line.includes("well-dignified")) return "dignityStrong";
  if (line.includes("debilitated (dignity")) return "dignityWeak";
  if (line.includes("cazimi")) return "cazimi";
  if (line.includes("combust the Sun")) return "combust";
  if (line.includes("under the Sun's beams")) return "underBeams";
  if (line.includes("retrograde — hesitation")) return "retrograde";
  if (line.startsWith("Prohibition") && line.includes("the matter is cut off")) {
    return "prohibitionDeny";
  }
  if (line.startsWith("Prohibition") && line.includes("perfects with labour")) {
    return "prohibitionReceived";
  }
  if (line.startsWith("Refranation")) return "refranation";
  if (line.includes("hemmed by both malefics")) return "besieging";
  if (line.includes("shielded by both benefics")) return "beneficEnclosure";
  if (line.startsWith("Indirect recovery")) return "indirectRecovery";
  if (line.includes("the matter comes to the querent (perfection by location)")) {
    return "locationMatterComes";
  }
  if (line.includes("the querent goes to the matter (perfection by location)")) {
    return "locationQuerentGoes";
  }
  // The mitigated form ("Moon void of course, but in …") must be tested BEFORE
  // the plain void prefix — both start with the same words.
  if (line.startsWith("Moon void of course, but in")) return "voidMoonMitigated";
  if (line.startsWith("Moon void of course")) return "voidMoon";
  // 0-weight narrative lines: "No direct aspect…", "Significators only
  // separating…", impeded-carrier "…FAILS…", and the almuten "(0)" notes.
  return null;
}

/** One fired weight on a chart: its key, the live magnitude, and how many times
 *  it fired (e.g. two debilitated significators both apply dignityWeak). */
interface FiredWeight {
  key: WeightKey;
  /** The signed magnitude the engine applied per occurrence. */
  magnitude: number;
  count: number;
}

interface ChartScore {
  id: string;
  /** The live engine verdict — the ground truth we reconstruct against. */
  live: { score: number; lean: Lean; confidence: Confidence; moonVoid: boolean };
  /** Per-weight contributions parsed from the live testimony lines. */
  fired: FiredWeight[];
  /** Fixed contribution from 0-weight lines (always 0, kept for clarity). */
  baseline: number;
}

const WEIGHT_RE = /\(([+-]\d+)\)\s*$/;

function judgeLive(ref: ChartRef): HoraryJudgment {
  return runCompute({ kind: "horary", quesitedHouse: ref.quesitedHouse, moment: ref.moment })
    .horary!;
}

/** Parse the live judgment into a reconstructable ChartScore. */
function decompose(ref: ChartRef): ChartScore {
  const j = judgeLive(ref);
  const byKey = new Map<WeightKey, { magnitude: number; count: number }>();
  for (const line of j.testimonies) {
    const key = classify(line);
    if (!key) continue;
    const m = line.match(WEIGHT_RE);
    if (!m) continue;
    const magnitude = Number.parseInt(m[1], 10);
    const prev = byKey.get(key);
    if (prev) {
      // This diagnostic ASSUMES every firing of a weight key carries the same
      // per-occurrence magnitude (true today: all weights are fixed constants).
      // Assert it, so a future variable-magnitude weight (e.g. a dignity-
      // proportional debit) surfaces here instead of silently mis-attributing flips.
      if (prev.magnitude !== magnitude) {
        throw new Error(
          `sensitivity diagnostic assumes constant per-key magnitude, but ${key} fired ` +
            `with ${prev.magnitude} and ${magnitude} — store magnitudes per-occurrence`,
        );
      }
      prev.count += 1;
    } else {
      byKey.set(key, { magnitude, count: 1 });
    }
  }
  const fired: FiredWeight[] = [...byKey.entries()].map(([key, v]) => ({
    key,
    magnitude: v.magnitude,
    count: v.count,
  }));
  return {
    id: ref.id,
    live: {
      score: j.score,
      lean: j.lean,
      confidence: j.confidence,
      moonVoid: j.moonVoidOfCourse,
    },
    fired,
    baseline: 0,
  };
}

/** Re-derive the lean from a score exactly as the engine does. */
function leanOf(score: number): Lean {
  return score > LEAN_CUTOFF ? "favorable" : score < -LEAN_CUTOFF ? "unfavorable" : "uncertain";
}

/** Re-derive the confidence band exactly as the engine does (void Moon caps a
 *  favorable lean to low). */
function confidenceOf(score: number, moonVoid: boolean): Confidence {
  const strength = Math.abs(score);
  let c: Confidence = "low";
  if (strength >= CONF_BANDS[1]) c = "high";
  else if (strength >= CONF_BANDS[0]) c = "medium";
  if (moonVoid && leanOf(score) === "favorable") c = "low";
  return c;
}

/** Reconstruct a chart's score, optionally scaling ONE weight key by `factor`.
 *  With no override this must reproduce the live score exactly. */
function reconstructScore(cs: ChartScore, perturbKey?: WeightKey, factor = 1): number {
  let score = cs.baseline;
  for (const f of cs.fired) {
    const scale = f.key === perturbKey ? factor : 1;
    // Round the perturbed magnitude to an integer — the engine's weights are all
    // integers, and a re-derivation would pick integer weights too.
    const mag = perturbKey === f.key ? Math.round(f.magnitude * scale) : f.magnitude;
    score += mag * f.count;
  }
  return score;
}

const ALL_KEYS: WeightKey[] = [
  "softPerfection",
  "squareApply",
  "oppositionApply",
  "moonSoft",
  "moonHard",
  "translation",
  "collection",
  "receptionMutual",
  "receptionOneWay",
  "dignityStrong",
  "dignityWeak",
  "cazimi",
  "combust",
  "underBeams",
  "retrograde",
  "prohibitionDeny",
  "prohibitionReceived",
  "refranation",
  "besieging",
  "beneficEnclosure",
  "indirectRecovery",
  "locationMatterComes",
  "locationQuerentGoes",
  "voidMoon",
  "voidMoonMitigated",
];

const PERTURBATIONS = [-0.25, -0.1, 0.1, 0.25] as const;

describe("horary weight-sensitivity diagnostic (read-only)", () => {
  const decomposed = CHARTS.map(decompose);

  it("reconstruction matches the live engine exactly (the diagnostic's contract)", () => {
    for (const cs of decomposed) {
      const score = reconstructScore(cs);
      expect(score, `${cs.id} reconstructed score`).toBe(cs.live.score);
      expect(leanOf(score), `${cs.id} reconstructed lean`).toBe(cs.live.lean);
      expect(confidenceOf(score, cs.live.moonVoid), `${cs.id} reconstructed confidence`).toBe(
        cs.live.confidence,
      );
    }
  });

  it("prints the sensitivity report (near-boundary verdicts + load-bearing weights)", () => {
    const lines: string[] = [];
    lines.push("");
    lines.push("================ HORARY WEIGHT-SENSITIVITY REPORT ================");
    lines.push("READ-ONLY diagnostic. No production scoring changed. De-risks the");
    lines.push("denial-spine re-derivation by showing fragile verdicts + which");
    lines.push(`weights move them. Lean cutoff ±${LEAN_CUTOFF}; confidence bands ${CONF_BANDS.join("/")}.`);
    lines.push(`Charts analysed: ${decomposed.length} (${CORPUS_CASES.length} corpus + ${GOLDEN.length} golden)`);
    lines.push("");

    // ---- (1) MARGINS / NEAR-BOUNDARY verdicts ----------------------------
    interface Margin {
      id: string;
      score: number;
      lean: Lean;
      confidence: Confidence;
      toLean: number;
      toBand: number;
      nearest: number;
    }
    const margins: Margin[] = decomposed.map((cs) => {
      const s = cs.live.score;
      const toLean = Math.abs(Math.abs(s) - LEAN_CUTOFF);
      const toBand = Math.min(...CONF_BANDS.map((b) => Math.abs(Math.abs(s) - b)));
      return {
        id: cs.id,
        score: s,
        lean: cs.live.lean,
        confidence: cs.live.confidence,
        toLean,
        toBand,
        nearest: Math.min(toLean, toBand),
      };
    });
    const nearBoundary = margins
      .filter((m) => m.nearest <= NEAR)
      .sort((a, b) => a.nearest - b.nearest);

    lines.push(`---- NEAR-BOUNDARY VERDICTS (within ${NEAR} pts of a cutoff/band) ----`);
    lines.push(`NEAR-BOUNDARY COUNT = ${nearBoundary.length} / ${decomposed.length} charts`);
    for (const m of nearBoundary) {
      const which = m.toLean <= m.toBand ? `lean ±${LEAN_CUTOFF}` : `conf band ${CONF_BANDS.join("/")}`;
      lines.push(
        `  [${m.nearest} pts] ${m.id}: score=${m.score} (${m.lean}/${m.confidence}) ` +
          `-> nearest is the ${which} edge`,
      );
    }
    lines.push("");
    lines.push("  Full margin table (toLean = dist to ±15, toBand = dist to 20/40):");
    for (const m of [...margins].sort((a, b) => a.nearest - b.nearest)) {
      lines.push(
        `    ${m.id.padEnd(28)} score=${String(m.score).padStart(4)} ` +
          `toLean=${String(m.toLean).padStart(3)} toBand=${String(m.toBand).padStart(3)} ` +
          `${m.lean}/${m.confidence}`,
      );
    }
    lines.push("");

    // ---- (2) PERTURB EACH WEIGHT, COUNT FLIPS ----------------------------
    interface Flips {
      key: WeightKey;
      magnitude: number | null; // the live magnitude (null if never fired)
      firedOn: number; // # charts where this weight fired
      leanFlips: number; // distinct charts whose lean flips under some perturbation
      confFlips: number; // distinct charts whose confidence flips under some perturbation
    }
    const flipRows: Flips[] = ALL_KEYS.map((key) => {
      const firedCharts = decomposed.filter((cs) => cs.fired.some((f) => f.key === key));
      const magnitude =
        firedCharts.length > 0
          ? (firedCharts[0].fired.find((f) => f.key === key)?.magnitude ?? null)
          : null;
      const leanFlipped = new Set<string>();
      const confFlipped = new Set<string>();
      for (const cs of firedCharts) {
        for (const factor of PERTURBATIONS) {
          const s = reconstructScore(cs, key, 1 + factor);
          if (leanOf(s) !== cs.live.lean) leanFlipped.add(cs.id);
          if (confidenceOf(s, cs.live.moonVoid) !== cs.live.confidence) confFlipped.add(cs.id);
        }
      }
      return {
        key,
        magnitude,
        firedOn: firedCharts.length,
        leanFlips: leanFlipped.size,
        confFlips: confFlipped.size,
      };
    });

    const ranked = [...flipRows].sort(
      (a, b) =>
        b.leanFlips + b.confFlips - (a.leanFlips + a.confFlips) ||
        b.leanFlips - a.leanFlips ||
        b.firedOn - a.firedOn,
    );

    lines.push(`---- WEIGHT SENSITIVITY (perturb ±${PERTURBATIONS.map((p) => `${Math.abs(p) * 100}%`)
      .filter((v, i, a) => a.indexOf(v) === i)
      .join("/")}, count distinct charts that flip) ----`);
    lines.push(
      "  weight              mag  firedOn  leanFlips  confFlips   verdict",
    );
    for (const r of ranked) {
      const total = r.leanFlips + r.confFlips;
      const verdict =
        r.firedOn === 0
          ? "never fires in corpus"
          : total === 0
            ? "INERT (no verdict moves)"
            : r.leanFlips > 0
              ? "LOAD-BEARING (moves leans)"
              : "moves confidence only";
      lines.push(
        `  ${r.key.padEnd(20)}${String(r.magnitude ?? "-").padStart(4)}` +
          `${String(r.firedOn).padStart(8)}${String(r.leanFlips).padStart(11)}` +
          `${String(r.confFlips).padStart(11)}   ${verdict}`,
      );
    }
    lines.push("");

    const loadBearing = ranked.filter((r) => r.leanFlips > 0).map((r) => r.key);
    const confOnly = ranked.filter((r) => r.leanFlips === 0 && r.confFlips > 0).map((r) => r.key);
    const inertFired = ranked
      .filter((r) => r.firedOn > 0 && r.leanFlips === 0 && r.confFlips === 0)
      .map((r) => r.key);
    const neverFired = ranked.filter((r) => r.firedOn === 0).map((r) => r.key);

    lines.push("---- SUMMARY ----");
    lines.push(`LOAD-BEARING (flip a lean): ${loadBearing.join(", ") || "(none)"}`);
    lines.push(`Confidence-only movers:     ${confOnly.join(", ") || "(none)"}`);
    lines.push(`INERT but firing (no flip): ${inertFired.join(", ") || "(none)"}`);
    lines.push(`Never fires in this corpus: ${neverFired.join(", ") || "(none)"}`);
    lines.push(`NEAR-BOUNDARY verdicts:     ${nearBoundary.length} of ${decomposed.length}`);
    lines.push("=================================================================");
    lines.push("");

    // The printed report IS the deliverable. Assert STRUCTURE only — this is a
    // diagnostic, never a gate on which weights happen to be load-bearing.
    console.log(lines.join("\n"));

    expect(flipRows.length).toBe(ALL_KEYS.length);
    expect(margins.length).toBe(decomposed.length);
    // Every fired weight must classify to a real magnitude (no silent drops).
    for (const r of flipRows) {
      if (r.firedOn > 0) expect(r.magnitude).not.toBeNull();
    }
  });
});
