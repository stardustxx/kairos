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

console.log("check-web-bundle: OK — bundle present, browser-safe, exports initBrowserEngine");
