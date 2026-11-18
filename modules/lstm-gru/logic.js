// Qdigo module: lstm-gru (ML2, Sessions 27–28: LSTM_GRU_PyTorch lecture notebook + architecture notes)
// Every number on stage comes from these functions: the w^k picture of fading gradients, one LSTM and one GRU step
// on a single memory element, gate retention g^k, the write/hold/overwrite demo, recurrent parameter counts, the
// RNN/LSTM/GRU comparison table, a residual shortcut's derivative, and a tiny self-attention example.
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
  const sig = (z) => 1 / (1 + Math.exp(-z));

  // ------------------------------------------------------------ 1. why plain RNNs forget
  // one hidden unit: going back k steps multiplies the gradient by w^k and by k tanh slopes (each ≤ 1)
  function chainFactor({ w, k, slope = 1 }) {
    const plain = w ** k, withSlope = (w * slope) ** k;
    return { plain: fix(plain), withSlope: fix(withSlope), kind: Math.abs(w * slope) < 1 ? 'vanishes' : Math.abs(w * slope) > 1 ? 'explodes' : 'stays' };
  }
  function fadeCurve({ x, w = 0.9 }) { return { y: w ** x }; }
  function fadeTable({ ws = [0.5, 0.9, 1, 1.1], ks = [10, 50] }) {
    return { rows: ws.map((w) => `w${String(w).replace('.', '_')}`), cols: ks.map((k) => `after${k}`), values: ws.map((w) => ks.map((k) => Number((w ** k).toPrecision(3)))) };
  }
  // roles: none (code, formula)
  function chainCode({ w, k, slope = 1 }) {
    const trace = [{ label: `Start the signal at 1.`, code: 'init', math: 'init', vars: { signal: 1 }, ops: [] }];
    let s = 1;
    for (let i = 1; i <= k; i++) {
      s *= w * slope;
      if (i <= 3 || i === k) trace.push({ label: `Step back ${i}: multiply by $w\\cdot\\tanh' = ${dn(w)}\\cdot${dn(slope)}$: signal $= ${dn(s, 6)}$.`, code: 'mult', math: 'mult', vars: { step: i, signal: fix(s) }, ops: [] });
      else if (i === 4) trace.push({ label: `… the same multiplication, again and again …`, code: 'mult', math: 'mult', vars: { step: i, signal: fix(s) }, ops: [] });
    }
    trace.push({ label: `After ${k} steps: $(${dn(w * slope)})^{${k}} = ${dn(s, 6)}$.`, code: 'out', math: 'out', vars: { signal: fix(s) }, ops: [] });
    return { signal: fix(s), trace };
  }

  // ------------------------------------------------------------ 2. one LSTM step on one memory element
  // given gate values (each in 0..1) and the candidate (−1..1)
  function lstmUpdate({ cprev, f, i, ct, o }) {
    const keep = fix(f * cprev), write = fix(i * ct);
    const C = fix(keep + write);
    const tC = Math.tanh(C);
    const h = fix(o * tC);
    return { keep, write, C, tanhC: fix(tC), h };
  }
  // full step from weights: each gate g has (w_g on x, u_g on h_prev, b_g)
  function lstmStep({ x, hprev, cprev, W }) {
    const pre = (g) => fix(W[g][0] * x + W[g][1] * hprev + W[g][2]);
    const zf = pre('f'), zi = pre('i'), zc = pre('c'), zo = pre('o');
    const f = fix(sig(zf)), i = fix(sig(zi)), ct = fix(Math.tanh(zc)), o = fix(sig(zo));
    const u = lstmUpdate({ cprev, f, i, ct, o });
    return { zf, zi, zc, zo, f, i, ct, o, ...u };
  }
  const LSTM_ROWS = ['f', 'i', 'ct', 'keep', 'write', 'C', 'o', 'h'];
  function lstmRows(n) {
    const r = lstmStep(n);
    const { x, hprev, cprev, W } = n;
    const zt = (g) => `${p(W[g][0])}${p(x)} + ${p(W[g][1])}${p(hprev)} + ${p(W[g][2])}`;
    return [
      ['f_t = \\sigma(z_f)', `\\sigma(${zt('f')}) = \\sigma(${dn(r.zf)})`, dn(r.f)],
      ['i_t = \\sigma(z_i)', `\\sigma(${zt('i')}) = \\sigma(${dn(r.zi)})`, dn(r.i)],
      ['\\tilde C_t = \\tanh(z_c)', `\\tanh(${zt('c')}) = \\tanh(${dn(r.zc)})`, dn(r.ct)],
      ['f_t C_{t-1}', `${dn(r.f)}\\cdot${p(cprev)}`, dn(r.keep)],
      ['i_t \\tilde C_t', `${dn(r.i)}\\cdot${p(r.ct)}`, dn(r.write)],
      ['C_t', `${dn(r.keep)} + ${p(r.write)}`, dn(r.C)],
      ['o_t = \\sigma(z_o)', `\\sigma(${zt('o')}) = \\sigma(${dn(r.zo)})`, dn(r.o)],
      ['h_t = o_t \\tanh(C_t)', `${dn(r.o)}\\cdot\\tanh(${dn(r.C)})`, dn(r.h)],
    ];
  }
  function lstmSheet({ net, upTo = 0, walk = 0 }) {
    const k = Math.max(upTo, walk);
    return { rows: LSTM_ROWS, cols: ['equation', 'substitution', 'result'], values: lstmRows(net).map((r, j) => [r[0], j < k ? r[1] : '', j < k ? r[2] : '']) };
  }
  const LSTM_SAY = ['Forget gate', 'Input gate', 'Candidate', 'Kept memory', 'Written memory', 'New cell state', 'Output gate', 'New hidden state'];
  // walk (patch lstmWalk). roles: sheet
  function lstmWalk({ net, from = 0, to = 8 }) {
    const rows = lstmRows(net);
    const trace = [];
    for (let j = from; j < to; j++) trace.push({ label: `${LSTM_SAY[j]}: $${rows[j][1]} = ${rows[j][2]}$.`, vars: { [LSTM_ROWS[j]]: Number(rows[j][2]) }, patch: { lstmWalk: j + 1 }, ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: `row:${LSTM_ROWS[j]}`, tone: 'accent' } }] });
    return { trace };
  }
  // math-code trace on given gate values. roles: none (code, formula)
  function lstmCode({ cprev, f, i, ct, o }) {
    const r = lstmUpdate({ cprev, f, i, ct, o });
    return {
      ...r,
      trace: [
        { label: `Keep: $f_t C_{t-1} = ${dn(f)}\\cdot${p(cprev)} = ${dn(r.keep)}$.`, code: 'keep', math: 'keep', vars: { keep: r.keep }, ops: [] },
        { label: `Write: $i_t \\tilde C_t = ${dn(i)}\\cdot${p(ct)} = ${dn(r.write)}$.`, code: 'write', math: 'write', vars: { write: r.write }, ops: [] },
        { label: `Add: $C_t = ${dn(r.keep)} + ${p(r.write)} = ${dn(r.C)}$.`, code: 'cell', math: 'cell', vars: { C: r.C }, ops: [] },
        { label: `Expose: $h_t = ${dn(o)}\\cdot\\tanh(${dn(r.C)}) = ${dn(o)}\\cdot${dn(r.tanhC)} = ${dn(r.h)}$.`, code: 'expose', math: 'expose', vars: { h: r.h }, ops: [] },
      ],
    };
  }

  // ------------------------------------------------------------ 3. one GRU step (Cho et al. / PyTorch convention)
  function gruUpdate({ z, hprev, ht }) {
    const keep = fix(z * hprev), add = fix((1 - z) * ht);
    return { keep, add, h: fix(keep + add), swapped: fix((1 - z) * hprev + z * ht) };
  }
  // full step: r = σ(w_r x + u_r h + b_r), z = σ(w_z x + u_z h + b_z), h̃ = tanh(w x + u (r·h) + b)
  function gruStep({ x, hprev, W }) {
    const zr = fix(W.r[0] * x + W.r[1] * hprev + W.r[2]), zz = fix(W.z[0] * x + W.z[1] * hprev + W.z[2]);
    const r = fix(sig(zr)), z = fix(sig(zz));
    const zh = fix(W.h[0] * x + W.h[1] * (r * hprev) + W.h[2]);
    const ht = fix(Math.tanh(zh));
    const u = gruUpdate({ z, hprev, ht });
    const noReset = fix(Math.tanh(W.h[0] * x + W.h[1] * hprev + W.h[2]));
    return { zr, zz, r, z, zh, ht, noReset, ...u };
  }
  const GRU_ROWS = ['r', 'z', 'ht', 'keep', 'add', 'h'];
  function gruRows(n) {
    const g = gruStep(n);
    const { x, hprev, W } = n;
    return [
      ['r_t = \\sigma(z_r)', `\\sigma(${p(W.r[0])}${p(x)} + ${p(W.r[1])}${p(hprev)} + ${p(W.r[2])}) = \\sigma(${dn(g.zr)})`, dn(g.r)],
      ['z_t = \\sigma(z_z)', `\\sigma(${p(W.z[0])}${p(x)} + ${p(W.z[1])}${p(hprev)} + ${p(W.z[2])}) = \\sigma(${dn(g.zz)})`, dn(g.z)],
      ['\\tilde h_t = \\tanh(\\cdot)', `\\tanh(${p(W.h[0])}${p(x)} + ${p(W.h[1])}(${dn(g.r)}\\cdot${p(hprev)}) + ${p(W.h[2])}) = \\tanh(${dn(g.zh)})`, dn(g.ht)],
      ['z_t h_{t-1}', `${dn(g.z)}\\cdot${p(hprev)}`, dn(g.keep)],
      ['(1 - z_t)\\tilde h_t', `${dn(fix(1 - g.z))}\\cdot${p(g.ht)}`, dn(g.add)],
      ['h_t', `${dn(g.keep)} + ${p(g.add)}`, dn(g.h)],
    ];
  }
  function gruSheet({ net, upTo = 0, walk = 0 }) {
    const k = Math.max(upTo, walk);
    return { rows: GRU_ROWS, cols: ['equation', 'substitution', 'result'], values: gruRows(net).map((r, j) => [r[0], j < k ? r[1] : '', j < k ? r[2] : '']) };
  }
  const GRU_SAY = ['Reset gate', 'Update gate', 'Candidate', 'Kept old state', 'Share of new content', 'New hidden state'];
  // walk (patch gruWalk). roles: sheet
  function gruWalk({ net, from = 0, to = 6 }) {
    const rows = gruRows(net);
    const trace = [];
    for (let j = from; j < to; j++) trace.push({ label: `${GRU_SAY[j]}: $${rows[j][1]} = ${rows[j][2]}$.`, vars: { [GRU_ROWS[j]]: Number(rows[j][2]) }, patch: { gruWalk: j + 1 }, ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: `row:${GRU_ROWS[j]}`, tone: 'accent' } }] });
    return { trace };
  }
  // roles: none (code, formula)
  function gruCode({ z, hprev, ht }) {
    const r = gruUpdate({ z, hprev, ht });
    return {
      ...r,
      trace: [
        { label: `Keep: $z_t h_{t-1} = ${dn(z)}\\cdot${p(hprev)} = ${dn(r.keep)}$.`, code: 'keep', math: 'keep', vars: { keep: r.keep }, ops: [] },
        { label: `Replace the rest: $(1 - z_t)\\tilde h_t = ${dn(fix(1 - z))}\\cdot${p(ht)} = ${dn(r.add)}$.`, code: 'add', math: 'add', vars: { add: r.add }, ops: [] },
        { label: `Blend: $h_t = ${dn(r.keep)} + ${p(r.add)} = ${dn(r.h)}$.`, code: 'blend', math: 'blend', vars: { h: r.h }, ops: [] },
      ],
    };
  }

  // ------------------------------------------------------------ 4. gate retention and write / hold / overwrite
  function retain({ g, k }) { return { share: fix(g ** k), lost: fix(1 - g ** k) }; }
  function retainCurve({ x, g = 0.9 }) { return { y: g ** x }; }
  // m_t = g_t m_{t−1} + (1 − g_t) c_t; mode 'learned' uses the dataset's gates, a number uses a fixed gate
  function gated({ c, gates, fixedG }) {
    let m = 0;
    const ms = c.map((ct, t) => { const g = fixedG ?? gates[t]; m = g * m + (1 - g) * ct; return fix(m); });
    return { ms };
  }
  function gateDemo({ c, gates }) {
    const x = range(c.length).map((t) => t + 1);
    return {
      learned: gated({ c, gates }).ms, half: gated({ c, gates, fixedG: 0.5 }).ms, slow: gated({ c, gates, fixedG: 0.99 }).ms,
      series: [
        { name: 'input content c_t', x, y: c },
        { name: 'gate fixed at 0.5', x, y: gated({ c, gates, fixedG: 0.5 }).ms },
        { name: 'gate fixed at 0.99', x, y: gated({ c, gates, fixedG: 0.99 }).ms },
        { name: 'input-dependent gate', x, y: gated({ c, gates }).ms },
      ],
    };
  }
  // roles: none (code, formula)
  function retainCode({ g, k }) {
    const trace = [{ label: 'A stored value starts as 1.', code: 'init', math: 'init', vars: { share: 1 }, ops: [] }];
    let s = 1;
    for (let t = 1; t <= k; t++) {
      s *= g;
      if (t <= 4 || t === k) trace.push({ label: `Step ${t}: keep the share $g = ${dn(g)}$ of it: $${dn(s, 6)}$.`, code: 'keep', math: 'keep', vars: { t, share: fix(s) }, ops: [] });
    }
    trace.push({ label: `After ${k} steps: $${dn(g)}^{${k}} = ${dn(s, 6)}$.`, code: 'out', math: 'out', vars: { share: fix(s) }, ops: [] });
    return { share: fix(s), trace };
  }

  // ------------------------------------------------------------ 5. parameter counts (notebook section 3)
  const BLOCKS = { rnn: 1, gru: 3, lstm: 4 };
  function gatedParams({ d, m, kind, torch = true }) {
    const b = BLOCKS[kind];
    const perBlock = m * (d + m) + (torch ? 2 * m : m);
    return { blocks: b, perBlock, params: b * perBlock, textbook: b * m * (d + m + 1) };
  }
  function paramTable({ d, m, extra = 0 }) {
    const kinds = ['rnn', 'lstm', 'gru'];
    const vals = kinds.map((k) => gatedParams({ d, m, kind: k }));
    return { rnn: vals[0].params, lstm: vals[1].params, gru: vals[2].params, grid: { rows: kinds, cols: ['blocks', 'recurrent', 'total'], values: vals.map((v) => [v.blocks, v.params, v.params + extra]) } };
  }
  // roles: none (code, formula)
  function paramsCode({ d, m, kind }) {
    const r = gatedParams({ d, m, kind });
    return {
      ...r,
      trace: [
        { label: `One block: $W_x$ is $${m}\\times${d}$ and $W_h$ is $${m}\\times${m}$: $${m}(${d} + ${m}) = ${m * (d + m)}$ weights.`, code: 'w', math: 'w', vars: { weights: m * (d + m) }, ops: [] },
        { label: `Plus PyTorch's two bias vectors: $+ 2\\cdot${m}$, so $${r.perBlock}$ per block.`, code: 'b', math: 'b', vars: { per_block: r.perBlock }, ops: [] },
        { label: `${kind.toUpperCase()} has ${r.blocks} block${r.blocks > 1 ? 's' : ''}: $${r.blocks}\\cdot${r.perBlock} = ${comma(r.params)}$.`, code: 'blocks', math: 'blocks', vars: { params: r.params }, ops: [] },
      ],
    };
  }

  // ------------------------------------------------------------ 6. the comparison (notebook section 4)
  // table columns: model, recurrent, total, best_val_acc, best_epoch, time
  function compare({ table, base = 'RNN' }) {
    const rows = table.rows;
    const b = rows.find((r) => r[0] === base);
    const out = rows.map((r) => ({ model: r[0], accGain: fix(r[3] - b[3]), timeRatio: fix(r[5] / b[5]), paramRatio: fix(r[1] / b[1]) }));
    const best = rows.reduce((a, r) => (r[3] > a[3] ? r : a));
    return { out, best: best[0], bestAcc: best[3], grid: { rows: out.map((o) => o.model), cols: ['acc_gain', 'param_ratio', 'time_ratio'], values: out.map((o) => [o.accGain, o.paramRatio, o.timeRatio]) } };
  }
  function tableGrid({ table }) {
    return { rows: table.rows.map((r) => String(r[0])), cols: table.columns.slice(1), values: table.rows.map((r) => r.slice(1)) };
  }
  // per-epoch validation accuracy: table rows [epoch, rnn, lstm, gru]
  function curves({ table }) {
    const ep = table.rows.map((r) => r[0]);
    return { series: table.columns.slice(1).map((name, j) => ({ name, x: ep, y: table.rows.map((r) => r[j + 1]) })) };
  }
  // roles: none (code, formula)
  function compareCode({ table, base = 'RNN' }) {
    const rows = table.rows;
    const b = rows.find((r) => r[0] === base);
    const trace = [{ label: `Baseline ${base}: accuracy $${dn(b[3])}$, ${b[1]} recurrent parameters, $${dn(b[5])}$ s.`, code: 'base', math: 'base', vars: { acc: b[3] }, ops: [] }];
    rows.filter((r) => r[0] !== base).forEach((r) => {
      trace.push({ label: `${r[0]}: gain $${dn(r[3])} - ${dn(b[3])} = ${dn(fix(r[3] - b[3]))}$; time $${dn(r[5])}/${dn(b[5])} = ${dn(fix(r[5] / b[5]), 2)}\\times$.`, code: 'row', math: 'row', vars: { model: r[0], gain: fix(r[3] - b[3]), time_ratio: fix(r[5] / b[5]) }, ops: [] });
    });
    return { trace };
  }

  // ------------------------------------------------------------ 7. residual shortcut (ResNet)
  // y = F(x) + x ⇒ dy/dx = F'(x) + 1; L blocks in a row multiply these
  function residual({ dF, L = 1 }) {
    return { plain: fix(dF ** L), res: fix((dF + 1) ** L), one: fix(dF + 1) };
  }
  // roles: none (code, formula)
  function residualCode({ dF, L }) {
    const trace = [{ label: `Each block's layers have slope $F'(x) = ${dn(dF)}$.`, code: 'slope', math: 'slope', vars: { dF }, ops: [] }];
    let pl = 1, rs = 1;
    for (let l = 1; l <= L; l++) {
      pl *= dF; rs *= dF + 1;
      trace.push({ label: `Block ${l}: plain $${dn(pl, 6)}$; with the shortcut $\\times(${dn(dF)} + 1)$: $${dn(rs, 6)}$.`, code: 'mult', math: 'mult', vars: { block: l, plain: fix(pl), residual: fix(rs) }, ops: [] });
    }
    return { plain: fix(pl), res: fix(rs), trace };
  }

  // ------------------------------------------------------------ 8. self-attention on a tiny sentence
  // score_ij = q_i · k_j; weights = softmax over j; output = Σ_j w_ij v_j (real Transformers also divide by √d)
  function attention({ Q, K, V, i = 0 }) {
    const scores = K.map((k) => fix(Q[i].reduce((a, q, d) => a + q * k[d], 0)));
    const ex = scores.map((s) => Math.exp(s));
    const Z = ex.reduce((a, b) => a + b, 0);
    const w = ex.map((e) => fix(e / Z));
    const out = V[0].map((_, d) => fix(V.reduce((a, v, j) => a + w[j] * v[d], 0)));
    const plainW = (() => { const s = scores.reduce((a, b) => a + b, 0); return scores.map((x) => fix(x / s)); })();
    return { scores, exps: ex.map(fix), Z: fix(Z), w, out, plainW, uniform: fix(1 / K.length) };
  }
  function attnSheet({ Q, K, V, words, i = 0, upTo = 0, walk = 0 }) {
    const r = attention({ Q, K, V, i });
    const k = Math.max(upTo, walk);
    return { rows: words, cols: ['score', 'exp', 'weight'], values: words.map((_, j) => [j < k ? r.scores[j] : '', j < k ? dn(r.exps[j], 3) : '', j < k && k > words.length ? dn(r.w[j], 3) : '']) };
  }
  // walk (patch attnWalk): scores and exps word by word, then the weights. roles: sheet
  function attnWalk({ Q, K, V, words, i = 0 }) {
    const r = attention({ Q, K, V, i });
    const trace = [];
    words.forEach((w, j) => {
      trace.push({ label: `"${w}": score $${Q[i].map((q, d) => `${dn(q)}\\cdot${dn(K[j][d])}`).join(' + ')} = ${dn(r.scores[j])}$, $e^{${dn(r.scores[j])}} = ${dn(r.exps[j], 3)}$.`, vars: { word: w, score: r.scores[j] }, patch: { attnWalk: j + 1 }, ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: `row:${w}`, tone: 'accent' } }] });
    });
    trace.push({ label: `Divide each by the total $${dn(r.Z, 3)}$: weights ${r.w.map((x) => dn(x, 3)).join(', ')}.`, vars: { total: r.Z }, patch: { attnWalk: words.length + 1 }, ops: [] });
    return { trace, w: r.w };
  }
  // roles: none (code, formula)
  function attnCode({ Q, K, V, i = 0 }) {
    const r = attention({ Q, K, V, i });
    const trace = [];
    r.scores.forEach((s, j) => trace.push({ label: `Position ${j}: score $q\\cdot k_${j} = ${dn(s)}$.`, code: 'score', math: 'score', vars: { j, score: s }, ops: [] }));
    trace.push({ label: `Softmax: $e^{s_j}/\\sum e^{s} \\Rightarrow$ ${r.w.map((x) => dn(x, 3)).join(', ')}.`, code: 'soft', math: 'soft', vars: { weights: r.w }, ops: [] });
    trace.push({ label: `Output: weighted average of the values $= [${r.out.map((x) => dn(x, 3)).join(', ')}]$.`, code: 'mix', math: 'mix', vars: { out: r.out }, ops: [] });
    return { ...r, trace };
  }
  // how far apart two positions are, and how many comparisons attention makes
  function pathLength({ T }) { return { rnnSteps: T - 1, attnSteps: 1, pairs: T * T }; }

  // ------------------------------------------------------------ generators
  const pickG = (rng) => rng.pick([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]);
  function lstmQ({ rng, difficulty }) {
    for (;;) {
      const cprev = rng.pick([-0.8, -0.5, 0.4, 0.6, 1, 1.5]), f = pickG(rng), i = pickG(rng), ct = rng.pick([-0.9, -0.5, 0.3, 0.5, 0.8]), o = pickG(rng);
      const r = lstmUpdate({ cprev, f, i, ct, o });
      const noForget = fix(cprev + i * ct), replace = fix(i * ct), noTanh = fix(o * r.C), swapFI = fix(i * cprev + f * ct);
      if ([noForget, replace, swapFI].some((v) => Math.abs(v - r.C) < 0.03)) continue;
      if (Math.abs(noTanh - r.h) < 0.03 || Math.abs(r.C) < 0.05) continue;
      void difficulty;
      return {
        vars: { cprev, f, i, ct, o, C: r.C, h: r.h, keep: r.keep, write: r.write, tanhC: r.tanhC, noForget, replace, noTanh, swapFI,
          errSteps: [`Kept memory $f_t C_{t-1} = ${dn(f)}\\cdot${p(cprev)} = ${dn(r.keep)}$`, `Written memory $i_t \\tilde C_t = ${dn(i)}\\cdot${p(ct)} = ${dn(r.write)}$`, `$C_t = ${dn(r.keep)} + ${p(r.write)} = ${dn(r.C)}$`, `$h_t = o_t C_t = ${dn(o)}\\cdot${p(r.C)} = ${dn(noTanh)}$`] },
        misconceptions: [
          { var: 'noForget', for: 'C', feedback: 'The forget gate **scales** the old memory: use $f_t C_{t-1}$, not $C_{t-1}$.' },
          { var: 'replace', for: 'C', feedback: 'The old memory is not thrown away: $C_t = f_t C_{t-1} + i_t \\tilde C_t$.' },
          { var: 'swapFI', for: 'C', feedback: 'The forget gate multiplies the **old** memory; the input gate multiplies the **candidate**.' },
          { var: 'noTanh', for: 'h', feedback: 'The output gate multiplies $\\tanh(C_t)$, not $C_t$ itself.' },
          { var: 'C', for: 'h', feedback: 'That is the cell state. The hidden state is $o_t \\tanh(C_t)$.' },
        ],
      };
    }
  }

  function gruQ({ rng, difficulty }) {
    for (;;) {
      if (difficulty === 3) {
        const W = { r: [rng.pick([0.5, 1, -1]), rng.pick([0.5, 1]), 0], z: [rng.pick([0.5, -0.5, 1]), rng.pick([1, 0.5]), rng.pick([0, 0.5])], h: [rng.pick([1, 0.5, -1]), rng.pick([1, 2, -1]), 0] };
        const x = rng.pick([1, -1, 0.5]), hprev = rng.pick([0.5, -0.5, 0.8]);
        const g = gruStep({ x, hprev, W });
        if (Math.abs(g.noReset - g.ht) < 0.03 || Math.abs(g.swapped - g.h) < 0.03) continue;
        return {
          vars: { x, hprev, W, r: g.r, z: g.z, ht: g.ht, h: g.h, keep: g.keep, add: g.add, swapped: g.swapped, noReset: g.noReset, zr: g.zr, zz: g.zz, zh: g.zh,
            grid: { rows: ['reset', 'update', 'candidate'], cols: ['w_x', 'u_h', 'b'], values: [W.r, W.z, W.h] } },
          misconceptions: [
            { var: 'noReset', for: 'ht', feedback: 'The candidate reads the **reset-scaled** past, $r_t h_{t-1}$, not $h_{t-1}$.' },
            { var: 'swapped', for: 'h', feedback: 'In this course (Cho et al., PyTorch) $z_t$ is the share of the **old** state kept: $h_t = z_t h_{t-1} + (1 - z_t)\\tilde h_t$.' },
          ],
        };
      }
      const z = pickG(rng), hprev = rng.pick([-0.6, -0.4, 0.3, 0.5, 0.9]), ht = rng.pick([-0.8, -0.4, 0.2, 0.6, 0.7]);
      const r = gruUpdate({ z, hprev, ht });
      const noOneMinus = fix(z * hprev + ht), mean = fix((hprev + ht) / 2);
      if ([r.swapped, noOneMinus, mean].some((v) => Math.abs(v - r.h) < 0.03)) continue;
      return {
        vars: { z, hprev, ht, h: r.h, keep: r.keep, add: r.add, swapped: r.swapped, noOneMinus, mean, oneMinus: fix(1 - z) },
        misconceptions: [
          { var: 'swapped', for: 'h', feedback: 'In this course (Cho et al., PyTorch) $z_t$ is the share of the **old** state kept: $h_t = z_t h_{t-1} + (1 - z_t)\\tilde h_t$.' },
          { var: 'noOneMinus', for: 'h', feedback: 'The candidate gets the **rest** of the weight, $1 - z_t$: the new state is a weighted average.' },
          { var: 'mean', for: 'h', feedback: 'That is a plain average. The update gate sets the weights: $z_t$ and $1 - z_t$.' },
        ],
      };
    }
  }

  function retainQ({ rng }) {
    for (;;) {
      const g = rng.pick([0.5, 0.8, 0.9, 0.95, 0.99]), k = rng.pick([5, 10, 20, 50]);
      const share = g ** k;
      if (share < 0.001) continue;
      const times = fix(g * k), linear = fix(1 - (1 - g) * k);
      if (Math.abs(linear - share) < 0.02 || Math.abs(times - share) < 0.02) continue;
      return {
        vars: { g, k, share: fix(share), sharePct: fix(share * 100), times, linear, lostPct: fix((1 - share) * 100) },
        misconceptions: [
          { var: 'times', for: 'share', feedback: 'The gate is applied once per step: $g^k$, not $g\\times k$.' },
          { var: 'linear', for: 'share', feedback: 'Each step keeps a **share** of what is left, so losses compound: $g^k$, not $1 - k(1-g)$.' },
        ],
      };
    }
  }

  function chainQ({ rng }) {
    for (;;) {
      const w = rng.pick([0.5, 0.8, 0.9, 1.1, 1.2]), k = rng.pick([5, 10, 20]), slope = rng.pick([1, 1, 0.9]);
      const v = (w * slope) ** k;
      if (v < 0.0005 || v > 100) continue;
      const times = fix(w * slope * k), noSlope = fix(w ** k);
      if (Math.abs(times - v) < 0.05 * Math.max(1, v)) continue;
      if (slope !== 1 && Math.abs(noSlope - v) < 0.02 * Math.max(1, v)) continue;
      return {
        vars: { w, k, slope, v: fix(v), times, noSlope, kindIdx: w * slope < 1 ? 0 : 1, factor: fix(w * slope) },
        misconceptions: [
          { var: 'times', for: 'v', feedback: 'The factor is applied $k$ times in a row: raise it to the power $k$.' },
          ...(slope !== 1 ? [{ var: 'noSlope', for: 'v', feedback: 'Each step also multiplies by the tanh slope.' }] : [{ value: fix(1 / v), for: 'v', feedback: 'Going back multiplies by the factor; it does not divide.' }]),
        ],
      };
    }
  }

  function paramQ({ rng, difficulty }) {
    for (;;) {
      const d = rng.pick([1, 8, 16, 32, 64, 100]), m = rng.pick([16, 32, 64, 128]);
      const kind = difficulty === 1 ? 'lstm' : rng.pick(['lstm', 'gru']);
      if (d === 32 && m === 32) continue;
      const r = gatedParams({ d, m, kind, torch: false });
      const wrongBlocks = gatedParams({ d, m, kind: kind === 'lstm' ? 'gru' : 'lstm', torch: false }).params;
      const noWh = BLOCKS[kind] * m * (d + 1), oneBlock = m * (d + m + 1);
      return {
        vars: { d, m, kind: kind.toUpperCase(), blocks: BLOCKS[kind], params: r.params, perBlock: m * (d + m + 1), wrongBlocks, noWh, oneBlock, torchParams: gatedParams({ d, m, kind }).params,
          errSteps: [`One block: $W_x$ is $${m}\\times${d}$, $W_h$ is $${m}\\times${m}$, plus ${m} biases: $${m * (d + m + 1)}$`, `${kind === 'lstm' ? 'An LSTM' : 'A GRU'} has ${BLOCKS[kind] === 4 ? 3 : 4} blocks`, `Total $${BLOCKS[kind] === 4 ? 3 : 4}\\cdot${m * (d + m + 1)} = ${wrongBlocks}$`] },
        misconceptions: [
          { var: 'wrongBlocks', for: 'params', feedback: 'LSTM has **4** blocks (forget, input, candidate, output); GRU has **3** (reset, update, candidate).' },
          { var: 'noWh', for: 'params', feedback: 'Every block also reads $h_{t-1}$: add the $m\\times m$ recurrent weights.' },
          { var: 'oneBlock', for: 'params', feedback: 'That is one block, a vanilla RNN. Multiply by the number of gated blocks.' },
        ],
      };
    }
  }

  function residualQ({ rng }) {
    for (;;) {
      const dF = rng.pick([0.05, 0.1, 0.2, -0.1, -0.2]), L = rng.pick([2, 3]);
      const r = residual({ dF, L });
      if (Math.abs(r.res - r.plain) < 0.05) continue;
      if (Math.abs(fix(dF * L + 1) - r.res) < 0.005) continue;
      return {
        vars: { dF, L, res: r.res, plain: r.plain, one: r.one },
        misconceptions: [
          { var: 'plain', for: 'res', feedback: 'That is the network **without** shortcuts. With $y = F(x) + x$ each block contributes $F\'(x) + 1$.' },
          { value: fix(dF * L + 1), for: 'res', feedback: 'Blocks in a row **multiply** their derivatives: $(F\'(x) + 1)^L$.' },
        ],
      };
    }
  }

  function attnQ({ rng, difficulty }) {
    for (;;) {
      const q = [rng.pick([1, 0, -1]), rng.pick([1, 0.5, -0.5])];
      const K = range(3).map(() => [rng.pick([1, 0, -1, 0.5]), rng.pick([1, 0, -1])]);
      const V = range(3).map(() => [rng.pick([1, 0, 2, -1])]);
      const r = attention({ Q: [q], K, V });
      const j = rng.int(0, 2);
      if (new Set(r.scores).size < 3 || r.scores.every((s) => s === 0)) continue;
      const w = r.w[j];
      if (Math.abs(r.uniform - w) < 0.03 || Math.abs(r.plainW[j] - w) < 0.03 || !Number.isFinite(r.plainW[j])) continue;
      if (difficulty === 3 && Math.abs(r.out[0] - V.reduce((a, v) => a + v[0], 0) / 3) < 0.05) continue;
      if (difficulty === 3 && Math.abs(r.out[0] - r.plainW.reduce((a, pw, k) => a + pw * V[k][0], 0)) < 0.02) continue;
      return {
        vars: { q, K, V, scores: r.scores, w, wAll: r.w, j, jName: `w${j + 1}`, out: r.out[0], uniform: r.uniform, plainW: r.plainW[j], Z: r.Z, exps: r.exps, meanV: fix(V.reduce((a, v) => a + v[0], 0) / 3), outPlain: fix(r.plainW.reduce((a, pw, k) => a + pw * V[k][0], 0)),
          grid: { rows: ['w1', 'w2', 'w3'], cols: ['k_1', 'k_2', 'v'], values: K.map((k, i) => [k[0], k[1], V[i][0]]) } },
        misconceptions: [
          { var: 'uniform', for: 'w', feedback: 'Attention weights are not equal: they come from a softmax of the scores.' },
          { var: 'plainW', for: 'w', feedback: 'Exponentiate the scores first (softmax): $e^{s_j} / \\sum_k e^{s_k}$.' },
          { var: 'meanV', for: 'out', feedback: 'That is a plain average. Weight each value by its attention weight.' },
          { var: 'outPlain', for: 'out', feedback: 'Those weights skip the softmax. Exponentiate the scores before normalizing.' },
        ],
      };
    }
  }

  function pathQ({ rng }) {
    const T = rng.pick([50, 100, 200, 500, 1000]);
    const r = pathLength({ T });
    return { vars: { T, rnnSteps: r.rnnSteps, pairs: r.pairs, double: 2 * T, Tsq4: 4 * r.pairs }, misconceptions: [
      { var: 'double', for: 'pairs', feedback: 'Every position compares itself with **every** position: $T\\times T$, not $2T$.' },
      { var: 'T', for: 'pairs', feedback: 'Each of the $T$ positions makes $T$ comparisons: $T^2$.' },
    ] };
  }

  return {
    fns: {
      chainFactor, fadeCurve, fadeTable, chainCode, lstmUpdate, lstmStep, lstmSheet, lstmWalk, lstmCode,
      gruUpdate, gruStep, gruSheet, gruWalk, gruCode, retain, retainCurve, gated, gateDemo, retainCode,
      gatedParams, paramTable, paramsCode, compare, tableGrid, curves, compareCode, residual, residualCode,
      attention, attnSheet, attnWalk, attnCode, pathLength,
    },
    generators: { lstmQ, gruQ, retainQ, chainQ, paramQ, residualQ, attnQ, pathQ },
  };
}
