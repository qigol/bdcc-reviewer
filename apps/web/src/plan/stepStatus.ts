import type { PathStep } from '@kodigo/schema';
import type { Attempt, Progress } from '../storage/db';

export type StepStatus = 'done' | 'started' | 'todo';

/** Status of one learning-path step, from that module's progress rows, attempts and mastery (0..1). Shared by the path and the study plan. */
export function stepStatus(s: PathStep, progress: Progress[], attempts: Attempt[], moduleMastery: number): StepStatus {
  if (s.kind === 'scene') {
    const p = progress.find((x) => x.tab === 'intuition' && x.itemId === s.id);
    return p?.status === 'done' ? 'done' : p ? 'started' : 'todo';
  }
  if (s.kind === 'section') {
    const seen = progress.some((x) => x.tab === 'math-code' && x.itemId === s.id);
    const practiced = !s.tryIt.length || attempts.some((a) => s.tryIt.includes(a.templateId) && a.score >= 0.5);
    return seen && practiced ? 'done' : seen ? 'started' : 'todo';
  }
  if (s.kind === 'case') {
    const p = progress.filter((x) => x.tab === 'application');
    return p.some((x) => x.status === 'done') ? 'done' : p.length ? 'started' : 'todo';
  }
  return moduleMastery >= 0.75 ? 'done' : attempts.some((a) => a.mode !== 'lesson' && a.mode !== 'predict' && a.mode !== 'exam-coding') ? 'started' : 'todo';
}

/** Where a path step lives; `base` is the module route (`/m/:id`, or the preview route). */
export const stepHref = (s: PathStep, base: string, moduleId: string) =>
  s.kind === 'scene' ? `${base}/intuition/${s.id}` : s.kind === 'section' ? `${base}/math-code/${s.id}` : s.kind === 'case' ? `${base}/application` : `/quiz?modules=${moduleId}&start=1`;
