/*
 * cli.ts — the `pnpm compute` command-line entry point. The compute dispatcher
 * itself lives in compute.ts (browser-safe); this module adds the Node-only
 * shell: argv/stdin handling and the run-as-script guard. runCompute is
 * re-exported so existing consumers (tests, index.ts) keep importing it from
 * here.
 */
import { readFileSync } from "node:fs";
import { runCompute } from "./compute.js";
import { isMainModule } from "./run-guard.js";
import type { ComputeRequest } from "./types.js";

export { runCompute } from "./compute.js";

function readStdin(): string {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

/**
 * CLI entrypoint. `args` is the post-script argv (i.e. `process.argv.slice(2)`):
 * args[0] is the JSON request, falling back to stdin when absent.
 */
export function main(args: string[]): void {
  const raw = args[0] ?? readStdin();
  if (!raw.trim()) {
    console.error('Usage: pnpm compute \'{"kind":"horary","quesitedHouse":10,"moment":{...}}\'');
    process.exit(1);
  }
  try {
    const req = JSON.parse(raw) as ComputeRequest;
    process.stdout.write(`${JSON.stringify(runCompute(req), null, 2)}\n`);
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}

// Executed only when run as a script (not when imported by tests/dispatcher).
if (isMainModule(import.meta.url)) {
  main(process.argv.slice(2));
}
