import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateModule, fixRequest, type FileMap } from '../src/index';
import { createNodeHost, readModuleDir } from '../src/node';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../modules');
const hostFactory = (src: string) => createNodeHost(src);

import fs from 'node:fs';
const builtins = fs.readdirSync(root).filter((d) => fs.existsSync(path.join(root, d, 'manifest.yaml'))).sort();

describe.each(builtins)('built-in module %s', (id) => {
  it('passes all seven validation steps with every lecture example reproduced', async () => {
    const files = await readModuleDir(path.join(root, id));
    const report = await validateModule(files, { hostFactory, seeds: 10 });
    const errors = report.issues.filter((i) => i.level === 'error');
    expect(errors, errors.map((e) => e.message).join('\n')).toEqual([]);
    expect(report.id).toBe(id);
    expect(report.stats?.examplesPassed).toBe(report.stats?.examples);
    expect(report.stats?.examples).toBeGreaterThan(0);
    expect(report.steps.every((s) => s.status === 'ok' || s.status === 'warn')).toBe(true);
  }, 60_000);
});

async function fim(): Promise<FileMap> {
  return readModuleDir(path.join(root, 'fim'));
}
const errorsOf = async (files: FileMap) => (await validateModule(files, { hostFactory, seeds: 2 })).issues.filter((i) => i.level === 'error');

describe('validator catches broken modules', () => {
  it('missing required file', async () => {
    const f = await fim();
    delete f['glossary.yaml'];
    const errs = await errorsOf(f);
    expect(errs.some((e) => e.step === 'structure' && /glossary\.yaml/.test(e.message))).toBe(true);
  });

  it('YAML syntax errors carry a line number', async () => {
    const f = await fim();
    f['glossary.yaml'] = 'terms:\n  - term: a\n    def: [unclosed\n';
    const errs = await errorsOf(f);
    const y = errs.find((e) => e.step === 'yaml');
    expect(y).toBeTruthy();
    expect(y!.line).toBeGreaterThan(0);
  });

  it('a wrong expected value in examples.yaml fails the lecture check', async () => {
    const f = await fim();
    const src = f['examples.yaml'] as string;
    // bump the first numeric expectation
    const broken = src.replace(/(expect:\s*\{?[^\n]*?:\s*)(\d+(?:\.\d+)?)/, (_m, a, n) => `${a}${Number(n) + 7}`);
    expect(broken).not.toBe(src);
    f['examples.yaml'] = broken;
    const errs = await errorsOf(f);
    expect(errs.some((e) => e.step === 'logic')).toBe(true);
  });

  it('unknown logic function references are reported', async () => {
    const f = await fim();
    f['math-code.yaml'] = (f['math-code.yaml'] as string).replace(/fn: support\b/, 'fn: noSuchFunction');
    const errs = await errorsOf(f);
    expect(errs.some((e) => /noSuchFunction/.test(e.message))).toBe(true);
  });

  it('logic.js that touches the network is rejected at load time', async () => {
    const f = await fim();
    f['logic.js'] = 'export default function (sdk) { fetch("https://example.com"); return { fns: {}, generators: {} }; }\n';
    const errs = await errorsOf(f);
    expect(errs.some((e) => e.step === 'logic')).toBe(true);
  });

  it('produces an LLM fix request listing every error', async () => {
    const f = await fim();
    delete f['glossary.yaml'];
    const report = await validateModule(f, { hostFactory, seeds: 1 });
    const text = fixRequest(report);
    expect(text).toContain('glossary.yaml');
  });
});

describe('courses', () => {
  it('every built-in module declares the BDCC course', async () => {
    for (const id of ['fim', 'nb-cf', 'lf-cf']) {
      const report = await validateModule(await readModuleDir(path.join(root, id)), { hostFactory, seeds: 1 });
      expect(report.issues.some((i) => i.path === 'course')).toBe(false);
    }
    const f = await fim();
    expect(String(f['manifest.yaml'])).toMatch(/^course: BDCC$/m);
  }, 60_000);

  it('warns (but still accepts) a module without a course', async () => {
    const f = await fim();
    f['manifest.yaml'] = String(f['manifest.yaml']).replace(/^course:.*\n/m, '');
    const report = await validateModule(f, { hostFactory, seeds: 2 });
    expect(report.ok).toBe(true);
    expect(report.issues.some((i) => i.level === 'warning' && i.step === 'lint' && i.path === 'course')).toBe(true);
  }, 60_000);
});

describe('Animation widget (guide §9a)', () => {
  // these tests use org-design's transfer-pricing clip: modules/org-design/assets/anim/transfer-pricing.{webm,mp4,poster.jpg}
  const SRC = 'src: [assets/anim/transfer-pricing.webm, assets/anim/transfer-pricing.mp4]';
  async function orgDesign(): Promise<FileMap> {
    const f = await readModuleDir(path.join(root, 'org-design'));
    expect(f['intuition.yaml'] as string).toContain(SRC);
    return f;
  }
  const withSrc = (f: FileMap, src: string, extra = '') => {
    f['intuition.yaml'] = (f['intuition.yaml'] as string).replace(SRC, `src: ${src}${extra}`);
    return f;
  };
  const report = (f: FileMap) => validateModule(f, { hostFactory, seeds: 1 });
  const errs = async (f: FileMap) => (await report(f)).issues.filter((i) => i.level === 'error').map((i) => i.message);

  it('accepts the shipped clip and its ANIMATIONS.md brief', async () => {
    const r = await report(await orgDesign());
    expect(r.issues.filter((i) => i.level === 'error')).toEqual([]);
    expect(r.issues.some((i) => /ANIMATIONS\.md/.test(i.message))).toBe(false);
  });

  it('reports a missing file', async () => {
    expect((await errs(withSrc(await orgDesign(), 'assets/anim/nope.webm'))).some((m) => /no file "assets\/anim\/nope\.webm"/.test(m))).toBe(true);
  });

  it('rejects formats the site cannot play and names the converter', async () => {
    const f = await orgDesign();
    f['assets/anim/raw.mov'] = new Uint8Array(10);
    const e = await errs(withSrc(f, 'assets/anim/raw.mov'));
    expect(e.some((m) => /Safari/.test(m) && /pnpm kodigo animation/.test(m))).toBe(true);
    expect((await errs(withSrc(await orgDesign(), 'assets/anim/index.html'))).some((m) => /render it first/.test(m))).toBe(true);
  });

  it('rejects a source list that mixes video and images', async () => {
    const f = await orgDesign();
    f['assets/anim/clip.gif'] = new Uint8Array(10);
    expect((await errs(withSrc(f, '[assets/anim/transfer-pricing.webm, assets/anim/clip.gif]'))).some((m) => /don't mix videos/.test(m))).toBe(true);
  });

  it('needs at least 2 frames in a frame folder', async () => {
    const f = await orgDesign();
    f['assets/anim/frames/0001.png'] = new Uint8Array(10);
    expect((await errs(withSrc(f, 'assets/anim/frames/'))).some((m) => /at least 2 frames/.test(m))).toBe(true);
    f['assets/anim/frames/0002.png'] = new Uint8Array(10);
    expect((await errs(withSrc(f, 'assets/anim/frames/'))).filter((m) => /frame/.test(m))).toEqual([]);
  });

  it('checks the segment and the poster', async () => {
    // the clip is played in segments (start/end bound to scene state): swap its segment for a backwards one
    const seg = await orgDesign();
    const y = seg['intuition.yaml'] as string;
    const SEG = "start: '@animFrom'\n          end: '@animTo'";
    const k = y.indexOf(SEG, y.indexOf(SRC));
    expect(k).toBeGreaterThan(y.indexOf(SRC));
    seg['intuition.yaml'] = y.slice(0, k) + 'start: 3\n          end: 2' + y.slice(k + SEG.length);
    expect((await errs(seg)).some((m) => /`end` must come after `start`/.test(m))).toBe(true);
    const f = await orgDesign();
    f['intuition.yaml'] = (f['intuition.yaml'] as string).replace('poster: assets/anim/transfer-pricing.poster.jpg', 'poster: assets/anim/transfer-pricing.mp4');
    expect((await errs(f)).some((m) => /a poster is a still image/.test(m))).toBe(true);
  });

  it('warns about files over 8 MB', async () => {
    const f = await orgDesign();
    f['assets/anim/transfer-pricing.webm'] = new Uint8Array(9 * 1024 * 1024);
    const r = await report(f);
    expect(r.issues.some((i) => i.level === 'warning' && /9\.0 MB/.test(i.message))).toBe(true);
  });
});
