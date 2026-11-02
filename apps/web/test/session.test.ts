import { describe, expect, it } from 'vitest';
import { pickItems, spread, type Candidate } from '../src/quiz/session';

const c = (i: number, type: string, difficulty = 1, skill = `s${i}`): Candidate => ({ moduleId: 'm', templateId: `t${i}`, type, skills: [skill], difficulty });
const byId = (cands: Candidate[]) => Object.fromEntries(cands.map((x) => [x.templateId, x]));

describe('pickItems', () => {
  it('does not repeat a template until the pool is used up', () => {
    const pool = Array.from({ length: 10 }, (_, i) => c(i, ['mcq', 'numeric', 'order'][i % 3]));
    for (let k = 0; k < 20; k++) {
      const ids = pickItems(pool, 10, { mode: 'practice' }).map((x) => x.templateId);
      expect(new Set(ids).size).toBe(10);
      const more = pickItems(pool, 15, { mode: 'exam' }).map((x) => x.templateId);
      expect(new Set(more).size).toBe(10);
    }
  });

  it('keeps one type to at most 40% when other types exist', () => {
    const pool = [...Array.from({ length: 30 }, (_, i) => c(i, 'numeric')), ...Array.from({ length: 10 }, (_, i) => c(100 + i, ['mcq', 'match', 'order', 'code-fill'][i % 4]))];
    const m = byId(pool);
    for (let k = 0; k < 20; k++) {
      const items = pickItems(pool, 20, { mode: 'exam' });
      const nNum = items.filter((x) => m[x.templateId].type === 'numeric').length;
      expect(nNum).toBeLessThanOrEqual(10); // 8 by cap; the pool only has 10 others, so the rest fill from numeric
      expect(nNum).toBeGreaterThanOrEqual(8);
    }
  });

  it('includes a conceptual and a production question when both exist', () => {
    const pool = [...Array.from({ length: 30 }, (_, i) => c(i, 'numeric')), c(99, 'mcq')];
    const m = byId(pool);
    for (let k = 0; k < 20; k++) {
      const items = pickItems(pool, 3, { mode: 'practice' });
      expect(items.some((x) => m[x.templateId].type === 'mcq')).toBe(true);
    }
  });

  it('ramps difficulty in practice mode', () => {
    const pool = Array.from({ length: 30 }, (_, i) => c(i, ['mcq', 'numeric', 'order'][i % 3], (i % 3) + 1));
    const m = byId(pool);
    let first = 0, last = 0;
    for (let k = 0; k < 50; k++) {
      const d = pickItems(pool, 30, { mode: 'practice' }).map((x) => m[x.templateId].difficulty);
      first += d.slice(0, 10).reduce((a, b) => a + b, 0);
      last += d.slice(20).reduce((a, b) => a + b, 0);
    }
    expect(last).toBeGreaterThan(first * 1.5);
  });

  it('leaves self-graded explain questions out of exams', () => {
    const pool = [c(1, 'explain'), c(2, 'mcq'), c(3, 'numeric')];
    const m = byId(pool);
    const items = pickItems(pool, 3, { mode: 'exam' });
    expect(items.every((x) => m[x.templateId].type !== 'explain')).toBe(true);
    expect(pickItems([c(1, 'explain')], 3, { mode: 'exam' })).toEqual([]);
  });
});

describe('spread', () => {
  it('avoids neighbours of the same type when possible', () => {
    const list = [c(1, 'mcq'), c(2, 'mcq'), c(3, 'mcq'), c(4, 'numeric'), c(5, 'numeric'), c(6, 'order')];
    const out = spread(list);
    for (let i = 1; i < out.length; i++) expect(out[i].type).not.toBe(out[i - 1].type);
  });
  it('avoids neighbours sharing a skill', () => {
    const list = [c(1, 'mcq', 1, 'a'), c(2, 'numeric', 1, 'a'), c(3, 'order', 1, 'b'), c(4, 'match', 1, 'b')];
    const out = spread(list);
    for (let i = 1; i < out.length; i++) expect(out[i].skills[0]).not.toBe(out[i - 1].skills[0]);
  });
});
