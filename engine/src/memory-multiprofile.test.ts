import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  activeSlug,
  appendJournal,
  clearProfile,
  computeCalibration,
  createProfile,
  listProfiles,
  loadJournal,
  loadProfile,
  recordOutcome,
  removeProfile,
  saveProfile,
  setActive,
} from "./memory.js";

// Each test gets a private, throwaway KAIROS_HOME so on-disk state never leaks.
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "kairos-mp-"));
  process.env.KAIROS_HOME = dir;
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.KAIROS_HOME;
});

describe("migration from a legacy single-profile ~/.kairos", () => {
  it("moves a legacy root profile.json into profiles/default/ without data loss", () => {
    // Seed a pre-multiprofile layout: profile.json sitting at the root.
    const legacy = {
      birth: { datetimeLocal: "1990-05-01T08:30:00", latitude: 40.7, longitude: -74 },
      home: { latitude: 51.5, longitude: -0.12, place: "London" },
      updatedAt: "2024-01-01T00:00:00.000Z",
    };
    writeFileSync(join(dir, "profile.json"), `${JSON.stringify(legacy)}\n`);

    // Reading triggers lazy migration; the profile is unchanged in content.
    const loaded = loadProfile();
    expect(loaded?.birth?.datetimeLocal).toBe("1990-05-01T08:30:00");
    expect(loaded?.home?.place).toBe("London");

    // It now physically lives under profiles/default/, and the root copy is gone.
    expect(existsSync(join(dir, "profiles", "default", "profile.json"))).toBe(true);
    expect(existsSync(join(dir, "profile.json"))).toBe(false);
    expect(activeSlug()).toBe("default");
  });

  it("leaves the legacy root journal in place and pools its entries as the default owner", () => {
    // A legacy journal at the root with an entry that has no ownerId field.
    const legacyEntry = {
      id: "old1",
      askedAt: "2024-01-01T00:00:00.000Z",
      question: "old question",
      kind: "horary",
      lean: "favorable",
      confidence: "high",
      outcome: "happened",
    };
    writeFileSync(join(dir, "journal.jsonl"), `${JSON.stringify(legacyEntry)}\n`);

    // Pooled read still sees it; it's attributed to the default profile.
    expect(loadJournal().map((e) => e.id)).toEqual(["old1"]);
    expect(loadJournal("default").map((e) => e.id)).toEqual(["old1"]);

    // And it still counts toward the overall (pooled) calibration.
    const report = computeCalibration();
    expect(report.overall.resolved).toBe(1);
    expect(report.overall.correct).toBe(1);
  });

  it("is idempotent — a second read does not move or corrupt anything", () => {
    writeFileSync(join(dir, "profile.json"), `${JSON.stringify({ home: { latitude: 0, longitude: 0 }, updatedAt: "x" })}\n`);
    loadProfile();
    const after1 = readFileSync(join(dir, "profiles", "default", "profile.json"), "utf8");
    loadProfile();
    const after2 = readFileSync(join(dir, "profiles", "default", "profile.json"), "utf8");
    expect(after2).toBe(after1);
  });

  it("survives a crash after the rename but before active.json is written", () => {
    // Simulate the interrupted state: data already moved, no active.json yet.
    const moved = { home: { latitude: 1, longitude: 2 }, updatedAt: "x" };
    mkdirSync(join(dir, "profiles", "default"), { recursive: true });
    writeFileSync(join(dir, "profiles", "default", "profile.json"), `${JSON.stringify(moved)}\n`);
    // Should resolve cleanly to the default profile, not throw.
    expect(loadProfile()?.home?.latitude).toBe(1);
    expect(activeSlug()).toBe("default");
  });
});

describe("fresh install", () => {
  it("returns null/[] and does not pre-create profile state until first write", () => {
    expect(loadProfile()).toBeNull();
    expect(loadJournal()).toEqual([]);
    expect(existsSync(join(dir, "profiles"))).toBe(false);
  });
});

describe("per-person profiles (pooled journal)", () => {
  it("keeps each profile's birth/home isolated by slug", () => {
    saveProfile({ birth: { datetimeLocal: "1990-01-01T00:00:00", latitude: 1, longitude: 1 } }); // default
    createProfile("Partner");
    saveProfile({ birth: { datetimeLocal: "1992-02-02T00:00:00", latitude: 2, longitude: 2 } }, "partner");

    expect(loadProfile("default")?.birth?.datetimeLocal).toBe("1990-01-01T00:00:00");
    expect(loadProfile("partner")?.birth?.datetimeLocal).toBe("1992-02-02T00:00:00");
    // The active (default) profile is untouched by the partner write.
    expect(loadProfile()?.birth?.latitude).toBe(1);
  });

  it("stamps each journal entry with the active owner and pools them in one file", () => {
    appendJournal({ question: "mine", kind: "horary" }); // owner: default
    createProfile("Partner");
    setActive("partner");
    appendJournal({ question: "theirs", kind: "horary" }); // owner: partner

    // One physical journal at the root holds both.
    expect(existsSync(join(dir, "journal.jsonl"))).toBe(true);
    expect(loadJournal().map((e) => e.question).sort()).toEqual(["mine", "theirs"]);
    // Filtering by owner partitions them.
    expect(loadJournal("default").map((e) => e.question)).toEqual(["mine"]);
    expect(loadJournal("partner").map((e) => e.question)).toEqual(["theirs"]);
  });

  it("pools calibration across owners by default, and filters when a slug is given", () => {
    // default: one correct high call
    appendJournal({ id: "d1", question: "Qd", kind: "horary", lean: "favorable", confidence: "high" });
    recordOutcome("d1", "happened");
    createProfile("Partner");
    setActive("partner");
    // partner: one wrong high call
    appendJournal({ id: "p1", question: "Qp", kind: "horary", lean: "favorable", confidence: "high" });
    recordOutcome("p1", "did-not-happen");

    // Pooled: 2 resolved, 1 correct.
    const pooled = computeCalibration();
    expect(pooled.overall.resolved).toBe(2);
    expect(pooled.overall.correct).toBe(1);

    // Per-owner: each isolated.
    expect(computeCalibration("default").overall.correct).toBe(1);
    expect(computeCalibration("partner").overall.correct).toBe(0);
  });
});

describe("profile management", () => {
  it("setActive switches what the zero-arg accessors resolve to", () => {
    createProfile("Partner");
    expect(activeSlug()).toBe("default");
    setActive("partner");
    expect(activeSlug()).toBe("partner");
    saveProfile({ home: { latitude: 9, longitude: 9 } }); // writes to partner
    expect(loadProfile("partner")?.home?.latitude).toBe(9);
    expect(loadProfile("default")).toBeNull();
  });

  it("setActive throws on an unknown slug", () => {
    expect(() => setActive("ghost")).toThrow();
  });

  it("listProfiles reports every profile with exactly one active", () => {
    saveProfile({ birth: { datetimeLocal: "1990-01-01T00:00:00", latitude: 1, longitude: 1 } }); // default
    createProfile("Partner", { home: { latitude: 5, longitude: 5 } });

    const list = listProfiles();
    const bySlug = Object.fromEntries(list.map((p) => [p.slug, p]));
    expect(Object.keys(bySlug).sort()).toEqual(["default", "partner"]);
    expect(bySlug.default.active).toBe(true);
    expect(bySlug.partner.active).toBe(false);
    expect(bySlug.default.hasBirth).toBe(true);
    expect(bySlug.partner.hasHome).toBe(true);
    expect(list.filter((p) => p.active)).toHaveLength(1);
  });

  it("createProfile disambiguates colliding slugs", () => {
    const a = createProfile("My Friend");
    const b = createProfile("my friend");
    expect(a.slug).toBe("my-friend");
    expect(b.slug).not.toBe(a.slug);
    expect(existsSync(join(dir, "profiles", a.slug))).toBe(true);
    expect(existsSync(join(dir, "profiles", b.slug))).toBe(true);
  });

  it("removeProfile deletes a profile and repoints active to a survivor", () => {
    saveProfile({ home: { latitude: 0, longitude: 0 } }); // default
    createProfile("Partner");
    setActive("partner");
    removeProfile("partner");
    expect(existsSync(join(dir, "profiles", "partner"))).toBe(false);
    expect(activeSlug()).toBe("default");
  });

  it("removeProfile refuses to delete the last remaining profile", () => {
    saveProfile({ home: { latitude: 0, longitude: 0 } }); // creates default
    expect(() => removeProfile("default")).toThrow();
    expect(existsSync(join(dir, "profiles", "default"))).toBe(true);
  });
});

describe("slug safety", () => {
  it("rejects path-traversal slugs everywhere a slug is accepted", () => {
    expect(() => loadProfile("../evil")).toThrow();
    expect(() => saveProfile({ home: { latitude: 0, longitude: 0 } }, "a/b")).toThrow();
    expect(() => setActive("../../etc")).toThrow();
    // A clean profile is unaffected.
    expect(() => clearProfile("default")).not.toThrow();
  });
});
