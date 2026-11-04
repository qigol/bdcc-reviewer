/** Quiz sessions and in-progress runs in browser storage. No schema imports: the top bar reads these from the main chunk. */

export type Mode = 'practice' | 'exam' | 'review' | 'weak' | 'interleaved' | 'retry';

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
