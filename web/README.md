# Kairos Chart Wheel (web)

A self-contained, client-side chart-wheel viewer for the Kairos astrology
engine. It renders a 12-house wheel — zodiac ring, house cusps, planet glyphs at
their ecliptic longitudes, degree labels, retrograde markers, and colour-coded
aspect lines — directly from the engine's `ComputeResult` JSON.

No build step, no frameworks, no npm dependencies. Plain HTML/CSS/JS.

## Setup

Just open `index.html` in any modern browser. It works over the `file://`
protocol (double-click the file) or from any static web server.

```
open web/index.html          # macOS
# or serve it:
python3 -m http.server -d web 8000   # then visit http://localhost:8000
```

> File upload (via the file picker) and JSON paste work under `file://`.
> The **Load Example** button uses `fetch()`, which most browsers block under
> `file://`. If it fails, open `example-output.json`, copy its contents into the
> text box, and click **Render Chart**. Serving over `http://` makes the button
> work.

## Usage

1. Produce a `ComputeResult` from the Kairos engine CLI, e.g.

   ```sh
   pnpm --filter @kairos/engine compute > chart.json
   ```

   (Consult the engine's own README for exact CLI flags; the web UI only needs
   the JSON it prints.)

2. Either **paste** the JSON into the text box, or **upload** the `.json` file
   with the file picker.

3. Click **Render Chart**.

Use the **Display** checkboxes to toggle aspect lines, retrograde markers, house
cusps, and degree labels without re-pasting. Chart metadata (kind, UTC time,
Julian day, house system) appears below the controls.

## Reading the wheel

- **Zodiac ring** — outer band divided into 12 sign sectors (♈…♓), with a glyph
  at each sector midpoint and degree ticks every 5° (longer every 10°). Hover a
  sign glyph for its name.
- **Orientation** — the Ascendant sits at the **left (9 o'clock)** and ecliptic
  longitude increases **counter-clockwise**, the traditional wheel convention.
  `Asc` and `MC` markers sit just outside the ring.
- **House cusps** — thin radial lines from the hub to the ring. The four angular
  cusps (1st/Asc, 4th/IC, 7th/Dsc, 10th/MC) are drawn bolder. House numbers
  1–12 sit on the inner hub. `cusps[0]` is the 1st-house cusp.
- **Planets** — Unicode glyphs (☉ ☽ ☿ ♀ ♂ ♃ ♄ ♅ ♆ ♇ ☊) placed at their
  longitudes. A short tick points from the ring to the exact degree; the glyph
  may be nudged slightly so close pairs don't overlap. Hover a glyph for exact
  position. The degree-in-sign appears under each glyph (toggleable).
- **Retrograde** — bodies with `retrograde: true` get a red ℞ marker.
- **Aspect lines** — coloured chords between aspecting planets, inside the planet
  ring. Applying aspects are drawn slightly thicker/more opaque. Hover a line for
  the aspect type and orb. Colours:

  | Aspect      | Angle | Colour  |
  |-------------|-------|---------|
  | Conjunction | 0°    | amber   |
  | Sextile     | 60°   | green   |
  | Square      | 90°   | red     |
  | Trine       | 120°  | teal    |
  | Opposition  | 180°  | dark red|

The page respects your OS light/dark preference.

## Expected JSON shape

The UI consumes the engine's `ComputeResult` (see
`engine/src/types.ts`). Minimum required structure:

```json
{
  "chart": {
    "kind": "natal",
    "julianDayUt": 2448032.3125,
    "utc": "1990-05-21T19:30:00Z",
    "planets": [
      { "name": "Sun", "longitude": 60.42, "sign": "Gemini",
        "degInSign": 0.42, "retrograde": false, "speed": 0.9712 }
    ],
    "houses": {
      "system": "P",
      "cusps": [205.5, 233.1, 263.8, 296.2, 327.4, 357.9,
                25.5, 53.1, 83.8, 116.2, 147.4, 177.9],
      "ascendant": 205.5,
      "mc": 116.2
    },
    "aspects": [
      { "a": "Sun", "b": "Mercury", "type": "conjunction",
        "orb": 4.45, "applying": false }
    ]
  }
}
```

Validation requires: `chart.planets` (non-empty array, each with string `name`
and numeric `longitude`), `chart.houses.cusps` (exactly 12 numbers),
numeric `chart.houses.ascendant` and `chart.houses.mc`, and a `chart.aspects`
array (may be empty). Invalid input shows an inline error message.

Optional fields are surfaced in metadata when present: `horary` (querent/quesited
significators, Moon void-of-course) and `transitAspects` (a count). Aspects whose
`a`/`b` names don't match a body in `chart.planets` — e.g. the `t.`/`n.`-prefixed
names in `transitAspects` — are skipped when drawing lines.

A full working sample lives in [`example-output.json`](./example-output.json).

## Files

| File                  | Purpose                                          |
|-----------------------|--------------------------------------------------|
| `index.html`          | Page layout, form, and SVG viewport              |
| `style.css`           | All styling, incl. SVG element classes and theme |
| `chart.js`            | SVG rendering (`window.KairosChart`)             |
| `app.js`              | Parsing, validation, events, metadata            |
| `example-output.json` | Sample `ComputeResult` for testing               |

## Limitations

- Vanilla JS; tested against modern evergreen browsers. No IE support.
- Requires JSON in the engine's current `ComputeResult` shape. If the engine
  schema changes, update the validator in `app.js` and this README.
- UTC times are shown verbatim — no conversion to local time.
- Aspect lines are drawn only between bodies present in `chart.planets`.
- Unicode glyph rendering depends on the system font; if a glyph is missing the
  planet falls back to the first two letters of its name.
