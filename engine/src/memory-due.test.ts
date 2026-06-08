/*
 * memory-due.test.ts — the calibration loop's two new halves:
 *   (1) auto-logging a reading as a side effect of runCompute, and
 *   (2) re-surfacing ripe, unresolved readings via dueReadings.
 *
 * Both run under a throwaway KAIROS_HOME so on-disk state never leaks between
 * tests or onto the real ~/.kairos. dueReadings takes an injectable reference
 * "now" so the ripeness logic is tested deterministically, not against the clock.
 */
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCompute } from "./cli.js";
import { appendJournal, dueReadings, loadJournal } from "./memory.js";
import type { ComputeRequest } from "./types.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "kairos-due-"));
  process.env.KAIROS_HOME = dir;
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.KAIROS_HOME;
});

// A concrete horary request — moment + location + quesitedHouse — so the engine
// returns a real HoraryJudgment whose lean/confidence/score we can assert we
// captured (rather than trusting a hand-copied second call).
function horaryReq(journal?: ComputeRequest["journal"]): ComputeRequest {
  return {
    kind: "horary",
    quesitedHouse: 10,
    moment: {
      datetimeLocal: "2024-03-15T14:30:00",
      latitude: 40.71,
      longitude: -74.0,
      timezone: "America/New_York",
    },
    journal,
  };
}

describe("runCompute auto-log", () => {
  it("writes one entry capturing engine-derived fields and returns its id", () => {
    const result = runCompute(horaryReq({ question: "Will I get the job?", verdictText: "Leans yes." }));

    // The judgment must be present so we can check the entry mirrors it.
    expect(result.horary).toBeDefined();
    expect(typeof result.journalId).toBe("string");
    expect(result.journalId!.length).toBeGreaterThan(0);

    const entries = loadJournal();
    expect(entries).toHaveLength(1);
    const entry = entries[0];
    expect(entry.id).toBe(result.journalId);
    expect(entry.question).toBe("Will I get the job?");
    expect(entry.verdictText).toBe("Leans yes.");
    expect(entry.kind).toBe("horary");
    expect(entry.quesitedHouse).toBe(10);
    // Engine-derived, NOT hand-copied — must equal what the judgment returned.
    expect(entry.lean).toBe(result.horary!.lean);
    expect(entry.confidence).toBe(result.horary!.confidence);
    expect(entry.score).toBe(result.horary!.score);
    expect(entry.outcome).toBeUndefined(); // freshly logged, unresolved
  });

  it("sets expectedResolutionAt from the horary timing's perfectsAtUtc when present", () => {
    const result = runCompute(horaryReq({ question: "Will the deal close?" }));
    const expected = result.horary?.timing?.perfectsAtUtc ?? undefined;
    const entry = loadJournal()[0];
    // Whatever the timing said, the entry's expected-resolution date mirrors it
    // (and stays undefined when timing/perfectsAtUtc is absent).
    expect(entry.expectedResolutionAt).toBe(expected);
  });

  it("writes nothing and sets no journalId when `journal` is absent (pure path)", () => {
    const result = runCompute(horaryReq());
    expect(result.horary).toBeDefined(); // still computed
    expect(result.journalId).toBeUndefined();
    // The store is untouched — no journal file at all.
    expect(existsSync(join(dir, "journal.jsonl"))).toBe(false);
    expect(loadJournal()).toHaveLength(0);
  });
});

describe("dueReadings", () => {
  const NOW = "2024-06-01T00:00:00.000Z";

  it("includes a past-due unresolved entry whose expectedResolutionAt is in the past", () => {
    appendJournal({
      id: "ripe",
      question: "ripe one",
      kind: "horary",
      askedAt: "2024-05-01T00:00:00.000Z",
      expectedResolutionAt: "2024-05-20T00:00:00.000Z", // before NOW
    });
    const due = dueReadings(undefined, NOW);
    expect(due.map((e) => e.id)).toEqual(["ripe"]);
  });

  it("excludes resolved entries and ones whose resolution is still in the future", () => {
    appendJournal({
      id: "resolved",
      question: "done",
      kind: "horary",
      askedAt: "2024-05-01T00:00:00.000Z",
      expectedResolutionAt: "2024-05-20T00:00:00.000Z",
      outcome: "happened",
    });
    appendJournal({
      id: "future",
      question: "not yet",
      kind: "horary",
      askedAt: "2024-05-01T00:00:00.000Z",
      expectedResolutionAt: "2024-07-01T00:00:00.000Z", // after NOW
    });
    const due = dueReadings(undefined, NOW);
    expect(due).toHaveLength(0);
  });

  it("uses a 30-day default lag past askedAt when expectedResolutionAt is absent", () => {
    appendJournal({
      id: "old-no-date",
      question: "asked long ago",
      kind: "horary",
      askedAt: "2024-04-01T00:00:00.000Z", // >30 days before NOW → ripe
    });
    appendJournal({
      id: "recent-no-date",
      question: "asked recently",
      kind: "horary",
      askedAt: "2024-05-25T00:00:00.000Z", // <30 days before NOW → not yet ripe
    });
    const due = dueReadings(undefined, NOW);
    expect(due.map((e) => e.id)).toEqual(["old-no-date"]);
  });

  it("orders most-ripe (longest overdue) first", () => {
    appendJournal({
      id: "less-overdue",
      question: "b",
      kind: "horary",
      askedAt: "2024-05-01T00:00:00.000Z",
      expectedResolutionAt: "2024-05-25T00:00:00.000Z",
    });
    appendJournal({
      id: "most-overdue",
      question: "a",
      kind: "horary",
      askedAt: "2024-05-01T00:00:00.000Z",
      expectedResolutionAt: "2024-05-02T00:00:00.000Z",
    });
    const due = dueReadings(undefined, NOW);
    expect(due.map((e) => e.id)).toEqual(["most-overdue", "less-overdue"]);
  });
});
