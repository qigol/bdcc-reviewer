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
