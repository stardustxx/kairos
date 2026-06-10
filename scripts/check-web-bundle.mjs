/*
 * check-web-bundle.mjs — smoke-check the built browser bundle (web/engine.js).
 *
 * The parity test exercises the swisseph-wasm npm package under Node, but NOT
 * the esbuild output (with its browser stubs and asset-path rewrites). This
 * script guards the actual artifact that ships in the npm tarball:
 *
 *   1. the bundle + wasm assets exist,
 *   2. no STATIC node builtin import survived bundling (the only permitted
 *      node-builtin references are swisseph-wasm's `if (node)` dynamic-import
 *      branches, which a browser never evaluates),
 *   3. the bundle is importable as ESM and exports initBrowserEngine
 *      (importing must not initialize wasm — init is lazy by design).
 *
 * Run after `pnpm build:web`. Exits non-zero with a specific message on the
 * first failure. Wired into the release-check CI before publish.
 */
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const bundle = resolve(root, "web/engine.js");

function fail(msg) {
  console.error(`check-web-bundle: FAIL — ${msg}`);
  process.exit(1);
}

// 1. Artifacts exist and are non-trivial.
for (const [rel, minBytes] of [
  ["web/engine.js", 100_000],
  ["web/swisseph.wasm", 100_000],
  ["web/swisseph.data", 1_000_000],
]) {
  let size = 0;
  try {
    size = statSync(resolve(root, rel)).size;
  } catch {
    fail(`${rel} is missing — run \`pnpm build:web\` first`);
  }
  if (size < minBytes) fail(`${rel} is suspiciously small (${size} bytes)`);
}

// 2. No static node-builtin import survived bundling. ESM static imports are
//    hoisted as `import ... from "node:x"` / `from"node:x"`; require("node:x")
//    would also break a browser. swisseph-wasm's guarded `await import(...)`
//    branches are dynamic and never evaluate in a browser, so allow those.
const src = readFileSync(bundle, "utf8");
const staticNodeImport = /(?:^|[;\n}])\s*import\s[^();]*?from\s*["']node:/m;
const requireNode = /\brequire\(\s*["']node:/;
if (staticNodeImport.test(src)) fail("static `import ... from \"node:*\"` found in web/engine.js");
if (requireNode.test(src)) fail('`require("node:*")` found in web/engine.js');

// 3. Importable, and exports a callable initBrowserEngine without side effects.
const mod = await import(pathToFileURL(bundle).href);
if (typeof mod.initBrowserEngine !== "function") {
  fail("web/engine.js does not export initBrowserEngine()");
}

// 4. Anti-drift: the inline example in index.html must match example-output.json.
//    The <script id="example-data" type="application/json"> block is the canonical
//    source for "Load Example"; example-output.json is kept for docs. The compare
//    normalizes whitespace/formatting only — key order must match too (the inline
//    block is produced by copying the file, so an order mismatch IS drift).
const indexHtml = readFileSync(resolve(root, "web/index.html"), "utf8");
const exampleJsonRaw = readFileSync(resolve(root, "web/example-output.json"), "utf8");
const inlineMatch = indexHtml.match(
  /<script\s+id="example-data"[^>]*>([\s\S]*?)<\/script>/
);
if (!inlineMatch) {
  fail(
    'web/index.html is missing <script id="example-data" type="application/json"> block — ' +
    "re-embed example-output.json"
  );
}
const inlineText = inlineMatch[1].trim();
if (!inlineText) {
  fail(
    '<script id="example-data"> block in web/index.html is empty — ' +
    "embed the contents of web/example-output.json"
  );
}
let inlineParsed, fileParsed;
try {
  inlineParsed = JSON.parse(inlineText);
} catch (e) {
  fail(`Inline example in web/index.html is not valid JSON: ${e.message}`);
}
try {
  fileParsed = JSON.parse(exampleJsonRaw);
} catch (e) {
  fail(`web/example-output.json is not valid JSON: ${e.message}`);
}
// Re-serialize each parse and compare: whitespace-insensitive, key-order-sensitive
// (deliberately fail-closed — a reordering can only come from regenerating one copy).
const inlineCanon = JSON.stringify(inlineParsed);
const fileCanon = JSON.stringify(fileParsed);
if (inlineCanon !== fileCanon) {
  fail(
    "Inline example in web/index.html differs from web/example-output.json — " +
    "update the <script id=\"example-data\"> block to match the file (or vice-versa)"
  );
}

console.log("check-web-bundle: OK — bundle present, browser-safe, exports initBrowserEngine, inline example matches file");
