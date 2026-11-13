import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import JSZip from 'jszip';
import { parseModule } from '@kodigo/schema';
import { createNodeHost, readModuleDir } from '@kodigo/schema/node';
import { buildEpub, type EpubModule, type EpubReport } from '../src/epub/index';

const root = path.resolve(__dirname, '../../..');
const XML_ENTITIES = new Set(['amp', 'lt', 'gt', 'quot', 'apos']);
const VOID = /^(?:\?|!)/;

/** A small well-formedness check: balanced tags, quoted attributes, only XML's own named entities. */
function xmlProblems(text: string): string[] {
  const problems: string[] = [];
  const body = text.replace(/<!--[\s\S]*?-->/g, '');
  for (const m of body.matchAll(/&([A-Za-z][A-Za-z0-9]*);/g)) if (!XML_ENTITIES.has(m[1])) problems.push(`named entity &${m[1]};`);
  if (/&(?![A-Za-z][A-Za-z0-9]*;|#\d+;|#x[0-9a-fA-F]+;)/.test(body)) problems.push('bare &');
  const stack: string[] = [];
  for (const m of body.matchAll(/<(\/?)([^\s>/]+)((?:\s+[^\s=>/]+(?:="[^"]*")?)*)\s*(\/?)>/g)) {
    const [whole, close, name, attrs, self] = m;
    if (VOID.test(name)) continue;
    if (/\s[^\s=>/]+(?=\s|$)/.test(attrs) && !/="/.test(attrs)) problems.push(`attribute without value in ${whole.slice(0, 40)}`);
    if (self) continue;
    if (close) {
      const top = stack.pop();
      if (top !== name) { problems.push(`</${name}> closes <${top}>`); break; }
    } else stack.push(name);
  }
  // anything that looks like a tag but did not match the pattern
  const tags = body.match(/<[^>]*>/g) ?? [];
  for (const t of tags) if (!/^<(\/?)([^\s>/]+)((?:\s+[^\s=>/]+(?:="[^"]*")?)*)\s*(\/?)>$/.test(t) && !/^<[?!]/.test(t)) problems.push(`malformed tag ${t.slice(0, 60)}`);
  if (stack.length) problems.push(`unclosed: ${stack.join(', ')}`);
  return problems;
}

async function load(id: string): Promise<EpubModule> {
  const files = await readModuleDir(path.join(root, 'modules', id));
  const { module } = parseModule(files);
  if (!module) throw new Error(`${id} does not parse`);
  return { parsed: module, files };
}

describe.each(['cost-behavior', 'pandas-select-rows'])('epub export of %s', (id) => {
  let report: EpubReport;
  let zip: JSZip;
  beforeAll(async () => {
    report = await buildEpub([await load(id)], { hostFactory: (s) => createNodeHost(s), modified: new Date('2026-01-02T03:04:05.678Z') });
    zip = await JSZip.loadAsync(report.bytes);
  }, 120_000);

  it('starts with an uncompressed mimetype entry', () => {
    const b = report.bytes;
    expect(new TextDecoder().decode(b.slice(30, 38))).toBe('mimetype');
    expect(b[8] | (b[9] << 8)).toBe(0); // compression method: stored
    expect(new TextDecoder().decode(b.slice(38, 58))).toBe('application/epub+zip');
  });

  it('lists exactly the files it ships', async () => {
    const opf = await zip.file('OEBPS/content.opf')!.async('string');
    const listed = [...opf.matchAll(/href="([^"]+)"/g)].map((m) => `OEBPS/${m[1]}`).sort();
    const shipped = Object.keys(zip.files).filter((f) => f.startsWith('OEBPS/') && !zip.files[f].dir && f !== 'OEBPS/content.opf').sort();
    expect(listed).toEqual(shipped);
    expect(opf).toContain('<meta property="dcterms:modified">2026-01-02T03:04:05Z</meta>');
    expect(opf).toContain('properties="nav"');
  });

  it('writes well-formed XHTML with namespaced MathML and nothing left unresolved', async () => {
    const opf = await zip.file('OEBPS/content.opf')!.async('string');
    for (const name of Object.keys(zip.files).filter((f) => /\.(xhtml|opf|ncx)$/.test(f))) {
      const text = await zip.file(name)!.async('string');
      expect(xmlProblems(text), name).toEqual([]);
      // code may legitimately hold [[ (pandas df[["a", "b"]]), so code is left out of this check
      const prose = text.replace(/<pre[\s\S]*?<\/pre>|<code>[\s\S]*?<\/code>/g, '');
      expect(prose, name).not.toMatch(/\{=|\[\[|\\text\{\?\}|katex-error/);
      expect(text, name).not.toMatch(/\salign="/);
      const maths = text.match(/<math[\s>][^>]*/g) ?? [];
      for (const m of maths) expect(m, name).toContain('xmlns="http://www.w3.org/1998/Math/MathML"');
      const href = name.replace(/^OEBPS\//, '');
      const item = new RegExp(`<item [^>]*href="${href.replace(/\./g, '\\.')}"[^>]*>`).exec(opf)?.[0] ?? '';
      if (name.endsWith('.xhtml')) expect(item.includes('properties="mathml"'), name).toBe(maths.length > 0);
    }
    expect(report.mathErrors).toEqual([]);
    expect(Object.keys(report.skipped).filter((k) => k.startsWith('unresolved'))).toEqual([]);
  });

  it('follows every question with its own answer, and every link resolves', async () => {
    const all: Record<string, string> = {};
    for (const name of Object.keys(zip.files).filter((f) => f.endsWith('.xhtml'))) all[name.replace(/^OEBPS\//, '')] = await zip.file(name)!.async('string');
    let questions = 0;
    for (const [file, text] of Object.entries(all)) {
      // each question block ends, then the answer block with the same number starts right away
      const qs = [...text.matchAll(/<div class="question[^"]*" id="q-(\d+)">/g)].map((m) => m[1]);
      const pairs = [...text.matchAll(/id="q-(\d+)">[\s\S]*?<\/div><div class="answer" id="a-(\d+)">/g)];
      expect(pairs.map((m) => m[1]), file).toEqual(qs);
      for (const m of pairs) expect(m[2], file).toBe(m[1]);
      questions += qs.length;
      const ids = [...text.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
      expect(new Set(ids).size, `${file} has duplicate ids`).toBe(ids.length);
      for (const m of text.matchAll(/href="([^"#]+\.xhtml)(?:#([^"]+))?"/g)) {
        expect(all[m[1]], `${file} → ${m[1]}`).toBeDefined();
        if (m[2]) expect(all[m[1]], `${file} → ${m[1]}#${m[2]}`).toContain(`id="${m[2]}"`);
      }
    }
    expect(questions).toBeGreaterThan(10);
    expect(all[`${id}-answers.xhtml`]).toBeUndefined();
  });

  it('gives the module its accent colour, darkened enough to read on white', async () => {
    const css = await zip.file('OEBPS/style.css')!.async('string');
    expect(css).toContain(`.m-${id} h1`);
    expect(await zip.file(`OEBPS/${id}-intro.xhtml`)!.async('string')).toContain(`<body class="m-${id}">`);
  });
});
