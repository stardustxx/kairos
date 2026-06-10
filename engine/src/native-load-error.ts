/*
 * native-load-error.ts — detect and explain a failure to load the native
 * `sweph` Swiss Ephemeris addon.
 *
 * On platforms without a prebuilt sweph binary (e.g. Intel macOS, musl libc)
 * the npm install compiles from source; without a C++ toolchain that fails,
 * and the first `kairos` run then dies with a raw require/node-gyp stack the
 * user has no reason to connect to a missing compiler (onboarding audit F1).
 * The dispatcher (bin.ts) loads the engine through `isNativeLoadError` and, on
 * a match, prints `formatNativeLoadError` instead. Detection is deliberately
 * narrow — only the sweph native-load signature — so unrelated errors are
 * NEVER masked; everything else rethrows untouched. The wasm/browser path
 * never imports this module.
 */

/** The platform facts the message reports; injectable so tests are exact. */
export interface NativeLoadPlatform {
  platform: string;
  arch: string;
  nodeVersion: string;
}

function currentPlatform(): NativeLoadPlatform {
  return { platform: process.platform, arch: process.arch, nodeVersion: process.version };
}

/**
 * True only for the sweph native-module load-failure signature:
 *   - ERR_DLOPEN_FAILED mentioning sweph (binary present but unloadable —
 *     wrong ABI/platform build), or
 *   - MODULE_NOT_FOUND / ERR_MODULE_NOT_FOUND mentioning sweph (the install
 *     never produced a binary, e.g. the source build failed).
 * Anything else — including load failures of other modules — is NOT ours.
 */
export function isNativeLoadError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (!/sweph/i.test(err.message)) return false;
  const code = (err as NodeJS.ErrnoException).code;
  return code === "ERR_DLOPEN_FAILED" || code === "MODULE_NOT_FOUND" || code === "ERR_MODULE_NOT_FOUND";
}

/**
 * A concise, actionable replacement for the raw node-gyp stack: what failed,
 * on which platform/arch, the likely cause, and the concrete fixes.
 */
export function formatNativeLoadError(
  err: Error,
  info: NativeLoadPlatform = currentPlatform(),
): string {
  const firstLine = err.message.split("\n", 1)[0].trim();
  return [
    `kairos: the native Swiss Ephemeris module (sweph) failed to load on ${info.platform}-${info.arch} (node ${info.nodeVersion}).`,
    "",
    "Likely cause: no prebuilt sweph binary exists for this platform/Node ABI, and the",
    "install-time source build did not produce one (usually a missing C++ toolchain).",
    "",
    "Fixes:",
    "  • macOS:        xcode-select --install    (Xcode Command Line Tools), then reinstall",
    "  • Alpine/musl:  apk add build-base python3, then reinstall",
    "  • or run via Docker instead — see the Docker fallback in the README",
    "",
    `(original error: ${firstLine})`,
  ].join("\n");
}
