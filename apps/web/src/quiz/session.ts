import { buildInstance, buildGlossaryInstance, glossaryTemplateIds, type QuizInstance, type Template } from '@kodigo/schema';
import type { LoadedModule } from '../modules/store';

export type Mode = 'practice' | 'exam' | 'review' | 'weak' | 'interleaved' | 'retry';
export const MODE_LABEL: Record<Mode, string> = {
  practice: 'Practice (instant feedback)',
  exam: 'Exam simulation (timed, feedback at the end)',
  review: 'Review due (spaced repetition)',
  weak: 'Weak spots (lowest mastery first)',
  interleaved: 'Interleaved (mix modules)',
  retry: 'Retry mistakes',
};
export const QTYPES = ['mcq', 'multi', 'numeric', 'code-fill', 'match', 'order', 'hand-calc'] as const;
export const QTYPE_LABEL: Record<string, string> = { mcq: 'Multiple choice', multi: 'Select all', numeric: 'Numeric', 'code-fill': 'Fill in the code', match: 'Matching', order: 'Ordering', 'hand-calc': 'Hand calculation' };

export interface SessionItem { moduleId: string; templateId: string; seed: number }
export interface QuizSession {
  id: string;
  createdAt: number;
  mode: Mode;
  items: SessionItem[];
  timeLimitSec?: number;
  title?: string;
}

export interface SessionConfig {
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
export interface SavedSlot { response?: unknown; graded?: unknown; startedAt?: number; timeMs?: number }
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
    if (cfg.glossary && (!cfg.types.length || cfg.types.includes('mcq')) && (!cfg.difficulties.length || cfg.difficulties.includes(1))) {
      for (const id of glossaryTemplateIds(m.parsed.glossary)) {
        const term = m.parsed.glossary.find((g) => id.endsWith(`-${g.id}`));
        const skills = term?.skills ?? [];
        if (cfg.skills.length && !skills.some((s) => cfg.skills.includes(`${m.id}:${s}`))) continue;
        out.push({ moduleId: m.id, templateId: id, type: 'mcq', skills, difficulty: 1, glossary: true });
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

/** Pick `count` items. Glossary questions are capped at ~25% so authored questions dominate. */
export function pickItems(cands: Candidate[], count: number, opts: { mode: Mode; weight?: (c: Candidate) => number } = { mode: 'practice' }): SessionItem[] {
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
  const items: SessionItem[] = [];
  const nAuth = count - nGloss;
  for (let i = 0; i < nAuth && pool.length; i++) { const c = pool[i % pool.length]; items.push({ moduleId: c.moduleId, templateId: c.templateId, seed: randomSeed() }); }
  for (const c of shuffle(gloss).slice(0, nGloss)) items.push({ moduleId: c.moduleId, templateId: c.templateId, seed: randomSeed() });
  return opts.mode === 'interleaved' || opts.weight ? items : shuffle(items);
}

export function newSession(mode: Mode, items: SessionItem[], extra: Partial<QuizSession> = {}): QuizSession {
  const s: QuizSession = { id: Math.random().toString(36).slice(2, 10), createdAt: Date.now(), mode, items, ...extra };
  saveSession(s);
  return s;
}

/** Build a renderable instance (runs the generator in the module's worker). */
export async function instantiate(mod: LoadedModule, item: SessionItem): Promise<QuizInstance> {
  if (item.templateId.startsWith('glossary-')) {
    const inst = buildGlossaryInstance(mod.id, mod.parsed.glossary, item.templateId, item.seed);
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
