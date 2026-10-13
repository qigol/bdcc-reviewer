# Source notes — Model Interpretability

## Source
- File: Session_6_Model_Interpretability_Basics_Instructors (Copy, Partial).ipynb | Session: 6 | Global methods
- File: Session_7_Local_Interpretability_Instructor (Full).ipynb | Session: 7 | Local methods
- No slide deck was provided. The Session 10 deck lists "Model interpretability, Sessions 5–9" with the guiding question
  "The model is accurate. Is it accurate for the reasons we think, or has it found a shortcut we would never accept?"

## Concept inventory (lecture order)
1. Why ask why — S6 §0 — we can already predict well; now: why does the model predict what it predicts?
2. Setup — S6 §1 — Breast Cancer Wisconsin, 30 numeric features, target 0 = malignant, **1 = benign**; every interpretation is about P(class 1).
3. Interpret only models worth interpreting — S6 §2 — RandomForest(300, random_state=42): accuracy 0.958, ROC-AUC 0.9949 on 143 test rows.
4. Built-in (impurity) importance — S6 §3 — summed impurity decrease per feature, normalized to 1; no direction; correlated features split credit; favours high-cardinality features; computed on training data.
5. Permutation importance — S6 §4 — shuffle one test column, re-score (ROC-AUC, 10 repeats), drop = importance; in metric units; small bars because AUC ≈ 0.99; negative values are noise; correlated twins can erase each other's credit.
6. Partial dependence — S6 §5 — sweep a feature over a grid, force every row to that value, average P(benign); slopes, flat regions, steps (tree structure), deciles; not causal, an average, ignores correlation (impossible rows).
7. Takeaways — S6 §6 — rank first, then shape; importance has no sign; twins break both rankings in opposite directions; a PDP describes the model, not the world.
8. Global vs local — S7 §2 — "what does the model rely on overall" vs "why this prediction for this case".
9. The case — S7 §2 — least clear-cut correctly predicted malignant test row: row 205, P(benign) 0.3367.
10. SHAP — S7 §3 — contributions that move the prediction from a baseline E[f(x)] and add up exactly to f(x); Shapley (1953) formula; worked 3-feature example; TreeExplainer exact for trees; (rows, features, classes) slicing; waterfall reading; negative ≠ bad; not causal; twins split credit; baseline depends on background data.
11. LIME — S7 §4 — perturb, score with the original model, weight by proximity, fit a weighted linear surrogate; objective ξ(x) = argmin L(f, g, π_x) + Ω(g); tabular LIME discretizes into bins; weights not on SHAP's scale; unstable; not the model.
12. Counterfactuals (DiCE) — S7 §5 — what would have to change for the prediction to flip; Wachter et al. objective; DiCE adds diversity; method="random"; unconstrained vs features_to_vary; valid ≠ plausible ≠ actionable; not causal.
13. Takeaways — S7 §6 — SHAP/LIME explain the prediction we have; DiCE asks for a different one; name the class; explanations disagree; none is causal.

## Formulas (verbatim, as TeX)
- Shapley value: `\phi_j = \sum_{S \subseteq F \setminus \{j\}} \frac{|S|!\,(|F|-|S|-1)!}{|F|!}\,\big[f(S \cup \{j\}) - f(S)\big]` — S7 §3
- LIME: `\xi(x) = \arg\min_{g \in G} \; \mathcal{L}(f, g, \pi_x) + \Omega(g)` — S7 §4
- Counterfactual: `\arg\min_{x'} \; \text{loss}\big(f(x'), y_{\text{target}}\big) + \lambda \, d(x, x')` — S7 §5
- Impurity importance (described in words, S6 §3): sum of impurity reductions per feature across the forest, normalized to sum to 1.

## Worked examples (exact numbers)
- Forest accuracy 0.958, ROC-AUC 0.9949 — S6 §2 / S7 §1 (shown as data; 0.958 = 137/143).
- Built-in importance ranking — S6 §3 — worst perimeter 0.1457, worst area 0.1441, worst concave points 0.1146 …; worst radius 5th (→ builtin-rank, twins-ranks)
- Permutation importance ranking — S6 §4 — worst perimeter 0.004413, worst area 0.004140, worst concave points 0.003690 …; worst radius 29th of 30 (−0.000252); 6 negative values (→ perm-rank, twins-ranks)
- Shapley 3-feature table — S7 §3 — six orderings, φ = (−0.24, +0.03, −0.09), sum −0.30 = prediction 0.30 − baseline 0.60 (→ shapley-phi, shapley-rows, shapley-weights, shapley-walk)
- SHAP additivity for patient 205 — S7 §3 — baseline 0.626, sum −0.2893, baseline + sum = 0.3367 = P(benign) (→ shap-additivity, shap-additivity-code)
- Class flip — S7 §3 output — base values 0.37402191 (class 0) and 0.62597809 (class 1) (→ shap-class-flip)
- LIME weights — S7 §4 — 8 conditions; largest |weight| is "worst texture <= 21.06" (+0.0469); 4 point towards malignant (→ lime-top)
- DiCE constrained counterfactuals — S7 §5 — e.g. cf1 halves worst perimeter (117.7 → 57.4) while worst area stays 989.5 (→ dice-geometry, derived)

## Conventions & ambiguities
- Class 1 = benign everywhere. A negative contribution pushes towards malignant. Explaining class 0 flips every sign (φ₀ = −φ₁, base₀ = 1 − base₁).
- The Shapley game's coalition values v(S) are not printed in the notebook; they are the unique values implied by its ordering table (v(∅) = 0.60, v(A) = 0.35, v(B) = 0.62, v(C) = 0.50, v(AB) = 0.40, v(AC) = 0.28, v(BC) = 0.55, v(ABC) = 0.30). Every one of the 18 table entries reproduces.
- Toy trees follow sklearn: go left when x ≤ threshold; a leaf's P(benign) is the benign fraction of its training rows; `predict` takes the argmax, so P = 0.5 goes to class 0 (malignant).
- Impurity importance of a split = (N_t / N)·(Gini(t) − N_L/N_t·Gini(L) − N_R/N_t·Gini(R)); importances are normalized to sum to 1; a forest averages its trees' normalized importances (sklearn).
- Toy permutation importance uses accuracy (hand-countable) and two fixed permutations ("reverse" and "shift by one"); the notebook uses ROC-AUC and 10 random repeats. The mechanics are identical.
- Toy LIME is 1-D with a Gaussian kernel exp(−d²/σ²) and weighted least squares; real tabular LIME also discretizes features into quartile bins and samples from training statistics.
- Toy counterfactual model: logit = 8 − 0.3·radius − 0.004·area, benign when logit > 0 (strictly; used everywhere, including the quiz). Patient-like start: radius 17.77, area 989.5 (patient 205's worst radius and worst area).
- Notation (v1.2.0): v(S) is the model's answer with only the features in S known; the notebook writes f(S), and the module keeps f(x) for the prediction. An ordering of features is o (σ is only the LIME kernel width; π is the LIME kernel π_x and 3.14159 in area = πr²), and permutation-importance shuffles are indexed k rather than π_k.
- Chart abbreviations (v1.2.1): the full key for logic.js shortName lives in the feature-prefixes glossary long; each importance chart title lists only the short forms its computed top 10 actually shows (the Application chart covers both rankings, since `by` is selectable).
- Patient 205 is dataset row 205 and position 94 (0-based) of the 143-row test set (shap_values[94, :, 1] in the notebook).
- The notebook's per-feature SHAP values for patient 205 (its waterfall bars) are **not recorded here**. The module therefore teaches waterfall reading on the three-feature table (baseline 0.60, bars B +0.03, C −0.09, A −0.24, top 0.30), uses only the baseline, the sum and P(benign) for the patient, and never quotes a per-feature SHAP value for her. The quiz's waterfall item is phrased as a hypothetical. If the bars are added later (row 205, class 1, top 9 + other features), the waterfall scene and the Application one-patient cell should show them.
- shap.plots.waterfall(max_display=10) draws the largest contributions one by one and groups the rest into an "other features" bar (library behaviour); the module says this without giving counts.
- LIME on patient 205, read by sign: worst perimeter (−0.019) and worst area (−0.015) push towards malignant; worst concave points (+0.015) and mean radius (+0.022) push towards benign. So LIME only partly supports a "size and dent features mean malignant" reading; the Application no longer claims SHAP and LIME agree on those features.
- DiCE: the notebook's first run was unconstrained (every feature could vary); its second allowed only the four features in features_to_vary (the rows in dice.yaml). method="random"; DiCE also aims for diversity among the counterfactuals. All eight second-run rows fail the geometry check (ratio more than 0.25 from the original 1.06); cf5 is 0.68.
- Feature prefixes (dataset documentation, not the notebook): each of 10 measurements is computed over the cell nuclei in a scan as mean, standard error ("error") and "worst" (mean of the three largest values).
- Quartile bins: tabular LIME's default discretizer (discretize_continuous=True, quartile) cuts each feature at its training quartiles, which is why its conditions are ranges.
- High-cardinality bias of impurity importance (concept 4) is taught as: many distinct values offer many split points, so trees can fit training noise with them; built-in importance credits that, permutation importance on test data does not.
- Toy LIME in the Math & Code live example uses seven copies (δ = −3..3) so the kernel width changes the slope (σ 0.5 → −0.2263, σ 2 → −0.1948, σ 3 → −0.1837); with three evenly spaced copies and symmetric weights σ cancels (−0.2016 for every σ), which the earlier version wrongly presented as "shrink σ and the slope approaches the model's". The scene's "too narrow is unstable" beat uses the total kernel weight (about 1.04 at σ 0.5, 4.81 at σ 3) as the stand-in for "few effective copies", since the toy has no sampling noise.

## Errata
- None in the numbers. Note only that the Session 7 file's title says "Students' Copy" while the filename says Instructor (Full); content is complete.

## Beyond the slides
- All toy datasets and models (ten tumours, two depth-2 trees, 1-D LIME, linear counterfactual model) — the notebooks' forest cannot run in the browser.
- The impurity-decrease formula (the notebook describes it in words only).
- The geometry check on DiCE rows (radius implied by perimeter vs by area) — makes the notebook's "no such tumour exists" measurable.
- The closed-form one-feature counterfactual for a linear score.
- Judgment call: the 1-D weighted-least-squares arithmetic (lime-surrogate) and the derivation of the Shapley factorial weights (shapley-formula) go beyond the notebook. Both sections are mostly lecture content (the objective and the formula are verbatim), so instead of a section-level beyondSlides flag the over-taught step's narration says it goes beyond the notebook.
- The waterfall reading on the three-feature table, and the loan-model transfer items in the quiz (waterfall, twins, counterfactuals, high-cardinality ID column, flat PDP).
- The plain-words readings of the LIME objective (G, L, π_x, Ω, arg min) and the Wachter counterfactual objective (loss, d, λ).

## Skill map
- global-local: concepts 1, 8, 13
- impurity-importance: concept 4
- permutation-importance: concept 5
- correlation-trap: concepts 4–5 (twins), 10 (SHAP splits credit), 12 (DiCE breaks geometry)
- pdp: concept 6
- shapley: concept 10 (Shapley values, the three-feature table)
- shap-reading: concept 10 (baseline + contributions, waterfall reading, (rows, features, classes) slicing, class flip, TreeExplainer)
- lime: concept 11
- counterfactuals: concept 12
- honest-reading: concepts 2, 3, 6, 7, 10, 13
