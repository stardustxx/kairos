# Example 1 — Career horary: "Will I get the job?" (indirect yes)

A horary chart is cast for the *moment a question is sincerely asked*. The 10th
house signifies the job/career, so this is a horary with `quesitedHouse: 10`.

**Every number below is from an actual engine run** — nothing is hand-written or
illustrative. Reproduce it with the command under
[Reproduce it](#reproduce-it).

---

## The question

> **"Will I get the job?"** — asked in New York, 12 June 2026, 14:30 local
> (18:30 UTC).

## The exact command

```bash
pnpm -s compute '{"kind":"horary","quesitedHouse":10,"moment":{"datetimeLocal":"2026-06-12T14:30:00","latitude":40.7128,"longitude":-74.006,"timezone":"America/New_York"}}'
```

## The raw verdict (verbatim engine output)

The decision-relevant part of the `horary` block, exactly as the engine returned
it:

```json
{
  "querentSignificator": "Venus",
  "quesitedSignificator": "Moon",
  "querentSignificatorHouse": 10,
  "quesitedSignificatorHouse": 8,
  "significatorAspect": null,
  "moonVoidOfCourse": false,
  "translationOfLight": { "translator": "Jupiter", "from": "Venus", "to": "Moon", "aspect": "sextile" },
  "significatorReception": { "kind": "mutual", "aReceivesBBy": "domicile", "bReceivesABy": "domicile" },
  "querentSignificatorDignity": 3,
  "quesitedSignificatorDignity": 5,
  "prohibition": null,
  "refranation": null,
  "score": 38,
  "confidence": "medium",
  "lean": "favorable",
  "perfection": {
    "direct": false,
    "broken": [],
    "indirectPath": "Jupiter",
    "summary": "No direct perfection, but the light is carried indirectly through Jupiter."
  },
  "testimonies": [
    "No direct aspect between the significators (0)",
    "Translation of light by Jupiter (Venus → Moon) (+18)",
    "Significators in mutual reception (Venus by domicile, Moon by domicile) — can perfect through dignity exchange (+15)",
    "Quesited significator Moon well-dignified (dignity +5) (+5)",
    "Almuten of the 1st (querent) is Saturn (more dignified than ruler Venus) — Saturn has the strongest say over the querent (0)"
  ]
}
```

**Headline: lean `favorable`, confidence `medium`, score `+38`.**

---

## The two-layer reading

The engine does the math; it does not write prose. The reading below uses only
the engine's real `lean`, `score`, `testimonies`, and chart positions.

### Layer 1 — the plain read

**Leans yes — moderate confidence.** The job is reachable, and there are two
distinct things working in your favor — but it perfects *indirectly*, so it
arrives through a process rather than landing in your lap.

**Most likely — it comes through, carried by a third party and a fair exchange.**
You and the job aren't connected by a direct aspect, but Jupiter relays the light
from your side to the job's side (a recruiter, a referrer, a senior advocate),
*and* the two significators are in mutual reception — each sits in a sign the
other rules, which classically means both sides are disposed to accommodate each
other. That is a "they want you and you want it" configuration. *(moderate)*

**Also in play — the role itself is the better-dignified, more settled side.**
The job's significator is well-placed (dignity +5); your own is positive but
weaker (+3). Practically: the opportunity is real and solid; any wobble is more
on your side — readiness, timing, your own hesitation — than on theirs.
*(moderate)*

**Least likely — it falls through.** No prohibition, no refranation, Moon not
void of course: nothing in the chart cuts the connection before it completes. An
outright "no" is the least-supported outcome. *(low)*

**Timing.** The engine returned no specific perfection date here, so treat the
timing as open — the relayed connection is forming, not already completed.

**What would prove this read wrong:** a flat, early "no" with no intermediary and
no sign of mutual interest — if the process simply dies on their side with no
go-between, this read missed.

### Layer 2 — the chart detail

*Skip unless you want the mechanics.*

Chart cast for 2026-06-12T18:30:00Z, New York (40.71°N, 74.01°W),
Regiomontanus houses. Ascendant **Libra 11.6°**, so the querent is ruled by
**Venus**; the 10th-house cusp (the job) is **Cancer 13.4°** (MC), giving the
quesited to the **Moon**.

- **You (querent) → Venus**, dignity **+3**.
- **The job (quesited) → Moon**, in Taurus 18.3°, 8th house, dignity **+5**
  (exaltation +4, face +1) — the better-dignified side.
- **No direct aspect** between Venus and Moon (testimony `0`).
- **Translation of light by Jupiter** (Cancer 26.4°, 10th house, dignity +4),
  carrying Venus → Moon by sextile (**+18**) — the third party.
- **Mutual reception** Venus ↔ Moon by domicile (**+15**) — both sides disposed
  to accommodate.
- **Perfection:** `direct: false`, `indirectPath: "Jupiter"`.
- **Engine score +38 → `favorable` / `medium`.** The +18 translation and +15
  reception dominate; confidence is `medium` (not `high`) because the route is
  indirect rather than a clean direct application.

---

## Reproduce it

```bash
git clone https://github.com/stardustxx/kairos.git
cd kairos && pnpm install
pnpm -s compute '{"kind":"horary","quesitedHouse":10,"moment":{"datetimeLocal":"2026-06-12T14:30:00","latitude":40.7128,"longitude":-74.006,"timezone":"America/New_York"}}'
```

You'll get the same `lean: "favorable"`, `score: 38`, `confidence: "medium"`.
Swiss Ephemeris is deterministic — the same moment and place always produce the
same chart.
