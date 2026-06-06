/*
 * app.js — User interaction, JSON parsing/validation, and metadata display.
 * Depends on chart.js (window.KairosChart). No build step; runs over file://.
 */

(function () {
  "use strict";

  // Cached DOM references.
  const els = {};
  // The last successfully parsed + validated ComputeResult, kept so toggles can
  // re-render without re-parsing.
  let lastResult = null;
  // Which chart the wheel/details show: "natal" (as-cast) or "relocated".
  let viewMode = "natal";

  /**
   * The ComputeResult to render, accounting for the relocation view toggle:
   * when "relocated" is selected and a relocation exists, substitute its chart.
   */
  function viewResult() {
    if (
      viewMode === "relocated" &&
      lastResult &&
      lastResult.relocation &&
      lastResult.relocation.chart
    ) {
      return Object.assign({}, lastResult, { chart: lastResult.relocation.chart });
    }
    return lastResult;
  }

  function $(id) {
    return document.getElementById(id);
  }

  const SIGNS = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
  ];
  /** Format an ecliptic longitude as "12° Gemini". */
  function degSign(lon) {
    const n = ((lon % 360) + 360) % 360;
    return `${Math.floor(n % 30)}° ${SIGNS[Math.floor(n / 30) % 12]}`;
  }

  function currentOptions() {
    return {
      showAspects: els.toggleAspects.checked,
      showRetrograde: els.toggleRetrograde.checked,
      showCusps: els.toggleCusps.checked,
      showDegrees: els.toggleDegrees.checked,
    };
  }

  function showError(msg) {
    els.error.textContent = msg;
    els.error.hidden = !msg;
  }

  /**
   * Validate that an object looks like a ComputeResult. Returns null on success
   * or a human-readable error string describing the first problem found.
   */
  function validateComputeResult(data) {
    if (data === null || typeof data !== "object") {
      return "Top-level JSON must be an object.";
    }
    const chart = data.chart;
    if (!chart || typeof chart !== "object") {
      return 'Missing "chart" object.';
    }
    if (!Array.isArray(chart.planets) || chart.planets.length === 0) {
      return 'chart.planets must be a non-empty array.';
    }
    for (let i = 0; i < chart.planets.length; i++) {
      const p = chart.planets[i];
      if (typeof p.name !== "string" || typeof p.longitude !== "number") {
        return `chart.planets[${i}] needs a string "name" and numeric "longitude".`;
      }
    }
    const houses = chart.houses;
    if (!houses || typeof houses !== "object") {
      return 'Missing "chart.houses" object.';
    }
    if (!Array.isArray(houses.cusps) || houses.cusps.length !== 12) {
      return "chart.houses.cusps must be an array of 12 cusp longitudes.";
    }
    if (typeof houses.ascendant !== "number" || typeof houses.mc !== "number") {
      return "chart.houses needs numeric ascendant and mc.";
    }
    if (!Array.isArray(chart.aspects)) {
      return "chart.aspects must be an array (may be empty).";
    }
    return null;
  }

  /** Parse the textarea contents into an object. Throws on invalid JSON. */
  function parseInput() {
    const raw = els.json.value.trim();
    if (!raw) {
      throw new Error("Paste ComputeResult JSON or upload a .json file first.");
    }
    return JSON.parse(raw);
  }

  function formatUtc(utc) {
    if (typeof utc !== "string") return "—";
    // Engine emits UTC; display it verbatim (no local-time conversion).
    return utc;
  }

  function renderMetadata(result) {
    const c = result.chart;
    els.metaKind.textContent = c.kind || "—";
    els.metaUtc.textContent = formatUtc(c.utc);
    els.metaJd.textContent =
      typeof c.julianDayUt === "number" ? c.julianDayUt.toFixed(4) : "—";
    els.metaSystem.textContent =
      (c.houses && c.houses.system) ? c.houses.system : "—";
    els.metaPlanets.textContent = c.planets ? String(c.planets.length) : "—";

    const parts = [];
    // Always-available chart context: sect + Part of Fortune.
    if (c.sect) {
      let ctx = `Sect: ${c.sect}.`;
      if (c.partOfFortune && c.partOfFortune.sign) {
        const pf = c.partOfFortune;
        ctx += ` Part of Fortune: ${Math.floor(pf.degInSign)}° ${pf.sign}` +
          (pf.house ? ` (house ${pf.house})` : "") + ".";
      }
      parts.push(ctx);
    }

    // Relocation summary (uses the original chart's angles vs the relocated ones).
    if (result.relocation && result.relocation.chart) {
      const rel = result.relocation;
      const loc = rel.location;
      let s = `Relocation (${loc.latitude.toFixed(2)}, ${loc.longitude.toFixed(2)}): ` +
        `Ascendant ${degSign(rel.chart.houses.ascendant)} ` +
        `(birthplace ${degSign(result.chart.houses.ascendant)}).`;
      const shifts = (rel.houseShifts || [])
        .map(function (x) { return `${x.planet} ${x.fromHouse}→${x.toHouse}`; });
      if (shifts.length) {
        s += ` ${shifts.length} ${shifts.length === 1 ? "planet changes" : "planets change"} ` +
          `house: ${shifts.join(", ")}.`;
      }
      s += ` Showing the ${viewMode === "relocated" ? "relocated" : "birthplace"} chart.`;
      parts.push(s);
    }

    let extra = "";
    if (result.electional && Array.isArray(result.electional.topMoments)) {
      const e = result.electional;
      const best = e.topMoments[0];
      if (best) {
        let ctx = `Elected moment: ${best.datetimeLocal} — score ${best.score}`;
        if (typeof e.averageScore === "number" && e.scoreRange) {
          ctx += ` (best of ${e.candidatesEvaluated}; window avg ${e.averageScore}, ` +
            `range ${e.scoreRange.min}…${e.scoreRange.max})`;
        } else {
          ctx += ` (of ${e.candidatesEvaluated} evaluated)`;
        }
        ctx += `. ${(best.reasons || []).join("; ")}.`;
        // Runner-up alternatives, for context on how close the field is.
        const alts = e.topMoments.slice(1, 4)
          .map(function (m) { return `${m.datetimeLocal} (${m.score})`; });
        if (alts.length) ctx += ` Alternatives: ${alts.join(", ")}.`;
        ctx += ` Chart below is the #1 moment.`;
        extra = ctx;
      }
    } else if (result.horary) {
      const h = result.horary;
      const lean = h.lean ? h.lean.charAt(0).toUpperCase() + h.lean.slice(1) : "—";
      const recv = h.significatorReception
        ? ` Reception: ${h.significatorReception.kind}.`
        : "";
      const dig = (typeof h.querentSignificatorDignity === "number")
        ? ` Significator dignity: ${h.querentSignificator} ${h.querentSignificatorDignity >= 0 ? "+" : ""}${h.querentSignificatorDignity}, ` +
          `${h.quesitedSignificator} ${h.quesitedSignificatorDignity >= 0 ? "+" : ""}${h.quesitedSignificatorDignity}.`
        : "";
      extra = `Horary: ${lean}` +
        (typeof h.score === "number" ? ` (score ${h.score}, ${h.confidence} confidence)` : "") +
        `. Querent ${h.querentSignificator} (house ${h.querentSignificatorHouse}), ` +
        `quesited ${h.quesitedSignificator} (house ${h.quesitedSignificatorHouse}). ` +
        `Moon void: ${h.moonVoidOfCourse ? "yes" : "no"}.` + recv + dig +
        (h.translationOfLight ? ` Translation by ${h.translationOfLight.translator}.` : "") +
        (h.collectionOfLight ? ` Collection by ${h.collectionOfLight.collector}.` : "") +
        (Array.isArray(h.testimonies) && h.testimonies.length
          ? " Testimonies: " + h.testimonies.join("; ") + "."
          : "");
    } else if (result.transitAspects) {
      extra = `Transit aspects to natal: ${result.transitAspects.length}.`;
    }
    if (extra) parts.push(extra);
    const combined = parts.join(" ");
    els.metaExtra.textContent = combined;
    els.metaExtra.hidden = !combined;

    els.metadata.hidden = false;
  }

  function draw() {
    const r = viewResult();
    if (!r) return;
    window.KairosChart.renderChart(els.chart, r, currentOptions());
  }

  // ---- Details tables ------------------------------------------------------

  const PLANET_GLYPHS = {
    Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀", Mars: "♂", Jupiter: "♃",
    Saturn: "♄", Uranus: "♅", Neptune: "♆", Pluto: "♇", Node: "☊",
  };
  const ASPECT_GLYPHS = {
    conjunction: "☌", sextile: "⚹", square: "□", trine: "△", opposition: "☍",
  };

  function esc(s) {
    return String(s).replace(/[&<>]/g, function (c) {
      return c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;";
    });
  }
  function cell(v, cls) {
    return `<td${cls ? ` class="${cls}"` : ""}>${esc(v)}</td>`;
  }
  function table(headers, rows) {
    const thead = "<tr>" + headers.map(function (h) { return `<th>${esc(h)}</th>`; }).join("") + "</tr>";
    return `<table class="data-table"><thead>${thead}</thead><tbody>${rows.join("")}</tbody></table>`;
  }

  function buildPositionsTable(chart) {
    const rows = chart.planets.map(function (p) {
      const glyph = PLANET_GLYPHS[p.name] || "";
      const pos = `${Math.floor(p.degInSign)}° ${p.sign}`;
      const dig = p.dignities
        ? `${p.dignities.score >= 0 ? "+" : ""}${p.dignities.score}`
        : "—";
      const digCls = p.dignities ? (p.dignities.score > 0 ? "pos" : p.dignities.score < 0 ? "neg" : "") : "";
      const cond = (p.sunProximity && p.sunProximity.state !== "clear") ? p.sunProximity.state : "";
      const condCls = cond === "cazimi" ? "pos" : cond ? "neg" : "";
      return "<tr>" +
        cell(`${glyph} ${p.name}`.trim()) +
        cell(pos) +
        cell(p.house != null ? p.house : "—", "num") +
        cell(p.retrograde ? "℞" : "", "retro") +
        cell(dig, "num " + digCls) +
        cell(cond, condCls) +
        "</tr>";
    });
    if (chart.partOfFortune) {
      const pf = chart.partOfFortune;
      rows.push("<tr class=\"fortune-row\">" +
        cell("⊕ Fortune") +
        cell(`${Math.floor(pf.degInSign)}° ${pf.sign}`) +
        cell(pf.house != null ? pf.house : "—", "num") +
        cell("") + cell("—", "num") + cell("") + "</tr>");
    }
    return table(["Body", "Position", "Hse", "℞", "Dignity", "Condition"], rows);
  }

  function buildAspectsTable(chart) {
    const aspects = (chart.aspects || []).slice().sort(function (a, b) { return a.orb - b.orb; });
    if (!aspects.length) return "<p class=\"empty\">No major aspects in orb.</p>";
    const rows = aspects.map(function (a) {
      const g = ASPECT_GLYPHS[a.type] || "";
      const perfects = a.perfectsAtUtc ? String(a.perfectsAtUtc).slice(0, 10) : "—";
      return "<tr>" +
        cell(`${a.a} ${g} ${a.b}`) +
        cell(a.type) +
        cell(`${a.orb.toFixed(1)}°`, "num") +
        cell(a.applying ? "applying" : "separating", a.applying ? "pos" : "") +
        cell(perfects, "num") +
        "</tr>";
    });
    return table(["Bodies", "Aspect", "Orb", "Motion", "Perfects"], rows);
  }

  function renderDetails() {
    const r = viewResult();
    const chart = r && r.chart;
    if (!chart) { els.details.hidden = true; return; }
    els.positionsTable.innerHTML = buildPositionsTable(chart);
    els.aspectsTable.innerHTML = buildAspectsTable(chart);
    els.details.hidden = !els.toggleDetails.checked;
  }

  function handleRender() {
    showError("");
    let data;
    try {
      data = parseInput();
    } catch (e) {
      showError("Invalid JSON: " + e.message);
      return;
    }
    const err = validateComputeResult(data);
    if (err) {
      showError(err);
      return;
    }
    lastResult = data;
    // Reset to the as-cast view, and reveal the switch only when relocation exists.
    viewMode = "natal";
    const hasReloc = !!(data.relocation && data.relocation.chart);
    els.viewSwitch.hidden = !hasReloc;
    if (hasReloc) els.chartView.value = "natal";
    renderMetadata(data);
    draw();
    renderDetails();
  }

  function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () {
      els.json.value = String(reader.result);
      handleRender();
    };
    reader.onerror = function () {
      showError("Could not read file: " + file.name);
    };
    reader.readAsText(file);
  }

  /**
   * Load a JSON ComputeResult from a URL (used by ?data=<path>, e.g. the
   * `pnpm wheel` helper writes last-result.json and opens ?data=last-result.json).
   */
  function loadFromUrl(url) {
    fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      })
      .then(function (txt) {
        els.json.value = txt;
        handleRender();
      })
      .catch(function (e) {
        showError("Could not load data from " + url + ": " + e.message);
      });
  }

  function loadExample() {
    // Fetch works when served over http; under file:// it is often blocked, so
    // we fall back to instructing the user.
    fetch("example-output.json")
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      })
      .then(function (txt) {
        els.json.value = txt;
        handleRender();
      })
      .catch(function () {
        showError(
          "Could not auto-load example-output.json (file:// blocks fetch). " +
          "Open example-output.json, copy its contents into the box, and click Render."
        );
      });
  }

  function init() {
    els.json = $("json-input");
    els.file = $("file-input");
    els.render = $("render-btn");
    els.example = $("example-btn");
    els.clear = $("clear-btn");
    els.error = $("error");
    els.chart = $("chart");
    els.metadata = $("metadata");
    els.metaKind = $("meta-kind");
    els.metaUtc = $("meta-utc");
    els.metaJd = $("meta-jd");
    els.metaSystem = $("meta-system");
    els.metaPlanets = $("meta-planets");
    els.metaExtra = $("meta-extra");
    els.toggleAspects = $("toggle-aspects");
    els.toggleRetrograde = $("toggle-retrograde");
    els.toggleCusps = $("toggle-cusps");
    els.toggleDegrees = $("toggle-degrees");
    els.toggleDetails = $("toggle-details");
    els.details = $("details");
    els.positionsTable = $("positions-table");
    els.aspectsTable = $("aspects-table");
    els.viewSwitch = $("view-switch");
    els.chartView = $("chart-view");

    els.render.addEventListener("click", handleRender);
    els.example.addEventListener("click", loadExample);
    els.clear.addEventListener("click", function () {
      els.json.value = "";
      lastResult = null;
      showError("");
      els.metadata.hidden = true;
      els.details.hidden = true;
      els.viewSwitch.hidden = true;
      viewMode = "natal";
      window.KairosChart.clearChart(els.chart);
    });

    els.file.addEventListener("change", function (e) {
      handleFile(e.target.files && e.target.files[0]);
    });

    // Re-render on any toggle change (no re-parse needed).
    [els.toggleAspects, els.toggleRetrograde, els.toggleCusps, els.toggleDegrees]
      .forEach(function (t) {
        t.addEventListener("change", draw);
      });
    els.toggleDetails.addEventListener("change", function () {
      els.details.hidden = !(els.toggleDetails.checked && lastResult);
    });

    els.chartView.addEventListener("change", function () {
      viewMode = els.chartView.value === "relocated" ? "relocated" : "natal";
      if (lastResult) renderMetadata(lastResult);
      draw();
      renderDetails();
    });
  }

  function start() {
    init();
    // Auto-load if a ?data=<path> query param is present (the wheel helper).
    try {
      const params = new URLSearchParams(window.location.search);
      const dataUrl = params.get("data");
      if (dataUrl) loadFromUrl(dataUrl);
    } catch (e) {
      /* ignore malformed query strings */
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
