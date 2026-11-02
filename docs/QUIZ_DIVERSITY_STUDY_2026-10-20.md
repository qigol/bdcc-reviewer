# Quiz diversity study (2026-10-20)

How to make the quiz more varied and better for learning, through new question formats, better use of the existing
types, and smarter session composition. This is a study, not an implementation: each proposal states what it costs
in the engine so we can choose what to build.

**Scope:** the question bank (`modules/*/quiz.yaml`, the `Template` union in `packages/schema/src/schemas.ts:361`,
`buildInstance` and the checkers in `packages/schema/src/quiz.ts`, the renderer in `apps/web/src/quiz/Question.tsx`) and the session
builder (`apps/web/src/quiz/session.ts`, `QuizBuilder.tsx`).

---

## 1. Where the bank stands today

Measured on 2026-10-20 across 17 modules. Some figures in the Oct-5 learner review are now out of date (for example, abm
had 0 level-3 templates then and has 7 now).

| | |
|---|---|
| Templates | **682** (30–50 per module) |
| Types | 9: `mcq`, `multi`, `numeric`, `code-fill`, `match`, `order`, `hand-calc`, `journal-entry`, `schedule-fill` |
| Generator-driven | 324 (48%), almost all of them numeric, hand-calc, journal or schedule |
| `mcq` + `multi` | 217, of which **200 (92%) are static**: same options and same right answer on every attempt |
| `optionFeedback` | used by 40 templates in 7 modules (abc, fim, lf-cf, nb-cf, the three spark modules); 10 use none. `multi` can't have it at all |
| Hints | on 79–100% of templates per module, except nb-cf at 63% (the review's "zero hints" finding is mostly fixed) |
| Level 3 | 0 in cost-concepts and cost-regression, 3 in cost-behavior; 7–10 elsewhere |
| Tags (templates carrying each) | math 252 · intuition 154 · code 106 · term 74 · application **67** · journal 45 |
| Visual stimulus (`show`) | heavy in the BDCC modules; **0** in abc, abm, cost-concepts, cost-flows, job-order, process-costing |

Per-module counts are reproducible with the script in Appendix A.

### What this means for the learner

1. **Most conceptual questions turn into recall of a fixed answer.** A static MCQ seen a second time through spaced
   repetition tests whether you remember which option was right, not whether you understand it. The review flagged
   the fim `milk-trap` item for exactly this, and the pattern covers 200 templates.
2. **Every question has the same shape: one prompt, one answer.** There are no formats that ask the learner to *find an
   error*, *justify a choice*, *judge their own certainty*, *explain*, or *carry one scenario through several linked
   parts*. Most of these have solid learning evidence behind them (§2).
3. **Recognition outweighs production for concepts.** Concepts are tested by picking from options. The only places a
   learner produces an answer are numbers (numeric, hand-calc, journal and schedule amounts) and code blanks; no concept is ever
   produced in words. Glossary auto-questions (`buildGlossaryInstance`) are all
   recognition MCQs (definition→term, term→definition, formula→term).
4. **Wrong answers in conceptual questions mostly get generic feedback.** A misconception engine exists for numbers
   (`misconceptions`), but most MCQs don't say why the chosen distractor is wrong.
5. **Little transfer.** Only 67 templates (10%) are tagged `application`, and the review found several of them reuse the lesson's own
   case (testing recall of that case, not transfer).
6. **The session builder doesn't balance the mix** (§4). A 20-question quiz can come out almost entirely numeric, and
   when a filter leaves fewer templates than `count`, `pickItems` cycles `pool[i % pool.length]` and serves the same
   template twice.

---

## 2. Why these particular formats (learning evidence)

| Principle | What it says | Strength | Formats it motivates |
|---|---|---|---|
| Retrieval practice | Testing beats restudying (meta-analysis g ≈ 0.50); recall tests showed larger benefits than recognition in Rowland 2014, though Adesope 2017 reportedly found MCQ practice works well too | Strong | Keep MCQs, add production: cloze, produce-the-term glossary |
| Elaborated feedback | Explaining *why* (d ≈ 0.49) beats giving the correct answer (0.32) and far beats right/wrong only (0.05) | Strong | Per-option feedback on every MCQ and multi |
| Self-explanation | Prompting learners to explain gives g ≈ 0.55 | Strong | Explain-then-compare |
| Interleaving | Mixed practice g ≈ 0.42, larger when the categories are similar and easy to confuse | Strong | Session type/skill mixing, "which method?" items |
| Confidence and the hypercorrection effect | Errors made with *high* confidence are corrected best after feedback (widely replicated) | Strong for the effect; confidence-based *marking* less studied | Confidence rating on any item |
| Erroneous examples | Finding and fixing errors helps, but mainly for learners with **solid prior knowledge** and for far transfer | Moderate, conditional | Spot-the-error, at difficulty 2–3 only |
| Faded worked examples | Worked examples first, then fade toward independent solving | Strong | Hand-calc with some steps given |
| Parsons problems | Learning gains comparable to writing code, in less time. **Distractor lines are contested**: one study found they cut efficiency, another found better immediate learning. Distractors should be real misconceptions | Moderate | Parsons, distractors optional |
| Two-tier diagnostics | Separates a lucky guess from understanding and names the misconception. Evidence is about *diagnostic validity*, not learning gains | Diagnostic only | Two-tier MCQ |
| Estimate first | Estimation skill correlates with maths ability, but no study found that *teaching* estimate-before-compute improves learning | Weak | Estimate first (low priority) |

Sources and caveats are in Appendix B.

---

## 3. Proposed formats

Ordered from cheapest to most expensive. "Engine cost" counts the six places a new type touches: the schema union,
`buildInstance` and a checker in `quiz.ts`, the `grade`/`emptyResponse`/`isAnswered` switch and a renderer in `Question.tsx`, `QTYPES`/`QTYPE_LABEL` in
`session.ts`, the validator smoke test, and guide §5.10 and §7.4.

### Tier 0: content only (no engine change)

**0a. Generated conceptual MCQs.** The engine already lets a generator return `options` and `answer` (`gen?.options`, `quiz.ts:154`). Use it so the
same concept is asked about a different scenario each time: for example "given these support counts, which itemset is
pruned?", or "given this transaction, which account is debited?". This moves the 92%-static share down without any new
type, and is the single biggest fix for rote recall.
- *Code module (fim):* the generator draws baskets and asks which candidate the Apriori principle prunes. Distractors are a
  frequent itemset, a superset of a pruned one, and the classic-prune answer.
- *Journal module (job-order):* draw a transaction ("factory rent ₱X paid"), then ask which account is debited. Options are
  Manufacturing Overhead, Rent Expense, WIP, and Finished Goods.

**0b. Classification ("sort into bins") using `match`.** `match` with repeated right-hand labels is graded
by label (`matchSlotRight`), so it already works as a bin sort: "value-added / non-value-added", "fixed /
variable / mixed", "transformation / action", "product / period cost". Write these with `pick` from a large pool so each
attempt draws different items.

**0c. `optionFeedback` on every conceptual MCQ.** Each distractor should name the misconception it represents. This is
cheap and has the strongest effect on what a wrong answer teaches. Make it a guide rule.

**0d. Transfer contexts.** Each module gets ≥ 3 `application` items set in a scenario that is *not* the lesson's
case (a pharmacy instead of the sari-sari store, a bakery instead of the job shop).

**0e. "Which method?" items.** An MCQ whose answer is a method, not a value: "Which costing system fits a
shipyard?", "Which similarity measure handles rating-scale bias?", "Which file format for column-pruned scans?". These
are the questions interleaving is meant to train.

### Tier 1: small engine changes that reuse existing renderers and checkers

**1a. Parsons (`order` + distractors).** Add `distractors?: string[]` to `order`. The learner drags the correct lines
into a solution area and leaves the decoys out. Grading: the existing Kendall-tau `checkOrder` on the kept lines,
minus a share for each decoy kept. *Cost:* a schema field, a two-zone variant of `Sortable`, and a small checker change.
Because the evidence on distractor lines is mixed, make them optional, keep them to 1–2 per item, and allow them only when each one is a real misconception.
- *Code:* PySpark `groupBy().agg()` pipeline lines plus a decoy `.collect()` placed too early.
- *Journal:* process-costing steps 1–5 plus a decoy "allocate overhead on direct labor hours".

**1b. Cloze (fill in the blanks in prose).** This is `code-fill` with prose instead of code. Allow `lang: text` (rendered as
Markdown, not a code block), and match case-insensitively. *Cost:* a renderer variant and a case flag in `checkBlank`. Its job is
to make the learner *produce* a key term instead of recognising it.
- "Lift = confidence ÷ ____ of the consequent." / "Underapplied overhead is closed to ____ ."

**1c. Glossary production questions.** A fourth auto-question kind, `glossary-produce-<id>`: show the definition and the
learner types the term (accept `term` plus its existing `aka` list from `glossary.yaml`). Auto-generation stays free for authors.
*Cost:* `glossaryTemplateIds` and `buildGlossaryInstance` emit a `code-fill`/cloze instance. Depends on 1b.

**1d. `optionFeedback` for `multi`.** Feedback per option, shown for each wrong pick or miss. *Cost:* a schema field and
the renderer. Needed for 0c to reach the 49 `multi` templates.

**1e. Confidence rating (a wrapper, not a type).** A 3-level "How sure are you?" prompt
(guessing / fairly sure / certain) before the answer is checked, on any question type in practice and exam modes.
Uses:
- In feedback: "confidently wrong" items get a highlighted explanation and are labelled as surprises (the
  hypercorrection effect).
- In spaced repetition: confidently-wrong items get the shortest interval. Lucky guesses (right but guessing) are scheduled
  like misses, not like knowns (`updateSrs` in `progress.ts:90` derives the grade from score only).
- On the results page: a calibration line ("you were certain on 12 and right on 9").

*Cost:* one control in `QuizRunner`, a `confidence` field in the attempt record, and changes to the SRS grade and results view.
No author work.

### Tier 2: new question types

**2a. Spot the error (`find-error`).** Show a worked solution (calculation steps, code lines, or journal
lines) where one step is wrong; the learner clicks the wrong step, then optionally types the corrected value.
Grading: 0.5 for the step and 0.5 for the correction (numeric, with the existing tolerance and misconceptions). The generator
supplies the correct steps, picks which step to corrupt, and applies a *real* misconception (the same `wrong*` values
modules already compute). This puts the misconception library to a second use.
- *nb-cf:* a user-based prediction where step 3 uses raw cosine instead of centred similarity.
- *process-costing:* an EU schedule where ending-WIP conversion uses the materials completion %.
- *spark-df-debugging:* a five-line pipeline where one line uses `filter` on an aggregated column before `agg`.

*Cost:* a new type (schema, builder, checker, a step-list renderer with selectable rows and an optional input). This is a strong fit for
this content because every module already has named misconceptions. The evidence favours learners who already know the
procedure, so use it at difficulty 2–3 only, after the learner has practised the straight calculation.

**2b. Two-tier MCQ (`two-tier`).** Tier 1 is the answer; tier 2 is "Why?", with 3–4 reasons, each tied to tier-1 options.
Full credit needs both. The feedback names the misconception from the *pair* (right answer + wrong reason = "lucky
guess, here's the gap"). *Cost:* a new type, and the renderer is two MCQ blocks.
- *lf-cf:* "Does ridge regularisation break the all-ones symmetry?" No. Why: "the objective is rotation-invariant" /
  "λ shrinks all factors equally so the tie persists" / … (this is exactly the misconception the review found in the module).
- *cost-behavior:* "Is this cost fixed or variable per unit?" + why.

**2c. Explain and compare (`explain`).** The lesson's `reflect` gate as a quiz item: the learner writes a short
explanation, then sees a model answer and a 2–4-point checklist, and ticks which points they covered (scored by the
self-check, weighted lower in exam mode). Self-grading isn't reliable for marks, so count it only toward practice and
mastery, or leave it out of exam mode. *Cost:* a new type with a small renderer, which can reuse the reflect-gate UI.

**2d. Multi-part case (`case`).** One generator call feeds 2–5 linked sub-questions of *any* existing type
(e.g. compute the predetermined rate → journal-entry the applied overhead → MCQ over/underapplied → schedule-fill the
adjusted COGS). The score is the average of the parts. Parts can reveal in sequence like hand-calc steps, with optional
"use the given value" carry-forward so one early slip doesn't zero the rest.
This is the real answer to the review's X7 (no integrative top end): exam-style problems such as a full year of books,
FP-growth by hand, or item-based CF end to end.
*Cost:* the largest. It nests instances, so `buildInstance` recurses, the renderer composes `QuestionView`s, and
grading aggregates. Build it last, but plan level-3 content around it.

**2e. Estimate first (option on `numeric`).** Before the exact answer, the learner picks a range or sign ("is the
variance favourable or unfavourable?", "is lift above or below 1?"). This trains number sense and catches sign errors early.
*Cost:* an optional `estimate` block on numeric, reusing the MCQ renderer. Low priority: no direct evidence that it improves learning.

### Not recommended

- **Free-text answers graded by an LLM.** The site is self-hosted and deterministic, works offline, and grades the same way
  every time. 2c gets most of the benefit without any of that.
- **Drag-onto-image hotspots.** High authoring and rendering cost; 0b and 2a cover the same skills here.

---

## 4. Session composition (the quiz builder)

The bank's variety is wasted if `pickItems` doesn't surface it.

| Problem (`session.ts`) | Proposal |
|---|---|
| Plain shuffle; the type mix is whatever the pool's mix is | **Stratified pick:** cap any one type at about 40% of a session and guarantee at least one conceptual item and one production item when the pool allows |
| Same template can repeat when `count > pool` (`pool[i % pool.length]`) | Repeat a template only after the pool is exhausted, and then with a new seed *and* show "N unique questions available" in the builder |
| Difficulty is a filter only; practice is already a full shuffle across types and skills | **Gentle difficulty ramp** in practice mode: sort the session into thirds (mostly level 1, then 2, then 3) while skills and types stay mixed inside each third. Grouping by skill would turn interleaving back into blocked practice, so it's ruled out. Exam mode keeps the full shuffle |
| "Interleaved" mode rotates modules round-robin, but adjacent items can still share a type | Add a light constraint to every mode: no two consecutive items of the same type or skill when the pool allows |
| Glossary capped at 25%, recognition-only | Keep the cap; mix in the production kind (1c) |
| Weak-spot mode weights by skill mastery only | Also favour templates answered confidently wrong (needs 1e) |

All of these stay inside `session.ts`. No module changes.

---

## 5. Roadmap

| # | Item | Kind | Effort | Value |
|---|---|---|---|---|
| 1 | Session: stratified type mix, no-repeat, difficulty ramp, no back-to-back same type (§4) | engine | S | High: every learner, every quiz |
| 2 | Guide rules: `optionFeedback` on every conceptual MCQ; ≥ 30% of conceptual MCQs generator-driven; ≥ 3 transfer items; bin-sort `match` (0a–0e) | guide | S | High, but only as modules are revised |
| 3 | Confidence rating plus SRS and calibration (1e) | engine | M | High, with no author work |
| 4 | Parsons, cloze, glossary-produce, `multi` feedback (1a–1d) | engine | M | Medium-high |
| 5 | Spot the error (2a) | new type | M | High at levels 2–3 |
| 6 | Two-tier (2b) | new type | M | High for conceptual modules (lf-cf, interpretability, cost-behavior) |
| 7 | Multi-part case (2d), then level-3 content for cost-concepts, cost-regression, cost-behavior | new type + content | L | Fixes the missing top end |
| 8 | Explain and compare (2c), estimate first (2e) | new type | S–M | Medium |

Content work (items 2, 7, and authoring new templates in the new types) means revising all 17 `quiz.yaml` files.
Each format proposal above also needs a guide §5.10 entry and a §7.4 quota once it's built.

## 6. Decisions needed

1. Which roadmap items to build, and in what order. The suggested first batch is 1 + 3 + 5.
2. Should confidence ratings be **optional or required** for each question? Required gives SRS and calibration clean data; optional is less friction.
3. Should `explain` (self-graded) count toward the **exam** score, or only toward practice and mastery?
4. New quotas for §7.4: e.g. ≥ 2 `find-error`, ≥ 1 `two-tier`, ≥ 1 `case` at level 3 per module. Should they apply to new modules only, or should existing modules be backfilled?
5. For multi-part cases, should a part answered wrong **carry forward** the learner's value or the correct value?

## 7. Status (2026-10-22)

**Built (engine, all client-side):** roadmap items 1, 3, 4, 5, 6, 7 and 8, so every format in §3 except the not-recommended ones.
- Session composition (`apps/web/src/quiz/session.ts`): 40% type cap, at least one conceptual and one production item, no repeats until the pool is used up, a difficulty ramp in practice, no back-to-back type or skill, and `explain` left out of exams.
- New fields on existing types: `multi.optionFeedback`, `order.distractors` (Parsons), `code-fill` with `lang: text` (prose cloze), `numeric.estimate`. A produce-the-term glossary question.
- New types: `find-error`, `two-tier`, `explain`, `case` (`packages/schema/src/schemas.ts`, `quiz.ts`, `validate.ts`, `apps/web/src/quiz/Question.tsx`).
- Confidence rating (`apps/web/src/storage/confidence.ts`, `QuizRunner.tsx`): optional; confidently-wrong answers and lucky guesses are rescheduled soon, and the results page shows calibration.
- `variants` on mcq, multi and two-tier: a conceptual question can carry several scenarios, and each attempt picks one by seed. This gives tier-0a's "new scenario each time" without writing a generator, and per-option feedback stays attached to each scenario.
- Guide §5.10, §7.4 and §12 updated. The validator now:
  - rejects `{=a+b}` expressions, which used to print literally;
  - builds and checks every variant;
  - range-checks feedback keys;
  - fails a find-error template when its "wrong" step equals the corrected value in any seed.

**§6 decisions, as built:**
- Confidence ratings are optional.
- `explain` counts for practice and mastery only and is never in exams.
- The new quotas apply to new modules; all 25 existing modules have now been brought up to them.
- A case reveals each part's correct value once it is checked, and later parts carry that value forward.

**Content, all 25 modules (minor versions bumped, with `authoring.notes` per §14):**
- Every static conceptual mcq/multi (about 270) has `optionFeedback` on every option that can be picked wrongly or missed.
- Every module has at least one of each:
  - `find-error` (generator-driven where a generator fits, with the wrong value redrawn so it never equals the right one);
  - `two-tier`;
  - a level-3 `case`;
  - `explain`;
  - Parsons or prose cloze.
- There are now 1,125 templates (up from 682). 158 of the 397 conceptual questions (40%) are generator-driven or have variants, up from 24. There are 148 application templates, and 75 of them are new transfer items set outside the lessons' own cases, each with three scenarios. There are 180 level-3 templates.
- Every new item was checked against its module's lesson. Wording that depends on generated numbers was swept over 500 to 1,500 seeds. Three items whose wording didn't hold for every draw were reworded as hypotheticals.

**Still open:** a handful of older distractors are weak (e.g. "The color of the national flag"). They now have feedback, but rewriting them as real misconceptions remains a content task.

---

## Appendix A: stats script

Run from the repo root (uses the `yaml` package pnpm already installs):

```js
// node qs.mjs   (adjust the yaml path to the version under node_modules/.pnpm)
import fs from 'fs'; import * as YAML from './node_modules/.pnpm/yaml@2.9.1/node_modules/yaml/dist/index.js';
for (const d of fs.readdirSync('modules')) {
  const f = `modules/${d}/quiz.yaml`; if (!fs.existsSync(f)) continue;
  const ts = YAML.parse(fs.readFileSync(f, 'utf8')).templates;
  const c = [0, 0, 0, 0]; ts.forEach((t) => c[t.difficulty]++);
  const mc = ts.filter((t) => ['mcq', 'multi'].includes(t.type));
  const n = (p) => ts.filter(p).length;
  console.log(d, `n=${ts.length} d=${c[1]}/${c[2]}/${c[3]} mc=${mc.length} staticMc=${mc.filter((t) => !t.generator).length}`,
    `hints=${n((t) => t.hints)} optFb=${n((t) => t.optionFeedback)} gen=${n((t) => t.generator)} show=${n((t) => t.show)}`);
}
```

## Appendix B: sources

Gathered on 2026-10-20, mostly from abstracts and secondary summaries. Effect sizes marked † were verified against
the paper or its abstract; the others come from secondary sources.

- **Retrieval practice:** Rowland (2014), *Psychological Bulletin* 140(6), 1432–1463, doi:10.1037/a0037559 (g ≈ 0.50). Adesope, Trevisan & Sundararajan (2017), *Review of Educational Research* 87(3), 659–701, doi:10.3102/0034654316689306.
- **Feedback:** Van der Kleij, Feskens & Eggen (2015), *Review of Educational Research* 85(4), 475–511 († elaborated d = 0.49, correct-answer 0.32, right/wrong 0.05). Shute (2008), *Review of Educational Research* 78(1), 153–189.
- **Self-explanation:** Bisra, Liu, Nesbit, Salimi & Winne (2018), *Educational Psychology Review* († g = 0.55, 64 reports).
- **Interleaving:** Brunmair & Richter (2019), *Psychological Bulletin*, doi:10.1037/bul0000209 († g = 0.42). Rohrer & Taylor (2007), *Instructional Science* 35(6), 481–498. Kang & Pashler (2012), *Applied Cognitive Psychology* 26, 97–103.
- **Hypercorrection:** Butterfield & Metcalfe (2001), *JEP: Learning, Memory, and Cognition* 27(6), 1491–1494. Metcalfe (2017), "Learning from Errors", *Annual Review of Psychology* 68, 465–489.
- **Erroneous examples:** Große & Renkl (2007), *Learning and Instruction* 17(6), 612–634 (benefit conditional on prior knowledge). Adams, McLaren et al. (2014), erroneous decimal examples in a web tutor (venue reported inconsistently).
- **Parsons problems:** Ericson et al. (ITiCSE 2023 working-group report). Harms, Chen & Kelleher (ICER 2016): distractors reduced efficiency. ICER 2024, "Distractors Make You Pay Attention": distractors improved immediate post-test. Smith & Zilles (SIGCSE 2023): avoid distractors in summative assessment.
- **Two-tier:** Treagust (1988), original not retrieved. Chandrasegaran, Treagust & Mocerino (2007). Chu, Treagust & Chandrasegaran (2009), *Research in Science & Technological Education* 27(3). These are diagnostic instruments, with no learning-gain effect sizes.
- **Worked examples and fading:** Renkl & Atkinson (2003), *Educational Psychologist* 38, 15–22.
- **Estimation:** Siegler & Opfer (2003), *Psychological Science* 14, 237–250 (correlational only).

Not located: Parsons & Haden (2006), Treagust (1988), and Chi et al. (1994) full texts.
