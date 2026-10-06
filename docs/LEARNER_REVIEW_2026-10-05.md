# Qdigo learner review (2026-10-05)

This is a learner-perspective review of all 11 lesson modules. Each module was worked through in the order a student meets it: the Path objectives, then every Intuition scene beat by beat (each gate answered *before* reading its answer), every Math & Code / Math & Journal section and its `tryIt`, the Application case, a sample of quiz templates with their generators, and the glossary. Every module was then judged on eight points:

1. Plain language
2. Sequencing and scaffolding
3. Quality of the interactions
4. Consistency
5. Correctness
6. Coverage against the lecture (`SOURCE_NOTES.md`)
7. Motivation and transfer
8. The quiz bank

Doubtful numbers were recomputed against each module's `logic.js` in scratch scripts. **No repo files were changed.**

This report is a companion to [AUDIT_2026-10-05.md](AUDIT_2026-10-05.md). Findings already in that audit are cited by ID (G1, C2, T7…) and not repeated. Everything below is new, or explains how an audit item feels to a student.

> **Limitation:** modules were reviewed from their source files and the renderer code (`Gate.tsx`, `IntuitionTab.tsx`, `ApplicationTab.tsx`, `Question.tsx`, `quiz.ts`, `guided.ts`), not by clicking through the running site. Claims about what is "on screen" come from reading which widgets a beat shows and what values they display.

---

## Summary

**Content accuracy is excellent.** Every lecture number in every module reproduces, the errata are handled openly, and the count-along walks (one step per row, loop iteration, or posting) are a real strength. The weaknesses are in the *learning loop*, and most of them repeat across modules:

| # | Cross-cutting problem | Modules | Impact |
|---|---|---|---|
| X1 | **The correct option is listed first in 100 of 118 lesson multiple-choice questions** (predict gates, Application decisions). Lesson options are never shuffled (`Gate.tsx:58`, `ApplicationTab.tsx:128`), although quiz MCQs are (`quiz.ts:141`). | All guide-2 modules, worst in MANACC (abc 10/10, abm 11/11, cost-flows 8/8, job-order 14/14, process-costing 12/12), time-series 16/17, interpretability 11/12, class-imbalance 10/13 | Learners discover "click the top option" within two scenes. |
| X2 | **Predict gates whose answer is already on screen.** A beat's `show`/`set` take effect when the beat opens, so worksheets, Readouts and Formulas display the result while the gate asks for it. | Every module. Counts: nb-cf 18/23, cost-flows ~14/27, interpretability ~11/18, abm 9/10 numeric | "Predict before we reveal" becomes copying. Predict attempts are also recorded toward mastery (`IntuitionTab.tsx:183`), so **mastery is inflated**. |
| X3 | **Percent answers are rejected.** A predict asking "in %" or "as a percent" parses `98.59%` as 0.9859 and marks it wrong (`Gate.tsx:46`). Modules also disagree on whether percentages are entered as 18.67 or 0.187. | class-imbalance, job-order, abm (MCE), cost-flows | Correct answers are marked wrong, so learners stop trusting the grader. |
| X4 | **The three BDCC modules (fim, nb-cf, lf-cf) are still guide edition 1.** They have no `objectives`, no practice or reflect gates, no `define:` cards, no `tryIt`, and no quiz hints. | fim, nb-cf, lf-cf | The learner watches about 10 scenes per module and never solves a fresh problem alone before the Quiz. The Path makes no promises. |
| X5 | **Path order puts Math sections before the scenes that teach them.** Placement comes from scene `skills` (`guided.ts:35-43`), so a section tagged with a broad skill can land too early. | fim, lf-cf, job-order, interpretability, time-series, abm | Formal notation and later concepts arrive before the intuition that explains them. |
| X6 | **Basic vocabulary is assumed.** In MANACC, direct materials, direct labour, overhead, debit/credit, WIP/FG/COGS and "material" are used before (or without) a definition, and job-order, the first MANACC module, has no prerequisites. In ML/BDCC, correlation, regression, superset, prefix and "one-step" are never defined. | job-order, cost-flows, abc, process-costing; fim, lf-cf, interpretability, time-series | This breaks guide §7.6 ("the learner starts from zero"). |
| X7 | **The quiz bank has no top end.** The level-3 share is 3–15% against the guide's 20% target, and the hard items rarely integrate several steps. Several "transfer" items reuse the lesson's own cases. | All (abm has 0 level-3, abc 1, cost-flows 1, interpretability 1) | Exam-style multi-step problems (a full year of books, a two-department chain, FP-growth by hand, item-based CF by hand) are never practised. |
| X8 | **The Application hands over every number.** Decisions become recognition rather than transfer, and some show the answer in the prompt or on stage. | process-costing, job-order, fim, cost-flows, abc | The case study doesn't test whether the learner can do the work. |
| X9 | **Errata callouts arrive before or during the first computation** and sometimes give away the gate. | job-order, time-series, fim, abm | Extra cognitive load at the worst moment. |
| X10 | **Learner-facing text cites slides** ("slide 13", "Example 10", "Session 5") that a self-learner may not have, and that sometimes disagree with SOURCE_NOTES. | most MANACC modules, fim, abc | Confusing references. |
| X11 | **MANACC cross-module drift.** Account titles differ between modules (and the journal grader string-matches them). The allocation basis contradicts itself (audit T7). The five-step report in process-costing and the three-part report in cost-flows aren't bridged. "Value-added share" and "MCE" aren't linked. Example numbers are reused. cost-flows doesn't say it is a review. | job-order, process-costing, cost-flows, abc, abm | Learners can't tell which convention the exam wants. |

### Things a module teaches that are wrong

These are the highest-priority content fixes, because a careful learner would come away with an incorrect idea.

| Module | What it teaches | Why it's wrong |
|---|---|---|
| process-costing | "A reconciliation gap means re-check Step 1 first" (gate, order quiz, Application, pitfall) | Step 5 equals Step 3 by construction when the same EU are used in Steps 4–5. A unit-count error **cannot** produce a gap. The cause is Step 3–5 arithmetic, costing ending WIP at the combined rate, inconsistent EU, or rounding. |
| lf-cf | "Random initialization **and regularization** fix the symmetry trap" (scene callout, examTip, rubric, quiz) | From an all-ones start, ridge also gives the even split (the module's own math-code admits this), and the ridge objective is invariant under rotation. Only random init breaks the tie. |
| class-imbalance | PR-AUC is an alias of ROC-AUC, with "0.5 = random" | PR-AUC is a different metric. Its random baseline is the minority share (0.239 here). |
| class-imbalance | "Near ratio 2, RUS wins"; gate "find a ratio where RUS is cheapest" | RUS wins only at slider stop 2.45 (window 2.417–2.492). At 2.0, ROS wins. |
| class-imbalance | Application: "above 0.35 wastes visits and misses a dropout" | At 0.40 the slider shows 7 flagged, 3 caught and higher precision. The slider disproves the answer key. |
| interpretability | LIME Math & Code: "shrink σ and the slope approaches the model's" | With three symmetric perturbations the slope is −0.2016 for **every** σ. The slider visibly does nothing. |
| interpretability | Application: "SHAP and LIME agree that size and dent features push towards malignant" | No SHAP values are ever shown, and the on-screen LIME table has two of those features pushing towards benign. |
| time-series | Lag-features scene: regression and naive MAE of 1.080 / 0.600 shown right after 4.527 / 1.900 | No mention that the first pair is one-step and the second multi-step. The learner concludes regression is ~9× better than ARIMA. |
| time-series | "One difference was enough, stop" next to "a slowly fading ACF means difference again" | The differenced ACF at lags 12/24/36 (0.916/0.884/0.864) fades slowly, so the two rules contradict each other unless seasonal differencing is explained. |
| fim | The Apriori-principle scene prunes to 1 three-itemset; the next scene counts 7 (including one "pruned") | The two scenes use different pruning rules, and the explanation appears only after the learner has answered. |
| abm | NVA list = moving, waiting, inspecting, **storing**; the quiz marks **scheduling** as NVA ("slide 26's four") | A learner who follows the lesson fails the quiz item. |
| job-order | S6 reflect's model answer: "most of its time in B… little labor" | Job 105 has 41% of its labour in B against 21% plant-wide, and B's overhead is 429% of labour cost against the 180% plantwide rate. The real reason is different. |
| nb-cf | Spark `columnSimilarities` on centered data "gives the lecture's adjusted cosine" | Spark's norms run over all raters, which is exactly the mistake the module's own pitfall warns against. |

### New grading bugs (not in the audit)

| Where | Bug | Fix |
|---|---|---|
| `abm/quiz.yaml` `pva-match`, `cost-flows/quiz.yaml` `wa-fifo-match` | Two right-hand cards have **identical labels**. `checkMatch` grades by index (`quiz.ts:368`), and the cards can't be told apart, so a correct answer is often marked wrong. (Verified; these are the only two match templates in the repo with duplicate labels.) | Engine: in `checkMatch`, compare `pairs[a][1] === pairs[i][1]`. Content: make the labels unique. |
| `abm` `mce-numeric`, `velocity-numeric` | Tolerances of 0.1 / 0.01 with no rounding instruction. 76% and 84% of the generated answers are non-integers, so 28 or 34.8 is marked wrong. | State the decimals, or loosen the tolerance. |
| `class-imbalance` `drawConfusion` | F1 ≈ (P+R)/2 within 0.01 in 27–40% of seeds, and balanced ≈ plain accuracy in 8–24%. The engine then drops the misconception, so the warned-against method is graded correct. | Reject draws where the gap is < 0.03. |
| `class-imbalance` F1 predict gate | Tolerance 0.01 accepts 0.58, which is the plain average. | Use `value 0.5714, tol 0.005`. |
| `nb-cf` `ub-predict-numeric` | About 10% of answers fall outside 1–5. The lesson taught clipping, so a learner who clips is marked wrong. | Say "do not clip", or reject the draw. |
| `process-costing` `flow-numeric` | Template difficulty is 1, so the generator's beginning-WIP branch (difficulty ≥ 2) never runs. | Add a difficulty-2 variant. |
| `process-costing` Portland weighted-average predict | The narration says "about ₱15.10", but 40,000 × 15.10 falls outside the tolerance of 5. | State 4 decimals, or use a relative tolerance. |
| `cost-flows` Application income cell | If "Allocating" is still selected from the previous cell, the "closed NI" question shows ₱650,000, which is one of the distractors. | Pin that cell to `method: close`. |
| `cost-flows` generator misconceptions | `fifo-transfer-numeric` and `abc-rate-numeric` get misconceptions for the wrong quantity. This is the same pattern as audit §3, but cost-flows isn't listed there. | Key misconceptions by answer var. |
| `nb-cf` / `time-series` code-fill | Correct code is rejected: `a.dot(b)`, `np.sum(a*b)`, `> 0.0`, `(2**rel)-1`, `48` for `len(test)`. | Extend the `accept` lists. |
| `lf-cf` quiz `symmetry-fixes` | Grades "regularization" as a fix for the symmetry trap (see above). | Answer: random init only. |

### Module scorecard

| Module | Course | Edition | Learner verdict | Top fix |
|---|---|---|---|---|
| fim | BDCC | 1 | Excellent count-along, but mostly watching | Guide 2 upgrade, Path order, Apriori contradiction |
| nb-cf | BDCC | 1 | Thorough, but 18/23 predicts are giveaways | Hide answers; item-similarity practice |
| lf-cf | BDCC | 1 | Careful arithmetic; teaches a wrong fix for the symmetry trap | Fix the regularization claim; unify v-notation |
| job-order | MANACC | 2 | Strong walks; concepts out of order | Teach WIP→FG→COGS and the FOH T-account before year-end |
| process-costing | MANACC | 2 | Faithful; wrong reconciliation lesson; FIFO Step 5 never built | Fix reconciliation; FIFO walk |
| cost-flows | MANACC | 2 | Correct numbers but unclear purpose; core skill skipped in one click | Frame as a review; teach Reeder entry by entry |
| abc | MANACC | 2 | Clear story; vocabulary assumed; answers on stage | Hide answers; define overhead/POHR/setup |
| abm | MANACC | 2 | Good cases; taught≠tested; two grading traps | Grading fixes; teach what's quizzed |
| class-imbalance | ML2 | 2 | Strong and well paced; a few self-contradicting interactions | Cost-ratio gate; PR-AUC; F1 grading |
| interpretability | ML2 | 2 | Strong toy data; SHAP scene doesn't deliver | Real waterfall; LIME live example |
| time-series | ML2 | 2 | Strong first half; contradictions in the second | One-step vs multi-step; differencing story; PACF |

### Content statistics

| Module | Scenes | Beats | Narration words/scene | Gates (predict/practice/reflect/when) | Math sections / tryIt | Quiz templates / with hints |
|---|---|---|---|---|---|---|
| fim | 10 | 70 | 153 | 23 / 0 / 0 / 7 | 9 / 0 | 34 / 0 |
| nb-cf | 10 | 68 | 189 | 23 / 0 / 0 / 6 | 9 / 0 | 31 / 0 |
| lf-cf | 9 | 48 | 145 | 12 / 0 / 0 / 5 | 8 / 0 | 30 / 0 |
| job-order | 9 | 64 | 133 | 33 / 8 / 5 / 5 | 9 / 9 | 32 / 27 |
| process-costing | 9 | 51 | 94 | 29 / 9 / 5 / 4 | 8 / 8 | 29 / 24 |
| cost-flows | 8 | 56 | 111 | 29 / 8 / 8 / 6 | 11 / 11 | 36 / 31 |
| abc | 6 | 33 | 76 | 15 / 6 / 6 / 1 | 10 / 10 | 29 / 24 |
| abm | 6 | 34 | 79 | 18 / 6 / 6 / 2 | 9 / 9 | 32 / 23 |
| class-imbalance | 9 | 71 | 212 | 26 / 9 / 3 / 9 | 10 / 10 | 41 / 35 |
| interpretability | 9 | 60 | 166 | 20 / 6 / 3 / 8 | 9 / 9 | 35 / 28 |
| time-series | 10 | 72 | 162 | 24 / 5 / 2 / 10 | 10 / 10 | 37 / 35 |

The MANACC modules, especially abc and abm, have about half as much narration per scene as the ML modules (76–79 vs 150–210 words). Their reviewers repeatedly flagged thin scenes, numbers given as facts rather than built, and missing bridges.

### Recommended order of work

1. **Platform fixes (one change each, every module benefits):**
   - shuffle lesson-gate and Application options deterministically (X1);
   - accept `v` and `v×100` when a predict question says "percent" (X3);
   - compare match labels instead of indices in `checkMatch`;
   - optionally, add a lint for gates whose answer value is printed by a widget already visible on that beat (X2), and a lint for math sections placed before the scene that defines their terms (X5).
2. **The "teaches something wrong" table above.**
3. **The new grading bugs above,** plus audit G1–G3 and C1–C4.
4. **Per module, hide predict answers until after the gate (X2).** This is mostly moving `show:` one beat later, or adding `upTo` reveal params to worksheet functions.
5. **Upgrade fim, nb-cf and lf-cf to guide edition 2 (X4).**
6. **MANACC structure:**
   - put job-order's cost flow before its year-end scenes;
   - frame cost-flows as a review;
   - add the basic-vocabulary beats;
   - align account titles and report formats across modules.
7. **Quiz bank top end:** level-3 integrative and transfer templates in every module (X7), and make Application cells compute-before-reveal (X8).

---

# Per-module reviews

Each section gives the learner verdict, strengths, walkthrough notes, an issue table (High = blocks understanding or teaches something wrong; Med = causes confusion or wasted effort; Low = polish), coverage gaps against the lecture, and the top five improvements. File references are relative to `modules/<id>/`.


## BDCC: Big Data & Cloud Computing

### Frequent Itemset Mining & Association Rules (`fim`)

**Learner verdict:** The numbers are right and the count-along walks are excellent. A patient learner can reproduce every slide number: 63 brute-force counts, 24 Apriori candidates, 18 FP-growth tables, 16 candidate rules and 13 lifts. As a first-time learner, though, I mostly watched, then clicked "predict" after the answer was already on screen. I never solved anything on my own before the Quiz. Key words (minsup, superset, prefix, minconf) appear before anyone explains them. The Path also sends me to the formal Math sections before the scenes that teach them. One real contradiction, between the Apriori-principle scene and the lecture's Apriori run, would confuse anyone paying attention.

**Strengths:**
- **The milk trap is a real "aha".** Confidence 1 but lift 1 is set up in scene 1 ("remember that, it will trick us later", `intuition.yaml:59`) and pays off in scene 10. The Application and the explain-back repeat it with prepaid load.
- **Support is counted exactly.** The ✓/✗ tally `0+1+1+1+0 = 3`, the "at least two items with support 2" gate, and the "adding an item can only lose baskets" beat set up anti-monotonicity before it gets a name.
- **FP-growth is concrete.** It is shown as "every support is a row count of a small table" (`:626`) and tied to slide 41's "parallelizable". That is much easier than an FP-tree.
- **Math & Code matches the lecture.** The traces follow slide 19's scheme and slide 51's "bigger antecedents first". The pitfalls target real mistakes.
- **The Application is realistic and decision-shaped.** Bundle vs placement vs ignore, plus a co-occurrence ≠ causation caveat. All of its numbers check out against `sarisari`.
- **Generators carry misconceptions** for almost every numeric item: any-vs-all, ÷|D|, reversed direction, RelSup(A) instead of RelSup(B), > vs ≥.

**Walkthrough notes:**
- **Path / manifest:** there are no `objectives` and no `guide: 2`. Path order comes from scene `skills` (`packages/schema/src/guided.ts:35-43`), so:
  - "Absolute and relative support" (⊆, Python loop) lands before "Counting togetherness".
  - "Frequent itemsets and minsup" lands before "Setting the bar".
  - "Apriori (as taught)" lands between the principle scene and the run scene.
- **whats-in-a-basket:** a nice drag-in opener, but it never says *why* a store mines receipts. "Database" first appears in the takeaway, and D is then used unexplained in the next formula.
- **counting-togetherness:** strong. The symbols ⊆, ∈, # and |D| are never read aloud in words.
- **lecture-support-table:** "minsup" and "pass" are used, but nothing ever defines minsup in narration.
- **the-bar:**
  - The predict "how many frequent at minsup 2?" comes after `set: {minsup: 2}` has coloured the lattice.
  - The DropBins says "sort by hand, without the colours", but the coloured lattice with its numbers stays on stage, and 4 of the 6 chips were never counted before.
  - At minsup 1 the readout says 25, but only 24 nodes are visible (maxLevel 3).
- **combinatorial-explosion:**
  - "How many of 63 are zero?" means counting 38 nodes by eye. It's busywork, and its explanation is audit T2.
  - "Switch to a log scale" is narrated as the learner's action, but the beat does it, and "log scale" is never explained.
- **apriori-principle:**
  - The core question depends on "superset", which is never defined. The module has no `define:` cards at all.
  - {bread, butter} is an odd example, since butter alone is infrequent.
  - The scene ends with "1 surviving 3-itemset" (the classic prune), but the next scene counts 7 three-item candidates, including one I'd just "pruned".
- **apriori-run:**
  - The slide-19 item order isn't explained.
  - The predicts for 7 and 11 come after the full run has played.
  - "24 counts" vs the 22 printed on slide 19 is never reconciled.
- **fp-growth-filter:**
  - "Drop bread plus every item before it" comes with no *why*.
  - $D_{\{bread\}}$, "prefix" and "FP" are unexplained, and the Tree widget is never introduced.
  - The predict for 18 comes after the walk.
  - The slide-25 erratum is shown after the walk that contains it.
- **itemsets-to-rules:**
  - P(B|A) is never read in words.
  - "Now flip it: yogurt→milk" is narrated while the stage still shows milk→yogurt, and the next gate was just answered by the narration.
  - The dropdown offers rules from infrequent itemsets.
  - Sup(I) and minconf are undefined.
  - "A 2/5 numerator" is wrong wording.
- **milk-trap:**
  - Strong scene.
  - bread→butter's lift of 2.5 is praised even though it rests on one basket and fails minsup. Then eggs–yogurt (1.11) is called "the only real association".
  - "Fooled us seven times" overclaims.
- **Math & Code:**
  - No `tryIt` anywhere.
  - Notation is never read in words: `\tbinom{I}{k}`, C_k/L_k, `{x ≤ i}`, ∖, ∀, ⇒.
  - I means "all items" in one section and "one frequent itemset" in another, and k changes meaning between adjacent lines.
- **Application:**
  - "At least 4.5 of 30 baskets".
  - The decisions are guessable: only the correct option mentions lift.
  - I never compute anything myself.
  - Lucky Me→load (1.15) is called "not a reason", while the Intuition calls 1.11 "real".
- **Quiz:** 34 templates with a good difficulty spread (44/41/15%) but zero `hints`. Nothing on relative minsup or a full FP-growth enumeration.

**Issues:**

| # | Sev | Where | Problem | Suggested fix |
|---|---|---|---|---|
| 1 | High | manifest.yaml; all files | Edition-1 module: no objectives, no `define` cards, no practice or reflect gates, no `tryIt`, no quiz hints. I watch 10 scenes and never solve a support, confidence or lift alone until the Quiz. | Add `guide: 2` plus 4–5 objectives. Add practice gates (`support-abs` after :128, `fp-projected` after :608, `conf-numeric` after :705, `lift-numeric` after :822, `apriori-candidates` after :525), reflect gates ("Why can a rule with confidence 1 be useless?"), and `tryIt` on every section. |
| 2 | High | intuition.yaml:5, :153, :401 + guided.ts:35-43 | Path order puts the formal support, minsup and Apriori-code sections before the scenes that teach them. | Scene 1 → `skills: []`; scene 3 → `[support]`; scene 6 → `[frequent-itemset]` (keep `apriori` on scene 7). |
| 3 | High | intuition.yaml:456-462 vs :534-539, :509, :541 | The principle scene prunes every superset of {bread, eggs}, leaving 1 three-itemset. The next scene's lecture Apriori counts 7, including {bread, milk, eggs}. The explanation arrives only after I've answered. | Move `show: [note]` to apriori-run's first beat. Reword: "Classic Apriori could skip these. The lecture's version only drops infrequent *single* items, so it still counts some." |
| 4 | High | intuition.yaml:432-442, :610, :722, :199; glossary | Superset, prefix, minconf and minsup are never defined, and no term has a `define:` beat. | Add glossary terms `superset`, `prefix`, `lattice` and `base-rate`, and `define` every term at first use. E.g. "A **superset** of {bread, butter} is any itemset that contains both, plus possibly more." |
| 5 | Med | intuition.yaml:152, :199 | minsup is used before definition, and the goal cites slide numbers. | "**minsup** (minimum support) is the bar: an itemset is **frequent** if its support is at least minsup." |
| 6 | Med | intuition.yaml:285, :375, :537, :546, :622 | Predicts are asked after the answer is on screen (coloured lattice, finished walk, filled tree). | Ask before the reveal. Replace the 38-zeros count with "Before playing: will most of the 63 be zero?". |
| 7 | Med | intuition.yaml:288-294 | "Sort by hand, without the colours" while the coloured lattice is on stage, and 4 of the 6 chips were never counted. | `hide: [lat]` and show the TransactionTable instead. |
| 8 | Med | intuition.yaml:822, :849; :659-664 | bread→butter (lift 2.5, from 1 basket, fails minsup) is presented as strong. The dropdown offers rules from infrequent itemsets with no warning. | "But {bread, butter} is in only 1 basket, below minsup, so this rule is never generated. A big lift on tiny support is noise." Mark infrequent rules "(not frequent)". |
| 9 | Med | intuition.yaml:849 vs application.yaml:232,237; quiz.yaml:563,569 | Lift 1.11 is called "real", but lift 1.15 is "no real connection". | Teach one stance: "just above 1 is positive but weak; on 5 or 30 baskets it could be chance." |
| 10 | Med | intuition.yaml:539-541; examples.yaml:161 | "24 counts" vs the 22 on slide 19 leaves the learner thinking they miscounted. | Callout: "Slide 19 stops at {milk, yogurt, cheese}; the scheme also counts two more (both 0): 24, or 22 as printed." |
| 11 | Med | intuition.yaml:596 | Dropping bread and every earlier item has no reason given. | "Itemsets containing an earlier item are found under that earlier prefix; dropping them means each itemset is counted exactly once." |
| 12 | Med | intuition.yaml:567, :600, :610 | The Tree widget, $D_{\{bread\}}$, "prefix" and "FP" are never introduced. | Expand to "FP-growth (Frequent-Pattern growth)". Gloss $D_{\{bread\}}$ as "D restricted to bread". Add a beat that introduces the tree. |
| 13 | Med | intuition.yaml:96, :420, :694; math-code.yaml:171, :222, :249, :342 | Symbols are never read in words (§7.6). | Gloss each one at first use. Replace `\tbinom{I}{k}` with "every k-item subset of I". |
| 14 | Med | math-code.yaml:171/243 vs :496/515; :518-519 | I and k change meaning between sections. | Use $\mathcal{I}$ for all items. Write "an itemset with m items gives $2^m-2$ rules". |
| 15 | Med | intuition.yaml:420, :669, :715 vs :96-98 | "Sup" switches between AbsSup and RelSup. | "Sup means the count; for confidence \|D\| cancels; lift needs RelSup(B)." |
| 16 | Med | intuition.yaml:63-65 | No motivation for why anyone mines baskets. | Add a beat on bundles, shelf layout and "frequently bought together". |
| 17 | Med | intuition.yaml:705-713 | The narration says yogurt→milk while the stage shows milk→yogurt, and the next gate was just answered. | Set the stage to match. Ask for "a *different* rule with confidence 1" (butter→bread leads into #8). |
| 18 | Med | application.yaml:25-170 | Every number is computed for me, so there's no transfer. | Add a cell: "Compute lift(sardinas → itlog)" (2.0 at support 0.10), then "frequent at 15%?". |
| 19 | Med | quiz.yaml | No template has hints. | Add 1–3 hints per numeric/hand-calc template: nudge → method → first step. |
| 20 | Med | quiz.yaml | Missing items: relative minsup, lecture-scheme Apriori counts, a full FP-growth enumeration, lift symmetry. | Add generators for each. |
| 21 | Low | intuition.yaml:512, :534; math-code.yaml:250 | Three different item orders; I wondered whether order matters in a set. | "Order inside a set doesn't matter. Apriori needs *some* fixed order; we use slide 19's." |
| 22 | Low | intuition.yaml:241, :253 | The readout says 25 but only 24 nodes are visible. | `maxLevel: 4`. |
| 23 | Low | intuition.yaml:391 | "Switch to log scale" is done by the beat, not the learner, and is unexplained. | Explain the 1, 10, 100… axis. |
| 24 | Low | intuition.yaml:734 | "a 2/5 numerator" | "2/5 = 0.4 each". |
| 25 | Low | intuition.yaml:849 | "Fooled us seven times": two of the seven had confidence 0.6. | "five times". |
| 26 | Low | intuition.yaml:541 | "The saving grows exponentially" overclaims. | "On real data with many rare items the saving is usually huge." |
| 27 | Low | application.yaml:41 | "4.5 of 30 baskets" | Round up: "at least 5 (15% × 30 = 4.5, rounded up)". |
| 28 | Low | application.yaml:126-152 | Decisions are guessable and the distractors are weak. | Make the distractors cite numbers too. |
| 29 | Low | logic.js:1093; glossary.yaml:127 | "A makes B more likely" reads as causal. | "Baskets with A have B more often than average." |
| 30 | Low | quiz.yaml:321-333 | milk-trap always has the same correct option text, so it becomes rote. | Vary it with a numeric lift or near-universal items. |
| 31 | Low | quiz.yaml:560-571 | act-on-rule reuses the Application's numbers, which tests recall. | Use a fresh store (e.g. a pharmacy). |
| 32 | Low | quiz.yaml:385 | The hint teaches the classic prune while the module stresses the lecture's version. | Reword it. |
| 33 | Low | intuition.yaml:585, :627 | The slide-25 erratum appears after the walk. | Show it with the player. |
| 34 | Low | intuition.yaml:513-519, :546 | Repeats facts answered scenes earlier ("11 frequent" asked a third time). | Ask for new information (e.g. "how many level-1 counts?"). |

Audit items that also hurt learning: **T2**, **T3**, **T4**, **T8** (broken lessonRef). The `define:` lint is the root cause of #4.

**Coverage gaps vs lecture:**
- Relative minsup (slides 12–13) is shown once and never practised.
- Slide 19's 22-vs-24 count is never reconciled.
- FP-growth by hand (slides 21–40) is only watched. Nothing asks for a full enumeration, which is the most exam-likely gap.
- The slide 41 comparison (63 counts vs 24 candidates vs 18 tables) is never shown side by side in a lesson.
- "Association pattern mining" and "antimonotonicity" never appear in narration.
- Over-taught: the 63-step brute-force walk and the 38-zeros count.

**Top 5 improvements:**
1. Upgrade to guide 2: objectives, `define:` beats, at least 5 practice gates, reflect gates, `tryIt` on every section, and quiz hints.
2. Fix the Path order via scene `skills`, and define minsup/frequent in plain words.
3. Reconcile the Apriori principle scene with the lecture's Apriori run (callout first, 22-vs-24 explained).
4. Make the lift story consistent: support caveats, one meaning of "weak positive", no causal wording.
5. Make predicts genuine (ask before revealing) and make notation readable (gloss every symbol, one symbol per meaning).

---

### Neighborhood-based Collaborative Filtering (`nb-cf`)

**Learner verdict:** The content is accurate and very thorough. Every lecture number is rebuilt on stage, and the errata are handled honestly. As a learning experience, though, it is mostly watching. In **18 of 23 predict gates** the answer is already on screen when the question appears. The module also has no practice or reflect gates, no `tryIt`, no quiz hints and no Path objectives, because it is still guide edition 1. Adjusted-cosine item similarity is taught but never tested by computation. It is easy to finish this module able to read the lecture's tables but not produce them.

**Strengths:**
- **The count-along is faithful.** It covers 6 + 10 user pairs, 21 + 15 item pairs, 4 user-based and 17 + 4 item-based predictions, and the DCG/IDCG terms. Every narrated number re-checks against `logic.js` (sim(C,A) = −0.73, sim(TW,SW1) = −0.80, B·c 1.214 → 6.01, IDCG 751.45).
- **Errata are explained, not silently fixed:** 0.87 vs 0.89, −0.73 vs −0.80, B·TW 0.7 vs 0.3, and the DCG/NDCG erratum.
- **There are good "aha" moments:**
  - D's zero vector.
  - "Blanks are not zeros".
  - Vector length cancels in cosine.
  - C·f = 0.86 falls below the scale, which motivates clipping.
  - The one-overlap trap, shown with a live β slider.
- **Adding the mean back (ŝ + μ) is taught explicitly**, even though the slides leave it out.
- **The Application asks for real transfer decisions:** why the two flavours differ, whether 4 hidden ratings are enough evidence, and item cold start.
- **Quiz misconceptions target real errors:** raw cosine, item-mean centering, forgetting μ, DCG off-by-one, linear gain.

**Walkthrough notes:**
- **Path:** there are no objectives and no `guide: 2`.
- **taste-twins:** the opening predict is guessable, and its Readout shows 1.00 already. The "1.5" option is impossible for a cosine.
- **harsh-vs-generous:**
  - `showRowMeans` displays μ_B while a gate asks for it.
  - The narration says "4 means and 12 subtractions … all 16 steps", but HP has 11 ratings, so the player stops at 15.
- **only-co-rated:** the worksheet's Σ row and the Formula ending "= −0.73" are visible from beat 1. All three predicts can be read off the stage.
- **similarity-matrix:**
  - μ_B, the dot product and sim are all visible during their gates.
  - The "most similar pair" question is a near-tie (B&C 0.94, A&C 0.89, D&E 0.87), and its explanation fits A&C too.
- **borrowing-opinions:** the `used?` column and the "neighbours used" Readout give the answers away. Nothing explains why negative neighbours are dropped.
- **add-the-mean-back:**
  - The Readout shows 6.01 during the 6.01 predict.
  - Two near-identical "check" beats follow, and one of them gives away C·f = 0.86.
- **flip-it:**
  - The matrix is transposed and then silently transposed back.
  - All three predicts are visible.
  - "Any single shared rater gives ±1" is not flagged as a problem, although almost every HP item similarity is the one-overlap trap, which is taught three scenes later.
  - The goal promises 17 predictions; only 7 are made.
  - Item-based predictions are never turned back into ratings.
- **item-based-ab:** everything is visible. A nice B·c comparison (1.69 item-based vs 1.21 user-based) has no prompt asking why.
- **one-overlap-trap:** the Readout answers its predict, β is never named, and the scene arrives too late to help in flip-it.
- **judging-a-ranking:**
  - The narration says to play the IDCG while `isheet` is hidden.
  - "@5" is never explained.
  - The scene has 11 beats, which is above the limit of 10.
- **Math & Code:**
  - No section has a `tryIt`.
  - The derivations teach numpy masking (`sq @ M.T`, ⊘, keepdims) more than CF.
  - "Try TW and SW1 on the HP data" is impossible because the section only has `ab5x6`.
  - Static text contradicts the live controls.
- **Application:**
  - Faye's two lists give the *same* order, yet the decision asks "why can they disagree?".
  - The holdout "win" comes from a three-way 5.0 tie broken alphabetically.
  - The user-based holdout predicts 0.83, below the 1–5 scale.
  - RMSE is never defined.
  - The Spark note is inaccurate.
- **Quiz:**
  - No templates have hints.
  - No template asks for computing an item–item similarity.
  - In 63% of `ib-predict-numeric` instances only one neighbour is used, and in 39% its similarity is exactly 1 from a single co-rater.
  - Only 2 of 31 templates are difficulty 3.

**Issues:**

| # | Sev | Where | Problem | Suggested fix |
|---|---|---|---|---|
| 1 | High | intuition.yaml:55-60, 93/129, 178-183+201/208/215, 248/283, 295+298/305, 350-365+395/404, 454-464+487, 574+579/588, 601+604, 642-647+681/688, 701+704, 746+761 | 18 of 23 predict gates show their answer at the same moment the question appears, because `show`/`set` are applied when the beat starts and Gate.tsx masks nothing. | On every gated beat, keep result-bearing widgets hidden and reveal them in the next beat. Give simSheet/predictSheet an `upTo`/`hideResult` param. Start Formulas on a step without the result. Make answer-printing Readouts start `hidden: true`. |
| 2 | High | manifest.yaml; intuition.yaml; math-code.yaml; quiz.yaml | Edition 1: no objectives, 0 practice/reflect/`define`, 0 `tryIt`, 0 hints. I never solve anything alone until the Quiz. | Upgrade to guide 2. Add 5 objectives. Add practice gates `center-numeric` (after L151), `sim-numeric` (L228), `ub-predict-numeric` (L414), `ib-predict-numeric` (L613), `dcg-numeric` (L866). Add reflect gates (#14, #19). Add `tryIt` to every section and 2–3 hints per numeric template. |
| 3 | High | quiz.yaml:173-203, 484-497; logic.js ibPredictQ | Item–item similarity is tested only by MCQs. `ib-predict-numeric` is often trivial: 317 of 500 seeds are a single shown value, and 197 of 500 rest on sim = 1 from one co-rater. | Add `isim-numeric`/`isim-hand` with an `isimQ` generator (misconceptions: item-mean centering, norms over all raters). Require ≥ 2 used neighbours and overlap ≥ 2 at difficulty ≥ 2. Add `ib-predict-hand` mirroring slides 20–46. |
| 4 | Med | intuition.yaml:143, 147 | "12 subtractions … 16 steps", but the player stops at 15. | "11 subtractions" and "15 steps". Fix SOURCE_NOTES too. |
| 5 | Med | math-code.yaml:151, 469; quiz.yaml:187; application.yaml:189 | "Pearson" means three different things and is never defined. | In docstrings call it "centered cosine over co-rated items". Keep "item-mean centering = Pearson" only in quiz feedback. Correct the surprise note. |
| 6 | Med | flip-it, item-based-ab; math-code.yaml:576-577, 650; quiz.yaml:157-171 vs 109-124 | The user-based quiz demands the rating (ŝ + μ), but the item-based quiz marks the rating *wrong*, and the item-based code returns the rating. | Add a flip-it beat: "ĥr = ŝ + μ_C = −5/3 + 11/3 = 2 (slide stops at −1.7)". Add an exam tip: "slides report ŝ; give ŝ unless asked for a rating". Make the two prompts parallel. |
| 7 | Med | application.yaml:89-100 | Both lists give the same order, then the decision asks "why do they disagree?". | Use Carlo (user-based FourSis ≈ KitaKita 2.6/2.6; item-based KitaKita 1.6 > FourSis 1.4), or reword the question. |
| 8 | Med | application.yaml:186-188 | It says Spark `columnSimilarities` on centered data gives "the lecture's adjusted cosine", but its norms run over all raters, which is the very mistake math-code warns against. | "…a close cousin: the dot is over co-raters, but the norms use all raters." |
| 9 | Med | application.yaml:101-132 | The item-based "win" rests on a three-way tie at 5.0; user-based predicts 0.83; RMSE is undefined. | Note the tie and clipping. Define RMSE in one line, or drop it. |
| 10 | Med | math-code.yaml:462 | "Try TW and SW1 on the HP data", but there is no HP data in this section. | Add `hp4x7` with a toggle, or point to flip-it. |
| 11 | Med | math-code.yaml:228, 247, 327, 547 | The lecture's P_u(j) means "the neighbours used"; here P_u(j) means all candidates. | Keep the lecture's meaning. Call the candidates R_j. Add a note: "Slides: P_u(j)". |
| 12 | Med | scene order; intuition.yaml:581, 228 | The one-overlap trap is taught after the item-based scene, where nearly every similarity is the trap. | Move `one-overlap-trap` right after `only-co-rated`. Reference it in flip-it. |
| 13 | Med | intuition.yaml:308-314 | "Most similar pair" is a near-tie, so it's a coin flip. | Ask "most *opposite*" (C&D −1.00) instead, or change the options. |
| 14 | Med | intuition.yaml:398, 325; math-code.yaml:226 | Negatives are dropped "because the lecture does", never *why*. | Reflect gate: "Why not use D's opinion flipped?" Model answer: opposite taste on some movies doesn't reliably predict the opposite on this one, and negative weights can shrink the denominator to 0 or flip its sign. |
| 15 | Med | math-code.yaml:110-220, 433-540 | The tab teaches numpy masking more than CF. The pitfall says `np.linalg.norm` is wrong, but the quiz's `code-sim` uses it correctly on the co-rated slice. | Make the per-pair co-rated version the main code; move the whole-matrix version to `extraCode`. Reword the pitfall to "norm over *all* ratings is wrong". |
| 16 | Med | quiz.yaml:116-117 | About 10% of `ub-predict` ratings fall outside 1–5. The lesson taught clipping, so a learner who clips is marked wrong. | Say "(do not clip)" in the prompt, or reject out-of-range draws. |
| 17 | Med | quiz.yaml:271-284 | The order item treats DCG-before-IDCG as the only valid order. | Use a strictly ordered chain. |
| 18 | Med | intuition.yaml:800, 853-862 | "Play the IDCG" while its worksheet is hidden. | `show: [isheet]` at L853. |
| 19 | Med | intuition.yaml:715 | B·c 1.21 vs 1.69 is mentioned with no prompt to think about it. | Reflect: "Why do the two flavours differ?" |
| 20 | Low | logic.js dcgQ terms | The explanation renders as false equations ("7 + … = 19.56"). | Bracket each term. |
| 21 | Low | intuition.yaml:498-507 | Duplicate check beats, and the text gives away C·f before the gate. | Merge them, and reveal C·f after the gate. |
| 22 | Low | intuition.yaml:567-576, 512 | The silent flip-back, and "17 predictions" when 7 are made. | Narrate the flip-back and fix the goal. |
| 23 | Low | math-code/intuition symbols | I_u, ∩, U_i, r̂, β and "@5" are never put in words. | Add half-sentence glosses. |
| 24 | Low | scene goals | Goals are slide lookups rather than questions, and "centered" is used before it's defined. | Rewrite them as curiosity questions. |
| 25 | Low | glossary.yaml | Missing basics: vector, dot product, norm, relevance, k, weighted average, RMSE, Pearson. The DCG short is a formula, and `neighborhood` covers users only. | Add the entries and write a plain DCG short. |
| 26 | Low | math-code.yaml:144, 888 | Static text contradicts the live controls. | Interpolate the values or say "at the default…". |
| 27 | Low | quiz.yaml:334, 353, 370 | Correct code is rejected (`a.dot(b)`, `np.sum(a*b)`, `> 0.0`, `(2**rel)-1`). | Extend the accept lists. |
| 28 | Low | quiz.yaml difficulty | Only 6% of templates are level 3, and the two DCG templates are near-duplicates. | Add level-3 item-sim and item-based hand-calcs. |
| 29 | Low | quiz.yaml:413-417; application.yaml:93 | Joke distractors make questions guessable. | Use plausible wrong ideas. |
| 30 | Low | application.yaml:2-3 | "Spotify's early playlists were neighbourhood CF" is doubtful. | Use Amazon item-to-item (2003) instead. |
| 31 | Low | application.yaml:133-150 | Rating every film the same gives no recommendations and no explanation. | "Rate at least three films differently." |

Audit items that also hurt learning: **nb-cf/logic.js:1044** `wrongAllNeighbors` (the module's most important misconception never fires correctly), **G1** (`(14/3)` parsed as negative), the 18 glossary terms that are never `define`d, and the meaning of `s` differing between nb-cf and lf-cf on the same data.

**Coverage gaps vs lecture:**
- Item–item adjusted-cosine computation (slides 18, 41) has no practice at all. It is the most exam-likely gap.
- There is no item-based prediction hand-calc, although slides 20–46 make up most of the deck.
- The P_u(j) notation differs from the slides.
- Under-taught: why only positive neighbours are used; what to report as the final item-based answer; the effect of k.
- Over-taught: numpy masking mechanics. RMSE and DIMSUM are mentioned without explanation.

**Top 5 improvements:**
1. Hide answers during predict gates, which restores about 18 real predictions.
2. Upgrade to guide 2: objectives, `define` cards, practice and reflect gates, `tryIt`, hints.
3. Add item-based computation to the quiz (`isim-numeric`, `isim-hand`, `ib-predict-hand`) and require ≥ 2 neighbours.
4. Settle the item-based "final answer" (ŝ vs rating) and align notation with the slides' P_u(j).
5. Fix the factual slips: 15 steps, "Pearson", the Spark claim, the Faye prompt, the holdout tie/RMSE, the impossible HP exercise, and the one-overlap trap's position.

---

### Latent-factor Collaborative Filtering (`lf-cf`)

**Learner verdict:** The lecture's arithmetic is rebuilt carefully:
- SSE = 75 row by row
- the slide 5 V-step and the slide 8 U-row
- x = 2.6 and y = 1.68
- a full 20-update sweep

Every one of these plays out on stage, and every number checks. Three things let a first-time learner down:
- **It teaches something false about the symmetry trap.** It says regularization fixes the trap. It doesn't, and the module's own Math & Code admits this.
- **It is still guide edition 1.** There are no objectives, no practice or reflect gates, no `tryIt` and no quiz hints.
- **V's notation flips between scenes.** The same symbol, v₁₂, names two different cells.

Several gates also give the answer away or pass on arrival.

**Strengths:**
- **Excellent count-along.** `sseWalk` (18+7+6+23+21 = 75), `alsDetailWalk` (every column mean / 2, every U row as Σvr/Σv²) and the `cgdSheet` worksheet reproduce slides 5, 8, 11 and 14 by hand. These were verified, as were the SSE sequence 75 → 35.75 → 23.41 → 22.70 → … → 22.62 and the random-start SSE of 1.85.
- **The constant-c warm-up quietly sets up "the best single number is the mean".** That idea returns in the V-step and in x = mean(r − 1).
- **The symmetry-trap scene is a real "aha"** built on the lecture's own oddity: identical columns on slide 8.
- **The slide-14 erratum (x → y) is flagged** in the scene, in Math & Code and in a quiz item.
- **The Application has strong transfer.** It includes d = 4, λ = 0 over-fitting (56 parameters for 37 ratings), fold-in as one U-step, and an honest NDCG comparison with nb-cf.
- **The numpy is clean.** Writing the U-step as the V-step on transposes is elegant, and the `lstsq` vs `solve` pitfall is well chosen.

**Walkthrough notes:**
- **Path:** no objectives.
- **hidden-tastes:** the predict's answer (4) is already in the Readout and on the formula's second line. The drawn angle is never mentioned.
- **matrix-is-a-product:** V's cells are written v̄₁₁, v̄₂₁… along the f1 row, so v̄₁₂ means item 1, factor 2 here. Two scenes later the index order flips, and the bar is never explained.
- **only-observed-cells:** good pacing. The best constant's SSE (36.8) is never compared with the start (75) or the end (22.6 / 1.85).
- **als-dance:**
  - The predict asks for "the value in each factor" before learning that any pair summing to 3.5 fits. That option isn't offered.
  - The U-step formula appears with no reason and reuses `c`.
  - "Like fitting a regression line" misleads.
- **symmetry-trap:**
  - "Both factors look alike, so they receive the same value" skips the real reason: every split fits equally well, and minimum-norm picks the even one.
  - The `beyond` callout then says regularization "makes it unique".
- **one-knob:** "CGD" is never expanded, and nothing says why it's called gradient descent when there is no step size. `rest` and `f` are undefined.
- **full-sweep:**
  - "The other **8** entries of U … other **8** of V" is wrong: it's 9 + 9, which matches the 20 updates.
  - A gate duplicates one two scenes later.
  - One CGD sweep from all ones (21.1) beats ALS (23.41), and later reaches SSE 1.85. Nothing explains that CGD escapes the symmetry trap.
- **watching-sse-fall:** the gate "until ALS SSE < 2" passes on arrival, because the default is 6 iterations and SSE 1.85.
- **filling-the-blanks:**
  - The readout is pre-coloured `tone: bad`, which gives away the "least trustworthy" gate.
  - The rounded factors shown give 0.485, not 0.47, so a hand check fails.
  - λ and ‖U‖² are never put in words.
- **Math & Code:**
  - No `tryIt` in any section.
  - `R` is never defined in Python, so none of the code runs as written.
  - Path placement puts the first formula ("latent-factor model") and regularization after the symmetry-trap scene.
  - The regularization summary contradicts its own step 4.
- **Application:**
  - At the default settings it shows Migs·Rewind ≈ −0.1, Faye·HLuna ≈ 0.8 and Bea's HLuna ≈ 0.23, with no comment.
  - "Epics vs romances" doesn't fit two of the cluster members.
  - The rubric repeats the regularization-fixes-symmetry error.
- **Quiz:**
  - No hints.
  - `cgdQ` always sets v₁ⱼ = 1, so Σv² is always a count.
  - No U-step generator, and no V-entry update with a non-unit partner (like the lecture's 2.6²).

**Issues:**

| # | Sev | Where | Problem | Suggested fix |
|---|---|---|---|---|
| 1 | High | intuition.yaml:285, 298-305; math-code.yaml:619, 710; application.yaml:228; quiz.yaml:206-213 | It says regularization "makes it unique" and that random init *and* λ "fix" the symmetry trap. False: from all-ones U, ridge also gives the even split (math-code:653 admits this), and the ridge objective is invariant under U→UQ, V→QᵀV. Extends audit T6. | Callout: "λ keeps factors small and makes each ALS step have one answer. It does **not** break the tie; only a random start does." ExamTip: "Symmetry → random init; over-fitting → λ or smaller d." Fix the rubric, and make `symmetry-fixes` answer only [random init]. |
| 2 | High | manifest; intuition; math-code; quiz | Edition 1: no promise on the Path, and I never compute alone before the quiz. | Add `guide: 2` and 4–5 objectives. Add practice gates `sse-hand` (after L175), `als-column-hand` (L240) and `cgd-hand` (L392). Add reflect gates: "Why don't blanks count as 0?" and "Why can't ALS from all ones use the second factor?". Add `tryIt` and hints. |
| 3 | High | intuition.yaml:69-70, 87-91 vs 228, 381; math-code.yaml:98, 184 vs 8, 367 | v̄₁₂ means item 1, factor 2 in scene 2, but factor 1, item 2 in the sweep. The bar is never explained. | Use v_{sj} (factor, item) everywhere and drop the bars. Fix the gate options. Note: "Slide 15 writes v_js; we write v_sj." |
| 4 | Med | intuition.yaml:436 | "Other 8 entries of U … other 8 of V". It's 9 + 9. | Change both to 9. |
| 5 | Med | intuition.yaml:22, 30, 41 | The predict's answer is in the Readout and on the Formula line. | Hide the Readout and start the Formula at step 0. |
| 6 | Med | intuition.yaml:459, 492 | The "ALS SSE below 2" gate passes on arrival. | Start at `sweeps: 1`, and gate on the **CGD** SSE < 2 (needs 6 sweeps). |
| 7 | Med | intuition.yaml:437-443 vs 482-488 | The same monotonicity gate appears twice, with a mismatched lead-in. | Replace one with a numeric predict (e.g. u₁₂ = 0.646). |
| 8 | Med | intuition.yaml:451, 495 | CGD from all ones escapes the trap (21.1, then 1.85), but the text says "ALS takes bigger steps". This looks like a contradiction. | Aha beat: "Changing u₁₁ alone makes U's columns differ at once: one-at-a-time updates break the tie ALS preserves." Add a quiz MCQ. |
| 9 | Med | intuition.yaml:231-234 | The predict asks for "the value in each factor" before learning only the sum is pinned down. | Options: 3.5 each / 1.75 each / **any pair summing to 3.5** / 14. Then show minimum-norm: 12.25 vs 6.125. |
| 10 | Med | intuition.yaml:295 | It doesn't say why the even split is the one chosen. | "Any split fits equally well; the even (minimum-norm) split is chosen, so V's rows come out equal." |
| 11 | Med | intuition.yaml:249 | The U-step formula appears without a reason and reuses `c`. | Rename c → w and explain it as a line through the origin. Add a predict gate on u2 (0.668). |
| 12 | Med | intuition.yaml:358; glossary.yaml:66; quiz.yaml:242, 405 | "CGD" is never expanded, yet the quiz uses "learning rate" and "step size" as distractors. | Explain CGD vs ordinary gradient descent (exact jump vs step size). |
| 13 | Med | intuition.yaml:375, 400, 436, 452 | `rest` and `f` are undefined, and the recipe switches letters. | Define them once and use one letter. |
| 14 | Med | math-code.yaml:4, 615 | Path placement puts the first formula and regularization after the symmetry-trap scene. | latent-model `skills: [latent-model]`; regularization `skills: [rank-choice, prediction]`. |
| 15 | Med | math-code (all code) | `R` is never defined, so nothing runs. | Define `R = np.array([...])  # slide 2` in the first section. |
| 16 | Med | logic.js:827; quiz.yaml:127-181 | v₁ⱼ is always 1, so "hard" isn't harder. | Draw v₁ⱼ ∈ {1, 1.5, 2} at difficulty ≥ 2. Add a `which: 'V'` variant. |
| 17 | Med | quiz.yaml | No ALS U-step template, though slide 8's 1.0988 is an exam staple. | New `alsRowQ` generator, with a forgot-to-halve misconception. |
| 18 | Med | quiz.yaml:163-164 | "SSE after the update": row only or the whole matrix? | Say "SSE of the whole matrix", with a hint. |
| 19 | Med | intuition.yaml:530, 563-566 | The red tone gives away the answer, and "far below" overstates 0.47. | Remove the tone until after the gate. |
| 20 | Med | logic.js fillTex | Rounded factors give 0.485, not the 0.47 shown. | Show 3 decimals. |
| 21 | Med | application.yaml:69-93 | Predictions outside the scale go uncommented. | "Raw dot products can leave 1–5; clip to [1, 5] for display." |
| 22 | Med | intuition.yaml:226; math-code.yaml:181, 200 | "Regression line", "features" and "targets" are undefined. | Explain them as "best weights in a recipe". |
| 23 | Low | intuition.yaml:187 | The best constant's SSE (36.8) is never stated or compared. | Add the comparison with 75 → 22.6 / 1.85. |
| 24 | Low | intuition.yaml:570 | ‖U‖² and λ are not put in words. | Add a plain-words gloss. |
| 25 | Low | intuition.yaml:104, 192, 310 | Goals use undefined terms. | Rewrite them as questions. |
| 26 | Low | intuition.yaml:15 | The angle in the vector plot is unexplained. | Explain it or remove it. |
| 27 | Low | intuition.yaml:495 | "Parallelize per entry" is loose. | "Entries of the same factor for different users don't interact." |
| 28 | Low | application.yaml:36 | "ALS half-steps / 2" axis label. | "iteration (V-step at .5)". |
| 29 | Low | application.yaml:48 | The cluster description doesn't fit its members. | Reword it. |
| 30 | Low | application.yaml:2-3 | Overstated Netflix Prize and YouTube claims. | Soften them. |
| 31 | Low | quiz.yaml:226-229 | One distractor is numerically equivalent to the key. | Replace it with "As the column mean". |
| 32 | Low | quiz.yaml:355-360 | `code-cgd` needs `rest[rated]`, but the lesson taught `rest` already restricted. | Add a hint. |
| 33 | Low | quiz.yaml | Level 3 is 10% of items. | Make `als-row` and a V-entry CGD variant level 3. |
| 34 | Low | glossary.yaml | Missing: dot product, minimum-norm, sweep, fold-in, NDCG, validation set. `rank`'s lessonRef is wrong. | Add the terms and fix the ref. |

Audit items that also hurt learning: **T6**, which #1 extends; the v̄ index order; the `dotQ` distractor collision; the `define:` lint (15 terms); and **G1/G2**.

**Coverage gaps vs lecture:**
- Slides 6–8 (U-step) get one beat and no quiz.
- Slides 12–14 (V-entry with a non-unit partner) are never generated.
- Slide 15's v_js notation is reconciled only in SOURCE_NOTES.
- CGD from all ones escaping the trap is a natural exam question and is missing.
- The minimum-norm split is asserted, not justified.

**Top 5 improvements:**
1. Correct the regularization message everywhere, and re-tag the section so it follows over-fitting.
2. Upgrade to guide 2: objectives, three practice gates, two reflect gates, `tryIt`, hints.
3. Unify notation (v_{sj}, w, `rest`, partner factor).
4. Repair the give-away and auto-pass gates, and add the CGD aha.
5. Close the quiz gaps: a U-step generator, a V-entry CGD variant with non-unit factors, and an unambiguous SSE prompt.

---

## MANACC: Managerial Accounting

### Job-Order Costing (`job-order`)

**Learner verdict:** I could follow every number. The count-along walks (Chiphard, Quezon, Cavite, Job 105, Cabinetry) are excellent, and every lecture figure reproduces. Two things hurt me as a first-time learner.

- **Concepts come in the wrong order.** The year-end overhead scenes (4–5) depend on Work in Process, Finished Goods, COGS and the Factory Overhead account. None of these has been taught by then: the accounts arrive in scene 7, and the Factory Overhead T-account never appears at all.
- **The checks can be gamed.** Every MCQ predict and decision puts the right answer first, and several numeric predicts show the answer on stage.

This is the first MANACC module and it has no prerequisites, so these problems hit a true beginner hardest.

**Strengths:**
- **The count-alongs are real.** `jobSheetWalk` fills the cost sheet one source document at a time (11 steps). `cogmWalk` builds the schedule row by row (9 steps). Every label carries its arithmetic, e.g. "180 × ₱6.50 = ₱1,170".
- **Rates are built before they are named.** The scene 3 predict asks me to compute the rate before "POHR" is named. Then the slider lets me feel the rate rise as budgeted hours fall.
- **The generators target real misconceptions:** pricing all hours at one wage, applying a per-hour rate to labour pesos, markup vs margin, splitting proration equally, putting the unfinished job into COGM.
- **Errata are handled honestly:** Company Y's 100% vs 150%, Marikina's markup vs margin, the rounded 180.4%.
- **The Malolos application is coherent and checks out:** ₱288,600 vs ₱335,400, ₱126,000 underapplied, ₱88,200 COGS share. It has five decisions, a tradeoffs table and an explainBack.
- **The five reflect gates ask real "why" questions.** The best are budgeted vs actual rates, and proration vs closing to COGS.

**Walkthrough notes:**
- **Path:** first MANACC module, no prerequisites. Direct materials, direct labour, debit/credit and "material amount" are never taught. cost-flows, which has these basics, comes later (order 25).
- **S1 job-or-process:**
  - Smooth.
  - The shipyard predict is answered by the definition just given, and three "job-order" answers come in a row.
  - It cites "slide 15", but SOURCE_NOTES says slide 17.
  - "Cost-of-production report" is unexplained.
- **S2 chiphard-sheet:**
  - "Direct" is never explained.
  - The ₱4.50 rate has no source.
  - The markup slider shows 0.40 while the text says 40%.
- **S3 why-a-rate:**
  - Strong scene.
  - DL *cost* as an activity base is never introduced, yet scene 4 uses "150% of DL cost".
  - The EVPI callout uses three unexplained acronyms.
  - DLH appears for the first time inside a Readout label.
- **S4 two-companies:** this is where I got lost.
  - The underapplied ₱6,000, the overapplied ₱8,000 and "Cr Cost of Goods Sold" are all on stage while the scene asks about them.
  - The errata callout appears before Y is computed.
  - "Brings Factory Overhead to zero" assumes a control account I've never seen.
  - COGS hasn't been defined yet.
- **S5 prorate-it:** WIP and FG are undefined. "Material" is never defined. The WIP credit is visible during its predict.
- **S6 two-departments:**
  - Typing `112.5%` is parsed as 1.125 and marked wrong.
  - The 180% plantwide rate comes from nowhere: the ₱17,500 of Dept B labour shows up later, in a side note.
  - The reflect's model answer is vague and partly misleading. Job 105 has 41% of its labour in B against 21% plant-wide, and B's overhead is 429% of its labour cost against a plantwide charge of 180%.
- **S7 follow-the-job:**
  - The player posts to Finished Goods and COGS before those are defined.
  - The Readout says "now sits in: not started".
  - "Gross margin" is undefined.
  - It says "five entries", but slide 61 has six (the purchase is missing).
- **S8 march-jobs:** clean, with a good contrast predict.
- **S9 beyond-the-floor:**
  - Allenby is predicted before the hours→labour, fees→materials mapping is explained.
  - Marikina's 18.7% is visible in the schedule and the errata.
  - Typing "18.7%" is marked wrong.
- **Math & Journal:**
  - The `job-cost-sheet` and `engagement` sections are tagged only `[job-cost-sheet]`, so they land right after S2, before POHR and the accounts.
  - `cost-systems` uses Job 105 before S6.
  - The under-over section is the natural place for a Factory Overhead T-account but has only a schedule.
  - The engagement keyFormula uses an undefined `r`.
- **Application:**
  - The ₱88,200 answer is always visible.
  - Malolos's ₱126,000 (4.8% of overhead) is prorated as material, while Pampanga's ₱225,000 (also 4.8%) is closed as immaterial. With no materiality rule taught, these look contradictory.
  - The learner never computes anything.
  - "Finished in December, delivered in January" appears for the third time.

**Issues:**

| # | Sev | Where | Problem | Suggested fix |
|---|---|---|---|---|
| 1 | High | intuition.yaml:358-367, 413-445 vs 598-620 | Scenes 4–5 close and prorate overhead into COGS, WIP and FG, but those accounts and the cost flow are only defined in scene 7. I memorise "underapplied → debit COGS" without knowing why COGS holds overhead. | Move `follow-the-job` right after `why-a-rate`. Or add a two-beat preview in S4: "Applied overhead rides with each job: into WIP, then FG when done, then COGS when sold." |
| 2 | High | intuition.yaml:358-361, 439; math-code.yaml:160-196 | "Brings Factory Overhead to zero" assumes a control account that is never shown. The entry recording actual overhead never appears anywhere. | Add a Factory Overhead `taccounts` block: debits = actual ₱198,000, credits = applied ₱192,000, balance ₱6,000 Dr, then the closing posting. |
| 3 | High | all option predicts (intuition.yaml:37,53,244,272,355,365,419,436,624,697,749; application.yaml:31,57,99) | All 14 MCQs put the correct answer first, and neither renderer shuffles. By scene 3 I'd learned to pick the first option. | Vary the answer positions and add shuffling (see X1). |
| 4 | High | intuition.yaml:517-518, 764-765; Gate.tsx:46 | A "percent" question rejects `112.5%` and `18.7%` (parsed as 1.125 and 0.187). | Accept both v and v×100 when the question says "percent", or ask for a decimal. |
| 5 | Med | intuition.yaml:336-367 | Three S4 predicts have their answers on stage. | Show `cmp`/`jr` on the beat after each gate. For Y, ask before the switch. |
| 6 | Med | intuition.yaml:343, 761 | Errata callouts appear before the content and give away predicts. | Show them one beat after, prefixed "If you're reading slide 34:". |
| 7 | Med | intuition.yaml:358, 414, 456; quiz; application.yaml:96 | "Material" is undefined and clashes with "direct *materials*". Pampanga and Malolos look contradictory. | Add a `materiality` term ("big enough to change a reader's decision; a judgment"). In the Application: "unlike Pampanga, 30% of applied overhead still sits in WIP and FG." |
| 8 | Med | intuition.yaml:109-123; glossary | DM, DL, OH, DLH and MH are undefined in the first MANACC module. | Add `direct-materials` and `direct-labor` terms, and spell out the abbreviations on first use. |
| 9 | Med | math-code.yaml:47-58, 392-399 | The Path places POHR/WIP content and the whole engagement section after S2. | `job-cost-sheet` skills `[job-cost-sheet, pohr]`; give `engagement` a new `service-jobs` skill introduced in S9. |
| 10 | Med | intuition.yaml:229-233 | DL *cost* as a base isn't introduced, yet "150% of DL cost" follows. | "…or direct labour **cost**, giving a rate like 150% of every labour peso." Add a predict. |
| 11 | Med | intuition.yaml:535, 501; math-code.yaml:278 | The 180% plantwide rate appears from nowhere. | Add a beat: (64,000 + 17,500 = 81,500; 147,000 ÷ 81,500 ≈ 180%), with a numeric predict. |
| 12 | Med | intuition.yaml:558-561 | The reflect's model answer is vague and arguably wrong. | "B's overhead is ₱4.29 per labour peso, but the plantwide rate charges ₱1.80. Job 105 has 41% of its labour in B vs the plant's 21%, so it misses most of B's machine overhead." |
| 13 | Med | intuition.yaml:197-206 | The EVPI callout is jargon and a tangent. | Drop it, or spell it out and mark it as a side note. |
| 14 | Med | logic.js:380-386; quiz flowQ | The purchase entry is missing, and the labour entry is never quizzed. | Add `e0` (purchase), call it "six entries", and include indices 0–5 in `flowQ.pick`. |
| 15 | Med | examples.yaml pampanga-job; math-code.yaml:153 | Pampanga Job #556 (the lecture's end-to-end Ex 11) is only a "Lecture check" row. | Work it as a choice in the POHR section or a beat in S4. |
| 16 | Med | quiz.yaml dept templates; logic.js:722-745 | The `compare-rates` objective is practised only with the rates given. | Add `dept-rates-handcalc` (rates from budgets, plantwide from combined budgets). |
| 17 | Med | quiz difficulty | 2 of 32 templates are level 3, and neither is integrative. | Add a Pampanga-style chain, a Cabinetry month plus closing, and a proration where the direction is inferred. |
| 18 | Med | application.yaml:77-104 | The year-end answer is visible, and nothing is computed. | Hide `ye-pr` until Prorate is chosen. Use computed distractors. |
| 19 | Med | quiz.yaml:171 vs intuition.yaml:765 | Percent format is inconsistent (18.67 vs 0.187). | Use one convention module-wide. |
| 20 | Med | SOURCE_NOTES:73 | Slide 61 credits "Factory Overhead **Applied**", but the module silently uses one account. | Note the equivalence in a pitfall or the glossary. |
| 21 | Low | intuition.yaml:623; quiz.yaml:541; application.yaml:73 | "Finished, not delivered" appears 3×, and "machine hours for an automated line" 4×. | Replace one with a new transfer case. |
| 22 | Low | logic.js:733; quiz.yaml:441 | `ohAWrong` is computed but never attached. | Attach it with feedback on the labour-cost base. |
| 23 | Low | quiz.yaml:131 | "Source document" is misapplied to POHR and the cost sheet. | Reword. |
| 24 | Low | logic.js:689 | Throwaway distractor. | Use a computed misconception. |
| 25 | Low | intuition.yaml:733-741 | Allenby is predicted before the mapping is explained. | Swap the beats. |
| 26 | Low | intuition.yaml:610-620 | FG and COGS are defined after posting to them. | Define them before the player. |
| 27 | Low | intuition.yaml:94; math-code.yaml:68 | The slider shows 0.40, not 40%. | `format: pct`. |
| 28 | Low | logic.js:434 | "Sits in: not started". | "nowhere yet; press play". |
| 29 | Low | math-code.yaml:16 | Uses Job 105 before S6. | Use Chiphard Job 123. |
| 30 | Low | math-code.yaml:342; quiz.yaml:515 | "Credit the previous account" doesn't fit the labour and overhead entries. | "…credit where the cost came from." |
| 31 | Low | math-code.yaml:399; glossary.yaml:126 | Undefined `r`; jargon such as "subsidiary ledger". | Gloss them. |
| 32 | Low | intuition.yaml:641, 389 | Goals use terms defined later. | Rephrase. |

Audit items that also hurt learning: the job-order misconception slips (`logic.js:857`, `quiz.yaml:452`, `:476`, rate hints on `job-total-numeric`, `wrongCogsNoBeg` on cogm), **T7** (contradiction with cost-flows), account-name inconsistency, and **G1** (debit-column parentheses).

**Coverage gaps vs lecture:**
- Slides 64–65 (value chain, strengths and limitations of job-order costing) are absent everywhere, and they are likely exam MCQ material.
- Slide 10 (three approaches): ABC is mentioned only in passing.
- Slides 19–21 (job cost sheets as the WIP subsidiary ledger) appear only in the glossary.
- Slide 30 (DL cost as a base) is missing.
- Slides 46/61 (Factory Overhead mechanics, Factory Overhead Applied) are under-taught.
- Slide 61's purchase entry is missing.
- Slide 67 (Pampanga) is never worked through.
- Slide 53 (₱17,500) is unexplained.
- Slide 55 (when to use departmental rates) appears only in an MCQ.
- Over-taught: the EVPI aside.

**Top 5 improvements:**
1. Fix the concept order: teach WIP → FG → COGS and the Factory Overhead T-account before under/overapplied and proration, and re-tag the math sections.
2. Make the checks real: vary the option order, stop showing answers on stage in S4, S5, S9 and the Application, and show errata after the gate.
3. Fix percent input, and use one convention.
4. Teach the basics in plain words: DM/DL, abbreviations, materiality, DL cost as a base, and where 180% comes from.
5. Deepen the quiz and close the lecture gaps: rate-computation and integrated level-3 templates, the purchase and labour entries, Pampanga #556, and the value chain / strengths and limitations content.

---

### Process Costing (`process-costing`)

**Learner verdict:** The module follows the lecture closely. It keeps one storyline going (Cavite in May, then June, then Portland, Batangas and Aklan), every lecture number reproduces, and the five-step worksheets are well built. Three things weaken it as a learning experience:

1. In five of the nine scenes, the table on stage already shows the answer before I predict.
2. It teaches that a reconciliation gap means "re-check Step 1 first". That is wrong: the reconciliation check mathematically cannot catch a unit-count error.
3. FIFO cost assignment ("cost to finish beginning WIP") is never built in Intuition, yet the quiz asks for it.

**Strengths:**
- **The Cavite thread carries over.** May's ending WIP of 10,000 gallons becomes June's beginning WIP, so I see why beginning WIP exists before weighted-average is even named.
- **The worksheets build in front of me.** `reportSheet` + `reportWalk` fill Steps 1–5 one row at a time, with the arithmetic in each label, for Cavite, Portland and Batangas.
- **FIFO is framed as one subtraction from weighted-average.** The Aklan beats then catch the "0% materials, so nothing is subtracted" trap well.
- **The reflect prompts ask real "why" questions.** For example: why does an ending-WIP gallon carry only ₱2.00?
- **The Application is a coherent two-department chain.** Pressing's ₱832,000 becomes Bottling's transferred-in cost, and the explainBack rubric is strong.
- **The misconception hints are specific.** Examples: `wrongSamePct`, `waEuConv`, `wrongTiPartial`, and "investigated, not plugged".

**Walkthrough notes:**
- **why-average:**
  - The comparison table lists DM/DL/OH and "conversion" before either is defined.
  - "Sort the four manufacturers from slide 13" assumes I have the slides.
  - The conversion predict repeats the narration word for word.
  - The operation-costing gate's answer is "Job-order costing", so it never tests the term itself.
- **count-the-units:** a good, concrete start. A predict about beginning WIP sits in the lost-units beat, and the 9,000-gallon lost-units example is never checked by a gate.
- **partly-done:**
  - The `tbl` schedule is visible from the start with every row computed (2,000; 18,000; 12,000; 13,500).
  - The "make it half converted" `when` gate is busywork.
  - "Evenly" is offered as an option but never explained.
- **five-steps:**
  - The player runs to the end before the scene asks for ending WIP and the reconciliation total.
  - The five step names are never listed first.
  - The practice `report-fill` (difficulty 2) generates beginning WIP labelled "(weighted-average)" before weighted-average is taught.
- **last-months-work:**
  - It opens on June Blending ("blend or keep apart?"), then silently switches to an un-introduced Department A. June is never resolved.
  - 6,100 is visible on the same beat that asks for it.
  - The takeaway "beginning WIP needs no separate treatment" is true only for EU.
- **wa-report:**
  - The narration says "about ₱15.10", but 40,000 × 15.10 = 604,000 is outside the tolerance.
  - The label "40,000 × 15.1046 = ₱604,182" is off by 2.
  - It never tells me that June's bags carried ₱85 each against ≈₱12.74 in July, which is the real reason the methods differ.
- **fifo:**
  - The full `euBoth` rows are visible from beat 1.
  - "500 + 4,000 + 600" appears in passing, and the 500 is never explained.
  - There is no FIFO walk.
  - The ending-WIP options put the peso amounts in the options themselves.
- **next-department:** the strongest scene. Dept 2's own costs and its lack of beginning WIP are never stated, and "TI" is never spelled out.
- **when-it-breaks:**
  - "Work backward cheapest-first" with the answer "Step 1" describes working forwards, and the advice is wrong anyway (issue 2).
  - The Iloilo narration contradicts method-mcq.
- **Math & Journal:**
  - The weighted-average derivation prints an arithmetic contradiction.
  - The FIFO "320" and "39,200" are never explained in words.
  - The Nueva Ecija facts are never stated.
  - A FIFO tryIt sits under the weighted-average section.
- **Application:**
  - Every number is given in the narration, so I never compute anything.
  - The fifo-check prompt states the answer (₱125).
  - It repeats the "Step 1 first" advice.
- **Quiz:**
  - `flow-numeric` is difficulty 1, so its beginning-WIP branch never runs. **Not in the audit.**
  - Only 2 templates are level 3, and both are flawed.

**Issues:**

| # | Sev | Where | Problem | Suggested fix |
|---|---|---|---|---|
| 1 | High | intuition.yaml:147-149, 172-205; 316-345; 424-466; 593-607 | The EU tables are on stage, fully computed, while I'm asked to predict 2,000, 18,000, 12,000, 6,100, 5,000, 5,100, 9,000 and 9,100. | Start the tables `hidden` and `show` them after each predict, or bind the rows to a `revealUpTo` state like `reportSheet`. |
| 2 | High | intuition.yaml:586-592, 628; quiz.yaml:178-190; application.yaml:104-114; math-code.yaml:178; intuition.yaml:287 | **It teaches something false.** Step 5 equals Step 3 by construction whenever the same EU are used in Steps 4 and 5. Verified with logic.js: a miscounted ending WIP gives gap 0, a wrong materials % gives gap 0, and a Portland FIFO wrong count gives gap 0. A gap actually comes from Step 3–5 arithmetic, ending WIP at the combined rate, inconsistent EU, FIFO dropping beginning-WIP cost, or rounding. | Rewrite the gate: "Which error could cause this ₱10,000 gap?" Answer: "Ending WIP costed at the full combined unit cost, or a multiplication slip in Step 5." Explain that a consistently wrong unit count still reconciles, which is why Step 1 has its own check. Reorder `reconcile-order`. If slide 68 prescribes Step 1 first, present that as "the lecture's checklist" with this nuance. |
| 3 | High | intuition.yaml:467-479; math-code.yaml:287-292; quiz.yaml:382-389 | FIFO Step 5 (beginning WIP + cost to finish + started-and-completed) is never built in Intuition. `fifo-handcalc` jumps over it, and its explanation prints the literal text "\text{cost to finish}". | Add a FIFO `reportWalk` on Portland (the steps exist at logic.js:195-213) and a predict for the 320 EU. Add materials-unit-cost and cost-to-finish steps to `fifo-handcalc`, and expose `finishCost`. |
| 4 | High | intuition.yaml:266-287, 394-406 | "What is ending WIP worth?" and "completed cost?" are asked after the Step 5 panel shows them. | Ask before the player, or stop the walk before Step 5. |
| 5 | Med | intuition.yaml:301-329 | The June story is set up and then abandoned, and Department A appears unannounced. | Drop the June panel, or say June's costs aren't given. Introduce Dept A with all its facts. |
| 6 | Med | intuition.yaml:295-298; quiz.yaml:211-228 | The five-steps practice uses beginning WIP and weighted-average before they're taught. | Add a `report-fill-basic` at difficulty 1 with no beginning WIP. |
| 7 | Med | intuition.yaml:401-406 | "About ₱15.10" gives 604,000, which is marked wrong. | Give 4 decimals, or use `relTol: 0.001`. |
| 8 | Med | intuition.yaml:279-287 vs math-code.yaml:223; logic.js:186 | "Must equal **exactly**", but the lecture's own Portland figures are off by ₱2. The label shows a product that's off by 2. | "Exactly, apart from a peso or two of rounding." Fix the label and the derivation. |
| 9 | Med | intuition.yaml:608-616 | Iloilo "apart from the spike" contradicts its own explanation and method-mcq. | "…reflect this quarter's prices without last quarter's cheaper beginning inventory blended in." |
| 10 | Med | intuition.yaml:56-65; glossary.yaml:18-21; quiz.yaml:35-49 | Operation costing is taught non-standardly, and the gate doesn't test it. | Check slide 16. Use the standard definition (materials traced per batch, conversion averaged per operation) and test it with a shoe-batch example. |
| 11 | Med | intuition.yaml:466; quiz.yaml:391-403 | The three-part FIFO EU count is flashed once, then `fifo-qty-fill` requires exactly that layout. | Add a beat explaining the 500 / 4,000 / 600 split, plus a predict. |
| 12 | Med | intuition.yaml:473-479 | The options contain the amounts already in the `cmp` table. | Ask *why* FIFO is lower, before revealing. |
| 13 | Med | intuition.yaml:380-382, 479 | June's ₱85/bag vs July's ≈₱12.74 is never mentioned. | Add one sentence. |
| 14 | Med | quiz.yaml:67-79; logic.js:347, 351 | `flow-numeric` never generates beginning WIP. **Not in the audit.** | Add `flow-numeric-2` at difficulty 2. |
| 15 | Med | intuition.yaml:42; quiz.yaml:159, 190, 434 | Slide references assume I have the slides. | Replace them with lesson references. |
| 16 | Med | glossary; intuition.yaml:107, 126, 280 | WIP, direct materials, factory overhead, FG, lost units, "costs to account for" and "cost to finish" are undefined. | Add the terms and `define` them. |
| 17 | Med | application.yaml:41-53, 86-88 | Every number is given, so the decisions are recognition, not transfer. | Hide the panels. Make "cost per litre" and Bottling's ending WIP (₱55,200) numeric decisions. |
| 18 | Med | application.yaml:54-74 | The prompt states the answer (₱125). | "Switch to FIFO. How much does cost transferred change?" |
| 19 | Med | math-code.yaml:404-425 | The Nueva Ecija facts are never stated. | State them in a step. |
| 20 | Med | quiz.yaml:296-308; logic.js:432 | `wa-qty-fill` blanks the "Physical units" column on an EU row. | Blank only the materials and conversion cells. |
| 21 | Low | intuition.yaml:185-190 | Busywork `when` gate. | Add a follow-up predict (13,000). |
| 22 | Low | intuition.yaml:46-55 | The predict repeats the narration. | Ask a contrast question (glue, supervisor salary). |
| 23 | Low | intuition.yaml:220-266 | No roadmap of the five steps. | List them in scene 2. |
| 24 | Low | intuition.yaml:527-536 | Dept 2's costs are not stated. | State them, and predict ₱35. |
| 25 | Low | logic.js:9 etc. | "TI" is never expanded. | "transferred-in (TI)". |
| 26 | Low | math-code.yaml:278, 289 | 39,200 and 320 are unexplained. | Explain them in words. |
| 27 | Low | math-code.yaml:444 | A FIFO tryIt sits under the weighted-average section. | Move it. |
| 28 | Low | quiz.yaml:482-498 | `ti-numeric`'s only misconception is 0. | Add real misconceptions. |
| 29 | Low | quiz.yaml:79 | The explanation is tautological. | Reword it. |
| 30 | Low | quiz.yaml:437-449, 51-64 | The match labels give the pairs away. | Use plain labels, or an MCQ. |
| 31 | Low | glossary.yaml:9 etc. | "Session 5" and "supplemental notes" are referenced. | Refer to modules instead. |
| 32 | Low | intuition.yaml:2-4, 26 | The title says "bottle", the scene says "gallons". | Fix the wording. |
| 33 | Low | quiz overall | Only 7% of templates are level 3, and both of those are flawed. | Add a two-department chain, FIFO ending WIP and reconciliation-diagnosis templates. |

Audit items that also hurt learning: **C2** (fifo-handcalc unsolvable), the "evenly" option never asked, `wa-eu-numeric` never having beginning WIP, misattached hints, **G1/G2**, and account-name inconsistency.

**Coverage gaps vs lecture:**
- Slide 79 (strengths and limitations): absent.
- Slides 21/41 (unit cost → inventory → COGS → pricing): thin.
- Example 4.5 (slide 42): dropped mid-scene.
- Example 8 (Nueva Ecija): Math only, with no stated facts.
- "Evenly" (slide 33): never taught.
- FIFO cost assignment (slide 58): never counted along, and no FIFO ending-WIP quiz item.
- Lost units: one MCQ only.
- Optional: departmental WIP entries and a full two-department quiz chain.

**Top 5 improvements:**
1. Fix the reconciliation lesson (gate, `reconcile-order`, Application, pitfall), and reconcile "exactly" with the lecture's ₱2 rounding gap.
2. Stop the spoilers: hide the EU tables and put the Step 5 predicts before the player.
3. Build FIFO Step 5 in Intuition: a walk, a cost-to-finish predict, and the three-part EU count. Scaffold `fifo-handcalc` to match.
4. Repair the weighted-average storyline (June / Dept A) and the practice difficulty, so beginning WIP is actually practised.
5. Turn the Application and quiz into transfer: compute before reveal, add level-3 chain items, remove slide references, fix the Iloilo wording.

---

### Cost Flows: Supplemental Notes (`cost-flows`)

**Learner verdict:** The numbers are right. I recomputed every lecture figure and all of them match:
- Reeder (a)–(k), the balances, both dispositions, NI ₱81,000
- Halsey's EU
- the WA and FIFO reports (221,400 / 12,000 and 221,350 / 12,050)
- Sarver's ABC (151.55 / 69.39)
- Mabini (720k vs 680k, NI 660k or 650k)

The Reeder year is a clear thread through the module. As a learning experience, though, it reads like a fast re-run of three other modules, and nothing tells the learner why or when to take it. More than half the predict gates show their answer on stage. The one truly new skill, the full-year journal, plays past in a single click. JIT's "five elements" and the slide 18–19 process-costing flow are never taught, yet the quiz tests them or the objectives promise them.

**Strengths:**
- **One company, one year.** Reeder runs end to end: entries → T-accounts → over/under → disposition → income statement. Math & Journal explains *why* each debit goes where it does ("factory or not? direct or indirect?").
- **Good contrast and "why" moments.** Under- and overapplied appear back to back, the reflect asks about the 12,000-unit WA−FIFO gap, and the materiality reflect weighs close vs allocate.
- **The Application flips the sign.** Mabini is *overapplied* while Reeder was underapplied, so it tests transfer. The "next year's rate" decision and the rubric line "not extra profit; it corrects overstated costs" are good judgement questions.
- **Generators target real errors:** WIP debited with actual overhead, S&A counted as overhead, closing in the wrong direction.
- **The JIT `when` gate is the best interaction.** The learner pushes wait and move time toward ≥ 40% value-added, and the hint does the reasoning.
- **Job 2B47 builds cleanly** from 3 requisitions and 4 tickets.

**Walkthrough notes:**
- **Path:**
  - The title "Supplemental Notes" is a handout label.
  - The summary never says this reviews job-order and process costing.
  - The `classify` objective mixes in regression from Sessions 1–3, which no MANACC module teaches.
- **cost-vocabulary:**
  - The learner sorts into DM/DL/MOH bins before any of them is defined. DM and DL have no glossary entries at all.
  - The prime-cost question comes before prime cost is defined.
  - Regression jargon (regressed, intercept, slope, R²) is unexplained.
  - The `when` gate is already satisfied on arrival (x starts at 3000).
- **documents-to-sheet:**
  - The Parker beats talk about a company that isn't on stage.
  - Parker's ₱8 is per machine hour; seconds later 2B47 uses ₱8 per direct labour hour, and nothing flags the change.
  - Mary's ₱9 and the ₱12 unit cost are visible before their gates.
  - `docs-order` asks about sales and production orders, which the scene never mentions.
- **reeder-year:**
  - Only entries (a)–(c) are narrated. Entries (d)–(k), including the new "150% of DL cost" base, play in one click.
  - The 150% first appears in a reflect's *model answer*.
  - The WIP and FG balances are visible (`showBalance` defaults to true).
  - Debit/credit and the liability and contra accounts are never explained.
- **close-the-year:**
  - The FG share and NI are both visible before their gates.
  - No overapplied example is worked in Intuition.
- **equivalent-units:**
  - There's no bridge from job-order to process costing, and slide 18 is skipped.
  - 181,000 and 160,000 are visible before their gates.
  - The narration states the addends, then asks for their sum.
- **production-report:**
  - An unnamed company appears.
  - Unit costs are shown before their gates.
  - FIFO's 176,000 EU is never derived.
  - The `when` prompt says "replay" but only checks the switch.
- **jit:**
  - Kanban is quizzed before it's defined.
  - The 8 hours is visible in the schedule.
  - The reflect assumes setup reduction, cells and TQC, which were never taught.
- **abc-preview:**
  - ₱45 and ₱51 are visible before their gates.
  - Cost driver and activity rate are defined after I've computed a rate.
  - ₱151.55 can't be computed by hand, because per-product driver usage is never on stage.
- **Math & Journal:**
  - `cost-terms` uses Reeder before Reeder is introduced, and uses *actual* MOH (310k) for product costs, against what scene 3 teaches.
  - `reeder-entries` shows debits only, in abbreviations.
  - `over-under`'s rationale argues against its own method (audit T7).
  - "Five activity rates", but three are shown.
- **Application:**
  - Only the job-order half of the objectives is exercised.
  - Leaving "Allocating" selected makes the "closed NI" question show ₱650,000, which is a listed distractor.
- **Quiz:**
  - 1 of 36 templates is level 3.
  - `jit-multi` tests untaught content.
  - `recon-fill` pre-fills every line amount.

**Issues:**

| # | Sev | Where | Problem | Suggested fix |
|---|---|---|---|---|
| 1 | High | intuition.yaml:157-182, 245-260, 344-365, 423-456, 527-548, 616-623, 675-708 | About 14 of 27 predict gates show their answer on stage (₱9, ₱12, 60,000, 90,000, 1,200, 81,000, 181,000, 160,000, 169,000, ₱0.84, ₱0.842, 8 h, ₱45, ₱51, ₱151.55). | Ask before the reveal. Move `show` to the next beat, limit worksheet reveals with `upTo`, and use `showBalance: false` until after the gate. |
| 2 | High | intuition.yaml:238-244, 264-268 | Nine of 11 entries, including the new 150%-of-DL-cost base, play in one click. This is the module's core new skill. | Split into beats. (d)–(g): "factory share → MOH, office → expense", with a predict (16,000). (h): "₱315,000 OH on ₱210,000 DL pesos = 150%", with a predict (300,000). (i)–(k): narrate COGM and COGS. |
| 3 | High | manifest.yaml:4-9, 22 | Nothing says this reviews job-order (10) and process costing (20), what's new, or when to take it. Scenes 2, 5, 6 and 8 largely repeat other modules. | Rename to "Cost Flows: One Year of Books (Review)". Add "Take after Job-Order and Process Costing; new here: T-accounts, the full (a)–(k) cycle, income statement, 3-part report, JIT." |
| 4 | High | quiz.yaml:504-519; math-code.yaml:480-511; intuition.yaml:563-644 | `jit-multi` asks for slide 27's five elements, but no beat names them. The skill description promises them. | Add a beat listing each element with the waste it removes. |
| 5 | Med | intuition.yaml:56-74; glossary | The learner sorts into DM/DL/MOH before definitions, and DM/DL are never defined. | Add `direct-materials` and `direct-labor` terms, and define them before the sort. |
| 6 | Med | intuition.yaml:66-74 | Prime cost is asked before it is defined. | Swap the beats. |
| 7 | Med | intuition.yaml:7, 85-89 | The `when` gate is satisfied on arrival. | Start `x` at 1000, and predict 50,500 first. |
| 8 | Med | intuition.yaml:80-97; manifest.yaml:25 | Regression jargon; no MANACC module teaches regression; "Quiz 1A" appears. | Add a plain beat on intercept = fixed part, slope = variable part, R². Add glossary terms. |
| 9 | Med | intuition.yaml:131-147, 168-169 | Parker isn't on stage, and the ₱8/MH vs ₱8/DLH change is unflagged. | Put Parker in a Readout. Add a contrast beat on activity bases. |
| 10 | Med | intuition.yaml:190-193; quiz.yaml:100-112 | `docs-order` tests sales and production orders, which are never shown. | Add a beat on sales order → production order. |
| 11 | Med | intuition.yaml:220-237 | Debit/credit and the AP, prepaid and contra accounts are assumed (§7.6). | Add a one-beat debit/credit primer and one-line glosses. |
| 12 | Med | intuition.yaml:380-398 | No bridge from jobs to process costing; slide 18 is skipped. | Opening beat on Halsey's continuous flow, with a "job-order or process?" predict. |
| 13 | Med | intuition.yaml:451-456 | The narration gives the addends, then asks for the sum. | Ask "conversion work on the 15,000 beginning units?" (3,000) instead. |
| 14 | Med | intuition.yaml:543-548 | FIFO's 176,000 appears from nowhere; the gate only checks the switch. | Predict the 1,000 EU to finish, and require the walk to finish. |
| 15 | Med | intuition.yaml:675-708 | Driver usage is never on stage, so ₱151.55 is read off, not computed. | Add a usage table and ask "3,000 × ₱51?" first. |
| 16 | Med | intuition.yaml:683-696 | Activity rate is computed before it is defined. | Define it in the same beat. |
| 17 | Med | intuition.yaml:605-623 | Kanban is quizzed before it is defined, with throwaway distractors. | Define it first, and use plausible distractors. |
| 18 | Med | intuition.yaml:633-639 | The reflect assumes untaught JIT practices. | Fix #4 first. |
| 19 | Med | math-code.yaml:14, 28-30 | Product costs use *actual* MOH, against scene 3's rule; the S&A split is invented. | Use applied overhead (636,000), and show S&A as one line. |
| 20 | Med | math-code.yaml:303-305, 324; application.yaml:136 | (T7) The module takes three positions on the allocation basis. | "Allocation spreads it by ending balances (the notes' basis); Session 5 uses applied overhead, which is more precise." |
| 21 | Med | application.yaml:67-102 | "Allocating" left selected shows NI ₱650,000, a distractor, so a correct reading is marked wrong. | Pin the income cell to `method: close`. |
| 22 | Med | application.yaml | The case covers only the record and close objectives. | Add a process-costing or ABC cell to Mabini. |
| 23 | Med | intuition.yaml:470-561; application.yaml:140 | The *five-step* report (process-costing) vs the *three-part* report here is mentioned only in an Application footnote. | Callout mapping the five steps onto the three parts. |
| 24 | Med | quiz difficulty | 1 of 36 templates is level 3; no full-year item. | Add a level-3 hand-calc on `randomYear`. |
| 25 | Med | quiz.yaml:438-453 | `recon-fill` pre-fills every line amount. | Blank the line amounts too, or switch to FIFO. |
| 26 | Low | quiz.yaml:455-473, 592-607 | Generator misconceptions are for the wrong quantity, so they never fire. Same pattern as other modules. **Not in the audit for cost-flows.** | Key the misconceptions per answer var. |
| 27 | Low | quiz.yaml:141-143 | An irrelevant hint gives entry (h) away. | Use a generic hint. |
| 28 | Low | math-code.yaml:170-191 | Debits only, in abbreviations, which clashes with the grader's exact-title matching. | Show full titles and the credit line. |
| 29 | Low | math-code.yaml:542-545 | "Five rates", three shown. | Add the other two. |
| 30 | Low | glossary vs abm | "Value-added share" vs "MCE". | Cross-reference them. |
| 31 | Low | glossary.yaml:215-219 | `cost-driver` aka "activity" is misleading. | Fix the short. |
| 32 | Low | quiz/intuition | Slide citations. | Replace them with content. |
| 33 | Low | intuition.yaml:235 etc. | Three names for the ₱90,000. | Use one. |
| 34 | Low | math-code.yaml:373, 478 | Trivia exam tip; misleading "same treatment". | Reword. |

Audit items that also hurt learning: **T7**, account-title differences across modules (which matter because the journal grader string-matches), and **G1/G2**.

**Coverage gaps vs lecture:**
- Slides 4/17: there's no RM → WIP → FG → COGS flow picture.
- Slides 18–19: job vs process and departmental WIP are skipped.
- Slide 8: the document flow is quizzed but not taught.
- Slides 27–28: the JIT elements and benefits are absent.
- Slide 30: ABC's three improvements are absent.
- Slide 2: regression is under-taught.
- Over-taught relative to what's new: POHR basics and WA/FIFO EU. Under-taught: the full-year entries.

**Top 5 improvements:**
1. Stop showing predict answers on stage.
2. Teach the Reeder year entry by entry, with a debit/credit primer.
3. Frame the module as a review: rename it, list prerequisites and what's new, and add bridges (3 parts ↔ 5 steps, ending balances ↔ applied-OH allocation, Manufacturing ↔ Factory Overhead).
4. Close the taught-vs-tested gaps: the JIT elements, the document flow, job vs process, and Sarver's driver usage.
5. Strengthen transfer and difficulty: a level-3 full-year generator, a process/ABC cell in Mabini, and a real `recon-fill`.

---

### Activity-Based Costing (`abc`)

**Learner verdict:** The story is clear: a blurry single rate, then five pools at Global Metals, cross-subsidy at Laguna, the cost hierarchy, services and customers, then whether to adopt. The numbers are correct everywhere they were checked, and the Cebu Kitchenware case is a strong transfer task. As a first-time learner, though, most numeric "predict" gates can be answered by reading a table that's already on screen. Every multiple-choice gate in Intuition and Application has the first option correct. The module also assumes Session 5/6 vocabulary it never defines (overhead, POHR, setup, gross margin, "traditional"). Several lecture examples (Tarlac, the registrar, departmental rates/Job 105, automation) never reach the learner in a teachable form.

**Strengths:**
- The opening puzzle ("Why would a simple, popular product lose to competitors…", `intuition.yaml:4`) motivates the topic well. The scene-1 reflect (`intuition.yaml:74-77`) makes the point that the total is the same but the split drives prices.
- The Laguna scene is well sequenced: compute the single-rate cost, flip to ABC, walk the comparison, then run the ₱330,000 cancellation check (`intuition.yaml:217-246`). It handles the slide-36 erratum correctly (₱6.60/bin vs ₱33/container).
- The driver-choice beat ("ABC in name, traditional costing in substance", `intuition.yaml:384-390`) and the Iloilo convergence beat teach judgement, not just arithmetic.
- The Application case is coherent and numerically correct. Checked: rates 40/1,500/300/8,000; ABC overhead 23.80/93.50/510; margins 32.7→37.2%, 44.3→43.8%, 45→30.8%; the bid at ₱370 overhead, ₱1,520 vs ₱1,320, a ₱35,000 loss. The bid decision is real transfer.
- The spectrum section explicitly fixes the slide-44 percentage-base error (`math-code.yaml:253-254`), which protects learners on the exam.
- The generators make clean numbers and enforce useful properties: exactly one losing customer, and rankings that actually flip (`logic.js:463-466`).

**Walkthrough notes:**
- **Scene 1 `blurry-average`**
  - Opens with "Sessions 5 and 6 applied overhead…" (`intuition.yaml:34`). A learner without those sessions has no idea what overhead, applied, or machine hours mean.
  - At `:64-70` I'm asked for the ABC-vs-plantwide gap ("ABC assigns ₱37,750") before ABC has been defined (that's scene 2). The Readout in the same beat already prints "Missed by the single rate ₱24,625" (`:29-31`).
  - "The single rate sees only the 500 machine hours" (`:70`) refers to a number I was never given.
  - The practice MCQ (`warning-mcq`) says "investigate ABC", again before ABC is defined.
- **Scene 2 `global-metals`**
  - The "Activity rates" schedule is visible from beat 1 with its Rate column filled in (`:94-96`). The setup-rate gate (`:131`, 1,000) and the waste-rate gate (`:140`, 5.00) can be read straight off the screen.
  - I'm asked to compute a rate (`:131`) one beat before "activity rate" is defined (`:135`).
  - Beat 4 (`:143-152`) mixes two-stage assignment ("tracing costs to activities rather than departments") with playing the Step 3 walk. The mention of "departments" confused me, because the system I just learned had no departments.
  - The per-tool gate (`:156`) comes right after the walk player finishes, while the sheet already shows "Overhead per tool ₱18.88".
- **Scene 3 `who-subsidizes`**
  - The overhead-per-unit schedule shows ₱45.00 for Custom while the gate asks me to compute 45 (`:183-185` vs `:222`).
  - The "Full cost per unit" column (`logic.js:213-214`) repeats the overhead figures because Laguna has no direct costs. I wondered what "full cost" meant.
  - No prediction is asked before the system flip (`:225-230`). This is the module's "aha" moment, and I flipped without committing to an answer.
- **Scene 4 `cost-hierarchy`**
  - The narration's examples match the chip labels almost word for word (`:272` "power per machine hour" vs `hierarchy.yaml:8`), so the sort is word-matching.
  - The scene never asks me to classify pools I've already met, and never asks me to pick a driver per level, even though objective `hierarchy` promises that.
- **Scene 5 `beyond-factory`**
  - The title promises registrars, but none appear.
  - The diagnostic-center schedule is fully filled from beat 1, including "ABC overhead per visit ₱110" (`:321-323`), so the ₱110 gate (`:334`) is a lookup.
  - The Rizal schedule appears in the same beat as the −₱140,000 gate (`:341-345`).
  - Rates are given as facts ("₱20 a visit") rather than built from 480,000 ÷ 24,000.
  - "Gross margin" and "operating profit" are never defined. This is the thinnest scene: four beats for two big ideas.
- **Scene 6 `worth-it`**
  - Iloilo appears three times: as a chip, as a predict gate, and as the quiz item `converge-mcq`.
  - "FMCG", "SKUs" and "ERP" are never explained.
  - Benefits and limitations (slides 59/61) get only one sentence (`:377`).
- **Math & Journal**
  - `apply-job` lets me choose Job 107 or 108, but its arithmetic step is hard-coded to Job 107 (`math-code.yaml:77-83`).
  - `cross-subsidy` derives only Custom's ₱78.00. Bins' ₱20.40 appears without a derivation (`:190`).
  - `hierarchy` uses Radiance (`:267-284`) before the caselets section introduces that company.
  - `caselets` is nine company names and tables with no story or question.
  - Tarlac (Ex 9) and the registrar (Ex 7.5) appear only as "Lecture check" rows (`:93`, `:346`), yet the examTip at `:350` refers to "the registrar example".
- **Application**
  - The story says "Overhead of ₱2,720,000 is applied at one rate" (`application.yaml:10`), but cell 2 then brings in a separate ₱400,000 of plant administration (`:50`). It's unclear whether the old rate included it.
  - The bid table shows "Profit per unit at the competitor's ₱1,450: −70" before I make the decision (`:80-81`).
- **Quiz**
  - Only one of 29 templates (`compare-handcalc`) is difficulty 3.
  - Nothing asks for full cost, margins or a pricing decision, although Application and the caselets depend on them.
  - `driver-match` (bank/hotel/airline drivers) and "rates are still estimates" in `limits-multi` test material that's never taught.

**Issues:**

| # | Sev | Where | Problem (as a learner experiences it) | Suggested fix |
|---|---|---|---|---|
| 1 | High | intuition.yaml:94-96 with :131, :140 | The rates table, with its Rate column filled in, is on screen while I'm asked to "predict" ₱1,000/setup and ₱5.00/lb. These gates are lookups. | Reveal the `rates` Schedule progressively (an `upTo` reveal fn like the job sheet), or set `hidden: true` and `show` it after beat 3. |
| 2 | High | intuition.yaml:183-185 / :222 | Custom's ₱45.00 traditional overhead is visible while I'm asked to compute it. | Hide `view` until the switch beat, or start with the ABC rows blank. |
| 3 | High | intuition.yaml:321-323 / :334; :341-345 | The diagnostic-center and Rizal schedules show the answers (₱110/visit, −₱140,000) while I'm asked for them. | Hide `lines` until after the gate. Move `show: [cust]` past the Customer B gate. Build the schedules row by row with walk players (§7.5). |
| 4 | High | intuition.yaml:41,51,123,278,287,389,396; application.yaml:39,57,90 | Every MCQ predict and every Application decision has the correct answer first, and options aren't shuffled (`Gate.tsx:58`, `ApplicationTab.tsx:128`). By scene 2 I was just clicking the top option, which is often also the longest. | Vary the answer position. Add `optionFeedback` for the wrong options. (Also see the cross-cutting fix X1.) |
| 5 | High | intuition.yaml:30, :68; quiz.yaml:11 | "ABC assigns ₱37,750" and "investigate ABC" are used in scene 1, before ABC is defined in scene 2. This breaks define-before-use (§7.1a). | In scene 1 say "a more detailed costing that follows setups, waste and inspections…". Move the ₱24,625 gap gate into scene 2, after the player. |
| 6 | High | intuition.yaml:34, :135; glossary.yaml:51 | "Sessions 5 and 6", overhead, POHR, applied, machine hours and direct labor are never explained, so a zero-background learner is lost in beat 1 (§7.6). | Add glossary terms `overhead` and `predetermined-overhead-rate` and define them in beat 1: "Overhead is factory cost you can't trace to one product: rent, power, setups, inspections. Before the year starts, companies divide budgeted overhead by a volume measure such as machine hours to get one rate…" |
| 7 | Med | intuition.yaml:44-45, warnings.yaml:7-10 | "Setup", "batch" and "production run" carry the whole argument but are never defined. | Add a glossary term `setup`: "preparing a machine for a new production run, done once per batch whatever its size". |
| 8 | Med | intuition.yaml:64-70 | The gap gate gives me both numbers and asks me to subtract, while the Readout already shows the result. | Ask instead: "Job 107 used 500 of the plant's 20,000 MH. At one ₱26.25 rate, how much overhead does it get?" (13,125). Then reveal the ABC figure. |
| 9 | Med | intuition.yaml:143-152 | One beat both introduces two-stage assignment ("rather than departments") and plays the walk. The plantwide system had no departments, so the contrast confused me. | Split the beat: first define two-stage assignment with a picture (overhead → one pool → jobs vs overhead → activity pools → jobs), then start the player. |
| 10 | Med | intuition.yaml:225-230 | The traditional→ABC flip has no prediction before it. | Add a gate before it: "Custom uses 25% of MH but 80% of setups. Under ABC its overhead per unit will… [rise / fall / stay about the same]". |
| 11 | Med | logic.js:213-214, intuition.yaml:185 | The "Full cost per unit" column equals overhead because there are no direct costs, which made me think full cost = overhead. | Drop the column when there's no dm/dl, or label it "Overhead only (no direct costs given)". |
| 12 | Med | intuition.yaml:156-158 | The per-tool gate comes after the player has already shown ₱18.88. | Move the gate before the player, or stop the walk before the `abc-unit` step. |
| 13 | Med | intuition.yaml:261-310; hierarchy.yaml:7-14 | The hierarchy sort is word-matching, never touches pools I've used, and never asks me to choose a driver by level (which the objective promises). | Use fresh activities ("Purchasing materials for each production order", "Maintaining the product catalogue", "Security guards"). Add a gate that classifies Global Metals' five pools, and a level↔driver match gate. |
| 14 | Med | intuition.yaml:313, 329-358 | The scene promises registrars, has none, and crams services and customer profitability into four beats with rates given as facts. | Retitle the scene or add the registrar (Ex 7.5). Split it into two scenes with walk players that build the rates. |
| 15 | Med | intuition.yaml:338-346; glossary | Gross margin, operating profit and cost to serve are never defined. | Add a `gross-margin` term ("sales minus cost of goods sold, before selling costs"). Define cost to serve: "what it costs to take a customer's orders and deliver to them". |
| 16 | Med | math-code.yaml:77-83 | Choosing Job 108 changes the per-unit line, but the arithmetic step still shows Job 107's numbers. | Interpolate the step from `jb`, or drop the Choice and add a separate Job 108 practice. |
| 17 | Med | math-code.yaml:184-191 | Bins' ABC ₱20.40 appears without a derivation. | Add a step: Bins $= 45{,}000\times20 + 300\times400 = 1{,}020{,}000 \div 50{,}000 = ₱20.40$. |
| 18 | Med | math-code.yaml:157 vs intuition.yaml:31, math-code.yaml:130, quiz.yaml:63 | The sign convention flips. Cross-subsidy and compare-fill use Traditional − ABC; the Job 107 gap and plant-handcalc use ABC − plantwide. I entered a negative number in plant-handcalc step 4. | Use one convention (Traditional − ABC) everywhere, or ask for "By how much does the single rate undercost the job? (positive number)". |
| 19 | Med | math-code.yaml:256-284 | The hierarchy section uses Radiance, which I haven't met yet, and shows "Facility = 0" with no comment. | Use Cebu or Global Metals pools, or add one sentence of context. |
| 20 | Med | math-code.yaml:93, 346, 350 | Tarlac (Ex 9) and the registrar (Ex 7.5) are only "Lecture check" rows, but an examTip refers to them as if they'd been taught. | Give each a short worked block with a one-line story. |
| 21 | Med | math-code.yaml:397-456 | Caselets are nine company names and tables with no scenario or question. "Three steps, as always" explains nothing. | Add a one-sentence story and question per caselet (e.g. "Is the Assorted Gift Pack really profitable?") and a numeric tryIt per complexity level. |
| 22 | Med | application.yaml:10 vs :50 | ₱2,720,000 "applied at one rate", then a separate ₱400,000 of plant admin appears. Is it inside the old rate? | "Overhead of ₱2,720,000 (excluding ₱400,000 of plant administration, reported separately)…" |
| 23 | Med | application.yaml:83-91 | The bid answer treats ABC full cost as what the order "really costs". Learners will carry that into special-order decisions, where only incremental costs matter. | Add "assuming setups, inspections and design work rise with orders like this", and note that facility cost is excluded. |
| 24 | Med | application.yaml:38, :80-81 | Cell 1's options print the margins (I just picked the largest), and the bid table shows −₱70 before I decide. | Remove the percentages from the options. Hide the `b-comp` row until after the decision. |
| 25 | Med | glossary; math-code titles | "Traditional costing", "plantwide rate", "single rate" and "OH" name the same thing. "Traditional" is never defined, and OH/MH are never spelled out. | Add "traditional costing" to the plantwide-rate `aka`. Spell out OH and MH on first use. |
| 26 | Med | manifest.yaml:24 | The objective promises "diverse, automated plants", but automation (slide 10: overhead grows, labor shrinks) is never taught. | Add a beat with overhead vs DL shares and a predict gate on what happens to a DLH rate as automation rises. |
| 27 | Med | SOURCE_NOTES.md:9; application.yaml:138 | Slides 12–15 are missing: Job 105 at ₱289.00 vs ₱245.80 under departmental rates, the refined first stage, the camera-lens analogy. The `connections` note mentions departmental rates as if they'd been taught. | Add a short beat: plantwide → departmental → activity rates as three levels of focus, using Job 105. |
| 28 | Med | quiz.yaml difficulty | 13 templates at level 1, 15 at level 2, 1 at level 3. Nothing on full cost, margin flips or bids, the skills Application uses. | Add `margin-handcalc`, `bid-numeric` and a three-pool `compare-handcalc` at level 3. |
| 29 | Med | quiz.yaml:452-464, :521-527 | `driver-match` (bank/hotel/airline) and "rates are still estimates" are tested but never taught. | Add the industry-driver table to the services section, and a limitations beat. |
| 30 | Low | quiz.yaml:80 | "Batch-level costs are spread evenly over all volume" is ambiguous. | "…spread over units in proportion to volume, as if every unit caused them". |
| 31 | Low | quiz.yaml:94 | "Identify the activities that cause costs (the cost drivers)" conflates activities with drivers. | "Identify the activities and choose a cost driver for each". |
| 32 | Low | logic.js:407-410 | The pitfalls the lesson warns about (rate × the pool's total driver; dividing by both products' units) have no matching misconception feedback. | Add `{ value: lo.abcTotal/(units[0]+units[1]), feedback: … }` to compareQ, and similar for jobQ. |
| 33 | Low | quiz.yaml:426 | The hint "Rates are ₱ per order and ₱ per delivery" doesn't help. | "Order rate = order-processing cost ÷ total orders of all three customers; same for deliveries." |
| 34 | Low | adopters.yaml:9; intuition.yaml:391-397; quiz.yaml:467-513 | The same three businesses are the chips, the predict gates and the quiz items, so the quiz tests recall, not transfer. | Use new cases in the quiz ("a bakery with 3 breads on one line"). |
| 35 | Low | intuition.yaml:374; quiz.yaml (several) | "slide 62", "Example 1" and "slide 79" are meaningless without the PDF. | Keep slide refs in `source` fields only. |
| 36 | Low | warnings.yaml:7-8, adopters.yaml:12 | Scene 1 chips spoil Laguna's numbers. FMCG and SKUs are unexplained. | Use generic chips. Write out "fast-moving consumer goods" and "product variants". |
| 37 | Low | math-code.yaml:469-470 | "Distortion ∝ diversity × batch-level overhead" is formatted as if it were a real formula. | Present it as a bullet list of conditions. |
| 38 | Low | math-code.yaml:22/26, :432/:436 | The `rate` and `diff` anchors are reused within one step list. | Use distinct anchors (`full`, `margin`). |
| 39 | Low | glossary.yaml:58 | "Stage 1 traces overhead to departments (traditional)" contradicts the plantwide setup used throughout. | "Stage 1 gathers overhead into cost pools (one plantwide pool, departments, or activities); Stage 2 assigns each pool to products." |

Audit findings that also hurt learning: **C1** (contradictory MH pools in `plantQ`) surfaces in the `single-rate` tryIt. The `distortion()` tone at **logic.js:238** undercuts the base-of-percentage lesson. **T1** (the abm module misattributes the ₱33 figure) misremembers this module's Laguna result.

**Coverage gaps vs lecture:**
- Slide 10 (automation shifts cost from labor to overhead): absent, despite the objective.
- Slides 12–15 (Job 105, departmental rates, refined first stage, camera-lens analogy): absent.
- Slides 20, 25, 50–55 (driver tables, including services and industries): untaught but quizzed.
- Slides 56–57 (registrar, Ex 7.5) and 68–69 (Tarlac, Ex 9, a typical exam-length job problem): only "Lecture check" rows.
- Slide 24 (traditional vs ABC comparison table): only implicit.
- Slides 59/61 (benefits and limitations): one sentence.
- Slides 43–44 (Pangasinan spectrum): Math only, no Intuition "aha".
- Case workbook (slides 85–108): numbers only, with no story, no questions, and no margin or full-cost quiz items.

**Top 5 improvements:**
1. Stop showing answers before the gate: hide or progressively reveal the rates, overhead-per-unit, diagnostic, Rizal and bid schedules, and rewrite the scene-1 gap gate. That alone turns about 8 busywork gates into real predictions.
2. Vary the correct-option position and add `optionFeedback`.
3. Build beginner vocabulary up front (overhead, POHR, setup/batch, traditional costing, gross margin), and move ABC-dependent numbers out of scene 1.
4. Fill the lecture gaps with count-along content: automation, departmental rates/Job 105, the registrar, Tarlac, driver tables, limitations. Split scene 5.
5. Tighten Math & Journal (dynamic Job 108, Bins derivation, one sign convention, hierarchy example off Radiance) and add level-3 margin, full-cost and bid quiz templates.

---

### Activity-Based Management (`abm`)

**Learner verdict:** The story holds together, the cases are concrete and Philippine-flavoured, and every number I recomputed is correct. There are real "aha" moments: Customer B's ₱195,000 swing, Supplier A being "₱5 cheaper, ₱21 dearer", and the 30%-vs-43% trap. As a first-time learner, though, I could read almost every numeric answer in Intuition off a table already on stage. Several quiz items test content the lesson never taught or that it contradicts (scheduling, the Luzon "checking" activities, tiering, the order of responses). Two auto-graded items mark correct answers wrong: the duplicate labels in `pva-match`, and the rounding in `mce-numeric` / `velocity-numeric`.

**Strengths:**
- Every lecture number reproduces: Rizal (−140,000 → 55,000), TCO (126,000 vs 105,000), Zamboanga (+980,000, 25.1%), Marikina (35% → 50%), the 100-unit order (20% → 50%, 10 → 25/day), and all the synthetic Davao figures (whale total 1,520,000, top five = 131.25%, TCO 2,388,000 vs 2,292,700, velocity 40 → 85.7, +114%).
- The "do" interactions are good: the VA/NVA DropBins (`intuition.yaml:76-78`), the fishbone DropBins (`:163-166`), the consolidation Choice (`:258-264`), and the MCE slider `when` gate with a useful hint (`:396`).
- Slide errata become teaching moments: "four times" is really 8× (`math-code.yaml:111`), and "30% faster" is really +43% (`intuition.yaml:405-411`). The examTip `1 ÷ (1 − x) − 1` is exam-useful.
- The Application is one coherent improvement cycle with 6 decisions. The velocity MCQ tests the reciprocal trap in a new setting, and the fishbone "how would you test it" prompt is genuine transfer.
- Generator misconceptions target real errors: price only / hidden costs only, giving the NVA share instead of MCE, and dividing by processing time instead of cycle time.

**Walkthrough notes:**
- **Scene 1 (diagnosis-treatment):**
  - It references "Custom Bracket" and "800 setups", which only appear in scene 3; abc never names that product.
  - All three predicts are guessable. "About half" isn't a real option, and the K-T option text includes "(find the cause)", which echoes the "Why…" stem.
  - The "which managers use ABM" reflect asks for slide-18 content I was never shown.
  - No numbers appear anywhere in the scene.
- **Section abc-to-abm** sits right after scene 1 but already uses "PVA, driver analysis … MCE". Its tryIt `toolkit-match` tests five tools not yet taught.
- **Scene 2 (value-or-waste):**
  - The inspection beat is excellent.
  - The cells gate offers Eliminate / Share / Select but not Reduce, the natural rival, and says cells *eliminate* moving while later sections show cells *cutting* it.
  - "Cycle time" is used four scenes before it is defined.
  - The `pva-match` practice calls Luzon's "Reviewing the application" and "Verifying the credit history" value-added, right after I learned that checking is NVA.
- **Scene 3 (why-800):**
  - Batch size (25) and ₱1.25 are visible in the sheet before their gates.
  - "Five whys" shows only four.
  - The Batangas jump is abrupt.
  - The multicollinearity reflect relies on regression jargon this site never teaches.
  - "Order the whys yourself" uses the Toyota chain instead of the bracket chain.
- **Scene 4 (customer-b):**
  - The first gate and the "don't drop B" reflect nearly duplicate abc.
  - −140,000 and 55,000 are both visible before their gates.
  - The whale curve is defined with no picture.
- **Scene 5 (cheap-supplier):**
  - The TCO schedule (₱126) is visible from beat 1, and the four hidden-cost lines are never walked through.
  - The JIT beat is followed by a defect-rework question unrelated to JIT.
  - The Zamboanga prompt doesn't say last year had no rush shipments.
- **Scene 6 (cycle-clock):**
  - Cycle time 10 and MCE 35% are on stage before their gates.
  - The velocity gate switches example and units (to days) without warning.
  - "Throughput" means velocity here, but the glossary aka says cycle time = "throughput time".
- **Application:** strong. The 8-column customer schedule will overflow on phones, and the "margins slipping although sales grew" hook is never paid off.
- **Quiz:** 32 templates, none at difficulty 3.

**Issues:**

| # | Sev | Where | Problem | Suggested fix |
|---|---|---|---|---|
| 1 | High | intuition.yaml:150-152/174-182, 228-230/255-270, 304-306/315-335, 357-359/379-389 | 9 of 10 numeric predicts have their answer on stage: batch 25, ₱1.25, −140,000, 55,000, receiving 3,000, ₱126, 980,000, 10 h, 35%. | Use the §7.5 worksheet pattern: the setups/customers/tco/cycle fns take an `upTo` param that returns `null` amounts for unreached rows, advanced with `set` after each gate. Quick fix: `hidden: true` on the sheet plus `show` after each gate. Ask the 55,000 predict *before* the `when` switch. |
| 2 | High | quiz.yaml:71-77 (grader quiz.ts:368) | `pva-match` has two identical "Value-added" and two identical "Non-value-added" cards. Grading is by index, so a learner who classifies everything correctly is marked wrong about 3 times in 4. **Not in the audit.** | Make the right side unique (pair each with a reason), or convert to a `multi` ("Which are non-value-added?"). |
| 3 | High | quiz.yaml:463-466, 502-506; logic.js:273-300 | `mce-numeric` says "e.g. 35 for 35%" but has tol 0.1, and 76% of answers are non-integers (27.78%…), so typing 28 is marked wrong. `velocity-numeric` has tol 0.01 and 84% non-integers, so 34.8 is marked wrong. | State the rounding ("to one decimal place"), or loosen tol to 0.5 (%) and 0.05 (units/day). Do the same for the hand-calc MCE steps. |
| 4 | High | quiz.yaml:115-124 vs intuition.yaml:102-103, glossary.yaml:35, math-code.yaml:49 | `nva-multi` marks "Scheduling production" as NVA and cites "slide 26's four examples", but the lesson taught moving, waiting, inspecting and **storing**. Following the lesson gets it wrong. | Teach the full slide-26 list (scheduling, moving, waiting, inspecting, storing) in scene 2 and the glossary, or drop the scheduling option. |
| 5 | High | datasets/luzon.yaml:7,9; quiz.yaml:73-75; intuition.yaml:136-139 | Right after "inspection is NVA", the practice calls "Reviewing the application for completeness" and "Verifying the credit history" value-added. To a learner they look like inspections. | Add a services contrast beat: "In a bank the credit check *is* the service: it produces the lending decision. Re-checking a mis-filled form is inspection." Put the same line in the explanation. |
| 6 | Med | intuition.yaml:4, 27, 52; math-code.yaml:16 | Scene 1 refers to "Custom Bracket" and "800 setups" before scene 3 introduces them (with audit T1 on the same line). | "Session 7 showed one plantwide rate undercosts Cavite Precision's premium custom part (we'll meet it as Custom Bracket, 800 setups a year)." |
| 7 | Med | intuition.yaml:30-55 | Scene 1 gates are guessable, the scene has no numbers, and there is no "do" gate. | Put the bracket setup schedule (₱40 vs ₱1.25) on stage as the diagnosis, then have the learner pick a treatment. Remove the giveaway parentheticals. |
| 8 | Med | intuition.yaml:56-63 | The "Which managers use ABM data?" reflect asks for content never presented. | Precede it with a `say` naming operations, sales and procurement, then ask what each would do with the setup data. |
| 9 | Med | math-code.yaml:33, 38 | The first section's tryIt `toolkit-match` tests five tools not yet taught. | Move it to the last section, or to a closing review. |
| 10 | Med | intuition.yaml:255-257, 281-288 vs abc/intuition.yaml:344-356 | The Customer B −140,000 gate and the "don't drop B" reflect are near-copies of abc. | Open with "rank A/B/C by gross margin, now guess the profit rank", go straight to consolidation, and change the reflect to "when is the ₱195k saving real?" (see #28). |
| 11 | Med | intuition.yaml:271-280; logic.js:194 | The whale curve has no picture, and the Rizal customers total −40,000, so the idea can't be checked on stage. `whale()` already returns a `chart` that nothing uses. | Add a Chart of the Davao whale curve and ask "how many customers to pass 100%?" (5, 131%). |
| 12 | Med | quiz.yaml:48-62, 126-140, 306-318, 320-331 | `benefits-multi`, `quality-mcq` (four quality-cost categories), `tier-match` and `respond-order` test content the lesson never teaches. The first three steps of `respond-order` have no taught order. | Add a beat or Callout for each, or cut `respond-order` down to a 2-step MCQ. |
| 13 | Med | intuition.yaml:205-212; quiz.yaml:240-248 | "Regress", "multicollinearity", "coefficient" and "Session 3's caselet" are used without definition. | Add a glossary term `multicollinearity` ("two candidate causes that move together, so the data can't tell which matters") and drop the "Session 3" reference. |
| 14 | Med | glossary.yaml:88 vs intuition.yaml:405-411 | "Throughput" means a time in the glossary and a rate in the reflect. | Drop the "throughput time" aka, or clarify the meaning in the reflect. |
| 15 | Med | intuition.yaml:118-128 vs math-code.yaml:371-373, application.yaml:36-37 | One place says cells *eliminate* moving, others show them *cutting* it, and the gate omits Reduce. | Reword the stem ("pieces pass hand to hand"). Add Reduce as a distractor: "a shorter move is Reduce; no move is Eliminate." |
| 16 | Med | intuition.yaml:44, 119, 132 | TQM, JIT and cycle time are used before they are defined. | Gloss them inline, and drop "TQM in Session 1". |
| 17 | Med | intuition.yaml:318-325 | The narration gives only the receiving rate, then asks for TCO per unit. Inspection, rework, expediting and admin are never walked through. | Add a walk player on `tc.trace` before the ₱126 gate. |
| 18 | Med | intuition.yaml:326-335 | The JIT beat is followed by an unrelated defect question, and "no rush shipments last year" is unstated (so 900,000 is defensible). | Split into two beats and state the comparison year. |
| 19 | Med | quiz.yaml (all) | No difficulty-3 items. Nothing on velocity % change (the headline trap) or a full supplier decision. | Add velocity-% generator, TCO "which supplier and by how much", whale-share items. |
| 20 | Med | intuition.yaml (end) | No closing synthesis (slides 66–69, 77–80). The five tools never come back together. | Add a short scene 7: drag the tools onto the Kaizen loop, then a reflect. |
| 21 | Low | math-code.yaml:51 | "NVA share = activities ÷ activities" sits next to "60–90% of cycle time", so a count and a time share get conflated. | Label it "share of activities (a count)". |
| 22 | Low | math-code.yaml:321 | "JIT plants push toward 80–90%" is not in the source. | Cite a source or soften the claim. |
| 23 | Low | intuition.yaml:158-162, 213-216 | "Five whys" shows four, and the practice is an unseen Toyota chain. | Add a fifth why, and retitle the beat. |
| 24 | Low | math-code.yaml:117 | SMED is not expanded. | Spell it out (Single-Minute Exchange of Dies). |
| 25 | Low | glossary.yaml:63 | "Cost to serve" is listed as an alias of the analysis. | Give it its own term. |
| 26 | Low | application.yaml:125; math-code.yaml:206 | "Example 10" means different things in abc and abm. | Drop example numbers in learner text. |
| 27 | Low | intuition.yaml:373-389 | cost-flows taught the same idea as "value-added share", with no bridge to MCE. | "This is the value-added share from the JIT notes, now with its usual name, MCE." |
| 28 | Low | intuition.yaml:270 | The ₱195,000 swing assumes order and delivery cost disappears. | Pitfall: "real only if the desk and trucks are cut back." |
| 29 | Low | quiz.yaml:139 | The `quality-mcq` hint points at the wrong answer (prevention). | "Which categories exist only because something already went wrong?" |
| 30 | Low | quiz.yaml:157; logic.js:384 | Explanations can say "batches of 21.43 units". | Keep `setupsA` a divisor of `unitsA`. |
| 31 | Low | quiz.yaml:77 | The explanation mentions "approving", which isn't one of the pairs. | Fix the text. |
| 32 | Low | datasets/fishbone.yaml:7 | One chip describes a consequence, not a cause. | Replace it with a cause. |
| 33 | Low | math-code.yaml:111; intuition.yaml:405 | Errata are given as narration, not as `Callout kind: errata`. | Wrap them in errata Callouts. |
| 34 | Low | application.yaml:10, 52 | The hook is never resolved, and the 8-column table overflows on phones. | Close the hook in `next-cycle`, and transpose or trim the table. |

Audit items that also hurt learning: **T1** (₱33 / Custom Bracket), the uncertain **abm/quiz.yaml:90** (Share vs Reduce), and **G2** (percent parsing on the MCE gates).

**Coverage gaps vs lecture:**
- Kepner-Tregoe plan (slides 16–17): absent.
- Users, toolkit and benefits (slides 18–20): quizzed but not taught.
- Slide 26 NVA list: mismatch (see #4).
- Quality costs (slide 28): only in one MCQ.
- Select/Share (slide 31): one line each.
- Toyota five-whys (slides 37–39): only in a quiz.
- Data analytics and multicollinearity (slides 42–43): jargon only.
- Responses and tiering (slides 49–52): partial, with no whale visual.
- Synthesis (slides 66–69, 77–80): absent.

**Top 5 improvements:**
1. Stop showing answers before predictions (progressive `upTo` worksheets).
2. Fix the three grading traps: `pva-match` duplicate labels, MCE/velocity rounding, and the NVA list mismatch.
3. Resolve the VA/NVA contradictions with a services contrast beat and an Eliminate-vs-Reduce beat.
4. Teach what the quiz tests (toolkit, benefits, quality costs, responses, tiering), and ground scene 1 in numbers.
5. Add a whale Chart, replace the duplicated Customer B gate, add difficulty-3 transfer items, and add a closing Kaizen synthesis.

---

## ML2: Machine Learning 2

### Class Imbalance (`class-imbalance`)

**Learner verdict:** This is a strong, well-paced module. Its concrete data (a lazy model, then an 18-row fraud table, then SIGLA, then the toy map) carries a beginner from "what is accuracy" to ADASYN, and I could reproduce nearly every number by hand. What lets it down is a handful of interactive spots that contradict themselves or grade badly:
- **A cost-ratio gate that only one slider stop satisfies**, with narration that describes the result wrongly.
- **An Application "best threshold" answer** that the slider disproves.
- **F1 and balanced-accuracy grading** that accepts the plain-average mistake the module warns about.
- **A glossary entry** that calls PR-AUC an alias of ROC-AUC.

The module also never says *why* imbalance hurts learning, so the jump from metrics (scenes 1–4) to resampling (scenes 5–8) feels unmotivated.

**Strengths:**
- **The lazy-model opener is excellent.** It runs predict 141 → predict 98.59% → predict recall 0 → slider to 99% → slider to 50:50 → reflect. You feel the trap rather than being told about it.
- **Terms are defined where the picture shows them.** All 35 glossary terms are `define`d, and TP/FN/FP/TN each come with an immediate predict on a real row. The audit's "25 terms never defined" lint looks stale for v1.1.0.
- **The toy map is well chosen.** All squared distances and ADASYN Δ check out, and M5 works as a built-in noise example.
- **The SMOTE-NC scene makes the problem vivid** ("What is halfway between Married and Divorced?"). The vote gate deliberately makes the blending partner lose.
- **The final scene turns the comparison table into an actionable idea:** flat ROC-AUC ≈ a threshold shift. It is backed by a cost slider and a reflect on who decides.
- **The honest-pipeline thread is reinforced** across code-fill, order, numeric and the Application leakage cell.

**Walkthrough notes:**
- **lazy-model:**
  - The Readout shows "dropout F1 = 0" from beat 1, two scenes before F1 is defined, and that value relies on an unexplained 0/0 convention.
  - The goal says "98.6%". The gate wants 98.59 "in %", so typing `98.59%` is parsed as 0.9859 and marked wrong.
- **tally-fraud:**
  - The tip gives only half the TP/FN mnemonic.
  - The TN predict comes after the tally is already on screen.
- **four-metrics:**
  - The F1 gate's tolerance (0.57 ± 0.01) accepts 0.58, which is the plain average the explain warns against.
  - "F1 stays close to the smaller of the two" isn't shown by the example on screen (0.57 vs 0.58).
  - Balanced accuracy gets one passive beat, yet it is quizzed.
  - "Accuracy barely moved" is contradicted by the sliders (+0.11).
- **per-class-sigla:**
  - Raw labels such as `Macro-F1-3class` appear before "macro" is defined.
  - The marker model scores *higher* on "Recall-UW-or-worse" but never catches SevUW. This is the best teaching moment in the scene and it is never explained.
  - "Rows add to 1" while the rows show 0.99 and 1.01.
- **resample-counts:**
  - Training-split numbers appear before any split is explained. Split-first and leakage come only in the last scene, but the lecture puts them before the techniques.
  - There's no bridge explaining why imbalance makes a model ignore the minority.
- **smote-line:** clean. k is introduced without any discussion of how to choose it.
- **smote-nc-vote:**
  - "NC" is glossed loosely.
  - The practice gate repeats SMOTE arithmetic instead of the vote.
  - The callout promised in SOURCE_NOTES (how distance works with text columns) is missing.
- **adasyn-hardness:** the M5 predict comes after "read the last column".
- **choose-by-decision:**
  - PR-AUC is never explained.
  - The RUS gate and the "near 2 RUS wins" narration are wrong (see the computed checks).
- **Math & Code:**
  - K means classes in one section and a sampled subset in the next.
  - y = 1/0 coding appears unannounced.
  - The F1 pitfall says 0.58; the calculator gives 0.585.
  - The SMOTE "mirror-image" pitfall is muddled.
  - There's no section on expected cost, even though it's quizzed.
- **Application:**
  - Cells 4–5 switch to the Adult Income table and ask which method suits "dropout screening".
  - The learner never resamples anything.
- **Quiz:**
  - 41 templates; the difficulty spread is 20/18/3, so level 3 is about 7%.
  - Nothing on thresholds, class weights, ROS overfitting, or reading a row-normalized matrix.
  - Several MCQs are guessable because the right answer is the only nuanced option.

**Computed checks** (simulation of `logic.js`):
- **Cost winners on the 0.05 slider grid:**
  - Baseline wins for 1.00–1.60.
  - SMOTE-NC wins for 1.65–1.90.
  - ROS wins for 1.95–2.40.
  - **RUS wins only at 2.45.** Analytically the window is 2.417 < r < 2.492.
  - ADASYN wins for ≥ 2.50.
- **Application threshold:**
  - 0.35 flags 8 learners, TP 3, precision 0.38.
  - **0.40 flags 7 learners, TP 3, precision 0.43.**
- **`confusionQ`:**
  - |F1 − (P+R)/2| ≤ 0.01 in 27%, 33% and 40% of seeds (difficulty 1, 2, 3).
  - |balanced − accuracy| ≤ 0.01 in 24%, 12% and 8% of seeds.
  - In those seeds the misconception is dropped and the wrong method is graded correct.

**Issues:**

| # | Sev | Where | Problem | Suggested fix |
|---|---|---|---|---|
| 1 | High | intuition.yaml:783-787 | "Find a cost ratio where plain RUS is cheapest" is met at only 1 of 101 slider stops (2.45). The hint says "between 1 and 5". The next beat says "near 2 RUS wins", but at 2.0 ROS wins, and SMOTE-NC's window is never mentioned. | Gate on "the ratio where the winner switches from Baseline" (`cc.best != 'Baseline'`). Rewrite: "At 1 the baseline wins; between about 1.7 and 2.4 the resamplers trade places by tiny margins; from about 2.5 ADASYN wins." |
| 2 | High | application.yaml:75-86 | The model answer says thresholds above 0.35 waste visits and miss a dropout. At 0.40 the slider shows 7 flagged, 3 caught and higher precision. The slider disproves the key. | Add the 0.40 option and make it correct, or rewrite the model answer: "0.35 or 0.40 both catch 3 of 4; 0.40 needs one fewer visit; catching the 4th needs 15 visits." |
| 3 | High | glossary.yaml:200-201 | PR-AUC is listed as an alias of ROC-AUC with a "0.5 = random" baseline. It is a different metric, and its random baseline is the minority share (0.239 here). | Remove the aka. Add a `pr-auc` term ("random ≈ minority share, not 0.5") and define it at choose-by-decision. |
| 4 | High | logic.js:656-672 (quiz.yaml:179-182, 212-216, 234-237) | In about a third of `f1-numeric` / `metrics-hand` instances the plain average is within 0.01 of F1, so the warned-against mistake is graded correct. The same happens for balanced vs plain accuracy (8–24%). | In `drawConfusion`: `if (Math.abs(m.f1Arith - m.f1) < 0.03) continue;` and the same for balanced vs accuracy. |
| 5 | Med | intuition.yaml:263-267 | The F1 gate (0.57 ± 0.01) accepts 0.58. | `answer: { value: 0.5714, tol: 0.005 }`. |
| 6 | Med | intuition.yaml:48-51; quiz.yaml:9-12 | `98.59%` is marked wrong in the gate. The quiz rejects `98%` and pushes toward 0.98, which is also wrong. | Ask for a decimal and accept percent (tol 0.0001). |
| 7 | Med | intuition.yaml:258-267 | "F1 stays near the smaller value" is asserted but not shown. | Add a `when` gate: TP=1, FP=0 → P 1.00, R 0.25, F1 0.40, not 0.63. |
| 8 | Med | intuition.yaml:387-431 | Nothing explains *why* uneven data makes a model ignore the minority. | Opening beat: "A model learns by reducing its mistakes; with 3:1 data, ignoring the minority costs little. Rebalancing makes those mistakes count." |
| 9 | Med | intuition.yaml:424-431, 801-804 | Training counts appear before any split; split-first and leakage come last, against the lecture's order. | Move the stratified-split and leakage beat and predict into `resample-counts`. |
| 10 | Med | intuition.yaml:306, 339-341; sigla.yaml:33-35 | Jargon row labels are shown before "macro" is defined. | Relabel them ("F1, 3 groups (avg)"…) and explain "avg". |
| 11 | Med | intuition.yaml:361-377 | The marker model scores higher on "UW-or-worse" but has SevUW recall 0, and this is never explained. | Add a beat: merged classes count calling 67% of severe cases plain Underweight as a "catch". |
| 12 | Med | application.yaml:104-149 | The switch to Adult Income is muddled for a dropout case. | Frame it explicitly as "borrowing the Session 3 lab". |
| 13 | Med | glossary.yaml:68 | "Positive = flagged as the thing we hunt" mixes up the true class with the guess. | "The group we hunt for (e.g. fraud), whatever the model guessed." |
| 14 | Med | intuition.yaml:268-271; math-code.yaml:189-202 | Balanced accuracy gets one passive beat but is quizzed. | Add a Formula step and a predict (0.71), plus a math step. |
| 15 | Med | intuition.yaml:729, 768-777; application.yaml:108 | The PR-AUC and balanced-accuracy columns are unexplained. | Define them (#3) or drop the columns. |
| 16 | Med | quiz.yaml:753-771 | `results-multi` asks about accuracy without showing it. | Add the table, or put the numbers in the prompt. |
| 17 | Med | quiz bank | No template on thresholds, class weights, ROS overfitting, or a real "choose a method"; level 3 is 3 of 41. | Add threshold numeric/MCQ, class-weights MCQ and a level-3 cost tie-point item. |
| 18 | Med | quiz.yaml:27-33, 579-586, 731-750, 780-786 | MCQs are guessable by form. | Write distractors from real misconceptions. |
| 19 | Med | quiz.yaml:40-60 | `why-hurts-multi` cites slide-24 content never presented, and one option is arguable. | Add a summary beat and reword the option. |
| 20 | Low | intuition.yaml:18-20 | F1 appears in scene 1 before it is defined. | Remove it, or add "(scene 3)". |
| 21 | Low | intuition.yaml:171-177, 701-707 | The TN and M5 predicts come after the answer is on screen. | Ask before playing. |
| 22 | Low | intuition.yaml:284-285 | "Accuracy barely moved". | "1/18 ≈ 0.06 per fraud vs recall 0.25". |
| 23 | Low | intuition.yaml:156 | Half a mnemonic. | Give both halves. |
| 24 | Low | intuition.yaml:343-344 | "Rows add to 1" while they show 0.99 and 1.01. | Note rounding. |
| 25 | Low | intuition.yaml:373-375 | Overstates a 0.01 gap. | "…slightly lower". |
| 26 | Low | intuition.yaml:608, 635 | "NC" loosely glossed; the practice repeats SMOTE. | "Nominal and Continuous"; use `smotenc-vote`. |
| 27 | Low | SOURCE_NOTES:150 | The promised callout on how distance handles text columns is missing. | Add a `beyond` callout. |
| 28 | Low | math-code.yaml:243 | "= 0.58". | "(2/3 + 1/2) ÷ 2 = 0.583". |
| 29 | Low | math-code.yaml:260, 293, 366-369 | K reused; 0/1 coding unannounced. | Rename the subset S and announce the coding. |
| 30 | Low | math-code.yaml:596 | Muddled pitfall. | "x_nb + λ(x_nb − x_i) overshoots; always start at x_i." |
| 31 | Low | math-code.yaml:497 | Forward link to leakage. | Fixed by #9. |
| 32 | Low | application.yaml:35, 90 | TALAAN and DepEd unexplained. | Gloss them. |
| 33 | Low | SIGLA naming | Three names for the same versions. | Use one pair. |
| 34 | Low | glossary.yaml:128 | macro-F1 listed as an alias. | Move it to `long`. |
| 35 | Low | application.yaml:224 | "Decision boundary" never taught. | Rephrase. |

Audit items that also hurt learning: the cost explanation dropping "{=cFP} ×" (now at quiz.yaml:869), and **G2**'s absolute tolerance, which combines with #4. The `define` lint looks resolved.

**Coverage gaps vs lecture:**
- Slide 24, "why imbalance hurts learning", is never taught.
- Slide 5's central question is never posed.
- Split-first comes last instead of first.
- Class weights and SAGIP tiers appear only in the Application.
- The threshold precision–recall trade-off has no intuition slider and no quiz item.
- PR-AUC and balanced accuracy are thin.
- Over-taught: three code-fills on SMOTE internals, against zero items on thresholds.

**Top 5 improvements:**
1. Fix the cost-ratio scene and the Application threshold key.
2. Make grading catch the targeted mistakes: filter `drawConfusion`, tighten the F1 gate, fix the percent traps.
3. Fix the wrong definitions: PR-AUC and "positive".
4. Add the "why imbalance hurts" motivation, and move split-first and leakage earlier.
5. Deepen F1, balanced accuracy and the SIGLA paradox. Extend the quiz to thresholds, class weights and a real method choice.

---

### Model Interpretability (`interpretability`)

**Learner verdict:** This is one of the stronger modules. The toy tumours and twin trees make built-in importance, permutation, twins and PDPs countable by hand, and the honest-reading message ("name the class", "not causal") comes back often. Three things hold it back for a learner:
- **The predicts give themselves away.** Most predict gates can be answered by reading the screen.
- **The SHAP scene doesn't deliver.** It promises to explain *why* patient 205 was called malignant, then never shows a single feature's contribution.
- **The LIME live example contradicts its own narration.**

The local-methods half also leaves several lecture items unexplained:
- how a model "knows only A";
- the waterfall plot;
- the LIME and Wachter objectives;
- the unconstrained DiCE search.

**Strengths:**
- **Exact twin features.** area = πr², and tree 2 = tree 1 with "area ≤ 660". The split credit (0.385 → 0.192 each) and the erase-credit effect (shuffle radius alone and accuracy *rises* 0.8 → 0.9; shuffle both and it falls to 0.6) are exact and surprising. All verified.
- **Class coding is drilled well.** It appears on screen 1, comes back in the waterfall scene with a live class switch (0.626 ↔ 0.374), and is carried into the quiz and the explainBack.
- **The flip-it geometry check works.** Drag area until the model flips, the readout says "no such tumour exists", then lock area = πr² to find the plausible flip at r ≈ 15.98. "Valid ≠ plausible ≠ actionable" becomes something you can feel.
- **The reflect prompts ask real "why" questions:** why shuffle rather than delete, why average over every order, patient vs model checker.
- **The real numbers recompute:** the ranks (worst radius 5th built-in, 29th by permutation), the Shapley table, additivity 0.626 − 0.2893 = 0.3367, and the DiCE ratio 0.515.
- **"Six tools, six questions" in the Application** is an excellent one-page summary.

**Walkthrough notes:**
- **global-or-local:** gentle. The "explain a bad model?" predict is guessable. "Worst" as a feature prefix is never explained.
- **impurity-credit:**
  - The Gini is shown in the Tree node note during its predict.
  - It never says how to measure mixing *after* a split (size-weighted children's Gini), so 0.417 has to be reverse-engineered.
  - The "which feature gets more" predict comes after the player printed both values.
- **shuffle-test:**
  - Good predicts.
  - A hint references a hidden control.
  - "Shuffle the **test** data", but the toy tumours are also the data the tree was built on.
  - "Look-alike features" is referenced one scene before it is taught.
- **twins:**
  - Three predicts are answered on stage: 0.192 in the bars, −0.1 in the readout and narration, and rank 29 in the table.
  - It leaves a puzzle: if twins hide each other, why are worst perimeter and worst area, themselves twins, ranked #1 and #2 by permutation?
- **pdp-sweep:** the initial v = 13 already shows 0.600 for the first predict. The v = 20 predict says "look at the red counter", which shows the answer.
- **fair-split:**
  - The full factorial Shapley formula sits on stage from beat 1, with S, F, |S|! and φ unexplained.
  - "Knowing only A, the model says 0.35" never explains how a model runs with features missing.
  - The φ_A predict comes after the average row is filled in.
- **waterfall:**
  - The title promises a waterfall, but the stage shows only baseline, sum and f(x), plus an unused feature table.
  - The additivity answer is in the same beat's narration.
  - "Background cases" is undefined.
- **local-line:**
  - The σ-shrinking gate is excellent.
  - 0.368 is visible in the weights table.
  - "True slope at 16" is undefined.
  - It implies narrower is always better, and never mentions LIME's instability at tiny widths.
  - The quartile cut points are unexplained.
- **flip-it:**
  - Strong.
  - It claims the notebook's first search moved "one feature on its own", but SOURCE_NOTES says the first run was unconstrained.
  - The DiCE ratio predict needs untaught formulas.
- **Math & Code:**
  - Path placement puts `shap-additivity` (TreeExplainer, Φ[94,:,1], class flip) before the waterfall scene that introduces them.
  - The LIME live slider does nothing (see #3).
  - The `shapley-formula` final step is hard-coded to A while the Choice offers B and C.
  - Ω(g), argmin and G are not glossed.
  - σ means an ordering in one section and a kernel width in another.
- **Application:**
  - The "one-patient" decision asks me to reconcile a SHAP ranking I never saw, and its model answer claims agreement that the on-screen LIME partly contradicts.
  - The "direction" decision reviews the real forest using the toy PDP.
- **Quiz:**
  - 35 templates. 18 are level 1 and only 1 is level 3.
  - Everything is set on tumours, so nothing tests transfer.
  - `impurity-normalize` at difficulty 1 never has more than one split per feature, so the step it targets (summing a feature's splits) is never exercised.

**Issues:**

| # | Sev | Where | Problem | Suggested fix |
|---|---|---|---|---|
| 1 | High | intuition.yaml:490-561; math-code.yaml:583-589; quiz.yaml:663 | The goal is "Why was patient 205 called malignant?", but no per-feature SHAP value is ever shown. Waterfall reading (S7 §3) is untaught. The quiz then cites "worst area at −0.16 on the waterfall", a number that isn't in SOURCE_NOTES and may be invented. | Add the notebook's top-10 SHAP values for row 205 to `patient.yaml`. Show a waterfall Chart from baseline through each bar to 0.3367. Add a reading beat ("read bottom-up…") and a predict ("which feature pushed hardest towards malignant?"). Use real values in `encoding-multi`. |
| 2 | High | intuition.yaml:127-131, 145-150, 309-312, 318-324, 336-338, 362-379, 389-395, 464-470, 529-534, 543-548, 605-609, 704-709 | About 11 of 18 predicts have their answer on screen. These attempts are also written to `db.attempts` with skills (IntuitionTab.tsx:183), so they **inflate mastery**. | Hide the revealing widget until after each gate: `bars` hidden in twins; initial `v: 10` in pdp-sweep; `show: [real]` on the beat after; drop "P(benign) = 0.3367" from the narration; `shapUpTo: 5` until φ_A is answered; hide the weights column; remove the Gini from the node note. |
| 3 | High | math-code.yaml:616-648 | With three symmetric perturbations and symmetric weights, the weighted slope is −0.2016 for **every** σ (verified for σ 0.5…5). The step claims "shrink σ and the slope approaches the model's". Moving the slider changes nothing. | Use the scene's `[-3..3]` perturbations (σ 0.5 → −0.2263, σ 3 → −0.1837), or reword: "with three evenly spaced copies σ cancels out". |
| 4 | High | application.yaml:133-140 | "SHAP and LIME rank differently" is asked with no SHAP ranking shown. The model answer claims they agree on "size and dent features pushing towards malignant", but the on-screen LIME has worst concave points at +0.0148 and mean radius at +0.022, both towards benign. | After #1, show both tables. Rewrite the answer to name the agreements and the disagreements, and lower confidence where they disagree. |
| 5 | Med | guided.ts:35; math-code.yaml:526-528, 481 | `shap-additivity` comes before the waterfall scene on the Path: define-before-use in reverse. | Split the skill (`shapley` / `shap-reading`) and tag the section with the new one. Change "TreeExplainer avoids that" to "a shortcut met in the next scene". |
| 6 | Med | intuition.yaml:443-449; math-code.yaml:399; glossary.yaml:117-121 | It never explains how a model answers with features "missing". "Background cases" is undefined. | Beat: "To 'hide' a feature, SHAP fills it with values from many real background cases and averages. With nothing known you get the baseline." Add a `background-data` term. |
| 7 | Med | intuition.yaml:428-432 | The full factorial formula sits on stage from beat 1, with its symbols unexplained (§7.6). | Hide it until the additivity beat and gloss φ, the bracket and the fraction, or show the simpler orderings form. |
| 8 | Med | math-code.yaml:375, 395 vs 602, 615; 399 vs 432 | σ means an ordering and also a kernel width. Coalition value is written v(S) in one place and f(S) in another, with f(x) for predictions. | Use π for orderings. Use v(S) for coalitions everywhere. |
| 9 | Med | math-code.yaml:479 | The final step is hard-coded "φ_A = …", while the Choice offers B/C. | Build the step from `sw.rows`, or remove the Choice. |
| 10 | Med | intuition.yaml:118, 212; application.yaml:64 | The prefixes "worst", "mean" and "error" are never explained. | "mean = average over cells; worst = average of the 3 largest; error = how much it varies." |
| 11 | Med | glossary.yaml:85; intuition.yaml:338; math-code.yaml:277 | "Correlation > 0.98" is used as if known. | Define correlation at the twins beat. |
| 12 | Med | intuition.yaml:330-338; math-code.yaml:237; application.yaml:73-91 | The twins-erase rule seems inconsistent with perimeter and area ranking #1 and #2. | "Erasing isn't all-or-nothing… rankings within a twin group are unstable; judge the group." |
| 13 | Med | glossary.yaml:136, 154; math-code.yaml:615 | The LIME objective and the Wachter counterfactual objective are not taught, though both are exam formulas. | Add plain-words steps for each, plus an MCQ on λ. |
| 14 | Med | intuition.yaml:683, 700-703 | The first DiCE run is misdescribed. "Diversity" and `method="random"` are absent. | "The notebook's first run let *every* feature change; its second allowed only four." Add a line on diversity. |
| 15 | Med | intuition.yaml:610-617; math-code.yaml:613-614 | "Truly local" implies the narrowest kernel is best, ignoring instability. Quartile bins are not explained. | Add a "too narrow is unstable" beat and a quartile-bin explanation. |
| 16 | Med | intuition.yaml:132-137 | Jumps from "Gini of a group" to "credit for lowering mixing" without showing how mixing after a split is measured. | Insert a beat: 6/10 × 0.444 + 4/10 × 0.375 = 0.417, plus a predict. |
| 17 | Med | math-code.yaml:93 | The high-cardinality bias appears only in one pitfall line. | Add a sentence in the area beat and a quiz option. |
| 18 | Med | intuition.yaml:707 | The DiCE ratio predict needs untaught formulas. | Give the formulas in the question. |
| 19 | Med | quiz difficulty; logic.js:599-610 | 1 of 35 templates is level 3, and every item is about tumours. `impurity-normalize` never sums several splits. | Raise it to difficulty 2 or force repeats. Add level-3 transfer items (loan model with income/salary twins; flip the class; "be 5 years younger"). |
| 20 | Med | quiz.yaml:79-85 | The "correct" non-answer in `builtin-limits` is arguable. | "Which features' questions removed the most mixing". |
| 21 | Low | intuition.yaml:214-217 | "Test data" vs training rows. | Clarify that the toy scores on the same rows it was built from. |
| 22 | Low | intuition.yaml:230 | The hint references a hidden control. | "Try radius or texture." |
| 23 | Low | intuition.yaml:240 | Hides the fact that the shift broke T1 and fixed T7. | Say so. |
| 24 | Low | intuition.yaml:393 | T10 isn't changed, and the counter shows the answer. | Reword and hide the counter. |
| 25 | Low | intuition.yaml:501; math-code.yaml:558 | "Patient 205 (test row 94)" unexplained. | Explain it. |
| 26 | Low | logic.js:730 vs math-code.yaml:725 | ≥ 0 vs > 0. | Use one. |
| 27 | Low | intuition.yaml:690 etc. | The radius is given as 14.5, 14.6 and 14.57. | Use 14.57. |
| 28 | Low | math-code.yaml:728 | Double negative. | Simplify. |
| 29 | Low | intuition.yaml:590, 613 | "True slope" undefined. | "How steep the curve is right at 16". |
| 30 | Low | intuition.yaml:57-60 | Guessable predict. | Use a concrete scenario. |
| 31 | Low | intuition.yaml:246 | Forward reference. | Drop the clause. |
| 32 | Low | intuition.yaml:499-501 | Unused feature table. | Use it or remove it. |
| 33 | Low | intuition.yaml:647-660 | Locked-mode slider does nothing. | Hide it, or note why. |
| 34 | Low | application.yaml:45, 187-189 | Deck reference; log-odds unexplained. | Drop the reference and explain log-odds. |
| 35 | Low | quiz perm-numeric | The ROC-AUC branch never fires. | Add a difficulty-2 template. |

Audit items that also hurt learning: the gini-hand `wrongNoChildWeights` step, `logic.js:609` `wrongFirst` (the root cause is #19), the "rise by −4" wording, and the unverifiable patient-205 claim (#1, #4).

**Coverage gaps vs lecture:**
- The SHAP waterfall and how to read it is missing.
- The real PDPs from Session 6 are not shown.
- The LIME and Wachter objectives are not taught.
- The DiCE unconstrained run and diversity are misdescribed or absent.
- The following get one mention each:
  - high-cardinality bias
  - quartile bins
  - background data
  - PDP deciles and the rug
- Over-taught and not flagged `beyondSlides`: LIME weighted least-squares arithmetic and the factorial-weight derivation.

**Top 5 improvements:**
1. Remove the predict giveaways, which also stops them inflating mastery.
2. Make the waterfall scene answer its goal with real per-feature SHAP values, and fix the Application SHAP/LIME comparison.
3. Fix the LIME live example, and add the instability and quartile notes.
4. Fill the conceptual holes: background data, the objectives in plain words, DiCE's runs. Fix the Path order.
5. Strengthen the quiz with non-medical transfer items and real summing in `impurity-normalize`. Define correlation and the feature prefixes. Add the twins clarification.

---

### Time Series Forecasting (`time-series`)

**Learner verdict:** This is one of the stronger modules. Its real data reproduces the notebook numbers, and it has good "aha" moments:
- lag‑12 gives the shape while lag‑1 gives the height;
- shuffling deletes nothing;
- the leaky regression scores MAE 0 with weights 3/−1/−1.

The second half is where it slips. The learner runs into three apparent contradictions:
- **Differencing:** "keep the seasonal wiggle in mind" vs "one difference is enough, stop".
- **Drift:** "average monthly change" is 0.1156 here, but the previous scene said 0.104.
- **ARIMA's MAE:** it jumps from 1.900 to 0.600 between scenes with no word about one-step vs multi-step.

The PACF is named but never shown, yet the learner must choose p from it.

**Strengths:**
- **Count-along on the lecture's own numbers.** Annual differences, the naive MAE over all 48 months, three ARIMA forecasts, and the feature rows built one by one. Every recomputed number matches: 4.527/5.103/1.224, 365.64/366.49/367.03, 0.222/0.232/0.509, 38 of 48 above 366.68, and the Niño r values 0.87/−0.66/0.75.
- **The lag‑1 vs lag‑12 beat** sets up naive vs seasonal-naive nicely.
- **The leakage scene works.** Switch to the leaky rolling mean, watch MAE drop to 0, then predict why the weights are 3/−1/−1.
- **Hypothesis-test language is careful.** "Fail to reject is not proof" appears in the intuition, the pitfalls and the ADF generator.
- **The errata are handled openly.** Intuition, math-code and quiz all use the mean form c + φ(Δy − c) + θε (the glossary is the exception: audit T5).
- **The Application's `one-step-trap` cell is real transfer.** A one-step regression can't plan 12 months ahead.

**Walkthrough notes:**
- **be-the-forecaster:**
  - A flat dashed line labelled "hidden (your forecast)" sits at last year's mean, which nudges toward a flat forecast just when the gate says "continue the climb".
  - Series C has no gate.
  - The reveal never asks me to compare my guess with what happened.
  - The scene has no `skills`.
- **name-the-parts:**
  - "The trend need not be straight", but the slider only draws straight lines.
  - "Multiply" and "several seasons" are never shown.
  - The El Niño chip is sorted as cyclic. Two scenes later the Niño data shows a strong yearly cycle.
- **lags:**
  - Both predicts are lookups: the side table prints labelled lag columns.
  - The `k == 12` gate rejects k = 24.
- **order-is-signal:** the random-forest callout uses MAE, naive and "decision trees" before any is defined.
- **stationary-gallery:**
  - "The random walk hardly moves" contradicts the chart: −7.5 to 12.1 vs ±3, with half-means 6.51 → 1.34.
  - The ADF table already shows the differenced row ("reject") before differencing is taught.
  - The 'c'/'ct' run labels are unexplained.
  - "Lower rejects" is never said.
  - ADF is never spelled out.
- **difference-by-hand:**
  - The Formula steps ahead of the narration.
  - Beats say the yearly wiggle survives; then the gate says "one difference was enough, stop".
- **autocorrelation:**
  - The r readout shows 0.87 during the "roughly what at lag 1?" predict.
  - The lag-12 predict can be read by sliding.
  - It never says that Pearson r on the scatter differs from the ACF estimator, though `acf-hand` penalises Pearson.
  - φᵏ appears in labels before φ is introduced.
  - The PACF gets one sentence and no picture.
  - No practice or reflect gate.
- **baselines:**
  - RMSE and MAPE are defined only as final numbers.
  - The "seasonal naive forgets every year sits higher" explanation doesn't distinguish it from naive. The real reason: naive starts from December, already 0.55 above the 1997 average, and every miss has the same sign.
- **arima-assembled:**
  - AR, I and MA are never spelled out.
  - ε is unnamed.
  - The p/q DropBins is solvable by word-matching.
  - The errata pops up during the first hand computation.
  - "Residual ACF spike at lag 12" refers to a chart that isn't on stage.
  - P, D, Q are unexplained.
- **lag-features:**
  - "Train 1960–1997" doesn't explain why 1959 is dropped.
  - The new numbers (naive 1.080, ARIMA 0.600) are one-step scores, never distinguished from the earlier multi-step 4.527/1.900. "One-step" is used but undefined.
  - Scenario C is never discussed.
  - "Rolling mean" has no glossary entry.
- **Math & Code:**
  - `adf` lands before differencing on the Path.
  - The differencing step refers to a column not shown.
  - `assert` lines exist only to hold anchors.
  - The ACF pitfall mentions an undrawn band.
  - The "slow fading → difference again" pitfall contradicts the scene 6 "stop" (the differenced ACF at lags 12/24/36 is 0.916/0.884/0.864).
  - No PACF section.
  - The general ARIMA equation is never shown.
  - The decomposition one-liner is heavy.
- **Application:**
  - The CO₂ comparison is shaky: it says growth is "about 1.5 ppm" while the lesson says about 2, and the ratio argument doesn't separate CO₂ from the coop.
  - The Δ₁₂ lag-12 ACF is computed on 16 values.
  - No ARIMA, ADF or ACF evidence is used.
- **Quiz:**
  - 37 templates. Difficulty is 18/16/3.
  - Nothing tests one-step vs multi-step, the ARIMA family, the names behind AR/I/MA, or history.
  - Two order items have more than one defensible order.
- **Glossary:**
  - All 33 terms are defined, so the audit lint is stale.
  - The p-value entry aliases "null hypothesis".
  - The drift entry says 0.116 against the scene's 0.104.
  - Missing entries: rolling mean, one-step forecast, month columns.

**Issues:**

| # | Sev | Where | Problem | Suggested fix |
|---|---|---|---|---|
| 1 | High | intuition.yaml:858-875; math-code.yaml:776-777 | Scene 8: ARIMA MAE 1.900, naive 4.527. Scene 10: naive 1.080, ARIMA 0.600, with no explanation. I'd conclude regression is about 9× better than ARIMA. | Beat before 858: "Until now each forecast was made once from Dec 1997 for all 48 months (**multi-step**). Here every month sees the real month before it (**one-step**): naive drops 4.527 → 1.080, ARIMA 1.900 → 0.600. Compare like with like." Add a predict, a glossary term and a quiz item. |
| 2 | High | intuition.yaml:483-493; math-code.yaml:537 | Three conflicting messages on differencing: the wiggle survives; "stop, one difference is enough"; slow ACF fading means "difference again". | Gate: "Reject H₀: d = 1 is enough. ADF doesn't look for seasons; the yearly wiggle goes to Δ₁₂ / SARIMA." Pitfall: "slow fading at lags 1, 2, 3 → difference again; slow fading only at 12, 24, 36 → seasonal difference." |
| 3 | High | intuition.yaml:576-579, 737-745; quiz.yaml:345-347, 358-377 | The PACF gets one sentence, no picture, yet I must match p ↔ PACF and do `pacf-numeric` with an untaught formula. | Show PACF charts (AR(1): one bar; MA(1): decays) and add a predict. Add a math section using (r₂ − r₁²)/(1 − r₁²) on the CO₂ diffs (→ −0.50). Fix audit C3. |
| 4 | Med | intuition.yaml:479 vs 747; glossary.yaml:158 | Average 0.104 vs drift 0.1156 "average monthly change". | "c = 0.1156, the model's long-run average change estimate, a little above the plain 0.104 because the model also accounts for how changes carry over." |
| 5 | Med | intuition.yaml:657-663; quiz.yaml:432-442 | The explanation of why seasonal naive is worse doesn't separate it from naive. | "Both sit below every real month; naive starts 0.55 higher. When every miss has the same sign, the right shape doesn't shrink MAE, but a higher starting level does." |
| 6 | Med | intuition.yaml:546-561 | The r readout shows the answer. | Hide `r` until after the gate, or start at k = 3. |
| 7 | Med | intuition.yaml:200-215 | The lag gates are lookups. | Show a y-only table and reveal the lag columns afterwards. |
| 8 | Med | intuition.yaml:390-391; glossary.yaml:66 | "The random walk hardly moves" contradicts the chart. | "It looks harmless, yet it is **not** stationary: it drifts with no level to return to. Compare its half-averages." |
| 9 | Med | intuition.yaml:366-369, 394; math-code.yaml:546 | The ADF table and section show "difference → d = 1" before differencing is taught; c/ct are cryptic. | Show only level-c in scene 5 and add diff-c in scene 6. Tag `adf` with `[stationarity, differencing]`. Gloss c/ct. |
| 10 | Med | intuition.yaml:271 | The random-forest callout uses MAE, naive and trees before they're defined. | Rephrase without those terms. |
| 11 | Med | intuition.yaml:733-736; quiz.yaml:601-619 | AR, I and MA are never spelled out, and MA is easy to confuse with the rolling mean. | Expand the three names, with an explicit contrast to the rolling mean. Add a quiz item. |
| 12 | Med | intuition.yaml:719-745 | The p/q bins are solvable by word matching. | Label the bins by evidence ("PACF cuts off after k"…). |
| 13 | Med | intuition.yaml:727-758 | The errata appears during the first ARIMA computation. | Move it after the practice gate, or to math-code only. |
| 14 | Med | intuition.yaml:770-772 | The residual ACF spike is described but not shown. | Add a chart or a Readout. |
| 15 | Med | intuition.yaml:9-11; logic.js:49 | The flat "hidden (your forecast)" line biases the guess. | Use a shaded band labelled "hidden months". |
| 16 | Med | math-code.yaml:254 | The narration refers to a change column that isn't shown. | Use the `annualDiff` output. |
| 17 | Med | quiz.yaml:129-145 | `forecast-workflow` wants the notebook's order, which contradicts the module's. | Drop or merge the stationarity item. |
| 18 | Med | quiz.yaml:695-711 | The first three steps of `features-order` can go in any order. | Merge them. |
| 19 | Med | quiz.yaml:554-572; logic.js:787 | No misconception for the notebook's as-written ARIMA error (365.71). `wrongNoC` is unused. | Add `wrongAsWritten`. |
| 20 | Med | intuition.yaml:500-580 | No practice or reflect in autocorrelation; no reflect in ARIMA. | Add `practice: acf-hand`, and a reflect on why forecasts become a straight climb. |
| 21 | Med | application.yaml:83-88 | The CO₂ comparison is shaky ("1.5 ppm"). | Reframe it around the 4-year horizon and same-sign misses. |
| 22 | Med | intuition.yaml:859 | Why 1959 is dropped isn't explained. | "(1959 is dropped: its lag_12 would come from before the data starts)." |
| 23 | Low | intuition.yaml:216-221 | k = 24 is rejected. | `k % 12 == 0`. |
| 24 | Low | intuition.yaml:148 | "Trend need not be straight" while the slider is straight-only. | Reword. |
| 25 | Low | intuition.yaml:130, 542, 561 | El Niño is called "cyclic", yet the data shows a yearly cycle. | One reconciling line. |
| 26 | Low | intuition.yaml:480-482 | The Formula steps early. | Move the step. |
| 27 | Low | intuition.yaml:816-875 | Scenario C is never discussed. | Add a beat ("more past didn't help; the calendar did"). |
| 28 | Low | glossary | Missing rolling mean, month columns and one-step forecast. | Add them and `define` them. |
| 29 | Low | math-code.yaml:120-139 | `assert` lines exist only to hold anchors. | Use a real line. |
| 30 | Low | math-code.yaml:536 | The band mentioned isn't drawn. | Draw it or drop the mention. |
| 31 | Low | quiz.yaml:205-226 | `gallery-match` can be solved by keyword. | Strip the verdict words. |
| 32 | Low | quiz.yaml:640-675 | `arima-code` rejects `48`; `roll-numeric` doesn't state the decimals. | Accept 48 and state "3 decimals". |
| 33 | Low | quiz.yaml:148-167 | The hint gives the answer away. | Make it a nudge. |
| 34 | Low | glossary.yaml:73-76 | "Null hypothesis" is aliased to p-value. | Give it its own term. |
| 35 | Low | quiz spread | 3 level-3 items, little transfer. | Add a new-series level-3 item. |

Audit items that also hurt learning: **C3** (impossible PACF values, the only PACF practice), **C4** (seasonal naive beyond one season), **T5**, the lag/naive distractor collisions, and the `adfQ` near-critical pairing.

**Coverage gaps vs lecture:**
- The history slides (exponential smoothing, Box–Jenkins, ML, TimesFM) are absent.
- VAR and GARCH are missing. ARIMAX appears only in a table.
- There's no PACF plot. How p = 1, q = 1 was supported is never shown.
- The general ARIMA equation appears only in the glossary, in the wrong form.
- One-step vs multi-step is under-taught.
- The seasonal difference on CO₂ appears only in the Application.
- Multiplicative and multiple seasonality get one sentence.
- Forecast intervals appear only in extraCode.
- Possibly over-taught: the decomposition section.

**Top 5 improvements:**
1. Add a one-step vs multi-step beat, glossary term and quiz item.
2. Reconcile differencing, seasonality and ADF, and fix the ACF pitfall.
3. Teach the PACF visually, with a short math section, and fix C3.
4. Make the gates require thinking: hide the lag columns and r, and relabel the p/q bins by evidence.
5. Fix the confusing number explanations: drift vs mean, seasonal naive, the random walk, the CO₂ comparison.

---

