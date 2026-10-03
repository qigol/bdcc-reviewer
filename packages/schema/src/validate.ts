/**
 * validateModule(): the import-time contract check (plan §11, guide §8/§12).
 * Steps: 1 structure · 2 YAML · 3 schema · 4 references · 5 logic (examples) · 6 quiz smoke · 7 lints.
 * Steps 5–6 need a LogicHost (browser worker, Node vm); pass none to run static checks only.
 */
import YAML, { LineCounter, isNode } from 'yaml';
import type { ZodError, ZodTypeAny } from 'zod';
import {
  Manifest, Dataset, ExamplesFile, GlossaryFile, IntuitionFile, MathCodeFile, ApplicationFile, QuizFile,
  REQUIRED_FILES, IDENT_RE,
  type Scene, type Section, type StageWidget, type Template, type Derive, type GeneratorOutput, type TraceStep,
} from './schemas';
import { WIDGET_BY_NAME, WIDGET_NAMES, COMMON_COMMANDS } from './widgets';
import { collectInterps, collectRefs, isRef, resolveRefs, interpolate, getPath, wordCount, type Scope } from './interpolate';
import { texAnchors, parseCodeAnchors } from './anchors';
import { sectionLiveWidgets, liveRoleTarget, PANE_ROLES } from './live';
import { parseExpr, varsOf } from './expr';
import { buildInstance, valuesEqual } from './quiz';
import type { FileMap } from './bundle';

export type Step = 'structure' | 'yaml' | 'schema' | 'refs' | 'logic' | 'quiz' | 'lint';
export const STEPS: { step: Step; label: string }[] = [
  { step: 'structure', label: 'Structure' },
  { step: 'yaml', label: 'YAML syntax' },
  { step: 'schema', label: 'Schema' },
  { step: 'refs', label: 'References' },
  { step: 'logic', label: 'Logic & lecture examples' },
  { step: 'quiz', label: 'Quiz smoke test' },
  { step: 'lint', label: 'Lints' },
];

export interface Issue {
  level: 'error' | 'warning';
  step: Step;
  file?: string;
  path?: string;
  line?: number;
  col?: number;
  message: string;
}

export interface ParsedModule {
  manifest: Manifest;
  sourceNotes: string;
  datasets: Record<string, Dataset>;
  logic: string;
  examples: ExamplesFile['examples'];
  glossary: GlossaryFile['terms'];
  intuition: IntuitionFile['scenes'];
  mathCode: MathCodeFile['sections'];
  application: ApplicationFile;
  quiz: QuizFile['templates'];
  widgetRequests?: string;
  assets: string[];
  sources: string[];
  labels: Record<string, string>;
}

export interface StepStatus { step: Step; label: string; status: 'ok' | 'warn' | 'error' | 'skipped'; }
export interface ValidationReport {
  ok: boolean;
  id?: string;
  version?: string;
  title?: string;
  issues: Issue[];
  steps: StepStatus[];
  stats?: { examples: number; examplesPassed: number; templates: number; instances: number; scenes: number; sections: number };
}

export interface LogicHost {
  fns: string[];
  generators: string[];
  call(fn: string, args: any): Promise<any>;
  generate(name: string, seed: number, difficulty: number): Promise<{ output?: GeneratorOutput; ms: number; error?: string }>;
  dispose?(): void;
}
export type LogicHostFactory = (source: string) => Promise<LogicHost>;

// ------------------------------------------------------------ helpers
const YAML_FILES: Record<string, ZodTypeAny> = {
  manifest: Manifest,
  examples: ExamplesFile,
  glossary: GlossaryFile,
  intuition: IntuitionFile,
  'math-code': MathCodeFile,
  application: ApplicationFile,
  quiz: QuizFile,
};

/** Find `name.yaml|yml|json` in the file map. */
function findFile(files: FileMap, base: string): string | undefined {
  for (const ext of ['yaml', 'yml', 'json']) if (typeof files[`${base}.${ext}`] === 'string') return `${base}.${ext}`;
  return undefined;
}

export function datasetPayload(ds: Dataset): any {
  switch (ds.kind) {
    case 'transactions': return ds.transactions;
    case 'matrix': return { rows: ds.rows, cols: ds.cols, values: ds.values };
    case 'table': return { columns: ds.columns, rows: ds.rows };
    case 'list': return ds.items;
    case 'json': return ds.value;
  }
}

export function datasetScope(mod: Pick<ParsedModule, 'datasets'>, ids?: string[]): Scope {
  const s: Scope = {};
  for (const id of ids ?? []) if (mod.datasets[id]) s[id] = datasetPayload(mod.datasets[id]);
  return s;
}
export function allDatasetPayloads(mod: Pick<ParsedModule, 'datasets'>): Record<string, any> {
  return Object.fromEntries(Object.entries(mod.datasets).map(([k, d]) => [k, datasetPayload(d)]));
}

interface YamlDoc { doc: YAML.Document; lc: LineCounter }

function zodIssues(err: ZodError, file: string, ydoc?: YamlDoc): Issue[] {
  return err.issues.map((i) => {
    const pos = ydoc ? posOf(ydoc, i.path) : undefined;
    return { level: 'error', step: 'schema', file, path: fmtPath(i.path), line: pos?.line, col: pos?.col, message: i.message };
  });
}

function fmtPath(path: (string | number)[]): string {
  return path.map((p, i) => (typeof p === 'number' ? `[${p}]` : i === 0 ? p : `.${p}`)).join('');
}

function posOf(y: YamlDoc, path: (string | number)[]): { line: number; col: number } | undefined {
  for (let n = path.length; n >= 0; n--) {
    try {
      const node = y.doc.getIn(path.slice(0, n), true);
      if (node && isNode(node) && node.range) {
        const p = y.lc.linePos(node.range[0]);
        return { line: p.line, col: p.col };
      }
    } catch { /* keep walking up */ }
  }
  return undefined;
}

export { transformLogicSource } from './logicSource';

// ------------------------------------------------------------ steps 1–3
export function parseModule(files: FileMap): { module?: ParsedModule; issues: Issue[] } {
  const issues: Issue[] = [];
  const err = (step: Step, message: string, extra: Partial<Issue> = {}) => issues.push({ level: 'error', step, message, ...extra });
  const warn = (step: Step, message: string, extra: Partial<Issue> = {}) => issues.push({ level: 'warning', step, message, ...extra });

  // 1. structure
  const paths = Object.keys(files);
  for (const req of REQUIRED_FILES) {
    const base = req.replace(/\.yaml$/, '');
    const found = req.endsWith('.yaml') ? findFile(files, base) : typeof files[req] === 'string' ? req : undefined;
    if (!found) err('structure', `Missing required file ${req}`, { file: req });
  }
  const datasetFiles = paths.filter((p) => /^datasets\/[^/]+\.(ya?ml|json)$/.test(p));
  if (!datasetFiles.length) err('structure', 'At least one dataset is required in datasets/<id>.yaml', { file: 'datasets/' });
  const known = new Set<string>([...REQUIRED_FILES, 'WIDGET_REQUESTS.md']);
  for (const p of paths) {
    const base = p.replace(/\.(ya?ml|json)$/, '.yaml');
    if (known.has(p) || known.has(base) || /^(datasets|assets|sources)\//.test(p)) continue;
    if (/^README(\.md)?$/i.test(p)) continue;
    warn('structure', `Unknown file ${p} (ignored)`, { file: p });
  }
  if (issues.some((i) => i.level === 'error')) return { issues };

  // 2–3. parse + schema
  const parsed: Record<string, any> = {};
  const docs: Record<string, YamlDoc> = {};
  const parseYaml = (file: string): any => {
    const text = files[file] as string;
    const lc = new LineCounter();
    const doc = YAML.parseDocument(text, { lineCounter: lc, prettyErrors: true, uniqueKeys: true });
    for (const e of doc.errors) {
      const p = e.linePos?.[0];
      err('yaml', e.message.split('\n')[0], { file, line: p?.line, col: p?.col });
    }
    for (const w of doc.warnings) {
      const p = w.linePos?.[0];
      warn('yaml', w.message.split('\n')[0], { file, line: p?.line, col: p?.col });
    }
    docs[file] = { doc, lc };
    if (doc.errors.length) return undefined;
    return doc.toJS({ maxAliasCount: 0 });
  };

  for (const [key, schema] of Object.entries(YAML_FILES)) {
    const file = findFile(files, key)!;
    let data: any;
    try { data = parseYaml(file); } catch (e: any) { err('yaml', String(e?.message ?? e), { file }); continue; }
    if (data === undefined) continue;
    const r = schema.safeParse(data);
    if (!r.success) issues.push(...zodIssues(r.error, file, docs[file]));
    else parsed[key] = r.data;
  }

  const datasets: Record<string, Dataset> = {};
  for (const file of datasetFiles) {
    let data: any;
    try { data = parseYaml(file); } catch (e: any) { err('yaml', String(e?.message ?? e), { file }); continue; }
    if (data === undefined) continue;
    const r = Dataset.safeParse(data);
    if (!r.success) { issues.push(...zodIssues(r.error, file, docs[file])); continue; }
    const expected = file.replace(/^datasets\//, '').replace(/\.(ya?ml|json)$/, '');
    if (r.data.id !== expected) err('schema', `Dataset id "${r.data.id}" must match its file name (${expected})`, { file, path: 'id' });
    if (datasets[r.data.id]) err('schema', `Duplicate dataset id "${r.data.id}"`, { file });
    datasets[r.data.id] = r.data;
  }

  if (issues.some((i) => i.level === 'error')) return { issues };

  const labels: Record<string, string> = {};
  for (const d of Object.values(datasets)) Object.assign(labels, (d as any).labels ?? {});

  const module: ParsedModule = {
    manifest: parsed.manifest,
    sourceNotes: files['SOURCE_NOTES.md'] as string,
    datasets,
    logic: files['logic.js'] as string,
    examples: parsed.examples.examples,
    glossary: parsed.glossary.terms,
    intuition: parsed.intuition.scenes,
    mathCode: parsed['math-code'].sections,
    application: parsed.application,
    quiz: parsed.quiz.templates,
    widgetRequests: typeof files['WIDGET_REQUESTS.md'] === 'string' ? (files['WIDGET_REQUESTS.md'] as string) : undefined,
    assets: paths.filter((p) => p.startsWith('assets/')),
    sources: paths.filter((p) => p.startsWith('sources/')),
    labels,
  };
  return { module, issues };
}

// ------------------------------------------------------------ step 4: references
interface Ctx {
  mod: ParsedModule;
  issues: Issue[];
  usedWidgets: Set<string>;
  fnRefs: { fn: string; file: string; path: string }[];
  genRefs: { gen: string; file: string; path: string }[];
}

function uniqueIds(list: { id?: string }[], kind: string, file: string, ctx: Ctx, pathPrefix: string) {
  const seen = new Set<string>();
  list.forEach((x, i) => {
    if (!x.id) return;
    if (seen.has(x.id)) ctx.issues.push({ level: 'error', step: 'refs', file, path: `${pathPrefix}[${i}].id`, message: `Duplicate ${kind} id "${x.id}"` });
    seen.add(x.id);
  });
}

function checkText(text: unknown, scope: Set<string> | null, file: string, path: string, ctx: Ctx) {
  if (typeof text !== 'string' || scope === null) return;
  for (const { path: p, format } of collectInterps(text)) {
    const head = p.split('.')[0];
    if (!scope.has(head)) ctx.issues.push({ level: 'error', step: 'refs', file, path, message: `{=${p}} does not resolve: "${head}" is not a dataset, state key or derived value in this scope` });
    if (format && !/^(\d|\df|frac|pct\d?|int|set|list|text)$/.test(format)) ctx.issues.push({ level: 'warning', step: 'refs', file, path, message: `Unknown format "|${format}" in {=${p}|${format}}` });
  }
}

function checkDeepText(value: unknown, scope: Set<string> | null, file: string, path: string, ctx: Ctx) {
  if (typeof value === 'string') checkText(value, scope, file, path, ctx);
  else if (Array.isArray(value)) value.forEach((v, i) => checkDeepText(v, scope, file, `${path}[${i}]`, ctx));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) checkDeepText(v, scope, file, `${path}.${k}`, ctx);
}

function checkRefsIn(value: unknown, scope: Set<string> | null, file: string, path: string, ctx: Ctx) {
  if (scope === null) return;
  for (const r of collectRefs(value)) {
    const head = r.split('.')[0];
    if (!scope.has(head)) ctx.issues.push({ level: 'error', step: 'refs', file, path, message: `Reference '@${r}' does not resolve: "${head}" is not in this scope` });
  }
}

function hasRefDeep(v: unknown): boolean {
  if (isRef(v)) return true;
  if (typeof v === 'string') return v.includes('{=');
  if (Array.isArray(v)) return v.some(hasRefDeep);
  if (v && typeof v === 'object') return Object.values(v).some(hasRefDeep);
  return false;
}

function buildScope(ctx: Ctx, file: string, path: string, opts: { data?: string[]; state?: Record<string, any>; derive?: Derive[]; extra?: string[] }): Set<string> {
  const names = new Map<string, string>();
  const add = (n: string, src: string) => {
    if (names.has(n)) ctx.issues.push({ level: 'error', step: 'refs', file, path, message: `Scope name "${n}" is defined twice (${names.get(n)} and ${src})` });
    names.set(n, src);
  };
  for (const d of opts.data ?? []) {
    if (!ctx.mod.datasets[d]) ctx.issues.push({ level: 'error', step: 'refs', file, path: `${path}.data`, message: `Unknown dataset "${d}"` });
    add(d, 'dataset');
  }
  for (const k of Object.keys(opts.state ?? {})) add(k, 'state');
  (opts.derive ?? []).forEach((d, i) => {
    add(d.out, 'derive');
    ctx.fnRefs.push({ fn: d.fn, file, path: `${path}.derive[${i}].fn` });
  });
  for (const e of opts.extra ?? []) add(e, 'StepPlayer out');
  const scope = new Set(names.keys());
  // derive inputs may reference earlier outputs and anything in scope
  (opts.derive ?? []).forEach((d, i) => checkRefsIn(d.in, scope, file, `${path}.derive[${i}].in`, ctx));
  return scope;
}

function checkStage(stage: StageWidget[], scope: Set<string> | null, stateKeys: Set<string>, file: string, path: string, ctx: Ctx, seenIds?: Set<string>) {
  const ids = seenIds ?? new Set<string>();
  stage.forEach((w, i) => {
    const p = `${path}[${i}]`;
    if (ids.has(w.id)) ctx.issues.push({ level: 'error', step: 'refs', file, path: `${p}.id`, message: `Duplicate widget id "${w.id}"` });
    ids.add(w.id);
    const meta = WIDGET_BY_NAME[w.widget];
    if (!meta) {
      ctx.issues.push({ level: 'error', step: 'refs', file, path: `${p}.widget`, message: `Unknown widget "${w.widget}". Available: ${WIDGET_NAMES.join(', ')}` });
      return;
    }
    ctx.usedWidgets.add(w.widget);
    const props = w.props ?? {};
    for (const [k, v] of Object.entries(props)) {
      const shape = meta.props[k] as ZodTypeAny | undefined;
      if (!shape) {
        ctx.issues.push({ level: 'warning', step: 'refs', file, path: `${p}.props.${k}`, message: `${w.widget} has no prop "${k}" (ignored)` });
        continue;
      }
      if (hasRefDeep(v)) continue;
      const r = shape.safeParse(v);
      if (!r.success) ctx.issues.push({ level: 'error', step: 'refs', file, path: `${p}.props.${k}`, message: `${w.widget}.${k}: ${r.error.issues[0]?.message ?? 'invalid'} (${fmtPath(r.error.issues[0]?.path ?? [])})` });
    }
    for (const [k, s] of Object.entries(meta.props)) {
      if ((s as ZodTypeAny).isOptional()) continue;
      const bound = w.bind && Object.keys(w.bind).includes(k);
      if (!(k in props) && !bound) ctx.issues.push({ level: 'error', step: 'refs', file, path: `${p}.props`, message: `${w.widget} requires prop "${k}"` });
    }
    if (w.widget === 'Matrix' && !('data' in props) && !('values' in props)) ctx.issues.push({ level: 'error', step: 'refs', file, path: `${p}.props`, message: 'Matrix needs `data` or `rows`/`cols`/`values`' });
    if (w.widget === 'Formula' && !('tex' in props) && !('steps' in props)) ctx.issues.push({ level: 'error', step: 'refs', file, path: `${p}.props`, message: 'Formula needs `tex` or `steps`' });
    for (const [out, key] of Object.entries(w.bind ?? {})) {
      if (!(out in meta.bind)) ctx.issues.push({ level: 'error', step: 'refs', file, path: `${p}.bind.${out}`, message: `${w.widget} has no bind output "${out}" (has: ${Object.keys(meta.bind).join(', ') || 'none'})` });
      if (scope !== null && !stateKeys.has(key)) ctx.issues.push({ level: 'error', step: 'refs', file, path: `${p}.bind.${out}`, message: `bind target "${key}" must be a state key declared in \`state:\`` });
    }
    checkRefsIn(props, scope, file, `${p}.props`, ctx);
    checkDeepText(props, scope, file, `${p}.props`, ctx);
    if (w.widget === 'StepPlayer' && typeof props.fn === 'string') ctx.fnRefs.push({ fn: props.fn, file, path: `${p}.props.fn` });
    if (w.widget === 'FunctionPlot' && typeof props.fn === 'string') ctx.fnRefs.push({ fn: props.fn, file, path: `${p}.props.fn` });
  });
  // StepPlayer roles must point at stage ids
  stage.forEach((w, i) => {
    if (w.widget !== 'StepPlayer') return;
    const roles = (w.props?.roles ?? {}) as Record<string, string>;
    for (const [role, target] of Object.entries(roles)) {
      if (typeof target === 'string' && !ids.has(target)) ctx.issues.push({ level: 'error', step: 'refs', file, path: `${path}[${i}].props.roles.${role}`, message: `Role "${role}" points at unknown widget id "${target}"` });
    }
  });
  return ids;
}

function checkLessonRef(ref: { tab: string; id: string } | undefined, file: string, path: string, ctx: Ctx) {
  if (!ref) return;
  const m = ctx.mod;
  const ok =
    ref.tab === 'intuition' ? m.intuition.some((s) => s.id === ref.id)
    : ref.tab === 'math-code' ? m.mathCode.some((s) => s.id === ref.id)
    : m.application.case.cells.some((c) => c.id === ref.id) || m.application.case.id === ref.id;
  if (!ok) ctx.issues.push({ level: 'error', step: 'refs', file, path, message: `lessonRef ${ref.tab}/${ref.id} does not exist` });
}

function checkSkills(skills: string[] | undefined, file: string, path: string, ctx: Ctx) {
  const known = new Set(ctx.mod.manifest.skills.map((s) => s.id));
  for (const s of skills ?? []) if (!known.has(s)) ctx.issues.push({ level: 'error', step: 'refs', file, path, message: `Unknown skill "${s}" (declare it in manifest.skills)` });
}

function stepPlayerOuts(stage: StageWidget[]): string[] {
  return stage.filter((w) => w.widget === 'StepPlayer' && typeof w.props?.out === 'string').map((w) => w.props!.out as string);
}

function checkScene(scene: Scene, i: number, ctx: Ctx) {
  const file = 'intuition.yaml';
  const p = `scenes[${i}]`;
  checkSkills(scene.skills, file, `${p}.skills`, ctx);
  const scope = buildScope(ctx, file, p, { data: scene.data, state: scene.state, derive: scene.derive, extra: stepPlayerOuts(scene.stage) });
  const stateKeys = new Set(Object.keys(scene.state ?? {}));
  const ids = checkStage(scene.stage, scope, stateKeys, file, `${p}.stage`, ctx);
  const byId = Object.fromEntries(scene.stage.map((w) => [w.id, w]));
  checkText(scene.goal, scope, file, `${p}.goal`, ctx);
  checkText(scene.takeaway, scope, file, `${p}.takeaway`, ctx);
  scene.beats.forEach((b, j) => {
    const bp = `${p}.beats[${j}]`;
    checkText(b.say, scope, file, `${bp}.say`, ctx);
    for (const k of Object.keys(b.set ?? {})) if (!stateKeys.has(k)) ctx.issues.push({ level: 'error', step: 'refs', file, path: `${bp}.set.${k}`, message: `set: "${k}" is not a declared state key` });
    checkRefsIn(b.set, scope, file, `${bp}.set`, ctx);
    for (const id of [...(b.show ?? []), ...(b.hide ?? [])]) if (!ids.has(id)) ctx.issues.push({ level: 'error', step: 'refs', file, path: bp, message: `show/hide: unknown widget id "${id}"` });
    (b.do ?? []).forEach((c, k) => {
      const w = byId[c.target];
      if (!w) { ctx.issues.push({ level: 'error', step: 'refs', file, path: `${bp}.do[${k}]`, message: `do: unknown target "${c.target}"` }); return; }
      const meta = WIDGET_BY_NAME[w.widget];
      if (meta && !(c.cmd in meta.commands) && !(c.cmd in COMMON_COMMANDS))
        ctx.issues.push({ level: 'error', step: 'refs', file, path: `${bp}.do[${k}].cmd`, message: `${w.widget} has no command "${c.cmd}" (has: ${[...Object.keys(meta.commands), ...Object.keys(COMMON_COMMANDS)].join(', ')})` });
      checkRefsIn(c.args, scope, file, `${bp}.do[${k}].args`, ctx);
    });
    const g = b.gate;
    if (!g) return;
    if (g.type === 'predict') {
      checkText(g.question, scope, file, `${bp}.gate.question`, ctx);
      checkText(g.explain, scope, file, `${bp}.gate.explain`, ctx);
      g.options?.forEach((o, k) => checkText(o, scope, file, `${bp}.gate.options[${k}]`, ctx));
      if (g.options) {
        const a = typeof g.answer === 'number' ? g.answer : g.answer.value;
        if (!Number.isInteger(a) || a < 0 || a >= g.options.length) ctx.issues.push({ level: 'error', step: 'refs', file, path: `${bp}.gate.answer`, message: `predict answer must be an option index 0..${g.options.length - 1}` });
      }
    } else if (g.type === 'when') {
      checkText(g.prompt, scope, file, `${bp}.gate.prompt`, ctx);
      try {
        const node = parseExpr(g.when);
        for (const v of varsOf(node)) if (!scope.has(v.split('.')[0])) ctx.issues.push({ level: 'error', step: 'refs', file, path: `${bp}.gate.when`, message: `when: "${v.split('.')[0]}" is not in scope` });
      } catch (e: any) {
        ctx.issues.push({ level: 'error', step: 'refs', file, path: `${bp}.gate.when`, message: `when expression does not parse: ${e.message}` });
      }
    } else if (g.type === 'event') {
      checkText(g.prompt, scope, file, `${bp}.gate.prompt`, ctx);
      const w = byId[g.target];
      if (!w) ctx.issues.push({ level: 'error', step: 'refs', file, path: `${bp}.gate.target`, message: `event gate: unknown target "${g.target}"` });
      else if (WIDGET_BY_NAME[w.widget] && !(g.event in WIDGET_BY_NAME[w.widget].events))
        ctx.issues.push({ level: 'error', step: 'refs', file, path: `${bp}.gate.event`, message: `${w.widget} never emits "${g.event}" (emits: ${Object.keys(WIDGET_BY_NAME[w.widget].events).join(', ') || 'nothing'})` });
    }
  });
}

export function sectionAnchors(s: Section) {
  const tex = new Set<string>();
  s.steps.forEach((st) => texAnchors(st.tex).forEach((a) => tex.add(a)));
  texAnchors(s.keyFormula).forEach((a) => tex.add(a));
  const main = parseCodeAnchors(s.code.source, s.code.lang ?? 'python');
  const code = new Set(Object.keys(main.anchors));
  const extra = new Set<string>();
  for (const e of s.extraCode ?? []) Object.keys(parseCodeAnchors(e.source, e.lang ?? 'python').anchors).forEach((a) => extra.add(a));
  return { tex, code, extra, problems: main.problems, lines: main.lines.length };
}

/** Lines of displayed code, not counting Python docstrings (they document the code; the 30-line limit is about the logic). */
export function codeLineCount(source: string, lang = 'python'): number {
  const lines = parseCodeAnchors(source, lang).lines;
  if (lang !== 'python') return lines.length;
  let n = 0, inDoc = false;
  for (const l of lines) {
    const t = l.trim();
    const quotes = (t.match(/"""/g) ?? []).length;
    if (inDoc) { if (quotes % 2 === 1) inDoc = false; continue; }
    if (t.startsWith('"""')) { if (quotes % 2 === 1) inDoc = true; continue; }
    n++;
  }
  return n;
}

function checkSection(s: Section, i: number, ctx: Ctx) {
  const file = 'math-code.yaml';
  const p = `sections[${i}]`;
  checkSkills(s.skills, file, `${p}.skills`, ctx);
  const scope = buildScope(ctx, file, p, { data: s.data, state: s.state, derive: s.derive });
  if (s.live) checkStage(s.live, scope, new Set(Object.keys(s.state ?? {})), file, `${p}.live`, ctx);
  checkText(s.summary, scope, file, `${p}.summary`, ctx);
  s.steps.forEach((st, j) => { checkText(st.tex, scope, file, `${p}.steps[${j}].tex`, ctx); checkText(st.say, scope, file, `${p}.steps[${j}].say`, ctx); });
  if (s.keyFormula && s.keyFormula.includes('{=')) ctx.issues.push({ level: 'error', step: 'refs', file, path: `${p}.keyFormula`, message: 'keyFormula goes to the cheat sheet and must not contain {=…}' });
  s.links.forEach((l, j) => checkText(l.say, scope, file, `${p}.links[${j}].say`, ctx));
  s.pitfalls?.forEach((t, j) => checkText(t, scope, file, `${p}.pitfalls[${j}]`, ctx));
  checkText(s.examTip, scope, file, `${p}.examTip`, ctx);
  const a = sectionAnchors(s);
  for (const pr of a.problems) ctx.issues.push({ level: 'error', step: 'refs', file, path: `${p}.code.source`, message: pr });
  for (const x of a.tex) if (!a.code.has(x) && !a.extra.has(x)) ctx.issues.push({ level: 'error', step: 'refs', file, path: `${p}.steps`, message: `\\anchor{${x}} has no matching "# @a ${x}" in the code` });
  for (const x of a.code) if (!a.tex.has(x)) ctx.issues.push({ level: 'error', step: 'refs', file, path: `${p}.code.source`, message: `code anchor "@a ${x}" has no matching \\anchor{${x}}{…} in the derivation` });
  const linkAnchors = new Set(s.links.map((l) => l.anchor));
  for (const x of a.tex) if (!linkAnchors.has(x)) ctx.issues.push({ level: 'error', step: 'refs', file, path: `${p}.links`, message: `anchor "${x}" is missing from links` });
  for (const x of linkAnchors) if (!a.tex.has(x)) ctx.issues.push({ level: 'error', step: 'refs', file, path: `${p}.links`, message: `links lists "${x}" but no \\anchor{${x}} exists in this section` });
  if (s.trace) {
    ctx.fnRefs.push({ fn: s.trace.fn, file, path: `${p}.trace.fn` });
    checkRefsIn(s.trace.in, scope, file, `${p}.trace.in`, ctx);
  }
  for (const e of s.examples ?? []) if (!ctx.mod.examples.some((x) => x.id === e)) ctx.issues.push({ level: 'error', step: 'refs', file, path: `${p}.examples`, message: `Unknown example "${e}"` });
}

function checkApplication(ctx: Ctx) {
  const file = 'application.yaml';
  const app = ctx.mod.application;
  const c = app.case;
  const outs = c.cells.flatMap((cell) => stepPlayerOuts(cell.stage ?? []));
  const scope = buildScope(ctx, file, 'case', { data: c.data, state: c.state, derive: c.derive, extra: outs });
  const stateKeys = new Set(Object.keys(c.state ?? {}));
  checkText(c.story, scope, file, 'case.story', ctx);
  uniqueIds(c.cells, 'cell', file, ctx, 'case.cells');
  const ids = new Set<string>();
  c.cells.forEach((cell, i) => {
    const p = `case.cells[${i}]`;
    checkText(cell.say, scope, file, `${p}.say`, ctx);
    if (cell.stage) checkStage(cell.stage, scope, stateKeys, file, `${p}.stage`, ctx, ids);
    if (cell.decision) {
      checkText(cell.decision.prompt, scope, file, `${p}.decision.prompt`, ctx);
      checkText(cell.decision.model, scope, file, `${p}.decision.model`, ctx);
      if (cell.decision.type === 'mcq') {
        const n = cell.decision.options?.length ?? 0;
        if (n < 2) ctx.issues.push({ level: 'error', step: 'refs', file, path: `${p}.decision`, message: 'mcq decision needs ≥ 2 options' });
        if (cell.decision.answer !== undefined && (cell.decision.answer < 0 || cell.decision.answer >= n)) ctx.issues.push({ level: 'error', step: 'refs', file, path: `${p}.decision.answer`, message: 'answer index out of range' });
      }
    }
  });
}

function checkTemplate(t: Template, i: number, ctx: Ctx) {
  const file = 'quiz.yaml';
  const p = `templates[${i}]`;
  checkSkills(t.skills, file, `${p}.skills`, ctx);
  checkLessonRef(t.lessonRef, file, `${p}.lessonRef`, ctx);
  for (const d of t.data ?? []) if (!ctx.mod.datasets[d]) ctx.issues.push({ level: 'error', step: 'refs', file, path: `${p}.data`, message: `Unknown dataset "${d}"` });
  if (t.generator) ctx.genRefs.push({ gen: t.generator, file, path: `${p}.generator` });
  const scope = t.generator ? null : new Set(t.data ?? []);
  checkText(t.prompt, scope, file, `${p}.prompt`, ctx);
  checkText(t.explanation, scope, file, `${p}.explanation`, ctx);
  if (t.show) checkStage(t.show, scope, new Set(), file, `${p}.show`, ctx);
  switch (t.type) {
    case 'mcq':
    case 'multi':
      if (!t.generator && (!t.options || t.answer === undefined)) ctx.issues.push({ level: 'error', step: 'refs', file, path: p, message: `${t.type} without a generator needs static options and answer` });
      break;
    case 'numeric':
      if (t.answer.var && !t.generator) ctx.issues.push({ level: 'error', step: 'refs', file, path: `${p}.answer.var`, message: 'answer.var needs a generator (or use answer.value)' });
      break;
    case 'hand-calc':
      t.steps.forEach((s, j) => { if (s.answer.var && !t.generator) ctx.issues.push({ level: 'error', step: 'refs', file, path: `${p}.steps[${j}].answer.var`, message: 'answer.var needs a generator' }); });
      break;
    case 'code-fill': {
      const inCode = new Set([...t.code.matchAll(/__BLANK_(\d+)__/g)].map((m) => m[1]));
      const declared = new Set(Object.keys(t.blanks));
      for (const b of inCode) if (!declared.has(b)) ctx.issues.push({ level: 'error', step: 'refs', file, path: `${p}.blanks`, message: `__BLANK_${b}__ has no entry in blanks` });
      for (const b of declared) if (!inCode.has(b)) ctx.issues.push({ level: 'error', step: 'refs', file, path: `${p}.blanks.${b}`, message: `blank "${b}" does not appear as __BLANK_${b}__ in the code` });
      for (const [k, b] of Object.entries(t.blanks)) {
        if (!b.accept?.length && !b.regex) ctx.issues.push({ level: 'error', step: 'refs', file, path: `${p}.blanks.${k}`, message: 'each blank needs accept[] or regex' });
        if (b.regex) { try { new RegExp(b.regex); } catch (e: any) { ctx.issues.push({ level: 'error', step: 'refs', file, path: `${p}.blanks.${k}.regex`, message: `invalid regex: ${e.message}` }); } }
      }
      break;
    }
    case 'match':
      if (t.pick && t.pick > t.pairs.length) ctx.issues.push({ level: 'error', step: 'refs', file, path: `${p}.pick`, message: 'pick is larger than the number of pairs' });
      break;
  }
}

export function checkIntegrity(mod: ParsedModule): { issues: Issue[]; fnRefs: Ctx['fnRefs']; genRefs: Ctx['genRefs']; usedWidgets: string[] } {
  const ctx: Ctx = { mod, issues: [], usedWidgets: new Set(), fnRefs: [], genRefs: [] };
  const m = mod.manifest;
  uniqueIds(m.skills, 'skill', 'manifest.yaml', ctx, 'skills');
  if (m.prerequisites?.includes(m.id)) ctx.issues.push({ level: 'error', step: 'refs', file: 'manifest.yaml', path: 'prerequisites', message: 'A module cannot be its own prerequisite' });
  uniqueIds(mod.examples, 'example', 'examples.yaml', ctx, 'examples');
  uniqueIds(mod.glossary, 'term', 'glossary.yaml', ctx, 'terms');
  uniqueIds(mod.intuition, 'scene', 'intuition.yaml', ctx, 'scenes');
  uniqueIds(mod.mathCode, 'section', 'math-code.yaml', ctx, 'sections');
  uniqueIds(mod.quiz, 'template', 'quiz.yaml', ctx, 'templates');
  const dsIds = new Set(Object.keys(mod.datasets));
  mod.examples.forEach((e, i) => {
    ctx.fnRefs.push({ fn: e.fn, file: 'examples.yaml', path: `examples[${i}].fn` });
    checkRefsIn(e.in, dsIds, 'examples.yaml', `examples[${i}].in`, ctx);
  });
  const termIds = new Set(mod.glossary.map((t) => t.id));
  mod.glossary.forEach((t, i) => {
    for (const r of t.related ?? []) if (!termIds.has(r)) ctx.issues.push({ level: 'error', step: 'refs', file: 'glossary.yaml', path: `terms[${i}].related`, message: `Unknown related term "${r}"` });
    checkLessonRef(t.lessonRef, 'glossary.yaml', `terms[${i}].lessonRef`, ctx);
    checkSkills(t.skills, 'glossary.yaml', `terms[${i}].skills`, ctx);
    for (const f of ['short', 'long', 'formula'] as const) if (typeof t[f] === 'string' && (t[f] as string).includes('{=')) ctx.issues.push({ level: 'error', step: 'refs', file: 'glossary.yaml', path: `terms[${i}].${f}`, message: 'Glossary text has no scope; remove {=…}' });
  });
  mod.intuition.forEach((s, i) => checkScene(s, i, ctx));
  mod.mathCode.forEach((s, i) => checkSection(s, i, ctx));
  checkApplication(ctx);
  mod.quiz.forEach((t, i) => checkTemplate(t, i, ctx));
  const listed = new Set(m.requires.widgets);
  for (const w of m.requires.widgets) if (!WIDGET_BY_NAME[w]) ctx.issues.push({ level: 'error', step: 'refs', file: 'manifest.yaml', path: 'requires.widgets', message: `Unknown widget "${w}"` });
  for (const w of ctx.usedWidgets) if (!listed.has(w)) ctx.issues.push({ level: 'error', step: 'refs', file: 'manifest.yaml', path: 'requires.widgets', message: `Widget "${w}" is used but not listed in requires.widgets` });
  for (const w of listed) if (!ctx.usedWidgets.has(w) && WIDGET_BY_NAME[w]) ctx.issues.push({ level: 'warning', step: 'refs', file: 'manifest.yaml', path: 'requires.widgets', message: `Widget "${w}" is listed but never used` });
  return { issues: ctx.issues, fnRefs: ctx.fnRefs, genRefs: ctx.genRefs, usedWidgets: [...ctx.usedWidgets] };
}

// ------------------------------------------------------------ step 7: lints
export function lintModule(mod: ParsedModule): Issue[] {
  const out: Issue[] = [];
  const w = (file: string, message: string, path?: string) => out.push({ level: 'warning', step: 'lint', file, path, message });
  const limit = (text: string | undefined, max: number, file: string, path: string, what: string) => {
    if (!text) return;
    const n = wordCount(text);
    if (n > max) w(file, `${what} has ${n} words (limit ${max})`, path);
  };
  const m = mod.manifest;
  if (!m.course?.trim()) w('manifest.yaml', 'no `course`: the site files this module under its default course. Set `course:` (e.g. BDCC) so it lands in the right course menu and quiz pool', 'course');
  if (m.skills.length < 6 || m.skills.length > 12) w('manifest.yaml', `${m.skills.length} skills (guide: 6–12)`, 'skills');
  limit(m.summary, 50, 'manifest.yaml', 'summary', 'summary');
  if (mod.intuition.length < 6 || mod.intuition.length > 10) w('intuition.yaml', `${mod.intuition.length} scenes (guide: 6–10)`);
  let interactive = 0;
  mod.intuition.forEach((s, i) => {
    const p = `scenes[${i}]`;
    if (s.beats.length < 4 || s.beats.length > 10) w('intuition.yaml', `scene "${s.id}" has ${s.beats.length} beats (guide: 4–10)`, p);
    if (!s.beats.some((b) => b.gate?.type === 'predict')) w('intuition.yaml', `scene "${s.id}" has no predict gate`, p);
    if (s.beats.some((b) => b.gate?.type === 'when' || b.gate?.type === 'event')) interactive++;
    s.beats.forEach((b, j) => limit(b.say, 60, 'intuition.yaml', `${p}.beats[${j}].say`, 'beat narration'));
    limit(s.takeaway, 25, 'intuition.yaml', `${p}.takeaway`, 'takeaway');
  });
  if (mod.intuition.length && interactive / mod.intuition.length < 0.5) w('intuition.yaml', `only ${interactive}/${mod.intuition.length} scenes have an interactive (when/event) gate (guide: ≥ 50%)`);
  mod.mathCode.forEach((s, i) => {
    const p = `sections[${i}]`;
    limit(s.summary, 60, 'math-code.yaml', `${p}.summary`, 'section summary');
    if (!s.examTip) w('math-code.yaml', `section "${s.id}" has no examTip`, p);
    const lines = codeLineCount(s.code.source, s.code.lang ?? 'python');
    if (lines > 30) w('math-code.yaml', `section "${s.id}" code has ${lines} lines, not counting docstrings (limit 30)`, `${p}.code`);
    const a = sectionAnchors(s);
    if (a.tex.size < 2 && s.steps.length > 2) w('math-code.yaml', `section "${s.id}" has fewer than 2 anchors`, p);
  });
  mod.application.case.cells.forEach((c, i) => limit(c.say, 90, 'application.yaml', `case.cells[${i}].say`, 'cell narration'));
  const cells = mod.application.case.cells.length;
  if (cells < 5 || cells > 9) w('application.yaml', `${cells} cells (guide: 5–9)`);
  const decisions = mod.application.case.cells.filter((c) => c.decision).length;
  if (decisions < 3) w('application.yaml', `${decisions} decision cells (guide: ≥ 3)`);
  if (!mod.application.atScale) w('application.yaml', 'no atScale section');
  if (!mod.application.tradeoffs) w('application.yaml', 'no tradeoffs table');
  mod.glossary.forEach((t, i) => limit(t.short, 25, 'glossary.yaml', `terms[${i}].short`, `glossary "${t.id}" short`));
  if (mod.glossary.length < 10) w('glossary.yaml', `${mod.glossary.length} terms (guide: typically 10–25)`);
  const q = mod.quiz;
  if (q.length < 25) w('quiz.yaml', `${q.length} templates (guide: ≥ 25)`);
  q.forEach((t, i) => limit(t.explanation, 120, 'quiz.yaml', `templates[${i}].explanation`, 'explanation'));
  const bySkill: Record<string, number> = {};
  q.forEach((t) => t.skills.forEach((s) => (bySkill[s] = (bySkill[s] ?? 0) + 1)));
  for (const s of m.skills) if ((bySkill[s.id] ?? 0) < 2) w('quiz.yaml', `skill "${s.id}" has ${bySkill[s.id] ?? 0} templates (guide: ≥ 2)`);
  const count = (f: (t: Template) => boolean) => q.filter(f).length;
  const quotas: [string, number, number][] = [
    ['generator-driven numeric/hand-calc', count((t) => (t.type === 'numeric' || t.type === 'hand-calc') && !!t.generator), 8],
    ['hand-calc', count((t) => t.type === 'hand-calc'), 2],
    ['mcq/multi', count((t) => t.type === 'mcq' || t.type === 'multi'), 6],
    ['code-fill', count((t) => t.type === 'code-fill'), 4],
    ['order', count((t) => t.type === 'order'), 2],
    ['match', count((t) => t.type === 'match'), 2],
  ];
  for (const [label, n, min] of quotas) if (n < min) w('quiz.yaml', `${n} ${label} templates (guide: ≥ ${min})`);
  const scenesSkills = new Set(mod.intuition.flatMap((s) => s.skills ?? []));
  const sectionSkills = new Set(mod.mathCode.flatMap((s) => s.skills));
  for (const s of m.skills) {
    if (!scenesSkills.has(s.id)) w('intuition.yaml', `skill "${s.id}" appears in no scene`);
    if (!sectionSkills.has(s.id)) w('math-code.yaml', `skill "${s.id}" appears in no math-code section`);
  }
  const notesErrata = /##\s*Errata\s*\n([\s\S]*?)(\n##\s|$)/i.exec(mod.sourceNotes ?? '');
  const hasNotesErrata = !!notesErrata && /^\s*-\s+\S/m.test(notesErrata[1]) && !/^\s*-\s*(none|n\/a)/im.test(notesErrata[1]);
  const hasModuleErrata =
    mod.mathCode.some((s) => s.errata?.length) ||
    JSON.stringify(mod.intuition).includes('"errata"') ||
    JSON.stringify(mod.application).includes('"errata"');
  if (hasNotesErrata && !hasModuleErrata) w('SOURCE_NOTES.md', 'SOURCE_NOTES lists errata but no section `errata` or errata Callout shows them');
  const text = JSON.stringify([mod.intuition, mod.mathCode, mod.application, mod.quiz, mod.glossary]);
  if (/\bTODO\b|\bTBD\b|lorem ipsum/i.test(text)) w('module', 'placeholder text (TODO/TBD/lorem) found');
  return out;
}

// ------------------------------------------------------------ steps 5–6: logic + quiz smoke
async function runDerive(host: LogicHost, derive: Derive[] | undefined, scope: Scope): Promise<Scope> {
  for (const d of derive ?? []) {
    const args = resolveRefs(d.in, scope);
    scope[d.out] = await host.call(d.fn, args);
  }
  return scope;
}

export interface LogicCheckResult { issues: Issue[]; examples: number; examplesPassed: number; instances: number }

export async function runLogicChecks(
  mod: ParsedModule,
  host: LogicHost,
  refs: { fnRefs: Ctx['fnRefs']; genRefs: Ctx['genRefs'] },
  opts: { seeds?: number; skipQuiz?: boolean } = {},
): Promise<LogicCheckResult> {
  const issues: Issue[] = [];
  const E = (step: Step, file: string, path: string | undefined, message: string) => issues.push({ level: 'error', step, file, path, message });
  const W = (step: Step, file: string, path: string | undefined, message: string) => issues.push({ level: 'warning', step, file, path, message });
  const fnSet = new Set(host.fns);
  const genSet = new Set(host.generators);
  for (const r of refs.fnRefs) if (!fnSet.has(r.fn)) E('logic', r.file, r.path, `logic.js has no fn "${r.fn}" (fns: ${host.fns.join(', ')})`);
  for (const r of refs.genRefs) if (!genSet.has(r.gen)) E('logic', r.file, r.path, `logic.js has no generator "${r.gen}" (generators: ${host.generators.join(', ')})`);
  const data = allDatasetPayloads(mod);

  // examples
  let passed = 0;
  for (const [i, ex] of mod.examples.entries()) {
    if (!fnSet.has(ex.fn)) continue;
    const missing: string[] = [];
    const args = resolveRefs(ex.in, data, missing);
    if (missing.length) { E('logic', 'examples.yaml', `examples[${i}].in`, `unresolved ${missing.join(', ')}`); continue; }
    try {
      const out = await host.call(ex.fn, args);
      const tol = ex.tol ?? 0.005;
      const fails: string[] = [];
      for (const [path, expected] of Object.entries(ex.expect)) {
        const r = getPath(out ?? {}, path);
        if (!r.found || !valuesEqual(r.value, expected, tol)) fails.push(`${path}: expected ${JSON.stringify(expected)}, got ${r.found ? JSON.stringify(r.value) : 'nothing'}`);
      }
      if (fails.length) E('logic', 'examples.yaml', `examples[${i}]`, `example "${ex.id}" (${ex.source}) failed: ${fails.join('; ')}`);
      else passed++;
    } catch (e: any) {
      E('logic', 'examples.yaml', `examples[${i}]`, `example "${ex.id}" threw: ${e?.message ?? e}`);
    }
  }

  // derive + trace smoke for scenes, sections, case
  const checkTrace = (result: any, file: string, path: string, anchorSets?: { tex: Set<string>; code: Set<string>; extra: Set<string> }, liveTargets?: StageWidget[]) => {
    const trace = result?.trace as TraceStep[] | undefined;
    if (!Array.isArray(trace) || !trace.length) { E('logic', file, path, 'trace fn returned no `trace` array'); return; }
    if (trace.length > 400) W('logic', file, path, `trace has ${trace.length} steps (limit 400)`);
    trace.forEach((st, k) => {
      if (typeof st.label !== 'string') E('logic', file, path, `trace step ${k} has no label`);
      else if (wordCount(st.label) > 20) W('lint', file, path, `trace step ${k} label has ${wordCount(st.label)} words (limit 20)`);
      if (anchorSets) {
        if (st.code && !anchorSets.code.has(st.code) && !anchorSets.extra.has(st.code)) W('logic', file, path, `trace step ${k} lights code anchor "${st.code}" that this section's code does not define`);
        if (st.math && !anchorSets.tex.has(st.math)) W('logic', file, path, `trace step ${k} lights math anchor "${st.math}" that this section's derivation does not define`);
      }
      if (liveTargets) for (const op of st.ops ?? []) {
        if (!PANE_ROLES.has(op.role) && !liveRoleTarget(op.role, liveTargets)) W('logic', file, path, `trace step ${k} has an op for role "${op.role}", which matches no live widget (ids: ${liveTargets.map((w) => w.id).join(', ') || 'none'})`);
      }
    });
  };
  const checkResolved = (value: unknown, scope: Scope, file: string, path: string) => {
    const missing: string[] = [];
    resolveRefs(value, scope, missing);
    for (const m of missing) W('refs', file, path, `${m} does not resolve with the initial state`);
    const texts: string[] = [];
    const walk = (v: unknown) => { if (typeof v === 'string') texts.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
    walk(value);
    for (const t of texts) {
      const r = interpolate(t, scope, { mode: 'md', labels: mod.labels });
      for (const m of r.missing) W('refs', file, path, `{=${m}} does not resolve with the initial state`);
    }
  };
  const smokeStage = async (stage: StageWidget[], scope: Scope, file: string, path: string) => {
    for (const [i, w] of stage.entries()) {
      checkResolved(w.props ?? {}, scope, file, `${path}[${i}].props`);
      if (w.widget === 'StepPlayer' && typeof w.props?.fn === 'string' && fnSet.has(w.props.fn)) {
        try {
          const res = await host.call(w.props.fn, resolveRefs(w.props.in ?? {}, scope));
          checkTrace(res, file, `${path}[${i}]`);
          if (typeof w.props.out === 'string') scope[w.props.out] = res;
        } catch (e: any) { E('logic', file, `${path}[${i}]`, `StepPlayer fn "${w.props.fn}" threw: ${e?.message ?? e}`); }
      }
      if (w.widget === 'FunctionPlot' && typeof w.props?.fn === 'string' && fnSet.has(w.props.fn)) {
        try {
          const dom = resolveRefs(w.props.domain, scope) as number[];
          const args = resolveRefs(w.props.args ?? {}, scope);
          const r = await host.call(w.props.fn, { ...args, x: (dom[0] + dom[1]) / 2 });
          if (typeof r?.y !== 'number') E('logic', file, `${path}[${i}]`, `FunctionPlot fn "${w.props.fn}" must return {y: number}`);
        } catch (e: any) { E('logic', file, `${path}[${i}]`, `FunctionPlot fn threw: ${e?.message ?? e}`); }
      }
    }
  };
  const allFns = (d?: Derive[]) => (d ?? []).every((x) => fnSet.has(x.fn));
  for (const [i, s] of mod.intuition.entries()) {
    if (!allFns(s.derive)) continue;
    const p = `scenes[${i}]`;
    try {
      const scope = await runDerive(host, s.derive, { ...datasetScope(mod, s.data), ...structuredClone(s.state ?? {}) });
      await smokeStage(s.stage, scope, 'intuition.yaml', `${p}.stage`);
      s.beats.forEach((b, j) => checkResolved([b.say, b.gate ?? null], scope, 'intuition.yaml', `${p}.beats[${j}]`));
    } catch (e: any) { E('logic', 'intuition.yaml', p, `derive failed with the initial state: ${e?.message ?? e}`); }
  }
  for (const [i, s] of mod.mathCode.entries()) {
    if (!allFns(s.derive)) continue;
    const p = `sections[${i}]`;
    try {
      const scope = await runDerive(host, s.derive, { ...datasetScope(mod, s.data), ...structuredClone(s.state ?? {}) });
      checkResolved([s.steps, s.summary, s.links], scope, 'math-code.yaml', p);
      if (s.live) await smokeStage(s.live, scope, 'math-code.yaml', `${p}.live`);
      if (s.trace && fnSet.has(s.trace.fn)) {
        const res = await host.call(s.trace.fn, resolveRefs(s.trace.in, scope));
        checkTrace(res, 'math-code.yaml', `${p}.trace`, sectionAnchors(s), sectionLiveWidgets(s, mod.datasets));
      }
    } catch (e: any) { E('logic', 'math-code.yaml', p, `derive/trace failed: ${e?.message ?? e}`); }
  }
  {
    const c = mod.application.case;
    if (allFns(c.derive)) {
      try {
        const scope = await runDerive(host, c.derive, { ...datasetScope(mod, c.data), ...structuredClone(c.state ?? {}) });
        for (const [i, cell] of c.cells.entries()) {
          if (cell.stage) await smokeStage(cell.stage, scope, 'application.yaml', `case.cells[${i}].stage`);
          checkResolved([cell.say, cell.decision ?? null], scope, 'application.yaml', `case.cells[${i}]`);
        }
      } catch (e: any) { E('logic', 'application.yaml', 'case', `derive failed: ${e?.message ?? e}`); }
    }
  }

  // quiz smoke
  let instances = 0;
  if (!opts.skipQuiz) {
    const seeds = opts.seeds ?? 25;
    for (const [i, t] of mod.quiz.entries()) {
      const p = `templates[${i}]`;
      if (t.generator && !genSet.has(t.generator)) continue;
      const nSeeds = t.generator ? seeds : 1;
      const problems = new Set<string>();
      let slow = 0;
      let misconceptionCount = (t.type === 'numeric' ? t.misconceptions?.length ?? 0 : 0);
      for (let s = 1; s <= nSeeds; s++) {
        let gen: GeneratorOutput | undefined;
        if (t.generator) {
          const r = await host.generate(t.generator, s, t.difficulty);
          if (r.error) { problems.add(`generator threw: ${r.error}`); continue; }
          if (r.ms > 50) slow = Math.max(slow, r.ms);
          gen = r.output;
          if (!gen || typeof gen.vars !== 'object') { problems.add('generator must return { vars }'); continue; }
          if (t.type === 'numeric') misconceptionCount = Math.max(misconceptionCount, (t.misconceptions?.length ?? 0) + (gen.misconceptions?.length ?? 0));
        }
        const inst = buildInstance({ moduleId: mod.manifest.id, datasets: data }, t, s, gen);
        inst.problems.forEach((x) => problems.add(x));
        instances++;
        const texts: string[] = [inst.prompt, inst.explanation, ...(inst.options ?? []), ...(inst.steps?.map((x) => x.prompt) ?? []), ...(inst.misconceptions?.map((m) => m.feedback) ?? [])];
        for (const tx of texts) for (const m of interpolate(tx, inst.scope, { mode: 'md', labels: mod.labels }).missing) problems.add(`unresolved {=${m}}`);
        if (t.show) {
          const missing: string[] = [];
          resolveRefs(t.show.map((w) => w.props ?? {}), inst.scope, missing);
          missing.forEach((m) => problems.add(`show: ${m} does not resolve`));
        }
        if (inst.numeric && inst.misconceptions?.some((m) => Math.abs(m.value - inst.numeric!.value) <= inst.numeric!.tol) && s <= 3) {
          // allowed (engine ignores it) but worth knowing
        }
      }
      for (const pr of problems) E('quiz', 'quiz.yaml', p, `template "${t.id}": ${pr}`);
      if (slow) W('quiz', 'quiz.yaml', p, `template "${t.id}": generator took ${slow.toFixed(0)} ms (limit 50 ms)`);
      if (t.type === 'numeric' && misconceptionCount < 2) W('lint', 'quiz.yaml', p, `numeric template "${t.id}" has ${misconceptionCount} misconceptions (guide: ≥ 2)`);
    }
  }
  return { issues, examples: mod.examples.length, examplesPassed: passed, instances };
}

// ------------------------------------------------------------ orchestrator
export async function validateModule(
  files: FileMap,
  opts: { hostFactory?: LogicHostFactory; seeds?: number; skipQuiz?: boolean } = {},
): Promise<ValidationReport & { module?: ParsedModule }> {
  const issues: Issue[] = [];
  const { module, issues: parseIssues } = parseModule(files);
  issues.push(...parseIssues);
  let stats: ValidationReport['stats'];
  let logicRan = false;
  let quizRan = false;
  if (module) {
    const integ = checkIntegrity(module);
    issues.push(...integ.issues);
    issues.push(...lintModule(module));
    if (opts.hostFactory) {
      let host: LogicHost | undefined;
      try {
        host = await opts.hostFactory(module.logic);
      } catch (e: any) {
        issues.push({ level: 'error', step: 'logic', file: 'logic.js', message: `logic.js failed to load: ${e?.message ?? e}` });
      }
      if (host) {
        try {
          const r = await runLogicChecks(module, host, integ, { seeds: opts.seeds, skipQuiz: opts.skipQuiz });
          issues.push(...r.issues);
          logicRan = true;
          quizRan = !opts.skipQuiz;
          stats = { examples: r.examples, examplesPassed: r.examplesPassed, templates: module.quiz.length, instances: r.instances, scenes: module.intuition.length, sections: module.mathCode.length };
        } finally {
          host.dispose?.();
        }
      }
    }
  }
  const steps: StepStatus[] = STEPS.map(({ step, label }) => {
    const mine = issues.filter((i) => i.step === step);
    let status: StepStatus['status'] = mine.some((i) => i.level === 'error') ? 'error' : mine.length ? 'warn' : 'ok';
    if (!module && ['refs', 'logic', 'quiz', 'lint'].includes(step) && !mine.length) status = 'skipped';
    if (step === 'logic' && !logicRan && !mine.length) status = 'skipped';
    if (step === 'quiz' && !quizRan && !mine.length) status = 'skipped';
    return { step, label, status };
  });
  // put errors first
  issues.sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1));
  return {
    ok: !issues.some((i) => i.level === 'error'),
    id: module?.manifest.id,
    version: module?.manifest.version,
    title: module?.manifest.title,
    issues,
    steps,
    stats,
    module,
  };
}

export function formatIssue(i: Issue): string {
  const loc = [i.file, i.line ? `${i.line}:${i.col ?? 1}` : null].filter(Boolean).join(':');
  return `${i.level === 'error' ? '✗' : '⚠'} [${i.step}] ${loc}${i.path ? ` (${i.path})` : ''} — ${i.message}`;
}

/** "Copy fix request for LLM" (plan §11). */
export function fixRequest(report: ValidationReport, id = report.id ?? 'module'): string {
  const errors = report.issues.filter((i) => i.level === 'error');
  const warnings = report.issues.filter((i) => i.level === 'warning');
  const files = [...new Set(errors.map((e) => e.file).filter(Boolean))] as string[];
  const lines: string[] = [];
  lines.push(`Your module \`${id}\`${report.version ? ` (version ${report.version})` : ''} failed validation.`);
  lines.push('');
  lines.push(`Errors (${errors.length}):`);
  errors.forEach((e, n) => lines.push(`${n + 1}. ${formatIssue(e)}`));
  if (warnings.length) {
    lines.push('');
    lines.push(`Warnings (${warnings.length}, fix if easy):`);
    warnings.slice(0, 25).forEach((e) => lines.push(`- ${formatIssue(e)}`));
    if (warnings.length > 25) lines.push(`- … and ${warnings.length - 25} more`);
  }
  lines.push('');
  lines.push(`Re-output ONLY the affected files${files.length ? ` (${files.join(', ')})` : ''}, each complete, in bundle format (<<<BUNDLE ${id}@${report.version ?? '1.0.0'}>>> … <<<END BUNDLE>>>). Keep the same id and version, and never rename existing IDs. Follow MODULE_AUTHORING_GUIDE.md.`);
  return lines.join('\n');
}

export { IDENT_RE };
