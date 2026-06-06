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

  function $(id) {
    return document.getElementById(id);
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

    let extra = "";
    if (result.electional && Array.isArray(result.electional.topMoments)) {
      const e = result.electional;
      const best = e.topMoments[0];
      if (best) {
        extra = `Elected moment: ${best.datetimeLocal} — score ${best.score} ` +
          `(of ${e.candidatesEvaluated} evaluated). ` +
          `${(best.reasons || []).join("; ")}. ` +
          `Chart below is this #1 moment.`;
      }
    } else if (result.horary) {
      const h = result.horary;
      extra = `Horary: querent ${h.querentSignificator} (house ` +
        `${h.querentSignificatorHouse}), quesited ${h.quesitedSignificator} ` +
        `(house ${h.quesitedSignificatorHouse}). Moon void: ` +
        `${h.moonVoidOfCourse ? "yes" : "no"}.`;
    } else if (result.transitAspects) {
      extra = `Transit aspects to natal: ${result.transitAspects.length}.`;
    }
    els.metaExtra.textContent = extra;
    els.metaExtra.hidden = !extra;

    els.metadata.hidden = false;
  }

  function draw() {
    if (!lastResult) return;
    window.KairosChart.renderChart(els.chart, lastResult, currentOptions());
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
    renderMetadata(data);
    draw();
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

    els.render.addEventListener("click", handleRender);
    els.example.addEventListener("click", loadExample);
    els.clear.addEventListener("click", function () {
      els.json.value = "";
      lastResult = null;
      showError("");
      els.metadata.hidden = true;
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
