# Source notes — pandas II: Selecting Rows by Conditions

## Source
- File: midterm-exam/Problem 1.ipynb, Problem 2.ipynb (BDCC 2026 Fall) | Date: 2026-11-03
- Used for the *kinds* of conditions only: items with at least N ratings, only recipes the user has not rated,
  neighbours with at least N common raters, up to k neighbours, frequent at a fraction of the baskets, the largest
  baskets, support AND confidence thresholds, sort by a score then by id. No exam code, thresholds or assert values
  are reused.
- Data: food-mini from pandas-read-data (`modules/pandas-read-data/assets/food-mini/`).

## Concept inventory (lecture order)
1. Boolean masks: condition → True/False per row; df[mask]; mask.sum() — scene one-mask
2. &, |, ~ with parentheses; `and` and missing parentheses raise ValueError — scene combine
3. isna/notna on a user's row; == NaN never matches — scene candidates, section unrated
4. Co-rated counts across two columns; neighbours with >= k common raters; excluding the target — scene neighbours
5. Relative thresholds (fraction × n); >= vs > at the boundary; comparing counts with a fraction — scene thresholds
6. Every row at the maximum (== max) vs nlargest(1) — same scene
7. Two-key sort with ascending=[False, True]; ties at the top-k cut-off — scene ranking
8. assert_equal's ACTUAL / DESIRED — every scene; application

## Formulas (verbatim, as TeX)
- None: a workflow module. Key lines appear as `keyFormula` per section.

## Worked examples (exact numbers)
- record2.py runs each cell for real (Python 3.12.12, pandas 2.2.3, numpy 2.x), with the recorder and conventions
  of pandas-read-data (fresh namespace per kernel, Jupyter cell numbers, display options, trimmed tracebacks,
  `/mnt/data/public` paths). Scalars print as `np.int64(25)`: that is numpy 2's repr; numpy 1 prints `25`.
- Dropped after recording: `-mask` (pandas 2.2 treats it like `~` on a boolean Series, so it teaches nothing) and a
  one-key `sort_values` that happened to keep the right tie order on this data.
- Masks: 25 rows with rating >= 4; user 1101's 4+ recipes 1207, 2318, 4415 → example masks
- User 1245 unrated 2318, 4415, 6110, 8233 → candidates-of-1245
- Common raters with 1207: 2318:3, 3542:4, 4415:2, 5021:3, 6110:1, 7064:4, 8233:1 → common-raters
- Mean ratings; top 5 by mean then id: 8233, 1207, 6110, 2318, 5021 (5021 and 7064 tie at 4.0) → ranking
- Tags: minsup = 8 × 0.25 = 2; >= keeps 11 tags, > keeps 8 → frequent-tags
- Pair rules over tags: 182; support >= 0.25 & confidence >= 0.8: 24; with |: 106; with support > 0.25: 15 → rules

## Conventions & ambiguities
- value_counts orders tied counts arbitrarily (an unstable sort); examples compare those lists as sets and the
  lessons show the real printed order.
- The utility matrix here keeps all 8 recipes (no count cut), so every user and recipe can be used in examples.

## Errata
- None.

## Beyond the slides
- The whole module is beyond the lectures: it teaches the pandas selections the midterm specs assumed.

## Skill map
- bool-mask: masks, df[mask], mask.sum()
- combine-masks: &, |, ~, parentheses, ValueError
- missing-mask: isna, notna, == NaN
- pair-mask: co-rated counts, neighbours, excluding the target
- relative-threshold: fraction × n, >= vs >
- max-filter: == max vs nlargest(1)
- sort-tiebreak: two-key sort, head(k)
- read-asserts: ACTUAL / DESIRED
