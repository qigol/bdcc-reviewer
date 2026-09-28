import type { WidgetRenderProps } from '../engine/types';
import { fmtNum, TONE_FILL } from './common';

interface P { labels: string[]; nA: number; nB: number; nAB: number; N: number; mode?: 'count' | 'fraction' }
export default function Venn({ props, marks, ctx }: WidgetRenderProps<P>) {
  const { nA = 0, nB = 0, nAB = 0, N = 1 } = props;
  const [la, lb] = props.labels ?? ['A', 'B'];
  const W = 360, H = 216, r = 70;
  const cx1 = 135, cx2 = 225, cy = 112;
  const f = (n: number) => (props.mode === 'fraction' ? `${n}/${N}` : fmtNum(n));
  const fillFor = (sel: string, base: string) => (marks.tone(sel) ? TONE_FILL[marks.tone(sel)!] : base);
  const lab = (x: string) => ctx.labels[x] ?? x;
  return (
    <div className="card p-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block w-full max-w-md" role="img" aria-label="Venn diagram">
        <defs><clipPath id="vennA"><circle cx={cx1} cy={cy} r={r} /></clipPath></defs>
        <rect x={4} y={4} width={W - 8} height={H - 8} rx={12} fill={fillFor('U', 'rgb(var(--panel2))')} fillOpacity={marks.tone('U') ? 0.25 : 1} stroke="rgb(var(--line))" />
        <circle cx={cx1} cy={cy} r={r} fill={fillFor('A', 'rgb(var(--accent))')} fillOpacity={marks.tone('A') ? 0.35 : 0.16} stroke="rgb(var(--accent))" strokeWidth={1.5} />
        <circle cx={cx2} cy={cy} r={r} fill={fillFor('B', 'rgb(var(--good))')} fillOpacity={marks.tone('B') ? 0.35 : 0.16} stroke="rgb(var(--good))" strokeWidth={1.5} />
        <circle cx={cx2} cy={cy} r={r} clipPath="url(#vennA)" fill={fillFor('AB', 'rgb(var(--warn))')} fillOpacity={marks.tone('AB') ? 0.55 : 0.25} />
        <text x={cx1 - 35} y={cy + 5} textAnchor="middle" fontSize={16} fontWeight={600} fill="rgb(var(--ink))">{f(nA - nAB)}</text>
        <text x={(cx1 + cx2) / 2} y={cy + 5} textAnchor="middle" fontSize={17} fontWeight={700} fill="rgb(var(--ink))">{f(nAB)}</text>
        <text x={cx2 + 35} y={cy + 5} textAnchor="middle" fontSize={16} fontWeight={600} fill="rgb(var(--ink))">{f(nB - nAB)}</text>
        <text x={cx1 - 40} y={cy - r - 10} textAnchor="middle" fontSize={12} fill="rgb(var(--accent))" fontWeight={600}>{lab(la)} ({f(nA)})</text>
        <text x={cx2 + 40} y={cy - r - 10} textAnchor="middle" fontSize={12} fill="rgb(var(--good))" fontWeight={600}>{lab(lb)} ({f(nB)})</text>
        <text x={W - 14} y={H - 12} textAnchor="end" fontSize={11} fill="rgb(var(--muted))">N = {N} · neither {f(N - nA - nB + nAB)}</text>
      </svg>
    </div>
  );
}
