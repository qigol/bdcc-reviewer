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
const RUN_KEY = 'kodigo-quiz-progress';

/** One-time move from sessionStorage (older versions), newer rows winning, so a quiz in progress survives the upgrade. */
function migrate() {
  try {
    const oldS = sessionStorage.getItem(KEY);
    const oldR = sessionStorage.getItem(RUN_KEY);
    if (oldS === null && oldR === null) return;
    const merge = (key: string, old: string | null, time: (x: any) => number) => {
      if (old === null) return;
      const cur = JSON.parse(localStorage.getItem(key) ?? '{}');
      for (const [id, x] of Object.entries<any>(JSON.parse(old))) if (!cur[id] || time(x) > time(cur[id])) cur[id] = x;
      localStorage.setItem(key, JSON.stringify(cur));
    };
    merge(KEY, oldS, (x) => x.createdAt ?? 0);
    merge(RUN_KEY, oldR, (x) => x.updatedAt ?? 0);
    sessionStorage.removeItem(KEY);
    sessionStorage.removeItem(RUN_KEY);
  } catch { /* storage blocked: nothing to move */ }
}

function loadAll(): Record<string, QuizSession> {
  migrate();
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { return {}; }
}

/** Store both tables; when the browser's quota is full, drop the oldest session and its run and retry once. */
function store(sessions: Record<string, QuizSession>, runs: Record<string, SavedRun>, keep?: string) {
  const write = () => {
    localStorage.setItem(KEY, JSON.stringify(sessions));
    localStorage.setItem(RUN_KEY, JSON.stringify(runs));
  };
  try { write(); } catch (e: any) {
    if (e?.name !== 'QuotaExceededError') return;
    const oldest = Object.keys(sessions).filter((id) => id !== keep).sort((a, b) => sessions[a].createdAt - sessions[b].createdAt)[0];
    if (oldest) { delete sessions[oldest]; delete runs[oldest]; }
    try { write(); } catch { /* still full: this quiz just won't resume */ }
  }
}

export function saveSession(s: QuizSession) {
  const all = loadAll();
  all[s.id] = s;
  const ids = Object.keys(all).sort((a, b) => all[b].createdAt - all[a].createdAt).slice(0, 20);
  const runs = loadRuns();
  store(Object.fromEntries(ids.map((i) => [i, all[i]])), Object.fromEntries(Object.entries(runs).filter(([k]) => ids.includes(k))), s.id);
}
export function getSession(id: string): QuizSession | undefined {
  return loadAll()[id];
}

/**
 * In-progress answers for a running quiz, so leaving the quiz page (lesson, glossary, browser
 * back, reload, closing the tab) and coming back resumes where you were instead of starting over.
 * Two tabs on the same run write last-wins.
 * Question instances aren't stored: they're regenerated deterministically from each item's seed.
 */
export interface SavedSlot { response?: unknown; graded?: unknown; startedAt?: number; timeMs?: number; seed?: number; confidence?: 1 | 2 | 3; retryAfterReveal?: boolean }
export interface SavedRun { idx: number; finished: boolean; deadline: number | null; slots: SavedSlot[]; updatedAt: number }

function loadRuns(): Record<string, SavedRun> {
  migrate();
  try { return JSON.parse(localStorage.getItem(RUN_KEY) ?? '{}'); } catch { return {}; }
}
export function getRunState(id: string): SavedRun | undefined {
  return loadRuns()[id];
}
export function saveRunState(id: string, run: Omit<SavedRun, 'updatedAt'>) {
  const sessions = loadAll();
  const runs = loadRuns();
  runs[id] = { ...run, updatedAt: Date.now() };
  // only keep progress for sessions that still exist
  store(sessions, Object.fromEntries(Object.entries(runs).filter(([k]) => k === id || sessions[k])), id);
}
/** Most recent quiz that was started but not finished, if any. */
export function latestUnfinished(): { session: QuizSession; run: SavedRun } | undefined {
  const sessions = loadAll();
  const best = Object.entries(loadRuns())
    .filter(([id, r]) => !r.finished && sessions[id] && r.slots.some((s) => s.graded || s.response !== undefined))
    .sort((a, b) => b[1].updatedAt - a[1].updatedAt)[0];
  return best ? { session: sessions[best[0]], run: best[1] } : undefined;
}
