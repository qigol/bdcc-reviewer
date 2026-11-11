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
| **Quiz** (per course) | Thirteen question types generated fresh every time: multiple choice, select-all, answer + reason, numeric (optionally estimate-first), fill-in code or prose, matching, ordering and Parsons line-banks, spot-the-error, hand calculations, multi-part cases, explain-and-compare, and, for accounting, journal entries and fill-in schedules. Hints and feedback on common mistakes throughout. Each quiz mixes types, avoids repeats and ramps up in difficulty in practice. An optional "how sure are you?" rating feeds spaced repetition and a calibration summary. A mistake journal and per-skill mastery are included. Accounting courses (`workbench: journal`) get a desk calculator that opens by itself on calculation questions. |

The original three BDCC modules reproduce every number in the lecture decks:

| Module | Lecture | Lecture checks |
|---|---|---|
| `fim`: Frequent Itemset Mining & Association Rules | Sessions 3–4 | 22 |
| `nb-cf`: Neighborhood-based Collaborative Filtering | Sessions 5–7 | 55 |
| `lf-cf`: Latent-factor Collaborative Filtering | Sessions 8–10 | 8 |

More built-in modules cover the rest of BDCC (Spark DataFrames, pandas) and other courses: MANACC (managerial
accounting, `workbench: journal`), INTB and ML2. Run `ls modules` for the current list.

Errors found in the slides are shown in the lessons as **errata** callouts and are also collected on the cheat sheet (`/cheatsheet`).

Progress is kept **in your browser** (IndexedDB). Use *Settings → Export* and *Import* to move it between devices. Modules
are kept **on the server**, so every device sees the same topics.

---

## Quick start (Docker)

```bash
cp .env.example docker/.env        # then set ADMIN_TOKEN: at least 16 characters (openssl rand -hex 24)
docker compose -f docker/compose.yml up -d --build
# open http://localhost:8080   (Admin: the shield icon, top right)
```

compose publishes the port on `127.0.0.1` only. To reach the site from other machines, put a TLS reverse proxy in
front of it (see [Running behind TLS](#running-behind-tls--a-reverse-proxy)), or publish it on your Tailscale address
with `ports: ["${TS_IP}:8080:8080"]`.

Imported modules and module settings (enabled flags, order, course overrides) go in `./data`, which is mounted at `/data`. The image build runs
`kodigo validate` on the built-in modules and **fails if any of them is invalid**. The runtime image contains no
`node_modules`, because esbuild bundles the server (`index.js`, plus `logic-child.mjs` for the isolated logic host).

| Env var | Default | |
|---|---|---|
| `ADMIN_TOKEN` | (required in production) | bearer token for the admin API/panel. In production a token shorter than 16 characters, or the example `change-me`, keeps admin disabled (503, with the reason in the log). 10 wrong tokens from one IP within 15 minutes block that IP for the rest of the window (429). The panel keeps the token in the tab's `sessionStorage`, so each new tab asks for it. |
| `TRUST_PROXY` | (unset) | set to `true` (or the proxy's address list) behind a reverse proxy, so the admin rate limit counts per client IP instead of per proxy |
| `HSTS` | (unset) | `1` sends `strict-transport-security: max-age=31536000`; set it only when every client reaches the site over HTTPS |
| `PORT` / `HOST` | `8080` / `0.0.0.0` | |
| `DATA_DIR` | `/data` | imported modules (`modules/<id>@<version>/`, last 3 versions kept) + `state.json` |
| `MAX_UPLOAD_MB` | `30` | zip/paste upload limit |
| `DEFAULT_COURSE` | `BDCC` | course for modules whose manifest has no `course:` (and no course set in Admin) |
| `MODULES_BUILTIN` / `WEB_DIR` | `./modules` / `./web` | built-in modules folder · built SPA folder (resolved from the working directory) |
| `CHRISTMAS_QUIZ` | `auto` | Christmas countdown quiz: `auto` (one day opens at a time from Dec 13) · `on` (all open now) · `off` |
| `CHRISTMAS_TZ` / `CHRISTMAS_NOW` | `Asia/Manila` / (unset) | time zone for the countdown and the seasonal look · fake today's date (`YYYY-MM-DD`) to preview a day |
| `SEASON_THEME` | `auto` | seasonal look: `auto` (Hell Week Nov 10 – Dec 7, Immaculate Conception Dec 8, Christmas Dec 9 – Jan 6) · `off` · `hellweek` / `immaculate` / `christmas` (force one). `CHRISTMAS_QUIZ=off` also drops the Christmas look |
| `LOG_LEVEL` | `info` | Fastify log level |

### Running behind TLS / a reverse proxy

Never expose port 8080 directly: the admin token travels in a header, so it needs HTTPS. Keep compose's
`127.0.0.1:8080` binding and let a proxy on the same host terminate TLS, for example with Caddy:

```
study.example.com {
  reverse_proxy 127.0.0.1:8080
}
```

or nginx (`proxy_pass http://127.0.0.1:8080;` with `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`).
Then set `TRUST_PROXY=true` and `HSTS=1`: without it every request seems to come from the proxy, so all clients share one admin
rate-limit counter and one person's typos can lock everyone out.

### How imported module code is contained

`logic.js` comes from module authors, so it never runs with the server's privileges. On the server, validation (import,
dry run, health check) runs it in a short-lived child process with an empty environment (no `ADMIN_TOKEN`), the Node
permission model (no file reads beyond its own script, no child processes or workers), a 128 MB heap and a watchdog
that kills it after 2.5 s. In the browser it runs in a Web Worker with network, storage and nested-worker APIs removed
and a CSP that allows none of them. Node's permission model is a seat belt, not a hard sandbox, so import stays
admin-only: validate an untrusted bundle first with `pnpm kodigo validate` in a throwaway container.

## Development

Requirements: Node ≥ 20 and pnpm 10 (`corepack enable`).

```bash
pnpm install
pnpm dev            # Vite on :5173 (proxies /api) + the API server on :8080 with ADMIN_TOKEN=dev
pnpm test           # vitest: sdk, checkers, parser, bundles, validator, and all built-in modules
pnpm typecheck
pnpm lint           # ESLint
pnpm build          # web (Vite) + server (esbuild bundle → apps/server/dist/index.js)
pnpm pyodide:fetch  # Python 3.12 + pandas for the coding mock exam (~23 MB into apps/web/public/pyodide,
                    # sha256-checked; `pnpm dev` and the web build run it, so the first build needs network)
pnpm smoke          # Playwright: every scene plays to its takeaway, every section renders,
                    # every quiz template instantiates (starts the built server itself)
```

Running the production build locally (the preview config `qdigo-built` in `.claude/launch.json` does the same on :8095):

```bash
pnpm build
cd apps/server && MODULES_BUILTIN=../../modules WEB_DIR=../web/dist DATA_DIR=../../data ADMIN_TOKEN=dev node dist/index.js
```

Rebuilding the web app while the server runs is fine: static files are resolved per request.

## Repository layout

```
apps/web          React SPA (Vite, Tailwind, framer-motion, KaTeX, Shiki, Dexie)
  src/engine        scene scope/derive, beats & gates, trace player, stage
  src/widgets       the catalog widgets (lazy-loaded)
  src/tabs          Path / Intuition / Math & Code (or Journal) / Application
  src/quiz          session builder, runner, question renderer, review (SRS)
  src/admin         module list, import (zip / folder / paste), validation reports
  e2e               Playwright smoke test
apps/server       Fastify API + static hosting; module registry on disk
packages/schema   zod schemas, widget catalog, validator (7 steps), quiz builders & graders, bundle/zip I/O
packages/sdk      the `sdk` passed to logic.js (seeded RNG, formatting, vectors, matrices, least squares, sets)
packages/cli      `kodigo` CLI
modules/          built-in modules, one folder per module
docs/             ARCHITECTURE.md (code map), MVP_PLAN.md, MODULE_AUTHORING_GUIDE.md, WIDGETS.md (generated)
docker/           Dockerfile, compose.yml
```

## API

| Method | Path | Auth | |
|---|---|---|---|
| GET | `/api/health` | | liveness |
| GET | `/api/modules` | | list with meta, course, enabled, order, health, stored versions |
| GET | `/api/index` | | lightweight index of every module for cross-module pages (ETag, 304) |
| GET | `/api/modules/:id/files` · `/files/*` | | text files plus a list of binaries as JSON (ETag, 304) · one raw file |
| GET | `/api/modules/:id/report` | | server-side validation report |
| GET | `/api/modules/:id/export` | | zip |
| GET | `/api/widgets.md` | | widget reference for module authors |
| GET | `/api/christmas` | | Christmas countdown status; only unlocked days carry their content |
| GET | `/api/season` | | today's seasonal look: `{season: "hellweek" \| "immaculate" \| "christmas" \| null, today, range?: {start, end}}` |
| GET | `/api/admin/check` | admin | checks the admin token |
| POST | `/api/modules` | admin | multipart zip, or JSON `{files: {path: text \| {base64}}}`; `?dryRun=1`, `?allowDowngrade=1` (a downgrade otherwise returns 409), `?keepAssets=1` (keep the installed version's `assets/` and `sources/` when re-importing pasted bundle text) |
| PATCH | `/api/modules/:id` | admin | `{enabled?, order?, current?, course?}` (`current` rolls back to a stored version; `course` overrides the manifest's course, `""` clears the override) |
| DELETE | `/api/modules/:id` | admin | imported modules only; built-ins can only be disabled |

Admin routes answer 503 when admin is disabled, 401 for a wrong token and 429 (with `retry-after`) after too many
failed attempts from one IP. A PATCH body that doesn't match `{enabled?: boolean, order?: number, current?: string,
course?: string | null}` gets 400 and changes nothing (unknown keys are ignored). A server error answers
`{error: 'Internal server error', requestId}`; the details are in the log under that id. Raw files under `/files/*` are served with a sandboxing CSP (PDFs excepted), and `.js`
files as `text/plain`.

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
