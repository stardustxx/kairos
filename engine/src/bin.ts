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
 */

import { main as computeMain } from "./cli.js";
import { main as geocodeMain } from "./geocode-cli.js";
import { main as installGeocodeMain } from "./install-geocode.js";
import { main as mcpMain } from "./mcp-server.js";
import { main as memoryMain } from "./memory-cli.js";
import { isMainModule } from "./run-guard.js";
import { main as wheelMain } from "./wheel.js";

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

/**
 * Dispatch entrypoint. `argv` is the full process argv: argv[2] is the
 * subcommand and argv.slice(3) are that command's own args.
 */
export async function main(argv: string[]): Promise<void> {
  const command = argv[2];
  const rest = argv.slice(3);

  switch (command) {
    case "compute":
      computeMain(rest);
      return;
    case "memory":
      memoryMain(rest);
      return;
    case "geocode":
      geocodeMain(rest);
      return;
    case "geocode:install":
      await installGeocodeMain(rest);
      return;
    case "wheel":
    case "wheel:render":
      await wheelMain(rest);
      return;
    case "mcp":
      await mcpMain(rest);
      return;
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
