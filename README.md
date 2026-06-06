# Kairos

Astrology-based decision support as a Claude Skill. Ask a real-life question
("will I get this job?", "is now the right time to switch?") and Kairos computes
an astronomically accurate chart (Swiss Ephemeris) and returns a calibrated
verdict — a clear lean, a confidence level, the specific signals behind it, and
honest caveats.

## How it works

- **`engine/`** — a TypeScript CLI (`pnpm compute <json>`) that computes planetary
  positions, houses, aspects, and horary significators. Pure math, fully tested.
- **`skill/SKILL.md`** — the Claude Skill: classifies the question, calls the
  engine, and interprets the result. Pure judgment, no math.

## Setup

```bash
pnpm install
pnpm test        # run the engine test suite
```

## Try the engine directly

```bash
pnpm compute '{"kind":"horary","quesitedHouse":10,"moment":{"datetimeLocal":"2026-06-02T09:00:00","latitude":40.7128,"longitude":-74.006,"timezone":"America/New_York"}}'
```

## Render a chart wheel

`pnpm wheel <json>` computes a request and opens an interactive SVG chart wheel
in your browser, pre-loaded with the result. For an **electional** request it
renders the chart of the #1 elected moment and shows its score and reasons.

```bash
pnpm wheel '{"kind":"horary","quesitedHouse":10,"moment":{"datetimeLocal":"2026-06-02T09:00:00","latitude":40.7128,"longitude":-74.006,"timezone":"America/New_York"}}'
```

The UI also runs standalone: open `web/index.html` and paste any `pnpm compute`
JSON (or click **Load Example**). See `web/README.md`.

## Install the skill

Copy or symlink `skill/` into your Claude skills directory as `kairos`, or point
your skill loader at `skill/SKILL.md`. The skill runs `pnpm compute` from this
project root, so keep the engine installed alongside it.

## Conventions

- Western **tropical** zodiac.
- Houses: **Placidus** (`"P"`) for natal/transit, **Regiomontanus** (`"R"`) for
  horary; pass `houseSystem` to override.
- Computation: Swiss Ephemeris **Moshier mode** by default — no data files,
  sub-arcsecond accuracy for the modern era. See "Ephemeris precision" below to
  opt into full SWIEPH precision.

## Ephemeris precision (SWIEPH opt-in)

By default, the engine uses the **Moshier analytical ephemeris** — accurate for
the modern era, no data files required. To use full Swiss Ephemeris (SWIEPH)
precision:

1. Download the `.se1` data files (planets + Moon, 1800–2399 CE) into `./ephe`:

   ```bash
   pnpm ephe:install            # or: pnpm ephe:install /custom/dir
   ```

2. Enable SWIEPH computation by pointing at that directory:

   ```bash
   KAIROS_SWIEPH=1 KAIROS_EPHE_PATH=./ephe pnpm -s compute '...'
   ```

   This shifts positions by up to ~1″ vs Moshier (e.g. the Moon), which is
   negligible for judgment but available if you want full JPL-derived precision.

If `KAIROS_SWIEPH=1` but the data files are unavailable, the engine logs a
warning to **stderr** and gracefully falls back to Moshier. Missing files never
crash the engine, and stdout JSON stays clean. The flags are resolved once at
process start (see `engine/src/ephemeris.ts`).

## Scope

The engine covers **horary**, **transits**, **natal**, and **electional**
(best-window search — scan a future window and rank candidate moments by
classical electional rules). Every chart also carries **essential dignities**
(Lilly's domicile/exaltation/triplicity/term/face scoring), **sect**, and the
**Part of Fortune**; horary judgments add **reception** and dignity-weighted
significator strength on top of translation/collection of light. Charts can be
**relocated** — pass a `relocation` place to recast the houses/angles for where
someone lives now (same birth moment, planets unchanged, only the houses move). An
interactive chart-wheel web UI ships in `web/` (`pnpm wheel`), with a
Birthplace/Relocated view switch and detail tables.

## Licensing note

`sweph` (Swiss Ephemeris) is dual-licensed AGPL / commercial. Fine for personal
and open use; revisit before shipping a closed commercial product.
