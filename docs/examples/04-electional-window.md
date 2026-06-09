# Example 4 — Electional window search: "When should I launch?"

Electional astrology runs the question backwards: instead of judging a fixed
moment, it **scans a window** and ranks the moments by how well-configured they
are for the matter. Here the matter is a 10th-house launch (a business / public
venture), and the engine scores every 30-minute slot across a ~2.5-day window in
New York.

**Every number below is from an actual engine run.** Reproduce it with the
command under [Reproduce it](#reproduce-it).

---

## The question

> **"Over the next couple of days, when is the best moment to launch?"** — 10th
> house (career / public venture), New York, scanning 10–12 June 2026, daytime
> hours, in 30-minute steps.

## The exact command

```bash
pnpm -s compute '{"kind":"electional","quesitedHouse":10,"window":{"startLocal":"2026-06-10T08:00:00","endLocal":"2026-06-12T18:00:00"},"stepMinutes":30,"location":{"latitude":40.7128,"longitude":-74.006,"timezone":"America/New_York"}}'
```

## The raw verdict (verbatim engine output)

```json
{
  "electional": {
    "candidatesEvaluated": 117,
    "averageScore": 62,
    "scoreRange": { "min": -15, "max": 155 },
    "topMoments": [
      {
        "datetimeLocal": "2026-06-11T20:30:00",
        "score": 155,
        "reasons": [
          "Moon not void-of-course +20",
          "Moon in Taurus (benefic sign) +15",
          "Moon angular (house 4) +10",
          "Venus angular (house 7, benefic) +25",
          "Venus in strong sign Cancer +10",
          "Jupiter angular (house 7, benefic) +25",
          "Jupiter in strong sign Cancer +10",
          "Significators Jupiter/Venus separating -10"
        ]
      },
      {
        "datetimeLocal": "2026-06-12T15:00:00",
        "score": 145,
        "reasons": [
          "Moon not void-of-course +20",
          "Moon in Taurus (benefic sign) +15",
          "Venus angular (house 10, benefic) +25",
          "Venus in strong sign Cancer +10",
          "Jupiter angular (house 10, benefic) +25",
          "Jupiter in strong sign Cancer +10",
          "Significators Venus/Moon non-aspecting -10"
        ]
      },
      {
        "datetimeLocal": "2026-06-11T18:00:00",
        "score": 144,
        "reasons": [
          "Moon not void-of-course +20",
          "Moon in Taurus (benefic sign) +15",
          "Venus in strong sign Cancer +10",
          "Jupiter in strong sign Cancer +10",
          "Significators Mars/Mercury applying sextile (favorable, orb 2.8) +39"
        ]
      }
    ]
  }
}
```

**Headline: 117 candidate moments scored, average `62`, range `−15…+155`; the
single best window is 11 June 20:30 at `+155`.**

---

## The two-layer reading

### Layer 1 — the plain read

**Pick 11 June, around 20:30.** Across 117 candidate moments the engine found a
clear winner at **+155** — more than double the window average of +62, and right
at the top of the range. What makes it strong: the Moon is **not void of course**
(things you start can actually progress), it sits in benefic Taurus and is
**angular** (prominent), and **both benefics — Venus and Jupiter — are angular**
and in a strong sign at that moment. That's an unusually clean stack of supports
for a launch. The one debit is that the two significators are *separating* rather
than applying (−10), so the configuration favors the *general* conditions over a
tight significator handshake.

**A solid runner-up — 12 June, 15:00 (+145).** Almost as strong, and here the two
benefics are angular in the **10th** specifically (the launch house itself),
which is thematically cleaner for a *public venture* even though the raw score is
10 lower.

**If you want significator perfection — 11 June, 18:00 (+144).** This one trades
some of the benefic-angularity for an actual **applying sextile between the
significators** (Mars/Mercury, orb 2.8°, +39) — i.e. an active handshake forming
rather than just good ambient conditions.

**The honest boundary.** Electional scoring weighs *general* chart conditions
(Moon, benefics, angularity) plus significator contact. It tells you which
moment is best-configured; it does not promise the venture succeeds. Treat the
+155 as "best available slot in this window," not "guaranteed win."

### Layer 2 — the chart detail

*Skip unless you want the mechanics.*

The #1 elected moment, **2026-06-11T20:30 local (12 June 00:30 UTC)**, casts to:

- **Ascendant Sagittarius 22.8°**, **MC Libra 15.0°**, night chart, New York.
- **Moon** in Taurus 7.3°, house 4 (angular), dignity **+7** — the strongest
  single placement (`Moon not void +20`, `benefic sign +15`, `angular +10`).
- **Venus** in Cancer 28.3°, house 7 (angular) — `+25` for angular benefic,
  `+10` for strong sign.
- **Jupiter** in Cancer 26.2°, house 7 (angular), dignity **+4** — another `+25`
  angular benefic, `+10` strong sign.
- **−10** because the two significators (Jupiter/Venus) are separating, not
  applying.
- Sum → **+155**, the window maximum.

The engine evaluated **117** candidate charts (every 30 min from 10 June 08:00 to
12 June 18:00), averaging **+62**, with the worst slot at **−15**.

---

## Reproduce it

```bash
git clone https://github.com/stardustxx/kairos.git
cd kairos && pnpm install
pnpm -s compute '{"kind":"electional","quesitedHouse":10,"window":{"startLocal":"2026-06-10T08:00:00","endLocal":"2026-06-12T18:00:00"},"stepMinutes":30,"location":{"latitude":40.7128,"longitude":-74.006,"timezone":"America/New_York"}}'
```

You'll get the same 117 candidates, the same average `62`, range `−15…+155`, and
the same top moment (11 June 20:30, `+155`).
