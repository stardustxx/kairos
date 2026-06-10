# Social media — ready-to-post drafts

**The launch message in one line: Kairos is the astrology tool that keeps
score — falsifiable verdicts, a calibration contract, local-first and
no-telemetry, AGPL.**

Every claim in every draft below is true of the current build and was verified
on 2026-06-10:

- **321 tests pass** (37 files; `pnpm test` on this commit).
- **Conformance corpus: 7/15 in-scope cases agree with the documented
  practitioner verdict = 46.7%** — stated honestly as a *baseline under
  improvement*, never as accuracy. (16 cases total; 1 is a known-gap case
  excluded from the percentage by design.)
- **The calibration scorecard is empty.** No outcomes have accrued yet; the
  fresh-install report is all zeros with `hitRate: null`. We say so.
- **No user counts exist** (no telemetry, brand-new package) and none are
  invented. **No "proven accuracy" claims** — Kairos explicitly does not claim
  astrology works; it claims it will keep score either way.

Worked-example links to include wherever a platform allows them:

- Full round-trip: <https://github.com/stardustxx/kairos/blob/main/docs/example.md>
- Example gallery (5 reproducible cases, incl. an honest "no"):
  <https://github.com/stardustxx/kairos/blob/main/docs/examples/README.md>
- Repo: <https://github.com/stardustxx/kairos>

Posting gate: nothing below goes out until the npm cold-check and the v1.1.0
cold-install CI are green (see `distribution-plan.md`).

---

## 1. Show HN

Verified against the live guidelines at
<https://news.ycombinator.com/showhn.html>: the title must begin with
"Show HN", the project must be something people can **try without a signup
barrier** (ours: `npx`, or clone and run), it must be the submitter's own work,
blog posts/sign-up pages are off-topic, and soliciting upvotes is banned. The
submitter should stick around and answer comments with curiosity, not
defensiveness.

**Title** (≤80 chars, no hype words, says what it is):

> Show HN: Kairos – an astrology engine that keeps score of its own verdicts

**URL:** `https://github.com/stardustxx/kairos`

**Text (first comment / body):**

> I built an astrology decision-support engine with one unusual property: every
> verdict it gives is falsifiable, logged, and graded against what actually
> happens.
>
> You ask a real question ("will I get the job?"). It computes an
> astronomically accurate chart with the Swiss Ephemeris (no LLM guessing at
> planetary positions), scores the classical horary testimonies, and returns a
> lean (favorable/unfavorable/uncertain), a confidence band tied to the actual
> weight of evidence, and — up front — the outcome that would prove the read
> wrong. The verdict is logged locally with an expected-resolution date; when
> that date arrives it asks you what happened, and `kairos memory calibration`
> shows your hit-rate by confidence band.
>
> The honest part: that scorecard ships empty. I have no outcomes yet, so the
> calibration report on a fresh install is all zeros — the README prints it
> verbatim. I also maintain a conformance corpus against documented
> 17th-century practitioner verdicts (Lilly et al.); the engine currently
> agrees on 7 of 15 in-scope cases (46.7%). That number is a baseline I'm
> working to raise, not an accuracy claim — and it measures conformance to
> classical method, not whether astrology works. Kairos takes no position on
> that; it takes a position on keeping score.
>
> Try it (deterministic — you'll get the same chart and verdict):
>
>     npx -y kairos-astrology compute '{"kind":"horary","quesitedHouse":10,"moment":{"datetimeLocal":"2026-06-08T11:15:00","latitude":51.5074,"longitude":-0.1278,"timezone":"Europe/London"}}'
>
> Worked example with the full two-layer reading:
> https://github.com/stardustxx/kairos/blob/main/docs/example.md
> Five more (one is an honest "no"):
> https://github.com/stardustxx/kairos/blob/main/docs/examples/README.md
>
> Tech: TypeScript, Swiss Ephemeris via sweph (Moshier mode by default — no
> data files), 321 tests, MCP server + Claude Code plugin + CLI + a
> web chart viewer that can also compute charts fully in-browser via a wasm Swiss Ephemeris (the viewer itself is dependency-free). Everything is local: profiles, journal,
> and outcomes live in ~/.kairos and never leave the machine. No telemetry.
> AGPL-3.0.
>
> Happy to answer anything — especially from practicing astrologers who
> disagree with the testimony weights, and from skeptics, since the whole
> design is an attempt to make this domain falsifiable per-user.

Anticipated top comment: "astrology isn't real." Prepared honest reply: that
may be so — Kairos doesn't claim otherwise. It claims that *if* you use
astrology for decisions (many do), you deserve a tool that states a verdict
you can grade later instead of an unfalsifiable narrative. The empty
calibration card is the design answer to exactly this objection.

## 2. Reddit

**Rule-verification status (honest):** Reddit blocks unauthenticated fetches of
subreddit rules (403 via every fetch path tried on 2026-06-09:
`www.reddit.com`, `old.reddit.com`, the JSON API, and a reader proxy), so the
per-sub rules below could **not** be verified verbatim from outside. Before
posting, open each subreddit's rules sidebar **while logged in** and check:
(a) whether self-promotion/app posts are allowed at all, (b) whether they're
restricted to a weekly/pinned thread, (c) required flair, and (d) any AI-tool
disclosure rule. If r/astrology's rules prohibit app promotion (community
reports suggest promotion there is restricted), **don't post it as a
showcase** — either use their designated promo thread if one exists, skip the
sub entirely, or wait until someone asks a question the tool genuinely
answers. r/ClaudeAI is a ~900k-member sub oriented around Claude/Claude Code
usage and has self-promotion-flavored flairs; it is the natural home for the
plugin post — still verify the flair rules in-app first.

### 2a. r/ClaudeAI draft (flair: whatever "Built with Claude / Self-promotion" flair the sub requires)

**Title:** I built a Claude Code plugin that gives astrology verdicts it can be
graded on — falsifiable leans, local outcome journal, empty scorecard by design

**Body:**

> Kairos is a Claude Code plugin (skill + MCP server) for decision/timing
> questions — "will I get the job?", "when should I launch?". The skill
> classifies the question, the bundled Swiss Ephemeris engine computes the
> actual chart (Claude never guesses planetary positions), and you get a
> verdict with a lean, a confidence band, the scored classical testimonies
> behind it, and the outcome that would prove it wrong.
>
> The part I care most about: it keeps score. Every verdict is journaled
> locally with an expected-resolution date. When that date passes, the skill
> asks what actually happened, and `kairos memory calibration` shows hit-rate
> by confidence band. On a fresh install that scorecard is empty and the tool
> says so — no fake metrics, no shipped "accuracy." There's also a conformance
> corpus against documented classical practitioner verdicts: currently 7/15
> in-scope agreement (46.7%), a baseline I'm raising, not an accuracy claim.
>
> Install:
>
>     /plugin marketplace add stardustxx/kairos
>     /plugin install kairos@stardustxx
>
> Then just ask it a decision question. Everything is local (~/.kairos), no
> telemetry, AGPL-3.0. 321 tests.
>
> Worked example (question in → two-layer verdict out):
> https://github.com/stardustxx/kairos/blob/main/docs/example.md
>
> Would genuinely value feedback on the skill's two-layer output format
> (plain read first, chart mechanics as an optional appendix) — that part went
> through a lot of iteration.

### 2b. r/astrology draft (post ONLY if the rules allow tool posts; otherwise hold)

Tone shift: this audience knows horary; lead with method, not tech.

**Title:** I built an open-source horary engine that logs its own verdicts and
shows you its hit-rate by confidence band — looking for practitioners to argue
with its weights

**Body:**

> Kairos casts horary (Regiomontanus), electional, transit, and natal charts
> with the Swiss Ephemeris and judges horary questions the classical way:
> significator perfection (direct, translation, collection), reception,
> essential dignities, void-of-course Moon, prohibition, refranation,
> besieging, combustion/cazimi, almutens, and timing from degrees to
> perfection. Each testimony carries a transparent signed weight and the
> verdict is the sum — you can read exactly why it leaned the way it did.
>
> What I think is new: it's accountable. Every verdict is logged locally with
> an expected-resolution date taken from the perfection timing; when the date
> passes it asks what happened, and the calibration report shows hit-rate by
> confidence band. Mine is empty so far — I'd rather ship an honest zero than
> a fake track record.
>
> I also test it against documented verdicts from classical sources (Lilly):
> it currently matches the practitioner's lean on 7 of 15 in-scope charts.
> I'd love practitioners' takes on where the weights are wrong — the corpus
> and every weight are open (AGPL): https://github.com/stardustxx/kairos
>
> Worked judgments with full testimony breakdowns (one is a clear "no"):
> https://github.com/stardustxx/kairos/blob/main/docs/examples/README.md
>
> It runs locally, free, no account, no telemetry — your charts and outcomes
> stay on your machine.

## 3. X/Twitter thread (7 posts)

> **1/** Astrology apps never tell you when they were wrong. I built one that
> does. Kairos gives a falsifiable verdict — a lean, a confidence band, and
> the outcome that would prove it wrong — then logs it and grades itself when
> reality answers. Open source, local-first. 🧵
>
> **2/** Ask "will I get the job?" and it computes a real chart (Swiss
> Ephemeris — not an LLM guessing where Venus is), scores the classical
> testimonies, and returns e.g.: favorable, medium confidence, +38 — with
> every signed signal listed. The reasoning IS the output.
>
> **3/** Every verdict is journaled with an expected-resolution date. When
> that date passes, it asks: what actually happened? Then
> `kairos memory calibration` shows your hit-rate by confidence band — does
> "high confidence" actually win more often than "low"?
>
> **4/** The honest part: that scorecard ships EMPTY. No outcomes yet, so the
> fresh-install report is zeros across every band — and the README prints it
> verbatim. No fake hit-rate, no "proven accuracy," no invented users.
>
> **5/** It's also tested against documented 17th-century practitioner
> verdicts (Lilly, Warnock, Louis). Current score: 7/15 in-scope charts agree (46.7%). That's
> a baseline I'm raising, not a brag — and it measures conformance to
> classical method, not whether astrology works.
>
> **6/** Privacy is structural: profiles, questions, and outcomes live in
> ~/.kairos and never leave your machine. No telemetry, no account, no cloud.
> AGPL-3.0. Works as a Claude Code plugin, an MCP server, or a plain CLI —
> 321 tests behind it.
>
> **7/** Try the exact worked example (deterministic — you'll get the same
> verdict):
> https://github.com/stardustxx/kairos/blob/main/docs/example.md
> Repo: https://github.com/stardustxx/kairos
> Skeptics and practitioners equally welcome — the weights are open and I want
> arguments.

## 4. Mastodon / Bluesky (short variants)

**Mastodon (≤500 chars):**

> I built Kairos: an open-source astrology engine that keeps score. Ask a real
> question, get a falsifiable verdict (lean + confidence + the outcome that
> would prove it wrong), logged locally and graded when reality answers. The
> calibration scorecard ships empty — honest zero over fake track record.
> Swiss Ephemeris, local-first, no telemetry, AGPL. 321 tests.
>
> https://github.com/stardustxx/kairos

**Bluesky (≤300 chars):**

> Kairos: an astrology tool that keeps score. Falsifiable verdicts, logged
> locally, graded against what actually happens. Scorecard ships empty —
> honest zero > fake track record. Swiss Ephemeris, no telemetry, AGPL.
>
> https://github.com/stardustxx/kairos

---

## Claim audit (every factual claim → its source in this repo)

| Claim in drafts | Source of truth |
|---|---|
| 321 tests pass | `pnpm test` on this commit (37 files / 321 tests) |
| 7/15 = 46.7% in-scope conformance | `engine/src/horary-conformance.cases.json` (16 cases, 15 in-scope, 7 agree); report printed by `engine/src/horary-conformance.test.ts` |
| Calibration scorecard empty | `kairos memory calibration` on a fresh install; verbatim JSON in README "Calibration contract" section |
| +38 favorable / medium example | `docs/example.md`; deterministic via Swiss Ephemeris |
| One example is an honest "no" | `docs/examples/02-relationship-horary.md` (−35 unfavorable) |
| Local-only memory, no telemetry | `~/.kairos` storage; no network code paths except user-initiated gazetteer/ephemeris downloads |
| AGPL-3.0 | `LICENSE`, `package.json` |
| Plugin / MCP / CLI / web viewer all exist | `.claude-plugin/`, `engine/src/mcp-server.ts`, `engine/src/bin.ts`, `web/` |
| Classical testimony list (prohibition, refranation, besieging, almuten, etc.) | `engine/src/horary.ts`, `skills/kairos/SKILL.md` Step 4 |

**Mandatory pre-post step:** these numbers move (the test suite and the
conformance corpus are actively growing).
Immediately before posting, re-run `pnpm test` and read the printed
conformance report (`pnpm exec vitest run engine/src/horary-conformance.test.ts`),
then substitute the live test count and the live in-scope agreement
fraction/percentage into every draft. The drafts serve the numbers, never the
reverse.
