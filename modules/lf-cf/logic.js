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

  // ---------------------------------------------------------------- line-by-line code traces
  // anchors: u, init, loop, v, p, ret
  function predictOneCode({ U, V, cells = [[0, 0]] }) {
    const trace = [];
    const d = U.values[0].length;
    for (const [i, j] of cells) {
      trace.push({ label: `\`u_i = U[${i}]\`: user ${U.rows[i]}'s factors (${U.values[i].map((x) => dn(x, 4)).join(', ')})`, code: 'u', math: 'u', vars: { u_i: U.values[i].map((x) => +x.toFixed(4)) } });
      let p = 0;
      trace.push({ label: '`p = 0.0`', code: 'init', math: 'init', vars: { p } });
      for (let s = 0; s < d; s++) {
        trace.push({ label: `\`for s\`: factor s = ${s + 1} of ${d}`, code: 'loop', math: 'loop', vars: { s: s + 1 } });
        trace.push({ label: `\`v_sj = V[${s}][${j}]\` = ${dn(V.values[s][j], 4)} (item ${V.cols[j]})`, code: 'v', math: 'v', vars: { v_sj: V.values[s][j] } });
        p += U.values[i][s] * V.values[s][j];
        trace.push({ label: `\`p += u_i[s] * v_sj\`: + (${dn(U.values[i][s], 4)})(${dn(V.values[s][j], 4)}) → p = ${dn(p, 4)}`, code: 'p', math: 'p', vars: { p } });
      }
      trace.push({ label: `\`return p\`: prediction for (${U.rows[i]}, ${V.cols[j]}) = ${dn(p, 4)}`, code: 'ret', math: 'ret', vars: { p } });
    }
    return { trace };
  }

  // anchors: init, loop, obs, err, add, ret
  function sseCode({ R, U, V }) {
    const { values: P } = product({ U, V });
    let total = 0;
    const trace = [{ label: '`total = 0.0`', code: 'init', math: 'init', vars: { total } }];
    R.values.forEach((row, i) => row.forEach((r, j) => {
      trace.push({ label: `\`for i, j\`: cell (${R.rows[i]}, ${R.cols[j]}), rating ${r === null ? 'None' : r}`, code: 'loop', math: 'loop', vars: { i: R.rows[i], j: R.cols[j] } });
      if (r === null) { trace.push({ label: '`R[i][j] is None` → `continue`: a blank carries no error', code: 'obs', math: 'obs', vars: { observed: 'False' } }); return; }
      const e = r - P[i][j];
      trace.push({ label: `\`e = R[i][j] - predict_one(...)\` = ${r} − ${dn(P[i][j], 3)} = ${dn(e, 3)}`, code: 'err', math: 'err', vars: { e } });
      total += e * e;
      trace.push({ label: `\`total += e * e\`: + ${dn(e * e, 3)} → total = ${dn(total, 3)}`, code: 'add', math: 'add', vars: { total } });
    }));
    trace.push({ label: `\`return total\` = ${dn(total, 3)}`, code: 'ret', math: 'ret', vars: { sse: total } });
    return { sse: total, trace };
  }

  // anchors: freeze, loop, obs, solve, store
  function alsStepVCode({ R, U }) {
    const d = U.values[0].length;
    const trace = [{ label: `\`V\` starts as a ${d} × ${R.cols.length} table of zeros; U stays frozen`, code: 'freeze', math: 'freeze', vars: { d, n: R.cols.length } }];
    const V = { rows: factorNames(d), cols: R.cols, values: Array.from({ length: d }, () => Array(R.cols.length).fill(0)) };
    R.cols.forEach((c, j) => {
      trace.push({ label: `\`for j\`: item ${c}`, code: 'loop', math: 'loop', vars: { j: c } });
      const rows = R.values.map((row, i) => i).filter((i) => R.values[i][j] !== null);
      const b = rows.map((i) => R.values[i][j]);
      trace.push({ label: `Observed raters: ${rows.map((i) => R.rows[i]).join(', ')}; \`b\` = [${b.join(', ')}]`, code: 'obs', math: 'obs', vars: { b } });
      trace.push({ label: `\`A\` = their frozen rows of U: ${rows.map((i) => `(${U.values[i].map((x) => dn(x, 3)).join(', ')})`).join(' ')}`, code: 'freeze', math: 'freeze', vars: { rows: rows.length } });
      const st = solveTex(R, U, { values: [[0], [0]] }, 'V', j);
      trace.push({ label: `\`lstsq(A, b)\`: ${st.text.replace(`${c} `, '')}`, code: 'solve', math: 'solve', vars: { v: st.v.map((x) => +x.toFixed(4)) } });
      st.v.forEach((x, s) => (V.values[s][j] = x));
      trace.push({ label: `Store column ${c} of V: (${st.v.map((x) => dn(x, 4)).join(', ')})`, code: 'store', math: 'store', vars: { V_col: st.v.map((x) => +x.toFixed(4)) } });
    });
    return { V, trace };
  }

  // anchors: init, loop, solve-v, solve-u, sse
  function alsCode({ R, iters = 3, initKind = 'ones', seed = 7 }) {
    let { U, V } = init({ R, d: 2, kind: initKind, seed });
    const trace = [{ label: `\`U\` = ${initKind === 'ones' ? 'all ones' : 'random numbers between 0.5 and 1.5'}; SSE = ${dn(sse({ R, U, V }).sse, 3)}`, code: 'init', math: 'init', vars: { U_row1: U.values[0].map((x) => +x.toFixed(3)) } }];
    for (let t = 0; t < iters; t++) {
      trace.push({ label: `\`for t\`: iteration ${t + 1} of ${iters}`, code: 'loop', math: 'loop', vars: { t: t + 1 } });
      V = alsStepV({ R, U }).V;
      trace.push({ label: `\`V = als_step_V(R, U)\`: 5 least-squares fits, SSE = ${dn(sse({ R, U, V }).sse, 3)}`, code: 'solve-v', math: 'solve-v', vars: { V_col1: V.values.map((r) => +r[0].toFixed(3)) } });
      U = alsStepU({ R, V }).U;
      trace.push({ label: `\`U = als_step_U(R, V)\`: 5 least-squares fits, SSE = ${dn(sse({ R, U, V }).sse, 3)}`, code: 'solve-u', math: 'solve-u', vars: { U_row1: U.values[0].map((x) => +x.toFixed(4)) } });
      trace.push({ label: `\`print\`: iteration ${t + 1}, SSE ${dn(sse({ R, U, V }).sse, 3)}${U.values.every((r) => Math.abs(r[0] - r[1]) < 1e-9) ? ' (columns of U still identical)' : ''}`, code: 'sse', math: 'sse', vars: { sse: sse({ R, U, V }).sse } });
    }
    return { trace };
  }

  // anchors: init, loop, rest, num, den, closed   (which = 'U' updates u_is, 'V' updates v_sj)
  function cgdUpdateCode({ R, U, V, which = 'U', i = 0, s = 0, j = 0 }) {
    const d = U.values[0].length;
    const trace = [{ label: '`num = den = 0.0`', code: 'init', math: 'init', vars: { num: 0, den: 0 } }];
    let num = 0, den = 0;
    const n = which === 'U' ? R.cols.length : R.rows.length;
    for (let q = 0; q < n; q++) {
      const ii = which === 'U' ? i : q, jj = which === 'U' ? q : j;
      const r = R.values[ii][jj];
      trace.push({ label: `\`for ${which === 'U' ? 'j' : 'i'}\`: cell (${R.rows[ii]}, ${R.cols[jj]}), rating ${r === null ? 'None → `continue`' : r}`, code: 'loop', math: 'loop', vars: { [which === 'U' ? 'j' : 'i']: which === 'U' ? R.cols[jj] : R.rows[ii] } });
      if (r === null) continue;
      let rest = 0;
      const parts = [];
      for (let t = 0; t < d; t++) if (t !== s) { rest += U.values[ii][t] * V.values[t][jj]; parts.push(`(${dn(U.values[ii][t], 3)})(${dn(V.values[t][jj], 3)})`); }
      trace.push({ label: `\`rest\` = other factors' part = ${parts.join(' + ')} = ${dn(rest, 3)}`, code: 'rest', math: 'rest', vars: { rest } });
      const f = which === 'U' ? V.values[s][jj] : U.values[ii][s];
      num += f * (r - rest);
      trace.push({ label: `\`num += ${which === 'U' ? 'V[s][j]' : 'U[i][s]'} * (r - rest)\`: + (${dn(f, 3)})(${r} − ${dn(rest, 3)}) = + ${dn(f * (r - rest), 3)} → num = ${dn(num, 3)}`, code: 'num', math: 'num', vars: { num } });
      den += f * f;
      trace.push({ label: `\`den += ${which === 'U' ? 'V[s][j]' : 'U[i][s]'} ** 2\`: + ${dn(f * f, 3)} → den = ${dn(den, 3)}`, code: 'den', math: 'den', vars: { den } });
    }
    trace.push({ label: `\`${which === 'U' ? `U[${i}][${s}]` : `V[${s}][${j}]`} = num / den\` = ${dn(num, 3)} / ${dn(den, 3)} = ${dn(num / den, 4)}`, code: 'closed', math: 'closed', vars: { value: num / den } });
    return { value: num / den, trace };
  }

  // Lecture CGD walk for the Math & Code tab: x via update_u, then y line by line via update_v.
  // anchors: start, x, init, loop, rest, num, den, update
  function cgdWorkedCode({ R }) {
    const st = init({ R, d: 2, kind: 'ones' });
    const a = cgdUpdate({ R, U: st.U, V: st.V, which: 'U', i: 0, s: 0 });
    const t = [{ label: `\`U, V\` = all ones: every prediction is 2, SSE = ${dn(a.sseBefore)}`, code: 'start', math: 'start', vars: { sse: a.sseBefore } },
      { label: `\`update_u(i=0, s=0)\`: x = u₁₁ = ${dn(a.num)}/${dn(a.den)} = ${dn(a.value)}; SSE ${dn(a.sseBefore)} → ${dn(a.sseAfter)}`, code: 'x', math: 'x', vars: { x: a.value } }];
    const inner = cgdUpdateCode({ R, U: a.U, V: a.V, which: 'V', s: 0, j: 0 }).trace.map((s) => ({ ...s, code: s.code === 'closed' ? 'update' : s.code, math: s.math === 'closed' ? 'update' : s.math }));
    inner[0] = { ...inner[0], label: `\`update_v(s=0, j=0)\` starts: ${inner[0].label}`, code: 'init', math: 'init' };
    const b = cgdUpdate({ R, U: a.U, V: a.V, which: 'V', s: 0, j: 0 });
    return { x: a.value, y: b.value, trace: [...t, ...inner, { label: `y = v₁₁ = ${dn(b.value, 4)}; SSE ${dn(b.sseBefore)} → ${dn(b.sseAfter)}`, code: 'y', math: 'y', vars: { y: b.value } }] };
  }

  // anchors: fit, loop, fill
  function fillCode({ R, U, V }) {
    const f = fillTex({ R, U, V });
    const trace = [{ label: `\`U, V\` trained; training SSE = ${dn(sse({ R, U, V }).sse)}`, code: 'fit', math: 'fit', vars: { sse: sse({ R, U, V }).sse } }];
    f.cells.forEach((c) => {
      trace.push({ label: `\`for i, j in missing\`: cell (${c.cell.replace(',', ', ')})`, code: 'loop', math: 'loop', vars: { cell: c.cell } });
      trace.push({ label: `$${c.tex}$`, code: 'fill', math: 'fill', vars: { p: c.value } });
    });
    return { trace };
  }

  // anchors: loop, lam, ridge
  function ridgeCode({ R, U, lambda = 1 }) {
    const trace = [];
    const d = U.values[0].length;
    R.cols.forEach((c, j) => {
      const rows = R.values.map((_, i) => i).filter((i) => R.values[i][j] !== null);
      trace.push({ label: `\`for j\`: item ${c}, observed raters ${rows.map((i) => R.rows[i]).join(', ')}`, code: 'loop', math: 'loop', vars: { j: c } });
      const Uo = rows.map((i) => U.values[i]);
      const A = Array.from({ length: d }, (_, p) => Array.from({ length: d }, (_, q) => Uo.reduce((t, u) => t + u[p] * u[q], 0) + (p === q ? lambda : 0)));
      trace.push({ label: `\`A = Uoᵀ Uo + λI\` = [${A.map((r) => `[${r.map((x) => dn(x, 3)).join(', ')}]`).join(', ')}]`, code: 'lam', math: 'lam', vars: { A: A.map((r) => r.map((x) => +x.toFixed(3))) } });
      const rhs = Array.from({ length: d }, (_, p) => rows.reduce((t, i) => t + U.values[i][p] * R.values[i][j], 0));
      const v = solve(A, rhs);
      trace.push({ label: `\`solve(A, Uoᵀ r)\` with Uoᵀ r = (${rhs.map((x) => dn(x, 3)).join(', ')}) → v = (${v.map((x) => dn(x, 3)).join(', ')})`, code: 'ridge', math: 'ridge', vars: { v: v.map((x) => +x.toFixed(4)) } });
    });
    return { trace };
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
