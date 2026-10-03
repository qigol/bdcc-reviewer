import { describe, expect, it } from 'vitest';
import { groupByCourse, splitByCourse } from '../src/modules/courseGroups';
import { MixedCourseError, newSession } from '../src/quiz/session';
import type { ModuleListEntry } from '../src/lib/api';

const entry = (id: string, course: string, order: number): ModuleListEntry => ({
  id, course, order, courseSource: 'manifest', version: '1.0.0', title: id, shortTitle: id, summary: '', enabled: true,
  origin: 'builtin', versions: [], hasBuiltin: true, prerequisites: [], health: { status: 'valid', errors: 0, warnings: 0 },
});

describe('course grouping', () => {
  const list = [entry('fim', 'BDCC', 10), entry('good-spot', 'MARK 3336', 5), entry('nb-cf', 'BDCC', 20), entry('lf-cf', 'BDCC', 30)];

  it('groups modules by course, ordering courses by their first module and keeping module order', () => {
    const g = groupByCourse(list);
    expect(g.map((x) => x.course)).toEqual(['MARK 3336', 'BDCC']);
    expect(g[1].modules.map((m) => m.id)).toEqual(['fim', 'nb-cf', 'lf-cf']);
  });

  it('splits quiz items into one batch per course', () => {
    const courseOf = (id: string) => list.find((m) => m.id === id)?.course;
    const parts = splitByCourse([{ moduleId: 'fim' }, { moduleId: 'good-spot' }, { moduleId: 'lf-cf' }], courseOf);
    expect(parts).toEqual([
      { course: 'BDCC', items: [{ moduleId: 'fim' }, { moduleId: 'lf-cf' }] },
      { course: 'MARK 3336', items: [{ moduleId: 'good-spot' }] },
    ]);
  });
});

describe('quiz sessions are single-course', () => {
  const courseOf = (id: string) => ({ fim: 'BDCC', 'nb-cf': 'BDCC', 'good-spot': 'MARK 3336' } as Record<string, string>)[id];

  it('accepts items from one course and records it', () => {
    const s = newSession('practice', 'BDCC', [{ moduleId: 'fim', templateId: 'a', seed: 1 }, { moduleId: 'nb-cf', templateId: 'b', seed: 2 }], courseOf);
    expect(s.course).toBe('BDCC');
    expect(s.items).toHaveLength(2);
  });

  it('refuses a quiz that mixes courses', () => {
    expect(() => newSession('practice', 'BDCC', [{ moduleId: 'fim', templateId: 'a', seed: 1 }, { moduleId: 'good-spot', templateId: 'b', seed: 2 }], courseOf)).toThrow(MixedCourseError);
    expect(() => newSession('practice', 'BDCC', [{ moduleId: 'good-spot', templateId: 'b', seed: 2 }], courseOf)).toThrow(/one course/);
  });
});
