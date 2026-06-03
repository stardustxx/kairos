# Kairos — Design (v1)

**Date:** 2026-06-02
**Status:** Approved (design phase)

## Summary

Kairos is a **Claude Skill** for astrology-based decision support. The user asks a
real-life question ("should I take this job?", "will I get it in two months?",
"is now the right time to switch?"). Kairos computes the *exact* relevant chart
using Swiss Ephemeris and Claude interprets it into a **calibrated verdict**: a
clear lean (e.g. "leans yes; strongest window mid-July") with a stated confidence
level and the supporting reasoning shown — never presenting the stars as destiny.

There is no MCP server and no hosted backend in v1. The skill bundles a Node CLI
that does the math; Claude runs it and interprets the JSON it returns.

## Motivation

Research (2026-06-02) established three things:

1. **The accuracy problem is real and documented.** General LLMs hallucinate
   planetary positions — they get the Sun sign right (date-derivable) but
   fabricate Moon, Rising, degrees, and aspects, because they treat numbers as
   tokens rather than coordinates. The named fix across the field is exactly this
   project's premise: wire the LLM to Swiss Ephemeris via a tool. Only ~29% of
   users trust AI astrology today, largely because of this.
2. **The decision-making audience exists.** Astrology apps are a ~$5B market
   (~20–25% CAGR). Surveys show large shares of young users already consult
   astrology for career decisions (e.g. checking signs before accepting a job).
   AstroTalk reaches ~$192M ARR doing question-based decision astrology — via
   human astrologers.
3. **Horary/decision-timing is the open lane.** The natal/transit/synastry tool
   layer is commoditizing (7+ existing MCP servers, free hosted ephemeris APIs).
   But **horary** (question → yes/no + timing) is almost entirely missing from
   automated tooling — done today only by humans. The user's own use cases land
   precisely on this underserved lane.

The defensible wedge is therefore **accuracy + genuine horary/decision technique +
conversational quality**, not another natal-chart app.

## Architecture

Two clean layers with a strict boundary:

```
kairos/
├── engine/         The accurate, testable calculation core (TypeScript + `sweph`)
│   └── CLI: `kairos compute <json>` → returns chart JSON on stdout
└── skill/          The Claude Skill (markdown guidance + interpretation rules)
    └── SKILL.md    Tells Claude WHEN to call the engine and HOW to judge output
```

- **Engine** does only math: planetary positions, house cusps, aspects/angles,
  horary significators. Deterministic. Unit-tested against known reference charts.
  Knows nothing about interpretation.
- **Skill** does only judgment: recognizes horary vs. transit questions, decides
  what to ask the engine for, and reads the engine output into a verdict. Knows
  nothing about the math internals.

Rationale: the engine is the hard-won accurate core that must be trustworthy and
stable; the skill is the interpretation layer that is cheap to iterate. Keeping
them separate means interpretation can evolve without risking calculation
correctness, and the engine can later back a website with no rewrite.

### Data flow

1. User asks Kairos a question inside Claude.
2. The skill classifies the question type (horary / transit / natal) and gathers
   the needed inputs (current moment and/or stored birth data).
3. The skill invokes the engine CLI with a JSON request.
4. The engine returns chart JSON with exact positions/degrees.
5. Claude interprets the JSON per the skill's judgment rules and produces the
   calibrated-verdict output.

## v1 Techniques

1. **Horary** — chart cast for the moment the question is asked. Yields yes/no +
   timing. Requires no birth data. Covers "will I get this job," "will this come
   to fruition." Uses traditional significator logic.
2. **Transits to natal** — current sky against the user's stored birth chart.
   Answers "is *now* the right time for *me*."
3. **Natal** — the user's birth chart, computed once and stored, used as the
   backdrop for transits.

**Deferred to v2:** *Electional* — scanning a date range to find the best window.
More complex (requires searching and scoring time ranges); explicitly out of v1
scope.

## Birth-data handling (graceful degradation)

- **Exact time** (the primary user) → full natal + transits + horary.
- **Rough time** (others who only know the hour-ish) → transits still work;
  house-sensitive claims (rising sign, house placements) carry an explicit caveat.
- **Unknown / none** → horary-only, which still answers every example question
  because a horary chart is cast for the question moment, not the birth.

Birth data, once supplied, is stored locally for reuse (no accounts, no server).

## System conventions

- **Western tropical** zodiac — the standard for horary and Western predictive
  work. (Not Vedic/sidereal.)
- House systems: default **Placidus** for natal/transits, **Regiomontanus** for
  horary (the traditional horary choice). Both configurable.
- Timezone and DST resolved from birth date + place; correct historical timezone
  handling is treated as a first-class correctness concern (a common failure mode
  in naive implementations).

## Output contract

Every answer is structured as:

1. **Verdict** — the lean plus an explicit confidence level.
2. **Key signals** — the specific placements/aspects driving the verdict, quoting
   the *exact degrees returned by the engine* (never recalled by the model).
3. **Timing** — relevant windows or dates where applicable.
4. **Honest caveats** — what reduces confidence; the reminder that this is one
   input to a decision, not fate.

Because every degree originates in the engine rather than the model's memory, the
output sidesteps the hallucination failure that breaks generic AI astrologers.

## Technology choices

- **TypeScript + `sweph`** (Node binding to Swiss Ephemeris) — full accuracy,
  matches the pnpm/JS preference, and lets the same engine back a future website
  with no rewrite.
- **pnpm** as package manager.
- No MCP, no server, no hosting in v1.

### Licensing note

Swiss Ephemeris is dual-licensed (AGPL or paid commercial). Acceptable for
personal/open use. If Kairos is ever shipped as a closed commercial product, this
must be revisited; pure-code alternatives (Moshier JS, Skyfield) exist as a
fallback.

## Out of scope (v1)

- Electional window-scanning (v2).
- Website / chart-wheel UI (later "front door"; the engine is built to support it).
- MCP server.
- Accounts, hosting, multi-user infrastructure.
- Vedic/sidereal astrology.

## Future direction

The engine-first split is deliberate so that later surfaces reuse the same core:

```
            engine (Swiss Ephemeris)
          ┌──────────┼──────────┐
   skill (v1)    website (v2)   electional (v2)
```
