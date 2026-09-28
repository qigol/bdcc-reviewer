import { useRef, useState } from 'react';
import type { WidgetRenderProps } from '../engine/types';
import { fmtNum, TONE_FILL } from './common';

interface Vec { id: string; x: number; y: number; label?: string; draggable?: boolean; tone?: string }
interface P { vectors: Vec[]; domain?: number[]; showCoords?: boolean; angleBetween?: string[]; showCosine?: boolean; showProjection?: string[] }
const COLORS = ['accent', 'good', 'warn', 'bad'];

export default function VectorPlot({ props, marks, bind, emit, isBound }: WidgetRenderProps<P>) {
  const [local, setLocal] = useState<Vec[] | null>(null);
  const vecs = (isBound('vectors') ? props.vectors : local ?? props.vectors) ?? [];
  const [lo, hi] = props.domain ?? [-5, 5];
  const S = 300, pad = 18;
  const sx = (x: number) => pad + ((x - lo) / (hi - lo)) * (S - 2 * pad);
  const sy = (y: number) => S - pad - ((y - lo) / (hi - lo)) * (S - 2 * pad);
  const inv = (px: number, py: number) => ({ x: lo + ((px - pad) / (S - 2 * pad)) * (hi - lo), y: lo + ((S - pad - py) / (S - 2 * pad)) * (hi - lo) });
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const move = (e: React.PointerEvent) => {
    if (!drag || !svg.current) return;
    const r = svg.current.getBoundingClientRect();
    const p = inv(((e.clientX - r.left) / r.width) * S, ((e.clientY - r.top) / r.height) * S);
    const snap = (v: number) => Math.max(lo, Math.min(hi, Math.round(v * 10) / 10));
    const next = vecs.map((v) => (v.id === drag ? { ...v, x: snap(p.x), y: snap(p.y) } : v));
    setLocal(next);
    bind('vectors', next);
    emit('change', next);
  };
  const get = (id?: string) => vecs.find((v) => v.id === id);
  const [a, b] = (props.angleBetween ?? []).map(get);
  const cos = a && b ? (a.x * b.x + a.y * b.y) / ((Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y)) || NaN) : NaN;
  const angA = a ? Math.atan2(a.y, a.x) : 0, angB = b ? Math.atan2(b.y, b.x) : 0;
  const arcR = 34;
  let d0 = angA, d1 = angB;
  if (Math.abs(d1 - d0) > Math.PI) { if (d1 > d0) d0 += 2 * Math.PI; else d1 += 2 * Math.PI; }
  const arc = a && b ? `M ${sx(0) + arcR * Math.cos(d0)} ${sy(0) - arcR * Math.sin(d0)} A ${arcR} ${arcR} 0 0 ${d1 > d0 ? 0 : 1} ${sx(0) + arcR * Math.cos(d1)} ${sy(0) - arcR * Math.sin(d1)}` : '';
  const [pa, pb] = (props.showProjection ?? []).map(get);
  const proj = pa && pb ? (() => { const k = (pa.x * pb.x + pa.y * pb.y) / (pb.x * pb.x + pb.y * pb.y || 1); return { x: k * pb.x, y: k * pb.y }; })() : null;
  // Label layout: tip-anchored, coordinates only for small plots, then pushed apart vertically so crowded plots stay legible.
  const showCoords = props.showCoords ?? vecs.length <= 3;
  const labels = (() => {
    const L = vecs.map((v) => {
      const right = sx(v.x) > S * 0.55;
      return { id: v.id, x: sx(v.x) + (right ? -6 : 6), y: sy(v.y) + (sy(v.y) < 24 ? 16 : -6), anchor: right ? 'end' : 'start',
        text: showCoords ? `${v.label ?? v.id} (${fmtNum(v.x, 1)}, ${fmtNum(v.y, 1)})` : (v.label ?? v.id) };
    });
    for (const side of ['start', 'end']) {
      const g = L.filter((l) => l.anchor === side).sort((p, q) => p.y - q.y);
      for (let i = 1; i < g.length; i++) if (g[i].y - g[i - 1].y < 14) g[i].y = g[i - 1].y + 14;
    }
    return Object.fromEntries(L.map((l) => [l.id, l]));
  })();
  const ticks = Array.from({ length: Math.floor(hi) - Math.ceil(lo) + 1 }, (_, i) => Math.ceil(lo) + i);
  return (
    <div className="card p-2">
      <svg ref={svg} viewBox={`0 0 ${S} ${S}`} className="mx-auto block w-full max-w-[400px] touch-none select-none overflow-visible" onPointerMove={move} onPointerUp={() => setDrag(null)} onPointerLeave={() => setDrag(null)} role="img" aria-label="vector plot">
        <defs>
          {COLORS.concat(['muted']).map((c) => (
            <marker key={c} id={`arr-${c}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={TONE_FILL[c]} /></marker>
          ))}
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={sx(t)} x2={sx(t)} y1={pad} y2={S - pad} stroke="rgb(var(--line))" strokeWidth={t === 0 ? 1.4 : 0.6} />
            <line y1={sy(t)} y2={sy(t)} x1={pad} x2={S - pad} stroke="rgb(var(--line))" strokeWidth={t === 0 ? 1.4 : 0.6} />
          </g>
        ))}
        {arc && <path d={arc} fill="none" stroke="rgb(var(--warn))" strokeWidth={2} />}
        {proj && pa && <><line x1={sx(pa.x)} y1={sy(pa.y)} x2={sx(proj.x)} y2={sy(proj.y)} stroke="rgb(var(--muted))" strokeDasharray="4 3" /><circle cx={sx(proj.x)} cy={sy(proj.y)} r={3} fill="rgb(var(--muted))" /></>}
        {vecs.map((v, i) => {
          const tone = marks.tone(`vec:${v.id}`) ?? v.tone ?? COLORS[i % COLORS.length];
          return (
            <g key={v.id}>
              <line x1={sx(0)} y1={sy(0)} x2={sx(v.x)} y2={sy(v.y)} stroke={TONE_FILL[tone]} strokeWidth={marks.tone(`vec:${v.id}`) ? 4 : 2.6} markerEnd={`url(#arr-${tone})`} />
              <text x={labels[v.id].x} y={labels[v.id].y} textAnchor={labels[v.id].anchor as 'start' | 'end'} fontSize={12} fontWeight={600} fill={TONE_FILL[tone]} stroke="rgb(var(--panel))" strokeWidth={3} paintOrder="stroke">{labels[v.id].text}</text>
              {v.draggable && <circle cx={sx(v.x)} cy={sy(v.y)} r={9} fill={TONE_FILL[tone]} fillOpacity={0.2} stroke={TONE_FILL[tone]} className="cursor-grab" onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); setDrag(v.id); }} />}
            </g>
          );
        })}
      </svg>
      {props.showCosine && a && b && (
        <div className="mt-1 text-center text-sm">
          cos θ = <b className="font-mono text-accent">{Number.isFinite(cos) ? fmtNum(cos, 2) : '0 (zero vector)'}</b>
          <span className="ml-2 text-xs text-muted">θ ≈ {Number.isFinite(cos) ? fmtNum((Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI, 0) : '—'}°</span>
        </div>
      )}
    </div>
  );
}
