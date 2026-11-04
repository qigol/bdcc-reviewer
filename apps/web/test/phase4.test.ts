/**
 * Phase 4 (D1–D7).
 * Property 10: a conflicting import left two notes per anchor and kept stale text.
 * Property 12: `score: 'x'` was written and `dbVersion: 99` accepted.
 * Property 13: an attempt row persisted when the SRS write failed.
 * Property 11, 14 (preservation): merge semantics and the SRS and mastery formulas are unchanged.
 * Property 17: a new tab saw no quiz session.
 */
import 'fake-indexeddb/auto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fc from 'fast-check';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, DB_VERSION } from '../src/storage/db';
import { exportProgress, importProgress, resetProgress } from '../src/storage/exportImport';
import { getSetting, recordAttempt, setSetting } from '../src/storage/progress';
import { backupDue, initStorage } from '../src/storage/persist';
import { getRunState, getSession, latestUnfinished, saveRunState, saveSession, type QuizSession } from '../src/quiz/sessionStore';
import { FakeStorage, installStorage } from './helpers';
import { refMastery, refSrs } from './reference/srsMastery';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = (tables: Record<string, unknown>, dbVersion: unknown = DB_VERSION) => JSON.stringify({ app: 'kodigo', dbVersion, exportedAt: 'x', tables });
const clearAll = async () => {
  await Promise.all([db.progress.clear(), db.attempts.clear(), db.srs.clear(), db.mastery.clear(), db.notes.clear(), db.bookmarks.clear(), db.settings.clear()]);
};

describe('note merge (Property 10)', () => {
  beforeEach(clearAll);
  const note = fc.record({
    moduleId: fc.constantFrom('a', 'b'), anchor: fc.constantFrom('x', 'y'), text: fc.string({ maxLength: 8 }),
    createdAt: fc.integer({ min: 1, max: 1000 }), updatedAt: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }),
  });
  const time = (n: { createdAt: number; updatedAt?: number }) => n.updatedAt ?? n.createdAt;

  it('one note per anchor holding the newest text, ties to local', async () => {
    await fc.assert(fc.asyncProperty(fc.array(note, { maxLength: 8 }), fc.array(note, { maxLength: 8 }), async (local, imported) => {
      await db.notes.clear();
      for (const n of local) await db.notes.add({ ...n });
      await importProgress(file({ notes: imported }));
      const after = await db.notes.toArray();
      const keys = after.map((n) => `${n.moduleId}|${n.anchor}`);
      expect(new Set(keys).size).toBe(keys.length);
      for (const k of new Set([...local, ...imported].map((n) => `${n.moduleId}|${n.anchor}`))) {
        const of = (l: typeof local) => l.filter((n) => `${n.moduleId}|${n.anchor}` === k);
        const best = (l: typeof local) => (l.length ? Math.max(...l.map(time)) : -1);
        const got = after.find((n) => `${n.moduleId}|${n.anchor}` === k)!;
        const winner = best(of(imported)) > best(of(local)) ? of(imported) : of(local);
        expect(winner.filter((n) => time(n) === best(winner)).map((n) => n.text)).toContain(got.text);
      }
    }), { numRuns: 80 });
  });

  it('the audit scenario: B edited later keeps the newer imported text in one note', async () => {
    await db.notes.add({ moduleId: 'm', anchor: 'a', text: 'old on B', createdAt: 500 });
    await importProgress(file({ notes: [{ moduleId: 'm', anchor: 'a', text: 'new on A', createdAt: 100, updatedAt: 900 }] }));
    expect((await db.notes.toArray()).map((n) => n.text)).toEqual(['new on A']);
  });
});

describe('import validation (Property 12)', () => {
  beforeEach(clearAll);

  const junk = fc.oneof(fc.constant(null), fc.integer(), fc.string({ maxLength: 4 }), fc.constant({}), fc.record({ score: fc.constant('x'), updatedAt: fc.constant('nope') }), fc.record({ moduleId: fc.constant('m'), tab: fc.constant('bad'), itemId: fc.constant('i'), status: fc.constant('done'), updatedAt: fc.constant(1) }));

  it('malformed rows never throw or reach the tables, and every row is accounted for', async () => {
    await fc.assert(fc.asyncProperty(fc.array(junk, { maxLength: 6 }), fc.constantFrom('progress', 'attempts', 'srs', 'mastery', 'notes', 'bookmarks', 'settings'), async (rows, table) => {
      await clearAll();
      const good = { skillKey: 'm:s', score: 0.5, n: 1, updatedAt: 1 };
      const r = await importProgress(file({ [table]: rows, mastery: table === 'mastery' ? [...rows, good] : [good] }));
      expect(r.skipped).toBe(rows.length);
      expect(r.added).toBe(1);
      expect(await db.mastery.count()).toBe(1);
      for (const t of ['progress', 'attempts', 'srs', 'notes', 'bookmarks', 'settings'] as const) expect(await db[t].count()).toBe(0);
    }), { numRuns: 60 });
  });

  it('non-finite numbers are invalid', async () => {
    // JSON can't carry NaN, but a hand-edited file can carry null or a string
    const r = await importProgress(file({ mastery: [{ skillKey: 'm:s', score: null, n: 1, updatedAt: 1 }] }));
    expect(r.skipped).toBe(1);
    expect(await db.mastery.count()).toBe(0);
  });

  it('a missing, non-numeric or newer dbVersion rejects the whole file with no writes', async () => {
    const tables = { mastery: [{ skillKey: 'm:s', score: 0.5, n: 1, updatedAt: 1 }] };
    await expect(importProgress(file(tables, 99))).rejects.toThrow(/newer version of Qdigo \(format 99\)/);
    await expect(importProgress(file(tables, '1'))).rejects.toThrow(/missing its format version/);
    await expect(importProgress(JSON.stringify({ app: 'kodigo', tables }))).rejects.toThrow(/missing its format version/);
    expect(await db.mastery.count()).toBe(0);
  });
});

describe('import merge preservation (Property 11)', () => {
  beforeEach(clearAll);

  it('a v1 export file imports; twice equals once; export → reset → import restores the tables', async () => {
    const fixture = fs.readFileSync(path.join(here, 'reference/export-v1.json'), 'utf8');
    const first = await importProgress(fixture);
    expect(first).toEqual({ added: 7, updated: 0, skipped: 0 });
    const snap = async () => ({ p: await db.progress.toArray(), s: await db.srs.toArray(), m: await db.mastery.toArray(), a: (await db.attempts.toArray()).map(({ id: _i, ...x }) => x), n: (await db.notes.toArray()).map(({ id: _i, ...x }) => x), b: await db.bookmarks.toArray(), t: await db.settings.toArray() });
    const once = await snap();
    expect(await importProgress(fixture)).toEqual({ added: 0, updated: 0, skipped: 0 });
    expect(await snap()).toEqual(once);
    const out = JSON.parse(await exportProgress());
    expect(Object.keys(out)).toEqual(['app', 'dbVersion', 'exportedAt', 'tables']);
    expect(out.dbVersion).toBe(1);
    await resetProgress();
    await db.settings.clear();
    await importProgress(JSON.stringify(out));
    expect(await snap()).toEqual(once);
  });

  it('keyed rows: the later updatedAt wins either way', async () => {
    await fc.assert(fc.asyncProperty(fc.integer({ min: 1, max: 100 }), fc.integer({ min: 1, max: 100 }), async (a, b) => {
      await clearAll();
      await db.mastery.put({ skillKey: 'k', score: 0.1, n: 1, updatedAt: a });
      await importProgress(file({ mastery: [{ skillKey: 'k', score: 0.9, n: 2, updatedAt: b }] }));
      expect((await db.mastery.get('k'))!.score).toBe(b > a ? 0.9 : 0.1);
    }), { numRuns: 40 });
  });

  it('device-local settings and the admin token never travel', async () => {
    await setSetting('firstUseAt', 5);
    await setSetting('lastExportAt', 6);
    await db.settings.put({ key: 'adminToken', value: 'secret' });
    const out = await exportProgress();
    for (const k of ['firstUseAt', 'lastExportAt', 'persistRequestedAt', 'adminToken']) expect(out).not.toContain(`"${k}"`);
    await db.settings.clear();
    await importProgress(file({ settings: [{ key: 'firstUseAt', value: 1 }, { key: 'adminToken', value: 'x' }, { key: 'theme', value: 'dark' }] }));
    expect((await db.settings.toArray()).map((s) => s.key)).toEqual(['theme']);
  });
});

const attempt = (over = {}) => ({ key: 'm/t', templateId: 't', moduleId: 'm', seed: 1, type: 'mcq', skills: ['s'], score: 1, response: {}, timeMs: 1, mode: 'practice', difficulty: 2, ...over });

describe('atomic recording (Property 13)', () => {
  beforeEach(clearAll);

  it('N concurrent answers all count', async () => {
    for (let run = 0; run < 20; run++) {
      await clearAll();
      const n = 2 + (run % 6);
      await Promise.all(Array.from({ length: n }, (_, i) => recordAttempt(attempt({ seed: i }))));
      expect((await db.mastery.get('m:s'))!.n).toBe(n);
      const s = (await db.srs.get('m/t'))!;
      expect(s.reps + s.lapses).toBe(n);
      expect(await db.attempts.count()).toBe(n);
    }
  });

  it('a failure in the SRS write leaves none of the three writes', async () => {
    const spy = vi.spyOn(db.srs, 'put').mockImplementation(() => { throw new Error('injected'); });
    await expect(recordAttempt(attempt())).rejects.toThrow();
    spy.mockRestore();
    expect(await db.attempts.count()).toBe(0);
    expect(await db.mastery.count()).toBe(0);
    expect(await db.srs.count()).toBe(0);
  });

  it('a coding exam row leaves SRS and mastery alone', async () => {
    await recordAttempt(attempt({ key: 'm/exam-coding', templateId: 'exam-coding', type: 'exam-coding', mode: 'exam-coding', skills: ['s'], score: 0.5 }));
    expect(await db.attempts.count()).toBe(1);
    expect(await db.mastery.count()).toBe(0);
    expect(await db.srs.count()).toBe(0);
  });
});

describe('SRS and mastery formulas (Property 14)', () => {
  beforeEach(clearAll);

  it('ordinary attempts write what the frozen formulas compute', async () => {
    const step = fc.record({ score: fc.double({ min: 0, max: 1, noNaN: true }), difficulty: fc.constantFrom(1, 2, 3), confidence: fc.constantFrom(undefined, 1, 2, 3) as fc.Arbitrary<undefined | 1 | 2 | 3> });
    await fc.assert(fc.asyncProperty(fc.array(step, { minLength: 1, maxLength: 6 }), async (steps) => {
      await clearAll();
      vi.useFakeTimers({ now: 1_700_000_000_000, toFake: ['Date'] });
      try {
        let m: ReturnType<typeof refMastery> | undefined;
        let s: ReturnType<typeof refSrs> | undefined;
        for (const x of steps) {
          await recordAttempt(attempt({ score: x.score, difficulty: x.difficulty, confidence: x.confidence }));
          m = refMastery(m, x.score, x.difficulty);
          s = refSrs(s, Date.now(), x.score, x.confidence);
          expect(await db.mastery.get('m:s')).toEqual({ skillKey: 'm:s', ...m, updatedAt: Date.now() });
          expect(await db.srs.get('m/t')).toEqual({ templateId: 'm/t', moduleId: 'm', ...s, updatedAt: Date.now() });
        }
      } finally { vi.useRealTimers(); }
    }), { numRuns: 40 });
  });
});

const session = (id: string, createdAt: number): QuizSession => ({ id, createdAt, mode: 'practice', items: [{ moduleId: 'm', templateId: 't', seed: 1 }] });

describe('quiz sessions in localStorage (Property 17)', () => {
  let local: FakeStorage;
  let tab: FakeStorage;
  beforeEach(() => { ({ local, session: tab } = installStorage()); });

  it('at most 20 sessions, runs only for stored ones, visible from another tab', () => {
    fc.assert(fc.property(fc.array(fc.integer({ min: 1, max: 40 }), { maxLength: 40 }), (ids) => {
      local.clear();
      ids.forEach((n, i) => {
        saveSession(session(`s${n}`, i));
        saveRunState(`s${n}`, { idx: 0, finished: false, deadline: null, slots: [{ response: 1 }] });
      });
      const sessions = JSON.parse(local.getItem('kodigo-sessions') ?? '{}');
      const runs = JSON.parse(local.getItem('kodigo-quiz-progress') ?? '{}');
      expect(Object.keys(sessions).length).toBeLessThanOrEqual(20);
      for (const id of Object.keys(runs)) expect(sessions[id]).toBeTruthy();
      // a new tab has its own sessionStorage but sees the same quizzes
      Object.defineProperty(globalThis, 'sessionStorage', { value: new FakeStorage(), configurable: true, writable: true });
      if (ids.length) expect(getSession(`s${ids[ids.length - 1]}`)).toBeTruthy();
    }));
  });

  it('latestUnfinished is the newest run with an answer', () => {
    vi.useFakeTimers({ now: 1000, toFake: ['Date'] });
    try {
      saveSession(session('a', 1));
      saveSession(session('b', 2));
      saveRunState('a', { idx: 0, finished: false, deadline: null, slots: [{ response: 1 }] });
      vi.setSystemTime(2000);
      saveRunState('b', { idx: 0, finished: false, deadline: null, slots: [{}] }); // nothing answered
      expect(latestUnfinished()?.session.id).toBe('a');
      vi.setSystemTime(3000);
      saveRunState('b', { idx: 0, finished: false, deadline: null, slots: [{ response: 2 }] });
      expect(latestUnfinished()?.session.id).toBe('b');
      saveRunState('b', { idx: 0, finished: true, deadline: null, slots: [{ response: 2 }] });
      expect(latestUnfinished()?.session.id).toBe('a');
    } finally { vi.useRealTimers(); }
  });

  it('migrates a quiz in progress from sessionStorage, newer rows winning, then removes the old keys', () => {
    local.setItem('kodigo-sessions', JSON.stringify({ a: session('a', 5) }));
    tab.setItem('kodigo-sessions', JSON.stringify({ a: { ...session('a', 9), title: 'newer' }, b: session('b', 1) }));
    tab.setItem('kodigo-quiz-progress', JSON.stringify({ b: { idx: 1, finished: false, deadline: null, slots: [], updatedAt: 1 } }));
    expect(getSession('a')?.title).toBe('newer');
    expect(getSession('b')).toBeTruthy();
    expect(getRunState('b')?.idx).toBe(1);
    expect(tab.getItem('kodigo-sessions')).toBeNull();
    expect(tab.getItem('kodigo-quiz-progress')).toBeNull();
  });

  it('on a full quota drops the oldest other session and still saves', () => {
    saveSession(session('old', 1));
    saveSession(session('mid', 2));
    local.quota = local.getItem('kodigo-sessions')!.length + 60;
    saveSession(session('new', 3));
    expect(getSession('new')).toBeTruthy();
    expect(getSession('old')).toBeUndefined();
  });
});

describe('persistent storage (D1)', () => {
  beforeEach(clearAll);

  it('first start asks once and records the dates', async () => {
    const persist = vi.fn(async () => true);
    vi.stubGlobal('navigator', { storage: { persist } });
    try {
      await initStorage(1234);
      await initStorage(9999);
      expect(persist).toHaveBeenCalledTimes(1);
      expect(await getSetting('firstUseAt')).toBe(1234);
      expect(await getSetting('persistRequestedAt')).toBe(1234);
    } finally { vi.unstubAllGlobals(); }
  });

  it('reminds only when not persisted and over 14 days since the last export', () => {
    const DAY = 86_400_000;
    const now = 100 * DAY;
    expect(backupDue(false, null, now - 15 * DAY, now)).toBe(true);
    expect(backupDue(false, null, now - 13 * DAY, now)).toBe(false);
    expect(backupDue(false, now - 1 * DAY, now - 99 * DAY, now)).toBe(false);
    expect(backupDue(true, null, now - 99 * DAY, now)).toBe(false);
    expect(backupDue(false, null, null, now)).toBe(false);
  });

  it('exporting records lastExportAt', async () => {
    await exportProgress();
    expect(await getSetting('lastExportAt')).toBeGreaterThan(0);
  });
});
