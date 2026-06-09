/*
 * validate.ts — fail fast with clear messages on malformed requests, instead of
 * surfacing a cryptic error from deep inside the ephemeris.
 */
import type { ChartKind, ComputeRequest, MomentInput } from "./types.js";

const KINDS: ChartKind[] = ["natal", "transit", "horary", "electional"];

function checkLatLon(label: string, lat: unknown, lon: unknown): void {
  if (typeof lat !== "number" || !Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error(`${label}: latitude must be a number in [-90, 90], got ${lat}`);
  }
  if (typeof lon !== "number" || !Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new Error(`${label}: longitude must be a number in [-180, 180], got ${lon}`);
  }
}

function checkDatetime(label: string, dt: unknown): void {
  if (typeof dt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(dt)) {
    throw new Error(
      `${label}: datetimeLocal must be local ISO without offset, e.g. "1990-05-21T14:30:00", got ${JSON.stringify(dt)}`,
    );
  }
}

function checkMoment(label: string, m: MomentInput | undefined): void {
  if (!m || typeof m !== "object") throw new Error(`${label} is required`);
  checkDatetime(label, m.datetimeLocal);
  checkLatLon(label, m.latitude, m.longitude);
}

/**
 * Validate a ComputeRequest's shape and numeric ranges. Throws an Error with a
 * specific, actionable message on the first problem found.
 */
export function validateRequest(req: ComputeRequest): void {
  if (!req || typeof req !== "object") {
    throw new Error("request must be a JSON object");
  }
  if (!KINDS.includes(req.kind)) {
    throw new Error(`kind must be one of ${KINDS.join(", ")}, got ${JSON.stringify(req.kind)}`);
  }

  if (req.kind === "electional") {
    if (!req.location) throw new Error("electional request requires `location`");
    checkLatLon("location", req.location.latitude, req.location.longitude);
    if (req.quesitedHouse == null || req.quesitedHouse < 2 || req.quesitedHouse > 12) {
      throw new Error(`electional requires quesitedHouse in 2..12, got ${req.quesitedHouse}`);
    }
    if (!req.window?.startLocal || !req.window?.endLocal) {
      throw new Error("electional request requires `window` with startLocal and endLocal");
    }
    checkDatetime("window.startLocal", req.window.startLocal);
    checkDatetime("window.endLocal", req.window.endLocal);
    if (typeof req.stepMinutes !== "number" || req.stepMinutes <= 0) {
      throw new Error(`electional requires a positive stepMinutes, got ${req.stepMinutes}`);
    }
  } else {
    checkMoment("moment", req.moment);
    if (req.kind === "transit") checkMoment("natal", req.natal);
    if (req.kind === "horary") {
      if (req.quesitedHouse == null || req.quesitedHouse < 2 || req.quesitedHouse > 12) {
        throw new Error(`horary requires quesitedHouse in 2..12, got ${req.quesitedHouse}`);
      }
      if (req.querentHouse != null && (req.querentHouse < 1 || req.querentHouse > 12)) {
        throw new Error(`horary querentHouse must be in 1..12, got ${req.querentHouse}`);
      }
    }
  }

  if (req.relocation) {
    checkLatLon("relocation", req.relocation.latitude, req.relocation.longitude);
  }
}
