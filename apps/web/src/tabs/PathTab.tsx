import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpenCheck, Briefcase, Check, Lightbulb, NotebookPen, PenLine, Sigma, Target, Trophy } from 'lucide-react';
import { learningPath, workbenchTabLabel, type PathStep } from '@kodigo/schema';
import { useModuleCtx } from './ModulePage';
import { useAttempts, useMastery, useModuleProgress } from '../storage/progress';
import { cn } from '../lib/util';

type Status = 'done' | 'started' | 'todo';

/** The guided path: objectives, then every lesson step in teaching order with its status. */
export function PathTab() {
  const { mod, base } = useModuleCtx();
  const m = mod.parsed.manifest;
  const progress = useModuleProgress(mod.preview ? undefined : mod.id);
  const attempts = useAttempts((a) => a.moduleId === mod.id);
  const mastery = useMastery();
  const steps = useMemo(() => learningPath(mod.parsed), [mod]);
  const journal = m.workbench === 'journal';
  const terms = useMemo(() => Object.fromEntries(mod.parsed.glossary.map((t) => [t.id, t.term])), [mod]);
  const skillScore = (id: string) => mastery.find((x) => x.skillKey === `${mod.id}:${id}`)?.score ?? 0;
  const moduleMastery = m.skills.length ? m.skills.reduce((a, s) => a + skillScore(s.id), 0) / m.skills.length : 0;

  const statusOf = (s: PathStep): Status => {
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
    return moduleMastery >= 0.75 ? 'done' : attempts.some((a) => a.mode !== 'lesson' && a.mode !== 'predict') ? 'started' : 'todo';
  };
  const hrefOf = (s: PathStep) =>
    s.kind === 'scene' ? `${base}/intuition/${s.id}` : s.kind === 'section' ? `${base}/math-code/${s.id}` : s.kind === 'case' ? `${base}/application` : `/quiz?modules=${m.id}&start=1`;
  const statuses = steps.map(statusOf);
  const done = statuses.filter((x) => x === 'done').length;
  const nextIdx = statuses.findIndex((x) => x !== 'done');
  const next = nextIdx >= 0 ? steps[nextIdx] : undefined;

  const icon = (s: PathStep) => {
    if (s.kind === 'scene') return <Lightbulb size={16} />;
    if (s.kind === 'section') return journal ? <NotebookPen size={16} /> : <Sigma size={16} />;
    if (s.kind === 'case') return <Briefcase size={16} />;
    return <Trophy size={16} />;
  };
  const kindLabel = (s: PathStep) => (s.kind === 'scene' ? 'Intuition' : s.kind === 'section' ? workbenchTabLabel(m) : s.kind === 'case' ? 'Application' : 'Quiz');

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-6" data-testid="path">
      <div className="card p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="label">Your path</div>
            <h2 className="text-xl font-semibold">{m.title}</h2>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-2 w-48 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full transition-all" style={{ width: `${(done / steps.length) * 100}%`, background: m.color ?? 'rgb(var(--accent))' }} /></div>
              <span className="text-xs text-muted">{done} of {steps.length} steps</span>
            </div>
          </div>
          {next ? (
            <Link to={hrefOf(next)} className="btn-primary" data-testid="path-continue">{done ? 'Continue' : 'Start'}: {next.title} <ArrowRight size={15} /></Link>
          ) : (
            <span className="chip border-good/50 bg-good/10 text-good"><Check size={12} className="mr-1" /> Path complete</span>
          )}
        </div>
        {m.objectives?.length ? (
          <div className="mt-4 border-t border-line pt-3" data-testid="objectives">
            <div className="label mb-2 flex items-center gap-1"><Target size={13} /> By the end you can</div>
            <ul className="flex flex-col gap-1.5">
              {m.objectives.map((o) => {
                const sk = o.skills ?? [];
                const score = sk.length ? sk.reduce((a, s) => a + skillScore(s), 0) / sk.length : 0;
                return (
                  <li key={o.id} className="flex items-center gap-3 text-sm">
                    <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white', score >= 0.75 ? 'bg-good' : 'bg-line')}>{score >= 0.75 && <Check size={12} />}</span>
                    <span className="flex-1">{o.text}</span>
                    {sk.length > 0 && <span className="w-24 shrink-0"><span className="block h-1.5 overflow-hidden rounded-full bg-line"><span className="block h-full bg-good" style={{ width: `${Math.round(score * 100)}%` }} /></span></span>}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>

      <ol className="relative mt-5 flex flex-col gap-2 border-l-2 border-line pl-6">
        {steps.map((s, i) => {
          const st = statuses[i];
          return (
            <li key={`${s.kind}:${s.id}`} className="relative" data-step={`${s.kind}:${s.id}`} data-status={st}>
              <span className={cn('absolute -left-[35px] top-3 flex h-6 w-6 items-center justify-center rounded-full border-2 bg-panel', st === 'done' ? 'border-good bg-good text-white' : i === nextIdx ? 'border-accent text-accent' : 'border-line text-muted')}>
                {st === 'done' ? <Check size={13} /> : <span className="text-[10px] font-bold">{i + 1}</span>}
              </span>
              <Link to={hrefOf(s)} className={cn('card flex items-start gap-3 px-4 py-3 transition hover:border-accent/50', i === nextIdx && 'ring-2 ring-accent/40')}>
                <span className="mt-0.5 text-muted">{icon(s)}</span>
                <span className="min-w-0 flex-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{kindLabel(s)}{st === 'started' ? ' · in progress' : ''}</span>
                  <span className="block font-medium">{s.title}</span>
                  {s.kind === 'scene' && s.terms.length > 0 && (
                    <span className="mt-1 flex flex-wrap gap-1"><BookOpenCheck size={13} className="mt-0.5 text-muted" />{s.terms.map((t) => <span key={t} className="chip">{terms[t] ?? t}</span>)}</span>
                  )}
                  {s.kind === 'section' && s.tryIt.length > 0 && <span className="mt-1 flex items-center gap-1 text-xs text-muted"><PenLine size={12} /> {s.tryIt.length} practice question{s.tryIt.length > 1 ? 's' : ''} at the end</span>}
                  {s.kind === 'mastery' && <span className="mt-1 block text-xs text-muted">Mixed practice on every skill · mastery {Math.round(moduleMastery * 100)}% (aim for 75%)</span>}
                </span>
                <ArrowRight size={15} className="mt-1 text-muted" />
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
