/*
 * install-ephe.ts — download the Swiss Ephemeris .se1 data files needed to run
 * Kairos in full SWIEPH precision (sub-arcsecond), instead of the default
 * Moshier analytical ephemeris.
 *
 *   pnpm ephe:install            # downloads into ./ephe
 *   pnpm ephe:install /some/dir  # downloads into a custom directory
 *
 * Then run any compute in SWIEPH mode:
 *   KAIROS_SWIEPH=1 KAIROS_EPHE_PATH=./ephe pnpm -s compute '{...}'
 *
 * The files cover 1800–2399 CE (planets + Moon), which spans every modern-era
 * natal/horary/electional chart. They are redistributed under the Swiss
 * Ephemeris license; see https://github.com/aloistr/swisseph for terms.
 */
import { mkdir, stat, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

const BASE = "https://raw.githubusercontent.com/aloistr/swisseph/master/ephe/";
// Planets (sepl) + Moon (semo) for 1800–2399. The mean lunar node is computed
// analytically and needs no file, so these two cover all bodies Kairos uses.
const FILES = ["sepl_18.se1", "semo_18.se1"];

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function alreadyPresent(path: string): Promise<number | null> {
  try {
    const s = await stat(path);
    return s.size > 0 ? s.size : null;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const dirArg = process.argv[2] ?? "ephe";
  const dir = isAbsolute(dirArg) ? dirArg : resolve(process.cwd(), dirArg);
  await mkdir(dir, { recursive: true });

  console.log(`Installing Swiss Ephemeris data into ${dir}\n`);
  let downloaded = 0;

  for (const name of FILES) {
    const dest = join(dir, name);
    const existing = await alreadyPresent(dest);
    if (existing) {
      console.log(`  • ${name} — already present (${fmtBytes(existing)}), skipping`);
      continue;
    }
    process.stdout.write(`  • ${name} … `);
    const res = await fetch(BASE + name);
    if (!res.ok) {
      console.log(`FAILED (HTTP ${res.status})`);
      console.error(`\nCould not download ${name} from ${BASE}${name}`);
      process.exit(1);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(dest, buf);
    downloaded++;
    console.log(`ok (${fmtBytes(buf.length)})`);
  }

  console.log(
    `\nDone (${downloaded} downloaded). Run in SWIEPH precision with:\n` +
      `  KAIROS_SWIEPH=1 KAIROS_EPHE_PATH=${dir} pnpm -s compute '{...}'`,
  );
}

main().catch((err) => {
  console.error(`Error: ${(err as Error).message}`);
  process.exit(1);
});
