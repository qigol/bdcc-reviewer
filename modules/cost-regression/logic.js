export default function register(sdk) {
  const { round, fmt } = sdk;
  const C = (x) => fmt(x, 'comma');
  const N4 = (x) => String(round(x, 4));
  const N2 = (x) => String(round(x, 2));

  // ------------------------------------------------------------------ shared helpers
  function clean(o) {
    if (Array.isArray(o)) return o.map(clean);
    if (o && typeof o === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = clean(v);
      return out;
    }
    return o;
  }
  // A "step" is { row?, role?, reveal?: [rowId | 'rowId:col'], label, math?, code?, vars?, tone? }.
  // Math & Journal trace: roles journal (the section's pane), formula, code.
  function toTrace(steps, role = 'journal') {
    return steps.map((s, i) => {
      const ops = [];
      if (i === 0) ops.push({ role, cmd: 'clear' });
      if (s.row) ops.push({ role, cmd: 'highlight', args: { sel: `row:${s.row}`, tone: s.tone ?? 'accent' } });
      return clean({ label: s.label, math: s.math, code: s.code ?? s.math, vars: s.vars ?? {}, ops });
    });
  }
  // Intuition walk: each step reveals more worksheet cells through `patch: {key: n}`.
  // A step may name its own widget role (sheet by default).
  function toWalk(steps, role, key) {
    return steps.map((s, i) => {
      const ops = [];
      if (s.row) ops.push({ role: s.role ?? role, cmd: 'highlight', args: { sel: `row:${s.row}`, tone: s.tone ?? 'accent' } });
      return clean({ label: s.label, vars: s.vars ?? {}, patch: { [key]: i + 1 }, ops });
    });
  }
  function keysOf(s) { return s.reveal ?? (s.row ? [s.row] : []); }
  function reveal(rows, steps, upTo) {
    if (upTo === undefined || upTo === null) return rows;
    const pending = new Set();
    steps.forEach((s, i) => { if (i >= upTo) keysOf(s).forEach((k) => pending.add(k)); });
    steps.slice(0, upTo).forEach((s) => keysOf(s).forEach((k) => pending.delete(k)));
    return rows.map((r) => {
      if (!r.id) return r;
      const out = { ...r };
      if (Array.isArray(out.amounts)) out.amounts = out.amounts.map((v, j) => (pending.has(r.id) || pending.has(`${r.id}:${j}`) ? null : v));
      else if ('amount' in out && pending.has(r.id)) out.amount = null;
      return out;
    });
  }
  const nice = (rng, lo, hi, step) => rng.int(Math.ceil(lo / step), Math.floor(hi / step)) * step;
  const twoDp = (x) => Math.abs(x * 100 - Math.round(x * 100)) < 1e-9;
  const sq = (x) => x * x;

  // ------------------------------------------------------------------ simple regression from sums (slides 19–28, 33–35, 42–43, 68–69)
  function sumsOf(points) {
    const s = { n: points.length, sx: 0, sy: 0, sxy: 0, sx2: 0, sy2: 0 };
    for (const p of points) { s.sx += p.x; s.sy += p.y; s.sxy += p.x * p.y; s.sx2 += p.x * p.x; s.sy2 += p.y * p.y; }
    return s;
  }
  // The slide's formulas: b = (nΣxy − ΣxΣy) ÷ (nΣx² − (Σx)²), a = ȳ − b x̄, R² = num² ÷ (den × denY),
  // sₑ = √(SSE ÷ (n − 2)) with SSE = Σy² − aΣy − bΣxy, s_b = sₑ ÷ √Σ(x − x̄)².
  function coreOf(s) {
    const { n, sx, sy, sxy, sx2, sy2 } = s;
    const num = n * sxy - sx * sy;
    const den = n * sx2 - sx * sx;
    const hasY = sy2 !== undefined && sy2 !== null;
    const denY = hasY ? n * sy2 - sy * sy : null;
    const b = num / den;
    const xbar = sx / n;
    const ybar = sy / n;
    const a = ybar - b * xbar;
    const r2 = hasY ? (num * num) / (den * denY) : null;
    const r = hasY ? num / Math.sqrt(den * denY) : null;
    const sse = hasY ? (denY - b * num) / n : null;
    const se = hasY && n > 2 ? Math.sqrt(Math.max(sse, 0) / (n - 2)) : null;
    const sxx = den / n;
    const sb = se === null ? null : se / Math.sqrt(sxx);
    const t = sb === null || sb === 0 ? null : b / sb;
    return { n, sx, sy, sxy, sx2, sy2, num, den, denY, b, a, xbar, ybar, r2, r, sse, se, sxx, sb, t };
  }

  // The tabulated worksheet: one row per observation, then totals, then the calculation rows.
  // roles: journal (pane), formula, code. Scene walk roles: sheet (table Schedule), calc (calculation Schedule).
  function regressionLayout(points, c) {
    const tableRows = points.map((p, i) => ({ id: `m${i}`, label: p.label, amounts: [p.x, p.y, p.x * p.y, p.x * p.x], format: 'number' }));
    tableRows.push({ id: 'total', label: 'Total', amounts: [c.sx, c.sy, c.sxy, c.sx2], format: 'number', style: 'total', anchor: 'sums' });
    const calcRows = [
      { id: 'n', label: 'Number of observations, n', amount: c.n, format: 'number', anchor: 'sums' },
      { id: 'xbar', label: `Mean of x: ${C(c.sx)} ÷ ${c.n}`, amount: c.xbar, format: 'number', anchor: 'xbar' },
      { id: 'ybar', label: `Mean of y: ${C(c.sy)} ÷ ${c.n}`, amount: c.ybar, format: 'number', anchor: 'ybar' },
      { id: 'num', label: `Numerator: ${c.n} × ${C(c.sxy)} − ${C(c.sx)} × ${C(c.sy)}`, amount: c.num, format: 'number', anchor: 'num' },
      { id: 'den', label: `Denominator: ${c.n} × ${C(c.sx2)} − ${C(c.sx)}²`, amount: c.den, format: 'number', anchor: 'den' },
      { id: 'b', label: 'Variable rate b = numerator ÷ denominator', amount: c.b, format: 'number', style: 'subtotal', anchor: 'b' },
      { id: 'a', label: 'Fixed cost a = ȳ − b x̄', amount: c.a, format: 'number', style: 'total', anchor: 'a' },
    ];
    const steps = [];
    points.forEach((p, i) => {
      steps.push({ reveal: [`m${i}:2`, `m${i}:3`], row: `m${i}`, role: 'sheet', label: `${p.label}: ${C(p.x)} × ${C(p.y)} = ${C(p.x * p.y)}; ${C(p.x)}² = ${C(p.x * p.x)}`, vars: { x: p.x, y: p.y } });
    });
    steps.push({ reveal: ['total:0'], row: 'total', role: 'sheet', label: `Add the x column: Σx = ${C(c.sx)}`, vars: { sx: c.sx } });
    steps.push({ reveal: ['total:1'], row: 'total', role: 'sheet', label: `Add the y column: Σy = ${C(c.sy)}`, vars: { sy: c.sy } });
    steps.push({ reveal: ['total:2'], row: 'total', role: 'sheet', label: `Add the xy column: Σxy = ${C(c.sxy)}`, vars: { sxy: c.sxy } });
    steps.push({ reveal: ['total:3'], row: 'total', role: 'sheet', label: `Add the x² column: Σx² = ${C(c.sx2)}`, vars: { sx2: c.sx2 } });
    steps.push({ row: 'n', role: 'calc', label: `${c.n} observations: n = ${c.n}`, vars: { n: c.n } });
    steps.push({ row: 'xbar', role: 'calc', label: `x̄ = ${C(c.sx)} ÷ ${c.n} = ${N4(c.xbar)}`, vars: { xbar: c.xbar } });
    steps.push({ row: 'ybar', role: 'calc', label: `ȳ = ${C(c.sy)} ÷ ${c.n} = ${N4(c.ybar)}`, vars: { ybar: c.ybar } });
    steps.push({ row: 'num', role: 'calc', label: `${c.n} × ${C(c.sxy)} − ${C(c.sx)} × ${C(c.sy)} = ${C(c.n * c.sxy)} − ${C(c.sx * c.sy)} = ${C(c.num)}`, vars: { num: c.num } });
    steps.push({ row: 'den', role: 'calc', label: `${c.n} × ${C(c.sx2)} − ${C(c.sx)}² = ${C(c.n * c.sx2)} − ${C(c.sx * c.sx)} = ${C(c.den)}`, vars: { den: c.den } });
    steps.push({ row: 'b', role: 'calc', label: `b = ${C(c.num)} ÷ ${C(c.den)} = ${N4(c.b)}`, vars: { b: c.b }, tone: 'good' });
    steps.push({ row: 'a', role: 'calc', label: `a = ${N4(c.ybar)} − ${N4(c.b)} × ${N4(c.xbar)} = ${N4(c.a)}`, vars: { a: c.a }, tone: 'good' });
    return { tableRows, calcRows, steps };
  }
  function regressionStats(args) {
    const points = args.points;
    return { points, c: coreOf(points ? sumsOf(points) : args) };
  }
  function regression(args) {
    const { points, c } = regressionStats(args);
    const out = { ...c };
    const trace = [];
    if (points) {
      const lay = regressionLayout(points, c);
      out.tableRows = lay.tableRows;
      out.calcRows = lay.calcRows;
      out.steps = lay.steps.length;
      // Pane trace: highlight the calculation rows only.
      lay.steps.filter((s) => s.role === 'calc').forEach((s) => trace.push({ ...s, math: s.row === 'n' ? 'sums' : s.row }));
      out.trace = toTrace(trace);
    }
    out.formula = `y′ = ${N4(c.a)} + ${N4(c.b)}x`;
    return clean(out);
  }
  function regressionSheet({ points, upTo }) {
    const { c } = regressionStats({ points });
    const lay = regressionLayout(points, c);
    return clean({ rows: reveal(lay.tableRows, lay.steps, upTo), calcRows: reveal(lay.calcRows, lay.steps, upTo), b: c.b, a: c.a });
  }
  // roles: sheet (table), calc (calculation)
  function regressionWalk({ points }) {
    const { c } = regressionStats({ points });
    const lay = regressionLayout(points, c);
    return clean({ steps: lay.steps.length, b: c.b, a: c.a, trace: toWalk(lay.steps, 'sheet', 'lsUpTo') });
  }

  // ------------------------------------------------------------------ the same line from deviations (workbook sheet "1. Tabulated Calculation")
  // b = Σxy ÷ Σx² with x = X − X̄ and y = Y − Ȳ, which is the slides' formula divided through by n.
  // roles: journal, formula, code
  function deviationForm({ points }) {
    const c = coreOf(sumsOf(points));
    const dev = points.map((p) => ({ dx: p.x - c.xbar, dy: p.y - c.ybar }));
    const sxy = dev.reduce((t, d) => t + d.dx * d.dy, 0);
    const sxx = dev.reduce((t, d) => t + d.dx * d.dx, 0);
    const b = sxy / sxx;
    const a = c.ybar - b * c.xbar;
    const err = points.map((p) => p.y - a - b * p.x);
    const rows = points.map((p, i) => ({ id: `d${i}`, label: p.label, amounts: [p.x, p.y, dev[i].dx, dev[i].dy, dev[i].dx * dev[i].dy, dev[i].dx * dev[i].dx], format: 'number' }));
    rows.push({ id: 'dsum', label: 'Total', amounts: [c.sx, c.sy, dev.reduce((t, d) => t + d.dx, 0), dev.reduce((t, d) => t + d.dy, 0), sxy, sxx], format: 'number', style: 'total', anchor: 'dsums' });
    const calcRows = [
      { id: 'xbar', label: 'Mean of X', amount: c.xbar, format: 'number', anchor: 'xbar' },
      { id: 'ybar', label: 'Mean of Y', amount: c.ybar, format: 'number', anchor: 'ybar' },
      { id: 'sxy', label: 'Σxy, the total of the xy column', amount: sxy, format: 'number', anchor: 'sxy' },
      { id: 'sxx', label: 'Σx², the total of the x² column', amount: sxx, format: 'number', anchor: 'sxx' },
      { id: 'b', label: 'Slope b = Σxy ÷ Σx²', amount: b, format: 'number', style: 'subtotal', anchor: 'b' },
      { id: 'a', label: 'Intercept a = Ȳ − b X̄', amount: a, format: 'number', style: 'total', anchor: 'a' },
    ];
    const steps = [
      { row: 'xbar', math: 'xbar', label: `X̄ = ${C(c.sx)} ÷ ${c.n} = ${N4(c.xbar)}`, vars: { xbar: c.xbar } },
      { row: 'ybar', math: 'ybar', label: `Ȳ = ${C(c.sy)} ÷ ${c.n} = ${N4(c.ybar)}`, vars: { ybar: c.ybar } },
      { row: 'sxy', math: 'sxy', label: `Σxy of the deviations = ${N4(sxy)}`, vars: { sxy } },
      { row: 'sxx', math: 'sxx', label: `Σx² of the deviations = ${N4(sxx)}`, vars: { sxx } },
      { row: 'b', math: 'b', label: `b = ${N4(sxy)} ÷ ${N4(sxx)} = ${N4(b)}`, vars: { b }, tone: 'good' },
      { row: 'a', math: 'a', label: `a = ${N4(c.ybar)} − ${N4(b)} × ${N4(c.xbar)} = ${N4(a)}`, vars: { a }, tone: 'good' },
    ];
    return clean({
      b, a, sxy, sxx, xbar: c.xbar, ybar: c.ybar, sumDevX: dev.reduce((t, d) => t + d.dx, 0), sumDevY: dev.reduce((t, d) => t + d.dy, 0),
      sumErr: err.reduce((t, e) => t + e, 0), r2: c.r2, se: c.se, rows, calcRows, trace: toTrace(steps),
    });
  }

  // ------------------------------------------------------------------ R² (slides 33–39)
  function r2Layout(c) {
    const rows = [
      { id: 'num', label: `Numerator: ${C(c.num)}, squared`, amount: c.num * c.num, format: 'number', anchor: 'num' },
      { id: 'den', label: `nΣx² − (Σx)² = ${C(c.den)}`, amount: c.den, format: 'number', anchor: 'den' },
      { id: 'deny', label: `nΣy² − (Σy)² = ${C(c.n)} × ${C(c.sy2)} − ${C(c.sy)}²`, amount: c.denY, format: 'number', anchor: 'deny' },
      { id: 'prod', label: 'Denominator: the two multiplied', amount: c.den * c.denY, format: 'number' },
      { id: 'r2', label: 'R² = squared numerator ÷ denominator', amount: c.r2, format: 'number', style: 'total', anchor: 'r2' },
      { id: 'r', label: 'Correlation r = √R², with the sign of b', amount: c.r, format: 'number', anchor: 'r' },
    ];
    const steps = [
      { row: 'num', math: 'num', label: `${C(c.num)}² = ${C(c.num * c.num)}`, vars: { numSq: c.num * c.num } },
      { row: 'den', math: 'den', label: `Denominator part 1 (x): ${C(c.den)}`, vars: { den: c.den } },
      { row: 'deny', math: 'deny', label: `${C(c.n)} × ${C(c.sy2)} − ${C(c.sy)}² = ${C(c.n * c.sy2)} − ${C(c.sy * c.sy)} = ${C(c.denY)}`, vars: { denY: c.denY } },
      { row: 'prod', label: `${C(c.den)} × ${C(c.denY)} = ${C(c.den * c.denY)}`, vars: { prod: c.den * c.denY } },
      { row: 'r2', math: 'r2', label: `R² = ${C(c.num * c.num)} ÷ ${C(c.den * c.denY)} = ${N4(c.r2)}, or ${N2(c.r2 * 100)}%`, vars: { r2: c.r2 }, tone: 'good' },
      { row: 'r', math: 'r', label: `r = ${N4(c.r)}, the square root of R²`, vars: { r: c.r } },
    ];
    return { rows, steps };
  }
  function rSquared(args) {
    const { c } = regressionStats(args);
    const lay = r2Layout(c);
    return clean({ r2: c.r2, r: c.r, num: c.num, den: c.den, denY: c.denY, explained: c.r2 * 100, unexplained: (1 - c.r2) * 100, rows: lay.rows, trace: toTrace(lay.steps) });
  }
  function r2Sheet(args) {
    const { c } = regressionStats(args);
    const lay = r2Layout(c);
    return clean({ rows: reveal(lay.rows, lay.steps, args.upTo), r2: c.r2 });
  }
  // roles: sheet
  function r2Walk(args) {
    const { c } = regressionStats(args);
    const lay = r2Layout(c);
    return clean({ steps: lay.steps.length, r2: c.r2, trace: toWalk(lay.steps, 'sheet', 'r2UpTo') });
  }

  // ------------------------------------------------------------------ standard error and t (slides 41–47)
  function seLayout(c) {
    const aSy = c.a * c.sy;
    const bSxy = c.b * c.sxy;
    const rows = [
      { id: 'sse', label: 'Squared errors: Σy² − aΣy − bΣxy', amount: c.sse, format: 'number', anchor: 'sse' },
      { id: 'df', label: 'Degrees of freedom: n − 2', amount: c.n - 2, format: 'number', anchor: 'df' },
      { id: 'se', label: 'Standard error of the estimate sₑ', amount: c.se, format: 'number', style: 'subtotal', anchor: 'se' },
      { id: 'band', label: 'About 95%: prediction ± 2 × sₑ', amount: 2 * c.se, format: 'number', anchor: 'band' },
      { id: 'sb', label: 'Standard error of b: sₑ ÷ √Σ(x − x̄)²', amount: c.sb, format: 'number', anchor: 'sb' },
      { id: 't', label: 't-statistic = b ÷ s_b', amount: c.t, format: 'number', style: 'total', anchor: 't' },
    ];
    const steps = [
      { row: 'sse', math: 'sse', label: `${C(c.sy2)} − ${N4(c.a)} × ${C(c.sy)} − ${N4(c.b)} × ${C(c.sxy)} = ${N4(c.sse)}`, vars: { sse: c.sse } },
      { row: 'df', math: 'df', label: `n − 2 = ${c.n} − 2 = ${c.n - 2}`, vars: { df: c.n - 2 } },
      { row: 'se', math: 'se', label: `sₑ = √(${N4(c.sse)} ÷ ${c.n - 2}) = ${N4(c.se)}`, vars: { se: c.se }, tone: 'good' },
      { row: 'band', math: 'band', label: `2 × ${N4(c.se)} = ${N4(2 * c.se)} either side of a prediction`, vars: { band: 2 * c.se } },
      { row: 'sb', math: 'sb', label: `s_b = ${N4(c.se)} ÷ √${N4(c.sxx)} = ${N4(c.sb)}`, vars: { sb: c.sb } },
      { row: 't', math: 't', label: `t = ${N4(c.b)} ÷ ${N4(c.sb)} = ${N2(c.t)}`, vars: { t: c.t }, tone: Math.abs(c.t) > 2 ? 'good' : 'warn' },
    ];
    return { rows, steps, aSy, bSxy };
  }
  function standardError(args) {
    const { c } = regressionStats(args);
    const lay = seLayout(c);
    return clean({ sse: c.sse, se: c.se, band: 2 * c.se, sb: c.sb, t: c.t, df: c.n - 2, significant: Math.abs(c.t) > 2, rows: lay.rows, trace: toTrace(lay.steps) });
  }
  function seSheet(args) {
    const { c } = regressionStats(args);
    const lay = seLayout(c);
    return clean({ rows: reveal(lay.rows, lay.steps, args.upTo), se: c.se, t: c.t });
  }
  // roles: sheet
  function seWalk(args) {
    const { c } = regressionStats(args);
    const lay = seLayout(c);
    return clean({ steps: lay.steps.length, se: c.se, t: c.t, trace: toWalk(lay.steps, 'sheet', 'seUpTo') });
  }
  // A prediction with its rough 95% range (slide 43): y ± 2 sₑ.
  function predictRange({ a, b, x, se }) {
    const y = a + b * x;
    return clean({ y, half: 2 * se, low: y - 2 * se, high: y + 2 * se });
  }

  // Prediction at x with the fitted line.
  function predictLine({ a, b, x }) {
    return clean({ y: a + b * x, varPart: b * x });
  }

  // ------------------------------------------------------------------ errors and the least-squares criterion (slides 11–12)
  // Rows: one per observation, columns [Actual, Predicted, Error u, u²].
  function lineFit({ points, a, b, xMax }) {
    const pred = points.map((p) => a + b * p.x);
    const err = points.map((p, i) => p.y - pred[i]);
    const sse = err.reduce((t, e) => t + e * e, 0);
    const rows = points.map((p, i) => ({ id: `e${i}`, label: p.label, amounts: [p.y, pred[i], err[i], err[i] * err[i]], format: 'number' }));
    rows.push({ id: 'sse', label: 'Total of the squared errors', amounts: [null, null, null, sse], format: 'number', style: 'total', anchor: 'sse' });
    const lineX = [];
    const lineY = [];
    if (xMax) {
      const n = 40;
      for (let i = 0; i <= n; i += 1) { const xv = (xMax * i) / n; lineX.push(xv); lineY.push(a + b * xv); }
    }
    return clean({
      sse, sumErr: err.reduce((t, e) => t + e, 0), sumAbs: err.reduce((t, e) => t + Math.abs(e), 0),
      rows, errors: err, predicted: pred, dotsX: points.map((p) => p.x), dotsY: points.map((p) => p.y), lineX, lineY,
    });
  }
  // Three lines through the same twelve months, with the sum of squared errors of each.
  function compareLines({ points, hlA, hlB, sgA, sgB }) {
    const c = coreOf(sumsOf(points));
    const sse = (a, b) => points.reduce((t, p) => t + sq(p.y - a - b * p.x), 0);
    const hl = sse(hlA, hlB);
    const sg = sse(sgA, sgB);
    const ls = sse(c.a, c.b);
    const rows = [
      { id: 'hl', label: 'High-low (2 months)', amounts: [hlA, hlB, hl], format: 'number', anchor: 'hl' },
      { id: 'sg', label: 'Scattergraph (by eye)', amounts: [sgA, sgB, sg], format: 'number', anchor: 'sg' },
      { id: 'ls', label: 'Least squares (all months)', amounts: [c.a, c.b, ls], format: 'number', style: 'total', anchor: 'ls' },
    ];
    const steps = [
      { row: 'hl', math: 'hl', label: `High-low line: squared errors add to ${N2(hl)}`, vars: { sseHL: hl } },
      { row: 'sg', math: 'sg', label: `Scattergraph line: squared errors add to ${N2(sg)}`, vars: { sseSG: sg } },
      { row: 'ls', math: 'ls', label: `Least-squares line: ${N2(ls)}, the smallest possible`, vars: { sseLS: ls }, tone: 'good' },
    ];
    return clean({ sseHL: hl, sseSG: sg, sseLS: ls, a: c.a, b: c.b, rows, trace: toTrace(steps) });
  }

  // ------------------------------------------------------------------ multiple regression (slides 49–57; workbook sheets)
  function invert(M) {
    const n = M.length;
    const A = M.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
    for (let c = 0; c < n; c += 1) {
      let p = c;
      for (let r = c + 1; r < n; r += 1) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      if (Math.abs(A[p][c]) < 1e-12) return null;
      [A[c], A[p]] = [A[p], A[c]];
      const d = A[c][c];
      for (let j = 0; j < 2 * n; j += 1) A[c][j] /= d;
      for (let r = 0; r < n; r += 1) {
        if (r === c) continue;
        const f = A[r][c];
        if (f !== 0) for (let j = 0; j < 2 * n; j += 1) A[r][j] -= f * A[c][j];
      }
    }
    return A.map((r) => r.slice(n));
  }
  // Least squares for y on k drivers via the deviation-form normal equations S b = S_y (the workbook's method).
  // Inputs: xs (array of k columns), y, names. roles: journal, formula, code.
  function multipleCore({ xs, y, names }) {
    const n = y.length;
    const k = xs.length;
    const nm = names ?? xs.map((_, i) => `X${i + 1}`);
    const mean = (v) => v.reduce((t, e) => t + e, 0) / v.length;
    const xbar = xs.map(mean);
    const ybar = mean(y);
    const S = xs.map((xi, i) => xs.map((xj, j) => xi.reduce((t, v, r) => t + (v - xbar[i]) * (xj[r] - xbar[j]), 0)));
    const Sy = xs.map((xi, i) => xi.reduce((t, v, r) => t + (v - xbar[i]) * (y[r] - ybar), 0));
    const Syy = y.reduce((t, v) => t + sq(v - ybar), 0);
    const inv = invert(S);
    if (!inv) return { singular: true, n, k };
    const coefs = inv.map((row) => row.reduce((t, v, j) => t + v * Sy[j], 0));
    const a = ybar - coefs.reduce((t, b, i) => t + b * xbar[i], 0);
    const ssr = coefs.reduce((t, b, i) => t + b * Sy[i], 0);
    const sse = Math.max(Syy - ssr, 0);
    const dfRes = n - k - 1;
    const se = Math.sqrt(sse / dfRes);
    const r2 = ssr / Syy;
    const adjR2 = 1 - ((1 - r2) * (n - 1)) / dfRes;
    const f = ssr / k / (sse / dfRes);
    const ses = coefs.map((_, i) => se * Math.sqrt(inv[i][i]));
    const ts = coefs.map((b, i) => b / ses[i]);
    let quad = 0;
    for (let i = 0; i < k; i += 1) for (let j = 0; j < k; j += 1) quad += xbar[i] * inv[i][j] * xbar[j];
    const seA = se * Math.sqrt(1 / n + quad);
    const tA = a / seA;
    // Correlations among drivers and with y.
    const cols = [...nm, 'Y'];
    const cov = (i, j) => (i < k && j < k ? S[i][j] : i < k ? Sy[i] : j < k ? Sy[j] : Syy);
    const corr = cols.map((_, i) => cols.map((__, j) => cov(i, j) / Math.sqrt(cov(i, i) * cov(j, j))));
    return { n, k, names: nm, a, coefs, ses, ts, seA, tA, r2, adjR2, multipleR: Math.sqrt(r2), se, f, dfReg: k, dfRes, sse, ssr, sst: Syy, corr, cols, xbar, ybar };
  }
  function multipleRegression(args) {
    const m = multipleCore(args);
    if (m.singular) return { singular: true };
    const rows = [
      { id: 'a', label: 'Intercept (fixed cost a)', amounts: [m.a, m.seA, m.tA], format: 'number', anchor: 'a' },
      ...m.names.map((nme, i) => ({ id: `b${i + 1}`, label: `${nme} coefficient`, amounts: [m.coefs[i], m.ses[i], m.ts[i]], format: 'number', anchor: `b${i + 1}` })),
    ];
    const fitRows = [
      { id: 'r2', label: 'R²', amount: m.r2, format: 'number', anchor: 'r2' },
      { id: 'adj', label: 'Adjusted R²', amount: m.adjR2, format: 'number', anchor: 'adj' },
      { id: 'se', label: 'Standard error of the estimate sₑ', amount: m.se, format: 'number', anchor: 'se' },
      { id: 'f', label: `F-statistic (${m.dfReg} and ${m.dfRes} degrees of freedom)`, amount: m.f, format: 'number', anchor: 'f' },
    ];
    const steps = [
      { row: 'a', math: 'a', label: `Intercept a = ${N4(m.a)}: the cost with every driver at zero`, vars: { a: m.a } },
      ...m.names.map((nme, i) => ({ row: `b${i + 1}`, math: `b${i + 1}`, label: `${nme}: ${N4(m.coefs[i])} per unit, holding the others fixed (t = ${N2(m.ts[i])})`, vars: { [`b${i + 1}`]: m.coefs[i], [`t${i + 1}`]: m.ts[i] } })),
      { row: 'r2', math: 'r2', label: `R² = ${N4(m.r2)}: ${N2(m.r2 * 100)}% explained jointly`, vars: { r2: m.r2 }, tone: 'good' },
    ];
    // Correlations among the drivers (k × k), one row per driver.
    const corrRows = m.names.map((nme, i) => ({
      id: `c${i + 1}`, label: nme, amounts: m.corr[i].slice(0, m.k), format: 'number', anchor: 'corr',
    }));
    const eq = `ŷ = ${N4(m.a)} ${m.coefs.map((b, i) => `${b < 0 ? '−' : '+'} ${N4(Math.abs(b))}·${m.names[i]}`).join(' ')}`;
    return clean({
      n: m.n, k: m.k, a: m.a, coefs: m.coefs, ses: m.ses, ts: m.ts, seA: m.seA, tA: m.tA, r2: m.r2, adjR2: m.adjR2,
      multipleR: m.multipleR, se: m.se, f: m.f, dfRes: m.dfRes, sse: m.sse, ssr: m.ssr, sst: m.sst, equation: eq,
      corrData: { rows: m.cols, cols: m.cols, values: m.corr }, maxCorr: Math.max(...m.corr.slice(0, m.k).flatMap((r, i) => r.slice(0, m.k).filter((_, j) => j !== i).map(Math.abs))),
      rows, fitRows, corrRows, corrColumns: m.names, trace: toTrace(steps),
    });
  }
  // Drop one driver (by index) and refit.
  function dropDriver({ xs, y, names, drop }) {
    const keepX = xs.filter((_, i) => i !== drop);
    const keepN = (names ?? xs.map((_, i) => `X${i + 1}`)).filter((_, i) => i !== drop);
    return multipleRegression({ xs: keepX, y, names: keepN });
  }
  // The same one driver with every other driver left out.
  function singleDriver({ xs, y, names, use }) {
    return multipleRegression({ xs: [xs[use]], y, names: [(names ?? xs.map((_, i) => `X${i + 1}`))[use]] });
  }
  // A published equation applied to values.
  function predictMulti({ intercept, coefs, values, names }) {
    const parts = coefs.map((b, i) => b * values[i]);
    const y = intercept + parts.reduce((t, v) => t + v, 0);
    const rows = [
      { id: 'pa', label: 'Fixed part (intercept)', amount: intercept, anchor: 'a' },
      ...coefs.map((b, i) => ({ id: `p${i + 1}`, label: `${names ? names[i] : `X${i + 1}`}: ${C(b)} × ${C(values[i])}`, amount: parts[i], indent: 1, anchor: `b${i + 1}` })),
      { id: 'y', label: 'Predicted cost', amount: y, style: 'total', anchor: 'y' },
    ];
    const steps = [
      { row: 'pa', math: 'a', label: `Start with the intercept ${C(intercept)}`, vars: { a: intercept } },
      ...coefs.map((b, i) => ({ row: `p${i + 1}`, math: `b${i + 1}`, label: `${C(b)} × ${C(values[i])} = ${C(parts[i])}`, vars: { [`part${i + 1}`]: parts[i] } })),
      { row: 'y', math: 'y', label: `Add them: ${C(intercept)} + ${parts.map(C).join(' + ')} = ${C(y)}`, vars: { y }, tone: 'good' },
    ];
    return clean({ y, parts, rows, trace: toTrace(steps) });
  }

  // Flat-argument wrappers so sliders can drive them.
  function predictTwo({ intercept, b1, b2, x1, x2, names }) {
    return predictMulti({ intercept, coefs: [b1, b2], values: [x1, x2], names });
  }
  // keep: 'both' | 'x1' | 'x2' | 'x3'
  function subsetModel({ xs, y, names, keep }) {
    const nm = names ?? xs.map((_, i) => `X${i + 1}`);
    if (keep === 'both') return multipleRegression({ xs, y, names: nm });
    const idx = Number(String(keep).replace(/\D/g, '')) - 1;
    return multipleRegression({ xs: [xs[idx]], y, names: [nm[idx]] });
  }

  // ------------------------------------------------------------------ reading a regression output (slides 33–47, 70–75)
  // Bands follow slide 37, with the weak band taken as below 0.50 (slide 38 cites "about 0.30–0.50").
  function judgeModel({ r2, t }) {
    const fit = r2 >= 0.8 ? 'strong' : r2 >= 0.5 ? 'usable' : 'weak';
    const significant = Math.abs(t) > 2;
    const verdict = !significant
      ? 'Do not rely on it: the slope is not statistically different from zero.'
      : fit === 'weak' ? 'Do not rely on it: the driver explains too little of the cost.'
        : fit === 'usable' ? 'Usable with caution: a moderate fit and a significant slope.'
          : 'Trust it within its range: a strong fit and a significant slope.';
    const rows = [
      { id: 'r2', label: 'R²: how much of the cost the driver explains', amount: r2, format: 'number', anchor: 'fit' },
      { id: 't', label: 't-statistic of the slope', amount: t, format: 'number', anchor: 'sig' },
      { id: 'verdict', label: `Reading: ${verdict}`, style: 'total', anchor: 'verdict' },
    ];
    return { fit, significant, verdict, rows };
  }
  function rangeCheck({ volume, low, high }) {
    const status = volume < low ? 'below' : volume > high ? 'above' : 'inside';
    const text = status === 'inside' ? 'Inside the range the model was estimated from.'
      : `Outside the range: ${status === 'below' ? 'below' : 'above'} the data the model was built on, so the estimate is an extrapolation.`;
    return { inside: status === 'inside', status, text };
  }
  // Which of two candidate drivers is stronger on both statistics (Example 11).
  function betterDriver({ r2A, tA, r2B, tB }) {
    const winner = r2A > r2B && Math.abs(tA) > Math.abs(tB) ? 'A' : r2B > r2A && Math.abs(tB) > Math.abs(tA) ? 'B' : 'mixed';
    return { winner, r2Gap: Math.abs(r2A - r2B) };
  }

  // ------------------------------------------------------------------ quiz generators
  function regSumsQ({ rng, difficulty }) {
    for (;;) {
      const n = difficulty === 1 ? 4 : 5;
      const xs = rng.sample([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], n).sort((p, q) => p - q);
      const a0 = rng.int(2, 12);
      const b0 = rng.pick([2, 3, 4, 5]);
      const pts = xs.map((x, i) => ({ label: `M${i + 1}`, x, y: a0 + b0 * x + rng.int(-3, 3) }));
      const c = coreOf(sumsOf(pts));
      if (c.den <= 0 || c.denY <= 0 || c.r2 < 0.85 || c.r2 > 0.999) continue;
      const predictAt = rng.int(xs[0], xs[n - 1] + 2);
      const predicted = c.a + c.b * predictAt;
      if (Math.abs(c.a) < 0.5) continue;
      return {
        vars: {
          points: pts,
          table: { rows: pts.map((p) => p.label), cols: ['x', 'y'], values: pts.map((p) => [p.x, p.y]) },
          n, sx: c.sx, sy: c.sy, sxy: c.sxy, sx2: c.sx2, sy2: c.sy2,
          num: c.num, den: c.den, denY: c.denY, numSq: c.num * c.num, prod: c.den * c.denY,
          xbar: c.xbar, ybar: c.ybar, b: c.b, a: c.a, r2: c.r2, r: c.r, predictAt, predicted,
          wrongB: c.sxy / c.sx2, wrongB2: c.num / (c.n * c.sx2), wrongA: c.ybar, wrongA2: c.ybar - c.b * c.sx, wrongNoA: c.b * predictAt, wrongR: c.r,
          wrongNoSq: c.num / (c.den * c.denY),
        },
        misconceptions: [
          { var: 'wrongB', feedback: 'That divides Σxy by Σx². Use the full formula: (nΣxy − ΣxΣy) ÷ (nΣx² − (Σx)²).' },
          { var: 'wrongB2', feedback: 'The denominator is nΣx² − (Σx)². You left out the (Σx)² term.' },
        ],
      };
    }
  }
  function r2Q({ rng, difficulty }) {
    const base = regSumsQ({ rng, difficulty });
    base.misconceptions = [
      { var: 'wrongR', feedback: 'That is the correlation r. R² is its **square**: the squared numerator over the product of both denominators.' },
      { var: 'wrongNoSq', feedback: 'You did not square the numerator, or you divided by only one denominator. Use (numerator)² ÷ (denominator x × denominator y).' },
    ];
    return base;
  }
  function seRangeQ({ rng }) {
    for (;;) {
      const y = nice(rng, 10000, 60000, 500);
      const se = nice(rng, 500, 4000, 100);
      return {
        vars: { y, se, half: 2 * se, low: y - 2 * se, high: y + 2 * se, wrongOne: y - se, wrongSe: se, wrongHalf: se / 2 },
        misconceptions: [
          { var: 'wrongOne', feedback: 'That is one standard error below. About 95% confidence uses roughly **two** standard errors.' },
          { var: 'wrongSe', feedback: 'That is the size of the standard error itself. The lower bound is the prediction minus two of them.' },
        ],
      };
    }
  }
  function tStatQ({ rng }) {
    for (;;) {
      const t = rng.pick([0.8, 1.2, 1.5, 1.8, 2.5, 3, 4, 5, 6]);
      const sb = rng.pick([0.2, 0.25, 0.4, 0.5, 0.8, 1.5, 2]);
      const b = t * sb;
      if (!twoDp(b)) continue;
      return {
        vars: { b, sb, t, significant: t > 2 ? 'is' : 'is not', verdict: t > 2 ? 'significant' : 'not significant', wrongInverse: sb / b, wrongProduct: b * sb },
        misconceptions: [
          { var: 'wrongInverse', feedback: 'You divided the other way. t is the coefficient **divided by** its standard error: b ÷ s_b.' },
          { var: 'wrongProduct', feedback: 'You multiplied. t = b ÷ s_b measures how many standard errors b is from zero.' },
        ],
      };
    }
  }
  function multiPredictQ({ rng, difficulty }) {
    for (;;) {
      const a = nice(rng, 4000, 20000, 1000);
      const b1 = rng.pick([1.5, 2, 2.5, 3, 4.5]);
      const b2 = rng.pick([40, 60, 80, 120, 150, 180]);
      const x1 = nice(rng, 1000, 8000, 500);
      const x2 = nice(rng, 10, 80, 5);
      const y = a + b1 * x1 + b2 * x2;
      if (!twoDp(y)) continue;
      return {
        vars: { a, b1, b2, x1, x2, y, part1: b1 * x1, part2: b2 * x2, wrongOne: a + b1 * x1, wrongNoA: b1 * x1 + b2 * x2 },
        misconceptions: [
          { var: 'wrongOne', feedback: 'You left out the second driver. A multiple regression equation adds a term for every driver.' },
          { var: 'wrongNoA', feedback: 'You left out the intercept. The fixed part a is added to both driver terms.' },
        ],
      };
    }
  }
  function errorQ({ rng }) {
    for (;;) {
      const a = rng.int(3, 20);
      const b = rng.pick([0.5, 1, 2, 3, 5]);
      const x = rng.int(4, 30);
      const pred = a + b * x;
      const y = pred + rng.pick([-6, -4, -3, -2, 2, 3, 4, 6]);
      return { vars: { a, b, x, y, pred, u: y - pred, wrongSign: pred - y, wrongPred: pred, usq: sq(y - pred) },
        misconceptions: [
          { var: 'wrongSign', feedback: 'The error is **actual minus predicted**: u = y − y′. You subtracted the other way round.' },
          { var: 'wrongPred', feedback: 'That is the predicted cost. The error is the gap between the actual cost and the prediction.' },
        ] };
    }
  }
  function sseQ({ rng, difficulty }) {
    for (;;) {
      const a = rng.int(2, 10);
      const b = rng.pick([1, 2, 3]);
      const n = difficulty === 1 ? 3 : 4;
      const xs = rng.sample([1, 2, 3, 4, 5, 6, 7, 8], n).sort((p, q) => p - q);
      const pts = xs.map((x, i) => ({ label: `M${i + 1}`, x, y: a + b * x + rng.pick([-3, -2, -1, 1, 2, 3]) }));
      const f = lineFit({ points: pts, a, b });
      if (f.sumErr === 0) continue;
      return {
        vars: {
          points: pts, a, b, sse: f.sse, sumErr: f.sumErr, sumAbs: f.sumAbs, n,
          table: { rows: pts.map((p) => p.label), cols: ['x', 'y'], values: pts.map((p) => [p.x, p.y]) },
        },
        misconceptions: [
          { var: 'sumErr', feedback: 'You added the raw errors. Positive and negative errors cancel, which is why the criterion **squares** them first.' },
          { var: 'sumAbs', feedback: 'You added the absolute errors. Least squares adds the **squared** errors.' },
        ],
      };
    }
  }
  const JUDGE_OPTIONS = [
    'Trust it within its range: a strong fit and a significant slope',
    'Usable with caution: a moderate fit and a significant slope',
    'Do not rely on it: the driver explains too little of the cost',
    'Do not rely on it: the slope is not statistically different from zero',
  ];
  function judgeQ({ rng }) {
    for (;;) {
      const r2 = rng.pick([0.25, 0.35, 0.42, 0.55, 0.6, 0.7, 0.85, 0.91, 0.96]);
      const t = rng.pick([0.6, 0.85, 1.4, 1.9, 2.4, 3.1, 4.5, 6.8]);
      if (Math.abs(t) < 2 && r2 < 0.5) continue;
      const j = judgeModel({ r2, t });
      const answer = !j.significant ? 3 : j.fit === 'weak' ? 2 : j.fit === 'usable' ? 1 : 0;
      return { vars: { r2, t, verdict: j.verdict }, options: JUDGE_OPTIONS, answer };
    }
  }

  return {
    fns: {
      regression, regressionSheet, regressionWalk, deviationForm, rSquared, r2Sheet, r2Walk, standardError, seSheet, seWalk, predictRange, predictLine,
      lineFit, compareLines, multipleRegression, dropDriver, singleDriver, subsetModel, predictMulti, predictTwo, judgeModel, rangeCheck, betterDriver,
    },
    generators: { regSumsQ, r2Q, seRangeQ, tStatQ, multiPredictQ, errorQ, sseQ, judgeQ },
  };
}
