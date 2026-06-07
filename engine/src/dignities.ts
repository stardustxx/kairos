/*
 * dignities.ts — classical essential dignities (Lilly's point system) and
 * reception. Given a planet's ecliptic longitude and the chart's sect, report
 * which of the five essential dignities it has (domicile, exaltation,
 * triplicity, term, face) and the debilities (detriment, fall, peregrine), with
 * a net score.
 *
 * Tables follow the standard traditional set: Ptolemaic exaltations, Dorothean
 * triplicities (day/night rulers), Egyptian terms (bounds), and Chaldean faces
 * (decans).
 */
import { DEGREES_PER_SIGN, SIGN_COUNT, SIGN_RULER, SIGNS } from "./constants.js";
import type { PlanetDignities, Reception } from "./types.js";

// Lilly point values.
const POINTS = { domicile: 5, exaltation: 4, triplicity: 3, term: 2, face: 1, detriment: -5, fall: -4, peregrine: -5 };

// Exaltation lord by sign index (Aries..Pisces); null where no planet exalts.
const EXALTATION: (string | null)[] = [
  "Sun",     // Aries
  "Moon",    // Taurus
  null,      // Gemini
  "Jupiter", // Cancer
  null,      // Leo
  "Mercury", // Virgo
  "Saturn",  // Libra
  null,      // Scorpio
  null,      // Sagittarius
  "Mars",    // Capricorn
  null,      // Aquarius
  "Venus",   // Pisces
];

// Element index 0=Fire,1=Earth,2=Air,3=Water -> { day, night } triplicity ruler.
const TRIPLICITY: { day: string; night: string }[] = [
  { day: "Sun", night: "Jupiter" },   // Fire (Aries/Leo/Sagittarius)
  { day: "Venus", night: "Moon" },    // Earth (Taurus/Virgo/Capricorn)
  { day: "Saturn", night: "Mercury" },// Air (Gemini/Libra/Aquarius)
  { day: "Mars", night: "Mars" },     // Water (Cancer/Scorpio/Pisces)
];

// Egyptian terms (bounds): per sign, ordered segments [upperBoundDeg, ruler].
const TERMS: [number, string][][] = [
  [[6, "Jupiter"], [12, "Venus"], [20, "Mercury"], [25, "Mars"], [30, "Saturn"]],   // Aries
  [[8, "Venus"], [15, "Mercury"], [22, "Jupiter"], [26, "Saturn"], [30, "Mars"]],   // Taurus
  [[6, "Mercury"], [12, "Jupiter"], [17, "Venus"], [24, "Mars"], [30, "Saturn"]],   // Gemini
  [[7, "Mars"], [13, "Venus"], [19, "Mercury"], [26, "Jupiter"], [30, "Saturn"]],   // Cancer
  [[6, "Jupiter"], [11, "Venus"], [18, "Saturn"], [24, "Mercury"], [30, "Mars"]],   // Leo
  [[7, "Mercury"], [17, "Venus"], [21, "Jupiter"], [28, "Mars"], [30, "Saturn"]],   // Virgo
  [[6, "Saturn"], [14, "Mercury"], [21, "Jupiter"], [28, "Venus"], [30, "Mars"]],   // Libra
  [[7, "Mars"], [11, "Venus"], [19, "Mercury"], [24, "Jupiter"], [30, "Saturn"]],   // Scorpio
  [[12, "Jupiter"], [17, "Venus"], [21, "Mercury"], [26, "Saturn"], [30, "Mars"]],  // Sagittarius
  [[7, "Venus"], [14, "Mercury"], [22, "Jupiter"], [26, "Mars"], [30, "Saturn"]],   // Capricorn
  [[7, "Saturn"], [13, "Mercury"], [20, "Venus"], [25, "Jupiter"], [30, "Mars"]],   // Aquarius
  [[12, "Venus"], [16, "Jupiter"], [19, "Mercury"], [28, "Mars"], [30, "Saturn"]],  // Pisces
];

// Faces (decans): per sign, 3 rulers (0-10, 10-20, 20-30) in Chaldean order.
const FACES: string[][] = [
  ["Mars", "Sun", "Venus"],         // Aries
  ["Mercury", "Moon", "Saturn"],    // Taurus
  ["Jupiter", "Mars", "Sun"],       // Gemini
  ["Venus", "Mercury", "Moon"],     // Cancer
  ["Saturn", "Jupiter", "Mars"],    // Leo
  ["Sun", "Venus", "Mercury"],      // Virgo
  ["Moon", "Saturn", "Jupiter"],    // Libra
  ["Mars", "Sun", "Venus"],         // Scorpio
  ["Mercury", "Moon", "Saturn"],    // Sagittarius
  ["Jupiter", "Mars", "Sun"],       // Capricorn
  ["Venus", "Mercury", "Moon"],     // Aquarius
  ["Saturn", "Jupiter", "Mars"],    // Pisces
];

function signIndexOf(longitude: number): number {
  return Math.floor((((longitude % 360) + 360) % 360) / DEGREES_PER_SIGN) % SIGN_COUNT;
}
function degInSignOf(longitude: number): number {
  return (((longitude % 360) + 360) % 360) - signIndexOf(longitude) * DEGREES_PER_SIGN;
}

function termRuler(signIndex: number, deg: number): string {
  for (const [upper, ruler] of TERMS[signIndex]) if (deg < upper) return ruler;
  return TERMS[signIndex][TERMS[signIndex].length - 1][1];
}
function faceRuler(signIndex: number, deg: number): string {
  return FACES[signIndex][Math.min(2, Math.floor(deg / 10))];
}

/** The five essential-dignity lords at a given ecliptic longitude, for the given
 *  sect. Each field names the single planet holding that dignity at the degree
 *  (exaltation may be null where no planet exalts). Exposes the dignity tables
 *  to consumers (e.g. the almuten computation) without duplicating them. */
export interface DignityLords {
  domicile: string;
  exaltation: string | null;
  triplicity: string;
  term: string;
  face: string;
}

/** Resolve the domicile/exaltation/triplicity/term/face lords at `longitude`
 *  (triplicity by `sect`). Reuses the same tables as computeDignities. */
export function dignityLordsAtDegree(longitude: number, sect: "day" | "night"): DignityLords {
  const si = signIndexOf(longitude);
  const deg = degInSignOf(longitude);
  const element = si % 4; // 0 Fire,1 Earth,2 Air,3 Water (Aries..Pisces cycles)
  return {
    domicile: SIGN_RULER[si],
    exaltation: EXALTATION[si],
    triplicity: TRIPLICITY[element][sect],
    term: termRuler(si, deg),
    face: faceRuler(si, deg),
  };
}

/**
 * Compute the essential dignity state of `planet` at `longitude` for a chart of
 * the given sect ("day"/"night"). The Sun and Moon never count as their own
 * triplicity participant beyond the day/night rulers used here.
 */
export function computeDignities(
  planet: string,
  longitude: number,
  sect: "day" | "night",
): PlanetDignities {
  const si = signIndexOf(longitude);
  const deg = degInSignOf(longitude);
  const labels: string[] = [];

  const domicile = SIGN_RULER[si] === planet;
  const exaltation = EXALTATION[si] === planet;
  const element = si % 4; // 0 Fire,1 Earth,2 Air,3 Water (Aries..Pisces cycles)
  const triplicity = TRIPLICITY[element][sect] === planet;
  const term = termRuler(si, deg) === planet;
  const face = faceRuler(si, deg) === planet;

  // Debilities: detriment = opposite of rulership; fall = opposite of exaltation.
  const detriment = SIGN_RULER[(si + 6) % 12] === planet;
  const fall = EXALTATION[(si + 6) % 12] === planet;

  const anyPositive = domicile || exaltation || triplicity || term || face;
  const peregrine = !anyPositive && !detriment && !fall;

  let score = 0;
  if (domicile) { score += POINTS.domicile; labels.push(`domicile in ${SIGNS[si]} (+5)`); }
  if (exaltation) { score += POINTS.exaltation; labels.push(`exaltation in ${SIGNS[si]} (+4)`); }
  if (triplicity) { score += POINTS.triplicity; labels.push(`${sect} triplicity ruler (+3)`); }
  if (term) { score += POINTS.term; labels.push(`term ruler (+2)`); }
  if (face) { score += POINTS.face; labels.push(`face ruler (+1)`); }
  if (detriment) { score += POINTS.detriment; labels.push(`detriment in ${SIGNS[si]} (-5)`); }
  if (fall) { score += POINTS.fall; labels.push(`fall in ${SIGNS[si]} (-4)`); }
  if (peregrine) { score += POINTS.peregrine; labels.push(`peregrine — no essential dignity (-5)`); }

  return { domicile, exaltation, triplicity, term, face, detriment, fall, peregrine, score, labels };
}

/** Does `host` planet dignify whatever sits at `longitude`, by domicile or
 *  exaltation? Returns the dignity name or null. (Strong forms of reception.) */
function receivesBy(host: string, longitude: number): string | null {
  const si = signIndexOf(longitude);
  if (SIGN_RULER[si] === host) return "domicile";
  if (EXALTATION[si] === host) return "exaltation";
  return null;
}

/**
 * Reception between two planets by domicile/exaltation. Mutual reception (each
 * in a sign the other rules/exalts) is a classical perfecting aid.
 */
export function receptionBetween(
  planetA: string,
  lonA: number,
  planetB: string,
  lonB: number,
): Reception | null {
  // A receives B if B sits in a sign A rules/exalts (and vice versa).
  const aReceivesBBy = receivesBy(planetA, lonB);
  const bReceivesABy = receivesBy(planetB, lonA);
  if (!aReceivesBBy && !bReceivesABy) return null;
  return {
    kind: aReceivesBBy && bReceivesABy ? "mutual" : "one-way",
    aReceivesBBy,
    bReceivesABy,
  };
}
