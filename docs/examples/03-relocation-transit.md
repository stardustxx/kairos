# Example 3 — Relocation transit: born one place, living another

Born in Seoul, now living in New York. This run takes the **current sky**
(today's transits) and casts its houses **twice**: once for Seoul (your birth
place) and once for New York (where you actually live now). Same planets, same
moment — but the houses, the angles, and therefore the *areas of life* the
transits land in shift with your location.

It also returns the **annual profection** (the classical "lord of the year")
derived from your natal Ascendant and your age, and the live transit-to-natal
aspects.

**Every number below is from an actual engine run.** Reproduce it with the
command under [Reproduce it](#reproduce-it).

---

## The question

> *"I was born in Seoul but I live in New York — what is the sky doing to me
> today, where I actually am?"* — transit moment 9 June 2026, 12:00 Seoul time
> (03:00 UTC), natal 12 March 1990, 07:45 Seoul.

## The exact command

```bash
pnpm -s compute '{"kind":"transit","moment":{"datetimeLocal":"2026-06-09T12:00:00","latitude":37.5665,"longitude":126.978,"timezone":"Asia/Seoul"},"natal":{"datetimeLocal":"1990-03-12T07:45:00","latitude":37.5665,"longitude":126.978,"timezone":"Asia/Seoul"},"relocation":{"latitude":40.7128,"longitude":-74.006,"timezone":"America/New_York"}}'
```

## The raw verdict (verbatim engine output)

The profection block, the relocation house-shifts, and the tightest
transit-to-natal aspects, exactly as returned:

```json
{
  "profection": {
    "age": 36,
    "profectedSign": "Aries",
    "profectedHouse": 1,
    "lordOfYear": "Mars",
    "lordOfYearPosition": { "sign": "Taurus", "house": 9, "retrograde": false }
  },
  "relocation": {
    "houseShifts": [
      { "planet": "Sun", "fromHouse": 10, "toHouse": 5 },
      { "planet": "Moon", "fromHouse": 7, "toHouse": 2 },
      { "planet": "Mercury", "fromHouse": 10, "toHouse": 6 },
      { "planet": "Venus", "fromHouse": 11, "toHouse": 6 },
      { "planet": "Mars", "fromHouse": 9, "toHouse": 3 },
      { "planet": "Jupiter", "fromHouse": 11, "toHouse": 6 },
      { "planet": "Saturn", "fromHouse": 8, "toHouse": 2 },
      { "planet": "Uranus", "fromHouse": 9, "toHouse": 4 },
      { "planet": "Neptune", "fromHouse": 7, "toHouse": 2 },
      { "planet": "Pluto", "fromHouse": 5, "toHouse": 1 },
      { "planet": "Node", "fromHouse": 6, "toHouse": 1 }
    ]
  },
  "transitAspects_tightest": [
    { "a": "t.Moon", "b": "n.Moon", "type": "opposition", "orb": 0.21, "applying": false },
    { "a": "t.Pluto", "b": "n.Venus", "type": "conjunction", "orb": 0.91, "applying": false },
    { "a": "t.Mars", "b": "n.Node", "type": "square", "orb": 0.99, "applying": false },
    { "a": "t.Jupiter", "b": "n.Moon", "type": "sextile", "orb": 1.07, "applying": true },
    { "a": "t.Mars", "b": "n.Mercury", "type": "sextile", "orb": 1.2, "applying": false }
  ]
}
```

(The `transitAspects` array in the full output is sorted by planet; the five
above are the tightest by orb. Everything is verbatim from the run — the orbs are
rounded to two places for readability.)

---

## The two-layer reading

### Layer 1 — the plain read

**Where you live changes which rooms today's weather hits.** The planets are in
the exact same places either way — but in Seoul the Sun's transit falls in your
10th (career, public standing), while in New York that same Sun falls in your
**5th** (creativity, romance, play). Eleven of your placements change house when
the chart is relocated, so "what today is about" genuinely depends on where you
are standing. Living in New York, today's emphasis pulls toward **home, money,
and the private 2nd/5th-house side of life**, not the public 10th.

**The year's headline topic — yourself.** You're 36, and the profection lands on
your **1st house** (profected sign Aries), making **Mars** your lord of the
year. This is a "you, your body, your initiative" year. Mars is currently running
through your **9th** (travel, study, the bigger picture) — which, for someone
living abroad, is an on-the-nose place for the year's ruler to sit.

**The tightest live transit — a 0.2° Moon opposition.** Transiting Moon is almost
exactly opposite your natal Moon, and transiting Jupiter is applying a sextile to
that same natal Moon (orb ~1°). Emotionally charged day, but with a supportive
Jupiter contact forming.

**What this is not:** this is a *positional* reading — which houses light up
where you live — not a yes/no verdict. There is no falsifiable lean here; that's
what the horary examples are for.

### Layer 2 — the chart detail

*Skip unless you want the mechanics.*

- **Transit chart angles (Seoul):** Ascendant **Virgo 13.3°**, MC **Gemini
  11.0°**.
- **Relocated angles (New York):** Ascendant **Capricorn 27.5°**, MC **Scorpio
  20.9°**. Casting the same moment ~9,000 km west rotates the whole house frame,
  which is why every planet's house changes.
- **House shifts:** all 11 bodies move (see the `houseShifts` array). E.g. natal
  emphasis aside, the *transit* Sun goes 10th → 5th, Saturn 8th → 2nd, Pluto 5th
  → 1st when relocated to New York.
- **Profection:** age 36 → 1st house (Aries) → lord of year **Mars**, found in
  Taurus, 9th house of the transit chart.
- **Tightest transit-to-natal aspects** (by orb): t.Moon ☍ n.Moon 0.21°;
  t.Pluto ☌ n.Venus 0.91°; t.Mars □ n.Node 0.99°; t.Jupiter ⚹ n.Moon 1.07°
  (applying); t.Mars ⚹ n.Mercury 1.20°.

---

## Reproduce it

```bash
git clone https://github.com/stardustxx/kairos.git
cd kairos && pnpm install
pnpm -s compute '{"kind":"transit","moment":{"datetimeLocal":"2026-06-09T12:00:00","latitude":37.5665,"longitude":126.978,"timezone":"Asia/Seoul"},"natal":{"datetimeLocal":"1990-03-12T07:45:00","latitude":37.5665,"longitude":126.978,"timezone":"Asia/Seoul"},"relocation":{"latitude":40.7128,"longitude":-74.006,"timezone":"America/New_York"}}'
```

You'll get the same profection (Mars, 1st house, age 36), the same 11 house
shifts, and the same transit aspects.
