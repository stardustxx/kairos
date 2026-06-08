/*
 * mcp-server.test.ts — unit tests for the MCP tool-handler logic.
 *
 * The handlers are factored as plain functions (no live stdio transport), so we
 * call them directly against a private, throwaway KAIROS_HOME. We assert the
 * handlers return MCP results (structured JSON text content) and surface errors
 * as `isError` tool results rather than throwing.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildServer,
  handleCompute,
  handleGeocode,
  handleMemoryCalibration,
  handleMemoryDue,
  handleMemoryLog,
  handleMemoryOutcome,
  handleProfileGet,
  handleProfileSet,
} from "./mcp-server.js";
import type { ComputeRequest } from "./types.js";

// Each test gets a private KAIROS_HOME so on-disk state never leaks.
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "kairos-mcp-"));
  process.env.KAIROS_HOME = dir;
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.KAIROS_HOME;
});

/** Pull the single text-content payload out of a tool result and JSON-parse it. */
function parsed(result: CallToolResult): unknown {
  const first = result.content[0];
  expect(first.type).toBe("text");
  return JSON.parse((first as { text: string }).text);
}

const LONDON = { latitude: 51.5074, longitude: -0.1278, timezone: "Europe/London" };

describe("buildServer", () => {
  it("constructs a server without throwing (no transport needed)", () => {
    expect(() => buildServer()).not.toThrow();
  });
});

describe("compute handler", () => {
  it("returns a horary judgment for a valid request", () => {
    const req: ComputeRequest = {
      kind: "horary",
      quesitedHouse: 10,
      moment: { datetimeLocal: "2020-03-20T12:00:00", ...LONDON },
    };
    const result = handleCompute(req);
    expect(result.isError).toBeFalsy();
    const value = parsed(result) as { horary?: { lean?: string } };
    expect(value.horary).toBeTruthy();
    expect(["favorable", "unfavorable", "uncertain"]).toContain(value.horary?.lean);
  });

  it("returns a tool error (not a throw) for an invalid request", () => {
    // Missing required `moment` for a horary request.
    const bad = { kind: "horary", quesitedHouse: 10 } as ComputeRequest;
    let result: CallToolResult | undefined;
    expect(() => {
      result = handleCompute(bad);
    }).not.toThrow();
    expect(result?.isError).toBe(true);
    expect((result?.content[0] as { text: string }).text).toMatch(/moment/i);
  });

  it("returns a tool error for an unknown kind", () => {
    const bad = { kind: "tarot" } as unknown as ComputeRequest;
    const result = handleCompute(bad);
    expect(result.isError).toBe(true);
  });
});

describe("geocode handler", () => {
  it("returns the install hint when the gazetteer is absent", () => {
    const result = handleGeocode({ query: "Tokyo" });
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toMatch(/geocode:install/);
  });

  it("rejects an empty query", () => {
    const result = handleGeocode({ query: "   " });
    expect(result.isError).toBe(true);
  });
});

describe("memory loop round-trip", () => {
  it("logs, lists due, records outcome, and reports calibration", () => {
    // 1. Log a favorable horary reading already past its expected-resolution date.
    const logged = handleMemoryLog({
      question: "Will the deal close?",
      kind: "horary",
      quesitedHouse: 7,
      lean: "favorable",
      confidence: "high",
      score: 5,
      expectedResolutionAt: "2000-01-01T00:00:00.000Z",
    });
    expect(logged.isError).toBeFalsy();
    const entry = parsed(logged) as { id: string };
    expect(entry.id).toBeTruthy();

    // 2. It shows up as due (its expected-resolution date is in the past).
    const due = handleMemoryDue({});
    const dueList = parsed(due) as Array<{ id: string }>;
    expect(dueList.some((e) => e.id === entry.id)).toBe(true);

    // 3. Record the outcome.
    const outcome = handleMemoryOutcome({ id: entry.id, outcome: "happened", note: "it closed" });
    expect(outcome.isError).toBeFalsy();
    const recorded = parsed(outcome) as { outcome: string; outcomeNote: string };
    expect(recorded.outcome).toBe("happened");
    expect(recorded.outcomeNote).toBe("it closed");

    // 4. No longer due once resolved.
    const dueAfter = parsed(handleMemoryDue({})) as Array<{ id: string }>;
    expect(dueAfter.some((e) => e.id === entry.id)).toBe(false);

    // 5. Calibration credits the correct favorable→happened reading in the high band.
    const calibration = parsed(handleMemoryCalibration({})) as {
      overall: { resolved: number; correct: number; hitRate: number | null };
      bands: Array<{ confidence: string; resolved: number; correct: number }>;
    };
    expect(calibration.overall.resolved).toBe(1);
    expect(calibration.overall.correct).toBe(1);
    expect(calibration.overall.hitRate).toBe(1);
    const high = calibration.bands.find((b) => b.confidence === "high");
    expect(high?.correct).toBe(1);
  });

  it("memory_outcome errors for an unknown id", () => {
    const result = handleMemoryOutcome({ id: "nope", outcome: "happened" });
    expect(result.isError).toBe(true);
  });

  it("memory_log errors on a malformed kind", () => {
    const result = handleMemoryLog({
      question: "x",
      kind: "tarot" as unknown as ComputeRequest["kind"],
    });
    expect(result.isError).toBe(true);
  });
});

describe("profile handlers", () => {
  it("set then get round-trips a home place", () => {
    const set = handleProfileSet({
      patch: { home: { latitude: 40.7, longitude: -74 } },
    });
    expect(set.isError).toBeFalsy();

    const got = parsed(handleProfileGet({})) as { home?: { latitude: number } };
    expect(got.home?.latitude).toBe(40.7);
  });

  it("profile_get is null on a fresh store", () => {
    expect(parsed(handleProfileGet({}))).toBeNull();
  });
});

describe("compute auto-log via journal field", () => {
  it("logs an entry and returns its id (preferred over memory_log)", () => {
    const req: ComputeRequest = {
      kind: "horary",
      quesitedHouse: 10,
      moment: { datetimeLocal: "2020-03-20T12:00:00", ...LONDON },
      journal: { question: "Will I get the job?" },
    };
    const value = parsed(handleCompute(req)) as { journalId?: string };
    expect(value.journalId).toBeTruthy();

    // The auto-logged entry is now visible to the memory tools.
    const due = parsed(handleMemoryDue({})) as Array<{ id: string }>;
    // Not necessarily due yet (depends on timing), but it must exist via calibration total.
    const calibration = parsed(handleMemoryCalibration({})) as { total: number };
    expect(calibration.total).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(due)).toBe(true);
  });
});
