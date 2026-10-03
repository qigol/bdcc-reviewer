import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Repeat, RotateCcw } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../storage/db';
import { useModuleStore } from '../modules/store';
import { splitByCourse, useCourses } from '../modules/courses';
import { newSession, randomSeed, QTYPE_LABEL } from './session';
import { timeAgo } from '../lib/util';

export function ReviewPage() {
  const nav = useNavigate();
  const { list } = useModuleStore();
  const { courseOf } = useCourses();
  const srs = useLiveQuery(() => db.srs.orderBy('due').toArray(), []) ?? [];
  const attempts = useLiveQuery(() => db.attempts.orderBy('at').reverse().limit(500).toArray(), []) ?? [];
  const now = Date.now();
  const due = srs.filter((s) => s.due <= now);
  const upcoming = srs.filter((s) => s.due > now).slice(0, 8);
  const mistakes = useMemo(() => {
    const seen = new Map<string, (typeof attempts)[number]>();
    for (const a of attempts) {
      if (a.mode === 'predict' || a.score >= 1) continue;
      if (!seen.has(a.key)) seen.set(a.key, a);
    }
    // drop mistakes that were later answered correctly
    const latestByKey = new Map<string, number>();
    for (const a of attempts) if (!latestByKey.has(a.key) && a.mode !== 'predict') latestByKey.set(a.key, a.score);
    return [...seen.values()].filter((a) => (latestByKey.get(a.key) ?? 0) < 1);
  }, [attempts]);
  const title = (moduleId: string) => list.find((m) => m.id === moduleId)?.shortTitle ?? moduleId;
  // quizzes are course-based, so due reviews and mistakes are grouped per course (modules that are gone are skipped)
  const known = (moduleId: string) => !!courseOf(moduleId);
  const dueByCourse = splitByCourse(due.filter((d) => known(d.moduleId)), courseOf);
  const mistakesByCourse = splitByCourse(mistakes.filter((a) => known(a.moduleId)), courseOf);
  const many = new Set([...dueByCourse, ...mistakesByCourse].map((g) => g.course)).size > 1;
  const retry = (course: string, items: { moduleId: string; templateId: string }[]) => {
    const s = newSession('retry', course, items.map((i) => ({ moduleId: i.moduleId, templateId: i.templateId, seed: randomSeed() })), courseOf, { title: course });
    nav(`/quiz/run/${s.id}`);
  };
  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-6">
      <h1 className="mb-4 flex items-center gap-2 text-xl font-semibold"><Repeat size={20} /> Review</h1>
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <div className="flex-1">
          <div className="font-semibold">{due.length} question template{due.length === 1 ? '' : 's'} due</div>
          <div className="text-sm text-muted">Spaced repetition over question templates: since the numbers change, you re-solve rather than recall.</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!dueByCourse.length && <button className="btn-primary" disabled>Start review</button>}
          {dueByCourse.map((g) => (
            <button key={g.course} className="btn-primary" onClick={() => nav(`/quiz?course=${encodeURIComponent(g.course)}&mode=review&count=${Math.min(20, g.items.length)}&start=1`)}>
              Start {many || dueByCourse.length > 1 ? `${g.course} ` : ''}review{dueByCourse.length > 1 ? ` (${g.items.length})` : ''}
            </button>
          ))}
        </div>
      </div>
      {upcoming.length > 0 && <div className="mt-2 text-xs text-muted">Next up: {upcoming.map((u) => `${u.templateId.split('/')[1]} (${new Date(u.due).toLocaleDateString()})`).join(' · ')}</div>}

      <div className="mb-2 mt-8 flex items-center justify-between">
        <h2 className="font-semibold">Mistake journal</h2>
        <div className="flex flex-wrap gap-2">
          {mistakesByCourse.map((g) => (
            <button key={g.course} className="btn" onClick={() => retry(g.course, g.items.slice(0, 20))}><RotateCcw size={15} /> Retry all{many ? ` ${g.course}` : ''} with new numbers</button>
          ))}
        </div>
      </div>
      {!mistakes.length ? <div className="card p-5 text-sm text-muted">No open mistakes. Every wrong answer lands here until you get that question type right.</div> : (
        <div className="card divide-y divide-line">
          {mistakes.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm">
              <span className="chip">{many ? `${courseOf(a.moduleId) ?? '?'} · ` : ''}{title(a.moduleId)}</span>
              <span className="font-medium">{a.templateId}</span>
              <span className="text-xs text-muted">{QTYPE_LABEL[a.type] ?? a.type} · {Math.round(a.score * 100)}% · {timeAgo(a.at)}</span>
              <button className="btn btn-sm ml-auto" disabled={!known(a.moduleId)} onClick={() => retry(courseOf(a.moduleId)!, [a])}><RotateCcw size={13} /> Retry with new numbers</button>
            </div>
          ))}
        </div>
      )}
      <p className="mt-6 text-xs text-muted">Progress is stored in this browser. <Link to="/settings" className="underline">Back it up</Link>.</p>
    </div>
  );
}
