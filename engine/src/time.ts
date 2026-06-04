import { DateTime } from "luxon";
import sweph from "sweph";
import tzlookup from "tz-lookup";
import type { MomentInput } from "./types.js";

export interface ResolvedTime {
  utc: string; // ISO 8601 in UTC
  julianDayUt: number;
}

export function resolveJulianDay(m: MomentInput): ResolvedTime {
  const zone = m.timezone ?? tzlookup(m.latitude, m.longitude);
  const local = DateTime.fromISO(m.datetimeLocal, { zone });
  if (!local.isValid) {
    throw new Error(`Invalid datetime "${m.datetimeLocal}" in zone "${zone}": ${local.invalidReason}`);
  }
  const utc = local.toUTC();
  const hour = utc.hour + utc.minute / 60 + utc.second / 3600;
  const jd = sweph.julday(utc.year, utc.month, utc.day, hour, sweph.constants.SE_GREG_CAL);
  return {
    utc: utc.toISO({ suppressMilliseconds: false })!,
    julianDayUt: jd,
  };
}
