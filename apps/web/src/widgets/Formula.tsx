import { useEffect, useMemo, useRef } from 'react';
import type { WidgetRenderProps } from '../engine/types';
import { Tex, anchorFromEvent, applyAnchorClasses } from '../lib/md';
import { ownCmds } from '../engine/marks';
import { cn } from '../lib/util';

const TONE_CLASS: Record<string, string> = { accent: 'anc-on', good: 'anc-good', bad: 'anc-bad', warn: 'anc-warn', muted: 'anc-hover' };

export default function Formula({ id, props, cmds, marks, ctx, bind }: WidgetRenderProps<{ tex?: string; steps?: string[]; step?: number; size?: 'sm' | 'md' | 'lg' }>) {
  const ref = useRef<HTMLDivElement>(null);
  const steps = props.steps ?? (props.tex ? [props.tex] : []);
  const step = useMemo(() => {
    let s = typeof props.step === 'number' ? props.step : props.steps ? 0 : 0;
    for (const c of ownCmds(cmds)) {
      if (c.cmd === 'step') s = Number(c.args?.n ?? c.args ?? 0);
      if (c.cmd === 'next') s += 1;
    }
    return Math.max(0, Math.min(s, steps.length - 1));
  }, [props.step, cmds, steps.length]);
  const trace = Object.values(ctx.traces).find((t) => t.formulaTargets.includes(id));
  const tex = steps[step] ?? '';
  useEffect(() => {
    const map: Record<string, string> = {};
    if (ctx.hoverAnchor) map[ctx.hoverAnchor] = 'anc-hover';
    for (const [sel, tone] of Object.entries(marks.tones)) if (sel.startsWith('term:')) map[sel.slice(5)] = TONE_CLASS[tone] ?? 'anc-on';
    if (trace?.math) map[trace.math] = 'anc-on';
    applyAnchorClasses(ref.current, map);
  });
  const size = props.size === 'lg' ? 'text-2xl' : props.size === 'sm' ? 'text-base' : 'text-xl';
  return (
    <div className="card relative px-4 py-3" ref={ref}>
      <Tex
        key={step}
        tex={tex}
        className={cn('anchored-math overflow-x-auto', size)}
        onMouseOver={(e) => { const a = anchorFromEvent(e); if (a) ctx.setHoverAnchor(a); }}
        onMouseOut={(e) => { if (anchorFromEvent(e)) ctx.setHoverAnchor(null); }}
      />
      {steps.length > 1 && (
        <div className="mt-1 flex items-center justify-end gap-1">
          {steps.map((_, i) => (
            <button key={i} aria-label={`formula step ${i + 1}`} onClick={() => bind('step', i)} className={cn('h-1.5 w-4 rounded-full transition', i <= step ? 'bg-accent' : 'bg-line')} />
          ))}
        </div>
      )}
    </div>
  );
}
