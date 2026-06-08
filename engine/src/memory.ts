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
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
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
  /** Human label for this person/context (e.g. "Partner", "Rectified 7:12am"). */
  label?: string;
  updatedAt: string;
}

/** A lightweight reference to a stored profile, keyed by its filesystem slug. */
export interface ProfileRef {
  slug: string;
  label?: string;
}

/** A profile plus the bits the CLI needs to render a listing. */
export interface ProfileListing extends ProfileRef {
  active: boolean;
  hasBirth: boolean;
  hasHome: boolean;
  updatedAt?: string;
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
  /** The plain-language verdict the model gave at log time (optional). Distinct
   * from `outcomeNote`, which records what actually HAPPENED on resolution. */
  verdictText?: string;
  outcome?: Outcome;
  outcomeNote?: string;
  resolvedAt?: string;
  /** When this reading is expected to be resolvable — the "ask me later" date. Set
   * from the horary timing's `perfectsAtUtc` when present (ISO-8601); absent
   * otherwise (the due resolver then falls back to a default lag past askedAt). */
  expectedResolutionAt?: string;
  /** Slug of the profile this reading is about. Absent on pre-multiprofile rows
   * (treated as the default profile). */
  ownerId?: string;
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
/** Directory holding one subdir per profile (each with its own profile.json). */
const PROFILES_DIR = "profiles";
/** Root-level pointer to the active profile: `{ "slug": "<slug>" }`. */
const ACTIVE_FILE = "active.json";
/** The reserved slug the migrated/original single user lives under. */
const DEFAULT_SLUG = "default";
/** Slugs are filesystem path segments, so keep them strict to prevent escape. */
const SLUG_RE = /^[a-z0-9-]+$/;

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

/** Throw on any slug that isn't a safe single path segment (no traversal). */
function assertSafeSlug(slug: string): void {
  if (!SLUG_RE.test(slug)) {
    throw new Error(`invalid profile slug ${JSON.stringify(slug)} (must match ${SLUG_RE})`);
  }
}

/** Turn a human label into a slug; fall back to a time-based id if it empties out. */
function slugify(label: string): string {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || `p-${Date.now().toString(36)}`;
}

function profilesRoot(): string {
  return join(memoryHome(), PROFILES_DIR);
}

function profileDir(slug: string): string {
  assertSafeSlug(slug);
  return join(profilesRoot(), slug);
}

function profilePath(slug: string): string {
  return join(profileDir(slug), PROFILE_FILE);
}

/** The journal is a single pooled file at the root (one track record). */
function journalPath(): string {
  return join(memoryHome(), JOURNAL_FILE);
}

function activePath(): string {
  return join(memoryHome(), ACTIVE_FILE);
}

/** Write the active-profile pointer atomically (stage to .tmp, then rename). */
function writeActivePointer(slug: string): void {
  ensureHome();
  const path = activePath();
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify({ slug }, null, 2)}\n`);
  renameSync(tmp, path);
}

/**
 * Lazily upgrade a pre-multiprofile store: a single `profile.json` at the root
 * becomes `profiles/default/profile.json`, and a root `active.json` is written
 * to mark the migration done. The pooled `journal.jsonl` stays at the root
 * untouched (its rows are attributed to the default profile on read).
 *
 * Idempotent and crash-safe: guarded by `active.json`; each step is a no-op if
 * already applied; the rename copies bytes verbatim (no parse), and a crash
 * before `active.json` lands simply re-runs (the moved data already resolves to
 * the default profile). Callers wrap this so a read on a read-only dir degrades
 * to the default path rather than throwing.
 */
function ensureMigrated(): void {
  if (existsSync(activePath())) return;
  const legacy = join(memoryHome(), PROFILE_FILE);
  if (!existsSync(legacy)) return; // fresh install (or journal-only) — nothing to move.
  mkdirSync(profileDir(DEFAULT_SLUG), { recursive: true });
  if (existsSync(legacy)) renameSync(legacy, profilePath(DEFAULT_SLUG));
  writeActivePointer(DEFAULT_SLUG); // last, so a crash before this re-runs safely.
}

/**
 * The slug of the active profile. Runs migration first (wrapped so reads never
 * throw), then reads `active.json`, defaulting to `default` when absent/garbled.
 */
export function activeSlug(): string {
  try {
    ensureMigrated();
    const path = activePath();
    if (!existsSync(path)) return DEFAULT_SLUG;
    const ptr = JSON.parse(readFileSync(path, "utf8")) as { slug?: unknown };
    return typeof ptr.slug === "string" && SLUG_RE.test(ptr.slug) ? ptr.slug : DEFAULT_SLUG;
  } catch {
    return DEFAULT_SLUG;
  }
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

/** Load a stored profile (the active one by default), or null if unsaved. */
export function loadProfile(slug: string = activeSlug()): Profile | null {
  const path = profilePath(slug);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Profile;
  } catch {
    return null;
  }
}

/**
 * Deep-merge a patch over a profile (the active one by default; birth/home
 * merged field-wise), refresh updatedAt, persist, and return the merged profile.
 */
export function saveProfile(patch: Partial<Profile>, slug: string = activeSlug()): Profile {
  ensureHome();
  mkdirSync(profileDir(slug), { recursive: true });
  const existing = loadProfile(slug);
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
  writeFileSync(profilePath(slug), `${JSON.stringify(merged, null, 2)}\n`);
  return merged;
}

/** Forget a profile's birth/home: delete its profile.json if present. */
export function clearProfile(slug: string = activeSlug()): void {
  const path = profilePath(slug);
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

/**
 * Read the pooled journal, skipping blank or corrupt lines defensively. With a
 * `slug`, return only that profile's entries (rows with no `ownerId` predate
 * multiprofile and count as the default profile); without one, return all.
 */
export function loadJournal(slug?: string): JournalEntry[] {
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
  if (slug == null) return entries;
  return entries.filter((e) => (e.ownerId ?? DEFAULT_SLUG) === slug);
}

/**
 * Append a reading to the pooled journal. Assigns id/askedAt if absent, stamps
 * the owning profile (the active one by default), writes one JSON line, and
 * returns the stored entry (so the caller can keep the id).
 */
export function appendJournal(
  entry: Omit<JournalEntry, "id" | "askedAt"> & Partial<Pick<JournalEntry, "id" | "askedAt">>,
  slug: string = activeSlug(),
): JournalEntry {
  validateEntryFields(entry);
  ensureHome();
  const existing = loadJournal();
  const stored: JournalEntry = {
    ...entry,
    id: entry.id ?? nextId(existing),
    askedAt: entry.askedAt ?? nowIso(),
    ownerId: entry.ownerId ?? slug,
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
export function computeCalibration(slug?: string): CalibrationReport {
  const entries = loadJournal(slug);
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

/** Default lag (ms) past `askedAt` before a timing-less reading is considered
 *  ripe — long enough that most matters have had a chance to resolve. */
const DEFAULT_LAG_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Logged-but-UNRESOLVED readings that are now ripe to ask about, most-ripe first.
 * A reading is ripe when its `expectedResolutionAt` is in the past; entries with
 * no expected-resolution date become ripe only after a default lag (30 days) past
 * `askedAt`. Resolved entries (any outcome) and not-yet-ripe ones are excluded.
 *
 * `nowIso` is injectable so tests are deterministic — they pass a fixed reference
 * "now" rather than depending on the real clock. Defaults to the wall clock.
 */
export function dueReadings(slug?: string, nowIso: string = new Date().toISOString()): JournalEntry[] {
  const now = new Date(nowIso).getTime();
  const ripe: Array<{ entry: JournalEntry; dueAt: number }> = [];
  for (const entry of loadJournal(slug)) {
    if (entry.outcome != null) continue; // already resolved
    const dueAt = entry.expectedResolutionAt
      ? new Date(entry.expectedResolutionAt).getTime()
      : new Date(entry.askedAt).getTime() + DEFAULT_LAG_MS;
    if (Number.isNaN(dueAt) || dueAt > now) continue; // not yet ripe (or unparseable)
    ripe.push({ entry, dueAt });
  }
  // Most-ripe first = oldest due date first (longest overdue).
  ripe.sort((a, b) => a.dueAt - b.dueAt);
  return ripe.map((r) => r.entry);
}

// ── Profile management ──────────────────────────────────────────────────────

/** Switch the active profile. Throws if no profile exists under `slug`. */
export function setActive(slug: string): ProfileRef {
  assertSafeSlug(slug);
  ensureMigrated();
  if (!existsSync(profileDir(slug))) throw new Error(`no profile "${slug}"`);
  writeActivePointer(slug);
  return { slug, label: loadProfile(slug)?.label };
}

/** List every stored profile, marking which one is active. */
export function listProfiles(): ProfileListing[] {
  ensureMigrated();
  const active = activeSlug();
  const root = profilesRoot();
  if (!existsSync(root)) return [];
  const slugs = readdirSync(root).filter((name) => {
    try {
      return SLUG_RE.test(name) && statSync(join(root, name)).isDirectory();
    } catch {
      return false;
    }
  });
  return slugs.map((slug) => {
    const profile = loadProfile(slug);
    return {
      slug,
      label: profile?.label,
      active: slug === active,
      hasBirth: profile?.birth != null,
      hasHome: profile?.home != null,
      updatedAt: profile?.updatedAt,
    };
  });
}

/**
 * Create a new profile from a human label (slugified, with `-2`/`-3`… added on
 * collision). Seeds birth/home from an optional patch. Does NOT switch active.
 */
export function createProfile(label: string, patch?: Partial<Profile>): ProfileRef {
  ensureMigrated();
  const base = slugify(label);
  let slug = base;
  for (let n = 2; existsSync(profileDir(slug)); n += 1) slug = `${base}-${n}`;
  saveProfile({ ...patch, label }, slug);
  return { slug, label };
}

/**
 * Delete a profile's birth/home (its `profiles/<slug>/` dir). Refuses to remove
 * the last remaining profile. If the removed profile was active, repoints active
 * to a surviving profile. Pooled journal rows owned by the slug are left intact
 * — the readings still happened and stay in the overall track record.
 */
export function removeProfile(slug: string): void {
  assertSafeSlug(slug);
  ensureMigrated();
  const all = listProfiles();
  if (all.length <= 1) throw new Error("cannot remove the last remaining profile");
  if (!all.some((p) => p.slug === slug)) throw new Error(`no profile "${slug}"`);
  rmSync(profileDir(slug), { recursive: true, force: true });
  if (activeSlug() === slug) {
    const survivor = all.find((p) => p.slug !== slug);
    if (survivor) writeActivePointer(survivor.slug);
  }
}
