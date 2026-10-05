# Qdigo

*Q's got your Qs.*

A self-hosted, modular study site for your courses, starting with **BDCC** (Big Data & Cloud Computing). Each topic is a
*module*: a folder of YAML and one plain `logic.js` that the site renders into three study tabs and a practice-quiz bank.
Modules belong to a **course** (`course:` in the manifest, e.g. `BDCC`). The top bar has one dropdown per course listing
its modules, and every quiz stays inside one course.

| Tab | What it is |
|---|---|
| **Path** | The module's learning objectives and every lesson step in teaching order, with progress and a Continue button. |
| **Intuition** | Guided, animated scenes in the style of a 3Blue1Brown video. Terms are defined where they first appear; you predict, drag, tune parameters, solve practice questions and explain ideas back before moving on. |
| **Math & Code** / **Math & Journal** | Derivations side by side with the course's workbench: Python code, or (for accounting, `workbench: journal`) journal entries, schedules and T-accounts. Hovering a formula term lights up its partner, "Step through" plays the computation across both panes, and "Your turn" gives fresh practice. |
| **Application** | A notebook-style case study (Philippine context) with decisions to make, plus the at-scale version (PySpark). |
| **Quiz** (per course) | Nine question types (including journal entries and fill-in schedules for accounting) generated fresh every time, with hints and feedback on common mistakes. Spaced repetition, a mistake journal and per-skill mastery are included. |

Three built-in BDCC modules reproduce every number in the lecture decks:

| Module | Lecture | Lecture checks |
|---|---|---|
| `fim`: Frequent Itemset Mining & Association Rules | Sessions 3–4 | 22 |
| `nb-cf`: Neighborhood-based Collaborative Filtering | Sessions 5–7 | 55 |
| `lf-cf`: Latent-factor Collaborative Filtering | Sessions 8–10 | 8 |

Errors found in the slides are shown in the lessons as **errata** callouts and are also collected on the cheat sheet (`/cheatsheet`).

Progress is kept **in your browser** (IndexedDB). Use *Settings → Export* and *Import* to move it between devices. Modules
are kept **on the server**, so every device sees the same topics.

---

## Quick start (Docker)

```bash
cp .env.example docker/.env        # then edit ADMIN_TOKEN
docker compose -f docker/compose.yml up -d --build
# open http://localhost:8080   (Admin: the shield icon, top right)
```

Imported modules and module settings (enabled flags, order, course overrides) go in `./data`, which is mounted at `/data`. The image build runs
`kodigo validate` on the built-in modules and **fails if any of them is invalid**. The runtime image contains no
`node_modules`, because esbuild bundles the server into a single file.

| Env var | Default | |
|---|---|---|
| `ADMIN_TOKEN` | (required in production) | bearer token for the admin API/panel. The admin panel is meant to sit behind Tailscale, not the open internet. |
| `PORT` / `HOST` | `8080` / `0.0.0.0` | |
| `DATA_DIR` | `/data` | imported modules (`modules/<id>@<version>/`, last 3 versions kept) + `state.json` |
| `MAX_UPLOAD_MB` | `30` | zip/paste upload limit |
| `DEFAULT_COURSE` | `BDCC` | course for modules whose manifest has no `course:` (and no course set in Admin) |

## Development

Requirements: Node ≥ 20 and pnpm 10 (`corepack enable`).

```bash
pnpm install
pnpm dev            # Vite on :5173 (proxies /api) + the API server on :8080 with ADMIN_TOKEN=dev
pnpm test           # vitest: sdk, checkers, parser, bundles, validator, and all built-in modules
pnpm typecheck
pnpm build          # web (Vite) + server (esbuild bundle → apps/server/dist/index.js)
pnpm smoke          # Playwright: every scene plays to its takeaway, every section renders,
                    # every quiz template instantiates (starts the built server itself)
```

Running the production build locally:

```bash
pnpm build
cd apps/server && MODULES_BUILTIN=../../modules WEB_DIR=../web/dist DATA_DIR=../../data ADMIN_TOKEN=dev node dist/index.js
```

After rebuilding the web app, restart the server so it picks up the new asset list.

## Repository layout

```
apps/web          React SPA (Vite, Tailwind, framer-motion, KaTeX, Shiki, Dexie)
  src/engine        scene scope/derive, beats & gates, trace player, stage
  src/widgets       the 23 catalog widgets (lazy-loaded)
  src/tabs          Path / Intuition / Math & Code (or Journal) / Application
  src/quiz          session builder, runner, question renderer, review (SRS)
  src/admin         module list, import (zip / folder / paste), validation reports
  e2e               Playwright smoke test
apps/server       Fastify API + static hosting; module registry on disk
packages/schema   zod schemas, widget catalog, validator (7 steps), quiz builders & graders, bundle/zip I/O
packages/sdk      the `sdk` passed to logic.js (seeded RNG, formatting, vectors, matrices, least squares, sets)
packages/cli      `kodigo` CLI
modules/          built-in modules (fim, nb-cf, lf-cf)
docs/             MVP_PLAN.md, MODULE_AUTHORING_GUIDE.md, WIDGETS.md (generated)
docker/           Dockerfile, compose.yml
```

## API

| Method | Path | Auth | |
|---|---|---|---|
| GET | `/api/health` | | liveness |
| GET | `/api/modules` | | list with meta, course, enabled, order, health, stored versions |
| GET | `/api/modules/:id/files` · `/files/*` | | all files as JSON · one raw file |
| GET | `/api/modules/:id/report` | | server-side validation report |
| GET | `/api/modules/:id/export` | | zip |
| GET | `/api/widgets.md` | | widget reference for module authors |
| POST | `/api/modules` | admin | multipart zip, or JSON `{files: {path: text \| {base64}}}`; `?dryRun=1`, `?allowDowngrade=1` (a downgrade otherwise returns 409) |
| PATCH | `/api/modules/:id` | admin | `{enabled?, order?, current?, course?}` (`current` rolls back to a stored version; `course` overrides the manifest's course, `""` clears the override) |
| DELETE | `/api/modules/:id` | admin | imported modules only; built-ins can only be disabled |

## Writing a new module

The full contract is in **[docs/MODULE_AUTHORING_GUIDE.md](docs/MODULE_AUTHORING_GUIDE.md)** (edition 2: guided learning, terms taught in Intuition, and the `journal` workbench for accounting courses; see `docs/MVP_PLAN.md` §19). The widget reference is
[docs/WIDGETS.md](docs/WIDGETS.md), which is generated with `pnpm widgets:doc`.

**With an LLM chat:** attach the lecture PDF, the guide, `WIDGETS.md` and (optionally) a reference module exported
as bundle text (Admin → `fim` → *bundle*). Then paste the prompt from guide §0. Import the answer via **Admin → Import →
Paste LLM output**. If validation fails, use **Copy fix request for LLM** and paste the corrected files back in.

**With the repo:**

```bash
pnpm kodigo unbundle answer.txt modules/<id>     # bundle text → folder
pnpm kodigo validate modules/<id> --warnings     # structure, YAML, schema, refs, logic + lecture examples, quiz smoke, lints
pnpm kodigo validate modules/<id> --fix-request  # print an LLM-ready fix request
pnpm kodigo pack modules/<id> [outDir]           # <id>@<version>.zip + .bundle.txt
pnpm kodigo json-schema schema.json              # JSON Schemas for editors
```

Validation runs `logic.js` in a sandbox (a Web Worker in the browser, `node:vm` in Node) with no network, no timers
and no `Math.random`. **Import is blocked if any lecture example fails to reproduce.**

## Notes on the lecture conventions

These are the conventions that reproduce the slides' numbers. Details and evidence are in each module's `SOURCE_NOTES.md`.

- **FIM:** support counts transactions. The lecture's Apriori extends each frequent itemset only with later frequent items in
  the order bread, butter, milk, eggs, yogurt, cheese. FP-growth is taught as prefix-projected databases in alphabetical order.
- **NB-CF:** cosine similarity on user-mean-centered ratings over co-rated items only. Take the top-k neighbors, keep only
  those with sim > 0, then predict the centered score and add μᵤ back. DCG uses gain 2^rel − 1 and discount log₂(i + 1).
- **LF-CF:** V is d×n. ALS from all-ones uses the minimum-norm least-squares solution, which gives V = column mean / 2 and
  U row 1 = 1.0988, and illustrates the symmetry trap. Coordinate descent gives x = 2.6 and y = 1.68.

Errata logged: FIM slide 25 (T1 should be T3) and slide 62 (the lift legend is garbled). NB-CF slides 11–12 use 0.87 where the
table says 0.89. On slides 18–37, sim(TW, SW1) is printed as −0.73 but is −0.80, and on slides 29–37 B·TW is 0.3, not 0.7.
On slide 53 the NDCG denominator should be IDCG. LF-CF slide 14 labels the result x, but it solves for y.
