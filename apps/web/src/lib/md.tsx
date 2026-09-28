import { createContext, memo, useContext, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { interpolate, type Scope } from '@kodigo/schema';
import { cn } from './util';

export const KATEX_MACROS: Record<string, string> = {
  '\\anchor': '\\htmlClass{kanc kanc-#1}{#2}',
};
export const katexOptions = () => ({
  macros: { ...KATEX_MACROS },
  trust: (ctx: { command: string }) => ctx.command === '\\htmlClass',
  strict: false as const,
  throwOnError: false,
  output: 'html' as const,
});

export interface InterpCtx { scope: Scope; labels: Record<string, string> }
export const InterpContext = createContext<InterpCtx>({ scope: {}, labels: {} });
export function useInterp() {
  const { scope, labels } = useContext(InterpContext);
  return useMemo(
    () => ({
      md: (t: string | undefined) => interpolate(t ?? '', scope, { mode: 'md', labels }).text,
      tex: (t: string | undefined) => interpolate(t ?? '', scope, { mode: 'tex', labels }).text,
      scope,
      labels,
    }),
    [scope, labels],
  );
}

const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins: any[] = [[rehypeKatex, katexOptions()]];

const MdInner = memo(function MdInner({ text, className, inline }: { text: string; className?: string; inline?: boolean }) {
  return (
    <div className={cn('md', inline && 'md-inline', className)}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={
          inline
            ? { p: ({ children }) => <span>{children}</span> }
            : { a: ({ href, children }) => <a href={href} target={href?.startsWith('http') ? '_blank' : undefined} rel="noreferrer">{children}</a> }
        }
      >
        {text}
      </ReactMarkdown>
    </div>
  );
});

/** Markdown with {=} interpolation from the surrounding InterpContext (or explicit scope). */
export function Markdown({ text, className, inline, scope, raw }: { text?: string; className?: string; inline?: boolean; scope?: Scope; raw?: boolean }) {
  const ctx = useContext(InterpContext);
  const t = raw ? text ?? '' : interpolate(text ?? '', scope ?? ctx.scope, { mode: 'md', labels: ctx.labels }).text;
  if (inline) return <span className={cn('md md-inline', className)}><MdInlineRender text={t} /></span>;
  return <MdInner text={t} className={className} />;
}

function MdInlineRender({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={{ p: ({ children }) => <>{children}</> }}>
      {text}
    </ReactMarkdown>
  );
}

const texCache = new Map<string, string>();
export function renderTex(tex: string, display = true): string {
  const k = (display ? 'D' : 'I') + tex;
  let html = texCache.get(k);
  if (html === undefined) {
    try {
      html = katex.renderToString(tex, { ...katexOptions(), displayMode: display });
    } catch (e: any) {
      html = `<span class="text-bad text-xs">${String(e?.message ?? e)}</span>`;
    }
    if (texCache.size > 2000) texCache.clear();
    texCache.set(k, html);
  }
  return html;
}

/** TeX with {=} interpolation (whole string is TeX). */
export function Tex({ tex, display = true, className, scope, onMouseOver, onMouseOut, onClick }: {
  tex?: string; display?: boolean; className?: string; scope?: Scope;
  onMouseOver?: React.MouseEventHandler; onMouseOut?: React.MouseEventHandler; onClick?: React.MouseEventHandler;
}) {
  const ctx = useContext(InterpContext);
  const t = interpolate(tex ?? '', scope ?? ctx.scope, { mode: 'tex', labels: ctx.labels }).text;
  const html = renderTex(t, display);
  const Tag = display ? 'div' : 'span';
  return <Tag className={className} onMouseOver={onMouseOver} onMouseOut={onMouseOut} onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Find the anchor name of a hovered KaTeX element. */
export function anchorFromEvent(e: React.MouseEvent | MouseEvent): string | null {
  let el = e.target as HTMLElement | null;
  while (el && el !== e.currentTarget) {
    if (el.classList?.contains('kanc')) {
      const c = [...el.classList].find((x) => x.startsWith('kanc-'));
      if (c) return c.slice(5);
    }
    el = el.parentElement;
  }
  return null;
}

/** Toggle classes on anchor elements inside a container. */
export function applyAnchorClasses(root: HTMLElement | null, map: Record<string, string>) {
  if (!root) return;
  root.querySelectorAll('.kanc').forEach((el) => {
    el.classList.remove('anc-hover', 'anc-on', 'anc-good', 'anc-bad', 'anc-warn');
    const c = [...el.classList].find((x) => x.startsWith('kanc-'));
    const name = c?.slice(5);
    if (name && map[name]) el.classList.add(map[name]);
  });
}
