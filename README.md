# Kairos

Astrology-based decision support. Ask a real-life question ("will I get this job?", "is now the right time to switch?") and Kairos computes an astronomically accurate chart (Swiss Ephemeris) and returns a calibrated verdict — a clear lean, a confidence level, the specific signals behind it, and honest caveats.

Kairos is available as:
- A Claude Code **plugin** (includes both the skill and the MCP server)
- A standalone **MCP server** (`npx -y kairos-astrology mcp`)
- A **CLI tool** (`kairos compute`, `kairos memory`, `kairos geocode`)
- A **Docker image** (fallback for Intel Mac, musl, and unprebuilt ABIs)

## How it works

- **`engine/`** — a TypeScript CLI that computes planetary positions, houses, aspects, and horary significators. Pure math, fully tested.
- **`.claude-plugin/`** — a Claude Code plugin that bundles the MCP server and the skill. Install via Claude Code's plugin marketplace.
- **`skills/kairos/SKILL.md`** — the Claude Skill (bundled in the plugin): classifies the question, calls the MCP tools, and interprets the result. Pure judgment, no math.

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

### Docker (Intel Mac, musl, Fallback)

If you cannot install the prebuilt sweph binary (Intel Mac, Alpine Linux, or other musl environments):

```bash
docker build -t kairos:latest .
docker run --rm -i kairos:latest mcp
```

This provides the MCP server via stdio, suitable for forwarding to Claude Code or other MCP clients.

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

### Render a chart wheel

```bash
pnpm wheel '{"kind":"horary","quesitedHouse":10,"moment":{"datetimeLocal":"2026-06-08T09:00:00","latitude":40.7128,"longitude":-74.006,"timezone":"America/New_York"}}'
```

The UI also runs standalone: open `web/index.html` and paste any `pnpm compute` JSON (or click **Load Example**). See `web/README.md`.

### Start the MCP server locally

```bash
pnpm mcp
```

## Memory

Kairos keeps a small **local** memory so it can remember you and learn from its own track record:

- **Profile** — stores your birth data (for transits/natal) and home/relocation location
- **Multiple people** — keep separate profiles per person you cast for (yourself, a partner, a friend)
- **Journal** — every verdict (question, kind, lean, confidence, score) is recorded
- **Outcomes & calibration** — record what actually happened and see hit-rate by confidence band

All memory is stored **locally** under `~/.kairos` (one `profiles/<slug>/` directory per person, plus a pooled `journal.jsonl`) and is **never synced** — everyone's birth data and your reading history stay on this machine.

## Conventions

- Western **tropical** zodiac.
- Houses: **Placidus** for natal/transit, **Regiomontanus** for horary
- Computation: Swiss Ephemeris **Moshier mode** by default — no data files, sub-arcsecond accuracy for the modern era. Opt into full SWIEPH precision:

  ```bash
  pnpm ephe:install            # download full .se1 data files
  ```

## Distribution & Publishing

Kairos is published to npm as `kairos-astrology`:

```bash
pnpm publish                # publish the current version to npm
```

The package includes:
- The compiled engine (`dist/`)
- The Claude skill and plugin manifests (`.claude-plugin/`)
- The web UI (`web/`)
- License and documentation

The maintainer will:
1. Make the GitHub repo public (`github.com/stardustxx/kairos`)
2. Push tags to trigger releases
3. Register the MCP server in the official MCP registry (optional)

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

All 216 tests pass on the current build.

## Technical Details

- **Engine language:** TypeScript
- **MCP SDK:** `@modelcontextprotocol/sdk` (Node.js)
- **Native dependency:** `sweph` (Swiss Ephemeris bindings; includes prebuilds for darwin-arm64, linux-x64, linux-arm64, win32-x64; Intel Mac and musl fall back to Docker or source compile)
- **Data storage:** `~/.kairos` (profiles, journal, geocoder gazetteer)

