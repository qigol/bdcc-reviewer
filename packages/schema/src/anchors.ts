/** Math ⇄ code anchors (guide §4.3, §4.6). */

export const TEX_ANCHOR_RE = /\\anchor\{([a-z0-9_-]+)\}/g;

export function texAnchors(tex: string | undefined): string[] {
  if (!tex) return [];
  return [...new Set([...tex.matchAll(TEX_ANCHOR_RE)].map((m) => m[1]))];
}

export function commentPrefix(lang = 'python'): string {
  const l = lang.toLowerCase();
  if (['python', 'py', 'bash', 'sh', 'shell', 'yaml', 'yml', 'r'].includes(l)) return '#';
  if (['sql'].includes(l)) return '--';
  return '//';
}

export interface ParsedCode {
  /** code with markers removed */
  code: string;
  lines: string[];
  /** anchor → 0-based line indices in the stripped code */
  anchors: Record<string, number[]>;
  /** problems (unbalanced blocks, …) */
  problems: string[];
}

function esc(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
}

export function parseCodeAnchors(source: string, lang = 'python'): ParsedCode {
  const p = esc(commentPrefix(lang));
  const blockStart = new RegExp(`^\\s*${p}\\s*@a\\s+([a-z0-9_-]+)\\s*$`);
  const blockEnd = new RegExp(`^\\s*${p}\\s*@end\\s*$`);
  const trailing = new RegExp(`\\s*${p}\\s*@a:([a-z0-9_-]+)\\s*$`);
  const out: string[] = [];
  const anchors: Record<string, number[]> = {};
  const stack: string[] = [];
  const problems: string[] = [];
  const add = (name: string, line: number) => {
    (anchors[name] ??= []);
    if (!anchors[name].includes(line)) anchors[name].push(line);
  };
  const src = (source ?? '').replace(/\r\n/g, '\n').replace(/\n+$/, '');
  for (const raw of src.split('\n')) {
    const s = blockStart.exec(raw);
    if (s) { stack.push(s[1]); anchors[s[1]] ??= []; continue; }
    if (blockEnd.test(raw)) {
      if (!stack.length) problems.push('`@end` without an open `@a` block');
      stack.pop();
      continue;
    }
    let line = raw;
    const t = trailing.exec(raw);
    const idx = out.length;
    if (t) { line = raw.slice(0, t.index).replace(/\s+$/, ''); add(t[1], idx); }
    for (const a of stack) add(a, idx);
    out.push(line);
  }
  if (stack.length) problems.push(`unclosed anchor block(s): ${stack.join(', ')}`);
  return { code: out.join('\n'), lines: out, anchors, problems };
}
