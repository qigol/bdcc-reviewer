/**
 * Tiny safe expression language for `when` gates (guide §5.7):
 *   == != < <= > >= and or not + - * / %, parentheses, dot paths (freq.count, pair.0),
 *   numbers, 'strings', true/false/null, and len(x) has(arr, v) abs(x) round(x, d).
 * No eval / Function: parsed to an AST and interpreted.
 */
import { getPath, type Scope } from './interpolate';

type Tok = { t: 'num' | 'str' | 'id' | 'op' | 'lp' | 'rp' | 'comma' | 'eof'; v: any; pos: number };

function lex(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      const m = /^[0-9]*\.?[0-9]+(e[+-]?[0-9]+)?/i.exec(src.slice(i))!;
      toks.push({ t: 'num', v: Number(m[0]), pos: i }); i += m[0].length; continue;
    }
    if (c === "'" || c === '"') {
      const end = src.indexOf(c, i + 1);
      if (end < 0) throw new Error(`unterminated string at ${i}`);
      toks.push({ t: 'str', v: src.slice(i + 1, end), pos: i }); i = end + 1; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)*/.exec(src.slice(i))!;
      toks.push({ t: 'id', v: m[0], pos: i }); i += m[0].length; continue;
    }
    const two = src.slice(i, i + 2);
    if (['==', '!=', '<=', '>=', '&&', '||'].includes(two)) { toks.push({ t: 'op', v: two === '&&' ? 'and' : two === '||' ? 'or' : two, pos: i }); i += 2; continue; }
    if ('<>+-*/%!'.includes(c)) { toks.push({ t: 'op', v: c === '!' ? 'not' : c, pos: i }); i++; continue; }
    if (c === '(') { toks.push({ t: 'lp', v: c, pos: i }); i++; continue; }
    if (c === ')') { toks.push({ t: 'rp', v: c, pos: i }); i++; continue; }
    if (c === ',') { toks.push({ t: 'comma', v: c, pos: i }); i++; continue; }
    throw new Error(`unexpected character '${c}' at ${i}`);
  }
  toks.push({ t: 'eof', v: null, pos: src.length });
  return toks;
}

type Node =
  | { k: 'lit'; v: any }
  | { k: 'var'; path: string }
  | { k: 'un'; op: string; a: Node }
  | { k: 'bin'; op: string; a: Node; b: Node }
  | { k: 'call'; fn: string; args: Node[] };

const PREC: Record<string, number> = { or: 1, and: 2, '==': 3, '!=': 3, '<': 4, '<=': 4, '>': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6 };
const FUNCS: Record<string, (...a: any[]) => any> = {
  len: (x) => (x == null ? 0 : Array.isArray(x) || typeof x === 'string' ? x.length : typeof x === 'object' ? Object.keys(x).length : 0),
  has: (arr, v) => (Array.isArray(arr) ? arr.some((x) => x === v || JSON.stringify(x) === JSON.stringify(v)) : false),
  abs: (x) => Math.abs(x),
  round: (x, d = 0) => Math.round(x * 10 ** d) / 10 ** d,
  min: (...a) => Math.min(...a),
  max: (...a) => Math.max(...a),
};

export function parseExpr(src: string): Node {
  const toks = lex(src);
  let p = 0;
  const peek = () => toks[p];
  const next = () => toks[p++];
  function primary(): Node {
    const t = next();
    if (t.t === 'num' || t.t === 'str') return { k: 'lit', v: t.v };
    if (t.t === 'lp') { const e = expr(0); if (next().t !== 'rp') throw new Error('expected )'); return e; }
    if (t.t === 'op' && (t.v === '-' || t.v === 'not')) return { k: 'un', op: t.v, a: unary(t.v) };
    if (t.t === 'id') {
      if (t.v === 'true') return { k: 'lit', v: true };
      if (t.v === 'false') return { k: 'lit', v: false };
      if (t.v === 'null') return { k: 'lit', v: null };
      if (t.v === 'not') return { k: 'un', op: 'not', a: unary('not') };
      if (peek().t === 'lp') {
        if (!(t.v in FUNCS)) throw new Error(`unknown function ${t.v}()`);
        next();
        const args: Node[] = [];
        if (peek().t !== 'rp') {
          for (;;) { args.push(expr(0)); if (peek().t === 'comma') { next(); continue; } break; }
        }
        if (next().t !== 'rp') throw new Error('expected ) after arguments');
        return { k: 'call', fn: t.v, args };
      }
      return { k: 'var', path: t.v };
    }
    throw new Error(`unexpected token '${t.v ?? t.t}' at ${t.pos}`);
  }
  function unary(op: string): Node {
    // 'not' binds looser than comparisons? Keep it simple: not applies to a comparison-level expression
    return op === 'not' ? expr(3) : primary();
  }
  function expr(minPrec: number): Node {
    let left = primary();
    for (;;) {
      const t = peek();
      const op = t.t === 'op' ? t.v : t.t === 'id' && (t.v === 'and' || t.v === 'or') ? t.v : null;
      if (!op || PREC[op] === undefined || PREC[op] < minPrec) break;
      next();
      const right = expr(PREC[op] + 1);
      left = { k: 'bin', op, a: left, b: right };
    }
    return left;
  }
  const e = expr(0);
  if (peek().t !== 'eof') throw new Error(`unexpected '${peek().v}' at ${peek().pos}`);
  return e;
}

export function varsOf(node: Node, out: string[] = []): string[] {
  if (node.k === 'var') out.push(node.path);
  else if (node.k === 'un') varsOf(node.a, out);
  else if (node.k === 'bin') { varsOf(node.a, out); varsOf(node.b, out); }
  else if (node.k === 'call') node.args.forEach((a) => varsOf(a, out));
  return out;
}

function ev(n: Node, scope: Scope): any {
  switch (n.k) {
    case 'lit': return n.v;
    case 'var': return getPath(scope, n.path).value;
    case 'un': return n.op === 'not' ? !ev(n.a, scope) : -ev(n.a, scope);
    case 'call': return FUNCS[n.fn](...n.args.map((a) => ev(a, scope)));
    case 'bin': {
      if (n.op === 'and') return ev(n.a, scope) && ev(n.b, scope);
      if (n.op === 'or') return ev(n.a, scope) || ev(n.b, scope);
      const a = ev(n.a, scope), b = ev(n.b, scope);
      switch (n.op) {
        case '==': return typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-9 : JSON.stringify(a) === JSON.stringify(b);
        case '!=': return typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) >= 1e-9 : JSON.stringify(a) !== JSON.stringify(b);
        case '<': return a < b;
        case '<=': return a <= b;
        case '>': return a > b;
        case '>=': return a >= b;
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': return a / b;
        case '%': return a % b;
      }
    }
  }
  return undefined;
}

const cache = new Map<string, Node>();
export function evalExpr(src: string, scope: Scope): any {
  let node = cache.get(src);
  if (!node) { node = parseExpr(src); cache.set(src, node); }
  try { return ev(node, scope); } catch { return false; }
}
