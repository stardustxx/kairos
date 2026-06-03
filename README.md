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
- Computation: Swiss Ephemeris **Moshier mode** — no data files, sub-arcsecond
  accuracy for the modern era. To upgrade to full SWIEPH precision, install the
  `.se1` data files and switch the flags in `engine/src/constants.ts`.

## Scope

v1 covers **horary**, **transits**, and **natal**. Electional (best-window search)
and a chart-wheel web UI are planned for v2; the engine is built to support both.

## Licensing note

`sweph` (Swiss Ephemeris) is dual-licensed AGPL / commercial. Fine for personal
and open use; revisit before shipping a closed commercial product.
