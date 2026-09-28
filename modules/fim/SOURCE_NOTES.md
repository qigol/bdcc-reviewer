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
