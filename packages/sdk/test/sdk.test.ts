import { describe, expect, it } from 'vitest';
import {
  createRng, hashSeed, round, fmt, frac, approx, dot, cosine, matmul, transpose, solve, lstsq, pinvSym, eigSym,
  combinations, powerset, sortSet, key, isSubset, union, intersect, difference, mean,
} from '../src/index';

describe('rng', () => {
  it('is deterministic per seed', () => {
    const a = createRng(42), b = createRng(42), c = createRng(43);
    const xs = Array.from({ length: 5 }, () => a.float());
    expect(Array.from({ length: 5 }, () => b.float())).toEqual(xs);
    expect(Array.from({ length: 5 }, () => c.float())).not.toEqual(xs);
  });
  it('int / pick / sample / shuffle stay in range', () => {
    const r = createRng(7);
    for (let i = 0; i < 200; i++) {
      const n = r.int(2, 5);
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(5);
    }
    expect(['a', 'b', 'c']).toContain(r.pick(['a', 'b', 'c']));
    const s = r.sample([1, 2, 3, 4, 5], 3);
    expect(new Set(s).size).toBe(3);
    expect(r.shuffle([1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4]);
  });
  it('hashSeed is stable', () => {
    expect(hashSeed('fim/support')).toBe(hashSeed('fim/support'));
    expect(hashSeed('a')).not.toBe(hashSeed('b'));
  });
});

describe('numbers', () => {
  it('round and fmt', () => {
    expect(round(2.675, 2)).toBeCloseTo(2.68, 10);
    expect(fmt(0.5)).toBe('0.5');
    expect(fmt(2 / 3, '3')).toBe('0.667');
    expect(fmt(1, '2f')).toBe('1.00');
    expect(fmt(0.6, 'pct')).toBe('60%');
    expect(fmt(2 / 3, 'frac')).toBe('2/3');
    expect(fmt(3.7, 'int')).toBe('4');
    expect(fmt(null)).toBe('—');
    expect(frac(0.75)).toBe('3/4');
    expect(approx(0.1 + 0.2, 0.3)).toBe(true);
  });
});

describe('linear algebra', () => {
  it('dot, cosine, mean', () => {
    expect(dot([1, 2, 3], [4, 5, 6])).toBe(32);
    expect(cosine([1, 0], [0, 1])).toBe(0);
    expect(cosine([1, 1], [2, 2])).toBeCloseTo(1, 12);
    expect(mean([1, 2, 3, 4])).toBe(2.5);
  });
  it('matmul / transpose / solve', () => {
    expect(matmul([[1, 2], [3, 4]], [[5], [6]])).toEqual([[17], [39]]);
    expect(transpose([[1, 2, 3]])).toEqual([[1], [2], [3]]);
    const x = solve([[2, 1], [1, 3]], [3, 5]);
    expect(x[0]).toBeCloseTo(0.8, 10);
    expect(x[1]).toBeCloseTo(1.4, 10);
  });
  it('eigSym reconstructs a symmetric matrix', () => {
    const S = [[4, 1], [1, 3]];
    const { values } = eigSym(S);
    expect(values.reduce((a, b) => a + b, 0)).toBeCloseTo(7, 8);
    expect(values.reduce((a, b) => a * b, 1)).toBeCloseTo(11, 8);
  });
  it('lstsq gives the minimum-norm solution for rank-deficient systems (lecture ALS)', () => {
    // two identical columns: x1 + x2 is determined, minimum norm splits it evenly
    const A = [[1, 1], [1, 1], [1, 1]];
    const x = lstsq(A, [2, 4, 3]);
    expect(x[0]).toBeCloseTo(1.5, 8);
    expect(x[1]).toBeCloseTo(1.5, 8);
    const P = pinvSym([[2, 2], [2, 2]]);
    expect(P[0][0]).toBeCloseTo(0.125, 8);
  });
});

describe('sets', () => {
  it('combinations and powerset', () => {
    expect(combinations(['a', 'b', 'c'], 2)).toEqual([['a', 'b'], ['a', 'c'], ['b', 'c']]);
    expect(powerset(['a', 'b', 'c'], { min: 1 }).length).toBe(7);
  });
  it('ordering and set algebra', () => {
    const order = ['bread', 'butter', 'milk'];
    expect(sortSet(['milk', 'bread'], order)).toEqual(['bread', 'milk']);
    expect(key(['milk', 'bread'], order)).toBe(key(['bread', 'milk'], order));
    expect(isSubset(['a'], ['a', 'b'])).toBe(true);
    expect(isSubset(['c'], ['a', 'b'])).toBe(false);
    expect(union(['a'], ['b', 'a'])).toEqual(['a', 'b']);
    expect(intersect(['a', 'b'], ['b', 'c'])).toEqual(['b']);
    expect(difference(['a', 'b'], ['b'])).toEqual(['a']);
  });
});
