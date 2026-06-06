import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sweph from "sweph";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveCalcFlags, resolveHouseFlags } from "../src/ephemeris.js";

// NOTE: the resolver intentionally logs to stderr (console.error) when SWIEPH
// is requested but the data path is missing. The tests below spy on
// console.error to assert that behaviour; seeing those messages during a normal
// test run is by design.

const MOSEPH = sweph.constants.SEFLG_MOSEPH;
const SWIEPH = sweph.constants.SEFLG_SWIEPH;
const SPEED = sweph.constants.SEFLG_SPEED;

describe("resolveCalcFlags / resolveHouseFlags", () => {
  let errSpy: ReturnType<typeof vi.spyOn>;
  let ephePathSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    ephePathSpy = vi.spyOn(sweph, "set_ephe_path").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns MOSEPH when KAIROS_SWIEPH is absent", () => {
    const env = {};
    expect(resolveCalcFlags(env)).toBe(MOSEPH | SPEED);
    expect(resolveHouseFlags(env)).toBe(MOSEPH);
    expect(ephePathSpy).not.toHaveBeenCalled();
    expect(errSpy).not.toHaveBeenCalled();
  });

  it("returns MOSEPH and logs when SWIEPH=1 but no path is set", () => {
    const env = { KAIROS_SWIEPH: "1" };
    expect(resolveCalcFlags(env)).toBe(MOSEPH | SPEED);
    expect(resolveHouseFlags(env)).toBe(MOSEPH);
    expect(ephePathSpy).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalled();
    expect(String(errSpy.mock.calls[0][0])).toContain("KAIROS_EPHE_PATH");
  });

  it("returns SWIEPH and sets the ephe path when SWIEPH=1 and .se1 files are present", () => {
    const dir = mkdtempSync(join(tmpdir(), "kairos-ephe-"));
    writeFileSync(join(dir, "seas_18.se1"), "stub");
    try {
      const env = { KAIROS_SWIEPH: "1", KAIROS_EPHE_PATH: dir };
      expect(resolveCalcFlags(env)).toBe(SWIEPH | SPEED);
      expect(resolveHouseFlags(env)).toBe(SWIEPH);
      expect(ephePathSpy).toHaveBeenCalledWith(dir);
      expect(errSpy).not.toHaveBeenCalled();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns MOSEPH and logs when the path exists but holds no .se1 files", () => {
    const dir = mkdtempSync(join(tmpdir(), "kairos-ephe-empty-"));
    try {
      const env = { KAIROS_SWIEPH: "1", KAIROS_EPHE_PATH: dir };
      expect(resolveCalcFlags(env)).toBe(MOSEPH | SPEED);
      expect(resolveHouseFlags(env)).toBe(MOSEPH);
      expect(ephePathSpy).not.toHaveBeenCalled();
      expect(errSpy).toHaveBeenCalled();
      expect(String(errSpy.mock.calls[0][0])).toContain(".se1");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns MOSEPH, logs, and does not crash when the path does not exist", () => {
    const env = {
      KAIROS_SWIEPH: "1",
      KAIROS_EPHE_PATH: "/nonexistent/kairos/ephe/path",
    };
    expect(resolveCalcFlags(env)).toBe(MOSEPH | SPEED);
    expect(resolveHouseFlags(env)).toBe(MOSEPH);
    expect(ephePathSpy).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalled();
  });

  it("returns MOSEPH for any value other than exactly '1'", () => {
    for (const val of ["0", "true", "yes", "2", ""]) {
      const env = { KAIROS_SWIEPH: val, KAIROS_EPHE_PATH: process.cwd() };
      expect(resolveCalcFlags(env)).toBe(MOSEPH | SPEED);
      expect(resolveHouseFlags(env)).toBe(MOSEPH);
    }
    expect(ephePathSpy).not.toHaveBeenCalled();
  });
});
