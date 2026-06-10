# Onboarding — first-run experience audit & plan

**A walk through the three real entry paths as they exist today, the friction
in each, a prioritized (but NOT yet implemented) improvement list, and an
honest definition of the "activated user" moment.**

Audited on 2026-06-09 against the current build (v1.1.0, full suite green). This
document changes no behavior — it is the map for future scoped work.

---

## Path 1 — Claude Code plugin → first `/kairos` question

The primary path, and the only one that delivers the full product (skill
judgment layer + MCP engine + memory loop).

**As it exists today:**

1. `/plugin marketplace add stardustxx/kairos`
2. `/plugin install kairos@stardustxx`
3. The plugin registers the MCP server as `npx -y kairos-astrology mcp`
   (`.claude-plugin/plugin.json`) and the skill (`skills/kairos/SKILL.md`).
4. User asks a decision question (or invokes the skill directly); the skill
   runs Step 0 (memory_due → empty on first run; profile_get → null), then
   classifies the question, geocodes the location, calls `compute` with a
   `journal` field, and renders the two-layer verdict.

**Friction points:**

- **F1. Cold MCP start latency.** The server command is `npx -y
  kairos-astrology mcp`: the first start downloads the package from the npm
  registry. On the prebuilt platforms (darwin-arm64, linux x64/arm64,
  win32-x64) this is seconds; on **Intel macOS / musl** it compiles `sweph`
  from source — minutes, and it **fails outright without Xcode CLT /
  build-base**, surfacing as an opaque "MCP server failed to start" rather
  than the README's clear caveat. The user has no reason to connect that
  failure to a C++ toolchain.
- **F2. The gazetteer ambush.** The first horary question needs lat/lon. The
  skill (correctly) prefers the `geocode` MCP tool, but on a fresh machine the
  gazetteer is absent, so the tool errors with "gazetteer not installed — run
  `kairos geocode:install` first" **in the middle of the user's first
  question**. The skill then either walks the user through a download they
  didn't expect, or silently falls back to estimated coordinates — both are
  weaker first impressions than being told up front.
- **F3. Blank-page problem.** Nothing suggests a first question. The skill
  description triggers on decision questions, but a user who installed out of
  curiosity ("now what?") gets no prompt, no demo, no example question to try.
- **F4. The journal/outcome loop is invisible at install time.** The
  calibration contract — the product's differentiator — only reveals itself
  after a verdict (journalId mention) and again days later (memory_due). A
  first-run user has no way to know the loop exists unless they read the
  README.
- **F5. Naming.** The skill surfaces as `/kairos:kairos` (plugin:skill); the
  README says "automatically available as `/kairos:kairos`" — correct but
  easy to mistype as `/kairos`.

## Path 2 — standalone MCP server (`npx -y kairos-astrology mcp`)

For users who already run their own MCP config (Claude Code via
`claude mcp add`, or any MCP client).

**As it exists today:** the server exposes `compute`, `horary`, `transit`,
`natal`, `electional`, `geocode`, `render_wheel`, and the memory/profile
tools. The model drives them from the tool descriptions alone.

**Friction points:**

- **F6. No judgment layer.** Without the skill, there is no Step 0 recall, no
  house-mapping table, no two-layer output discipline, no falsifiability
  line, no journal-by-default. The tool descriptions are good, but the user
  gets "an ephemeris with verdicts," not the calibrated product. Nothing
  tells a standalone-MCP user that the skill exists and is most of the value.
- **F7. Request-shape burden.** `compute` takes the full request JSON
  (`kind`, `quesitedHouse`, `moment`…). A bare client has to know the house
  map ("job = 10th") from the tool description or guess. Same F1 cold-start
  and F2 gazetteer frictions apply.
- **F8. No first-run handshake.** The stdio server starts silently (correct
  for the protocol), so a user testing `npx -y kairos-astrology mcp` in a
  terminal sees nothing and may assume it hung. The README doesn't say
  "silence is success — point a client at it."

## Path 3 — web app (`web/index.html`)

**As it exists today:** a web app that both **computes and renders**: a compute
form (kind, datetime defaulting to now, lat/lon + geolocation, quesited-house
picker) runs the engine fully in-browser via a wasm Swiss Ephemeris
(`pnpm build:web` produces `web/engine.js` + wasm assets; the npm tarball ships
them prebuilt), and the original paste/upload-JSON viewer path still works
dependency-free. Nothing leaves the browser.

**Friction points:**

- **F9. The empty textarea is the front door.** The placeholder is a bare
  JSON skeleton (`{ "chart": { "kind": "natal", ... } }`). A visitor without
  engine output has nothing to do — there's no on-page pointer to the one
  command (`npx -y kairos-astrology compute …`) that would *give* them JSON.
- **F10. Load Example breaks under `file://`.** The button fetches
  `example-output.json`, which most browsers block on the file protocol — so
  the literal first click of the most likely first action **fails** for the
  double-click-index.html user. The workaround (open the JSON, copy, paste) is
  documented in `web/README.md` but not on the page where the failure happens.
- **F11. Verdict coverage asymmetry.** The verdict panel renders for
  horary/electional only; transit/natal users get a wheel with no verdict and
  no note saying that's by design.

## Prioritized improvements (scoped, NOT implemented here)

S = hours, M = a day-ish, L = multi-day. Ordered by (impact on first-run) /
(effort). Each is deliberately small enough to land without touching verdict
behavior — none of these may move a verdict, per the regression guards.

| # | Size | Fixes | Proposal |
|---|------|-------|----------|
| 1 | S | F3 | **First-question suggestion in the skill — SHIPPED.** Fresh-install branch (memory_due empty + no profile) now offers a one-line prompt in SKILL.md Step 0: "First time? Try a real yes/no question like 'will I get the job I interviewed for?'" |
| 2 | S | F2 | **Front-load the gazetteer, gracefully — SHIPPED.** The same fresh-install branch asks consent for the one-time download via the `geocode_install` MCP tool before the first geocode call, preventing the mid-question error; existing estimate fallback retained. |
| 3 | S | F10 | **Make Load Example work under `file://` — SHIPPED.** The example `ComputeResult` is now inlined in `index.html` (a JSON script block); the button needs no fetch. A drift guard in `check-web-bundle.mjs` keeps the inline copy identical to `example-output.json`. |
| 4 | S | F9 | **Web front-door copy — SHIPPED.** One sentence above the textarea directs users to the `npx` command or Load Example, with a link to `docs/example.md`. |
| 5 | S | F5, F8 | **README touch-ups — SHIPPED.** Exact skill invocation (`/kairos:kairos`) stated next to install commands; standalone-MCP section documents that silence is success; stale test count updated to live number. |
| 6 | M | F3, F4 | **Guided demo question — SHIPPED.** The deterministic London 2026-06-08 11:15 example is documented end-to-end in the README and `docs/example.md` and offered by the skill's first-run branch. The journal design question is decided: a demo compute **omits the `journal` field entirely** (SKILL.md hard rule), so demos never pollute the real track record — no `--dry` flag needed. |
| 7 | M | F2 | **Geocode-install prompt UX — SHIPPED.** `geocode_install` MCP tool added; the model can ask for consent and act on it instead of relaying a shell command. Download stays strictly user-initiated. |
| 8 | M | F1 | **Fail loud and early on unprebuilt platforms — SHIPPED.** Preflight in the MCP/CLI entry detects a missing sweph binary + missing toolchain and prints the actionable fix (Xcode CLT command on Mac, `build-base`/`python3` on Alpine, Docker fallback) instead of a node-gyp stack trace. |
| 9 | M | F6 | **Tell standalone-MCP users about the skill — SHIPPED.** README standalone-MCP section and server tool annotations note that the Claude Code plugin layer adds judgment/calibration discipline, so raw-tools users know what they are missing and how to get it. |
| 10 | — | F9 | **Web compute form — SHIPPED.** The wasm in-browser compute form landed (kind, house picker with the matter→house labels, datetime defaulting to now, lat/lon + geolocation). Remaining follow-ups fold into #4 copy polish and a place-name search (the gazetteer is Node-only today, so the form takes lat/lon). |
| 11 | L | F11 | **Transit/natal verdict panel.** Needs a designed "window texture, not yes/no" panel consistent with the per-kind confidence rule in the skill. Worth doing only after real transit users exist. |

## The "activated user" moment — defined honestly

**Activated = the user has received their first verdict AND that reading is
logged in `~/.kairos/journal.jsonl` with an `expectedResolutionAt`.**

Why this definition and not "installed" or "first compute":

- Install and even first-compute are tourism. The product's thesis is the
  **calibration contract**, and a user only enters it when a verdict of
  theirs is on the record *with a date it can be graded on*. That's the
  moment Kairos becomes "the astrology tool that keeps score" *for them* —
  everything before it is a demo.
- `expectedResolutionAt` is the precise, mechanical marker: the engine stamps
  it on horary readings with applying-perfection timing, and it's what makes
  the reading resurface via `memory due`. A journaled reading without it can
  still be resolved manually, but the self-closing loop — the part that
  distinguishes the product — requires the date.
- The *fully realized* user is one step further: first outcome recorded
  (`memory outcome <id> …`), i.e. the loop has closed once. Activation is
  entering the loop; retention is closing it.

**Measurement honesty:** by design there is no telemetry, so activation is
**not remotely observable** — we cannot count activated users and will not
pretend to. It is measurable (a) by each user locally (`kairos memory
journal` / `memory due`), and (b) for the project, only qualitatively —
users mentioning journal ids, due readings, or calibration cards in issues
and posts. The definition still earns its keep: every onboarding improvement
above is judged by one question — *does it shorten the path from install to
the first journaled, dated verdict?*
