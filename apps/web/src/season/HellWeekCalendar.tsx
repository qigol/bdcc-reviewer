import { Link } from 'react-router-dom';
import { CalendarDays, Flame } from 'lucide-react';
import { useCourses } from '../modules/courses';
import { useSetting } from '../storage/progress';
import { parseLocalDate } from '../plan/studyPlan';
import { cn } from '../lib/util';
import { calendarExams, calendarWeeks, type CalendarExam } from './calendar';
import { DEADLINES } from './deadlines';
import { useSeasonStatus } from './useSeason';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const fmt = (d: string, o: Intl.DateTimeFormatOptions) => parseLocalDate(d).toLocaleDateString(undefined, o);
const describe = (e: CalendarExam) => [e.name, e.time, e.note].filter(Boolean).join(', ');
const origin = (e: CalendarExam) => (e.mine ? 'from your Settings' : e.source === 'deadline' ? 'deadline' : 'syllabus date');

/** Hell Week, day by day: every exam and deadline in the season (syllabus dates, the fixed deadline list, your own from Settings). */
export function HellWeekCalendar() {
  const status = useSeasonStatus();
  const { courses } = useCourses();
  const [mine] = useSetting('exams');
  if (status?.season !== 'hellweek' || !status.range) return null;
  const { start, end } = status.range;
  const today = status.today;
  const exams = calendarExams(courses, mine, DEADLINES).filter((e) => e.date >= start && e.date <= end);
  const weeks = calendarWeeks(start, end, exams);
  const next = exams.find((e) => e.date >= today);
  return (
    <section className="card mb-6 p-4" aria-label="Hell Week calendar" data-testid="hellweek-calendar">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="flex items-center gap-2 font-semibold"><CalendarDays size={17} className="text-accent" /> Hell Week</h2>
        <span className="text-sm text-muted">{fmt(start, { month: 'short', day: 'numeric' })} – {fmt(end, { month: 'short', day: 'numeric' })} · {exams.length} deadline{exams.length === 1 ? '' : 's'}</span>
        {next && <span className="text-sm">Next: <b>{next.name}</b>, {next.date === today ? 'today' : fmt(next.date, { weekday: 'short', month: 'short', day: 'numeric' })}</span>}
        <Link to="/settings" className="ml-auto text-xs text-muted underline">Edit your exams</Link>
      </div>
      <div role="table" aria-label="Days of Hell Week" className="grid grid-cols-7 gap-1 text-xs">
        <div role="row" className="contents">
          {DOW.map((d) => <div key={d} role="columnheader" className="pb-1 text-center font-medium text-muted">{d}</div>)}
        </div>
        {weeks.map((w) => (
          <div key={w[0].date} role="row" className="contents">
            {w.map((day) => {
              const past = day.date < today;
              const isToday = day.date === today;
              const dayNum = parseLocalDate(day.date).getDate();
              const label = `${fmt(day.date, { weekday: 'long', month: 'long', day: 'numeric' })}${day.exams.length ? `: ${day.exams.map(describe).join('; ')}` : ''}`;
              return (
                <div key={day.date} role="cell" aria-label={day.inRange ? label : undefined}
                  className={cn('flex min-h-[3.75rem] min-w-0 flex-col gap-0.5 rounded-md border p-1',
                    !day.inRange ? 'border-transparent opacity-30' : day.exams.length ? 'border-accent/60 bg-accent/10' : 'border-line bg-panel2/50',
                    past && day.inRange && 'opacity-50',
                    isToday && 'ring-2 ring-accent')}>
                  <span className={cn('flex items-center justify-between', isToday && 'font-bold text-accent')}>
                    {dayNum === 1 || day.date === start ? fmt(day.date, { month: 'short', day: 'numeric' }) : dayNum}
                    {day.exams.length > 0 && <Flame size={12} className="text-accent" aria-hidden />}
                  </span>
                  {day.exams.map((e) => (
                    <span key={e.key} className="truncate rounded bg-accent px-0.5 py-px text-[9px] font-semibold leading-tight tracking-tight text-white sm:px-1 sm:text-[10px] sm:tracking-normal" title={`${describe(e)} (${origin(e)})`}>
                      {e.course}<span className="hidden font-normal sm:inline"> {e.name.slice(e.course.length).trim()}</span>
                    </span>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
