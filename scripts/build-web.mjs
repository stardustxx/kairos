/*
 * build-web.mjs — bundle the in-browser engine: engine/src/browser.ts ->
 * web/engine.js (ESM), plus the two wasm assets that must sit NEXT TO the
 * bundle: web/swisseph.wasm (the compiled Swiss Ephemeris) and
 * web/swisseph.data (the package's preloaded emscripten FS bundle — its module
 * init requires it, though the engine's Moshier mode never reads the .se1
 * files inside). Run via `pnpm build:web`.
 *
 * Node-only layers are swapped out here, at build time, so the bundle contains
 * no `sweph` addon and no node:* imports:
 *   - ./ephemeris.js  -> ephemeris-browser-default.ts (no native default)
 *   - ./memory.js     -> memory-browser.ts (journaling stubbed out)
 * Node builtins referenced by swisseph-wasm's environment-sniffing branches
 * are marked external; those branches never execute in a browser.
 */
import { copyFile, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = (p) => resolve(root, "engine/src", p);

/** Swap Node-only engine modules for their browser stubs. */
const browserStubs = {
  name: "kairos-browser-stubs",
  setup(b) {
    b.onResolve({ filter: /^\.\/ephemeris\.js$/ }, () => ({
      path: src("ephemeris-browser-default.ts"),
    }));
    b.onResolve({ filter: /^\.\/memory\.js$/ }, () => ({
      path: src("memory-browser.ts"),
    }));
  },
};

/**
 * swisseph-wasm's browser locateFile resolves its assets at
 * '../wasm/<file>' relative to import.meta.url — which, once bundled, is
 * web/engine.js, so '../wasm/' would escape the web/ directory. Rewrite the
 * base to './' so the assets are fetched from beside the bundle
 * (web/swisseph.wasm, web/swisseph.data). Fails the build loudly if the
 * upstream source changes shape.
 */
const wasmAssetPaths = {
  name: "swisseph-wasm-asset-paths",
  setup(b) {
    b.onLoad({ filter: /swisseph-wasm[/\\]src[/\\]swisseph\.js$/ }, async (args) => {
      const code = await readFile(args.path, "utf8");
      const needle = "'../wasm/' + path";
      if (!code.includes(needle)) {
        throw new Error(
          "swisseph-wasm/src/swisseph.js no longer locates assets via '../wasm/' — update scripts/build-web.mjs",
        );
      }
      return { contents: code.replaceAll(needle, "'./' + path"), loader: "js" };
    });
  },
};

const result = await build({
  entryPoints: [src("browser.ts")],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  outfile: resolve(root, "web/engine.js"),
  // Node builtins imported inside swisseph-wasm's `if (node)` branches only;
  // left as bare dynamic imports that a browser never evaluates.
  external: ["module", "url", "path", "fs"],
  plugins: [browserStubs, wasmAssetPaths],
  logLevel: "info",
  metafile: true,
});

const wasmDir = resolve(root, "node_modules/swisseph-wasm/wasm");
await copyFile(resolve(wasmDir, "swisseph.wasm"), resolve(root, "web/swisseph.wasm"));
await copyFile(resolve(wasmDir, "swisseph.data"), resolve(root, "web/swisseph.data"));

const out = result.metafile.outputs["web/engine.js"];
console.log(`web/engine.js: ${(out.bytes / 1024).toFixed(0)} KiB`);
console.log("copied: web/swisseph.wasm, web/swisseph.data");
