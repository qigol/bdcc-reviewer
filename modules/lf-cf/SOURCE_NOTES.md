# Source notes — Latent-factor Collaborative Filtering

## Source
- File: 8-10-lf-cf.pdf | Sessions: 8–10 | Date: 2026-09-18 | Pages: 8 (handout, 2 slides per page; slide n is on page ⌈n/2⌉)

## Concept inventory (lecture order)
1. The rating matrix with missing entries — slide 2
2. Factorization R ≈ U·V with rank d = 2; U starts as all ones — slide 3
3. SSE over observed entries only, written out per item column — slide 4
4. ALS step 1: solve V with U fixed → V = column mean / 2 in both rows — slide 5
5. ALS step 2: solve U with V fixed — slides 6–8 (U row 1 = 1.09884117 …)
6. Coordinate gradient descent: start from U = V = ones (all predictions 2) — slides 9–10
7. Update one entry x = u₁₁: SSE of row 1 is a parabola → x = 2.6 — slide 11
8. Then update y = v₁₁ with x = 2.6 fixed → 1.68 — slides 12–14
9. General closed-form single-entry update — slide 15

## Formulas (verbatim, as TeX)
- Model: `p_{ij} = \sum_{s=1}^{d} u_{is} v_{sj}` — slide 15 (the slide writes v_{js}; we use V as d×n to match slides 3–6)
- SSE: `\text{SSE} = \sum_{(i,j) \text{ observed}} (r_{ij} - p_{ij})^2` — slides 4, 15
- Derivative set to 0: `\sum -2 v_{sj}\left(r_{ij} - u_{is} v_{sj} - \sum_{t \ne s} u_{it} v_{tj}\right) = 0` — slide 15
- Closed form: `u_{is} = \frac{\sum_{j} v_{sj}\left(r_{ij} - \sum_{t \ne s} u_{it} v_{tj}\right)}{\sum_{j} v_{sj}^2}` — slide 15

## Worked examples (exact numbers)
- V after the first ALS half-step (U = ones): [1.75, 1.5, 1.8, 1.6, 1.625] in **both** rows — slide 5 (→ als-v-first, als-v-symmetric)
- U after the next half-step: rows 1.09884117, 0.66802999, 0.79970381, 1.13156101, 1.27784027, identical in both columns — slide 8 (→ als-u-first)
- CGD from U = V = ones: x = u₁₁ = 13/5 = 2.6 — slide 11 (→ cgd-x)
- then y = v₁₁ = 16.4/9.76 = 1.68 — slide 14 (→ cgd-y)
- (derived) SSE with U = V = ones is 75, dropping to 62.2 after the x update — not on slides, used in scenes

## Conventions & ambiguities
- V is d×n (factors × items) as on slides 3–6; entries are written v_{sj}. Slide 15's indices are transposed (v_{js}); same math.
- SSE sums over observed cells only (slide 4 omits the missing (3,1), (3,2), (5,5) terms).
- The ALS least-squares problems starting from U = all ones are rank-deficient: only v₁ⱼ + v₂ⱼ is determined. The slides show the **even split** (each = column mean / 2). That is the minimum-norm least-squares solution, which our logic uses (`sdk.lstsq`). It reproduces slides 5 and 8 to 8 decimals.
- The symmetry persists forever: with identical columns in U, both rows of V stay equal and vice versa, so the rank-2 model behaves as rank 1. This motivates random initialization and regularization (taught as insight/beyond).
- CGD solves each single-entry problem exactly (a parabola's minimum), so SSE never increases.

## Errata
- slide 14: the derivation solves for **y** (v₁₁) but labels the result "x = 1.68". It should read y = 1.68.

## Beyond the slides
- Random initialization (symmetry trap scene) and λ (ridge) regularization in ALS (math-code section `regularization`, Application case).
- Spark MLlib `ALS` in the Application tab; comparison with neighbourhood CF on the barkada matrix using NDCG.

## Skill map
- latent-model: p = Σ u·v, U and V shapes, parameter count
- sse-observed: SSE over observed entries
- als-step: freeze one factor, least squares for the other
- als-symmetry: the all-ones symmetry trap, non-unique minimizer
- cgd-derivation: derivative → closed form (slide 15)
- cgd-update: the worked x = 2.6, y = 1.68 updates
- prediction: filling missing cells, over-fitting
- rank-choice: choosing d, regularization

## Revision 1.1 — solve-along (2026-09-30)
- `sseWalk` counts SSE = 18 + 7 + 6 + 23 + 21 = 75 row by row (squared-error worksheet). `alsDetailWalk` writes out iteration 1: each V column as v₁ⱼ + v₂ⱼ = column mean (then the even split), each U row as u₁ + u₂ = Σ v·r / Σ v² (e.g. 30.225 / 13.753 = 2.1977 → 1.09884117), then summarises iterations 2–3. SSE: 75 → 35.75 → 23.41.
- `cgdSheet` shows the closed-form update as a worksheet (r, rest, r − rest, factor, products, squares; Σ gives num and den): x = 13/5, y = 16.4/9.76.
- Beyond the slides: `cgdSweepWalk` completes one full sweep. It starts with the lecture's two moves (x = u₁₁ = 2.6, y = v₁₁ = 1.68; SSE 75 → 62.2 → 57.68), then updates the other entries of U row by row and of V row by row; SSE ends near 21.1.
- Blank predictions are shown as written dot products (`fillTex`, `fillWalk`).
- Math & Code: loop-based Python traced line by line (`predictOneCode`, `sseCode`, `alsStepVCode`, `alsCode`, `cgdUpdateCode`, `cgdWorkedCode`, `fillCode`, `ridgeCode`).
