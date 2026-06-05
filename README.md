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

1. Download the `.se1` data files from Astrodienst and place them in a directory,
   then point the engine at it:

   ```bash
   export KAIROS_EPHE_PATH=/path/to/ephemeris
   ```

2. Enable SWIEPH computation:

   ```bash
   export KAIROS_SWIEPH=1
   pnpm compute '...'
   ```

If `KAIROS_SWIEPH=1` but the data files are unavailable, the engine logs a
warning to **stderr** and gracefully falls back to Moshier. Missing files never
crash the engine, and stdout JSON stays clean. The flags are resolved once at
process start (see `engine/src/ephemeris.ts`).

## Scope

The engine covers **horary**, **transits**, **natal**, and **electional**
(best-window search — scan a future window and rank candidate moments by
classical electional rules). A chart-wheel web UI is still planned.

## Licensing note

`sweph` (Swiss Ephemeris) is dual-licensed AGPL / commercial. Fine for personal
and open use; revisit before shipping a closed commercial product.
