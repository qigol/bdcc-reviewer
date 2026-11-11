/**
 * Exams on the Hell Week calendar: each course test's syllabus date (manifest `assessmentDate`), plus the learner's own
 * exams from Settings. A learner exam replaces the syllabus one it matches (same course and the same name, e.g. the
 * "INTB Long Quiz 4" the Settings shortcut makes, or the same modules), so learners can move a date. Pure.
 */
import { groupByAssessment } from '../modules/courseGroups';
import { addDays, daysBetween, parseLocalDate } from '../plan/studyPlan';

export interface CalendarExam { key: string; name: string; course: string; date: string; mine: boolean }

interface Mod { id: string; order?: number; assessment?: string; assessmentDate?: string }
interface LearnerExam { id: string; name: string; course: string; date: string; moduleIds?: string[] }

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

export function calendarExams(courses: { course: string; modules: Mod[] }[], mine: LearnerExam[]): CalendarExam[] {
  const out: CalendarExam[] = mine.map((e) => ({ key: e.id, name: e.name, course: e.course, date: e.date, mine: true }));
  for (const g of courses) {
    for (const s of groupByAssessment(g.modules)) {
      const date = s.modules.find((m) => m.assessmentDate)?.assessmentDate;
      if (!s.assessment || !date) continue;
      const name = `${g.course} ${s.assessment}`;
      const ids = s.modules.map((m) => m.id);
      const overridden = mine.some((e) => e.course === g.course && (norm(e.name) === norm(name) || (!!e.moduleIds?.length && sameSet(e.moduleIds, ids))));
      if (!overridden) out.push({ key: `syllabus:${g.course}:${s.assessment}`, name, course: g.course, date, mine: false });
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
