# Source notes — Neighborhood-based Collaborative Filtering

## Source
- File: 5-7-nb-cf.pdf | Sessions: 5–7 | Date: 2026-09-14 | Pages: 27 (handout, 2 slides per page; slide n is on page ⌈n/2⌉)

## Concept inventory (lecture order)
1. User-based collaborative filtering — slides 2–14 — predict a user's missing rating from similar users
2. Row means μᵤ — slide 3 — average of the ratings each user gave
3. Mean-centering — slide 4 — rating − μᵤ, so harsh and generous raters become comparable
4. User–user similarity matrix — slides 5, 9 — cosine of centered ratings
5. Top-k neighbours and the weighted prediction — slides 10–14 (k = 3)
6. Item-based collaborative filtering — slides 15–47 — similarity between items (columns), prediction from the items the user rated (k = 2)
7. Discounted cumulative gain — slides 48–52 — gain 2^rel − 1 discounted by log₂(i + 1); IDCG from the ideal order
8. NDCG — slide 53 — DCG / IDCG

## Formulas (verbatim, as TeX)
- Mean: `\mu_u = \frac{1}{|I_u|}\sum_{j \in I_u} r_{uj}` — slide 3
- Centered rating: `s_{uj} = r_{uj} - \mu_u` — slide 4
- Prediction (centered): `\hat s_{uj} = \frac{\sum_{v \in P_u(j)} \text{sim}(u,v)\, s_{vj}}{\sum_{v \in P_u(j)} \text{sim}(u,v)}` — slide 10 (worked: (0.7)(1.5)+(0.94)(1) over 0.7+0.94 = 1.2)
- DCG: `\sum_{i=1}^{k} \frac{2^{rel_i} - 1}{\log_2(i + 1)}` — slide 50
- NDCG: `\text{DCG}/\text{IDCG}` — slide 53

## Worked examples (exact numbers)
- HP matrix means 10/3, 14/3, 11/3, 3 — slide 3 (→ hp-means)
- Centered HP matrix, e.g. A: 2/3, 5/3, −7/3 — slide 4 (→ hp-center-a)
- HP user similarities: sim(B,A) = 1, sim(C,A) = −0.73, sim(C,B) = 0, D row all 0 — slide 5 (→ hp-sim-*)
- a–f matrix means 5.5, 4.8, 2, 2.5, 2 — slide 7 (→ ab-means)
- a–f user similarities 0.70, 0.89, −0.90, −0.82, 0.94, −0.72, −0.90, −1, −0.82, 0.87 — slide 9 (→ ab-sim-*)
- User-based, k = 3: B·c = 1.2, C·a = 1.3, C·f = −1.1, E·b = −0.5 — slides 10–13 (→ ub-*)
- HP item similarities — slide 18 (→ ib-sim-*)
- Item-based, k = 2, HP: C·HP1 = −1.7, A·HP2 = 0.7, C·HP2 blank, D·HP2 = 0, HP3 blank for A/C/D, B·TW = 0.3, D·TW = 0, B·SW1 blank, A·SW2 = −2.3, B·SW2 blank, D·SW2 = 0, SW3 blank — slides 20–37 (→ ib-hp-*)
- a–f item similarities 0.74, 0.91, −0.85, … — slide 41 (→ ab-isim-*)
- Item-based, k = 2, a–f: C·a = 1, E·b = −1, B·c = 1.7, C·f = −1 — slides 43–46 (→ ib-ab-*)
- DCG = 514.72, IDCG = 751.45, NDCG = 0.685 — slides 50–53 (→ dcg, ndcg)

## Conventions & ambiguities
- Similarity is the cosine of **user-mean-centered** ratings computed **only over co-rated entries**, for both user-based and item-based CF. This reproduces every value in the similarity tables on slides 5, 9, 18 and 41 except one (see errata). Pearson over all items, or raw cosine, does not.
- No overlap or a zero-norm vector gives similarity 0 (row D on slide 5 is all zeros because D's centered ratings are all 0; HP3/TW on slide 18 have no common rater).
- Neighbours: among the peers (items) that rated (were rated by) the target, take the top-k by similarity, then use **only those with sim > 0**. This is why B·c (k = 3) uses A and C but not D (−0.72), and why C·HP2, the HP3 column and SW3 stay blank (slides 22, 24–26, 33–36).
- The denominator is Σ sim over the used neighbours (all positive, so Σ|sim| gives the same value).
- Predictions are in centered space. The slides stop there; the final rating is ŝ + μᵤ (e.g. B·c = 1.2 + 4.8 = 6.0). The module teaches both.
- DCG uses gain 2^rel − 1 and discount log₂(i + 1). IDCG takes the best k items of **all** rated items (the ideal list [A, F, C, E, B] leaves out D).
- Tie-breaking among neighbours with equal similarity is by row/column order. It never changes a lecture number because ties only occur among non-positive similarities.

## Errata
- slide 53: "NDCG = DCG / NDCG" should read DCG / **IDCG** (the numbers 514.72 / 751.45 are DCG / IDCG).
- slides 11–12: the formula uses 0.87 for sim(C, A), but the similarity table says 0.89. With 0.89 the prediction is 1.35 instead of 1.34; both round to 1.3.
- slides 18–37: sim(TW, SW1) is printed as −0.73. Co-rated mean-centered cosine gives −0.80 (co-raters A and C: TW = (5/3, −5/3), SW1 = (−7/3, 1/3)). −0.73 equals sim(A, C) from the user-based table, so it was probably copied. No prediction changes because the value is negative.
- slides 29–37: B's predicted TW is shown as 0.7, but slide 27 computes (1)(1/3)/1 = 0.3.

## Beyond the slides
- Significance weighting (shrink similarities computed from few co-rated items) — in the one-overlap-trap scene and the `significance` section; standard fix in the literature.
- Adding the mean back (ŝ + μᵤ) is taught explicitly even though the slides leave it implicit.
- Barkada case study, hold-out NDCG evaluation, Spark notes in the Application tab.

## Skill map
- mean-centering: μᵤ and s = r − μᵤ
- similarity: cosine over co-rated centered ratings
- neighbors: top-k then sim > 0
- ubcf-predict: user-based prediction and adding the mean back
- ibcf-similarity: adjusted cosine between items
- ibcf-predict: item-based prediction
- dcg: discounted cumulative gain
- ndcg: IDCG and NDCG
- sparsity-pitfalls: small overlaps, blanks, cold start

## Revision 1.1 — solve-along (2026-09-30)
- Every similarity is solved on a worksheet (`simSheet`): co-rated entries side by side, products, squares, the three sums, then dot / (‖u‖·‖v‖). `simWalk` does this for every pair: HP users (6, slide 5), a–f users (10, slide 9), HP items (21, slide 18), a–f items (15, slide 41). Pairs are visited in lower-triangle order (row label after column label), as the slides' tables are laid out.
- Numbers are shown the way the slides show them: thirds as fractions on the HP matrix (10/3, −32/9, √(74/9)), decimals on the a–f matrix (5.5, 1.2, 6.2).
- `centerWalk` computes every mean and every centered value (15 steps for HP: 4 means + 11 ratings; 31 for a–f). `predictWalk` solves every prediction the slides show: B·c, C·a, C·f, E·b (user-based, k = 3), all 17 HP blanks in the slides' column order (item-based, k = 2; 10 stay blank), and C·a, E·b, B·c, C·f (item-based, a–f). `dcgWalk` adds the DCG and IDCG terms one at a time.
- Math & Code: the Python is now plain loops so the trace can step through every line and iteration (numpy versions are kept as an extra tab for mean-centering). Superseded by 1.2.

## Revision 1.2 — numpy Math & Code, terms defined at first use (2026-09-30)
- Math & Code code is numpy throughout. Similarities are computed for all pairs at once: blanks are zero-filled (`np.nan_to_num`), so `Z @ Z.T` (or `Z.T @ Z` for items) is the co-rated dot product, and `(Z**2) @ M.T` with the 0/1 rating mask M gives each side's squared norm over the co-rated entries only. `np.where` sets 0 where a norm is 0. Neighbours use `np.flatnonzero`, a stable `argsort` of −sim (the lecture's row-order tie-break) and boolean indexing. Predictions are `w @ s / w.sum()`. DCG is vectorized (`2.0 ** rel - 1`, `np.log2(np.arange(1, k + 1) + 1)`), IDCG uses `np.sort(all_rel)[::-1]`, and significance weights use `M @ M.T` for every overlap.
- The numpy code was run on both lecture matrices and reproduces every similarity table (slides 5, 9, 18, 41, with the TW/SW1 erratum), every prediction (4 user-based, 17 + 4 item-based, the same 10 HP blanks), DCG 514.72, IDCG 751.45 and NDCG 0.685.
- Each trace takes one step per line and shows the array that line produces (mask, zero-filled matrix, dot, squares, masked sums of squares, norms, denominators, similarities), plus detail steps that expand one entry (e.g. dot[A, B] term by term, ss[A, B] and ss[B, A] with the mask factors, the broadcast of the means). New examples np-*-trace check the traces against the slides.
- Intuition: terms are defined where they first appear. The ranking scene introduces DCG word by word (gain 2^rel − 1 with rel = true rating, discount log₂(i + 1), cumulative sum), then IDCG, then NDCG = DCG / IDCG, before the learner is asked to reach NDCG ≥ 0.95.

## Revision 1.3 — learner review 2026-10-05, guide edition 2
- **Guide 2.** `guide: 2`, five objectives, every glossary term `define`d in one Intuition beat, 6 practice gates (center-numeric, sim-numeric, ub-predict-numeric, isim-numeric, ib-predict-numeric, dcg-numeric) and 2 reflect gates (why drop negative neighbours; why user- and item-based B·c differ), `tryIt` on all nine sections, hints on every numeric, hand-calc and code-fill template.
- **Predicts are real predictions.** `simSheet` and `predictSheet` take `reveal` (0 = inputs only, symbolic formula; 1 = products / used? column; 2 = sums, formula stops before the division; 3 = full). Beats `set` the reveal key; walks never patch it. Means columns (`showRowMeans`), the VectorPlot cosine and the RankList gains are bound to state and switch on after their gates. Readouts that print a gate's answer start hidden.
- **Scene order.** `one-overlap-trap` now follows `only-co-rated`, so the trap is taught before the item-based scenes, where most similarities rest on one co-rater. `taste-twins` has no skills, and `borrowing-opinions` is tagged `neighbors` only, so the Path places the similarity section after `only-co-rated` and the user-based prediction section after `add-the-mean-back`.
- **ŝ vs rating (judgment call).** The lecture's tables report ŝ. The module teaches both: item-based questions ask for ŝ explicitly, user-based ones for the rating explicitly, and flip-it adds a beat turning ŝ(C, HP1) = −5/3 into the rating −5/3 + 11/3 = 2. Exam tips say "give ŝ unless asked for a rating".
- **Notation.** The lecture's $P_u(j)$ is the set of neighbours actually used (top k, sim > 0); the candidates (other raters of j) are now $R_j$. Item-based keeps $N_j(u)$ with a word gloss (the lecture's item-based symbol is not recorded here).
- **"Pearson".** Used for one thing only: centering items by their own (column) mean, which the lecture does not do (quiz feedback, adjusted-cosine glossary note). Docstrings say "centered cosine over co-rated items". RMSE and Pearson were not added as glossary terms (no natural Intuition beat to define them; guide 2 would require one); the Application no longer shows RMSE.
- **Math & Code.** Similarity sections now show the per-pair co-rated code (`sim(S, u, v)`, `item_sim(S, i, j)`) traced by `sim()`; the whole-matrix numpy versions moved to `extraCode`. `simCode` is kept for the `np-*-trace` examples. The pitfall now says a length over **all** of a user's ratings is wrong (`np.linalg.norm` on the co-rated slice is right, as in `code-sim`).
- **Quiz generators.** `ubPredictQ` (difficulty ≥ 2) uses k = 3, needs ≥ 2 positive neighbours from ≥ 2 co-rated items each and a negative neighbour inside the top 3, and rejects ratings outside 1–5 (a learner who clips is never marked wrong). The "use every top-k neighbour" misconception comes in two forms, each computed separately for ŝ, the rating and the denominator and keyed with `for:` (audit nb-cf/logic.js:1044): the **signed** form (`wrongSigned*`: Σ sim·s / Σ sim with the negative neighbour's signed similarity in Σ sim, the natural error that the borrowing-opinions reflect describes) and the |sim| form (`wrongAll*`). Both only at difficulty ≥ 2. Draws with |signed Σ sim| < 0.3, or where either form lands within 0.06 of the right ŝ, are redrawn. New `isimQ` (adjusted cosine; misconceptions item-mean centering, norms over all raters, raw cosine), `ubPipelineQ` and `ibPipelineQ` (raw ratings → mean, two similarities, ŝ, rating; level-3 integrative hand-calcs). `ibPipelineQ` builds the target user's row by hand (exactly two other items rated, with different ratings) and checks each item shares ≥ 2 raters with the target before computing any similarity, so it stays well under the 50 ms generator budget; equal similarities (ŝ = 0) are redrawn. `ibPredictQ` at difficulty ≥ 2 needs two positive neighbours sharing ≥ 2 raters with the target. `dcgQ` explanations bracket each term; `dcg-numeric-hard` now asks for the DCG change when the top two items swap. `ndcgQ` adds the "ideal list from the recommended items only" misconception; at difficulty 3 (`ndcg-hand-hard`, transfer) it uses 6 items with relevance 0–5 and k = 4, and the item that belongs first in the ideal list is always missing from the recommended list (misconceptions keyed to `topRel`, `idcg`, `ndcg` and linear gain on `dcg`). New `sigSimQ` (`sig-hand`, level 3): sim(A, B) from raw ratings, then significance weighting with β ∈ {3, 4} and an overlap below β; misconceptions raw cosine, weight divided by the number of items, unshrunk sim. Significance weighting is beyond the lecture and the prompt says so. Level-3 share: 8 of 38 templates (21%, X7).
- **Application.** Faye's decision asks why the predicted *ratings* differ (both flavours give the same order); Carlo was considered but user-based gives an exact tie. The Faye lists and the new Bea·Goyo computation decision derive from the fixed `barkada` dataset, not the editable sheet. The holdout model answer now notes item-based's three-way 5.0 tie (broken alphabetically) and user-based's 0.83 below the scale. Spark `columnSimilarities` on centered data is described as a close cousin of the adjusted cosine (dot over co-raters, lengths over all raters). The intro uses Amazon's 2003 item-to-item CF instead of the doubtful Spotify claim.
- **Cross-module.** `s` is a centered rating here but a factor index in lf-cf; noted in the mean-centering glossary entry.
