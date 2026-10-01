import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, ChevronRight, ExternalLink, Footprints, ListOrdered, Rocket, X, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { resolveRefs, getPath, valuesEqual, datasetScope, sectionLiveWidgets, liveRoleTarget, PANE_ROLES, type Section, type TraceStep } from '@kodigo/schema';
import { useModuleCtx } from './ModulePage';
import { useScope } from '../engine/useScope';
import { useTracePlayer, traceCommands } from '../engine/trace';
import { InterpContext, Markdown, Tex, anchorFromEvent, applyAnchorClasses } from '../lib/md';
import { CodeView, anchorColor } from '../widgets/CodeView';
import { varsBadge } from '../widgets/Code';
import { CalloutBox } from '../widgets/Callout';
import { StageProvider, Stage } from '../engine/Stage';
import { cn, stableHash } from '../lib/util';
import { markProgress, setSetting, useModuleProgress } from '../storage/progress';
import { fmtNum } from '../widgets/common';
import type { LoadedModule } from '../modules/store';
import type { StageWidget } from '@kodigo/schema';
import type { WidgetCommand } from '../engine/types';

export function MathCodeTab() {
  const { mod, base } = useModuleCtx();
  const { sectionId } = useParams();
  const nav = useNavigate();
  const sections = mod.parsed.mathCode;
  const progress = useModuleProgress(mod.preview ? undefined : mod.id);
  const seen = new Set(progress.filter((p) => p.tab === 'math-code').map((p) => p.itemId));
  const section = sections.find((s) => s.id === sectionId);
  useEffect(() => {
    if (!sectionId && sections.length) nav(`${base}/math-code/${sections.find((s) => !seen.has(s.id))?.id ?? sections[0].id}`, { replace: true });
  }, [sectionId]);
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-1 gap-4 px-4 py-4">
      <aside className="no-print hidden w-56 shrink-0 lg:block">
        <div className="sticky top-16">
          <div className="label mb-2 px-2">Sections</div>
          <ol className="flex flex-col gap-0.5">
            {sections.map((s, i) => (
              <li key={s.id}>
                <Link to={`${base}/math-code/${s.id}`} className={cn('flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm transition', s.id === sectionId ? 'bg-panel font-semibold shadow-sm ring-1 ring-line' : 'text-muted hover:bg-panel hover:text-ink')}>
                  <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold', seen.has(s.id) ? 'bg-good/80 text-white' : 'bg-panel2 text-muted')}>{seen.has(s.id) ? <Check size={11} /> : i + 1}</span>
                  <span className="leading-snug">{s.title}{s.beyondSlides && <Rocket size={11} className="ml-1 inline text-purple-400" />}</span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        {section ? <SectionView key={section.id} section={section} next={sections[sections.indexOf(section) + 1]} /> : <div className="text-muted">Pick a section.</div>}
      </div>
    </div>
  );
}

interface InputHints {
  /** every item id that appears in a transactions dataset of this section */
  items: string[];
  /** row and column labels of the section's matrix datasets */
  rows: string[];
  cols: string[];
}

function inputHints(mod: LoadedModule, data: string[] = []): InputHints {
  const items = new Set<string>(), rows = new Set<string>(), cols = new Set<string>();
  for (const id of data) {
    const ds: any = mod.parsed.datasets[id];
    if (ds?.kind === 'transactions') ds.transactions.forEach((t: any) => t.items.forEach((i: string) => items.add(i)));
    if (ds?.kind === 'matrix') { ds.rows.forEach((r: string) => rows.add(r)); ds.cols.forEach((c: string) => cols.add(c)); }
  }
  return { items: [...items].sort(), rows: [...rows], cols: [...cols] };
}

/** A text/number box that commits on Enter or blur, reverts on Escape, and resyncs when the value changes elsewhere. */
function CommitInput({ value, onCommit, type = 'text', className, validate, title }: {
  value: string; onCommit: (v: string) => void; type?: string; className?: string; validate?: (v: string) => string | null; title?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setDraft(value); setErr(null); }, [value]);
  const commit = () => {
    if (draft === value) { setErr(null); return; }
    const e = validate?.(draft) ?? null;
    setErr(e);
    if (!e) onCommit(draft);
  };
  return (
    <span className="relative inline-flex flex-col">
      <input
        type={type} step="any" className={cn('input py-0.5', err && 'border-bad', className)} value={draft} title={err ?? title}
        onChange={(e) => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setErr(null); } }}
        aria-invalid={!!err}
      />
      {err && <span className="absolute left-0 top-full z-20 mt-0.5 whitespace-nowrap rounded bg-bad px-1.5 py-0.5 text-[10px] text-white">{err}</span>}
    </span>
  );
}

function LiveInputs({ state, setState, labels, hints, skip, initial, onReset }: {
  state: Record<string, any>; setState: (k: string, v: any) => void; labels: Record<string, string>;
  hints: InputHints; skip: Set<string>; initial: Record<string, any>; onReset: () => void;
}) {
  const keys = Object.keys(state).filter((k) => !skip.has(k));
  const changed = stableHash(state) !== stableHash(initial);
  if (!keys.length && !changed) return null;
  const known = new Set([...hints.rows, ...hints.cols]);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm" data-testid="live-inputs">
      {keys.length > 0 && <span className="label">Live inputs</span>}
      {keys.map((k) => {
        const v = state[k];
        const name = <span className="font-mono text-xs text-muted">{k}</span>;
        if (typeof v === 'number') {
          return (
            <label key={k} className="flex items-center gap-1">{name}
              <CommitInput type="number" className="w-20" value={String(v)} onCommit={(t) => setState(k, Number(t))}
                validate={(t) => (t.trim() === '' || !Number.isFinite(Number(t)) ? 'enter a number' : null)} />
            </label>
          );
        }
        if (Array.isArray(v) && v.every((x) => typeof x === 'string') && hints.items.length && v.every((x) => hints.items.includes(x))) {
          // an itemset: toggle items on and off
          return (
            <div key={k} className="flex flex-wrap items-center gap-1" role="group" aria-label={`${k} items`}>{name}
              {hints.items.map((it) => {
                const on = v.includes(it);
                return (
                  <button key={it} type="button" aria-pressed={on}
                    className={cn('rounded-full border px-2 py-0.5 text-xs transition', on ? 'tone-accent mark-bg font-semibold' : 'border-line bg-panel2 text-muted hover:text-ink')}
                    title={on && v.length === 1 ? 'An itemset needs at least one item' : undefined}
                    onClick={() => { if (on && v.length === 1) return; setState(k, on ? v.filter((x) => x !== it) : hints.items.filter((x) => x === it || v.includes(x))); }}>
                    {labels[it] ?? it}
                  </button>
                );
              })}
            </div>
          );
        }
        if (typeof v === 'string' && known.has(v)) {
          // a user or item of the matrix: pick from its labels
          const opts = hints.rows.includes(v) && !hints.cols.includes(v) ? hints.rows : hints.cols.includes(v) && !hints.rows.includes(v) ? hints.cols : [...hints.rows, ...hints.cols];
          return (
            <label key={k} className="flex items-center gap-1">{name}
              <select className="input w-auto py-0.5" value={v} onChange={(e) => setState(k, e.target.value)}>
                {opts.map((o) => <option key={o} value={o}>{labels[o] ?? o}</option>)}
              </select>
            </label>
          );
        }
        if (Array.isArray(v) && v.every((x) => typeof x === 'string')) {
          return (
            <label key={k} className="flex items-center gap-1">{name}
              <CommitInput className="w-40" value={v.join(', ')} onCommit={(t) => setState(k, t.split(',').map((x) => x.trim()).filter(Boolean))} title={v.map((x) => labels[x] ?? x).join(', ')} />
            </label>
          );
        }
        if (typeof v === 'string') return <label key={k} className="flex items-center gap-1">{name}<CommitInput className="w-28" value={v} onCommit={(t) => setState(k, t)} /></label>;
        return <span key={k} className="chip font-mono">{k} = {JSON.stringify(v).slice(0, 40)}</span>;
      })}
      {changed && <button className="btn-ghost btn-sm" onClick={onReset} title="Back to the lecture's values"><RotateCcw size={12} /> Lecture values</button>}
    </div>
  );
}

function fmtVar(v: any): string {
  if (typeof v === 'number') return fmtNum(v, 3);
  if (Array.isArray(v)) return `[${v.map((x) => (typeof x === 'number' ? fmtNum(x, 3) : String(x))).join(', ')}]`;
  if (v && typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** Debugger-style watch: the latest value of every variable the trace has shown so far; the ones set by this line glow. */
function VarsWatch({ steps, index }: { steps: TraceStep[]; index: number }) {
  const { latest, now } = useMemo(() => {
    const latest: Record<string, any> = {};
    for (let i = 0; i <= index && i < steps.length; i++) Object.assign(latest, steps[i].vars ?? {});
    return { latest, now: new Set(Object.keys(steps[index]?.vars ?? {})) };
  }, [steps, index]);
  const keys = Object.keys(latest);
  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid="vars-watch">
      <span className="label mr-1">Variables</span>
      {keys.length === 0 && <span className="text-xs text-muted">none yet: press ▶</span>}
      {keys.map((k) => (
        <span key={k} className={cn('rounded-md border px-1.5 py-0.5 font-mono text-[11px] transition-colors', now.has(k) ? 'border-warn/60 bg-warn/15 font-semibold text-ink' : 'border-line bg-panel2 text-muted')}>
          {k} = {fmtVar(latest[k]).slice(0, 80)}
        </span>
      ))}
    </div>
  );
}

/** The live example's widgets (lecture data by default), driven by the section's state and, while stepping, by the trace's ops. */
function LivePanel({ mod, section, state, setState, widgets, cmds, className }: {
  mod: LoadedModule; section: Section; state: Record<string, any>; setState: (k: string, v: any) => void;
  widgets: StageWidget[]; cmds?: Record<string, WidgetCommand[]>; className?: string;
}) {
  // while stepping, the trace decides what lights up, so drop a table's static `highlight`
  const shown = useMemo(() => (cmds ? widgets.map((w) => (w.props && 'highlight' in w.props ? { ...w, props: { ...w.props, highlight: [], showContainCount: false } } : w)) : widgets), [widgets, !!cmds]);
  return (
    <StageProvider mod={mod} spec={{ data: section.data, derive: section.derive }} state={state} setState={setState} cmds={cmds}>
      <Stage widgets={shown} compact className={className} />
    </StageProvider>
  );
}

function SectionView({ section, next }: { section: Section; next?: Section }) {
  const { mod, base } = useModuleCtx();
  const nav = useNavigate();
  const [state, setStateObj] = useState<Record<string, any>>(() => structuredClone(section.state ?? {}));
  const setState = useCallback((k: string, v: any) => setStateObj((s) => ({ ...s, [k]: v })), []);
  const { scope, error } = useScope(mod, { data: section.data, derive: section.derive }, state);
  const [hover, setHover] = useState<string | null>(null);
  const [revealAll, setRevealAll] = useState(true);
  const [revealed, setRevealed] = useState(1);
  const [tracing, setTracing] = useState(false);
  const [showData, setShowData] = useState(true);
  const [codeTab, setCodeTab] = useState(0);
  const traceIn = useMemo(() => (section.trace ? resolveRefs(section.trace.in, scope) : null), [section.trace, scope]);
  const trace = useTracePlayer(mod, tracing ? section.trace?.fn : undefined, traceIn, { speed: 0.8 });
  const step = tracing && trace.index >= 0 ? trace.steps[trace.index] : undefined;
  const derivRef = useRef<HTMLDivElement>(null);
  const anchorOrder = section.links.map((l) => l.anchor);
  const liveWidgets = useMemo(() => sectionLiveWidgets(section, mod.parsed.datasets), [section, mod]);
  const hints = useMemo(() => inputHints(mod, section.data), [mod, section.data]);
  // state keys a live widget (Slider, Choice…) already controls don't get a second input box
  const boundKeys = useMemo(() => new Set(liveWidgets.flatMap((w) => Object.values(w.bind ?? {}))), [liveWidgets]);
  // the trace's ops, routed from their roles to the live widgets (code/formula roles are the panes themselves)
  const liveCmds = useMemo(() => {
    if (!tracing || trace.index < 0) return undefined;
    const { byRole } = traceCommands(trace.steps, trace.index);
    const out: Record<string, WidgetCommand[]> = {};
    for (const [role, list] of Object.entries(byRole)) {
      if (PANE_ROLES.has(role)) continue;
      const id = liveRoleTarget(role, liveWidgets);
      if (id) (out[id] ??= []).push(...list);
    }
    return out;
  }, [tracing, trace.steps, trace.index, liveWidgets]);
  const hasLive = liveWidgets.length > 0;

  useEffect(() => {
    if (mod.preview) return;
    markProgress(mod.id, 'math-code', section.id, { moduleVersion: mod.version });
    setSetting('lastLocation', { moduleId: mod.id, tab: 'math-code', id: section.id, path: `${base}/math-code/${section.id}`, title: `${mod.parsed.manifest.shortTitle} · ${section.title}`, at: Date.now() });
  }, [section.id]);

  useEffect(() => {
    const map: Record<string, string> = {};
    if (hover) map[hover] = 'anc-hover';
    if (step?.math) map[step.math] = 'anc-on';
    applyAnchorClasses(derivRef.current, map);
  });

  const steps = section.steps;
  const visibleSteps = revealAll ? steps.length : revealed;
  const codes = [{ title: section.code.title ?? 'Python', lang: section.code.lang ?? 'python', source: section.code.source }, ...(section.extraCode ?? []).map((c) => ({ title: c.title, lang: c.lang ?? 'python', source: c.source }))];
  const code = codes[Math.min(codeTab, codes.length - 1)];
  const badges = step?.code ? { [step.code]: varsBadge(step.vars) ?? '' } : undefined;
  const stepScope = useMemo(() => ({ ...scope, ...(step?.vars ?? {}) }), [scope, step]);

  return (
    <InterpContext.Provider value={{ scope, labels: mod.labels }}>
      <div className="flex flex-col gap-4">
        <header>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">{section.title}</h2>
            {section.beyondSlides && <span className="chip border-purple-400/50 bg-purple-400/10 text-purple-500"><Rocket size={11} className="mr-1" /> beyond the slides</span>}
            {section.skills.map((s) => <span key={s} className="chip">{mod.parsed.manifest.skills.find((k) => k.id === s)?.label ?? s}</span>)}
          </div>
          <Markdown text={section.summary} className="mt-1 text-sm text-muted" />
        </header>

        {section.keyFormula && (
          <div className="card flex flex-wrap items-center gap-3 border-accent/30 bg-accent/5 px-4 py-2">
            <span className="label">Key formula</span>
            <Tex tex={section.keyFormula} display={false} className="text-lg" />
          </div>
        )}

        {(hasLive || Object.keys(state).length) ? (
          <div className="card p-3" data-testid="live-example">
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <span className="label">Live example (lecture data)</span>
              <LiveInputs state={state} setState={setState} labels={mod.labels} hints={hints} skip={boundKeys}
                initial={section.state ?? {}} onReset={() => setStateObj(structuredClone(section.state ?? {}))} />
              {hasLive && !tracing && <button className="btn-ghost btn-sm ml-auto" onClick={() => setShowData(!showData)}>{showData ? <EyeOff size={13} /> : <Eye size={13} />} {showData ? 'Hide' : 'Show'} data</button>}
            </div>
            {error && <div className="mb-2 text-xs text-bad">These inputs don't work for this example: {error}</div>}
            {tracing && hasLive
              ? <div className="text-xs text-muted">While you step through, the live data sits next to the code and follows each line.</div>
              : showData && hasLive && <LivePanel mod={mod} section={section} state={state} setState={setState} widgets={liveWidgets} className="max-h-[560px] overflow-auto" />}
            {!hasLive && section.trace && !tracing && <div className="text-xs text-muted">Press <b>Step through</b> to run the code on these inputs, line by line.</div>}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {section.links.map((l) => (
            <span key={l.anchor} onMouseEnter={() => setHover(l.anchor)} onMouseLeave={() => setHover(null)} title={l.say}
              className={cn('inline-flex cursor-default items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition', hover === l.anchor || step?.math === l.anchor || step?.code === l.anchor ? 'border-accent bg-accent/10' : 'border-line bg-panel')}>
              <span className="h-2 w-2 rounded-full" style={{ background: anchorColor(l.anchor, anchorOrder) }} />
              <Markdown text={l.label} inline raw />
            </span>
          ))}
          <span className="flex-1" />
          {section.trace && (
            <button className={cn('btn', tracing && 'border-warn/60 bg-warn/10')} onClick={() => { setTracing(!tracing); trace.reset(); }} data-testid="step-through">
              <Footprints size={15} /> {tracing ? 'Stop stepping' : 'Step through'}
            </button>
          )}
        </div>

        {tracing && (
          <div className="card sticky top-14 z-10 flex flex-wrap items-center gap-2 border-warn/40 px-3 py-2 shadow">
            <button className="btn btn-sm" onClick={trace.back} disabled={trace.index < 0}>◀</button>
            <button className="btn-primary btn-sm" onClick={trace.toggle}>{trace.playing ? 'Pause' : 'Play'}</button>
            <button className="btn btn-sm" onClick={trace.step} disabled={trace.index >= trace.steps.length - 1}>▶</button>
            <input type="range" className="w-40 accent-[rgb(var(--warn))]" min={-1} max={trace.steps.length - 1} value={trace.index} onChange={(e) => { trace.pause(); trace.setIndex(Number(e.target.value)); }} aria-label="trace position" />
            <span className="font-mono text-xs text-muted">{trace.index + 1}/{trace.steps.length}</span>
            <div className="min-w-[200px] flex-1 text-sm">{trace.error ? <span className="text-bad">{trace.error}</span> : step ? <Markdown text={step.label} scope={stepScope} /> : <span className="text-muted">Press ▶ to step through the computation.</span>}</div>
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="card p-4" ref={derivRef}>
            <div className="mb-2 flex items-center justify-between">
              <span className="label">Derivation</span>
              <button className="btn-ghost btn-sm" onClick={() => { setRevealAll(!revealAll); setRevealed(1); }}><ListOrdered size={13} /> {revealAll ? 'One step at a time' : 'Show all'}</button>
            </div>
            <ol className="flex flex-col gap-3">
              {steps.slice(0, visibleSteps).map((st, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-panel2 text-[10px] font-bold text-muted">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <Tex tex={st.tex} className="anchored-math overflow-x-auto" onMouseOver={(e) => { const a = anchorFromEvent(e); if (a) setHover(a); }} onMouseOut={(e) => { if (anchorFromEvent(e)) setHover(null); }} />
                    <Markdown text={st.say} className="text-sm text-muted" />
                  </div>
                </li>
              ))}
            </ol>
            {!revealAll && visibleSteps < steps.length && <button className="btn mt-3" onClick={() => setRevealed(revealed + 1)}>Next step <ChevronRight size={14} /></button>}
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            {codes.length > 1 && (
              <div className="flex gap-1">
                {codes.map((c, i) => <button key={i} className={cn('btn btn-sm', i === codeTab && 'border-accent/50 bg-accent/10')} onClick={() => setCodeTab(i)}>{c.title}</button>)}
              </div>
            )}
            <CodeView source={code.source} lang={code.lang} title={codes.length === 1 ? code.title : undefined} hoverAnchor={hover} setHoverAnchor={setHover} activeAnchor={step?.code ?? null} badges={codeTab === 0 ? badges : undefined} anchorOrder={anchorOrder} maxHeight={tracing ? 460 : undefined} followActive={tracing} />
            {tracing && (
              <div className="card flex flex-col gap-3 border-warn/40 p-3" data-testid="live-trace">
                <VarsWatch steps={trace.steps} index={trace.index} />
                {hasLive && <LivePanel mod={mod} section={section} state={state} setState={setState} widgets={liveWidgets} cmds={liveCmds} className="max-h-[520px] overflow-auto" />}
              </div>
            )}
            <div className="text-[11px] text-muted">Hover a colored term or a code line to see its partner. Displayed code is Python; the site computes with the module's logic.js, and the lecture check below confirms both agree with the slides.</div>
          </div>
        </div>

        {!!section.examples?.length && <LectureCheck mod={mod} ids={section.examples} />}

        <div className="grid gap-3 md:grid-cols-2">
          {section.pitfalls?.length ? <CalloutBox kind="warn" title="Pitfalls" body={section.pitfalls.map((p) => `- ${p}`).join('\n')} /> : null}
          {section.examTip && <CalloutBox kind="exam" body={section.examTip} />}
          {section.errata?.map((e, i) => <CalloutBox key={i} kind="errata" body={e} />)}
        </div>

        <div className="flex justify-end">
          {next ? <button className="btn-primary" onClick={() => nav(`${base}/math-code/${next.id}`)}>Next: {next.title} <ChevronRight size={15} /></button>
            : <button className="btn-primary" onClick={() => nav(`${base}/application`)}>On to Application <ChevronRight size={15} /></button>}
        </div>
      </div>
    </InterpContext.Provider>
  );
}

export function LectureCheck({ mod, ids }: { mod: LoadedModule; ids: string[] }) {
  const [results, setResults] = useState<Record<string, { ok: boolean; got: Record<string, any>; error?: string }>>({});
  const examples = mod.parsed.examples.filter((e) => ids.includes(e.id));
  useEffect(() => {
    let alive = true;
    const data = datasetScope(mod.parsed, Object.keys(mod.parsed.datasets));
    Promise.all(examples.map(async (ex) => {
      try {
        const out = await mod.logic.call(ex.fn, resolveRefs(ex.in, data));
        const got: Record<string, any> = {};
        let ok = true;
        for (const [p, exp] of Object.entries(ex.expect)) {
          const r = getPath(out ?? {}, p);
          got[p] = r.value;
          if (!r.found || !valuesEqual(r.value, exp, ex.tol ?? 0.005)) ok = false;
        }
        return [ex.id, { ok, got }] as const;
      } catch (e: any) {
        return [ex.id, { ok: false, got: {}, error: String(e?.message ?? e) }] as const;
      }
    })).then((r) => alive && setResults(Object.fromEntries(r)));
    return () => { alive = false; };
  }, [mod, ids.join(',')]);
  const pdf = mod.parsed.manifest.sources.find((s) => s.file && (mod.binary.includes(`sources/${s.file}`) || typeof mod.files[`sources/${s.file}`] !== 'undefined'));
  const show = (v: any) => (typeof v === 'number' ? fmtNum(v, 4) : Array.isArray(v) ? `[${v.map((x) => (typeof x === 'number' ? fmtNum(x, 3) : JSON.stringify(x))).join(', ')}]` : JSON.stringify(v));
  return (
    <div className="card p-3">
      <div className="label mb-2">Lecture check: the slides' numbers, recomputed</div>
      <div className="flex flex-col gap-1.5">
        {examples.map((ex) => {
          const r = results[ex.id];
          return (
            <div key={ex.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-panel2 px-3 py-1.5 text-sm" data-testid={`example-${ex.id}`} data-ok={r?.ok ? 'true' : r ? 'false' : 'pending'}>
              <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-white', !r ? 'bg-muted/40' : r.ok ? 'bg-good' : 'bg-bad')}>{r ? r.ok ? <Check size={12} /> : <X size={12} /> : '…'}</span>
              <span className="font-mono text-xs text-muted">{ex.fn}</span>
              <span className="flex-1">{Object.entries(ex.expect).map(([k, v]) => <span key={k} className="mr-3"><span className="text-muted">{k}</span> = <b>{show(v)}</b>{r && !r.ok && <span className="ml-1 text-bad">(got {show(r.got[k])})</span>}</span>)}</span>
              {ex.note && <span className="text-xs text-muted"><Markdown text={ex.note} inline raw /></span>}
              <span className="text-xs text-muted">{ex.source}</span>
              {pdf && ex.page && <a className="text-xs text-accent underline" href={`${mod.fileUrl(`sources/${pdf.file}`)}#page=${ex.page}`} target="_blank" rel="noreferrer">open slide <ExternalLink size={11} className="inline" /></a>}
              {r?.error && <span className="w-full text-xs text-bad">{r.error}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
