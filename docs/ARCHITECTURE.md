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
| `apps/server/src/index.ts` | Fastify API and static hosting of the built SPA; reads every env var |
| `apps/server/src/registry.ts` | Module registry: built-ins (`MODULES_BUILTIN`) plus imports in `DATA_DIR/modules/<id>@<version>/`; enabled/order/current/course in `DATA_DIR/state.json`; keeps the newest 3 imported versions |
| `apps/server/src/christmas/` | 12-day Christmas countdown quiz: `days.ts` (content), `schedule.ts` (which days are open) |
| `packages/schema/src/` | Isomorphic core, shared by web, server and CLI (see below) |
| `packages/sdk/src/index.ts` | The `sdk` given to `logic.js` as `register(sdk)`: seeded RNG, formatting, vectors, matrices, least squares, sets |
| `packages/cli/src/index.ts` | `kodigo` CLI: `validate`, `pack`, `unbundle`, `widgets-doc`, `json-schema`, `animation` (`animation.ts`) |
| `apps/web/src/` | React SPA (Vite, Tailwind, react-router, framer-motion, KaTeX, Shiki, Dexie) (see below) |
| `modules/<id>/` | Built-in modules. List them with `ls modules`; course per module: `grep -H "^course:" modules/*/manifest.yaml` |
| `animations/` | HyperFrames source for `Animation` widget clips. Not shipped; renders go to `modules/<id>/assets/anim/` |
| `docker/` | `Dockerfile` (build stage runs `kodigo validate modules`; runtime has no node_modules) and `compose.yml` |
| `data/` | Local DATA_DIR (imported modules + `state.json`); mounted at `/data` in Docker |

### `packages/schema/src` (one file per concern)

`schemas.ts` zod schemas for the module format · `validate.ts` the 7-step validator (structure, YAML, schema,
references, logic/examples, quiz smoke, lints) · `quiz.ts` quiz instances (`buildInstance`, glossary questions) and
every answer checker (`check*`) · `widgets.ts` widget catalog (the contract every widget must honor; source of
`docs/WIDGETS.md`) · `node.ts` Node `LogicHost` (`node:vm`, `Math.random` throws) · `logicSource.ts` turns `logic.js`
into a callable body · `interpolate.ts` scope paths, `@refs`, `{=path|format}` · `expr.ts` safe `when` expressions
(no eval) · `anchors.ts` math⇄code anchors · `live.ts` Math & Code live widgets · `journal.ts` journal workbench
(entries, schedules, T-accounts) · `guided.ts` where terms are introduced, learning path · `bundle.ts` bundle text and
zip I/O · `jsonSchema.ts` JSON Schema export.

### `apps/web/src`

| Folder | Owns |
|---|---|
| `app/` | Shell and pages: `App.tsx` (routes), `Dashboard`, `PlanPage`, `GlossaryPage`, `CheatsheetPage`, `SettingsPage`, `CourseMenu`, `CommandPalette`, `highlights.ts` (dashboard banner entries) |
| `modules/` | `store.tsx` loads and caches modules from the API; `logic.ts` + `logic.worker.ts` run `logic.js` in a Web Worker with network APIs removed; `courses.ts`/`courseGroups.ts` group modules by course |
| `tabs/` | `ModulePage` (module route shell), `PathTab`, `IntuitionTab`, `MathCodeTab`, `ApplicationTab` |
| `engine/` | Scenes: `useScope.ts` (datasets + state + derive), `Stage.tsx` (lays out widgets by region), `Gate.tsx` (practice/predict/reflect gates), `trace.ts`/`marks.ts` (step-through commands) |
| `widgets/` | One `<Name>.tsx` per catalog widget, lazy-loaded through `registry.ts` |
| `quiz/` | `QuizBuilder` → `session.ts` (builds course-scoped sessions) → `QuizRunner` → `Question.tsx` (renders every question type); `ReviewPage` (SRS), `Calculator`, `PracticeBox` |
| `storage/` | `db.ts` (Dexie), `progress.ts` (progress, settings, exams), `confidence.ts` (confidence → SM-2 grade), `exportImport.ts` |
| `plan/` | Exam study plan: `studyPlan.ts` (pure scheduler), `usePlan.ts`, `stepStatus.ts` (shared with PathTab) |
| `glossary/` | `notes.ts` (one note per term id across modules), `ForceGraph.tsx` |
| `christmas/` | `ChristmasPage`, `useChristmas.ts`, `banner.ts`, `Decorations.tsx` |
| `admin/` | `AdminPage`, `ImportPanel` (zip/folder/paste), `ReportView` |
| `lib/` | `api.ts` (every server call + response types), `md.tsx`, `calc.ts`, shared UI bits |

Routes (`app/App.tsx`): `/`, `/m/:id/{path,intuition[/:sceneId],math-code[/:sectionId],application}`,
`/preview/m/:id/...` (admin preview), `/quiz`, `/quiz/run/:sessionId`, `/review`, `/glossary/*`, `/cheatsheet`, `/plan`,
`/christmas`, `/settings`, `/admin`.

## Main flows

- **Module import:** files (zip / folder / pasted bundle) → `POST /api/modules` → `registry.ts` → `validateModule()` in
  `packages/schema/src/validate.ts` (steps 5–6 run `logic.js` through `node.ts`) → stored as `<id>@<version>`. Import is
  blocked if any lecture example in `examples.yaml` fails to reproduce. The admin import panel also validates in the browser first (`browserHostFactory` in `modules/logic.ts`).
- **Rendering a module:** `GET /api/modules` and `/api/modules/:id/files` → `modules/store.tsx` parses with
  `@kodigo/schema` → `tabs/*` → `engine/Stage.tsx` → `widgets/registry.ts`. `derive` and generators run in the logic worker.
- **Quiz:** `quiz/session.ts` picks templates from one course, then per item calls `mod.logic.generate(...)` and
  `buildInstance` (or `buildGlossaryInstance`) from `packages/schema/src/quiz.ts` → `Question.tsx` grades with the
  schema's `check*` functions → saves `attempts`, `srs`, `mastery` rows (`confidence.ts` shapes the SM-2 grade).
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
- **An API route:** `apps/server/src/index.ts` (admin routes call `requireAdmin`), client in `apps/web/src/lib/api.ts`.
- **A rule implied by a module fix:** add it to `docs/MODULE_AUTHORING_GUIDE.md`.

## Commands and checks

`pnpm dev` (Vite :5173 proxying `/api` to the server on :8080, `ADMIN_TOKEN=dev`) · `pnpm test` (vitest:
`packages/*/test`, `apps/*/test`, including every built-in module in `packages/schema/test/modules.test.ts`) ·
`pnpm typecheck` · `pnpm build` · `pnpm smoke` (Playwright `apps/web/e2e`, needs a build) · `pnpm kodigo <cmd>`.
Preview configs in `.claude/launch.json`: `qdigo-dev`, and `qdigo-xmas-preview` (server on :8095 with a fake December
date; build the web app first). After rebuilding the web app, restart the server. The Docker build fails on any invalid module.

## Where the long docs go deeper

- `docs/MVP_PLAN.md`: §3 architecture, §7 module system, §8 study tabs, §9 quiz engine, §10 browser storage, §11 admin,
  §12 Docker, §19 guided learning and workbenches.
- `docs/MODULE_AUTHORING_GUIDE.md`: §3 package layout and bundle format, §4 shared syntax, §5 file specs, §7 pedagogy,
  §8 correctness rules, §9 widgets, §9a animations, §14 revising modules and fix requests.
- `docs/WIDGETS.md` (generated widget reference) · `animations/README.md` (clip pipeline) · `README.md` (user-facing
  overview, API table, env vars).
