import { describe, expect, it } from 'vitest';
import { addDays, buildPlan, daysBetween, type PlanExam, type PlanInput, type PlanTask } from '../src/plan/studyPlan';

const TODAY = '2026-11-03';
const exam = (id: string, course: string, inDays: number): PlanExam => ({ id, name: id, course, date: addDays(TODAY, inDays) });
const tasks = (moduleId: string, n: number, minutes = 30): PlanTask[] =>
  Array.from({ length: n }, (_, i) => ({ moduleId, moduleTitle: moduleId, step: { kind: 'scene', id: `s${i}`, title: `S${i}`, skills: [], terms: [] }, minutes, href: `/m/${moduleId}/intuition/s${i}` }));
const plan = (p: Partial<PlanInput>) => buildPlan({ today: TODAY, hoursPerDay: 2, exams: [], reviews: {}, ...p });
const lessons = (d: { items: { kind: string }[] }) => d.items.filter((x) => x.kind === 'lesson');

describe('dates', () => {
  it('counts calendar days across month ends', () => {
    expect(daysBetween('2026-10-30', '2026-11-02')).toBe(3);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('study plan', () => {
  it('fits lessons into the daily budget and finishes before the exam', () => {
    const p = plan({ exams: [{ exam: exam('mid', 'BDCC', 10), tasks: tasks('a', 12) }] });
    expect(p.days).toHaveLength(11);
    for (const d of p.days) expect(d.minutes).toBeLessThanOrEqual(120);
    expect(p.days.flatMap(lessons)).toHaveLength(12);
    const st = p.exams[0];
    expect(st.unscheduledMinutes).toBe(0);
    expect(st.lessonsDoneOn! <= addDays(TODAY, 8)).toBe(true);
  });

  it('keeps the day before an exam for practice and exam day free of new lessons', () => {
    const p = plan({ exams: [{ exam: exam('mid', 'BDCC', 5), tasks: tasks('a', 8) }] });
    const before = p.days.find((d) => d.date === addDays(TODAY, 4))!;
    const day = p.days.find((d) => d.date === addDays(TODAY, 5))!;
    expect(p.exams[0].unscheduledMinutes).toBe(0);
    expect(lessons(before)).toHaveLength(0);
    expect(before.items.some((x) => x.kind === 'practice')).toBe(true);
    expect(lessons(day)).toHaveLength(0);
    expect(day.items.some((x) => x.kind === 'practice')).toBe(true);
    expect(day.exams).toEqual(['mid']);
  });

  it('spills lessons onto the day before when an exam is overloaded', () => {
    const p = plan({ exams: [{ exam: exam('mid', 'BDCC', 5), tasks: tasks('a', 30) }] });
    expect(lessons(p.days.find((d) => d.date === addDays(TODAY, 4))!).length).toBeGreaterThan(0);
    expect(lessons(p.days.find((d) => d.date === addDays(TODAY, 5))!)).toHaveLength(0);
  });

  it('flags overload with hours a day that really do fit', () => {
    const input = { hoursPerDay: 1, exams: [{ exam: exam('mid', 'BDCC', 4), tasks: tasks('a', 20) }] };
    const st = plan(input).exams[0];
    expect(st.unscheduledMinutes).toBeGreaterThan(0);
    expect(st.neededHoursPerDay).toBeGreaterThan(1);
    expect(plan({ ...input, hoursPerDay: st.neededHoursPerDay! }).exams[0].unscheduledMinutes).toBe(0);
    expect(plan({ ...input, hoursPerDay: st.neededHoursPerDay! - 0.5 }).exams[0].unscheduledMinutes).toBeGreaterThan(0);
  });

  it('suggests hours that fit an earlier exam even while a later one competes for time', () => {
    const input = {
      hoursPerDay: 2,
      exams: [
        { exam: exam('mid', 'MANACC', 9), tasks: tasks('m', 60) },
        { exam: exam('fin', 'BDCC', 14), tasks: tasks('b', 50) },
      ],
    };
    const p = plan(input);
    for (const st of p.exams) {
      expect(st.neededHoursPerDay).toBeDefined();
      expect(plan({ ...input, hoursPerDay: st.neededHoursPerDay! }).exams.find((e) => e.exam.id === st.exam.id)!.unscheduledMinutes).toBe(0);
    }
  });

  it('works on two exams at once instead of starving the later, bigger one', () => {
    const p = plan({
      hoursPerDay: 3,
      exams: [
        { exam: exam('small', 'MARK', 6), tasks: tasks('m', 2) },
        { exam: exam('big', 'BDCC', 9), tasks: tasks('b', 30) },
      ],
    });
    const first = lessons(p.days[0]) as { examId: string }[];
    expect(first.some((x) => x.examId === 'big')).toBe(true);
    expect(p.exams.find((e) => e.exam.id === 'small')!.unscheduledMinutes).toBe(0);
  });

  it('schedules reviews first, with overdue ones today and the rest rolling over past the cap', () => {
    const p = plan({
      exams: [{ exam: exam('mid', 'BDCC', 5), tasks: tasks('a', 3) }],
      reviews: { [addDays(TODAY, -2)]: { BDCC: 100 }, [addDays(TODAY, 1)]: { BDCC: 4 } },
    });
    const r0 = p.days[0].items[0];
    expect(r0.kind).toBe('review');
    expect(r0.minutes).toBeLessThanOrEqual(120 * 0.4);
    const r1 = p.days[1].items.find((x) => x.kind === 'review') as { count: number };
    expect(r1.count).toBeGreaterThan(4); // carried over from today
  });

  it('plans nothing new on exam day and ignores passed exams', () => {
    const p = plan({ exams: [{ exam: exam('today', 'BDCC', 0), tasks: tasks('a', 3) }, { exam: exam('old', 'BDCC', -3), tasks: [] }] });
    expect(p.days).toHaveLength(1);
    expect(lessons(p.days[0])).toHaveLength(0);
    expect(p.days[0].items.some((x) => x.kind === 'practice')).toBe(true);
    expect(p.exams.map((e) => e.exam.id)).toEqual(['old', 'today']);
    expect(p.exams[0].daysLeft).toBe(-3);
  });

  it('gives an oversized step a day of its own instead of never scheduling it', () => {
    const p = plan({ hoursPerDay: 0.5, exams: [{ exam: exam('mid', 'BDCC', 6), tasks: tasks('a', 1, 45) }] });
    expect(p.days.flatMap(lessons)).toHaveLength(1);
  });
});
