import { describe, expect, it } from 'vitest';
import { Template, buildInstance, buildGlossaryInstance, glossaryTemplateIds, glossaryKind, termSpellings, checkBlank, checkParsons, checkFindError, checkTwoTier, checkExplain, type QuizInstance } from '../src';

const ctx = { moduleId: 'm', datasets: {} };
const base = { skills: ['s'], difficulty: 2, tags: ['math'], prompt: 'Q', explanation: 'E' };
const build = (t: object, seed = 1, gen?: any): QuizInstance => buildInstance(ctx, Template.parse({ id: 't', ...base, ...t }), seed, gen);

describe('Parsons (order with distractors)', () => {
  it('appends decoys after the right lines', () => {
    const inst = build({ type: 'order', items: ['a', 'b', 'c'], distractors: ['x'] });
    expect(inst.items).toEqual(['a', 'b', 'c', 'x']);
    expect(inst.nCorrect).toBe(3);
    expect(inst.problems).toEqual([]);
  });
  it('rejects a decoy that repeats an item', () => {
    expect(build({ type: 'order', items: ['a', 'b'], distractors: ['a'] }).problems.length).toBeGreaterThan(0);
  });
  it('grades order, coverage and decoys', () => {
    expect(checkParsons([0, 1, 2], 3)).toBe(1);
    expect(checkParsons([0, 1, 2, 3], 3)).toBeCloseTo(0.95 - 0.28, 1); // perfect order − one decoy share, capped below 1
    expect(checkParsons([0, 1], 3)).toBeCloseTo(2 / 3);
    expect(checkParsons([2, 1, 0], 3)).toBe(0);
    expect(checkParsons([], 3)).toBe(0);
    expect(checkParsons([3], 3)).toBe(0);
  });
});

describe('cloze (code-fill with lang: text)', () => {
  it('matches case-insensitively and ignores a trailing period', () => {
    const b = { accept: ['Cost of Goods Sold'] };
    expect(checkBlank('cost of goods sold.', b, { ignoreCase: true })).toBe(true);
    expect(checkBlank('cost of goods sold', b)).toBe(false);
    expect(checkBlank('COGS', b, { ignoreCase: true })).toBe(false);
  });
});

describe('estimate-first numeric', () => {
  it('builds the estimate block, resolving refs', () => {
    const inst = build({ type: 'numeric', generator: 'g', answer: { var: 'x' }, estimate: { prompt: 'Above or below 1?', options: ['below 1', 'above 1'], answer: '@side' } }, 1, { vars: { x: 1.4, side: 1 } });
    expect(inst.estimate).toEqual({ prompt: 'Above or below 1?', options: ['below 1', 'above 1'], answer: 1, feedback: undefined });
    expect(inst.problems).toEqual([]);
  });
  it('flags an out-of-range estimate answer', () => {
    expect(build({ type: 'numeric', answer: { value: 2 }, estimate: { prompt: 'p', options: ['a', 'b'], answer: 5 } }).problems.length).toBe(1);
  });
});

describe('find-error', () => {
  const t = { type: 'find-error', generator: 'g', steps: '@steps', wrong: '@w', fix: { var: 'right' }, misconceptions: [{ var: 'bad', feedback: 'that is the wrong value again' }] };
  const gen = { vars: { steps: ['s1', 's2', 's3', 's4'], w: 2, right: 10, bad: 12 } };
  it('builds from generator refs', () => {
    const inst = build(t, 1, gen);
    expect(inst.lines).toHaveLength(4);
    expect(inst.wrong).toBe(2);
    expect(inst.fix?.value).toBe(10);
    expect(inst.problems).toEqual([]);
  });
  it('grades pick and fix', () => {
    const inst = build(t, 1, gen);
    expect(checkFindError(2, '10', inst).score).toBe(1);
    expect(checkFindError(2, '11', inst).score).toBe(0.5);
    expect(checkFindError(2, '12', inst).feedback).toContain('that is the wrong value again');
    expect(checkFindError(1, '10', inst).score).toBe(0);
  });
  it('without fix, the pick is the whole score', () => {
    const inst = build({ type: 'find-error', steps: ['a', 'b', 'c'], wrong: 0, stepFeedback: { 1: 'b is fine' } });
    expect(checkFindError(0, '', inst).score).toBe(1);
    expect(checkFindError(1, '', inst).feedback).toEqual(['b is fine']);
  });
  it('flags a wrong index out of range', () => {
    expect(build({ type: 'find-error', generator: 'g', steps: '@s', wrong: '@w' }, 1, { vars: { s: ['a', 'b', 'c'], w: 3 } }).problems.length).toBe(1);
  });
});

describe('two-tier', () => {
  it('shuffles both tiers and keeps the keys and feedback aligned', () => {
    for (let seed = 1; seed < 20; seed++) {
      const inst = build({ type: 'two-tier', options: ['yes', 'no'], answer: 1, reasons: ['r0', 'r1', 'r2'], reasonAnswer: 2, reasonFeedback: { 0: 'why r0 is wrong' } }, seed);
      expect(inst.options![inst.answer as number]).toBe('no');
      expect(inst.reasons![inst.reasonAnswer!]).toBe('r2');
      expect(inst.reasonFeedback![inst.reasons!.indexOf('r0')]).toBe('why r0 is wrong');
    }
  });
  it('gives the reason credit only with the right answer', () => {
    expect(checkTwoTier(1, 2, 1, 2).score).toBe(1);
    expect(checkTwoTier(1, 0, 1, 2).score).toBe(0.5);
    expect(checkTwoTier(0, 2, 1, 2).score).toBe(0);
  });
});

describe('explain', () => {
  it('scores the ticked share of the checklist', () => {
    const inst = build({ type: 'explain', model: 'M', checklist: ['a', 'b', 'c', 'd'] });
    expect(inst.checklist).toHaveLength(4);
    expect(checkExplain([true, false, true, false], 4)).toBe(0.5);
  });
});

describe('case', () => {
  it('builds every part from one generator draw', () => {
    const inst = build({
      type: 'case', generator: 'g',
      parts: [
        { type: 'numeric', prompt: 'rate', answer: { var: 'rate' } },
        { type: 'mcq', prompt: 'over or under?', options: ['over', 'under'], answer: 0 },
        { type: 'find-error', prompt: 'spot it', steps: ['a', 'b', 'c'], wrong: 1 },
      ],
    }, 1, { vars: { rate: 4.5 }, options: ['should', 'not leak'], answer: 1 });
    expect(inst.parts).toHaveLength(3);
    expect(inst.parts![0].numeric?.value).toBe(4.5);
    expect(inst.parts![1].options?.sort()).toEqual(['over', 'under']); // generator options don't leak into parts
    expect(inst.parts![0].skills).toEqual(['s']);
    expect(inst.problems).toEqual([]);
  });
  it('prefixes part problems', () => {
    const inst = build({ type: 'case', parts: [{ type: 'numeric', prompt: 'a', answer: { value: 1 } }, { type: 'mcq', prompt: 'b', options: ['x'], answer: 3 }] });
    expect(inst.problems.some((p) => p.startsWith('part 2:'))).toBe(true);
  });
  it('rejects explain and nested cases as parts', () => {
    expect(() => Template.parse({ id: 't', ...base, type: 'case', parts: [{ type: 'explain', prompt: 'p', model: 'm', checklist: ['a', 'b'] }, { type: 'mcq', prompt: 'b', options: ['x', 'y'], answer: 0 }] })).toThrow();
  });
});

describe('glossary produce', () => {
  const terms = [
    { id: 'sup', term: 'Support (absolute)', aka: ['support count'], short: 'number of baskets containing the itemset' },
    { id: 'conf', term: 'Confidence', short: 'support of X∪Y over support of X' },
  ] as any;
  it('is listed and classified as a cloze at difficulty 2', () => {
    expect(glossaryTemplateIds(terms)).toContain('glossary-produce-sup');
    expect(glossaryKind('glossary-produce-sup')).toEqual({ type: 'code-fill', difficulty: 2 });
    expect(glossaryKind('glossary-def-sup')).toEqual({ type: 'mcq', difficulty: 1 });
  });
  it('accepts the term, its aka and the bare term', () => {
    expect(termSpellings(terms[0])).toEqual(expect.arrayContaining(['Support (absolute)', 'Support', 'support count']));
    const inst = buildGlossaryInstance('m', terms, 'glossary-produce-sup', 1)!;
    expect(inst.type).toBe('code-fill');
    expect(inst.lang).toBe('text');
    expect(checkBlank('support', inst.blanks!['1'], { ignoreCase: true })).toBe(true);
    expect(inst.prompt).not.toContain('Support');
  });
  it('works even for a single-term glossary', () => {
    expect(buildGlossaryInstance('m', [terms[1]], 'glossary-produce-conf', 1)).not.toBeNull();
  });
});

describe('variants', () => {
  const t = {
    type: 'mcq', options: ['a0', 'b0', 'c0'], answer: 1, optionFeedback: { 0: 'why a0', 2: 'why c0' },
    variants: [
      { prompt: 'Q1', options: ['a1', 'b1', 'c1'], answer: 2, optionFeedback: { 0: 'why a1' } },
      { prompt: 'Q2', options: ['a2', 'b2'], answer: 0, explanation: 'E2' },
    ],
  };
  it('builds every scenario with its own answer and aligned feedback', () => {
    const parsed = Template.parse({ id: 't', ...base, ...t });
    for (let seed = 1; seed < 30; seed++) {
      for (const k of [0, 1, 2]) {
        const inst = buildInstance(ctx, parsed, seed, undefined, k);
        const right = ['b0', 'c1', 'a2'][k];
        expect(inst.options![inst.answer as number]).toBe(right);
        if (k === 0) expect(inst.optionFeedback![inst.options!.indexOf('c0')]).toBe('why c0');
        if (k === 1) { expect(inst.prompt).toBe('Q1'); expect(inst.optionFeedback![inst.options!.indexOf('a1')]).toBe('why a1'); expect(Object.keys(inst.optionFeedback!)).toHaveLength(1); }
        if (k === 2) { expect(inst.explanation).toBe('E2'); expect(inst.optionFeedback).toEqual({}); }
        expect(inst.problems).toEqual([]);
      }
    }
  });
  it('picks a scenario from the seed, the same one every time', () => {
    const parsed = Template.parse({ id: 't', ...base, ...t });
    const seen = new Set<string>();
    for (let seed = 1; seed < 60; seed++) {
      const a = buildInstance(ctx, parsed, seed), b = buildInstance(ctx, parsed, seed);
      expect(a.prompt).toBe(b.prompt);
      seen.add(a.prompt);
    }
    expect(seen.size).toBe(3);
  });
  it('flags feedback keys that are not option indexes', () => {
    const inst = buildInstance(ctx, Template.parse({ id: 't', ...base, type: 'mcq', options: ['x', 'y'], answer: 0, optionFeedback: { 5: 'nope' } }), 1);
    expect(inst.problems.some((p) => p.includes('optionFeedback key "5"'))).toBe(true);
  });
});

describe('find-error misconceptions', () => {
  it('only takes generator misconceptions keyed to the fix', () => {
    const inst = build({ type: 'find-error', generator: 'g', steps: ['a', 'b', 'c'], wrong: 1, fix: { var: 'x' } }, 1,
      { vars: { x: 5 }, misconceptions: [{ value: 7, feedback: 'keyed', for: 'x' }, { value: 9, feedback: 'unkeyed' }] });
    expect(inst.misconceptions!.map((m) => m.feedback)).toEqual(['keyed']);
  });
});
