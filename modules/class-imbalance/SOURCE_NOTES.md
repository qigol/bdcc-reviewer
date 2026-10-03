# Source notes — Class Imbalance

## Source
- File: bsdsba2028_-_ml2_session_2_class_imbalance.pdf | Sessions: 2 | Date: 2026-08-14 / 2026-08-18 | Pages: 29
- File: Session_3_Class_Imbalance_Instructor.ipynb (Math + Code notebook) | Session: 3

## Concept inventory (lecture order)
1. The central question — S2 slide 5 — is the model learning the minority, or is the metric rewarding it for ignoring that class?
2. SAGIP dropout model (TALAAN) — slides 7–10 — dropout is rare (1.41%); SAGIP uses recall/precision/F1/AUC, LightGBM `scale_pos_weight`, tunable risk tiers.
3. The lazy model — slide 9 — always predicting the majority on 10,000 learners: 98.59% accuracy, 0% recall, F1 0.
4. SIGLA nutritional status — slides 11–15 — headline macro-F1 looks fine; the row-normalized 5-class confusion matrices show per-class recall from 0.94 (Normal) down to 0.00 (Severely Underweight, marker model).
5. Overall → class-specific → decision-relevant performance — slide 15.
6. A 99:1 world — slides 17–18 — the majority-guesser gets 99% accuracy and 0% minority recall.
7. Synthetic fraud dataset — slides 19–22 — 18 transactions, 4 frauds; predictions; tally into a confusion matrix; accuracy 83.3%, precision 0.67, recall 0.50, F1 0.57.
8. Why imbalance hurts — slide 24 — errors barely move accuracy; the cheapest way to look good is to bet on the majority; standard evaluation hides it; costs depend on the task.
9. Five techniques, intuition — slide 25 — RUS (majority ↓), ROS (minority ↑), SMOTE (synthetic between real minority points), SMOTE-NC (mixed numeric + categorical), ADASYN (more points where the minority is hardest to learn).
10. Notebook: Adult Income, split before touching the data — S3 nb §2–3 — stratified 75/25 split, resample train only, test keeps the real imbalance.
11. Notebook: baseline logistic regression — §4 — accuracy 0.826 but recall 0.506.
12. Notebook: RUS, ROS, SMOTE, SMOTE-NC, ADASYN, one light formula each — techniques 1–5.
13. Notebook: final comparison and "resist the obvious answer" — §5 — recall up, precision down, ROC-AUC/PR-AUC barely move; choose by the decision.

## Formulas (verbatim, as TeX)
- Accuracy: `\frac{TP + TN}{TP + TN + FP + FN}` — slide 22
- Precision: `\frac{TP}{TP + FP}` — slide 22
- Recall: `\frac{TP}{TP + FN}` — slide 22
- F1: `2 \cdot \frac{P \cdot R}{P + R}` — slide 22
- RUS: `n_{\text{majority}}^{\text{kept}} = n_{\text{minority}}` — nb technique 1
- ROS: `n_{\text{minority}}^{\text{new}} = n_{\text{majority}}` — nb technique 2
- SMOTE: `x_{\text{new}} = x_i + \lambda\,(x_{\text{neighbor}} - x_i),\ \lambda \sim U(0, 1)` — nb technique 3
- SMOTE-NC: interpolate numeric columns; categorical value = most frequent among the point's minority neighbours — nb technique 4
- ADASYN: `r_i = \frac{\Delta_i}{k},\ \hat r_i = \frac{r_i}{\sum_j r_j}`; synthetic count near x_i ∝ r̂_i — nb technique 5

## Worked examples (exact numbers)
- Lazy model, 10,000 learners at 1.41% — slide 9 — 141 dropouts / 9,859 non-dropouts → accuracy 98.59%, recall 0, F1 0 (→ lazy-sagip)
- 99:1 world — slide 18 — accuracy 99%, minority recall 0% (→ lazy-99-1)
- Fraud confusion matrix — slides 20–21 — TP 2, FN 2, FP 1, TN 13 (→ fraud-tally)
- Fraud metrics — slide 22 — accuracy 83.3%, precision 0.67, recall 0.50, F1 0.57 (→ fraud-metrics, fraud-metrics-code)
- SIGLA per-class recall — slide 14 — Normal 0.91 / 0.94, Underweight 0.27 / 0.29, Severely Underweight 0.11 / 0.00 (→ sigla-anthro, sigla-marker)
- Adult counts — nb §3 — 37,155 vs 11,687, ratio 3.2 : 1, minority 23.9% (→ adult-ratio)
- Adult split — nb §3 — train 36,631, test 12,211, both 23.9% minority (→ adult-split)
- Resampled sizes — nb techniques 1–2 — RUS 17,530 rows, ROS 55,732 rows, both 50% minority (→ adult-rus, adult-ros)
- SMOTE endpoints — nb technique 3 — λ = 0 lands on x_i, λ = 1 on the neighbour (→ smote-lambda-0, smote-lambda-1)
- SMOTE on codes — nb technique 4 — Married = 0, Divorced = 1, λ = 0.5 → 0.5, a category that does not exist (→ smote-codes)
- Final comparison table — nb §5 — shown verbatim as the `results` dataset (logistic regression outputs, not recomputable in the browser)

## Conventions & ambiguities
- Positive class = the minority (Fraud, dropout, >50K). TP means "minority caught". Every metric is for the minority unless named otherwise.
- Confusion matrix layout follows slide 21: rows = actual, columns = predicted, positive first (TP FN / FP TN).
- Precision with no predicted positives is reported as 0 (sklearn `zero_division=0`, as the notebook sets). The lazy model's F1 is therefore 0, as slide 9 says.
- F1 on slide 22 is computed from rounded P = .67; at full precision F1 = 4/7 = 0.5714, which still rounds to 0.57.
- SIGLA matrices are row-normalized, so the diagonal **is** the per-class recall (slide 14 says so). Rows sum to 0.99–1.01 because of rounding; we read the diagonal directly rather than re-dividing, which would turn 0.94 into 0.93.
- Stratified split: test rows = ⌈0.25 × 48,842⌉ = 12,211 and each class contributes round(0.25 × count): 2,922 minority, 9,289 majority. This reproduces RUS = 2 × 8,765 = 17,530 and ROS = 2 × 27,866 = 55,732 exactly.
- Nearest neighbours use Euclidean distance; on the toy map we compare **squared** distances (same ranking, whole numbers).
- SMOTE neighbours are found among the **minority** points only; ADASYN's difficulty Δ_i counts majority points among the k nearest of **all** points (imbalanced-learn behaviour).
- Lessons fix the "random" draws (which majority rows RUS keeps, which neighbour and λ SMOTE picks) so every learner sees the same numbers; real code draws them with `random_state`.

## Errata
- None found. Every number on the slides and in the notebook outputs is internally consistent.

## Beyond the slides
- Toy 15-point map (10 majority, 5 minority) for SMOTE and ADASYN by hand — the notebook only shows 2-D PCA plots of 36,631 rows.
- ADASYN's total budget G = (n_maj − n_min)·β and g_i = round(r̂_i · G) — from the ADASYN paper / imbalanced-learn; the notebook states only "proportional to r̂_i".
- Balanced accuracy (mean of per-class recalls) — used in the notebook's table but never defined there.
- Macro recall of the SIGLA matrices — derived from slide 14, not stated on the slides.
- Expected cost = c_FN · FN + c_FP · FP to choose between methods; FN and FP are reconstructed from the table's rounded precision and recall (approximate).
- The SMOTE-NC distance penalty for categorical mismatches (median std of numeric columns) is mentioned only as a callout.

## Skill map
- accuracy-trap: concepts 1, 3, 6, 8, 11
- confusion-matrix: concept 7 (tally)
- prf1: concept 7 (metrics), balanced accuracy
- per-class: concepts 4, 5
- random-resampling: concepts 9, 12 (RUS, ROS)
- smote: concepts 9, 12 (SMOTE)
- smote-nc: concepts 9, 12 (SMOTE-NC)
- adasyn: concepts 9, 12 (ADASYN)
- choosing: concepts 2, 10, 13
