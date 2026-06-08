/*
 * lots.ts — the classical Hermetic lots (Arabic parts) beyond the Part of
 * Fortune. Each lot is a sensitive point cast from the Ascendant by the arc
 * between two other points, with the two non-Ascendant terms swapped between
 * day and night charts (the "sect reversal").
 *
 * Formulae follow Paulus Alexandrinus (Eisagogika, 378 CE) — the canonical
 * Hellenistic seven, one lot per visible planet. Day-chart forms (Sun above
 * the horizon); reverse the two non-Ascendant terms by night:
 *
 *   Fortune (Moon)     day: Asc + Moon    - Sun       (computed in chart.ts)
 *   Spirit (Sun)       day: Asc + Sun     - Moon       — exact mirror of Fortune
 *   Eros (Venus)       day: Asc + Venus   - Spirit
 *   Necessity (Mercury)day: Asc + Fortune - Mercury
 *   Courage (Mars)     day: Asc + Fortune - Mars
 *   Victory (Jupiter)  day: Asc + Jupiter - Spirit
 *   Nemesis (Saturn)   day: Asc + Fortune - Saturn
 *
 * Source: Paulus Alexandrinus, "Introduction to Astrology" (trans. Greenbaum,
 * 2001), chapter 23 on the lots; cross-checked against Hand's "Night & Day:
 * Planetary Sect in Astrology" and the Seven Stars Astrology summary of the
 * four principal lots. Spirit, Eros, Victory reverse against Venus/Jupiter and
 * the (already sect-aware) Spirit; Necessity, Courage, Nemesis reverse against
 * Mercury/Mars/Saturn and the (already sect-aware) Fortune.
 */
import { DEGREES_PER_SIGN, SIGN_COUNT, SIGNS } from "./constants.js";
import { houseOf } from "./houses.js";
import type { Lot, Sect } from "./types.js";

function norm360(x: number): number {
  return ((x % 360) + 360) % 360;
}

/**
 * Cast a lot from the Ascendant: by day Asc + a - b, reversed by night to
 * Asc + b - a. The same sign/degree/house derivation as the Part of Fortune.
 */
function makeLot(
  name: string,
  asc: number,
  a: number,
  b: number,
  sect: Sect,
  cusps: number[],
): Lot {
  const lon = norm360(sect === "day" ? asc + a - b : asc + b - a);
  const si = Math.floor(lon / DEGREES_PER_SIGN) % SIGN_COUNT;
  return {
    name,
    longitude: lon,
    sign: SIGNS[si],
    degInSign: lon - si * DEGREES_PER_SIGN,
    house: houseOf(lon, cusps),
  };
}

/** The point longitudes a lot computation needs (all ecliptic 0..360). */
export interface LotInputs {
  ascendant: number;
  sun: number;
  moon: number;
  mercury: number;
  venus: number;
  mars: number;
  jupiter: number;
  saturn: number;
  /** The Part of Fortune longitude (already sect-aware). */
  fortune: number;
  sect: Sect;
  /** House cusps for deriving each lot's house. */
  cusps: number[];
}

/**
 * Compute the classical Hermetic lots beyond Fortune. Spirit is computed first
 * (it is the mirror of Fortune across the Ascendant and several lots depend on
 * it); Fortune is supplied by the caller. The returned order is Spirit, Eros,
 * Necessity, Courage, Victory, Nemesis.
 */
export function computeLots(inputs: LotInputs): Lot[] {
  const { ascendant, sun, moon, mercury, venus, mars, jupiter, saturn, fortune, sect, cusps } =
    inputs;

  // Spirit (Sun): day Asc + Sun - Moon — the exact mirror of Fortune across
  // the Ascendant by day, and its sect reversal flips with the chart.
  const spirit = makeLot("Spirit", ascendant, sun, moon, sect, cusps);

  return [
    spirit,
    // Eros (Venus): day Asc + Venus - Spirit.
    makeLot("Eros", ascendant, venus, spirit.longitude, sect, cusps),
    // Necessity (Mercury): day Asc + Fortune - Mercury.
    makeLot("Necessity", ascendant, fortune, mercury, sect, cusps),
    // Courage (Mars): day Asc + Fortune - Mars.
    makeLot("Courage", ascendant, fortune, mars, sect, cusps),
    // Victory (Jupiter): day Asc + Jupiter - Spirit.
    makeLot("Victory", ascendant, jupiter, spirit.longitude, sect, cusps),
    // Nemesis (Saturn): day Asc + Fortune - Saturn.
    makeLot("Nemesis", ascendant, fortune, saturn, sect, cusps),
  ];
}
