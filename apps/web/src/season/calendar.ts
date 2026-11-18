/**
 * Exams on the Hell Week calendar: each course test's syllabus date (manifest `assessmentDate`), plus the learner's own
 * exams from Settings. A learner exam replaces the syllabus one it matches (same course and the same name, e.g. the
 * "INTB Long Quiz 4" the Settings shortcut makes, or the same modules), so learners can move a date. Other deadlines
 * (presentations, quizzes, projects; `deadlines.ts`) are passed in and replaced the same way by name. Pure.
 */
import { groupByAssessment } from '../modules/courseGroups';
import { addDays, daysBetween, parseLocalDate } from '../plan/studyPlan';

export interface CalendarExam {
  key: string; name: string; course: string; date: string; mine: boolean;
  /** Where the date comes from; `deadline` = the fixed list in `deadlines.ts`. */
  source?: 'syllabus' | 'mine' | 'deadline'; time?: string; note?: string;
}
interface Deadline { course: string; name: string; date: string; time?: string; note?: string }

interface Mod { id: string; order?: number; assessment?: string; assessmentDate?: string }
interface LearnerExam { id: string; name: string; course: string; date: string; moduleIds?: string[] }

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

export function calendarExams(courses: { course: string; modules: Mod[] }[], mine: LearnerExam[], deadlines: Deadline[] = []): CalendarExam[] {
  const out: CalendarExam[] = mine.map((e) => ({ key: e.id, name: e.name, course: e.course, date: e.date, mine: true, source: 'mine' }));
  for (const d of deadlines) {
    if (mine.some((e) => e.course === d.course && norm(e.name) === norm(d.name))) continue;
    out.push({ key: `deadline:${d.course}:${d.name}`, name: d.name, course: d.course, date: d.date, mine: false, source: 'deadline', time: d.time, note: d.note });
  }
  for (const g of courses) {
    for (const s of groupByAssessment(g.modules)) {
      const date = s.modules.find((m) => m.assessmentDate)?.assessmentDate;
      if (!s.assessment || !date) continue;
      const name = `${g.course} ${s.assessment}`;
      const ids = s.modules.map((m) => m.id);
      const overridden = mine.some((e) => e.course === g.course && (norm(e.name) === norm(name) || (!!e.moduleIds?.length && sameSet(e.moduleIds, ids))));
      if (!overridden) out.push({ key: `syllabus:${g.course}:${s.assessment}`, name, course: g.course, date, mine: false, source: 'syllabus' });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

export interface CalendarDay { date: string; inRange: boolean; exams: CalendarExam[] }

/** Whole Monday-to-Sunday weeks covering `start`..`end`; days outside the range are padding. */
export function calendarWeeks(start: string, end: string, exams: CalendarExam[]): CalendarDay[][] {
  const lead = (parseLocalDate(start).getDay() + 6) % 7; // days since Monday
  const first = addDays(start, -lead);
  const total = daysBetween(first, end) + 1;
  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < Math.ceil(total / 7) * 7; i++) {
    const date = addDays(first, i);
    if (i % 7 === 0) weeks.push([]);
    weeks[weeks.length - 1].push({ date, inRange: date >= start && date <= end, exams: exams.filter((e) => e.date === date) });
  }
  return weeks;
}
