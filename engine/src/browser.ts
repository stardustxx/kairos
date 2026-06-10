/*
 * browser.ts — the browser bundle entry point (built by `pnpm build:web` into
 * web/engine.js via scripts/build-web.mjs).
 *
 * Everything runs in-page: the wasm ephemeris is fetched from files sitting
 * next to the bundle (swisseph.wasm + swisseph.data), and no data ever leaves
 * the machine. The Node-only layers are swapped out at build time:
 * ephemeris.ts (native sweph) for a null default, memory.ts (file-backed
 * journal) for a throwing stub.
 */
import { runCompute } from "./compute.js";
import { setEphemerisProvider } from "./ephemeris-provider.js";
import { createWasmEphemeris } from "./ephemeris-wasm.js";

export interface BrowserEngine {
  runCompute: typeof runCompute;
}

let enginePromise: Promise<BrowserEngine> | null = null;

/**
 * Initialize the in-browser engine: load + compile the wasm ephemeris and
 * register it as the engine's provider. Idempotent — concurrent/repeat calls
 * share one init. Resolves to { runCompute }, the same dispatcher the CLI and
 * MCP server use.
 */
export function initBrowserEngine(): Promise<BrowserEngine> {
  if (!enginePromise) {
    enginePromise = createWasmEphemeris()
      .then((provider) => {
        setEphemerisProvider(provider);
        return { runCompute };
      })
      .catch((err) => {
        // Allow a retry after a transient failure (e.g. offline first load).
        enginePromise = null;
        throw err;
      });
  }
  return enginePromise;
}
