# Source notes — Regression-Based Cost Estimation

## Source
- Files: `Session 3 Regression Cost Estimation.pdf` (85 pp; the slide footer numbering runs 1–83) | Session 3 of 30 | ACCT 2302 Principles of Managerial Accounting, Fall Term 2026
- Companion workbooks supplied with the deck: `Simple Linear Regression Illustration.xlsx` (2 sheets), `Multiple Regression Illustration.xlsx` (2 variables, n = 10) and `Multiple Regression Illustration (1).xlsx` (3 variables, n = 12). The two multiple-regression files are different data sets, not a duplicate.
- Texts cited by the deck: Cornerstone Ch. 3 Appendix; Weygandt et al. Ch. 2 Appendix; Shim & Siegel Ch. 3, §3.7–3.8.

## Concept inventory (lecture order)
1. The gap left by high-low and scattergraph — slide 9
2. Regression analysis; simple vs multiple — slides 10, 14
3. Error (residual) u = y − y′ — slide 11
4. The least-squares criterion — slide 12
5. What regression adds: objectivity, full data use, fit statistics — slide 13
6. The normal equations (not derived) — slide 16
7. The by-hand formulas for b and a — slide 19
8. Step 1–5 on the 12-month data — slides 20–28 (Examples 1–3)
9. Three methods compared — slide 29
10. R² and r — slides 33–39 (Example 4)
11. Standard error of the estimate and the t-statistic — slides 41–45 (Examples 5–6)
12. Multiple regression — slides 49–52 (Example 7)
13. Multicollinearity — slides 53–57 (Example 8)
14. Choosing a method; workflow; communication; software; caveats — slides 59–66
15. Worked examples 9–12 — slides 68–75

## Formulas (verbatim, as TeX)
- Normal equations: `\sum y = na + b\sum x`, `\sum xy = a\sum x + b\sum x^2` — slide 16
- `b = \frac{n\sum xy - (\sum x)(\sum y)}{n\sum x^2 - (\sum x)^2}` — slide 19
- `a = \bar{y} - b\bar{x}` — slide 19
- `R^2 = \frac{(n\sum xy - \sum x\sum y)^2}{[n\sum x^2 - (\sum x)^2][n\sum y^2 - (\sum y)^2]}` — slide 34
- `u = y - y'`; minimize `\sum u^2 = \sum (y - y')^2` — slides 11–12
- `t = b / s_b` — slide 44

## Worked examples (exact numbers)
- Table and totals: Σx = 174, Σy = 225, Σxy = 3,414, Σx² = 2,792, n = 12 — slides 20–21 (→ `fmc-regression`)
- Ex. 1 means: x̄ = 14.5, ȳ = 18.75 — slides 22–23
- Ex. 2 b = 1,818 ÷ 3,228 = 0.5632 — slides 24–25
- Ex. 3 a = 18.75 − 0.5632 × 14.5 = 10.5836 (₱10,583.60) — slides 26–27
- Predictions 19,031.60 / 21,847.60 / 16,215.60 at 15,000 / 20,000 / 10,000 DLH — slide 28 (→ `fmc-predict-*`)
- Ex. 4 R² = 3,305,124 ÷ 5,432,724 = 0.6084 (Σy² = 4,359; nΣy² − (Σy)² = 1,683) — slides 34–35 (→ `fmc-r2`)
- Ex. 5 sₑ = 2.3436 (₱000); ≈ ±₱4,687 — slides 42–43 (→ `fmc-se`)
- Ex. 6 (R² 0.42, t 0.85): do not rely — slides 46–47 (→ `judge-software`)
- Ex. 7 Baguio: 12,000 + 3.20X₁ + 180X₂; 5,000 kg, 40 orders → ₱35,200; R² = 0.94 — slides 50–51 (→ `baguio-predict`)
- Ex. 8 multicollinearity red flag (96% correlation, negative coefficient) — slides 55–56 (qualitative)
- Ex. 9 Cordillera: b = ₱44.80, a = ₱3,640, ₱13,496 at 220 hrs — slides 68–69 (→ `cordillera-sums`, `cordillera-points`, `cordillera-predict`)
- Ex. 10 Iloilo Ice Plant: high-low 25,000 + 183.33/ton against regression 26,800 + 179.20/ton, R² 0.98 (no raw data) — slides 70–71
- Ex. 11 driver choice: DLH R² 0.55 t 2.3 vs MH R² 0.81 t 5.6 → machine hours — slides 72–73 (→ `judge-drivers`)
- Ex. 12 utilities: R² 0.91, t 6.8, sₑ ₱3,200, data 8,000–15,000 MH; 22,000 MH is outside — slides 74–75 (→ `range-utilities`)
- Workbook, simple: Ads/Sales ($000), n = 10: Σx = 130, Σy = 371, Σxy (deviations) = 539, Σx² (deviations) = 330, b = 1.6333, a = 15.8667 (→ `ads-deviation`)
- Workbook, template sample (12 pairs): SLOPE 3.81119, INTERCEPT 46.39394, CORREL 0.998423, RSQ 0.996847, STEYX 0.810479 (→ `template-regression`)
- Workbook, 2 drivers: a 2.228033, b₁ 1.541841, b₂ 3.218619, R² 0.995784, adj. R² 0.994579, sₑ 1.051498, SE(b₁) 1.136087, SE(b₂) 0.616847, t 1.35715 / 5.217856, F 826.601 (→ `twovar-multiple`)
- Workbook, 3 drivers: a 13.951519, b 2.213725 / 1.410038 / 3.275862, R² 0.995095, adj. 0.993255, sₑ 1.364295, t 1.81771 / 2.190576 / 1.995224, F 540.979 (→ `threevar-multiple`)

## Conventions & ambiguities
- **Units.** The regression table uses thousands (hours in 000, overhead in ₱000). b is therefore pesos per hour and a is in thousands; the slide restates a = 10.5836 as ₱10,583.60.
- **Rounding.** The slide computes a with b rounded to 0.5632 (a = 18.75 − 8.1664). The module uses the unrounded b; both give 10.5836 to four decimals.
- **sₑ.** The deck gives the value 2.3436 and says it was computed "using Σy², a, b, Σy and Σxy". The module uses sₑ = √[(Σy² − aΣy − bΣxy) ÷ (n − 2)]. In exact arithmetic the same quantity is √[(nΣy² − (Σy)² − b(nΣxy − ΣxΣy)) ÷ (n(n − 2))], which is what the code evaluates for stability. It reproduces 2.3436, and the workbook's STEYX.
- **s_b and t for the FMC line.** The deck defines t = b ÷ s_b but gives no s_b number. The module uses the textbook s_b = sₑ ÷ √Σ(x − x̄)², giving s_b ≈ 0.143 and t ≈ 3.94 (not on the slides).
- **"Good R²" bands.** Slide 37 says above ~0.80–0.90 strong, 0.50–0.80 usable, below ~0.30–0.50 poor. The module's `judgeModel` uses strong ≥ 0.80, usable 0.50–0.80, weak < 0.50; Example 6's R² = 0.42 is "modest" on the slide and "weak" here. The quiz generator avoids the 0.30–0.50 ambiguity by not pairing a weak R² with an insignificant t.
- **Significance.** |t| > 2 as the slide's rule of thumb (not a table lookup).
- **Multiple regression** is solved from the deviation-form normal equations, as the workbook's "Manual Computation" sheet does. SE(bᵢ) = sₑ √[(S⁻¹)ᵢᵢ] and SE(a) = sₑ √[1/n + x̄ᵀS⁻¹x̄].

## Errata
- Slide 11: "If actual May overhead is ₱25,000 and the line predicts ₱23,800, the error is ₱1,200." The fitted line actually predicts ₱23,537.60 at 23,000 DLH, so the figure is illustrative, not from the regression above. The module uses the numbers only as the arithmetic u = y − y′ (in thousands: 25 − 23.8 = 1.2) and does not claim they are the line's value for May.
- Several slide footers read "SESSION 1" although this is Session 3; layout only, nothing numeric.
- Workbook `Multiple Regression Illustration.xlsx`, sheet "Excel Template (LINEST)": the instruction text refers to "rows 6–25" and "Rows 6–15 hold sample data", but the data sit in rows 10–19. Cosmetic.
- Workbook currency: the simple-regression illustration labels advertising and sales in `$000`; the module shows them as plain numbers.

## Beyond the slides
- The correlation matrix and the "drop X1 and refit" comparison use the supplied multiple-regression workbooks; the deck describes multicollinearity only in words (slides 53–56). Section `multicollinearity` is flagged `beyondSlides`.
- The statsmodels snippet in the Application tab and the Excel function names (`SLOPE`, `INTERCEPT`, `RSQ`, `STEYX`, `LINEST`) go slightly beyond slide 65.
- Standard error of b and the t-statistic for FMC, as above.

## Skill map
- least-squares: residual, squared errors, why one best line (slides 11–17)
- regression-line: table, totals, b, a, deviation form (slides 19–28, 68–69; workbook sheet 1)
- r-squared: R², r, rules of thumb (slides 33–39)
- standard-error: sₑ and the ±2 sₑ range (slides 41–43)
- t-statistic: s_b and t (slides 44–47)
- multiple-regression: equation, prediction, adjusted R² and F from the workbook (slides 49–52)
- multicollinearity: warning signs, remedies (slides 53–57; workbook)
- method-choice: when regression wins, relevant range, driver choice, communication (slides 59–66, 70–75)
