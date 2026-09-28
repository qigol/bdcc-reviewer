import { useEffect, useMemo, useRef, useState } from 'react';
import type { WidgetRenderProps } from '../engine/types';
import { ownCmds } from '../engine/marks';
import { fmtNum } from './common';
import { Tex } from '../lib/md';
import { stableHash } from '../lib/util';

interface P { fn: string; args?: Record<string, any>; domain: number[]; samples?: number; x?: number; draggable?: boolean; showTangent?: boolean; showMin?: boolean; xLabel?: string; yLabel?: string }

export default function FunctionPlot({ props, cmds, marks, ctx, bind, emit, isBound }: WidgetRenderProps<P>) {
  const [a, b] = props.domain ?? [0, 1];
  const n = props.samples ?? 80;
  const [pts, setPts] = useState<{ x: number; y: number }[]>([]);
  const [localX, setLocalX] = useState<number | null>(null);
  const argsKey = stableHash(props.args ?? {});
  // Derived args arrive asynchronously; don't call logic until all of them are present.
  const ready = !Object.values(props.args ?? {}).some((v) => v === null || v === undefined);
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    const xs = Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
    Promise.all(xs.map((x) => ctx.mod.logic.call(props.fn, { ...(props.args ?? {}), x }).then((r: any) => ({ x, y: Number(r?.y) })))).then((p) => alive && setPts(p)).catch((e) => console.warn('[FunctionPlot]', e));
    return () => { alive = false; };
  }, [props.fn, argsKey, a, b, n, ready]);
  const { animX, showMinCmd } = useMemo(() => {
    let animX: number | null = null, showMinCmd = false;
    for (const c of ownCmds(cmds)) { if (c.cmd === 'animateTo') animX = Number(c.args?.x); if (c.cmd === 'markMin') showMinCmd = true; }
    return { animX, showMinCmd };
  }, [cmds]);
  const x = animX ?? (isBound('x') ? props.x : localX ?? props.x);
  const [yAt, setYAt] = useState<{ y: number; slope: number } | null>(null);
  useEffect(() => {
    if (typeof x !== 'number' || !ready) { setYAt(null); return; }
    const h = (b - a) / 2000;
    Promise.all([x - h, x, x + h].map((xx) => ctx.mod.logic.call(props.fn, { ...(props.args ?? {}), x: xx }).then((r: any) => Number(r?.y)))).then(([y0, y1, y2]) => setYAt({ y: y1, slope: (y2 - y0) / (2 * h) })).catch(() => setYAt(null));
  }, [x, props.fn, argsKey, ready]);
  const W = 520, H = 260, L = 48, R = 14, T = 14, B = 34;
  const ys = pts.map((p) => p.y).filter(Number.isFinite);
  const yMin = ys.length ? Math.min(...ys) : 0, yMax = ys.length ? Math.max(...ys) : 1;
  const sx = (v: number) => L + ((v - a) / (b - a || 1)) * (W - L - R);
  const sy = (v: number) => T + (1 - (v - yMin) / (yMax - yMin || 1)) * (H - T - B);
  // Grid minimum, refined by fitting a parabola through its two neighbours.
  const min = useMemo(() => {
    let k = -1;
    pts.forEach((p, i) => { if (Number.isFinite(p.y) && (k < 0 || p.y < pts[k].y)) k = i; });
    if (k < 0) return null;
    if (k === 0 || k === pts.length - 1) return pts[k];
    const [p0, p1, p2] = [pts[k - 1], pts[k], pts[k + 1]];
    const den = p0.y - 2 * p1.y + p2.y;
    if (!(den > 0)) return p1;
    const h = p1.x - p0.x;
    const x = p1.x + (h * (p0.y - p2.y)) / (2 * den);
    const y = p1.y - ((p0.y - p2.y) ** 2) / (8 * den);
    return { x, y };
  }, [pts]);
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState(false);
  const onMove = (e: React.PointerEvent) => {
    if (!drag || !svg.current || !props.draggable) return;
    const r = svg.current.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const nx = Math.max(a, Math.min(b, a + ((px - L) / (W - L - R)) * (b - a)));
    const snapped = Math.round(nx * 100) / 100;
    setLocalX(snapped);
    bind('x', snapped);
    emit('change', snapped);
  };
  const path = pts.filter((p) => Number.isFinite(p.y)).map((p, i) => `${i ? 'L' : 'M'} ${sx(p.x)} ${sy(p.y)}`).join(' ');
  const tangent = props.showTangent && yAt && typeof x === 'number' ? (() => { const dx = (b - a) * 0.18; return [x - dx, yAt.y - yAt.slope * dx, x + dx, yAt.y + yAt.slope * dx]; })() : null;
  return (
    <div className="card p-3">
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="w-full touch-none select-none" onPointerMove={onMove} onPointerUp={() => setDrag(false)} onPointerLeave={() => setDrag(false)} role="img" aria-label="function plot">
        <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="rgb(var(--muted))" />
        <line x1={L} x2={L} y1={T} y2={H - B} stroke="rgb(var(--muted))" />
        {[0, 0.25, 0.5, 0.75, 1].map((t) => { const v = yMin + t * (yMax - yMin); return <text key={t} x={L - 6} y={sy(v) + 4} textAnchor="end" fontSize={10} fill="rgb(var(--muted))">{fmtNum(v, 1)}</text>; })}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => { const v = a + t * (b - a); return <text key={t} x={sx(v)} y={H - B + 14} textAnchor="middle" fontSize={10} fill="rgb(var(--muted))">{fmtNum(v, 2)}</text>; })}
        <path d={path} fill="none" stroke={marks.tone('curve') ? 'rgb(var(--warn))' : 'rgb(var(--accent))'} strokeWidth={2.5} />
        {(props.showMin || showMinCmd) && min && (
          <g className={marks.pulse('min') ? 'pulse' : undefined}>
            <line x1={sx(min.x)} x2={sx(min.x)} y1={sy(min.y)} y2={H - B} stroke="rgb(var(--good))" strokeDasharray="4 3" />
            <circle cx={sx(min.x)} cy={sy(min.y)} r={5} fill="rgb(var(--good))" />
            <text x={sx(min.x)} y={sy(min.y) - 9} textAnchor="middle" fontSize={11} fontWeight={600} fill="rgb(var(--good))">min ≈ ({fmtNum(min.x, 2)}, {fmtNum(min.y, 2)})</text>
          </g>
        )}
        {tangent && <line x1={sx(tangent[0])} y1={sy(tangent[1])} x2={sx(tangent[2])} y2={sy(tangent[3])} stroke="rgb(var(--warn))" strokeWidth={2} />}
        {typeof x === 'number' && yAt && (
          <g>
            <circle cx={sx(x)} cy={sy(yAt.y)} r={props.draggable ? 8 : 5.5} fill="rgb(var(--accent))" stroke="white" strokeWidth={2} className={props.draggable ? 'cursor-grab' : undefined} onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); setDrag(true); }} />
            <text x={sx(x) + 10} y={sy(yAt.y) + 16} fontSize={11} fill="rgb(var(--ink))">x = {fmtNum(x, 2)}, f = {fmtNum(yAt.y, 2)}{props.showTangent ? `, slope ${fmtNum(yAt.slope, 2)}` : ''}</text>
          </g>
        )}
      </svg>
      <div className="flex justify-between px-2 text-xs text-muted">
        {props.xLabel ? <Tex tex={props.xLabel} display={false} /> : <span />}
        {props.yLabel ? <span>y: <Tex tex={props.yLabel} display={false} /></span> : <span />}
      </div>
    </div>
  );
}
