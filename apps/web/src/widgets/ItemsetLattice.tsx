import { useMemo } from 'react';
import { combinations, key as setKey, isSubset } from '@kodigo/sdk';
import type { WidgetRenderProps } from '../engine/types';
import { ownCmds } from '../engine/marks';
import { abbreviations, asList, TONE_FILL } from './common';
import { cn } from '../lib/util';

interface P { items: string[]; support?: Record<string, number>; minsup?: number; maxLevel?: number; showSupport?: boolean; showEmpty?: boolean; selection?: string[] }
const NODE_W = 56, NODE_H = 26, GAP_X = 6, LEVEL_H = 74;

export default function ItemsetLattice({ props, cmds, marks, ctx, bind, emit }: WidgetRenderProps<P>) {
  const items = props.items ?? [];
  const maxLevel = Math.min(props.maxLevel ?? Math.min(items.length, 4), items.length);
  const abbr = useMemo(() => abbreviations(items, ctx.labels), [items, ctx.labels]);
  const { pruned, visibleMax } = useMemo(() => {
    const pruned: string[][] = [];
    let visibleMax = maxLevel;
    for (const c of ownCmds(cmds)) {
      if (c.cmd === 'prune') for (const s of asList(c.args?.sel)) pruned.push(s.replace(/^set:/, '').split(',').filter(Boolean));
      if (c.cmd === 'reveal') visibleMax = Math.min(maxLevel, Number(c.args?.level ?? maxLevel));
      if (c.cmd === 'hideAbove') visibleMax = Math.min(maxLevel, Number(c.args?.level ?? maxLevel));
    }
    return { pruned, visibleMax };
  }, [cmds, maxLevel]);
  const levels = useMemo(() => {
    const out: string[][][] = [];
    for (let k = props.showEmpty ? 0 : 1; k <= maxLevel; k++) out.push(k === 0 ? [[]] : combinations(items, k));
    return out;
  }, [items, maxLevel, props.showEmpty]);
  const width = Math.max(...levels.map((l) => l.length)) * (NODE_W + GAP_X) + 20;
  const pos = new Map<string, { x: number; y: number }>();
  levels.forEach((lvl, li) => {
    const rowW = lvl.length * (NODE_W + GAP_X) - GAP_X;
    lvl.forEach((s, i) => pos.set(setKey(s, items), { x: (width - rowW) / 2 + i * (NODE_W + GAP_X) + NODE_W / 2, y: 20 + li * LEVEL_H + NODE_H / 2 }));
  });
  const height = levels.length * LEVEL_H - (LEVEL_H - NODE_H) + 44;
  const sel = props.selection ?? [];
  const isPruned = (s: string[]) => pruned.some((p) => isSubset(p, s));
  const edges: [string, string][] = [];
  levels.forEach((lvl, li) => {
    if (li + 1 >= levels.length) return;
    for (const s of lvl) for (const t of levels[li + 1]) if (isSubset(s, t)) edges.push([setKey(s, items), setKey(t, items)]);
  });
  const levelOf = (k: string) => (k ? k.split(',').length : 0);

  return (
    <div className="card overflow-x-auto p-2 scrollbar-thin">
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', minWidth: Math.min(width, 520), maxWidth: width * 1.15, maxHeight: height * 1.15 }} className="mx-auto block" role="img" aria-label="itemset lattice">
        {edges.map(([a, b]) => {
          if (levelOf(b) > visibleMax) return null;
          const pa = pos.get(a)!, pb = pos.get(b)!;
          const dim = isPruned(b.split(','));
          return <line key={a + '>' + b} x1={pa.x} y1={pa.y + NODE_H / 2} x2={pb.x} y2={pb.y - NODE_H / 2} stroke="rgb(var(--line))" strokeWidth={1} opacity={dim ? 0.3 : 0.9} />;
        })}
        {levels.flat().map((s) => {
          const k = setKey(s, items);
          const lvl = s.length;
          if (lvl > visibleMax) return null;
          const p = pos.get(k)!;
          const sup = props.support?.[k];
          const hasMin = typeof props.minsup === 'number' && typeof sup === 'number';
          const frequent = hasMin && sup! >= props.minsup!;
          const pr = isPruned(s);
          const tone = marks.tone(`set:${k}`) ?? marks.tone(`level:${lvl}`);
          const selected = sel.length > 0 && setKey(sel, items) === k;
          const fill = tone ? TONE_FILL[tone] : pr ? 'rgb(var(--panel2))' : hasMin ? (frequent ? 'rgb(var(--good))' : 'rgb(var(--panel2))') : 'rgb(var(--panel))';
          const fillOpacity = tone ? 0.22 : hasMin && frequent && !pr ? 0.2 : 1;
          const stroke = tone ? TONE_FILL[tone] : selected ? 'rgb(var(--accent))' : pr ? 'rgb(var(--line))' : hasMin && frequent ? 'rgb(var(--good))' : 'rgb(var(--line))';
          const label = lvl === 0 ? '∅' : s.map((i) => abbr[i]).join('·');
          const pulse = marks.pulse(`set:${k}`);
          return (
            <g
              key={k || 'empty'}
              transform={`translate(${p.x - NODE_W / 2}, ${p.y - NODE_H / 2})`}
              className={cn('cursor-pointer', pulse && 'pulse')}
              onClick={() => { bind('selection', s); emit('nodeClick', { set: s, key: k }); }}
            >
              <title>{`{${s.map((i) => ctx.labels[i] ?? i).join(', ')}}${typeof sup === 'number' ? ` · support ${sup}` : ''}${pr ? ' · pruned' : ''}`}</title>
              <rect width={NODE_W} height={NODE_H} rx={7} fill={fill} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={selected || tone ? 2 : 1.2} strokeDasharray={pr ? '4 3' : undefined} style={{ transition: 'all .35s' }} />
              {pulse && <rect width={NODE_W} height={NODE_H} rx={7} fill="none" stroke="rgb(var(--accent))" strokeWidth={2}><animate attributeName="opacity" values="1;0;1;0" dur="1.2s" /></rect>}
              <text x={NODE_W / 2} y={NODE_H / 2 + 4.5} textAnchor="middle" fontSize={12.5} fontWeight={600} fill={pr ? 'rgb(var(--muted))' : 'rgb(var(--ink))'} style={{ textDecoration: pr ? 'line-through' : undefined }}>{label}</text>
              {props.showSupport && typeof sup === 'number' && (
                <text x={NODE_W / 2} y={NODE_H + 13} textAnchor="middle" fontSize={10.5} fill={frequent && !pr ? 'rgb(var(--good))' : 'rgb(var(--muted))'} fontWeight={600}>{sup}</text>
              )}
              {marks.note(`set:${k}`) && <text x={NODE_W / 2} y={-5} textAnchor="middle" fontSize={10} fill="rgb(var(--accent))">{marks.note(`set:${k}`)}</text>}
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1 px-2 text-[11px] text-muted">
        {items.map((i) => <span key={i}><b className="text-ink">{abbr[i]}</b> = {ctx.labels[i] ?? i}</span>)}
        {typeof props.minsup === 'number' && <span className="ml-2"><span className="inline-block h-2 w-3 rounded-sm bg-good/40 align-middle" /> support ≥ {props.minsup}</span>}
      </div>
    </div>
  );
}
