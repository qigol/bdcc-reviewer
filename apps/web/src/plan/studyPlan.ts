/**
 * Exam countdown study plan (MVP plan §13): spread the remaining path steps of each exam's modules over the
 * days before it, within a daily time budget, with SRS reviews first and practice before each exam.
 * Pure: no React or Dexie. The plan is recomputed from live progress every time, never stored.
 */
import type { PathStep } from '@kodigo/schema';

// ------------------------------------------------------------ dates (local calendar days, 'YYYY-MM-DD')
// `new Date('YYYY-MM-DD')` is UTC midnight, which is the previous evening west of UTC and drifts a day east of it.
const DAY = 86400000;
const parts = (d: string) => d.split('-').map(Number) as [number, number, number];
export const parseLocalDate = (d: string) => { const [y, m, dd] = parts(d); return new Date(y, m - 1, dd); };
export const toYmd = (t: Date | number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
/** whole calendar days from a to b (negative if b is earlier); DST-proof */
export const daysBetween = (a: string, b: string) => { const [y1, m1, d1] = parts(a); const [y2, m2, d2] = parts(b); return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DAY); };
export const addDays = (d: string, n: number) => { const [y, m, dd] = parts(d); return toYmd(new Date(y, m - 1, dd + n)); };

export function countdownLabel(days: number) {
  return days > 1 ? `${days} days to go` : days === 1 ? 'Tomorrow' : days === 0 ? "Exam day. Q's got your Qs!" : 'Passed';
}

// ------------------------------------------------------------ time estimates (minutes); tune here
export const MINUTES = {
  sceneBase: 4, perBeat: 1.5,
  sectionBase: 8, perDerivationStep: 2, perTryIt: 3,
  caseBase: 8, perDecision: 3,
  mastery: 15,
  perReview: 1.5,
  /** smallest leftover worth a practice block */
  minPractice: 10,
  /** at most this share of a day goes to reviews; the rest roll over */
  reviewShare: 0.4,
};

export interface StepSize { beats?: number; derivationSteps?: number; decisions?: number }
export function estimateMinutes(step: PathStep, size: StepSize = {}): number {
  const m = MINUTES;
  const raw =
    step.kind === 'scene' ? m.sceneBase + m.perBeat * (size.beats ?? 4)
    : step.kind === 'section' ? m.sectionBase + m.perDerivationStep * (size.derivationSteps ?? 3) + m.perTryIt * step.tryIt.length
    : step.kind === 'case' ? m.caseBase + m.perDecision * (size.decisions ?? 3)
    : m.mastery;
  return Math.round(raw);
}

// ------------------------------------------------------------ planning
export interface PlanExam { id: string; name: string; course: string; date: string }
export interface PlanTask { moduleId: string; moduleTitle: string; step: PathStep; minutes: number; href: string }
export type PlanItem =
  | { kind: 'lesson'; examId: string; course: string; task: PlanTask; minutes: number }
  | { kind: 'review'; course: string; count: number; minutes: number }
  | { kind: 'practice'; examId: string; course: string; minutes: number };
export interface PlanDay { date: string; items: PlanItem[]; minutes: number; exams: string[] }
export interface ExamStatus {
  exam: PlanExam;
  daysLeft: number;
  /** lesson minutes still to do for this exam (including what the plan schedules) */
  remainingMinutes: number;
  /** lesson minutes that don't fit before the exam at the current hours per day */
  unscheduledMinutes: number;
  /** the day the plan finishes this exam's lessons (undefined if none are left) */
  lessonsDoneOn?: string;
  /** daily hours that would fit everything due by this exam, when the current budget doesn't */
  neededHoursPerDay?: number;
}
export interface PlanInput {
  today: string;
  hoursPerDay: number;
  /** each exam with its remaining steps in study order; a module covered by several exams belongs to the earliest */
  exams: { exam: PlanExam; tasks: PlanTask[] }[];
  /** projected SRS reviews per day and course (overdue ones counted on today) */
  reviews: Record<string, Record<string, number>>;
}
export interface Plan { days: PlanDay[]; exams: ExamStatus[] }


/**
 * Day by day until the last exam: reviews first (capped, overflow rolls over), then lessons, always taking the next
 * step of the exam with the most remaining minutes per day left before its lesson deadline (so a big later exam isn't
 * starved by a small earlier one), then practice for the nearest exam with leftover time. Lessons aim to finish two
 * days before an exam (one if it's that close) so the day before is practice; an overloaded exam keeps getting lessons
 * that day. Exam day gets a warm-up and no new material for that exam.
 */
export function buildPlan(input: PlanInput): Plan {
  const { days, state } = schedule(input);
  const { today } = input;
  const exams: ExamStatus[] = input.exams
    .map((e) => {
      const s = state.find((x) => x.exam.id === e.exam.id);
      const daysLeft = daysBetween(today, e.exam.date);
      if (!s) return { exam: e.exam, daysLeft, remainingMinutes: 0, unscheduledMinutes: 0 };
      const unscheduledMinutes = s.queue.reduce((a, t) => a + t.minutes, 0);
      const st: ExamStatus = { exam: e.exam, daysLeft, remainingMinutes: s.total, unscheduledMinutes, lessonsDoneOn: s.queue.length ? undefined : s.doneOn };
      if (unscheduledMinutes > 0) st.neededHoursPerDay = hoursToFit(input, e.exam.id);
      return st;
    })
    .sort((a, b) => a.exam.date.localeCompare(b.exam.date));
  return { days, exams };
}

/** The fewest hours a day (in half hours, up to 16) at which the plan fits every lesson for this exam; undefined if none does. */
function hoursToFit(input: PlanInput, examId: string): number | undefined {
  const fits = (h: number) => !schedule({ ...input, hoursPerDay: h }).state.find((s) => s.exam.id === examId)?.queue.length;
  let lo = Math.floor(input.hoursPerDay * 2) + 1;
  let hi = 32;
  if (lo > hi || !fits(hi / 2)) return undefined;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (fits(mid / 2)) hi = mid;
    else lo = mid + 1;
  }
  return lo / 2;
}

function schedule(input: PlanInput) {
  const { today } = input;
  const budget = Math.max(0, input.hoursPerDay) * 60;
  const upcoming = input.exams.filter((e) => daysBetween(today, e.exam.date) >= 0).sort((a, b) => a.exam.date.localeCompare(b.exam.date));
  const state = upcoming.map((e) => {
    const left = daysBetween(today, e.exam.date);
    const deadline = left >= 3 ? addDays(e.exam.date, -2) : addDays(e.exam.date, -1);
    return { ...e, left, deadline, queue: [...e.tasks], total: e.tasks.reduce((a, t) => a + t.minutes, 0), doneOn: undefined as string | undefined };
  });
  const days: PlanDay[] = [];
  const last = upcoming.at(-1)?.exam.date;
  const horizon = last ? Math.min(daysBetween(today, last), 365) : -1;
  let carry: Record<string, number> = {};
  const practice = (items: PlanItem[], s: (typeof state)[number], minutes: number) => {
    const existing = items.find((x): x is Extract<PlanItem, { kind: 'practice' }> => x.kind === 'practice' && x.examId === s.exam.id);
    if (existing) existing.minutes += minutes;
    else items.push({ kind: 'practice', examId: s.exam.id, course: s.exam.course, minutes });
  };

  for (let i = 0; i <= horizon; i++) {
    const date = addDays(today, i);
    const items: PlanItem[] = [];
    let free = budget;

    // 1. reviews (carry-over first, then today's)
    const due: Record<string, number> = { ...carry };
    for (const [c, n] of Object.entries(input.reviews[date] ?? {})) due[c] = (due[c] ?? 0) + n;
    if (i === 0) for (const [d, byCourse] of Object.entries(input.reviews)) if (d < today) for (const [c, n] of Object.entries(byCourse)) due[c] = (due[c] ?? 0) + n;
    carry = {};
    let reviewRoom = budget * MINUTES.reviewShare;
    for (const [course, n] of Object.entries(due)) {
      const fit = Math.min(n, Math.floor(reviewRoom / MINUTES.perReview));
      if (fit > 0) {
        const minutes = Math.round(fit * MINUTES.perReview);
        items.push({ kind: 'review', course, count: fit, minutes });
        reviewRoom -= minutes;
        free -= minutes;
      }
      if (n > fit) carry[course] = n - fit;
    }

    // 2. reserved practice: a warm-up on exam day, a longer block the day before
    for (const s of state) {
      if (free <= 0) break;
      const minutes = date === s.exam.date ? Math.min(free, 30) : s.left >= 3 && date === addDays(s.exam.date, -1) ? Math.min(free, Math.max(60, budget / 2)) : 0;
      if (minutes > 0) { practice(items, s, Math.round(minutes)); free -= Math.round(minutes); }
    }

    // 3. lessons, most pressing exam first (past its deadline only when overloaded, and never on exam day)
    for (;;) {
      const open = state.filter((s) => s.queue.length && date < s.exam.date);
      if (!open.length) break;
      const pressure = (s: (typeof open)[number]) => s.queue.reduce((a, t) => a + t.minutes, 0) / (Math.max(0, daysBetween(date, s.deadline)) + 1);
      open.sort((a, b) => pressure(b) - pressure(a) || a.exam.date.localeCompare(b.exam.date));
      const nothingYet = !items.some((x) => x.kind === 'lesson');
      // an oversized step still gets a day of its own
      const pick = open.find((s) => s.queue[0].minutes <= free || (nothingYet && free >= budget * 0.5));
      if (!pick) break;
      const task = pick.queue.shift()!;
      items.push({ kind: 'lesson', examId: pick.exam.id, course: pick.exam.course, task, minutes: task.minutes });
      free -= task.minutes;
      if (!pick.queue.length) pick.doneOn = date;
      if (free <= 0) break;
    }

    // 4. leftover: practice for the nearest exam still ahead
    const next = state.find((s) => date < s.exam.date);
    if (next && free >= MINUTES.minPractice) {
      practice(items, next, Math.round(free));
      free = 0;
    }

    days.push({ date, items, minutes: items.reduce((a, x) => a + x.minutes, 0), exams: state.filter((s) => s.exam.date === date).map((s) => s.exam.id) });
  }
  return { days, state };
}
