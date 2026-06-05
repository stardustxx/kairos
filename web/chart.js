/*
 * chart.js — Core SVG rendering for Kairos chart wheels.
 *
 * Pure rendering module. No DOM event handling lives here (see app.js).
 * Exposes a small set of functions on the global `KairosChart` object so the
 * page works over the file:// protocol with no module bundler.
 *
 * GEOMETRY / ORIENTATION
 * ----------------------
 * Astrology wheels traditionally place the Ascendant (1st house cusp) at the
 * 9 o'clock position (screen left / due East) with ecliptic longitude
 * increasing COUNTER-clockwise around the wheel.
 *
 * SVG's coordinate system has y pointing DOWN, and the native polar
 * convention (cos, sin) sweeps CLOCKWISE on screen. To get the traditional
 * counter-clockwise zodiac we negate the angle.
 *
 * For a given ecliptic longitude L (degrees, 0..360) we compute a screen
 * angle, measured from the Ascendant longitude, then convert to Cartesian.
 *
 *   relative = L - ascendant            // 0 at the Ascendant
 *   screenDeg = 180 - relative          // 180 = left (9 o'clock); subtract to
 *                                       //   go counter-clockwise as L grows
 *   x = cx + r * cos(screenDeg)
 *   y = cy + r * sin(screenDeg)
 *
 * Sanity check (with the example fixture, ascendant = 205.5):
 *   - L = 205.5 (Ascendant)        -> relative 0    -> screenDeg 180 -> left.   OK
 *   - L = 205.5 + 90 = 295.5 (IC)  -> relative 90   -> screenDeg 90  -> bottom. OK
 *     (90° of zodiac counter-clockwise from the left lands at the bottom — the
 *      4th house cusp / IC region, which is correct for a wheel drawn CCW.)
 *   - L = 205.5 - 90 = 115.5 (MC)  -> relative -90  -> screenDeg 270 -> top.    OK
 */

(function (global) {
  "use strict";

  // ---- Constants -----------------------------------------------------------

  const SIZE = 600; // SVG viewBox width/height in user units
  const CENTER = SIZE / 2; // 300

  // Concentric radii (user units from center).
  const R = {
    outer: 285, // outer edge of zodiac ring
    zodiac: 250, // inner edge of zodiac ring (where sign band ends)
    signLabel: 267, // radius for sign glyph labels
    house: 250, // outer end of house cusp lines
    houseInner: 70, // inner end of house cusp lines (hub radius)
    houseNum: 90, // radius for house-number labels
    planet: 175, // radius where planet glyphs sit
    planetTick: 248, // outer end of the little tick that points to exact longitude
    degLabel: 150, // radius for the degree text under each planet
    aspectHub: 145, // aspect lines drawn within this radius (inside planet ring)
  };

  const SVG_NS = "http://www.w3.org/2000/svg";

  const SIGNS = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
  ];

  // Unicode zodiac glyphs, indexed by sign (Aries..Pisces).
  const SIGN_GLYPHS = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];

  // Planet glyphs. Falls back to the name (truncated) if a glyph is missing.
  const PLANET_GLYPHS = {
    Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀", Mars: "♂",
    Jupiter: "♃", Saturn: "♄", Uranus: "♅", Neptune: "♆", Pluto: "♇",
    Node: "☊",
  };

  const RETROGRADE = "℞";

  // Aspect type -> CSS class (colours live in style.css).
  const ASPECT_CLASS = {
    conjunction: "aspect-conjunction",
    sextile: "aspect-sextile",
    trine: "aspect-trine",
    square: "aspect-square",
    opposition: "aspect-opposition",
  };

  // ---- Low-level SVG helpers ----------------------------------------------

  function el(name, attrs) {
    const node = document.createElementNS(SVG_NS, name);
    if (attrs) {
      for (const k in attrs) {
        if (attrs[k] !== null && attrs[k] !== undefined) {
          node.setAttribute(k, attrs[k]);
        }
      }
    }
    return node;
  }

  function text(content, attrs) {
    const node = el("text", attrs);
    node.textContent = content;
    return node;
  }

  /**
   * Map an ecliptic longitude (degrees) to an {x, y} point on the wheel.
   * `radius` is the distance from center in user units.
   * `ascendant` rotates the whole wheel so the Asc sits at screen-left.
   */
  function degreesToXY(longitude, radius, ascendant) {
    const relative = longitude - ascendant;
    const screenDeg = 180 - relative;
    const rad = (screenDeg * Math.PI) / 180;
    return {
      x: CENTER + radius * Math.cos(rad),
      y: CENTER + radius * Math.sin(rad),
    };
  }

  // ---- Layer renderers -----------------------------------------------------

  function renderZodiac(svg, ascendant) {
    const g = el("g", { class: "zodiac" });

    // Outer + inner ring circles.
    g.appendChild(el("circle", { cx: CENTER, cy: CENTER, r: R.outer, class: "ring-circle" }));
    g.appendChild(el("circle", { cx: CENTER, cy: CENTER, r: R.zodiac, class: "ring-circle" }));

    // 12 sign sectors: divider lines every 30° and a glyph at each sector mid.
    for (let i = 0; i < 12; i++) {
      const startLon = i * 30;
      const a = degreesToXY(startLon, R.zodiac, ascendant);
      const b = degreesToXY(startLon, R.outer, ascendant);
      g.appendChild(el("line", {
        x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: "sign-divider",
      }));

      const mid = degreesToXY(startLon + 15, R.signLabel, ascendant);
      const label = text(SIGN_GLYPHS[i], {
        x: mid.x, y: mid.y, class: "sign-glyph",
        "text-anchor": "middle", "dominant-baseline": "central",
      });
      const titleEl = el("title");
      titleEl.textContent = SIGNS[i];
      label.appendChild(titleEl);
      g.appendChild(label);
    }

    // Fine degree ticks every 5°, longer every 10°.
    for (let d = 0; d < 360; d += 5) {
      const long = d % 10 === 0;
      const inner = degreesToXY(d, R.outer - (long ? 10 : 6), ascendant);
      const outer = degreesToXY(d, R.outer, ascendant);
      g.appendChild(el("line", {
        x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y,
        class: long ? "deg-tick deg-tick-major" : "deg-tick",
      }));
    }

    svg.appendChild(g);
  }

  function renderHouses(svg, houses, options) {
    if (!options.showCusps) return;
    const g = el("g", { class: "houses" });
    const cusps = houses.cusps;
    const asc = houses.ascendant;

    for (let i = 0; i < 12; i++) {
      const lon = cusps[i];
      const inner = degreesToXY(lon, R.houseInner, asc);
      const outer = degreesToXY(lon, R.house, asc);

      // Angular cusps (Asc = 1st, IC = 4th, Dsc = 7th, MC = 10th) drawn bolder.
      const angular = i === 0 || i === 3 || i === 6 || i === 9;
      g.appendChild(el("line", {
        x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y,
        class: angular ? "cusp-line cusp-line-angular" : "cusp-line",
      }));

      // House number placed at the midpoint of the arc between this cusp and
      // the next, on the inner hub.
      const next = cusps[(i + 1) % 12];
      let span = next - lon;
      if (span <= 0) span += 360; // handle wraparound
      const midLon = lon + span / 2;
      const numPos = degreesToXY(midLon, R.houseNum, asc);
      g.appendChild(text(String(i + 1), {
        x: numPos.x, y: numPos.y, class: "house-number",
        "text-anchor": "middle", "dominant-baseline": "central",
      }));
    }

    // Asc / MC markers just outside the wheel.
    const ascPos = degreesToXY(asc, R.outer + 14, asc);
    g.appendChild(text("Asc", {
      x: ascPos.x, y: ascPos.y, class: "angle-label",
      "text-anchor": "middle", "dominant-baseline": "central",
    }));
    const mcPos = degreesToXY(houses.mc, R.outer + 14, asc);
    g.appendChild(text("MC", {
      x: mcPos.x, y: mcPos.y, class: "angle-label",
      "text-anchor": "middle", "dominant-baseline": "central",
    }));

    svg.appendChild(g);
  }

  /**
   * Spread out planets that sit very close in longitude so their glyphs do not
   * overlap. Returns a map name -> displayLongitude (the angle used only for
   * placing the glyph; the tick still points at the true longitude).
   */
  function spreadPlanets(planets) {
    const MIN_SEP = 7; // degrees of visual separation
    const sorted = planets
      .map((p, idx) => ({ idx, lon: p.longitude }))
      .sort((a, b) => a.lon - b.lon);

    const display = {};
    for (let i = 0; i < sorted.length; i++) {
      let lon = sorted[i].lon;
      if (i > 0) {
        const prev = sorted[i - 1].displayLon;
        if (lon - prev < MIN_SEP) lon = prev + MIN_SEP;
      }
      sorted[i].displayLon = lon;
      display[planets[sorted[i].idx].name] = lon;
    }
    return display;
  }

  function renderPlanets(svg, planets, ascendant, options) {
    const g = el("g", { class: "planets" });
    const display = spreadPlanets(planets);

    for (const p of planets) {
      const trueLon = p.longitude;
      const showLon = display[p.name];

      // Tick from the zodiac ring inward to the true longitude position.
      const tickOuter = degreesToXY(trueLon, R.planetTick, ascendant);
      const tickInner = degreesToXY(trueLon, R.planet + 12, ascendant);
      g.appendChild(el("line", {
        x1: tickOuter.x, y1: tickOuter.y, x2: tickInner.x, y2: tickInner.y,
        class: "planet-tick",
      }));

      const pos = degreesToXY(showLon, R.planet, ascendant);
      const glyph = PLANET_GLYPHS[p.name] || p.name.slice(0, 2);
      const glyphEl = text(glyph, {
        x: pos.x, y: pos.y, class: "planet-glyph",
        "text-anchor": "middle", "dominant-baseline": "central",
      });
      const titleEl = el("title");
      titleEl.textContent =
        `${p.name} ${p.degInSign.toFixed(2)}° ${p.sign}` +
        (p.retrograde ? " (R)" : "");
      glyphEl.appendChild(titleEl);
      g.appendChild(glyphEl);

      // Degree-in-sign label under the glyph.
      if (options.showDegrees) {
        const degPos = degreesToXY(showLon, R.degLabel, ascendant);
        const degStr = `${Math.floor(p.degInSign)}°`;
        g.appendChild(text(degStr, {
          x: degPos.x, y: degPos.y, class: "deg-label",
          "text-anchor": "middle", "dominant-baseline": "central",
        }));
      }

      // Retrograde marker.
      if (options.showRetrograde && p.retrograde) {
        const rPos = degreesToXY(showLon, R.planet - 18, ascendant);
        g.appendChild(text(RETROGRADE, {
          x: rPos.x, y: rPos.y, class: "retro-label",
          "text-anchor": "middle", "dominant-baseline": "central",
        }));
      }
    }

    svg.appendChild(g);
  }

  function renderAspects(svg, aspects, planets, ascendant, options) {
    if (!options.showAspects || !aspects) return;
    const g = el("g", { class: "aspects" });

    const byName = {};
    for (const p of planets) byName[p.name] = p;

    for (const asp of aspects) {
      const A = byName[asp.a];
      const B = byName[asp.b];
      // Skip aspects referencing bodies not in this planet set (e.g. transit
      // "t."/"n." prefixed names from transitAspects).
      if (!A || !B) continue;

      const pa = degreesToXY(A.longitude, R.aspectHub, ascendant);
      const pb = degreesToXY(B.longitude, R.aspectHub, ascendant);
      const cls = ASPECT_CLASS[asp.type] || "aspect-other";

      const line = el("line", {
        x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y,
        class: "aspect-line " + cls + (asp.applying ? " aspect-applying" : ""),
      });
      const titleEl = el("title");
      titleEl.textContent =
        `${asp.a} ${asp.type} ${asp.b} — orb ${asp.orb.toFixed(2)}°` +
        (asp.applying ? ", applying" : ", separating");
      line.appendChild(titleEl);
      g.appendChild(line);
    }

    svg.appendChild(g);
  }

  function clearChart(svg) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
  }

  /**
   * Render a full chart wheel from a ComputeResult.
   * @param {SVGElement} svg     target <svg> element
   * @param {object} result      a parsed ComputeResult ({ chart, ... })
   * @param {object} options     visibility flags
   */
  function renderChart(svg, result, options) {
    options = options || {};
    const chart = result.chart;
    const ascendant = chart.houses.ascendant;

    clearChart(svg);
    svg.setAttribute("viewBox", `0 0 ${SIZE} ${SIZE}`);

    // Order matters: aspects sit beneath planets and the rings.
    renderZodiac(svg, ascendant);
    renderHouses(svg, chart.houses, options);
    renderAspects(svg, chart.aspects, chart.planets, ascendant, options);
    renderPlanets(svg, chart.planets, ascendant, options);
  }

  global.KairosChart = {
    SIZE: SIZE,
    SIGNS: SIGNS,
    degreesToXY: degreesToXY,
    renderZodiac: renderZodiac,
    renderHouses: renderHouses,
    renderPlanets: renderPlanets,
    renderAspects: renderAspects,
    clearChart: clearChart,
    renderChart: renderChart,
  };
})(window);
