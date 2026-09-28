import { useEffect, useMemo, useState } from 'react';
import type { WidgetRenderProps } from '../engine/types';
import { ownCmds } from '../engine/marks';
import { fmtNum } from './common';
import { Tex } from '../lib/md';
import { cn } from '../lib/util';

type M = { rows: string[]; cols: string[]; values: (number | string | null)[][] };
interface P { U: M; V: M; R?: M; symbolic?: boolean; showError?: boolean; format?: string | number }

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
function texOf(v: number | string | null, format?: string | number) { return v === null ? '' : typeof v === 'number' ? fmtNum(v, format).replace('−', '-') : v; }
function mulTex(a: number | string | null, b: number | string | null, format?: string | number): string {
  if (a === null || b === null) return '';
  if (isNum(a) && isNum(b)) return fmtNum(a * b, format).replace('−', '-');
  if (a === 1 || a === '1') return texOf(b, format);
  if (b === 1 || b === '1') return texOf(a, format);
  return `${texOf(a, format)}${isNum(b) ? '\\cdot ' : ''}${texOf(b, format)}`;
}

export default function MatrixProduct({ props, cmds, marks, emit }: WidgetRenderProps<P>) {
  const { U, V, R } = props;
  const focus = useMemo(() => {
    let f: { i: number; j: number } | null = null;
    for (const c of ownCmds(cmds)) { if (c.cmd === 'focus') f = { i: Number(c.args?.i ?? 0), j: Number(c.args?.j ?? 0) }; if (c.cmd === 'unfocus') f = null; }
    return f;
  }, [cmds]);
  const d = U?.cols?.length ?? 0;
  const [sweep, setSweep] = useState(-1);
  useEffect(() => {
    if (!focus) { setSweep(-1); return; }
    setSweep(0);
    let k = 0;
    const t = setInterval(() => { k++; setSweep(k); if (k >= d) clearInterval(t); }, 550);
    return () => clearInterval(t);
  }, [focus?.i, focus?.j, d]);
  if (!U?.values || !V?.values) return <div className="card p-3 text-sm text-muted">Waiting for factors…</div>;
  const m = U.rows.length, n = V.cols.length;
  const numeric = !props.symbolic && U.values.flat().every(isNum) && V.values.flat().every(isNum);
  const P: (number | string)[][] = Array.from({ length: m }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      if (numeric) { let s = 0; for (let k = 0; k < d; k++) s += (U.values[i][k] as number) * (V.values[k][j] as number); return s; }
      return Array.from({ length: d }, (_, k) => mulTex(U.values[i][k], V.values[k][j], props.format)).filter(Boolean).join('+');
    }),
  );
  const sel = (kind: string, a: number, b?: number, la?: string, lb?: string) => {
    const keys = b === undefined ? [`${kind}:${a}`, la ? `${kind}:${la}` : ''] : [`${kind}:${a},${b}`, la && lb ? `${kind}:${la},${lb}` : ''];
    for (const k of keys) if (k && marks.tone(k)) return marks.tone(k);
    return undefined;
  };
  const cellCls = 'min-w-[40px] rounded px-1.5 py-0.5 text-center text-[13px] tabular-nums transition-colors duration-300';
  const errStyle = (i: number, j: number): React.CSSProperties | undefined => {
    if (!props.showError || !R || !numeric) return undefined;
    const r = R.values[i]?.[j];
    if (!isNum(r)) return undefined;
    const e = r - (P[i][j] as number);
    const a = Math.min(1, Math.abs(e) / 3) * 0.5;
    return { backgroundColor: e >= 0 ? `rgb(var(--good) / ${a})` : `rgb(var(--bad) / ${a})` };
  };
  const Mat = ({ name, M, cell, rowsLabel = true }: { name: string; M: { rows: string[]; cols: string[] }; cell: (i: number, j: number) => React.ReactNode; rowsLabel?: boolean }) => (
    <div className="flex flex-col items-center">
      <div className="mb-1 text-xs font-semibold text-muted">{name}</div>
      <table className="border-separate border-spacing-0.5">
        <thead><tr>{rowsLabel && <th />}{M.cols.map((c) => <th key={c} className="px-1 text-[10px] font-medium text-muted">{c}</th>)}</tr></thead>
        <tbody>{M.rows.map((r, i) => <tr key={r}>{rowsLabel && <th className="pr-1 text-[10px] font-medium text-muted">{r}</th>}{M.cols.map((_, j) => <td key={j} className="p-0">{cell(i, j)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
  const val = (v: number | string | null) => (isNum(v) ? fmtNum(v, props.format) : v === null ? '' : <Tex tex={String(v)} display={false} />);
  return (
    <div className="card overflow-x-auto p-3 scrollbar-thin">
      <div className="flex min-w-max items-center gap-3">
        <Mat name="U" M={U} cell={(i, k) => (
          <div className={cn(cellCls, 'bg-panel2', focus?.i === i && 'tone-accent mark-bg', focus?.i === i && sweep === k && 'tone-warn mark-bg font-bold', sel('U', i, k, U.rows[i], U.cols[k]) && `tone-${sel('U', i, k, U.rows[i], U.cols[k])} mark-bg`, sel('Urow', i, undefined, U.rows[i]) && `tone-${sel('Urow', i, undefined, U.rows[i])} mark-bg`)}>{val(U.values[i][k])}</div>
        )} />
        <span className="text-xl text-muted">×</span>
        <Mat name="V" M={V} cell={(k, j) => (
          <div className={cn(cellCls, 'bg-panel2', focus?.j === j && 'tone-accent mark-bg', focus?.j === j && sweep === k && 'tone-warn mark-bg font-bold', sel('V', k, j, V.rows[k], V.cols[j]) && `tone-${sel('V', k, j, V.rows[k], V.cols[j])} mark-bg`, sel('Vcol', j, undefined, V.cols[j]) && `tone-${sel('Vcol', j, undefined, V.cols[j])} mark-bg`)}>{val(V.values[k][j])}</div>
        )} />
        <span className="text-xl text-muted">=</span>
        <Mat name="P = UV" M={{ rows: U.rows, cols: V.cols }} cell={(i, j) => (
          <div
            onMouseEnter={() => emit('hover', { i, j })}
            style={errStyle(i, j)}
            className={cn(cellCls, 'bg-panel2', focus && focus.i === i && focus.j === j && (sweep >= d ? 'tone-good mark-bg font-bold' : 'tone-accent mark-bg'), sel('P', i, j, U.rows[i], V.cols[j]) && `tone-${sel('P', i, j, U.rows[i], V.cols[j])} mark-bg`)}
          >
            {focus && focus.i === i && focus.j === j && sweep < d && numeric
              ? fmtNum(Array.from({ length: Math.max(0, sweep + 1) }, (_, k) => (U.values[i][k] as number) * (V.values[k][j] as number)).reduce((a, b) => a + b, 0), props.format)
              : val(P[i][j])}
          </div>
        )} />
        {R && (
          <>
            <span className="text-xl text-muted">≈</span>
            <Mat name="R" M={R} cell={(i, j) => (
              <div className={cn(cellCls, R.values[i][j] === null ? 'bg-panel2/40' : 'bg-panel2', sel('R', i, j, R.rows[i], R.cols[j]) && `tone-${sel('R', i, j, R.rows[i], R.cols[j])} mark-bg`)}>{val(R.values[i][j])}</div>
            )} />
          </>
        )}
      </div>
      {focus && numeric && (
        <div className="mt-2 text-center text-xs text-muted">
          <Tex display={false} tex={`p_{${U.rows[focus.i]},${V.cols[focus.j]}} = ${Array.from({ length: d }, (_, k) => `${fmtNum(U.values[focus.i][k] as number, 3)}\\cdot${fmtNum(V.values[k][focus.j] as number, 3)}`).join(' + ').replace(/−/g, '-')} = ${fmtNum(P[focus.i][focus.j] as number, 3).replace('−', '-')}`} />
        </div>
      )}
      {props.showError && R && numeric && <div className="mt-1 text-center text-[11px] text-muted">P cells tinted by the error r − p on observed entries (green: under-predicts, red: over-predicts)</div>}
    </div>
  );
}
