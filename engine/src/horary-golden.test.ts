import { describe, expect, it } from "vitest";
import { runCompute } from "./cli.js";
import type { HoraryJudgment, MomentInput } from "./types.js";

/**
 * GOLDEN-CHART REGRESSION BASELINE for the horary verdict.
 *
 * The horary judgment (lean / confidence / score / perfection / timing /
 * testimonies) is the product's entire payload, and it falls out of the
 * magic-number weights in aggregateTestimony (engine/src/horary.ts): +40 soft
 * perfection, +20 Moon, +18 translation, +15 collection, -25 prohibition,
 * -30 void Moon, the ±15 lean cutoffs, the 20/40 confidence bands, and so on.
 * Any tweak to those weights, the moiety/reception orbs, or the perfection
 * detectors silently re-scores real charts — and the smoke tests would not
 * catch it.
 *
 * This file pins a SPREAD of fixed reference charts (real moments at London and
 * New York, each chosen because it exhibits a specific classical condition) to
 * an exact, stable projection of the judgment. A red diff here means a verdict
 * moved. When that move is INTENTIONAL — the planned prohibition-with-reception
 * and moiety-orb correctness work, or any deliberate re-weighting — UPDATE these
 * expectations as part of the change so the new verdicts are reviewed on
 * purpose, not regressed by accident.
 *
 * Determinism: every chart is built from a fixed datetimeLocal + IANA timezone
 * at a fixed lat/lon via runCompute with the bundled Moshier ephemeris, and NO
 * `journal` field is supplied — so nothing is logged and the projection is a
 * pure function of the request. We snapshot a STABLE PROJECTION (lean,
 * confidence, score, the perfection picture, timing unit/amount, and the ordered
 * testimonies) rather than the whole result object: additive SIBLING fields on
 * the result/judgment object (e.g. journalId) are dropped by the projection and
 * never break the baseline. The pinned `testimonies` array, by contrast, is
 * matched EXACTLY — any new testimony, even appended at the end, is treated as an
 * intentional change that must be reviewed and re-baselined here, by design.
 */

const LONDON = { latitude: 51.5074, longitude: -0.1278, timezone: "Europe/London" };
const NEW_YORK = { latitude: 40.7128, longitude: -74.006, timezone: "America/New_York" };

/** The stable, review-friendly slice of a judgment we pin (see header). */
interface JudgmentProjection {
  lean: HoraryJudgment["lean"];
  confidence: HoraryJudgment["confidence"];
  score: number;
  perfection: {
    direct: boolean;
    broken: HoraryJudgment["perfection"]["broken"];
    indirectPath: string | null;
  };
  /** Only the unit + amount of the timing narrative (the exact perfectsAtUtc is
   *  ephemeris-precise and not part of the verdict we guard). Null when the
   *  significators form no applying perfection. */
  timing: { unit: string; amount: number } | null;
  testimonies: string[];
}

/** Build a fixed horary chart and project its judgment down to the pinned slice.
 *  No `journal` field is passed, so runCompute writes nothing. */
function judge(
  place: Omit<MomentInput, "datetimeLocal">,
  datetimeLocal: string,
  quesitedHouse: number,
): JudgmentProjection {
  const result = runCompute({
    kind: "horary",
    quesitedHouse,
    moment: { datetimeLocal, ...place },
  });
  const j = result.horary!;
  return {
    lean: j.lean,
    confidence: j.confidence,
    score: j.score,
    perfection: {
      direct: j.perfection.direct,
      broken: j.perfection.broken,
      indirectPath: j.perfection.indirectPath,
    },
    timing: j.timing ? { unit: j.timing.unit, amount: j.timing.amount } : null,
    testimonies: j.testimonies,
  };
}

describe("horary golden charts (verdict regression baseline)", () => {
  // 1. Clearly FAVORABLE by DIRECT soft perfection: the significators apply to a
  //    trine and nothing breaks it — the +40 path with high confidence.
  it("clearly favorable: direct perfection by applying trine (NYC, 10th)", () => {
    expect(judge(NEW_YORK, "2024-02-26T20:00:00", 10)).toEqual({
      lean: "favorable",
      confidence: "high",
      score: 40,
      perfection: { direct: true, broken: [], indirectPath: null },
      timing: { unit: "weeks", amount: 8 },
      testimonies: [
        "Significators perfect by applying trine (+40)",
        "One-way reception (Venus receives the other by domicile) (+5)",
        "Querent significator Venus debilitated (dignity -5) (-5)",
        "Almuten of the 1st (querent) is Saturn (more dignified than ruler Venus) — Saturn has the strongest say over the querent (0)",
      ],
    });
  });

  // 2. Clearly UNFAVORABLE: a direct square is broken by BOTH a prohibition and a
  //    refranation with no surviving indirect path — the strong-denial floor.
  it("clearly unfavorable: prohibition + refranation break the perfection (NYC, 2nd)", () => {
    // CATEGORICAL DENIAL-SPINE re-baseline (score -43 → -51, lean unchanged
    // unfavorable/high). This chart carries a SURVIVING DENIAL: the Moon perfects a
    // trine with Saturn before the significators (an UNRECEIVED prohibition —
    // receivesTarget/mutualReception both false), AND Saturn refranes (retrograde),
    // with NO sound translation/collection rescuing the matter. So the matter is
    // categorically prohibited before it completes and earns NONE of the positive
    // perfection points: the applying-square (+8) is now SUPPRESSED to (0). The
    // denial debits (-25 prohibition, -22 refranation) and the conditions are kept,
    // so the score drops by the suppressed +8 to -51. (The earlier participating-
    // ruler/Dorothean-table fixes that set the prior -43 baseline still apply: the
    // Jupiter peregrine→detriment lift and the 2nd-house almuten flip Mars→Venus.)
    expect(judge(NEW_YORK, "2024-08-01T20:00:00", 2)).toEqual({
      lean: "unfavorable",
      confidence: "high",
      score: -51,
      perfection: { direct: false, broken: ["prohibition", "refranation"], indirectPath: null },
      timing: { unit: "days", amount: 4 },
      testimonies: [
        "Significators apply by square, but suppressed: the matter is prohibited before it completes — it earns nothing (0)",
        "One-way reception (Jupiter receives the other by domicile) (+5)",
        "Querent significator Saturn debilitated (dignity -5) (-5)",
        "Querent significator Saturn retrograde — hesitation or reversal (-4)",
        "Prohibition: Moon perfects by trine with Saturn before the significators — the matter is cut off (-25)",
        "Refranation: Saturn turns back (retrograde/stationing) before the significators perfect — the matter withdraws (-22)",
        "Almuten of the 2nd is Venus (more dignified than ruler Jupiter) — Venus has the strongest say over the matter (0)",
      ],
    });
  });

  // 3. UNCERTAIN: no aspect, no carrier, score exactly 0 — sits squarely inside
  //    the ±15 dead band. Guards the lean cutoffs themselves.
  it("uncertain: no direct aspect and no carrier, score lands in the dead band (London, 2nd)", () => {
    expect(judge(LONDON, "2024-02-21T20:00:00", 2)).toEqual({
      lean: "uncertain",
      confidence: "low",
      score: 0,
      perfection: { direct: false, broken: [], indirectPath: null },
      timing: null,
      testimonies: [
        "No direct aspect between the significators (0)",
        "Almuten of the 1st (querent) is Saturn (more dignified than ruler Venus) — Saturn has the strongest say over the querent (0)",
      ],
    });
  });

  // 4. COMBUST significator (isolated, Moon NOT void): the quesited significator
  //    Venus is combust the Sun — the -7 solar debit. Pins combustion weighting
  //    cleanly, away from a void-Moon swamp.
  it("combust significator: quesited Venus combust the Sun (NYC, 7th)", () => {
    expect(judge(NEW_YORK, "2024-05-06T20:00:00", 7)).toEqual({
      lean: "favorable",
      confidence: "medium",
      score: 23,
      perfection: { direct: false, broken: [], indirectPath: null },
      timing: null,
      testimonies: [
        "No direct aspect between the significators (0)",
        "Moon (co-significator of querent) applies by conjunction to the quesited (+20)",
        "Querent significator Mars well-dignified (dignity +6) (+5)",
        "Quesited significator Venus well-dignified (dignity +5) (+5)",
        "Quesited significator Venus combust the Sun — hidden/weakened (-7)",
        "Almuten of the 7th is Moon (more dignified than ruler Venus) — Moon has the strongest say over the matter (0)",
      ],
    });
  });

  // 5. VOID-OF-COURSE Moon: the dominant -30 testimony, now offset by a benefic
  //    enclosure (+10). The shared significator Saturn (333.27°) is tightly hemmed
  //    between Venus (243.02°, a partile square, gap 0.25°) behind and Jupiter
  //    (35.58°, a sextile, gap 2.31°) ahead — nothing intervening on either side —
  //    so Saturn is enclosed between the two benefics ("aided"): a real protection
  //    the engine now credits, lifting the score -30 → -20 (still unfavorable, but
  //    the void Moon is partly softened). Enclosure verified: both flanking rays
  //    are within the 6° enclosure cap and are the tightest contacts on their side.
  it("void-of-course Moon, softened by benefic enclosure of Saturn (London, 2nd)", () => {
    expect(judge(LONDON, "2024-01-01T08:00:00", 2)).toEqual({
      lean: "unfavorable",
      confidence: "medium",
      score: -20,
      perfection: { direct: false, broken: [], indirectPath: null },
      timing: null,
      testimonies: [
        "No direct aspect between the significators (0)",
        "querent significator Saturn enclosed between Venus and Jupiter — shielded by both benefics (+10)",
        "Moon void of course — little is likely to come of the matter (-30)",
      ],
    });
  });

  // 6. TRANSLATION of light: no direct aspect, but a sound Jupiter carries the
  //    light Mars -> Saturn (+18) and Mercury also collects (+15) — the indirect
  //    perfection path. Pins both indirect-carrier weights at once.
  it("translation of light: Jupiter carries Mars to Saturn (London, 10th)", () => {
    expect(judge(LONDON, "2024-01-16T08:00:00", 10)).toEqual({
      lean: "favorable",
      confidence: "high",
      score: 48,
      perfection: { direct: false, broken: [], indirectPath: "Jupiter" },
      timing: null,
      testimonies: [
        // Saturn (querent) 334.72° and Mars (quesited) 278.76° are 55.96° apart:
        // 4.04° off a sextile. Under moiety orbs the Mars-Saturn pair allows
        // (9 + 7.5)/2 = 8.25°, so this sextile is now IN orb (the old flat 4°
        // sextile orb excluded it -> "No direct aspect"). Saturn is the slower
        // body and separating, so the contact carries 0 weight — score is
        // unchanged at 48 and the verdict is identical.
        "Significators only separating (sextile) — the matter is past, not forming (0)",
        "Moon applies by square to the quesited — testimony with difficulty (+5)",
        "Translation of light by Jupiter (Mars → Saturn) (+18)",
        "Collection of light by Mercury (+15)",
        "One-way reception (Saturn receives the other by domicile) (+5)",
        // Quesited Mars is in Capricorn (Earth); Earth's PARTICIPATING triplicity
        // ruler is Mars, so Mars now scores exaltation +4 + participating +1 = 5
        // (was 4). Still "well-dignified" (≥ 4, +5), so only the displayed dignity
        // number moves and the score is unchanged.
        "Quesited significator Mars well-dignified (dignity +5) (+5)",
        "Almuten of the 1st (querent) is Mars (more dignified than ruler Saturn) — Mars has the strongest say over the querent (0)",
      ],
    });
  });

  // 7. COLLECTION of light: the significators are separating (matter past), but a
  //    sound Jupiter both apply to gathers their light (+15) — the indirect path
  //    survives without any direct/translation credit.
  it("collection of light: Jupiter gathers both significators, quesited Mars benefic-enclosed (London, 7th)", () => {
    // Benefic-enclosure re-baseline: the quesited significator Mars (306.60°) is
    // enclosed between Venus (306.39°, a partile conjunction by BODY, gap 0.21°)
    // behind and Jupiter (39.99°, a square by RAY, gap 3.39°) ahead, with nothing
    // intervening — Mars is shielded between the two benefics ("aided", +10). Both
    // flankers are the tightest contact on their side and within the 6° enclosure
    // cap, so this is a genuine protection. It lifts the score 10 → 20, which
    // crosses the +15 favorable cutoff (uncertain → favorable) and the 20-point
    // confidence band (low → medium). Classically apt: a debilitated Mars hemmed
    // by both fortunes is rescued, not merely weak.
    expect(judge(LONDON, "2024-02-21T20:00:00", 7)).toEqual({
      lean: "favorable",
      confidence: "medium",
      score: 20,
      perfection: { direct: false, broken: [], indirectPath: "Jupiter" },
      timing: null,
      testimonies: [
        "Significators only separating (conjunction) — the matter is past, not forming (0)",
        "Collection of light by Jupiter (+15)",
        "Quesited significator Mars debilitated (dignity -5) (-5)",
        "quesited significator Mars enclosed between Venus and Jupiter — shielded by both benefics (+10)",
        "Almuten of the 1st (querent) is Saturn (more dignified than ruler Venus) — Saturn has the strongest say over the querent (0)",
      ],
    });
  });

  // 8. PROHIBITION with an INDIRECT RESCUE: the direct square is broken by both
  //    prohibition and refranation, but a sound Mars collection survives, so the
  //    -25/-22 breakers carry a +12 indirect-recovery credit and indirectPath is
  //    set. This is exactly the kind of chart the upcoming
  //    prohibition-with-reception work will revisit — pin it now.
  it("prohibition broken but rescued indirectly through Mars (London, 10th)", () => {
    // Participating-ruler re-baseline: quesited Jupiter is in Gemini (Air), whose
    // PARTICIPATING triplicity ruler is Jupiter (+1). Jupiter's dignity rises from
    // peregrine -5 to detriment -5 + participating +1 = -4, which no longer clears
    // the "debilitated" (≤ -5) threshold — so the "Quesited significator Jupiter
    // debilitated (-5)" testimony drops, the score rises -21 → -16, and that
    // crosses the |score| ≥ 20 confidence band so confidence falls medium → low.
    expect(judge(LONDON, "2024-08-11T20:00:00", 10)).toEqual({
      lean: "unfavorable",
      confidence: "low",
      score: -16,
      perfection: { direct: false, broken: ["prohibition", "refranation"], indirectPath: "Mars" },
      timing: { unit: "days", amount: 2 },
      testimonies: [
        "Significators apply by square — perfection with friction (+8)",
        "Collection of light by Mars (+15)",
        "One-way reception (Jupiter receives the other by domicile) (+5)",
        "Querent significator Saturn debilitated (dignity -5) (-5)",
        "Querent significator Saturn retrograde — hesitation or reversal (-4)",
        "Prohibition: Moon perfects by trine with Saturn before the significators — the matter is cut off (-25)",
        "Refranation: Saturn turns back (retrograde/stationing) before the significators perfect — the matter withdraws (-22)",
        "Indirect recovery: though prohibited directly, Mars carries the light between the significators — the matter can still come together that way (+12)",
      ],
    });
  });

  // 9. BESIEGING: a direct applying conjunction (+40), but the querent
  //    significator Sun is hemmed between Mars and Saturn (-12) and the quesited
  //    Saturn is combust — the perfection is marked broken by "besieging". Pins
  //    the besieging debit and its interaction with a direct perfection.
  it("besieging: querent Sun hemmed between Mars and Saturn (London, 7th)", () => {
    expect(judge(LONDON, "2028-04-15T12:00:00", 7)).toEqual({
      lean: "favorable",
      confidence: "medium",
      score: 21,
      perfection: { direct: false, broken: ["besieging"], indirectPath: null },
      timing: { unit: "days", amount: 4 },
      testimonies: [
        "Significators perfect by applying conjunction (+40)",
        "Querent significator Sun well-dignified (dignity +7) (+5)",
        "Quesited significator Saturn debilitated (dignity -5) (-5)",
        "Quesited significator Saturn combust the Sun — hidden/weakened (-7)",
        "querent significator Sun besieged between Mars and Saturn — hemmed by both malefics (-12)",
      ],
    });
  });

  // 10. ORDINARY MIXED chart, 2nd house (money/resources): translation by Mercury
  //     plus mixed dignities net a low-confidence favorable lean — a realistic
  //     "leans yes but weakly" verdict.
  it("ordinary mixed, 2nd house: weak favorable via Mercury translation (NYC, 2nd)", () => {
    expect(judge(NEW_YORK, "2024-02-06T08:00:00", 2)).toEqual({
      lean: "favorable",
      confidence: "low",
      score: 18,
      perfection: { direct: false, broken: [], indirectPath: "Mercury" },
      timing: null,
      testimonies: [
        "No direct aspect between the significators (0)",
        "Translation of light by Mercury (Mars → Jupiter) (+18)",
        "Querent significator Jupiter debilitated (dignity -5) (-5)",
        // Quesited Mars is in Capricorn (Earth); Earth's PARTICIPATING triplicity
        // ruler is Mars, so Mars now scores exaltation +4 + participating +1 +
        // term +2 = 7 (was 6). Still "well-dignified" (+5), display number only.
        "Quesited significator Mars well-dignified (dignity +7) (+5)",
        "Almuten of the 1st (querent) is Venus (more dignified than ruler Jupiter) — Venus has the strongest say over the querent (0)",
        "Almuten of the 2nd is Sun (more dignified than ruler Mars) — Sun has the strongest say over the matter (0)",
      ],
    });
  });

  // 11. ORDINARY MIXED chart, 7th house (relationship/other party): a direct
  //     applying sextile that is PROHIBITED by the Moon. The Moon (343.69°) perfects
  //     a square with quesited Venus (81.31°) before the significators do — an
  //     UNRECEIVED prohibition (receivesTarget/mutualReception both false) — and
  //     there is NO translation/collection to rescue the matter. So this is a
  //     SURVIVING DENIAL.
  //
  //     CATEGORICAL DENIAL-SPINE re-baseline (VERDICT FLIP favorable → unfavorable;
  //     score +20 → -25). Classically (Lilly CA Bk. III), a perfection prohibited
  //     before it completes does NOT happen — the matter is denied. Under the old
  //     flat additive score the +40 sextile out-weighed the -25 prohibition, netting
  //     a wrong "favorable +20". Now the matter earns NONE of its perfection points:
  //     the direct sextile (+40) AND the Moon-applies-to-quesited (+5) are both
  //     SUPPRESSED to (0). The -25 prohibition debit dominates, the score goes
  //     negative (-25 = -25 + dignity +5 - 5), and the lean is correctly unfavorable.
  //     This is the showcase chart for the rule: a single surviving denial overturns
  //     a direct perfection. confidence medium (|score| 25 ≥ 20).
  it("surviving denial: direct sextile prohibited by the Moon is categorically denied (London, 7th)", () => {
    expect(judge(LONDON, "2026-05-11T20:00:00", 7)).toEqual({
      lean: "unfavorable",
      confidence: "medium",
      score: -25,
      perfection: { direct: false, broken: ["prohibition"], indirectPath: null },
      timing: { unit: "weeks", amount: 3 },
      testimonies: [
        "Significators apply by sextile, but suppressed: the matter is prohibited before it completes — it earns nothing (0)",
        "Moon applies by square to the quesited, but suppressed: the matter is prohibited before it completes — it earns nothing (0)",
        "Querent significator Mars well-dignified (dignity +7) (+5)",
        "Quesited significator Venus debilitated (dignity -5) (-5)",
        "Prohibition: Moon perfects by square with Venus before the significators — the matter is cut off (-25)",
      ],
    });
  });

  // 12. ORDINARY MIXED chart, 10th house (career/outcome): direct trine perfection
  //     with reception (the slow-but-clean "yes"), now REINFORCED by a Mercury
  //     translation. Under moiety orbs Mercury (81.51°) and the Moon (252.28°,
  //     querent co-significator) are 170.77° apart — 9.23° off an opposition —
  //     which fits their (7 + 12)/2 = 9.5° pair orb but exceeded the old flat 8°
  //     opposition orb. That newly in-orb Mercury-Moon opposition lets Mercury
  //     translate light (Jupiter -> Moon), adding +18 and an indirectPath, so the
  //     score rises 45 -> 63 (still favorable/high; the direct trine is intact).
  it("ordinary mixed, 10th house: direct trine with reception and Mercury translation (NYC, 10th)", () => {
    expect(judge(NEW_YORK, "2027-05-21T08:00:00", 10)).toEqual({
      lean: "favorable",
      confidence: "high",
      score: 63,
      perfection: { direct: true, broken: [], indirectPath: "Mercury" },
      timing: { unit: "months", amount: 7 },
      testimonies: [
        "Significators perfect by applying trine (+40)",
        "Translation of light by Mercury (Jupiter → Moon) (+18)",
        "One-way reception (Jupiter receives the other by domicile) (+5)",
      ],
    });
  });
});
