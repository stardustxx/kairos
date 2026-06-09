/*
 * calibration-card.ts — turn a CalibrationReport into a clean, HONEST,
 * shareable artifact (Markdown or a self-contained SVG badge-card).
 *
 * The whole point is honesty: a 3-of-3 streak must never be dressed up as
 * proof. Every card surfaces the sample size (n resolved) PROMINENTLY and
 * carries the report's small-sample caveat. When nothing has resolved yet, the
 * card says so plainly ("no resolved outcomes yet — here is how the track
 * record grows") instead of rendering empty or misleading 100%/0% bars.
 *
 * Pure rendering only — no store reads/writes. Callers pass a CalibrationReport
 * (from computeCalibration); these functions just format it.
 */
import type { CalibrationBand, CalibrationReport } from "./memory.js";

/** Human label for a confidence band (kept Title-Case for the card). */
const BAND_LABEL: Record<CalibrationBand["confidence"], string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

/** The honest line shown when no directional readings have resolved yet. */
const EMPTY_HEADLINE = "No resolved outcomes yet — here is how the track record grows.";

/** Format a hit-rate (0..1 or null) as a percentage string, or an em-dash. */
function pct(hitRate: number | null): string {
  return hitRate == null ? "—" : `${Math.round(hitRate * 100)}%`;
}

/** True when nothing directional has resolved (overall sample is empty). */
function isEmptyReport(report: CalibrationReport): boolean {
  return report.overall.resolved === 0;
}

/**
 * Render the calibration track-record as Markdown. Shows the overall hit-rate,
 * a per-band table (n-resolved + hit-rate), total/unresolved counts, and the
 * sample size + caveat up top. The empty (0-resolved) report renders the
 * honest "no outcomes yet" state rather than a misleading 100%/0%.
 */
export function renderCalibrationCardMarkdown(report: CalibrationReport): string {
  const lines: string[] = [];
  lines.push("# Kairos calibration — track record");
  lines.push("");

  if (isEmptyReport(report)) {
    lines.push(`**${EMPTY_HEADLINE}**`);
    lines.push("");
    lines.push(
      `Logged readings: **${report.total}** · awaiting resolution: **${report.unresolved}** · resolved: **0**`,
    );
    lines.push("");
    lines.push(
      "Once you record how a directional reading actually turned out (happened / did-not-happen / partial), its confidence band starts showing a hit-rate here.",
    );
    lines.push("");
    lines.push(`> ${report.note}`);
    lines.push("");
    return lines.join("\n");
  }

  const { resolved, correct, hitRate } = report.overall;
  lines.push(
    `**Overall hit-rate: ${pct(hitRate)}** — over **${resolved}** resolved reading${resolved === 1 ? "" : "s"} (${correct} correct-equivalent).`,
  );
  lines.push("");
  lines.push("| Confidence | Resolved (n) | Hit-rate |");
  lines.push("| --- | --- | --- |");
  for (const band of report.bands) {
    lines.push(`| ${BAND_LABEL[band.confidence]} | ${band.resolved} | ${pct(band.hitRate)} |`);
  }
  lines.push("");
  lines.push(
    `Total logged: **${report.total}** · resolved: **${resolved}** · awaiting resolution: **${report.unresolved}**`,
  );
  lines.push("");
  lines.push(`> ${report.note}`);
  lines.push("");
  return lines.join("\n");
}

/** XML/SVG-escape a string so user-ish text can't break the markup. */
function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** SVG geometry constants for the badge-card. */
const CARD_W = 440;
const PAD = 20;
const BAR_X = 150;
const BAR_W = 200;

/**
 * Render the calibration track-record as a small, self-contained SVG badge-card
 * (no external fonts/images/refs — safe to embed anywhere). Shows the overall
 * hit-rate, per-band bars with n + hit-rate, and the sample size + caveat. The
 * empty (0-resolved) report renders the honest "no outcomes yet" panel with no
 * bars, never a misleading full/empty bar.
 */
export function renderCalibrationCardSvg(report: CalibrationReport): string {
  const empty = isEmptyReport(report);
  // Height: header block + (bands rows OR an empty panel) + footer caveat.
  const rowH = 30;
  const headerH = 78;
  const bodyH = empty ? 60 : report.bands.length * rowH + 8;
  const footerH = 52;
  const cardH = headerH + bodyH + footerH;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${cardH}" viewBox="0 0 ${CARD_W} ${cardH}" role="img" aria-label="Kairos calibration track record">`,
  );
  // Card background + border.
  parts.push(
    `<rect x="0.5" y="0.5" width="${CARD_W - 1}" height="${cardH - 1}" rx="12" fill="#0f1117" stroke="#2a2f3a"/>`,
  );
  // Title.
  parts.push(
    `<text x="${PAD}" y="30" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="15" font-weight="600" fill="#e6e8ee">Kairos calibration</text>`,
  );

  if (empty) {
    parts.push(
      `<text x="${PAD}" y="56" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="12" fill="#aab1c0">${esc("No resolved outcomes yet —")}</text>`,
    );
    parts.push(
      `<text x="${PAD}" y="74" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="12" fill="#aab1c0">here is how the track record grows.</text>`,
    );
    parts.push(
      `<text x="${PAD}" y="${headerH + 24}" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="12" fill="#e6e8ee">Logged: ${report.total} · awaiting: ${report.unresolved} · resolved: 0</text>`,
    );
  } else {
    const { resolved, hitRate } = report.overall;
    // Big overall number + sample size right under the title.
    parts.push(
      `<text x="${PAD}" y="58" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="26" font-weight="700" fill="#7dd3a8">${esc(pct(hitRate))}</text>`,
    );
    parts.push(
      `<text x="110" y="58" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="12" fill="#aab1c0">overall · n=${resolved} resolved</text>`,
    );

    let y = headerH;
    for (const band of report.bands) {
      const rowMid = y + rowH / 2;
      const frac = band.hitRate == null ? 0 : band.hitRate;
      const fillW = Math.max(0, Math.min(1, frac)) * BAR_W;
      parts.push(
        `<text x="${PAD}" y="${rowMid + 4}" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="12" fill="#e6e8ee">${esc(BAND_LABEL[band.confidence])} (n=${band.resolved})</text>`,
      );
      // Track.
      parts.push(
        `<rect x="${BAR_X}" y="${rowMid - 7}" width="${BAR_W}" height="14" rx="7" fill="#1c2130"/>`,
      );
      // Filled portion only when this band actually has resolved samples.
      if (band.resolved > 0 && band.hitRate != null) {
        parts.push(
          `<rect x="${BAR_X}" y="${rowMid - 7}" width="${fillW.toFixed(1)}" height="14" rx="7" fill="#7dd3a8"/>`,
        );
      }
      parts.push(
        `<text x="${BAR_X + BAR_W + 10}" y="${rowMid + 4}" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="12" fill="#aab1c0">${esc(pct(band.hitRate))}</text>`,
      );
      y += rowH;
    }
    parts.push(
      `<text x="${PAD}" y="${headerH + bodyH + 8}" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="11" fill="#8b93a5">Total ${report.total} · resolved ${resolved} · awaiting ${report.unresolved}</text>`,
    );
  }

  // Caveat footer — always present, so a tiny sample is never oversold.
  const caveatY = cardH - 16;
  parts.push(
    `<text x="${PAD}" y="${caveatY}" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="10.5" font-style="italic" fill="#8b93a5">${esc(report.note)}</text>`,
  );

  parts.push("</svg>");
  return `${parts.join("\n")}\n`;
}
