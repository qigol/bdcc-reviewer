// Qdigo module: dl-training (ML2, Sessions 19–20: hyperparameter tuning and regularization guided notebook)
// Every number on stage comes from these functions: parameter counts of the 2–64–64–1 network, gradient descent on
// the bowl, steps per epoch, momentum and Adam updates, the narrow valley, early stopping replayed on a validation
// curve, inverted dropout, the L2 penalty and weight decay, and the shape of under- and overfitting curves.
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
  const comma = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '{,}');
  const range = (n) => Array.from({ length: n }, (_, i) => i);

  // ------------------------------------------------------------ 1. parameters of a fully connected network
  function paramCount({ layers }) {
    const rows = [];
    let total = 0;
    for (let i = 1; i < layers.length; i++) {
      const w = layers[i - 1] * layers[i], b = layers[i];
      total += w + b;
      rows.push({ layer: i, w, b, count: w + b });
    }
    return { rows, total, perLayer: rows.map((r) => r.count), weights: rows.reduce((s, r) => s + r.w, 0) };
  }
  function paramGrid({ layers, upTo = 99 }) {
    const r = paramCount({ layers });
    return { rows: r.rows.map((x) => `layer${x.layer}`), cols: ['W_shape', 'b_shape', 'count'], values: r.rows.map((x, i) => [`(${layers[i]}, ${layers[i + 1]})`, `(1, ${layers[i + 1]})`, i < upTo ? x.count : '']) };
  }
  // roles: none (code, formula)
  function paramCode({ layers }) {
    const r = paramCount({ layers });
    const trace = [{ label: `Layers ${layers.join('–')}; total starts at 0.`, code: 'start', math: 'start', vars: { total: 0 }, ops: [] }];
    let t = 0;
    r.rows.forEach((x, i) => {
      t += x.count;
      trace.push({ label: `Layer ${x.layer}: $${layers[i]}\\cdot${layers[i + 1]} + ${layers[i + 1]} = ${comma(x.count)}$; total $${comma(t)}$.`, code: 'layer', math: 'layer', vars: { n_in: layers[i], n_out: layers[i + 1], count: x.count, total: t }, ops: [] });
    });
    return { total: r.total, trace };
  }

  // ------------------------------------------------------------ 2. gradient descent on the bowl L = ½·c·θ²
  function bowl({ eta, c = 1, theta0 = 2, steps = 15 }) {
    const thetas = [theta0];
    for (let k = 0; k < steps; k++) thetas.push(fix(thetas[k] - eta * c * thetas[k]));
    const losses = thetas.map((t) => fix(0.5 * c * t * t));
    const factor = fix(1 - eta * c);
    const verdict = Math.abs(factor) >= 1 ? 'diverges' : factor < 0 ? 'oscillates but settles' : eta * c < 0.3 ? 'creeps' : 'settles';
    return { thetas, losses, factor, verdict, last: thetas[thetas.length - 1], series: [{ name: `η = ${eta}`, x: range(steps + 1), y: losses }] };
  }
  function bowlCompare({ etas = [0.1, 0.8, 1.8, 2.1], steps = 15 }) {
    return { series: etas.map((e) => ({ name: `η = ${e}`, x: range(steps + 1), y: bowl({ eta: e, steps }).losses.map((v) => Math.min(v, 8)) })) };
  }
  // roles: none (code, formula)
  function bowlCode({ eta, c = 1, theta0 = 2, steps = 4 }) {
    const r = bowl({ eta, c, theta0, steps });
    const trace = [{ label: `Start at $\\theta_0 = ${dn(theta0)}$, loss $${dn(r.losses[0])}$.`, code: 'start', math: 'start', vars: { theta: theta0 }, ops: [] }];
    for (let k = 1; k <= steps; k++) {
      const g = fix(c * r.thetas[k - 1]);
      trace.push({ label: `Gradient $c\\,\\theta = ${dn(g)}$.`, code: 'grad', math: 'grad', vars: { step: k, grad: g }, ops: [] });
      trace.push({ label: `$\\theta = ${dn(r.thetas[k - 1])} - ${dn(eta)}\\cdot${p(g)} = ${dn(r.thetas[k])}$; loss $${dn(r.losses[k])}$.`, code: 'update', math: 'update', vars: { step: k, theta: r.thetas[k], loss: r.losses[k] }, ops: [] });
    }
    return { ...r, trace };
  }

  // ------------------------------------------------------------ 3. batches, steps and epochs
  function steps({ N, B, epochs = 1 }) {
    const perEpoch = Math.ceil(N / B);
    return { perEpoch, total: perEpoch * epochs, lastBatch: N - (perEpoch - 1) * B, floor: Math.floor(N / B) };
  }
  // roles: none (code, formula)
  function stepsCode({ N, B, epochs = 1 }) {
    const r = steps({ N, B, epochs });
    return {
      ...r,
      trace: [
        { label: `$N/B = ${N}/${B} = ${dn(N / B)}$; round up: $${r.perEpoch}$ batches per epoch.`, code: 'per', math: 'per', vars: { per_epoch: r.perEpoch }, ops: [] },
        { label: `The last batch holds $${r.lastBatch}$ examples.`, code: 'last', math: 'last', vars: { last_batch: r.lastBatch }, ops: [] },
        { label: `$${r.perEpoch}\\times${epochs} = ${comma(r.total)}$ steps in all.`, code: 'total', math: 'total', vars: { total_steps: r.total }, ops: [] },
      ],
    };
  }

  // ------------------------------------------------------------ 4. momentum and Adam
  // v_t = β v_{t−1} + g_t ; θ_t = θ_{t−1} − η v_t
  function momentum({ grads, beta, eta, theta0 = 0, v0 = 0 }) {
    let v = v0, th = theta0;
    const vs = [], thetas = [];
    for (const g of grads) { v = fix(beta * v + g); th = fix(th - eta * v); vs.push(v); thetas.push(th); }
    return { vs, thetas, last: vs[vs.length - 1], theta: th, limit: beta < 1 ? fix(1 / (1 - beta)) : null };
  }
  function momSheet({ grads, beta, eta, theta0 = 0, upTo = 0, walk = 0 }) {
    const r = momentum({ grads, beta, eta, theta0 });
    const k = Math.max(upTo, walk);
    return { rows: grads.map((_, i) => `t${i + 1}`), cols: ['g', 'v', 'theta'], values: grads.map((g, i) => [g, i < k ? r.vs[i] : '', i < k ? r.thetas[i] : '']) };
  }
  // walk (patch momWalk). roles: sheet
  function momWalk({ grads, beta, eta, theta0 = 0 }) {
    const r = momentum({ grads, beta, eta, theta0 });
    const trace = grads.map((g, i) => {
      const prev = i ? r.vs[i - 1] : 0, prevT = i ? r.thetas[i - 1] : theta0;
      return { label: `$t = ${i + 1}$: $v = ${dn(beta)}\\cdot${p(prev)} + ${p(g)} = ${dn(r.vs[i])}$; $\\theta = ${dn(prevT)} - ${dn(eta)}\\cdot${p(r.vs[i])} = ${dn(r.thetas[i])}$.`,
        vars: { t: i + 1, v: r.vs[i], theta: r.thetas[i] }, patch: { momWalk: i + 1 }, ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: `row:t${i + 1}`, tone: 'accent' } }] };
    });
    return { trace, vs: r.vs };
  }
  // math-code trace. roles: sheet
  function momCode({ grads, beta, eta, theta0 = 0 }) {
    const r = momentum({ grads, beta, eta, theta0 });
    const trace = [{ label: `Velocity starts at $v = 0$, $\\theta = ${dn(theta0)}$.`, code: 'init', math: 'init', vars: { v: 0, theta: theta0 }, ops: [{ role: 'sheet', cmd: 'clear' }] }];
    grads.forEach((g, i) => {
      const prev = i ? r.vs[i - 1] : 0;
      trace.push({ label: `$v = ${dn(beta)}\\cdot${p(prev)} + ${p(g)} = ${dn(r.vs[i])}$.`, code: 'vel', math: 'vel', vars: { t: i + 1, v: r.vs[i] }, ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: `cell:t${i + 1},v`, tone: 'accent' } }] });
      trace.push({ label: `$\\theta = ${dn(i ? r.thetas[i - 1] : theta0)} - ${dn(eta)}\\cdot${p(r.vs[i])} = ${dn(r.thetas[i])}$.`, code: 'move', math: 'move', vars: { t: i + 1, theta: r.thetas[i] }, ops: [{ role: 'sheet', cmd: 'annotate', args: { sel: `cell:t${i + 1},theta`, text: dn(r.thetas[i]) } }] });
    });
    return { ...r, trace };
  }
  // one Adam step from zero averages (as the notebook writes it)
  function adamStep({ g, t = 1, m0 = 0, s0 = 0, beta1 = 0.9, beta2 = 0.999, eta = 0.001, eps = 1e-8 }) {
    const m = beta1 * m0 + (1 - beta1) * g, s = beta2 * s0 + (1 - beta2) * g * g;
    const mhat = m / (1 - beta1 ** t), shat = s / (1 - beta2 ** t);
    const stepSize = (eta * mhat) / (Math.sqrt(shat) + eps);
    return { m: fix(m), s: fix(s), mhat: fix(mhat), shat: fix(shat), step: fix(stepSize), sgdStep: fix(eta * g) };
  }
  // roles: none (code, formula)
  function adamCode({ g, eta = 0.1 }) {
    const r = adamStep({ g, eta });
    return {
      ...r,
      trace: [
        { label: `$m = 0.9\\cdot0 + 0.1\\cdot${p(g)} = ${dn(r.m)}$.`, code: 'm', math: 'm', vars: { m: r.m }, ops: [] },
        { label: `$s = 0.999\\cdot0 + 0.001\\cdot${p(g)}^2 = ${dn(r.s, 6)}$.`, code: 's', math: 's', vars: { s: r.s }, ops: [] },
        { label: `Bias correction at $t = 1$: $\\hat m = ${dn(r.mhat)}$, $\\hat s = ${dn(r.shat)}$.`, code: 'hat', math: 'hat', vars: { m_hat: r.mhat, s_hat: r.shat }, ops: [] },
        { label: `Step $= ${dn(eta)}\\cdot${dn(r.mhat)}/\\sqrt{${dn(r.shat)}} = ${dn(r.step)}$, whatever the size of $g$.`, code: 'step', math: 'step', vars: { step: r.step }, ops: [] },
      ],
    };
  }
  // the narrow valley L = ½(θ1² + 50 θ2²) from (−4, 0.8)
  function valley({ optimizer, eta, n = 40, beta = 0.9 }) {
    const C = [1, 50];
    let th = [-4, 0.8];
    const m = [0, 0], s = [0, 0];
    const path = [th.slice()];
    for (let t = 1; t <= n; t++) {
      const g = [C[0] * th[0], C[1] * th[1]];
      if (optimizer === 'SGD') th = th.map((v, i) => v - eta * g[i]);
      else if (optimizer === 'Momentum') { for (let i = 0; i < 2; i++) m[i] = beta * m[i] + g[i]; th = th.map((v, i) => v - eta * m[i]); }
      else {
        for (let i = 0; i < 2; i++) { m[i] = beta * m[i] + (1 - beta) * g[i]; s[i] = 0.999 * s[i] + 0.001 * g[i] ** 2; }
        th = th.map((v, i) => v - (eta * (m[i] / (1 - beta ** t))) / (Math.sqrt(s[i] / (1 - 0.999 ** t)) + 1e-8));
      }
      path.push(th.map(fix));
    }
    const last = path[path.length - 1];
    return { path, last, dist: fix(Math.hypot(last[0], last[1])) };
  }
  function valleyChart({ runs }) {
    return { series: runs.map(([opt, eta]) => { const v = valley({ optimizer: opt, eta }); return { name: `${opt}, η = ${eta}`, x: v.path.map((q) => q[0]), y: v.path.map((q) => q[1]) }; }) };
  }

  // ------------------------------------------------------------ 5. data splits and scaling on training data only
  function scaleTrain({ train, other }) {
    const mu = train.reduce((a, b) => a + b, 0) / train.length;
    const sd = Math.sqrt(train.reduce((a, b) => a + (b - mu) ** 2, 0) / train.length);
    return { mu: fix(mu), sd: fix(sd), zTrain: train.map((v) => fix((v - mu) / sd)), zOther: other.map((v) => fix((v - mu) / sd)) };
  }
  // roles: none
  function scaleCode({ train, other }) {
    const r = scaleTrain({ train, other });
    return {
      ...r,
      trace: [
        { label: `Mean of the training values only: $\\mu = ${dn(r.mu)}$.`, code: 'mu', math: 'mu', vars: { mu: r.mu }, ops: [] },
        { label: `Standard deviation of the training values: $\\sigma = ${dn(r.sd)}$.`, code: 'sd', math: 'sd', vars: { sd: r.sd }, ops: [] },
        { label: `Scale every set with those two numbers: validation $\\to [${r.zOther.map((v) => dn(v, 2)).join(', ')}]$.`, code: 'z', math: 'z', vars: { z_val: r.zOther }, ops: [] },
      ],
    };
  }
  function bestOf({ table, col }) {
    const ci = table.columns.indexOf(col);
    let best = table.rows[0];
    for (const r of table.rows) if (r[ci] < best[ci]) best = r;
    return { label: best[0], value: best[ci] };
  }
  function tableGrid({ table }) {
    return { rows: table.rows.map((r) => String(r[0]).replace(/[^A-Za-z0-9_-]/g, '_')), cols: table.columns.slice(1), values: table.rows.map((r) => r.slice(1)) };
  }

  // ------------------------------------------------------------ 6. diagnosing curves (illustrative shapes)
  function shapeCurves({ kind = 'good', epochs = 30 }) {
    const e = range(epochs).map((i) => i + 1);
    const f = {
      underfit: (t) => [0.62 - 0.04 * (1 - Math.exp(-t / 10)), 0.64 - 0.04 * (1 - Math.exp(-t / 10))],
      good: (t) => [0.15 + 0.5 * Math.exp(-t / 6), 0.22 + 0.45 * Math.exp(-t / 6)],
      overfit: (t) => [0.04 + 0.6 * Math.exp(-t / 6), 0.3 + 0.38 * Math.exp(-t / 4) + 0.012 * Math.max(0, t - 8)],
      'lr-high': (t) => { const j = 0.25 * Math.abs(Math.sin(t * 1.7)); return [0.45 + j, 0.5 + j]; },
      'lr-low': (t) => [0.69 - 0.004 * t, 0.7 - 0.0035 * t],
    }[kind];
    const tr = e.map((t) => fix(Math.round(f(t)[0] * 1000) / 1000)), va = e.map((t) => fix(Math.round(f(t)[1] * 1000) / 1000));
    let best = 0; va.forEach((v, i) => { if (v < va[best]) best = i; });
    return { series: [{ name: 'training loss', x: e, y: tr }, { name: 'validation loss', x: e, y: va }], bestEpoch: best + 1, finalGap: fix(va[va.length - 1] - tr[tr.length - 1]) };
  }
  // the rule as code: falling/rising validation, gap
  function diagnose({ trainEnd, valEnd, valMin, high = 0.5 }) {
    if (trainEnd > high && valEnd > high) return { verdict: 'underfitting' };
    if (valEnd > valMin + 0.05) return { verdict: 'overfitting' };
    return { verdict: 'good fit' };
  }

  // ------------------------------------------------------------ 7. early stopping (find_stopping_point)
  function earlyStop({ val, patience, minDelta }) {
    let best = Infinity, bestEpoch = 0, wait = 0;
    const log = [];
    for (let e = 1; e <= val.length; e++) {
      const loss = val[e - 1];
      const improved = loss < best - minDelta;
      if (improved) { best = loss; bestEpoch = e; wait = 0; } else wait += 1;
      log.push({ e, loss, improved, wait, best: fix(best), bestEpoch });
      if (wait >= patience) return { bestEpoch, stopEpoch: e, best: fix(best), log, stopped: true };
    }
    return { bestEpoch, stopEpoch: val.length, best: fix(best), log, stopped: false };
  }
  function stopSheet({ val, patience, minDelta, upTo = 0, walk = 0 }) {
    const r = earlyStop({ val, patience, minDelta });
    const k = Math.max(upTo, walk);
    return { rows: val.map((_, i) => `e${i + 1}`), cols: ['val_loss', 'better', 'wait'], values: val.map((v, i) => { const L = r.log[i]; return [v, L && i < k ? (L.improved ? 'yes' : 'no') : '', L && i < k ? L.wait : '']; }) };
  }
  // walk (patch stopWalk). roles: sheet
  function stopWalk({ val, patience, minDelta, stopAt = 999 }) {
    const r = earlyStop({ val, patience, minDelta });
    const trace = r.log.filter((L) => L.e <= stopAt).map((L) => ({
      label: L.improved
        ? `Epoch ${L.e}: $${dn(L.loss)}$ beats the best by more than $\\delta$. New best; wait $= 0$.`
        : `Epoch ${L.e}: $${dn(L.loss)}$ is not below $${dn(L.best)} - ${dn(minDelta)}$. Wait $= ${L.wait}$${L.wait >= patience ? ': stop' : ''}.`,
      vars: { epoch: L.e, wait: L.wait, best_epoch: L.bestEpoch }, patch: { stopWalk: L.e }, ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: `row:e${L.e}`, tone: L.improved ? 'good' : 'warn' } }],
    }));
    return { trace, stopEpoch: r.stopEpoch, bestEpoch: r.bestEpoch };
  }
  // math-code trace. roles: sheet
  function stopCode({ val, patience, minDelta }) {
    const r = earlyStop({ val, patience, minDelta });
    const trace = [{ label: `best $= \\infty$, wait $= 0$. Patience ${patience}, $\\delta = ${dn(minDelta)}$.`, code: 'init', math: 'init', vars: { patience, min_delta: minDelta }, ops: [{ role: 'sheet', cmd: 'clear' }] }];
    for (const L of r.log) {
      trace.push({ label: `Epoch ${L.e}: is $${dn(L.loss)} < \\text{best} - \\delta$? ${L.improved ? 'Yes' : 'No'}.`, code: 'test', math: 'test', vars: { epoch: L.e, val_loss: L.loss }, ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: `row:e${L.e}`, tone: 'accent' } }] });
      trace.push({ label: L.improved ? `Keep epoch ${L.e} as best; wait $= 0$.` : `wait $= ${L.wait}$.`, code: L.improved ? 'keep' : 'wait', math: L.improved ? 'keep' : 'wait', vars: { best_epoch: L.bestEpoch, wait: L.wait }, ops: [] });
    }
    trace.push({ label: `Stop at epoch ${r.stopEpoch}; restore the weights of epoch ${r.bestEpoch}.`, code: 'stop', math: 'stop', vars: { stop_epoch: r.stopEpoch, best_epoch: r.bestEpoch }, ops: [] });
    return { ...r, trace };
  }
  function stopChart({ val, patience, minDelta }) {
    const r = earlyStop({ val, patience, minDelta });
    return { series: [{ name: 'validation loss', x: val.map((_, i) => i + 1), y: val }, { name: 'stopped here', x: [r.stopEpoch, r.stopEpoch], y: [Math.min(...val), Math.max(...val)] }, { name: 'best epoch (restored)', x: [r.bestEpoch], y: [val[r.bestEpoch - 1]] }] };
  }

  // ------------------------------------------------------------ 8. inverted dropout
  function dropout({ a, mask, p: rate }) {
    const keep = fix(1 - rate);
    const out = a.map((v, i) => fix(mask[i] ? v / keep : 0));
    return { keep: fix(keep), scale: fix(1 / keep), out, sumIn: fix(a.reduce((s, v) => s + v, 0)), sumOut: fix(out.reduce((s, v) => s + v, 0)), kept: mask.filter(Boolean).length, expectedKept: fix(a.length * keep) };
  }
  // roles: none
  function dropoutCode({ a, mask, p: rate }) {
    const r = dropout({ a, mask, p: rate });
    const trace = [{ label: `Keep probability $1 - p = ${dn(r.keep)}$; survivors are scaled by $1/${dn(r.keep)} = ${dn(r.scale)}$.`, code: 'keep', math: 'keep', vars: { keep: r.keep, scale: r.scale }, ops: [] }];
    a.forEach((v, i) => trace.push({ label: mask[i] ? `Unit ${i + 1} kept: $${dn(v)}/${dn(r.keep)} = ${dn(r.out[i])}$.` : `Unit ${i + 1} dropped: $0$.`, code: 'mask', math: 'mask', vars: { unit: i + 1, out: r.out[i] }, ops: [] }));
    trace.push({ label: 'At prediction time nothing is dropped and nothing is scaled.', code: 'eval', math: 'eval', vars: {}, ops: [] });
    return { ...r, trace };
  }

  // ------------------------------------------------------------ 9. L2 regularization / weight decay
  function l2({ w, lam }) {
    const sq = w.reduce((s, v) => s + v * v, 0);
    return { sumSq: fix(sq), penalty: fix(0.5 * lam * sq), grads: w.map((v) => fix(lam * v)) };
  }
  // SGD with weight decay: w ← w − η(g + λw) = (1 − ηλ)w − ηg
  function decayStep({ w, g, lam, eta }) {
    const shrink = fix(1 - eta * lam);
    const next = fix(w - eta * (g + lam * w));
    return { shrink, next, plain: fix(w - eta * g), extra: fix(lam * w) };
  }
  // one weight; data loss ½(w − 3)², best w = 3/(1 + λ)
  function bestWeight({ lam, target = 3 }) {
    const w = target / (1 + lam);
    return { w: fix(w), total: fix(0.5 * (w - target) ** 2 + 0.5 * lam * w * w) };
  }
  function penaltyCurve({ x, lam = 0.5 }) { return { y: 0.5 * (x - 3) ** 2 + 0.5 * lam * x * x }; }
  // roles: none
  function l2Code({ w, g, lam, eta }) {
    const a = l2({ w, lam });
    const d = w.map((wi, i) => decayStep({ w: wi, g: g[i], lam, eta }));
    const trace = [
      { label: `Penalty: $\\tfrac{${dn(lam)}}{2}(${w.map((v) => `${dn(v)}^2`).join(' + ')}) = ${dn(a.penalty)}$.`, code: 'pen', math: 'pen', vars: { penalty: a.penalty }, ops: [] },
    ];
    w.forEach((wi, i) => {
      trace.push({ label: `Weight ${i + 1}: gradient $${dn(g[i])} + ${dn(lam)}\\cdot${p(wi)} = ${dn(fix(g[i] + lam * wi))}$.`, code: 'grad', math: 'grad', vars: { i: i + 1, grad: fix(g[i] + lam * wi) }, ops: [] });
      trace.push({ label: `$w = ${dn(wi)} - ${dn(eta)}\\cdot${p(fix(g[i] + lam * wi))} = ${dn(d[i].next)}$.`, code: 'step', math: 'step', vars: { i: i + 1, w_new: d[i].next }, ops: [] });
    });
    return { penalty: a.penalty, next: d.map((x) => x.next), trace };
  }

  // ------------------------------------------------------------ generators
  function paramQ({ rng, difficulty }) {
    for (;;) {
      const depth = difficulty === 1 ? 3 : 4;
      const layers = [rng.pick([2, 3, 4, 8, 10])];
      for (let i = 1; i < depth - 1; i++) layers.push(rng.pick([16, 32, 64, 128]));
      layers.push(rng.pick([1, 1, 3, 10]));
      if (layers.join() === '2,64,64,1') continue;
      const r = paramCount({ layers });
      const noBias = r.weights, units = layers.reduce((a, b) => a + b, 0);
      if (noBias === r.total) continue;
      return {
        vars: { layers, shape: layers.join('–'), total: r.total, perLayer: r.perLayer, noBias, units, extraBias: r.total + layers[0] },
        misconceptions: [
          { var: 'noBias', for: 'total', feedback: 'Each layer also has one bias per unit.' },
          { var: 'extraBias', for: 'total', feedback: 'The inputs are data, not units: they have no bias.' },
        ],
      };
    }
  }
  function bowlQ({ rng, difficulty }) {
    for (;;) {
      const eta = rng.pick([0.1, 0.2, 0.5, 0.8, 1.5, 1.8, 2.2]), c = difficulty === 1 ? 1 : rng.pick([1, 2, 4]), theta0 = rng.pick([1, 2, 3, -2]);
      const k = difficulty === 3 ? 2 : 1;
      const r = bowl({ eta, c, theta0, steps: k });
      const ans = r.thetas[k];
      const plusGrad = fix(theta0 + eta * c * theta0), noEta = fix(theta0 - c * theta0);
      if (Math.abs(plusGrad - ans) < 0.02 || Math.abs(noEta - ans) < 0.02) continue;
      const factor = r.factor;
      return {
        vars: { eta, c, theta0, k, ans, factor, plusGrad, noEta, verdict: bowl({ eta, c }).verdict, verdictIdx: Math.abs(factor) >= 1 ? 2 : factor < 0 ? 1 : 0, g0: fix(c * theta0) },
        misconceptions: [
          { var: 'plusGrad', for: 'ans', feedback: 'Gradient descent **subtracts** $\\eta$ times the gradient.' },
          { var: 'noEta', for: 'ans', feedback: 'Multiply the gradient by the learning rate $\\eta$ before subtracting.' },
        ],
      };
    }
  }
  function stepsQ({ rng, difficulty }) {
    for (;;) {
      const N = rng.pick([160, 500, 1000, 1200, 2000, 50000, 60000]), B = rng.pick([16, 32, 64, 100, 128, 256]), epochs = rng.pick([5, 10, 20, 200]);
      const r = steps({ N, B, epochs });
      if (N % B === 0 || B === r.perEpoch) continue;
      const floorTotal = r.floor * epochs, perExample = N * epochs;
      return {
        vars: { batchOnly: B, N, B, epochs, perEpoch: r.perEpoch, total: r.total, lastBatch: r.lastBatch, floor: r.floor, floorTotal, perExample, ratio: dn(N / B) },
        misconceptions: [
          { var: 'floor', for: 'perEpoch', feedback: 'The leftover examples still form one last, smaller batch: round **up**.' },
          { var: 'batchOnly', for: 'perEpoch', feedback: 'That is the size of one batch. Count how many batches fit in $N$.' },
          { var: 'floorTotal', for: 'total', feedback: 'Round $N/B$ **up** before multiplying by the epochs.' },
          { var: 'perExample', for: 'total', feedback: 'One step uses a whole batch, not one example.' },
        ],
      };
    }
  }
  function momQ({ rng, difficulty }) {
    for (;;) {
      const beta = rng.pick([0.5, 0.8, 0.9]), eta = rng.pick([0.1, 0.01, 0.5]);
      const T = difficulty === 1 ? 2 : 3;
      const grads = range(T).map(() => rng.pick([1, 2, -1, 0.5, 4]));
      const r = momentum({ grads, beta, eta, theta0: 1 });
      const v = r.last, noMem = grads[T - 1], sumG = fix(grads.reduce((a, b) => a + b, 0)), avgForm = momentum({ grads: grads.map((g) => g * (1 - beta)), beta, eta, theta0: 1 }).last;
      if ([noMem, sumG, avgForm].some((x) => Math.abs(x - v) < 0.03)) continue;
      return {
        vars: { beta, eta, grads, T, v, vs: r.vs, theta: r.theta, noMem, sumG, avgForm, grid: { rows: ['g'], cols: grads.map((_, i) => `t${i + 1}`), values: [grads] } },
        misconceptions: [
          { var: 'noMem', for: 'v', feedback: 'That is just the current gradient. Momentum adds $\\beta$ times the previous velocity.' },
          { var: 'sumG', for: 'v', feedback: 'Older gradients fade: each step multiplies the old velocity by $\\beta$.' },
          { var: 'avgForm', for: 'v', feedback: 'That is Adam\'s averaged form, $(1-\\beta)g$. This momentum adds the full gradient: $v = \\beta v + g$.' },
        ],
      };
    }
  }
  function stopQ({ rng, difficulty }) {
    for (;;) {
      const n = 10;
      const val = [];
      let v = 0.7;
      const turn = rng.int(3, 6);
      for (let e = 1; e <= n; e++) { v = e <= turn ? v - rng.pick([0.03, 0.05, 0.08]) : v + rng.pick([-0.005, 0.01, 0.02, 0.03]); val.push(fix(Math.round(v * 1000) / 1000)); }
      const patience = difficulty === 1 ? 2 : 3, minDelta = difficulty === 3 ? 0.01 : 0;
      const r = earlyStop({ val, patience, minDelta });
      if (!r.stopped) continue;
      const noDelta = earlyStop({ val, patience, minDelta: 0 });
      if (difficulty === 3 && noDelta.stopEpoch === r.stopEpoch) continue;
      const lastBest = r.stopEpoch, minEpoch = val.indexOf(Math.min(...val)) + 1;
      if (r.bestEpoch === r.stopEpoch) continue;
      return {
        vars: { val, patience, minDelta, stopEpoch: r.stopEpoch, bestEpoch: r.bestEpoch, best: r.best, lastBest, minEpoch, noDeltaStop: noDelta.stopEpoch, offByOne: r.stopEpoch - 1, late: r.stopEpoch + 1,
          grid: { rows: ['val'], cols: val.map((_, i) => `e${i + 1}`), values: [val] } },
        misconceptions: [
          { var: 'offByOne', for: 'stopEpoch', feedback: `Training stops on the epoch where the wait **reaches** the patience (${patience}).` },
          ...(minDelta ? [{ var: 'noDeltaStop', for: 'stopEpoch', feedback: 'A loss counts as better only if it beats the best by more than $\\delta$.' }] : []),
          { var: 'late', for: 'stopEpoch', feedback: 'Training stops on the epoch where the wait reaches the patience, not one epoch later.' },
          { var: 'lastBest', for: 'bestEpoch', feedback: 'Restore the **best** epoch, not the epoch where training stopped.' },
        ],
      };
    }
  }
  function dropQ({ rng }) {
    for (;;) {
      const rate = rng.pick([0.2, 0.25, 0.5, 0.75]), a = rng.pick([0.6, 1.2, 1.5, 2, 3]);
      const keep = 1 - rate, ans = fix(a / keep), times = fix(a * keep), byP = fix(a / rate);
      if ([times, byP, a].some((x) => Math.abs(x - ans) < 0.02)) continue;
      const n = rng.pick([64, 100, 200, 512]);
      return {
        vars: { rate, a, keep: fix(keep), ans, times, byP, n, kept: fix(n * keep) },
        misconceptions: [
          { var: 'times', for: 'ans', feedback: 'Inverted dropout **divides** the survivors by $1 - p$ so the total stays the same.' },
          { var: 'byP', for: 'ans', feedback: 'Divide by the keep probability $1 - p$, not by $p$.' },
          { var: 'a', for: 'ans', feedback: 'During training the survivors are scaled up by $1/(1-p)$.' },
        ],
      };
    }
  }
  function l2Q({ rng, difficulty }) {
    for (;;) {
      const lam = rng.pick([0.01, 0.1, 0.5, 1]), eta = rng.pick([0.1, 0.5]);
      const w = range(difficulty === 1 ? 2 : 3).map(() => rng.pick([-2, -1, 1, 2, 3, 0.5]));
      const g = rng.pick([0.2, -0.4, 1, 0]);
      const a = l2({ w, lam });
      const noHalf = fix(lam * a.sumSq), noSquare = fix(0.5 * lam * w.reduce((s, v) => s + Math.abs(v), 0));
      const d = decayStep({ w: w[0], g, lam, eta });
      const noDecay = d.plain, plusDecay = fix(w[0] - eta * (g - lam * w[0]));
      if ([noHalf, noSquare].some((x) => Math.abs(x - a.penalty) < 0.01)) continue;
      if ([noDecay, plusDecay].some((x) => Math.abs(x - d.next) < 0.005)) continue;
      return {
        vars: { lam, eta, w, g, penalty: a.penalty, sumSq: a.sumSq, noHalf, noSquare, w0: w[0], next: d.next, shrink: d.shrink, noDecay, plusDecay, extra: d.extra, bestW: bestWeight({ lam }).w },
        misconceptions: [
          { var: 'noHalf', for: 'penalty', feedback: 'The penalty is $\\tfrac{\\lambda}{2}\\sum w^2$: halve it.' },
          { var: 'noSquare', for: 'penalty', feedback: 'Square each weight; L2 uses $w^2$, not $|w|$.' },
          { var: 'noDecay', for: 'next', feedback: 'You left out the penalty\'s gradient $\\lambda w$.' },
          { var: 'plusDecay', for: 'next', feedback: 'The penalty pulls the weight **toward 0**: add $\\lambda w$ to the gradient before subtracting.' },
        ],
      };
    }
  }

  return {
    fns: {
      paramCount, paramGrid, paramCode, bowl, bowlCompare, bowlCode, steps, stepsCode,
      momentum, momSheet, momWalk, momCode, adamStep, adamCode, valley, valleyChart,
      scaleTrain, scaleCode, bestOf, tableGrid, shapeCurves, diagnose,
      earlyStop, stopSheet, stopWalk, stopCode, stopChart, dropout, dropoutCode,
      l2, decayStep, bestWeight, penaltyCurve, l2Code,
    },
    generators: { paramQ, bowlQ, stepsQ, momQ, stopQ, dropQ, l2Q },
  };
}
