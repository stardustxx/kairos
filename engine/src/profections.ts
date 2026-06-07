/*
 * profections.ts — annual profections (the classical "lord of the year").
 *
 * A time-lord technique: from the natal Ascendant, advance one whole sign for
 * each completed year of life. The sign reached is the profected Ascendant; its
 * position counting from the natal 1st house is the profected house (the topic
 * activated for the year), and the domicile ruler of that sign is the Lord of
 * the Year — the planet whose natal and transiting condition colours the year.
 *
 * Everything derives from the natal Ascendant degree and the person's age in
 * completed years; no ephemeris is consulted here. The activation cycles every
 * 12 years (age 0, 12, 24… all return to the natal 1st house / Ascendant sign).
 */
import { DEGREES_PER_SIGN, SIGN_COUNT, SIGN_RULER, SIGNS } from "./constants.js";
import type { Profection } from "./types.js";

/** Sign index 0..11 (Aries..Pisces) for an ecliptic longitude. */
function signIndexOf(longitude: number): number {
  return Math.floor((((longitude % 360) + 360) % 360) / DEGREES_PER_SIGN) % SIGN_COUNT;
}

/**
 * Compute the annual profection for a given completed age.
 *
 * @param natalAscLongitude ecliptic longitude (0..360) of the natal Ascendant.
 * @param ageYears completed years of life (integer, floored). Advances on each
 *   birthday; age 0 = natal Ascendant sign / 1st house.
 *
 * profectedSign = sign (natalAscSignIndex + ageYears) mod 12
 * profectedHouse = (ageYears mod 12) + 1
 * lordOfYear = domicile ruler of the profected sign
 */
export function annualProfection(natalAscLongitude: number, ageYears: number): Profection {
  const age = Math.max(0, Math.floor(ageYears));
  const natalSignIndex = signIndexOf(natalAscLongitude);
  const profectedSignIndex = (natalSignIndex + age) % SIGN_COUNT;
  const profectedHouse = (age % SIGN_COUNT) + 1;
  return {
    age,
    profectedSign: SIGNS[profectedSignIndex],
    profectedHouse,
    lordOfYear: SIGN_RULER[profectedSignIndex],
  };
}

/** Parse a tz-naive local datetime ("YYYY-MM-DDThh:mm[:ss]") into calendar
 *  fields [year, month, day, hour, minute, second]. */
function parseCalendarFields(s: string): [number, number, number, number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (!m) throw new Error(`Invalid datetime "${s}"`);
  return [
    Number(m[1]),
    Number(m[2]),
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6] ?? "0"),
  ];
}

/**
 * Completed years of life between two civil datetimes (the natal moment and the
 * target moment), each a tz-naive local ISO string. Returns the integer (floored)
 * count of full years — it advances by one on each birthday.
 *
 * The comparison is done directly on the parsed calendar fields (wall-clock),
 * NOT via Date: parsing through Date would interpret each string in the host's
 * timezone, and a DST difference between the natal year and the target year would
 * shift the reconstructed birthday by an hour and throw the boundary off by a
 * whole year. Comparing wall-clock fields sidesteps the timezone entirely.
 */
export function completedYearsBetween(natalDatetimeLocal: string, momentDatetimeLocal: string): number {
  const natal = parseCalendarFields(natalDatetimeLocal);
  const moment = parseCalendarFields(momentDatetimeLocal);
  let years = moment[0] - natal[0];
  // Has this year's birthday been reached? Compare month/day/hh/mm/ss in order.
  let reached = true;
  for (let i = 1; i < natal.length; i++) {
    if (moment[i] < natal[i]) {
      reached = false;
      break;
    }
    if (moment[i] > natal[i]) break;
  }
  if (!reached) years -= 1;
  return Math.max(0, years);
}
