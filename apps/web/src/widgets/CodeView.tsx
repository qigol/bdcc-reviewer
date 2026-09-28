import { useEffect, useMemo, useState } from 'react';
import { parseCodeAnchors } from '@kodigo/schema';
import { tokenize, type Tok } from './shiki';
import { cn } from '../lib/util';

const ANCHOR_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];
export function anchorColor(name: string, order: string[]) {
  const i = order.indexOf(name);
  return ANCHOR_COLORS[(i < 0 ? name.length : i) % ANCHOR_COLORS.length];
}

export interface CodeViewProps {
  source: string;
  lang?: string;
  lineNumbers?: boolean;
  maxHeight?: number;
  hoverAnchor?: string | null;
  setHoverAnchor?: (a: string | null) => void;
  /** anchor lit by a trace step */
  activeAnchor?: string | null;
  /** text badges per anchor (shown at the end of the anchor's last line) */
  badges?: Record<string, string>;
  /** anchor → tone class from commands (anchor:<name>) */
  anchorTones?: Record<string, string>;
  lineTones?: Record<number, string>;
  anchorOrder?: string[];
  title?: string;
  className?: string;
}

export function CodeView({ source, lang = 'python', lineNumbers = true, maxHeight, hoverAnchor, setHoverAnchor, activeAnchor, badges, anchorTones, lineTones, anchorOrder, title, className }: CodeViewProps) {
  const parsed = useMemo(() => parseCodeAnchors(source ?? '', lang), [source, lang]);
  const [tokens, setTokens] = useState<Tok[][] | null>(null);
  useEffect(() => {
    let alive = true;
    tokenize(parsed.code, lang).then((t) => alive && setTokens(t)).catch(() => alive && setTokens(null));
    return () => { alive = false; };
  }, [parsed.code, lang]);
  const order = anchorOrder ?? Object.keys(parsed.anchors);
  const lineAnchors = useMemo(() => {
    const m: string[][] = parsed.lines.map(() => []);
    for (const [a, lines] of Object.entries(parsed.anchors)) for (const l of lines) m[l]?.push(a);
    return m;
  }, [parsed]);
  const badgeAt = useMemo(() => {
    const m: Record<number, string[]> = {};
    for (const [a, text] of Object.entries(badges ?? {})) {
      const lines = parsed.anchors[a];
      if (!lines?.length || !text) continue;
      const l = lines[lines.length - 1];
      (m[l] ??= []).push(text);
    }
    return m;
  }, [badges, parsed]);
  return (
    <div className={cn('overflow-hidden rounded-xl border border-line bg-panel', className)}>
      {title && <div className="border-b border-line bg-panel2 px-3 py-1.5 text-xs font-medium text-muted">{title}</div>}
      <pre className="scrollbar-thin overflow-auto py-2 font-mono text-[13px] leading-[1.45]" style={{ maxHeight }}>
        <code>
          {parsed.lines.map((line, i) => {
            const anchors = lineAnchors[i];
            const hovered = !!hoverAnchor && anchors.includes(hoverAnchor);
            const active = !!activeAnchor && anchors.includes(activeAnchor);
            const tone = anchors.map((a) => anchorTones?.[a]).find(Boolean) ?? lineTones?.[i + 1];
            return (
              <span
                key={i}
                className={cn('code-line', hovered && 'anc-hover', active && 'trace-on', tone && `tone-${tone} mark-bg`)}
                onMouseEnter={() => anchors.length && setHoverAnchor?.(anchors[0])}
                onMouseLeave={() => anchors.length && setHoverAnchor?.(null)}
              >
                {lineNumbers && <span className="inline-block w-9 select-none pr-3 text-right text-muted/60">{i + 1}</span>}
                <span className="inline-block w-2">
                  {anchors.length > 0 && <span className="inline-block h-2 w-1 rounded-sm align-middle" style={{ background: anchorColor(anchors[0], order) }} />}
                </span>
                {tokens?.[i] ? tokens[i].map((t, k) => <span key={k} className="shk" style={t.style as any}>{t.content}</span>) : line || ' '}
                {badgeAt[i]?.map((b, k) => (
                  <span key={k} className="ml-3 rounded bg-warn/20 px-1.5 py-0.5 font-sans text-[11px] font-semibold text-warn">{b}</span>
                ))}
              </span>
            );
          })}
        </code>
      </pre>
    </div>
  );
}
