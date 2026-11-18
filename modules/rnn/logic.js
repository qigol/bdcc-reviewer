// Qdigo module: rnn (ML2, Sessions 25–26: RNN_PyTorch guided notebook, Parts A–F)
// Every number on stage comes from these functions: the running-summary toy, the one-unit RNN forward pass,
// tanh values and slopes, parameter counts, Backpropagation Through Time on the three-step toy, the w^k picture of
// vanishing and exploding gradients, padding, sliding windows and forecast scores.
export default function register(sdk) {
  void sdk;

  // ------------------------------------------------------------ helpers
  const dn = (x, d = 4) => {
    if (x === null || x === undefined || !Number.isFinite(x)) return '—';
    let r = Math.round((x + Math.sign(x) * 1e-12) * 10 ** d) / 10 ** d;
    if (Object.is(r, -0)) r = 0;
    return String(r);
  };
  const fix = (x) => Number(dn(x, 10));
  const p = (x) => `(${dn(x)})`;
  const plus = (x) => (x < 0 ? `- ${dn(-x)}` : `+ ${dn(x)}`);
  const comma = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '{,}');
  const range = (n) => Array.from({ length: n }, (_, i) => i);

  // ------------------------------------------------------------ 1. the running summary (A3)
  // h_t = tanh(carry·h_{t−1} + x_t), x_t = +1 for "good", −1 for "bad", 0 otherwise
  function notes({ text, carry = 0.8, scores = { good: 1, bad: -1 } }) {
    const words = text.split(' ');
    let h = 0;
    const hs = [], xs = [];
    for (const w of words) {
      const x = scores[w] ?? 0;
      h = Math.tanh(carry * h + x);
      xs.push(x); hs.push(fix(h));
    }
    return { words, xs, hs, final: fix(h) };
  }
  function notesChart({ a, b, carry = 0.8 }) {
    const A = notes({ text: a, carry }), B = notes({ text: b, carry });
    return { finalA: A.final, finalB: B.final, series: [{ name: 'review 1: good … bad', x: range(A.hs.length).map((i) => i + 1), y: A.hs }, { name: 'review 2: bad … good', x: range(B.hs.length).map((i) => i + 1), y: B.hs }] };
  }
  function bagOfWords({ a, b }) {
    const count = (t) => { const c = {}; for (const w of t.split(' ')) c[w] = (c[w] ?? 0) + 1; return c; };
    const A = count(a), B = count(b);
    const words = Object.keys(A).sort();
    return { same: words.every((w) => A[w] === B[w]) && Object.keys(B).length === words.length, grid: { rows: words.map((w) => w.replace(/[^a-z0-9]/g, '')), cols: ['review1', 'review2'], values: words.map((w) => [A[w], B[w] ?? 0]) } };
  }

  // ------------------------------------------------------------ 2. one step and the forward pass (C5, C7)
  function rnnStep({ x, hprev, wxh, whh, bh }) {
    const z = fix(wxh * x + whh * hprev + bh);
    const h = Math.tanh(z);
    return { z, h: fix(h), slope: fix(1 - h * h) };
  }
  function sameInput({ x, hprevs, wxh, whh, bh }) {
    return { hs: hprevs.map((hp) => rnnStep({ x, hprev: hp, wxh, whh, bh }).h), grid: { rows: hprevs.map((_, i) => `case${i + 1}`), cols: ['h_prev', 'z', 'h_t'], values: hprevs.map((hp) => { const r = rnnStep({ x, hprev: hp, wxh, whh, bh }); return [hp, r.z, Number(dn(r.h))]; }) } };
  }
  // full precision forward pass of a one-unit RNN
  function rnnForward({ x, wxh, whh, bh, h0 = 0, why = 1, by = 0 }) {
    let h = h0;
    const hs = [], zs = [], rows = [];
    x.forEach((xt, t) => {
      const a = wxh * xt, b = whh * h, z = a + b + bh;
      const hn = Math.tanh(z);
      rows.push({ t: t + 1, x: xt, a: fix(a), b: fix(b), z: fix(z), h: fix(hn), hprev: fix(h) });
      h = hn; hs.push(fix(hn)); zs.push(fix(z));
    });
    const yhat = fix(why * h + by);
    return { hs, zs, rows, hT: fix(h), yhat };
  }
  // worksheet: t | x_t | w_xh x_t | w_hh h_{t-1} | z_t | h_t, filled up to max(upTo, walk); hideLast hides h of the last filled row
  function rnnSheet({ x, wxh, whh, bh, h0 = 0, upTo = 0, walk = 0 }) {
    const r = rnnForward({ x, wxh, whh, bh, h0 });
    const k = Math.max(upTo, walk);
    return {
      rows: r.rows.map((row) => `t${row.t}`), cols: ['x', 'wxh_x', 'whh_hprev', 'z', 'h'],
      values: r.rows.map((row, i) => (i < k ? [row.x, `${dn(wxh)}\\cdot${p(row.x)} = ${dn(row.a)}`, `${dn(whh)}\\cdot${p(row.hprev)} = ${dn(row.b)}`, dn(row.z), dn(row.h)] : [row.x, '', '', '', ''])),
    };
  }
  // walk (patch rnnWalk). roles: sheet
  function rnnWalk({ x, wxh, whh, bh, h0 = 0, from = 0 }) {
    const r = rnnForward({ x, wxh, whh, bh, h0 });
    const trace = [];
    r.rows.forEach((row, i) => {
      if (i < from) return;
      trace.push({ label: `$t = ${row.t}$: $z = ${dn(row.a)} ${plus(row.b)} ${plus(bh)} = ${dn(row.z)}$, $h_${row.t} = \\tanh(${dn(row.z)}) = ${dn(row.h)}$.`, vars: { t: row.t, z: row.z, h: row.h }, patch: { rnnWalk: i + 1 },
        ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: `row:t${row.t}`, tone: 'accent' } }] });
    });
    return { trace, hs: r.hs };
  }
  // math-code trace. roles: sheet (the worksheet Matrix), code, formula
  function rnnCode({ x, wxh, whh, bh, h0 = 0, why = 2, by = 0 }) {
    const r = rnnForward({ x, wxh, whh, bh, h0, why, by });
    const trace = [{ label: `Start from $h_0 = ${dn(h0)}$.`, code: 'h0', math: 'h0', vars: { h: h0 }, ops: [{ role: 'sheet', cmd: 'clear' }] }];
    r.rows.forEach((row) => {
      trace.push({ label: `$t = ${row.t}$: $z = ${dn(wxh)}\\cdot${p(row.x)} + ${dn(whh)}\\cdot${p(row.hprev)} ${plus(bh)} = ${dn(row.z)}$.`, code: 'z', math: 'z', vars: { t: row.t, x_t: row.x, h_prev: row.hprev, z: row.z },
        ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: `row:t${row.t}`, tone: 'accent' } }] });
      trace.push({ label: `$h_${row.t} = \\tanh(${dn(row.z)}) = ${dn(row.h)}$, carried to the next step.`, code: 'h', math: 'h', vars: { t: row.t, h: row.h },
        ops: [{ role: 'sheet', cmd: 'annotate', args: { sel: `cell:t${row.t},h`, text: dn(row.h) } }] });
    });
    trace.push({ label: `Output once, from the last state: $\\hat y = ${dn(why)}\\cdot${dn(r.hT)} ${plus(by)} = ${dn(r.yhat)}$.`, code: 'out', math: 'out', vars: { y_hat: r.yhat }, ops: [] });
    return { ...r, trace };
  }

  // ------------------------------------------------------------ 3. tanh (C6) and memory length
  function tanhAt({ z }) { const t = Math.tanh(z); return { tanh: fix(t), slope: fix(1 - t * t), sigmoidForm: fix(2 / (1 + Math.exp(-2 * z)) - 1) }; }
  function tanhCurve({ x }) { return { y: Math.tanh(x) }; }
  function tanhSlope({ x }) { const t = Math.tanh(x); return { y: 1 - t * t }; }
  // a single spike x_1 = 1, then zeros; w_xh = 1, b = 0 (the notebook's demo)
  function spike({ whh, steps = 15, wxh = 1 }) {
    let h = 0;
    const hs = [];
    for (let t = 0; t < steps; t++) { h = Math.tanh(wxh * (t === 0 ? 1 : 0) + whh * h); hs.push(fix(h)); }
    return { hs, last: hs[hs.length - 1], h5: hs[4] };
  }
  function spikeChart({ ws = [0.5, 0.8, 0.95, 1.2], steps = 15 }) {
    return { series: ws.map((w) => ({ name: `w_hh = ${w}`, x: range(steps).map((i) => i + 1), y: spike({ whh: w, steps }).hs })) };
  }

  // ------------------------------------------------------------ 4. parameters (C8, E2, F5)
  function rnnParams({ d, m, k = 1, vocab = 0, emb = 0, torchBias = false }) {
    const rnn = m * (d + m + 1) + (torchBias ? m : 0);
    const dense = (m + 1) * k;
    const embedding = vocab * emb;
    return { rnn, formula: m * (d + m + 1), dense, embedding, total: rnn + dense + embedding, wxh: m * d, whh: m * m, b: m };
  }
  // roles: none (code, formula)
  function paramsCode({ d, m, k = 1, vocab = 0, emb = 0 }) {
    const r = rnnParams({ d, m, k, vocab, emb, torchBias: true });
    return {
      ...r,
      trace: [
        { label: `Embedding: $${comma(vocab)}\\cdot${emb} = ${comma(r.embedding)}$ word-vector numbers.`, code: 'emb', math: 'emb', vars: { embedding: r.embedding }, ops: [] },
        { label: `$W_{xh}$: $${m}\\cdot${d} = ${r.wxh}$; $W_{hh}$: $${m}\\cdot${m} = ${r.whh}$; bias ${m}.`, code: 'rnn', math: 'rnn', vars: { W_xh: r.wxh, W_hh: r.whh, b_h: m }, ops: [] },
        { label: `RNN: $${m}(${d} + ${m} + 1) = ${comma(r.formula)}$, plus PyTorch's second bias ${m}: $${comma(r.rnn)}$.`, code: 'rnn', math: 'rnn', vars: { rnn: r.rnn }, ops: [] },
        { label: `Dense: $(${m} + 1)\\cdot${k} = ${r.dense}$. Total $${comma(r.total)}$.`, code: 'dense', math: 'dense', vars: { dense: r.dense, total: r.total }, ops: [] },
      ],
    };
  }

  // ------------------------------------------------------------ 5. BPTT on the one-unit toy (D1–D3)
  // loss L = (ŷ − y)², ŷ = w_hy·h_T + b_y
  function bptt({ x, wxh, whh, bh, why, by = 0, y, h0 = 0, lr = 0.02 }) {
    const T = x.length;
    const hs = [h0];
    for (let t = 0; t < T; t++) hs.push(Math.tanh(wxh * x[t] + whh * hs[t] + bh));
    const hT = hs[T], yhat = why * hT + by, L = (yhat - y) ** 2;
    const dyhat = 2 * (yhat - y);
    const dh = Array(T + 1).fill(0);
    dh[T] = dyhat * why;
    const factors = [];
    for (let t = T; t >= 2; t--) { const f = whh * (1 - hs[t] ** 2); factors.unshift(fix(f)); dh[t - 1] = dh[t] * f; }
    const pieces = { wxh: [], whh: [], bh: [] };
    for (let t = 1; t <= T; t++) {
      const dz = dh[t] * (1 - hs[t] ** 2);
      pieces.wxh.push(fix(dz * x[t - 1])); pieces.whh.push(fix(dz * hs[t - 1])); pieces.bh.push(fix(dz));
    }
    const sum = (a) => fix(a.reduce((s, v) => s + v, 0));
    const g = { wxh: sum(pieces.wxh), whh: sum(pieces.whh), bh: sum(pieces.bh), why: fix(dyhat * hT), by: fix(dyhat) };
    const next = { wxh: fix(wxh - lr * g.wxh), whh: fix(whh - lr * g.whh), bh: fix(bh - lr * g.bh), why: fix(why - lr * g.why) };
    const after = rnnForward({ x, wxh: next.wxh, whh: next.whh, bh: next.bh, h0, why: next.why, by });
    return {
      hs: hs.slice(1).map(fix), yhat: fix(yhat), L: fix(L), dyhat: fix(dyhat), dh: dh.slice(1).map(fix), factors, pieces, g, next,
      newL: fix((after.yhat - y) ** 2), hT: fix(hT),
    };
  }
  // backward worksheet: one row per step t = T..1: ∂L/∂h_t, local factor, contributions to w_xh and w_hh
  function bpttSheet({ x, wxh, whh, bh, why, by = 0, y, h0 = 0, upTo = 0, walk = 0 }) {
    const r = bptt({ x, wxh, whh, bh, why, by, y, h0 });
    const k = Math.max(upTo, walk);
    const T = x.length;
    const order = range(T).map((i) => T - i); // T, T−1, …, 1
    return {
      rows: order.map((t) => `t${t}`), cols: ['dL_dh', 'step_back', 'to_wxh', 'to_whh'],
      values: order.map((t, i) => (i < k ? [dn(r.dh[t - 1]), t >= 2 ? `${dn(whh)}(1 - ${dn(r.hs[t - 1])}^2) = ${dn(r.factors[t - 2])}` : '—', dn(r.pieces.wxh[t - 1]), dn(r.pieces.whh[t - 1])] : ['', '', '', ''])),
    };
  }
  // walk (patch bpttWalk). roles: sheet
  function bpttWalk({ x, wxh, whh, bh, why, by = 0, y, h0 = 0 }) {
    const r = bptt({ x, wxh, whh, bh, why, by, y, h0 });
    const T = x.length;
    const trace = [];
    for (let i = 0; i < T; i++) {
      const t = T - i;
      const lab = t === T
        ? `$\\partial L/\\partial h_${T} = 2(\\hat y - y)\\,w_{hy} = 2${p(fix(r.yhat - y))}${p(why)} = ${dn(r.dh[T - 1])}$.`
        : `$\\partial L/\\partial h_${t} = ${dn(r.dh[t])}\\times${dn(r.factors[t - 1])} = ${dn(r.dh[t - 1])}$: one step back multiplies by $w_{hh}(1 - h_${t + 1}^2)$.`;
      trace.push({ label: lab, vars: { t, dL_dh: r.dh[t - 1] }, patch: { bpttWalk: i + 1 }, ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: `row:t${t}`, tone: 'accent' } }] });
    }
    return { trace, dh: r.dh };
  }
  // math-code trace. roles: none (code, formula)
  function bpttCode({ x, wxh, whh, bh, why, by = 0, y, h0 = 0, lr = 0.02 }) {
    const r = bptt({ x, wxh, whh, bh, why, by, y, h0, lr });
    const T = x.length;
    const trace = [{ label: `Forward: $h = [${r.hs.join(', ')}]$, $\\hat y = ${dn(r.yhat)}$, $L = (${dn(r.yhat)} - ${dn(y)})^2 = ${dn(r.L)}$.`, code: 'fwd', math: 'fwd', vars: { y_hat: r.yhat, L: r.L }, ops: [] }];
    trace.push({ label: `Start the signal: $\\partial L/\\partial h_${T} = ${dn(r.dyhat)}\\times${dn(why)} = ${dn(r.dh[T - 1])}$.`, code: 'start', math: 'start', vars: { dL_dh: r.dh[T - 1] }, ops: [] });
    for (let t = T; t >= 1; t--) {
      trace.push({ label: `$t = ${t}$: add $${dn(r.pieces.wxh[t - 1])}$ to $w_{xh}$'s gradient and $${dn(r.pieces.whh[t - 1])}$ to $w_{hh}$'s.`, code: 'acc', math: 'acc', vars: { t, to_wxh: r.pieces.wxh[t - 1], to_whh: r.pieces.whh[t - 1] }, ops: [] });
      if (t >= 2) trace.push({ label: `One step back: $\\times\\,${dn(r.factors[t - 2])}$ gives $\\partial L/\\partial h_${t - 1} = ${dn(r.dh[t - 2])}$.`, code: 'back', math: 'back', vars: { t: t - 1, dL_dh: r.dh[t - 2] }, ops: [] });
    }
    trace.push({ label: `Totals: $\\partial L/\\partial w_{xh} = ${dn(r.g.wxh)}$, $\\partial L/\\partial w_{hh} = ${dn(r.g.whh)}$. Update with $\\eta = ${lr}$.`, code: 'update', math: 'update', vars: { g_wxh: r.g.wxh, g_whh: r.g.whh, new_whh: r.next.whh }, ops: [] });
    return { ...r, trace };
  }

  // ------------------------------------------------------------ 6. vanishing and exploding (E4)
  function vanish({ w, k }) { return { scale: w ** k, log10: fix(Math.log10(Math.abs(w) ** k)) }; }
  function vanishTable({ ws = [0.5, 0.9, 1.1, 1.5], ks = [20, 50] }) {
    return { grid: { rows: ws.map((w) => `w${String(w).replace('.', '_')}`), cols: ks.map((k) => `after${k}`), values: ws.map((w) => ks.map((k) => (w ** k).toExponential(2))) }, values: ws.map((w) => ks.map((k) => w ** k)) };
  }
  function vanishCurve({ x, w = 0.9 }) { return { y: w ** x }; }

  // ------------------------------------------------------------ 7. sentiment data prep (E1–E2)
  // pad or truncate at the START ("pre"), as Keras does by default
  function padPre({ ids, maxLen }) {
    const out = ids.length >= maxLen ? ids.slice(ids.length - maxLen) : [...Array(maxLen - ids.length).fill(0), ...ids];
    return { out, dropped: Math.max(0, ids.length - maxLen), zeros: Math.max(0, maxLen - ids.length) };
  }
  function padPost({ ids, maxLen }) {
    const out = ids.length >= maxLen ? ids.slice(0, maxLen) : [...ids, ...Array(maxLen - ids.length).fill(0)];
    return { out };
  }
  function encode({ text, vocab, maxId = 10000 }) {
    const ids = [1];
    for (const w of text.toLowerCase().split(' ')) { const i = vocab[w]; ids.push(i !== undefined && i < maxId ? i : 2); }
    return { ids };
  }
  function confusion({ tn, fp, fn, tp }) {
    const n = tn + fp + fn + tp;
    return { acc: fix((tp + tn) / n), n, grid: { rows: ['true0', 'true1'], cols: ['pred0', 'pred1'], values: [[tn, fp], [fn, tp]] } };
  }
  function bce({ y, p: prob }) { return { L: fix(-(y * Math.log(prob) + (1 - y) * Math.log(1 - prob))) }; }
  function sigmoidAt({ s }) { return { p: fix(1 / (1 + Math.exp(-s))) }; }

  // ------------------------------------------------------------ 8. forecasting (F1–F6)
  // sliding windows of length L: input y_{t−L}..y_{t−1}, target y_t
  function windows({ series, size }) {
    const X = [], y = [];
    for (let t = size; t < series.length; t++) { X.push(series.slice(t - size, t)); y.push(series[t]); }
    return { X, y, count: X.length };
  }
  function windowGrid({ series, size, show = 4 }) {
    const w = windows({ series, size });
    return { rows: w.X.slice(0, show).map((_, i) => `ex${i}`), cols: [...range(size).map((k) => `t${k + 1}`), 'target'], values: w.X.slice(0, show).map((xs, i) => [...xs, w.y[i]]) };
  }
  // roles: win (the window grid)
  function windowCode({ series, size }) {
    const w = windows({ series, size });
    const trace = [{ label: `Window length $L = ${size}$; the first target is position ${size}.`, code: 'loop', math: 'loop', vars: { L: size }, ops: [{ role: 'win', cmd: 'clear' }] }];
    w.X.forEach((xs, i) => {
      if (i < 4) trace.push({ label: `Target $y_{${size + i}} = ${dn(w.y[i])}$; input $[${xs.map(dn).join(', ')}]$.`, code: 'take', math: 'take', vars: { t: size + i, target: w.y[i] }, ops: [{ role: 'win', cmd: 'highlight', args: { sel: `row:ex${i}`, tone: 'accent' } }] });
    });
    trace.push({ label: `${series.length} values give $${series.length} - ${size} = ${w.count}$ windows.`, code: 'count', math: 'count', vars: { windows: w.count }, ops: [] });
    return { count: w.count, trace };
  }
  // how many (window, target) pairs n values give; on changes there is one value fewer
  function windowCount({ n, size, changes = false }) { const m = changes ? n - 1 : n; return { count: m - size, firstTarget: size + (changes ? 1 : 0) }; }
  function diffs({ series }) { return { d: series.slice(1).map((v, i) => fix(v - series[i])) }; }
  function scale({ series, trainN }) {
    const tr = series.slice(0, trainN);
    const mu = tr.reduce((a, b) => a + b, 0) / tr.length;
    const sd = Math.sqrt(tr.reduce((a, b) => a + (b - mu) ** 2, 0) / tr.length);
    return { mu: fix(mu), sd: fix(sd), z: series.map((v) => fix((v - mu) / sd)) };
  }
  function scores({ y, yhat }) {
    const e = y.map((v, i) => v - yhat[i]);
    const n = e.length;
    return { mae: fix(e.reduce((a, b) => a + Math.abs(b), 0) / n), rmse: fix(Math.sqrt(e.reduce((a, b) => a + b * b, 0) / n)), mape: fix((100 * e.reduce((a, b, i) => a + Math.abs(b / y[i]), 0)) / n) };
  }
  function naive({ series, from }) {
    const y = series.slice(from), yhat = series.slice(from - 1, series.length - 1);
    return { y, yhat, ...scores({ y, yhat }) };
  }
  function fromChange({ last, change }) { return { yhat: fix(last + change) }; }
  // a table dataset as a Matrix payload (first column = row labels)
  function tableGrid({ table }) {
    return { rows: table.rows.map((r) => String(r[0])), cols: table.columns.slice(1), values: table.rows.map((r) => r.slice(1)) };
  }
  function historyChart({ table }) {
    const ep = table.rows.map((r) => r[0]);
    return { acc: [{ name: 'training accuracy', x: ep, y: table.rows.map((r) => r[2]) }, { name: 'validation accuracy', x: ep, y: table.rows.map((r) => r[4]) }], best: table.rows.reduce((b, r) => (r[4] > b[4] ? r : b))[0] };
  }

  // ------------------------------------------------------------ generators
  const W = [0.5, -0.5, 1, 0.8, -1, 0.2];
  // two-step forward pass of a one-unit RNN with hand-friendly numbers
  function forwardQ({ rng, difficulty }) {
    for (;;) {
      const T = difficulty === 1 ? 1 : difficulty === 2 ? 2 : 3;
      const wxh = rng.pick([0.5, 1, -0.5, 2]), whh = rng.pick([0.5, 0.8, -0.5, 0.9]), bh = rng.pick([0, 0.1, -0.2, 0.2]);
      const x = range(T).map(() => rng.pick([1, 0, -1, 0.5, 2]));
      const h0 = difficulty === 1 ? rng.pick([0.5, -0.5, 0.2]) : 0;
      if (x.join() === '1,0,-0.5') continue;
      const why = rng.pick([2, -1, 1.5]);
      const r = rnnForward({ x, wxh, whh, bh, h0, why });
      const last = r.rows[T - 1];
      if (Math.abs(last.z) < 0.05 || Math.abs(last.z) > 2.5) continue;
      const noTanh = last.z;
      const noMem = fix(Math.tanh(wxh * last.x + bh));
      if (Math.abs(noMem - last.h) < 0.03 || Math.abs(noTanh - last.h) < 0.03) continue;
      const noOut = r.hT;
      if (Math.abs(noOut - r.yhat) < 0.03) continue;
      const yNoTanh = fix(why * last.z);
      if (Math.abs(yNoTanh - r.yhat) < 0.03) continue;
      return {
        vars: { x, wxh, whh, bh, h0, why, T, z: last.z, h: last.h, hs: r.hs, yhat: r.yhat, noTanh, noMem, noOut, yNoTanh, h1: r.hs[0], zs: r.zs, hPrev: last.hprev, xLast: last.x,
          grid: { rows: ['x'], cols: x.map((_, i) => `t${i + 1}`), values: [x] } },
        misconceptions: [
          { var: 'noTanh', for: 'h', feedback: 'That is $z_t$ itself. The hidden state is $\\tanh(z_t)$.' },
          { var: 'noMem', for: 'h', feedback: 'You left out the memory term $w_{hh}h_{t-1}$: the previous state feeds every step.' },
          { var: 'noOut', for: 'yhat', feedback: 'That is the hidden state. The prediction is $w_{hy}h_T + b_y$.' },
          { var: 'yNoTanh', for: 'yhat', feedback: 'You multiplied $z_T$, not $h_T = \\tanh(z_T)$, by $w_{hy}$.' },
        ],
      };
    }
  }

  function paramQ({ rng, difficulty }) {
    for (;;) {
      const d = rng.pick([1, 4, 8, 16, 32, 50]), m = rng.pick([8, 16, 32, 64]), k = rng.pick([1, 1, 3, 5]);
      const vocab = difficulty === 3 ? rng.pick([5000, 10000, 20000]) : 0;
      const r = rnnParams({ d, m, k, vocab, emb: vocab ? d : 0 });
      const noWhh = m * (d + 1), squareWhh = m * (d + m * m + 1) - m * m + m * m, perStep = r.formula * rng.pick([10, 12, 200]);
      const noBias = m * (d + m);
      if (d === 32 && m === 32) continue;
      if (d === 1 && m === 16) continue;
      void squareWhh;
      const steps = rng.pick([12, 50, 200]);
      const totalNoEmb = r.formula + r.dense, totalTimes = r.formula * steps + r.dense + r.embedding;
      return {
        vars: { totalNoEmb, totalTimes, d, m, k, vocab, rnn: r.formula, torch: r.formula + m, dense: r.dense, embedding: r.embedding, total: r.formula + r.dense + r.embedding, noWhh, noBias, steps, timesT: r.formula * steps, perStep },
        misconceptions: [
          { var: 'noWhh', for: 'rnn', feedback: 'You forgot the recurrent matrix $W_{hh}$ ($m \\times m$): the hidden state feeds itself.' },
          { var: 'timesT', for: 'rnn', feedback: 'The weights are **shared** across time steps; the sequence length does not multiply them.' },
          { var: 'noBias', for: 'rnn', feedback: 'Add the hidden bias $b_h$: $m$ more numbers.' },
          { var: 'totalNoEmb', for: 'total', feedback: 'Include the embedding table: one row of numbers per vocabulary word.' },
          { var: 'totalTimes', for: 'total', feedback: 'The recurrent weights are shared over time; do not multiply them by the review length.' },
        ],
      };
    }
  }

  // one step back in BPTT: ∂L/∂h_{t−1} = ∂L/∂h_t · w_hh(1 − h_t²)
  function backStepQ({ rng }) {
    for (;;) {
      const dh = rng.pick([-2, -1.5, -1, 1, 1.2, 2]), whh = rng.pick([0.5, 0.8, 0.9, 1.2, -0.6]), h = rng.pick([0.2, 0.5, -0.5, 0.6, 0.8, -0.3]);
      const f = fix(whh * (1 - h * h)), ans = fix(dh * f);
      const noSlope = fix(dh * whh), useH = fix(dh * whh * h), noSquare = fix(dh * whh * (1 - h));
      if ([noSlope, useH, noSquare].some((v) => Math.abs(v - ans) < 0.02)) continue;
      return {
        vars: { dh, whh, h, f, ans, noSlope, useH, noSquare, hsq: fix(h * h) },
        misconceptions: [
          { var: 'noSlope', for: 'ans', feedback: 'You left out the tanh slope $1 - h_t^2$.' },
          { var: 'noSquare', for: 'ans', feedback: 'The tanh slope is $1 - h_t^2$: square the state first.' },
          { var: 'useH', for: 'ans', feedback: 'Multiply by the slope $1 - h_t^2$, not by $h_t$ itself.' },
        ],
      };
    }
  }

  // shared-parameter gradient: sum of per-step pieces
  function sharedQ({ rng }) {
    for (;;) {
      const pieces = range(3).map(() => rng.pick([-0.9, -0.6, -0.3, 0, 0.2, 0.5, 0.8, 1.1]));
      const sum = fix(pieces.reduce((a, b) => a + b, 0));
      const last = pieces[2], mean = fix(sum / 3);
      if (Math.abs(sum) < 0.1 || Math.abs(last - sum) < 0.05 || Math.abs(mean - sum) < 0.05) continue;
      return {
        vars: { pieces, sum, last, mean },
        misconceptions: [
          { var: 'last', for: 'sum', feedback: 'That is only the last step. The shared weight is used at every step, so the pieces are **added**.' },
          { var: 'mean', for: 'sum', feedback: 'BPTT adds the pieces; it does not average them.' },
        ],
      };
    }
  }

  function vanishQ({ rng }) {
    for (;;) {
      const w = rng.pick([0.5, 0.8, 0.9, 0.95, 1.1, 1.2]), k = rng.pick([5, 10, 20]);
      const v = w ** k;
      if (v > 50 || v < 0.0005) continue;
      const linear = fix(1 - (1 - w) * k), times = fix(w * k);
      if (Math.abs(linear - v) < 0.05 * Math.max(1, v)) continue;
      return {
        vars: { w, k, v: fix(v), vPct: fix(v * 100), times, linear, kind: w < 1 ? 'vanishes' : 'explodes', kindIdx: w < 1 ? 0 : 1 },
        misconceptions: [
          { var: 'linear', for: 'v', feedback: 'The factor multiplies the signal again at every step; it does not subtract a fixed amount. Use $w^k$.' },
          { var: 'times', for: 'v', feedback: 'The factor is applied $k$ times **in a row**: $w^k$, not $w\\times k$.' },
        ],
      };
    }
  }

  function windowQ({ rng, difficulty }) {
    for (;;) {
      const n = rng.pick([24, 36, 60, 120, 516]), L = rng.pick([3, 6, 12, 24]);
      if (L >= n) continue;
      const diffsAlso = difficulty === 3;
      const count = diffsAlso ? n - 1 - L : n - L;
      const plusOne = count + 1, wrongDiff = n - L;
      if (diffsAlso && wrongDiff === count) continue;
      return {
        vars: { n, L, count, plusOne, wrongDiff, diffsAlso, first: L + (diffsAlso ? 2 : 1) },
        misconceptions: [
          { var: 'n', for: 'count', feedback: 'The first $L$ values have no complete window before them, so they are never targets.' },
          { var: 'plusOne', for: 'count', feedback: 'Every window needs $L$ past values **and** a target after them, so the first $L$ values are never targets: $n - L$.' },
          ...(diffsAlso ? [{ var: 'wrongDiff', for: 'count', feedback: 'Differencing first turns $n$ values into $n - 1$ changes.' }] : []),
        ],
      };
    }
  }

  function naiveQ({ rng }) {
    for (;;) {
      const base = rng.pick([20, 50, 100, 315]);
      const s = [base];
      for (let i = 0; i < 5; i++) s.push(fix(s[i] + rng.pick([-2, -1, 1, 2, 3])));
      const r = naive({ series: s, from: 3 });
      const mean = s.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
      const meanMae = fix(r.y.reduce((a, v) => a + Math.abs(v - mean), 0) / r.y.length);
      const signed = fix(r.y.reduce((a, v, i) => a + (v - r.yhat[i]), 0) / r.y.length);
      if (Math.abs(meanMae - r.mae) < 0.05 || Math.abs(signed - r.mae) < 0.05) continue;
      return {
        vars: { series: s, mae: r.mae, rmse: r.rmse, y: r.y, yhat: r.yhat, meanMae, signed, grid: { rows: ['y'], cols: s.map((_, i) => `m${i + 1}`), values: [s] } },
        misconceptions: [
          { var: 'signed', for: 'mae', feedback: 'Take the **absolute** errors before averaging; positive and negative misses must not cancel.' },
          { var: 'meanMae', for: 'mae', feedback: 'The naive forecast is last month\'s value, not the average of the training months.' },
        ],
      };
    }
  }

  function changeQ({ rng }) {
    const last = rng.pick([368.2, 370.5, 316.4, 25.3, 101.7]), change = rng.pick([-1.4, -0.6, 0.8, 1.3, 2.1]);
    return { vars: { last, change, yhat: fix(last + change), flip: fix(last - change), onlyChange: change },
      misconceptions: [
        { var: 'onlyChange', for: 'yhat', feedback: 'The model predicts the **change**; add it to last month\'s level.' },
        { var: 'flip', for: 'yhat', feedback: 'Add the predicted change; do not subtract it.' },
      ] };
  }

  void W;
  return {
    fns: {
      notes, notesChart, bagOfWords, rnnStep, sameInput, rnnForward, rnnSheet, rnnWalk, rnnCode,
      tanhAt, tanhCurve, tanhSlope, spike, spikeChart, rnnParams, paramsCode,
      bptt, bpttSheet, bpttWalk, bpttCode, vanish, vanishTable, vanishCurve,
      padPre, padPost, encode, confusion, bce, sigmoidAt,
      windows, windowGrid, windowCode, windowCount, diffs, scale, scores, naive, fromChange, tableGrid, historyChart,
    },
    generators: { forwardQ, paramQ, backStepQ, sharedQ, vanishQ, windowQ, naiveQ, changeQ },
  };
}
