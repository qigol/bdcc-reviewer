/**
 * Markdown and TeX → XHTML fragments for the EPUB. Output is strict XML: void elements self-closed, no named
 * entities, MathML with its namespace. Text must be interpolated ({=…}) before it reaches these functions.
 */
import katex from 'katex';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import { toHtml } from 'hast-util-to-html';
import { TERM_LINK_RE, TEX_ANCHOR_RE } from '@kodigo/schema';

/** Problems met while rendering (math errors …), collected per book. */
export interface RenderLog { mathErrors: string[] }

const TO_HTML = {
  allowDangerousHtml: true,
  closeSelfClosing: true,
  closeEmptyElements: true,
  tightSelfClosing: false,
  collapseBooleanAttributes: false,
  characterReferences: { useNamedReferences: false },
} as const;

/** Escape text for XML content and attribute values. */
export const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // characters XML 1.0 forbids (KaTeX and authors never need them)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

/**
 * TeX → MathML (KaTeX). The one place math is rendered, so another backend (SVG images) can replace it.
 * `\anchor{name}{…}` (the web's hover links) keeps only its body.
 */
export function renderMath(tex: string, display: boolean, log: RenderLog): string {
  const src = String(tex ?? '').replace(TEX_ANCHOR_RE, '');
  let out: string;
  try {
    out = katex.renderToString(src, { output: 'mathml', displayMode: display, throwOnError: true, strict: false });
  } catch (e: any) {
    log.mathErrors.push(`${String(e?.message ?? e).split('\n')[0]} in: ${src.slice(0, 80)}`);
    return `<code class="tex">${esc(src)}</code>`;
  }
  // KaTeX marks unknown commands in red instead of throwing
  if (out.includes('mathcolor="#cc0000"')) log.mathErrors.push(`unknown command in: ${src.slice(0, 80)}`);
  out = out.replace(/<span class="katex">/, '').replace(/<\/span>$/, '');
  return display ? `<div class="math">${out}</div>` : out;
}

/** Where `[[term]]` links point: an href per term id, or undefined (shown as plain text). */
export type TermHref = (id: string) => { href: string; label: string } | undefined;

/** `[[id|text]]` → a Markdown link to the glossary entry (unknown ids become their text). */
export function linkTerms(md: string, termHref: TermHref): string {
  if (!md.includes('[[')) return md;
  return md.replace(TERM_LINK_RE, (_, id: string, shown?: string) => {
    const t = termHref(id);
    const label = shown ?? t?.label ?? id;
    return t ? `[${label}](${t.href})` : label;
  });
}

function processor(log: RenderLog) {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype, {
      // raw HTML in authored Markdown is dropped (it might not be XML); math becomes MathML
      allowDangerousHtml: false,
      handlers: {
        inlineMath: (_s: any, node: any) => ({ type: 'raw', value: renderMath(node.value, false, log) }) as any,
        math: (_s: any, node: any) => ({ type: 'raw', value: renderMath(node.value, true, log) }) as any,
      },
    });
}

/** Markdown (with $…$ math and [[term]] links) → an XHTML fragment. `inline` drops the wrapping <p>. */
export function md(text: string | undefined, ctx: { log: RenderLog; termHref: TermHref }, opts: { inline?: boolean } = {}): string {
  const src = linkTerms(String(text ?? ''), ctx.termHref);
  if (!src.trim()) return '';
  const p = processor(ctx.log);
  const tree = p.runSync(p.parse(src)) as any;
  // GFM table alignment comes out as align="…", which HTML5 (and so EPUB 3) does not allow
  const walk = (n: any) => {
    const align = n.properties?.align;
    if (align) {
      delete n.properties.align;
      n.properties.className = [...(n.properties.className ?? []), `align-${align}`];
    }
    n.children?.forEach(walk);
  };
  walk(tree);
  let html = toHtml(tree, TO_HTML as any).trim();
  if (opts.inline) {
    const m = /^<p>([\s\S]*)<\/p>$/.exec(html);
    if (m && !m[1].includes('<p>')) html = m[1];
  }
  return html;
}

/** A TeX string (a whole formula) → display MathML. */
export const tex = (t: string | undefined, log: RenderLog) => (t && t.trim() ? renderMath(t, true, log) : '');
