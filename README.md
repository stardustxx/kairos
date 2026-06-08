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

## Install (for anyone)

Kairos runs anywhere, not just on the author's machine:

```bash
git clone <repo-url> kairos
cd kairos
pnpm install
pnpm test                       # run the engine test suite — all should pass
```

Then install the Claude Skill and point it at your checkout:

1. **Install the skill** — copy or symlink `skill/` into your Claude skills
   directory as `kairos` (it is typically *symlinked* there, so the skill file
   lives outside the repo and cannot locate the engine by walking up its own
   directory tree):

   ```bash
   ln -s "$(pwd)/skill" ~/.claude/skills/kairos
   ```

2. **Tell the skill where the engine lives** — export `KAIROS_ROOT` (the path to
   *this* checkout) so every engine command the skill runs can find it:

   ```bash
   export KAIROS_ROOT="$(pwd)"   # add to your shell profile to persist it
   ```

   `KAIROS_ROOT` is the **repo/engine** location. It is separate from
   `KAIROS_HOME`, which (if set) overrides where the engine stores your **data**
   (`~/.kairos`) — don't conflate them.

3. **Optional installers** — the offline geocoder and full-precision ephemeris
   are opt-in:

   ```bash
   pnpm geocode:install            # offline city → lat/lon + timezone gazetteer
   pnpm ephe:install               # full Swiss Ephemeris .se1 data files
   ```

## Setup

```bash
pnpm install
pnpm test        # run the engine test suite
```

## Try the engine directly

```bash
pnpm compute '{"kind":"horary","quesitedHouse":10,"moment":{"datetimeLocal":"2026-06-02T09:00:00","latitude":40.7128,"longitude":-74.006,"timezone":"America/New_York"}}'
```

## Geocode a place (offline)

Instead of looking up coordinates by hand, resolve a city name to authoritative
lat/lon + timezone from a local gazetteer (no network at query time):

```bash
pnpm geocode:install            # one-time: download the GeoNames cities15000 set
pnpm -s geocode 'Tokyo'         # → [{ name, country, latitude, longitude, timezone, ... }]
```

It returns the top matches, most populous first, as JSON. The data lives under
`~/.kairos/geonames` (outside the repo). Run with `pnpm -s` so stdout stays clean
JSON.

## Render a chart wheel

`pnpm wheel <json>` computes a request and opens an interactive SVG chart wheel
in your browser, pre-loaded with the result. For an **electional** request it
renders the chart of the #1 elected moment and shows its score and reasons.

```bash
pnpm wheel '{"kind":"horary","quesitedHouse":10,"moment":{"datetimeLocal":"2026-06-02T09:00:00","latitude":40.7128,"longitude":-74.006,"timezone":"America/New_York"}}'
```

The UI also runs standalone: open `web/index.html` and paste any `pnpm compute`
JSON (or click **Load Example**). See `web/README.md`.

## Memory

Kairos keeps a small **local** memory (`pnpm -s memory <command>`) so it can
remember you and learn from its own track record:

- **Profile** — `memory profile get|set|clear` stores your birth data (for
  transits/natal) and home/relocation location, so the skill doesn't re-ask.
- **Multiple people** — `memory profile list|use <slug>|add "<Name>"|remove <slug>`
  keep a separate profile per person you cast for (you, a partner, a friend).
  `get`/`set`/`clear` act on the active profile; append `--profile <slug>` to any
  command to act on another person for just that one call.
- **Journal** — `memory log <json>` records every verdict (question, kind, lean,
  confidence, score) and returns an `id`; `memory journal` lists them. Entries are
  tagged with the person they're about.
- **Outcomes & calibration** — `memory outcome <id> <happened|did-not-happen|partial> [note]`
  records what actually happened, and `memory calibration` reports hit-rate by
  confidence band (pooled across everyone; add `--profile <slug>` to narrow to one
  person). Small samples are noisy — it's a personal pattern, not proof.

All of this lives under `~/.kairos` (one `profiles/<slug>/` directory per person,
plus a pooled `journal.jsonl`) and is **never synced** — everyone's birth data and
your history stay on this machine. (Run with `pnpm -s`; the `-s` keeps pnpm's
banner out of the JSON.)

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

## License

Kairos is licensed under the **GNU Affero General Public License v3.0 or later**
(AGPL-3.0-or-later). The full text is in [`LICENSE`](./LICENSE); third-party
credits are in [`NOTICE`](./NOTICE).

**In plain English:** you can run, study, modify, and share Kairos freely. The
one extra string the AGPL attaches (beyond the regular GPL) is the *network*
clause: if you ever host a modified Kairos as a service that other people use over
a network, you must also offer those users the corresponding source code. For the
intended **local, personal** use — running it on your own machine — this changes
nothing; you're free to do whatever you like.

`sweph` (Swiss Ephemeris) is dual-licensed AGPL / commercial. Distributing Kairos
under the AGPL is fine for personal and open use; if you ever embed it in a
closed-source or commercial product, obtain a commercial Swiss Ephemeris license
from Astrodienst AG first (see `NOTICE`).
