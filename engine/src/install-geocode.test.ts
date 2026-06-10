/*
 * install-geocode.test.ts — the shared gazetteer install path and its MCP
 * surface (geocode_install). NEVER touches the network: every test stubs
 * global fetch — the idempotent already-installed path must not call it at
 * all, and the download paths are exercised only up to a stubbed failure.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gazetteerPath, installGazetteer } from "./install-geocode.js";
import { handleGeocodeInstall } from "./mcp-server.js";

let dir: string;

/** A fetch stub that fails the test if the network is ever reached. */
const noNetwork = vi.fn(() => {
  throw new Error("network was hit — installGazetteer must not download here");
});

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "kairos-geo-"));
  process.env.KAIROS_HOME = dir;
  vi.stubGlobal("fetch", noNetwork);
  noNetwork.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  rmSync(dir, { recursive: true, force: true });
  delete process.env.KAIROS_HOME;
});

/** Seed KAIROS_HOME with a tiny but valid-looking gazetteer of `cities` rows. */
function seedGazetteer(cities: number): string {
  const path = gazetteerPath();
  mkdirSync(join(dir, "geonames"), { recursive: true });
  const rows = Array.from({ length: cities }, (_, i) => `${i}\tCity${i}\tcity${i}`);
  writeFileSync(path, `${rows.join("\n")}\n`); // trailing newline must not count
  return path;
}

describe("installGazetteer idempotence", () => {
  it("returns alreadyInstalled with the path and city count, without any network", async () => {
    const path = seedGazetteer(3);
    const result = await installGazetteer();
    expect(result).toEqual({ installed: true, alreadyInstalled: true, path, cities: 3 });
    expect(noNetwork).not.toHaveBeenCalled();
  });

  it("a second call reports the same thing (idempotent)", async () => {
    seedGazetteer(2);
    const first = await installGazetteer();
    const second = await installGazetteer();
    expect(second).toEqual(first);
    expect(noNetwork).not.toHaveBeenCalled();
  });

  it("force bypasses the cache and attempts the download (here: the stub)", async () => {
    seedGazetteer(2);
    await expect(installGazetteer({ force: true })).rejects.toThrow(/network was hit/);
    expect(noNetwork).toHaveBeenCalledTimes(1);
  });

  it("an empty gazetteer file does not count as installed", async () => {
    const path = gazetteerPath();
    mkdirSync(join(dir, "geonames"), { recursive: true });
    writeFileSync(path, "");
    await expect(installGazetteer()).rejects.toThrow(/network was hit/);
  });

  it("surfaces an HTTP failure as a thrown error (fresh-install path)", async () => {
    vi.stubGlobal("fetch", async () => ({ ok: false, status: 503 }));
    await expect(installGazetteer()).rejects.toThrow(/HTTP 503/);
  });
});

describe("geocode_install MCP handler", () => {
  it("already-installed returns the result shape with alreadyInstalled: true", async () => {
    const path = seedGazetteer(5);
    const result = await handleGeocodeInstall({});
    expect(result.isError).toBeFalsy();
    const value = JSON.parse((result.content[0] as { text: string }).text);
    expect(value).toEqual({ installed: true, alreadyInstalled: true, path, cities: 5 });
    expect(noNetwork).not.toHaveBeenCalled();
  });

  it("a failed download surfaces as an MCP tool error, not a throw", async () => {
    vi.stubGlobal("fetch", async () => ({ ok: false, status: 404 }));
    const result = await handleGeocodeInstall({});
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toMatch(/HTTP 404/);
  });

  it("force on an installed gazetteer attempts the download (consented re-fetch)", async () => {
    seedGazetteer(5);
    const result = await handleGeocodeInstall({ force: true });
    expect(result.isError).toBe(true); // the no-network stub threw
    expect(noNetwork).toHaveBeenCalledTimes(1);
  });
});
