import { useEffect, useRef, useState } from 'react';
import type { WidgetRenderProps } from '../engine/types';
import { fmtNum } from './common';
import { Markdown } from '../lib/md';

interface S { name: string; x?: (number | string)[]; y: number[] }
interface P { kind: 'line' | 'bar' | 'scatter'; series: S[]; xLabel?: string; yLabel?: string; logY?: boolean; title?: string }
const COLORS = ['rgb(var(--accent))', 'rgb(var(--good))', 'rgb(var(--warn))', 'rgb(var(--bad))', '#0ea5e9', '#8b5cf6'];

function niceTicks(min: number, max: number, n = 5): number[] {
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  const step0 = span / n;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= n) ?? step0;
  const start = Math.floor(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + step * 0.5; v += step) out.push(Number(v.toPrecision(10)));
  return out;
}

export default function Chart({ props, marks }: WidgetRenderProps<P>) {
  const series = (Array.isArray(props.series) ? props.series : []).filter((s) => s && Array.isArray(s.y));
  // Match the viewBox to the real width so narrow side-panel charts keep readable text.
  const box = useRef<HTMLDivElement>(null);
  const [cw, setCw] = useState(560);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setCw(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const W = Math.max(300, Math.min(560, cw || 560)), H = W < 420 ? 220 : 260, L = 52, R = 16, T = 16, B = 40;
  const categorical = series.some((s) => s.x?.some((x) => typeof x === 'string')) || props.kind === 'bar';
  const n = Math.max(1, ...series.map((s) => s.y.length));
  const xs = (s: S) => s.x ?? s.y.map((_, i) => i + 1);
  const allY = series.flatMap((s) => s.y.filter((v) => Number.isFinite(v)));
  const tr = (v: number) => (props.logY ? Math.log10(Math.max(v, 1e-9)) : v);
  let yMin = Math.min(...allY.map(tr)), yMax = Math.max(...allY.map(tr));
  if (!allY.length) { yMin = 0; yMax = 1; }
  if (props.kind === 'bar' && !props.logY) yMin = Math.min(0, yMin);
  const pad = (yMax - yMin) * 0.08 || 1;
  const nonNeg = allY.length > 0 && Math.min(...allY) >= 0 && !props.logY;
  if (props.kind !== 'bar') { yMin = nonNeg ? Math.max(0, yMin - pad) : yMin - pad; } yMax += pad;
  const ticks = niceTicks(yMin, yMax).filter((t) => !nonNeg || t >= 0);
  yMin = Math.min(yMin, ticks[0]); yMax = Math.max(yMax, ticks[ticks.length - 1]);
  const numX = !categorical ? series.flatMap((s) => xs(s) as number[]) : [];
  const xMin = numX.length ? Math.min(...numX) : 0, xMax = numX.length ? Math.max(...numX) : 1;
  const sx = (x: number | string, i: number) => categorical ? L + ((i + 0.5) / n) * (W - L - R) : L + ((Number(x) - xMin) / (xMax - xMin || 1)) * (W - L - R);
  const sy = (v: number) => T + (1 - (tr(v) - yMin) / (yMax - yMin || 1)) * (H - T - B);
  const cats = categorical ? (series[0] ? xs(series[0]) : []) : [];
  const bw = ((W - L - R) / n) * 0.8 / Math.max(1, series.length);
  return (
    <div ref={box} className="card p-3">
      {props.title && <div className="mb-1 text-xs font-semibold text-muted"><Markdown text={props.title} inline /></div>}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={props.title ?? 'chart'}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={sy(props.logY ? Math.pow(10, t) : t)} y2={sy(props.logY ? Math.pow(10, t) : t)} stroke="rgb(var(--line))" strokeDasharray="3 3" />
            <text x={L - 6} y={sy(props.logY ? Math.pow(10, t) : t) + 4} textAnchor="end" fontSize={10.5} fill="rgb(var(--muted))">{props.logY ? fmtNum(Math.pow(10, t), 0) : fmtNum(t)}</text>
          </g>
        ))}
        <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="rgb(var(--muted))" />
        {categorical
          ? cats.map((c, i) => <text key={i} x={sx(c, i)} y={H - B + 15} textAnchor="middle" fontSize={10.5} fill="rgb(var(--muted))">{String(c)}</text>)
          : niceTicks(xMin, xMax, 6).filter((t) => t >= xMin && t <= xMax).map((t) => <text key={t} x={sx(t, 0)} y={H - B + 15} textAnchor="middle" fontSize={10.5} fill="rgb(var(--muted))">{fmtNum(t)}</text>)}
        {series.map((s, si) => {
          const color = COLORS[si % COLORS.length];
          const tone = marks.tone(`series:${s.name}`);
          const w = tone ? 3.5 : 2;
          const pts = s.y.map((v, i) => [sx(xs(s)[i] as any, i), sy(v)] as const).filter(([, y]) => Number.isFinite(y));
          if (props.kind === 'bar')
            return s.y.map((v, i) => {
              const x = sx(cats[i] ?? i, i) - (bw * series.length) / 2 + si * bw;
              const y0 = sy(Math.max(yMin, 0)), y1 = sy(v);
              return <rect key={`${si}-${i}`} x={x} y={Math.min(y0, y1)} width={bw - 2} height={Math.abs(y0 - y1)} rx={3} fill={color} opacity={marks.tone(`point:${s.name},${i}`) ? 1 : 0.8} style={{ transition: 'all .4s' }} />;
            });
          return (
            <g key={si}>
              {props.kind === 'line' && <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={color} strokeWidth={w} strokeLinejoin="round" style={{ transition: 'all .4s' }} />}
              {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={marks.tone(`point:${s.name},${i}`) ? 6 : props.kind === 'scatter' ? 4.5 : 3} fill={color} />)}
            </g>
          );
        })}
        {props.xLabel && <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="rgb(var(--muted))">{props.xLabel}</text>}
        {props.yLabel && <text x={12} y={(T + H - B) / 2} textAnchor="middle" fontSize={11} fill="rgb(var(--muted))" transform={`rotate(-90 12 ${(T + H - B) / 2})`}>{props.yLabel}</text>}
      </svg>
      {series.length > 1 && (
        <div className="flex flex-wrap justify-center gap-3 text-xs text-muted">
          {series.map((s, i) => <span key={s.name} className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />{s.name}</span>)}
        </div>
      )}
    </div>
  );
}
