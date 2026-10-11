# Source notes — Cost Behavior and Cost Estimation

## Source
- File: `Cost Behavior Classification Estimation.pdf` (86 pp, slides 1–86) | Session 2 of 30 | ACCT 2302 Principles of Managerial Accounting, Fall Term 2026, instructor A. G. Agustin
- Texts cited by the deck: Mowen, Hansen & Heitger *Cornerstone* Ch. 3; Weygandt, Kimmel & Aly (Canadian) Ch. 2; Shim & Siegel *Schaum's Outline* Ch. 3.
- Neighbouring sources used only for context: `Foundations of Managerial Accounting.pdf` (Session 1), `Session 3 Regression Cost Estimation.pdf` (Session 3), `Principles of Managerial Accounting Course Introduction.pdf` (syllabus; no examinable content, Quiz 1 covers Sessions 1–3).

## Concept inventory (lecture order)
1. Why cost behavior matters (CVP, special decisions, contribution approach, flexible budgets) — slide 9
2. Cost behavior defined; relevant range mentioned — slide 10
3. Four patterns: variable, fixed, mixed, step — slides 11, 22
4. Variable cost: total varies in proportion, per unit constant — slides 12–13
5. Fixed cost: total constant, per unit falls — slides 14–17 (Example 1)
6. Mixed (semivariable) cost and y = a + bx — slides 18–20
7. Step cost — slide 21
8. Classifying by behavior (Marikina Shoe) — slides 23–24 (Example 2)
9. Relevant range; "all costs are variable in the long run" — slides 26–29
10. Committed vs discretionary fixed costs — slides 30–35 (Example 3)
11. Why separate mixed costs; three methods; data requirements — slides 37–39
12. Running example: Flexible Manufacturing Company, 12 months — slide 40
13. High-low method — slides 42–52 (Examples 4–6; strengths and limitations)
14. Scattergraph method — slides 54–62 (Example 7; outlier detector)
15. Comparing methods; predicted overhead table — slides 64–66
16. Applying the formula to a budget — slides 67–70 (Example 8)
17. Pitfalls — slide 71
18. Worked examples 9–11 — slides 73–78

## Formulas (verbatim, as TeX)
- Cost-volume formula: `y = a + bx` — slide 20 (y total cost, x activity, a fixed cost component/intercept, b variable rate/slope)
- High-low variable rate: `b = \frac{\text{cost at high} - \text{cost at low}}{\text{activity at high} - \text{activity at low}}` — slide 43
- High-low fixed cost: `a = \text{total cost at either point} - b \times \text{activity at that point}` — slide 43
- Estimated cost: `y' = a + bx`, prime marks an estimate — slide 50
- Scattergraph: fixed cost = y-intercept; variable rate = (cost at a point on the line − fixed cost) ÷ activity at that point — slides 55, 58

## Worked examples (exact numbers)
- Ex. 1 Heaven Consumer Products: depreciation ₱27,000 at 5,000 and 10,000 units → ₱5.40 and ₱2.70 per unit — slides 15–16 (→ `heaven-unit`)
- Ex. 2 Marikina Shoe: leather variable, rent fixed, electric ₱8,000 + ₱0.15/kWh mixed, line supervisor per 15 workers step — slides 23–24 (→ DropBins dataset `marikina`)
- Ex. 3 Cavite Precision Parts: 6 years of lease and depreciation committed; training and trade-fair sponsorship discretionary — slides 34–35 (→ `cavite`)
- Running data FMC: 12 months of (DLH, overhead) — slide 40 (→ `fmc`)
- Ex. 4 high/low = May (23,000 DLH, ₱25,000) and September (7,000 DLH, ₱14,000); differences 16,000 and ₱11,000 — slides 44–45 (→ `fmc-high-low`)
- Ex. 5 b = 11,000 ÷ 16,000 = ₱0.6875 per DLH — slides 46–47 (→ `fmc-high-low`)
- Ex. 6 a = ₱9,187.50 from both points (variable cost 15,812.50 at high, 4,812.50 at low) — slides 48–49 (→ `fmc-high-low`)
- Formula y′ = 9,187.50 + 0.6875x; predictions ₱19,500 at 15,000, ₱22,937.50 at 20,000, and ₱15,875 at 10,000 (an arithmetic slip, correct value ₱16,062.50; see Errata) — slide 50 (→ `fmc-predict-*`)
- Ex. 7 scattergraph: intercept ₱6,000, point (23,000; ₱25,000) → variable ₱19,000, rate ₱0.8261 — slides 57–58 (→ `scatter-fmc`)
- Head-to-head table: 10,000 → 15,875 (should be 16,062.50) / 14,261; 15,000 → 19,500 / 18,392; 20,000 → 22,938 / 22,522; 25,000 → 26,375 / 26,653 — slide 64 (→ `compare-table`)
- Ex. 8 budget at 18,000 DLH: 9,187.50 + 12,375 = ₱21,562.50 — slides 68–69 (→ `fmc-budget`)
- Ex. 9 Bicol Express Logistics: (300 km, ₱15,000) and (900 km, ₱33,000) → ₱30/km, ₱6,000, ₱27,000 at 700 km — slides 73–74 (→ `bicol-high-low`, `bicol-predict`)
- Ex. 10 Zamboanga Seafood: May ₱95,000 at 20,000 kg is a typhoon outlier; exclude it — slides 75–76 (qualitative; see Beyond the slides)
- Ex. 11 Cordillera Craft Furniture: y = 12,000 + 8x, 40 machine hours → incremental overhead ₱320, not ₱12,320 — slides 77–78 (→ `cordillera-incremental`)

## Conventions & ambiguities
- **High and low are chosen by activity (x), never by cost (y).** Slide 42 says it outright and slide 45 stresses "TRUE activity extremes". In the FMC data the cost extremes are the same months by coincidence (May ₱25,000 and September ₱14,000), so the data alone cannot show the difference; the module's quiz generator forces a draw where the highest cost is *not* at the highest activity.
- **Scattergraph predictions use the variable rate rounded to 4 decimals (₱0.8261).** The exact rate is 19,000 ÷ 23,000 = 0.826087. With the exact rate the table on slide 64 would read ₱18,391 at 15,000 DLH and ₱26,652 at 25,000 DLH; the slide prints ₱18,392 and ₱26,653, which are reproduced only by 0.8261 × x + 6,000 (18,391.5 and 26,652.5, rounded half up). `scatterFormula` takes `roundRate: 4` to reproduce the slide; the default keeps full precision.
- **High-low prediction at 20,000 DLH** is ₱22,937.50 (slide 50) and is shown rounded to ₱22,938 on slide 64. Same number, two roundings.
- **Units.** Slide 40 prints DLH and overhead in thousands ("Direct Labor Hours (000)", "Factory Overhead (₱000)"), but Examples 4–8 restate them in hours and pesos (23,000 DLH, ₱25,000). The dataset stores full units so b is read directly as pesos per DLH.
- **Money symbol.** Peso (₱) throughout.
- **Step costs** have no numbers in the deck. `behaviorAt` computes a step cost as `ceil(activity ÷ step width) × step amount`; at zero activity it is zero. This is the module's own convention for illustration (see Beyond the slides).

## Errata
- **Slides 50 and 64: the high-low estimate at 10,000 DLH is printed as ₱15,875, but 9,187.50 + 0.6875 × 10,000 = 9,187.50 + 6,875 = ₱16,062.50.** The slide's own formula contradicts it. Every other value on slide 50 (₱19,500 at 15,000; ₱22,937.50 at 20,000) and slide 64 (₱19,500; ₱22,938; ₱26,375) reproduces. The module uses ₱16,062.50; the gap to the scattergraph estimate at 10,000 DLH is therefore ₱1,801.50, not the ₱1,614 the slide's number implies. Shown as an errata note in the cost-formula and compare-methods sections and as a callout in the head-to-head scene.
- Slide 59 footer text reads "SESSIONS 1ame Data, Different Results" (a PDF footer collision), and every slide footer reads "SESSION 1" even though this is Session 2. Layout issues only; nothing numeric.
- Slide 64 shows ₱22,938 for the high-low estimate at 20,000 DLH; slide 50 gives the unrounded ₱22,937.50. Not an error, a rounding.

## Beyond the slides
- Step-cost staircase numbers (₱1,500 per 25 units) and the four-pattern chart's illustrative rates are invented to draw the pictures; the deck gives only verbal descriptions. Flagged with a `beyond` callout.
- The Zamboanga Seafood outlier is described in words only (seven tight linear months plus May at ₱95,000 and 20,000 kg). The seven normal months (cost = ₱20,000 + ₱3 × kg) are invented so the learner can watch the high-low formula change when May is included or excluded. Flagged with a `beyond` callout.
- The fixed-per-unit table for several volumes goes past Example 1's two volumes.

## Skill map
- behavior-patterns: variable, fixed, mixed, step; classification (Ex. 2)
- unit-behavior: total vs per-unit behavior (Ex. 1)
- relevant-range: relevant range and extrapolation (slides 26–29, 71)
- fixed-types: committed vs discretionary (Ex. 3)
- cost-formula: y = a + bx, prediction, budgeting (Ex. 8, 9d)
- high-low: select by activity, b, a (Ex. 4–6, 9)
- scattergraph: plot, intercept, slope, outliers (Ex. 7, 10)
- compare-methods: head-to-head, choice, incremental cost, pitfalls (slides 64–71, Ex. 11)
