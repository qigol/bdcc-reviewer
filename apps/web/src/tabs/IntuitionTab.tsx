import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, BookMarked, Check, CheckCircle2, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { resolveRefs, evalExpr, TRANSIENT_COMMANDS, workbenchTabLabel, type Scene, type Term } from '@kodigo/schema';
import { useModuleCtx } from './ModulePage';
import { StageProvider, Stage, useStage } from '../engine/Stage';
import { GateView, gateSatisfied, type GateState } from '../engine/Gate';
import type { WidgetCommand } from '../engine/types';
import { Markdown, Tex } from '../lib/md';
import { cn } from '../lib/util';
import { markProgress, setSetting, useModuleProgress, useSetting, saveNote, useNote } from '../storage/progress';
import { db } from '../storage/db';
import { speak, stopSpeaking } from '../lib/speech';
import { datasetScope } from '@kodigo/schema';

export function IntuitionTab() {
  const { mod, base } = useModuleCtx();
  const { sceneId } = useParams();
  const nav = useNavigate();
  const scenes = mod.parsed.intuition;
  const progress = useModuleProgress(mod.preview ? undefined : mod.id);
  const done = new Set(progress.filter((p) => p.tab === 'intuition' && p.status === 'done').map((p) => p.itemId));
  const scene = scenes.find((s) => s.id === sceneId);
  useEffect(() => {
    if (!sceneId && scenes.length) {
      const seen = progress.filter((p) => p.tab === 'intuition').sort((a, b) => b.updatedAt - a.updatedAt)[0];
      const target = scenes.find((s) => !done.has(s.id))?.id ?? seen?.itemId ?? scenes[0].id;
      nav(`${base}/intuition/${target}`, { replace: true });
    }
  }, [sceneId, scenes.length]);
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-1 gap-4 px-4 py-4">
      <aside className="no-print hidden w-56 shrink-0 lg:block">
        <div className="sticky top-16">
          <div className="label mb-2 px-2">Scenes</div>
          <ol className="flex flex-col gap-0.5">
            {scenes.map((s, i) => (
              <li key={s.id}>
                <Link to={`${base}/intuition/${s.id}`} className={cn('flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm transition', s.id === sceneId ? 'bg-panel font-semibold shadow-sm ring-1 ring-line' : 'text-muted hover:bg-panel hover:text-ink')}>
                  <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold', done.has(s.id) ? 'bg-good text-white' : 'bg-panel2 text-muted')}>{done.has(s.id) ? <Check size={11} /> : i + 1}</span>
                  <span className="leading-snug">{s.title}</span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        {scene ? <ScenePlayer key={scene.id} scene={scene} index={scenes.indexOf(scene)} total={scenes.length} next={scenes[scenes.indexOf(scene) + 1]} /> : <div className="text-muted">Pick a scene.</div>}
      </div>
    </div>
  );
}

function initialHidden(scene: Scene) {
  return new Set(scene.stage.filter((w) => w.hidden).map((w) => w.id));
}

function ScenePlayer({ scene, index, total, next }: { scene: Scene; index: number; total: number; next?: Scene }) {
  const { mod, base } = useModuleCtx();
  const nav = useNavigate();
  const [narration, setNarration] = useSetting('narration');
  const [reducedMotionSetting] = useSetting('reducedMotion');
  const reducedMotion = reducedMotionSetting || (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [beat, setBeat] = useState(0);
  const [finished, setFinished] = useState(false);
  const [gates, setGates] = useState<Record<number, GateState>>({});
  const [replayKey, setReplayKey] = useState(0);
  const beats = scene.beats;
  const dataScope = useMemo(() => datasetScope(mod.parsed, scene.data), [mod, scene]);

  // state = initial + every `set` up to the current beat (+ learner edits since)
  const stateAt = useCallback((i: number, from?: Record<string, any>) => {
    let s = from ?? structuredClone(scene.state ?? {});
    const startAt = from ? i : 0;
    for (let b = startAt; b <= i; b++) if (beats[b]?.set) s = { ...s, ...resolveRefs(beats[b].set, { ...dataScope, ...s }) };
    return s;
  }, [scene, beats, dataScope]);
  const [state, setStateObj] = useState<Record<string, any>>(() => stateAt(0));
  const setState = useCallback((k: string, v: any) => setStateObj((s) => ({ ...s, [k]: v })), []);

  // resume
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current || mod.preview) return;
    resumed.current = true;
    db.progress.get([mod.id, 'intuition', scene.id]).then((p) => {
      if (p?.beatIndex && p.beatIndex > 0 && p.beatIndex < beats.length && p.status !== 'done') goto(p.beatIndex, true);
    });
  }, []);

  const beatRef = useRef(beat);
  beatRef.current = beat;
  const goto = useCallback((i: number, jump = false) => {
    i = Math.max(0, Math.min(beats.length - 1, i));
    const cur = beatRef.current;
    if (i === cur + 1 && !jump) setStateObj((s) => stateAt(i, s));
    else setStateObj(stateAt(i));
    setBeat(i);
    setFinished(false);
  }, [beats.length, stateAt]);

  const hidden = useMemo(() => {
    const h = initialHidden(scene);
    for (let b = 0; b <= beat; b++) {
      beats[b].show?.forEach((id) => h.delete(id));
      beats[b].hide?.forEach((id) => h.add(id));
    }
    return h;
  }, [scene, beat]);

  const cmds = useMemo(() => {
    const out: Record<string, WidgetCommand[]> = {};
    for (let b = 0; b <= beat; b++) {
      (beats[b].do ?? []).forEach((c, k) => {
        const transient = TRANSIENT_COMMANDS.has(c.cmd);
        if (transient && b !== beat) return;
        (out[c.target] ??= []).push({ cmd: c.cmd, args: c.args, transient, seq: replayKey * 100000 + b * 100 + k + 1 });
      });
    }
    return out;
  }, [beat, beats, replayKey]);

  const cur = beats[beat];
  const gs = gates[beat] ?? {};
  const setGate = (s: GateState) => setGates((g) => ({ ...g, [beat]: s }));

  const onEvent = useCallback((widgetId: string, event: string) => {
    setGates((g) => {
      const b = beats[beatRef.current];
      if (b?.gate?.type === 'event' && b.gate.target === widgetId && b.gate.event === event) return { ...g, [beatRef.current]: { ...(g[beatRef.current] ?? {}), event: true } };
      return g;
    });
  }, [beats]);

  useEffect(() => {
    if (mod.preview) return;
    markProgress(mod.id, 'intuition', scene.id, { beatIndex: beat, moduleVersion: mod.version });
    setSetting('lastLocation', { moduleId: mod.id, tab: 'intuition', id: scene.id, beat, path: `${base}/intuition/${scene.id}`, title: `${mod.parsed.manifest.shortTitle} · ${scene.title}`, at: Date.now() });
  }, [beat, scene.id]);

  useEffect(() => { speak(cur?.say ?? '', narration); }, [beat, narration]);
  useEffect(() => () => stopSpeaking(), []);

  return (
    <StageProvider mod={mod} spec={{ data: scene.data, derive: scene.derive }} state={state} setState={setState} cmds={cmds} onEvent={onEvent} reducedMotion={reducedMotion} replayKey={replayKey}>
      {(scope) => {
        let whenTrue = false;
        if (cur?.gate?.type === 'when') whenTrue = !!evalExpr(cur.gate.when, scope);
        const canNext = gateSatisfied(cur?.gate, gs, whenTrue);
        const isLast = beat === beats.length - 1;
        const advance = () => {
          if (!canNext) return;
          if (isLast) {
            setFinished(true);
            if (!mod.preview) markProgress(mod.id, 'intuition', scene.id, { status: 'done', beatIndex: beat, moduleVersion: mod.version });
          } else goto(beat + 1);
        };
        return (
          <div className="flex flex-col gap-4">
            <KeyboardControls onNext={advance} onBack={() => goto(beat - 1)} onReplay={() => setReplayKey((k) => k + 1)} />
            <header className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="label">Scene {index + 1} of {total}</div>
                <h2 className="text-xl font-semibold">{scene.title}</h2>
                <p className="text-sm text-muted">{scene.goal}</p>
              </div>
              <div className="no-print flex items-center gap-1">
                <button className="btn-ghost btn-sm" title="Narrate (text to speech)" aria-pressed={narration} onClick={() => setNarration(!narration)}>{narration ? <Volume2 size={16} /> : <VolumeX size={16} />}</button>
                <button className="btn-ghost btn-sm" title="Replay beat (R)" onClick={() => setReplayKey((k) => k + 1)}><RotateCcw size={16} /></button>
              </div>
            </header>
            <Stage widgets={scene.stage} hidden={hidden} />
            <AnimatePresence mode="wait">
              {!finished ? (
                <motion.div key={`beat-${beat}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: reducedMotion ? 0.1 : 0.25 }}
                  className="card sticky bottom-3 z-10 flex flex-col gap-3 p-4 shadow-lg">
                  <Markdown text={cur.say} className="text-[15px]" />
                  {cur.define?.length ? <DefinitionCards ids={cur.define} terms={mod.parsed.glossary} /> : null}
                  {cur.gate && cur.gate.type !== 'continue' && (
                    <GateView key={`${scene.id}:${beat}`} gate={cur.gate} state={gs} setState={setGate} whenTrue={whenTrue} mod={mod} noteAnchor={`reflect:${scene.id}:${beat}`}
                      onAnswer={(correct, response) => { if (!mod.preview) db.attempts.add({ key: `${mod.id}/predict:${scene.id}:${beat}`, templateId: `predict:${scene.id}:${beat}`, moduleId: mod.id, seed: 0, type: 'predict', skills: scene.skills ?? [], score: correct ? 1 : 0, response, timeMs: 0, mode: 'predict', at: Date.now() }); }} />
                  )}
                  <div className="flex items-center gap-3">
                    <button className="btn" onClick={() => goto(beat - 1)} disabled={beat === 0}><ArrowLeft size={15} /> Back</button>
                    <div className="flex flex-1 items-center justify-center gap-1.5" aria-label="beats">
                      {beats.map((_, i) => (
                        <button key={i} aria-label={`beat ${i + 1}`} onClick={() => i <= beat && goto(i)} className={cn('h-2 rounded-full transition-all', i === beat ? 'w-6 bg-accent' : i < beat ? 'w-2 bg-accent/50' : 'w-2 bg-line')} />
                      ))}
                    </div>
                    <button className="btn-primary" onClick={advance} disabled={!canNext} data-testid="next-beat">
                      {cur.gate?.type === 'continue' && cur.gate.label ? cur.gate.label : isLast ? 'Finish' : 'Next'} <ArrowRight size={15} />
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="takeaway" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="card border-good/40 p-5">
                  <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-good"><CheckCircle2 size={18} /> Takeaway</div>
                  <Markdown text={scene.takeaway} className="text-lg font-medium" />
                  <TermsRecap scene={scene} terms={mod.parsed.glossary} />
                  <ExplainBack moduleId={mod.id} anchor={`scene:${scene.id}`} disabled={!!mod.preview} />
                  <div className="mt-4 flex gap-2">
                    <button className="btn" onClick={() => { goto(0, true); setGates({}); }}><RotateCcw size={15} /> Watch again</button>
                    {next ? <button className="btn-primary" onClick={() => nav(`${base}/intuition/${next.id}`)}>Next scene: {next.title} <ArrowRight size={15} /></button>
                      : <button className="btn-primary" onClick={() => nav(`${base}/math-code`)}>On to {workbenchTabLabel(mod.parsed.manifest)} <ArrowRight size={15} /></button>}
                    <button className="btn-ghost" onClick={() => nav(`${base}/path`)}>Back to the path</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      }}
    </StageProvider>
  );
}

function KeyboardControls({ onNext, onBack, onReplay }: { onNext: () => void; onBack: () => void; onReplay: () => void }) {
  const ctx = useStage();
  const ref = useRef({ onNext, onBack, onReplay, ctx });
  ref.current = { onNext, onBack, onReplay, ctx };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); ref.current.onNext(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); ref.current.onBack(); }
      else if (e.key === 'r' || e.key === 'R') ref.current.onReplay();
      else if (e.key === ' ') {
        const p = Object.values(ref.current.ctx.players)[0];
        if (p) { e.preventDefault(); p.toggle(); }
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  return null;
}

export function ExplainBack({ moduleId, anchor, prompt, disabled }: { moduleId: string; anchor: string; prompt?: string; disabled?: boolean }) {
  const note = useNote(moduleId, anchor);
  const [text, setText] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const value = text ?? note?.text ?? '';
  return (
    <div className="mt-3">
      <label className="label mb-1 block">{prompt ?? 'Explain it back in your own words (saved to your notes)'}</label>
      <textarea className="input min-h-[70px] w-full" value={value} disabled={disabled} onChange={(e) => { setText(e.target.value); setSaved(false); }} placeholder="If you can say it simply, you understand it." />
      <div className="mt-1 flex justify-end">
        <button className="btn btn-sm" disabled={disabled || !value.trim()} onClick={async () => { await saveNote(moduleId, anchor, value); setSaved(true); }}>{saved ? <><Check size={13} /> Saved</> : 'Save note'}</button>
      </div>
    </div>
  );
}

/** The terms a beat introduces (`define`), shown as definition cards under the narration. */
function DefinitionCards({ ids, terms }: { ids: string[]; terms: Term[] }) {
  const list = ids.map((id) => terms.find((t) => t.id === id)).filter(Boolean) as Term[];
  if (!list.length) return null;
  return (
    <div className={cn('grid gap-2', list.length > 1 && 'md:grid-cols-2')} data-testid="definitions">
      {list.map((t) => (
        <motion.div key={t.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-accent/30 bg-accent/5 px-3 py-2" data-term={t.id}>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-accent"><BookMarked size={12} /> New term</span>
            <span className="font-semibold">{t.term}</span>
            {t.aka?.length ? <span className="text-xs text-muted">also {t.aka.join(', ')}</span> : null}
          </div>
          <div className="text-sm">{t.short}</div>
          {t.formula && <Tex tex={t.formula} display={false} className="mt-1 block text-sm" />}
          {t.long && <details className="mt-1 text-sm text-muted"><summary className="cursor-pointer text-xs">More</summary><Markdown text={t.long} raw /></details>}
        </motion.div>
      ))}
    </div>
  );
}

function TermsRecap({ scene, terms }: { scene: Scene; terms: Term[] }) {
  const ids = [...new Set(scene.beats.flatMap((b) => b.define ?? []))];
  const list = ids.map((id) => terms.find((t) => t.id === id)).filter(Boolean) as Term[];
  if (!list.length) return null;
  return (
    <div className="mt-3 rounded-lg bg-panel2 px-3 py-2" data-testid="terms-recap">
      <div className="label mb-1 flex items-center gap-1"><BookMarked size={12} /> Terms from this scene</div>
      <dl className="grid gap-x-3 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
        {list.map((t) => <div key={t.id} className="contents"><dt className="font-semibold">{t.term}</dt><dd className="text-muted">{t.short}</dd></div>)}
      </dl>
    </div>
  );
}
