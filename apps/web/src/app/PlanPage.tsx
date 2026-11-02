import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Briefcase, CalendarClock, CalendarDays, Dumbbell, Lightbulb, Repeat, Sigma, Trophy } from 'lucide-react';
import { usePlan } from '../plan/usePlan';
import { countdownLabel, parseLocalDate, type ExamStatus, type PlanDay, type PlanItem } from '../plan/studyPlan';
import { useSetting } from '../storage/progress';
import { useModuleStore } from '../modules/store';
import { cn } from '../lib/util';

export const fmtMinutes = (m: number) => (m < 60 ? `${Math.round(m)} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${Math.round(m % 60)} min` : ''}`);
const fmtDate = (d: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }) => parseLocalDate(d).toLocaleDateString(undefined, opts);
const q = encodeURIComponent;

/** The full day-by-day exam plan. */
export function PlanPage() {
  const { plan, loading } = usePlan();
  const [exams] = useSetting('exams');
  const [hours] = useSetting('studyHoursPerDay');
  const { listError } = useModuleStore();
  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-6" data-testid="plan">
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div className="mr-auto">
          <h1 className="flex items-center gap-2 text-xl font-semibold"><CalendarDays size={20} className="text-accent" /> Study plan</h1>
          <p className="text-sm text-muted">{hours} h a day · rebuilt from your progress every time you open it</p>
        </div>
        <Link to="/settings" className="btn btn-sm">Exams &amp; hours</Link>
      </div>
      {listError ? (
        <div className="card p-5 text-sm"><div className="mb-1 flex items-center gap-2 font-semibold text-bad"><AlertTriangle size={18} /> Can't reach the Qdigo server</div><p className="text-muted">The plan needs your modules to know what's left. {listError}</p></div>
      ) : !exams.length ? (
        <div className="card p-6 text-sm text-muted">No exams yet. <Link to="/settings" className="text-accent underline">Add one in Settings</Link> and Qdigo will plan your days up to it.</div>
      ) : loading ? (
        <div className="card h-40 animate-pulse" />
      ) : (
        <>
          <ExamCountdowns exams={plan.exams} />
          <ol className="mt-5 flex flex-col gap-3">
            {plan.days.map((d, i) => <DayCard key={d.date} day={d} exams={plan.exams} today={i === 0} />)}
          </ol>
        </>
      )}
    </div>
  );
}

export function ExamCountdowns({ exams, compact }: { exams: ExamStatus[]; compact?: boolean }) {
  return (
    <ul className={cn('flex flex-col', compact ? 'gap-1' : 'gap-2')} data-testid="exam-countdowns">
      {exams.map((s) => (
        <li key={s.exam.id} className={cn(compact ? 'text-sm' : 'card px-4 py-3')}>
          <div className="flex items-center gap-2">
            <CalendarClock size={compact ? 15 : 18} className="shrink-0 text-accent" />
            <span className="min-w-0 flex-1 truncate"><b>{s.exam.name}</b> <span className="text-muted">· {fmtDate(s.exam.date)}</span></span>
            <span className={cn('shrink-0 font-semibold', s.daysLeft < 0 && 'text-muted')}>{countdownLabel(s.daysLeft)}</span>
          </div>
          {!compact && s.daysLeft >= 0 && (
            <div className="mt-1 pl-7 text-xs text-muted">
              {s.remainingMinutes === 0 ? 'All lessons done: the plan is reviews and practice.' : s.lessonsDoneOn ? `${fmtMinutes(s.remainingMinutes)} of lessons left, done by ${fmtDate(s.lessonsDoneOn)}.` : `${fmtMinutes(s.remainingMinutes)} of lessons left.`}
            </div>
          )}
          {s.unscheduledMinutes > 0 && (
            <div className={cn('mt-1 flex items-start gap-1.5 text-xs text-warn', !compact && 'pl-7')} data-testid="plan-overload">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>{fmtMinutes(s.unscheduledMinutes)} won't fit before this exam.{s.neededHoursPerDay ? ` About ${s.neededHoursPerDay} h a day would cover it.` : ''}</span>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function DayCard({ day, exams, today }: { day: PlanDay; exams: ExamStatus[]; today: boolean }) {
  const examNames = day.exams.map((id) => exams.find((e) => e.exam.id === id)?.exam.name).filter(Boolean);
  return (
    <li className={cn('card p-4', today && 'ring-2 ring-accent/40')} data-testid="plan-day" data-date={day.date}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-semibold">{today ? 'Today' : fmtDate(day.date)}</span>
        {examNames.map((n) => <span key={n} className="chip border-accent/50 bg-accent/10 text-accent"><Trophy size={12} className="mr-1" /> {n}</span>)}
        <span className="ml-auto text-xs text-muted">{fmtMinutes(day.minutes)}</span>
      </div>
      <PlanItems items={day.items} exams={exams} />
    </li>
  );
}

export function PlanItems({ items, exams }: { items: PlanItem[]; exams: ExamStatus[] }) {
  if (!items.length) return <div className="text-sm text-muted">Rest day.</div>;
  const examName = (id: string) => exams.find((e) => e.exam.id === id)?.exam.name ?? '';
  return (
    <ul className="flex flex-col gap-1">
      {items.map((it, i) => {
        const [href, icon, label, sub] =
          it.kind === 'review' ? [`/review`, <Repeat size={15} />, `Review ${it.count} due card${it.count === 1 ? '' : 's'}`, it.course]
          : it.kind === 'practice' ? [`/quiz?course=${q(it.course)}&mode=weak&start=1`, <Dumbbell size={15} />, 'Practice weak spots', examName(it.examId)]
          : [it.task.href, stepIcon(it.task.step.kind), it.task.step.title, it.task.moduleTitle];
        return (
          <li key={i}>
            <Link to={href} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition hover:bg-panel2" data-testid={`plan-item-${it.kind}`}>
              <span className="text-muted">{icon}</span>
              <span className="min-w-0 flex-1 truncate"><span className="font-medium">{label}</span> <span className="text-muted">· {sub}</span></span>
              <span className="shrink-0 text-xs text-muted">{fmtMinutes(it.minutes)}</span>
              <ArrowRight size={14} className="shrink-0 text-muted" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

const stepIcon = (kind: string) => (kind === 'scene' ? <Lightbulb size={15} /> : kind === 'section' ? <Sigma size={15} /> : kind === 'case' ? <Briefcase size={15} /> : <Trophy size={15} />);
