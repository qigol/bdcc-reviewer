import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../storage/db';
import { useAllProgress, useAttempts, useMastery, useSetting } from '../storage/progress';
import { useModuleIndex } from '../modules/useIndex';
import { useCourses } from '../modules/courses';
import { buildPlan, estimateMinutes, toYmd, type Plan, type PlanTask } from './studyPlan';
import { stepHref, stepStatus } from './stepStatus';

/** The live exam plan: remaining path steps per exam (each module counted once, by its earliest exam) scheduled from today. */
export function usePlan(): { plan: Plan; loading: boolean } {
  const [exams] = useSetting('exams');
  const [hours] = useSetting('studyHoursPerDay');
  const { mods, loading } = useModuleIndex();
  const { courses, courseOf } = useCourses();
  const progress = useAllProgress();
  const attempts = useAttempts();
  const mastery = useMastery();
  const srs = useLiveQuery(() => db.srs.toArray(), []) ?? [];
  const today = toYmd(Date.now());

  const plan = useMemo(() => {
    const claimed = new Set<string>();
    const sorted = [...exams].sort((a, b) => a.date.localeCompare(b.date));
    const perExam = sorted.map((exam) => {
      const inCourse = courses.find((g) => g.course === exam.course)?.modules.map((m) => m.id) ?? [];
      const ids = exam.moduleIds?.length ? inCourse.filter((id) => exam.moduleIds!.includes(id)) : inCourse;
      const tasks: PlanTask[] = [];
      // past exams don't claim modules, so a later exam on the same material still plans it
      if (exam.date < today) return { exam, tasks };
      for (const id of ids) {
        if (claimed.has(id)) continue;
        claimed.add(id);
        const mod = mods.find((m) => m.id === id);
        if (!mod) continue;
        const p = progress.filter((x) => x.moduleId === id);
        const a = attempts.filter((x) => x.moduleId === id);
        const skills = mod.manifest.skills;
        const mm = skills.length ? skills.reduce((acc, s) => acc + (mastery.find((x) => x.skillKey === `${id}:${s.id}`)?.score ?? 0), 0) / skills.length : 0;
        for (const step of mod.path) {
          if (stepStatus(step, p, a, mm) === 'done') continue;
          const size =
            step.kind === 'scene' ? { beats: mod.scenes.find((s) => s.id === step.id)?.beats }
            : step.kind === 'section' ? { derivationSteps: mod.sections.find((s) => s.id === step.id)?.steps }
            : step.kind === 'case' ? { decisions: mod.application.decisions.length }
            : {};
          tasks.push({ moduleId: id, moduleTitle: mod.manifest.shortTitle, step, minutes: estimateMinutes(step, size), href: stepHref(step, `/m/${id}`, id) });
        }
      }
      return { exam, tasks };
    });
    const reviews: Record<string, Record<string, number>> = {};
    for (const r of srs) {
      const course = courseOf(r.moduleId);
      if (!course) continue;
      const day = toYmd(r.due);
      (reviews[day] ??= {})[course] = (reviews[day][course] ?? 0) + 1;
    }
    return buildPlan({ today, hoursPerDay: hours, exams: perExam, reviews });
  }, [exams, hours, mods, courses, progress, attempts, mastery, srs, today]);

  return { plan, loading };
}
