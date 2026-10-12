/**
 * Arithmetic for the quiz calculator: + − × ÷, parentheses, %, and `Ans` (the last result).
 * Parsed and interpreted, never eval'd. Accepts what learners copy from a question:
 * `₱12,500`, `1,234.5`, `×` `÷` `−`, and implicit multiplication like `2(3 + 4)`.
 *
 * Percent works like a desk calculator: `15%` is 0.15, `20,900 × 150%` is 31,350,
 * and after + or − it is a percent of the left side, so `200 + 10%` is 220.
 */

type Tok = { t: 'num'; v: number } | { t: 'op'; v: string } | { t: 'ans' };
type Node = { k: 'num'; v: number } | { k: 'neg'; a: Node } | { k: 'pct'; a: Node } | { k: 'bin'; op: string; a: Node; b: Node };

export class CalcError extends Error {}

function lex(src: string): Tok[] {
  const s = src.replace(/[×xX✕]/g, '*').replace(/[÷:]/g, '/').replace(/[−–—]/g, '-').replace(/[₱$\s]/g, '');
  const toks: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/[0-9.]/.test(c)) {
      const m = /^(\d{1,3}(,\d{3})+(\.\d*)?|\d+(\.\d*)?(e[+-]?\d+)?|\.\d+(e[+-]?\d+)?)/i.exec(s.slice(i));
      if (!m) throw new CalcError(`Can't read the number at "${s.slice(i, i + 6)}"`);
      const next = s[i + m[0].length] ?? '';
      if (next === ',' || (m[0].includes(',') && /[0-9]/.test(next))) throw new CalcError('Use commas only between groups of three digits, like 12,500');
      if (next === '.') throw new CalcError('A number has two decimal points');
      toks.push({ t: 'num', v: Number(m[0].replace(/,/g, '')) });
      i += m[0].length;
      continue;
    }
    if (/^ans/i.test(s.slice(i))) { toks.push({ t: 'ans' }); i += 3; continue; }
    if ('+-*/%()'.includes(c)) { toks.push({ t: 'op', v: c }); i++; continue; }
    if (c === ',') throw new CalcError('Use commas only between groups of three digits, like 12,500');
    throw new CalcError(`"${c}" isn't something the calculator understands`);
  }
  return toks;
}

function parse(toks: Tok[], ans: number | null): Node {
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => { const t = toks[p]; return !!t && t.t === 'op' && t.v === v; };
  const startsOperand = () => { const t = toks[p]; return !!t && (t.t === 'num' || t.t === 'ans' || (t.t === 'op' && t.v === '(')); };

  function primary(): Node {
    const t = peek();
    if (!t) throw new CalcError('The expression ends too soon');
    if (t.t === 'num') { p++; return { k: 'num', v: t.v }; }
    if (t.t === 'ans') {
      p++;
      if (ans === null) throw new CalcError('No previous answer yet');
      return { k: 'num', v: ans };
    }
    if (t.v === '(') {
      p++;
      const e = expr();
      if (!isOp(')')) throw new CalcError('A "(" is missing its ")"');
      p++;
      return e;
    }
    throw new CalcError(t.v === ')' ? 'There is a ")" with no "("' : `"${t.v}" needs a number before it`);
  }
  function postfix(): Node {
    let n = primary();
    while (isOp('%')) { p++; n = { k: 'pct', a: n }; }
    return n;
  }
  function unary(): Node {
    if (isOp('-')) { p++; return { k: 'neg', a: unary() }; }
    if (isOp('+')) { p++; return unary(); }
    return postfix();
  }
  function term(): Node {
    let n = unary();
    for (;;) {
      if (isOp('*') || isOp('/')) { const op = (toks[p++] as { v: string }).v; n = { k: 'bin', op, a: n, b: unary() }; }
      else if (startsOperand()) n = { k: 'bin', op: '*', a: n, b: unary() }; // 2(3+4), (1+2)(3+4)
      else return n;
    }
  }
  function expr(): Node {
    let n = term();
    while (isOp('+') || isOp('-')) { const op = (toks[p++] as { v: string }).v; n = { k: 'bin', op, a: n, b: term() }; }
    return n;
  }
  const n = expr();
  if (p < toks.length) {
    const t = toks[p];
    throw new CalcError(t.t === 'op' && t.v === ')' ? 'There is a ")" with no "("' : 'Something is left over at the end');
  }
  return n;
}

function run(n: Node): number {
  switch (n.k) {
    case 'num': return n.v;
    case 'neg': return -run(n.a);
    case 'pct': return run(n.a) / 100;
    case 'bin': {
      const a = run(n.a);
      // desk-calculator percent: 200 + 10% = 220, 200 − 10% = 180
      if ((n.op === '+' || n.op === '-') && n.b.k === 'pct') {
        const share = a * run(n.b);
        return n.op === '+' ? a + share : a - share;
      }
      const b = run(n.b);
      if (n.op === '+') return a + b;
      if (n.op === '-') return a - b;
      if (n.op === '*') return a * b;
      if (b === 0) throw new CalcError("Can't divide by zero");
      return a / b;
    }
  }
}

/** Evaluate an expression. Throws CalcError with a learner-friendly message. */
export function evalCalc(src: string, ans: number | null = null): number {
  const toks = lex(src);
  if (!toks.length) throw new CalcError('Type a calculation');
  const v = run(parse(toks, ans));
  if (!Number.isFinite(v)) throw new CalcError('The result is too large');
  return Number(v.toPrecision(12)); // hide float noise: 0.1 + 0.2 = 0.3
}

/** For display: thousands separators, up to 6 decimals. */
export function formatCalc(v: number): string {
  return v.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

/** For typing into an answer field: plain digits, no separators, up to 6 decimals. */
export function plainCalc(v: number): string {
  return String(Number(v.toFixed(6)));
}
