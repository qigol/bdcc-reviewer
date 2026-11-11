import { describe, expect, it } from 'vitest';
import { calendarExams, calendarWeeks } from '../src/season/calendar';

const mod = (id: string, order: number, assessment?: string, assessmentDate?: string) => ({ id, order, assessment, assessmentDate });
const courses = [
  { course: 'INTB', modules: [mod('a', 10, 'Long Quiz 3', '2026-10-15'), mod('b', 100, 'Long Quiz 4', '2026-11-12'), mod('c', 110, 'Long Quiz 4', '2026-11-12')] },
  { course: 'BDCC', modules: [mod('fim', 10, 'Midterm', '2026-09-25'), mod('spark', 40, 'Final Exam', '2026-12-04')] },
  { course: 'ML2', modules: [mod('ts', 10)] },
];

describe('Hell Week calendar', () => {
  it('puts every dated course test on the calendar, sorted by date', () => {
    expect(calendarExams(courses, []).map((e) => `${e.date} ${e.name}`)).toEqual([
      '2026-09-25 BDCC Midterm', '2026-10-15 INTB Long Quiz 3', '2026-11-12 INTB Long Quiz 4', '2026-12-04 BDCC Final Exam',
    ]);
  });

  it("a learner's own exam replaces the syllabus one it matches, by name or by modules", () => {
    const mine = [
      { id: 'x', name: 'intb  long quiz 4', course: 'INTB', date: '2026-11-13' },
      { id: 'y', name: 'Spark final', course: 'BDCC', date: '2026-12-05', moduleIds: ['spark'] },
      { id: 'z', name: 'ML2 exam', course: 'ML2', date: '2026-11-20' },
    ];
    const got = calendarExams(courses, mine);
    expect(got.filter((e) => !e.mine).map((e) => e.name)).toEqual(['BDCC Midterm', 'INTB Long Quiz 3']);
    expect(got.filter((e) => e.mine).map((e) => e.date)).toEqual(['2026-11-13', '2026-11-20', '2026-12-05']);
  });

  it('lays the season out in whole Monday-to-Sunday weeks', () => {
    const exams = calendarExams(courses, []);
    const weeks = calendarWeeks('2026-11-10', '2026-12-07', exams);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0][0].date).toBe('2026-11-09'); // Monday before Tue Nov 10
    expect(weeks[0][0].inRange).toBe(false);
    expect(weeks.at(-1)!.at(-1)!.date).toBe('2026-12-13');
    const days = weeks.flat();
    expect(days.find((d) => d.date === '2026-11-12')!.exams.map((e) => e.name)).toEqual(['INTB Long Quiz 4']);
    expect(days.find((d) => d.date === '2026-12-04')!.exams.map((e) => e.name)).toEqual(['BDCC Final Exam']);
    expect(days.filter((d) => d.inRange)).toHaveLength(28);
  });
});
