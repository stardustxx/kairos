// NOTE: this module is part of the BROWSER bundle closure, so it must not
// import `sweph` or any node:* builtin. Computation flags live on the active
// EphemerisProvider (see ephemeris-provider.ts); the body/calendar identifiers
// below are stable Swiss Ephemeris ABI values, identical across the native
// `sweph` addon and the `swisseph-wasm` build (SE_SUN=0 .. SE_MEAN_NODE=10,
// SE_GREG_CAL=1), so they are spelled as literals here.

/** Swiss Ephemeris Gregorian-calendar flag (SE_GREG_CAL). */
export const SE_GREG_CAL = 1;

export const DEGREES_PER_SIGN = 30;
export const SIGN_COUNT = 12;

export const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
] as const;
export type Sign = (typeof SIGNS)[number];

/** Normalize an ecliptic longitude into [0, 360). Values already in range are
 *  returned UNCHANGED (bit-exact): the `(x % 360 + 360) % 360` arithmetic
 *  rounds in the last ulp, and sweph output (always in range) must pass
 *  through without any floating-point wobble. */
function normalizedLongitude(longitude: number): number {
  if (longitude >= 0 && longitude < 360) return longitude;
  return ((longitude % 360) + 360) % 360;
}

/** Sign index 0..11 (Aries..Pisces) for an ecliptic longitude. Accepts any
 *  input (negative or >= 360 is normalized into [0, 360) first). */
export function signIndexOf(longitude: number): number {
  return Math.floor(normalizedLongitude(longitude) / DEGREES_PER_SIGN) % SIGN_COUNT;
}

/** Degrees into the sign (0..30) at an ecliptic longitude. */
export function degInSignOf(longitude: number): number {
  return normalizedLongitude(longitude) - signIndexOf(longitude) * DEGREES_PER_SIGN;
}

/** Smallest angular distance (0..180) between two ecliptic longitudes. */
export function separation(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Signed shortest angular path from lon1 to lon2, in (-180, 180].
 * Positive means lon2 is "ahead of" lon1 in the direction of increasing
 * longitude. Used so root-finding has a continuous function that changes sign
 * as an aspect perfects, rather than the always-positive `separation`.
 */
export function signedSeparation(lon1: number, lon2: number): number {
  let d = (lon2 - lon1) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

export interface PlanetDef {
  name: string;
  id: number;
  classical: boolean; // one of the 7 traditional planets (used for horary rulership)
}

// Body ids are the Swiss Ephemeris SE_* constants (SE_SUN..SE_PLUTO,
// SE_MEAN_NODE) — part of the stable ABI shared by both ephemeris backends.
export const PLANETS: PlanetDef[] = [
  { name: "Sun", id: 0, classical: true },
  { name: "Moon", id: 1, classical: true },
  { name: "Mercury", id: 2, classical: true },
  { name: "Venus", id: 3, classical: true },
  { name: "Mars", id: 4, classical: true },
  { name: "Jupiter", id: 5, classical: true },
  { name: "Saturn", id: 6, classical: true },
  { name: "Uranus", id: 7, classical: false },
  { name: "Neptune", id: 8, classical: false },
  { name: "Pluto", id: 9, classical: false },
  { name: "Node", id: 10, classical: false },
];

// Traditional (classical) sign rulerships, by sign index 0..11 (Aries..Pisces).
// Used for horary significators.
export const SIGN_RULER: string[] = [
  "Mars",    // Aries
  "Venus",   // Taurus
  "Mercury", // Gemini
  "Moon",    // Cancer
  "Sun",     // Leo
  "Mercury", // Virgo
  "Venus",   // Libra
  "Mars",    // Scorpio
  "Jupiter", // Sagittarius
  "Saturn",  // Capricorn
  "Saturn",  // Aquarius
  "Jupiter", // Pisces
];

/** Classical domicile ruler of the sign occupied at an ecliptic longitude
 *  (e.g. a house cusp) — the planet that rules that degree by sign rulership. */
export function rulerOfLongitude(longitude: number): string {
  return SIGN_RULER[signIndexOf(longitude)];
}

export interface AspectDef {
  name: string;
  angle: number;
}

// The five Ptolemaic aspect ANGLES. Classically the allowed orb is NOT a
// property of the aspect type but of the two PLANETS in contact (see PLANET_ORB
// and operativeOrb in aspects.ts), so no per-aspect orb is stored here.
export const ASPECTS: AspectDef[] = [
  { name: "conjunction", angle: 0 },
  { name: "sextile", angle: 60 },
  { name: "square", angle: 90 },
  { name: "trine", angle: 120 },
  { name: "opposition", angle: 180 },
];

// MOIETY-BASED ORBS. In traditional astrology an orb is the radius of a
// planet's light/body, a property of the PLANET, not of the aspect. Two planets
// are in aspect when their separation from exactness is within the MEAN of
// their two full orbs (equivalently, the sum of their two moieties = half-orbs).
// Source: William Lilly, Christian Astrology (1647), Bk. 1, "Of the Orbes of
// the Planets" — full orbs (in degrees of diameter): Sun 15, Moon 12,
// Mercury 7, Venus 7, Mars 7.5, Jupiter 9, Saturn 9.
// The operative orb for a PAIR = (orbA + orbB) / 2 (see operativeOrb), applied
// to ALL five Ptolemaic aspects alike. Worked examples:
//   Sun-Moon      = (15 + 12) / 2 = 13.5
//   Mercury-Venus = ( 7 +  7) / 2 = 7
//   Saturn-Mars   = ( 9 + 7.5) / 2 = 8.25
export const PLANET_ORB: Record<string, number> = {
  Sun: 15,
  Moon: 12,
  Mercury: 7,
  Venus: 7,
  Mars: 7.5,
  Jupiter: 9,
  Saturn: 9,
};

// Default full orb for bodies Lilly's table does not cover (modern planets,
// Node, Part of Fortune, etc.). Chosen as a conservative small orb so these
// non-classical points do not claim wide aspects; they never carry horary
// significator weight, so this only affects descriptive aspect listings.
export const DEFAULT_PLANET_ORB = 5;
