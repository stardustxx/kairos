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
 *   pnpm -s memory outcome <id> happened it worked out
 *   pnpm -s memory calibration
 */

import type { JournalEntry, Outcome, Profile } from "./memory.js";
import {
  appendJournal,
  clearProfile,
  computeCalibration,
  loadJournal,
  loadProfile,
  recordOutcome,
  saveProfile,
} from "./memory.js";

const USAGE = [
  "Usage: pnpm -s memory <command>",
  "  profile get",
  "  profile set <json>",
  "  profile clear",
  "  log <json>",
  "  journal | journal list",
  "  outcome <id> <happened|did-not-happen|partial|unknown> [note words...]",
  "  calibration",
].join("\n");

function emit(value: unknown): void {
  process.stdout.write(JSON.stringify(value));
}

function main(): void {
  const argv = process.argv;
  const command = argv[2];

  switch (command) {
    case "profile": {
      const sub = argv[3];
      if (sub === "get") {
        emit(loadProfile());
      } else if (sub === "set") {
        if (!argv[4]) throw new Error("profile set requires a JSON argument");
        emit(saveProfile(JSON.parse(argv[4]) as Partial<Profile>));
      } else if (sub === "clear") {
        clearProfile();
        emit({ ok: true });
      } else {
        process.stderr.write(USAGE);
        process.exit(1);
      }
      return;
    }
    case "log": {
      if (!argv[3]) throw new Error("log requires a JSON argument");
      const entry = JSON.parse(argv[3]) as Parameters<typeof appendJournal>[0];
      emit(appendJournal(entry));
      return;
    }
    case "journal": {
      if (argv[3] != null && argv[3] !== "list") {
        process.stderr.write(USAGE);
        process.exit(1);
      }
      emit(loadJournal() satisfies JournalEntry[]);
      return;
    }
    case "outcome": {
      const id = argv[3];
      const outcome = argv[4] as Outcome | undefined;
      if (!id || !outcome) throw new Error("outcome requires <id> and <outcome>");
      const note = argv.slice(5).join(" ") || undefined;
      emit(recordOutcome(id, outcome, note));
      return;
    }
    case "calibration": {
      emit(computeCalibration());
      return;
    }
    default: {
      process.stderr.write(USAGE);
      process.exit(1);
    }
  }
}

// Executed only when run as a script (not when imported by tests).
if (process.argv[1]?.endsWith("memory-cli.ts")) {
  try {
    main();
  } catch (err) {
    process.stderr.write(JSON.stringify({ error: (err as Error).message }));
    process.exit(1);
  }
}
