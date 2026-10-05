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
