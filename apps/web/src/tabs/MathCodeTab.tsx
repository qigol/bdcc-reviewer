import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, ChevronRight, ExternalLink, Footprints, ListOrdered, Rocket, X, Eye, EyeOff } from 'lucide-react';
import { resolveRefs, getPath, valuesEqual, datasetScope, type Section } from '@kodigo/schema';
import { useModuleCtx } from './ModulePage';
import { useScope } from '../engine/useScope';
import { useTracePlayer } from '../engine/trace';
import { InterpContext, Markdown, Tex, anchorFromEvent, applyAnchorClasses } from '../lib/md';
import { CodeView, anchorColor } from '../widgets/CodeView';
import { varsBadge } from '../widgets/Code';
import { CalloutBox } from '../widgets/Callout';
import { StageProvider, Stage } from '../engine/Stage';
import { cn } from '../lib/util';
import { markProgress, setSetting, useModuleProgress } from '../storage/progress';
import { fmtNum } from '../widgets/common';
import type { LoadedModule } from '../modules/store';
import type { StageWidget } from '@kodigo/schema';

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

function LiveInputs({ state, setState, labels }: { state: Record<string, any>; setState: (k: string, v: any) => void; labels: Record<string, string> }) {
  const keys = Object.keys(state);
  if (!keys.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="label">Live inputs</span>
      {keys.map((k) => {
        const v = state[k];
        if (typeof v === 'number') return <label key={k} className="flex items-center gap-1"><span className="font-mono text-xs text-muted">{k}</span><input type="number" className="input w-20 py-0.5" value={v} step="any" onChange={(e) => setState(k, Number(e.target.value))} /></label>;
        if (Array.isArray(v) && v.every((x) => typeof x === 'string')) return <label key={k} className="flex items-center gap-1"><span className="font-mono text-xs text-muted">{k}</span><input className="input w-40 py-0.5" defaultValue={v.join(', ')} onBlur={(e) => setState(k, e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} title={v.map((x) => labels[x] ?? x).join(', ')} /></label>;
        if (typeof v === 'string') return <label key={k} className="flex items-center gap-1"><span className="font-mono text-xs text-muted">{k}</span><input className="input w-28 py-0.5" defaultValue={v} onBlur={(e) => setState(k, e.target.value)} /></label>;
        return <span key={k} className="chip font-mono">{k} = {JSON.stringify(v).slice(0, 40)}</span>;
      })}
    </div>
  );
}

function dataWidgets(mod: LoadedModule, ids: string[] = []): StageWidget[] {
  return ids.map((id): any => {
    const ds = mod.parsed.datasets[id];
    if (ds?.kind === 'transactions') return { id: `ds-${id}`, widget: 'TransactionTable', props: { transactions: `@${id}`, title: ds.title ?? id } };
    if (ds?.kind === 'matrix') return { id: `ds-${id}`, widget: 'Matrix', props: { data: `@${id}`, title: ds.title ?? id, showRowMeans: false } };
    return { id: `ds-${id}`, widget: 'Text', props: { body: `**${ds?.title ?? id}**: \`${JSON.stringify((ds as any)?.value ?? (ds as any)?.items ?? (ds as any)?.rows ?? '').slice(0, 300)}\`` } };
  });
}

function SectionView({ section, next }: { section: Section; next?: Section }) {
  const { mod, base } = useModuleCtx();
  const nav = useNavigate();
  const [state, setStateObj] = useState<Record<string, any>>(() => structuredClone(section.state ?? {}));
  const setState = (k: string, v: any) => setStateObj((s) => ({ ...s, [k]: v }));
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

        {(section.data?.length || Object.keys(state).length) ? (
          <div className="card p-3">
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <span className="label">Live example (lecture data)</span>
              <LiveInputs state={state} setState={setState} labels={mod.labels} />
              {!!section.data?.length && <button className="btn-ghost btn-sm ml-auto" onClick={() => setShowData(!showData)}>{showData ? <EyeOff size={13} /> : <Eye size={13} />} {showData ? 'Hide' : 'Show'} data</button>}
            </div>
            {error && <div className="mb-2 text-xs text-bad">derive error: {error}</div>}
            {showData && !!section.data?.length && (
              <StageProvider mod={mod} spec={{ data: section.data }} state={{}}>
                <Stage widgets={dataWidgets(mod, section.data)} compact className="max-h-[340px] overflow-auto" />
              </StageProvider>
            )}
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
            <CodeView source={code.source} lang={code.lang} title={codes.length === 1 ? code.title : undefined} hoverAnchor={hover} setHoverAnchor={setHover} activeAnchor={step?.code ?? null} badges={codeTab === 0 ? badges : undefined} anchorOrder={anchorOrder} />
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
