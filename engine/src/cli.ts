import { readFileSync } from "node:fs";
import { computeCrossAspects } from "./aspects.js";
import { buildChart, relocateChart } from "./chart.js";
import { searchElectionalMoments } from "./electional.js";
import { judgeHorary } from "./horary.js";
import { computePositions } from "./positions.js";
import { resolveJulianDay } from "./time.js";
import type { ComputeRequest, ComputeResult } from "./types.js";
import { validateRequest } from "./validate.js";

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
  }

  if (req.kind === "horary") {
    if (req.quesitedHouse == null) {
      throw new Error("horary request requires `quesitedHouse` (2..12)");
    }
    result.horary = judgeHorary(chart, req.quesitedHouse);
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

  return result;
}

function readStdin(): string {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

// Executed only when run as a script (not when imported by tests).
if (process.argv[1]?.endsWith("cli.ts")) {
  const raw = process.argv[2] ?? readStdin();
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
