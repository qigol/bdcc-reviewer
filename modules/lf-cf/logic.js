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
    const d = (x) => String(+(+x).toFixed(2));
    const dot = a.x * b.x + a.y * b.y;
    return { dot, tex: `(${d(a.x)})(${d(b.x)}) + (${d(a.y)})(${d(b.y)}) = ${d(a.x * b.x)} + ${d(a.y * b.y)} = ${d(dot)}` };
  }

  // SSE if every prediction were the same constant c (minimised by the mean of the observed ratings)
  function constantSse({ R, c }) {
    const obs = R.values.flat().filter((x) => x !== null);
    const mean = obs.reduce((a, b) => a + b, 0) / obs.length;
    const f = (k) => obs.reduce((acc, r) => acc + (r - k) * (r - k), 0);
    return { sse: f(c), best: f(mean), mean, observed: obs.length };
  }

  function paramCount({ m, n, d }) { return { params: m * d + d * n, cells: m * n }; }

  // ---------------------------------------------------------------- solve-along helpers
  const dn = (x, d = 2) => String(+(+x).toFixed(d)).replace(/^-0$/, '0');
  const pr = (x, d = 2) => `(${dn(x, d)})`;
  const clone = (M) => ({ ...M, values: M.values.map((r) => r.slice()) });
  const uName = (i, s) => `u_{${i + 1}${s + 1}}`;
  const vName = (s, j) => `v_{${s + 1}${j + 1}}`;

  // Squared-error worksheet: (r − p)² per observed cell, row sums in the last column (first `upTo` rows filled).
  function sseSheet({ R, U, V, upTo = 99 }) {
    const { values: P } = product({ U, V });
    const cols = [...R.cols, 'row Σ'];
    let total = 0;
    const rowSums = [];
    const values = R.values.map((row, i) => {
      let s = 0;
      const cells = row.map((r, j) => { if (r === null) return null; const e = (r - P[i][j]) ** 2; s += e; return i < upTo ? e : null; });
      rowSums.push(s);
      if (i < upTo) total += s;
      return [...cells, i < upTo ? s : null];
    });
    return { rows: R.rows, cols, values, total, rowSums, done: Math.min(upTo, R.rows.length) };
  }

  // SSE counted row by row. roles: sheet (Matrix from sseSheet), err (Matrix of errors). Patches sseUpTo.
  function sseWalk({ R, U, V }) {
    const { values: P } = product({ U, V });
    const trace = [];
    const sums = [];
    R.values.forEach((row, i) => {
      const obs = row.map((r, j) => ({ r, j })).filter((o) => o.r !== null);
      const terms = obs.map((o) => `(${o.r} - ${dn(P[i][o.j])})^2`).join(' + ');
      const sq = obs.map((o) => dn((o.r - P[i][o.j]) ** 2));
      const s = obs.reduce((t, o) => t + (o.r - P[i][o.j]) ** 2, 0);
      sums.push(s);
      const skipped = row.map((r, j) => (r === null ? R.cols[j] : null)).filter(Boolean);
      trace.push({
        label: `Row ${R.rows[i]}: $${terms} = ${sq.join(' + ')} = ${dn(s)}$${skipped.length ? ` (${skipped.join(', ')} blank, skipped)` : ''}`,
        vars: { rowSSE: s }, patch: { sseUpTo: i + 1 },
        ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: `row:${R.rows[i]}`, tone: 'accent' } }, { role: 'err', cmd: 'highlight', args: { sel: `row:${R.rows[i]}`, tone: 'accent' } }],
      });
    });
    const total = sums.reduce((a, b) => a + b, 0);
    trace.push({ label: `SSE $= ${sums.map((x) => dn(x)).join(' + ')} = ${dn(total)}$ over ${R.values.flat().filter((x) => x !== null).length} observed cells`, vars: { sse: total }, patch: { sseUpTo: R.rows.length },
      ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: 'col:row Σ', tone: 'good' } }] });
    return { sse: total, trace };
  }

  // How one column (V-step) or row (U-step) is solved, written out.
  function solveTex(R, U, V, half, idx) {
    if (half === 'V') {
      const j = idx;
      const obs = R.values.map((row, i) => ({ i, r: row[j] })).filter((o) => o.r !== null);
      const allOnes = obs.every((o) => U.values[o.i].every((x) => Math.abs(x - 1) < 1e-12));
      const v = ridge(obs.map((o) => U.values[o.i]), obs.map((o) => o.r), 0);
      if (allOnes) {
        const sum = obs.reduce((t, o) => t + o.r, 0);
        return {
          tex: `\\begin{aligned} ${vName(0, j)} + ${vName(1, j)} &= \\frac{${obs.map((o) => o.r).join(' + ')}}{${obs.length}} = \\frac{${sum}}{${obs.length}} = ${dn(sum / obs.length, 3)} \\\\ \\Rightarrow\\; ${vName(0, j)} = ${vName(1, j)} &= ${dn(v[0], 4)} \\end{aligned}`,
          v, text: `${R.cols[j]} (U = ones, only the sum counts): $${vName(0, j)} + ${vName(1, j)} = \\frac{${obs.map((o) => o.r).join(' + ')}}{${obs.length}} = ${dn(sum / obs.length, 3)}$ → ${dn(v[0], 4)} each`,
        };
      }
      return { tex: `\\mathbf{v}_{${j + 1}} = (${v.map((x) => dn(x, 3)).join(', ')})`, v, text: `${R.cols[j]}: least squares over ${obs.length} observed ratings → (${v.map((x) => dn(x, 3)).join(', ')})` };
    }
    const i = idx;
    const obs = R.values[i].map((r, j) => ({ j, r })).filter((o) => o.r !== null);
    const c = V.values[0];
    const equalRows = V.values.every((row) => row.every((x, j) => Math.abs(x - c[j]) < 1e-12));
    const u = ridge(obs.map((o) => V.values.map((row) => row[o.j])), obs.map((o) => o.r), 0);
    if (equalRows) {
      const num = obs.reduce((t, o) => t + c[o.j] * o.r, 0), den = obs.reduce((t, o) => t + c[o.j] ** 2, 0);
      return {
        tex: `\\begin{aligned} ${uName(i, 0)} + ${uName(i, 1)} &= \\frac{${obs.map((o) => `${pr(c[o.j], 3)}(${o.r})`).join(' + ')}}{${obs.map((o) => `${dn(c[o.j], 3)}^2`).join(' + ')}} = \\frac{${dn(num, 4)}}{${dn(den, 4)}} = ${dn(num / den, 5)} \\\\ \\Rightarrow\\; ${uName(i, 0)} = ${uName(i, 1)} &= ${dn(u[0], 8)} \\end{aligned}`,
        u, text: `${R.rows[i]} (V's rows equal): $${uName(i, 0)} + ${uName(i, 1)} = \\frac{\\sum v\\,r}{\\sum v^2} = \\frac{${dn(num, 3)}}{${dn(den, 3)}} = ${dn(num / den, 4)}$ → ${dn(u[0], 4)} each`,
      };
    }
    return { tex: `\\mathbf{u}_{${i + 1}} = (${u.map((x) => dn(x, 3)).join(', ')})`, u, text: `${R.rows[i]}: least squares over ${obs.length} ratings → (${u.map((x) => dn(x, 3)).join(', ')})` };
  }

  // ALS with the first iteration solved column by column and row by row.
  // roles: product (MatrixProduct). Patches U, V, alsTex.
  function alsDetailWalk({ R, iters = 3 }) {
    let { U, V } = init({ R, d: 2, kind: 'ones' });
    const trace = [{ label: `Start: U = V = all ones, every prediction is 2, SSE = ${dn(sse({ R, U, V }).sse)}`, patch: { U, V, alsTex: '\\text{start: } U = V = \\mathbf{1}' } }];
    for (let it = 0; it < iters; it++) {
      if (it === 0) {
        const V2 = clone(V);
        R.cols.forEach((c, j) => {
          const st = solveTex(R, U, V, 'V', j);
          st.v.forEach((x, s) => (V2.values[s][j] = x));
          trace.push({ label: `V-step, ${st.text}`, patch: { U, V: clone(V2), alsTex: st.tex },
            ops: [{ role: 'product', cmd: 'highlight', args: { sel: `Vcol:${j}`, tone: 'accent' } }] });
        });
        V = V2;
        const s1 = sse({ R, U, V });
        const colS = R.cols.map((_, j) => R.values.reduce((t, row, i) => t + (row[j] === null ? 0 : (row[j] - s1.P.values[i][j]) ** 2), 0));
        trace.push({ label: `SSE now: each column's spread around its mean, $${colS.map((x) => dn(x)).join(' + ')} = ${dn(s1.sse)}$`, patch: { U, V, alsTex: `\\text{SSE} = ${colS.map((x) => dn(x)).join(' + ')} = ${dn(s1.sse)}` } });
        const U2 = clone(U);
        R.rows.forEach((r, i) => {
          const st = solveTex(R, U, V, 'U', i);
          U2.values[i] = st.u.slice();
          trace.push({ label: `U-step, ${st.text}`, patch: { U: clone(U2), V, alsTex: st.tex },
            ops: [{ role: 'product', cmd: 'highlight', args: { sel: `Urow:${i}`, tone: 'accent' } }] });
        });
        U = U2;
        const s2 = sse({ R, U, V });
        const rowS = R.rows.map((_, i) => R.values[i].reduce((t, r, j) => t + (r === null ? 0 : (r - s2.P.values[i][j]) ** 2), 0));
        trace.push({ label: `Iteration 1 done. SSE by row: $${rowS.map((x) => dn(x)).join(' + ')} = ${dn(s2.sse)}$`, patch: { U, V, alsTex: `\\text{SSE} = ${rowS.map((x) => dn(x)).join(' + ')} = ${dn(s2.sse)}` } });
      } else {
        V = alsStepV({ R, U }).V;
        const a = sse({ R, U, V }).sse;
        trace.push({ label: `Iteration ${it + 1}: V-step (same even split) → SSE = ${dn(a, 3)}`, patch: { U, V, alsTex: `\\text{iteration ${it + 1}, V-step: SSE} = ${dn(a, 3)}` } });
        U = alsStepU({ R, V }).U;
        const b = sse({ R, U, V }).sse;
        trace.push({ label: `Iteration ${it + 1}: U-step → SSE = ${dn(b, 3)}. Both columns of U are still identical.`, patch: { U, V, alsTex: `\\text{iteration ${it + 1}, U-step: SSE} = ${dn(b, 3)}` } });
      }
    }
    return { U, V, sse: sse({ R, U, V }).sse, trace };
  }

  // Worksheet for one coordinate update: every observed term of Σ f·(r − rest) and Σ f².
  function cgdSheet({ R, U, V, which = 'U', i = 0, s = 0, j = 0 }) {
    const r = cgdUpdate({ R, U, V, which, i, s, j });
    const name = which === 'U' ? uName(i, s) : vName(s, j);
    const rows = [...r.terms.map((t) => (which === 'U' ? t.col : t.row)), 'Σ'];
    const f = which === 'U' ? 'v' : 'u';
    const cols = ['r', 'rest', 'r − rest', f, `${f}·(r − rest)`, `${f}²`];
    const values = r.terms.map((t) => { const fac = which === 'U' ? t.v : t.u; return [t.r, t.rest, t.r - t.rest, fac, fac * (t.r - t.rest), fac * fac]; });
    values.push([null, null, null, null, r.num, r.den]);
    const numTex = r.terms.map((t) => { const fac = which === 'U' ? t.v : t.u; return `${pr(fac, 3)}(${t.r} - ${dn(t.rest, 3)})`; }).join(' + ');
    const denTex = r.terms.map((t) => `${dn(which === 'U' ? t.v : t.u, 3)}^2`).join(' + ');
    return {
      rows, cols, values, value: r.value, num: r.num, den: r.den, sseBefore: r.sseBefore, sseAfter: r.sseAfter,
      tex: `${name} = \\frac{${numTex}}{${denTex}} = \\frac{${dn(r.num, 4)}}{${dn(r.den, 4)}} = ${dn(r.value, 4)}`,
      title: `Updating $${name}$: one row per observed ${which === 'U' ? 'item of this user' : 'user of this item'} (rest = what the other factor predicts)`,
    };
  }

  // One full coordinate-descent sweep: every entry of U, then every entry of V, each solved exactly.
  // roles: product (MatrixProduct). Patches U, V, upd.
  function cgdSweepWalk({ R, d = 2, sweeps = 1, lectureStart = true }) {
    let { U, V } = init({ R, d, kind: 'ones' });
    const trace = [{ label: `Start: U = V = all ones, SSE = ${dn(sse({ R, U, V }).sse)}`, patch: { U, V, upd: { which: 'U', i: 0, s: 0, j: 0 } } }];
    for (let sw = 0; sw < sweeps; sw++) {
      const order = [];
      // the lecture's first two moves (slides 11–14): x = u11, then y = v11; then every other entry of U, then of V
      if (lectureStart && sw === 0) order.push({ which: 'U', i: 0, s: 0, j: 0 }, { which: 'V', i: 0, s: 0, j: 0 });
      const done = (o) => lectureStart && sw === 0 && o.i === 0 && o.s === 0 && o.j === 0;
      for (let i = 0; i < R.rows.length; i++) for (let s = 0; s < d; s++) if (!done({ i, s, j: 0 })) order.push({ which: 'U', i, s, j: 0 });
      for (let s = 0; s < d; s++) for (let j = 0; j < R.cols.length; j++) if (!done({ i: 0, s, j })) order.push({ which: 'V', i: 0, s, j });
      for (const o of order) {
        const sh = cgdSheet({ R, U, V, ...o });
        const r = cgdUpdate({ R, U, V, ...o });
        const name = o.which === 'U' ? uName(o.i, o.s) : vName(o.s, o.j);
        U = r.U; V = r.V;
        trace.push({
          label: `$${name} = \\frac{${dn(sh.num, 3)}}{${dn(sh.den, 3)}} = ${dn(r.value, 3)}$; SSE ${dn(r.sseBefore, 2)} → ${dn(r.sseAfter, 2)}`,
          vars: { value: r.value, sse: r.sseAfter },
          patch: { U, V, upd: o },
          ops: [{ role: 'product', cmd: 'highlight', args: { sel: o.which === 'U' ? `U:${o.i},${o.s}` : `V:${o.s},${o.j}`, tone: 'warn' } }],
        });
      }
    }
    return { U, V, sse: sse({ R, U, V }).sse, trace };
  }

  // The blanks, each as a written-out dot product.
  function fillTex({ R, U, V }) {
    const { values: P } = product({ U, V });
    const d = U.values[0].length;
    const out = [];
    R.values.forEach((row, i) => row.forEach((r, j) => {
      if (r !== null) return;
      const terms = Array.from({ length: d }, (_, s) => `${pr(U.values[i][s])}${pr(V.values[s][j])}`).join(' + ');
      out.push({ cell: `${R.rows[i]},${R.cols[j]}`, value: P[i][j], tex: `\\hat r_{${R.rows[i]},${R.cols[j]}} = ${Array.from({ length: d }, (_, s) => `${uName(i, s)}${vName(s, j)}`).join(' + ')} = ${terms} = ${dn(P[i][j])}` });
    }));
    return { cells: out, tex: out.map((o) => o.tex) };
  }

  // roles: m (Matrix of ratings with blanks)
  function fillWalk({ R, U, V }) {
    const f = fillTex({ R, U, V });
    return { trace: f.cells.map((c) => ({ label: `$${c.tex}$`, ops: [{ role: 'm', cmd: 'fill', args: { cell: c.cell, value: c.value } }] })) };
  }

  // ---------------------------------------------------------------- numpy code traces (Math & Code tab)
  // The Math & Code tab shows numpy code. Each trace takes one step per line of that code (a few lines get an extra
  // step that splits a line into its two operations). The array a line produces is printed as TeX in the step label;
  // vars carry shapes and single values for the badge beside the code line.
  const NAN = '{\\color{gray}\\text{nan}}';
  const TF = (b) => (b ? '\\text{T}' : '\\text{F}');
  const txt = (x) => `\\text{${x}}`;
  const shp = (A) => `(${A.length}, ${A[0].length})`;
  const cellT = (x, f) => (typeof x === 'string' ? x : x === null || Number.isNaN(x) ? NAN : f(x));
  // TeX table of an array, with optional row / column labels; hl = [[i, j], …] entries to box
  function arr(V, { rows = null, cols = null, f = (x) => dn(x, 3), hl = [] } = {}) {
    const cell = (x, i, j) => {
      const t = cellT(x, f);
      return hl.some(([a, b]) => a === i && b === j) ? `\\boxed{${t}}` : t;
    };
    const head = cols ? `${rows ? ' & ' : ''}${cols.map((c) => `\\scriptstyle\\text{${c}}`).join(' & ')} \\\\ \\hline ` : '';
    const body = V.map((r, i) => `${rows ? `\\scriptstyle\\text{${rows[i]}} & ` : ''}${r.map((x, j) => cell(x, i, j)).join(' & ')}`).join(' \\\\ ');
    const t = `\\begin{array}{${rows ? 'r|' : ''}${'r'.repeat(V[0].length)}}${head}${body}\\end{array}`;
    return rows || cols ? t : `\\left[${t}\\right]`;
  }
  // a 1-D array, printed the way numpy prints it
  const vec = (v, f = (x) => dn(x, 3)) => `[\\,${v.map((x) => cellT(x, f)).join(',\\ ')}\\,]`;
  const pyList = (v, f = (x) => dn(x, 3)) => `[${v.map((x) => (x === null ? 'nan' : typeof x === 'string' ? x : f(x))).join(', ')}]`;
  const colOf = (A, j) => A.map((r) => r[j]);
  const mul = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((t, x, k) => t + x * B[k][j], 0)));

  // anchors: u, v, p, all
  function predictOneCode({ U, V, R = null, cells = [[0, 0]] }) {
    const d = U.values[0].length;
    const f4 = (x) => dn(x, 4);
    const trace = [];
    for (const [i, j] of cells) {
      const u = U.values[i], v = colOf(V.values, j);
      const p = u.reduce((t, x, s) => t + x * v[s], 0);
      trace.push(
        { label: `\`U[i]\` with i = ${i} is row ${U.rows[i]} of U: that user's ${d} factor values.\n\n$\\mathbf{u}_i = ${vec(u, f4)}$`,
          code: 'u', math: 'u', vars: { i } },
        { label: `\`V[:, j]\` with j = ${j} is column ${V.cols[j]} of V (\`:\` means every row): the item's ${d} factor values.\n\n$\\mathbf{v}_j = ${vec(v, f4)}$`,
          code: 'v', math: 'v', vars: { j } },
        { label: '`u_i @ v_j` multiplies factor by factor, then adds: a dot product.\n\n' + `$p_{${U.rows[i]},${V.cols[j]}} = ${u.map((x, s) => `${pr(x, 4)}${pr(v[s], 4)}`).join(' + ')} = ${dn(p, 4)}$${R && R.values[i][j] === null ? ' (a blank in R, predicted all the same)' : ''}`,
          code: 'p', math: 'p', vars: { p } },
      );
    }
    const P = mul(U.values, V.values);
    trace.push({ label: `\`U @ V\`: (${U.values.length}×${d})(${d}×${V.cols.length}) gives ${U.values.length}×${V.cols.length}, every cell's dot product at once. Boxed: the cells above.\n\n$P = ${arr(P, { rows: U.rows, cols: V.cols, hl: cells })}$`,
      code: 'all', math: 'all', vars: { shape: shp(P) } });
    return { trace };
  }

  // anchors: pred, err, obs, sq, add
  function sseCode({ R, U, V }) {
    const P = mul(U.values, V.values);
    const E = R.values.map((row, i) => row.map((r, j) => (r === null ? null : r - P[i][j])));
    const M = R.values.map((row) => row.map((r) => r !== null));
    const e = E.flat().filter((x) => x !== null);
    const sq = e.map((x) => x * x);
    const rowS = E.map((row) => row.reduce((t, x) => t + (x === null ? 0 : x * x), 0));
    const total = sq.reduce((a, b) => a + b, 0);
    const L = { rows: R.rows, cols: R.cols };
    return {
      sse: total,
      trace: [
        { label: '`U @ V`: every prediction at once.\n\n' + `$P = ${arr(P, { ...L, f: (x) => dn(x, 2) })}$`, code: 'pred', math: 'pred', vars: { shape: shp(P) } },
        { label: '`R - P` subtracts entry by entry. A blank is NaN, and NaN minus anything stays NaN.\n\n' + `$E = ${arr(E, { ...L, f: (x) => dn(x, 2) })}$`, code: 'err', math: 'err', vars: { shape: shp(E) } },
        { label: `\`np.isnan(R)\` marks the blanks and \`~\` flips it: T = observed (${e.length} of ${M.flat().length} cells).\n\n$M = ${arr(M.map((r) => r.map(TF)), L)}$`, code: 'obs', math: 'obs', vars: { observed: e.length } },
        { label: `\`E[M]\` (boolean indexing) keeps only the ${e.length} observed errors, row by row, as a flat 1-D array.\n\n$${vec(e, (x) => dn(x, 2))}$`, code: 'sq', math: 'sq', vars: { shape: `(${e.length},)` } },
        { label: '`** 2` squares each error: every term is positive, and big misses count extra.\n\n' + `$${vec(sq, (x) => dn(x, 2))}$`, code: 'sq', math: 'sq', vars: { shape: `(${sq.length},)` } },
        { label: '`.sum()` adds all the squares. Grouped by row:\n\n' + `$${rowS.map((x) => dn(x, 2)).join(' + ')} = ${dn(total, 3)}$`, code: 'add', math: 'add', vars: { sse: total } },
      ],
    };
  }

  // anchors: init, loop, obs, feat, target, solve, transpose
  function alsStepVCode({ R, U }) {
    const d = U.values[0].length, n = R.cols.length;
    const V = Array.from({ length: d }, () => Array(n).fill(0));
    const f3 = (x) => dn(x, 3);
    const trace = [{ label: `\`np.zeros((${d}, ${n}))\`: a ${d} × ${n} table of zeros, one column per item, filled in below. U stays frozen.\n\n$V = ${arr(V, { rows: factorNames(d), cols: R.cols, f: String })}$`,
      code: 'init', math: 'init', vars: { shape: `(${d}, ${n})` } }];
    R.cols.forEach((c, j) => {
      const col = colOf(R.values, j);
      const rated = col.map((x) => x !== null);
      const rows = rated.map((b, i) => (b ? i : -1)).filter((i) => i >= 0);
      const A = rows.map((i) => U.values[i]);
      const b = rows.map((i) => R.values[i][j]);
      const st = solveTex(R, U, { values: [[0], [0]] }, 'V', j);
      st.v.forEach((x, s) => (V[s][j] = x));
      const allOnes = A.every((r) => r.every((x) => Math.abs(x - 1) < 1e-12));
      trace.push(
        { label: `\`for j\`: j = ${j}, item ${c}. Each item is its own small regression.`, code: 'loop', math: 'loop', vars: { j } },
        { label: `\`R[:, j]\` is column ${c}; \`~np.isnan\` marks the users who rated it.\n\n$${arr([col], { cols: R.rows, f: String })} \\;\\Rightarrow\\; ${arr([rated.map(TF)], { cols: R.rows })}$`,
          code: 'obs', math: 'obs', vars: { rated: rated.filter(Boolean).length } },
        { label: '`U[rated]` keeps those users\' frozen rows of U: the inputs (features) of the regression.\n\n' + `$A = ${arr(A, { rows: rows.map((i) => R.rows[i]), cols: factorNames(d), f: f3 })}$`,
          code: 'feat', math: 'feat', vars: { shape: shp(A) } },
        { label: `\`R[rated, j]\` keeps their ratings of ${c}: the targets the regression should match.\n\n$\\mathbf{b} = ${vec(b, String)}$`,
          code: 'target', math: 'target', vars: { shape: `(${b.length},)` } },
        { label: (allOnes
          ? 'A\'s rows are all (1, 1), so only v₁ + v₂ counts; it equals the mean. `lstsq` splits it evenly.'
          : '`np.linalg.lstsq` finds the v with the smallest ‖Av − b‖²; `V[:, j] = v` stores it as column j.') + `\n\n$${st.tex} \\;\\Rightarrow\\; V =${arr(V, { rows: factorNames(d), cols: R.cols, f: f3, hl: Array.from({ length: d }, (_, s) => [s, j]) })}$`,
          code: 'solve', math: 'solve', vars: { v: pyList(st.v, (x) => dn(x, 4)) } },
      );
    });
    // the U-step: the same function on the transposes
    const Vm = { rows: factorNames(d), cols: R.cols, values: V };
    const U2 = alsStepU({ R, V: Vm }).U;
    const su = solveTex(R, U, Vm, 'U', 0);
    trace.push(
      { label: `\`als_step_U\`: with \`R.T\` and \`V.T\`, users become columns, so the V-step code solves U; \`.T\` flips it back.\n\n$U = ${arr(U2.values, { rows: R.rows, cols: factorNames(d), f: (x) => dn(x, 8) })}$`,
        code: 'transpose', math: 'transpose', vars: { shape: shp(U2.values) } },
      { label: `Row ${R.rows[0]} of that U-step, written out (slide 8). V's rows are equal, so only u₁₁ + u₁₂ matters.\n\n$${su.tex}$`,
        code: 'transpose', math: 'transpose', vars: { 'U[0]': pyList(U2.values[0], (x) => dn(x, 8)) } },
    );
    return { V: Vm, U: U2, trace };
  }

  // anchors: init, loop, solve-v, solve-u, sse
  function alsCode({ R, iters = 3, initKind = 'ones', seed = 7 }) {
    let { U, V } = init({ R, d: 2, kind: initKind, seed });
    const L = (M, f = (x) => dn(x, 3)) => arr(M.values, { rows: M.rows, cols: M.cols, f });
    const trace = [{ label: `${initKind === 'ones' ? '`np.ones`: every entry of U is 1 (the lecture).' : 'Random numbers between 0.5 and 1.5 (the site uses its own seeded generator, so numpy\'s would differ).'} SSE = ${dn(sse({ R, U, V }).sse, 3)}.\n\n$U = ${L(U, (x) => dn(x, 2))}$`,
      code: 'init', math: 'init' }];
    for (let t = 0; t < iters; t++) {
      trace.push({ label: `\`for t\`: iteration ${t + 1} of ${iters}: one V-step, then one U-step.`, code: 'loop', math: 'loop', vars: { t } });
      V = alsStepV({ R, U }).V;
      const a = sse({ R, U, V }).sse;
      trace.push({ label: `\`als_step_V(R, U)\`: U frozen, 5 column regressions. SSE = ${dn(a, 3)}.\n\n$V = ${L(V)}$`, code: 'solve-v', math: 'solve-v', vars: { sse: a } });
      U = alsStepU({ R, V }).U;
      const b = sse({ R, U, V }).sse;
      trace.push({ label: `\`als_step_U(R, V)\`: V frozen, 5 row regressions. SSE = ${dn(b, 3)}.\n\n$U = ${L(U, (x) => dn(x, 4))}$`, code: 'solve-u', math: 'solve-u', vars: { sse: b } });
      const sym = U.values.every((r) => Math.abs(r[0] - r[1]) < 1e-9);
      trace.push({ label: `\`print\`: iteration ${t + 1}, SSE ${dn(b, 3)}.${sym ? ' The two columns of U are still identical: the symmetry trap.' : ' The two columns of U now differ.'}`, code: 'sse', math: 'sse', vars: { sse: b } });
    }
    return { trace };
  }

  // anchors: obs, full, rest, num, den, closed (which = 'U': update_u for U[i, s]; 'V': update_v for V[s, j], anchor 'update')
  function cgdSteps({ R, U, V, which = 'U', i = 0, s = 0, j = 0 }) {
    const I = which === 'U';
    const d = U.values[0].length;
    const idx = I ? R.cols.map((_, q) => q) : R.rows.map((_, q) => q);
    const line = I ? R.values[i] : colOf(R.values, j);
    const rated = line.map((x) => x !== null);
    const k = idx.filter((q) => rated[q]);
    const names = I ? R.cols : R.rows;
    const full = k.map((q) => (I ? U.values[i].reduce((t, x, tt) => t + x * V.values[tt][q], 0) : U.values[q].reduce((t, x, tt) => t + x * V.values[tt][j], 0)));
    const own = k.map((q) => (I ? U.values[i][s] * V.values[s][q] : U.values[q][s] * V.values[s][j]));
    const rest = full.map((x, t) => x - own[t]);
    const fac = k.map((q) => (I ? V.values[s][q] : U.values[q][s]));
    const r = k.map((q) => line[q]);
    const left = r.map((x, t) => x - rest[t]);
    const num = fac.reduce((t, x, q) => t + x * left[q], 0);
    const den = fac.reduce((t, x) => t + x * x, 0);
    const value = num / den;
    const f3 = (x) => dn(x, 3);
    const upd = cgdUpdate({ R, U, V, which, i, s, j });
    const target = I ? `U[${i}, ${s}]` : `V[${s}, ${j}]`;
    const who = I ? `the items ${R.rows[i]} rated` : `the users who rated ${R.cols[j]}`;
    const steps = [
      { label: `\`${I ? 'R[i]' : 'R[:, j]'}\` is ${I ? `row ${R.rows[i]}` : `column ${R.cols[j]}`}; \`~np.isnan\` marks ${who}.\n\n$${arr([line], { cols: names, f: String })} \\;\\Rightarrow\\; ${arr([rated.map(TF)], { cols: names })}$`,
        code: 'obs', math: 'obs', vars: { rated: k.length } },
      { label: `\`${I ? 'U[i] @ V[:, rated]' : 'U[rated] @ V[:, j]'}\`: the full prediction for each of ${who}.\n\n$\\text{full} = ${vec(full, f3)}$`,
        code: 'full', math: 'full', vars: { shape: `(${k.length},)` } },
      { label: `\`full\` minus \`${I ? 'U[i, s] * V[s, rated]' : 'U[rated, s] * V[s, j]'}\`, factor ${s + 1}'s own part (element-wise): what the other factors predict.\n\n$${vec(full, f3)} - ${vec(own, f3)} = ${vec(rest, f3)}$`,
        code: 'rest', math: 'rest', vars: { rest: pyList(rest, f3) } },
      { label: `\`${I ? 'R[i, rated]' : 'R[rated, j]'} - rest\` is what is left for factor ${s + 1} to explain; \`@\` with its factor values multiplies and adds.\n\n$${fac.map((x, q) => `${pr(x, 3)}(${r[q]} - ${f3(rest[q])})`).join(' + ')} = ${fac.map((x, q) => f3(x * left[q])).join(' + ')} = ${f3(num)}$`,
        code: 'num', math: 'num', vars: { num } },
      { label: 'A vector `@` itself adds its squares.\n\n' + `$${fac.map((x) => `${f3(x)}^2`).join(' + ')} = ${f3(den)}$`, code: 'den', math: 'den', vars: { den } },
      { label: `Divide: the bottom of the parabola, written into ${target}. SSE ${dn(upd.sseBefore, 2)} → ${dn(upd.sseAfter, 2)}.\n\n$${I ? uName(i, s) : vName(s, j)} = \\frac{${f3(num)}}{${f3(den)}} = ${dn(value, 4)}$`,
        code: I ? 'closed' : 'update', math: I ? 'closed' : 'update', vars: { [target]: value } },
    ];
    return { value, steps, upd };
  }
  function cgdUpdateCode(args) {
    const r = cgdSteps(args);
    return { value: r.value, trace: r.steps };
  }

  // Lecture CGD walk: x via update_u, then y line by line via update_v.
  // anchors: start, x, obs, full, rest, num, den, update, y
  function cgdWorkedCode({ R }) {
    const st = init({ R, d: 2, kind: 'ones' });
    const a = cgdUpdate({ R, U: st.U, V: st.V, which: 'U', i: 0, s: 0 });
    const inner = cgdSteps({ R, U: a.U, V: a.V, which: 'V', s: 0, j: 0 });
    return {
      x: a.value, y: inner.value,
      trace: [
        { label: `\`np.ones\`: U (5 × 2) and V (2 × 5) all ones, so every prediction is 2. SSE = ${dn(a.sseBefore)}.`, code: 'start', math: 'start', vars: { sse: a.sseBefore } },
        { label: `\`update_u(R, U, V, i=0, s=0)\` (previous section): x = u₁₁ = ${dn(a.num)} / ${dn(a.den)} = ${dn(a.value)}. SSE ${dn(a.sseBefore)} → ${dn(a.sseAfter)}.`, code: 'x', math: 'x', vars: { 'U[0, 0]': a.value } },
        ...inner.steps,
        { label: `\`V\` now holds y = v₁₁ = ${dn(inner.value, 4)}. SSE ${dn(inner.upd.sseBefore)} → ${dn(inner.upd.sseAfter)}.`, code: 'y', math: 'y', vars: { 'V[0, 0]': inner.value } },
      ],
    };
  }

  // anchors: fit, pred, blank, fill, filled
  function fillCode({ R, U, V }) {
    const P = mul(U.values, V.values);
    const M = R.values.map((row) => row.map((r) => r === null));
    const f = fillTex({ R, U, V });
    const L = { rows: R.rows, cols: R.cols, f: (x) => dn(x, 2) };
    const blanks = [];
    M.forEach((row, i) => row.forEach((b, j) => { if (b) blanks.push([i, j]); }));
    const filled = R.values.map((row, i) => row.map((r, j) => (r === null ? P[i][j] : r)));
    const e = sse({ R, U, V }).sse;
    return {
      trace: [
        { label: `\`als(...)\` from a random start: training SSE = ${dn(e)}.\n\n$U = ${arr(U.values, { rows: U.rows, cols: U.cols, f: (x) => dn(x, 2) })} \\quad V = ${arr(V.values, { rows: V.rows, cols: V.cols, f: (x) => dn(x, 2) })}$`,
          code: 'fit', math: 'fit', vars: { sse: e } },
        { label: '`U @ V`: every prediction at once, blanks included.\n\n' + `$P = ${arr(P, { ...L, hl: blanks })}$`, code: 'pred', math: 'pred', vars: { shape: shp(P) } },
        { label: `\`np.isnan(R)\` is True exactly at the ${blanks.length} blanks.\n\n$M = ${arr(M.map((r) => r.map(TF)), { rows: R.rows, cols: R.cols })}$`, code: 'blank', math: 'blank', vars: { blanks: blanks.length } },
        ...f.cells.map((c) => ({ label: `Each value in \`P[M]\` is one dot product, a row of U · a column of V:\n\n$${c.tex}$`, code: 'fill', math: 'fill', vars: { p: c.value } })),
        { label: '`P[M]` as one flat array, in row order.\n\n' + `$${vec(f.cells.map((c) => c.value), (x) => dn(x, 2))}$`, code: 'fill', math: 'fill', vars: { shape: `(${blanks.length},)` } },
        { label: '`np.where(M, P, R)` takes P where M is True (a blank) and R everywhere else.\n\n' + `$\\hat R = ${arr(filled, { ...L, hl: blanks })}$`, code: 'filled', math: 'filled', vars: { shape: shp(filled) } },
      ],
    };
  }

  // anchors: init, loop, obs, lam, rhs, ridge
  function ridgeCode({ R, U, lambda = 1 }) {
    const d = U.values[0].length, n = R.cols.length;
    const V = Array.from({ length: d }, () => Array(n).fill(0));
    const f3 = (x) => dn(x, 3);
    const trace = [{ label: `\`d = U.shape[1]\` = ${d} factors; \`np.zeros\` makes the ${d} × ${n} result, one column per item.`, code: 'init', math: 'init', vars: { d } }];
    R.cols.forEach((c, j) => {
      const rows = R.values.map((_, i) => i).filter((i) => R.values[i][j] !== null);
      const Uo = rows.map((i) => U.values[i]);
      const r = rows.map((i) => R.values[i][j]);
      const A = Array.from({ length: d }, (_, p) => Array.from({ length: d }, (_, q) => Uo.reduce((t, u) => t + u[p] * u[q], 0) + (p === q ? lambda : 0)));
      const rhs = Array.from({ length: d }, (_, p) => Uo.reduce((t, u, k) => t + u[p] * r[k], 0));
      const v = solve(A, rhs);
      v.forEach((x, s) => (V[s][j] = x));
      trace.push(
        { label: `\`for j\`: j = ${j}, item ${c}.`, code: 'loop', math: 'loop', vars: { j } },
        { label: `Raters of ${c}: ${rows.map((i) => R.rows[i]).join(', ')}. \`U[rated]\` keeps their rows, \`R[rated, j]\` their ratings.\n\n$U_o = ${arr(Uo, { rows: rows.map((i) => R.rows[i]), cols: factorNames(d), f: f3 })} \\quad \\mathbf{r} = ${vec(r, String)}$`,
          code: 'obs', math: 'obs', vars: { shape: shp(Uo) } },
        { label: `\`Uo.T @ Uo\` is ${d} × ${d}; \`lam * np.eye(${d})\` adds λ = ${lambda} to its diagonal.\n\n$A = ${arr(Uo.length ? mul(transpose(Uo), Uo) : [[0, 0], [0, 0]], { f: f3 })} + ${lambda}\\,I = ${arr(A, { f: f3 })}$`,
          code: 'lam', math: 'lam', vars: { shape: shp(A) } },
        { label: `\`Uo.T @ r\`: each factor's column of Uo dotted with the ratings.\n\n$\\text{rhs} = ${vec(rhs, f3)}$`, code: 'rhs', math: 'rhs', vars: { rhs: pyList(rhs, f3) } },
        { label: `\`np.linalg.solve(A, rhs)\` solves A v = rhs; \`V[:, j] = v\` stores it as column ${c} of V.\n\n$\\mathbf{v} = ${vec(v, (x) => dn(x, 4))}$`, code: 'ridge', math: 'ridge', vars: { v: pyList(v, (x) => dn(x, 4)) } },
      );
    });
    return { V, trace };
  }

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
    fns: {
      factorVectors, dot2, constantSse, init, product, sse, alsStepV, alsStepU, als, cgdUpdate, sseEntry, cgdLecture, cgdRun, fillMissing, trainRecommend, holdoutCompare, paramCount,
      sseSheet, sseWalk, alsDetailWalk, cgdSheet, cgdSweepWalk, fillTex, fillWalk,
      predictOneCode, sseCode, alsStepVCode, alsCode, cgdUpdateCode, cgdWorkedCode, fillCode, ridgeCode,
    },
    generators: { dotQ, sseQ, alsColumnQ, cgdQ, paramsQ },
  };
}
