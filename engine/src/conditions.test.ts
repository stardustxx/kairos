/*
 * conditions.test.ts — sunProximity classifies by TRUE angular separation from
 * the Sun's body (great-circle distance across longitude AND ecliptic latitude),
 * NOT by ecliptic-longitude difference alone.
 *
 * The bug this guards: a body within the cazimi window (17') IN LONGITUDE can be
 * several degrees away in ecliptic latitude — the Moon up to ~5.1°, the inner
 * planets several degrees — i.e. nowhere near the Sun's disc. Classifying on
 * longitude alone would wrongly award cazimi (+5, a sign-flip rescue) or combust
 * (-7) to a planet that is not actually burnt. Threading the body's ecliptic
 * latitude into the true-separation formula fixes that.
 */
import { describe, expect, it } from "vitest";
import { sunProximity } from "./conditions.js";

const SUN_LON = 100; // arbitrary Sun longitude; its ecliptic latitude is ~0.

describe("sunProximity uses true angular separation, not longitude alone", () => {
  it("17' in longitude but 3° in ecliptic latitude is NOT cazimi (true sep ~3°)", () => {
    // Δlon = 10' = 0.1667°, latitude = 3°. True separation ≈ hypot(0.167, 3) ≈ 3°,
    // far outside the 17' cazimi window — so the body is NOT in the Sun's heart.
    // (On longitude alone it would wrongly read cazimi.) At ~3° it lands in the
    // combust band (≤ 8.5°), which is the correct verdict: near but not cazimi.
    const r = sunProximity(SUN_LON + 10 / 60, SUN_LON, 3);
    expect(r.state).not.toBe("cazimi");
    expect(r.state).toBe("combust");
    expect(r.distanceDeg).toBeGreaterThan(2.9);
    expect(r.distanceDeg).toBeLessThan(3.1);
  });

  it("truly within 17' on BOTH longitude and latitude IS cazimi", () => {
    // Δlon = 10', latitude = 0.05° (3'). True separation ≈ hypot(10', 3') ≈ 10.4',
    // inside the 17' cazimi window — this body really is in the Sun's heart.
    const r = sunProximity(SUN_LON + 10 / 60, SUN_LON, 5 / 60);
    expect(r.state).toBe("cazimi");
    expect(r.distanceDeg).toBeLessThan(17 / 60);
  });

  it("arcminutes in longitude but ~5° latitude is NOT cazimi (the Moon case)", () => {
    // The Moon can sit within arcminutes of the Sun in longitude yet ~5° off in
    // latitude (away from an eclipse). 2' longitude, 5° latitude ⇒ true sep ~5°.
    // Longitude alone would award the +5 cazimi rescue; true separation correctly
    // says this is NOT cazimi — at ~5° it is combust (≤ 8.5°), not burnt-free.
    const r = sunProximity(SUN_LON + 2 / 60, SUN_LON, 5);
    expect(r.state).not.toBe("cazimi");
    expect(r.state).toBe("combust");
    expect(r.distanceDeg).toBeGreaterThan(4.9);
    expect(r.distanceDeg).toBeLessThan(5.1);
  });

  it("close in longitude but very high latitude is not even combust", () => {
    // 2' longitude, 12° latitude ⇒ true sep ~12°: beyond combust (8.5°), only
    // under the beams (≤ 15°). A wide-latitude body is not burnt at all.
    const r = sunProximity(SUN_LON + 2 / 60, SUN_LON, 12);
    expect(r.state).toBe("under-beams");
    expect(r.distanceDeg).toBeGreaterThan(11.9);
  });

  it("on the ecliptic (latitude 0) reduces to the longitude difference", () => {
    // Combust band: 5° in longitude, 0 latitude ⇒ true sep exactly 5°.
    const combust = sunProximity(SUN_LON + 5, SUN_LON, 0);
    expect(combust.state).toBe("combust");
    expect(combust.distanceDeg).toBeCloseTo(5, 6);

    // Default latitude argument (omitted) behaves the same as latitude 0.
    const defaulted = sunProximity(SUN_LON + 5, SUN_LON);
    expect(defaulted.distanceDeg).toBeCloseTo(5, 6);
    expect(defaulted.state).toBe("combust");
  });

  it("a true conjunction (0 separation) is cazimi", () => {
    const r = sunProximity(SUN_LON, SUN_LON, 0);
    expect(r.state).toBe("cazimi");
    expect(r.distanceDeg).toBeCloseTo(0, 9);
  });
});
