/**
 * Scope paths, @references and {=path|format} interpolation (guide §4.4, §4.5).
 * Isomorphic: used by the web renderer, the validator and the quiz smoke test.
 */
import { fmt } from '@kodigo/sdk';

export type Scope = Record<string, any>;

export function getPath(scope: Scope, path: string): { found: boolean; value: any } {
  if (!path) return { found: false, value: undefined };
  const parts = path.split('.');
  let cur: any = scope;
  for (const p of parts) {
    if (cur === null || cur === undefined) return { found: false, value: undefined };
    if (Array.isArray(cur) && /^\d+$/.test(p)) cur = cur[Number(p)];
    else if (Array.isArray(cur) && p === 'length') cur = cur.length;
    else if (typeof cur === 'object' && p in cur) cur = cur[p];
    else return { found: false, value: undefined };
  }
  return { found: cur !== undefined, value: cur };
}

export const isRef = (v: unknown): v is string => typeof v === 'string' && v.startsWith('@') && v.length > 1;

/** Deeply replace '@path' strings by their scope value. Missing refs are reported and become null. */
export function resolveRefs<T = any>(value: T, scope: Scope, missing?: string[]): any {
  if (isRef(value)) {
    const r = getPath(scope, value.slice(1));
    if (!r.found) {
      missing?.push(value);
      return null;
    }
    return r.value;
  }
  if (Array.isArray(value)) return value.map((v) => resolveRefs(v, scope, missing));
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value as any)) out[k] = resolveRefs(v, scope, missing);
    return out;
  }
  return value;
}

/** Collect every '@ref' string in a value (for static checks). */
export function collectRefs(value: unknown, out: string[] = []): string[] {
  if (isRef(value)) out.push(value.slice(1));
  else if (Array.isArray(value)) value.forEach((v) => collectRefs(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collectRefs(v, out));
  return out;
}

export const INTERP_RE = /\{=([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)*)(?:\|([a-z0-9]+))?\}/g;

/** Collect every {=path} used in a string. */
export function collectInterps(text: string): { path: string; format?: string }[] {
  const out: { path: string; format?: string }[] = [];
  if (typeof text !== 'string') return out;
  for (const m of text.matchAll(INTERP_RE)) out.push({ path: m[1], format: m[2] });
  return out;
}

export interface InterpOptions {
  /** 'md' = Markdown with $…$ math regions; 'tex' = the whole string is TeX */
  mode?: 'md' | 'tex';
  labels?: Record<string, string>;
}

function escapeTexText(s: string): string {
  return s.replace(/\\/g, '\\textbackslash{}').replace(/([{}_#%&$^])/g, '\\$1');
}

export function formatValue(value: any, format: string | undefined, tex: boolean, labels: Record<string, string> = {}): string {
  const lab = (x: any) => (typeof x === 'string' && labels[x] ? labels[x] : String(x));
  if (value === undefined || value === null) return tex ? '\\text{—}' : '—';
  if (format === 'set') {
    const arr = Array.isArray(value) ? value : [value];
    if (!arr.length) return tex ? '\\emptyset' : '∅';
    return tex ? `\\{${arr.map((x) => `\\text{${escapeTexText(lab(x))}}`).join(', ')}\\}` : `{${arr.map(lab).join(', ')}}`;
  }
  if (format === 'list') {
    const arr = Array.isArray(value) ? value : [value];
    return arr.map((x) => (typeof x === 'number' ? fmt(x) : lab(x))).join(', ');
  }
  if (format === 'text') return tex ? `\\text{${escapeTexText(lab(value))}}` : lab(value);
  if (typeof value === 'number') {
    let s = fmt(value, format ?? '');
    if (tex) s = s.replace('%', '\\%').replace('∞', '\\infty').replace(/−/g, '-').replace(/,/g, '{,}').replace('₱', '\\text{₱}');
    return s;
  }
  if (typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map((x) => (typeof x === 'number' ? fmt(x, format ?? '') : lab(x))).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Replace {=path|fmt}. In 'md' mode, placeholders inside $…$ / $$…$$ are formatted as TeX.
 * Returns the text and the list of paths that did not resolve (rendered as '?').
 */
export function interpolate(text: string, scope: Scope, opts: InterpOptions = {}): { text: string; missing: string[] } {
  const missing: string[] = [];
  if (typeof text !== 'string' || !text.includes('{=')) return { text: text ?? '', missing };
  const labels = opts.labels ?? {};
  const mathMask = opts.mode === 'tex' ? null : mathRegions(text);
  const out = text.replace(INTERP_RE, (whole, path: string, format: string | undefined, offset: number) => {
    const r = getPath(scope, path);
    const inTex = opts.mode === 'tex' || (mathMask ? mathMask(offset) : false);
    if (!r.found) {
      missing.push(path);
      return inTex ? '\\text{?}' : '?';
    }
    return formatValue(r.value, format, inTex, labels);
  });
  return { text: out, missing };
}

/** Returns a predicate: is character offset i inside $…$ or $$…$$ ? */
export function mathRegions(text: string): (i: number) => boolean {
  const ranges: [number, number][] = [];
  let i = 0;
  let open = -1;
  let display = false;
  while (i < text.length) {
    const c = text[i];
    if (c === '\\' ) { i += 2; continue; }
    if (c === '`' && open < 0) {
      // skip inline code spans
      const end = text.indexOf('`', i + 1);
      if (end > 0) { i = end + 1; continue; }
    }
    if (c === '$') {
      const dbl = text[i + 1] === '$';
      if (open < 0) { open = i; display = dbl; i += dbl ? 2 : 1; continue; }
      if (display === dbl) { ranges.push([open, i + (dbl ? 2 : 1)]); open = -1; i += dbl ? 2 : 1; continue; }
    }
    i++;
  }
  return (k: number) => ranges.some(([a, b]) => k > a && k < b);
}

/** Strip Markdown/TeX for speech synthesis and search. */
/** Glossary term links in Markdown: [[term-id]] or [[term-id|shown text]] (guide §4.2). */
export const TERM_LINK_RE = /\[\[([a-z0-9]+(?:-[a-z0-9]+)*)(?:\|([^\]\n]+))?\]\]/g;

/** Every [[term]] link in a string. */
export function collectTermLinks(text: unknown): { id: string; text?: string }[] {
  if (typeof text !== 'string' || !text.includes('[[')) return [];
  return [...text.matchAll(TERM_LINK_RE)].map((m) => ({ id: m[1], text: m[2] }));
}

/** Replace [[id|text]] by its visible text (the term name when `names` knows the id). */
export function stripTermLinks(text: string, names: Record<string, string> = {}): string {
  if (typeof text !== 'string' || !text.includes('[[')) return text;
  return text.replace(TERM_LINK_RE, (_, id: string, shown?: string) => shown ?? names[id] ?? id);
}

export function plainText(md: string): string {
  return stripTermLinks(md || '')
    .replace(/\$\$?([^$]*)\$\$?/g, (_, t) => t.replace(/\\[a-zA-Z]+/g, ' ').replace(/[{}^_]/g, ' '))
    .replace(/[*_`#>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function wordCount(md: string): number {
  const t = stripTermLinks(md || '').replace(/\$\$?[^$]*\$\$?/g, ' x ').replace(/\{=[^}]*\}/g, ' x ');
  return t.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
}
