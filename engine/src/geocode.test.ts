import { describe, expect, it } from "vitest";
import { type GeoCity, parseGeonamesLine, searchCities } from "./geocode.js";

/**
 * Inline GeoNames-shaped fixture (tab-separated, real column layout). Coordinates
 * here are illustrative and only need internal consistency for the search/ranking
 * assertions — these tests never hit the network or the cached file.
 *
 * Columns (0-indexed): 0 id, 1 name, 2 asciiname, 3 alternates, 4 lat, 5 lon,
 * 6 fclass, 7 fcode, 8 country, 9 cc2, 10-13 admin, 14 population, 15 elevation,
 * 16 dem, 17 timezone, 18 modified.
 */
function row(
  id: string,
  name: string,
  lat: string,
  lon: string,
  country: string,
  population: string,
  timezone: string,
  asciiname = name,
): string {
  return [
    id,
    name,
    asciiname,
    "",
    lat,
    lon,
    "P",
    "PPL",
    country,
    "",
    "",
    "",
    "",
    "",
    population,
    "",
    "0",
    timezone,
    "2020-01-01",
  ].join("\t");
}

const FIXTURE = [
  row("1850147", "Tokyo", "35.6895", "139.69171", "JP", "8336599", "Asia/Tokyo"),
  row("2643743", "London", "51.50853", "-0.12574", "GB", "8961989", "Europe/London"),
  // Two Springfields with different populations — population breaks the tie.
  row("4951788", "Springfield", "42.10148", "-72.58981", "US", "153060", "America/New_York"),
  row("4409896", "Springfield", "37.21533", "-93.29824", "US", "169176", "America/Chicago"),
  // A "Tokyo"-containing name to exercise exact-vs-includes ordering.
  row("9999999", "West Tokyo", "35.7", "139.5", "JP", "300000", "Asia/Tokyo"),
].join("\n");

describe("parseGeonamesLine", () => {
  it("parses name, coordinates, country, population, and timezone", () => {
    const line = row("1850147", "Tokyo", "35.6895", "139.69171", "JP", "8336599", "Asia/Tokyo");
    const city = parseGeonamesLine(line) as GeoCity;
    expect(city).not.toBeNull();
    expect(city.name).toBe("Tokyo");
    expect(city.asciiname).toBe("Tokyo");
    expect(city.country).toBe("JP");
    expect(city.latitude).toBeCloseTo(35.6895, 4);
    expect(city.longitude).toBeCloseTo(139.69171, 4);
    expect(city.population).toBe(8336599);
    expect(city.timezone).toBe("Asia/Tokyo");
  });

  it("preserves a distinct asciiname for accented place names", () => {
    const line = row("3117735", "Málaga", "36.72016", "-4.42034", "ES", "568305", "Europe/Madrid", "Malaga");
    const city = parseGeonamesLine(line) as GeoCity;
    expect(city.name).toBe("Málaga");
    expect(city.asciiname).toBe("Malaga");
  });

  it("returns null on blank, truncated, or non-numeric-coordinate lines", () => {
    expect(parseGeonamesLine("")).toBeNull();
    expect(parseGeonamesLine("   ")).toBeNull();
    expect(parseGeonamesLine("123\tNowhere\tNowhere")).toBeNull(); // too few fields
    const badLat = row("1", "Nowhere", "NaN", "10", "US", "100", "America/New_York");
    expect(parseGeonamesLine(badLat)).toBeNull();
  });
});

describe("searchCities", () => {
  it("returns an exact name match over partials", () => {
    const results = searchCities("Tokyo", FIXTURE);
    expect(results[0].name).toBe("Tokyo"); // exact beats "West Tokyo" (includes)
    expect(results[0].timezone).toBe("Asia/Tokyo");
    expect(results[0].latitude).toBeCloseTo(35.6895, 4);
  });

  it("breaks ties within a match tier by population (desc)", () => {
    const results = searchCities("Springfield", FIXTURE);
    expect(results).toHaveLength(2);
    expect(results[0].population).toBe(169176); // Missouri, more populous
    expect(results[0].timezone).toBe("America/Chicago");
    expect(results[1].population).toBe(153060);
    expect(results[1].timezone).toBe("America/New_York");
  });

  it("matches case-insensitively on name", () => {
    const results = searchCities("london", FIXTURE);
    expect(results[0].name).toBe("London");
    expect(results[0].country).toBe("GB");
  });

  it("honors the limit", () => {
    const results = searchCities("o", FIXTURE, 2);
    expect(results).toHaveLength(2);
  });

  it("returns [] when nothing matches", () => {
    expect(searchCities("Atlantis", FIXTURE)).toEqual([]);
  });

  it("returns [] for an empty query", () => {
    expect(searchCities("   ", FIXTURE)).toEqual([]);
  });
});
