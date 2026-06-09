# Example 5 — Money horary: "Will the money come through?" (direct yes, with timing)

The 2nd house signifies money / movable assets, so this is a horary with
`quesitedHouse: 2`. Unlike the career example (which perfected *indirectly*), here
the two significators apply to a direct aspect that nothing breaks — a clean
**direct perfection** — and the engine even estimates a rough timing.

**Every number below is from an actual engine run.** Reproduce it with the
command under [Reproduce it](#reproduce-it).

---

## The question

> **"Will the money I'm owed come through?"** — asked in London, 10 June 2026,
> 07:30 local (06:30 UTC).

## The exact command

```bash
pnpm -s compute '{"kind":"horary","quesitedHouse":2,"moment":{"datetimeLocal":"2026-06-10T07:30:00","latitude":51.5074,"longitude":-0.1278,"timezone":"Europe/London"}}'
```

## The raw verdict (verbatim engine output)

```json
{
  "querentSignificator": "Moon",
  "quesitedSignificator": "Sun",
  "querentSignificatorHouse": 10,
  "quesitedSignificatorHouse": 11,
  "significatorAspect": { "a": "Moon", "b": "Sun", "type": "sextile", "orb": 7.004981401126244, "applying": true },
  "moonVoidOfCourse": false,
  "significatorReception": { "kind": "one-way", "aReceivesBBy": null, "bReceivesABy": "exaltation" },
  "querentSignificatorDignity": -5,
  "quesitedSignificatorDignity": -5,
  "prohibition": null,
  "refranation": null,
  "timing": {
    "degreesToPerfection": 7.004981401126244,
    "unit": "days",
    "amount": 7,
    "text": "about 7 days",
    "perfectsAtUtc": null
  },
  "score": 35,
  "confidence": "medium",
  "lean": "favorable",
  "perfection": {
    "direct": true,
    "broken": [],
    "indirectPath": null,
    "summary": "Direct perfection: the significators apply to sextile and nothing breaks it."
  },
  "testimonies": [
    "Significators perfect by applying sextile (+40)",
    "One-way reception (Sun receives the other by exaltation) (+5)",
    "Querent significator Moon debilitated (dignity -5) (-5)",
    "Quesited significator Sun debilitated (dignity -5) (-5)"
  ]
}
```

**Headline: lean `favorable`, confidence `medium`, score `+35`, with a rough
timing of "about 7 days."**

---

## The two-layer reading

### Layer 1 — the plain read

**Leans yes — moderate confidence.** This is the cleanest kind of yes in horary:
the two significators are moving *toward* a harmonious aspect and nothing in the
chart interrupts them before they meet.

**Most likely — it comes through directly.** Your significator and the money's
significator apply to a sextile (the strongest single testimony in the chart,
+40), and there's a one-way reception on top of it — the money's side "receives"
you by exaltation, i.e. is disposed to honor the claim. No prohibition and no
refranation means nothing steps in to break the contact. *(moderate)*

**Timing — roughly a week.** The aspect completes in about 7° of separation, and
the engine translates that to **"about 7 days"** as a rough order-of-magnitude
estimate (a day per degree). Treat it as "soon, on the order of a week," not a
hard date.

**The one caveat — both sides are weakly dignified.** Both significators are
peregrine/debilitated (−5 each), so while the connection *forms*, neither party
is in a position of strength. Practically: the money arrives, but possibly smaller,
later, or with more friction than hoped. *(this is what keeps it `medium`, not
`high`.)*

**What would prove this read wrong:** the payment stalling out indefinitely with
no contact from the other side — if nothing moves within roughly a week-to-a-few,
the applying-sextile testimony missed.

### Layer 2 — the chart detail

*Skip unless you want the mechanics.*

Chart cast for 2026-06-10T06:30:00Z, London (51.51°N, 0.13°W), Regiomontanus
houses, day chart. Ascendant **Cancer 23.6°**, so the querent is ruled by the
**Moon**; the 2nd house gives the money to the **Sun**.

- **You (querent) → Moon**, in Aries 12.4°, 10th house, dignity **−5**
  (peregrine).
- **The money (quesited) → Sun**, in Gemini 19.4°, 11th house, dignity **−5**
  (peregrine).
- **Significator aspect:** Moon applying sextile Sun, orb 7.0°, **`applying:
  true`** → **+40**, the dominant testimony.
- **One-way reception** (Sun receives the Moon by exaltation) → **+5**.
- **No prohibition, no refranation, Moon not void** → the perfection stands:
  `direct: true`.
- **Timing:** 7° to perfection → "about 7 days" (no precise `perfectsAtUtc`
  computed here, so the date is left open).
- **Engine score +35 → `favorable` / `medium`.** The +40 applying sextile carries
  it; the two −5 debilities are why it's `medium`, not `high`.

This is the mirror image of [Example 2](02-relationship-horary.md): there a
*separating* aspect under a void Moon produced an honest **no**; here an
*applying* aspect with no break produces an honest **yes** — same engine, same
rules, opposite verdict, both falsifiable.

---

## Reproduce it

```bash
git clone https://github.com/stardustxx/kairos.git
cd kairos && pnpm install
pnpm -s compute '{"kind":"horary","quesitedHouse":2,"moment":{"datetimeLocal":"2026-06-10T07:30:00","latitude":51.5074,"longitude":-0.1278,"timezone":"Europe/London"}}'
```

You'll get the same `lean: "favorable"`, `score: 35`, `confidence: "medium"`, and
the same "about 7 days" timing.
