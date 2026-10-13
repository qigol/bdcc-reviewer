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

### Revision 1.1.0 (learner review 2026-10-05): judgment calls and conventions
- **Framed as a review.** Title "Cost Flows: One Year of Books (Review)"; the summary says to take it after job-order and process costing and lists what is new (T-accounts, the full (a)–(k) cycle, closing into the income statement, the three-part report, JIT, ABC preview). Prerequisites unchanged.
- **Cross-module account titles (X11).** The journal grader matches strings within this module, so the notes' titles stay (Manufacturing Overhead, Raw Materials, Work in Process, Finished Goods, Salaries and Wages Payable). Glossary `aka`/`long` name the other modules' titles for the same accounts: Factory Overhead and Raw Materials Inventory and Wages Payable (job-order), Finished Goods Inventory and Work-in-Process Inventory (process-costing).
- **Allocation basis (audit T7), agreed wording**, used in the glossary, the over-under section and the Application trade-offs: "The notes spread over/underapplied overhead by ending balances; the job-order module prorates by the applied overhead in each account, which is more precise. Both are accepted methods." Job-order keeps prorating by applied overhead.
- **Three parts vs five steps.** The process-costing module's five steps map onto the notes' three parts: Steps 1–2 = Part 1, Steps 3–4 = Part 2, Step 5 = Part 3 (Callout in the production-report scene, glossary, math-code, Application connections).
- **Value-added share = MCE.** The JIT value-added share is the abm module's manufacturing cycle efficiency; cross-referenced in the glossary, math-code and connections.
- **Cost-terms section numbers.** The prime/conversion/product totals on Reeder's year now use *applied* overhead (DM 136,000 + DL 200,000 + applied 300,000 = 636,000 product cost), matching the job-order rule that WIP receives only applied overhead; selling and administrative costs are one line (209,000), replacing an invented selling/administrative split.
- **Regression warm-up.** The lecture's Quiz 1A is kept as a reading exercise (intercept = fixed part, slope = variable rate, R²), with glossary terms; the cost-regression module teaches the fitting. The `classify` objective now says "a given cost equation". Learner text no longer says "Quiz 1A".
- **Document flow (slide 8).** Sales order → production order → requisitions, time tickets, POHR → job cost sheet is taught in a beat; sales order and production order use standard textbook definitions.
- **Job vs process (slides 18–19).** Taught in one bridge beat (unique jobs traced vs identical units averaged; one WIP account per department) with the standard textbook distinction. Check against slides 18–19's wording if it differs.
- **JIT five elements (slide 27).** Taught as the five the quiz already used (few suppliers delivering small lots often, machines grouped into cells, reduced setup time, total quality control, a flexible multi-skilled work force), each paired with the waste it removes (the pairing is the standard textbook reading, not printed on the slide as such). Benefits (slide 28) summarized as less inventory, time and defects.
- **ABC's three improvements (slide 30)** are not in these notes' inventory text, so the module does not state them; to add when the slide wording is available.
- **Unnamed production-report company (slides 24–25).** The notes don't name it; the scene says so rather than inventing a name.
- **Debit/credit primer and liability/contra accounts** (Accounts Payable, Salaries and Wages Payable, Prepaid Insurance, Accumulated Depreciation) are glossed with standard definitions; the lecture assumes them.
- **One name for the ₱90,000:** "selling and administrative salaries", recorded as Wage and Salary Expense.
- **Application additions (synthetic).** Mabini's powder-coating line (December, weighted-average): beginning 1,000 panels 60% converted with ₱4,000 + ₱9,000; 18,000 started; 17,000 finished; 2,000 left at 50%; added ₱72,000 + ₱171,000 → EU 19,000 / 18,000, unit costs ₱4.00 / ₱10.00 (FIFO conversion ₱9.83 is a distractor). Setup pool ₱120,000 for 400 setups → ₱300 per setup; the ornamental gate's 6 setups → ₱1,800 vs ₱360 on 60 of 20,000 labor hours. Checked in examples.yaml (mabini-coat, mabini-coat-fifo, mabini-setup-rate, mabini-close).
- **Generators.** Every generator misconception is keyed with `for`; `euQ` skips 50% beginning conversion under FIFO (work done = work to do); `yearQ` and `incomeQ` redraw loss years; `yearQ` redraws when allocating would barely differ from closing; `abcQ` redraws when the old labor-hour overhead nearly equals the ABC answer.

### Revision 1.2.0 (re-audit): judgment calls and conventions
- **Application cells are all on screen at once**, so no cell may show a number another cell asks for. The rate cell asks for the predetermined rate (120.0%; distractors 116.0% = 696,000 ÷ 600,000 actual labor, 83.3% = 580,000 ÷ 696,000 inverted, 117.2% = 680,000 ÷ 580,000 actual overhead); the ₱720,000 applied amount moves to its model. Up to 1.2.0 entry (h)'s journal memo printed "120%" beside this cell; 1.3.0 removed it (see below). The rate can still be recovered from the entries journal as applied ÷ actual direct labor (720,000 in (h) ÷ 600,000 in (c)). That is an accepted path: it takes a computation, and it is the rate's definition run backwards. The ledger cell shows account totals (`balances().balanceRows`: debits, credits, balance) instead of T-accounts, so entry (e)'s ₱45,000 Manufacturing Overhead debit is not printed beside the entries cell that asks for it.
- **JIT predict asks for the value-added share (25%)**, not the sum of the addends the question lists (guide §7.1b); "only processing adds value" moved into that beat.
- **Reeder ledger gate:** the balances are shown (and listed) only on the beat after the "which balance must be cleared" gate, and the question names all five accounts so the answer can't be found by elimination.
- The module's first beat no longer names job-order or process costing (both are defined later).

### Revision 1.3.0 (re-audit 2)
- **Entry (h)'s memo is rate-free** ("Overhead applied to Work in Process at the predetermined rate") in every Journal, because the Application entries cell's journal is on screen beside the rate cell. The math-code trace label for (h) still prints the rate (`cycle().trace`), since that Math & Code section has no gate and already shows the rate in its key formula, readout and rate schedule.
- **The dispose cell's narration no longer prints adjusted COGS**: the income cell below it asks the learner to make that adjustment (its ₱620,000 distractor is "forgot to adjust COGS"). The allocation schedule and year-end journal stay.
- **`randomYear` draws a non-zero estimate offset** (±10,000–30,000 of direct labor). With a zero offset the "applied the rate to estimated labor" misconception equalled the correct applied overhead in about 1 seed in 7, on hand-calc steps the validator's collision check does not cover. `overheadQ`'s two `applied` misconceptions (rate × estimated labor and estimated overhead) are always the same number, so they are merged into one hint.

## Errata / inconsistencies found
- Slide 10, entry (c): "Indirect Labor, $85,0000" — read as $85,000 (the entry and the T-account use 85,000).
- Slide 12, entry (h): "Direct labor cost, $210,0000" — read as $210,000 (the slide's own division uses 210,000).
- Slide 17: under Salaries and Wages Payable / Direct Labor, the debit side reads "Debited for the cost of materials purchased", copied from the Raw Materials box. The account is credited for labor incurred (and debited when wages are paid).
- Slide 20: the EU totals print as "189.000 181.000" with periods for thousands separators.
- Slide 2: Quiz 1A covers Sessions 1–3 (cost behavior and regression), not this session; it is treated as a warm-up in the cost-terms section.
- Slide 30 lists "Machine time" and "Power consumed" as activities; the ABC section keeps to Sarver's five activities.

## What I added beyond the slides
- JIT manufacturing-time numbers (2 + 0.5 + 1 + 4.5 hours) — the slide gives only the formula; illustrative numbers make the value-added share concrete.
- The cost-terms section's prime/conversion/product/period totals use Reeder's figures (DM 136,000, DL 200,000, applied MOH 300,000, selling and administrative 209,000 as one line) to tie the vocabulary to the year that follows.
- Application case (Mabini Metalcraft) — synthetic, same structure as Reeder: rate 120%, applied 720,000 vs actual 680,000 → overapplied 40,000; close → COGS 1,460,000, NI 660,000; allocate (10/15/75%) → COGS 1,470,000, NI 650,000.
- Mabini also has a process line and an ABC setup pool in the Application (see Revision 1.1.0 above).
