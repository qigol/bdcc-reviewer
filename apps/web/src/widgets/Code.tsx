import { useMemo } from 'react';
import type { WidgetRenderProps } from '../engine/types';
import { CodeView } from './CodeView';
import { ownCmds } from '../engine/marks';
import { fmtNum } from './common';

export function varsBadge(vars?: Record<string, any>): string | undefined {
  if (!vars) return undefined;
  const parts = Object.entries(vars).map(([k, v]) => `${k} = ${typeof v === 'number' ? fmtNum(v, 3) : Array.isArray(v) ? `[${v.map((x) => (typeof x === 'number' ? fmtNum(x, 3) : x)).join(', ')}]` : typeof v === 'object' && v ? JSON.stringify(v) : String(v)}`);
  return parts.join(' · ') || undefined;
}

export default function Code({ id, props, marks, cmds, ctx }: WidgetRenderProps<{ source: string; lang?: string; lineNumbers?: boolean; badges?: Record<string, string>; maxHeight?: number; title?: string }>) {
  const trace = Object.values(ctx.traces).find((t) => t.codeTargets.includes(id));
  const badges = useMemo(() => {
    const b: Record<string, string> = { ...(props.badges ?? {}) };
    for (const c of ownCmds(cmds)) if (c.cmd === 'badges') Object.assign(b, c.args ?? {});
    if (trace?.code) { const v = varsBadge(trace.vars); if (v) b[trace.code] = v; }
    return b;
  }, [props.badges, cmds, trace]);
  const anchorTones: Record<string, string> = {};
  const lineTones: Record<number, string> = {};
  for (const [sel, tone] of Object.entries(marks.tones)) {
    if (sel.startsWith('anchor:')) anchorTones[sel.slice(7)] = tone;
    if (sel.startsWith('line:')) lineTones[Number(sel.slice(5))] = tone;
  }
  return (
    <CodeView
      source={props.source}
      lang={props.lang}
      lineNumbers={props.lineNumbers !== false}
      maxHeight={props.maxHeight}
      title={props.title}
      hoverAnchor={ctx.hoverAnchor}
      setHoverAnchor={ctx.setHoverAnchor}
      activeAnchor={trace?.code ?? null}
      badges={badges}
      anchorTones={anchorTones}
      lineTones={lineTones}
    />
  );
}
