import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Tab, type Progress, type Attempt } from './db';
import { srsGrade, type Confidence } from './confidence';

/** an upcoming exam; `moduleIds` narrows it to part of the course (default: every module in it) */
export interface Exam { id: string; name: string; course: string; date: string; moduleIds?: string[] }

export interface Settings {
  theme: 'light' | 'dark' | 'system';
  narration: boolean;
  reducedMotion: boolean;
  exams: Exam[];
  /** daily study budget for the exam plan */
  studyHoursPerDay: number;
  lastLocation: { moduleId: string; tab: string; id?: string; beat?: number; path: string; title?: string; at: number } | null;
  showBeyond: boolean;
  /** the course you were last studying (default for the quiz builder and cheat sheet) */
  course: string | null;
  /** device-local, never exported: first start, when persistent storage was requested, last progress download */
  firstUseAt: number | null;
  persistRequestedAt: number | null;
  lastExportAt: number | null;
}
export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  narration: false,
  reducedMotion: false,
  exams: [],
  studyHoursPerDay: 2,
  lastLocation: null,
  showBeyond: true,
  course: null,
  firstUseAt: null,
  persistRequestedAt: null,
  lastExportAt: null,
};

/** One-time move of the old single `examDate` setting into `exams`, on the last-studied course or the only one. */
export async function migrateExamDate(courses: string[]) {
  const old = (await db.settings.get('examDate'))?.value as string | null | undefined;
  if (old === undefined) return;
  if (old && !(await getSetting('exams')).length) {
    const saved = await getSetting('course');
    const course = saved && courses.includes(saved) ? saved : courses[0];
    if (!course) return; // try again once courses have loaded
    await setSetting('exams', [{ id: crypto.randomUUID(), name: `${course} exam`, course, date: old }]);
  }
  await db.settings.delete('examDate');
}

export async function getSetting<K extends keyof Settings>(key: K): Promise<Settings[K]> {
  const row = await db.settings.get(key);
  return (row?.value as Settings[K]) ?? DEFAULT_SETTINGS[key];
}
export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  await db.settings.put({ key, value, updatedAt: Date.now() });
}
export function useSetting<K extends keyof Settings>(key: K): [Settings[K], (v: Settings[K]) => void] {
  const row = useLiveQuery(() => db.settings.get(key), [key]);
  const value = (row?.value as Settings[K]) ?? DEFAULT_SETTINGS[key];
  return [value, (v) => { setSetting(key, v); }];
}

export async function markProgress(moduleId: string, tab: Tab, itemId: string, patch: Partial<Progress> = {}) {
  const key: [string, string, string] = [moduleId, tab, itemId];
  const cur = await db.progress.get(key);
  const status = patch.status === 'done' || cur?.status === 'done' ? 'done' : 'seen';
  await db.progress.put({ ...(cur ?? { moduleId, tab, itemId }), ...patch, status, updatedAt: Date.now() } as Progress);
}

export function useModuleProgress(moduleId: string | undefined) {
  return useLiveQuery(() => (moduleId ? db.progress.where('moduleId').equals(moduleId).toArray() : Promise.resolve([] as Progress[])), [moduleId]) ?? [];
}
export function useAllProgress() {
  return useLiveQuery(() => db.progress.toArray(), []) ?? [];
}
export function useAttempts(filter?: (a: Attempt) => boolean) {
  return useLiveQuery(async () => {
    const all = await db.attempts.orderBy('at').reverse().toArray();
    return filter ? all.filter(filter) : all;
  }, []) ?? [];
}

// ------------------------------------------------------------ mastery (plan §9.4)
export const ALPHA = 0.3;
const W_D: Record<number, number> = { 1: 0.8, 2: 1, 3: 1.2 };
export type Level = 'new' | 'learning' | 'shaky' | 'solid' | 'mastered';
export function levelOf(score: number, n: number): Level {
  if (n < 3) return 'new';
  if (score < 0.5) return 'learning';
  if (score < 0.75) return 'shaky';
  if (score < 0.9) return 'solid';
  return 'mastered';
}
export const LEVEL_COLOR: Record<Level, string> = { new: 'bg-muted/40', learning: 'bg-bad', shaky: 'bg-warn', solid: 'bg-accent', mastered: 'bg-good' };

export async function updateMastery(moduleId: string, skills: string[], score: number, difficulty = 2, now = Date.now()) {
  for (const s of skills) {
    const skillKey = `${moduleId}:${s}`;
    const cur = (await db.mastery.get(skillKey)) ?? { skillKey, score: 0, n: 0, updatedAt: 0 };
    const w = W_D[difficulty] ?? 1;
    const m = Math.min(1, Math.max(0, cur.score + ALPHA * w * (score - cur.score)));
    await db.mastery.put({ skillKey, score: m, n: cur.n + 1, updatedAt: now });
  }
}
export function useMastery() {
  return useLiveQuery(() => db.mastery.toArray(), []) ?? [];
}

// ------------------------------------------------------------ SRS (SM-2-lite on templates)
const DAY = 86400000;
export async function updateSrs(key: string, moduleId: string, score: number, confidence?: Confidence, now = Date.now()) {
  const cur = (await db.srs.get(key)) ?? { templateId: key, moduleId, ease: 2.5, interval: 0, due: now, reps: 0, lapses: 0, updatedAt: now };
  const grade = srsGrade(score, confidence);
  let { ease, interval, reps, lapses } = cur;
  if (grade < 3) {
    reps = 0;
    lapses += 1;
    interval = 0.25; // six hours: re-solve later today
  } else {
    reps += 1;
    interval = reps === 1 ? 1 : reps === 2 ? 3 : Math.round(interval * ease);
  }
  ease = Math.max(1.3, ease + 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
  await db.srs.put({ templateId: key, moduleId, ease, interval, reps, lapses, due: now + interval * DAY, updatedAt: now });
}
export function useDueReviews() {
  return useLiveQuery(async () => (await db.srs.where('due').belowOrEqual(Date.now()).toArray()), []) ?? [];
}

/** One transaction: the attempt, mastery and SRS all land or none do, and overlapping answers can't lose updates. */
export async function recordAttempt(a: Omit<Attempt, 'id' | 'at'>) {
  const now = Date.now();
  await db.transaction('rw', db.attempts, db.mastery, db.srs, async () => {
    await db.attempts.add({ ...a, at: now });
    if (a.mode === 'exam-coding') return; // a whole-exam record, not practice of a skill
    const isGlossary = a.templateId.startsWith('glossary-');
    if (a.skills.length) await updateMastery(a.moduleId, a.skills, a.score, a.difficulty, now);
    if (!isGlossary || a.mode === 'review') await updateSrs(a.key, a.moduleId, a.score, a.confidence, now);
  });
}

export async function saveNote(moduleId: string, anchor: string, text: string) {
  const existing = await db.notes.where('moduleId').equals(moduleId).filter((n) => n.anchor === anchor).first();
  if (existing) await db.notes.update(existing.id!, { text, updatedAt: Date.now() });
  else await db.notes.add({ moduleId, anchor, text, createdAt: Date.now() });
}
export function useNote(moduleId: string, anchor: string) {
  return useLiveQuery(() => db.notes.where('moduleId').equals(moduleId).filter((n) => n.anchor === anchor).first(), [moduleId, anchor]);
}

/** Mastery as displayed at `now` (stored `score` is never changed by display). */
export function effectiveMastery(score: number, _updatedAt: number, _now: number): number {
  return score;
}
