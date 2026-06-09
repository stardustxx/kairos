import { describe, expect, it } from "vitest";
import { FIXED_STARS, precessedLongitude, starContacts } from "./fixedstars.js";
import type { PlanetPosition } from "./types.js";

/** Minimal planet for contact tests — only name + longitude matter here. */
function body(name: string, longitude: number): PlanetPosition {
  return { name, longitude, eclipticLatitude: 0, sign: "Aries", degInSign: 0, retrograde: false, speed: 0 };
}

const regulus = FIXED_STARS.find((s) => s.name === "Regulus")!.lonJ2000;

describe("precessedLongitude", () => {
  it("leaves J2000 longitudes unchanged at year 2000", () => {
    expect(precessedLongitude(149.8, 2000)).toBeCloseTo(149.8, 6);
  });

  it("advances Regulus ~0.014°/yr: 149.8 (2000) -> ~150.2 (2028)", () => {
    const lon2028 = precessedLongitude(regulus, 2028);
    // 50.29"/yr * 28 / 3600 = 0.391° of drift.
    expect(lon2028).toBeCloseTo(150.19, 2);
    expect(lon2028 - regulus).toBeCloseTo(0.391, 2);
  });
});

describe("starContacts", () => {
  const year = 2028;
  const regulus2028 = precessedLongitude(regulus, year);

  it("flags a planet placed exactly on a precessed star longitude", () => {
    const planets = [body("Mars", regulus2028)];
    const contacts = starContacts(planets, { ascendant: 0, mc: 90 }, year, 1);
    const hit = contacts.find((c) => c.star === "Regulus" && c.body === "Mars");
    expect(hit).toBeDefined();
    expect(hit!.orb).toBeCloseTo(0, 6);
    expect(hit!.longitude).toBeCloseTo(regulus2028, 6);
  });

  it("does not flag a planet just outside the orb", () => {
    const planets = [body("Mars", regulus2028 + 1.2)];
    const contacts = starContacts(planets, { ascendant: 0, mc: 90 }, year, 1);
    expect(contacts.find((c) => c.star === "Regulus" && c.body === "Mars")).toBeUndefined();
  });

  it("flags Asc/MC contacts and sorts by tightest orb", () => {
    const contacts = starContacts(
      [],
      { ascendant: regulus2028 + 0.8, mc: regulus2028 - 0.2 },
      year,
      1,
    );
    const regContacts = contacts.filter((c) => c.star === "Regulus");
    expect(regContacts.map((c) => c.body)).toEqual(["MC", "Ascendant"]);
    expect(regContacts[0].orb).toBeLessThan(regContacts[1].orb);
  });
});
