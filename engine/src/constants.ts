import sweph from "sweph";

// Computation flags: Moshier analytical ephemeris (no data files), with speed.
export const CALC_FLAGS =
  sweph.constants.SEFLG_MOSEPH | sweph.constants.SEFLG_SPEED;
export const HOUSE_FLAGS = sweph.constants.SEFLG_MOSEPH;

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
  orb: number;
}

export const ASPECTS: AspectDef[] = [
  { name: "conjunction", angle: 0, orb: 8 },
  { name: "sextile", angle: 60, orb: 4 },
  { name: "square", angle: 90, orb: 7 },
  { name: "trine", angle: 120, orb: 8 },
  { name: "opposition", angle: 180, orb: 8 },
];
