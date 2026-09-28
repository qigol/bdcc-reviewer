import { useEffect, useMemo, useRef } from 'react';
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import type { WidgetRenderProps, TraceView, WidgetCommand } from '../engine/types';
import { useTracePlayer, traceCommands } from '../engine/trace';
import { Markdown } from '../lib/md';

interface P { fn: string; in: Record<string, any>; roles: Record<string, string>; autoplay?: boolean; speed?: number; loop?: boolean; showLabel?: boolean; out?: string }

export default function StepPlayer({ id, props, ctx, emit }: WidgetRenderProps<P>) {
  const t = useTracePlayer(ctx.mod, props.fn, props.in, { speed: props.speed, autoplay: props.autoplay, loop: props.loop });
  const { byRole, patch } = useMemo(() => traceCommands(t.steps, t.index), [t.steps, t.index]);
  const cur = t.index >= 0 ? t.steps[t.index] : undefined;
  const roles = props.roles ?? {};
  const lastKey = useRef('');

  useEffect(() => {
    const cmds: Record<string, WidgetCommand[]> = {};
    for (const [role, list] of Object.entries(byRole)) {
      const target = roles[role];
      if (target) cmds[target] = list;
    }
    const view: TraceView = {
      cmds,
      patch: props.out && t.result ? { ...patch, [props.out]: t.result } : patch,
      code: cur?.code,
      math: cur?.math,
      vars: cur?.vars,
      label: cur?.label,
      codeTargets: roles.code ? [roles.code] : [],
      formulaTargets: roles.formula ? [roles.formula] : [],
    };
    const key = JSON.stringify([view.cmds, patch, view.code, view.math, view.vars, view.label, props.out && t.result ? t.index : null, !!t.result]);
    if (key === lastKey.current) return;
    lastKey.current = key;
    ctx.registerTrace(id, view);
  }, [byRole, patch, cur, t.result]);
  useEffect(() => () => ctx.registerTrace(id, null), []);

  const api = useRef(t);
  api.current = t;
  useEffect(() => {
    ctx.registerPlayer(id, {
      toggle: () => api.current.toggle(), play: () => api.current.play(), pause: () => api.current.pause(),
      step: () => api.current.step(), back: () => api.current.back(), reset: () => api.current.reset(), goto: (n) => api.current.setIndex(n),
    });
    return () => ctx.registerPlayer(id, null);
  }, []);

  const lastEmitted = useRef(-2);
  useEffect(() => {
    if (t.index === lastEmitted.current) return;
    lastEmitted.current = t.index;
    if (t.index >= 0) emit('step', { index: t.index });
    if (t.steps.length && t.index === t.steps.length - 1) emit('done');
  }, [t.index, t.steps.length]);

  const n = t.steps.length;
  const labelScope = useMemo(() => ({ ...ctx.scope, ...(cur?.vars ?? {}) }), [ctx.scope, cur]);
  return (
    <div className="card px-3 py-2.5" data-testid="step-player">
      {props.showLabel !== false && (
        <div className="mb-2 min-h-[1.6rem] text-sm">
          {t.error ? <span className="text-bad">{t.error}</span> : cur ? <Markdown text={cur.label} scope={labelScope} /> : <span className="text-muted">Press ▶ to play the algorithm step by step ({n} steps).</span>}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <button className="btn-ghost btn-sm" aria-label="reset" onClick={t.reset}><RotateCcw size={15} /></button>
        <button className="btn-ghost btn-sm" aria-label="previous step" onClick={t.back} disabled={t.index < 0}><SkipBack size={15} /></button>
        <button className="btn-primary btn-sm w-9" aria-label={t.playing ? 'pause' : 'play'} onClick={t.toggle} disabled={!n}>{t.playing ? <Pause size={15} /> : <Play size={15} />}</button>
        <button className="btn-ghost btn-sm" aria-label="next step" onClick={t.step} disabled={t.index >= n - 1}><SkipForward size={15} /></button>
        <input type="range" aria-label="scrub" className="mx-1 flex-1 accent-[rgb(var(--accent))]" min={-1} max={Math.max(-1, n - 1)} value={t.index} onChange={(e) => { t.pause(); t.setIndex(Number(e.target.value)); }} />
        <span className="w-14 text-right font-mono text-xs text-muted tabular-nums">{t.index + 1}/{n}</span>
        <select aria-label="speed" className="input py-0.5 text-xs" value={t.speed} onChange={(e) => t.setSpeed(Number(e.target.value))}>
          {[0.5, 1, 2, 4].map((s) => <option key={s} value={s}>{s}×</option>)}
        </select>
      </div>
    </div>
  );
}
