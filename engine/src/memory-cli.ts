/*
 * memory-cli.ts — thin CLI over the Kairos memory store.
 *
 * Prints ONLY machine-readable JSON to stdout (the skill parses it; pnpm runs
 * with -s so there is no banner). Dispatches on process.argv[2].
 *
 *   pnpm -s memory profile get
 *   pnpm -s memory profile set '{"home":{"latitude":40.7,"longitude":-74}}'
 *   pnpm -s memory profile clear
 *   pnpm -s memory log '{"question":"...","kind":"horary","lean":"favorable"}'
 *   pnpm -s memory journal
 *   pnpm -s memory due            (alias: pending) — ripe unresolved readings
 *   pnpm -s memory outcome <id> happened it worked out
 *   pnpm -s memory calibration
 */

import {
  renderCalibrationCardMarkdown,
  renderCalibrationCardSvg,
} from "./calibration-card.js";
import type { JournalEntry, Outcome, Profile } from "./memory.js";
import {
  appendJournal,
  clearProfile,
  computeCalibration,
  createProfile,
  dueReadings,
  listProfiles,
  loadJournal,
  loadProfile,
  recordOutcome,
  removeProfile,
  saveProfile,
  setActive,
} from "./memory.js";
import { isMainModule } from "./run-guard.js";

const USAGE = [
  "Usage: pnpm -s memory <command> [--profile <slug>]",
  "  profile get",
  "  profile set <json>",
  "  profile clear",
  "  profile list",
  "  profile use <slug>",
  "  profile add <label> [json]",
  "  profile remove <slug>",
  "  log <json>",
  "  journal | journal list",
  "  due | pending",
  "  outcome <id> <happened|did-not-happen|partial|unknown> [note words...]",
  "  calibration [--card | --card svg]",
  "",
  "  --profile <slug>  run this one command against <slug> without switching the",
  "                    active profile (works with get/set/clear/log/journal/due/calibration)",
].join("\n");

function emit(value: unknown): void {
  process.stdout.write(JSON.stringify(value));
}

/** Strip a global `--profile <slug>` from anywhere in argv; return slug + rest. */
function extractProfileFlag(argv: string[]): { slug?: string; rest: string[] } {
  const rest: string[] = [];
  let slug: string | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--profile") {
      slug = argv[i + 1];
      if (!slug) throw new Error("--profile requires a slug");
      i += 1; // skip the value
    } else {
      rest.push(argv[i]);
    }
  }
  return { slug, rest };
}

/**
 * Memory CLI entrypoint. `args` is the post-script argv
 * (i.e. `process.argv.slice(2)`); the subcommand is args[0].
 */
export function main(args: string[]): void {
  // Parse the args, pulling out a global --profile <slug>.
  const { slug, rest } = extractProfileFlag(args);
  const command = rest[0];
  // When a slug is given, scope per-profile ops to it; else use the active one.
  const withSlug = <T>(fn: (slug?: string) => T): T => (slug ? fn(slug) : fn());

  switch (command) {
    case "profile": {
      const sub = rest[1];
      if (sub === "get") {
        emit(withSlug(loadProfile));
      } else if (sub === "set") {
        if (!rest[2]) throw new Error("profile set requires a JSON argument");
        const patch = JSON.parse(rest[2]) as Partial<Profile>;
        emit(withSlug((s) => (s ? saveProfile(patch, s) : saveProfile(patch))));
      } else if (sub === "clear") {
        withSlug(clearProfile);
        emit({ ok: true });
      } else if (sub === "list") {
        emit(listProfiles());
      } else if (sub === "use") {
        if (!rest[2]) throw new Error("profile use requires a slug");
        emit(setActive(rest[2]));
      } else if (sub === "add") {
        if (!rest[2]) throw new Error("profile add requires a label");
        const patch = rest[3] ? (JSON.parse(rest[3]) as Partial<Profile>) : undefined;
        emit(createProfile(rest[2], patch));
      } else if (sub === "remove") {
        if (!rest[2]) throw new Error("profile remove requires a slug");
        removeProfile(rest[2]);
        emit({ ok: true, removed: rest[2] });
      } else {
        process.stderr.write(USAGE);
        process.exit(1);
      }
      return;
    }
    case "log": {
      if (!rest[1]) throw new Error("log requires a JSON argument");
      const entry = JSON.parse(rest[1]) as Parameters<typeof appendJournal>[0];
      emit(withSlug((s) => (s ? appendJournal(entry, s) : appendJournal(entry))));
      return;
    }
    case "journal": {
      if (rest[1] != null && rest[1] !== "list") {
        process.stderr.write(USAGE);
        process.exit(1);
      }
      emit(withSlug(loadJournal) satisfies JournalEntry[]);
      return;
    }
    case "due":
    case "pending": {
      // Logged-but-unresolved readings that are now ripe to ask about (most-ripe
      // first). Uses the real clock here; the underlying fn takes an injectable
      // "now" for deterministic tests.
      emit(withSlug(dueReadings) satisfies JournalEntry[]);
      return;
    }
    case "outcome": {
      const id = rest[1];
      const outcome = rest[2] as Outcome | undefined;
      if (!id || !outcome) throw new Error("outcome requires <id> and <outcome>");
      const note = rest.slice(3).join(" ") || undefined;
      emit(recordOutcome(id, outcome, note));
      return;
    }
    case "calibration": {
      const report = withSlug(computeCalibration);
      // `--card` prints a rendered, shareable card (markdown by default, or SVG
      // with `--card svg`) as a RAW string instead of the usual JSON payload.
      const cardIdx = rest.indexOf("--card");
      if (cardIdx !== -1) {
        const format = rest[cardIdx + 1] === "svg" ? "svg" : "markdown";
        const card =
          format === "svg"
            ? renderCalibrationCardSvg(report)
            : renderCalibrationCardMarkdown(report);
        process.stdout.write(card);
        return;
      }
      emit(report);
      return;
    }
    default: {
      process.stderr.write(USAGE);
      process.exit(1);
    }
  }
}

// Executed only when run as a script (not when imported by tests/dispatcher).
if (isMainModule(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(JSON.stringify({ error: (err as Error).message }));
    process.exit(1);
  }
}
