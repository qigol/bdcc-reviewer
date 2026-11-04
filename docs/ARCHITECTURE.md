# Architecture map

A map of the code for agents and new contributors. Read this first; open the long docs only for the section you need.
Keep it current: a change that moves, adds or renames anything listed here updates this file in the same change.
It names structure, not counts. For current lists, run the commands given.

## What the app is

**Qdigo** is a self-hosted study site. The core app holds no topic content. Each topic is a **module**: a folder of YAML
plus one plain `logic.js`. The app renders a module into study tabs (Path, Intuition, Math & Code or Math & Journal,
Application) and a quiz bank. Modules belong to a **course** (`course:` in `manifest.yaml`). Quizzes never mix courses.
Modules live on the server. Learner progress lives only in the browser (IndexedDB).

**Naming:** "Qdigo" is the display name only. Internal identifiers keep **`kodigo`**: the `@kodigo/*` packages, the
`kodigo` CLI, the Dexie DB `'kodigo'`, storage keys and the Docker image. Do not rename them, because that breaks saved progress.

## Layout

| Path | Role |
|---|---|
| `apps/server/src/index.ts` | Entry: `loadConfig()` → `buildApp()` → listen → warm the health cache |
| `apps/server/src/config.ts` | `loadConfig(env)`: the only place that reads env vars |
| `apps/server/src/app.ts` | `buildApp(cfg, deps)`: Fastify API, hooks, compression (never on `/files/*`), cache policy, error handler and static hosting of the built SPA, without listening (tests use `app.inject`; fixture in `apps/server/test/fixtures.ts`) |
| `apps/server/src/registry.ts` | Module registry (a stat-only fingerprint per folder drives its manifest, health and index caches and the `/files` ETag; only validation reads binaries): built-ins (`MODULES_BUILTIN`) plus imports in `DATA_DIR/modules/<id>@<version>/`; enabled/order/current/course in `DATA_DIR/state.json`; keeps the newest 3 imported versions; validates through a `LogicHostFactory` (default: the isolated host) |
| `apps/server/src/logic/` | Isolated logic host: `isolatedHost.ts` forks `child.ts` (built as `dist/logic-child.mjs`) per validation with an empty env, the Node permission model, a 128 MB heap, a watchdog and at most 2 at once |
| `apps/server/src/headers.ts` | `securityHeaders()`: the CSP and security headers per response (page without `'unsafe-eval'`, logic worker, Pyodide worker, module files, API; HSTS when `HSTS=1`), applied in one `onSend` hook. 5xx bodies are generic with a `requestId` |
| `apps/server/src/rateLimit.ts` | Failed-admin-auth limiter (10 per IP per 15 min, then 429) |
| `apps/server/src/validation.ts` | zod schemas for admin request bodies (`ModulePatch`) |
| `apps/server/src/christmas/` | 12-day Christmas countdown quiz: `days.ts` (content), `schedule.ts` (which days are open) |
| `packages/schema/src/` | Isomorphic core, shared by web, server and CLI (see below) |
| `packages/sdk/src/index.ts` | The `sdk` given to `logic.js` as `register(sdk)`: seeded RNG, formatting, vectors, matrices, least squares, sets |
| `packages/cli/src/index.ts` | `kodigo` CLI: `validate`, `pack`, `unbundle`, `widgets-doc`, `json-schema`, `animation` (`animation.ts`) |
| `apps/web/src/` | React SPA, one lazy chunk per route (Vite, Tailwind, react-router, framer-motion, KaTeX, Shiki, Dexie) (see below) |
| `modules/<id>/` | Built-in modules. List them with `ls modules`; course per module: `grep -H "^course:" modules/*/manifest.yaml` |
| `animations/` | HyperFrames source for `Animation` widget clips. Not shipped; renders go to `modules/<id>/assets/anim/` |
| `docker/` | `Dockerfile` (build stage runs `kodigo validate modules` and fetches Pyodide through the web build; runtime has `index.js` and `logic-child.mjs` and no node_modules) and `compose.yml` |
| `scripts/` | `fetch-pyodide.mjs`: the pinned Pyodide release for the coding exam, checked by sha256 · `exam-check/`: runs a coding exam's shipped cells (walkthrough steps, tests, twists) in real pandas for many seeds (see its README) |
| `data/` | Local DATA_DIR (imported modules + `state.json`); mounted at `/data` in Docker |

### `packages/schema/src` (one file per concern)

`schemas.ts` zod schemas for the module format · `validate.ts` the 7-step validator (structure, YAML, schema,
references, logic/examples, quiz smoke, lints) · `quiz.ts` quiz instances (`buildInstance`, glossary questions) and
every answer checker (`check*`) · `widgets.ts` widget catalog (the contract every widget must honor; source of
`docs/WIDGETS.md`) · `node.ts` Node `LogicHost` (`node:vm`, `Math.random` throws, microtasks bounded by the timeout; not a security boundary on its own) · `logicSource.ts` turns `logic.js`
into a callable body · `interpolate.ts` scope paths, `@refs`, `{=path|format}` · `expr.ts` safe `when` expressions
(no eval) · `anchors.ts` math⇄code anchors · `live.ts` Math & Code live widgets · `journal.ts` journal workbench
(entries, schedules, T-accounts) · `guided.ts` where terms are introduced, learning path · `moduleIndex.ts` `buildModuleIndex` (the lightweight index cross-module pages use) · `parse.ts` the parser as its own entry (`@kodigo/schema/parse`, loaded on demand by the web app) · `bundle.ts` bundle text and
zip I/O · `jsonSchema.ts` JSON Schema export.

### `apps/web/src`

| Folder | Owns |
|---|---|
| `app/` | Shell and pages: `App.tsx` (routes), `Dashboard`, `PlanPage`, `GlossaryPage`, `CheatsheetPage`, `SettingsPage`, `CourseMenu`, `CommandPalette`, `highlights.ts` (dashboard banner entries) |
| `modules/` | `store.tsx` loads and caches full modules from the API; `useIndex.ts` `useModuleIndex()` gives cross-module pages `GET /api/index` instead; `logicPool.ts` caps live workers (4, 60 s idle), and `logic.ts` starts a worker only on its first call; `logic.ts` + `logic.worker.ts` run `logic.js` in a Web Worker; `harden.ts` removes network, storage and nested-worker globals first and fails closed; `courses.ts`/`courseGroups.ts` group modules by course |
| `tabs/` | `ModulePage` (module route shell; adds a "Mock exam" tab when the module has `exam.yaml`), `PathTab`, `IntuitionTab`, `MathCodeTab`, `ApplicationTab` (notebook cells; a decision option's `outcomes` show what running it does) |
| `exam/` | `ExamTab`: mock-exam runner (one seed per attempt, items revealed and locked in order, scored on submit) and its mode switch; `CodingExam` + `CodeCell` (the "write the code" version); `ExamWalkthrough` (after submit: step-by-step solution and twists, for every problem or only the missed ones); `ExamTools` (guide, hints, scratchpad, row marking) |
| `py/` | Python in the browser: `pyodide.worker.ts` (Pyodide in a module Worker, notebook-style cells) and `python.ts` (`PythonKernel`: run, restart, 20 s timeout). Pyodide's files are served from `/pyodide/` |
| `engine/` | Scenes: `useScope.ts` (datasets + state + derive), `Stage.tsx` (lays out widgets by region), `Gate.tsx` (practice/predict/reflect gates), `trace.ts`/`marks.ts` (step-through commands) |
| `widgets/` | One `<Name>.tsx` per catalog widget, lazy-loaded through `registry.ts` |
| `quiz/` | `QuizBuilder` → `session.ts` (builds course-scoped sessions; storage in `sessionStore.ts`, `summary.ts` the summary math) → `QuizRunner` → `Question.tsx` (renders every question type); `ReviewPage` (SRS), `Calculator`, `PracticeBox` |
| `storage/` | `db.ts` (Dexie), `progress.ts` (progress, settings, exams), `confidence.ts` (confidence → SM-2 grade), `exportImport.ts` |
| `plan/` | Exam study plan: `studyPlan.ts` (pure scheduler), `usePlan.ts`, `stepStatus.ts` (shared with PathTab) |
| `glossary/` | `notes.ts` (one note per term id across modules), `ForceGraph.tsx` |
| `christmas/` | `ChristmasPage`, `useChristmas.ts`, `banner.ts`, `Decorations.tsx` |
| `admin/` | `AdminPage`, `ImportPanel` (zip/folder/paste), `ReportView`, `token.ts` (admin token in `sessionStorage`, never IndexedDB) |
| `lib/` | `api.ts` (every server call + response types), `md.tsx`, `calc.ts`, shared UI bits |

Routes (`app/App.tsx`): `/`, `/m/:id/{path,intuition[/:sceneId],math-code[/:sectionId],application,exam}`,
`/preview/m/:id/...` (admin preview), `/quiz`, `/quiz/run/:sessionId`, `/review`, `/glossary/*`, `/cheatsheet`, `/plan`,
`/christmas`, `/settings`, `/admin`.

## Main flows

- **Module import:** files (zip / folder / pasted bundle) → `POST /api/modules` → `registry.ts` → `validateModule()` in
  `packages/schema/src/validate.ts` (steps 5–6 run `logic.js` in a child process: `logic/isolatedHost.ts` → `node.ts`) → stored as `<id>@<version>`. Import is
  blocked if any lecture example in `examples.yaml` fails to reproduce. The admin import panel also validates in the browser first (`browserHostFactory` in `modules/logic.ts`).
- **Cross-module pages** (Dashboard, Glossary, Cheatsheet, QuizBuilder, Plan, command palette): `GET /api/index` → `useModuleIndex()`. They download no module and start no worker. Quiz runs, module pages, exams and admin load full modules.
- **Rendering a module:** `GET /api/modules` and `/api/modules/:id/files` → `modules/store.tsx` parses with
  `@kodigo/schema` → `tabs/*` → `engine/Stage.tsx` → `widgets/registry.ts`. `derive` and generators run in the logic worker.
- **Quiz:** `quiz/session.ts` picks templates from one course, then per item calls `mod.logic.generate(...)` and
  `buildInstance` (or `buildGlossaryInstance`) from `packages/schema/src/quiz.ts` → `Question.tsx` grades with the
  schema's `check*` functions → saves `attempts`, `srs`, `mastery` rows (`confidence.ts` shapes the SM-2 grade).
- **Mock exam:** optional `exam.yaml` (`ExamFile` in `schemas.ts`, parsed into `ParsedModule.exam`) → `exam/ExamTab`
  draws one seed, calls the `story` generator and `instantiate` for every item with that seed → grades on submit and
  saves `attempts` with mode `exam`. The validator checks over 25 seeds that every item's generator returns the story's
  `storyKey` (one dataset per attempt).
- **Coding exam:** `exam.yaml` `coding` → `exam/CodingExam` gets the attempt's files and test values from the
  `coding.story` generator → `py/python.ts` runs each cell in `py/pyodide.worker.ts` (files written to Python's file
  system before each run) → on submit: restart, every cell top to bottom, then the test cells; a test scores when it
  raises nothing. Not saved to `attempts`. After submit, `exam/ExamWalkthrough` runs each problem's walkthrough steps
  and twists in the same kernel (every problem, or only those that lost points). Pyodide 0.27.8 (Python 3.12 + pandas 2.2) is fetched into
  `apps/web/public/pyodide/` (gitignored) by `scripts/fetch-pyodide.mjs`, which `pnpm dev` and the web build run.
- **Progress:** Dexie DB `kodigo`, tables `progress`, `attempts`, `srs`, `mastery`, `notes`, `bookmarks`, `settings`
  (`storage/db.ts`). Adding an **indexed** field needs a `this.version(n)` bump; unindexed fields don't. Export/import
  merges by key with the later `updatedAt` winning. The study plan is recomputed from progress, never stored.
- **Christmas:** `CHRISTMAS_QUIZ` (`auto`|`on`|`off`), `CHRISTMAS_TZ` (default Asia/Manila), `CHRISTMAS_NOW`
  (fake date) → `GET /api/christmas`. Only unlocked days' content leaves the server. Answers are kept apart from study stats.

## How to add…

- **A module:** follow `docs/MODULE_AUTHORING_GUIDE.md`, then `pnpm kodigo validate modules/<id> --warnings`.
  Copy the anatomy of an existing module (`manifest.yaml`, `glossary.yaml`, `intuition.yaml`, `math-code.yaml`,
  `application.yaml`, `quiz.yaml`, `examples.yaml`, `logic.js`, `datasets/`, `SOURCE_NOTES.md`). `logic.js` must be
  deterministic: use the sdk's seeded RNG and never `Math.random`, timers or network.
- **A widget:** contract in `packages/schema/src/widgets.ts` → component `apps/web/src/widgets/<Name>.tsx` → entry in
  `widgets/registry.ts` → `pnpm widgets:doc` (regenerates `docs/WIDGETS.md`; never edit that file by hand).
- **A question type:** `type` literal in `packages/schema/src/schemas.ts` → build and `check*` in `quiz.ts` → render in
  `apps/web/src/quiz/Question.tsx` → wire in `quiz/session.ts` → validator quiz smoke (`validate.ts`) → tests in
  `packages/schema/test/qtypes.test.ts` and `apps/web/e2e/smoke.spec.ts` → document it in the authoring guide.
- **A mock exam:** `exam.yaml` in a module plus `case` templates in its `quiz.yaml` whose generators share one data
  draw; see `docs/MODULE_AUTHORING_GUIDE.md` §5.11. A coding version adds `coding` to `exam.yaml` and a generator
  for its files and test values, plus walkthrough steps and twists per problem; run `scripts/exam-check` in real pandas
  before shipping (§5.11).
- **An API route:** `apps/server/src/app.ts` (admin routes call `requireAdmin`; a new env var goes in `config.ts`), client in `apps/web/src/lib/api.ts`.
- **A rule implied by a module fix:** add it to `docs/MODULE_AUTHORING_GUIDE.md`.

## Commands and checks

`pnpm dev` (Vite :5173 proxying `/api` to the server on :8080, `ADMIN_TOKEN=dev`) · `pnpm test` (vitest:
`packages/*/test`, `apps/*/test`, including every built-in module in `packages/schema/test/modules.test.ts`) ·
`pnpm typecheck` · `pnpm build` · `node scripts/check-bundle-size.mjs` (main chunk ≤ 450 KB) · `pnpm smoke` (Playwright `apps/web/e2e`, needs a build) · `pnpm kodigo <cmd>` ·
`pnpm pyodide:fetch` (download and sha256-check Pyodide; the web build and `pnpm dev` run it, so the build needs network
once). Preview configs in `.claude/launch.json`: `qdigo-dev`, `qdigo-built` (the built server on :8095, where CSP applies). The
Docker build fails on any invalid module. CSP and MIME types are only applied by the Fastify server, never by Vite dev, so
check Pyodide changes on the built app served by the server.

## Where the long docs go deeper

- `docs/MVP_PLAN.md`: §3 architecture, §7 module system, §8 study tabs, §9 quiz engine, §10 browser storage, §11 admin,
  §12 Docker, §19 guided learning and workbenches.
- `docs/MODULE_AUTHORING_GUIDE.md`: §3 package layout and bundle format, §4 shared syntax, §5 file specs, §7 pedagogy,
  §8 correctness rules, §9 widgets, §9a animations, §14 revising modules and fix requests.
- `docs/WIDGETS.md` (generated widget reference) · `animations/README.md` (clip pipeline) · `README.md` (user-facing
  overview, API table, env vars).
