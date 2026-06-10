/*
 * native-load-error.test.ts — the F1 fail-loud path: the detector must match
 * ONLY the sweph native-load failure signature (never masking unrelated
 * errors), and the formatter must carry platform/arch, the likely cause, and
 * the concrete fixes instead of a raw require/node-gyp stack.
 */
import { describe, expect, it } from "vitest";
import { formatNativeLoadError, isNativeLoadError } from "./native-load-error.js";

/** Build an Error carrying a Node-style `code`, like require/import failures do. */
function codedError(message: string, code?: string): Error {
  const err = new Error(message);
  if (code) (err as NodeJS.ErrnoException).code = code;
  return err;
}

describe("isNativeLoadError", () => {
  it("matches ERR_DLOPEN_FAILED for the sweph addon (ABI/platform mismatch)", () => {
    const err = codedError(
      "dlopen(/x/node_modules/sweph/build/Release/sweph.node): mach-o file, but is an incompatible architecture",
      "ERR_DLOPEN_FAILED",
    );
    expect(isNativeLoadError(err)).toBe(true);
  });

  it("matches MODULE_NOT_FOUND for sweph (source build never produced a binary)", () => {
    const err = codedError("Cannot find module 'sweph'", "MODULE_NOT_FOUND");
    expect(isNativeLoadError(err)).toBe(true);
  });

  it("matches ERR_MODULE_NOT_FOUND for sweph (ESM resolution variant)", () => {
    const err = codedError(
      "Cannot find package 'sweph' imported from /x/engine/src/ephemeris.ts",
      "ERR_MODULE_NOT_FOUND",
    );
    expect(isNativeLoadError(err)).toBe(true);
  });

  it("does NOT match a module-not-found for some OTHER module", () => {
    const err = codedError("Cannot find module 'left-pad'", "MODULE_NOT_FOUND");
    expect(isNativeLoadError(err)).toBe(false);
  });

  it("does NOT match a dlopen failure that is not sweph's", () => {
    const err = codedError(
      "dlopen(/x/node_modules/other-addon/build/other.node): not loadable",
      "ERR_DLOPEN_FAILED",
    );
    expect(isNativeLoadError(err)).toBe(false);
  });

  it("does NOT match an ordinary error that merely mentions sweph", () => {
    expect(isNativeLoadError(new Error("sweph returned nonsense"))).toBe(false);
  });

  it("does NOT match non-Error values", () => {
    expect(isNativeLoadError("sweph ERR_DLOPEN_FAILED")).toBe(false);
    expect(isNativeLoadError(undefined)).toBe(false);
    expect(isNativeLoadError({ code: "ERR_DLOPEN_FAILED", message: "sweph" })).toBe(false);
  });
});

describe("formatNativeLoadError", () => {
  const err = codedError(
    "Cannot find module 'sweph'\nRequire stack:\n- /x/engine/dist/src/ephemeris.js",
    "MODULE_NOT_FOUND",
  );
  const info = { platform: "darwin", arch: "x64", nodeVersion: "v22.1.0" };
  const msg = formatNativeLoadError(err, info);

  it("names the module and the platform/arch/node it failed on", () => {
    expect(msg).toContain("sweph");
    expect(msg).toContain("darwin-x64");
    expect(msg).toContain("v22.1.0");
  });

  it("states the likely cause (no prebuild / missing toolchain)", () => {
    expect(msg).toMatch(/prebuilt/i);
    expect(msg).toMatch(/toolchain/i);
  });

  it("gives the concrete fixes: Xcode CLT, Alpine build deps, Docker fallback", () => {
    expect(msg).toContain("xcode-select --install");
    expect(msg).toContain("apk add build-base python3");
    expect(msg).toMatch(/Docker/);
  });

  it("includes only the first line of the original error (no require stack)", () => {
    expect(msg).toContain("Cannot find module 'sweph'");
    expect(msg).not.toContain("Require stack");
  });

  it("defaults to the current process platform facts when none are injected", () => {
    const live = formatNativeLoadError(err);
    expect(live).toContain(`${process.platform}-${process.arch}`);
    expect(live).toContain(process.version);
  });
});
