# Distribution plan — the go-live sequence

**The concrete, ordered list of maintainer actions that takes Kairos v1.1.0 from
a green repo to every channel it belongs on — and the channels it deliberately
stays off.**

Everything here was verified against the live repo state on 2026-06-10:
321 tests pass (37 files), version is `1.1.0` in `package.json`,
`.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, and
`.claude-plugin/server.json`, and the conformance corpus reports 7/15 = 46.7%
in-scope agreement. External channel processes were verified against live docs
(URLs cited inline).

---

## Phase 0 — pre-flight (local, no side effects)

```bash
cd ~/Documents/Projects/kairos
pnpm install
pnpm lint && pnpm typecheck && pnpm test     # ALL tests must pass (321 at last audit; the corpus grows, so trust the live count)
pnpm build                                   # tsc -> dist/ (also runs as prepublishOnly)
pnpm pack --dry                              # inspect the exact tarball contents
grep -R '"version": "1.1.0"' package.json .claude-plugin/*.json   # 4 hits expected
```

Notes:

- `devEngines.packageManager` pins **pnpm** (`^11.5.1`, `onFail: "download"`), so
  `npm publish` / `npm pack` fail with `EBADDEVENGINES` by design. All publish
  commands below use pnpm.
- The README's publish checklist previously said "237 today" in two places —
  both have since been updated to the live count (done; verify before tagging).

## Phase 1 — npm publish (the root of every other channel)

```bash
# 1. Publish (pnpm, not npm — devEngines blocks npm)
pnpm publish --access public

# 2. Registry cold-check from a scratch dir (proves the cold path real users hit)
cd "$(mktemp -d)"
npx -y kairos-astrology@latest compute '{"kind":"horary","quesitedHouse":10,"moment":{"datetimeLocal":"2026-06-08T11:15:00","latitude":51.5074,"longitude":-0.1278,"timezone":"Europe/London"}}'
# expect: lean "favorable", confidence "medium", score 38
# (Swiss Ephemeris is deterministic — this is the same chart as docs/example.md)
```

If the cold-check fails, **stop here** — every downstream channel (plugin MCP
start, MCP registry, Docker) resolves through the npm package.

**Provenance.** npm provenance attestations require an OIDC-capable CI
environment (GitHub Actions / GitLab CI); a local `pnpm publish --provenance`
cannot generate one. Two honest options:

- Ship v1.1.0 from the laptop **without** provenance (fine; nothing claims
  otherwise), and
- set up [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/)
  (OIDC, GA since July 2025 — see the
  [GitHub changelog](https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/))
  for v1.2.0+, which generates provenance automatically with no `--provenance`
  flag. Note: trusted-publisher configs created after 2026-05-20 must explicitly
  select allowed actions ([docs](https://docs.npmjs.com/trusted-publishers/)).

## Phase 2 — tag v1.1.0 (fires the cold-install CI)

```bash
git tag v1.1.0
git push origin v1.1.0
```

Pushing a `v*` tag triggers `.github/workflows/release-check.yml` — the
zero-compile cold-install matrix (macos-14 / ubuntu-latest / windows-latest)
that packs the tarball, installs it in an isolated project, asserts the sweph
**prebuild** resolved (no `node-gyp rebuild` in the install log), and runs a
horary compute asserting a `"lean"` in the output. Intel macOS (`darwin-x64`)
is intentionally absent from the matrix — it compiles from source by design.

Watch the three jobs go green, then cut a GitHub release from the tag (release
notes can link `docs/example.md` and the example gallery).

## Phase 3 — official MCP registry

Verified against the live quickstart at
<https://modelcontextprotocol.io/registry/quickstart> (registry is **in
preview**; breaking changes or data resets may occur). The current process is
the **`mcp-publisher` CLI with GitHub device-flow auth** — there is no
PR-to-a-repo submission anymore.

Prerequisites already in place in this repo:

- `package.json` has `"mcpName": "io.github.stardustxx/kairos"` (the registry
  verifies the npm package carries this field — it must match `server.json`'s
  `name`).
- `.claude-plugin/server.json` exists with the current `2025-12-11` schema,
  `name: io.github.stardustxx/kairos`, npm package `kairos-astrology@1.1.0`,
  stdio transport, positional arg `mcp`.
- GitHub auth requires the name to start with `io.github.stardustxx/` — it does.

Exact commands:

```bash
# 1. Install the publisher CLI (macOS)
brew install mcp-publisher
# (or the prebuilt binary:
#  curl -L "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_$(uname -s | tr '[:upper:]' '[:lower:]')_$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/').tar.gz" | tar xz mcp-publisher && sudo mv mcp-publisher /usr/local/bin/)

# 2. mcp-publisher reads ./server.json from the cwd — ours lives in .claude-plugin/
cd ~/Documents/Projects/kairos
cp .claude-plugin/server.json ./server.json     # temporary working copy

# 3. Authenticate (GitHub device flow: visit github.com/login/device, enter the code)
mcp-publisher login github

# 4. Publish
mcp-publisher publish

# 5. Verify it landed
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.stardustxx/kairos"

# 6. Remove the working copy (canonical file stays in .claude-plugin/)
rm ./server.json
```

Troubleshooting (from the live quickstart): "Registry validation failed for
package" → the published npm tarball must contain the `mcpName` field (it does;
`package.json` ships in every npm tarball). "You do not have permission" → the
namespace must match the GitHub account that authenticated.

Ordering constraint: **Phase 1 must complete first** — the registry hosts
metadata only and validates against the live npm package.

## Phase 4 — Docker image (optional, the zero-build fallback)

The `Dockerfile` runs `npm install -g kairos-astrology`, so it can only be
built **after** Phase 1. It exists for Intel Mac / musl users who can't or
won't compile sweph.

```bash
docker build -t kairos:1.1.0 -t kairos:latest .
docker run --rm kairos:1.1.0 compute '{"kind":"horary","quesitedHouse":10,"moment":{"datetimeLocal":"2026-06-08T11:15:00","latitude":51.5074,"longitude":-0.1278,"timezone":"Europe/London"}}'
# expect the same +38 favorable verdict

# Publish (pick ONE registry; GHCR keeps everything under the same GitHub account)
docker tag kairos:1.1.0 ghcr.io/stardustxx/kairos:1.1.0
docker tag kairos:1.1.0 ghcr.io/stardustxx/kairos:latest
echo "$GHCR_PAT" | docker login ghcr.io -u stardustxx --password-stdin
docker push ghcr.io/stardustxx/kairos:1.1.0
docker push ghcr.io/stardustxx/kairos:latest
```

If publishing the image, build multi-arch (`docker buildx build
--platform linux/amd64,linux/arm64`) so Apple Silicon users don't get an
emulated amd64 image. This phase is genuinely optional — the README's
`docker build` instructions already work for the users who need them.

## Phase 5 — directories and awesome-lists

### Claude Code marketplace indexers (no action required)

[claudemarketplaces.com](https://claudemarketplaces.com) describes itself as an
"automatically updated directory" curated by install count, GitHub stars, and
community votes — it crawls GitHub for `marketplace.json` files. Ours is in
`.claude-plugin/marketplace.json` on a public repo, so indexing should happen
without a submission. There is **no documented manual-submission path**; do not
plan around being listed, and do not pay for the "Advertise" placement.

### awesome-mcp-servers (PR — verified contribution rules)

[punkpeye/awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers)
accepts PRs. Rules from its
[CONTRIBUTING.md](https://github.com/punkpeye/awesome-mcp-servers/blob/main/CONTRIBUTING.md):

- One server per line: name linked to the repo + a brief, accurate description.
- Categorize under the relevant section, **alphabetical order** within it.
- Match the README's existing format/capitalization/punctuation exactly.
- A PR opened by an automated agent may add `🤖🤖🤖` to the title for
  fast-track review — if Claude Code opens this PR, do that and say so.

Suggested entry (adjust to the list's exact badge conventions at PR time):
`[stardustxx/kairos](https://github.com/stardustxx/kairos) - Astrology
decision support via Swiss Ephemeris: horary/electional/transit charts with
classical dignities, falsifiable scored verdicts, and a local outcome journal.`

### awesome-claude-code (issue form — strict, human-only)

[hesreallyhim/awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code)
uses a **GitHub issue form** ("🚀 Recommend New Resource"), not PRs. Verified
rules from the live issue template:

- Submissions **must be made by a human through the github.com UI** — `gh` CLI
  or programmatic submissions are auto-closed and violate their CoC. This one
  is the maintainer's to file personally.
- The resource must be **at least one week old** — file this a week+ after the
  repo went public (it already is).
- **Disclose any network requests** beyond the Anthropic API. Kairos makes
  exactly two kinds, both user-initiated: the optional GeoNames gazetteer
  download (`kairos geocode:install`) and the optional `.se1` ephemeris
  download (`pnpm ephe:install`). The plugin's MCP command is
  `npx -y kairos-astrology mcp`, which resolves the package from npm — the
  template explicitly flags `npx @latest`-style auto-update as a caution, so
  state it plainly in the submission.
- Capability claims must be backed by evidence — link the worked examples and
  the conformance corpus, claim nothing beyond them.

Other lists (e.g.
[ccplugins/awesome-claude-code-plugins](https://github.com/ccplugins/awesome-claude-code-plugins),
[ComposioHQ/awesome-claude-plugins](https://github.com/ComposioHQ/awesome-claude-plugins))
accept standard PRs per their READMEs — same honest one-liner, check each
repo's CONTRIBUTING.md at PR time. Lower priority; the two above are the
established ones.

## What NOT to do

- **No hosted SaaS / "try it online" compute service.** Two independent
  reasons: (1) AGPL-3.0 §13 — running a modified version as a network service
  obligates offering corresponding source to its users, which is manageable,
  but (2) the product identity is **local-first, no telemetry** — a hosted
  service would receive users' questions and birth data, which is exactly what
  Kairos promises never leaves the machine. The static `web/index.html` viewer
  is fine to host as-is (a static client-side app is **conveyed source**, not a
  network service — every byte the browser runs is the source).
- **No fake-able growth tactics.** No upvote solicitation (HN bans it), no
  bought listings, no astroturfed reviews. The product's one differentiator is
  honesty; the launch cannot contradict it.
- **No paid Docker Hub / marketplace placements.** Organic only.

## Measurement — what we can honestly know

Kairos has **no telemetry by design**, so there is no install beacon, no usage
ping, no DAU. The trustworthy public signals, in increasing order of meaning:

1. **npm downloads** (`https://api.npmjs.org/downloads/point/last-week/kairos-astrology`,
   or npmjs.com's package page) — a *reach proxy only*. Inflated by CI,
   mirrors, and the plugin's `npx -y` cold starts; never quote it as "users."
2. **GitHub stars / forks / watchers** — interest, not usage.
3. **GitHub issues and discussions** — the first signal of *real* users,
   because only someone who ran it files one.
4. **The real metric: users entering the outcome loop.** A Kairos user is
   "real" when they log a reading and later resolve it
   (`kairos memory outcome <id> happened|did-not-happen`). By design we cannot
   count this remotely — it lives in each user's `~/.kairos`. The only honest
   proxies are users *talking about* their calibration cards (issues, posts,
   screenshots) and direct conversation. Accept that this metric is
   qualitative; that is the cost of the privacy promise, and it is worth it.

Set expectations accordingly: success for this launch is a working cold path
on every channel, a handful of real users filing real issues, and the first
outsider-reported calibration card — not a downloads number.

## The sequence at a glance

| # | Action | Gate to proceed |
|---|--------|-----------------|
| 0 | lint + typecheck + test + build + pack-dry + version grep | all green, full suite |
| 1 | `pnpm publish --access public` + scratch-dir `npx` cold-check | verdict +38 favorable comes back |
| 2 | push tag `v1.1.0` (fires release-check.yml) + GitHub release | 3-OS cold-install matrix green |
| 3 | `mcp-publisher login github` + `publish` + curl verify | server visible in registry search |
| 4 | (optional) Docker build + GHCR push | container compute returns the verdict |
| 5 | awesome-mcp-servers PR; awesome-claude-code issue (human, ≥1wk) | accepted/merged on their timeline |
| — | social posts (see `social-media.md`) | after 1–3 are verified, never before |

Social goes out only after the cold paths are proven — the worst launch outcome
is a Show HN where the top comment is "the install command fails."
