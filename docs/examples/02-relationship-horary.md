# Example 2 — Relationship horary: "Will we get back together?" (an honest no)

This is the example that shows Kairos is willing to tell you **no**. The 7th
house signifies the partner / the other person, so this is a horary with
`quesitedHouse: 7`. There *is* an aspect between the significators — but it is
separating, and the Moon is void of course, so the engine leans unfavorable.

**Every number below is from an actual engine run.** Reproduce it with the
command under [Reproduce it](#reproduce-it).

---

## The question

> **"Will we get back together?"** — asked in Los Angeles, 18 June 2026, 21:00
> local (19 June 04:00 UTC).

## The exact command

```bash
pnpm -s compute '{"kind":"horary","quesitedHouse":7,"moment":{"datetimeLocal":"2026-06-18T21:00:00","latitude":34.0522,"longitude":-118.2437,"timezone":"America/Los_Angeles"}}'
```

## The raw verdict (verbatim engine output)

```json
{
  "querentSignificator": "Saturn",
  "quesitedSignificator": "Moon",
  "querentSignificatorHouse": 3,
  "quesitedSignificatorHouse": 8,
  "significatorAspect": { "a": "Saturn", "b": "Moon", "type": "trine", "orb": 10.298154704463997, "applying": false },
  "moonVoidOfCourse": true,
  "translationOfLight": null,
  "collectionOfLight": null,
  "significatorReception": null,
  "querentSignificatorDignity": -3,
  "quesitedSignificatorDignity": -5,
  "prohibition": null,
  "refranation": null,
  "score": -35,
  "confidence": "medium",
  "lean": "unfavorable",
  "perfection": {
    "direct": false,
    "broken": [],
    "indirectPath": null,
    "summary": "No perfection: the significators neither perfect directly nor through a sound carrier."
  },
  "testimonies": [
    "Significators only separating (trine) — the matter is past, not forming (0)",
    "Quesited significator Moon debilitated (dignity -5) (-5)",
    "Moon void of course — little is likely to come of the matter (-30)",
    "Almuten of the 1st (querent) is Mars (more dignified than ruler Saturn) — Mars has the strongest say over the querent (0)"
  ]
}
```

**Headline: lean `unfavorable`, confidence `medium`, score `−35`.**

---

## The two-layer reading

### Layer 1 — the plain read

**Leans no — moderate confidence.** There *is* a connection between you and the
other person, but the chart says it's behind you, not ahead of you.

**Most likely — the connection is in the past tense.** The two significators do
form a harmonious aspect (a trine), but it is *separating*, not applying — in
horary that reads as a bond that already happened and is now coming apart, rather
than one forming. On top of that the Moon — which carries the momentum of the
matter — is **void of course**, the classical signal that "little is likely to
come of it." That −30 is the single heaviest weight in the chart. *(moderate)*

**Also in play — both sides are weakly placed.** Neither significator has
essential dignity to lean on (the other person's is in fall/debility at −5).
There isn't a strong, settled foundation for either party to rebuild on right
now. *(moderate)*

**Least likely — a clean reconciliation.** Nothing in the chart is actively
*blocking* it (no prohibition), so it's not impossible — but with a separating
aspect and a void Moon, a fresh, forming connection is the least-supported
reading. *(low)*

**What would prove this read wrong:** a clear, mutual move back toward each
other within the next few weeks with real momentum behind it — if that happens,
the void-Moon / separating-aspect testimony missed.

### Layer 2 — the chart detail

*Skip unless you want the mechanics.*

Chart cast for 2026-06-19T04:00:00Z, Los Angeles (34.05°N, 118.24°W),
Regiomontanus houses, **night** chart. Ascendant **Capricorn 11.5°**, so the
querent is ruled by **Saturn**; the 7th house gives the other person to the
**Moon**.

- **You (querent) → Saturn**, dignity **−3** (fall in Aries).
- **The other person (quesited) → Moon**, in Leo 23.9°, 8th house, dignity
  **−5** (peregrine).
- **Significator aspect:** Saturn trine Moon, orb 10.3°, **`applying: false`** —
  separating. Testimony scored `0`, read as "the matter is past, not forming."
- **Moon void of course → −30.** The dominant negative weight.
- **No prohibition, no refranation** — nothing is actively cutting it off; it's
  simply not forming.
- **Engine score −35 → `unfavorable` / `medium`.** The void Moon plus the
  quesited's debility outweigh the (separating) trine.

This is the case the value proposition is built on: a generic tool would
narrate the trine as romantic hope. Kairos scores it honestly as a *separating*
aspect under a void Moon and returns **no** — a falsifiable no, with the exact
testimony that would be wrong if you do reconcile.

---

## Reproduce it

```bash
git clone https://github.com/stardustxx/kairos.git
cd kairos && pnpm install
pnpm -s compute '{"kind":"horary","quesitedHouse":7,"moment":{"datetimeLocal":"2026-06-18T21:00:00","latitude":34.0522,"longitude":-118.2437,"timezone":"America/Los_Angeles"}}'
```

You'll get the same `lean: "unfavorable"`, `score: -35`, `confidence: "medium"`.
