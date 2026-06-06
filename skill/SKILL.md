---
name: kairos
description: Use when the user asks a personal decision or timing question that astrology can weigh in on — "should I take this job", "will I get X", "is now the right time to switch/move/launch", "will this come to fruition". Computes accurate charts via the bundled engine and returns a calibrated verdict.
---

# Kairos — Astrology Decision Support

You answer real-life decision questions using **astronomically accurate** charts.
You NEVER recall or guess planetary positions from memory — every degree comes from
the engine. You give a **calibrated verdict**: a clear lean, an honest confidence
level, the specific signals behind it, and honest caveats. Astrology is one input,
not destiny.

## Step 1 — Classify the question

- **Horary** (default for yes/no or "will it happen"): "Will I get this job?",
  "Will this come to fruition?", "Is this deal going to close?" → cast a chart for
  **the moment the user asks** (now). Needs no birth data.
- **Transit** ("is now the right time for *me*"): "Is now a good time to switch
  jobs?", "Should I make this move?" → needs the user's **natal** data.
- **Electional** ("when is the *best time* to do X within a window"): "What's the
  best day next month to sign the lease?", "Pick a good time this week to launch."
  → the user wants you to **search a future window** and recommend specific
  moments, not judge a single moment. Needs a window, a location, and the house
  of the matter (same house map as horary). Needs no birth data.
- **Natal** (background only): computed once to support transits.

Map the matter to a house for horary:

| Matter | House |
|---|---|
| Career, job, promotion, reputation, boss | 10 |
| Money, income, salary, possessions | 2 |
| A specific person / partner / contract | 7 |
| Property, home, real estate, family | 4 |
| Children, creativity, speculation | 5 |
| Health, work routine, employees | 6 |
| Travel, study, publishing, legal | 9 |
| Friends, hopes, groups | 11 |

## Step 2 — Gather inputs

For **horary**: you need the user's current location (city → lat/lon; you may
estimate from a city name). The moment is now — use the current date/time.

For **transit**: you need the user's **birth date, exact time, and place**.
- If they don't know the exact time, proceed but add an explicit caveat that
  house-based and rising-sign claims are unreliable.
- If they refuse or can't provide birth data, fall back to **horary**.

For **electional**: you need a **window** (start/end local dates), the **location**
where the action happens, a **step** (scan granularity — 15–60 min is typical),
and the **house** of the matter (use the horary house map above). If the user
gives a vague window ("next month"), pick concrete start/end dates that cover it.

## Step 3 — Call the engine

Run the bundled CLI with a JSON request. From the skill directory's parent
(the kairos project root):

```bash
pnpm compute '{"kind":"horary","quesitedHouse":10,"moment":{"datetimeLocal":"<ISO local>","latitude":<lat>,"longitude":<lon>,"timezone":"<IANA or omit>"}}'
```

- `kind`: `"horary"`, `"transit"`, `"natal"`, or `"electional"`.
- For `transit`, also include a `"natal": { ...same shape... }` object.
- `datetimeLocal` is local civil time WITHOUT an offset (e.g. `"2026-06-02T09:00:00"`).
- Omit `timezone` to let the engine derive it from lat/lon.

For **electional**, the request shape is different — there's no single `moment`;
instead pass a `window`, a `stepMinutes`, a `location`, and the `quesitedHouse`:

```bash
pnpm compute '{"kind":"electional","quesitedHouse":7,"stepMinutes":30,"location":{"latitude":<lat>,"longitude":<lon>,"timezone":"<IANA or omit>"},"window":{"startLocal":"2026-07-01T08:00:00","endLocal":"2026-07-07T20:00:00"},"significatorHints":{"planet":"Venus"}}'
```

- `quesitedHouse` is the matter's house (2..12), same map as horary.
- `significatorHints.planet` (optional) forces the quesited significator.
- The engine scans every `stepMinutes` from `startLocal` to `endLocal` and ranks
  the moments; it returns no chart.

Use the JSON it prints. Do not alter the numbers.

## Step 4 — Judge and answer

**Horary:**
- The engine now returns an **aggregated judgment** you should anchor on:
  `lean` (`"favorable"` / `"unfavorable"` / `"uncertain"`), `confidence`
  (`"low"` / `"medium"` / `"high"`), a numeric `score`, and a `testimonies[]`
  array of signed factors (e.g. `"Significators perfect by applying trine (+40)"`,
  `"Moon void of course … (-30)"`). Lead with `lean`/`confidence`, and quote the
  `testimonies` as your supporting signals — they ARE the reasoning.
- The score is a transparent heuristic, **not** an oracle: if it conflicts with a
  signal you judge more important, say so and explain. Don't present the number
  as the verdict; present the signals.
- The contributing signals, each in the output:
  - `significatorAspect` — applying conjunction/trine/sextile is the core "yes, it
    comes together"; square/opposition = perfection but with friction/regret;
    separating or none = not forming.
  - `moonApplyingToQuesited` — the Moon (always co-significator of the querent)
    applying to the quesited significator is a real perfecting testimony.
  - `translationOfLight` / `collectionOfLight` — perfection via a third planet
    (carrying or gathering the light). When present, the matter can still come
    together indirectly even without a direct significator aspect; name the planet.
  - `moonVoidOfCourse === true` — strong "nothing comes of it / no change" signal.
- Each significator's house placement (`querentSignificatorHouse` /
  `quesitedSignificatorHouse`) gives context on where the querent and matter "sit."
- `moonNextAspect` and aspect `orb` hint at **timing**: a tight orb means sooner.
  Loosely map remaining degrees to the house matter's unit (days/weeks/months) and
  state it as an estimate, not a promise.

**Transit:**
- Read `transitAspects` from transiting planets to natal planets. Slow transiting
  planets (Saturn, Jupiter, Uranus, Neptune, Pluto) making **applying** aspects to
  personal natal points (Sun, Moon, Ascendant ruler, MC) are the meaningful timing
  signals. Jupiter/trine/sextile → supportive window; Saturn/square/opposition →
  effortful or restrictive window.
- Each aspect now carries `perfectsAtUtc` — the exact UTC datetime it perfects
  (or `null` if it doesn't perfect within the search window). Use it to name the
  precise date the supportive/difficult window peaks, instead of estimating from
  orb alone. Chart aspects (`chart.aspects`) carry the same field.

**Electional:**
- Read `electional.topMoments` — an array of candidates sorted **best first**.
  Each has `datetimeLocal` (the recommended moment), a numeric `score` (higher is
  better; ~50 is neutral), and a `reasons` array of signed signals (e.g.
  `"Moon not void-of-course +20"`, `"Venus angular (house 10, benefic) +25"`,
  `"Significators ... applying trine (favorable, orb 1.2) +42"`).
- Recommend the top 1–3 `datetimeLocal` moments. Quote the actual `reasons`
  behind each — these ARE the key signals. A void-of-course Moon (`-40`) or a
  malefic angular/hard significator aspect dragging the score down is a real
  caveat to state.
- `candidatesEvaluated` tells you how wide the search was; if the best score is
  still low/negative, say the window is unfavorable rather than overselling it.

## Step 5 — Output (always this shape)

1. **Verdict** — the lean + a confidence word (low / moderate / strong).
   Example: "Leans yes — moderate confidence."
2. **Key signals** — the specific placements and aspects, quoting the **exact
   degrees from the engine** (e.g. "your significator Venus at 12.4° Libra applies
   to a trine with Jupiter at 9.1° Aquarius").
3. **Timing** — windows/dates where the data supports it; otherwise say timing is
   unclear.
4. **Caveats** — what lowers confidence (void Moon, rough birth time, wide orb),
   and the reminder that this is one input to the decision.

Never present a verdict without the signals. Never invent a degree the engine
did not return.
