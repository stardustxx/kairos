import { describe, expect, it } from "vitest";
import { runCompute } from "./cli.js";
import type { HoraryJudgment, MomentInput } from "./types.js";

/**
 * SEPARATING-AS-DENIAL unit tests (Lilly, CA p. 110, "Of Separation").
 *
 * The rule: when the significators' only aspect is SEPARATING (judgeHorary
 * prefers applying aspects, so a separating significatorAspect means none
 * applies) AND no perfection avenue survives — no sound translation, no sound
 * collection, no Moon applying to the quesited, no mutual reception, no
 * perfection-by-location testimony — the separation is an active dissolution
 * worth -12 (affliction-class, parity with besieging), replacing the 0-weight
 * "matter is past, not forming" narrative line. When ANY path survives, the
 * 0-weight line is kept: separation alone must never override a live carry.
 *
 * Doctrine: Lilly, CA p. 110 — separating significators mean the matter "hung
 * in suspence, and there seemed some dislike or rupture in it; and as the
 * significators doe seperate, so will the matter and affection of the parties
 * more alienate and vary". Practitioner application: Warnock's 2002 grad-school
 * horary ("separating rather than applying aspect between her significator and
 * the significator of higher education" → "decidedly negative").
 *
 * NOTE on the deferred void-vs-carry rule: an investigated companion doctrine
 * ("a sound carry in progress overrides the void-Moon debit") was a NO-GO — its
 * only basis was Lilly's 1646 marriage chart, where modern recalculation
 * (Anthony Louis, 2024) shows the supposed translation never existed at
 * accurate positions. It is NOT implemented; see the void-of-course block in
 * horary.ts for the deferral record.
 *
 * Determinism: fixed datetimeLocal + IANA timezone + lat/lon via runCompute
 * with the bundled Moshier ephemeris; no `journal` field, nothing logged.
 */

const LONDON = { latitude: 51.5074, longitude: -0.1278, timezone: "Europe/London" };
const NEW_YORK = { latitude: 40.7128, longitude: -74.006, timezone: "America/New_York" };
const WASHINGTON_DC = { latitude: 38.9167, longitude: -77.05, timezone: "America/New_York" };
const OSLO = { latitude: 59.9167, longitude: 10.7167, timezone: "Europe/Oslo" };

function judge(
  place: Omit<MomentInput, "datetimeLocal">,
  datetimeLocal: string,
  quesitedHouse: number,
): HoraryJudgment {
  return runCompute({
    kind: "horary",
    quesitedHouse,
    moment: { datetimeLocal, ...place },
  }).horary!;
}

const WEIGHT_RE = /\(([+-]\d+)\)\s*$/;

/** Sum of the displayed signed testimony weights — the sensitivity invariant. */
function displayedWeightSum(j: HoraryJudgment): number {
  return j.testimonies
    .map((line) => line.match(WEIGHT_RE))
    .filter((m): m is RegExpMatchArray => m !== null)
    .reduce((sum, m) => sum + Number.parseInt(m[1], 10), 0);
}

describe("separating-as-denial (Lilly CA p. 110)", () => {
  // Lilly's 1644 "marry the elderly man" chart (conformance corpus): Mercury and
  // Jupiter only separate by sextile, and nothing else perfects — the cleanest
  // isolated firing (the chart's only other weights cancel: +5 reception, -5
  // debility), so the score IS the new debit.
  it("fires when the significators only separate and no perfection path survives", () => {
    const j = judge(LONDON, "1644-06-24T10:30:00", 7);
    expect(j.significatorAspect?.applying).toBe(false);
    expect(j.translationOfLight).toBeNull();
    expect(j.collectionOfLight).toBeNull();
    expect(j.moonApplyingToQuesited).toBeNull();
    expect(j.significatorReception?.kind).not.toBe("mutual");
    expect(j.testimonies).toContain(
      "Significators separating (sextile) and no way of perfection remains — " +
        "the matter dissolves as they part (-12)",
    );
    expect(j.score).toBe(-12);
    expect(j.lean).toBe("uncertain");
  });

  // Golden-collection chart: the significators separate by conjunction, but a
  // sound Jupiter collection survives — the live carry wins, the 0-weight
  // narrative line is kept, and the score is untouched.
  it("does NOT fire when a sound collection survives (a live carry wins)", () => {
    const j = judge(LONDON, "2024-02-21T20:00:00", 7);
    expect(j.collectionOfLight?.collector).toBe("Jupiter");
    expect(j.testimonies).toContain(
      "Significators only separating (conjunction) — the matter is past, not forming (0)",
    );
    expect(j.testimonies.join("\n")).not.toContain("no way of perfection remains");
    expect(j.score).toBe(20);
  });

  // Bevan's 1995 physiotherapy-exam chart (conformance corpus, the critical
  // no-regression guard): the significators separate by square, but the Moon
  // applies by trine to the quesited AND the querent's ruler sits in the
  // quesited's house — exactly the avenues Bevan judged by. No denial.
  it("does NOT fire when the Moon applies to the quesited / location testimony fires", () => {
    const j = judge(OSLO, "1995-06-08T17:30:00", 10);
    expect(j.moonApplyingToQuesited?.type).toBe("trine");
    expect(j.testimonies).toContain(
      "Significators only separating (square) — the matter is past, not forming (0)",
    );
    expect(j.testimonies.join("\n")).not.toContain("no way of perfection remains");
    expect(j.score).toBe(25);
    expect(j.lean).toBe("favorable");
  });

  // Golden-direct-trine chart: an applying aspect exists, so the separating
  // branch is never reached at all.
  it("does NOT fire when the significators apply directly", () => {
    const j = judge(NEW_YORK, "2024-02-26T20:00:00", 10);
    expect(j.significatorAspect?.applying).toBe(true);
    expect(j.testimonies.join("\n")).not.toContain("Significators separating");
    expect(j.testimonies.join("\n")).not.toContain("Significators only separating");
    expect(j.score).toBe(40);
  });

  // Warnock's 2002 grad-school chart (the sourced practitioner application):
  // the -12 fires, and the score still equals the sum of the displayed
  // testimony weights — the sensitivity invariant holds with the new line.
  it("invariant: score equals the sum of displayed weights when the denial fires", () => {
    const j = judge(WASHINGTON_DC, "2002-02-15T17:50:00", 9);
    expect(j.testimonies).toContain(
      "Significators separating (sextile) and no way of perfection remains — " +
        "the matter dissolves as they part (-12)",
    );
    expect(displayedWeightSum(j)).toBe(j.score);
    expect(j.score).toBe(-7);
    expect(j.lean).toBe("uncertain");
  });
});
