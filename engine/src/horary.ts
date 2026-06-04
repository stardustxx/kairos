import { SIGN_RULER, PLANETS, DEGREES_PER_SIGN, SIGN_COUNT } from "./constants.js";
import { computeAspects } from "./aspects.js";
import { houseOf } from "./houses.js";
import type { Aspect, Chart, HoraryJudgment, PlanetPosition } from "./types.js";

function rulerOfCusp(cuspLongitude: number): string {
  const signIndex = Math.floor(cuspLongitude / DEGREES_PER_SIGN) % SIGN_COUNT;
  return SIGN_RULER[signIndex];
}

/** The Moon is void of course if it forms no further major aspect before
 *  leaving its current sign. Traditionally only the 7 classical planets count.
 *
 *  NOTE: v1 approximation — this compares the tightest applying aspect's current
 *  orb to the Moon's remaining arc in its sign, not the exact relative-motion
 *  perfection time. */
export function moonVoidStatus(planets: PlanetPosition[]): { void: boolean; next: Aspect | null } {
  const moon = planets.find((p) => p.name === "Moon")!;
  const degreesToSignEnd = DEGREES_PER_SIGN - moon.degInSign;
  // Restrict to the classical bodies (Moon + the 6 other traditional planets).
  const classicalNames = new Set(PLANETS.filter((d) => d.classical).map((d) => d.name));
  const classical = planets.filter((p) => classicalNames.has(p.name));
  // Find the Moon's next applying major aspect to any classical body.
  const aspectsWithMoon = computeAspects(classical).filter(
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

  const querentSignificatorHouse = sigA ? houseOf(sigA.longitude, chart.houses.cusps) : 0;
  const quesitedSignificatorHouse = sigB ? houseOf(sigB.longitude, chart.houses.cusps) : 0;

  const moon = moonVoidStatus(chart.planets);
  return {
    querentSignificator: querentSig,
    quesitedSignificator: quesitedSig,
    querentSignificatorHouse,
    quesitedSignificatorHouse,
    significatorAspect,
    moonVoidOfCourse: moon.void,
    moonNextAspect: moon.next,
  };
}
