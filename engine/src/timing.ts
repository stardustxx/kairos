/*
 * timing.ts — plain-language "when" estimates for horary perfection.
 *
 * Classical timing reads an applying aspect as a clock. The NUMBER of time units
 * is the degrees-to-perfection (the aspect's current orb): a significator 4°
 * short of perfecting gives "4". The UNIT (days / weeks / months / years) is set
 * by the modality (quadruplicity) of the sign the applying significator occupies,
 * optionally refined by its angularity:
 *
 *   - movable / cardinal sign  -> the FAST unit (days)
 *   - common  / mutable  sign  -> the MEDIUM unit (weeks)
 *   - fixed              sign  -> the SLOW unit (months)
 *
 * Angularity sharpens or stretches this: a significator in an angular house
 * (1,4,7,10) hastens the matter (one unit faster); a cadent house (3,6,9,12)
 * delays it (one unit slower); succedent houses leave the modality unit as is.
 *
 * Source: William Lilly, "Christian Astrology" (1647), Ch. on "the time when a
 * thing shall be perfected" — units by the quadruplicity of the sign and the
 * angularity of the significators. This is explicitly an ESTIMATE, not a
 * deterministic prediction; when the exact perfection time is known
 * (aspect.perfectsAtUtc) it is surfaced verbatim alongside the estimate.
 */
import { signIndexOf } from "./constants.js";
import type { Aspect, PlanetPosition, Timing } from "./types.js";

/** Time units, ordered fast -> slow, so angularity can shift by one step.
 *  Mirrors the `unit` field of the public `Timing` interface in types.ts. */
export type TimingUnit = Timing["unit"];

const UNIT_LADDER: TimingUnit[] = ["days", "weeks", "months", "years"];

/** Sign modality (quadruplicity) -> base unit. The ladder lets angularity shift
 *  one step faster/slower around this base. */
type Modality = "movable" | "common" | "fixed";

const MODALITY_UNIT: Record<Modality, TimingUnit> = {
  movable: "days", // cardinal: Aries, Cancer, Libra, Capricorn
  common: "weeks", // mutable: Gemini, Virgo, Sagittarius, Pisces
  fixed: "months", // fixed: Taurus, Leo, Scorpio, Aquarius
};

/** Modality of a sign by its index 0..11 (Aries..Pisces): the quadruplicity
 *  repeats movable, fixed, common every three signs. */
function modalityOfSignIndex(signIndex: number): Modality {
  switch (signIndex % 3) {
    case 0:
      return "movable";
    case 1:
      return "fixed";
    default:
      return "common";
  }
}

/** Shift a unit one step along the fast->slow ladder, clamped at the ends. */
function shiftUnit(unit: TimingUnit, steps: number): TimingUnit {
  const i = UNIT_LADDER.indexOf(unit);
  const next = Math.min(Math.max(i + steps, 0), UNIT_LADDER.length - 1);
  return UNIT_LADDER[next];
}

/** Angularity of a house: angular (1,4,7,10) hastens, cadent (3,6,9,12) delays,
 *  succedent (2,5,8,11) is neutral. Returns the ladder shift (-1 / 0 / +1).
 *  House 0 (unknown) is treated as neutral. */
function angularityShift(house: number | undefined): number {
  if (!house || house < 1 || house > 12) return 0;
  if (house === 1 || house === 4 || house === 7 || house === 10) return -1; // angular: hastens
  if (house === 3 || house === 6 || house === 9 || house === 12) return 1; // cadent: delays
  return 0; // succedent
}

/** Format an ISO 8601 UTC timestamp into a readable calendar date (YYYY-MM-DD).
 *  Returns null when the input is not a parseable date. */
function formatPerfectionDate(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // Calendar date in UTC; the time-of-day is rarely meaningful for an estimate.
  return d.toISOString().slice(0, 10);
}

/**
 * Turn an applying aspect into a human "when" estimate, classically grounded.
 *
 * The NUMBER of units is degrees-to-perfection (the aspect orb), rounded to the
 * nearest whole unit (a minimum of 1, since an in-orb applying aspect always
 * implies "soon", never "zero"). The UNIT is the modality of the sign the
 * applying significator (`movingPlanet`) occupies, shifted by its angularity
 * when the planet carries a house.
 *
 * This is an ESTIMATE. When the aspect's exact perfection time is known
 * (`aspect.perfectsAtUtc`), it is surfaced in `perfectsAtUtc` and appended to
 * `text` as a readable absolute date ("perfects on YYYY-MM-DD").
 */
export function estimateTiming(aspect: Aspect, movingPlanet: PlanetPosition): Timing {
  const degreesToPerfection = aspect.orb;
  const signIndex = signIndexOf(movingPlanet.longitude);
  const modality = modalityOfSignIndex(signIndex);
  const baseUnit = MODALITY_UNIT[modality];
  const unit = shiftUnit(baseUnit, angularityShift(movingPlanet.house));

  // At least one whole unit: an applying aspect in orb is always "soon".
  const amount = Math.max(1, Math.round(degreesToPerfection));

  let text = `about ${amount} ${amount === 1 ? unit.replace(/s$/, "") : unit}`;

  const perfectsAtUtc = aspect.perfectsAtUtc ?? null;
  if (perfectsAtUtc) {
    const date = formatPerfectionDate(perfectsAtUtc);
    if (date) text += ` (perfects on ${date})`;
  }

  return { degreesToPerfection, unit, amount, text, perfectsAtUtc };
}
