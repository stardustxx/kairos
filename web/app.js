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

  // ---- Permalink encoding + Recent charts (client-side only) ---------------

  // URL hash parameter that carries an encoded ComputeResult, and the
  // localStorage key for the capped recent-charts list.
  const HASH_PARAM = "r";
  const STORAGE_KEY = "kairos.recent.v1";
  const RECENT_LIMIT = 10;
  // A generous ceiling on encoded length: very large payloads usually mean a
  // corrupt or hostile hash, and most browsers cap URLs well below this.
  const MAX_ENCODED = 2_000_000;

  /** Encode a UTF-8 string as base64url (no padding), safe for a URL hash. */
  function toBase64Url(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  /** Decode a base64url string back to its original UTF-8 string. */
  function fromBase64Url(b64url) {
    let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  /** Encode a ComputeResult object into a compact base64url string. */
  function encodeResult(result) {
    return toBase64Url(JSON.stringify(result));
  }

  /** Decode a base64url string into a ComputeResult object. Throws on failure. */
  function decodeResult(encoded) {
    return JSON.parse(fromBase64Url(encoded));
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

  // Jargon worth a tooltip in the verdict reasons.
  const GLOSSARY = {
    "void of course": "The Moon makes no further major aspect before leaving its sign — classically, 'nothing comes of the matter.'",
    combust: "Within ~8.5° of the Sun — the planet is burnt, hidden, weakened.",
    cazimi: "Within ~17' of the Sun's exact degree — the planet is strengthened, 'in the heart.'",
    "under the sun's beams": "Within ~15° of the Sun — moderately weakened.",
    peregrine: "A planet with no essential dignity — wandering, without resources.",
    "translation of light": "A faster planet carries light between the two significators, perfecting the matter indirectly.",
    "collection of light": "A heavier planet both significators apply to, gathering their light.",
    reception: "Each significator sits in a sign the other rules or exalts — goodwill that can perfect a matter.",
    detriment: "A planet in the sign opposite its rulership — weakened.",
    fall: "A planet in the sign opposite its exaltation — weakened.",
  };

  /** Wrap known glossary terms in a tooltip span (HTML). Input is plain text. */
  function glossarize(text) {
    let out = esc(text);
    for (const term in GLOSSARY) {
      const re = new RegExp("\\b(" + term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")\\b", "i");
      out = out.replace(re, '<span class="term" title="' + esc(GLOSSARY[term]) + '">$1</span>');
    }
    return out;
  }

  /** Populate the dedicated verdict block for horary / electional; hide otherwise. */
  function renderVerdict(result) {
    const v = els.verdict;
    // The scope note addresses transit/natal users (wheel, no verdict panel) —
    // show it only for results that have a chart but no verdict to render.
    els.verdictScopeNote.hidden = !!(result.horary ||
      (result.electional && result.electional.topMoments && result.electional.topMoments[0]) ||
      !result.chart);
    if (result.horary) {
      const h = result.horary;
      const lean = h.lean || "uncertain";
      els.verdictLean.textContent = lean.charAt(0).toUpperCase() + lean.slice(1);
      els.verdictLean.className = "verdict-lean " + lean;
      els.verdictSub.textContent =
        `Querent ${h.querentSignificator} (house ${h.querentSignificatorHouse}) · ` +
        `quesited ${h.quesitedSignificator} (house ${h.quesitedSignificatorHouse})`;
      const conf = (h.confidence || "low");
      els.verdictConfidence.className = "confidence-chip " + conf;
      els.verdictConfidence.innerHTML = conf + " confidence " +
        '<span class="score">' + (h.score >= 0 ? "+" : "") + h.score + "</span>";
      els.verdictConfidence.hidden = false;
      const reasons = Array.isArray(h.testimonies) ? h.testimonies : [];
      els.verdictReasons.innerHTML = reasons.map(function (t) {
        const cls = /\(-\d/.test(t) ? "neg" : /\(\+\d/.test(t) ? "pos" : "";
        return '<li class="' + cls + '">' + glossarize(t) + "</li>";
      }).join("");
      v.hidden = false;
    } else if (result.electional && result.electional.topMoments && result.electional.topMoments[0]) {
      const e = result.electional;
      const best = e.topMoments[0];
      els.verdictLean.textContent = best.datetimeLocal.replace("T", "  ");
      els.verdictLean.className = "verdict-lean " +
        (best.score > e.averageScore + 15 ? "favorable" : best.score < e.averageScore ? "unfavorable" : "uncertain");
      els.verdictSub.textContent =
        `Best of ${e.candidatesEvaluated} moments · score ${best.score} ` +
        `(window avg ${e.averageScore}, range ${e.scoreRange.min}…${e.scoreRange.max})`;
      els.verdictConfidence.className = "confidence-chip " +
        (best.score >= 90 ? "high" : best.score >= 60 ? "medium" : "low");
      els.verdictConfidence.innerHTML = 'score <span class="score">' + best.score + "</span>";
      els.verdictConfidence.hidden = false;
      const reasons = (best.reasons || []).slice();
      const alts = e.topMoments.slice(1, 4)
        .map(function (m) { return m.datetimeLocal + " (" + m.score + ")"; });
      els.verdictReasons.innerHTML =
        reasons.map(function (t) {
          const cls = /-\d/.test(t) ? "neg" : /\+\d/.test(t) ? "pos" : "";
          return '<li class="' + cls + '">' + glossarize(t) + "</li>";
        }).join("") +
        (alts.length ? '<li>Alternatives: ' + esc(alts.join(", ")) + "</li>" : "");
      v.hidden = false;
    } else {
      v.hidden = true;
    }
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

    // The horary/electional verdict now lives in the dedicated #verdict block;
    // metadata keeps only neutral chart context.
    if (result.transitAspects) {
      parts.push(`Transit aspects to natal: ${result.transitAspects.length}.`);
    }
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
    return String(s).replace(/[&<>"']/g, function (c) {
      return c === "&"
        ? "&amp;"
        : c === "<"
          ? "&lt;"
          : c === ">"
            ? "&gt;"
            : c === '"'
              ? "&quot;"
              : "&#39;";
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
      return `<tr data-planet="${esc(p.name)}">` +
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
    const aspects = (chart.aspects || [])
      .concat(chart.angleAspects || []) // include aspects to the Asc/MC
      .slice()
      .sort(function (a, b) { return a.orb - b.orb; });
    if (!aspects.length) return "<p class=\"empty\">No major aspects in orb.</p>";
    const rows = aspects.map(function (a) {
      const g = ASPECT_GLYPHS[a.type] || "";
      const perfects = a.perfectsAtUtc ? String(a.perfectsAtUtc).slice(0, 10) : "—";
      return `<tr data-a="${esc(a.a)}" data-b="${esc(a.b)}">` +
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
    applySelection();
  }

  // ---- Linked selection: click a planet (wheel or table) to focus it --------

  let selectedPlanet = null;

  function applySelection() {
    const svg = els.chart;
    const has = !!selectedPlanet;
    svg.classList.toggle("has-selection", has);
    svg.querySelectorAll(".planet-glyph").forEach(function (g) {
      g.classList.toggle("is-active", has && g.getAttribute("data-planet") === selectedPlanet);
    });
    svg.querySelectorAll(".aspect-line").forEach(function (l) {
      const on = has && (l.getAttribute("data-a") === selectedPlanet || l.getAttribute("data-b") === selectedPlanet);
      l.classList.toggle("is-active", on);
    });
    // Tables: highlight the selected planet's rows.
    els.details.querySelectorAll("tr[data-planet]").forEach(function (tr) {
      tr.classList.toggle("row-active", has && tr.getAttribute("data-planet") === selectedPlanet);
    });
    els.details.querySelectorAll("tr[data-a]").forEach(function (tr) {
      const on = has && (tr.getAttribute("data-a") === selectedPlanet || tr.getAttribute("data-b") === selectedPlanet);
      tr.classList.toggle("row-active", on);
      tr.classList.toggle("row-dim", has && !on);
    });
  }

  function selectPlanet(name) {
    selectedPlanet = selectedPlanet === name ? null : name;
    applySelection();
  }

  // ---- Recent charts (localStorage, degrades silently in private mode) -----

  /** Read the stored recent list, or [] if storage is unavailable/corrupt. */
  function readRecent() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  /** Persist the recent list. Silently no-ops if storage is unavailable. */
  function writeRecent(list) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      return true;
    } catch (e) {
      return false;
    }
  }

  /** Build a concise, human-readable label for a saved chart. */
  function recentLabel(result) {
    const chart = result.chart || {};
    const kind = chart.kind || "chart";
    if (result.horary) {
      const h = result.horary;
      return `Horary: ${h.querentSignificator} and ${h.quesitedSignificator}`;
    }
    if (result.electional && result.electional.topMoments && result.electional.topMoments[0]) {
      const best = result.electional.topMoments[0];
      return `Electional: best ${String(best.datetimeLocal).replace("T", " ")}`;
    }
    if (chart.utc) {
      return `${kind.charAt(0).toUpperCase() + kind.slice(1)}: ${String(chart.utc).slice(0, 16).replace("T", " ")} UTC`;
    }
    return kind.charAt(0).toUpperCase() + kind.slice(1);
  }

  function formatSavedAt(ts) {
    try {
      return new Date(ts).toLocaleString();
    } catch (e) {
      return "";
    }
  }

  /** Save the current result to the recent list (capped, de-duped by encoding). */
  function saveRecent(result) {
    let encoded;
    try {
      encoded = encodeResult(result);
    } catch (e) {
      return; // unserialisable - skip silently
    }
    const list = readRecent().filter(function (r) { return r && r.encoded !== encoded; });
    list.unshift({
      label: recentLabel(result),
      kind: (result.chart && result.chart.kind) || "chart",
      savedAt: Date.now(),
      encoded: encoded,
    });
    writeRecent(list.slice(0, RECENT_LIMIT));
    renderRecent();
  }

  /** Render the recent-charts list, or hide it when empty. */
  function renderRecent() {
    const list = readRecent();
    if (!list.length) {
      els.recent.hidden = true;
      els.recentList.innerHTML = "";
      return;
    }
    els.recentList.innerHTML = list.map(function (r, i) {
      return '<li><button type="button" class="recent-item" data-recent="' + i + '">' +
        '<span class="recent-label">' + esc(r.label) + "</span>" +
        '<span class="recent-time">' + esc(formatSavedAt(r.savedAt)) + "</span>" +
        "</button></li>";
    }).join("");
    els.recent.hidden = false;
  }

  /** Open a recent chart by index: load its JSON into the box and render. */
  function openRecent(index) {
    const list = readRecent();
    const item = list[index];
    if (!item) return;
    let result;
    try {
      result = decodeResult(item.encoded);
    } catch (e) {
      showShareNotice("That saved chart could not be opened.");
      return;
    }
    els.json.value = JSON.stringify(result, null, 2);
    handleRender();
  }

  // ---- Copy link / Copy JSON -----------------------------------------------

  function showCopyStatus(msg) {
    els.copyStatus.textContent = msg;
    window.clearTimeout(showCopyStatus._t);
    showCopyStatus._t = window.setTimeout(function () {
      els.copyStatus.textContent = "";
    }, 2500);
  }

  function showShareNotice(msg) {
    els.shareNotice.textContent = msg;
    els.shareNotice.hidden = !msg;
  }

  /** Copy text to the clipboard, with a synchronous fallback for file://. */
  function copyText(textValue, okMessage) {
    function fallback() {
      try {
        const ta = document.createElement("textarea");
        ta.value = textValue;
        ta.setAttribute("readonly", "");
        ta.style.position = "absolute";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (ok) showCopyStatus(okMessage);
        else showShareNotice("Copy failed. Select the JSON and copy it manually.");
      } catch (e) {
        showShareNotice("Copy is not available in this browser.");
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textValue).then(
        function () { showCopyStatus(okMessage); },
        fallback,
      );
    } else {
      fallback();
    }
  }

  function copyLink() {
    if (!lastResult) return;
    showShareNotice("");
    let encoded;
    try {
      encoded = encodeResult(lastResult);
    } catch (e) {
      showShareNotice("This chart could not be encoded into a link.");
      return;
    }
    const base = window.location.href.split("#")[0];
    const url = base + "#" + HASH_PARAM + "=" + encoded;
    // Reflect it in the address bar so a manual copy works too.
    try {
      window.history.replaceState(null, "", "#" + HASH_PARAM + "=" + encoded);
    } catch (e) {
      /* file:// may reject replaceState; the copied URL still works */
    }
    copyText(url, "Link copied");
  }

  function copyJson() {
    if (!lastResult) return;
    showShareNotice("");
    copyText(JSON.stringify(lastResult, null, 2), "JSON copied");
  }

  // ---- In-browser compute (wasm engine, loaded lazily on first compute) -----

  // Resolves to { runCompute } once web/engine.js + its wasm assets are loaded.
  // Kept so later computes are instant; reset to null on failure for a retry.
  let enginePromise = null;

  function loadEngine() {
    if (window.location.protocol === "file:") {
      return Promise.reject(new Error(
        "In-browser compute needs the page served over http(s) — browsers " +
        "block module/wasm loading from file://. Run e.g. " +
        "`python3 -m http.server` in web/ and reload. " +
        "(Pasting ComputeResult JSON still works here.)"
      ));
    }
    if (!enginePromise) {
      enginePromise = import("./engine.js")
        .catch(function (e) {
          enginePromise = null;
          throw new Error(
            "Could not load the engine bundle (web/engine.js). If you are " +
            "running from a clone, build it first with `pnpm build:web`. (" +
            e.message + ")"
          );
        })
        .then(function (mod) { return mod.initBrowserEngine(); })
        .catch(function (e) {
          enginePromise = null;
          throw e;
        });
    }
    return enginePromise;
  }

  function showComputeError(msg) {
    els.computeError.textContent = msg;
    els.computeError.hidden = !msg;
  }

  function setComputeStatus(msg) {
    els.computeStatus.textContent = msg;
  }

  /** Default the datetime-local input to "now" in this device's local time. */
  function defaultComputeDatetime() {
    function pad(n) { return String(n).padStart(2, "0"); }
    const d = new Date();
    els.computeDatetime.value =
      d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
      "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  /** Build a ComputeRequest from the form. Throws with a friendly message. */
  function computeRequestFromForm() {
    const kind = els.computeKind.value === "natal" ? "natal" : "horary";
    const datetimeLocal = els.computeDatetime.value;
    if (!datetimeLocal) throw new Error("Pick a date and time.");
    const latitude = parseFloat(els.computeLat.value);
    const longitude = parseFloat(els.computeLon.value);
    if (!isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw new Error("Latitude must be a number between -90 and 90.");
    }
    if (!isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new Error("Longitude must be a number between -180 and 180.");
    }
    const req = {
      kind: kind,
      moment: { datetimeLocal: datetimeLocal, latitude: latitude, longitude: longitude },
    };
    if (kind === "horary") req.quesitedHouse = parseInt(els.computeHouse.value, 10);
    return req;
  }

  function handleCompute(event) {
    if (event) event.preventDefault();
    showComputeError("");
    let req;
    try {
      req = computeRequestFromForm();
    } catch (e) {
      showComputeError(e.message);
      return;
    }
    const question = els.computeQuestion.value.trim();
    els.computeBtn.disabled = true;
    setComputeStatus(enginePromise
      ? "Computing…"
      : "Loading the ephemeris engine (first run downloads ~13 MB, then it's cached)…");
    loadEngine()
      .then(function (engine) {
        setComputeStatus("Computing…");
        const result = engine.runCompute(req);
        // Feed the result through the SAME path as pasted JSON, so the
        // verdict panel, wheel, details, share, and recent list all behave
        // identically for computed and pasted charts.
        els.json.value = JSON.stringify(result, null, 2);
        handleRender();
        if (question) {
          els.verdictQuestion.textContent = "“" + question + "”";
          els.verdictQuestion.hidden = false;
        }
        setComputeStatus("");
      })
      .catch(function (e) {
        setComputeStatus("");
        showComputeError(e && e.message ? e.message : String(e));
      })
      .then(function () {
        els.computeBtn.disabled = false;
      });
  }

  function handleGeolocate() {
    showComputeError("");
    if (!navigator.geolocation) {
      showComputeError("Geolocation is not available in this browser — enter latitude/longitude manually.");
      return;
    }
    setComputeStatus("Locating…");
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        els.computeLat.value = pos.coords.latitude.toFixed(4);
        els.computeLon.value = pos.coords.longitude.toFixed(4);
        setComputeStatus("");
      },
      function (err) {
        setComputeStatus("");
        showComputeError("Could not get your location (" + err.message + ") — enter latitude/longitude manually.");
      },
      { timeout: 10000 }
    );
  }

  /** Horary needs a question + quesited house; natal needs neither. */
  function syncComputeKind() {
    const horary = els.computeKind.value !== "natal";
    els.computeQuestionField.hidden = !horary;
    els.computeHouseField.hidden = !horary;
  }

  function handleRender() {
    showError("");
    showShareNotice("");
    // A pasted/decoded result has no form question attached; computed charts
    // re-show it right after this call.
    els.verdictQuestion.hidden = true;
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
    selectedPlanet = null;
    // Reset to the as-cast view, and reveal the switch only when relocation exists.
    viewMode = "natal";
    const hasReloc = !!(data.relocation && data.relocation.chart);
    els.viewSwitch.hidden = !hasReloc;
    if (hasReloc) els.chartView.value = "natal";
    renderVerdict(data);
    renderMetadata(data);
    draw();
    renderDetails();
    els.shareRow.hidden = false;
    saveRecent(data);
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
    // Read the example from the inline <script id="example-data"> block — no
    // fetch needed, so this works under file:// on first click.
    var el = document.getElementById("example-data");
    var txt = el ? el.textContent.trim() : "";
    if (txt) {
      els.json.value = txt;
      handleRender();
      return;
    }
    // Fallback: try fetch (http server path) then tell the user what to do.
    fetch("example-output.json")
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      })
      .then(function (fetched) {
        els.json.value = fetched;
        handleRender();
      })
      .catch(function () {
        showError(
          "Example data not found. Open example-output.json, copy its contents into the box, and click Render."
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
    els.verdict = $("verdict");
    els.verdictScopeNote = $("verdict-scope-note");
    els.verdictLean = $("verdict-lean");
    els.verdictSub = $("verdict-sub");
    els.verdictConfidence = $("verdict-confidence");
    els.verdictReasons = $("verdict-reasons");
    els.shareRow = $("share-row");
    els.copyLink = $("copy-link-btn");
    els.copyJsonBtn = $("copy-json-btn");
    els.copyStatus = $("copy-status");
    els.shareNotice = $("share-notice");
    els.recent = $("recent");
    els.recentList = $("recent-list");
    els.recentClear = $("recent-clear-btn");
    els.computeForm = $("compute-form");
    els.computeKind = $("compute-kind");
    els.computeQuestion = $("compute-question");
    els.computeQuestionField = $("compute-question-field");
    els.computeHouse = $("compute-house");
    els.computeHouseField = $("compute-house-field");
    els.computeDatetime = $("compute-datetime");
    els.computeLat = $("compute-lat");
    els.computeLon = $("compute-lon");
    els.computeGeo = $("compute-geo");
    els.computeBtn = $("compute-btn");
    els.computeStatus = $("compute-status");
    els.computeError = $("compute-error");
    els.verdictQuestion = $("verdict-question");

    els.computeForm.addEventListener("submit", handleCompute);
    els.computeGeo.addEventListener("click", handleGeolocate);
    els.computeKind.addEventListener("change", syncComputeKind);
    defaultComputeDatetime();
    syncComputeKind();

    els.render.addEventListener("click", handleRender);
    els.copyLink.addEventListener("click", copyLink);
    els.copyJsonBtn.addEventListener("click", copyJson);
    els.recentClear.addEventListener("click", function () {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        /* storage unavailable - nothing to clear */
      }
      renderRecent();
    });
    els.recentList.addEventListener("click", function (e) {
      const btn = e.target.closest("[data-recent]");
      if (btn) openRecent(Number(btn.getAttribute("data-recent")));
    });
    els.example.addEventListener("click", loadExample);
    els.clear.addEventListener("click", function () {
      els.json.value = "";
      lastResult = null;
      showError("");
      showShareNotice("");
      els.metadata.hidden = true;
      els.details.hidden = true;
      els.viewSwitch.hidden = true;
      els.verdict.hidden = true;
      els.verdictScopeNote.hidden = true;
      els.verdictQuestion.hidden = true;
      els.shareRow.hidden = true;
      els.copyStatus.textContent = "";
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

    // Linked selection: click a planet glyph in the wheel, or a planet row.
    els.chart.addEventListener("click", function (e) {
      const g = e.target.closest("[data-planet]");
      if (g) selectPlanet(g.getAttribute("data-planet"));
    });
    els.details.addEventListener("click", function (e) {
      const tr = e.target.closest("tr[data-planet]");
      if (tr) selectPlanet(tr.getAttribute("data-planet"));
    });
  }

  /**
   * If the URL hash carries an encoded ComputeResult (#r=<base64url>), decode
   * and render it through the same path as the textarea. Returns true if it
   * handled a hash, false otherwise. Never throws to a blank page.
   */
  function loadFromHash() {
    let hash = window.location.hash || "";
    if (hash.charAt(0) === "#") hash = hash.slice(1);
    if (!hash) return false;
    let encoded = null;
    try {
      const params = new URLSearchParams(hash);
      encoded = params.get(HASH_PARAM);
    } catch (e) {
      encoded = null;
    }
    if (!encoded) return false;
    if (encoded.length > MAX_ENCODED) {
      showShareNotice("This shared link is too large to open.");
      return true;
    }
    let result;
    try {
      result = decodeResult(encoded);
    } catch (e) {
      showShareNotice("This shared link could not be decoded.");
      return true;
    }
    const err = validateComputeResult(result);
    if (err) {
      showShareNotice("Shared link is not a valid chart: " + err);
      return true;
    }
    // Feed the decoded JSON through the same renderer as the textarea path.
    els.json.value = JSON.stringify(result, null, 2);
    handleRender();
    return true;
  }

  function start() {
    init();
    renderRecent();
    // Priority: an encoded result in the hash (#r=...) renders immediately.
    let handled = false;
    try {
      handled = loadFromHash();
    } catch (e) {
      /* never blank the page on a malformed hash */
      showShareNotice("This shared link could not be opened.");
      handled = true;
    }
    if (handled) return;
    // Otherwise auto-load if a ?data=<path> query param is present (wheel helper).
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
