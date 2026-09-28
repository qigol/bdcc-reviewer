import { useEffect, useRef, useState } from 'react';
import { animate } from 'framer-motion';
import { fmt } from '@kodigo/sdk';
import { cn } from '../lib/util';

export function fmtNum(v: unknown, format?: string | number): string {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v !== 'number') return String(v);
  const f = format === undefined ? '' : String(format);
  return fmt(v, f).replace(/^-/, '−');
}

/** Tweens between numeric values (Framer Motion); shows the final value formatted exactly. */
export function AnimatedNumber({ value, format, reduced, duration = 0.6 }: { value: number | null | undefined; format?: string | number; reduced?: boolean; duration?: number }) {
  const [display, setDisplay] = useState<number | null | undefined>(value);
  const [animating, setAnimating] = useState(false);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (reduced || typeof value !== 'number' || typeof from !== 'number' || from === value) { setDisplay(value); return; }
    setAnimating(true);
    const c = animate(from, value, { duration, ease: 'easeInOut', onUpdate: (v) => setDisplay(v), onComplete: () => { setAnimating(false); setDisplay(value); } });
    return () => c.stop();
  }, [value, reduced, duration]);
  const f = animating && (format === 'frac' || format === 'int') ? 2 : format;
  return <>{fmtNum(display, f)}</>;
}

export function WidgetCard({ title, children, className, right }: { title?: React.ReactNode; children: React.ReactNode; className?: string; right?: React.ReactNode }) {
  return (
    <div className={cn('card p-3', className)}>
      {(title || right) && (
        <div className="mb-2 flex items-center justify-between gap-2">
          {title ? <div className="text-xs font-semibold text-muted">{title}</div> : <span />}
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export const TONE_FILL: Record<string, string> = {
  accent: 'rgb(var(--accent))',
  good: 'rgb(var(--good))',
  bad: 'rgb(var(--bad))',
  warn: 'rgb(var(--warn))',
  muted: 'rgb(var(--muted))',
};

export function asList(sel: unknown): string[] {
  return Array.isArray(sel) ? sel.map(String) : sel === undefined || sel === null ? [] : [String(sel)];
}

/** Shortest unique prefix (≥ 2 chars) per item, for compact node labels. */
export function abbreviations(items: string[], labels: Record<string, string> = {}): Record<string, string> {
  const names = items.map((i) => (labels[i] ?? i).replace(/[^A-Za-z0-9]/g, '').toLowerCase());
  const out: Record<string, string> = {};
  items.forEach((it, idx) => {
    let n = 2;
    while (n < names[idx].length && names.some((o, j) => j !== idx && o.startsWith(names[idx].slice(0, n)))) n++;
    out[it] = (labels[it] ?? it).replace(/[^A-Za-z0-9]/g, '').slice(0, n) || it.slice(0, 2);
  });
  return out;
}
