/*
 * geocode.ts — pure parser + search over the cached GeoNames gazetteer.
 *
 * Turns a city name into authoritative coordinates + IANA timezone so charts
 * never depend on hand-entered lat/lon. The data is the GeoNames cities15000
 * gazetteer (population ≥ 15,000), installed offline by install-geocode.ts.
 *
 * This module is PURE: searchCities operates over passed-in TSV text, so it is
 * unit-testable with an inline fixture and never touches the filesystem or the
 * network. Coordinates are read verbatim from the authoritative dataset — never
 * invented or interpolated.
 */

/** One resolved city from the GeoNames gazetteer. */
export interface GeoCity {
  name: string;
  asciiname: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
  population: number;
}

// GeoNames cities15000.txt is tab-separated with these 0-indexed columns
// (https://download.geonames.org/export/dump/ — see "geoname" table layout).
const COL_NAME = 1;
const COL_ASCIINAME = 2;
const COL_LATITUDE = 4;
const COL_LONGITUDE = 5;
const COL_COUNTRY = 8;
const COL_POPULATION = 14;
const COL_TIMEZONE = 17;
// Highest column we index, so we can reject truncated/garbled lines early.
const MIN_FIELDS = COL_TIMEZONE + 1;

/**
 * Parse a single GeoNames TSV line into a GeoCity, or null if the line is blank,
 * truncated, or has non-numeric coordinates/population (a corrupt row is skipped
 * rather than poisoning a search). Latitude/longitude are taken verbatim.
 */
export function parseGeonamesLine(line: string): GeoCity | null {
  const trimmed = line.replace(/\r$/, "");
  if (!trimmed.trim()) return null;
  const f = trimmed.split("\t");
  if (f.length < MIN_FIELDS) return null;

  const latitude = Number.parseFloat(f[COL_LATITUDE]);
  const longitude = Number.parseFloat(f[COL_LONGITUDE]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const name = f[COL_NAME];
  const timezone = f[COL_TIMEZONE];
  if (!name || !timezone) return null;

  // Population may be blank for some rows; treat absent/garbled as 0.
  const populationRaw = Number.parseInt(f[COL_POPULATION], 10);
  const population = Number.isFinite(populationRaw) ? populationRaw : 0;

  return {
    name,
    asciiname: f[COL_ASCIINAME] || name,
    country: f[COL_COUNTRY],
    latitude,
    longitude,
    timezone,
    population,
  };
}

/** Match quality, lower is better: 0 exact, 1 startsWith, 2 includes. */
function matchRank(city: GeoCity, q: string): number {
  const name = city.name.toLowerCase();
  const ascii = city.asciiname.toLowerCase();
  if (name === q || ascii === q) return 0;
  if (name.startsWith(q) || ascii.startsWith(q)) return 1;
  if (name.includes(q) || ascii.includes(q)) return 2;
  return Number.POSITIVE_INFINITY;
}

/**
 * Search the gazetteer TSV for cities matching `query`, case-insensitively on
 * name/asciiname. Ranks exact matches first, then startsWith, then includes;
 * within a tier, higher population wins (so "London" → London, GB before a
 * hamlet). Returns the top `limit` as GeoCity[]; an empty/no-match query → [].
 */
export function searchCities(query: string, tsvText: string, limit = 5): GeoCity[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const matches: { city: GeoCity; rank: number }[] = [];
  for (const line of tsvText.split("\n")) {
    const city = parseGeonamesLine(line);
    if (!city) continue;
    const rank = matchRank(city, q);
    if (rank === Number.POSITIVE_INFINITY) continue;
    matches.push({ city, rank });
  }

  matches.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank; // better match tier first
    return b.city.population - a.city.population; // then most populous
  });

  return matches.slice(0, Math.max(0, limit)).map((m) => m.city);
}
