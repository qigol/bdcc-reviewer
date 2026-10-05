import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  validateModule, buildInstance, checkJournalEntry, parseNumber, formatValue, interpolate, collectTermLinks, stripTermLinks,
  learningPath, termHomes, glossaryWithHomes, workbenchTabLabel, parseModule, type FileMap,
} from '../src/index';
import { fmt, moneyText } from '@kodigo/sdk';
import { createNodeHost, readModuleDir } from '../src/node';

const fixture = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/joc-demo');
const hostFactory = (src: string) => createNodeHost(src);
const load = () => readModuleDir(fixture);
const errorsOf = async (files: FileMap) => (await validateModule(files, { hostFactory, seeds: 3 })).issues.filter((i) => i.level === 'error');

describe('journal-workbench fixture (guide 2)', () => {
  it('validates with no errors and reproduces its examples', async () => {
    const r = await validateModule(await load(), { hostFactory, seeds: 15 });
    const errors = r.issues.filter((i) => i.level === 'error');
    expect(errors, errors.map((e) => e.message).join('\n')).toEqual([]);
    expect(r.stats?.examplesPassed).toBe(4);
  }, 60_000);

  it('a glossary term no beat defines is an error under guide 2 (a warning otherwise)', async () => {
    const f = await load();
    f['intuition.yaml'] = (f['intuition.yaml'] as string).replace('        define: [finished-goods]\n', '');
    const errs = await errorsOf(f);
    expect(errs.some((e) => /never introduced/.test(e.message) && /finished-goods/.test(e.message))).toBe(true);
    f['manifest.yaml'] = (f['manifest.yaml'] as string).replace('guide: 2\n', '');
    const r = await validateModule(f, { hostFactory, seeds: 2 });
    expect(r.issues.some((e) => e.level === 'error' && /never introduced/.test(e.message))).toBe(false);
    expect(r.issues.some((e) => e.level === 'warning' && /never introduced/.test(e.message))).toBe(true);
  });

  it('unknown define ids and [[term]] links are errors', async () => {
    const f = await load();
    f['intuition.yaml'] = (f['intuition.yaml'] as string).replace('define: [job-cost-sheet]', 'define: [job-cost-sheet, no-such-term]').replace('[[manufacturing-overhead]]', '[[manufacturing-overheads]]');
    const errs = await errorsOf(f);
    expect(errs.some((e) => /define: "no-such-term"/.test(e.message))).toBe(true);
    expect(errs.some((e) => /\[\[manufacturing-overheads\]\]/.test(e.message))).toBe(true);
  });

  it('an unbalanced static entry and an unpaired journal anchor are errors', async () => {
    const f = await load();
    f['math-code.yaml'] = (f['math-code.yaml'] as string)
      .replace("- { account: Raw Materials, credit: '@dm', anchor: dm }", '- { account: Raw Materials, credit: 1, anchor: dmx }');
    const errs = await errorsOf(f);
    expect(errs.some((e) => /does not balance/.test(e.message))).toBe(true);
    expect(errs.some((e) => /journal anchor "dmx"/.test(e.message))).toBe(true);
  });

  it('a section without its workbench pane is an error under guide 2', async () => {
    const f = await load();
    const src = f['math-code.yaml'] as string;
    f['math-code.yaml'] = src.replace(/    journal:\n      title: Overhead budget\n[\s\S]*?(?=    links:)/, "    code: { source: 'rate = est_oh / est_base' }\n");
    const errs = await errorsOf(f);
    expect(errs.some((e) => /needs a `journal` pane/.test(e.message))).toBe(true);
  });

  it('practice gates and tryIt must name real templates', async () => {
    const f = await load();
    f['intuition.yaml'] = (f['intuition.yaml'] as string).replace('template: close-je', 'template: nope');
    f['math-code.yaml'] = (f['math-code.yaml'] as string).replace('tryIt: [rate-numeric]', 'tryIt: [ghost]');
    const errs = await errorsOf(f);
    expect(errs.some((e) => /practice gate: unknown quiz template "nope"/.test(e.message))).toBe(true);
    expect(errs.some((e) => /tryIt: unknown quiz template "ghost"/.test(e.message))).toBe(true);
  });

  it('builds the learning path: scenes, then the sections they unlock, then the case and a mastery check', async () => {
    const { module } = parseModule(await load());
    const p = learningPath(module!);
    expect(p.map((s) => `${s.kind}:${s.id}`)).toEqual([
      'scene:why-a-rate', 'section:pohr', 'scene:follow-the-cost', 'section:job-cost', 'section:close-overhead', 'case:kapitan-quote', 'mastery:mastery',
    ]);
    expect(termHomes(module!.intuition)['finished-goods']).toEqual({ scene: 'follow-the-cost', beat: 3 });
    expect(glossaryWithHomes(module!.glossary, module!.intuition).find((t) => t.id === 'allocation-base')?.lessonRef).toEqual({ tab: 'intuition', id: 'why-a-rate' });
    expect(workbenchTabLabel(module!.manifest)).toBe('Math & Journal');
  });
});

describe('journal-entry and schedule-fill questions', () => {
  const parse = (s: string) => parseNumber(s, ['decimal']);
  const expected = { lines: [{ account: 'Cost of Goods Sold', debit: 27000 }, { account: 'Manufacturing Overhead', credit: 27000 }] };

  it('full credit for the right accounts, sides and amounts (any case, any line order, currency symbols ok)', () => {
    const r = checkJournalEntry([
      { account: 'manufacturing overhead', debit: '', credit: '27000' },
      { account: 'Cost of Goods Sold', debit: '₱27,000', credit: '' },
    ], expected, { parse });
    expect(r.score).toBe(1);
    expect(r.balanced).toBe(true);
  });

  it('reversed entries, wrong amounts and stray accounts get specific feedback', () => {
    const rev = checkJournalEntry([
      { account: 'Manufacturing Overhead', debit: '27000', credit: '' },
      { account: 'Cost of Goods Sold', debit: '', credit: '27000' },
    ], expected, { parse });
    expect(rev.score).toBe(0);
    expect(rev.feedback.join(' ')).toMatch(/reversed/);
    const bad = checkJournalEntry([
      { account: 'Cost of Goods Sold', debit: '26000', credit: '' },
      { account: 'Manufacturing Overhead', debit: '', credit: '27000' },
      { account: 'Work in Process', debit: '1000', credit: '' },
    ], expected, { parse });
    expect(bad.score).toBe(0); // 1 right − 1 extra
    expect(bad.feedback.join(' ')).toMatch(/amount for \*\*Cost of Goods Sold\*\* is off/);
    expect(bad.feedback.join(' ')).toMatch(/Work in Process\*\* doesn't belong/);
  });

  it('instances resolve generator vars and flag unbalanced or unknown-account answers', () => {
    const t: any = {
      id: 'x', type: 'journal-entry', skills: ['s'], difficulty: 1, tags: ['journal'], prompt: 'p', explanation: 'e',
      accounts: ['Cash', 'Sales', 'Rent'], entries: [{ lines: [{ account: 'Cash', debit: '@a' }, { account: 'Sales', credit: '@a' }] }],
    };
    const ok = buildInstance({ moduleId: 'm', datasets: {} }, t, 1, { vars: { a: 500 } });
    expect(ok.problems).toEqual([]);
    expect(ok.entries![0].lines[0]).toEqual({ account: 'Cash', debit: 500, credit: null });
    const bad = buildInstance({ moduleId: 'm', datasets: {} }, { ...t, entries: [{ lines: [{ account: 'Cash', debit: 500 }, { account: 'Loans', credit: 400 }] }] }, 1);
    expect(bad.problems.join(' ')).toMatch(/does not balance/);
    expect(bad.problems.join(' ')).toMatch(/"Loans" is not in accounts/);
  });

  it('schedule-fill needs at least one numeric blank', () => {
    const t: any = { id: 'y', type: 'schedule-fill', skills: ['s'], difficulty: 1, tags: ['journal'], prompt: 'p', explanation: 'e',
      rows: [{ label: 'Sales', amount: 100 }, { label: 'CM', amount: '@cm', blank: true }] };
    expect(buildInstance({ moduleId: 'm', datasets: {} }, t, 1, { vars: { cm: 40 } }).problems).toEqual([]);
    expect(buildInstance({ moduleId: 'm', datasets: {} }, { ...t, rows: [{ label: 'a', amount: 1 }, { label: 'b', amount: 2 }] }, 1).problems.join()).toMatch(/blank: true/);
  });
});

describe('money formats, parsing and term links', () => {
  it('formats pesos and thousands', () => {
    expect(fmt(61000, 'money')).toBe('₱61,000');
    expect(fmt(1250.5, 'money')).toBe('₱1,250.50');
    expect(fmt(15, 'money2')).toBe('₱15.00');
    expect(fmt(-300, 'money')).toBe('−₱300');
    expect(fmt(1234567.891, 'comma')).toBe('1,234,567.89');
    expect(fmt(40000, 'comma0')).toBe('40,000');
    expect(moneyText(2.5, undefined, '$')).toBe('$2.50');
    expect(formatValue(600000, 'comma', true)).toBe('600{,}000');
    expect(formatValue(15, 'money2', true)).toBe('\\text{₱}15.00');
    expect(interpolate('Pay {=x|money} now', { x: 1200 }).text).toBe('Pay ₱1,200 now');
  });

  it('reads accounting-style answers', () => {
    expect(parseNumber('₱12,500')).toBe(12500);
    expect(parseNumber('P 12,500.50')).toBe(12500.5);
    expect(parseNumber('(1,200)')).toBe(-1200);
    expect(parseNumber('PHP 300')).toBe(300);
  });

  it('collects and strips [[term]] links', () => {
    expect(collectTermLinks('see [[work-in-process]] and [[applied-overhead|overhead applied]]')).toEqual([
      { id: 'work-in-process', text: undefined }, { id: 'applied-overhead', text: 'overhead applied' },
    ]);
    expect(stripTermLinks('the [[wip|WIP]] and [[cogs]]', { cogs: 'COGS' })).toBe('the WIP and COGS');
  });
});
