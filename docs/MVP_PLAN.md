# Qdigo: MVP Plan

*A modular, self-hosted study site for BDCC (Big Data & Cloud Computing), built so new topics can be added as drop-in modules.*

> "Qdigo" is a play on "kodigo" (Filipino slang for a crib sheet). The display name appears in the page title, header and docs; internal identifiers (`@kodigo/*` packages, the `kodigo` CLI, the Dexie DB name, storage keys and the Docker image name) keep the old spelling so saved progress survives.

---

## 0. TL;DR

- **One app, many modules.** The core app contains the engine, a library of interactive widgets, the quiz engine, progress storage and the admin panel. It contains **no topic content**. Each topic is a **module**: a folder or zip of YAML files plus one plain-JS `logic.js`. An LLM can produce one from a PDF by following `MODULE_AUTHORING_GUIDE.md`.
- **Every module has three study tabs:** **Intuition** (guided, animated, drag-and-drop scenes in the style of a 3Blue1Brown video, with the math built up in place), **Math & Code** (derivation on the left, Python on the right, with each term linked to the lines that compute it) and **Application** (a notebook-style case study that ties the tabs together, plus a section on how it's done at scale). A global **Quiz** tab draws on every module.
- **Progress lives in the browser.** It's stored in IndexedDB, with JSON export/import for backup. **Modules live on the server**, in a Docker volume, so every device you use sees the same topics.
- **The admin panel** imports a module as a zip, a folder, or text pasted straight from an LLM chat. It validates the module against the schema, runs the module's own lecture-number checks, shows a preview, and installs it. When validation fails, one button copies an **LLM-ready fix request**.
- **Initial modules** (one per deck): `fim` (Frequent Itemset Mining & Association Rules), `nb-cf` (Neighborhood-based CF + DCG/NDCG), `lf-cf` (Latent-factor CF: ALS & Coordinate Descent).

---

## 1. Goals and non-goals

### Goals (MVP)
1. Learn each topic three ways (intuition, then math with code, then application) using the lecture's own examples and numbers.
2. Practice with **endless, freshly generated** questions (numbers change each time) of several kinds: multiple choice, numeric, fill-in-the-code, matching, ordering, and step-by-step **hand-calculations** like the ones on midterms.
3. Remember progress per browser and resume where you left off.
4. Add a new topic without touching core code: PDF → LLM + guide → module bundle → admin import.
5. Run anywhere with one `docker compose up`, including the homelab box.

### Non-goals (MVP)
- User accounts and multi-user progress sync. Progress is per browser; export/import covers moving it.
- Modules shipping their own React components. Modules compose **catalog widgets**; custom widgets come later (§14).
- Generating modules inside the app (for example by calling an LLM API). That's a possible later feature.
- Executing Python in the browser. It's planned (Pyodide, §14) but not needed for the MVP.

---

## 2. What the three decks contain

| Deck | Sessions | Content | Worked examples to reproduce exactly |
|---|---|---|---|
| **Frequent Itemset Mining** | 3–4 | transactions, items, k-itemsets; absolute and relative support; minsup; brute force; Apriori (superset pruning); FP-growth taught as *successive filtering of projected databases*; association rules (antecedent → consequent); confidence; rule generation (subsets of frequent itemsets); lift | 5-transaction grocery DB; minsup = 2 → 11 frequent itemsets; minconf = 0.6 → 13 rules; conf({bread}→{butter}) = 0.5; lift({bread}→{butter}) = 2.5; lift({bread}→{eggs}) = 0.83 |
| **Neighborhood-based CF** | 5–7 | user-based CF (row means μᵤ, mean-centering, similarity over co-rated items, top-k peers, weighted prediction); item-based CF (adjusted cosine, top-k similar items the user rated); DCG, IDCG, NDCG | 4×7 HP/TW/SW matrix; 5×6 a–f matrix (k=3 user-based, k=2 item-based); DCG = 514.72, IDCG = 751.45, NDCG = 0.685 |
| **Latent-factor CF** | 8–10 | R ≈ U·V (rank d); SSE over observed entries; Alternating Least Squares; Coordinate (gradient) descent with its closed-form single-entry update | 5×5 ratings with 2 missing cells; ALS from U = ones → V = column-mean/2, U row 1 = 1.0988…; CGD x = 2.6, then y = 1.68 |

### Conventions I verified by recomputing the slides
These must be encoded exactly, and the authoring guide requires this for every future module:
- **Similarity (user- and item-based):** cosine of **user-mean-centered** ratings, computed **only over co-rated entries**. It reproduces every value in the slides' similarity tables (0.70, 0.89, 0.94, −0.72, 0.74, 0.91, …). Zero overlap or a zero-norm vector gives sim = 0.
- **Neighbor selection:** take the top-k by similarity among peers (or items) that rated the target, then **use only those with sim > 0**. That's why B→c uses A and C but not D. If none are positive, the prediction is left blank (slides 29 and 33).
- **Predictions are shown in centered space.** The final rating is ŝ + μᵤ (for example, B's predicted c = 1.2 + 4.8 = 6.0). The slides stop before adding the mean back, so the module teaches both.
- **FP-growth as taught** is prefix-projected database filtering in a fixed item order (alphabetical), not FP-tree construction. The module teaches the lecture's version first and the FP-tree as an extra.

### Errata found in the slides
Modules show these as `errata` callouts:
- NB-CF slide 53: "NDCG = DCG / **NDCG**" should read DCG / **IDCG**.
- NB-CF slides 11–12 use 0.87 for sim(C, A), but the table says 0.89. The rounded result (1.3) doesn't change.
- LF-CF slide 14 solves for **y** but labels the result "x = 1.68".
- FIM slide 62: the lift legend is garbled (it says "Lift = 1: more likely…"). Slide 61's wording (>1 / =1 / <1) is correct.

### Insights worth building scenes around
- **The milk trap (FIM):** milk is in all 5 baskets, so every rule X→{milk} has confidence 1 **and lift exactly 1**. High confidence can mean nothing, which is why lift exists.
- **The one-overlap trap (NB-CF):** sim(A,B) = 1 in the HP matrix because they share one rated item. Similarity from a tiny overlap is unreliable.
- **The symmetry trap (LF-CF):** starting ALS from all-ones U makes both latent columns identical forever (V = column-mean/2 in both rows), so rank 2 collapses to rank 1. That's why initialization is random. It also shows the objective has no unique minimizer (only v₁+v₂ is determined), which motivates regularization.

---

## 3. Architecture

```
┌──────────────────────────── Browser (SPA) ─────────────────────────────┐
│  Shell & routing  ─  Dashboard · Module tabs · Quiz · Glossary · Admin  │
│                                                                         │
│  Scene engine ──► Widget library (catalog, versioned)                   │
│     ▲   scope = datasets + state + derived vars                         │
│     │   gates, beats, traces, {=var} interpolation                      │
│     │                                                                   │
│  Module loader ──► schema validator (shared pkg) ──► registry           │
│     │                                                                   │
│     └──► Logic Worker (Web Worker, Comlink) runs module logic.js:       │
│             fns (algorithms + traces), generators (quiz), sdk helpers   │
│                                                                         │
│  Quiz engine (templates × seeds, checkers, SRS, mastery)                │
│  Storage: IndexedDB via Dexie (progress, attempts, SRS, notes, prefs)   │
└───────────────▲─────────────────────────────────────────────────────────┘
                │ /api/modules (list, files, import, delete, patch)
┌───────────────┴─────────── Server container (Node) ─────────────────────┐
│  Fastify: serves SPA + built-in modules (/app/modules, read-only)       │
│           + imported modules (/data/modules, volume)                    │
│  Same validator package as the browser, so imports are checked twice    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key design decisions
1. **Modules are data plus pure functions.** YAML describes *what* to show, and `logic.js` computes numbers and traces. The core decides *how* to render. That keeps modules small, validatable, and within an LLM's reach, and the core can improve every module at once.
2. **Declarative state leads to automatic animation.** Scenes change **state** (`set: {minsup: 3}`), and widgets tween between states themselves with Framer Motion layout and value animations. Authors never write animation code, which is what makes the "smooth like 3b1b" feel achievable at scale.
3. **Anchors link math to code.** A formula term is wrapped as `\anchor{conf}{...}` (a KaTeX macro), and a code block marks lines with `# @a conf` … `# @end`. Hovering either side highlights both, and step-through traces light them up together.
4. **Displayed code is Python; executed logic is JS.** Python matches the course. JS runs fast in the worker and drives animations. `examples.yaml` (lecture numbers) is the contract both must satisfy, and a later Pyodide parity check (§14) will run the displayed Python against the same examples.
5. **Quiz questions are templates × seeds.** A question instance is `(templateId, seed)`, so it's deterministic, shareable and re-generatable, and values change on every new seed.
6. **Stable IDs everywhere.** Scene, section, template and skill IDs never change across module versions, so progress survives upgrades.

---

## 4. Tech stack

| Concern | Choice | Why |
|---|---|---|
| Build / SPA | **Vite + React 18 + TypeScript** | fast dev loop, good lazy-loading for widgets |
| Routing | React Router v6 (data routers) | nested module → tab routes |
| Styling / UI | Tailwind CSS + Radix primitives (shadcn/ui style) | accessible tabs, dialogs, popovers; theming via CSS variables |
| Animation | **Framer Motion** (`motion`) | layout animations, spring tweens, `AnimatePresence`, and `useReducedMotion` |
| Drag & drop | **dnd-kit** | keyboard and touch sensors, so drag-and-drop stays accessible |
| Math | **KaTeX** (`trust` limited to `\htmlClass`, macro `\anchor`) | fast, supports class hooks for anchors |
| Code highlighting | **Shiki** (fine-grained bundle: python, javascript, sql, bash) | accurate highlighting, line decorations for anchors |
| SVG charts & diagrams | visx or hand-written SVG + d3-scale/d3-shape | lattice, vectors, function plots |
| Schemas | **zod** → `zod-to-json-schema` | one source of truth for TS types, runtime validation and the JSON Schema given to LLMs |
| YAML / zip | `yaml` (eemeli), **JSZip** | line-numbered YAML errors; zip import/export |
| Expressions in gates | `filtrex` | safe, sandboxed boolean expressions (`minsup >= 3`) |
| Worker RPC | **Comlink** | module logic runs isolated from DOM and storage |
| Storage | **Dexie** (IndexedDB) | versioned schema, bulk export/import |
| Markdown | `react-markdown` + `remark-gfm` + `remark-math`/`rehype-katex` | narration and explanations |
| Server | **Fastify** (Node 20, ESM) + `@fastify/static` + `@fastify/multipart` | tiny footprint (~60–90 MB RAM) |
| Monorepo | **pnpm workspaces** | shared `schema` and `sdk` packages |
| Tests | Vitest (sdk, engine, checkers, schema), Playwright (smoke: every built-in module renders and every quiz template instantiates) | |

---

## 5. Repository layout

```
bdcc-midterms-reviewer/
├─ apps/
│  ├─ web/                      # React SPA
│  │  └─ src/
│  │     ├─ app/                # layout, routes, dashboard, command palette
│  │     ├─ engine/             # scope, derive, interpolation, beats, gates, trace player
│  │     ├─ widgets/            # one folder per widget: Component.tsx + meta.ts (zod props, cmds, events, example)
│  │     │  └─ registry.ts
│  │     ├─ tabs/               # IntuitionTab, MathCodeTab, ApplicationTab
│  │     ├─ quiz/               # session builder, renderers per type, checkers, srs, mastery
│  │     ├─ storage/            # dexie db, export/import, resume
│  │     ├─ modules/            # api client, loader, worker host, validation UI
│  │     └─ admin/
│  └─ server/                   # Fastify: static + /api/modules
├─ packages/
│  ├─ schema/                   # zod schemas + TS types + JSON Schema + validateModule() (pure, isomorphic)
│  ├─ sdk/                      # helpers passed to logic.js (rng, frac, linalg, combinatorics…)
│  └─ cli/                      # `kodigo validate <dir|zip>`, `kodigo pack <dir>`, `kodigo unbundle <txt>`
├─ modules/                     # built-in modules (source of truth, zipped at build)
│  ├─ fim/  ├─ nb-cf/  └─ lf-cf/
├─ docs/
│  ├─ MVP_PLAN.md               # this file
│  ├─ MODULE_AUTHORING_GUIDE.md # give this to the LLM
│  └─ WIDGETS.md                # GENERATED from widgets/*/meta.ts at build time
├─ docker/
│  ├─ Dockerfile
│  └─ compose.yml
└─ package.json / pnpm-workspace.yaml
```

**Rule that keeps the system scalable:** `docs/WIDGETS.md` is generated from each widget's `meta.ts` (props schema, selectors, commands, events, example). The authoring guide references it, so adding a widget automatically updates what the next LLM session knows.

---

## 6. Navigation and screens

| Route | Screen |
|---|---|
| `/` | **Dashboard**: module cards (progress rings for Intuition / Math & Code / Application / Quiz mastery), "Resume where you left off", due reviews, weak skills, exam countdown |
| `/m/:id` → `/m/:id/intuition` | Module page with sub-tabs **Intuition · Math & Code · Application** plus a module-scoped "Practice" button |
| `/m/:id/intuition/:sceneId` | Guided scene player (deep-linkable) |
| `/m/:id/math-code/:sectionId` | Split view |
| `/m/:id/application` | Notebook case study |
| `/quiz` | Session builder: course (one per quiz), modules, types, skills, difficulty, count, mode |
| `/quiz/run/:sessionId` | Question runner |
| `/review` | Spaced-repetition queue and mistake journal |
| `/glossary` | All terms across modules (searchable, filterable by module) |
| `/cheatsheet` | Auto-built printable formula sheet per course (key formulas, exam tips, errata) |
| `/admin` | Module manager (token-protected) |

Modules are grouped into **courses** (manifest `course`, e.g. `BDCC`; Admin can override it, and modules without one go to the server's `DEFAULT_COURSE`). The top bar has **one dropdown per course** that lists its enabled modules in `order` (with `shortTitle` and the module accent color) and links to a quiz on that course, followed by **Quiz · Review · Glossary**. Quizzes are course-based: a session only ever draws from one course's modules, and review/retry queues are split per course. A command palette (Ctrl/Cmd-K) searches terms, sections, scenes and formulas.

---

## 7. The module system

### 7.1 Package layout (fixed file names; convention over configuration)

```
<module-id>/
├─ manifest.yaml          # identity, version, skills, sources, required widgets
├─ SOURCE_NOTES.md        # LLM's extraction of the PDF: concepts, formulas, worked examples, conventions, errata
├─ datasets/*.yaml        # typed datasets (transactions | matrix | table | list | json)
├─ logic.js               # plain ES module: fns (algorithms, traces) + generators (quiz)
├─ examples.yaml          # lecture numbers: fn + inputs → expected outputs (+ slide refs)
├─ glossary.yaml
├─ intuition.yaml         # guided scenes
├─ math-code.yaml         # sections: derivation ⇄ code
├─ application.yaml       # notebook scenes + at-scale + connections
├─ quiz.yaml              # question templates
├─ assets/                # optional images/svg
└─ sources/               # optional original PDF(s), for "open slide 43" links
```

The full field-by-field spec, including TypeScript types, is in `MODULE_AUTHORING_GUIDE.md`. The `packages/schema` implementation **must match it**.

### 7.2 Loading pipeline
1. `GET /api/modules` returns `[{id, version, title, shortTitle, order, color, icon, enabled, origin: builtin|imported, health}]`.
2. When a module is opened, the client fetches its files, parses the YAML and validates it with the same `validateModule()` the server used, then caches the result in memory.
3. `logic.js` is loaded **into the Logic Worker** as a blob-URL ES module, and `register(sdk)` is called. Its fns and generators are exposed over Comlink.
4. Widgets are lazy-loaded by name from `registry.ts`. A missing widget renders a visible placeholder showing its name, so the module is never blank.

### 7.3 Scope and reactivity (shared by Intuition and Application)
- **scope** = datasets (by id) + scene `state` + `derive` outputs, in a single flat namespace.
- References: `'@name.path'` in props and inputs; `{=name.path|fmt}` interpolation in Markdown and TeX.
- On any state change, `derive` steps re-run in order, calling logic fns in the worker (debounced, with results cached by input hash). Widgets receive new props and animate.
- Widgets write back through `bind` (for example, a slider writes `minsup`, a table edit writes `transactions`).

### 7.4 Versioning
- `schemaVersion` (integer) belongs to the module format. The core ships migrators for older versions.
- `version` (semver) belongs to the module's content. Importing the same `id` with a higher version is an upgrade, and progress keyed by stable IDs survives. A lower version needs explicit confirmation.

---

## 8. The three study tabs

### 8.1 Intuition (guided scenes)
**Format:** one **scene** equals one idea (support, the Apriori principle, mean-centering…). A scene has a **stage** of widgets and a sequence of **beats**. Each beat contains narration (≤ ~60 words, Markdown + KaTeX), optional state changes, widget commands, and an optional **gate**.

**Player UX:** a large stage with a narration card below it and a progress dots bar. Keys: → next, ← back, space play/pause for traces, R replay beat. "Narrate" uses the Web Speech API (a free text-to-speech toggle). Each scene ends with a one-sentence takeaway card, and "Explain it back" opens a note box.

**Gates (interaction checkpoints):**
- `continue`: plain next button.
- `predict`: "Before we reveal it, which itemsets get pruned?" You must answer, but a wrong answer doesn't block you. It's logged and shows feedback.
- `when`: continue unlocks once a scope expression is true ("Drag minsup until only {milk} survives" → `when: 'freq.count == 1'`).
- `event`: wait for a widget event (for example, `DropBins` fires `solved`).

**Animation primitives come from widgets.** For example, `TransactionTable.project` slides non-matching rows out and fades prefix items (FP-growth), `ItemsetLattice.prune` cascades grey over supersets, `Matrix.center` subtracts row means with number tweening, and `MatrixProduct.focus` sweeps a row·column dot product. `StepPlayer` plays an algorithm **trace** across several widgets in sync (play/pause/step/scrub/speed).

**Math appears inside the intuition.** A `Formula` widget sits on stage and builds up (`step`), and its terms get highlighted as the corresponding thing happens in the visual. By the end of a scene, the formula is the compressed version of what you just saw.

### 8.2 Math & Code (side-by-side)
**Layout:** section list on the left rail; center-left **Derivation** (ordered `steps`: TeX + short explanation, revealed one by one or all at once); center-right **Code** (Python, Shiki).

**Linking:**
- Hovering a formula term (`\anchor{name}`) highlights the matching code lines (`# @a name`), and vice versa. The anchor names are shown as small colored tags in both panes.
- **Live example:** a mini-dataset (from the lecture) sits above both panes, and the formula renders with substituted numbers (`\frac{{=sup.ab}}{{=sup.a}}` → `\frac{1}{2}`).
- **Trace mode:** "Step through" runs the section's `trace` fn. The current code lines light up with **value badges** (like a debugger), the matching math term glows, and the label narrates.
- **Lecture check card:** shows `examples.yaml` entries for this section (input → expected, with a slide ref and an "open slide" link when the PDF is bundled), with a green tick when the logic output matches.
- Per section: **key formula** (feeds the cheat sheet), **pitfalls**, **exam tip**, and anything *beyond the slides* is clearly badged.

### 8.3 Application (weaving it together)
A **notebook-layout** scene set (all cells visible, scrollable) with the same engine and widgets as Intuition:
1. **Case study**: realistic small dataset and story. Each cell adds a step of the pipeline with live params, and **decision prompts** ("Which bundle would you promote? Why is lift the better metric here?") come with model answers.
2. **At scale**: how it's done on big data. The course is BDCC, so this is Spark MLlib (`FPGrowth`, `ALS`), `mlxtend`, and a discussion of complexity, parallelism and sparsity, as code plus notes (not executed).
3. **Trade-offs table** (for example, brute force vs Apriori vs FP-growth; user- vs item-based; neighborhood vs latent factor).
4. **Connections** to other modules (for example, NB-CF and LF-CF predictions on the same matrix, both scored with NDCG).

---

## 9. Quiz engine

### 9.1 Question types
| Type | Answer UI | Checking |
|---|---|---|
| `mcq` | radio | exact; options may come from a generator (numeric distractors built from misconceptions) |
| `multi` | checkboxes | exact set; partial credit = (TP − FP)/|correct|, floored at 0 |
| `numeric` | input (accepts `0.67`, `2/3`, `67%` when allowed) | abs/rel tolerance; if the wrong value matches a known misconception, that specific feedback is shown |
| `code-fill` | code block with inline inputs at `__BLANK_n__` | normalized match (whitespace, quotes) against `accept[]` or `regex`; later: Pyodide execution |
| `match` | drag terms onto definitions (dnd-kit) | per-pair partial credit |
| `order` | drag steps into sequence | Kendall-tau partial credit; full credit only if exact |
| `hand-calc` | multi-step worksheet (each step numeric, unlocked in sequence, with an optional "show step" penalty) | per-step, the classic exam computation |
| *(auto)* glossary | term ↔ definition MCQ, formula ↔ name | generated from `glossary.yaml`, no authoring needed |

### 9.2 Templates and generators
- A template holds a prompt with `{=vars}`, an optional visual (`show:` widgets such as a generated transaction table), a type-specific answer spec, `skills`, `difficulty 1–3`, a `lessonRef` ("review this" link), `misconceptions`, and `explanation`.
- `generator: name` → `logic.js` `generators[name]({rng, difficulty})` returns `{vars, answer?, options?, misconceptions?}`. The seeded RNG (mulberry32) makes an instance fully reproducible from `(templateId, seed)`.
- Generators are written to produce **hand-computable numbers** and to **reject ambiguous draws** (ties at a top-k cutoff, zero denominators).

### 9.3 Session modes
- **Practice**: immediate feedback, with a hint and a "show me in the lesson" link.
- **Exam simulation**: timed, no hints, feedback at the end, with a per-skill breakdown.
- **Review (SRS)**: due templates (SM-2-lite on templates; since values change, you re-solve rather than recall).
- **Weak spots**: sampled by lowest skill mastery.
- **Interleaved**: mixes modules, which improves retention.
- **Mistake journal**: every wrong attempt, with a "retry with new numbers" button.

### 9.4 Mastery model
Per skill (`moduleId:skillId`): an exponentially weighted score, `m ← m + α·w_d·(score − m)` with α = 0.3 and weight by difficulty. Levels: *new* (< 3 attempts), *learning* (< 0.5), *shaky* (< 0.75), *solid* (< 0.9), *mastered*. The dashboard shows skill bars per module.

---

## 10. Browser storage (progress and memory)

Dexie DB `kodigo`, v1:

| Table | Key | Fields |
|---|---|---|
| `progress` | `[moduleId+tab+itemId]` | status (`seen`/`done`), beatIndex, moduleVersion, updatedAt |
| `attempts` | `++id`, index `templateId`, `moduleId`, `at` | seed, type, skills[], score 0–1, response, timeMs, mode |
| `srs` | `templateId` | ease, interval, due, reps, lapses |
| `mastery` | `skillKey` | score, n, updatedAt |
| `notes` | `++id`, index `moduleId` | anchor (scene/section id), text (explain-backs, personal notes), createdAt |
| `bookmarks` | `[moduleId+ref]` | label, createdAt |
| `settings` | `key` | theme, narration, reducedMotion, examDate, adminToken, lastLocation |

- **Resume**: `settings.lastLocation` = `{moduleId, tab, id, beat}`, updated on every navigation.
- **Export/import**: Settings → "Download my progress" (JSON with all tables and a DB version). Import merges by key, and for conflicts the later `updatedAt` wins.
- **Reset**: per module or everything, with confirmation.
- `localStorage` is used only for trivial UI prefs such as panel widths.

---

## 11. Admin panel

**Access:** `/admin`, which prompts once for `ADMIN_TOKEN` (stored in settings) and sends it as a Bearer token. Fine behind Tailscale; not meant for the open internet.

**Module list:** title, id, version, origin (built-in/imported), health (✓ valid / ⚠ warnings / ✗ errors), enabled toggle, drag-to-reorder, and actions: *Preview · Run checks · Export zip · Replace/upgrade · Disable · Delete (imported only)*.

**Import (three ways):**
1. **Drop a `.zip`** (or pick a folder, using the `webkitdirectory` input).
2. **Paste LLM output**: a text box that accepts the **bundle text format** from the guide (`<<<FILE path>>>` … `<<<END FILE>>>`). It's the smoothest path from a chat, since you copy the whole answer and paste it. Multiple pastes are appended, for answers split across messages.
3. **CLI** (for a Claude Code session with repo access): `pnpm kodigo validate modules/<id>`, then commit.

**Validation report (runs in browser, then again on server):**
1. Structure: required files present, no unknown top-level files (warn).
2. YAML syntax, with file:line:col.
3. Schema (zod), with JSON paths.
4. Referential integrity: widget names exist in the catalog; every `@ref` and `{=var}` resolves in its scope; every `\anchor{x}` has a matching `# @a x` in the same section and vice versa; fn and generator names exist in `logic.js`; `lessonRef`s, skill ids and dataset ids exist; IDs are unique.
5. Logic: `logic.js` loads in the worker, and **every `examples.yaml` case passes** (lecture numbers reproduced).
6. Quiz smoke test: each template is instantiated with 25 seeds and checked for finite answers, distinct options, the answer present among options, no unresolved `{=}`, and generation under 50 ms.
7. Lints (warnings): too few templates per skill, beats over 80 words, scenes without a predict gate, missing exam tips, no errata section even though `SOURCE_NOTES.md` lists errata.

**"Copy fix request for LLM"** formats the failures into a ready-to-paste prompt: *"Your module `x` failed validation. Errors: … Re-output ONLY the affected files, complete, in bundle format."* This closes the loop without you debugging YAML by hand.

**Preview:** renders the uploaded module in a temporary sandboxed route before installing.

> Clipboard note: `navigator.clipboard` only works in a secure context. Over plain `http://<tailscale-ip>`, the copy button falls back to select-and-copy. `tailscale serve` gives HTTPS if you want the real clipboard API.

---

## 12. Docker

### 12.1 Dockerfile (multi-stage)
```dockerfile
# ---- build ----
FROM node:20-alpine AS build
WORKDIR /src
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps ./apps
COPY packages ./packages
COPY modules ./modules
RUN pnpm install --frozen-lockfile \
 && pnpm -r build \
 && pnpm kodigo validate modules/*        # fail the image build if a built-in module is invalid

# ---- runtime ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080 DATA_DIR=/data MODULES_BUILTIN=/app/modules
COPY --from=build /src/apps/server/dist ./server
COPY --from=build /src/apps/server/node_modules ./server/node_modules
COPY --from=build /src/apps/web/dist ./web
COPY --from=build /src/modules ./modules
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK CMD wget -qO- http://localhost:8080/api/health || exit 1
CMD ["node", "server/index.js"]
```

### 12.2 compose.yml
```yaml
services:
  kodigo:
    build: { context: .., dockerfile: docker/Dockerfile }
    image: kodigo:latest
    ports: ["8080:8080"]
    environment:
      ADMIN_TOKEN: ${ADMIN_TOKEN:?set ADMIN_TOKEN in .env}
      MAX_UPLOAD_MB: 30
    volumes:
      - ./data:/data            # imported modules + module state (enabled/order)
    restart: unless-stopped
```

### 12.3 Server API
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | none | liveness |
| GET | `/api/modules` | none | list with meta, enabled, order, health |
| GET | `/api/modules/:id/files/*` | none | raw module files (built-in or imported) |
| POST | `/api/modules` | admin | multipart zip or JSON `{files: {path: content}}` (from paste); validate, store at `/data/modules/<id>@<version>/`, flip the `current` pointer |
| PATCH | `/api/modules/:id` | admin | `{enabled, order}` |
| DELETE | `/api/modules/:id` | admin | imported only (built-ins can be disabled but not deleted) |
| GET | `/api/modules/:id/export` | none | zip download |

`/data/state.json` holds enabled flags and order. Old versions are kept (the last 3) for rollback.

**Homelab fit:** the image is ~150 MB and runs in ~80 MB of RAM, so it's fine on the 4 GB MacBook Air Docker host. Reach it via its Tailscale MagicDNS name at port 8080. Progress is per browser, so use Export/Import to move it between laptop and phone.

**Dev loop:** `pnpm dev` runs Vite (5173) with a proxy to Fastify (8080), and module files hot-reload from `./modules`.

---

## 13. Widget catalog (MVP)

The authoritative props, selectors, commands and events are in `MODULE_AUTHORING_GUIDE.md §9` and the generated `WIDGETS.md`.

| Widget | What it does | Used by |
|---|---|---|
| `TransactionTable` | transactions as item chips; highlight itemset (rows glow); strike; **editable drag-drop** of items; `project` for FP-growth conditional DBs | fim |
| `ItemsetLattice` | Hasse diagram of the itemset lattice; supports and minsup coloring; `prune` cascade; reveal by level | fim |
| `Venn` | 2-set Venn with counts/fractions (support, confidence, lift intuition) | fim |
| `Matrix` | numeric matrix with missing cells, row means, heatmap, editable (ratings), `center`, `fill`, `transpose` animations | nb-cf, lf-cf |
| `MatrixProduct` | U × V ≈ R layout (numeric or symbolic entries); `focus` animates a row·column dot product; error overlay | lf-cf |
| `VectorPlot` | draggable 2D vectors, angle, cosine readout | nb-cf, lf-cf |
| `FunctionPlot` | y = f(x) from a logic fn; draggable x, tangent, minimum marker, `animateTo` | lf-cf (CGD parabola) |
| `Chart` | line/bar/scatter (SSE vs iteration, DCG discount curve, lattice size vs n) | all |
| `RankList` | drag-to-reorder ranking; relevance badges; live DCG; `sortIdeal` | nb-cf |
| `DropBins` | drag chips into labeled bins; self-checking | all |
| `Tree` | expandable tree (projected-DB recursion, FP-tree) | fim |
| `Formula` | KaTeX with anchors, `{=var}` interpolation, stepwise build (`steps`), `highlightTerm` | all |
| `Code` | Shiki code with anchors and value badges | all |
| `StepPlayer` | runs a logic trace, driving other widgets by role (play/step/scrub/speed) | all |
| `Slider`, `Choice` | bound parameters (minsup, minconf, k, d, λ…) | all |
| `Readout` | big live numbers ("Sup = 0.4") | all |
| `Callout` | note / tip / warn / exam / errata / beyond-slides | all |
| `Text`, `Image` | static content on stage | all |

---

## 14. Creative extras (prioritized)

**In MVP (cheap, high value):**
1. **Hand-calc worksheets.** A generated fresh dataset, walked step by step exactly like the slides (mean, then centered, then sims, then neighbors, then prediction). It's the closest thing to the actual midterm.
2. **Misconception-aware feedback.** Wrong numeric answers are matched against computed "wrong-method" values ("You divided by |D| instead of Sup(A)").
3. **Auto cheat sheet** (`/cheatsheet`): key formulas, exam tips and errata from every module, print-optimized.
4. **Errata and conventions callouts** so you know where the slides are sloppy and which convention your prof uses.
5. **Resume anywhere** and a **mistake journal** with "retry with new numbers".
6. **Glossary auto-quiz** at zero authoring cost.
7. **Narrate toggle** (Web Speech API) for 3b1b-style listening while watching the animation.
8. **Accessibility**: keyboard drag-and-drop through dnd-kit sensors, and `prefers-reduced-motion` swaps tweens for fades.

**Post-MVP:**
9. **Pyodide "Run it" and parity check.** Run the displayed Python in-browser, validate code-fill questions by executing them, and check that the displayed Python reproduces `examples.yaml` (catches JS/Python drift).
10. **"Recommender Showdown" capstone module** (`prerequisites: [fim, nb-cf, lf-cf]`): association rules vs user-/item-based vs ALS on the same data, scored with NDCG.
11. **Concept map**: a graph of modules and skills colored by mastery.
12. **Custom widgets as Web Components.** A module may ship `widgets.js` defining custom elements (`widget: custom:x-foo`) for the rare visual that the catalog can't express.
13. **Exam countdown study plan**: given an exam date, schedules scenes and reviews per day.
14. **Optional progress sync** to the server (`/api/progress/:profile`) for multiple devices, off by default.
15. **Source PDF deep links**: bundle the deck in `sources/` so "slide 43" opens `deck.pdf#page=N`.

---

## 15. Initial module outlines

These outlines are the brief for building the three built-in modules; the `fim` module is also the **reference module** for future LLM sessions.

### 15.1 `fim`: Frequent Itemset Mining & Association Rules
**Datasets:** `grocery5` (the lecture DB: T1 {bread, butter, milk}, T2 {eggs, milk, yogurt}, T3 {bread, cheese, eggs, milk}, T4 {eggs, milk, yogurt}, T5 {cheese, milk, yogurt}); `sarisari` (~30 baskets: pandesal, kape 3-in-1, Skyflakes, Coke, Lucky Me, itlog, yelo, sardinas, …) for Application.
**Skills:** support, frequent-itemset, brute-force, apriori, fp-growth, rules, confidence, lift, interpretation.
**Intuition scenes:**
1. *What's in a basket*: drag items into 5 baskets (terms: transaction, item, k-itemset).
2. *Counting togetherness*: pick an itemset, containing baskets glow, abs → rel support; the formula builds.
3. *The bar*: minsup slider; predict-gate sorting itemsets into frequent/infrequent bins.
4. *Combinatorial explosion*: n-items slider vs 2ⁿ−1 lattice growth (Chart plus lattice).
5. *The Apriori principle*: an infrequent {bread, butter} greys all its supersets (predict which).
6. *Apriori, level by level*: StepPlayer on grocery5, minsup = 2 (matches slide 19).
7. *FP-growth: shrink the world*: successive projected DBs (slides 21–40) with Tree and `project`.
8. *From itemsets to rules*: antecedent → consequent; confidence as P(B|A) with Venn.
9. *The milk trap*: conf = 1 but lift = 1; lift > 1 / = 1 / < 1 with bread→butter (2.5) and bread→eggs (0.83).
**Math & Code sections:** absolute/relative support · frequent itemsets · brute force (powerset) · Apriori join+prune · FP-growth recursion (projected DB) · confidence · rule generation from a frequent itemset · lift · (beyond slides) leverage/conviction as an extra.
**Application:** sari-sari basket analysis with minsup/minconf sliders, a rules table sortable by lift, and decisions (bundle promo, shelf placement, "is this rule actionable?"). At scale: `pyspark.ml.fpm.FPGrowth` and `mlxtend.frequent_patterns`. Trade-offs: brute force vs Apriori vs FP-growth (from slide 41).
**Quiz (≥ 25 templates):** support (abs/rel), count frequent itemsets at minsup, which candidate Apriori prunes, confidence and lift numeric (misconceptions: ÷|D|, reversed rule, lift ÷ RelSup(A)), rules passing minconf (multi), Apriori steps (order), terms (match), code-fill `support`/`confidence`, and hand-calc "mine all rules of a 5-transaction DB".

### 15.2 `nb-cf`: Neighborhood-based Collaborative Filtering + ranking evaluation
**Datasets:** `hp4x7` (users A–D × HP1, HP2, HP3, TW, SW1, SW2, SW3), `ab5x6` (A–E × a–f), `dcg6` (actual ratings A9 B3 C7 D2 E5 F8, rec list [B, A, C, F, E]); `barkada` (6 friends × 8 films) for Application.
**Skills:** mean-centering, similarity, neighbors, ubcf-predict, ibcf-similarity, ibcf-predict, dcg, ndcg, sparsity-pitfalls.
**Intuition:** *taste twins* (VectorPlot cosine) · *harsh vs generous raters* (Matrix `center`) · *only compare what you both rated* (co-rated mask) · *the similarity matrix fills in* · *borrowing opinions* (k slider, weighted average, positive neighbors only) · *add the mean back* · *flip it: item-based* (`transpose`) · *the one-overlap trap* · *judging a ranking* (RankList drag, then DCG live, then IDCG via `sortIdeal`, then NDCG).
**Math & Code:** μᵤ and centering · cosine over co-rated · neighbor selection (top-k, sim > 0) · user-based prediction (+ μᵤ) · item-based adjusted cosine · item-based prediction · DCG / IDCG / NDCG.
**Application:** barkada movie night (add your own ratings), user- vs item-based recommendations side by side, NDCG on held-out ratings, cold-start and sparsity discussion.
**Errata callouts:** slide 53 NDCG denominator; slide 11 0.87 vs 0.89.

### 15.3 `lf-cf`: Latent-factor Collaborative Filtering
**Datasets:** `r5x5` (the lecture matrix, with missing (3,1), (3,2), (5,5)); `barkada` (shared with nb-cf for the cross-module comparison).
**Skills:** latent-model, sse-observed, als-step, als-symmetry, cgd-derivation, cgd-update, prediction, rank-choice.
**Intuition:** *hidden tastes* (2 sliders per user and film, rating = dot product) · *a matrix is a product* (MatrixProduct) · *only observed cells count* (SSE heat) · *the ALS dance* (freeze U, solve V, and back) · *the symmetry trap* · *one knob at a time* (FunctionPlot parabola, min at x = 2.6) · *watching SSE fall* (Chart) · *filling the blanks*.
**Math & Code:** model pᵢⱼ = Σₛ uᵢₛvⱼₛ · SSE over observed · ALS least-squares update (normal equations; λ regularization marked beyond-slides) · CGD derivation (slide 15, step by step) · CGD worked steps (x = 2.6, y = 1.68) · prediction.
**Application:** complete the barkada matrix with latent factors, interpret the factors, compare with nb-cf predictions using NDCG (weaving modules together). At scale: `pyspark.ml.recommendation.ALS(rank, maxIter, regParam, coldStartStrategy="drop")`.
**Errata:** slide 14 "x = 1.68" should be y.

---

## 16. Roadmap and acceptance criteria

| Phase | Scope | Done when |
|---|---|---|
| **0: Foundation** | pnpm monorepo; `schema` (zod types from the guide), `sdk`, `cli validate`; Fastify server and API; loader and worker host; shell, routing, theming; Dexie storage and resume; Docker build | `docker compose up` serves an empty shell; `kodigo validate` works on a hello-world module |
| **1: Engine + FIM** | scope/derive/interpolation, beats and gates, StepPlayer; widgets: TransactionTable, ItemsetLattice, Venn, Tree, Formula, Code, Slider, Choice, Readout, Callout, DropBins, Chart, Text; the three tabs; full `fim` module | all FIM examples pass; every scene plays with no console errors; math↔code hover works in every section |
| **2: Quiz + progress** | all 7 question types + glossary auto-questions; session modes; SRS; mastery; dashboard; mistake journal; cheat sheet; export/import | 200 random instances across FIM templates generate and check; progress survives reload and export→import |
| **3: CF modules** | widgets Matrix, MatrixProduct, VectorPlot, FunctionPlot, RankList; `nb-cf`, `lf-cf` | every slide number in §2 reproduced by `examples.yaml`; cross-module NDCG comparison works |
| **4: Admin** | module list, zip/folder/paste import, full validation report, copy-fix-request, preview, enable/order/delete/export, version upgrade | a module produced by a fresh LLM session from the guide imports, with any fixes coming only through the copy-fix loop |
| **5: Extras** | Pyodide run + parity, narration, capstone, concept map, web-component widgets | per feature |

**If the exam is close:** do Phase 0, then the quiz engine plus hand-calc templates for all three modules (skipping Intuition scenes at first), then the Intuition scenes. Practice questions give the most exam value per hour of build time.

---

## 17. Risks and mitigations

| Risk | Mitigation |
|---|---|
| LLM-generated modules with wrong math | `examples.yaml` with slide refs is mandatory and checked at import; `SOURCE_NOTES.md` records conventions; misconception values force the generator to compute the wrong path explicitly (which also reveals confusion) |
| Displayed Python drifts from executed JS | shared examples; Pyodide parity check in Phase 5 |
| Scene authoring too verbose for an LLM | `derive` + state lets widgets animate automatically; strict word limits; the reference `fim` module to imitate |
| Widget catalog doesn't cover a new topic | `WIDGET_REQUESTS.md` in the module with a fallback render; custom web-component widgets later |
| Untrusted `logic.js` | runs in a Web Worker (no DOM or storage), import is admin-only, CSP `connect-src 'self'` |
| Progress lost when switching browsers | export/import; optional sync later |
| Schema evolution breaks old modules | `schemaVersion` + migrators; the CLI can upgrade a module folder in place |

---

## 18. Open decisions (defaults chosen; change if you disagree)
- **Code language shown:** Python (matches the course and your Jupyter setup). Other languages are supported per block.
- **Authoring format:** YAML (LaTeX-friendly with `|` blocks). JSON is also accepted by the loader.
- **Module storage:** on the server volume (shared across devices), not per browser.
- **FP-growth pedagogy:** the lecture's projected-database version first, FP-tree second.
- **DCG/NDCG:** kept inside `nb-cf` as in the deck, with its own skills so it could be split into an `rs-eval` module later.

---

## 19. Guided learning and workbenches (guide edition 2)

Qdigo grew from a reviewer into a guided course: the site now sequences the lessons, makes the learner practice and explain inside them, and supports courses whose "code" is accounting records. All of it is additive to `schemaVersion: 1`; modules opt into the strict rules with `guide: 2`.

| Feature | Module field | What the site does |
|---|---|---|
| **Path tab** (module landing page) | `manifest.objectives` (3–6, tied to skills) | objectives with per-objective mastery, then every scene → the math sections it unlocks → case → mastery check, with status and a Continue button |
| **Terms taught in Intuition** | beat `define: [term-id]`; `[[term-id]]` in any Markdown | definition card under the narration; hover cards on later mentions; terms recap on the takeaway; the defining scene becomes the term's lesson link (glossary page, glossary auto-questions). Under guide 2, a term no beat defines is an import error |
| **Practice in the lesson** | gate `practice: { template }`; section `tryIt: [ids]` | a quiz question with fresh numbers, hints and feedback inside the scene or under the section; attempts count toward mastery |
| **Self-explanation** | gate `reflect: { prompt, model }` | the learner writes first, then compares with a model answer; saved to notes |
| **Hints** | template `hints: [...]` | revealed one at a time in practice mode |
| **Math & Journal** | `manifest.workbench: journal`, `currency`; section `journal: { blocks }` | entries, schedules and T-accounts next to the derivation, with anchors, live amounts and step-through; validator checks balancing and anchor pairing |
| **Accounting widgets** | `Journal`, `TAccounts`, `Schedule` | general journal with `post`, T-accounts with postings, statements/cost schedules with subtotal and total rules |
| **Accounting questions** | `journal-entry`, `schedule-fill` | pick accounts and enter Dr/Cr (graded per account with side/amount/balance feedback); fill in a statement's blank amounts |
| **Money** | `{=x|money}`, `|money2`, `|comma` | `₱61,000`; answers accept `₱12,500`, `12,500`, `(1,200)` |

The quiz builder only offers the question types the chosen course has. A demo journal-workbench module (`packages/schema/test/fixtures/joc-demo`, job-order costing) exercises every feature in the tests and supplies the guide's §6b excerpts.
