import { describe, expect, it } from "vitest";
import { antisciaContacts, antiscion, contraAntiscion } from "./antiscia.js";
import type { PlanetPosition } from "./types.js";

function body(name: string, longitude: number): PlanetPosition {
  return { name, longitude, eclipticLatitude: 0, sign: "Aries", degInSign: 0, retrograde: false, speed: 0 };
}

describe("antiscion / contraAntiscion", () => {
  it("10° Gemini (70°) -> antiscion 110° (20° Cancer)", () => {
    expect(antiscion(70)).toBeCloseTo(110, 9);
  });

  it("10° Gemini (70°) -> contra-antiscion 290° (20° Capricorn)", () => {
    expect(contraAntiscion(70)).toBeCloseTo(290, 9);
  });

  it("wraps into 0..360", () => {
    expect(antiscion(200)).toBeCloseTo(340, 9); // 180 - 200 = -20 -> 340
    expect(contraAntiscion(0)).toBeCloseTo(0, 9); // 360 mod 360
  });
});

describe("antisciaContacts", () => {
  it("flags an antiscia contact (one body on another's antiscion)", () => {
    // antiscion(70) = 110. Place a second body at 110.3 -> within 1° orb.
    const planets = [body("Mercury", 70), body("Venus", 110.3)];
    const contacts = antisciaContacts(planets, 1);
    const hit = contacts.find((c) => c.kind === "antiscia");
    expect(hit).toBeDefined();
    expect(hit!.orb).toBeCloseTo(0.3, 6);
    // De-duped: a single unordered pair, not two.
    expect(contacts.filter((c) => c.kind === "antiscia").length).toBe(1);
  });

  it("flags a contra-antiscia contact", () => {
    // contraAntiscion(70) = 290. Place a body at 290.5 -> within 1° orb.
    const planets = [body("Mercury", 70), body("Saturn", 290.5)];
    const contacts = antisciaContacts(planets, 1);
    const hit = contacts.find((c) => c.kind === "contra-antiscia");
    expect(hit).toBeDefined();
    expect(hit!.orb).toBeCloseTo(0.5, 6);
  });

  it("misses when the offset exceeds the orb", () => {
    const planets = [body("Mercury", 70), body("Venus", 112)]; // 2° from antiscion 110
    expect(antisciaContacts(planets, 1)).toHaveLength(0);
  });
});
