import { DateTime } from "luxon";
import tzlookup from "tz-lookup";
import { SE_GREG_CAL } from "./constants.js";
import { ephemeris } from "./ephemeris-provider.js";
import type { MomentInput } from "./types.js";

export interface ResolvedTime {
  utc: string; // ISO 8601 in UTC
  julianDayUt: number;
}

/**
 * Convert a Universal Time Julian Day back to an ISO 8601 UTC string.
 * Uses sweph.revjul to break the JD into civil components, then Luxon to
 * format. (sweph.jdut1_to_utc applies leap-second corrections that introduce
 * sub-second jitter; revjul gives the clean UT calendar value we want.)
 */
export function julianDayToUtcString(julianDayUt: number): string {
  const r = ephemeris().revjul(julianDayUt, SE_GREG_CAL);
  const whole = Math.floor(r.hour);
  const minFloat = (r.hour - whole) * 60;
  const minute = Math.floor(minFloat);
  const second = (minFloat - minute) * 60;
  const dt = DateTime.fromObject(
    {
      year: r.year,
      month: r.month,
      day: r.day,
      hour: whole,
      minute,
      second: Math.floor(second),
      millisecond: Math.round((second - Math.floor(second)) * 1000),
    },
    { zone: "utc" },
  );
  return dt.toISO({ suppressMilliseconds: true })!;
}

export function resolveJulianDay(m: MomentInput): ResolvedTime {
  const zone = m.timezone ?? tzlookup(m.latitude, m.longitude);
  const local = DateTime.fromISO(m.datetimeLocal, { zone });
  if (!local.isValid) {
    throw new Error(`Invalid datetime "${m.datetimeLocal}" in zone "${zone}": ${local.invalidReason}`);
  }
  const utc = local.toUTC();
  const hour = utc.hour + utc.minute / 60 + utc.second / 3600;
  const jd = ephemeris().julday(utc.year, utc.month, utc.day, hour, SE_GREG_CAL);
  return {
    utc: utc.toISO({ suppressMilliseconds: false })!,
    julianDayUt: jd,
  };
}
