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
 * Data: GeoNames (https://www.geonames.org/), Creative Commons Attribution 4.0.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
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

/**
 * Installer entrypoint. `args` is the post-script argv
 * (i.e. `process.argv.slice(2)`); pass `--force` to re-download.
 */
export async function main(args: string[]): Promise<void> {
  const force = args.includes("--force");
  const dir = geonamesDir();
  const txtDest = gazetteerPath();

  if (!force && existsSync(txtDest) && statSync(txtDest).size > 0) {
    console.log(
      `cities15000.txt already present (${fmtBytes(statSync(txtDest).size)}) at\n  ${txtDest}\n` +
        "Nothing to do — pass --force to re-download.",
    );
    return;
  }

  if (!hasUnzip()) {
    console.error(
      "The system `unzip` command was not found, but the GeoNames dataset is a ZIP.\n" +
        "Install it and re-run `pnpm geocode:install`:\n" +
        "  • macOS:  unzip ships with the OS (check your PATH)\n" +
        "  • Debian/Ubuntu:  sudo apt-get install unzip\n" +
        "  • Fedora/RHEL:    sudo dnf install unzip\n" +
        "  • Alpine:         apk add unzip",
    );
    process.exit(1);
  }

  mkdirSync(dir, { recursive: true });
  const zipDest = join(dir, ZIP_NAME);

  console.log(`Downloading GeoNames cities15000 into ${dir}\n`);
  process.stdout.write(`  • ${ZIP_NAME} … `);
  const res = await fetch(ZIP_URL);
  if (!res.ok) {
    console.log(`FAILED (HTTP ${res.status})`);
    console.error(`\nCould not download ${ZIP_URL}`);
    process.exit(1);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(zipDest, buf);
  console.log(`ok (${fmtBytes(buf.length)})`);

  process.stdout.write(`  • extracting ${TXT_NAME} … `);
  // -o overwrite, -j junk paths (flat), -d into dir. Restrict to the .txt we use.
  const unzip = spawnSync("unzip", ["-o", "-j", zipDest, TXT_NAME, "-d", dir], {
    stdio: ["ignore", "ignore", "pipe"],
  });
  if (unzip.status !== 0) {
    console.log("FAILED");
    console.error(`\nunzip failed: ${unzip.stderr?.toString().trim() || `exit ${unzip.status}`}`);
    process.exit(1);
  }
  if (!existsSync(txtDest) || statSync(txtDest).size === 0) {
    console.log("FAILED");
    console.error(`\nExtraction did not produce ${txtDest}`);
    process.exit(1);
  }
  console.log(`ok (${fmtBytes(statSync(txtDest).size)})`);

  console.log(
    `\nDone. Cached at\n  ${txtDest}\n` +
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
