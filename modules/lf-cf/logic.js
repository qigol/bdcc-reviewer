// Kodigo module: lf-cf (Latent-factor Collaborative Filtering: ALS and coordinate descent)
// Conventions (see SOURCE_NOTES.md):
//  - R ≈ P = U·V with U m×d (users × factors) and V d×n (factors × items), as on the slides
//  - SSE is summed over OBSERVED cells only
//  - ALS: freeze one factor matrix and solve an ordinary least-squares problem per row/column.
//    When the problem is rank-deficient (e.g. U = all ones) we take the minimum-norm solution,
//    which splits evenly: this is exactly the slides' V = column-mean/2 and U row 1 = 1.0988…
//  - Coordinate descent updates ONE entry with its closed form (slide 15)
//  - Optional λ (ridge) regularization is beyond the slides
export default function register(sdk) {
  const { lstsq, solve, transpose } = sdk;

  const mat = (rows, cols, values) => ({ rows, cols, values });
  const factorNames = (d) => Array.from({ length: d }, (_, s) => `f${s + 1}`);
  function ones(m, n) { return Array.from({ length: m }, () => Array(n).fill(1)); }
  // tiny deterministic generator for "random" initialisation (seeded, pure)
  function seeded(seed) {
    let a = seed >>> 0 || 1;
    return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  }
  function init({ R, d = 2, kind = 'ones', seed = 7, scale = 1 }) {
    const m = R.rows.length, n = R.cols.length;
    const f = factorNames(d);
    if (kind === 'ones') return { U: mat(R.rows, f, ones(m, d)), V: mat(f, R.cols, ones(d, n)) };
    const rnd = seeded(seed);
    const U = Array.from({ length: m }, () => Array.from({ length: d }, () => +(0.5 + rnd() * scale).toFixed(2)));
    const V = Array.from({ length: d }, () => Array.from({ length: n }, () => +(0.5 + rnd() * scale).toFixed(2)));
    return { U: mat(R.rows, f, U), V: mat(f, R.cols, V) };
  }

  function product({ U, V }) {
    const m = U.values.length, d = U.values[0].length, n = V.values[0].length;
    const P = Array.from({ length: m }, (_, i) => Array.from({ length: n }, (_, j) => {
      let s = 0;
      for (let t = 0; t < d; t++) s += U.values[i][t] * V.values[t][j];
      return s;
    }));
    return { P: mat(U.rows, V.cols, P), values: P };
  }

  function sse({ R, U, V }) {
    const { values: P } = product({ U, V });
    let total = 0, count = 0;
    const err = R.values.map((row, i) => row.map((r, j) => {
      if (r === null || r === undefined) return null;
      const e = r - P[i][j];
      total += e * e;
      count++;
      return e;
    }));
    return { sse: total, observed: count, rmse: Math.sqrt(total / Math.max(1, count)), errors: mat(R.rows, R.cols, err), P: mat(R.rows, R.cols, P) };
  }

  // Solve for V with U frozen (one least-squares problem per item column)
  // roles: product (MatrixProduct), code, formula
  function alsStepV({ R, U, lambda = 0 }) {
    const d = U.values[0].length;
    const V = Array.from({ length: d }, () => Array(R.cols.length).fill(0));
    const trace = [];
    R.cols.forEach((c, j) => {
      const obs = R.values.map((row, i) => i).filter((i) => R.values[i][j] !== null);
      const A = obs.map((i) => U.values[i]);
      const b = obs.map((i) => R.values[i][j]);
      const v = ridge(A, b, lambda);
      v.forEach((x, s) => (V[s][j] = x));
      trace.push({ label: `Item ${c}: least squares over ${obs.length} observed ratings → v = (${v.map((x) => +x.toFixed(3)).join(', ')})`, code: 'solve', math: 'solve', vars: { v } });
    });
    return { V: mat(factorNames(d), R.cols, V), trace };
  }

  // Solve for U with V frozen (one least-squares problem per user row)
  function alsStepU({ R, V, lambda = 0 }) {
    const d = V.values.length;
    const U = Array.from({ length: R.rows.length }, () => Array(d).fill(0));
    const trace = [];
    R.rows.forEach((r, i) => {
      const obs = R.cols.map((_, j) => j).filter((j) => R.values[i][j] !== null);
      const A = obs.map((j) => V.values.map((row) => row[j]));
      const b = obs.map((j) => R.values[i][j]);
      const u = ridge(A, b, lambda);
      U[i] = u;
      trace.push({ label: `User ${r}: least squares over ${obs.length} ratings → u = (${u.map((x) => +x.toFixed(4)).join(', ')})`, code: 'solve', math: 'solve', vars: { u } });
    });
    return { U: mat(R.rows, factorNames(d), U), trace };
  }

  function ridge(A, b, lambda) {
    if (!A.length) return Array(A[0] ? A[0].length : 0).fill(0);
    if (!lambda) return lstsq(A, b);
    const At = transpose(A);
    const d = A[0].length;
    const AtA = At.map((row, p) => At.map((col) => row.reduce((s, x, k) => s + x * col[k], 0)).map((x, q) => x + (p === q ? lambda : 0)));
    const Atb = At.map((row) => row.reduce((s, x, k) => s + x * b[k], 0));
    return solve(AtA, Atb.slice(0, d));
  }

  // Alternating least squares. roles: product (MatrixProduct), sse (Chart), code, formula
  function als({ R, U0, V0, d = 2, iters = 5, lambda = 0, initKind = 'ones', seed = 7, startWith = 'V' }) {
    const start = U0 && V0 ? { U: U0, V: V0 } : init({ R, d, kind: initKind, seed });
    let U = start.U, V = start.V;
    const history = [sse({ R, U, V }).sse];
    const trace = [{ label: `Start: U = ${initKind === 'ones' ? 'all ones' : 'random'}, SSE = ${+history[0].toFixed(2)}`, code: 'init', math: 'init', patch: { U, V }, vars: { sse: history[0] } }];
    const steps = [];
    for (let it = 0; it < iters; it++) {
      for (const half of startWith === 'V' ? ['V', 'U'] : ['U', 'V']) {
        if (half === 'V') V = alsStepV({ R, U, lambda }).V; else U = alsStepU({ R, V, lambda }).U;
        const s = sse({ R, U, V }).sse;
        history.push(s);
        steps.push({ half, U, V, sse: s });
        trace.push({ label: `Iteration ${it + 1}: freeze ${half === 'V' ? 'U' : 'V'}, solve ${half} → SSE = ${+s.toFixed(3)}`, code: half === 'V' ? 'solve-v' : 'solve-u', math: half === 'V' ? 'solve-v' : 'solve-u', patch: { U, V }, vars: { sse: s } });
      }
    }
    const symmetric = U.values.every((row) => row.every((x) => Math.abs(x - row[0]) < 1e-9)) && V.values.every((row) => row.every((x, j) => Math.abs(x - V.values[0][j]) < 1e-9));
    const fin = sse({ R, U, V });
    return {
      U, V, P: fin.P, sse: fin.sse, rmse: fin.rmse, history, symmetric, steps,
      first: steps[0] ? { V: steps[0].V, U: steps[1] ? steps[1].U : null } : null,
      series: [{ name: 'SSE (ALS)', x: history.map((_, i) => i / 2), y: history }],
      trace,
    };
  }

  // Closed-form update of ONE entry (slide 15). which = 'U' (u_{i,s}) or 'V' (v_{s,j})
  // roles: product (MatrixProduct), code, formula
  function cgdUpdate({ R, U, V, which = 'U', i = 0, s = 0, j = 0 }) {
    const d = U.values[0].length;
    let num = 0, den = 0;
    const terms = [];
    if (which === 'U') {
      for (let jj = 0; jj < R.cols.length; jj++) {
        const r = R.values[i][jj];
        if (r === null) continue;
        let rest = 0;
        for (let t = 0; t < d; t++) if (t !== s) rest += U.values[i][t] * V.values[t][jj];
        num += V.values[s][jj] * (r - rest);
        den += V.values[s][jj] * V.values[s][jj];
        terms.push({ col: R.cols[jj], r, rest, v: V.values[s][jj] });
      }
    } else {
      for (let ii = 0; ii < R.rows.length; ii++) {
        const r = R.values[ii][j];
        if (r === null) continue;
        let rest = 0;
        for (let t = 0; t < d; t++) if (t !== s) rest += U.values[ii][t] * V.values[t][j];
        num += U.values[ii][s] * (r - rest);
        den += U.values[ii][s] * U.values[ii][s];
        terms.push({ row: R.rows[ii], r, rest, u: U.values[ii][s] });
      }
    }
    const value = den === 0 ? 0 : num / den;
    const U2 = { ...U, values: U.values.map((row) => row.slice()) };
    const V2 = { ...V, values: V.values.map((row) => row.slice()) };
    if (which === 'U') U2.values[i][s] = value; else V2.values[s][j] = value;
    const before = sse({ R, U, V }).sse;
    const after = sse({ R, U: U2, V: V2 }).sse;
    const name = which === 'U' ? `u_${i + 1}${s + 1}` : `v_${s + 1}${j + 1}`;
    return {
      value, num, den, U: U2, V: V2, sseBefore: before, sseAfter: after, terms,
      trace: [
        { label: `Freeze every entry except ${name}; the SSE becomes a parabola in it`, code: 'freeze', math: 'freeze', ops: [{ role: 'product', cmd: 'highlight', args: { sel: which === 'U' ? `U:${i},${s}` : `V:${s},${j}`, tone: 'warn' } }] },
        { label: `Numerator Σ (factor)·(r − rest) = ${+num.toFixed(3)}`, code: 'num', math: 'num', vars: { num } },
        { label: `Denominator Σ (factor)² = ${+den.toFixed(3)}`, code: 'den', math: 'den', vars: { den } },
        { label: `${name} = ${+num.toFixed(3)} / ${+den.toFixed(3)} = ${+value.toFixed(4)}; SSE ${+before.toFixed(2)} → ${+after.toFixed(2)}`, code: 'update', math: 'update', vars: { value }, patch: { U: U2, V: V2 } },
      ],
    };
  }

  // SSE as a function of one entry (for FunctionPlot): returns { y }
  function sseEntry({ R, U, V, which = 'U', i = 0, s = 0, j = 0, x }) {
    const U2 = { ...U, values: U.values.map((row) => row.slice()) };
    const V2 = { ...V, values: V.values.map((row) => row.slice()) };
    if (which === 'U') U2.values[i][s] = x; else V2.values[s][j] = x;
    return { y: sse({ R, U: U2, V: V2 }).sse };
  }

  // The lecture's CGD walk-through: U = V = ones, update u11 (x) then v11 (y)
  function cgdLecture({ R }) {
    const st = init({ R, d: 2, kind: 'ones' });
    const a = cgdUpdate({ R, U: st.U, V: st.V, which: 'U', i: 0, s: 0 });
    const b = cgdUpdate({ R, U: a.U, V: a.V, which: 'V', s: 0, j: 0 });
    return { x: a.value, y: b.value, U1: a.U, V1: a.V, U2: b.U, V2: b.V, U0: st.U, V0: st.V, sse0: a.sseBefore, sse1: a.sseAfter, sse2: b.sseAfter,
      trace: [...a.trace.map((t) => ({ ...t, label: 'x: ' + t.label })), ...b.trace.map((t) => ({ ...t, label: 'y: ' + t.label }))] };
  }

  // Full coordinate descent sweeps (every entry of U then of V, once per sweep)
  function cgdRun({ R, d = 2, sweeps = 5, initKind = 'ones', seed = 7 }) {
    let { U, V } = init({ R, d, kind: initKind, seed });
    const history = [sse({ R, U, V }).sse];
    for (let sw = 0; sw < sweeps; sw++) {
      for (let i = 0; i < R.rows.length; i++) for (let s = 0; s < d; s++) ({ U, V } = cgdUpdate({ R, U, V, which: 'U', i, s }));
      for (let s = 0; s < d; s++) for (let j = 0; j < R.cols.length; j++) ({ U, V } = cgdUpdate({ R, U, V, which: 'V', s, j }));
      history.push(sse({ R, U, V }).sse);
    }
    return { U, V, history, sse: history[history.length - 1], series: [{ name: 'SSE (coordinate descent)', x: history.map((_, i) => i), y: history }] };
  }

  // Predictions for the missing cells
  function fillMissing({ R, U, V }) {
    const { values: P } = product({ U, V });
    const filled = R.values.map((row, i) => row.map((r, j) => (r === null ? P[i][j] : r)));
    const missing = [];
    R.values.forEach((row, i) => row.forEach((r, j) => { if (r === null) missing.push({ row: R.rows[i], col: R.cols[j], value: P[i][j] }); }));
    return { filled: mat(R.rows, R.cols, filled), missing, P: mat(R.rows, R.cols, P), text: missing.map((m) => `${m.row}·${m.col} ≈ ${+m.value.toFixed(2)}`).join(', ') };
  }

  // Train and recommend on a larger matrix (Application): random init, ridge ALS
  function trainRecommend({ R, d = 2, lambda = 0.1, iters = 15, seed = 3, user }) {
    const r = als({ R, d, iters, lambda, initKind: 'random', seed });
    const f = fillMissing({ R, U: r.U, V: r.V });
    const ui = R.rows.indexOf(user);
    const recs = ui < 0 ? [] : R.cols.map((c, j) => ({ item: c, rating: R.values[ui][j] === null ? f.P.values[ui][j] : null })).filter((x) => x.rating !== null).sort((a, b) => b.rating - a.rating);
    return {
      U: r.U, V: r.V, sse: r.sse, rmse: r.rmse, history: r.history, series: r.series,
      filled: f.filled, P: f.P, recs, text: recs.map((x) => `${x.item} (${x.rating.toFixed(1)})`).join(', ') || 'none',
      factors: mat(R.rows, r.U.cols, r.U.values), itemFactors: mat(R.cols, r.V.rows, transpose(r.V.values)),
      table: { rows: recs.map((x) => x.item), cols: ['predicted'], values: recs.map((x) => [x.rating]) },
    };
  }

  // Hold out some of a user's ratings; compare ALS with a simple user-based CF (centered cosine, k = 2)
  function holdoutCompare({ R, user, hide, d = 2, lambda = 0.1, iters = 15, seed = 3 }) {
    const ui = R.rows.indexOf(user);
    const masked = mat(R.rows, R.cols, R.values.map((row, i) => row.map((x, j) => (i === ui && hide.includes(R.cols[j]) ? null : x))));
    const truth = Object.fromEntries(hide.map((it) => [it, R.values[ui][R.cols.indexOf(it)]]));
    const a = als({ R: masked, d, iters, lambda, initKind: 'random', seed });
    const Pa = product({ U: a.U, V: a.V }).values;
    const alsPred = Object.fromEntries(hide.map((it) => [it, Pa[ui][R.cols.indexOf(it)]]));
    const nbPred = Object.fromEntries(hide.map((it) => [it, ubcf(masked, ui, R.cols.indexOf(it), 2)]));
    const rank = (pred) => hide.slice().sort((x, y) => (pred[y] ?? -Infinity) - (pred[x] ?? -Infinity) || (x < y ? -1 : 1));
    const nd = (order) => {
      const g = (id, i) => (Math.pow(2, truth[id]) - 1) / Math.log2(i + 2);
      const dcg = order.reduce((s, id, i) => s + g(id, i), 0);
      const ideal = hide.slice().sort((x, y) => truth[y] - truth[x]);
      const idcg = ideal.reduce((s, id, i) => s + g(id, i), 0);
      return idcg ? dcg / idcg : 0;
    };
    return {
      truth, alsPred, nbPred, alsOrder: rank(alsPred), nbOrder: rank(nbPred), ndcgALS: nd(rank(alsPred)), ndcgNB: nd(rank(nbPred)),
      table: { rows: hide, cols: ['actual', 'ALS', 'user-based CF'], values: hide.map((it) => [truth[it], alsPred[it], nbPred[it]]) },
    };
  }
  function ubcf(M, ui, j, k) {
    const mu = M.values.map((row) => { const o = row.filter((x) => x !== null); return o.length ? o.reduce((a, b) => a + b, 0) / o.length : null; });
    const C = M.values.map((row, i) => row.map((x) => (x === null ? null : x - mu[i])));
    const simOf = (a, b) => {
      const idx = C[a].map((_, q) => q).filter((q) => C[a][q] !== null && C[b][q] !== null);
      const dot = idx.reduce((s, q) => s + C[a][q] * C[b][q], 0);
      const na = Math.sqrt(idx.reduce((s, q) => s + C[a][q] ** 2, 0)), nb = Math.sqrt(idx.reduce((s, q) => s + C[b][q] ** 2, 0));
      return na && nb ? dot / (na * nb) : 0;
    };
    const cands = M.rows.map((_, p) => p).filter((p) => p !== ui && C[p][j] !== null).map((p) => ({ p, sim: simOf(ui, p) })).sort((a, b) => b.sim - a.sim).slice(0, k).filter((c) => c.sim > 0);
    if (!cands.length || mu[ui] === null) return null;
    return cands.reduce((s, c) => s + c.sim * C[c.p][j], 0) / cands.reduce((s, c) => s + c.sim, 0) + mu[ui];
  }

  // Item (or user) factor vectors as 2-D points for a VectorPlot (first two factors)
  function factorVectors({ V, U, which = 'items', labels = {} }) {
    const pts = which === 'items'
      ? V.cols.map((c, j) => ({ id: c, label: labels[c] || c, x: +V.values[0][j].toFixed(2), y: +(V.values[1] ? V.values[1][j] : 0).toFixed(2) }))
      : U.rows.map((r, i) => ({ id: r, label: labels[r] || r, x: +U.values[i][0].toFixed(2), y: +(U.values[i][1] ?? 0).toFixed(2) }));
    // Tight square domain that still contains the origin (no wasted empty quadrants).
    const all = pts.flatMap((p) => [p.x, p.y]);
    const lo = Math.floor(Math.min(0, ...all) * 2) / 2 - 0.5;
    const hi = Math.ceil(Math.max(1, ...all) * 2) / 2 + 0.5;
    return { vectors: pts, domain: [lo, hi] };
  }

  function dot2({ vectors }) {
    const [a, b] = vectors;
    return { dot: a.x * b.x + a.y * b.y };
  }

  // SSE if every prediction were the same constant c (minimised by the mean of the observed ratings)
  function constantSse({ R, c }) {
    const obs = R.values.flat().filter((x) => x !== null);
    const mean = obs.reduce((a, b) => a + b, 0) / obs.length;
    const f = (k) => obs.reduce((acc, r) => acc + (r - k) * (r - k), 0);
    return { sse: f(c), best: f(mean), mean, observed: obs.length };
  }

  function paramCount({ m, n, d }) { return { params: m * d + d * n, cells: m * n }; }

  // ---------------------------------------------------------------- quiz generators
  const near = (a, b, t = 0.011) => Math.abs(a - b) < t;
  function smallR(rng, m, n, holes) {
    const values = Array.from({ length: m }, () => Array.from({ length: n }, () => rng.int(1, 5)));
    let h = 0;
    while (h < holes) {
      const i = rng.int(0, m - 1), j = rng.int(0, n - 1);
      if (values[i][j] === null) continue;
      if (values[i].filter((x) => x !== null).length <= 2) continue;
      if (values.map((r) => r[j]).filter((x) => x !== null).length <= 2) continue;
      values[i][j] = null; h++;
    }
    return mat(Array.from({ length: m }, (_, i) => `u${i + 1}`), Array.from({ length: n }, (_, j) => `i${j + 1}`), values);
  }
  const halfInts = (rng) => rng.int(0, 6) / 2;

  function dotQ({ rng, difficulty }) {
    const d = difficulty === 1 ? 2 : 3;
    for (;;) {
      const u = Array.from({ length: d }, () => halfInts(rng));
      const v = Array.from({ length: d }, () => halfInts(rng));
      const p = u.reduce((s, x, t) => s + x * v[t], 0);
      const wrongSum = u.reduce((a, b) => a + b, 0) + v.reduce((a, b) => a + b, 0);
      if (p === 0 || near(p, wrongSum)) continue;
      return { vars: { u, v, p, d, wrongSum, wrongFirst: u[0] * v[0] }, misconceptions: [
        { var: 'wrongSum', feedback: 'You added the factors. The prediction is the **dot product**: multiply matching factors, then add.' },
        { var: 'wrongFirst', feedback: 'Include every latent factor, not just the first: Σₛ uᵢₛ vₛⱼ.' },
      ] };
    }
  }

  function sseQ({ rng, difficulty }) {
    for (;;) {
      const R = smallR(rng, 3, 3, difficulty === 1 ? 1 : 2);
      const U = mat(R.rows, ['f1'], R.rows.map(() => [rng.int(1, 2)]));
      const V = mat(['f1'], R.cols, [R.cols.map(() => rng.int(1, 2))]);
      const s = sse({ R, U, V });
      const P = s.P.values;
      const wrongZero = R.values.reduce((acc, row, i) => acc + row.reduce((a, r, j) => a + Math.pow((r ?? 0) - P[i][j], 2), 0), 0);
      if (near(wrongZero, s.sse) || s.sse === 0) continue;
      return { vars: { R, U, V, P: s.P, sse: s.sse, observed: s.observed, wrongZero }, misconceptions: [
        { var: 'wrongZero', feedback: 'You treated missing ratings as 0. The SSE sums over **observed** cells only.' },
        { value: Math.sqrt(s.sse), feedback: 'That is the square root. SSE is the plain sum of squared errors.' },
      ] };
    }
  }

  function alsColumnQ({ rng }) {
    for (;;) {
      const R = smallR(rng, 4, 4, 2);
      const j = rng.int(0, 3);
      const col = R.values.map((r) => r[j]).filter((x) => x !== null);
      const mean = col.reduce((a, b) => a + b, 0) / col.length;
      const U = mat(R.rows, ['f1', 'f2'], R.rows.map(() => [1, 1]));
      const V = alsStepV({ R, U }).V;
      const v = V.values[0][j];
      const wrongAllRows = R.values.reduce((a, r) => a + (r[j] ?? 0), 0) / R.rows.length / 2;
      if (near(wrongAllRows, v) || near(mean, v)) continue;
      return { vars: { R, item: R.cols[j], v, mean, n: col.length, wrongMean: mean, wrongAllRows }, misconceptions: [
        { var: 'wrongMean', feedback: 'That is v₁ⱼ + v₂ⱼ. With U = all ones both factors get the same value, so each is half the mean (minimum-norm split).' },
        { var: 'wrongAllRows', feedback: 'Only observed ratings enter the least-squares problem; don\'t count blanks as 0.' },
      ] };
    }
  }

  function cgdQ({ rng, difficulty }) {
    for (;;) {
      const R = smallR(rng, 3, 4, difficulty === 3 ? 2 : 1);
      const i = rng.int(0, 2);
      const Uv = R.rows.map(() => [1, 1]);
      const Vv = [R.cols.map(() => 1), R.cols.map(() => (difficulty === 1 ? 1 : rng.int(1, 2)))];
      const U = mat(R.rows, ['f1', 'f2'], Uv), V = mat(['f1', 'f2'], R.cols, Vv);
      const r = cgdUpdate({ R, U, V, which: 'U', i, s: 0 });
      const obs = R.values[i].filter((x) => x !== null);
      const wrongMean = obs.reduce((a, b) => a + b, 0) / obs.length;
      if (near(wrongMean, r.value) || Math.abs(r.value * 10 - Math.round(r.value * 10)) > 1e-9 && difficulty === 1) continue;
      return { vars: { R, U, V, i: i + 1, user: R.rows[i], value: r.value, num: r.num, den: r.den, wrongMean, before: r.sseBefore, after: r.sseAfter }, misconceptions: [
        { var: 'wrongMean', feedback: 'You averaged the raw ratings. Subtract what the other factor already predicts (r − Σₜ≠ₛ uᵢₜvₜⱼ) first.' },
        { var: 'num', feedback: 'That is only the numerator; divide by Σ v²ₛⱼ over the observed cells.' },
      ] };
    }
  }

  function paramsQ({ rng }) {
    const m = rng.int(3, 12) * 100, n = rng.int(2, 9) * 50, d = rng.pick([2, 5, 10, 20]);
    return { vars: { m, n, d, params: m * d + d * n, cells: m * n, wrongMN: m * n, wrongMult: m * n * d }, misconceptions: [
      { var: 'wrongMN', feedback: 'm·n is the size of R itself; the factorization stores only m·d + d·n numbers.' },
      { var: 'wrongMult', feedback: 'Add the two factor matrices\' sizes: U is m×d and V is d×n.' },
    ] };
  }

  return {
    fns: { factorVectors, dot2, constantSse, init, product, sse, alsStepV, alsStepU, als, cgdUpdate, sseEntry, cgdLecture, cgdRun, fillMissing, trainRecommend, holdoutCompare, paramCount },
    generators: { dotQ, sseQ, alsColumnQ, cgdQ, paramsQ },
  };
}
