# Source notes — Frequent Itemset Mining & Association Rules

## Source
- File: 3-4-fim.pdf | Sessions: 3–4 | Date: 2026-09-09 | Pages: 11 (handout, 6 slides per page; slide n is on page ⌈n/6⌉)

## Concept inventory (lecture order)
1. Frequent itemset mining — slide 2 — find itemsets with support ≥ minsup
2. Association pattern mining — slide 3 — rules that predict an itemset from another
3. Database, transactions, items, itemsets (k-itemsets) — slides 4–7
4. Absolute support — slide 8 — number of transactions containing the itemset
5. Relative support — slide 9 — fraction of transactions containing the itemset
6. Frequent itemset / minsup (absolute and relative) — slides 10–13
7. Three ways to find frequent itemsets — slide 14 — brute force, Apriori, FP-growth
8. Brute force — slides 15–16 — evaluate the support of every possible itemset
9. Apriori — slides 17–19 — evaluate only supersets of frequent itemsets
10. FP-growth — slides 20–40 — successively filter the database (prefix-projected databases)
11. Comparison — slide 41 — brute force simple but expensive; Apriori faster but more complicated; FP-growth parallelizable but complicated to implement
12. Association rules, antecedent → consequent — slide 42
13. Confidence — slide 43 — Conf(A→B) = P(B|A) = Sup(A∪B)/Sup(A)
14. Finding rules — slides 44–60 — frequent itemsets first, then every antecedent/consequent split, keep those with conf ≥ minconf
15. Lift — slides 61–62 — Conf(A→B)/RelSup(B); >1 positive, =1 none, <1 negative

## Formulas (verbatim, as TeX)
- Absolute support: `\text{AbsSup}(X) = |\{T \in D : X \subseteq T\}|` — slide 8
- Relative support: `\text{RelSup}(X) = \text{AbsSup}(X)/|D|` — slide 9
- Frequent: `\text{Sup}(X) \ge \text{minsup}` — slide 10
- Confidence: `\text{Conf}(A \rightarrow B) = P(B \mid A) = \frac{\text{Sup}(A \cup B)}{\text{Sup}(A)}` — slide 43
- Lift: `\text{Lift}(A \rightarrow B) = \frac{\text{Conf}(A \rightarrow B)}{\text{RelSup}(B)}` — slide 61

## Worked examples (exact numbers)
- AbsSup over the 5-basket DB — slide 8 — {bread,butter,milk}=1, {bread,butter}=1, {bread,milk}=2, {butter,milk}=1, {bread}=2, {butter}=1, {milk}=5 (→ abs-support-*)
- RelSup — slide 9 — 1/5=0.2, 1/5=0.2, 2/5=0.4, 1/5=0.2, 2/5=0.4, 1/5=0.2, 5/5=1 (→ rel-support-*)
- minsup = 3 → only {milk} among the listed itemsets — slide 10 (→ frequent-among-3)
- minsup = 2 → {bread,milk}, {bread}, {milk} — slide 11 (→ frequent-among-2)
- minsup = 0.5 → only {milk}; minsup = 0.4 → {bread,milk}, {bread}, {milk} — slides 12–13 (→ frequent-among-rel)
- Brute force — slide 16 — AbsSup({bread,cheese,eggs,milk}) = 1, eggs 3, yogurt 3, cheese 2; 2⁶ − 1 = 63 itemsets for 6 items (→ brute-*)
- Apriori, minsup = 2 — slide 19 — 10 two-item candidates; {milk,eggs,yogurt} = 2 is the only frequent 3-itemset (→ apriori-*)
- FP-growth, minsup = 2 — slides 21–40 — 18 prefixes explored, 11 frequent itemsets (→ fp-growth-*)
- Conf({bread}→{butter}) = 1/2 = 0.5 — slide 43 (→ conf-bread-butter)
- Frequent itemsets at minsup 2 — slide 45 — 11 itemsets (→ frequent-minsup-2)
- Conf(yogurt→milk)=1, Conf(milk→yogurt)=0.6 — slide 47; Conf(eggs→milk)=1, Conf(milk→eggs)=0.6 — slide 49
- {eggs,yogurt}→milk = 1, {eggs,milk}→yogurt = 0.67, {yogurt,milk}→eggs = 0.67 — slide 51; eggs→{yogurt,milk} = 0.67, yogurt→{eggs,milk} = 0.67, milk→{eggs,yogurt} = 0.4 (rejected) — slide 52
- eggs→yogurt = yogurt→eggs = 0.67 — slide 54; bread→milk = 1, milk→bread = 0.4 (rejected) — slide 56; cheese→milk = 1, milk→cheese = 0.4 (rejected) — slide 58
- minsup 2, minconf 0.6 → 13 rules — slide 60 (→ rules-13)
- Lift(bread→butter) = 0.5/0.2 = 2.5 — slide 61; Lift(bread→eggs) = 0.5/0.6 = 0.83 — slide 62

## Conventions & ambiguities
- Support counts transactions, not item occurrences — reproduces every slide 8 value.
- minsup below 1 is relative, otherwise absolute — slides 12–13 use 0.5 and 0.4, slides 10–11 use 3 and 2.
- The lecture's Apriori (slide 19) does **not** apply the classic "all (k−1)-subsets frequent" prune: it counts {bread, milk, eggs} although {bread, eggs} is infrequent. It extends every frequent itemset by one frequent item that comes later in the order bread, butter, milk, eggs, yogurt, cheese. This reproduces the 10 two-item candidates on slide 19. The slide's list stops at {milk, yogurt, cheese}; the scheme also counts {eggs, yogurt, cheese} (support 0) and {milk, eggs, yogurt, cheese} (support 0), which the slide omits (probably for space). Classic join+prune Apriori is taught as a `beyond` extra (17 candidates instead of 24).
- FP-growth as taught is prefix-projected database filtering in alphabetical order (slides 21–40), not FP-tree construction. The order of prefixes on the slides (bread, bread-butter, bread-cheese, bread-eggs, bread-milk, butter, cheese, …, yogurt) is exactly a depth-first walk that projects on each item present in the current database; infrequent prefixes are shown but not expanded.
- Rule generation takes every non-empty proper subset of a frequent itemset as antecedent (slides 47–60).
- Lift uses the relative support of the **consequent** (slides 61–62).

## Errata
- slide 25: the {bread, eggs}-projected database shows transaction 1 with {milk}; it should be transaction 3 (T1 = {bread, butter, milk} has no eggs). The support (1) is unaffected.
- slide 62: the lift legend is garbled ("Lift = 1: more likely for precedent and antecedent to go together…"). Slide 61's wording is correct: > 1 positive association, = 1 no association, < 1 negative association.

## Beyond the slides
- Classic Apriori join + prune (math-code section `apriori-classic` callout) — standard textbook version; shows why pruning before counting saves work.
- Leverage and conviction (section `leverage-conviction`) — common rule metrics in mlxtend/Spark output.
- PySpark `FPGrowth` and mlxtend in the Application tab — how it is done at scale.

## Skill map
- support: absolute and relative support
- frequent-itemset: minsup, frequent itemsets, antimonotonicity
- brute-force: the 2ⁿ − 1 lattice
- apriori: the Apriori principle and the level-wise run
- fp-growth: projected databases
- rules: rule generation from frequent itemsets
- confidence: conf as P(B|A)
- lift: lift and its interpretation
- interpretation: acting on rules, the milk trap

## Revision 1.1 — count-along (2026-09-30)
- Intuition now counts every support on screen instead of reporting results: `support` walks the baskets one by one (running tally, ✓ +1 / ✗ +0 per row); `supportGridWalk` fills the slide-8 table row by row and replays the four minsup settings of slides 10–13; `bruteForceWalk` counts all 2⁶ − 1 = 63 itemsets (38 of them are 0); `aprioriWalk` counts all 24 candidates of the slide-19 scheme with the candidate-generation step spelled out; `fpWalk` shows, for every filtered table of slides 21–40, a tick grid with each remaining item's count, then decides each of the 18 prefixes; `rulesWalk` computes all 16 candidate rules of slides 47–60; `liftWalk` computes lift for all 13 kept rules.
- Rule order in `rulesWalk` follows the slides: itemsets in slide-45 order, items written as on the slides (e.g. {eggs, yogurt, milk}), bigger antecedents first (slides 51–52).
- Math & Code: every section's trace is line-level (one anchor per code line) and walks every loop iteration, e.g. `supportCode`, `bruteForceCode` (208 steps), `aprioriCode`, `fpGrowthCode` (recursive calls with their prefix), `confidenceCode` (single pass), `rulesCode`, `liftCode`.
- Examples added as regression checks for the walks: brute-walk-63, apriori-walk-24, fp-walk-18, rules-walk-13.

## Revision 1.2 — learner review 2026-10-05 (guide edition 2)
- Guide 2: objectives in the manifest; every glossary term is `define`d in one Intuition beat. New terms: `database` (D, |D|), `lattice`, `superset`, `prefix`, `base-rate`. Leverage and conviction (beyond the slides) are defined in a closing milk-trap beat.
- Path order: scene `whats-in-a-basket` has no skills, `lecture-support-table` only `support`, `apriori-principle` only `frequent-itemset`. So the Math sections land after the scene that teaches them (support after counting-togetherness, frequent-itemsets after the-bar, apriori after apriori-run). minsup and "frequent" are defined in lecture-support-table, before the-bar uses them.
- Apriori principle vs the lecture's Apriori: the principle scene uses {bread, eggs} (both items frequent, pair infrequent) instead of {bread, butter}. It ends by calling its result "the classic, strict prune". The lecture-version callout now opens the apriori-run scene, before any count is asked. The 22 vs 24 count is explained in a callout after the run and in a math-code pitfall (scheme in Conventions above).
- Predicts asked before the reveal (guide 7.1b):
  - the-bar hides the slider and readout while "11" is asked;
  - "38 zeros" became a pre-play MCQ on ranges; the reveal narration gives the 4 + 13 + 14 + 7 breakdown (audit T2);
  - the level-3 "7" predict gives the five frequent pairs and asks before the run;
  - the re-asked "11 frequent" became a new question: total candidates at minsup 3 = 10 (6 + 3 + 1, checked with aprioriRun);
  - FP-growth's "18" became a pre-play Sup({cheese, milk}) = 2 inside D_{cheese};
  - "13 of 16 kept" became a pre-play MCQ on which antecedent fails;
  - the milk-trap Readout and Formula stay hidden until Lift(yogurt → milk) is answered.
- One stance on weak lift: a lift just above 1 (1.11 on 5 baskets, 1.15 on 30) is a weak positive association that could easily be chance. It is not "the only real association" and not "no connection". Big lift on an itemset below minsup (bread → butter, 2.5 on 1 basket) is called noise. Five rules have conf 1 and lift 1 ("fooled us five times"; the other two lift-1 rules have conf 0.6). The lift-1 rules are "milk alone as antecedent or consequent" (audit T3).
- Lift wording is non-causal everywhere: "baskets with A hold B more often than average".
- Notation: 𝓘 = all items (math-code brute force and Apriori); I = one frequent itemset (rule generation); k = antecedent size there; an itemset with m items gives 2^m − 2 rules. Every symbol is written out in words at first use: ⊆, ∈, #, |D|, ∀, ⊇, ⇒, ∖, P(B | A), n choose k.
- Conviction (audit T4): expected failures under independence divided by observed failures.
- Slide, session and example numbers are removed from learner-facing text. Errata read "If you're reading the slides: …" and appear after the gate they relate to. The {bread, eggs} erratum appears on the beat after the bread-branch gate, before the full walk.
- New quiz generators:
  - relMinsupQ (relative minsup → round up; keyed misconceptions);
  - aprioriCountQ (the lecture scheme with a given order; the classic-prune and brute-force counts are misconceptions);
  - fpEnumQ (full FP-growth enumeration);
  - liftSymQ (lift symmetry);
  - relMineQ (integrative level 3).
- Generator fixes:
  - ruleCountQ now draws k = 3–6 with a "single-item antecedents" misconception (the old k(k − 1) equalled 2^k − 2 for k = 2, 3);
  - handRuleQ redraws when Sup(A) = |D| or Sup(A) = Sup(B);
  - trapQ varies the common item (all baskets or all but one), and every option cites a computed number.
- Application:
  - minsup 15% × 30 = 4.5 is shown as "at least 5 (rounded up)" (`minsupCount` in frequentItemsets);
  - new cells ask for Lift(sardinas → itlog) = (3/5)/(9/30) = 2.0, then whether {sardinas, itlog} (support 0.10) is frequent at 15%;
  - decision options cite numbers;
  - the load-trap cell shows confidence and base rate, and the learner computes the lift.
- Re-audit (1.3.0):
  - apriori-run no longer re-asks which item fails minsup (answered in the previous scene); it asks how many level-2 candidates start with {milk} (3: eggs, yogurt, cheese), which introduces "extend only by later items" before the 10-pair predict.
  - Load-trap base rate is 26/30 = 0.867; it is printed to 3 decimals (0.75 / 0.867 ≈ 0.87) because 0.75 / 0.87 rounds to 0.86.
  - act-on-rule (quiz): RelSup(paracetamol) = 0.40 / 0.92 ≈ 0.435 from option 2, so option 3 is conf 0.35, lift 0.80 (0.35 / 0.435).
  - FP-growth cheese gate is a count-along on the cheese tick grid (counts hidden), like the bread gate.
- Re-audit 2 (1.4.0):
  - apriori-principle lattice gets no support map at all (the freq derive is gone). supportMap holds every itemset up to level 4, so showing it gave away the level-3 predict (only {eggs, milk, yogurt} shows 2). showSupport: false alone is not enough: ItemsetLattice still prints "support N" in each node's hover tooltip whenever a map is passed. Without minsup the map drove nothing else (no colouring; prune/highlight are set-based). Beat 0's narration gives the supports it needs, and the "support of your pick" Readout still answers the click-an-infrequent-pair gate.
  - Every StepPlayer is now hidden until the beat that asks the learner to play it (lecture-support-table, apriori-run), so no predict can be answered by scrubbing.
  - Confidence glossary: Sup is the count, one convention throughout (shares give the same ratio).
  - Load-trap supersedes the 1.3.0 note above: the 3-decimal base-rate Readout is gone; the say gives load as 26 of 30 baskets next to kape 12 of 30, so the learner picks the base rate. Options state comparative results without numbers, because the bundle cell already prints "lift 0.87" for kape + load and the say prints 75%.
