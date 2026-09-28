import type { HighlighterCore } from 'shiki/core';

let hl: Promise<HighlighterCore> | null = null;
export function getHighlighter(): Promise<HighlighterCore> {
  hl ??= (async () => {
    const [{ createHighlighterCore }, { createJavaScriptRegexEngine }] = await Promise.all([import('shiki/core'), import('shiki/engine/javascript')]);
    return createHighlighterCore({
      themes: [import('shiki/themes/github-light.mjs'), import('shiki/themes/github-dark.mjs')],
      langs: [import('shiki/langs/python.mjs'), import('shiki/langs/javascript.mjs'), import('shiki/langs/sql.mjs'), import('shiki/langs/bash.mjs'), import('shiki/langs/yaml.mjs')],
      engine: createJavaScriptRegexEngine(),
    });
  })();
  return hl;
}

export interface Tok { content: string; style: Record<string, string> }
const LANGS: Record<string, string> = { py: 'python', python: 'python', js: 'javascript', javascript: 'javascript', ts: 'javascript', sql: 'sql', bash: 'bash', sh: 'bash', shell: 'bash', yaml: 'yaml', yml: 'yaml', scala: 'javascript', java: 'javascript' };

export async function tokenize(code: string, lang = 'python'): Promise<Tok[][]> {
  const h = await getHighlighter();
  const l = LANGS[lang.toLowerCase()] ?? 'python';
  const r = h.codeToTokens(code, { lang: l as any, themes: { light: 'github-light', dark: 'github-dark' } });
  return r.tokens.map((line) =>
    line.map((t: any) => {
      const style: Record<string, string> = {};
      if (t.htmlStyle) for (const [k, v] of Object.entries(t.htmlStyle)) style[k] = String(v);
      else if (t.color) style.color = t.color;
      return { content: t.content, style };
    }),
  );
}
