# Source notes — Cost Flows: Supplemental Notes

## Source
- File: Session6A_Process_Costing-Supplemental_Notes.pdf | Session: 6A (ACCT 2302, Principles of Managerial Accounting, AIM, Fall 2026) | Instructor: Agerico G. "Gerry" Agustin | 33 slides
- Textbook mapping on the title slide: Cornerstone Ch. 6, Canadian (Weygandt) Ch. 4.
- Despite the title, most of the deck reviews job-order cost flows (slides 3–17); process costing is slides 18–26, then JIT (27–29) and an ABC preview (30–32).

## Concept inventory (deck order)
1. Quiz 1A, cost concepts and regression (Marikina Shoe Manufacturing) — slide 2.
2. Summary of cost terms: DM, DL, MOH; prime and conversion cost; selling and administrative period costs — slide 3.
3. Cost flows in a manufacturing firm, from DM/DL/MOH through WIP, Finished Goods and COGS to net income — slide 4.
4. Why use estimated data; the predetermined overhead rate — slides 5–6 (Parker Company ₱600,000 / 75,000 MH = ₱8/MH).
5. Application of overhead to jobs — slide 7 (job: DM ₱5,000, DL ₱3,000, 500 MH → ₱12,000).
6. Flow of documents: sales order → production order → materials requisition, time ticket, POHR → job cost sheet — slide 8.
7. Materials requisition, job cost sheet and employee time ticket for Job 2B47 — slide 9 (images).
8. Reeder Company journal entries (a)–(k) — slides 10–12.
9. T-accounts — slide 13; disposition (close or allocate) — slide 14; income statement — slide 15; under- and overapplied overhead — slide 16.
10. Summary of cost flows (what each account is debited and credited for) — slide 17.
11. Job-order vs process costing — slide 18; T-account model of process costing flows — slide 19.
12. Equivalent units, weighted-average (Halsey Company) — slide 20; FIFO — slide 21; overview diagram — slide 22.
13. The production report's three parts — slide 23; WA report — slide 24; FIFO report — slide 25 (images); WA vs FIFO differences — slide 26.
14. JIT: definition, pull vs push, five key elements — slide 27; benefits and manufacturing time — slide 28; Kanban vs JIT — slide 29.
15. Activity-based costing: activities as cost drivers, three improvements — slide 30; Sarver Company example — slides 31–32 (images).

## Formulas (verbatim, as TeX)
- Cost equation (Quiz 1A): `Y = a + bX` with a = 25{,}000, b = 8.50 — slide 2
- Prime cost `\text{DM} + \text{DL}`; conversion cost `\text{DL} + \text{MOH}` — slide 3
- `\text{POHR} = \frac{\text{Estimated total manufacturing overhead}}{\text{Estimated total activity (DLH, MH, etc.)}}` — slide 6
- `\text{Actual overhead} - \text{Applied overhead} = \text{Under-applied overhead}` — slide 16
- `\text{Processing} + \text{Inspection} + \text{Move} + \text{Wait} = \text{Manufacturing time}` — slide 28

## Worked examples (exact numbers)
- Quiz 1A — slide 2 — Y = 25,000 + 8.50 × 3,000 = 50,500. (→ quiz1a-predict, scene cost-vocabulary)
- Parker — slides 6–7 — ₱8/MH; overhead 4,000; job cost 12,000. (→ parker-rate-job)
- Job 2B47 — slide 9 — Req. 14873: 150 × 1.64 + 300 × 1.38 = 660; reqs 660 + 506 + 238 = 1,404; tickets 45 + 60 + 21 + 54 = 180 for 27 hours; overhead 27 × 8 = 216; total 1,800; 150 units → 12.00. Mary Holden's ticket: 5 h on 2B47, 2 h on 2B50, 1 h maintenance at 9.00 = 72. (→ job-2b47, job-2b47-walk, holden-ticket)
- Reeder (a)–(k) — slides 10–12 — rate 315,000 / 210,000 = 150%; applied 300,000; insurance 16,000/4,000. (→ reeder-cycle)
- Reeder T-accounts — slide 13 — RM 10,000; WIP 60,000; FG 90,000; MOH 10,000 debit; COGS 600,000. (→ reeder-balances, reeder-ledger-walk)
- Disposition — slide 14 — close: COGS +10,000; allocate 8% / 12% / 80% → 800 / 1,200 / 8,000. (→ reeder-close, reeder-allocate)
- Income statement — slide 15 — sales 900,000; COGS 610,000; GM 290,000; S&A 90,000 + 4,000 + 100,000 + 15,000 = 209,000; NI 81,000. (→ reeder-income, reeder-income-walk)
- Under/overapplied — slide 16 — actual 310,000 vs applied 300,000 → underapplied 10,000. (→ reeder-cycle)
- Halsey — slides 20–22 — WA EU 189,000 / 181,000; FIFO 0 + 160,000 + 14,000 = 174,000 and 3,000 + 160,000 + 6,000 = 169,000. (→ halsey-wa, halsey-fifo)
- Production report — slides 24–25 — beginning 10,000 units (100% / 90%; cost 3,520 + 7,208); started 190,000; completed 180,000; ending 20,000 (100% / 25%); added 74,480 + 148,192. WA: EU 200,000 / 185,000; unit 0.39 / 0.84; transferred 221,400; ending 7,800 + 4,200 = 12,000; total 233,400. FIFO: EU 190,000 / 176,000; unit 0.392 / 0.842; transferred 10,728 + 842 + 209,780 = 221,350; ending 7,840 + 4,210 = 12,050. (→ report-wa, report-fifo, report-fifo-walk)
- Sarver — slides 31–32 — old rate 900,000 / 50,000 DLH = 18; activity rates 51, 20, 135, 7.85, 120; overhead A 392,200 → 98.05/unit, B 507,800 → 25.39/unit; unit cost A 98.50 → 151.55, B 80.00 → 69.39. Spreadsheet on slide 31: 200,000 / 340 setups = 588.24. (→ sarver-abc, sarver-sheet-rate)

## Journal entries, schedules and statements (journal workbench)
- Entries (a)–(k) as on slides 10–12, with the slide's account titles in title case: Raw Materials, Accounts Payable, Work in Process, Manufacturing Overhead, Wage and Salary Expense, Salaries and Wages Payable, Insurance Expense, Prepaid Insurance, Advertising Expense, Depreciation Expense, Accumulated Depreciation, Finished Goods, Accounts Receivable, Sales, Cost of Goods Sold. "Accounts payable (or cash)" in (d) and (f) is shown as Accounts Payable. (→ reeder-entries section, reeder-year scene)
- T-accounts for RM, WIP, MOH, FG and COGS with opening balances (slide 13). (→ reeder-taccounts)
- Disposition entries (slide 14), both forms. (→ over-under)
- Income statement (slide 15). (→ income-statement)
- Production report in three schedules: quantity schedule with EU, unit costs, cost reconciliation (slides 24–25). (→ production-report)

## Conventions & ambiguities
- Currency: the deck uses ₱ for Parker and Quiz 1A but $ for Reeder, Halsey, the production report and Sarver. The module uses ₱ throughout (the course's currency); the numbers are unchanged.
- Process-costing account titles follow slide 19 ("Work in Process – Department A"); this module needs only the single-department report, so no transfer entries are drawn.
- Allocation of the overhead balance rounds each share to the whole peso and lets COGS take the rounding difference (the slide's shares are exact).
- Halsey's materials are 100% complete in beginning inventory, so FIFO's "work to complete beginning inventory" for materials is 0.

## Errata / inconsistencies found
- Slide 10, entry (c): "Indirect Labor, $85,0000" — read as $85,000 (the entry and the T-account use 85,000).
- Slide 12, entry (h): "Direct labor cost, $210,0000" — read as $210,000 (the slide's own division uses 210,000).
- Slide 17: under Salaries and Wages Payable / Direct Labor, the debit side reads "Debited for the cost of materials purchased", copied from the Raw Materials box. The account is credited for labor incurred (and debited when wages are paid).
- Slide 20: the EU totals print as "189.000 181.000" with periods for thousands separators.
- Slide 2: Quiz 1A covers Sessions 1–3 (cost behavior and regression), not this session; it is treated as a warm-up in the cost-terms section.
- Slide 30 lists "Machine time" and "Power consumed" as activities; the ABC section keeps to Sarver's five activities.

## What I added beyond the slides
- JIT manufacturing-time numbers (2 + 0.5 + 1 + 4.5 hours) — the slide gives only the formula; illustrative numbers make the value-added share concrete.
- The cost-terms section's prime/conversion/product/period totals use Reeder's figures (DM 136,000, DL 200,000, actual MOH 310,000) to tie the vocabulary to the year that follows.
- Application case (Mabini Metalcraft) — synthetic, same structure as Reeder: rate 120%, applied 720,000 vs actual 680,000 → overapplied 40,000; close → COGS 1,460,000, NI 660,000; allocate (10/15/75%) → COGS 1,470,000, NI 650,000.
