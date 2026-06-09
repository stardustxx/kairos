# A worked example — "Will I get the job?"

This is a complete, real round-trip through Kairos: a question goes in, the
engine computes an astronomically accurate chart, and a calibrated two-layer
verdict comes out. **Every number below is from an actual engine run** — nothing
here is hand-written or illustrative. You can reproduce it with the command in
[Reproduce it yourself](#reproduce-it-yourself).

A horary chart is cast for the *moment a question is sincerely asked*. Here the
question — "Will I get the job?" — is asked in London on 8 June 2026 at 11:15
local time (10:15 UTC). The 10th house signifies the job/career, so we run a
horary with `quesitedHouse: 10`.

---

## The question

> **"Will I get the job?"** — asked in London, 8 June 2026, 11:15 local.

```bash
pnpm -s compute '{"kind":"horary","quesitedHouse":10,"moment":{"datetimeLocal":"2026-06-08T11:15:00","latitude":51.5074,"longitude":-0.1278,"timezone":"Europe/London"}}'
```

## The raw verdict (real engine output)

The engine returns the full chart plus a `horary` block. The decision-relevant
part of that block, verbatim:

```json
{
  "querentSignificator": "Mercury",
  "quesitedSignificator": "Venus",
  "querentSignificatorHouse": 11,
  "quesitedSignificatorHouse": 11,
  "moonVoidOfCourse": false,
  "moonApplyingToQuesited": { "a": "Moon", "b": "Venus", "type": "trine", "orb": 6.36, "applying": true },
  "translationOfLight": { "translator": "Moon", "from": "Mercury", "to": "Venus", "aspect": "trine" },
  "querentSignificatorDignity": 1,
  "quesitedSignificatorDignity": 3,
  "prohibition": null,
  "refranation": null,
  "score": 38,
  "confidence": "medium",
  "lean": "favorable",
  "perfection": {
    "direct": false,
    "broken": [],
    "indirectPath": "Moon",
    "summary": "No direct perfection, but the light is carried indirectly through Moon."
  },
  "testimonies": [
    "No direct aspect between the significators (0)",
    "Moon (co-significator of querent) applies by trine to the quesited (+20)",
    "Translation of light by Moon (Mercury → Venus) (+18)"
  ]
}
```

The headline numbers: **lean `favorable`, confidence `medium`, score `+38`.**

> The full result (chart wheel, all planet positions, dignities, houses, and this
> horary block) is saved in [`web/example-output.json`](../web/example-output.json).
> Open `web/index.html`, click **Load Example**, and you'll see this exact chart
> rendered as a wheel with the verdict panel.

---

## The reading the skill produces

The engine does the math; it does **not** write prose. The Kairos skill turns the
JSON above into a calibrated answer in two layers. Layer 1 is self-sufficient for
a non-astrologer; Layer 2 is the optional mechanics. The reading below uses only
the engine's real `lean`, `score`, `testimonies`, and chart positions.

### Example reading

**Leans yes — moderate confidence.** The chart says the job is reachable, but it
comes to you sideways rather than landing cleanly in your lap.

**Most likely — it comes through, with help from a third party.**
You and the job aren't connected directly, but a go-between carries things from
you to it: a recruiter, a referral, a mutual contact, an introduction. The
strongest single signal in the chart is exactly this kind of relayed connection,
and it points to yes. *(moderate)*

**Also in play — both sides are decently placed, the role slightly more so.**
Neither significator is debilitated; both carry a little essential dignity, with
the job's side (Venus, +3) marginally better-placed than your own (Mercury, +1).
Practically: this is a real, solid opportunity, not a hollow one — the question is
whether the connection completes, not whether the role is worth having.
*(moderate)*

**Least likely — it falls through.**
There's no blocking pattern in the chart (nothing cutting the connection off
before it completes), so an outright "no" is the least-supported outcome — but the
indirect, third-party route means it isn't guaranteed either. *(low)*

**Timing.** The engine returned no specific perfection date for this question, so
treat the timing as open: the relayed connection is forming, not already
completed. Don't read a fixed deadline into it.

**The honest boundary.** This is one input, not destiny. Horary measures the
*shape and momentum* of the situation at the moment you asked — it leans yes here
because the connecting testimony (a third party carrying the light) is the
dominant signal and nothing breaks it. It is **not** a substitute for
following up, preparing, or negotiating. **What would prove this read wrong:** a
flat, early "no" with no intermediary involved and no further contact — if the
process simply dies on their side with no go-between, this read missed.

---

### The chart detail, if you want it —

*Skip this unless you want the mechanics — every number behind the read lives
here.*

Chart cast for 2026-06-08T10:15:00Z, London (51.51°N, 0.13°W),
Regiomontanus houses. Ascendant Virgo 2.2°, so the querent is ruled by Mercury;
the 10th-house cusp (the job) gives the quesited to Venus.

- **You (the querent) → Mercury**, in Cancer 10.6°, in the 11th house, dignity
  **+1** (face ruler).
- **The job (the quesited) → Venus**, in Cancer 24.1°, in the 11th house, dignity
  **+3** (triplicity). Both significators carry a little essential dignity — the
  job's side marginally the better-placed of the two.
- **No direct aspect** between Mercury and Venus (testimony `0`) — hence "you
  aren't connected directly."
- **Translation of light by the Moon** (Moon in Pisces 17.8°, 7th house) carrying
  Mercury → Venus by trine (**+18**), and the **Moon applies by trine to the
  quesited Venus** (orb 6.4°, applying, **+20**). These two are the "third party
  carries it through" mechanic and the dominant driver of the favorable lean.
- **No prohibition, no refranation, Moon not void of course** — nothing in the
  chart cuts the connection off before it perfects, which is why "it falls
  through" is the least-likely outcome.
- **Perfection:** `direct: false`, `indirectPath: "Moon"` — *"No direct
  perfection, but the light is carried indirectly through Moon."*
- **Engine score +38 → lean `favorable`, confidence `medium`.** The +20 and +18
  connecting testimonies are the whole positive case; the indirect (rather than
  direct) route is why confidence is `medium`, not `high`.

Falsifiability, restated next to the mechanic it tests: the favorable lean rests
on the Moon's translation of light to Venus. If the job never materializes and no
intermediary was ever involved, that translation testimony did not predict the
outcome — and this read owns the miss rather than re-narrating the same Moon to
explain a "no."

---

## Reproduce it yourself

```bash
git clone https://github.com/stardustxx/kairos.git
cd kairos
pnpm install
pnpm -s compute '{"kind":"horary","quesitedHouse":10,"moment":{"datetimeLocal":"2026-06-08T11:15:00","latitude":51.5074,"longitude":-0.1278,"timezone":"Europe/London"}}'
```

You'll get the same chart and the same `lean: "favorable"`, `score: 38`,
`confidence: "medium"`. (Swiss Ephemeris is deterministic — the same moment and
place always produce the same chart.)
