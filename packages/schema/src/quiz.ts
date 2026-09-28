/**
 * Quiz instances (template × seed) and answer checkers. Isomorphic, shared by the
 * web quiz runner and the validator's smoke test (guide §5.10, plan §9).
 */
import { createRng, hashSeed, approx } from '@kodigo/sdk';
import type { Template, Term, StageWidget, LessonRef, GeneratorOutput, NumericAnswer, Value } from './schemas';
import { getPath, type Scope } from './interpolate';

export interface NumericSpec {
  value: number;
  tol: number;
  relTol?: number;
  accept: ('decimal' | 'fraction' | 'percent')[];
}
export interface ResolvedMisconception { value: number; feedback: string }

export interface QuizInstance {
  key: string;
  moduleId: string;
  templateId: string;
  seed: number;
  type: Template['type'];
  difficulty: 1 | 2 | 3;
  skills: string[];
  tags: string[];
  lessonRef?: LessonRef;
  scope: Scope;
  prompt: string;
  explanation: string;
  show?: StageWidget[];
  // mcq / multi
  options?: string[];
  answer?: number | number[];
  optionFeedback?: Record<number, string>;
  // numeric
  numeric?: NumericSpec;
  misconceptions?: ResolvedMisconception[];
  // code-fill
  code?: string;
  lang?: string;
  blanks?: Record<string, { accept?: string[]; regex?: string; hint?: string }>;
  // match
  pairs?: [string, string][];
  rightOrder?: number[];
  // order
  items?: string[];
  startOrder?: number[];
  // hand-calc
  steps?: { prompt: string; numeric: NumericSpec; misconceptions: ResolvedMisconception[]; hint?: string }[];
  /** problems found while building (unresolved vars …) */
  problems: string[];
}

export interface BuildContext {
  moduleId: string;
  /** dataset id → payload */
  datasets: Record<string, any>;
}

function numSpec(a: NumericAnswer, scope: Scope, problems: string[], where: string): NumericSpec {
  let value = a.value as number;
  if (a.var !== undefined) {
    const r = getPath(scope, a.var);
    if (!r.found) problems.push(`${where}: answer var "${a.var}" is not in scope`);
    value = r.value;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) problems.push(`${where}: answer is not a finite number (${JSON.stringify(value)})`);
  return { value, tol: a.tol ?? 0.01, relTol: a.relTol, accept: a.accept ?? ['decimal', 'fraction'] };
}

function resolveMisc(list: { var?: string; value?: number; feedback: string }[] | undefined, scope: Scope, problems: string[], where: string): ResolvedMisconception[] {
  const out: ResolvedMisconception[] = [];
  for (const m of list ?? []) {
    let v = m.value;
    if (m.var !== undefined) {
      const r = getPath(scope, m.var);
      if (!r.found) { problems.push(`${where}: misconception var "${m.var}" is not in scope`); continue; }
      v = r.value;
    }
    if (typeof v !== 'number' || !Number.isFinite(v)) { problems.push(`${where}: misconception value is not finite`); continue; }
    out.push({ value: v, feedback: m.feedback });
  }
  return out;
}

export function buildInstance(ctx: BuildContext, t: Template, seed: number, gen?: GeneratorOutput): QuizInstance {
  const problems: string[] = [];
  const scope: Scope = {};
  for (const d of t.data ?? []) scope[d] = ctx.datasets[d];
  if (gen?.vars) Object.assign(scope, gen.vars);
  const rng = createRng(hashSeed(`${t.id}:${seed}:layout`));
  const inst: QuizInstance = {
    key: `${ctx.moduleId}/${t.id}`,
    moduleId: ctx.moduleId,
    templateId: t.id,
    seed,
    type: t.type,
    difficulty: t.difficulty,
    skills: t.skills,
    tags: t.tags,
    lessonRef: t.lessonRef,
    scope,
    prompt: t.prompt,
    explanation: t.explanation,
    show: t.show,
    problems,
  };
  switch (t.type) {
    case 'mcq':
    case 'multi': {
      const options = (gen?.options ?? t.options ?? []).slice();
      let answer: any = gen?.answer ?? t.answer;
      if (!options.length) problems.push('no options');
      if (t.type === 'mcq' && typeof answer !== 'number') problems.push('mcq needs a numeric answer index');
      if (t.type === 'multi' && !Array.isArray(answer)) problems.push('multi needs an array of answer indexes');
      const fb: Record<number, string> = {};
      if (t.type === 'mcq' && t.optionFeedback) for (const [k, v] of Object.entries(t.optionFeedback)) fb[Number(k)] = v;
      let perm = options.map((_, i) => i);
      if (t.shuffle !== false) perm = rng.shuffle(perm);
      inst.options = perm.map((i) => options[i]);
      const map = (i: number) => perm.indexOf(i);
      inst.answer = Array.isArray(answer) ? answer.map(map).sort((a, b) => a - b) : typeof answer === 'number' ? map(answer) : undefined;
      inst.optionFeedback = Object.fromEntries(Object.entries(fb).map(([k, v]) => [map(Number(k)), v]));
      const idx = Array.isArray(answer) ? answer : [answer];
      if (idx.some((i: any) => typeof i !== 'number' || i < 0 || i >= options.length)) problems.push('answer index out of range');
      if (new Set(options).size !== options.length) problems.push(`options are not distinct: ${JSON.stringify(options)}`);
      break;
    }
    case 'numeric':
      inst.numeric = numSpec(t.answer, scope, problems, 'answer');
      inst.misconceptions = resolveMisc([...(t.misconceptions ?? []), ...(gen?.misconceptions ?? [])], scope, problems, 'misconception');
      break;
    case 'code-fill':
      inst.code = t.code;
      inst.lang = t.lang ?? 'python';
      inst.blanks = t.blanks;
      break;
    case 'match': {
      let pairs = t.pairs.slice();
      if (t.pick && t.pick < pairs.length) pairs = rng.sample(pairs, t.pick);
      inst.pairs = pairs as [string, string][];
      inst.rightOrder = rng.shuffle(pairs.map((_, i) => i));
      break;
    }
    case 'order': {
      inst.items = t.items;
      let order = rng.shuffle(t.items.map((_, i) => i));
      if (order.every((v, i) => v === i) && order.length > 1) order = [...order.slice(1), order[0]];
      inst.startOrder = order;
      break;
    }
    case 'hand-calc':
      inst.steps = t.steps.map((s, i) => ({
        prompt: s.prompt,
        numeric: numSpec(s.answer, scope, problems, `step ${i + 1}`),
        misconceptions: resolveMisc(s.misconceptions, scope, problems, `step ${i + 1}`),
        hint: s.hint,
      }));
      break;
  }
  return inst;
}

// ------------------------------------------------------------ glossary auto-questions
export function glossaryTemplateIds(terms: Term[]): string[] {
  const ids: string[] = [];
  for (const t of terms) {
    ids.push(`glossary-def-${t.id}`, `glossary-term-${t.id}`);
    if (t.formula) ids.push(`glossary-formula-${t.id}`);
  }
  return ids;
}

export function buildGlossaryInstance(moduleId: string, terms: Term[], templateId: string, seed: number): QuizInstance | null {
  const m = /^glossary-(def|term|formula)-(.+)$/.exec(templateId);
  if (!m) return null;
  const [, kind, termId] = m;
  const term = terms.find((t) => t.id === termId);
  if (!term || terms.length < 2) return null;
  const rng = createRng(hashSeed(`${templateId}:${seed}`));
  const pool = terms.filter((t) => t.id !== termId && (kind !== 'formula' || t.formula));
  const others = rng.sample(pool, 3);
  const all = rng.shuffle([term, ...others]);
  const answer = all.indexOf(term);
  let prompt = '';
  let options: string[] = [];
  if (kind === 'def') {
    prompt = `Which definition matches **${term.term}**?`;
    options = all.map((t) => t.short);
  } else if (kind === 'term') {
    prompt = `Which term is defined as: *${term.short}*`;
    options = all.map((t) => t.term);
  } else {
    prompt = `Which concept does this formula define?\n\n$$${term.formula}$$`;
    options = all.map((t) => t.term);
  }
  if (options.length < 2) return null;
  return {
    key: `${moduleId}/${templateId}`,
    moduleId,
    templateId,
    seed,
    type: 'mcq',
    difficulty: 1,
    skills: term.skills?.length ? term.skills : [],
    tags: ['term'],
    lessonRef: term.lessonRef,
    scope: {},
    prompt,
    explanation: `**${term.term}**: ${term.short}${term.long ? `\n\n${term.long}` : ''}`,
    options,
    answer,
    problems: [],
  };
}

// ------------------------------------------------------------ checkers
export function parseNumber(raw: string, accept: NumericSpec['accept'] = ['decimal', 'fraction']): number | null {
  if (raw === undefined || raw === null) return null;
  let s = String(raw).trim().replace(/^=\s*/, '').replace(/[−–]/g, '-').replace(/,/g, '');
  if (!s) return null;
  if (s.endsWith('%')) {
    if (!accept.includes('percent')) return null;
    const v = Number(s.slice(0, -1));
    return Number.isFinite(v) ? v / 100 : null;
  }
  const fr = /^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/.exec(s);
  if (fr) {
    if (!accept.includes('fraction')) return null;
    const d = Number(fr[2]);
    return d === 0 ? null : Number(fr[1]) / d;
  }
  if (!/^-?(\d+\.?\d*|\.\d+)(e-?\d+)?$/i.test(s)) return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

export function withinTol(x: number, target: number, tol: number, relTol?: number): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(target)) return false;
  const d = Math.abs(x - target);
  return d <= tol + 1e-12 || (relTol !== undefined && d <= relTol * Math.abs(target) + 1e-12);
}

export interface NumericResult {
  parsed: number | null;
  correct: boolean;
  score: number;
  feedback?: string;
}

export function checkNumeric(raw: string, spec: NumericSpec, misconceptions: ResolvedMisconception[] = []): NumericResult {
  const parsed = parseNumber(raw, spec.accept);
  if (parsed === null) return { parsed, correct: false, score: 0, feedback: `Couldn't read that as a number${spec.accept.includes('fraction') ? ' (decimals like 0.67 or fractions like 2/3 work)' : ''}.` };
  if (withinTol(parsed, spec.value, spec.tol, spec.relTol)) return { parsed, correct: true, score: 1 };
  for (const m of misconceptions) {
    if (withinTol(m.value, spec.value, spec.tol, spec.relTol)) continue; // engine ignores misconceptions equal to the answer
    if (withinTol(parsed, m.value, spec.tol, spec.relTol)) return { parsed, correct: false, score: 0, feedback: m.feedback };
  }
  return { parsed, correct: false, score: 0 };
}

export const checkMcq = (choice: number | null, answer: number) => (choice === answer ? 1 : 0);

export function checkMulti(chosen: number[], answer: number[]): number {
  const A = new Set(answer);
  const tp = chosen.filter((c) => A.has(c)).length;
  const fp = chosen.length - tp;
  if (!answer.length) return chosen.length ? 0 : 1;
  return Math.max(0, (tp - fp) / answer.length);
}

export const normalizeCode = (s: string) => String(s ?? '').replace(/\s+/g, '').replace(/"/g, "'");

export function checkBlank(input: string, blank: { accept?: string[]; regex?: string }): boolean {
  const n = normalizeCode(input);
  if (!n) return false;
  if (blank.accept?.some((a) => normalizeCode(a) === n)) return true;
  if (blank.regex) {
    try { return new RegExp(blank.regex).test(String(input).trim()); } catch { return false; }
  }
  return false;
}

/** order = the learner's sequence of original indexes (0 = first correct item). Kendall-tau partial credit. */
export function checkOrder(order: number[]): number {
  const n = order.length;
  if (order.every((v, i) => v === i)) return 1;
  let conc = 0, disc = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) (order[i] < order[j] ? conc++ : disc++);
  const tau = (conc - disc) / Math.max(1, conc + disc);
  return Math.max(0, Math.min(0.95, tau));
}

/** assignment[i] = index of the right-hand item placed next to left item i. */
export function checkMatch(assignment: (number | null)[]): number {
  if (!assignment.length) return 0;
  return assignment.filter((a, i) => a === i).length / assignment.length;
}

export function valuesEqual(actual: any, expected: Value, tol: number): boolean {
  if (typeof expected === 'number') return typeof actual === 'number' && Math.abs(actual - expected) <= tol + 1e-12;
  if (expected === null) return actual === null || actual === undefined;
  if (Array.isArray(expected)) return Array.isArray(actual) && actual.length === expected.length && expected.every((e, i) => valuesEqual(actual[i], e, tol));
  if (typeof expected === 'object') return !!actual && typeof actual === 'object' && Object.entries(expected).every(([k, v]) => valuesEqual(actual[k], v, tol));
  return actual === expected;
}

export { approx };
