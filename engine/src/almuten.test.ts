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
    // term (18<21)=Jupiter, face (10-20)=Saturn.
    //   Venus  = domicile 5             = 5
    //   Saturn = exaltation 4 + face 1  = 5   <- ties Venus on total
    //   Mercury= triplicity 3           = 3
    //   Jupiter= term 2                 = 2
    // Tie at 5: Venus's weightiest dignity is domicile (rank 0),
    // Saturn's is exaltation (rank 1) -> domicile wins. Almuten = Venus.
    const r = almutenOfDegree(198, "night");
    expect(r.planet).toBe("Venus");
    expect(r.score).toBe(5);

    const by = Object.fromEntries(r.breakdown.map((c) => [c.planet, c.points]));
    expect(by.Venus).toBe(5);
    expect(by.Saturn).toBe(5);
    expect(by.Mercury).toBe(3);
    expect(by.Jupiter).toBe(2);

    const saturn = r.breakdown.find((c) => c.planet === "Saturn")!;
    expect(saturn.sources).toEqual(["exaltation (+4)", "face (+1)"]);
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
