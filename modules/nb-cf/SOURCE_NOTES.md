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
- `centerWalk` computes every mean and every centered value (16 steps for HP, 31 for a–f). `predictWalk` solves every prediction the slides show: B·c, C·a, C·f, E·b (user-based, k = 3), all 17 HP blanks in the slides' column order (item-based, k = 2; 10 stay blank), and C·a, E·b, B·c, C·f (item-based, a–f). `dcgWalk` adds the DCG and IDCG terms one at a time.
- Math & Code: the Python is now plain loops so the trace can step through every line and iteration (numpy versions are kept as an extra tab for mean-centering).
