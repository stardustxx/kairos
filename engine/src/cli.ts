import { readFileSync } from "node:fs";
import { buildChart } from "./chart.js";
import { computePositions } from "./positions.js";
import { resolveJulianDay } from "./time.js";
import { computeCrossAspects } from "./aspects.js";
import { judgeHorary } from "./horary.js";
import type { ComputeRequest, ComputeResult } from "./types.js";

export function runCompute(req: ComputeRequest): ComputeResult {
  const chart = buildChart(req.kind, req.moment);
  const result: ComputeResult = { chart };

  if (req.kind === "transit") {
    if (!req.natal) throw new Error("transit request requires a `natal` moment");
    const natalTime = resolveJulianDay(req.natal);
    const natalPlanets = computePositions(natalTime.julianDayUt);
    result.transitAspects = computeCrossAspects(chart.planets, natalPlanets);
  }

  if (req.kind === "horary") {
    if (req.quesitedHouse == null) {
      throw new Error("horary request requires `quesitedHouse` (2..12)");
    }
    result.horary = judgeHorary(chart, req.quesitedHouse);
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
if (process.argv[1] && process.argv[1].endsWith("cli.ts")) {
  const raw = process.argv[2] ?? readStdin();
  if (!raw.trim()) {
    console.error('Usage: pnpm compute \'{"kind":"horary","quesitedHouse":10,"moment":{...}}\'');
    process.exit(1);
  }
  try {
    const req = JSON.parse(raw) as ComputeRequest;
    process.stdout.write(JSON.stringify(runCompute(req), null, 2) + "\n");
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}
