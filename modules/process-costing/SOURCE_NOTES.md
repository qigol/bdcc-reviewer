# Source notes — Process Costing

## Source
- File: Session6_Process_Costing.pdf | Sessions: 6 (ACCT 2302, Principles of Managerial Accounting, AIM, Fall 2026) | Instructor: Agerico G. Agustin | Pages: 69 PDF pages, slides numbered 1–82
- Textbook mapping on the title slide: Cornerstone Ch. 6, Canadian (Weygandt) Ch. 4.

## Concept inventory (lecture order)
1. Process costing defined; industries; averaging note — slide 9.
2. Job-order vs process costing revisited — slide 10; the averaging idea — slide 11.
3. Two cost categories: direct materials and conversion (DL + OH) — slide 12.
4. Example 1 classification — slide 13; industries — slide 15; hybrid (operation) costing — slide 16.
5. Five-step framework — slides 18–19 (physical units, equivalent units, total costs, unit cost, apply costs; Step 5 must reconcile).
6. Cost-of-production report — slide 20; product-cost connection — slide 21.
7. Physical flow equation — slide 22 (also detects lost units).
8. Multiple departments; transferred-in costs (third category, 100% complete, like material added at the start) — slides 23–24.
9. Example 2 physical flow — slide 25.
10. Equivalent units — slide 28; why materials and conversion differ — slide 29; Example 3 — slide 30; common trap — slide 32; three materials-addition patterns — slide 33; Example 3.5 (materials at end) — slide 34.
11. Example 4, full five-step solution with no beginning inventory — slides 37–40; why it matters — slide 41.
12. Example 4.5, a second month with beginning WIP (discussion) — slide 42.
13. Weighted-average method — slides 45–47; Example 5 EU — slide 48; Example 6 full WA report — slides 50–52.
14. FIFO method — slide 54; the one formula difference — slide 55; Example 7 FIFO EU — slide 56; head-to-head WA vs FIFO on Example 6 data ("Portland Cement") — slide 58; choosing a method — slide 59.
15. Connecting forward (standard costs, flexible budgets) — slide 60.
16. Example 6.5 journal entry for an interdepartmental transfer — slide 61.
17. Example 8 Nueva Ecija Rice Mill (WA) — slide 64; Example 9 Batangas Chemicals (transferred-in) — slide 66; Example 10 reconciliation error — slide 68; Example 11 Aklan FIFO with materials at end — slide 70.
18. Glossary recap, concept map, takeaways — slides 73–75; Example 12 Iloilo (choose FIFO) — slide 76; bridge — slide 78; strengths and limitations — slide 79.

## Formulas (verbatim, as TeX)
- Physical flow: `\text{Beginning Inventory} + \text{Units Started} = \text{Units Completed} + \text{Ending Inventory}` — slide 22
- WA equivalent units: `\text{EU} = \text{Units completed} + (\text{Ending WIP} \times \%\text{ complete})` — slide 45
- FIFO equivalent units: `\text{EU} = \text{Units completed} + (\text{Ending WIP} \times \%) - (\text{Beginning WIP} \times \%\text{ already done})` — slides 54–55
- Unit cost: `\text{Cost per EU} = \text{Total cost} \div \text{Equivalent units}`, per category — slide 18
- Reconciliation: `\text{Cost of completed} + \text{Ending WIP} = \text{Total costs to account for}` — slide 19

## Worked examples (exact numbers)
- Ex 1 — slide 13 — brewery process, jeweler job, refinery process, renovation job. (→ scene why-average)
- Ex 2 — slide 25 — 0 + 18,000 = 8,000 + 10,000. (→ cavite-flow)
- Ex 3 — slide 30 — EU materials 8,000 + 10,000 = 18,000; conversion 8,000 + 2,000 = 10,000. (→ cavite-eu)
- Ex 3.5 — slide 34 — materials at end: EU 12,000 + 0 = 12,000; conversion 12,000 + 1,500 = 13,500. (→ bottling-eu)
- Ex 4 — slides 38–40 — unit costs 27,000/18,000 = 1.50, 25,000/10,000 = 2.50, combined 4.00; completed 8,000 × 4 = 32,000; ending WIP 15,000 + 5,000 = 20,000; total 52,000. (→ cavite-report)
- Ex 5 — slide 48 — WA EU 6,500 / 6,100. (→ depta-eu)
- Ex 6 — slides 51–52 — EU 45,000 / 41,500; totals 53,500 / 577,500; unit costs 1.1889 / 13.9156; combined 15.1046; completed ≈ 604,184; ending WIP ≈ 5,944 + 20,874 = 26,818; total 631,000. (→ portland-wa, portland-wa-assign)
- Ex 7 — slide 56 — FIFO EU 6,500 − 1,500 = 5,000; 6,100 − 1,000 = 5,100. (→ depta-eu)
- Head-to-head — slide 58 — FIFO EU 44,200 / 41,020; unit 0.9389 / 12.7133; completed 607,235; ending WIP 23,765 (WA 604,184 / 26,818). (→ portland-fifo, portland-compare)
- Ex 6.5 — slide 61 — transfer ₱288,000 from Milling to Packaging. (→ nueva-transfer)
- Ex 8 — slide 64 — EU 20,000 / 17,000; unit 9.00 / 9.00; completed 288,000; ending WIP 45,000; total 333,000. (→ nueva-wa)
- Ex 9 — slide 66 — EU TI 10,000, materials 8,000, conversion 9,200; unit 15, 8, 12 = 35; to FG 280,000; ending WIP 44,400; total 324,400. (→ batangas-ti)
- Ex 10 — slide 68 — 450,000 vs 380,000 + 60,000 = 440,000; gap 10,000. (→ reconcile-gap)
- Ex 11 — slide 70 — FIFO materials 9,000 − 0 = 9,000; conversion 9,800 − 700 = 9,100. (→ aklan-fifo-eu)
- Ex 12 — slide 76 — FIFO for Iloilo Sugar Refinery (qualitative). (→ method-mcq, scene when-it-breaks)

## Journal entries, schedules and statements (journal workbench)
- Slide 61 (Example 6.5): Dr Work-in-Process – Packaging Department 288,000; Cr Work-in-Process -- Milling Department 288,000. If Milling were the final department the debit would be Finished Goods Inventory. (→ transfer-entries section)
- Example 9's transfer to finished goods (implied by "cost transferred to Finished Goods"): Dr Finished Goods Inventory 280,000; Cr Work-in-Process – Blending Department 280,000. (→ transferred-in section)
- The cost-of-production report is built as three schedule blocks: Steps 1–2 (quantity schedule and EU), Steps 3–4 (costs and cost per EU), Step 5 (assignment and reconciliation), in the order slides 38–40 and 51–52 present them.
- Chart of accounts: Work-in-Process – <Department> Department, Finished Goods Inventory.

## Conventions & ambiguities
- Department WIP accounts are titled "Work-in-Process – X Department". Slide 61 prints one with an en dash and one with a double hyphen; the module uses the en dash for both.
- Example 5/7's 66.67% is stored as 2/3 (0.666…), which gives the slide's 1,000 equivalent units exactly.
- Example 6 rounds each unit cost to 4 dp (1.1889, 13.9156, combined 15.1046) and marks the dollar amounts "≈". The module computes unrounded (604,182.06 completed; 26,817.94 ending WIP) and checks the slide's figures within ₱2.50; labels show 4 dp.
- FIFO completed cost = beginning WIP cost + cost to finish beginning WIP (its remaining % × current unit cost) + started-and-completed units × combined current unit cost; reproduces 607,235.
- Transferred-in cost is a third category, always 100% complete (slide 24); Batangas' 10,000 transferred units are entered as "started".
- Example 4.5 gives no June costs, so it is used only for the "why beginning WIP changes everything" discussion.

## Errata
- None that change a result. Slide 52's amounts are approximate by design (marked ≈); the module notes this where they appear.

## Beyond the slides
- The application case (Laguna Coco Gold, two departments) is synthetic and reuses the lecture's methods.
- "In practice" notes on ERP process costing, percent-complete estimates and month-end controls.

## Skill map
- pc-basics: concepts 1–4.
- physical-flow: concept 7, Ex 2.
- equiv-units: concept 10, Ex 3, 3.5.
- five-steps: concepts 5–6, 11, Ex 4, Ex 10.
- weighted-avg: concept 13, Ex 5, 6, 8.
- fifo: concept 14, Ex 7, head-to-head, Ex 11.
- choose-method: concept 14 (choosing), Ex 12.
- transferred-in: concept 8, Ex 6.5, Ex 9.
