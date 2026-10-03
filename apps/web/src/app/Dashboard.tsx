import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CalendarClock, Dumbbell, GraduationCap, PlayCircle, Repeat, Target } from 'lucide-react';
import { useModuleStore, type LoadedModule } from '../modules/store';
import { useCourses } from '../modules/courses';
import { useAllModules } from '../modules/useAll';
import { levelOf, LEVEL_COLOR, useAllProgress, useDueReviews, useMastery, useSetting } from '../storage/progress';
import { Ring } from './Ring';
import { ModuleIcon } from './icons';
import { Markdown } from '../lib/md';
import { cn, timeAgo } from '../lib/util';

export function Dashboard() {
  const store = useModuleStore();
  const { mods, loading, errors } = useAllModules();
  const { courses, courseOf } = useCourses();
  const progress = useAllProgress();
  const mastery = useMastery();
  const due = useDueReviews();
  const [last] = useSetting('lastLocation');
  const [examDate] = useSetting('examDate');
  const nav = useNavigate();
  const days = examDate ? Math.ceil((new Date(examDate).getTime() - Date.now()) / 86400000) : null;
  const weak = mastery
    .filter((m) => m.n >= 1)
    .map((m) => {
      const [mid, sid] = m.skillKey.split(':');
      const mod = mods.find((x) => x.id === mid);
      return { ...m, mid, sid, label: mod?.parsed.manifest.skills.find((s) => s.id === sid)?.label ?? sid, mod };
    })
    .filter((m) => m.mod)
    .sort((a, b) => a.score - b.score)
    .slice(0, 6)
    .map((m) => ({ ...m, course: courseOf(m.mid) ?? '' }));
  const weakCourses = [...new Set(weak.map((w) => w.course))];
  const multiCourse = courses.length > 1;
  const q = (course: string) => encodeURIComponent(course);

  if (store.listError) return (
    <div className="mx-auto max-w-xl p-10"><div className="card p-5"><div className="mb-1 flex items-center gap-2 font-semibold text-bad"><AlertTriangle size={18} /> Can't reach the Kodigo server</div><p className="text-sm text-muted">{store.listError}</p></div></div>
  );

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6">
      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <div className="card flex items-center gap-3 p-4 md:col-span-2">
          <PlayCircle className="shrink-0 text-accent" size={32} />
          <div className="min-w-0 flex-1">
            <div className="label">Resume where you left off</div>
            {last ? <div className="truncate font-semibold">{last.title ?? last.path}</div> : <div className="text-sm text-muted">Nothing yet. Pick a module below and start with its first Intuition scene.</div>}
            {last && <div className="text-xs text-muted">{timeAgo(last.at)}</div>}
          </div>
          {last && <button className="btn-primary" onClick={() => nav(last.path)}>Continue <ArrowRight size={15} /></button>}
        </div>
        <div className="card flex flex-col justify-center gap-2 p-4">
          <div className="flex items-center gap-2">
            <CalendarClock size={18} className="text-accent" />
            {days !== null ? <span className="font-semibold">{days > 0 ? `${days} day${days === 1 ? '' : 's'} to the exam` : days === 0 ? 'Exam day. Good luck!' : 'Exam date passed'}</span> : <Link to="/settings" className="text-sm text-muted underline">Set your exam date</Link>}
          </div>
          <button className="btn justify-between" onClick={() => nav('/review')}><span className="flex items-center gap-2"><Repeat size={15} /> Reviews due</span><b>{due.length}</b></button>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{multiCourse ? 'Courses' : 'Modules'}</h2>
        <button className="btn" onClick={() => nav('/quiz')}><Dumbbell size={15} /> Build a quiz</button>
      </div>
      {store.listLoaded && !store.list.length && <div className="card p-6 text-sm text-muted">No modules installed. Add one in <Link to="/admin" className="text-accent underline">Admin</Link>.</div>}
      <div className="flex flex-col gap-8">
        {courses.map((g) => {
          const loaded = g.modules.map((e) => mods.find((m) => m.id === e.id)).filter((m): m is LoadedModule => !!m);
          return (
            <section key={g.course} aria-label={`${g.course} modules`} data-testid={`course-${g.course}`}>
              <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-line pb-2">
                <h3 className="mr-auto flex items-center gap-2 font-semibold"><GraduationCap size={18} className="text-accent" /> {g.course} <span className="text-xs font-normal text-muted">{g.modules.length} module{g.modules.length === 1 ? '' : 's'}</span></h3>
                <Link to={`/quiz?course=${q(g.course)}`} className="btn btn-sm"><Dumbbell size={14} /> Quiz on {g.course}</Link>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {loading && !loaded.length && g.modules.filter((e) => !errors[e.id]).map((m) => <div key={m.id} className="card h-56 animate-pulse" />)}
                {loaded.map((mod) => <ModuleCard key={mod.id} mod={mod} progress={progress} mastery={mastery} />)}
                {g.modules.filter((e) => errors[e.id]).map((e) => (
                  <div key={e.id} className="card border-bad/40 p-4 text-sm"><div className="font-semibold text-bad">{e.id} failed to load</div><pre className="mt-1 whitespace-pre-wrap text-xs text-muted">{errors[e.id]}</pre></div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {weak.length > 0 && (
        <div className="mt-8">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold"><Target size={18} /> Weakest skills</h2>
            <div className="flex flex-wrap gap-2">
              {weakCourses.map((c) => <button key={c} className="btn" onClick={() => nav(`/quiz?course=${q(c)}&mode=weak&start=1`)}>Practice {multiCourse ? `${c} ` : ''}weak spots</button>)}
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {weak.map((w) => {
              const lvl = levelOf(w.score, w.n);
              return (
                <div key={w.skillKey} className="card flex items-center gap-3 px-3 py-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: w.mod!.parsed.manifest.color }} />
                  <span className="flex-1 text-sm"><b>{w.label}</b> <span className="text-muted">· {multiCourse ? `${w.course} · ` : ''}{w.mod!.parsed.manifest.shortTitle}</span></span>
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-line"><div className={cn('h-full', LEVEL_COLOR[lvl])} style={{ width: `${w.score * 100}%` }} /></div>
                  <span className="w-16 text-right text-xs text-muted">{lvl}</span>
                  <Link className="btn btn-sm" to={`/quiz?modules=${w.mid}&skills=${w.mid}:${w.sid}&start=1`}>Drill</Link>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ModuleCard({ mod, progress, mastery }: { mod: LoadedModule; progress: ReturnType<typeof useAllProgress>; mastery: ReturnType<typeof useMastery> }) {
  const m = mod.parsed.manifest;
  const p = progress.filter((x) => x.moduleId === mod.id);
  const scenes = mod.parsed.intuition.length || 1;
  const intuition = p.filter((x) => x.tab === 'intuition' && x.status === 'done').length / scenes;
  const math = p.filter((x) => x.tab === 'math-code').length / (mod.parsed.mathCode.length || 1);
  const decisions = mod.parsed.application.case.cells.filter((c) => c.decision).map((c) => c.id);
  const appDone = p.filter((x) => x.tab === 'application' && x.status === 'done' && (decisions.includes(x.itemId) || x.itemId === 'explain-back')).length / (decisions.length + 1);
  const skills = m.skills.map((s) => mastery.find((x) => x.skillKey === `${mod.id}:${s.id}`));
  const quiz = skills.reduce((a, s) => a + (s?.score ?? 0), 0) / (skills.length || 1);
  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="h-1.5" style={{ background: m.color }} />
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: m.color }}><ModuleIcon name={m.icon} /></div>
          <div className="min-w-0">
            <Link to={`/m/${mod.id}`} className="font-semibold hover:underline">{m.title}</Link>
            <div className="text-xs text-muted">{m.sources[0]?.sessions ? `Sessions ${m.sources[0].sessions}` : m.course} · v{m.version}</div>
          </div>
        </div>
        <Markdown text={m.summary} raw className="mt-2 line-clamp-3 text-sm text-muted" />
        <div className="mt-3 flex justify-between px-1">
          <Ring value={intuition} label="Intuition" color={m.color} />
          <Ring value={math} label="Math" color={m.color} />
          <Ring value={appDone} label="Apply" color={m.color} />
          <Ring value={quiz} label="Mastery" color="rgb(var(--good))" />
        </div>
        <div className="mt-3 flex flex-wrap gap-1" title="skill mastery">
          {m.skills.map((s, i) => {
            const sk = skills[i];
            const lvl = levelOf(sk?.score ?? 0, sk?.n ?? 0);
            return <span key={s.id} title={`${s.label}: ${lvl}`} className={cn('h-1.5 flex-1 rounded-full', LEVEL_COLOR[lvl])} />;
          })}
        </div>
        <div className="mt-4 flex gap-2">
          <Link to={`/m/${mod.id}/intuition`} className="btn-primary flex-1">Study</Link>
          <Link to={`/quiz?modules=${mod.id}&start=1`} className="btn flex-1"><Dumbbell size={14} /> Practice</Link>
        </div>
      </div>
    </div>
  );
}
