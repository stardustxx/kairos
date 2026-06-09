# Example gallery — real, reproducible verdicts

Five complete round-trips through Kairos, one file each. **Every number in every
example comes from an actual engine run** — no invented degrees, leans, or scores.
Each file gives you the question, the exact command, the verbatim JSON verdict,
and a two-layer reading (Layer 1 plain, Layer 2 chart detail) built only from the
real numbers. Every example ends with a copy-paste command so you can reproduce
the same chart yourself (Swiss Ephemeris is deterministic — same moment + place →
same chart).

| # | Example | Kind | Real verdict |
|---|---------|------|--------------|
| 1 | [Career horary — "Will I get the job?"](01-career-horary.md) | `horary`, 10th house | `favorable` / `medium` / **+38** (indirect perfection via Jupiter + mutual reception) |
| 2 | [Relationship horary — "Will we get back together?"](02-relationship-horary.md) | `horary`, 7th house | `unfavorable` / `medium` / **−35** (separating aspect, Moon void of course) |
| 3 | [Relocation transit — born Seoul, living New York](03-relocation-transit.md) | `transit` + `relocation` | positional: 11 placements change house; lord of year **Mars** (1st, age 36) |
| 4 | [Electional window — "When should I launch?"](04-electional-window.md) | `electional`, 10th house | 117 moments scored, avg **+62**, best **+155** at 11 Jun 20:30 |
| 5 | [Money horary — "Will the money come through?"](05-money-horary.md) | `horary`, 2nd house | `favorable` / `medium` / **+35** (direct applying sextile, "~7 days") |

## Why these five

- **Examples 1, 2, 5** are the core horary cases and deliberately span the verdict
  space: an **indirect yes** (carried by a third party), an honest **no** (the tool
  declining to flatter a separating aspect under a void Moon), and a clean
  **direct yes** with a timing estimate. Same engine, same rules, opposite leans —
  all falsifiable.
- **Example 3** shows the non-horary side: how the *same* sky lands in different
  houses depending on where you live, plus annual profection — a positional read,
  explicitly *not* a yes/no verdict.
- **Example 4** shows the search mode: rank a whole window instead of judging one
  fixed moment.

## A note on honesty

These examples were not cherry-picked to all say "yes." Example 2 is a **no**, and
several scanned moments in the other questions also leaned unfavorable before a
clear case was chosen for illustration. The point of the gallery is to show the
engine's full behavior — including when it tells you the answer you didn't want.
The track record that turns these one-off reads into a *calibrated* hit-rate is
described in the [Calibration contract](../../README.md#calibration-contract--kairos-keeps-score)
section of the README.
