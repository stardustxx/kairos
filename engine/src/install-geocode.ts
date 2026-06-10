/*
 * install-geocode.ts — download the GeoNames cities15000 gazetteer so Kairos can
 * resolve a city name to authoritative lat/lon + IANA timezone fully OFFLINE.
 *
 *   pnpm geocode:install            # downloads into ~/.kairos/geonames
 *   pnpm geocode:install --force    # re-download even if already cached
 *
 * cities15000 covers every populated place with population ≥ 15,000. The dataset
 * ships as a ZIP; Node has no native unzip, so we shell out to the system
 * "unzip". If it is missing, we print a clear instruction and exit non-zero.
 *
 * The cache root follows the same KAIROS_HOME convention as memory.ts, under a
 * geonames/ subdir. Idempotent: an existing cities15000.txt is reused unless
 * --force is passed.
 *
 * The actual install lives in `installGazetteer` so the CLI (below) and the MCP
 * `geocode_install` tool share one code path. The download is strictly
 * user-initiated in both: the CLI is a command the user types, and the MCP tool
 * description requires explicit consent before the model calls it.
 *
 * Data: GeoNames (https://www.geonames.org/), Creative Commons Attribution 4.0.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { isMainModule } from "./run-guard.js";

const ZIP_URL = "https://download.geonames.org/export/dump/cities15000.zip";
const ZIP_NAME = "cities15000.zip";
const TXT_NAME = "cities15000.txt";

/** Memory's home convention, read at call time so KAIROS_HOME can override. */
function kairosHome(): string {
  return process.env.KAIROS_HOME || join(homedir(), ".kairos");
}

/** Where the extracted gazetteer lives: <home>/geonames/cities15000.txt. */
function geonamesDir(): string {
  return join(kairosHome(), "geonames");
}

export function gazetteerPath(): string {
  return join(geonamesDir(), TXT_NAME);
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** True if the system `unzip` command is available on PATH. */
function hasUnzip(): boolean {
  const probe = spawnSync("unzip", ["-v"], { stdio: "ignore" });
  return probe.status === 0 || probe.error == null;
}

/** One TSV row per city in the gazetteer; ignores a trailing blank line. */
function countCities(txtPath: string): number {
  let count = 0;
  for (const line of readFileSync(txtPath, "utf8").split("\n")) {
    if (line.trim() !== "") count += 1;
  }
  return count;
}

/** What an install (or an already-installed check) reports. */
export interface GazetteerInstallResult {
  installed: true;
  alreadyInstalled: boolean;
  path: string;
  cities: number;
}

/**
 * Install the gazetteer (shared by the CLI and the MCP `geocode_install` tool).
 * Idempotent: when cities15000.txt is already present and non-empty it returns
 * immediately with `alreadyInstalled: true` and performs NO network access;
 * pass `force` to re-download. Throws on any failure (missing unzip, HTTP
 * error, extraction failure) — callers decide how to surface it. `log`
 * receives human-readable progress lines (the CLI prints them; the MCP tool
 * stays silent so stdout never sees them).
 */
export async function installGazetteer(
  options: { force?: boolean; log?: (line: string) => void } = {},
): Promise<GazetteerInstallResult> {
  const log = options.log ?? (() => {});
  const dir = geonamesDir();
  const txtDest = gazetteerPath();

  if (!options.force && existsSync(txtDest) && statSync(txtDest).size > 0) {
    return {
      installed: true,
      alreadyInstalled: true,
      path: txtDest,
      cities: countCities(txtDest),
    };
  }

  if (!hasUnzip()) {
    throw new Error(
      "the system `unzip` command was not found, but the GeoNames dataset is a ZIP.\n" +
        "Install it and re-run the gazetteer install:\n" +
        "  • macOS:  unzip ships with the OS (check your PATH)\n" +
        "  • Debian/Ubuntu:  sudo apt-get install unzip\n" +
        "  • Fedora/RHEL:    sudo dnf install unzip\n" +
        "  • Alpine:         apk add unzip",
    );
  }

  mkdirSync(dir, { recursive: true });
  const zipDest = join(dir, ZIP_NAME);

  log(`Downloading GeoNames cities15000 into ${dir}`);
  const res = await fetch(ZIP_URL);
  if (!res.ok) {
    throw new Error(`could not download ${ZIP_URL} (HTTP ${res.status})`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(zipDest, buf);
  log(`  • ${ZIP_NAME} ok (${fmtBytes(buf.length)})`);

  // -o overwrite, -j junk paths (flat), -d into dir. Restrict to the .txt we use.
  const unzip = spawnSync("unzip", ["-o", "-j", zipDest, TXT_NAME, "-d", dir], {
    stdio: ["ignore", "ignore", "pipe"],
  });
  if (unzip.status !== 0) {
    throw new Error(`unzip failed: ${unzip.stderr?.toString().trim() || `exit ${unzip.status}`}`);
  }
  if (!existsSync(txtDest) || statSync(txtDest).size === 0) {
    throw new Error(`extraction did not produce ${txtDest}`);
  }
  log(`  • extracted ${TXT_NAME} (${fmtBytes(statSync(txtDest).size)})`);
  // The zip is only an intermediate; only the extracted .txt is ever read.
  rmSync(zipDest, { force: true });

  return {
    installed: true,
    alreadyInstalled: false,
    path: txtDest,
    cities: countCities(txtDest),
  };
}

/**
 * CLI entrypoint. `args` is the post-script argv
 * (i.e. `process.argv.slice(2)`); pass `--force` to re-download.
 */
export async function main(args: string[]): Promise<void> {
  const result = await installGazetteer({
    force: args.includes("--force"),
    log: (line) => console.log(line),
  });

  if (result.alreadyInstalled) {
    console.log(
      `cities15000.txt already present (${result.cities} cities) at\n  ${result.path}\n` +
        "Nothing to do — pass --force to re-download.",
    );
    return;
  }

  console.log(
    `\nDone. ${result.cities} cities cached at\n  ${result.path}\n` +
      "Query a city with:\n  pnpm -s geocode 'Tokyo'",
  );
}

// Run the installer only when invoked as a script — geocode-cli.ts imports the
// path helpers from this module, and importing must not trigger a download.
if (isMainModule(import.meta.url)) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  });
}
