import { describe, expect, it } from "vitest";
import { almutenOfDegree } from "./almuten.js";

/**
 * Hand-verified cases. Longitudes are absolute ecliptic degrees
 * (Aries 0°=0, Taurus 0°=30, Libra 0°=180, ...). Dignity lords come straight
 * from the tables in dignities.ts (Ptolemaic exaltations, Dorothean
 * triplicities, Egyptian terms, Chaldean faces).
 */
describe("almutenOfDegree", () => {
  it("8° Aries by day — exaltation+triplicity Sun out-dignifies domicile Mars", () => {
    // 8° Aries (lon 8). Domicile=Mars, exalt=Sun, Fire-day triplicity=Sun,
    // term (8<12)=Venus, face (8<10)=Mars.
    //   Sun   = exaltation 4 + triplicity 3 = 7
    //   Mars  = domicile 5  + face 1        = 6
    //   Venus = term 2                      = 2
    // Almuten = Sun (7), NOT the domicile ruler Mars.
    const r = almutenOfDegree(8, "day");
    expect(r.planet).toBe("Sun");
    expect(r.score).toBe(7);

    const by = Object.fromEntries(r.breakdown.map((c) => [c.planet, c.points]));
    expect(by.Sun).toBe(7);
    expect(by.Mars).toBe(6);
    expect(by.Venus).toBe(2);

    const sun = r.breakdown.find((c) => c.planet === "Sun")!;
    expect(sun.sources).toEqual(["exaltation (+4)", "triplicity (+3)"]);
  });

  it("8° Aries by night — triplicity shifts to Jupiter, domicile Mars wins", () => {
    // Same degree, night: Fire-night triplicity=Jupiter (not Sun).
    //   Mars    = domicile 5 + face 1 = 6
    //   Sun     = exaltation 4        = 4
    //   Jupiter = triplicity 3        = 3
    //   Venus   = term 2              = 2
    // Almuten = Mars (6).
    const r = almutenOfDegree(8, "night");
    expect(r.planet).toBe("Mars");
    expect(r.score).toBe(6);

    const by = Object.fromEntries(r.breakdown.map((c) => [c.planet, c.points]));
    expect(by.Mars).toBe(6);
    expect(by.Sun).toBe(4);
    expect(by.Jupiter).toBe(3);
    expect(by.Venus).toBe(2);
  });

  it("18° Libra by night — exact tie at 5 broken by weightier dignity (domicile > exaltation)", () => {
    // 18° Libra (lon 198). Domicile=Venus, exalt=Saturn, Air-night triplicity=Mercury,
    // Air PARTICIPATING triplicity=Jupiter (co-rules day+night, +1),
    // term (18<21)=Jupiter, face (10-20)=Saturn.
    //   Venus  = domicile 5                         = 5
    //   Saturn = exaltation 4 + face 1              = 5   <- ties Venus on total
    //   Mercury= triplicity 3                       = 3
    //   Jupiter= term 2 + participating triplicity 1= 3   <- participating adds +1
    // Tie at 5: Venus's weightiest dignity is domicile (rank 0),
    // Saturn's is exaltation (rank 1) -> domicile wins. Almuten = Venus.
    const r = almutenOfDegree(198, "night");
    expect(r.planet).toBe("Venus");
    expect(r.score).toBe(5);

    const by = Object.fromEntries(r.breakdown.map((c) => [c.planet, c.points]));
    expect(by.Venus).toBe(5);
    expect(by.Saturn).toBe(5);
    expect(by.Mercury).toBe(3);
    // Jupiter = term (+2) + Air participating triplicity (+1) = 3 (was 2 before
    // the participating ruler was added).
    expect(by.Jupiter).toBe(3);
    const jupiter = r.breakdown.find((c) => c.planet === "Jupiter")!;
    expect(jupiter.sources).toEqual(["term (+2)", "participating triplicity (+1)"]);

    const saturn = r.breakdown.find((c) => c.planet === "Saturn")!;
    expect(saturn.sources).toEqual(["exaltation (+4)", "face (+1)"]);
  });

  it("19° Cancer by day — participating triplicity (+1) flips the almuten to the Moon", () => {
    // 19° Cancer (lon 109.5), DAY. Domicile=Moon, exalt=Jupiter,
    // Water-day triplicity=Venus, Water PARTICIPATING triplicity=Moon (+1),
    // term (Cancer 19–26)=Jupiter, face (10–20)=Mercury.
    //   Jupiter = exaltation 4 + term 2                        = 6
    //   Moon    = domicile 5 + participating triplicity 1      = 6   <- tie via +1
    //   Venus   = triplicity 3                                 = 3
    //   Mercury = face 1                                       = 1
    // WITHOUT the participating ruler the Moon would score only 5 and Jupiter (6)
    // would be almuten. The +1 ties the Moon at 6, and the tie-break (domicile
    // rank 0 beats exaltation rank 1) hands the win to the Moon. So the
    // participating ruler changes the almuten.
    const r = almutenOfDegree(109.5, "day");
    expect(r.planet).toBe("Moon");
    expect(r.score).toBe(6);

    const by = Object.fromEntries(r.breakdown.map((c) => [c.planet, c.points]));
    expect(by.Moon).toBe(6);
    expect(by.Jupiter).toBe(6);
    expect(by.Venus).toBe(3);
    expect(by.Mercury).toBe(1);

    const moon = r.breakdown.find((c) => c.planet === "Moon")!;
    expect(moon.sources).toEqual(["domicile (+5)", "participating triplicity (+1)"]);
  });

  it("breakdown lists all 7 classical planets in Chaldean order", () => {
    const r = almutenOfDegree(8, "day");
    expect(r.breakdown.map((c) => c.planet)).toEqual([
      "Saturn",
      "Jupiter",
      "Mars",
      "Sun",
      "Venus",
      "Mercury",
      "Moon",
    ]);
  });
});
