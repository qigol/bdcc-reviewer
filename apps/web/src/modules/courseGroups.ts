import type { ModuleListEntry } from '../lib/api';

/**
 * Courses group modules. A module's course comes from the server list entry (manifest `course`,
 * an admin override, or the server's default course), so every module belongs to exactly one.
 * Quizzes never mix courses.
 */
export interface CourseGroup {
  course: string;
  modules: ModuleListEntry[];
}

/** Group modules by course. Courses are ordered by their first module's order, then by name; modules keep list order. */
export function groupByCourse(list: ModuleListEntry[]): CourseGroup[] {
  const by = new Map<string, ModuleListEntry[]>();
  for (const m of list) {
    const c = m.course || 'Other';
    if (!by.has(c)) by.set(c, []);
    by.get(c)!.push(m);
  }
  const minOrder = (ms: ModuleListEntry[]) => Math.min(...ms.map((m) => m.order));
  return [...by.entries()]
    .map(([course, modules]) => ({ course, modules }))
    .sort((a, b) => minOrder(a.modules) - minOrder(b.modules) || a.course.localeCompare(b.course));
}

export interface AssessmentGroup<T> {
  /** the test these modules are assessed in; null for modules without a label */
  assessment: string | null;
  modules: T[];
}

/**
 * Group one course's modules by the test they are assessed in (manifest `assessment`). Groups are ordered by their
 * first module's order, so they follow the syllabus; unlabelled modules come last. A course with no labels gives one
 * group with `assessment: null`, so callers can render it exactly as before.
 */
export function groupByAssessment<T extends { order?: number; assessment?: string }>(modules: T[]): AssessmentGroup<T>[] {
  const by = new Map<string | null, T[]>();
  for (const m of modules) {
    const a = m.assessment?.trim() || null;
    if (!by.has(a)) by.set(a, []);
    by.get(a)!.push(m);
  }
  const minOrder = (ms: T[]) => Math.min(...ms.map((m) => m.order ?? 1000));
  return [...by.entries()]
    .map(([assessment, modules]) => ({ assessment, modules }))
    .sort((a, b) => (a.assessment === null ? 1 : 0) - (b.assessment === null ? 1 : 0) || minOrder(a.modules) - minOrder(b.modules));
}

/** Split quiz items into one batch per course (a quiz may only draw from one course). */
export function splitByCourse<T extends { moduleId: string }>(items: T[], courseOf: (id: string) => string | undefined): { course: string; items: T[] }[] {
  const by = new Map<string, T[]>();
  for (const it of items) {
    const c = courseOf(it.moduleId) ?? '?';
    if (!by.has(c)) by.set(c, []);
    by.get(c)!.push(it);
  }
  return [...by.entries()].map(([course, items]) => ({ course, items }));
}
