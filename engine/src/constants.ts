import sweph from "sweph";
import { resolveCalcFlags, resolveHouseFlags } from "./ephemeris.js";

// Computation flags, resolved once at module load from the environment.
// Defaults to Moshier analytical ephemeris (no data files), with speed.
// Set KAIROS_SWIEPH=1 + KAIROS_EPHE_PATH=<dir> to opt into full SWIEPH
// precision; see engine/src/ephemeris.ts.
export const CALC_FLAGS = resolveCalcFlags();
export const HOUSE_FLAGS = resolveHouseFlags();

export const DEGREES_PER_SIGN = 30;
export const SIGN_COUNT = 12;

export const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
] as const;
export type Sign = (typeof SIGNS)[number];

export interface PlanetDef {
  name: string;
  id: number;
  classical: boolean; // one of the 7 traditional planets (used for horary rulership)
}

export const PLANETS: PlanetDef[] = [
  { name: "Sun", id: sweph.constants.SE_SUN, classical: true },
  { name: "Moon", id: sweph.constants.SE_MOON, classical: true },
  { name: "Mercury", id: sweph.constants.SE_MERCURY, classical: true },
  { name: "Venus", id: sweph.constants.SE_VENUS, classical: true },
  { name: "Mars", id: sweph.constants.SE_MARS, classical: true },
  { name: "Jupiter", id: sweph.constants.SE_JUPITER, classical: true },
  { name: "Saturn", id: sweph.constants.SE_SATURN, classical: true },
  { name: "Uranus", id: sweph.constants.SE_URANUS, classical: false },
  { name: "Neptune", id: sweph.constants.SE_NEPTUNE, classical: false },
  { name: "Pluto", id: sweph.constants.SE_PLUTO, classical: false },
  { name: "Node", id: sweph.constants.SE_MEAN_NODE, classical: false },
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
