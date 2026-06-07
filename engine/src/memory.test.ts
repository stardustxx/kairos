import { appendFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { JournalEntry } from "./memory.js";
import {
  appendJournal,
  clearProfile,
  computeCalibration,
  loadJournal,
  loadProfile,
  recordOutcome,
  saveProfile,
} from "./memory.js";

// Each test gets a private, throwaway KAIROS_HOME so on-disk state never leaks
// between tests (or onto the real ~/.kairos).
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "kairos-mem-"));
  process.env.KAIROS_HOME = dir;
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.KAIROS_HOME;
});

describe("loadProfile", () => {
  it("is null on a fresh directory", () => {
    expect(loadProfile()).toBeNull();
  });
});

describe("saveProfile", () => {
  it("merges birth then home across two calls and sets updatedAt", () => {
    const first = saveProfile({
      birth: {
        datetimeLocal: "1990-05-01T08:30:00",
        latitude: 40.7,
        longitude: -74,
        timezone: "America/New_York",
        place: "New York",
      },
    });
    expect(first.birth?.datetimeLocal).toBe("1990-05-01T08:30:00");
    expect(first.home).toBeUndefined();
    expect(typeof first.updatedAt).toBe("string");
    expect(first.updatedAt.length).toBeGreaterThan(0);

    const second = saveProfile({
      home: { latitude: 51.5, longitude: -0.12, place: "London" },
    });
    // Birth survived the second save (field-wise merge), home was added.
    expect(second.birth?.datetimeLocal).toBe("1990-05-01T08:30:00");
    expect(second.birth?.place).toBe("New York");
    expect(second.home?.place).toBe("London");
    expect(second.home?.latitude).toBe(51.5);

    // Reloading from disk yields the same merged profile.
    const reloaded = loadProfile();
    expect(reloaded).not.toBeNull();
    expect(reloaded!.birth?.place).toBe("New York");
    expect(reloaded!.home?.place).toBe("London");

    // updatedAt is refreshed (monotonic, non-decreasing) on each save.
    expect(
      new Date(second.updatedAt).getTime(),
    ).toBeGreaterThanOrEqual(new Date(first.updatedAt).getTime());
  });

  it("merges nested birth fields without dropping prior keys", () => {
    saveProfile({
      birth: { datetimeLocal: "2000-01-01T00:00:00", latitude: 1, longitude: 2 },
    });
    const merged = saveProfile({ birth: { place: "Quito" } as never });
    expect(merged.birth?.datetimeLocal).toBe("2000-01-01T00:00:00");
    expect(merged.birth?.latitude).toBe(1);
    expect(merged.birth?.place).toBe("Quito");
  });
});

describe("clearProfile", () => {
  it("removes a saved profile", () => {
    saveProfile({ home: { latitude: 0, longitude: 0 } });
    expect(loadProfile()).not.toBeNull();
    clearProfile();
    expect(loadProfile()).toBeNull();
  });

  it("is a no-op when nothing has been saved", () => {
    expect(() => clearProfile()).not.toThrow();
    expect(loadProfile()).toBeNull();
  });
});

describe("appendJournal / loadJournal", () => {
  it("assigns a non-empty id and askedAt", () => {
    const stored = appendJournal({
      question: "Should I take the job?",
      kind: "horary",
    });
    expect(typeof stored.id).toBe("string");
    expect(stored.id.length).toBeGreaterThan(0);
    expect(typeof stored.askedAt).toBe("string");
    expect(stored.askedAt.length).toBeGreaterThan(0);
  });

  it("round-trips multiple entries with distinct ids", () => {
    const a = appendJournal({ question: "Q1", kind: "horary" });
    const b = appendJournal({ question: "Q2", kind: "electional" });
    const c = appendJournal({ question: "Q3", kind: "natal" });

    const loaded = loadJournal();
    expect(loaded).toHaveLength(3);
    expect(loaded.map((e) => e.question)).toEqual(["Q1", "Q2", "Q3"]);

    const ids = [a.id, b.id, c.id];
    expect(new Set(ids).size).toBe(3); // all distinct
    expect(loaded.map((e) => e.id)).toEqual(ids); // persisted ids match returned
  });
});

describe("recordOutcome", () => {
  it("updates outcome and resolvedAt on the matching entry", () => {
    const entry = appendJournal({ question: "Will it rain?", kind: "horary" });
    expect(entry.outcome).toBeUndefined();
    expect(entry.resolvedAt).toBeUndefined();

    const updated = recordOutcome(entry.id, "happened", "it poured");
    expect(updated.id).toBe(entry.id);
    expect(updated.outcome).toBe("happened");
    expect(updated.outcomeNote).toBe("it poured");
    expect(typeof updated.resolvedAt).toBe("string");
    expect(updated.resolvedAt!.length).toBeGreaterThan(0);

    // Persisted: reload shows exactly one entry, now resolved.
    const loaded = loadJournal();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].outcome).toBe("happened");
    expect(loaded[0].resolvedAt).toBe(updated.resolvedAt);
  });

  it("resolves the right entry among several without disturbing the rest", () => {
    const a = appendJournal({ question: "Q1", kind: "horary" });
    const b = appendJournal({ question: "Q2", kind: "horary" });
    recordOutcome(b.id, "did-not-happen");

    const loaded = loadJournal();
    expect(loaded).toHaveLength(2);
    const reA = loaded.find((e) => e.id === a.id)!;
    const reB = loaded.find((e) => e.id === b.id)!;
    expect(reA.outcome).toBeUndefined();
    expect(reB.outcome).toBe("did-not-happen");
  });

  it("throws on an unknown id", () => {
    appendJournal({ question: "Q", kind: "horary" });
    expect(() => recordOutcome("does-not-exist", "happened")).toThrow();
  });

  it("rejects an outcome outside the allowed set", () => {
    const entry = appendJournal({ question: "Q", kind: "horary" });
    expect(() => recordOutcome(entry.id, "yes-it-did" as never)).toThrow(/outcome must be one of/);
    // The entry stays unresolved rather than being corrupted.
    expect(loadJournal()[0].outcome).toBeUndefined();
  });

  it("preserves a corrupt journal line through a rewrite instead of dropping it", () => {
    const a = appendJournal({ question: "Q1", kind: "horary" });
    // Simulate a torn write: a half-written, unparseable line appended after a.
    appendFileSync(join(dir, "journal.jsonl"), '{"id":"torn","question":"half\n');
    const b = appendJournal({ question: "Q2", kind: "horary" });

    recordOutcome(b.id, "happened");

    // Parseable entries still load (corrupt line is skipped on read)...
    const loaded = loadJournal();
    expect(loaded.map((e) => e.id).sort()).toEqual([a.id, b.id].sort());
    // ...but the corrupt line was NOT erased by the rewrite — it survives on disk.
    expect(readFileSync(join(dir, "journal.jsonl"), "utf8")).toContain('"half');
  });
});

describe("appendJournal validation", () => {
  it("rejects an unknown chart kind", () => {
    expect(() => appendJournal({ question: "Q", kind: "tarot" as never })).toThrow(/kind must be one of/);
  });

  it("rejects a malformed lean or confidence", () => {
    expect(() =>
      appendJournal({ question: "Q", kind: "horary", lean: "maybe" as never }),
    ).toThrow(/lean must be one of/);
    expect(() =>
      appendJournal({ question: "Q", kind: "horary", confidence: "very-high" as never }),
    ).toThrow(/confidence must be one of/);
  });
});

describe("computeCalibration", () => {
  // Seed the journal directly by appending fully-formed entries (overriding the
  // generated id so we control everything), then resolve outcomes via the API.
  function seed(
    entries: Array<Pick<JournalEntry, "lean" | "confidence"> & { outcome?: JournalEntry["outcome"] }>,
  ): void {
    entries.forEach((e, i) => {
      const stored = appendJournal({
        id: `e${i}`,
        question: `Q${i}`,
        kind: "horary",
        lean: e.lean,
        confidence: e.confidence,
      });
      if (e.outcome) recordOutcome(stored.id, e.outcome);
    });
  }

  it("computes per-band resolved/correct/hitRate over directional, resolved entries", () => {
    seed([
      // high band: 2 resolved, 1 correct -> 0.5
      { lean: "favorable", confidence: "high", outcome: "happened" }, // correct
      { lean: "favorable", confidence: "high", outcome: "did-not-happen" }, // wrong
      // medium band: 2 resolved, 2 correct -> 1.0
      { lean: "favorable", confidence: "medium", outcome: "happened" }, // correct
      { lean: "unfavorable", confidence: "medium", outcome: "did-not-happen" }, // correct
      // low band: 1 resolved, 0 correct -> 0.0
      { lean: "unfavorable", confidence: "low", outcome: "happened" }, // wrong
    ]);

    const report = computeCalibration();
    const byBand = Object.fromEntries(report.bands.map((b) => [b.confidence, b]));

    expect(byBand.high.resolved).toBe(2);
    expect(byBand.high.correct).toBe(1);
    expect(byBand.high.hitRate).toBe(0.5);

    expect(byBand.medium.resolved).toBe(2);
    expect(byBand.medium.correct).toBe(2);
    expect(byBand.medium.hitRate).toBe(1);

    expect(byBand.low.resolved).toBe(1);
    expect(byBand.low.correct).toBe(0);
    expect(byBand.low.hitRate).toBe(0);

    // Overall aggregates: 5 resolved, 3 correct.
    expect(report.overall.resolved).toBe(5);
    expect(report.overall.correct).toBe(3);
    expect(report.overall.hitRate).toBe(3 / 5);
    expect(report.unresolved).toBe(0);
    expect(report.total).toBe(5);
  });

  it("excludes uncertain leans and unresolved entries from resolved counts", () => {
    seed([
      { lean: "favorable", confidence: "high", outcome: "happened" }, // counts
      { lean: "uncertain", confidence: "high", outcome: "happened" }, // excluded: uncertain
      { lean: "favorable", confidence: "high" }, // excluded: unresolved (directional)
      { lean: "uncertain", confidence: "high" }, // excluded entirely: uncertain + unresolved
    ]);

    const report = computeCalibration();
    const high = report.bands.find((b) => b.confidence === "high")!;

    // Only the single resolved, directional entry is counted.
    expect(high.resolved).toBe(1);
    expect(high.correct).toBe(1);
    expect(high.hitRate).toBe(1);

    // The directional-but-unresolved entry contributes to unresolved; the two
    // "uncertain" entries are dropped before the resolved/unresolved split.
    expect(report.unresolved).toBe(1);
    expect(report.overall.resolved).toBe(1);
    expect(report.total).toBe(4);
  });

  it("gives a 'partial' outcome 0.5 credit regardless of lean", () => {
    seed([
      { lean: "favorable", confidence: "medium", outcome: "partial" },
      { lean: "unfavorable", confidence: "medium", outcome: "partial" },
    ]);

    const report = computeCalibration();
    const medium = report.bands.find((b) => b.confidence === "medium")!;
    expect(medium.resolved).toBe(2);
    expect(medium.correct).toBe(1); // 0.5 + 0.5
    expect(medium.hitRate).toBe(0.5);
  });

  it("reports null hitRate for bands with no resolved entries", () => {
    const report = computeCalibration();
    for (const band of report.bands) {
      expect(band.resolved).toBe(0);
      expect(band.hitRate).toBeNull();
    }
    expect(report.overall.hitRate).toBeNull();
  });
});
