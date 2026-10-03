import { useMemo } from 'react';
import { enabledModules, useModuleStore } from './store';
import { groupByCourse, type CourseGroup } from './courseGroups';

export { groupByCourse, splitByCourse, type CourseGroup } from './courseGroups';

/** Enabled modules grouped by course, plus a module → course lookup. */
export function useCourses(): { courses: CourseGroup[]; courseOf: (moduleId: string) => string | undefined } {
  const { list } = useModuleStore();
  return useMemo(() => {
    const courses = groupByCourse(enabledModules(list));
    const map = new Map(list.map((m) => [m.id, m.course]));
    return { courses, courseOf: (id: string) => map.get(id) };
  }, [list]);
}
