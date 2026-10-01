import { describe, expect, it } from 'vitest';
import {
  interpolate, resolveRefs, getPath, collectRefs, mathRegions,
  parseExpr, evalExpr, varsOf,
  texAnchors, parseCodeAnchors,
  parseBundle, formatBundle, readZip, writeZip,
  parseNumber, checkNumeric, checkMulti, checkBlank, checkOrder, checkMatch, valuesEqual,
  WIDGETS, widgetsMarkdown,
  liveRoleTarget, defaultLiveWidgets, codeLineCount,
} from '../src/index';

describe('interpolation', () => {
  const scope = { s: { conf: 2 / 3, n: 5 }, name: 'bread', items: ['a', 'b'] };
  it('resolves paths and refs', () => {
    expect(getPath(scope, 's.n')).toEqual({ found: true, value: 5 });
    expect(getPath(scope, 'items.1').value).toBe('b');
    expect(getPath(scope, 'nope.x').found).toBe(false);
    expect(resolveRefs({ a: '@s.n', b: ['@name', 'lit'] }, scope)).toEqual({ a: 5, b: ['bread', 'lit'] });
    expect(collectRefs({ a: '@s.n', b: ['@name'] }).sort()).toEqual(['name', 's.n']);
  });
  it('formats values inline', () => {
    expect(interpolate('conf = {=s.conf|3}', scope).text).toBe('conf = 0.667');
    expect(interpolate('{=s.conf|pct}', scope).text).toBe('67%');
    const r = interpolate('{=missing.path}', scope);
    expect(r.missing).toEqual(['missing.path']);
  });
  it('detects math regions', () => {
    const inMath = mathRegions('text $x$ more');
    expect(inMath(6)).toBe(true);
    expect(inMath(1)).toBe(false);
  });
});

describe('gate expressions', () => {
  it('evaluates safely', () => {
    expect(evalExpr('abs(x - 2.6) < 0.06', { x: 2.62 })).toBe(true);
    expect(evalExpr('len(sel) >= 2 and has(sel, "milk")', { sel: ['bread', 'milk'] })).toBe(true);
    expect(evalExpr('a.b + 1 == 3', { a: { b: 2 } })).toBe(true);
    expect(evalExpr('not (x > 1) or y', { x: 5, y: false })).toBe(false);
    expect(varsOf(parseExpr('a.b + max(c, 1)')).sort()).toEqual(['a.b', 'c']);
  });
  it('rejects code injection', () => {
    expect(() => parseExpr('constructor.constructor("return 1")()')).toThrow();
    expect(() => parseExpr('x; y')).toThrow();
  });
});

describe('anchors', () => {
  it('finds TeX anchors (lowercase names only)', () => {
    expect(texAnchors('\\anchor{num}{a} + \\anchor{den}{b} + \\anchor{num}{c}')).toEqual(['num', 'den']);
    expect(texAnchors('\\anchor{camelCase}{x}')).toEqual([]);
  });
  it('parses code anchor blocks and trailing markers', () => {
    const src = ['# @a loop', 'for x in xs:', '    y += x   # @a:acc', '# @end', 'print(y)'].join('\n');
    const p = parseCodeAnchors(src, 'python');
    expect(p.lines).toEqual(['for x in xs:', '    y += x', 'print(y)']);
    expect(p.anchors.loop).toEqual([0, 1]);
    expect(p.anchors.acc).toEqual([1]);
    expect(p.problems).toEqual([]);
    expect(parseCodeAnchors('# @a open\nx = 1', 'python').problems.length).toBe(1);
  });
});

describe('bundles', () => {
  it('round-trips the LLM bundle format', () => {
    const files = { 'manifest.yaml': 'id: demo\n', 'logic.js': 'export default {}\n' };
    const text = formatBundle('demo', '1.0.0', files);
    const back = parseBundle(text);
    expect(back.errors).toEqual([]);
    expect(back.files).toEqual(files);
  });
  it('reports unterminated files', () => {
    const r = parseBundle('<<<FILE manifest.yaml>>>\nid: x\n');
    expect(r.incomplete).toBe('manifest.yaml');
  });
  it('round-trips zips (text and binary)', async () => {
    const files = { 'manifest.yaml': 'id: z\n', 'assets/a.png': new Uint8Array([137, 80, 78, 71]) };
    const zip = await writeZip(files, 'z');
    const back = await readZip(zip);
    expect(back['manifest.yaml']).toBe('id: z\n');
    expect(Array.from(back['assets/a.png'] as Uint8Array)).toEqual([137, 80, 78, 71]);
  });
});

describe('quiz checkers', () => {
  it('parses numbers and fractions', () => {
    expect(parseNumber('2/3')).toBeCloseTo(0.6667, 3);
    expect(parseNumber(' 0.5 ')).toBe(0.5);
    expect(parseNumber('60%', ['decimal', 'percent'])).toBeCloseTo(0.6, 10);
    expect(parseNumber('60%')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
  });
  it('grades numeric answers with misconception feedback', () => {
    const spec = { value: 0.6, tol: 0.01, accept: ['decimal', 'fraction'] as ('decimal' | 'fraction')[] };
    expect(checkNumeric('3/5', spec).correct).toBe(true);
    const r = checkNumeric('0.75', spec, [{ value: 0.75, feedback: 'You divided by the wrong support.' }]);
    expect(r.correct).toBe(false);
    expect(r.feedback).toMatch(/wrong support/);
  });
  it('partial credit for multi, order and match', () => {
    expect(checkMulti([0, 1], [0, 1])).toBe(1);
    expect(checkMulti([0, 2], [0, 1])).toBe(0);
    expect(checkMulti([0], [0, 1])).toBe(0.5);
    expect(checkOrder([0, 1, 2, 3])).toBe(1);
    expect(checkOrder([1, 0, 2, 3])).toBeLessThan(1);
    expect(checkOrder([3, 2, 1, 0])).toBe(0);
    expect(checkMatch([0, 1, null])).toBeCloseTo(2 / 3, 10);
  });
  it('code blanks ignore whitespace and quote style', () => {
    expect(checkBlank('support( "milk" )', { accept: ["support('milk')"] })).toBe(true);
    expect(checkBlank('x', { regex: '^x$' })).toBe(true);
    expect(checkBlank('', { accept: [''] })).toBe(false);
  });
  it('valuesEqual compares nested values with tolerance', () => {
    expect(valuesEqual({ a: [1, 2.0001] }, { a: [1, 2] } as any, 0.001)).toBe(true);
    expect(valuesEqual([1, 2], [1, 3] as any, 0.001)).toBe(false);
  });
});

describe('widget catalog', () => {
  it('has 20 documented widgets', () => {
    expect(WIDGETS.length).toBe(20);
    for (const w of WIDGETS) expect(w.name).toMatch(/^[A-Z][A-Za-z]+$/);
    expect(widgetsMarkdown()).toContain('## StepPlayer');
  });
});

describe('math-code live example', () => {
  const live = [
    { id: 'k-slider', widget: 'Slider' },
    { id: 'ds-r5x5', widget: 'Matrix' },
    { id: 'rank', widget: 'RankList' },
  ];
  it('routes trace roles to live widgets', () => {
    expect(liveRoleTarget('rank', live)).toBe('rank');
    expect(liveRoleTarget('r5x5', live)).toBe('ds-r5x5');
    expect(liveRoleTarget('matrix', live)).toBe('ds-r5x5');
    expect(liveRoleTarget('data', live)).toBe('k-slider');
    expect(liveRoleTarget('ranklist', live)).toBe('rank');
    expect(liveRoleTarget('table', live)).toBeNull();
  });
  it('builds one default widget per dataset', () => {
    const w = defaultLiveWidgets({ g: { id: 'g', kind: 'transactions', transactions: [] } as any, m: { id: 'm', kind: 'matrix', rows: [], cols: [], values: [] } as any }, ['g', 'm']);
    expect(w.map((x) => [x.id, x.widget])).toEqual([['ds-g', 'TransactionTable'], ['ds-m', 'Matrix']]);
  });
  it('does not count docstrings toward the code-length limit', () => {
    const src = 'def f(x):\n    """Summary.\n\n    Returns:\n        x\n    """\n    return x  # @a:ret\n\ndef g():\n    """One line."""\n    return 1\n';
    expect(codeLineCount(src)).toBe(5);
  });
});
