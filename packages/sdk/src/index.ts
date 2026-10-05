/**
 * @kodigo/sdk — helpers handed to every module's logic.js as `register(sdk)`.
 * Pure, dependency-free, isomorphic (browser worker, Node CLI, server).
 * Sets are plain arrays; matrices are arrays of rows; `null` marks a missing cell.
 */

export type Num = number;
export type Matrix = (number | null)[][];

// ---------------------------------------------------------------- RNG
export interface Rng {
  float(): number;
  int(lo: number, hi: number): number;
  pick<T>(arr: readonly T[]): T;
  sample<T>(arr: readonly T[], k: number): T[];
  shuffle<T>(arr: readonly T[]): T[];
  bool(p?: number): boolean;
  /** internal state, for debugging */
  readonly seed: number;
}

/** mulberry32: tiny, fast, good enough for quiz generation; fully reproducible. */
export function createRng(seed: number): Rng {
  let a = (seed >>> 0) || 0x9e3779b9;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    seed,
    float: next,
    int(lo, hi) {
      lo = Math.ceil(lo); hi = Math.floor(hi);
      return lo + Math.floor(next() * (hi - lo + 1));
    },
    pick(arr) {
      if (!arr.length) throw new Error('rng.pick: empty array');
      return arr[Math.floor(next() * arr.length)];
    },
    shuffle(arr) {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    sample(arr, k) {
      return rng.shuffle(arr).slice(0, Math.max(0, Math.min(k, arr.length)));
    },
    bool(p = 0.5) { return next() < p; },
  };
  return rng;
}

/** Hash a string to a 32-bit seed (FNV-1a). */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// ---------------------------------------------------------------- numbers
export function round(x: number, d = 2): number {
  if (x === null || x === undefined || !Number.isFinite(x)) return x;
  const f = Math.pow(10, d);
  const r = Math.round((x + Number.EPSILON * Math.sign(x)) * f) / f;
  return Object.is(r, -0) ? 0 : r;
}

export function approx(a: number, b: number, tol = 1e-9): boolean {
  return Math.abs(a - b) <= tol;
}

function gcd(a: number, b: number): number {
  a = Math.abs(a); b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

/** Best fraction with denominator ≤ maxDen if it matches within 1e-9, else 2 dp string. */
export function frac(x: number, maxDen = 12): string {
  if (!Number.isFinite(x)) return String(x);
  if (Number.isInteger(x)) return String(x);
  for (let den = 2; den <= maxDen; den++) {
    const num = Math.round(x * den);
    if (Math.abs(num / den - x) < 1e-9) {
      const g = gcd(num, den);
      return `${num / g}/${den / g}`;
    }
  }
  return String(round(x, 2));
}

function stripZeros(s: string): string {
  if (!s.includes('.')) return s;
  s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s === '-0' ? '0' : s;
}

/**
 * Format a number by spec: '' (2 dp stripped) | '0'..'9' (N dp stripped) | 'Nf' (fixed) |
 * 'frac' | 'pct' | 'pct1' | 'int'.
 */
export function fmt(x: unknown, spec = ''): string {
  if (x === null || x === undefined) return '—';
  if (typeof x !== 'number') return String(x);
  if (!Number.isFinite(x)) return x > 0 ? '∞' : x < 0 ? '−∞' : 'NaN';
  if (spec === '' || spec === undefined) return stripZeros(round(x, 2).toFixed(2));
  if (/^\d$/.test(spec)) { const d = Number(spec); return stripZeros(round(x, d).toFixed(d)); }
  const fixed = /^(\d)f$/.exec(spec);
  if (fixed) return round(x, Number(fixed[1])).toFixed(Number(fixed[1]));
  if (spec === 'frac') return frac(x, 12);
  if (spec === 'pct') return `${stripZeros(round(x * 100, 0).toFixed(0))}%`;
  const pct = /^pct(\d)$/.exec(spec);
  if (pct) return `${stripZeros(round(x * 100, Number(pct[1])).toFixed(Number(pct[1])))}%`;
  if (spec === 'int') return String(Math.round(x));
  const comma = /^comma(\d)?$/.exec(spec);
  if (comma) return comma[1] === undefined ? groupThousands(stripZeros(round(x, 2).toFixed(2))) : groupThousands(round(x, Number(comma[1])).toFixed(Number(comma[1])));
  const money = /^money(\d)?$/.exec(spec);
  if (money) return moneyText(x, money[1] === undefined ? undefined : Number(money[1]));
  return stripZeros(round(x, 2).toFixed(2));
}

/** '1234567.5' → '1,234,567.5' (a leading minus becomes the real minus sign). */
export function groupThousands(s: string): string {
  const neg = s.startsWith('-');
  const [int, dec] = (neg ? s.slice(1) : s).split('.');
  const g = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${neg ? '−' : ''}${g}${dec !== undefined ? `.${dec}` : ''}`;
}

/**
 * Money: thousands separators, 0 decimals when the amount is whole (to the centavo) and 2 otherwise,
 * unless `decimals` is given. `₱12,500`, `₱1,250.50`, `−₱300`.
 */
export function moneyText(x: number, decimals?: number, symbol = '₱'): string {
  if (!Number.isFinite(x)) return fmt(x);
  const d = decimals ?? (Math.abs(x - Math.round(x)) < 0.005 ? 0 : 2);
  const body = groupThousands(round(Math.abs(x), d).toFixed(d));
  return `${x < 0 && round(Math.abs(x), d) !== 0 ? '−' : ''}${symbol}${body}`;
}

// ---------------------------------------------------------------- vectors
export const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
export const mean = (a: number[]) => (a.length ? sum(a) / a.length : NaN);
export function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) s += a[i] * b[i];
  return s;
}
export const norm = (a: number[]) => Math.sqrt(dot(a, a));
export function cosine(a: number[], b: number[]): number {
  const na = norm(a), nb = norm(b);
  if (na === 0 || nb === 0) return 0;
  return dot(a, b) / (na * nb);
}

// ---------------------------------------------------------------- matrices
export function zeros(m: number, n: number): number[][] {
  return Array.from({ length: m }, () => Array(n).fill(0));
}
export function transpose<T>(M: T[][]): T[][] {
  if (!M.length) return [];
  return M[0].map((_, j) => M.map((row) => row[j]));
}
export function matmul(A: number[][], B: number[][]): number[][] {
  const m = A.length, k = B.length, n = B[0]?.length ?? 0;
  const C = zeros(m, n);
  for (let i = 0; i < m; i++)
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let t = 0; t < k; t++) s += A[i][t] * B[t][j];
      C[i][j] = s;
    }
  return C;
}

/** Solve a small dense square system A x = b by Gaussian elimination with partial pivoting. */
export function solve(A: number[][], b: number[]): number[] {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) throw new Error('solve: singular matrix (use lstsq for a minimum-norm solution)');
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/** Symmetric eigen-decomposition (Jacobi). Returns eigenvalues and eigenvectors (columns). */
export function eigSym(S: number[][]): { values: number[]; vectors: number[][] } {
  const n = S.length;
  const A = S.map((r) => r.slice());
  const V: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j];
    if (off < 1e-22) break;
    for (let p = 0; p < n; p++)
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-15) continue;
        const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = A[k][p], akq = A[k][q];
          A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p][k], aqk = A[q][k];
          A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = V[k][p], vkq = V[k][q];
          V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq;
        }
      }
  }
  return { values: A.map((r, i) => r[i]), vectors: V };
}

/** Moore–Penrose pseudo-inverse of a small symmetric PSD matrix. */
export function pinvSym(S: number[][], tol = 1e-10): number[][] {
  const { values, vectors } = eigSym(S);
  const n = S.length;
  const P = zeros(n, n);
  const maxv = Math.max(...values.map(Math.abs), 0);
  values.forEach((lam, k) => {
    if (Math.abs(lam) <= tol * Math.max(1, maxv)) return;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) P[i][j] += (vectors[i][k] * vectors[j][k]) / lam;
  });
  return P;
}

/**
 * Least squares min ||A x − b||² with the minimum-norm solution when A is rank-deficient
 * (e.g. ALS started from all-ones U: only v1+v2 is determined, so it splits evenly).
 */
export function lstsq(A: number[][], b: number[]): number[] {
  const At = transpose(A);
  const AtA = matmul(At, A);
  const Atb = At.map((row) => dot(row, b));
  const P = pinvSym(AtA);
  return P.map((row) => dot(row, Atb));
}

/** Row means over observed (non-null) entries. */
export function rowMeans(M: Matrix): number[] {
  return M.map((row) => {
    const o = row.filter((x): x is number => x !== null && x !== undefined);
    return o.length ? sum(o) / o.length : NaN;
  });
}
/** [[i, j], …] for every observed cell, row-major. */
export function observed(M: Matrix): [number, number][] {
  const out: [number, number][] = [];
  M.forEach((row, i) => row.forEach((x, j) => { if (x !== null && x !== undefined) out.push([i, j]); }));
  return out;
}

// ---------------------------------------------------------------- sets (arrays)
export function combinations<T>(arr: readonly T[], k: number): T[][] {
  const out: T[][] = [];
  const cur: T[] = [];
  const rec = (start: number) => {
    if (cur.length === k) { out.push(cur.slice()); return; }
    for (let i = start; i < arr.length; i++) { cur.push(arr[i]); rec(i + 1); cur.pop(); }
  };
  if (k >= 0 && k <= arr.length) rec(0);
  return out;
}
export function powerset<T>(arr: readonly T[], opts: { min?: number; max?: number } = {}): T[][] {
  const min = opts.min ?? 1, max = opts.max ?? arr.length;
  const out: T[][] = [];
  for (let k = min; k <= Math.min(max, arr.length); k++) out.push(...combinations(arr, k));
  return out;
}
function cmpBy(order?: readonly string[]) {
  return (a: any, b: any) => {
    if (order) {
      const ia = order.indexOf(a), ib = order.indexOf(b);
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 1e9 : ia) - (ib === -1 ? 1e9 : ib);
    }
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
  };
}
/** Deduplicate and sort (by `order` if given, else natural/alphabetical). */
export function sortSet<T>(set: readonly T[], order?: readonly string[]): T[] {
  return [...new Set(set)].sort(cmpBy(order));
}
/** Canonical itemset key, e.g. 'bread,milk'. */
export function key(set: readonly unknown[], order?: readonly string[]): string {
  return sortSet(set as any[], order).join(',');
}
export function isSubset(a: readonly unknown[], b: readonly unknown[]): boolean {
  const B = new Set(b);
  return a.every((x) => B.has(x));
}
export const union = <T>(a: readonly T[], b: readonly T[]) => sortSet([...a, ...b]);
export const intersect = <T>(a: readonly T[], b: readonly T[]) => { const B = new Set(b); return sortSet(a.filter((x) => B.has(x))); };
export const difference = <T>(a: readonly T[], b: readonly T[]) => { const B = new Set(b); return sortSet(a.filter((x) => !B.has(x))); };

// ---------------------------------------------------------------- misc
export const log2 = (x: number) => Math.log2(x);
export const range = (n: number) => Array.from({ length: n }, (_, i) => i);
export function assert(cond: unknown, msg = 'assertion failed'): asserts cond {
  if (!cond) throw new Error(msg);
}

export const sdk = {
  round, fmt, frac, approx,
  sum, mean, dot, norm, cosine,
  zeros, transpose, matmul, solve, lstsq, pinvSym, eigSym, rowMeans, observed,
  combinations, powerset, sortSet, key, isSubset, union, intersect, difference,
  log2, range, assert, createRng, hashSeed,
};
export type Sdk = typeof sdk;
export default sdk;
