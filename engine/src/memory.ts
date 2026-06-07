/*
 * memory.ts — local persistent memory for Kairos.
 *
 * Gives Kairos a private, on-disk memory so it can (a) remember the user
 * (birth + home), (b) log every reading to an append-only journal, and (c)
 * report its own calibration (hit-rate by confidence band).
 *
 * Storage is LOCAL ONLY — under the home dir, never synced. Birth data is
 * sensitive, so nothing here ever leaves the machine.
 */
import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ChartKind, Confidence, Lean } from "./types.js";

/** A place (lat/lon + optional zone/label) the user is associated with. */
export interface ProfilePlace {
  latitude: number;
  longitude: number;
  timezone?: string;
  place?: string;
}

/** The remembered user: where/when they were born and where they live now. */
export interface Profile {
  birth?: ProfilePlace & { datetimeLocal: string };
  home?: ProfilePlace;
  updatedAt: string;
}

/** How a logged reading actually turned out. */
export type Outcome = "happened" | "did-not-happen" | "partial" | "unknown";

/** One logged reading. Append-only; rewritten in place only to record outcome. */
export interface JournalEntry {
  id: string;
  askedAt: string;
  question: string;
  kind: ChartKind;
  quesitedHouse?: number;
  lean?: Lean;
  confidence?: Confidence;
  score?: number;
  outcome?: Outcome;
  outcomeNote?: string;
  resolvedAt?: string;
}

/** Calibration stats for a single confidence band. */
export interface CalibrationBand {
  confidence: Confidence;
  resolved: number;
  correct: number;
  hitRate: number | null;
}

/** Kairos's self-reported calibration across all resolved readings. */
export interface CalibrationReport {
  bands: CalibrationBand[];
  overall: { resolved: number; correct: number; hitRate: number | null };
  unresolved: number;
  total: number;
  note: string;
}

const PROFILE_FILE = "profile.json";
const JOURNAL_FILE = "journal.jsonl";

const VALID_KINDS = new Set<ChartKind>(["natal", "transit", "horary", "electional"]);
const VALID_LEANS = new Set<Lean>(["favorable", "unfavorable", "uncertain"]);
const VALID_CONFIDENCES = new Set<Confidence>(["low", "medium", "high"]);
const ALL_OUTCOMES = new Set<Outcome>(["happened", "did-not-happen", "partial", "unknown"]);

/** Current wall-clock time as an ISO-8601 string. */
function nowIso(): string {
  return new Date().toISOString();
}

/**
 * The memory root directory. Reads process.env at CALL time (not module load)
 * so tests can override KAIROS_HOME per-test.
 */
export function memoryHome(): string {
  return process.env.KAIROS_HOME || join(homedir(), ".kairos");
}

/** Ensure the memory dir exists before any write. */
function ensureHome(): string {
  const dir = memoryHome();
  mkdirSync(dir, { recursive: true });
  return dir;
}

function profilePath(): string {
  return join(memoryHome(), PROFILE_FILE);
}

function journalPath(): string {
  return join(memoryHome(), JOURNAL_FILE);
}

/**
 * Write the journal atomically: stage to a temp file, then rename over the
 * target. A crash mid-write leaves the old journal intact rather than a
 * half-truncated one — important because recordOutcome rewrites the whole file.
 */
function writeJournalAtomic(content: string): void {
  const path = journalPath();
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, content);
  renameSync(tmp, path);
}

/** Load the stored profile, or null if none has been saved yet. */
export function loadProfile(): Profile | null {
  const path = profilePath();
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Profile;
  } catch {
    return null;
  }
}

/**
 * Deep-merge a patch over the existing profile (birth/home merged field-wise),
 * refresh updatedAt, persist, and return the merged profile.
 */
export function saveProfile(patch: Partial<Profile>): Profile {
  ensureHome();
  const existing = loadProfile();
  const merged: Profile = {
    ...existing,
    ...patch,
    updatedAt: nowIso(),
  };
  if (existing?.birth || patch.birth) {
    merged.birth = { ...existing?.birth, ...patch.birth } as Profile["birth"];
  }
  if (existing?.home || patch.home) {
    merged.home = { ...existing?.home, ...patch.home } as Profile["home"];
  }
  writeFileSync(profilePath(), `${JSON.stringify(merged, null, 2)}\n`);
  return merged;
}

/** Forget the user: delete profile.json if present. */
export function clearProfile(): void {
  const path = profilePath();
  if (existsSync(path)) rmSync(path);
}

/**
 * Generate a journal id: epoch millis (base36, keeps ids time-sortable) + a
 * short random suffix (closes the same-millisecond collision window between
 * concurrent CLI invocations) + a counter against ids already in this snapshot.
 */
function nextId(existing: JournalEntry[]): string {
  const base = `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
  const taken = new Set(existing.map((e) => e.id));
  let counter = 0;
  let id = `${base}-${counter.toString(36)}`;
  while (taken.has(id)) {
    counter += 1;
    id = `${base}-${counter.toString(36)}`;
  }
  return id;
}

/**
 * Reject malformed enum fields before they reach the store — a mistyped kind,
 * lean, or confidence would otherwise persist silently and quietly skew
 * calibration (which filters on these values). Missing lean/confidence is fine.
 */
function validateEntryFields(entry: {
  kind?: unknown;
  lean?: unknown;
  confidence?: unknown;
}): void {
  if (entry.kind == null || !VALID_KINDS.has(entry.kind as ChartKind)) {
    throw new Error(
      `kind must be one of ${[...VALID_KINDS].join(", ")}, got ${JSON.stringify(entry.kind)}`,
    );
  }
  if (entry.lean != null && !VALID_LEANS.has(entry.lean as Lean)) {
    throw new Error(
      `lean must be one of ${[...VALID_LEANS].join(", ")}, got ${JSON.stringify(entry.lean)}`,
    );
  }
  if (entry.confidence != null && !VALID_CONFIDENCES.has(entry.confidence as Confidence)) {
    throw new Error(
      `confidence must be one of ${[...VALID_CONFIDENCES].join(", ")}, got ${JSON.stringify(entry.confidence)}`,
    );
  }
}

/** Read the journal, skipping blank or corrupt lines defensively. */
export function loadJournal(): JournalEntry[] {
  const path = journalPath();
  if (!existsSync(path)) return [];
  const entries: JournalEntry[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      entries.push(JSON.parse(trimmed) as JournalEntry);
    } catch {
      // Skip a corrupt line rather than failing the whole read.
    }
  }
  return entries;
}

/**
 * Append a reading to the journal. Assigns id and askedAt if absent, writes one
 * JSON line, and returns the stored entry (so the caller can keep the id).
 */
export function appendJournal(
  entry: Omit<JournalEntry, "id" | "askedAt"> & Partial<Pick<JournalEntry, "id" | "askedAt">>,
): JournalEntry {
  validateEntryFields(entry);
  ensureHome();
  const existing = loadJournal();
  const stored: JournalEntry = {
    ...entry,
    id: entry.id ?? nextId(existing),
    askedAt: entry.askedAt ?? nowIso(),
  };
  writeFileSync(journalPath(), `${JSON.stringify(stored)}\n`, { flag: "a" });
  return stored;
}

/**
 * Record how a reading turned out: set outcome/outcomeNote/resolvedAt on the
 * matching entry, then rewrite the whole journal atomically. Corrupt/partial
 * lines are preserved verbatim (never silently dropped by the rewrite), and the
 * write is staged-then-renamed so an interrupted call can't truncate the file.
 * Throws on an unknown outcome or an id that isn't present.
 */
export function recordOutcome(id: string, outcome: Outcome, note?: string): JournalEntry {
  if (!ALL_OUTCOMES.has(outcome)) {
    throw new Error(`outcome must be one of ${[...ALL_OUTCOMES].join(", ")}, got ${JSON.stringify(outcome)}`);
  }
  ensureHome();
  const path = journalPath();
  const rawLines = existsSync(path) ? readFileSync(path, "utf8").split("\n") : [];
  let updated: JournalEntry | null = null;
  const out: string[] = [];
  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let parsed: JournalEntry | null = null;
    try {
      parsed = JSON.parse(trimmed) as JournalEntry;
    } catch {
      // Preserve an unparseable line as-is rather than erasing it on rewrite.
      out.push(trimmed);
      continue;
    }
    if (!updated && parsed.id === id) {
      updated = { ...parsed, outcome, outcomeNote: note, resolvedAt: nowIso() };
      out.push(JSON.stringify(updated));
    } else {
      out.push(JSON.stringify(parsed));
    }
  }
  if (!updated) throw new Error(`no journal entry with id "${id}"`);
  writeJournalAtomic(out.length ? `${out.join("\n")}\n` : "");
  return updated;
}

const CONFIDENCE_BANDS: Confidence[] = ["low", "medium", "high"];
const RESOLVED_OUTCOMES = new Set<Outcome>(["happened", "did-not-happen", "partial"]);

/** Credit (0..1) a directional verdict earns given its outcome. */
function creditFor(lean: Lean, outcome: Outcome): number {
  if (outcome === "partial") return 0.5;
  if (lean === "favorable" && outcome === "happened") return 1;
  if (lean === "unfavorable" && outcome === "did-not-happen") return 1;
  return 0;
}

/**
 * Compute Kairos's calibration: hit-rate by confidence band over resolved,
 * directional (favorable/unfavorable) readings. "partial" counts as half credit.
 */
export function computeCalibration(): CalibrationReport {
  const entries = loadJournal();
  const bands: CalibrationBand[] = CONFIDENCE_BANDS.map((confidence) => ({
    confidence,
    resolved: 0,
    correct: 0,
    hitRate: null,
  }));

  let unresolved = 0;
  for (const entry of entries) {
    const lean = entry.lean;
    if (lean !== "favorable" && lean !== "unfavorable") continue;
    const resolved = entry.outcome != null && RESOLVED_OUTCOMES.has(entry.outcome);
    if (!resolved) {
      unresolved += 1;
      continue;
    }
    const band = bands.find((b) => b.confidence === entry.confidence);
    if (!band) continue;
    band.resolved += 1;
    band.correct += creditFor(lean, entry.outcome as Outcome);
  }

  for (const band of bands) {
    band.hitRate = band.resolved === 0 ? null : band.correct / band.resolved;
  }

  const resolved = bands.reduce((sum, b) => sum + b.resolved, 0);
  const correct = bands.reduce((sum, b) => sum + b.correct, 0);

  return {
    bands,
    overall: {
      resolved,
      correct,
      hitRate: resolved === 0 ? null : correct / resolved,
    },
    unresolved,
    total: entries.length,
    note: "Small samples are noisy — this is a personal pattern, not proof.",
  };
}
