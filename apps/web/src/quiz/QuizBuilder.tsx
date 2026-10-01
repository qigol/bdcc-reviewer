import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Dumbbell, Play, RotateCw } from 'lucide-react';
import { useAllModules } from '../modules/useAll';
import { candidates, latestUnfinished, MODE_LABEL, newSession, pickItems, QTYPE_LABEL, QTYPES, type Mode, type SessionConfig } from './session';
import { db } from '../storage/db';
import { cn } from '../lib/util';

export function QuizBuilder() {
  const { mods, loading } = useAllModules();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [cfg, setCfg] = useState<SessionConfig>(() => ({
    modules: params.get('modules')?.split(',').filter(Boolean) ?? [],
    types: [],
    skills: params.get('skills')?.split(',').filter(Boolean) ?? [],
    difficulties: [],
    count: Number(params.get('count') ?? 10),
    mode: (params.get('mode') as Mode) ?? 'practice',
    glossary: true,
    timeLimitMin: 20,
  }));
  const [msg, setMsg] = useState<string | null>(null);
  const [unfinished] = useState(() => latestUnfinished());
  useEffect(() => {
    if (!loading && !cfg.modules.length && mods.length) setCfg((c) => ({ ...c, modules: mods.map((m) => m.id) }));
  }, [loading, mods.length]);
  const cands = useMemo(() => candidates(mods, cfg), [mods, cfg]);
  const set = <K extends keyof SessionConfig>(k: K, v: SessionConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));
  const toggle = <K extends 'modules' | 'types' | 'skills' | 'difficulties'>(k: K, v: any) => setCfg((c) => ({ ...c, [k]: (c[k] as any[]).includes(v) ? (c[k] as any[]).filter((x) => x !== v) : [...(c[k] as any[]), v] }));

  const start = async (override?: Partial<SessionConfig>) => {
    const c = { ...cfg, ...override };
    if (!c.modules.length) c.modules = mods.map((m) => m.id);
    const list = candidates(mods, c);
    let items;
    if (c.mode === 'review') {
      const due = await db.srs.where('due').belowOrEqual(Date.now()).toArray();
      const keys = new Set(due.map((d) => d.templateId));
      const pool = list.filter((x) => keys.has(`${x.moduleId}/${x.templateId}`));
      if (!pool.length) { setMsg('Nothing is due for review right now. Practice something first, or try Weak spots.'); return; }
      items = pickItems(pool, Math.min(c.count, pool.length), { mode: 'practice' });
    } else if (c.mode === 'weak') {
      const mastery = Object.fromEntries((await db.mastery.toArray()).map((m) => [m.skillKey, m]));
      items = pickItems(list, c.count, { mode: 'weak', weight: (x) => { const ms = x.skills.map((s) => mastery[`${x.moduleId}:${s}`]); return ms.length ? Math.max(...ms.map((m) => (m ? (m.n < 3 ? 0.8 : 1 - m.score) : 1))) : 0.5; } });
    } else items = pickItems(list, c.count, { mode: c.mode });
    if (!items.length) { setMsg('No questions match these filters.'); return; }
    const s = newSession(c.mode, items, { timeLimitSec: c.mode === 'exam' ? (c.timeLimitMin ?? 20) * 60 : undefined });
    nav(`/quiz/run/${s.id}`);
  };

  const autostarted = useRef(false);
  useEffect(() => {
    if (params.get('start') && !loading && mods.length && !autostarted.current) { autostarted.current = true; start(); }
  }, [loading, mods.length]);

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-6">
      <h1 className="mb-1 flex items-center gap-2 text-xl font-semibold"><Dumbbell size={20} /> Build a quiz</h1>
      <p className="mb-5 text-sm text-muted">Every question is freshly generated: the numbers change each time. Exam-style hand calculations walk you through the lecture's procedure step by step.</p>
      {unfinished && !params.get('start') && (() => {
        const done = unfinished.run.slots.filter((x) => x.graded).length;
        return (
          <div className="card mb-4 flex flex-wrap items-center gap-3 border-accent/50 bg-accent/5 px-4 py-3 text-sm" data-testid="resume-quiz">
            <RotateCw size={16} className="text-accent" />
            <span className="flex-1">You have an unfinished quiz ({done} of {unfinished.session.items.length} answered).</span>
            <button className="btn-primary" onClick={() => nav(`/quiz/run/${unfinished.session.id}`)}>Resume</button>
          </div>
        );
      })()}
      <div className="card divide-y divide-line">
        <Field label="Modules">
          <div className="flex flex-wrap gap-1.5">
            {mods.map((m) => <Toggle key={m.id} on={cfg.modules.includes(m.id)} onClick={() => toggle('modules', m.id)} color={m.parsed.manifest.color}>{m.parsed.manifest.shortTitle}</Toggle>)}
          </div>
        </Field>
        <Field label="Mode">
          <select className="input w-full max-w-md" value={cfg.mode} onChange={(e) => set('mode', e.target.value as Mode)}>
            {(['practice', 'exam', 'review', 'weak', 'interleaved'] as Mode[]).map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
          </select>
          {cfg.mode === 'exam' && <label className="mt-2 flex items-center gap-2 text-sm">Time limit <input type="number" min={1} max={180} className="input w-20" value={cfg.timeLimitMin} onChange={(e) => set('timeLimitMin', Number(e.target.value))} /> minutes</label>}
        </Field>
        <Field label="Question types" hint="none selected = all">
          <div className="flex flex-wrap gap-1.5">{QTYPES.map((t) => <Toggle key={t} on={cfg.types.includes(t)} onClick={() => toggle('types', t)}>{QTYPE_LABEL[t]}</Toggle>)}</div>
          <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={cfg.glossary} onChange={(e) => set('glossary', e.target.checked)} className="accent-[rgb(var(--accent))]" /> Include auto-generated glossary questions</label>
        </Field>
        <Field label="Difficulty" hint="none selected = all">
          <div className="flex gap-1.5">{[1, 2, 3].map((d) => <Toggle key={d} on={cfg.difficulties.includes(d)} onClick={() => toggle('difficulties', d)}>{['', 'Warm-up', 'Standard', 'Exam-hard'][d]}</Toggle>)}</div>
        </Field>
        <Field label="Skills" hint="none selected = all">
          <div className="flex flex-col gap-2">
            {mods.filter((m) => cfg.modules.includes(m.id)).map((m) => (
              <div key={m.id} className="flex flex-wrap items-center gap-1.5">
                <span className="w-14 text-xs font-semibold text-muted">{m.parsed.manifest.shortTitle}</span>
                {m.parsed.manifest.skills.map((s) => <Toggle key={s.id} small on={cfg.skills.includes(`${m.id}:${s.id}`)} onClick={() => toggle('skills', `${m.id}:${s.id}`)}>{s.label}</Toggle>)}
              </div>
            ))}
          </div>
        </Field>
        <Field label="Questions">
          <div className="flex items-center gap-3">
            <input type="range" min={3} max={40} value={cfg.count} onChange={(e) => set('count', Number(e.target.value))} className="w-56 accent-[rgb(var(--accent))]" />
            <b className="w-8">{cfg.count}</b>
            <span className="text-xs text-muted">{cands.length} templates match</span>
          </div>
        </Field>
      </div>
      {msg && <div className="mt-3 rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn">{msg}</div>}
      <div className="mt-4 flex justify-end">
        <button className="btn-primary px-5 py-2" onClick={() => start()} disabled={loading || !cands.length} data-testid="start-quiz"><Play size={16} /> Start</button>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 px-4 py-3 sm:grid-cols-[140px_1fr]">
      <div className="text-sm font-medium">{label}{hint && <div className="text-[11px] font-normal text-muted">{hint}</div>}</div>
      <div>{children}</div>
    </div>
  );
}
function Toggle({ on, onClick, children, color, small }: { on: boolean; onClick: () => void; children: React.ReactNode; color?: string; small?: boolean }) {
  return (
    <button onClick={onClick} aria-pressed={on} className={cn('rounded-full border transition', small ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm', on ? 'border-accent bg-accent/10 font-semibold text-accent' : 'border-line text-muted hover:text-ink')} style={on && color ? { borderColor: color, color } : undefined}>
      {children}
    </button>
  );
}
