/**
 * Phase 5 (L1–L3).
 * Property 16: displayed mastery stayed at its peak forever.
 * Property 15: `explain` counted at full weight, and retries after a revealed solution moved mastery and SRS.
 * Property 18: a quiz with 2 failed questions out of 10 read 100% with no note.
 */
import 'fake-indexeddb/auto';
import fc from 'fast-check';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../src/storage/db';
import { ALPHA, effectiveMastery, levelOf, recordAttempt, W_SELF } from '../src/storage/progress';
import { summarize } from '../src/quiz/summary';
import { refMastery } from './reference/srsMastery';

const DAY = 86_400_000;
const attempt = (over = {}) => ({ key: 'm/t', templateId: 't', moduleId: 'm', seed: 1, type: 'mcq', skills: ['s'], score: 1, response: {}, timeMs: 1, mode: 'practice', difficulty: 2, ...over });

describe('mastery decay (Property 16)', () => {
  const s = fc.double({ min: 0, max: 1, noNaN: true });
  const t = fc.integer({ min: 0, max: 400 * DAY });

  it('full during the 7-day grace; non-increasing; stays in [0, s]; strictly lower past grace', () => {
    fc.assert(fc.property(s, t, t, (score, a, b) => {
      const [t1, t2] = a < b ? [a, b] : [b, a];
      const e1 = effectiveMastery(score, 0, t1), e2 = effectiveMastery(score, 0, t2);
      expect(e2).toBeLessThanOrEqual(e1);
      expect(e1).toBeLessThanOrEqual(score);
      expect(e1).toBeGreaterThanOrEqual(0);
      if (t1 <= 7 * DAY) expect(e1).toBe(score);
      if (t1 > 8 * DAY && score > 1e-9) expect(e1).toBeLessThan(score);
    }));
  });

  it('the design example: 0.95 reads 0.95 on day 7, 0.48 on day 37, 0.24 on day 67', () => {
    expect(effectiveMastery(0.95, 0, 7 * DAY)).toBe(0.95);
    expect(effectiveMastery(0.95, 0, 37 * DAY)).toBeCloseTo(0.475, 3);
    expect(effectiveMastery(0.95, 0, 67 * DAY)).toBeCloseTo(0.2375, 3);
  });

  it('levelOf thresholds are unchanged', () => {
    expect([levelOf(0.95, 2), levelOf(0.4, 3), levelOf(0.6, 3), levelOf(0.8, 3), levelOf(0.95, 3)]).toEqual(['new', 'learning', 'shaky', 'solid', 'mastered']);
  });
});

describe('self-grades and post-solution retries (Property 15)', () => {
  beforeEach(async () => { await Promise.all([db.attempts.clear(), db.mastery.clear(), db.srs.clear()]); });

  it('explain moves mastery at half weight and is flagged; its SRS step is unchanged', async () => {
    await recordAttempt(attempt({ type: 'explain', score: 1 }));
    expect((await db.mastery.get('m:s'))!.score).toBeCloseTo(ALPHA * W_SELF, 10);
    expect((await db.attempts.toArray())[0].selfGraded).toBe(true);
    expect((await db.srs.get('m/t'))!.reps).toBe(1);
  });

  it('a stream with retries: only ordinary and explain answers move anything', async () => {
    const step = fc.record({ kind: fc.constantFrom('plain', 'explain', 'post', 'coding'), score: fc.double({ min: 0, max: 1, noNaN: true }) });
    await fc.assert(fc.asyncProperty(fc.array(step, { maxLength: 10 }), async (steps) => {
      await Promise.all([db.attempts.clear(), db.mastery.clear(), db.srs.clear()]);
      let model = { score: 0, n: 0 };
      let counted = 0;
      for (const x of steps) {
        if (x.kind === 'plain') { await recordAttempt(attempt({ score: x.score })); model = refMastery(model, x.score, 2); counted++; }
        if (x.kind === 'explain') { await recordAttempt(attempt({ type: 'explain', score: x.score })); model = { score: Math.min(1, Math.max(0, model.score + ALPHA * W_SELF * (x.score - model.score))), n: model.n + 1 }; counted++; }
        if (x.kind === 'post') await recordAttempt(attempt({ score: x.score, postSolution: true }));
        if (x.kind === 'coding') await recordAttempt(attempt({ key: 'm/exam-coding', templateId: 'exam-coding', type: 'exam-coding', mode: 'exam-coding', score: x.score }));
      }
      expect(await db.attempts.count()).toBe(steps.length);
      const m = await db.mastery.get('m:s');
      if (!counted) expect(m).toBeUndefined();
      else { expect(m!.n).toBe(model.n); expect(m!.score).toBeCloseTo(model.score, 10); }
      const s = await db.srs.get('m/t');
      expect(!!s).toBe(counted > 0); // reps reset on a lapse, so they do not count answers
    }), { numRuns: 40 });
  });

  it('stored score is what the formula wrote; decay only applies at display', async () => {
    vi.useFakeTimers({ now: 1_700_000_000_000, toFake: ['Date'] });
    try {
      await recordAttempt(attempt({ score: 1 }));
      vi.setSystemTime(1_700_000_000_000 + 90 * DAY);
      const row = (await db.mastery.get('m:s'))!;
      expect(row.score).toBeCloseTo(ALPHA, 10);
      expect(effectiveMastery(row.score, row.updatedAt, Date.now())).toBeLessThan(row.score);
    } finally { vi.useRealTimers(); }
  });
});

describe('quiz summary (Property 18)', () => {
  const slot = fc.oneof(
    fc.record({ inst: fc.constant({}), graded: fc.record({ score: fc.double({ min: 0, max: 1, noNaN: true }) }) }),
    fc.record({ inst: fc.constant({}), graded: fc.constant(null) }),
    fc.record({ error: fc.constant('boom') }),
  );

  it('lists every failed slot, excludes it from the denominator, and says so', () => {
    fc.assert(fc.property(fc.array(slot, { maxLength: 12 }), (slots: any[]) => {
      const items = slots.map((_, i) => ({ moduleId: 'm', templateId: `t${i}` }));
      const r = summarize(slots, items);
      const errs = slots.flatMap((s, i) => (s.error ? [i] : []));
      expect(r.failed.map((f) => f.index)).toEqual(errs);
      expect(r.failed.every((f) => f.error === 'boom' && f.moduleId === 'm' && f.templateId === `t${f.index}`)).toBe(true);
      expect(r.denominator).toBe(slots.filter((s) => s.inst && s.graded).length);
      expect(r.rule).toBe('excluded');
      if (errs.length) expect(r.note).toContain(String(errs.length));
      else expect(r.note).toBe('');
    }));
  });

  it('the audit example: 10 slots, 2 errors, 8 correct', () => {
    const slots: any[] = [...Array.from({ length: 8 }, () => ({ inst: {}, graded: { score: 1 } })), { error: 'a' }, { error: 'b' }];
    const r = summarize(slots);
    expect([r.score, r.denominator, r.pct, r.failed.length]).toEqual([8, 8, 1, 2]);
    expect(r.note).toBe("2 questions couldn't be generated and aren't counted");
  });

  it('a quiz without errors keeps its score and denominator', () => {
    const r = summarize([{ inst: {}, graded: { score: 0.5 } }, { inst: {}, graded: { score: 1 } }]);
    expect([r.score, r.denominator, r.pct, r.note]).toEqual([1.5, 2, 0.75, '']);
  });
});
