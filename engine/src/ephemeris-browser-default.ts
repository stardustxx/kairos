/*
 * ephemeris-browser-default.ts — browser-bundle replacement for ephemeris.ts.
 *
 * The web build (scripts/build-web.mjs) aliases "./ephemeris.js" to this stub
 * so the native `sweph` addon and its `node:fs` flag probing never enter the
 * browser bundle. There is NO default provider in the browser: ephemeris()
 * throws a clear message until initBrowserEngine() registers the wasm backend.
 */
import type { EphemerisProvider } from "./ephemeris-provider.js";

export const nativeEphemeris: EphemerisProvider | null = null;
