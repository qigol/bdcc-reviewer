// Qdigo module: neural-networks (ML2, Session 17 + Final Term Lab 1, Part A)
// Every number on stage comes from these functions: the lab's solved 2–2–1 network, "your network" (a second 2–2–1
// network the learner solves alone), a one-unit-per-layer chain, and the lecture's single neuron, logic gates and XOR.
export default function register(sdk) {
  void sdk;

  // ------------------------------------------------------------ helpers
  // Display a number: up to 4 dp, no trailing zeros, no "-0".
  const dn = (x, d = 4) => {
    if (x === null || x === undefined || !Number.isFinite(x)) return '—';
    let r = Math.round((x + Math.sign(x) * 1e-12) * 10 ** d) / 10 ** d;
    if (Object.is(r, -0)) r = 0;
    return String(r);
  };
  const p = (x) => `(${dn(x)})`; // a factor in a product, always in brackets, as the lab writes it
  const plus = (x) => (x < 0 ? `+ (${dn(x)})` : `+ ${dn(x)}`); // an added term
  const minus = (x) => (x < 0 ? `- (${dn(x)})` : `- ${dn(x)}`); // a subtracted term
  const fix = (x) => Number(dn(x, 10)); // clean float noise (0.1 + 0.2) without rounding real values
  const relu = (z) => Math.max(0, z);
  const slope = (z) => (z > 0 ? 1 : 0);
  const sigmoid = (z) => 1 / (1 + Math.exp(-z));
  const PARAMS = ['w11', 'w21', 'b1', 'w12', 'w22', 'b2', 'v1', 'v2', 'c'];
  const PTEX = { w11: 'w_{11}', w21: 'w_{21}', b1: 'b_1', w12: 'w_{12}', w22: 'w_{22}', b2: 'b_2', v1: 'v_1', v2: 'v_2', c: 'c' };

  // ------------------------------------------------------------ 1. one neuron
  // z = Σ wᵢxᵢ + b, then a = g(z). Lecture: x = (2, 1, 3), w = (0.5, −1, 0.25), b = 0.1 → z = 0.85.
  function neuron({ x, w, b }) {
    const terms = x.map((xi, i) => w[i] * xi);
    const z = fix(terms.reduce((s, t) => s + t, 0) + b);
    return { z, terms, relu: relu(z), sigmoid: sigmoid(z), tanh: Math.tanh(z), step: z > 0 ? 1 : 0 };
  }

  // roles: inputs (Matrix of x and w), code, formula
  function neuronCode({ x, w, b }) {
    const trace = [{ label: 'Start the sum at $z = 0$.', code: 'sum', math: 'sum', vars: { z: 0 }, ops: [{ role: 'inputs', cmd: 'clear' }] }];
    let z = 0;
    x.forEach((xi, i) => {
      const r = `x${i + 1}`;
      trace.push({ label: `Input ${i + 1}: take $x_${i + 1} = ${dn(xi)}$ and $w_${i + 1} = ${dn(w[i])}$.`, code: 'sum', math: 'sum', vars: { i, z },
        ops: [{ role: 'inputs', cmd: 'highlight', args: { sel: `row:${r}`, tone: 'accent' } }] });
      z = fix(z + w[i] * xi);
      trace.push({ label: `$z = z + ${p(w[i])}${p(xi)} = ${dn(z)}$.`, code: 'term', math: 'term', vars: { i, z },
        ops: [{ role: 'inputs', cmd: 'annotate', args: { sel: `cell:${r},w`, text: `+${dn(w[i] * xi)}` } }] });
    });
    z = fix(z + b);
    trace.push({ label: `Add the bias: $z = z ${plus(b)} = ${dn(z)}$.`, code: 'bias', math: 'bias', vars: { z }, ops: [] });
    trace.push({ label: `Activation: $\\text{ReLU}(${dn(z)}) = ${dn(relu(z))}$.`, code: 'act', math: 'act', vars: { z, a: relu(z) }, ops: [] });
    return { z, a: relu(z), trace };
  }

  // Matrix payload of a neuron's inputs and weights
  function neuronGrid({ x, w }) {
    return { rows: x.map((_, i) => `x${i + 1}`), cols: ['x', 'w'], values: x.map((xi, i) => [xi, w[i]]) };
  }

  // ------------------------------------------------------------ 2. activation functions
  function actFn(kind, z) {
    if (kind === 'linear') return z;
    if (kind === 'step') return z > 0 ? 1 : 0;
    if (kind === 'sigmoid') return sigmoid(z);
    if (kind === 'tanh') return Math.tanh(z);
    return relu(z);
  }
  function activation({ x, kind = 'relu' }) { return { y: actFn(kind, x) }; }
  function actValues({ z }) {
    return { z, linear: z, step: z > 0 ? 1 : 0, sigmoid: sigmoid(z), tanh: Math.tanh(z), relu: relu(z) };
  }
  // derivative (slope) of each activation at z
  function actSlope({ z, kind = 'relu' }) {
    const s = sigmoid(z);
    const d = { linear: 1, step: 0, sigmoid: s * (1 - s), tanh: 1 - Math.tanh(z) ** 2, relu: slope(z) }[kind];
    return { d };
  }

  // Lecture: inner 2x + 1, outer 3(·) − 4. Without activation the two layers collapse to 6x − 1.
  function collapse({ w1 = 2, b1 = 1, w2 = 3, b2 = -4, from = -2, to = 1.5 }) {
    const W = fix(w2 * w1), B = fix(w2 * b1 + b2);
    const xs = [], lin = [], bent = [];
    for (let i = 0; i <= 14; i++) {
      const x = fix(from + ((to - from) * i) / 14);
      xs.push(x); lin.push(fix(w2 * (w1 * x + b1) + b2)); bent.push(fix(w2 * relu(w1 * x + b1) + b2));
    }
    return {
      W, B,
      noAct: [{ name: `no activation: ${dn(W)}x ${B < 0 ? '−' : '+'} ${dn(Math.abs(B))}`, x: xs, y: lin }],
      both: [{ name: 'no activation', x: xs, y: lin }, { name: 'with ReLU in between', x: xs, y: bent }],
    };
  }
  // anchors: inner, outer, merged. roles: none
  function collapseCode({ w1, b1, w2, b2 }) {
    const W = fix(w2 * w1), B = fix(w2 * b1 + b2);
    return {
      W, B,
      trace: [
        { label: `Layer 1: $h = ${dn(w1)}x ${plus(b1)}$.`, code: 'inner', math: 'inner', vars: { W1: w1, b1 }, ops: [] },
        { label: `Layer 2: $y = ${dn(w2)}h ${plus(b2)}$.`, code: 'outer', math: 'outer', vars: { W2: w2, b2 }, ops: [] },
        { label: `Merged weight $W' = ${p(w2)}${p(w1)} = ${dn(W)}$.`, code: 'mw', math: 'mw', vars: { W_new: W }, ops: [] },
        { label: `Merged bias $b' = ${p(w2)}${p(b1)} ${plus(b2)} = ${dn(B)}$: still one straight line.`, code: 'mb', math: 'mb', vars: { b_new: B }, ops: [] },
      ],
    };
  }

  // ------------------------------------------------------------ 3. threshold units, one line, XOR
  const POINTS = [[0, 0], [0, 1], [1, 0], [1, 1]];
  const TARGET = { and: [0, 0, 0, 1], or: [0, 1, 1, 1], xor: [0, 1, 1, 0] };

  // McCulloch–Pitts: fire when x1 + x2 ≥ θ. Rows reveal up to `upTo`.
  function mpTable({ upTo = 4, showAnd = false, showOr = false }) {
    const rows = POINTS.map(([a, b]) => `x${a}${b}`);
    const values = POINTS.map(([a, b], i) => [a, b, i < upTo ? a + b : '', showAnd ? (a + b >= 2 ? 1 : 0) : '', showOr ? (a + b >= 1 ? 1 : 0) : '']);
    return { rows, cols: ['x1', 'x2', 'sum', 'AND', 'OR'], values };
  }

  // One straight line w1·x1 + w2·x2 + b = 0. Fires when the sum > 0. Scores it against AND, OR or XOR.
  function lineFit({ w1 = 1, w2 = 1, b = 0.5, gate = 'and' }) {
    const t = TARGET[gate];
    const fires = POINTS.map(([a, c]) => (w1 * a + w2 * c + b > 0 ? 1 : 0));
    const correct = fires.filter((f, i) => f === t[i]).length;
    const one = POINTS.filter((_, i) => t[i] === 1), zero = POINTS.filter((_, i) => t[i] === 0);
    const line = { x: [], y: [] };
    for (let i = 0; i <= 60; i++) {
      const s = -0.5 + (2 * i) / 60;
      if (Math.abs(w2) > 1e-9) {
        const y = (-b - w1 * s) / w2;
        if (y >= -0.5 && y <= 1.5) { line.x.push(fix(s)); line.y.push(fix(y)); }
      } else if (Math.abs(w1) > 1e-9) { line.x.push(fix(-b / w1)); line.y.push(fix(s)); }
    }
    return {
      correct, fires, gate,
      series: [
        { name: 'should output 1', x: one.map((q) => q[0]), y: one.map((q) => q[1]) },
        { name: 'should output 0', x: zero.map((q) => q[0]), y: zero.map((q) => q[1]) },
        { name: 'the line (sum = 0)', x: line.x, y: line.y },
      ],
    };
  }

  // roles: pts (Matrix of the four points), code, formula
  function perceptronCode({ w1, w2, b, gate = 'and' }) {
    const t = TARGET[gate];
    const trace = [{ label: `Weights $(${dn(w1)}, ${dn(w2)})$, bias $${dn(b)}$. Test each point.`, code: 'sum', math: 'sum', vars: { w1, w2, b }, ops: [{ role: 'pts', cmd: 'clear' }] }];
    let correct = 0;
    POINTS.forEach(([a, c], i) => {
      const s = fix(w1 * a + w2 * c + b), out = s > 0 ? 1 : 0;
      const r = `x${a}${c}`;
      trace.push({ label: `$(${a}, ${c})$: sum $= ${p(w1)}${p(a)} + ${p(w2)}${p(c)} ${plus(b)} = ${dn(s)}$.`, code: 'sum', math: 'sum', vars: { x1: a, x2: c, s },
        ops: [{ role: 'pts', cmd: 'highlight', args: { sel: `row:${r}`, tone: 'accent' } }] });
      if (out === t[i]) correct += 1;
      trace.push({ label: `${s > 0 ? `$${dn(s)} > 0$: fires, output 1` : `$${dn(s)} \\le 0$: silent, output 0`}. Target ${t[i]}: ${out === t[i] ? 'right' : 'wrong'}.`, code: 'fire', math: 'fire', vars: { out, correct },
        ops: [{ role: 'pts', cmd: 'annotate', args: { sel: `cell:${r},target`, text: out === t[i] ? '✓' : '✗' } }] });
    });
    return { correct, trace };
  }
  function pointGrid({ gate = 'and' }) {
    return { rows: POINTS.map(([a, b]) => `x${a}${b}`), cols: ['x1', 'x2', 'target'], values: POINTS.map(([a, b], i) => [a, b, TARGET[gate][i]]) };
  }

  // The lecture's XOR network: h1 = step(x1 + x2 − 0.5) (OR), h2 = step(x1 + x2 − 1.5) (AND), y = step(h1 − h2 − 0.5).
  function xorNet() {
    const rows = POINTS.map(([a, b]) => {
      const h1 = a + b - 0.5 > 0 ? 1 : 0, h2 = a + b - 1.5 > 0 ? 1 : 0;
      return { x1: a, x2: b, h1, h2, y: h1 - h2 - 0.5 > 0 ? 1 : 0 };
    });
    return { rows, outputs: rows.map((r) => r.y) };
  }
  // The truth table filled cell by cell: k = number of cells filled (3 per row: h1, h2, y).
  function xorSheet({ upTo = 0, walk = 0 }) {
    const k = Math.max(upTo, walk);
    const net = xorNet().rows;
    const values = net.map((r, i) => [r.x1, r.x2, ...['h1', 'h2', 'y'].map((c, j) => (i * 3 + j < k ? r[c] : ''))]);
    return { rows: net.map((r) => `x${r.x1}${r.x2}`), cols: ['x1', 'x2', 'h1', 'h2', 'y'], values };
  }
  // walk: fills the XOR table one cell at a time (patch xorWalk); stops before row (1,1) when stopAt = 9
  function xorWalk({ stopAt = 12 }) {
    const net = xorNet().rows;
    const trace = [];
    net.forEach((r, i) => {
      const s = r.x1 + r.x2;
      const cells = [
        [`$(${r.x1}, ${r.x2})$: OR unit $${s} - 0.5 = ${dn(s - 0.5)}$ → $h_1 = ${r.h1}$.`, 'h1'],
        [`AND unit $${s} - 1.5 = ${dn(s - 1.5)}$ → $h_2 = ${r.h2}$.`, 'h2'],
        [`Output $${r.h1} - ${r.h2} - 0.5 = ${dn(r.h1 - r.h2 - 0.5)}$ → $y = ${r.y}$.`, 'y'],
      ];
      cells.forEach(([label, col], j) => {
        const n = i * 3 + j + 1;
        if (n <= stopAt) trace.push({ label, vars: { x1: r.x1, x2: r.x2, [col]: r[col] }, patch: { xorWalk: n }, ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: `cell:x${r.x1}${r.x2},${col}`, tone: 'accent' } }] });
      });
    });
    return { trace };
  }
  // where the four points land in the hidden space (h1, h2)
  function hiddenSpace() {
    const net = xorNet().rows;
    const one = net.filter((r) => r.y === 1), zero = net.filter((r) => r.y === 0);
    const line = { x: [], y: [] };
    for (let i = 0; i <= 40; i++) { const h1 = -0.25 + (1.5 * i) / 40; const h2 = h1 - 0.5; if (h2 >= -0.25 && h2 <= 1.25) { line.x.push(fix(h1)); line.y.push(fix(h2)); } }
    return {
      series: [
        { name: 'XOR = 1: (0,1) and (1,0) both land here', x: one.map((r) => r.h1), y: one.map((r) => r.h2) },
        { name: 'XOR = 0', x: zero.map((r) => r.h1), y: zero.map((r) => r.h2) },
        { name: 'one line now works: h1 − h2 − 0.5 = 0', x: line.x, y: line.y },
      ],
    };
  }

  // ------------------------------------------------------------ 4. layers and parameters
  // Each layer after the input has (inputs × units) weights plus one bias per unit.
  function paramCount({ layers }) {
    const perLayer = [];
    for (let i = 1; i < layers.length; i++) perLayer.push(layers[i - 1] * layers[i] + layers[i]);
    return { perLayer, total: perLayer.reduce((s, v) => s + v, 0), weights: perLayer.map((v, i) => v - layers[i + 1]) };
  }
  // roles: none (code, formula)
  function paramCountCode({ layers }) {
    const trace = [{ label: `Layers ${layers.join('–')}. Start the count at 0.`, code: 'sum', math: 'sum', vars: { total: 0 }, ops: [] }];
    let total = 0;
    for (let i = 1; i < layers.length; i++) {
      const a = layers[i - 1], b = layers[i];
      trace.push({ label: `Layer ${i}: ${a} inputs into ${b} units.`, code: 'sum', math: 'sum', vars: { n_in: a, n_out: b, total }, ops: [] });
      total += a * b + b;
      trace.push({ label: `$${a} \\times ${b}$ weights $+ ${b}$ biases $= ${a * b + b}$; total $${total}$.`, code: 'layer', math: 'layer', vars: { n_in: a, n_out: b, total }, ops: [] });
    }
    return { total, trace };
  }
  // Slide: a 224 × 224 × 3 photo flattened into a 1,000-unit layer.
  function imageWeights({ h = 224, w = 224, ch = 3, hidden = 1000 }) {
    const inputs = h * w * ch;
    return { inputs, weights: inputs * hidden, millions: (inputs * hidden) / 1e6 };
  }

  // ------------------------------------------------------------ 5. derivatives and the chain rule
  // y = (a·x + b)^n: inner u = a·x + b, outer u^n. dy/dx = n·u^(n−1) · a.
  function chainRule({ a, b = 0, n, x }) {
    const u = fix(a * x + b);
    const outer = fix(n * u ** (n - 1));
    return { u, y: fix(u ** n), outer, inner: a, d: fix(outer * a) };
  }
  // roles: none. f(x) = (a x + b)^n, one step per factor
  function chainCode({ a, b = 0, n, x }) {
    const r = chainRule({ a, b, n, x });
    return {
      d: r.d,
      trace: [
        { label: `Inner: $u = ${dn(a)} \\cdot ${p(x)} ${plus(b)} = ${dn(r.u)}$.`, code: 'inner', math: 'inner', vars: { x, u: r.u }, ops: [] },
        { label: `Outer slope: $dy/du = ${n} u^{${n - 1}} = ${dn(r.outer)}$.`, code: 'outer', math: 'outer', vars: { dy_du: r.outer }, ops: [] },
        { label: `Inner slope: $du/dx = ${dn(a)}$.`, code: 'innerd', math: 'innerd', vars: { du_dx: a }, ops: [] },
        { label: `Multiply: $${dn(r.outer)} \\times ${dn(a)} = ${dn(r.d)}$.`, code: 'mult', math: 'mult', vars: { dy_dx: r.d }, ops: [] },
      ],
    };
  }
  // f(x) = x² with its tangent: a slope of 0 at the bottom of the bowl
  function square({ x }) { return { y: x * x }; }
  function squareSlope({ x }) { return { slope: fix(2 * x), y: fix(x * x) }; }

  // ------------------------------------------------------------ 6. the 2–2–1 network: forward, backward, update
  // net: { x1, x2, y, w11, w21, b1, w12, w22, b2, v1, v2, c, eta }. w_ij goes FROM input i TO hidden unit j.
  function forward(n) {
    const z1 = fix(n.w11 * n.x1 + n.w21 * n.x2 + n.b1), z2 = fix(n.w12 * n.x1 + n.w22 * n.x2 + n.b2);
    const a1 = relu(z1), a2 = relu(z2), yhat = fix(n.v1 * a1 + n.v2 * a2 + n.c);
    return { z1, z2, a1, a2, yhat, L: fix(0.5 * (yhat - n.y) ** 2) };
  }
  function net221({ net, eta }) {
    const e = eta ?? net.eta;
    const f = forward(net);
    const dyhat = fix(f.yhat - net.y), s1 = slope(f.z1), s2 = slope(f.z2);
    const da1 = fix(dyhat * net.v1), dz1 = fix(da1 * s1), da2 = fix(dyhat * net.v2), dz2 = fix(da2 * s2);
    const g = {
      w11: fix(dz1 * net.x1), w21: fix(dz1 * net.x2), b1: dz1, w12: fix(dz2 * net.x1), w22: fix(dz2 * net.x2), b2: dz2,
      v1: fix(dyhat * f.a1), v2: fix(dyhat * f.a2), c: dyhat,
    };
    const next = { ...net };
    for (const k of PARAMS) next[k] = fix(net[k] - e * g[k]);
    const after = forward(next);
    return {
      ...f, dyhat, s1, s2, da1, dz1, da2, dz2, g, next, after, eta: e,
      newZ1: after.z1, newZ2: after.z2, newYhat: after.yhat, newL: after.L,
      lossDown: after.L < f.L, crossed: Math.sign(after.yhat - net.y) !== Math.sign(f.yhat - net.y) && after.yhat !== net.y,
    };
  }

  // Forward worksheet: equation | substitution | result, rows filled up to max(upTo, walk)
  const FWD_ROWS = ['z1', 'z2', 'a1', 'a2', 'yhat', 'L'];
  function fwdRows(n) {
    const f = forward(n);
    return [
      ['w_{11}x_1 + w_{21}x_2 + b_1', `${p(n.w11)}${p(n.x1)} + ${p(n.w21)}${p(n.x2)} ${plus(n.b1)}`, dn(f.z1)],
      ['w_{12}x_1 + w_{22}x_2 + b_2', `${p(n.w12)}${p(n.x1)} + ${p(n.w22)}${p(n.x2)} ${plus(n.b2)}`, dn(f.z2)],
      ['\\text{ReLU}(z_1)', `\\max(0,\\ ${dn(f.z1)})`, dn(f.a1)],
      ['\\text{ReLU}(z_2)', `\\max(0,\\ ${dn(f.z2)})`, dn(f.a2)],
      ['v_1a_1 + v_2a_2 + c', `${p(n.v1)}${p(f.a1)} + ${p(n.v2)}${p(f.a2)} ${plus(n.c)}`, dn(f.yhat)],
      ['\\tfrac12(\\hat y - y)^2', `\\tfrac12(${dn(f.yhat)} ${minus(n.y)})^2`, dn(f.L)],
    ];
  }
  function fwdSheet({ net, upTo = 0, walk = 0 }) {
    const k = Math.max(upTo, walk);
    return { rows: FWD_ROWS, cols: ['equation', 'substitution', 'result'], values: fwdRows(net).map((r, i) => [r[0], i < k ? r[1] : '', i < k ? r[2] : '']) };
  }
  const FWD_SAY = ['Unit 1 sum', 'Unit 2 sum', 'Unit 1 activation', 'Unit 2 activation', 'Prediction', 'Loss'];
  // walk: fills forward rows from..to−1 (patch fwdWalk)
  function fwdWalk({ net, from = 0, to = 6 }) {
    const rows = fwdRows(net);
    const trace = [];
    for (let i = from; i < to; i++) {
      trace.push({ label: `${FWD_SAY[i]}: $${rows[i][1]} = ${rows[i][2]}$.`, vars: { [FWD_ROWS[i]]: Number(rows[i][2]) }, patch: { fwdWalk: i + 1 },
        ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: `row:${FWD_ROWS[i]}`, tone: 'accent' } }] });
    }
    return { trace };
  }

  // Backward worksheet: rows are the quantity each loss gradient is taken with respect to (∂L/∂ ·)
  const BWD_ROWS = ['yhat', 'v1', 'c', 'a1', 'z1', 'w11', 'w21', 'b1', 'v2', 'a2', 'z2', 'w12', 'w22', 'b2'];
  function bwdRows(n) {
    const r = net221({ net: n });
    const D = (top, bot) => `\\tfrac{\\partial ${top}}{\\partial ${bot}}`;
    return [
      ['\\hat y - y', `${dn(r.yhat)} ${minus(n.y)}`, dn(r.dyhat)],
      [`${D('L', '\\hat y')}${D('\\hat y', 'v_1')} = (\\hat y - y)\\,a_1`, `${p(r.dyhat)}${p(r.a1)}`, dn(r.g.v1)],
      [`${D('L', '\\hat y')}${D('\\hat y', 'c')} = (\\hat y - y)(1)`, `${p(r.dyhat)}(1)`, dn(r.g.c)],
      [`${D('L', '\\hat y')}${D('\\hat y', 'a_1')} = (\\hat y - y)\\,v_1`, `${p(r.dyhat)}${p(n.v1)}`, dn(r.da1)],
      [`${D('L', 'a_1')}${D('a_1', 'z_1')} = ${D('L', 'a_1')}\\,\\text{ReLU}'(z_1)`, `${p(r.da1)}${p(r.s1)}`, dn(r.dz1)],
      [`${D('L', 'z_1')}${D('z_1', 'w_{11}')} = ${D('L', 'z_1')}\\,x_1`, `${p(r.dz1)}${p(n.x1)}`, dn(r.g.w11)],
      [`${D('L', 'z_1')}${D('z_1', 'w_{21}')} = ${D('L', 'z_1')}\\,x_2`, `${p(r.dz1)}${p(n.x2)}`, dn(r.g.w21)],
      [`${D('L', 'z_1')}${D('z_1', 'b_1')} = ${D('L', 'z_1')}(1)`, `${p(r.dz1)}(1)`, dn(r.g.b1)],
      [`${D('L', '\\hat y')}${D('\\hat y', 'v_2')} = (\\hat y - y)\\,a_2`, `${p(r.dyhat)}${p(r.a2)}`, dn(r.g.v2)],
      [`${D('L', '\\hat y')}${D('\\hat y', 'a_2')} = (\\hat y - y)\\,v_2`, `${p(r.dyhat)}${p(n.v2)}`, dn(r.da2)],
      [`${D('L', 'a_2')}\\,\\text{ReLU}'(z_2)`, `${p(r.da2)}${p(r.s2)}`, dn(r.dz2)],
      [`${D('L', 'z_2')}\\,x_1`, `${p(r.dz2)}${p(n.x1)}`, dn(r.g.w12)],
      [`${D('L', 'z_2')}\\,x_2`, `${p(r.dz2)}${p(n.x2)}`, dn(r.g.w22)],
      [`${D('L', 'z_2')}(1)`, `${p(r.dz2)}(1)`, dn(r.g.b2)],
    ];
  }
  function bwdSheet({ net, upTo = 0, walk = 0 }) {
    const k = Math.max(upTo, walk);
    return { rows: BWD_ROWS, cols: ['chain', 'substitution', 'result'], values: bwdRows(net).map((r, i) => [i < k + 1 ? r[0] : '', i < k ? r[1] : '', i < k ? r[2] : '']) };
  }
  const BWD_TEX = { yhat: '\\hat y', v1: 'v_1', c: 'c', a1: 'a_1', z1: 'z_1', w11: 'w_{11}', w21: 'w_{21}', b1: 'b_1', v2: 'v_2', a2: 'a_2', z2: 'z_2', w12: 'w_{12}', w22: 'w_{22}', b2: 'b_2' };
  // walk: fills backward rows from..to−1 (patch bwdWalk)
  function bwdWalk({ net, from = 0, to = 14 }) {
    const rows = bwdRows(net);
    const trace = [];
    for (let i = from; i < to; i++) {
      const id = BWD_ROWS[i];
      trace.push({ label: `$\\partial L/\\partial ${BWD_TEX[id]} = ${rows[i][1]} = ${rows[i][2]}$.`, vars: { [`dL_d${id}`]: Number(rows[i][2]) }, patch: { bwdWalk: i + 1 },
        ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: `row:${id}`, tone: 'accent' } }] });
    }
    return { trace };
  }

  // Update worksheet: θ − η ∂L/∂θ for all nine parameters
  function updRows(n, eta) {
    const r = net221({ net: n, eta });
    return PARAMS.map((k) => [`${PTEX[k]} - \\eta\\,\\tfrac{\\partial L}{\\partial ${PTEX[k]}}`, `${dn(n[k])} - ${p(r.eta)}${p(r.g[k])}`, dn(r.next[k])]);
  }
  function updSheet({ net, eta, upTo = 0, walk = 0 }) {
    const k = Math.max(upTo, walk);
    return { rows: PARAMS, cols: ['rule', 'substitution', 'new value'], values: updRows(net, eta).map((r, i) => [r[0], i < k ? r[1] : '', i < k ? r[2] : '']) };
  }
  // walk: fills update rows in the listed order (patch updWalk counts rows done)
  function updWalk({ net, from = 0, to = 9 }) {
    const rows = updRows(net);
    const trace = [];
    for (let i = from; i < to; i++) {
      trace.push({ label: `$${PTEX[PARAMS[i]]}^{\\text{new}} = ${rows[i][1]} = ${rows[i][2]}$.`, vars: { [PARAMS[i]]: Number(rows[i][2]) }, patch: { updWalk: i + 1 },
        ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: `row:${PARAMS[i]}`, tone: 'accent' } }] });
    }
    return { trace };
  }
  // One step at a chosen learning rate: the new loss, and a curve of new loss against η
  function stepAt({ net, eta }) {
    const r = net221({ net, eta });
    return { eta, L: r.L, newL: r.newL, newYhat: r.newYhat, lossDown: r.newL < r.L, crossed: r.crossed };
  }
  function etaCurve({ net, max = 0.4 }) {
    const x = [], y = [];
    for (let i = 0; i <= 40; i++) { const e = fix((max * i) / 40); x.push(e); y.push(net221({ net, eta: e }).newL); }
    return { series: [{ name: 'loss after one step', x, y }, { name: 'loss before the step', x: [0, max], y: [forward(net).L, forward(net).L] }] };
  }

  // roles: vals (Matrix of computed values), code, formula
  function forwardCode({ net }) {
    const f = forward(net);
    const trace = [{ label: 'Inputs $x = (' + dn(net.x1) + ', ' + dn(net.x2) + ')$. Loop over the two hidden units.', code: 'z', math: 'z', vars: { x1: net.x1, x2: net.x2 }, ops: [{ role: 'vals', cmd: 'clear' }] }];
    [1, 2].forEach((j) => {
      const z = f[`z${j}`], a = f[`a${j}`];
      const wa = net[`w1${j}`], wb = net[`w2${j}`], b = net[`b${j}`];
      trace.push({ label: `Unit ${j}: $z_${j} = ${p(wa)}${p(net.x1)} + ${p(wb)}${p(net.x2)} ${plus(b)} = ${dn(z)}$.`, code: 'z', math: 'z', vars: { j, z }, ops: [{ role: 'vals', cmd: 'fill', args: { cell: `unit${j},z`, value: z } }] });
      trace.push({ label: `Unit ${j}: $a_${j} = \\max(0, ${dn(z)}) = ${dn(a)}$.`, code: 'a', math: 'a', vars: { j, a }, ops: [{ role: 'vals', cmd: 'fill', args: { cell: `unit${j},a`, value: a } }] });
    });
    trace.push({ label: `Output: $\\hat y = ${p(net.v1)}${p(f.a1)} + ${p(net.v2)}${p(f.a2)} ${plus(net.c)} = ${dn(f.yhat)}$.`, code: 'yhat', math: 'yhat', vars: { y_hat: f.yhat }, ops: [{ role: 'vals', cmd: 'fill', args: { cell: 'output,z', value: f.yhat } }] });
    trace.push({ label: `Loss: $\\tfrac12(${dn(f.yhat)} ${minus(net.y)})^2 = ${dn(f.L)}$.`, code: 'loss', math: 'loss', vars: { L: f.L }, ops: [{ role: 'vals', cmd: 'fill', args: { cell: 'output,a', value: f.L } }] });
    return { ...f, trace };
  }
  function valsGrid() {
    return { rows: ['unit1', 'unit2', 'output'], cols: ['z', 'a'], values: [['', ''], ['', ''], ['', '']] };
  }
  // the nine parameters as a Matrix (rows: where the arrow ends; cols: where it starts)
  function paramGrid({ net }) {
    return { rows: ['unit1', 'unit2', 'output'], cols: ['from1', 'from2', 'bias'], values: [[net.w11, net.w21, net.b1], [net.w12, net.w22, net.b2], [net.v1, net.v2, net.c]] };
  }
  function gradGrid() {
    return { rows: ['unit1', 'unit2', 'output'], cols: ['from1', 'from2', 'bias'], values: [['', '', ''], ['', '', ''], ['', '', '']] };
  }

  // roles: grads (Matrix of loss gradients, same layout as paramGrid), code, formula
  function backwardCode({ net }) {
    const r = net221({ net });
    const trace = [{ label: `Start at the loss: $\\partial L/\\partial \\hat y = ${dn(r.yhat)} ${minus(net.y)} = ${dn(r.dyhat)}$.`, code: 'dy', math: 'dy', vars: { d_yhat: r.dyhat }, ops: [{ role: 'grads', cmd: 'clear' }] }];
    trace.push({ label: `Output bias: $\\partial L/\\partial c = ${dn(r.dyhat)}$.`, code: 'dc', math: 'dc', vars: { d_c: r.g.c }, ops: [{ role: 'grads', cmd: 'fill', args: { cell: 'output,bias', value: r.g.c } }] });
    [1, 2].forEach((j) => {
      const a = r[`a${j}`], v = net[`v${j}`], da = r[`da${j}`], s = r[`s${j}`], dz = r[`dz${j}`];
      trace.push({ label: `Unit ${j}: $\\partial L/\\partial v_${j} = ${p(r.dyhat)}${p(a)} = ${dn(r.g[`v${j}`])}$.`, code: 'dv', math: 'dv', vars: { j, d_v: r.g[`v${j}`] }, ops: [{ role: 'grads', cmd: 'fill', args: { cell: `output,from${j}`, value: r.g[`v${j}`] } }] });
      trace.push({ label: `Unit ${j}: $\\partial L/\\partial a_${j} = ${p(r.dyhat)}${p(v)} = ${dn(da)}$.`, code: 'da', math: 'da', vars: { j, d_a: da }, ops: [] });
      trace.push({ label: `Unit ${j}: ReLU slope ${s} because $z_${j} = ${dn(r[`z${j}`])}$, so $\\partial L/\\partial z_${j} = ${dn(dz)}$.`, code: 'dz', math: 'dz', vars: { j, d_z: dz }, ops: [] });
      trace.push({ label: `Unit ${j}: $\\partial L/\\partial w_{1${j}} = ${p(dz)}${p(net.x1)} = ${dn(r.g[`w1${j}`])}$.`, code: 'dw', math: 'dw', vars: { j, d_w1: r.g[`w1${j}`] }, ops: [{ role: 'grads', cmd: 'fill', args: { cell: `unit${j},from1`, value: r.g[`w1${j}`] } }] });
      trace.push({ label: `Unit ${j}: $\\partial L/\\partial w_{2${j}} = ${p(dz)}${p(net.x2)} = ${dn(r.g[`w2${j}`])}$.`, code: 'dw', math: 'dw', vars: { j, d_w2: r.g[`w2${j}`] }, ops: [{ role: 'grads', cmd: 'fill', args: { cell: `unit${j},from2`, value: r.g[`w2${j}`] } }] });
      trace.push({ label: `Unit ${j}: $\\partial L/\\partial b_${j} = ${dn(dz)}$.`, code: 'db', math: 'db', vars: { j, d_b: r.g[`b${j}`] }, ops: [{ role: 'grads', cmd: 'fill', args: { cell: `unit${j},bias`, value: r.g[`b${j}`] } }] });
    });
    return { g: r.g, trace };
  }

  // roles: params (Matrix of parameters, updated in place), code, formula
  function updateCode({ net }) {
    const r = net221({ net });
    const where = { w11: 'unit1,from1', w21: 'unit1,from2', b1: 'unit1,bias', w12: 'unit2,from1', w22: 'unit2,from2', b2: 'unit2,bias', v1: 'output,from1', v2: 'output,from2', c: 'output,bias' };
    const trace = [{ label: `Every gradient is already computed on the old network. Learning rate $\\eta = ${dn(r.eta)}$.`, code: 'rule', math: 'rule', vars: { eta: r.eta }, ops: [{ role: 'params', cmd: 'clear' }] }];
    for (const k of PARAMS) {
      trace.push({ label: `$${PTEX[k]} = ${dn(net[k])} - ${p(r.eta)}${p(r.g[k])} = ${dn(r.next[k])}$.`, code: 'rule', math: 'rule', vars: { name: k, old: net[k], grad: r.g[k], new: r.next[k] },
        ops: [{ role: 'params', cmd: 'fill', args: { cell: where[k], value: r.next[k] } }] });
    }
    trace.push({ label: `Run forward again: $\\hat y = ${dn(r.newYhat)}$, loss $${dn(r.L)} \\to ${dn(r.newL)}$.`, code: 'again', math: 'again', vars: { y_hat: r.newYhat, L: r.newL }, ops: [] });
    return { next: r.next, trace };
  }

  // ------------------------------------------------------------ 7. one unit per layer (the lab's two-hidden-layer shape)
  // net: { x, y, w1, b1, w2, b2, v, c, eta }
  function chainForward(n) {
    const z1 = fix(n.w1 * n.x + n.b1), a1 = relu(z1), z2 = fix(n.w2 * a1 + n.b2), a2 = relu(z2), yhat = fix(n.v * a2 + n.c);
    return { z1, a1, z2, a2, yhat, L: fix(0.5 * (yhat - n.y) ** 2) };
  }
  function deepChain({ net, eta }) {
    const e = eta ?? net.eta;
    const f = chainForward(net);
    const dyhat = fix(f.yhat - net.y), s1 = slope(f.z1), s2 = slope(f.z2);
    const da2 = fix(dyhat * net.v), dz2 = fix(da2 * s2), da1 = fix(dz2 * net.w2), dz1 = fix(da1 * s1);
    const g = { w1: fix(dz1 * net.x), b1: dz1, w2: fix(dz2 * f.a1), b2: dz2, v: fix(dyhat * f.a2), c: dyhat };
    const next = { ...net };
    for (const k of Object.keys(g)) next[k] = fix(net[k] - e * g[k]);
    const after = chainForward(next);
    return { ...f, dyhat, s1, s2, da2, dz2, da1, dz1, g, next, after, newYhat: after.yhat, newL: after.L, eta: e };
  }
  // roles: none (code, formula)
  function deepCode({ net }) {
    const r = deepChain({ net });
    const S = (k) => dn(r[k]);
    return {
      g: r.g,
      trace: [
        { label: `Forward: $z_1 = ${p(net.w1)}${p(net.x)} ${plus(net.b1)} = ${S('z1')}$, $a_1 = ${S('a1')}$.`, code: 'f1', math: 'f1', vars: { z1: r.z1, a1: r.a1 }, ops: [] },
        { label: `$z_2 = ${p(net.w2)}${p(r.a1)} ${plus(net.b2)} = ${S('z2')}$, $a_2 = ${S('a2')}$.`, code: 'f2', math: 'f2', vars: { z2: r.z2, a2: r.a2 }, ops: [] },
        { label: `$\\hat y = ${p(net.v)}${p(r.a2)} ${plus(net.c)} = ${S('yhat')}$; $\\partial L/\\partial \\hat y = ${S('dyhat')}$.`, code: 'out', math: 'out', vars: { y_hat: r.yhat, d_yhat: r.dyhat }, ops: [] },
        { label: `Layer 2 signal: $\\partial L/\\partial z_2 = ${p(r.dyhat)}${p(net.v)}${p(r.s2)} = ${S('dz2')}$.`, code: 'dz2', math: 'dz2', vars: { d_z2: r.dz2 }, ops: [] },
        { label: `$\\partial L/\\partial w_2 = ${p(r.dz2)}${p(r.a1)} = ${dn(r.g.w2)}$.`, code: 'dw2', math: 'dw2', vars: { d_w2: r.g.w2 }, ops: [] },
        { label: `Layer 1 signal: $\\partial L/\\partial z_1 = ${p(r.dz2)}${p(net.w2)}${p(r.s1)} = ${S('dz1')}$.`, code: 'dz1', math: 'dz1', vars: { d_z1: r.dz1 }, ops: [] },
        { label: `$\\partial L/\\partial w_1 = ${p(r.dz1)}${p(net.x)} = ${dn(r.g.w1)}$.`, code: 'dw1', math: 'dw1', vars: { d_w1: r.g.w1 }, ops: [] },
      ],
    };
  }

  // ------------------------------------------------------------ 8. application: café cups forecast (same 2–2–1 shape)
  // features: temp (°C above 25, rounded), weekend (0/1); target: hundreds of iced drinks sold
  function cafeDay({ day, net }) {
    const n = { ...net, x1: day.temp, x2: day.weekend, y: day.sold };
    return net221({ net: n });
  }
  // A table dataset as a Matrix payload: the first column becomes the row labels.
  function tableGrid({ table }) {
    return { rows: table.rows.map((r) => String(r[0])), cols: table.columns.slice(1), values: table.rows.map((r) => r.slice(1)) };
  }
  function cafeTable({ days, net }) {
    const rows = days.rows.map((r) => String(r[0]));
    const values = days.rows.map((r) => {
      const f = forward({ ...net, x1: r[1], x2: r[2], y: r[3] });
      return [r[1], r[2], r[3], fix(f.yhat), fix(f.L)];
    });
    return { rows, cols: ['temp', 'weekend', 'sold', 'predicted', 'loss'], values };
  }
  function cafeTrain({ days, net, eta, steps = 30 }) {
    // full-batch gradient descent on the average loss over the days; the loss curve for the chart
    let n = { ...net };
    const hist = [];
    const avg = (q) => days.rows.reduce((s, r) => s + forward({ ...q, x1: r[1], x2: r[2], y: r[3] }).L, 0) / days.rows.length;
    for (let t = 0; t <= steps; t++) {
      hist.push(fix(avg(n)));
      const G = Object.fromEntries(PARAMS.map((k) => [k, 0]));
      for (const r of days.rows) {
        const g = net221({ net: { ...n, x1: r[1], x2: r[2], y: r[3] }, eta }).g;
        for (const k of PARAMS) G[k] += g[k] / days.rows.length;
      }
      const m = { ...n };
      for (const k of PARAMS) m[k] = n[k] - eta * G[k];
      n = m;
    }
    return { history: hist, start: hist[0], end: hist[hist.length - 1], series: [{ name: `η = ${eta}`, y: hist }] };
  }

  // ------------------------------------------------------------ generators
  const H = [-1, -0.5, 0.5, 1, 1.5, 2]; // hand-friendly weights
  const pickN = (rng, arr) => rng.pick(arr);

  // Quiz: one neuron's weighted sum and ReLU
  function neuronQ({ rng, difficulty }) {
    for (;;) {
      const k = difficulty === 1 ? 2 : 3;
      const x = Array.from({ length: k }, () => rng.pick([-1, 1, 2, 3]));
      const w = Array.from({ length: k }, () => pickN(rng, difficulty === 3 ? [-1, -0.5, 0.25, 0.5, 1, 1.5] : H));
      const b = rng.pick([-1, -0.5, 0, 0.5, 1]);
      const r = neuron({ x, w, b });
      if (r.z === 0 || Math.abs(r.z) > 6) continue;
      if (difficulty >= 2 && r.z > 0) continue; // the ReLU question needs a negative sum, or "forgot ReLU" is invisible
      const noBias = fix(r.z - b), plainSum = fix(x.reduce((s, v) => s + v, 0) + b);
      if (noBias === r.z || plainSum === r.z || Math.abs(noBias - r.z) < 0.3) continue;
      const rows = x.map((_, i) => `x${i + 1}`);
      return {
        vars: { x, w, b, z: r.z, a: r.relu, k, grid: { rows, cols: ['x', 'w'], values: x.map((xi, i) => [xi, w[i]]) },
          sumText: x.map((xi, i) => `${p(w[i])}${p(xi)}`).join(' + ') + ` ${plus(b)}`, noBias, plainSum, rawZ: r.z, absZ: Math.abs(r.z), negZ: r.z < 0 },
        misconceptions: [
          { var: 'noBias', for: 'z', feedback: 'You left out the **bias**. It is added once, after the weighted terms.' },
          { var: 'plainSum', for: 'z', feedback: 'You added the inputs without multiplying each by its **weight**.' },
          { var: 'rawZ', for: 'a', feedback: 'That is $z$ itself. ReLU outputs $\\max(0, z)$, so a negative sum becomes 0.' },
          { var: 'absZ', for: 'a', feedback: 'ReLU does not flip the sign: a negative sum becomes **0**, not its size.' },
        ],
      };
    }
  }

  // Quiz: activation values (ReLU / sigmoid / step) at a given z
  function activationQ({ rng }) {
    for (;;) {
      const kind = rng.pick(['relu', 'step']);
      // ReLU: negative sums only (a positive one makes "passed z through" correct); step: never exactly 1
      const z = rng.pick(kind === 'relu' ? [-3, -2, -1.5, -1, -0.5] : [-3, -2, -1.5, -0.5, 0.5, 1.5, 2, 3]);
      const val = actFn(kind, z);
      return {
        vars: { z, kind, val, kindName: kind === 'relu' ? 'ReLU' : 'step', absZ: Math.abs(z), rawZ: z, negZ: z < 0 },
        misconceptions: [
          { var: 'rawZ', for: 'val', feedback: 'That just passes $z$ through, like a linear activation.' },
          { var: 'absZ', for: 'val', feedback: 'ReLU does not flip the sign: negative inputs become **0**, not their size.' },
        ],
      };
    }
  }

  // Quiz: parameter count of a fully connected network
  function paramQ({ rng, difficulty }) {
    for (;;) {
      const depth = difficulty === 1 ? 3 : difficulty === 2 ? 3 : 4;
      const layers = Array.from({ length: depth }, () => rng.int(2, difficulty === 3 ? 6 : 5));
      const r = paramCount({ layers });
      const noBias = r.weights.reduce((s, v) => s + v, 0);
      const extraBias = r.total + layers[0];
      const units = layers.reduce((s, v) => s + v, 0);
      if (noBias === r.total || units === r.total) continue;
      if (layers[0] === 3 && layers[1] === 4 && layers[2] === 2 && depth === 3) continue; // the lecture's own network
      return {
        vars: { layers, shape: layers.join('–'), total: r.total, perLayer: r.perLayer, noBias, extraBias, units },
        misconceptions: [
          { var: 'noBias', for: 'total', feedback: 'You counted only the weights. Every hidden and output neuron also has **one bias**.' },
          { var: 'extraBias', for: 'total', feedback: 'Input "neurons" just hold the features: they have no bias.' },
          { var: 'units', for: 'total', feedback: 'That counts neurons, not parameters. Count every arrow (weight) plus one bias per non-input neuron.' },
        ],
      };
    }
  }

  // Quiz: chain rule on (a·x + b)^n at a point
  function chainQ({ rng, difficulty }) {
    for (;;) {
      const a = rng.pick([2, 3, 4, 5, -2]), b = difficulty === 1 ? 0 : rng.pick([-1, 1, 2]), n = rng.pick(difficulty === 3 ? [3, 4] : [2, 3]);
      const x = rng.pick([0, 1, 2, -1]);
      const r = chainRule({ a, b, n, x });
      if (r.u === 0 || Math.abs(r.d) > 500) continue;
      const noInner = r.outer, onX = fix(n * x ** (n - 1));
      if (noInner === r.d || onX === r.d) continue;
      return {
        vars: { a, b, n, x, u: r.u, outer: r.outer, d: r.d, noInner, onX, fx: `(${dn(a)}x ${b ? plus(b) : ''})^{${n}}`.replace(' )', ')') },
        misconceptions: [
          { var: 'noInner', for: 'd', feedback: 'You differentiated the outer power but forgot to **multiply by the inner derivative** $du/dx = a$.' },
          { var: 'onX', for: 'd', feedback: 'You applied the power rule to $x$ alone. Name the inner $u = ax + b$ first, and use $u$ in the outer slope.' },
        ],
      };
    }
  }

  // A random 2–2–1 network with hand-friendly numbers. needDead: force unit 2 to be switched off.
  function drawNet(rng, { needDead = false, noDead = false } = {}) {
    for (;;) {
      const n = {
        x1: rng.pick([-1, 1, 2]), x2: rng.pick([-1, 1, 2]), y: rng.pick([1, 2, 3, 4]),
        w11: pickN(rng, H), w21: pickN(rng, H), b1: rng.pick([-0.5, 0, 0.5, 1]),
        w12: pickN(rng, H), w22: pickN(rng, H), b2: rng.pick([-0.5, 0, 0.5, 1]),
        v1: rng.pick([-1, -0.5, 0.5, 1, 1.5]), v2: rng.pick([-1, -0.5, 0.5, 1, 1.5]), c: rng.pick([0, 0.5, 1]), eta: rng.pick([0.1, 0.05]),
      };
      const r = net221({ net: n });
      if (r.z1 === 0 || r.z2 === 0 || r.z1 <= 0) continue;
      if (needDead && r.z2 > 0) continue;
      if (noDead && r.z2 <= 0) continue;
      if (r.dyhat === 0 || Math.abs(r.dyhat) > 4 || Math.abs(r.yhat) > 6) continue;
      if (n.x1 === 2 && n.x2 === -1 && n.y === 2.5) continue;
      return { n, r };
    }
  }
  const netVars = (n, r) => ({
    ...n, z1: r.z1, z2: r.z2, a1: r.a1, a2: r.a2, yhat: r.yhat, L: r.L, dyhat: r.dyhat, s1: r.s1, s2: r.s2,
    da1: r.da1, dz1: r.dz1, da2: r.da2, dz2: r.dz2,
    gw11: r.g.w11, gw21: r.g.w21, gb1: r.g.b1, gw12: r.g.w12, gw22: r.g.w22, gb2: r.g.b2, gv1: r.g.v1, gv2: r.g.v2, gc: r.g.c,
    nw11: r.next.w11, nv1: r.next.v1, nc: r.next.c, newYhat: r.newYhat, newL: r.newL,
    params: paramGrid({ net: n }),
  });

  // Quiz: forward pass of a 2–2–1 network (prediction and loss)
  function forwardQ({ rng, difficulty }) {
    for (;;) {
      // unit 2 is always switched off, so "forgot the ReLU" gives a different prediction
      const { n, r } = drawNet(rng, { needDead: true });
      void difficulty;
      const noRelu = fix(n.v1 * r.z1 + n.v2 * r.z2 + n.c);
      const noC = fix(r.yhat - n.c);
      const fullSq = fix((r.yhat - n.y) ** 2), noSquare = fix(0.5 * Math.abs(r.yhat - n.y));
      if (n.c === 0) continue;
      if ([noRelu, noC].some((v) => Math.abs(v - r.yhat) < 0.03)) continue;
      if ([fullSq, noSquare].some((v) => Math.abs(v - r.L) < 0.006)) continue;
      if ([r.yhat, r.L].some((v) => Math.abs(v * 1000 - Math.round(v * 1000)) > 1e-6)) continue;
      return {
        vars: { ...netVars(n, r), noRelu, noC, fullSq, noSquare },
        misconceptions: [
          { var: 'noRelu', for: 'yhat', feedback: 'A hidden unit with a negative sum is switched **off**: its activation is $\\max(0, z) = 0$, not $z$.' },
          { var: 'noC', for: 'yhat', feedback: 'You left out the output bias $c$.' },
          { var: 'fullSq', for: 'L', feedback: 'The loss is **half** the squared error: $\\tfrac12(\\hat y - y)^2$.' },
          { var: 'noSquare', for: 'L', feedback: 'Square the miss before halving it.' },
        ],
      };
    }
  }

  // Quiz: output-layer and hidden-layer loss gradients, and one update
  function backwardQ({ rng, difficulty }) {
    for (;;) {
      const { n, r } = drawNet(rng, { noDead: difficulty === 1 });
      const flipV1 = fix(-r.g.v1), withZ = fix(r.dyhat * r.z1);
      const noV = fix(r.dyhat * n.x1), flipW = fix(-r.g.w11);
      const plusUpd = fix(n.v1 + r.eta * r.g.v1), noEta = fix(n.v1 - r.g.v1);
      const reluVal = fix(r.da1 * r.a1 * n.x1);
      const vals = [r.g.v1, r.g.w11, r.next.v1, r.dz1];
      if (vals.some((v) => Math.abs(v * 1000 - Math.round(v * 1000)) > 1e-6)) continue;
      if (r.g.v1 === 0 || r.g.w11 === 0) continue;
      if (Math.abs(withZ - r.g.v1) < 0.03 && r.z1 !== r.a1) continue;
      if ([noV, flipW, reluVal].some((v) => Math.abs(v - r.g.w11) < 0.03)) continue;
      if ([plusUpd, noEta].some((v) => Math.abs(v - r.next.v1) < 0.03)) continue;
      if (r.a1 === 1) continue; // ReLU'(z1) = 1 would make the "used the activation" mistake invisible
      return {
        vars: { ...netVars(n, r), flipV1, noA: r.dyhat, noV, flipW, plusUpd, noEta, reluVal },
        misconceptions: [
          { var: 'flipV1', for: 'gv1', feedback: 'Sign slip: $\\partial L/\\partial \\hat y = \\hat y - y$ (prediction minus target), not $y - \\hat y$.' },
          { var: 'noA', for: 'gv1', feedback: 'That is only $\\partial L/\\partial \\hat y$. Multiply by $\\partial \\hat y/\\partial v_1 = a_1$.' },
          { var: 'noV', for: 'gw11', feedback: 'The chain to $w_{11}$ passes through $v_1$: multiply by $\\partial \\hat y/\\partial a_1 = v_1$.' },
          { var: 'flipW', for: 'gw11', feedback: 'Sign slip: start from $\\hat y - y$, then multiply by $v_1$, the ReLU slope and $x_1$.' },
          { var: 'reluVal', for: 'gw11', feedback: 'You used the activation $a_1$ where the ReLU **slope** belongs. The slope is 1 when $z_1 > 0$, whatever $a_1$ is.' },
          { var: 'plusUpd', for: 'nv1', feedback: 'Gradient descent **subtracts**: $\\theta - \\eta\\,\\partial L/\\partial \\theta$. Adding climbs the loss.' },
          { var: 'noEta', for: 'nv1', feedback: 'You subtracted the whole gradient. Multiply it by the learning rate $\\eta$ first.' },
        ],
      };
    }
  }

  // Quiz: the ReLU slope at a pre-activation (the lab's flagged mistake: using the activation value)
  function reluSlopeQ({ rng }) {
    const z = rng.pick([-2, -1.5, -0.5, 0.5, 1.5, 2, 2.5, 3]);
    const misconceptions = z > 0
      ? [{ value: z, for: 's', feedback: 'That is the activation value $\\max(0, z)$. The derivative is the **slope** of ReLU: 1 or 0.' },
        { value: 0, for: 's', feedback: 'The slope is 0 only on the flat part, where $z < 0$. Here $z > 0$.' }]
      : [{ value: 1, for: 's', feedback: 'The slope is 1 only on the rising part, where $z > 0$. Here $z < 0$.' },
        { value: z, for: 's', feedback: "That is $z$ itself. ReLU's slope is either 1 or 0." }];
    return { vars: { z, s: slope(z), a: relu(z) }, misconceptions };
  }

  // Quiz: one unit per layer, the lab's two-hidden-layer shape, never the lab's own table
  function drawChain(rng) {
    for (;;) {
      const n = {
        x: rng.pick([1, 2, 3]), y: rng.pick([1, 2, 3, 4, 5]),
        w1: rng.pick([0.5, 1, 1.5, 2]), b1: rng.pick([-0.5, 0, 0.5, 1]),
        w2: rng.pick([0.5, 1, 1.5, -1]), b2: rng.pick([-0.5, 0, 0.5, 1]),
        v: rng.pick([0.5, 1, 1.5, 2, -1]), c: rng.pick([0, 0.5, 1]), eta: rng.pick([0.1, 0.05]),
      };
      if (n.x === 2 && n.y === 3 && n.w1 === 0.5 && n.b1 === 0 && n.w2 === 1 && n.b2 === 0 && n.v === 1 && n.c === 0) continue;
      const r = deepChain({ net: n });
      if (r.z1 <= 0 || r.z2 <= 0 || r.dyhat === 0 || Math.abs(r.dyhat) > 4) continue;
      const all = [r.z1, r.z2, r.yhat, r.L, r.g.w1, r.g.w2, r.g.v, r.next.w1, r.next.w2];
      if (all.some((v) => Math.abs(v * 1000 - Math.round(v * 1000)) > 1e-6)) continue;
      if (new Set([r.g.w1, r.g.w2, r.g.v]).size < 3) continue;
      return { n, r };
    }
  }
  function chainQ2({ rng }) {
    for (;;) {
      const { n, r } = drawChain(rng);
      const noW2 = fix(r.dz2 * n.x), noRelu2 = fix(r.dyhat * n.v * r.a2 * n.w2 * n.x), fullSq = fix(2 * r.L);
      const plusW1 = fix(n.w1 + r.eta * r.g.w1), flipDy = fix(-r.dyhat);
      if ([noW2].some((v) => Math.abs(v - r.g.w1) < 0.03)) continue;
      if (Math.abs(noRelu2 - r.g.w1) < 0.03) continue;
      if (Math.abs(plusW1 - r.next.w1) < 0.03 || Math.abs(flipDy - r.dyhat) < 0.03) continue;
      return {
        vars: {
          ...n, z1: r.z1, a1: r.a1, z2: r.z2, a2: r.a2, yhat: r.yhat, L: r.L, dyhat: r.dyhat, dz2: r.dz2, dz1: r.dz1, da1: r.da1, da2: r.da2,
          gw1: r.g.w1, gw2: r.g.w2, gv: r.g.v, gb1: r.g.b1, gc: r.g.c, nw1: r.next.w1, nw2: r.next.w2, newYhat: r.newYhat, newL: r.newL,
          noW2, noRelu2, fullSq, plusW1, flipDy,
        },
        misconceptions: [
          { var: 'fullSq', for: 'L', feedback: 'The loss is **half** the squared error.' },
          { var: 'flipDy', for: 'dyhat', feedback: 'It is prediction minus target, $\\hat y - y$.' },
          { var: 'noW2', for: 'gw1', feedback: 'The chain from $w_1$ crosses layer 2: multiply by $\\partial z_2/\\partial a_1 = w_2$.' },
          { var: 'noRelu2', for: 'gw1', feedback: 'You used the activation $a_2$ where the ReLU **slope** (1 or 0) belongs.' },
          { var: 'plusW1', for: 'nw1', feedback: 'Gradient descent subtracts $\\eta\\,\\partial L/\\partial w_1$.' },
        ],
      };
    }
  }

  // Quiz: collapse of two linear layers
  function collapseQ({ rng }) {
    for (;;) {
      const w1 = rng.pick([2, 3, -1, 4]), b1 = rng.pick([1, -1, 2]), w2 = rng.pick([2, 3, -2, 0.5]), b2 = rng.pick([-4, 1, 3, -1]);
      const W = fix(w1 * w2), B = fix(w2 * b1 + b2), addB = fix(b1 + b2), noScale = fix(b1 * w2);
      if (addB === B || noScale === B || W === B) continue;
      return {
        vars: { w1, b1, w2, b2, W, B, addB, noScale },
        misconceptions: [
          { var: 'addB', for: 'B', feedback: 'The first bias also passes through layer 2, so it is **multiplied by $w_2$** before $b_2$ is added.' },
          { var: 'noScale', for: 'B', feedback: 'You scaled $b_1$ but forgot to add layer 2\'s own bias $b_2$.' },
        ],
      };
    }
  }

  // Quiz: does one straight line fire at a point?
  function lineQ({ rng }) {
    for (;;) {
      const w1 = rng.pick([1, 2, -1, 0.5]), w2 = rng.pick([1, -1, 2, 0.5]), b = rng.pick([-1.5, -0.5, -1, 0.5, -2]);
      const [x1, x2] = rng.pick(POINTS);
      const s = fix(w1 * x1 + w2 * x2 + b);
      if (s === 0) continue;
      return { vars: { w1, w2, b, x1, x2, s }, answer: s > 0 ? 0 : 1, options: ['It fires: output 1', 'It stays silent: output 0'] };
    }
  }

  return {
    fns: {
      neuron, neuronCode, neuronGrid, activation, actValues, actSlope, collapse, collapseCode,
      mpTable, lineFit, perceptronCode, pointGrid, xorNet, xorSheet, xorWalk, hiddenSpace,
      paramCount, paramCountCode, imageWeights, chainRule, chainCode, square, squareSlope,
      net221, fwdSheet, fwdWalk, bwdSheet, bwdWalk, updSheet, updWalk, stepAt, etaCurve,
      forwardCode, valsGrid, paramGrid, gradGrid, backwardCode, updateCode,
      deepChain, deepCode, cafeDay, cafeTable, cafeTrain, tableGrid,
    },
    generators: { neuronQ, activationQ, paramQ, chainQ, forwardQ, backwardQ, reluSlopeQ, chainQ2, collapseQ, lineQ },
  };
}
