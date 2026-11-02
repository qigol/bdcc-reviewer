import { buildInstance, buildGlossaryInstance, glossaryKind, glossaryTemplateIds, glossaryWithHomes, type QuizInstance, type Template } from '@kodigo/schema';
import type { LoadedModule } from '../modules/store';

export type Mode = 'practice' | 'exam' | 'review' | 'weak' | 'interleaved' | 'retry';
export const MODE_LABEL: Record<Mode, string> = {
  practice: 'Practice (instant feedback)',
  exam: 'Exam simulation (timed, feedback at the end)',
  review: 'Review due (spaced repetition)',
  weak: 'Weak spots (lowest mastery first)',
  interleaved: "Interleaved (mix this course's modules)",
  retry: 'Retry mistakes',
};
export const QTYPES = ['mcq', 'multi', 'two-tier', 'numeric', 'code-fill', 'match', 'order', 'find-error', 'hand-calc', 'case', 'journal-entry', 'schedule-fill', 'explain'] as const;
export const QTYPE_LABEL: Record<string, string> = { mcq: 'Multiple choice', multi: 'Select all', numeric: 'Numeric', 'code-fill': 'Fill in the blanks', match: 'Matching', order: 'Ordering', 'hand-calc': 'Hand calculation', 'journal-entry': 'Journal entry', 'schedule-fill': 'Complete the schedule', 'find-error': 'Spot the error', 'two-tier': 'Answer + reason', explain: 'Explain it', case: 'Multi-part case' };

export interface SessionItem { moduleId: string; templateId: string; seed: number }
export interface QuizSession {
  id: string;
  createdAt: number;
  mode: Mode;
  items: SessionItem[];
  /** every item comes from a module of this course */
  course?: string;
  timeLimitSec?: number;
  title?: string;
}

export interface SessionConfig {
  /** quizzes are course-based: only modules of this course are used */
  course: string;
  modules: string[];
  types: string[];
  skills: string[]; // 'moduleId:skillId'
  difficulties: number[];
  count: number;
  mode: Mode;
  glossary: boolean;
  timeLimitMin?: number;
}

export function randomSeed(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % 2147483647 || 1;
}

const KEY = 'kodigo-sessions';
function loadAll(): Record<string, QuizSession> {
  try { return JSON.parse(sessionStorage.getItem(KEY) ?? '{}'); } catch { return {}; }
}
export function saveSession(s: QuizSession) {
  const all = loadAll();
  all[s.id] = s;
  const ids = Object.keys(all).sort((a, b) => all[b].createdAt - all[a].createdAt).slice(0, 20);
  try { sessionStorage.setItem(KEY, JSON.stringify(Object.fromEntries(ids.map((i) => [i, all[i]])))); } catch {}
}
export function getSession(id: string): QuizSession | undefined {
  return loadAll()[id];
}

/**
 * In-progress answers for a running quiz, so leaving the quiz page (lesson, glossary, browser
 * back, reload) and coming back resumes where you were instead of starting over.
 * Question instances aren't stored: they're regenerated deterministically from each item's seed.
 */
export interface SavedSlot { response?: unknown; graded?: unknown; startedAt?: number; timeMs?: number; seed?: number; confidence?: 1 | 2 | 3 }
export interface SavedRun { idx: number; finished: boolean; deadline: number | null; slots: SavedSlot[]; updatedAt: number }

const RUN_KEY = 'kodigo-quiz-progress';
function loadRuns(): Record<string, SavedRun> {
  try { return JSON.parse(sessionStorage.getItem(RUN_KEY) ?? '{}'); } catch { return {}; }
}
export function getRunState(id: string): SavedRun | undefined {
  return loadRuns()[id];
}
export function saveRunState(id: string, run: Omit<SavedRun, 'updatedAt'>) {
  const sessions = loadAll();
  const runs = loadRuns();
  runs[id] = { ...run, updatedAt: Date.now() };
  // only keep progress for sessions that still exist
  const kept = Object.fromEntries(Object.entries(runs).filter(([k]) => k === id || sessions[k]));
  try { sessionStorage.setItem(RUN_KEY, JSON.stringify(kept)); } catch {}
}
/** Most recent quiz that was started but not finished, if any. */
export function latestUnfinished(): { session: QuizSession; run: SavedRun } | undefined {
  const sessions = loadAll();
  const best = Object.entries(loadRuns())
    .filter(([id, r]) => !r.finished && sessions[id] && r.slots.some((s) => s.graded || s.response !== undefined))
    .sort((a, b) => b[1].updatedAt - a[1].updatedAt)[0];
  return best ? { session: sessions[best[0]], run: best[1] } : undefined;
}

export interface Candidate { moduleId: string; templateId: string; type: string; skills: string[]; difficulty: number; glossary?: boolean }

export function candidates(mods: LoadedModule[], cfg: Pick<SessionConfig, 'modules' | 'types' | 'skills' | 'difficulties' | 'glossary'>): Candidate[] {
  const out: Candidate[] = [];
  for (const m of mods) {
    if (!cfg.modules.includes(m.id)) continue;
    for (const t of m.parsed.quiz) {
      if (cfg.types.length && !cfg.types.includes(t.type)) continue;
      if (cfg.difficulties.length && !cfg.difficulties.includes(t.difficulty)) continue;
      if (cfg.skills.length && !t.skills.some((s) => cfg.skills.includes(`${m.id}:${s}`))) continue;
      out.push({ moduleId: m.id, templateId: t.id, type: t.type, skills: t.skills, difficulty: t.difficulty });
    }
    if (cfg.glossary) {
      for (const id of glossaryTemplateIds(m.parsed.glossary)) {
        const kind = glossaryKind(id);
        if (cfg.types.length && !cfg.types.includes(kind.type)) continue;
        if (cfg.difficulties.length && !cfg.difficulties.includes(kind.difficulty)) continue;
        const term = m.parsed.glossary.find((g) => id.endsWith(`-${g.id}`));
        const skills = term?.skills ?? [];
        if (cfg.skills.length && !skills.some((s) => cfg.skills.includes(`${m.id}:${s}`))) continue;
        out.push({ moduleId: m.id, templateId: id, type: kind.type, skills, difficulty: kind.difficulty, glossary: true });
      }
    }
  }
  return out;
}

function shuffle<T>(a: T[]): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}

/** Types that test a concept by choosing or arranging, vs. types where the learner produces the answer. */
const CONCEPTUAL = new Set(['mcq', 'multi', 'match', 'order', 'two-tier', 'find-error']);
const PRODUCTION = new Set(['numeric', 'hand-calc', 'code-fill', 'journal-entry', 'schedule-fill', 'explain', 'case']);
/** no question type takes more than this share of a session (when the pool has enough other types) */
export const TYPE_CAP = 0.4;

/**
 * Choose `n` candidates from `pool` (already in preference order) without repeating a template until
 * the pool is used up, keeping any one type to ≤ TYPE_CAP of the session and including at least one
 * conceptual and one production question when the pool has them.
 */
function choose(pool: Candidate[], n: number): Candidate[] {
  if (!pool.length || n <= 0) return [];
  const cap = Math.max(1, Math.ceil(n * TYPE_CAP));
  const typesInPool = new Set(pool.map((c) => c.type)).size;
  const out: Candidate[] = [];
  while (out.length < n) {
    const left = n - out.length;
    const round: Candidate[] = [];
    const byType: Record<string, number> = {};
    for (const c of out) byType[c.type] = (byType[c.type] ?? 0) + 1;
    // first pass respects the type cap; second pass fills from whatever is left in this round
    const skipped: Candidate[] = [];
    for (const c of pool) {
      if (round.length >= left) break;
      if (typesInPool > 1 && (byType[c.type] ?? 0) >= cap) { skipped.push(c); continue; }
      round.push(c);
      byType[c.type] = (byType[c.type] ?? 0) + 1;
    }
    for (const c of skipped) { if (round.length >= left) break; round.push(c); }
    out.push(...round);
  }
  // guarantee one conceptual and one production question when the pool has them
  for (const kind of [CONCEPTUAL, PRODUCTION]) {
    if (out.some((c) => kind.has(c.type))) continue;
    const add = pool.find((c) => kind.has(c.type));
    if (!add) continue;
    // swap out the last item of the most common type (out has none of `kind`, so this can't remove the other kind's only item unless n = 1)
    const counts: Record<string, number> = {};
    for (const c of out) counts[c.type] = (counts[c.type] ?? 0) + 1;
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (out.length > 1 && top[1] > 1) out[out.map((c) => c.type).lastIndexOf(top[0])] = add;
  }
  return out;
}

/** Reorder so no two neighbours share a type or a skill, when some other order allows it (greedy). */
export function spread<T extends { type: string; skills: string[]; moduleId: string }>(list: T[]): T[] {
  const rest = list.slice();
  const out: T[] = [];
  const clash = (a: T | undefined, b: T) => !!a && (a.type === b.type || (a.moduleId === b.moduleId && a.skills.some((s) => b.skills.includes(s))));
  while (rest.length) {
    const prev = out[out.length - 1];
    let i = rest.findIndex((c) => !clash(prev, c));
    if (i < 0) i = rest.findIndex((c) => c.type !== prev?.type);
    if (i < 0) i = 0;
    out.push(rest.splice(i, 1)[0]);
  }
  return out;
}

/** Practice: a gentle ramp, mostly easy → hard, with types and skills still mixed inside each stretch. */
function ramp<T extends { difficulty: number }>(list: T[]): T[] {
  return list.map((c) => ({ c, k: c.difficulty + Math.random() * 1.6 })).sort((a, b) => a.k - b.k).map((x) => x.c);
}

/**
 * Pick `count` items. Glossary questions are capped at ~25% so authored questions dominate. Templates
 * don't repeat until the pool is used up, one type is kept to ≤ 40%, practice ramps up in difficulty,
 * and neighbours avoid sharing a type or skill. Exam sessions leave out self-graded `explain` items.
 */
export function pickItems(cands: Candidate[], count: number, opts: { mode: Mode; weight?: (c: Candidate) => number } = { mode: 'practice' }): SessionItem[] {
  if (opts.mode === 'exam') cands = cands.filter((c) => c.type !== 'explain');
  if (!cands.length) return [];
  const authored = cands.filter((c) => !c.glossary);
  const gloss = cands.filter((c) => c.glossary);
  const nGloss = authored.length ? Math.min(gloss.length, Math.round(count * 0.25)) : Math.min(gloss.length, count);
  let pool: Candidate[] = [];
  if (opts.weight) {
    // weighted sampling without replacement, then fill
    const w = authored.map((c) => ({ c, w: Math.max(0.05, opts.weight!(c)) * (0.5 + Math.random()) }));
    pool = w.sort((a, b) => b.w - a.w).map((x) => x.c);
  } else if (opts.mode === 'interleaved') {
    const byMod: Record<string, Candidate[]> = {};
    for (const c of shuffle(authored)) (byMod[c.moduleId] ??= []).push(c);
    const lists = Object.values(byMod);
    while (lists.some((l) => l.length)) for (const l of lists) if (l.length) pool.push(l.shift()!);
  } else pool = shuffle(authored);
  let picked = [...choose(pool, count - nGloss), ...shuffle(gloss).slice(0, nGloss)];
  if (opts.mode === 'practice') picked = ramp(picked);
  else if (!opts.weight && opts.mode !== 'interleaved') picked = shuffle(picked);
  if (opts.mode !== 'interleaved' && !opts.weight) picked = spread(picked);
  return picked.map((c) => ({ moduleId: c.moduleId, templateId: c.templateId, seed: randomSeed() }));
}

export class MixedCourseError extends Error {
  constructor(public courses: string[]) {
    super(`A quiz can only use modules from one course (got ${courses.join(', ')}).`);
  }
}

/**
 * Create and store a quiz session. Quizzes are course-based: every item must come from a module of
 * `course` (checked with `courseOf`), otherwise this throws MixedCourseError.
 */
export function newSession(mode: Mode, course: string, items: SessionItem[], courseOf: (moduleId: string) => string | undefined, extra: Partial<QuizSession> = {}): QuizSession {
  const found = [...new Set(items.map((it) => courseOf(it.moduleId) ?? '?'))];
  if (found.some((c) => c !== course)) throw new MixedCourseError([...new Set([course, ...found])]);
  const s: QuizSession = { id: Math.random().toString(36).slice(2, 10), createdAt: Date.now(), mode, items, ...extra, course };
  saveSession(s);
  return s;
}

/** Build a renderable instance (runs the generator in the module's worker). */
export async function instantiate(mod: LoadedModule, item: SessionItem): Promise<QuizInstance> {
  if (item.templateId.startsWith('glossary-')) {
    // "show me in the lesson" defaults to the scene that introduces the term
    const inst = buildGlossaryInstance(mod.id, glossaryWithHomes(mod.parsed.glossary, mod.parsed.intuition), item.templateId, item.seed);
    if (!inst) throw new Error(`glossary question ${item.templateId} unavailable`);
    return inst;
  }
  const t = mod.parsed.quiz.find((x) => x.id === item.templateId) as Template | undefined;
  if (!t) throw new Error(`template ${item.templateId} not found in ${mod.id}`);
  let gen;
  if (t.generator) {
    const r = await mod.logic.generate(t.generator, item.seed, t.difficulty);
    if (r.error) throw new Error(`generator ${t.generator} failed: ${r.error}`);
    gen = r.output;
  }
  return buildInstance({ moduleId: mod.id, datasets: mod.datasets }, t, item.seed, gen);
}
