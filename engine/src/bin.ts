#!/usr/bin/env node
/*
 * bin.ts — the single `kairos` dispatcher. It reads the subcommand from argv[2]
 * and forwards the remaining args (argv.slice(3)) to the matching CLI's exported
 * main. This is the one bin declared in package.json; running the compiled
 * `dist/src/bin.js <cmd>` works because of the robust isMainModule guard below.
 *
 *   kairos compute '{"kind":"horary",...}'
 *   kairos memory journal
 *   kairos geocode 'Tokyo'
 *   kairos geocode:install [--force]
 *   kairos wheel '{...}'        (alias: wheel:render)
 *   kairos mcp                  (stdio MCP server over the engine)
 *
 * The sub-CLIs are imported DYNAMICALLY inside the dispatch so the native
 * sweph load happens where we can catch it: on platforms with no prebuild and
 * no toolchain the import fails, and loadCli prints a concise actionable
 * message instead of a raw require/node-gyp stack (onboarding F1). Static
 * imports would hoist the failure above any try/catch. Only the sweph
 * native-load signature is intercepted; other errors rethrow untouched.
 */

import { formatNativeLoadError, isNativeLoadError } from "./native-load-error.js";
import { isMainModule } from "./run-guard.js";

const USAGE = [
  "Usage: kairos <command> [args...]",
  "",
  "Commands:",
  "  compute <json>           judge a request (horary/transit/natal/electional)",
  "  memory <subcommand>      profiles, journal, due readings, calibration",
  "  geocode <city>           resolve a city to lat/lon + timezone",
  "  geocode:install [--force] download the offline GeoNames gazetteer",
  "  wheel [--write [out]] <json>  render the chart wheel (alias: wheel:render)",
  "  mcp                      start the stdio MCP server over the engine",
].join("\n");

/** Import a sub-CLI module, translating a native sweph load failure into the
 *  actionable message. Any OTHER import-time failure is a genuine bug, so it
 *  keeps its full stack — the top-level catch only prints err.message, which
 *  would strip the file/line a debugger needs. */
async function loadCli<T>(importer: () => Promise<T>): Promise<T> {
  try {
    return await importer();
  } catch (err) {
    if (isNativeLoadError(err)) {
      process.stderr.write(`${formatNativeLoadError(err as Error)}\n`);
    } else {
      process.stderr.write(`${(err instanceof Error && err.stack) || String(err)}\n`);
    }
    process.exit(1);
  }
}

/**
 * Dispatch entrypoint. `argv` is the full process argv: argv[2] is the
 * subcommand and argv.slice(3) are that command's own args.
 */
export async function main(argv: string[]): Promise<void> {
  const command = argv[2];
  const rest = argv.slice(3);

  switch (command) {
    case "compute": {
      const { main: computeMain } = await loadCli(() => import("./cli.js"));
      computeMain(rest);
      return;
    }
    case "memory": {
      const { main: memoryMain } = await loadCli(() => import("./memory-cli.js"));
      memoryMain(rest);
      return;
    }
    case "geocode": {
      const { main: geocodeMain } = await loadCli(() => import("./geocode-cli.js"));
      geocodeMain(rest);
      return;
    }
    case "geocode:install": {
      const { main: installGeocodeMain } = await loadCli(() => import("./install-geocode.js"));
      await installGeocodeMain(rest);
      return;
    }
    case "wheel":
    case "wheel:render": {
      const { main: wheelMain } = await loadCli(() => import("./wheel.js"));
      await wheelMain(rest);
      return;
    }
    case "mcp": {
      const { main: mcpMain } = await loadCli(() => import("./mcp-server.js"));
      await mcpMain(rest);
      return;
    }
    default:
      process.stderr.write(`${USAGE}\n`);
      process.exit(1);
  }
}

// Executed only when run as a script. Same robust guard as the sub-CLIs so
// `node dist/src/bin.js <cmd>` (and `tsx engine/src/bin.ts <cmd>`) both work.
if (isMainModule(import.meta.url)) {
  main(process.argv).catch((err) => {
    process.stderr.write(`Error: ${(err as Error).message}\n`);
    process.exit(1);
  });
}
