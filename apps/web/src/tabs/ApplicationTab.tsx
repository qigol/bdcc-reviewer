import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Link2, Server, Scale, X } from 'lucide-react';
import type { Cell } from '@kodigo/schema';
import { useModuleCtx } from './ModulePage';
import { StageProvider, Stage } from '../engine/Stage';
import { Markdown } from '../lib/md';
import { CodeView } from '../widgets/CodeView';
import { cn } from '../lib/util';
import { markProgress, setSetting, useModuleProgress } from '../storage/progress';
import { ExplainBack } from './IntuitionTab';
import { useModuleStore } from '../modules/store';

export function ApplicationTab() {
  const { mod, base } = useModuleCtx();
  const app = mod.parsed.application;
  const c = app.case;
  const [state, setStateObj] = useState<Record<string, any>>(() => structuredClone(c.state ?? {}));
  const setState = (k: string, v: any) => setStateObj((s) => ({ ...s, [k]: v }));
  const progress = useModuleProgress(mod.preview ? undefined : mod.id);
  const answered = new Set(progress.filter((p) => p.tab === 'application' && p.status === 'done').map((p) => p.itemId));
  const store = useModuleStore();
  const [rubric, setRubric] = useState<Record<number, boolean>>({});
  useEffect(() => {
    if (mod.preview) return;
    markProgress(mod.id, 'application', 'case', { moduleVersion: mod.version });
    setSetting('lastLocation', { moduleId: mod.id, tab: 'application', path: `${base}/application`, title: `${mod.parsed.manifest.shortTitle} · ${c.title}`, at: Date.now() });
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-5">
      <Markdown text={app.intro} className="mb-4 text-[15px] text-muted" />
      <StageProvider mod={mod} spec={{ data: c.data, derive: c.derive }} state={state} setState={setState}>
        <div className="flex flex-col gap-5">
          <div className="card border-l-4 p-5" style={{ borderLeftColor: mod.parsed.manifest.color }}>
            <div className="label">Case study</div>
            <h2 className="mb-1 text-xl font-semibold">{c.title}</h2>
            <Markdown text={c.story} />
          </div>
          {c.cells.map((cell, i) => (
            <CellView key={cell.id} cell={cell} index={i} answered={answered.has(cell.id)} onAnswered={() => !mod.preview && markProgress(mod.id, 'application', cell.id, { status: 'done', moduleVersion: mod.version })} />
          ))}
        </div>
      </StageProvider>

      {app.atScale && (
        <section className="mt-8">
          <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold"><Server size={18} /> {app.atScale.title}</h3>
          <div className="card p-4">
            <Markdown text={app.atScale.body} />
            <div className="mt-3 grid gap-3">
              {app.atScale.code?.map((cd, i) => <CodeView key={i} source={cd.source} lang={cd.lang ?? 'python'} title={cd.title} />)}
            </div>
          </div>
        </section>
      )}

      {app.tradeoffs && (
        <section className="mt-8">
          <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold"><Scale size={18} /> {app.tradeoffs.title}</h3>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-panel2">{app.tradeoffs.columns.map((h) => <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>)}</tr></thead>
              <tbody>{app.tradeoffs.rows.map((r, i) => <tr key={i} className="border-t border-line">{r.map((cell, j) => <td key={j} className={cn('px-3 py-2 align-top', j === 0 && 'font-medium')}><Markdown text={cell} raw /></td>)}</tr>)}</tbody>
            </table>
          </div>
        </section>
      )}

      {!!app.connections?.length && (
        <section className="mt-8">
          <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold"><Link2 size={18} /> Connections</h3>
          <div className="grid gap-2 md:grid-cols-2">
            {app.connections.map((cn_) => {
              const other = store.list.find((m) => m.id === cn_.module);
              return (
                <div key={cn_.module} className="card p-3">
                  {other ? <Link to={`/m/${other.id}/intuition`} className="font-semibold text-accent underline">{other.title}</Link> : <span className="font-semibold">{cn_.module} <span className="text-xs text-muted">(not installed)</span></span>}
                  <Markdown text={cn_.note} raw className="mt-1 text-sm" />
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-8">
        <div className="card p-5">
          <h3 className="text-lg font-semibold">Explain it back</h3>
          <Markdown text={app.explainBack.prompt} raw className="mt-1" />
          <div className="mt-2 flex flex-col gap-1">
            {app.explainBack.rubric.map((r, i) => (
              <label key={i} className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1 accent-[rgb(var(--good))]" checked={!!rubric[i]} onChange={(e) => setRubric({ ...rubric, [i]: e.target.checked })} />
                <Markdown text={r} inline raw />
              </label>
            ))}
          </div>
          <ExplainBack moduleId={mod.id} anchor="application:explain-back" prompt="Your explanation" disabled={!!mod.preview} />
          <div className="mt-2 flex justify-end">
            <button className="btn-primary" disabled={!!mod.preview} onClick={() => markProgress(mod.id, 'application', 'explain-back', { status: 'done', moduleVersion: mod.version })}>
              {answered.has('explain-back') ? <><Check size={15} /> Marked complete</> : 'Mark application complete'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function CellView({ cell, index, answered, onAnswered }: { cell: Cell; index: number; answered: boolean; onAnswered: () => void }) {
  const [choice, setChoice] = useState<number | null>(null);
  const [open, setOpen] = useState('');
  const [revealed, setRevealed] = useState(false);
  const d = cell.decision;
  return (
    <section className="card p-4" data-cell={cell.id}>
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-panel2 font-mono text-xs text-muted">[{index + 1}]</span>
        {cell.title && <h3 className="font-semibold">{cell.title}</h3>}
        {answered && <Check size={15} className="text-good" />}
      </div>
      <Markdown text={cell.say} className="mb-3" />
      {cell.stage && <Stage widgets={cell.stage} />}
      {d && (
        <div className="mt-3 rounded-xl border border-accent/40 bg-accent/5 p-3">
          <div className="label mb-1 text-accent">Your call</div>
          <Markdown text={d.prompt} className="font-medium" />
          {d.type === 'mcq' ? (
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {(d.options ?? []).map((o, i) => {
                const picked = choice === i;
                const right = revealed && d.answer === i;
                return (
                  <button key={i} disabled={revealed} onClick={() => { setChoice(i); setRevealed(true); onAnswered(); }}
                    className={cn('rounded-lg border px-3 py-2 text-left text-sm transition', right ? 'tone-good mark-bg' : picked && revealed ? (d.answer === undefined ? 'tone-accent mark-bg' : 'tone-bad mark-bg') : 'border-line bg-panel hover:border-accent/50')}>
                    <Markdown text={o} inline />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-2">
              <textarea className="input min-h-[60px] w-full" value={open} onChange={(e) => setOpen(e.target.value)} placeholder="Think it through, then compare with the model answer." />
              {!revealed && <button className="btn mt-1" onClick={() => { setRevealed(true); onAnswered(); }}>Show model answer</button>}
            </div>
          )}
          {revealed && (
            <div className="mt-2 rounded-lg bg-panel p-3 text-sm">
              {d.type === 'mcq' && d.answer !== undefined && <div className="mb-1 flex items-center gap-1 font-semibold">{choice === d.answer ? <><Check size={14} className="text-good" /> Good call.</> : <><X size={14} className="text-warn" /> Here's the reasoning.</>}</div>}
              <Markdown text={d.model} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
