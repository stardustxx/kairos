/*
 * check-doc-claims.mjs — verify that documentation suite-size claims match reality.
 *
 * Scans README.md and docs/launch/**\/*.md for test-count and test-file-count
 * claims, then compares them to the live counts produced by `vitest list`.
 *
 * Exit 0 quietly when every claim matches.
 * Exit 1 with a clear per-claim error when any claim is wrong.
 *
 * MATCHER DESIGN (deliberately conservative):
 *   - Test-count:  matches "<N> tests" where N >= 100.
 *     Lower bound avoids false positives from sentences like "3 tests" or
 *     "unit tests".  The pattern is: /\b(\d{3,})\s+tests\b/g
 *   - File-count:  matches "<N> files" only when the word "tests" appears
 *     within ~60 chars on the same line, on EITHER side — both orderings occur
 *     in these docs ("37 files / 321 tests" and "321 tests pass (37 files)").
 *     No minimum on file count (files are always adjacent to a tests claim).
 *
 * COUNTING:
 *   `pnpm exec vitest list` emits one line per test on stdout, format:
 *     path/to/file.test.ts > Suite name > test name
 *   Actual test count  = number of non-empty output lines.
 *   Actual file count  = number of distinct leading path segments (first token
 *                        before the first " > ").
 *   If `vitest list` exits non-zero we fall back to `vitest run --reporter=json`
 *   and parse the JSON summary.
 */

import { execSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

// ---------------------------------------------------------------------------
// 1. Count tests from vitest list
// ---------------------------------------------------------------------------

function getActualCounts() {
  let stdout;
  try {
    stdout = execSync("pnpm exec vitest list", {
      cwd: root,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch {
    // vitest list failed — fall back to vitest run --reporter=json
    let jsonOut;
    try {
      jsonOut = execSync("pnpm exec vitest run --reporter=json", {
        cwd: root,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (err2) {
      // vitest run writes JSON to stdout even on failure; try to parse it
      jsonOut = err2.stdout ?? "";
    }
    // Parse JSON summary: { numTotalTests, numTotalTestSuites }
    let parsed;
    try {
      parsed = JSON.parse(jsonOut.trim());
    } catch {
      console.error(
        "check-doc-claims: could not count tests via vitest list or vitest run --reporter=json",
      );
      process.exit(2);
    }
    return {
      tests: parsed.numTotalTests,
      files: parsed.numTotalTestSuites,
      source: "vitest run --reporter=json",
    };
  }

  const lines = stdout.split("\n").filter((l) => l.trim() !== "");
  const tests = lines.length;
  const fileSet = new Set();
  for (const line of lines) {
    const sep = line.indexOf(" > ");
    if (sep !== -1) fileSet.add(line.slice(0, sep).trim());
  }
  const files = fileSet.size;
  return { tests, files, source: "vitest list" };
}

// ---------------------------------------------------------------------------
// 2. Scan docs for claims
// ---------------------------------------------------------------------------

// Returns array of { file, line, col, kind, claimedCount }
async function collectClaims(docFiles) {
  const claims = [];

  // Test-count pattern: 3+ digit number followed by " tests"
  // Matches "278 tests", "301 tests", etc.  Avoids "3 tests", "16 tests".
  const TEST_COUNT_RE = /\b(\d{3,})\s+tests\b/g;

  // File-count pattern: any number followed by " files", accepted only when
  // "tests" appears within 60 chars on the same line, BEFORE or AFTER the
  // match — so "321 tests pass (37 files)" and "37 files / 321 tests" both
  // count, but "34 files in the repo" does not.
  const FILE_COUNT_RE = /\b(\d+)\s+files\b/g;
  const NEARBY_TESTS = /\btests\b/;

  for (const filePath of docFiles) {
    let src;
    try {
      src = readFileSync(filePath, "utf8");
    } catch {
      continue; // file disappeared between glob and read; skip
    }

    const lines = src.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const text = lines[i];

      // Reset lastIndex between lines (RegExp is stateful with /g)
      TEST_COUNT_RE.lastIndex = 0;
      let m;
      while ((m = TEST_COUNT_RE.exec(text)) !== null) {
        claims.push({
          file: filePath,
          line: lineNum,
          col: m.index + 1,
          kind: "tests",
          claimedCount: Number(m[1]),
        });
      }

      FILE_COUNT_RE.lastIndex = 0;
      while ((m = FILE_COUNT_RE.exec(text)) !== null) {
        const before = text.slice(Math.max(0, m.index - 60), m.index);
        const after = text.slice(m.index + m[0].length, m.index + m[0].length + 60);
        if (!NEARBY_TESTS.test(before) && !NEARBY_TESTS.test(after)) continue;
        claims.push({
          file: filePath,
          line: lineNum,
          col: m.index + 1,
          kind: "files",
          claimedCount: Number(m[1]),
        });
      }
    }
  }

  return claims;
}

// ---------------------------------------------------------------------------
// 3. Main
// ---------------------------------------------------------------------------

const { tests: actualTests, files: actualFiles, source } = getActualCounts();

// Collect doc files: README.md + docs/launch/**/*.md. A plain recursive walk —
// no glob, so the script runs on any Node version (fs.promises.glob is 22+).
const docFiles = [resolve(root, "README.md")];
function walkMd(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) walkMd(full);
    else if (entry.name.endsWith(".md")) docFiles.push(full);
  }
}
walkMd(resolve(root, "docs/launch"));

const claims = await collectClaims(docFiles);

const failures = [];
for (const c of claims) {
  const actual = c.kind === "tests" ? actualTests : actualFiles;
  if (c.claimedCount !== actual) {
    failures.push(
      `  ${c.file}:${c.line}:${c.col}  claims ${c.claimedCount} ${c.kind}, actual is ${actual} (from ${source})` +
        `\n    Fix: update the doc to "${actual} ${c.kind}" or widen/narrow the matcher in scripts/check-doc-claims.mjs`,
    );
  }
}

if (failures.length > 0) {
  console.error(
    `check-doc-claims: ${failures.length} stale claim(s) found:\n\n${failures.join("\n\n")}`,
  );
  process.exit(1);
}

// Quiet on success (CI-friendly)
