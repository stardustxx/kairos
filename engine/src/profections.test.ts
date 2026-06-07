import { describe, expect, it } from "vitest";
import { annualProfection, completedYearsBetween } from "./profections.js";

/**
 * Hand-verified annual profections. Ascendant longitudes are absolute ecliptic
 * degrees (Aries 0°=0, Taurus 0°=30, Libra 0°=180, ...). Domicile rulers come
 * from SIGN_RULER in constants.ts. The cycle has period 12: age 0, 12, 24…
 * return to the natal Ascendant sign / 1st house.
 */
describe("annualProfection", () => {
  it("Aries Ascendant, age 0 — Aries / 1st / Mars", () => {
    const p = annualProfection(5, 0); // 5° Aries
    expect(p.age).toBe(0);
    expect(p.profectedSign).toBe("Aries");
    expect(p.profectedHouse).toBe(1);
    expect(p.lordOfYear).toBe("Mars");
  });

  it("Aries Ascendant, age 1 — Taurus / 2nd / Venus", () => {
    const p = annualProfection(5, 1);
    expect(p.profectedSign).toBe("Taurus");
    expect(p.profectedHouse).toBe(2);
    expect(p.lordOfYear).toBe("Venus");
  });

  it("Aries Ascendant, age 12 — wraps back to Aries / 1st / Mars", () => {
    const p = annualProfection(5, 12);
    expect(p.age).toBe(12);
    expect(p.profectedSign).toBe("Aries");
    expect(p.profectedHouse).toBe(1);
    expect(p.lordOfYear).toBe("Mars");
  });

  it("Aries Ascendant, age 30 — 30 mod 12 = 6 → Libra / 7th / Venus", () => {
    const p = annualProfection(5, 30);
    expect(p.profectedSign).toBe("Libra");
    expect(p.profectedHouse).toBe(7);
    expect(p.lordOfYear).toBe("Venus");
  });

  it("Scorpio Ascendant (non-Aries), age 3 — Aquarius / 4th / Saturn", () => {
    // 195° = 15° Libra? No: 195/30 = 6.5 → sign index 6 = Libra. Use Scorpio.
    // Scorpio = sign index 7; 7+3 = 10 → Aquarius; (3 mod 12)+1 = 4th; Aquarius ruler = Saturn.
    const p = annualProfection(7 * 30 + 12, 3); // 12° Scorpio
    expect(p.profectedSign).toBe("Aquarius");
    expect(p.profectedHouse).toBe(4);
    expect(p.lordOfYear).toBe("Saturn");
  });

  it("Cancer Ascendant, age 5 — Sagittarius / 6th / Jupiter", () => {
    // Cancer = index 3; 3+5 = 8 → Sagittarius; house = 6; Sagittarius ruler = Jupiter.
    const p = annualProfection(3 * 30 + 1, 5); // 1° Cancer
    expect(p.profectedSign).toBe("Sagittarius");
    expect(p.profectedHouse).toBe(6);
    expect(p.lordOfYear).toBe("Jupiter");
  });

  it("floors a fractional age", () => {
    const p = annualProfection(5, 1.9);
    expect(p.age).toBe(1);
    expect(p.profectedSign).toBe("Taurus");
  });
});

describe("completedYearsBetween", () => {
  it("counts full years and advances on the birthday", () => {
    // Born 1990-05-21; same calendar day in 2026 is the 36th birthday.
    expect(completedYearsBetween("1990-05-21T14:30:00", "2026-05-20T23:59:00")).toBe(35);
    expect(completedYearsBetween("1990-05-21T14:30:00", "2026-05-21T14:30:00")).toBe(36);
    expect(completedYearsBetween("1990-05-21T14:30:00", "2026-06-07T12:00:00")).toBe(36);
  });

  it("is 0 before the first birthday", () => {
    expect(completedYearsBetween("1990-05-21T14:30:00", "1990-12-01T00:00:00")).toBe(0);
    expect(completedYearsBetween("1990-05-21T14:30:00", "1991-05-20T00:00:00")).toBe(0);
    expect(completedYearsBetween("1990-05-21T14:30:00", "1991-05-21T14:30:00")).toBe(1);
  });

  it("respects the birthday time-of-day", () => {
    // Just before the exact birthday minute → still the prior year.
    expect(completedYearsBetween("1990-05-21T14:30:00", "1991-05-21T14:29:00")).toBe(0);
  });

  it("is DST-proof on an early-March birthday across years with different DST state", () => {
    // 1990-03-10 was standard time, 2026-03-10 is daylight time in US zones. A
    // Date-based reconstruction would shift the anniversary by an hour and report
    // 35; wall-clock field comparison correctly gives the 36th birthday.
    expect(completedYearsBetween("1990-03-10T02:30:00", "2026-03-10T02:30:00")).toBe(36);
    // One minute before the wall-clock birthday is still the prior year.
    expect(completedYearsBetween("1990-03-10T02:30:00", "2026-03-10T02:29:00")).toBe(35);
  });

  it("parses optional seconds and rejects malformed input", () => {
    expect(completedYearsBetween("2000-01-01T00:00", "2010-01-01T00:00")).toBe(10);
    expect(() => completedYearsBetween("not-a-date", "2010-01-01T00:00")).toThrow();
  });
});
