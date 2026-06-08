/*
 * run-guard.ts — robust "is this module the entrypoint?" check.
 *
 * The old guards compared `process.argv[1]` against a hard-coded ".ts" suffix,
 * so they NEVER matched the compiled `.js` files: `node dist/src/cli.js` was a
 * silent no-op. This compares the resolved module URL against the resolved
 * `process.argv[1]`, so it fires for BOTH the dev path (tsx running the .ts) and
 * the built path (node running the .js). It is realpath-tolerant: symlinked or
 * relative invocations still resolve to the same canonical file.
 */
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Resolve a filesystem path to its canonical form, tolerating missing files. */
function canonical(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

/**
 * True when `moduleUrl` (pass `import.meta.url`) is the script Node was launched
 * with. Works for `.ts` (tsx) and `.js` (compiled dist) alike.
 */
export function isMainModule(moduleUrl: string): boolean {
  const invoked = process.argv[1];
  if (!invoked) return false;
  return canonical(fileURLToPath(moduleUrl)) === canonical(invoked);
}
