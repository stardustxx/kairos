/*
 * mcp-server.ts — a stdio MCP server ("kairos") over the engine's library
 * exports. Every tool calls the library IN-PROCESS (no shell-out, no
 * stdout-JSON parsing): it validates inputs, runs the same functions the CLIs
 * call, and returns the engine result as structured JSON text content.
 *
 * STDOUT SAFETY: stdout is the JSON-RPC channel for the stdio transport — a
 * stray `console.log` there corrupts the protocol stream. This module NEVER
 * writes to stdout itself; the only writer is StdioServerTransport. Diagnostics
 * (the startup line) go to stderr. Tool handlers return errors as proper MCP
 * tool errors (`isError: true`) rather than throwing, so a bad request never
 * crashes the server or leaks a stack trace onto the wire.
 *
 * Wired into the `kairos mcp` dispatcher (see bin.ts); for local dev run
 * `pnpm mcp` (tsx engine/src/mcp-server.ts).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  renderCalibrationCardMarkdown,
  renderCalibrationCardSvg,
} from "./calibration-card.js";
import { runCompute } from "./cli.js";
import { type GeoCity, searchCities } from "./geocode.js";
import { gazetteerPath } from "./install-geocode.js";
import {
  appendJournal,
  computeCalibration,
  dueReadings,
  loadProfile,
  type Outcome,
  type Profile,
  recordOutcome,
  saveProfile,
} from "./memory.js";
import { isMainModule } from "./run-guard.js";
import type { ComputeRequest } from "./types.js";
import { validateRequest } from "./validate.js";
import { renderWheelToFile } from "./wheel.js";

/** Read this package's version for the server identity, resolved from the
 *  module location (../../package.json) so it works in both dev (engine/src)
 *  and the built dist (dist/src). Falls back to "0.0.0" if unreadable. */
function packageVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(join(here, "..", "..", "package.json"), "utf8")) as {
      version?: string;
    };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/** Wrap a value as a single-text-content MCP result holding pretty JSON. */
function jsonContent(value: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
  };
}

/** Wrap an error message as a proper MCP tool error (not a thrown crash). */
function toolError(message: string): CallToolResult {
  return {
    isError: true,
    content: [{ type: "text", text: message }],
  };
}

/**
 * Run a handler, converting any thrown Error into an MCP tool error so a bad
 * input surfaces as a clean `isError` result on the wire instead of crashing
 * the server. The handlers below are deliberately plain functions (not bound to
 * a live transport) so the test suite can call them directly.
 */
function guard(fn: () => unknown): CallToolResult {
  try {
    return jsonContent(fn());
  } catch (err) {
    return toolError((err as Error).message);
  }
}

// ── Tool handlers (exported for direct unit testing, no transport needed) ────

/** compute — validate a full ComputeRequest, then run it; returns ComputeResult. */
export function handleCompute(req: ComputeRequest): CallToolResult {
  return guard(() => {
    validateRequest(req);
    return runCompute(req);
  });
}

/**
 * render_wheel — validate a ComputeRequest, run it, then write a single
 * self-contained openable HTML chart to a temp file and return its ABSOLUTE
 * path. Errors (as a proper MCP tool error) when the request produces no chart
 * (e.g. an electional with no candidates). This never writes to stdout — it
 * returns the path as structured JSON content for the transport to emit.
 */
export function handleRenderWheel(req: ComputeRequest): CallToolResult {
  return guard(() => {
    validateRequest(req);
    const result = runCompute(req);
    if (!result.chart) {
      throw new Error(
        "nothing to render: this request produced no chart (an electional with no candidates?)",
      );
    }
    const path = renderWheelToFile(result);
    return { path, note: "open this file in a browser" };
  });
}

/** geocode — search the cached gazetteer; hints to install when it is absent. */
export function handleGeocode(input: { query: string; limit?: number }): CallToolResult {
  return guard(() => {
    const query = input.query.trim();
    if (!query) throw new Error("geocode requires a non-empty `query`");
    const path = gazetteerPath();
    if (!existsSync(path)) {
      throw new Error(
        "gazetteer not installed — run `kairos geocode:install` first to download the offline GeoNames data",
      );
    }
    const tsv = readFileSync(path, "utf8");
    return searchCities(query, tsv, input.limit ?? 5) satisfies GeoCity[];
  });
}

/** memory_log — append a reading to the journal; returns the stored entry. */
export function handleMemoryLog(
  input: Parameters<typeof appendJournal>[0] & { profile?: string },
): CallToolResult {
  return guard(() => {
    const { profile, ...entry } = input;
    return profile ? appendJournal(entry, profile) : appendJournal(entry);
  });
}

/** memory_due — ripe, unresolved readings (most-ripe first). */
export function handleMemoryDue(input: { profile?: string }): CallToolResult {
  return guard(() => dueReadings(input.profile));
}

/** memory_outcome — record how a logged reading turned out. */
export function handleMemoryOutcome(input: {
  id: string;
  outcome: Outcome;
  note?: string;
}): CallToolResult {
  return guard(() => recordOutcome(input.id, input.outcome, input.note));
}

/** memory_calibration — hit-rate by confidence band over resolved readings. */
export function handleMemoryCalibration(input: { profile?: string }): CallToolResult {
  return guard(() => computeCalibration(input.profile));
}

/**
 * memory_calibration_card — the same calibration data rendered as a clean,
 * shareable card. `format: "markdown"` (default) returns the Markdown card;
 * `format: "svg"` returns a self-contained SVG badge. Both surface the sample
 * size + caveat and handle the empty (no-outcomes-yet) case honestly. Returns
 * the rendered card as plain text content (not JSON) so it's ready to paste.
 */
export function handleMemoryCalibrationCard(input: {
  profile?: string;
  format?: "markdown" | "svg";
}): CallToolResult {
  try {
    const report = computeCalibration(input.profile);
    const card =
      input.format === "svg"
        ? renderCalibrationCardSvg(report)
        : renderCalibrationCardMarkdown(report);
    return { content: [{ type: "text", text: card }] };
  } catch (err) {
    return toolError((err as Error).message);
  }
}

/** profile_get — the remembered birth/home profile (active by default). */
export function handleProfileGet(input: { profile?: string }): CallToolResult {
  return guard(() => (input.profile ? loadProfile(input.profile) : loadProfile()));
}

/** profile_set — deep-merge a patch over a profile; returns the merged profile. */
export function handleProfileSet(input: {
  patch: Partial<Profile>;
  profile?: string;
}): CallToolResult {
  return guard(() =>
    input.profile ? saveProfile(input.patch, input.profile) : saveProfile(input.patch),
  );
}

// ── Input schemas (Zod raw shapes; the SDK renders these to JSON Schema) ─────

/** A moment + place, mirroring MomentInput. */
const momentShape = z.object({
  datetimeLocal: z
    .string()
    .describe('Local civil datetime, ISO without offset, e.g. "1990-05-21T14:30:00".'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timezone: z.string().optional().describe('IANA zone, e.g. "America/New_York".'),
  houseSystem: z.string().optional().describe('Single-letter house system code, default "P".'),
});

/** A place only (lat/lon + optional zone/houseSystem); datetime ignored. */
const placeShape = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timezone: z.string().optional(),
  houseSystem: z.string().optional(),
  datetimeLocal: z.string().optional(),
});

/** The full ComputeRequest as a Zod object, kept structurally in sync with
 *  ComputeRequest in types.ts. validateRequest does the authoritative checks. */
const computeRequestShape = {
  kind: z
    .enum(["natal", "transit", "horary", "electional"])
    .describe("Chart kind. Drives which other fields are required."),
  moment: momentShape
    .optional()
    .describe('The chart\'s own moment. Required for natal/transit/horary; for "transit" use now.'),
  natal: momentShape.optional().describe('Required only for kind "transit": the natal chart.'),
  quesitedHouse: z
    .number()
    .int()
    .min(2)
    .max(12)
    .optional()
    .describe("House of the matter (2..12). Required for horary; reused by electional."),
  querentHouse: z
    .number()
    .int()
    .min(1)
    .max(12)
    .optional()
    .describe(
      "Horary only. Radix house (1..12) the QUERENT's significator is read from (default 1, the asker). Set to TURN THE CHART for a third-party question: the querent house becomes the radix house of the person the matter is about (e.g. 7 for a partner), and quesitedHouse becomes their concern's DERIVED radix house.",
    ),
  window: z
    .object({ startLocal: z.string(), endLocal: z.string() })
    .optional()
    .describe('Required for "electional": local-time window to scan (ISO without offset).'),
  stepMinutes: z
    .number()
    .positive()
    .optional()
    .describe('Required for "electional": scan interval in minutes (e.g. 15).'),
  location: placeShape
    .optional()
    .describe('Required for "electional": the place to cast each candidate chart for.'),
  significatorHints: z
    .object({ planet: z.string().optional(), beneficWeighting: z.number().optional() })
    .optional()
    .describe('Optional for "electional": steer significator choice/weighting.'),
  relocation: placeShape
    .optional()
    .describe("Optional: recast the chart's houses/angles for another place (same moment)."),
  journal: z
    .object({ question: z.string(), verdictText: z.string().optional() })
    .optional()
    .describe(
      "Optional auto-logging: when present, the compute appends a journal entry (the engine-derived fields plus this question) and returns the new entry id.",
    ),
};

/** Journal-entry fields for memory_log, mirroring appendJournal's input. */
const journalEntryShape = {
  question: z.string().describe("The user's question, recorded verbatim."),
  kind: z
    .enum(["natal", "transit", "horary", "electional"])
    .describe("The chart kind this reading used."),
  quesitedHouse: z.number().int().min(2).max(12).optional(),
  lean: z.enum(["favorable", "unfavorable", "uncertain"]).optional(),
  confidence: z.enum(["low", "medium", "high"]).optional(),
  score: z.number().optional(),
  verdictText: z.string().optional().describe("The plain-language verdict given at log time."),
  expectedResolutionAt: z
    .string()
    .optional()
    .describe('When this reading is expected resolvable (the "ask me later" date, ISO-8601).'),
  profile: z.string().optional().describe("Profile slug to log against (default: the active one)."),
};

/** A ProfilePlace patch (lat/lon + optional zone/place, plus birth datetime). */
const profilePlaceShape = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timezone: z.string().optional(),
  place: z.string().optional(),
});

/** Build and configure the "kairos" MCP server with all tools registered.
 *  Pure construction — no transport is connected here, so this is testable. */
export function buildServer(): McpServer {
  const server = new McpServer({ name: "kairos", version: packageVersion() });

  server.registerTool(
    "compute",
    {
      title: "Compute a chart judgment",
      description:
        "The core tool. Validates a ComputeRequest (kind plus the per-kind fields) and runs the engine, returning the full ComputeResult: a horary judgment, transit aspects + annual profection, a natal/electional chart, optional relocation, and (when `journal` is supplied) the auto-logged entry id.",
      inputSchema: computeRequestShape,
    },
    async (args) => handleCompute(args as unknown as ComputeRequest),
  );

  server.registerTool(
    "render_wheel",
    {
      title: "Render a chart wheel to an openable HTML file",
      description:
        "Takes the SAME request as compute (a ComputeRequest), runs the engine, and writes ONE self-contained chart wheel as an openable .html file (web assets + the ComputeResult inlined, no network needed). Returns { path, note } with the artifact's absolute path for the user to open in a browser. The visual verdict panel covers horary/electional; transit/natal render the wheel without one. Errors when the request produces no chart (e.g. an electional with no candidates).",
      inputSchema: computeRequestShape,
    },
    async (args) => handleRenderWheel(args as unknown as ComputeRequest),
  );

  server.registerTool(
    "horary",
    {
      title: "Horary judgment (convenience)",
      description:
        "Convenience wrapper over compute for a horary question: builds the request from a moment + quesitedHouse and returns the judgment (lean, confidence, perfection picture, timing).",
      inputSchema: {
        moment: momentShape.describe("The moment the question was asked (with place)."),
        quesitedHouse: z
          .number()
          .int()
          .min(2)
          .max(12)
          .describe("House of the matter asked about (2..12)."),
        querentHouse: z
          .number()
          .int()
          .min(1)
          .max(12)
          .optional()
          .describe(
            "Radix house (1..12) the querent's significator is read from (default 1). Set to turn the chart for a third-party question.",
          ),
        relocation: placeShape.optional(),
        journal: z
          .object({ question: z.string(), verdictText: z.string().optional() })
          .optional(),
      },
    },
    async (args) =>
      handleCompute({ kind: "horary", ...(args as Record<string, unknown>) } as ComputeRequest),
  );

  server.registerTool(
    "transit",
    {
      title: "Transit + profection (convenience)",
      description:
        "Convenience wrapper over compute for a transit reading: compares a transit `moment` against a `natal` chart and returns transit aspects plus the annual profection (lord of the year).",
      inputSchema: {
        moment: momentShape.describe('The transit moment (typically "now").'),
        natal: momentShape.describe("The natal chart to compare against."),
        relocation: placeShape.optional(),
      },
    },
    async (args) =>
      handleCompute({ kind: "transit", ...(args as Record<string, unknown>) } as ComputeRequest),
  );

  server.registerTool(
    "natal",
    {
      title: "Natal chart (convenience)",
      description:
        "Convenience wrapper over compute for a natal chart: casts the chart for a single birth moment + place (planets, houses, aspects, dignities, lots).",
      inputSchema: {
        moment: momentShape.describe("The birth moment + place."),
        relocation: placeShape.optional(),
      },
    },
    async (args) =>
      handleCompute({ kind: "natal", ...(args as Record<string, unknown>) } as ComputeRequest),
  );

  server.registerTool(
    "electional",
    {
      title: "Electional search (convenience)",
      description:
        "Convenience wrapper over compute for an electional search: scans a local-time window at a step interval for the best moments to act on a matter (quesitedHouse), returning the top candidates and the #1 chart.",
      inputSchema: {
        location: placeShape.describe("The place to cast each candidate chart for."),
        window: z
          .object({ startLocal: z.string(), endLocal: z.string() })
          .describe("Local-time window to scan (ISO without offset)."),
        stepMinutes: z.number().positive().describe("Scan interval in minutes (e.g. 15)."),
        quesitedHouse: z.number().int().min(2).max(12).describe("House of the matter (2..12)."),
        significatorHints: z
          .object({ planet: z.string().optional(), beneficWeighting: z.number().optional() })
          .optional(),
      },
    },
    async (args) =>
      handleCompute({
        kind: "electional",
        ...(args as Record<string, unknown>),
      } as ComputeRequest),
  );

  server.registerTool(
    "geocode",
    {
      title: "Resolve a city to coordinates",
      description:
        "Look up a city name in the cached offline GeoNames gazetteer, returning authoritative lat/lon + IANA timezone (most populous first). Errors with an install hint if the gazetteer is absent (run `kairos geocode:install`).",
      inputSchema: {
        query: z.string().describe('City name, e.g. "Tokyo" or "San Francisco".'),
        limit: z.number().int().positive().optional().describe("Max matches to return (default 5)."),
      },
    },
    async (args) => handleGeocode(args as { query: string; limit?: number }),
  );

  server.registerTool(
    "memory_log",
    {
      title: "Log a reading to the journal",
      description:
        "Append a reading to the local append-only journal and return its id. Note: passing `journal` to the compute tool is the PREFERRED path — it captures the engine-derived lean/confidence/score itself so the track record can't drift. Use this only to log a reading computed elsewhere.",
      inputSchema: journalEntryShape,
    },
    async (args) =>
      handleMemoryLog(args as unknown as Parameters<typeof handleMemoryLog>[0]),
  );

  server.registerTool(
    "memory_due",
    {
      title: "Readings ripe to resolve",
      description:
        "List logged-but-unresolved readings that are now ripe to ask about (most-ripe first), so Kairos can follow up on past questions.",
      inputSchema: {
        profile: z.string().optional().describe("Profile slug (default: the active one)."),
      },
    },
    async (args) => handleMemoryDue(args as { profile?: string }),
  );

  server.registerTool(
    "memory_outcome",
    {
      title: "Record how a reading turned out",
      description:
        "Record the outcome of a previously logged reading by id (happened / did-not-happen / partial / unknown), feeding the calibration track record.",
      inputSchema: {
        id: z.string().describe("The journal entry id returned by memory_log or compute."),
        outcome: z
          .enum(["happened", "did-not-happen", "partial", "unknown"])
          .describe("How the matter actually resolved."),
        note: z.string().optional().describe("Optional note on what actually happened."),
      },
    },
    async (args) => handleMemoryOutcome(args as { id: string; outcome: Outcome; note?: string }),
  );

  server.registerTool(
    "memory_calibration",
    {
      title: "Self-reported calibration",
      description:
        "Report Kairos's hit-rate by confidence band over resolved, directional readings — a personal pattern, not proof.",
      inputSchema: {
        profile: z.string().optional().describe("Profile slug (default: the active one)."),
      },
    },
    async (args) => handleMemoryCalibration(args as { profile?: string }),
  );

  server.registerTool(
    "memory_calibration_card",
    {
      title: "Shareable calibration track-record card",
      description:
        "Render Kairos's calibration as a clean, HONEST, shareable card — Markdown (default) or a self-contained SVG badge. Always surfaces the sample size (n resolved) and the small-sample caveat so a tiny streak is never presented as proof; when nothing has resolved yet it renders an explicit 'no outcomes yet' state instead of a misleading 100%/0%. Returns the rendered card as plain text.",
      inputSchema: {
        format: z
          .enum(["markdown", "svg"])
          .optional()
          .describe('Card format: "markdown" (default) or "svg".'),
        profile: z.string().optional().describe("Profile slug (default: the active one)."),
      },
    },
    async (args) =>
      handleMemoryCalibrationCard(args as { profile?: string; format?: "markdown" | "svg" }),
  );

  server.registerTool(
    "profile_get",
    {
      title: "Get the remembered profile",
      description:
        "Return the stored profile (birth + home places) for the active profile, or a named one. Null when nothing is saved.",
      inputSchema: {
        profile: z.string().optional().describe("Profile slug (default: the active one)."),
      },
    },
    async (args) => handleProfileGet(args as { profile?: string }),
  );

  server.registerTool(
    "profile_set",
    {
      title: "Update the remembered profile",
      description:
        "Deep-merge a patch over the profile (birth/home merged field-wise) and return the merged profile. Stored LOCALLY only under KAIROS_HOME — birth data never leaves the machine.",
      inputSchema: {
        patch: z
          .object({
            birth: profilePlaceShape
              .extend({ datetimeLocal: z.string() })
              .optional()
              .describe("Birth place + datetime."),
            home: profilePlaceShape.optional().describe("Current home place."),
            label: z.string().optional().describe("Human label for this person/context."),
          })
          .describe("Partial profile to merge in."),
        profile: z.string().optional().describe("Profile slug (default: the active one)."),
      },
    },
    async (args) =>
      handleProfileSet(args as { patch: Partial<Profile>; profile?: string }),
  );

  return server;
}

/**
 * Entrypoint for `kairos mcp`: build the server and serve it over stdio. `args`
 * is accepted for parity with the other CLIs (no flags today). Resolves only
 * when the transport closes. Diagnostics go to stderr — stdout is reserved for
 * the JSON-RPC channel.
 */
export async function main(_args: string[]): Promise<void> {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("kairos mcp: stdio server ready.\n");
}

// Executed only when run as a script (dev: `pnpm mcp`). The dispatcher (bin.ts)
// imports `main` instead, so this guard stays quiet under import.
if (isMainModule(import.meta.url)) {
  main(process.argv.slice(2)).catch((err) => {
    process.stderr.write(`Error: ${(err as Error).message}\n`);
    process.exit(1);
  });
}
