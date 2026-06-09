import { readFileSync } from "node:fs";
import { computeCrossAspects } from "./aspects.js";
import { buildChart, relocateChart } from "./chart.js";
import { searchElectionalMoments } from "./electional.js";
import { judgeHorary } from "./horary.js";
import { appendJournal } from "./memory.js";
import { computePositions } from "./positions.js";
import { annualProfection, completedYearsBetween } from "./profections.js";
import { isMainModule } from "./run-guard.js";
import { resolveJulianDay } from "./time.js";
import type { ComputeRequest, ComputeResult } from "./types.js";
import { validateRequest } from "./validate.js";

/**
 * Auto-log this compute to the local journal as a side effect (opt-in via
 * `req.journal`). We capture the engine-derived fields HERE — kind, quesitedHouse,
 * and for horary the judgment's own lean/confidence/score — rather than trusting a
 * hand-copied second call, so the track record can't drift from what the engine
 * actually returned. Sets `expectedResolutionAt` from the horary timing's
 * perfectsAtUtc when present (the "ask me later" date). Mutates `result.journalId`.
 */
function autoLog(req: ComputeRequest, result: ComputeResult): void {
  if (!req.journal) return;
  const judgment = result.horary;
  const stored = appendJournal({
    question: req.journal.question,
    kind: req.kind,
    quesitedHouse: req.quesitedHouse,
    lean: judgment?.lean,
    confidence: judgment?.confidence,
    score: judgment?.score,
    verdictText: req.journal.verdictText,
    expectedResolutionAt: judgment?.timing?.perfectsAtUtc ?? undefined,
  });
  result.journalId = stored.id;
}

export function runCompute(req: ComputeRequest): ComputeResult {
  validateRequest(req);
  // Electional is window-based: it has no single chart, so handle it first.
  if (req.kind === "electional") {
    if (!req.window) throw new Error("electional request requires `window`");
    if (req.stepMinutes == null) {
      throw new Error("electional request requires `stepMinutes`");
    }
    if (!req.location) {
      throw new Error("electional request requires `location`");
    }
    if (req.quesitedHouse == null) {
      throw new Error("electional request requires `quesitedHouse` (2..12)");
    }
    const electional = searchElectionalMoments(
      req.window,
      req.stepMinutes,
      req.location,
      req.quesitedHouse,
      req.significatorHints,
    );
    const result: ComputeResult = { electional };
    // Attach the full chart of the #1 elected moment so it can be rendered/
    // inspected. Only one chart, so we keep exact aspect timing (default).
    const best = electional.topMoments[0];
    if (best) {
      result.chart = buildChart("electional", {
        ...req.location,
        datetimeLocal: best.datetimeLocal,
      });
    }
    autoLog(req, result);
    return result;
  }

  if (!req.moment) {
    throw new Error(`request of kind "${req.kind}" requires a \`moment\``);
  }
  const chart = buildChart(req.kind, req.moment);
  const result: ComputeResult = { chart };

  if (req.kind === "transit") {
    if (!req.natal) throw new Error("transit request requires a `natal` moment");
    const natalTime = resolveJulianDay(req.natal);
    const natalPlanets = computePositions(natalTime.julianDayUt);
    result.transitAspects = computeCrossAspects(
      chart.planets,
      natalPlanets,
      chart.julianDayUt,
    );

    // Annual profection (lord of the year): advance one whole sign from the
    // natal Ascendant per completed year of life, up to the transit moment.
    // (Natal-alone charts have no meaningful profection — age would be 0 and
    // simply return the natal Ascendant sign / 1st house.)
    const natalChart = buildChart("natal", req.natal);
    const age = completedYearsBetween(req.natal.datetimeLocal, req.moment.datetimeLocal);
    const profection = annualProfection(natalChart.houses.ascendant, age);
    // Look up where the Lord of the Year is "running" in the transit chart.
    const lord = chart.planets.find((p) => p.name === profection.lordOfYear);
    if (lord) {
      profection.lordOfYearPosition = {
        sign: lord.sign,
        house: lord.house!,
        retrograde: lord.retrograde,
      };
    }
    result.profection = profection;
  }

  if (req.kind === "horary") {
    if (req.quesitedHouse == null) {
      throw new Error("horary request requires `quesitedHouse` (2..12)");
    }
    result.horary = judgeHorary(chart, req.quesitedHouse, req.querentHouse);
  }

  // Relocation: recast this chart's houses/angles for another place (same moment).
  if (req.relocation) {
    if (req.relocation.latitude == null || req.relocation.longitude == null) {
      throw new Error("relocation requires `latitude` and `longitude`");
    }
    const relocated = relocateChart(
      chart,
      req.relocation.latitude,
      req.relocation.longitude,
      req.relocation.houseSystem,
    );
    const houseShifts = chart.planets
      .map((p) => {
        const rp = relocated.planets.find((q) => q.name === p.name)!;
        return { planet: p.name, fromHouse: p.house!, toHouse: rp.house! };
      })
      .filter((s) => s.fromHouse !== s.toHouse);
    result.relocation = {
      location: {
        latitude: req.relocation.latitude,
        longitude: req.relocation.longitude,
      },
      chart: relocated,
      houseShifts,
    };
  }

  autoLog(req, result);
  return result;
}

function readStdin(): string {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

/**
 * CLI entrypoint. `args` is the post-script argv (i.e. `process.argv.slice(2)`):
 * args[0] is the JSON request, falling back to stdin when absent.
 */
export function main(args: string[]): void {
  const raw = args[0] ?? readStdin();
  if (!raw.trim()) {
    console.error('Usage: pnpm compute \'{"kind":"horary","quesitedHouse":10,"moment":{...}}\'');
    process.exit(1);
  }
  try {
    const req = JSON.parse(raw) as ComputeRequest;
    process.stdout.write(`${JSON.stringify(runCompute(req), null, 2)}\n`);
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}

// Executed only when run as a script (not when imported by tests/dispatcher).
if (isMainModule(import.meta.url)) {
  main(process.argv.slice(2));
}
