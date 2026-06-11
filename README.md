# Kairos

**An astrology decision-support tool that gives you an honest answer, not a horoscope.**

Ask a real decision or timing question, like *"Will I get the job?"*, *"Is now the
right time to switch?"*, or *"Will this come to fruition?"*. Kairos computes an
astronomically accurate chart with the Swiss Ephemeris, then returns a
**calibrated verdict**:

- a clear **lean** (favorable / unfavorable / uncertain),
- a **confidence level** (low / medium / high) tied to the actual weight of evidence,
- the specific **classical signals** behind it (the real testimonies, scored), and
- **falsifiable caveats**, including, up front, the outcome that would prove the read wrong.

Astrology is treated as one honest input, not destiny. No vague flattery, no
unfalsifiable retrofits, no fake metrics. Just a lean you can act on and check
against what actually happens.

**For:** anyone weighing a real choice who wants a structured, classical second
opinion they can interrogate, and Claude Code users who want that opinion as a skill.

**Install (Claude Code plugin):**

```bash
/plugin marketplace add stardustxx/kairos
/plugin install kairos@stardustxx
```

See a real round-trip, question in and two-layer verdict out, in
**[the worked example](docs/example.md)** (a "Will I get the job?" horary that the
engine scores `favorable`, `medium` confidence, `+38`).

---

Kairos is available as:
- A Claude Code **plugin** (includes both the skill and the MCP server)
- A standalone **MCP server** (`npx -y kairos-astrology mcp`)
- A **CLI tool** (`kairos compute`, `kairos memory`, `kairos geocode`)
- A **Docker image** (fallback for Intel Mac, musl, and unprebuilt ABIs)

## How it works

- **`engine/`** is a TypeScript CLI that computes planetary positions, houses, aspects, and horary significators. Pure math, fully tested.
- **`.claude-plugin/`** is a Claude Code plugin that bundles the MCP server and the skill. Install via Claude Code's plugin marketplace.
- **`skills/kairos/SKILL.md`** is the Claude Skill (bundled in the plugin): it classifies the question, calls the MCP tools, and interprets the result. Pure judgment, no math.

## A 30-second example

Ask **"Will I get the job?"** in London on 8 June 2026 at 11:15. The 10th house
signifies the job, so:

```bash
pnpm -s compute '{"kind":"horary","quesitedHouse":10,"moment":{"datetimeLocal":"2026-06-08T11:15:00","latitude":51.5074,"longitude":-0.1278,"timezone":"Europe/London"}}'
```

The engine returns the chart plus a scored verdict. The decisive part:

```json
{
  "lean": "favorable",
  "confidence": "medium",
  "score": 38,
  "testimonies": [
    "No direct aspect between the significators (0)",
    "Moon (co-significator of querent) applies by trine to the quesited (+20)",
    "Translation of light by Moon (Mercury → Venus) (+18)"
  ]
}
```

The skill turns that into a two-layer answer. Layer 1 is the plain read; Layer 2
is the optional mechanics:

> **Leans yes, moderate confidence.** The job is reachable, but it comes to you
> sideways rather than landing cleanly in your lap. **Most likely:** it comes
> through with help from a third party, such as a referral, a recruiter, or an
> introduction. **What would prove this wrong:** a flat, early "no" with no
> intermediary involved.
>
> *The chart detail, if you want it:* you (the querent) are Mercury in Cancer
> 10.6° (dignity +1); the job is Venus in Cancer 24.1° (dignity +3). There is no
> direct aspect, but the Moon translates light from Mercury to Venus by trine
> (+18) and applies to Venus by trine (+20). That's the third party carrying it
> through. With no prohibition and the Moon not void, an outright "no" is the
> least likely outcome. Engine score **+38**.

Every number above comes from a real run. The **[full worked example](docs/example.md)**
walks through the complete two-layer reading; the same chart is also viewable in the
web UI (`web/index.html` → **Load Example**).

## More worked examples

The **[example gallery](docs/examples/README.md)** has five complete,
reproducible round-trips. Each one includes the question, the exact command, the
verbatim JSON verdict, and a two-layer reading built only from the real numbers:

| Example | Kind | Real verdict |
|---------|------|--------------|
| [Career horary](docs/examples/01-career-horary.md): "Will I get the job?" | `horary` (10th) | `favorable` / `medium` / **+38** |
| [Relationship horary](docs/examples/02-relationship-horary.md): "Will we get back together?" | `horary` (7th) | `unfavorable` / `medium` / **−35** |
| [Relocation transit](docs/examples/03-relocation-transit.md): born Seoul, living NYC | `transit` + `relocation` | 11 placements change house; lord of year Mars |
| [Electional window](docs/examples/04-electional-window.md): "When should I launch?" | `electional` (10th) | 117 moments, best **+155** |
| [Money horary](docs/examples/05-money-horary.md): "Will the money come through?" | `horary` (2nd) | `favorable` / `medium` / **+35** |

These were not cherry-picked to all say yes; example 2 is an honest no. Every
file ends with a copy-paste command, and since the Swiss Ephemeris is
deterministic, you get the same chart and the same verdict.

## Calibration contract: Kairos keeps score

Here is the thing no generic astrology tool will do: keep score against itself.

Every directional verdict Kairos produces is falsifiable, and the tool is built
to log it, remember it, and grade itself later:

1. **Log on compute.** Pass a `journal` field (or use the skill) and the engine
   records the question alongside the verdict it actually returned (kind,
   `lean`, `confidence`, `score`), captured from the engine itself so the track
   record can't drift from a hand-copied number. When the chart has a perfection
   date, it's stored as the expected-resolution date ("ask me later").
2. **Resolve when ripe.** `kairos memory due` surfaces the logged readings whose
   expected-resolution date has arrived. You tell it what happened:
   `kairos memory outcome <id> happened` (or `did-not-happen` / `partial` /
   `unknown`).
3. **Read the scorecard.** `kairos memory calibration` reports your hit-rate by
   confidence band. Does "high confidence" actually win more often than "low"?

The honest part: today that scorecard is empty. With no outcomes recorded yet,
the real report is exactly this (verbatim):

```jsonc
// kairos memory calibration  (on a fresh install)
{
  "bands": [
    { "confidence": "low",    "resolved": 0, "correct": 0, "hitRate": null },
    { "confidence": "medium", "resolved": 0, "correct": 0, "hitRate": null },
    { "confidence": "high",   "resolved": 0, "correct": 0, "hitRate": null }
  ],
  "overall": { "resolved": 0, "correct": 0, "hitRate": null },
  "note": "Small samples are noisy — this is a personal pattern, not proof."
}
```

The `--card` view prints it plainly: *"No resolved outcomes yet — here is how the
track record grows."* Kairos does not ship a fake hit-rate, and it does not
claim its astrology is proven. It claims something narrower and more useful: it is
the astrology tool that states a falsifiable verdict, remembers it, and will
show you its own batting average as your outcomes accumulate, by confidence
band, with the sample size always in view, and the standing caveat that a small
personal sample is a pattern, not proof.

That reframes Kairos from "another ephemeris wrapper" to the one that keeps
score.

## Install

### Primary: Claude Code Plugin

The easiest way to use Kairos in Claude Code:

```bash
/plugin marketplace add stardustxx/kairos
/plugin install kairos@stardustxx
```

This installs both the skill and the MCP server. The skill is automatically available as `/kairos:kairos`.

### Alternative: Register the MCP Server Directly

If you already have Claude Code set up and want to just use the MCP tools without the full plugin:

```bash
# Start the server standalone
npx -y kairos-astrology mcp

# Or use the bundled MCP server via Claude Code's MCP configuration
```

The server prints a one-line ready notice to stderr and then nothing more, because stdout is
reserved for the MCP protocol. An otherwise quiet terminal is success: point an MCP client at
it and it is ready to accept tool calls.

Note: the raw MCP tools expose the ephemeris and verdict engine. The Claude Code plugin's skill
layer adds the judgment discipline: question classification, the house-mapping table, two-layer
output, falsifiability lines, and journal-by-default. If you are using the MCP server without
the plugin, you are getting the engine without that calibration harness.

### Alternative: CLI Tool

For direct command-line access:

```bash
# Install globally
npm install -g kairos-astrology

# Or use npx without installation
npx -y kairos-astrology compute '{"kind":"horary","quesitedHouse":10,"moment":{"datetimeLocal":"2026-06-08T14:30:00","latitude":40.7128,"longitude":-74.0060}}'

# Geocode a location
npx -y kairos-astrology geocode 'Tokyo'

# Check past readings
npx -y kairos-astrology memory due

# Set birth profile
npx -y kairos-astrology memory profile set '{"birth":{"datetimeLocal":"1990-03-12T07:45:00","latitude":37.57,"longitude":126.98,"timezone":"Asia/Seoul","place":"Seoul"}}'
```

### Cold install and the Intel-Mac caveat (read before `npx`)

Kairos's only native dependency is `sweph` (the Swiss Ephemeris bindings). It
ships prebuilt binaries for:

| Platform | Cold `npx` / install |
|----------|----------------------|
| **macOS Apple Silicon** (`darwin-arm64`) | prebuilt, installs with no compiler |
| **Linux x64 / arm64** (glibc) | prebuilt, installs with no compiler |
| **Windows x64** (`win32-x64`) | prebuilt, installs with no compiler |
| **Intel macOS** (`darwin-x64`) | **no prebuild, compiles from source on first install** |
| **Alpine / musl Linux** | **no prebuild, compiles from source** |

On Intel macOS (and musl Linux), the first `npx -y kairos-astrology …` or
`npm install` will compile `sweph` from source, which requires the Xcode
Command Line Tools (`xcode-select --install`) on Mac, or `build-base` +
`python3` on Alpine. This is a one-time cost; once built, subsequent runs are
fast. If the required toolchain is absent, the CLI and MCP server now fail with
an actionable message naming the exact install command (`xcode-select --install`
on Mac, `apk add build-base python3` on Alpine, or the Docker fallback) rather
than emitting an opaque node-gyp stack trace.

You do not need any ephemeris data files for this. Kairos defaults to Swiss
Ephemeris Moshier mode, which computes positions analytically (sub-arcsecond
for the modern era) with no `.se1` downloads. The compile is only for the
native addon, not for data.

If you can't (or don't want to) compile, the Docker image is the zero-build
fallback. It bundles a working `sweph` for every platform:

```bash
docker build -t kairos:latest .
docker run --rm -i kairos:latest mcp     # stdio MCP server, forward to Claude Code
docker run --rm -i kairos:latest compute '{"kind":"horary","quesitedHouse":10,"moment":{"datetimeLocal":"2026-06-08T11:15:00","latitude":51.5074,"longitude":-0.1278,"timezone":"Europe/London"}}'
```

## Development: Build from Source

```bash
git clone https://github.com/stardustxx/kairos.git
cd kairos
pnpm install
pnpm test                       # run the engine test suite
```

### Try the engine directly

```bash
pnpm compute '{"kind":"horary","quesitedHouse":10,"moment":{"datetimeLocal":"2026-06-08T09:00:00","latitude":40.7128,"longitude":-74.006,"timezone":"America/New_York"}}'
```

### Geocode a place (offline)

```bash
pnpm geocode:install            # one-time: download the GeoNames cities15000 set
pnpm -s geocode 'Tokyo'         # → [{ name, country, latitude, longitude, timezone, ... }]
```

When using the MCP server, the `geocode_install` MCP tool handles the one-time city-database
download interactively with user consent, no shell command required.

### Render a chart wheel

```bash
pnpm wheel '{"kind":"horary","quesitedHouse":10,"moment":{"datetimeLocal":"2026-06-08T09:00:00","latitude":40.7128,"longitude":-74.006,"timezone":"America/New_York"}}'
```

The UI also runs standalone: open `web/index.html` and paste any `pnpm compute` JSON (or click **Load Example**). See `web/README.md`.

### Compute in the browser (no server)

The web app can also compute charts entirely in your browser. The same engine
code runs against a WebAssembly build of the Swiss Ephemeris
([`swisseph-wasm`](https://github.com/prolaxu/swisseph-wasm), GPL-3.0-or-later),
in the same Moshier mode as the Node default. A parity test pins the two
backends to within 1e-6° and to identical horary verdicts. Everything stays
in-page: no server, no telemetry, no data leaves the machine (the
"use my location" button uses the browser's own geolocation API, locally).

From a clone, build the browser bundle once, then serve `web/`:

```bash
pnpm build:web                   # esbuild → web/engine.js + swisseph.{wasm,data}
python3 -m http.server -d web    # any static server; file:// can't load wasm modules
```

Fill in the compute form (kind, optional question, date/time, lat/lon, the
matter's house) and the verdict panel + wheel render through the same path as
pasted JSON. The npm tarball ships `web/engine.js`, `web/swisseph.wasm`, and
`web/swisseph.data` prebuilt; in a git clone they are gitignored, so run
`pnpm build:web` yourself. The in-browser mode covers horary and natal charts;
journal/memory and the offline geocoder remain Node-only (enter lat/lon
manually, or look them up with `pnpm geocode`).

### Start the MCP server locally

```bash
pnpm mcp
```

## Memory

Kairos keeps a small **local** memory so it can remember you and learn from its own track record:

- **Profile** stores your birth data (for transits/natal) and home/relocation location
- **Multiple people**: keep separate profiles per person you cast for (yourself, a partner, a friend)
- **Journal**: every verdict (question, kind, lean, confidence, score) is recorded
- **Outcomes and calibration**: record what actually happened and see hit-rate by confidence band

All memory is stored locally under `~/.kairos` (one `profiles/<slug>/` directory per person, plus a pooled `journal.jsonl`) and is never synced. Everyone's birth data and your reading history stay on this machine.

## Conventions

- Western **tropical** zodiac.
- Houses: **Placidus** for natal/transit, **Regiomontanus** for horary
- Computation: Swiss Ephemeris **Moshier mode** by default. No data files, sub-arcsecond accuracy for the modern era. Opt into full SWIEPH precision:

  ```bash
  pnpm ephe:install            # download full .se1 data files
  ```

## Distribution & Publishing

Kairos publishes to npm as `kairos-astrology`. The package ships:
- The compiled engine (`dist/`)
- The Claude skill and the plugin manifests (`skills/`, `.claude-plugin/`)
- The web UI (`web/`, minus the local `last-result.json` artifact)
- `LICENSE`, `NOTICE`, `README.md`, and the docs they link

> **Note:** this package sets `devEngines.packageManager: pnpm`, so `npm
> publish` / `npm pack` are blocked with `EBADDEVENGINES`. Publish with
> `pnpm` (which the repo uses anyway). `pnpm pack --dry` prints the exact
> tarball contents.

### Maintainer publish checklist

v1.1.0 is published: [`kairos-astrology` on npm](https://www.npmjs.com/package/kairos-astrology),
the `v1.1.0` tag is cut (release-check green on macOS, Linux, and Windows), and the
MCP server is registered as `io.github.stardustxx/kairos` in the
[official MCP registry](https://registry.modelcontextprotocol.io). The checklist
below is the repeatable sequence for the next release; bump the versions first.

```bash
# 1. Verify green
pnpm install
pnpm lint && pnpm typecheck && pnpm test         # all must pass (321 tests today)

# 2. Build the publishable artifacts
pnpm build                                        # tsc -> dist/ (also runs as prepublishOnly)

# 3. Inspect what will ship (no last-result.json; dist + skills + .claude-plugin + web)
pnpm pack --dry

# 4. Confirm version is 1.1.0 everywhere it must match
grep -R '"version": "1.1.0"' package.json .claude-plugin/*.json

# 5. Publish (pnpm, not npm; see devEngines note above)
pnpm publish --access public                      # first publish of a public scoped/unscoped pkg

# 6. Prove the registry cold path from a scratch dir
cd "$(mktemp -d)"
npx -y kairos-astrology@1.1.0 compute '{"kind":"horary","quesitedHouse":10,"moment":{"datetimeLocal":"2026-06-08T11:15:00","latitude":51.5074,"longitude":-0.1278,"timezone":"Europe/London"}}'
# expect: lean "favorable", score 38, confidence "medium"
# on Intel macOS this first run compiles sweph from source (needs Xcode CLT); see "Cold install" above
```

Follow-ups for each release: push the version tag (fires the release-check CI,
a three-OS cold-install of the packed tarball) and re-publish `server.json` to
the MCP registry with `mcp-publisher publish` (login via GitHub device flow).

## License

Kairos is licensed under the **GNU Affero General Public License v3.0 or later** (`AGPL-3.0-or-later`). See `LICENSE` for details.

This means:
- You can use, modify, and distribute Kairos freely
- If you modify it and distribute the modified version, you must make your modifications available under the same license
- If you run a modified version as a service (including as part of Claude Code), you must offer the source code to users

See `NOTICE` for additional attribution.

## Testing

```bash
pnpm test                       # run the engine test suite
pnpm typecheck                  # check TypeScript types
pnpm lint                       # lint the engine code
```

All 321 tests pass on the current build (37 files).

## Technical Details

- **Engine language:** TypeScript
- **MCP SDK:** `@modelcontextprotocol/sdk` (Node.js)
- **Native dependency:** `sweph` (Swiss Ephemeris bindings; includes prebuilds for darwin-arm64, linux-x64, linux-arm64, win32-x64; Intel Mac and musl fall back to Docker or source compile)
- **Data storage:** `~/.kairos` (profiles, journal, geocoder gazetteer)
