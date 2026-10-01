import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { WidgetRenderProps } from '../engine/types';
import { ownCmds } from '../engine/marks';
import { AnimatedNumber, asList, fmtNum } from './common';
import { Tex, Markdown } from '../lib/md';
import { cn } from '../lib/util';

type Cell = number | string | null;
interface P {
  data?: { rows: string[]; cols: string[]; values: Cell[][] };
  rows?: string[]; cols?: string[]; values?: Cell[][];
  format?: string | number; editable?: boolean | { min?: number; max?: number; step?: number };
  heatmap?: 'none' | 'seq' | 'div'; showRowMeans?: boolean; meanLabel?: string; emptyLabel?: string; title?: string; rowHeader?: string;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export default function Matrix({ props, cmds, marks, ctx, bind, emit, isBound }: WidgetRenderProps<P>) {
  const base = props.data ?? { rows: props.rows ?? [], cols: props.cols ?? [], values: props.values ?? [] };
  const [edited, setEdited] = useState<Cell[][] | null>(null);
  const [editing, setEditing] = useState<[number, number] | null>(null);
  const values0 = (isBound('values') ? base.values : edited ?? base.values) ?? [];
  const { centered, transposed, fills, mask } = useMemo(() => {
    let centered = false, transposed = false;
    const fills: Record<string, number> = {};
    let mask: string[] | null = null;
    for (const c of ownCmds(cmds)) {
      if (c.cmd === 'center') centered = true;
      if (c.cmd === 'uncenter') centered = false;
      if (c.cmd === 'transpose') transposed = !transposed;
      if (c.cmd === 'fill') fills[String(c.args?.cell ?? '').replace(/\s/g, '')] = Number(c.args?.value);
      if (c.cmd === 'mask') mask = asList(c.args?.sel);
    }
    return { centered, transposed, fills, mask };
  }, [cmds]);

  const rowsL = base.rows ?? [];
  const colsL = base.cols ?? [];
  const means = values0.map((r) => { const o = (r ?? []).filter(isNum); return o.length ? o.reduce((a, b) => a + b, 0) / o.length : NaN; });
  // cell value after fills and centering (in original orientation)
  const valueAt = (i: number, j: number): { v: Cell; filled: boolean } => {
    const k = `${rowsL[i]},${colsL[j]}`;
    if (k in fills) return { v: centered && isNum(fills[k]) ? fills[k] - (Number.isFinite(means[i]) ? means[i] : 0) : fills[k], filled: true };
    const raw = values0[i]?.[j] ?? null;
    if (centered && isNum(raw) && Number.isFinite(means[i])) return { v: raw - means[i], filled: false };
    return { v: raw, filled: false };
  };
  const R = transposed ? colsL : rowsL;
  const C = transposed ? rowsL : colsL;
  const get = (i: number, j: number) => (transposed ? valueAt(j, i) : valueAt(i, j));
  const labelRow = (i: number) => R[i];
  const labelCol = (j: number) => C[j];
  const cellKey = (i: number, j: number) => (transposed ? `${colsL[j] ?? ''},${rowsL[i] ?? ''}` : `${rowsL[i]},${colsL[j]}`);
  const origRC = (i: number, j: number) => (transposed ? [C[j], R[i]] : [R[i], C[j]]);

  const allNums = values0.flat().filter(isNum);
  const maxAbs = Math.max(1e-9, ...R.flatMap((_, i) => C.map((_, j) => get(i, j).v)).filter(isNum).map(Math.abs));
  const [minV, maxV] = allNums.length ? [Math.min(...allNums), Math.max(...allNums)] : [0, 1];
  const heat = (v: Cell): React.CSSProperties | undefined => {
    if (!isNum(v) || !props.heatmap || props.heatmap === 'none') return undefined;
    if (props.heatmap === 'div') {
      const a = Math.min(1, Math.abs(v) / maxAbs) * 0.45;
      return { backgroundColor: v >= 0 ? `rgb(var(--good) / ${a})` : `rgb(var(--bad) / ${a})` };
    }
    const t = (v - minV) / (maxV - minV || 1);
    return { backgroundColor: `rgb(var(--accent) / ${0.06 + t * 0.4})` };
  };
  const masked = (i: number, j: number) => {
    if (!mask) return false;
    const [r, c] = origRC(i, j);
    return !mask.some((s) => s === `cell:${r},${c}` || s === `row:${r}` || s === `col:${c}`);
  };
  const toneAt = (i: number, j: number) => {
    const [r, c] = origRC(i, j);
    return marks.tone(`cell:${r},${c}`) ?? marks.tone(`row:${r}`) ?? marks.tone(`col:${c}`) ?? (get(i, j).v === null ? marks.tone('missing') : undefined);
  };
  const edOpts = typeof props.editable === 'object' ? props.editable : {};
  const commit = (i: number, j: number, text: string) => {
    const [ri, cj] = transposed ? [j, i] : [i, j];
    const next = values0.map((r) => [...r]);
    const t = text.trim();
    let v: Cell = t === '' ? null : Number(t);
    if (v !== null && !Number.isFinite(v)) v = values0[ri][cj];
    if (isNum(v) && edOpts.min !== undefined) v = Math.max(edOpts.min, v);
    if (isNum(v) && edOpts.max !== undefined) v = Math.min(edOpts.max, v);
    next[ri][cj] = v;
    setEdited(next);
    bind('values', next);
    emit('change', { row: rowsL[ri], col: colsL[cj], value: v, values: next });
    setEditing(null);
  };
  const showMeans = props.showRowMeans && !transposed;

  return (
    <div className="card overflow-x-auto p-2 scrollbar-thin">
      {props.title && <div className="mb-1.5 px-1 text-xs font-semibold text-muted"><Markdown text={props.title} inline /></div>}
      <table className="mx-auto border-separate border-spacing-0.5 text-sm tabular-nums">
        <thead>
          <tr>
            <th className="px-2 py-1 text-xs text-muted">{props.rowHeader ?? ''}</th>
            {C.map((c, j) => (
              <th key={c} className={cn('min-w-[46px] rounded-md bg-ink/85 px-2 py-1 text-center text-xs font-semibold text-panel', marks.tone(`col:${c}`) && `tone-${marks.tone(`col:${c}`)} mark-bg !text-ink`)}>{labelCol(j)}</th>
            ))}
            {showMeans && <th className="min-w-[54px] rounded-md bg-ink/60 px-2 py-1 text-center text-xs text-panel"><Tex tex={props.meanLabel ?? '\\mu_u'} display={false} /></th>}
          </tr>
        </thead>
        <tbody>
          {R.map((r, i) => (
            <tr key={r}>
              <th className={cn('rounded-md bg-ink/85 px-2 py-1 text-center text-xs font-semibold text-panel', marks.tone(`row:${r}`) && `tone-${marks.tone(`row:${r}`)} mark-bg !text-ink`)}>{labelRow(i)}</th>
              {C.map((c, j) => {
                const { v, filled } = get(i, j);
                const tone = toneAt(i, j);
                const [or, oc] = origRC(i, j);
                const pulse = marks.pulse(`cell:${or},${oc}`);
                const isEditing = editing && editing[0] === i && editing[1] === j;
                return (
                  <td
                    key={c}
                    style={tone ? undefined : heat(v)}
                    onClick={() => { if (props.editable) setEditing([i, j]); bind('selection', { row: or, col: oc }); emit('select', { row: or, col: oc }); }}
                    className={cn(
                      'relative min-w-[46px] rounded-md px-2 py-1 text-center transition-colors duration-300',
                      v === null ? 'bg-panel2/60 text-muted' : 'bg-panel2',
                      tone && `tone-${tone} mark-bg font-semibold`,
                      masked(i, j) && 'opacity-25',
                      props.editable && 'cursor-text hover:ring-1 hover:ring-accent/50',
                      pulse && 'pulse',
                      marks.note(`cell:${or},${oc}`) && 'pb-0.5 pt-3.5',
                    )}
                    title={marks.note(`cell:${or},${oc}`)}
                  >
                    {isEditing ? (
                      <input
                        autoFocus
                        type="number"
                        step={edOpts.step ?? 1}
                        min={edOpts.min}
                        max={edOpts.max}
                        defaultValue={isNum(values0[transposed ? j : i]?.[transposed ? i : j]) ? String(values0[transposed ? j : i][transposed ? i : j]) : ''}
                        className="w-14 rounded border border-accent bg-panel px-1 text-center outline-none"
                        onBlur={(e) => commit(i, j, e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') commit(i, j, (e.target as HTMLInputElement).value); if (e.key === 'Escape') setEditing(null); }}
                      />
                    ) : filled ? (
                      <motion.span key={String(v)} initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }} className="inline-block font-semibold text-accent">
                        {isNum(v) ? fmtNum(v, props.format) : String(v ?? '')}
                      </motion.span>
                    ) : isNum(v) ? (
                      <AnimatedNumber value={v} format={props.format} reduced={ctx.reducedMotion} />
                    ) : typeof v === 'string' ? (
                      <Tex tex={v} display={false} />
                    ) : (
                      props.emptyLabel ?? ''
                    )}
                    {marks.note(`cell:${or},${oc}`) && <span className="absolute left-1/2 top-0.5 -translate-x-1/2 whitespace-nowrap rounded bg-accent px-1 text-[9px] leading-tight text-white">{marks.note(`cell:${or},${oc}`)}</span>}
                  </td>
                );
              })}
              {showMeans && (
                <td className={cn('rounded-md bg-panel2 px-2 py-1 text-center font-semibold', marks.tone(`mean:${r}`) && `tone-${marks.tone(`mean:${r}`)} mark-bg`, marks.pulse(`mean:${r}`) && 'pulse')}>
                  {Number.isFinite(means[i]) ? fmtNum(means[i], props.format === 'int' ? 2 : props.format) : '—'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {centered && <div className="mt-1 text-center text-[11px] text-muted">mean-centered: each observed rating minus its row mean</div>}
    </div>
  );
}
