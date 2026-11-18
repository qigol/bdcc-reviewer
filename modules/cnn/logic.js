// Qdigo module: cnn (ML2, Sessions 21–24: CNN_PyTorch guided notebook, Parts A–E)
// Every number on stage comes from these functions: 1D and 2D convolution (flip, pad, stride), the output-size
// formula, max pooling, parameter counts, the MNIST / Cats-vs-Dogs / VGG16 shape tables, and reading training curves.
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
  const comma = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '{,}');
  const range = (n) => Array.from({ length: n }, (_, i) => i);
  const flip1 = (w) => w.slice().reverse();
  const flip2 = (W) => W.slice().reverse().map((r) => r.slice().reverse());
  const pad1 = (x, q) => [...Array(q).fill(0), ...x, ...Array(q).fill(0)];
  const pad2 = (X, q) => {
    const w = X[0].length + 2 * q;
    const zero = () => Array(w).fill(0);
    return [...range(q).map(zero), ...X.map((r) => pad1(r, q)), ...range(q).map(zero)];
  };
  const outSizeRaw = (n, m, q, s) => Math.floor((n + 2 * q - m) / s) + 1;
  // Matrix payload with r0.., c0.. labels
  function matGrid({ M, rowPrefix = 'r', colPrefix = 'c' }) {
    return { rows: M.map((_, i) => `${rowPrefix}${i}`), cols: M[0].map((_, j) => `${colPrefix}${j}`), values: M };
  }
  const vecGrid = (rowsObj) => {
    const n = Math.max(...Object.values(rowsObj).map((v) => v.length));
    return { rows: Object.keys(rowsObj), cols: range(n).map((i) => `i${i}`), values: Object.values(rowsObj).map((v) => range(n).map((i) => (i < v.length ? v[i] : ''))) };
  };

  // ------------------------------------------------------------ 1. one-dimensional convolution
  // y[i] = Σ_k xpad[i·s + k] · w^r[k]; flip = false gives cross-correlation (the filter as written).
  function conv1d({ x, w, p: q = 0, s = 1, flip = true }) {
    const wr = flip ? flip1(w) : w.slice();
    const xpad = pad1(x, q);
    const m = wr.length, o = outSizeRaw(x.length, m, q, s);
    const y = [], windows = [], terms = [];
    for (let i = 0; i < o; i++) {
      const win = xpad.slice(i * s, i * s + m);
      windows.push(win);
      terms.push(win.map((v, k) => `${dn(v)}\\cdot${dn(wr[k])}`).join(' + '));
      y.push(fix(win.reduce((acc, v, k) => acc + v * wr[k], 0)));
    }
    return { y, wr, xpad, n: x.length, m, o, windows, terms };
  }
  // worksheet: one row per output, filled up to max(upTo, walk)
  function conv1dSheet({ x, w, p: q = 0, s = 1, flip = true, upTo = 0, walk = 0 }) {
    const r = conv1d({ x, w, p: q, s, flip });
    const k = Math.max(upTo, walk);
    return {
      rows: r.y.map((_, i) => `y${i}`), cols: ['window', 'products', 'y'],
      values: r.y.map((v, i) => [i < k ? `[${r.windows[i].map(dn).join(', ')}]` : '', i < k ? r.terms[i] : '', i < k ? v : '']),
    };
  }
  // walk: fills conv1dSheet rows (patch c1Walk); roles: sheet, xs (the input grid)
  function conv1dWalk({ x, w, p: q = 0, s = 1, flip = true, stopAt = 99 }) {
    const r = conv1d({ x, w, p: q, s, flip });
    const trace = [];
    r.y.forEach((v, i) => {
      if (i >= stopAt) return;
      const cells = range(r.m).map((k) => i * s + k);
      trace.push({ label: `Stop ${i}: the window starts at position $${i}\\cdot${s} = ${i * s}$. $y[${i}] = ${r.terms[i]} = ${dn(v)}$.`, vars: { i, y: v }, patch: { c1Walk: i + 1 },
        ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: `row:y${i}`, tone: 'accent' } }, ...cells.map((c) => ({ role: 'xs', cmd: 'highlight', args: { sel: `cell:x,i${c}`, tone: 'accent' } }))] });
    });
    return { trace, y: r.y };
  }
  // the input and the flipped filter as a 2-row grid (x on top, filter under the first window)
  function conv1dGrid({ x, w, p: q = 0, flip = true }) {
    return vecGrid({ x: pad1(x, q), filter: flip ? flip1(w) : w });
  }
  // math-code trace. roles: xs (Matrix with rows x, filter), code, formula
  function conv1dCode({ x, w, p: q = 0, s = 1 }) {
    const r = conv1d({ x, w, p: q, s });
    const trace = [
      { label: `Flip the filter: $[${w.map(dn).join(', ')}] \\to [${r.wr.map(dn).join(', ')}]$.`, code: 'flip', math: 'flip', vars: { w_r: r.wr }, ops: [{ role: 'xs', cmd: 'clear' }, { role: 'xs', cmd: 'highlight', args: { sel: 'row:filter', tone: 'accent' } }] },
      { label: `Pad with $p = ${q}$ zeros on each side: length $${r.xpad.length}$.`, code: 'pad', math: 'pad', vars: { n_padded: r.xpad.length }, ops: [{ role: 'xs', cmd: 'highlight', args: { sel: 'row:x', tone: 'muted' } }] },
      { label: `Positions: $\\lfloor(${r.xpad.length} - ${r.m})/${s}\\rfloor + 1 = ${r.o}$.`, code: 'count', math: 'count', vars: { positions: r.o }, ops: [{ role: 'xs', cmd: 'highlight', args: { sel: 'row:x', tone: 'accent' } }] },
    ];
    r.y.forEach((v, i) => {
      const cells = range(r.m).map((k) => i * s + k);
      trace.push({ label: `$i = ${i}$: window $x[${i * s}:${i * s + r.m}] = [${r.windows[i].map(dn).join(', ')}]$.`, code: 'window', math: 'window', vars: { i, window: r.windows[i] },
        ops: cells.map((c) => ({ role: 'xs', cmd: 'highlight', args: { sel: `cell:x,i${c}`, tone: 'accent' } })) });
      trace.push({ label: `Dot with the flipped filter: $${r.terms[i]} = ${dn(v)}$.`, code: 'dot', math: 'dot', vars: { i, y_i: v },
        ops: [{ role: 'xs', cmd: 'annotate', args: { sel: `cell:x,i${i * s}`, text: `y${i}=${dn(v)}` } }] });
    });
    return { y: r.y, trace };
  }

  // valid / same / full padding of one input with one odd-length filter
  function padModes({ x, w }) {
    const m = w.length;
    const modes = [['valid', 0], ['same', (m - 1) / 2], ['full', m - 1]];
    const out = {};
    for (const [name, q] of modes) {
      const r = conv1d({ x, w, p: q, s: 1 });
      out[name] = { p: q, o: r.o, y: r.y };
    }
    return { ...out, grid: { rows: ['valid', 'same', 'full'], cols: ['p', 'outputs', 'values'], values: modes.map(([name]) => [out[name].p, out[name].o, out[name].y.map(dn).join(', ')]) } };
  }

  // ------------------------------------------------------------ 2. output size
  function outSize({ n, m, p: q = 0, s = 1 }) {
    const num = n + 2 * q - m;
    const o = Math.floor(num / s) + 1;
    return { num, raw: fix(num / s), o, floored: num % s !== 0 };
  }
  // roles: none (code, formula)
  function outSizeCode({ n, m, p: q = 0, s = 1 }) {
    const r = outSize({ n, m, p: q, s });
    return {
      o: r.o,
      trace: [
        { label: `Padded length minus the filter: $${n} + 2\\cdot${q} - ${m} = ${r.num}$.`, code: 'num', math: 'num', vars: { n, m, p: q, room: r.num }, ops: [] },
        { label: `Divide by the stride and round down: $\\lfloor ${r.num}/${s} \\rfloor = ${Math.floor(r.num / s)}$.`, code: 'div', math: 'div', vars: { steps: Math.floor(r.num / s) }, ops: [] },
        { label: `Add the first position: $${Math.floor(r.num / s)} + 1 = ${r.o}$.`, code: 'plus1', math: 'plus1', vars: { o: r.o }, ops: [] },
      ],
    };
  }

  // ------------------------------------------------------------ 3. two-dimensional convolution
  function conv2d({ X, W, p: q = 0, s = 1, flip = true }) {
    const Xp = pad2(X, q), Wr = flip ? flip2(W) : W.map((r) => r.slice());
    const m1 = Wr.length, m2 = Wr[0].length;
    const o1 = Math.floor((Xp.length - m1) / s) + 1, o2 = Math.floor((Xp[0].length - m2) / s) + 1;
    const Y = [], terms = [];
    for (let i = 0; i < o1; i++) {
      const row = [];
      for (let j = 0; j < o2; j++) {
        let acc = 0; const t = []; const win = [];
        for (let a = 0; a < m1; a++) for (let b = 0; b < m2; b++) {
          const v = Xp[i * s + a][j * s + b];
          win.push([i * s + a, j * s + b]);
          acc += v * Wr[a][b];
          if (v !== 0 && Wr[a][b] !== 0) t.push(`${dn(Wr[a][b])}\\cdot${dn(v)}`);
        }
        row.push(fix(acc));
        terms.push({ i, j, tex: t.length ? t.join(' + ') : '0', win });
      }
      Y.push(row);
    }
    return { Y, Wr, Xp, o1, o2, terms };
  }
  function conv2dSheet({ X, W, p: q = 0, s = 1, flip = true, upTo = 0, walk = 0 }) {
    const r = conv2d({ X, W, p: q, s, flip });
    const k = Math.max(upTo, walk);
    return { rows: r.Y.map((_, i) => `r${i}`), cols: r.Y[0].map((_, j) => `c${j}`), values: r.Y.map((row, i) => row.map((v, j) => (i * r.o2 + j < k ? v : ''))) };
  }
  // walk: fills the output Y cell by cell (patch c2Walk). roles: out (Y), xp (padded input)
  function conv2dWalk({ X, W, p: q = 0, s = 1, flip = true, stopAt = 99 }) {
    const r = conv2d({ X, W, p: q, s, flip });
    const trace = [];
    r.terms.forEach((t, n) => {
      if (n >= stopAt) return;
      trace.push({ label: `$Y[${t.i},${t.j}]$: window at row ${t.i * s}, column ${t.j * s}. Non-zero products: $${t.tex} = ${dn(r.Y[t.i][t.j])}$.`, vars: { i: t.i, j: t.j, y: r.Y[t.i][t.j] }, patch: { c2Walk: n + 1 },
        ops: [{ role: 'out', cmd: 'highlight', args: { sel: `cell:r${t.i},c${t.j}`, tone: 'accent' } }, ...t.win.map(([a, b]) => ({ role: 'xp', cmd: 'highlight', args: { sel: `cell:r${a},c${b}`, tone: 'accent' } }))] });
    });
    return { trace, Y: r.Y };
  }
  function paddedGrid({ X, p: q = 0 }) { return matGrid({ M: pad2(X, q) }); }
  function flippedGrid({ W }) { return matGrid({ M: flip2(W) }); }
  // math-code trace. roles: xp (padded input Matrix), code, formula
  function conv2dCode({ X, W, p: q = 0, s = 1 }) {
    const r = conv2d({ X, W, p: q, s });
    const trace = [
      { label: 'Rotate the filter 180°: reverse its rows, then each row.', code: 'flip', math: 'flip', vars: { W_r: r.Wr }, ops: [{ role: 'xp', cmd: 'clear' }] },
      { label: `Pad a ring of $p = ${q}$ zeros, then count stops: $${r.o1} \\times ${r.o2}$.`, code: 'size', math: 'size', vars: { o1: r.o1, o2: r.o2 }, ops: [{ role: 'xp', cmd: 'highlight', args: { sel: 'row:r0', tone: 'muted' } }] },
    ];
    r.terms.forEach((t) => {
      trace.push({ label: `Stop $(${t.i}, ${t.j})$: the window's top-left corner is $(${t.i * s}, ${t.j * s})$.`, code: 'window', math: 'window', vars: { i: t.i, j: t.j },
        ops: t.win.map(([a, b]) => ({ role: 'xp', cmd: 'highlight', args: { sel: `cell:r${a},c${b}`, tone: 'accent' } })) });
      trace.push({ label: `Multiply and add: $${t.tex} = ${dn(r.Y[t.i][t.j])}$.`, code: 'sum', math: 'sum', vars: { i: t.i, j: t.j, Y_ij: r.Y[t.i][t.j] },
        ops: [{ role: 'xp', cmd: 'annotate', args: { sel: `cell:r${t.i * s},c${t.j * s}`, text: `Y=${dn(r.Y[t.i][t.j])}` } }] });
    });
    return { Y: r.Y, trace };
  }
  // sum of a filter's numbers: 0 → only edges survive; 1 → brightness kept
  function kernelSum({ W }) {
    const sum = fix(W.flat().reduce((a, b) => a + b, 0));
    return { sum, kind: Math.abs(sum) < 1e-9 ? 'edge' : Math.abs(sum - 1) < 1e-9 ? 'keeps brightness' : 'changes brightness' };
  }

  // ------------------------------------------------------------ 4. max pooling
  function maxPool({ X, size = 2, s }) {
    const st = s ?? size;
    const o1 = Math.floor((X.length - size) / st) + 1, o2 = Math.floor((X[0].length - size) / st) + 1;
    const Y = [], A = [], where = [];
    for (let i = 0; i < o1; i++) {
      const row = [], arow = [];
      for (let j = 0; j < o2; j++) {
        let best = -Infinity, at = null, sum = 0;
        for (let a = 0; a < size; a++) for (let b = 0; b < size; b++) {
          const v = X[i * st + a][j * st + b];
          sum += v;
          if (v > best) { best = v; at = [i * st + a, j * st + b]; }
        }
        row.push(best); arow.push(fix(sum / (size * size))); where.push({ i, j, at });
      }
      Y.push(row); A.push(arow);
    }
    return { Y, avg: A, o1, o2, where };
  }
  function poolSheet({ X, size = 2, upTo = 0, walk = 0 }) {
    const r = maxPool({ X, size });
    const k = Math.max(upTo, walk);
    return { rows: r.Y.map((_, i) => `r${i}`), cols: r.Y[0].map((_, j) => `c${j}`), values: r.Y.map((row, i) => row.map((v, j) => (i * r.o2 + j < k ? v : ''))) };
  }
  // walk: one pooled cell per step (patch poolWalk). roles: pin (input), pout (pooled)
  function poolWalk({ X, size = 2, stopAt = 99 }) {
    const r = maxPool({ X, size });
    const trace = [];
    r.where.forEach((w, n) => {
      if (n >= stopAt) return;
      const cells = [];
      for (let a = 0; a < size; a++) for (let b = 0; b < size; b++) cells.push([w.i * size + a, w.j * size + b]);
      const vals = cells.map(([a, b]) => X[a][b]);
      trace.push({ label: `Square $(${w.i}, ${w.j})$ holds ${vals.join(', ')}. The largest is $${r.Y[w.i][w.j]}$.`, vars: { i: w.i, j: w.j, max: r.Y[w.i][w.j] }, patch: { poolWalk: n + 1 },
        ops: [...cells.map(([a, b]) => ({ role: 'pin', cmd: 'highlight', args: { sel: `cell:r${a},c${b}`, tone: 'accent' } })), { role: 'pout', cmd: 'highlight', args: { sel: `cell:r${w.i},c${w.j}`, tone: 'good' } }] });
    });
    return { trace, Y: r.Y };
  }
  function poolSame({ X1, X2, size = 2 }) {
    const a = maxPool({ X: X1, size }).Y, b = maxPool({ X: X2, size }).Y;
    return { same: JSON.stringify(a) === JSON.stringify(b), Y1: a, Y2: b, grid2: matGrid({ M: b }) };
  }
  // shift every row right by k (wrapping), as np.roll(X, k, axis=1)
  function shiftCols({ X, k = 1 }) {
    const n = X[0].length;
    const M = X.map((r) => r.map((_, j) => r[(j - k + n * 10) % n]));
    const pooled = maxPool({ X: M }).Y;
    return { M, grid: matGrid({ M }), pooled, pooledGrid: matGrid({ M: pooled }) };
  }
  // math-code trace. roles: pin (input Matrix), code, formula
  function poolCode({ X, size = 2 }) {
    const r = maxPool({ X, size });
    const trace = [{ label: `Output size: $\\lfloor(${X.length} - ${size})/${size}\\rfloor + 1 = ${r.o1}$ each way.`, code: 'size', math: 'size', vars: { o1: r.o1, o2: r.o2 }, ops: [{ role: 'pin', cmd: 'clear' }] }];
    r.where.forEach((w) => {
      const cells = [];
      for (let a = 0; a < size; a++) for (let b = 0; b < size; b++) cells.push([w.i * size + a, w.j * size + b]);
      trace.push({ label: `Square $(${w.i}, ${w.j})$: $\\max(${cells.map(([a, b]) => X[a][b]).join(', ')}) = ${r.Y[w.i][w.j]}$.`, code: 'max', math: 'max', vars: { i: w.i, j: w.j, out: r.Y[w.i][w.j] },
        ops: [...cells.map(([a, b]) => ({ role: 'pin', cmd: 'highlight', args: { sel: `cell:r${a},c${b}`, tone: 'accent' } })), { role: 'pin', cmd: 'annotate', args: { sel: `cell:r${w.at[0]},c${w.at[1]}`, text: 'max' } }] });
    });
    return { Y: r.Y, trace };
  }

  // ------------------------------------------------------------ 5. parameters
  function convParams({ m, cin, cout }) {
    const perFilter = m * m * cin + 1;
    return { perFilter, params: perFilter * cout, noBias: m * m * cin * cout, noCin: (m * m + 1) * cout, weights: m * m * cin * cout, biases: cout };
  }
  function denseParams({ din, dout }) { return { params: (din + 1) * dout, noBias: din * dout }; }
  // dense layer on a flattened image vs one conv layer on the same image (the notebook's A1 comparison)
  function denseVsConv({ n, c, units, filters, m }) {
    const dense = denseParams({ din: n * n * c, dout: units }).params;
    const conv = convParams({ m, cin: c, cout: filters }).params;
    return { inputs: n * n * c, dense, conv, ratio: Math.round(dense / conv) };
  }
  // roles: none (code, formula)
  function denseVsConvCode({ n, c, units, filters, m }) {
    const r = denseVsConv({ n, c, units, filters, m });
    return {
      ...r,
      trace: [
        { label: `Flatten: $${n}\\cdot${n}\\cdot${c} = ${comma(r.inputs)}$ inputs.`, code: 'inputs', math: 'inputs', vars: { inputs: r.inputs }, ops: [] },
        { label: `Dense: $(${comma(r.inputs)} + 1)\\cdot${units} = ${comma(r.dense)}$.`, code: 'dense', math: 'dense', vars: { dense: r.dense }, ops: [] },
        { label: `Convolution: $(${m}\\cdot${m}\\cdot${c} + 1)\\cdot${filters} = ${comma(r.conv)}$, whatever the image size.`, code: 'conv', math: 'conv', vars: { conv: r.conv }, ops: [] },
      ],
    };
  }
  // roles: none (code, formula)
  function paramsCode({ m, cin, cout, din, dout }) {
    const c = convParams({ m, cin, cout }), d = denseParams({ din, dout });
    return {
      conv: c.params, dense: d.params,
      trace: [
        { label: `One filter: $${m}\\cdot${m}\\cdot${cin} = ${m * m * cin}$ weights, one slice per input channel.`, code: 'fw', math: 'fw', vars: { weights_per_filter: m * m * cin }, ops: [] },
        { label: `Plus its bias: $${m * m * cin} + 1 = ${c.perFilter}$.`, code: 'fb', math: 'fb', vars: { per_filter: c.perFilter }, ops: [] },
        { label: `Times $${cout}$ filters: $${c.perFilter}\\cdot${cout} = ${comma(c.params)}$.`, code: 'conv', math: 'conv', vars: { conv_params: c.params }, ops: [] },
        { label: `Dense: $(${din} + 1)\\cdot${dout} = ${comma(d.params)}$.`, code: 'dense', math: 'dense', vars: { dense_params: d.params }, ops: [] },
      ],
    };
  }

  // ------------------------------------------------------------ 6. a CNN's shape table
  // spec items: {kind: conv, filters, m, p?} | {kind: pool, size} | {kind: flatten} | {kind: dropout} | {kind: dense, units}
  function cnnRows({ input, spec }) {
    let [h, w, c] = input;
    let feats = null, total = 0;
    const rows = [];
    for (const L of spec) {
      let params = 0, shape, calc;
      if (L.kind === 'conv') {
        const q = L.p ?? 0;
        const nh = outSizeRaw(h, L.m, q, 1), nw = outSizeRaw(w, L.m, q, 1);
        params = (L.m * L.m * c + 1) * L.filters;
        calc = `${q ? `${h} + ${2 * q} - ${L.m} + 1 = ${nh}` : `${h} - ${L.m} + 1 = ${nh}`};\\ (${L.m}\\cdot${L.m}\\cdot${c} + 1)\\cdot${L.filters}`;
        h = nh; w = nw; c = L.filters; shape = `${h}×${w}×${c}`;
      } else if (L.kind === 'pool') {
        const nh = outSizeRaw(h, L.size, 0, L.size), nw = outSizeRaw(w, L.size, 0, L.size);
        calc = `\\lfloor(${h} - ${L.size})/${L.size}\\rfloor + 1 = ${nh}`;
        h = nh; w = nw; shape = `${h}×${w}×${c}`;
      } else if (L.kind === 'flatten') {
        feats = h * w * c; calc = `${h}\\cdot${w}\\cdot${c} = ${comma(feats)}`; shape = String(feats);
      } else if (L.kind === 'dropout') {
        calc = '\\text{no weights}'; shape = String(feats ?? `${h}×${w}×${c}`);
      } else if (L.kind === 'dense') {
        params = (feats + 1) * L.units; calc = `(${comma(feats)} + 1)\\cdot${L.units}`; feats = L.units; shape = String(L.units);
      }
      total += params;
      rows.push({ kind: L.kind, label: L.kind === 'conv' ? `conv ${L.filters}` : L.kind === 'pool' ? `pool ${L.size}` : L.kind === 'dense' ? `dense ${L.units}` : L.kind, shape, calc, params });
    }
    return { rows, total, h, w, c, feats };
  }
  function cnnTable({ input, spec, upTo = 99, walk = 0 }) {
    const r = cnnRows({ input, spec });
    const k = Math.max(upTo, walk);
    // Matrix string cells render as TeX: plain words go in \text{}, × becomes \times, no $ delimiters
    const tex = (s) => s.replace(/×/g, ' \\times ');
    const values = r.rows.map((row, i) => [`\\text{${row.label}}`, i < k ? tex(row.shape) : '', i < k ? row.calc : '', i < k ? row.params : '']);
    return { ...r, grid: { rows: r.rows.map((_, i) => `L${i + 1}`), cols: ['layer', 'output', 'calculation', 'parameters'], values } };
  }
  // walk: fills the shape table one layer at a time (patch tblWalk). roles: tbl
  function cnnWalk({ input, spec, stopAt = 99 }) {
    const r = cnnRows({ input, spec });
    const trace = [];
    r.rows.forEach((row, i) => {
      if (i >= stopAt) return;
      trace.push({ label: `${row.label}: output ${row.shape}. $${row.calc}$${row.params ? `, so $${comma(row.params)}$ parameters` : ', no parameters'}.`, vars: { layer: row.label, params: row.params }, patch: { tblWalk: i + 1 },
        ops: [{ role: 'tbl', cmd: 'highlight', args: { sel: `row:L${i + 1}`, tone: 'accent' } }] });
    });
    return { trace, total: r.total };
  }
  // math-code trace. roles: tbl (the shape table Matrix), code, formula
  function shapeCode({ input, spec }) {
    const r = cnnRows({ input, spec });
    const trace = [{ label: `Start: $h, w, c = ${input.join(', ')}$; total $= 0$.`, code: 'start', math: 'start', vars: { h: input[0], w: input[1], c: input[2], total: 0 }, ops: [{ role: 'tbl', cmd: 'clear' }] }];
    let total = 0;
    r.rows.forEach((row, i) => {
      total += row.params;
      const anchor = { conv: 'conv', pool: 'pool', flatten: 'flat', dropout: 'flat', dense: 'dense' }[row.kind];
      trace.push({ label: `${row.label}: $${row.calc}$ → ${row.shape}. Total $${comma(total)}$.`, code: anchor, math: anchor, vars: { layer: row.label, shape: row.shape, params: row.params, total },
        ops: [{ role: 'tbl', cmd: 'highlight', args: { sel: `row:L${i + 1}`, tone: 'accent' } }] });
    });
    return { total, trace };
  }

  // ------------------------------------------------------------ 7. VGG16 and transfer learning
  // blocks: [[convs, filters], …]; 3×3 same-padding convs, a 2×2 pool after each block. head: units of the new classifier.
  function vgg({ input, blocks, head = 256, unfreeze = 1 }) {
    let [h, , c] = input;
    const sizes = [h];
    const blockParams = [];
    for (const [convs, f] of blocks) {
      let bp = 0;
      for (let k = 0; k < convs; k++) { bp += (9 * c + 1) * f; c = f; }
      blockParams.push(bp);
      h = Math.floor(h / 2); sizes.push(h);
    }
    const features = h * h * c;
    const base = blockParams.reduce((a, b) => a + b, 0);
    const headParams = (features + 1) * head + (head + 1);
    const top = blockParams.slice(blocks.length - unfreeze).reduce((a, b) => a + b, 0);
    return { sizes, sizesText: sizes.join(' → '), features, side: h, channels: c, convLayers: blocks.reduce((a, b) => a + b[0], 0), blockParams, base, head: headParams, frozenTrainable: headParams, fineTuneTrainable: headParams + top, total: base + headParams };
  }
  // roles: none (code, formula)
  function vggCode({ input, blocks, head = 256 }) {
    const r = vgg({ input, blocks, head });
    const trace = [{ label: `Input side $${input[0]}$.`, code: 'start', math: 'start', vars: { side: input[0] }, ops: [] }];
    let side = input[0];
    blocks.forEach(([convs, f], b) => {
      const ns = Math.floor(side / 2);
      trace.push({ label: `Block ${b + 1}: ${convs} convs with ${f} filters keep $${side}$ (same padding); the pool gives $\\lfloor ${side}/2 \\rfloor = ${ns}$.`, code: 'block', math: 'block', vars: { block: b + 1, side: ns, filters: f }, ops: [] });
      side = ns;
    });
    trace.push({ label: `Flatten: $${r.side}\\cdot${r.side}\\cdot${r.channels} = ${comma(r.features)}$ features.`, code: 'flat', math: 'flat', vars: { features: r.features }, ops: [] });
    trace.push({ label: `New head: $(${comma(r.features)} + 1)\\cdot${head} + (${head} + 1) = ${comma(r.head)}$ trainable.`, code: 'head', math: 'head', vars: { head_params: r.head }, ops: [] });
    return { ...r, trace };
  }

  // ------------------------------------------------------------ 8. training curves
  // hist: table {columns: [epoch, loss, val_loss, accuracy, val_accuracy], rows}
  function curves({ hist }) {
    const rows = hist.rows;
    const ep = rows.map((r) => r[0]);
    let best = 0, bestAcc = 0;
    rows.forEach((r, i) => { if (r[2] < rows[best][2]) best = i; if (r[4] > rows[bestAcc][4]) bestAcc = i; });
    const last = rows[rows.length - 1];
    return {
      bestEpoch: ep[best], minValLoss: rows[best][2], bestAccEpoch: ep[bestAcc], bestValAcc: rows[bestAcc][4],
      finalTrainAcc: last[3], finalValAcc: last[4], finalGap: fix(last[3] - last[4]), epochs: rows.length,
      loss: [{ name: 'training loss', x: ep, y: rows.map((r) => r[1]) }, { name: 'validation loss', x: ep, y: rows.map((r) => r[2]) }],
      acc: [{ name: 'training accuracy', x: ep, y: rows.map((r) => r[3]) }, { name: 'validation accuracy', x: ep, y: rows.map((r) => r[4]) }],
    };
  }
  function bothAcc({ a, b }) {
    const A = curves({ hist: a }), B = curves({ hist: b });
    return { series: [{ name: 'no augmentation: training', x: A.acc[0].x, y: A.acc[0].y }, { name: 'no augmentation: validation', x: A.acc[1].x, y: A.acc[1].y }, { name: 'augmentation: training', x: B.acc[0].x, y: B.acc[0].y }, { name: 'augmentation: validation', x: B.acc[1].x, y: B.acc[1].y }] };
  }
  // roles: none (code, formula). Walks every epoch looking for the lowest validation loss.
  function bestEpochCode({ hist }) {
    const rows = hist.rows;
    let best = 0;
    const trace = [{ label: `Start with epoch ${rows[0][0]}: validation loss $${dn(rows[0][2])}$.`, code: 'init', math: 'init', vars: { best_epoch: rows[0][0], best_loss: rows[0][2] }, ops: [] }];
    for (let i = 1; i < rows.length; i++) {
      const better = rows[i][2] < rows[best][2];
      if (better) best = i;
      trace.push({ label: `Epoch ${rows[i][0]}: $${dn(rows[i][2])}$ ${better ? 'is below the best so far: keep it' : 'is not lower: skip'}.`, code: better ? 'keep' : 'test', math: better ? 'keep' : 'test', vars: { epoch: rows[i][0], val_loss: rows[i][2], best_epoch: rows[best][0] }, ops: [] });
    }
    const last = rows[rows.length - 1];
    trace.push({ label: `Final gap: $${dn(last[3])} - ${dn(last[4])} = ${dn(fix(last[3] - last[4]))}$.`, code: 'gap', math: 'gap', vars: { gap: fix(last[3] - last[4]) }, ops: [] });
    return { bestEpoch: rows[best][0], trace };
  }

  // ------------------------------------------------------------ generators
  const LECTURE_X = '3,2,1,7,1,2,5,4';
  function conv1dQ({ rng, difficulty }) {
    for (;;) {
      const n = difficulty === 1 ? 5 : 6;
      const m = difficulty === 3 ? 3 : rng.pick([2, 3]);
      const x = range(n).map(() => rng.int(0, 5));
      const w = range(m).map(() => rng.pick([-1, 1, 2, 0.5]));
      const s = difficulty === 1 ? 1 : rng.pick([1, 2]);
      const q = difficulty === 3 ? 1 : 0;
      if (x.join(',') === LECTURE_X) continue;
      const r = conv1d({ x, w, p: q, s }), c = conv1d({ x, w, p: q, s, flip: false });
      if (r.o < 2) continue;
      const k = rng.int(0, r.o - 1);
      const y = r.y[k], yc = c.y[k];
      if (Math.abs(y - yc) < 0.3) continue; // flipping must matter for this output
      const s1 = conv1d({ x, w, p: q, s: 1 });
      const wrongStride = s > 1 ? s1.y[k] : fix(r.y[(k + 1) % r.o]);
      if (Math.abs(wrongStride - y) < 0.3) continue;
      const c1 = conv1d({ x, w, p: q, s: 1, flip: false });
      const xcStride = s > 1 ? c1.y[k] : fix(c.y[(k + 1) % c.o]);
      if (Math.abs(xcStride - yc) < 0.3) continue;
      return {
        vars: { x, w, s, p: q, k, y, yc, wr: r.wr, o: r.o, yAll: r.y, ycAll: c.y, xpad: r.xpad, win: r.windows[k], terms: r.terms[k], termsC: c.terms[k], wrongStride, xcStride,
          grid: vecGrid({ x, w }), start: k * s, wrText: r.wr.map(dn).join(', '), padText: r.xpad.join(', ') },
        misconceptions: [
          { var: 'yc', for: 'y', feedback: 'You slid the filter **as written**. Convolution flips it first; sliding it unflipped is cross-correlation.' },
          { var: 'wrongStride', for: 'y', feedback: `Output $y[${k}]$ uses the window that starts at position $${k}\\cdot${s} = ${k * s}$. Count the outputs from 0.` },
          { var: 'y', for: 'yc', feedback: 'That flips the filter. Cross-correlation, what PyTorch does, slides it as written.' },
          { var: 'xcStride', for: 'yc', feedback: `Output ${k} uses the window that starts at position $${k}\cdot${s} = ${k * s}$. Count the outputs from 0.` },
        ],
      };
    }
  }

  function outSizeQ({ rng, difficulty }) {
    for (;;) {
      const n = difficulty === 1 ? rng.pick([6, 7, 8, 10, 12, 28, 32]) : rng.pick([7, 9, 11, 15, 28, 31, 64, 100, 150, 224]);
      const m = rng.pick([2, 3, 5, 7]);
      const q = difficulty === 1 ? rng.pick([1, 2]) : rng.pick([1, 2, 3]);
      const s = difficulty === 1 ? 1 : rng.pick([1, 2, 3]);
      if (m > n + 2 * q) continue;
      const r = outSize({ n, m, p: q, s });
      const noPlus = r.o - 1, oneP = Math.floor((n + q - m) / s) + 1, ceil = Math.ceil(r.num / s) + 1;
      if (noPlus === r.o || oneP === r.o) continue;
      if (difficulty === 3 && !r.floored) continue;
      return {
        vars: { n, m, p: q, s, o: r.o, num: r.num, raw: r.raw, noPlus, oneP, ceil, floored: r.floored, steps: Math.floor(r.num / s), pSame: (m - 1) / 2, mOdd: m % 2 === 1 },
        misconceptions: [
          { var: 'noPlus', for: 'o', feedback: 'You counted the jumps but not the first position. Add 1.' },
          { var: 'oneP', for: 'o', feedback: 'Padding goes on **both** sides: add $2p$, not $p$.' },
          ...(r.floored ? [{ var: 'ceil', for: 'o', feedback: 'Round **down**: a last step that would hang over the edge is skipped.' }] : []),
        ],
      };
    }
  }

  function conv2dQ({ rng, difficulty }) {
    for (;;) {
      const n = difficulty === 1 ? 3 : 4;
      const m = 2;
      const X = range(n).map(() => range(n).map(() => rng.int(0, 4)));
      const W = range(m).map(() => range(m).map(() => rng.pick([-1, 0, 1, 2])));
      const flip = difficulty !== 1;
      const r = conv2d({ X, W, p: 0, s: 1, flip }), alt = conv2d({ X, W, p: 0, s: 1, flip: !flip });
      const i = rng.int(0, r.o1 - 1), j = rng.int(0, r.o2 - 1);
      const y = r.Y[i][j], yAlt = alt.Y[i][j];
      if (Math.abs(y - yAlt) < 0.5) continue;
      const t = r.terms[i * r.o2 + j];
      const windowSum = fix(t.win.reduce((a, [u, v]) => a + r.Xp[u][v], 0));
      if (Math.abs(windowSum - y) < 0.5) continue;
      return {
        vars: { X, W, y, yAlt, i, j, o1: r.o1, o2: r.o2, flip, windowSum, n, tex: t.tex,
          mode: flip ? 'convolution (rotate the filter 180° first)' : 'cross-correlation (slide the filter as written, as PyTorch does)',
          Xg: matGrid({ M: X }), Wg: matGrid({ M: W, rowPrefix: 'k', colPrefix: 'l' }), Wrg: matGrid({ M: flip2(W), rowPrefix: 'k', colPrefix: 'l' }), Yg: matGrid({ M: r.Y }) },
        misconceptions: [
          { var: 'windowSum', for: 'y', feedback: 'You added the window numbers without multiplying each by its filter weight.' },
          { var: 'yAlt', for: 'y', feedback: flip ? 'You slid the filter as written. This question asks for convolution, which rotates it 180° first.' : 'You rotated the filter. PyTorch slides it as written (cross-correlation).' },
        ],
      };
    }
  }

  function poolQ({ rng }) {
    for (;;) {
      const X = range(4).map(() => range(4).map(() => rng.int(0, 9)));
      const r = maxPool({ X, size: 2 });
      const i = rng.int(0, 1), j = rng.int(0, 1);
      const y = r.Y[i][j], avg = r.avg[i][j];
      if (Math.abs(y - avg) < 1) continue;
      const first = X[i * 2][j * 2];
      if (first === y) continue;
      return {
        vars: { X, Xg: matGrid({ M: X }), i, j, y, avg, first, Yg: matGrid({ M: r.Y }), rowA: i * 2, rowB: i * 2 + 1, colA: j * 2, colB: j * 2 + 1 },
        misconceptions: [
          { var: 'avg', for: 'y', feedback: 'That is **average** pooling. Max pooling keeps the largest number in the square.' },
          { var: 'first', for: 'y', feedback: 'That is just the top-left number of the square. Keep the largest of the four.' },
        ],
      };
    }
  }

  function convParamQ({ rng, difficulty }) {
    for (;;) {
      const m = rng.pick([3, 3, 5, 1]);
      const cin = difficulty === 1 ? rng.pick([1, 3]) : rng.pick([3, 16, 32, 64]);
      const cout = rng.pick([8, 16, 32, 64]);
      const r = convParams({ m, cin, cout });
      if (r.noCin === r.params || r.noBias === r.params) continue;
      if (m === 3 && cin === 1 && cout === 32) continue; // the lecture's first MNIST layer
      return {
        vars: { m, cin, cout, params: r.params, perFilter: r.perFilter, noBias: r.noBias, noCin: r.noCin, weights: r.weights,
          errSteps: [`One filter has $${m}\\cdot${m} = ${m * m}$ weights`, `Adding its bias gives $${m * m + 1}$ per filter`, `There are ${cout} filters, so $${m * m + 1}\\cdot${cout} = ${r.noCin}$`] },
        misconceptions: [
          { var: 'noBias', for: 'params', feedback: 'Each filter also has **one bias**: $(m\\cdot m\\cdot C_{in} + 1)\\cdot C_{out}$.' },
          { var: 'noCin', for: 'params', feedback: 'A filter has an $m\\times m$ slice for **every input channel**. Multiply by $C_{in}$.' },
        ],
      };
    }
  }

  // stack of conv(3) / pool(2) stages → final shape, flatten size and the first dense layer's parameters
  function drawStack(rng, difficulty) {
    const n = rng.pick(difficulty === 3 ? [65, 75, 97, 101, 129] : [29, 31, 33, 49, 65]);
    const stages = difficulty === 1 ? 1 : difficulty === 2 ? 2 : 3;
    const filters = [rng.pick([8, 16, 32]), rng.pick([16, 32, 64]), rng.pick([32, 64, 128])].slice(0, stages);
    const spec = [];
    filters.forEach((f) => { spec.push({ kind: 'conv', filters: f, m: 3 }, { kind: 'pool', size: 2 }); });
    const units = rng.pick([32, 64, 128]);
    spec.push({ kind: 'flatten' }, { kind: 'dense', units }, { kind: 'dense', units: rng.pick([1, 10]) });
    return { n, spec, units };
  }
  function stackQ({ rng, difficulty }) {
    for (;;) {
      const cin = rng.pick([1, 3]);
      const { n, spec, units } = drawStack(rng, difficulty);
      const r = cnnRows({ input: [n, n, cin], spec });
      const side = Number(r.rows.filter((x) => x.kind === 'pool').slice(-1)[0].shape.split('×')[0]);
      const feats = Number(r.rows.find((x) => x.kind === 'flatten').shape);
      const dense1 = r.rows.find((x) => x.kind === 'dense').params;
      const convs = spec.filter((x) => x.kind === 'conv');
      const lastConv = convs[convs.length - 1].filters;
      const firstConv = r.rows[0].params;
      const lastConvSide = Number(r.rows.filter((x) => x.kind === 'conv').slice(-1)[0].shape.split('×')[0]);
      const flatBeforePool = (lastConvSide * lastConvSide * lastConv + 1) * units;
      let hc = n; for (const L of spec) { if (L.kind === 'conv') hc -= 2; else if (L.kind === 'pool') hc = Math.ceil(hc / 2); }
      const noFloor = hc * hc * lastConv;
      let hs = n; for (const L of spec) if (L.kind === 'pool') hs = Math.floor(hs / 2);
      const samePad = hs * hs * lastConv;
      if (noFloor === feats || samePad === feats) continue;
      const shapes = r.rows.filter((x) => x.kind === 'conv' || x.kind === 'pool').map((x) => `${x.label}: ${x.shape}`).join(' → ');
      const stagesText = convs.map((x) => `conv with ${x.filters} filters of 3×3, ReLU, then 2×2 max pool`).join('; ');
      return {
        vars: { n, cin, side, feats, dense1, units, lastConv, firstConv, noFloor, samePad, total: r.total, shapes, stagesText, noBiasDense: feats * units, firstFilters: convs[0].filters, flatBeforePool, lastConvSide },
        misconceptions: [
          { var: 'noFloor', for: 'feats', feedback: 'Pooling an odd size rounds **down**: $\\lfloor(n-2)/2\\rfloor + 1$.' },
          { var: 'samePad', for: 'feats', feedback: 'These convolutions use **no padding**: each one trims 2 from the side ($n - 3 + 1$).' },
          { var: 'flatBeforePool', for: 'dense1', feedback: 'You flattened the last convolution output; the last pool comes first and halves each side.' },
          { var: 'noBiasDense', for: 'dense1', feedback: 'Each dense unit also has a bias: $(d_{in} + 1)\\cdot d_{out}$.' },
        ],
      };
    }
  }

  function denseVsConvQ({ rng }) {
    const n = rng.pick([32, 64, 100, 128]), c = 3, units = rng.pick([64, 128, 256]), filters = rng.pick([16, 32, 64]);
    const r = denseVsConv({ n, c, units, filters, m: 3 });
    return {
      vars: { n, c, units, filters, dense: r.dense, conv: r.conv, inputs: r.inputs, noC: (n * n + 1) * units, noBias: r.inputs * units },
      misconceptions: [
        { var: 'noC', for: 'dense', feedback: 'A colour image has 3 numbers per pixel. Flatten all $n\\cdot n\\cdot 3$ of them.' },
        { var: 'noBias', for: 'dense', feedback: 'Add one bias per dense unit: $(d_{in} + 1)\\cdot d_{out}$.' },
      ],
    };
  }

  // an illustrative 12-epoch run that overfits after a drawn epoch
  function curveQ({ rng }) {
    for (;;) {
      const bestAt = rng.int(3, 8);
      const rows = [];
      for (let e = 1; e <= 12; e++) {
        const tr = Math.round((0.7 * Math.exp(-0.28 * e) + 0.02) * 1000) / 1000;
        const base = 0.69 - 0.05 * Math.min(e, bestAt);
        const vl = fix(base + (e > bestAt ? 0.06 * (e - bestAt) + rng.int(0, 2) / 100 : rng.int(0, 1) / 100));
        const ta = fix(Math.min(0.99, 0.55 + 0.04 * e));
        const va = fix(Math.min(0.55 + 0.03 * Math.min(e, bestAt), 0.8) - (e > bestAt ? 0.005 * (e - bestAt) : 0));
        rows.push([e, tr, vl, ta, va]);
      }
      const hist = { columns: ['epoch', 'loss', 'val_loss', 'accuracy', 'val_accuracy'], rows };
      const c = curves({ hist });
      const ties = rows.filter((r) => Math.abs(r[2] - c.minValLoss) < 0.005).length;
      if (ties > 1 || c.bestEpoch === 12) continue;
      return {
        vars: { hist, lossSeries: c.loss, bestEpoch: c.bestEpoch, minValLoss: c.minValLoss, lastEpoch: 12, minTrain: 12, turnEpoch: c.bestEpoch + 1, gap: c.finalGap },
        misconceptions: [
          { var: 'minTrain', for: 'bestEpoch', feedback: 'Training loss keeps falling to the last epoch; that says nothing about new photos. Read the **validation** curve.' },
          { var: 'turnEpoch', for: 'bestEpoch', feedback: 'That is the first epoch **after** the bottom, where validation loss starts to rise. Keep the epoch with the lowest value.' },
        ],
      };
    }
  }

  function vggQ({ rng }) {
    for (;;) {
      const head = rng.pick([64, 128, 256, 512]);
      const side = rng.pick([128, 150, 160, 224]);
      if (side === 150 && head === 256) continue; // the lecture's own head
      const r = vgg({ input: [side, side, 3], blocks: [[2, 64], [2, 128], [3, 256], [3, 512], [3, 512]], head });
      return {
        vars: { head, side, features: r.features, fside: r.side, trainable: r.head, base: r.base, noBias: r.features * head + head, withBase: r.head + r.base, sizes: r.sizesText, ft: r.fineTuneTrainable },
        misconceptions: [
          { var: 'withBase', for: 'trainable', feedback: 'The base is **frozen**: its weights are not trained. Count only the new head.' },
          { var: 'noBias', for: 'trainable', feedback: 'Each dense unit has a bias, and so does the output: $(d_{in}+1)\\cdot u + (u + 1)$.' },
        ],
      };
    }
  }

  return {
    fns: {
      matGrid, conv1d, conv1dSheet, conv1dWalk, conv1dGrid, conv1dCode, padModes, outSize, outSizeCode,
      conv2d, conv2dSheet, conv2dWalk, paddedGrid, flippedGrid, conv2dCode, kernelSum,
      maxPool, poolSheet, poolWalk, poolSame, shiftCols, poolCode,
      convParams, denseParams, denseVsConv, denseVsConvCode, paramsCode, cnnTable, cnnWalk, shapeCode, vgg, vggCode,
      curves, bothAcc, bestEpochCode,
    },
    generators: { conv1dQ, outSizeQ, conv2dQ, poolQ, convParamQ, stackQ, denseVsConvQ, curveQ, vggQ },
  };
}
