import { SIGN_RULER, ASPECTS, SIGNS } from "./constants.js";
import { computeAspects } from "./aspects.js";
import type { Aspect, Chart, HoraryJudgment, PlanetPosition } from "./types.js";

function rulerOfCusp(cuspLongitude: number): string {
  const signIndex = Math.floor(cuspLongitude / 30) % 12;
  return SIGN_RULER[signIndex];
}

/** The Moon is void of course if it forms no further major aspect before
 *  leaving its current sign. */
function moonVoidOfCourse(planets: PlanetPosition[]): { void: boolean; next: Aspect | null } {
  const moon = planets.find((p) => p.name === "Moon")!;
  const degInSign = moon.longitude % 30;
  const degreesToSignEnd = 30 - degInSign;
  // Find the Moon's next applying major aspect to any classical body.
  const aspectsWithMoon = computeAspects(planets).filter(
    (a) => (a.a === "Moon" || a.b === "Moon") && a.applying,
  );
  if (aspectsWithMoon.length === 0) {
    return { void: true, next: null };
  }
  // Approximate degrees until exact for the tightest applying aspect.
  const next = aspectsWithMoon.reduce((best, a) => (a.orb < best.orb ? a : best));
  const isVoid = next.orb > degreesToSignEnd;
  return { void: isVoid, next };
}

export function judgeHorary(chart: Chart, quesitedHouse: number): HoraryJudgment {
  if (quesitedHouse < 2 || quesitedHouse > 12) {
    throw new Error(`quesitedHouse must be 2..12, got ${quesitedHouse}`);
  }
  const querentSig = rulerOfCusp(chart.houses.cusps[0]);
  const quesitedSig = rulerOfCusp(chart.houses.cusps[quesitedHouse - 1]);

  const sigA = chart.planets.find((p) => p.name === querentSig);
  const sigB = chart.planets.find((p) => p.name === quesitedSig);
  let significatorAspect: Aspect | null = null;
  if (sigA && sigB && sigA.name !== sigB.name) {
    const between = computeAspects([sigA, sigB]);
    const applying = between.filter((a) => a.applying);
    significatorAspect =
      (applying.length ? applying : between).sort((x, y) => x.orb - y.orb)[0] ?? null;
  }

  const moon = moonVoidOfCourse(chart.planets);
  return {
    querentSignificator: querentSig,
    quesitedSignificator: quesitedSig,
    significatorAspect,
    moonVoidOfCourse: moon.void,
    moonNextAspect: moon.next,
  };
}

// Re-exported for callers that want the sign list without importing constants.
export { SIGNS };
