/*
 * memory-browser.ts — browser-bundle replacement for memory.ts.
 *
 * The memory/journal layer is file-backed (node:fs under KAIROS_HOME) and is a
 * Node-only feature. The web build (scripts/build-web.mjs) aliases
 * "./memory.js" to this stub so the bundle carries no node:fs. The browser UI
 * never sets `req.journal`, so this only fires if someone pastes a request
 * with `journal` into the in-browser compute path — then we fail loudly
 * instead of pretending to log.
 */
export function appendJournal(): never {
  throw new Error(
    "Journaling (`journal` on a compute request) is not available in the browser build — run the Node CLI/MCP engine to keep a local journal.",
  );
}
