/*
 * fixedstars.ts — major astrological fixed stars and their contacts to chart
 * points. A fixed star "contacts" a body when it is conjunct (by ecliptic
 * longitude) within a tight orb (default 1°); the classical reading is by
 * conjunction only, to the planets and to the Asc/MC.
 *
 * Star longitudes are tabulated at epoch J2000.0 (ecliptic longitude, degrees
 * 0..360) and precessed to the chart year with the standard linear rate of
 * ~50.29 arcsec/yr (general precession in longitude). This linear approximation
 * is accurate to well under an orb across the centuries of interest.
 *
 * SOURCE: J2000 ecliptic longitudes from the standard astrological literature
 * (e.g. Robson, "The Fixed Stars and Constellations in Astrology", brought to
 * J2000; cross-checked against common ephemeris star catalogues). Values are
 * given to ~0.1° and are review-verified.
 */
import { DEGREES_PER_SIGN, SIGN_COUNT, SIGNS, separation } from "./constants.js";
import type { PlanetPosition } from "./types.js";

/** Classical benefic/malefic tone of a fixed star. */
export type StarTone = "benefic" | "malefic" | "mixed";

export interface FixedStar {
  name: string;
  /** Ecliptic longitude at epoch J2000.0, degrees 0..360. */
  lonJ2000: number;
  /** Planetary nature, e.g. "Mars/Saturn", "Jupiter/Venus". */
  nature: string;
  tone: StarTone;
}

/**
 * ~20 major astrological fixed stars with J2000 ecliptic longitudes (degrees),
 * planetary natures, and classical tone. See SOURCE note above.
 */
export const FIXED_STARS: FixedStar[] = [
  { name: "Algol", lonJ2000: 56.17, nature: "Saturn/Jupiter", tone: "malefic" },
  { name: "Alcyone (Pleiades)", lonJ2000: 59.7, nature: "Moon/Mars", tone: "mixed" },
  { name: "Aldebaran", lonJ2000: 69.7, nature: "Mars", tone: "mixed" },
  { name: "Rigel", lonJ2000: 76.8, nature: "Jupiter/Saturn", tone: "benefic" },
  { name: "Betelgeuse", lonJ2000: 88.7, nature: "Mars/Mercury", tone: "benefic" },
  { name: "Sirius", lonJ2000: 104.0, nature: "Jupiter/Mars", tone: "benefic" },
  { name: "Castor", lonJ2000: 110.2, nature: "Mercury", tone: "mixed" },
  { name: "Pollux", lonJ2000: 113.3, nature: "Mars", tone: "malefic" },
  { name: "Regulus", lonJ2000: 149.8, nature: "Mars/Jupiter", tone: "benefic" },
  { name: "Vindemiatrix", lonJ2000: 189.8, nature: "Saturn/Mercury", tone: "malefic" },
  { name: "Algorab", lonJ2000: 193.4, nature: "Mars/Saturn", tone: "malefic" },
  { name: "Spica", lonJ2000: 203.8, nature: "Venus/Mars", tone: "benefic" },
  { name: "Arcturus", lonJ2000: 204.2, nature: "Mars/Jupiter", tone: "benefic" },
  { name: "Antares", lonJ2000: 249.8, nature: "Mars/Jupiter", tone: "malefic" },
  { name: "Vega", lonJ2000: 285.3, nature: "Venus/Mercury", tone: "benefic" },
  { name: "Altair", lonJ2000: 301.8, nature: "Mars/Jupiter", tone: "mixed" },
  { name: "Fomalhaut", lonJ2000: 333.9, nature: "Venus/Mercury", tone: "mixed" },
  { name: "Markab", lonJ2000: 353.5, nature: "Mars/Mercury", tone: "malefic" },
  { name: "Scheat", lonJ2000: 359.4, nature: "Mars/Mercury", tone: "malefic" },
  { name: "Achernar", lonJ2000: 345.3, nature: "Jupiter", tone: "benefic" },
];

/** General precession in longitude, arcseconds per year (linear approximation). */
const PRECESSION_ARCSEC_PER_YEAR = 50.29;

function norm360(x: number): number {
  return ((x % 360) + 360) % 360;
}

/**
 * Precess a J2000 ecliptic longitude to the given year with the standard linear
 * approximation: lon(year) = (lonJ2000 + 50.29"/yr * (year - 2000) / 3600) mod 360.
 */
export function precessedLongitude(lonJ2000: number, year: number): number {
  const driftDeg = (PRECESSION_ARCSEC_PER_YEAR * (year - 2000)) / 3600;
  return norm360(lonJ2000 + driftDeg);
}

export interface StarContact {
  star: string;
  /** The contacted body: a planet name, or "Ascendant" / "MC". */
  body: string;
  /** Precessed ecliptic longitude of the star at the chart year. */
  longitude: number;
  /** Orb (degrees) of the conjunction. */
  orb: number;
  tone: StarTone;
  nature: string;
}

/**
 * Conjunctions of any planet OR the Asc/MC to a precessed fixed-star longitude,
 * within `orb` degrees (default 1°). Each star longitude is precessed to `year`
 * before testing. Sorted by tightest orb.
 */
export function starContacts(
  planets: PlanetPosition[],
  angles: { ascendant: number; mc: number },
  year: number,
  orb = 1,
): StarContact[] {
  const points: Array<{ name: string; lon: number }> = [
    ...planets.map((p) => ({ name: p.name, lon: p.longitude })),
    { name: "Ascendant", lon: angles.ascendant },
    { name: "MC", lon: angles.mc },
  ];
  const out: StarContact[] = [];
  for (const star of FIXED_STARS) {
    const starLon = precessedLongitude(star.lonJ2000, year);
    for (const pt of points) {
      const o = separation(pt.lon, starLon);
      if (o > orb) continue;
      out.push({
        star: star.name,
        body: pt.name,
        longitude: starLon,
        orb: o,
        tone: star.tone,
        nature: star.nature,
      });
    }
  }
  out.sort((a, b) => a.orb - b.orb);
  return out;
}

/** Sign + degree-in-sign of a longitude, for display convenience. */
export function signOfLongitude(longitude: number): { sign: string; degInSign: number } {
  const lon = norm360(longitude);
  const si = Math.floor(lon / DEGREES_PER_SIGN) % SIGN_COUNT;
  return { sign: SIGNS[si], degInSign: lon - si * DEGREES_PER_SIGN };
}
