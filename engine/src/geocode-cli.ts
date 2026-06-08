/*
 * geocode-cli.ts — resolve a city name to authoritative lat/lon + timezone.
 *
 * Prints ONLY machine-readable JSON to stdout (run with pnpm -s so there is no
 * banner). Reads the offline gazetteer cached by `pnpm geocode:install`.
 *
 *   pnpm -s geocode 'Tokyo'
 *   pnpm -s geocode 'San Francisco'
 *
 * Output is a GeoCity[] (top matches, most populous first). If the dataset is
 * not installed, it errors to stderr and exits 1.
 */
import { existsSync, readFileSync } from "node:fs";
import { type GeoCity, searchCities } from "./geocode.js";
import { gazetteerPath } from "./install-geocode.js";

function emit(value: unknown): void {
  process.stdout.write(JSON.stringify(value));
}

function main(): void {
  const query = process.argv.slice(2).join(" ").trim();
  if (!query) {
    process.stderr.write("Usage: pnpm -s geocode '<city>'");
    process.exit(1);
  }

  const path = gazetteerPath();
  if (!existsSync(path)) {
    throw new Error("gazetteer not installed — run `pnpm geocode:install` first");
  }

  const tsv = readFileSync(path, "utf8");
  emit(searchCities(query, tsv) satisfies GeoCity[]);
}

// Executed only when run as a script (not when imported by tests).
if (process.argv[1]?.endsWith("geocode-cli.ts")) {
  try {
    main();
  } catch (err) {
    process.stderr.write(JSON.stringify({ error: (err as Error).message }));
    process.exit(1);
  }
}
