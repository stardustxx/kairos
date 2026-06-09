/*
 * almuten.ts — the almuten (al-mubtazz) of a degree: the planet that holds the
 * most essential dignity at a given ecliptic longitude, and therefore has the
 * strongest "say" over whatever sits there.
 *
 * It sums the SAME Lilly point values used in dignities.ts across the essential
 * dignities (domicile=5, exaltation=4, triplicity[by sect]=3, term=2, face=1,
 * plus the Dorothean PARTICIPATING triplicity ruler=1) for each of the seven
 * classical planets, and picks the highest total. This is sometimes NOT the
 * simple domicile ruler: a planet that exalts, rules the triplicity, and bounds
 * the term can out-dignify the lord of the sign — and the participating ruler's
 * +1 can now tip a tie or carry a peregrine degree.
 *
 * Tie-break (deterministic, documented):
 *   1. Higher total essential-dignity score wins.
 *   2. On an exact tie, the planet contributing the WEIGHTIER single dignity
 *      wins (domicile > exaltation > triplicity > term > face > participating).
 *      Participating ranks LAST: though it shares the +1 value of face, face is
 *      one of the canonical five dignities and outranks the supplementary share.
 *   3. Still tied: traditional Chaldean order
 *      (Saturn, Jupiter, Mars, Sun, Venus, Mercury, Moon).
 */
import { dignityLordsAtDegree } from "./dignities.js";

// Lilly point values for the essential dignities (mirrors dignities.ts), with
// the Dorothean participating triplicity ruler as a +1 minor dignity.
const DIGNITY_POINTS = { domicile: 5, exaltation: 4, triplicity: 3, term: 2, face: 1, triplicityParticipating: 1 } as const;

// Dignity kinds ordered by weight (weightiest first) — drives both the tie-break
// "weightier single dignity" rule and the order of the breakdown sources. The
// participating triplicity ruler is appended LAST (a +1 supplementary share,
// below face).
const DIGNITY_ORDER = ["domicile", "exaltation", "triplicity", "term", "face", "triplicityParticipating"] as const;
type DignityKind = (typeof DIGNITY_ORDER)[number];

// The seven classical planets in Chaldean order (slowest..fastest). Used as the
// final deterministic tie-break and as the canonical breakdown ordering.
const CHALDEAN_ORDER = ["Saturn", "Jupiter", "Mars", "Sun", "Venus", "Mercury", "Moon"] as const;

/** One planet's essential-dignity tally at a degree. */
export interface AlmutenContribution {
  planet: string;
  points: number;
  /** Which dignities contributed, weightiest-first, e.g. ["exaltation (+4)", "face (+1)"]. */
  sources: string[];
}

export interface AlmutenResult {
  /** The winning planet — the most dignified at the degree. */
  planet: string;
  /** Its total essential-dignity score. */
  score: number;
  /** Every classical planet's tally (Chaldean order), winner derivable from this. */
  breakdown: AlmutenContribution[];
}

/**
 * Compute the almuten (most essentially dignified planet) at `longitude` for a
 * chart of the given `sect`. Returns the winner, its score, and a full
 * per-planet breakdown.
 */
export function almutenOfDegree(longitude: number, sect: "day" | "night"): AlmutenResult {
  const lords = dignityLordsAtDegree(longitude, sect);

  // Map each dignity kind to the planet holding it at this degree. The
  // participating triplicity ruler is suppressed when it coincides with the
  // in-sect triplicity ruler so a single planet never collects both the +3 and
  // the +1 (the Dorothean tables keep them distinct; this is a defensive guard).
  const lordOf: Record<DignityKind, string | null> = {
    domicile: lords.domicile,
    exaltation: lords.exaltation,
    triplicity: lords.triplicity,
    term: lords.term,
    face: lords.face,
    triplicityParticipating:
      lords.triplicityParticipating === lords.triplicity ? null : lords.triplicityParticipating,
  };

  // Tally points + sources per planet, walking dignities weightiest-first so the
  // sources list is naturally ordered by weight.
  const contributions = new Map<string, AlmutenContribution>();
  for (const planet of CHALDEAN_ORDER) {
    contributions.set(planet, { planet, points: 0, sources: [] });
  }
  for (const kind of DIGNITY_ORDER) {
    const planet = lordOf[kind];
    if (planet == null) continue; // no planet exalts in some signs
    const c = contributions.get(planet);
    if (!c) continue; // ignore any non-classical lord (defensive; tables are classical)
    c.points += DIGNITY_POINTS[kind];
    const label = kind === "triplicityParticipating" ? "participating triplicity" : kind;
    c.sources.push(`${label} (+${DIGNITY_POINTS[kind]})`);
  }

  const breakdown = CHALDEAN_ORDER.map((p) => contributions.get(p)!);

  // Highest score; weightier single dignity; then Chaldean order.
  const weightiestRank = (c: AlmutenContribution): number => {
    // Lower index = weightier. Use the first (weightiest) source it owns.
    for (let i = 0; i < DIGNITY_ORDER.length; i++) {
      const kind = DIGNITY_ORDER[i];
      if (lordOf[kind] === c.planet) return i;
    }
    return DIGNITY_ORDER.length; // no dignity at all (peregrine): rank last
  };

  const winner = breakdown.reduce((best, c) => {
    if (c.points !== best.points) return c.points > best.points ? c : best;
    const rc = weightiestRank(c);
    const rb = weightiestRank(best);
    if (rc !== rb) return rc < rb ? c : best;
    // Still tied: Chaldean order — keep `best` since breakdown is already in
    // Chaldean order and `best` was encountered first.
    return best;
  });

  return { planet: winner.planet, score: winner.points, breakdown };
}
