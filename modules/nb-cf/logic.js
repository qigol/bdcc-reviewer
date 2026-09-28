// Kodigo module: nb-cf (Neighborhood-based Collaborative Filtering + DCG/NDCG)
// Conventions verified against every table in the deck (see SOURCE_NOTES.md):
//  - ratings are mean-centered by the USER's mean over the items that user rated
//  - similarity = cosine of centered vectors over CO-RATED entries only (0 if no overlap or a zero norm)
//    user-based: rows compared over items both users rated; item-based ("adjusted cosine"): columns
//    compared over users who rated both items, still centered by user means
//  - neighbours: among peers (items) that rated (were rated by) the target, take the top-k by similarity,
//    then use only those with sim > 0; if none remain the prediction is blank
//  - prediction in centered space: ŝ = Σ sim·dev / Σ sim; final rating = ŝ + μ_u (slides stop at ŝ)
//  - DCG gain 2^rel − 1, discount log2(i + 1); IDCG uses the best k of all items
export default function register(sdk) {
  const EPS = 1e-12;

  function means(M) {
    return M.values.map((row) => {
      const o = row.filter((x) => x !== null && x !== undefined);
      return o.length ? o.reduce((a, b) => a + b, 0) / o.length : null;
    });
  }
  function centered(M) {
    const mu = means(M);
    return M.values.map((row, i) => row.map((x) => (x === null || x === undefined ? null : x - mu[i])));
  }
  function center({ matrix }) {
    const mu = means(matrix);
    const C = centered(matrix);
    return { rows: matrix.rows, cols: matrix.cols, values: C, means: mu, meansMap: Object.fromEntries(matrix.rows.map((r, i) => [r, mu[i]])) };
  }
  function rowMeans({ matrix }) {
    const mu = means(matrix);
    return { means: mu, map: Object.fromEntries(matrix.rows.map((r, i) => [r, mu[i]])) };
  }

  function vector(C, M, mode, label) {
    if (mode === 'item') {
      const j = M.cols.indexOf(label);
      if (j < 0) throw new Error(`unknown item ${label}`);
      return C.map((row) => row[j]);
    }
    const i = M.rows.indexOf(label);
    if (i < 0) throw new Error(`unknown user ${label}`);
    return C[i];
  }

  // roles: matrix (Matrix of ratings), code, formula
  function sim({ matrix, a, b, mode = 'user' }) {
    const C = centered(matrix);
    const va = vector(C, matrix, mode, a);
    const vb = vector(C, matrix, mode, b);
    const other = mode === 'item' ? matrix.rows : matrix.cols;
    const idx = [];
    for (let k = 0; k < va.length; k++) if (va[k] !== null && vb[k] !== null) idx.push(k);
    const xa = idx.map((k) => va[k]);
    const xb = idx.map((k) => vb[k]);
    const dot = xa.reduce((s, x, k) => s + x * xb[k], 0);
    const na = Math.sqrt(xa.reduce((s, x) => s + x * x, 0));
    const nb = Math.sqrt(xb.reduce((s, x) => s + x * x, 0));
    const value = na < EPS || nb < EPS ? 0 : dot / (na * nb);
    const corated = idx.map((k) => other[k]);
    const cells = (lab) => corated.map((o) => (mode === 'item' ? `cell:${o},${lab}` : `cell:${lab},${o}`));
    const r2 = (x) => Math.round(x * 100) / 100;
    return {
      sim: value, corated, overlap: idx.length, xa, xb, dot, na, nb,
      trace: [
        { label: `Co-rated ${mode === 'item' ? 'users' : 'items'}: ${corated.length ? corated.join(', ') : 'none → similarity 0'}`, code: 'corated', math: 'corated', vars: { overlap: idx.length },
          ops: [{ role: 'matrix', cmd: 'mask', args: { sel: [...cells(a), ...cells(b)] } }] },
        { label: `Dot product of the centered values = ${r2(dot)}`, code: 'dot', math: 'dot', vars: { dot } },
        { label: `Norms over the co-rated entries: ${r2(na)} and ${r2(nb)}`, code: 'norm', math: 'norm', vars: { na, nb } },
        { label: `sim(${a}, ${b}) = ${r2(dot)} / (${r2(na)} · ${r2(nb)}) = ${r2(value)}`, code: 'sim', math: 'sim', vars: { sim: value } },
      ],
    };
  }

  // roles: sims (Matrix of similarities, starts empty), matrix (ratings)
  function simMatrix({ matrix, mode = 'user' }) {
    const labels = mode === 'item' ? matrix.cols : matrix.rows;
    const values = labels.map(() => labels.map(() => null));
    const trace = [];
    for (let i = 0; i < labels.length; i++)
      for (let j = 0; j < labels.length; j++) {
        if (i === j) continue;
        const s = sim({ matrix, a: labels[i], b: labels[j], mode }).sim;
        values[i][j] = s;
        if (j < i) {
          trace.push({
            label: `sim(${labels[i]}, ${labels[j]}) = ${Math.round(s * 100) / 100}`, code: 'sim', math: 'sim', vars: { sim: s },
            ops: [
              { role: 'sims', cmd: 'fill', args: { cell: `${labels[i]},${labels[j]}`, value: s } },
              { role: 'sims', cmd: 'fill', args: { cell: `${labels[j]},${labels[i]}`, value: s } },
              { role: 'matrix', cmd: 'highlight', args: { sel: mode === 'item' ? [`col:${labels[i]}`, `col:${labels[j]}`] : [`row:${labels[i]}`, `row:${labels[j]}`], tone: 'accent' } },
            ],
          });
        }
      }
    return { rows: labels, cols: labels, values, empty: labels.map(() => labels.map(() => null)), trace };
  }

  // Prediction for one missing cell. roles: matrix (centered ratings Matrix), sims (similarity Matrix), code, formula
  function predict({ matrix, user, item, k, mode = 'user' }) {
    const C = centered(matrix);
    const mu = means(matrix);
    const ui = matrix.rows.indexOf(user);
    const ij = matrix.cols.indexOf(item);
    if (ui < 0 || ij < 0) throw new Error('unknown user or item');
    const cands = [];
    if (mode === 'user') {
      matrix.rows.forEach((peer, p) => {
        if (p === ui || C[p][ij] === null) return;
        cands.push({ label: peer, sim: sim({ matrix, a: user, b: peer, mode: 'user' }).sim, dev: C[p][ij], order: p });
      });
    } else {
      matrix.cols.forEach((other, q) => {
        if (q === ij || C[ui][q] === null) return;
        cands.push({ label: other, sim: sim({ matrix, a: item, b: other, mode: 'item' }).sim, dev: C[ui][q], order: q });
      });
    }
    cands.sort((x, y) => y.sim - x.sim || x.order - y.order);
    const top = cands.slice(0, k);
    const used = top.filter((c) => c.sim > EPS);
    const num = used.reduce((s, c) => s + c.sim * c.dev, 0);
    const den = used.reduce((s, c) => s + c.sim, 0);
    const blank = used.length === 0;
    const value = blank ? null : num / den;
    const rating = blank ? null : value + mu[ui];
    const tieAtCutoff = cands.length > k && Math.abs(cands[k - 1].sim - cands[k].sim) < 1e-9 && cands[k].sim > EPS;
    const r2 = (x) => (x === null ? '—' : Math.round(x * 100) / 100);
    const devCell = (c) => (mode === 'user' ? `cell:${c.label},${item}` : `cell:${user},${c.label}`);
    const simCell = (c) => (mode === 'user' ? `cell:${user},${c.label}` : `cell:${item},${c.label}`);
    const trace = [
      { label: `Candidates who ${mode === 'user' ? `rated ${item}` : `${user} rated`}: ${cands.map((c) => `${c.label} (${r2(c.sim)})`).join(', ') || 'none'}`, code: 'cands', math: 'cands',
        ops: [{ role: 'matrix', cmd: 'highlight', args: { sel: cands.map(devCell), tone: 'muted' } }, { role: 'sims', cmd: 'highlight', args: { sel: cands.map(simCell), tone: 'muted' } }] },
      { label: `Top-${k} by similarity: ${top.map((c) => c.label).join(', ') || 'none'}; keep only sim > 0: ${used.map((c) => c.label).join(', ') || 'none'}`, code: 'topk', math: 'topk',
        ops: [{ role: 'sims', cmd: 'highlight', args: { sel: used.map(simCell), tone: 'good' } }, { role: 'matrix', cmd: 'highlight', args: { sel: used.map(devCell), tone: 'accent' } }] },
      { label: blank ? 'No positive neighbour → leave the prediction blank' : `ŝ = (${used.map((c) => `${r2(c.sim)}·${r2(c.dev)}`).join(' + ')}) / (${used.map((c) => r2(c.sim)).join(' + ')}) = ${r2(value)}`, code: 'pred', math: 'pred', vars: { num, den, centered: value },
        ops: blank ? [] : [{ role: 'matrix', cmd: 'fill', args: { cell: `${user},${item}`, value } }] },
      { label: blank ? 'Nothing to add back' : `Add the mean back: ${r2(value)} + ${r2(mu[ui])} = ${r2(rating)}`, code: 'mean', math: 'mean', vars: { rating } },
    ];
    return { centered: value, mean: mu[ui], rating, blank, neighbors: cands.map((c) => ({ ...c, used: used.includes(c), top: top.includes(c) })), used: used.map((c) => c.label), top: top.map((c) => c.label), num, den, tieAtCutoff, trace };
  }

  // Predict every missing cell. Returns centered predictions and final ratings.
  function fill({ matrix, k, mode = 'user' }) {
    const C = centered(matrix);
    const mu = means(matrix);
    const pred = C.map((row) => row.slice());
    const ratings = matrix.values.map((row) => row.slice());
    const predicted = [];
    const trace = [];
    matrix.rows.forEach((u, i) => matrix.cols.forEach((it, j) => {
      if (matrix.values[i][j] !== null) return;
      const p = predict({ matrix, user: u, item: it, k, mode });
      predicted.push({ row: u, col: it, centered: p.centered, rating: p.rating });
      if (!p.blank) { pred[i][j] = p.centered; ratings[i][j] = p.rating; }
      trace.push({ label: `${u} · ${it}: ${p.blank ? 'blank (no positive neighbour)' : `ŝ = ${Math.round(p.centered * 100) / 100}`}`, code: 'pred', math: 'pred',
        ops: p.blank ? [{ role: 'matrix', cmd: 'highlight', args: { sel: `cell:${u},${it}`, tone: 'muted' } }] : [{ role: 'matrix', cmd: 'fill', args: { cell: `${u},${it}`, value: p.centered } }] });
    }));
    return { centeredMatrix: { rows: matrix.rows, cols: matrix.cols, values: pred }, ratingMatrix: { rows: matrix.rows, cols: matrix.cols, values: ratings }, predicted, means: mu, count: predicted.filter((p) => p.centered !== null).length, trace };
  }

  // roles: list (RankList), code, formula
  function dcg({ ratings, list, k, gain = 'exp2' }) {
    const kk = Math.min(k ?? list.length, list.length);
    const g = (r) => (gain === 'linear' ? r : Math.pow(2, r) - 1);
    const terms = [];
    let total = 0;
    const trace = [];
    for (let i = 0; i < kk; i++) {
      const id = list[i];
      const rel = ratings[id] ?? 0;
      const contrib = g(rel) / Math.log2(i + 2);
      total += contrib;
      terms.push({ pos: i + 1, id, rel, gain: g(rel), disc: Math.log2(i + 2), contrib });
      trace.push({ label: `Position ${i + 1}: ${id} (rel ${rel}) adds (2^${rel} − 1)/log₂(${i + 2}) = ${Math.round(contrib * 100) / 100}; DCG = ${Math.round(total * 100) / 100}`, code: 'term', math: 'term', vars: { dcg: total },
        ops: [{ role: 'list', cmd: 'highlight', args: { sel: `pos:${i + 1}`, tone: 'accent' } }] });
    }
    return { dcg: total, terms, k: kk, trace };
  }

  // roles: list (RankList), code, formula
  function ndcg({ ratings, list, k, gain = 'exp2' }) {
    const kk = Math.min(k ?? list.length, list.length);
    const ideal = Object.keys(ratings).sort((a, b) => ratings[b] - ratings[a] || (a < b ? -1 : 1)).slice(0, kk);
    const d = dcg({ ratings, list, k: kk, gain });
    const id = dcg({ ratings, list: ideal, k: kk, gain });
    const value = id.dcg > 0 ? d.dcg / id.dcg : 0;
    const r2 = (x) => Math.round(x * 100) / 100;
    return {
      dcg: d.dcg, idcg: id.dcg, ndcg: value, ideal, terms: d.terms, idealTerms: id.terms,
      trace: [
        ...d.trace.map((t) => ({ ...t, code: 'dcg', math: 'dcg' })),
        { label: `Ideal order (best ${kk} by true rating): ${ideal.join(', ')}`, code: 'idcg', math: 'idcg', ops: [{ role: 'list', cmd: 'sortIdeal' }] },
        { label: `IDCG = ${r2(id.dcg)}`, code: 'idcg', math: 'idcg', vars: { idcg: id.dcg } },
        { label: `NDCG = ${r2(d.dcg)} / ${r2(id.dcg)} = ${Math.round(value * 1000) / 1000}`, code: 'ndcg', math: 'ndcg', vars: { ndcg: value } },
      ],
    };
  }

  function dcgFromOrder({ ratings, order, k }) {
    return ndcg({ ratings, list: order, k });
  }

  // cosine of the first two 2-D vectors (for the VectorPlot scene)
  function vecCos({ vectors }) {
    const [a, b] = vectors;
    const na = Math.hypot(a.x, a.y), nb = Math.hypot(b.x, b.y);
    return { cos: na < EPS || nb < EPS ? 0 : (a.x * b.x + a.y * b.y) / (na * nb) };
  }

  // Significance weighting (beyond the slides): shrink similarities computed from few co-rated items
  function shrunkSim({ matrix, a, b, mode = 'user', beta = 3 }) {
    const s = sim({ matrix, a, b, mode });
    const w = Math.min(s.overlap, beta) / beta;
    return { sim: s.sim, overlap: s.overlap, weight: w, shrunk: s.sim * w };
  }

  // Top-n recommendations for one user (unrated items ranked by predicted rating)
  function recommend({ matrix, user, k, mode = 'user', n = 3 }) {
    const ui = matrix.rows.indexOf(user);
    const out = [];
    matrix.cols.forEach((it, j) => {
      if (matrix.values[ui][j] !== null) return;
      const p = predict({ matrix, user, item: it, k, mode });
      out.push({ item: it, rating: p.rating, centered: p.centered, used: p.used });
    });
    const ranked = out.filter((x) => x.rating !== null).sort((a, b) => b.rating - a.rating);
    return {
      items: ranked.slice(0, n), all: out, count: ranked.length, blank: out.filter((x) => x.rating === null).map((x) => x.item),
      top: ranked[0] ? ranked[0].item : null,
      table: { rows: ranked.map((r) => r.item), cols: ['predicted rating'], values: ranked.map((r) => [r.rating]) },
      text: ranked.map((r) => `${r.item} (${Math.round(r.rating * 10) / 10})`).join(', ') || 'none',
    };
  }

  // Hide some known ratings of a user, predict them, rank, score with NDCG against the truth
  function holdout({ matrix, user, hide, k, mode = 'user' }) {
    const ui = matrix.rows.indexOf(user);
    const masked = { rows: matrix.rows, cols: matrix.cols, values: matrix.values.map((r, i) => r.map((x, j) => (i === ui && hide.includes(matrix.cols[j]) ? null : x))) };
    const truth = {};
    const preds = [];
    for (const it of hide) {
      const j = matrix.cols.indexOf(it);
      truth[it] = matrix.values[ui][j];
      const p = predict({ matrix: masked, user, item: it, k, mode });
      preds.push({ item: it, pred: p.rating === null ? -Infinity : p.rating, shown: p.rating });
    }
    const order = preds.slice().sort((a, b) => b.pred - a.pred || (a.item < b.item ? -1 : 1)).map((p) => p.item);
    const n = ndcg({ ratings: truth, list: order, k: order.length });
    const rmseParts = preds.filter((p) => p.shown !== null).map((p) => Math.pow(p.shown - truth[p.item], 2));
    return { order, truth, predictions: preds.map((p) => ({ item: p.item, predicted: p.shown, actual: truth[p.item] })), ndcg: n.ndcg, dcg: n.dcg, idcg: n.idcg,
      rmse: rmseParts.length ? Math.sqrt(rmseParts.reduce((a, b) => a + b, 0) / rmseParts.length) : null,
      table: { rows: preds.map((p) => p.item), cols: ['predicted', 'actual'], values: preds.map((p) => [p.shown, truth[p.item]]) } };
  }

  // ---------------------------------------------------------------- quiz generators
  const LETTERS = ['A', 'B', 'C', 'D', 'E'];
  const ITEMS = ['i1', 'i2', 'i3', 'i4', 'i5', 'i6'];
  function randMatrix(rng, nu, ni, missing, lo = 1, hi = 5) {
    const values = Array.from({ length: nu }, () => Array.from({ length: ni }, () => rng.int(lo, hi)));
    let holes = 0;
    while (holes < missing) {
      const i = rng.int(0, nu - 1), j = rng.int(0, ni - 1);
      if (values[i][j] === null) continue;
      if (values[i].filter((x) => x !== null).length <= 2) continue;
      values[i][j] = null;
      holes++;
    }
    return { rows: LETTERS.slice(0, nu), cols: ITEMS.slice(0, ni), values };
  }
  const near = (a, b, t = 0.011) => Math.abs(a - b) < t;

  function meanQ({ rng }) {
    for (;;) {
      const M = randMatrix(rng, 3, 5, 3);
      const u = rng.int(0, 2);
      const row = M.values[u];
      const obs = row.filter((x) => x !== null);
      if (obs.length === row.length) continue;
      const mu = obs.reduce((a, b) => a + b, 0) / obs.length;
      const wrongAll = obs.reduce((a, b) => a + b, 0) / row.length;
      if (near(mu, wrongAll)) continue;
      return { vars: { matrix: M, user: M.rows[u], mean: mu, wrongAll, sum: obs.reduce((a, b) => a + b, 0), n: obs.length, ni: row.length }, misconceptions: [
        { var: 'wrongAll', feedback: 'You divided by every item, including the ones the user never rated. μᵤ averages only the **observed** ratings.' },
        { var: 'sum', feedback: 'That is the sum; divide by the number of ratings.' },
      ] };
    }
  }

  function centerQ({ rng }) {
    for (;;) {
      const M = randMatrix(rng, 3, 5, 3);
      const u = rng.int(0, 2);
      const j = rng.int(0, 4);
      if (M.values[u][j] === null) continue;
      const mu = means(M)[u];
      const dev = M.values[u][j] - mu;
      if (Math.abs(dev) < 0.05) continue;
      const colMu = (() => { const o = M.values.map((r) => r[j]).filter((x) => x !== null); return o.reduce((a, b) => a + b, 0) / o.length; })();
      const wrongCol = M.values[u][j] - colMu;
      if (near(wrongCol, dev)) continue;
      return { vars: { matrix: M, user: M.rows[u], item: M.cols[j], r: M.values[u][j], mean: mu, dev, wrongSign: -dev, wrongCol }, misconceptions: [
        { var: 'wrongSign', feedback: 'Sign flipped: centered value = rating − μᵤ.' },
        { var: 'wrongCol', feedback: 'You subtracted the **item** (column) mean. The lecture centers by the **user** (row) mean.' },
      ] };
    }
  }

  function simQ({ rng, difficulty }) {
    for (;;) {
      const ni = difficulty === 3 ? 6 : 5;
      const M = randMatrix(rng, 2, ni, difficulty === 1 ? 1 : 3);
      const s = sim({ matrix: M, a: 'A', b: 'B', mode: 'user' });
      if (s.overlap < 2 || s.na < 1e-9 || s.nb < 1e-9) continue;
      if (Math.abs(s.sim) > 0.999) continue;
      // raw cosine over co-rated (forgot to center)
      const idx = M.cols.map((_, j) => j).filter((j) => M.values[0][j] !== null && M.values[1][j] !== null);
      const ra = idx.map((j) => M.values[0][j]), rb = idx.map((j) => M.values[1][j]);
      const rawCos = ra.reduce((t, x, q) => t + x * rb[q], 0) / (Math.sqrt(ra.reduce((t, x) => t + x * x, 0)) * Math.sqrt(rb.reduce((t, x) => t + x * x, 0)));
      if (near(rawCos, s.sim)) continue;
      const mu = means(M);
      return { vars: { matrix: M, sim: s.sim, overlap: s.overlap, corated: s.corated, dot: s.dot, na: s.na, nb: s.nb, rawCos, muA: mu[0], muB: mu[1] }, misconceptions: [
        { var: 'rawCos', feedback: 'You used the raw ratings. Mean-center each user first (subtract μᵤ), then take the cosine.' },
        { value: -s.sim, feedback: 'Check the signs of the centered values: the magnitude is right but the sign is flipped.' },
      ] };
    }
  }

  function neighborsQ({ rng }) {
    for (;;) {
      const M = randMatrix(rng, 5, 5, 5);
      const u = rng.int(0, 4);
      const holes = M.cols.map((_, j) => j).filter((j) => M.values[u][j] === null);
      if (!holes.length) continue;
      const j = rng.pick(holes);
      const k = rng.pick([2, 3]);
      const p = predict({ matrix: M, user: M.rows[u], item: M.cols[j], k, mode: 'user' });
      const cands = p.neighbors;
      if (cands.length < k + 1 || p.tieAtCutoff || !p.used.length) continue;
      if (!cands.some((c) => c.sim <= 1e-9)) continue;
      const sims = { rows: [M.rows[u]], cols: cands.map((c) => c.label), values: [cands.map((c) => c.sim)] };
      const answer = cands.map((c, i) => (c.used ? i : -1)).filter((i) => i >= 0);
      return { vars: { matrix: M, user: M.rows[u], item: M.cols[j], k, sims, used: p.used }, options: cands.map((c) => `${c.label} (sim ${Math.round(c.sim * 100) / 100})`), answer };
    }
  }

  function ubPredictQ({ rng, difficulty }) {
    for (;;) {
      const M = randMatrix(rng, difficulty === 3 ? 5 : 4, 5, difficulty === 3 ? 5 : 4);
      const u = rng.int(0, M.rows.length - 1);
      const holes = M.cols.map((_, j) => j).filter((j) => M.values[u][j] === null);
      if (!holes.length) continue;
      const j = rng.pick(holes);
      const k = 2;
      const p = predict({ matrix: M, user: M.rows[u], item: M.cols[j], k, mode: 'user' });
      if (p.blank || p.tieAtCutoff || p.used.length < (difficulty === 1 ? 1 : 2)) continue;
      const C = center({ matrix: M });
      const s = simMatrix({ matrix: M, mode: 'user' });
      const allUsed = p.neighbors.filter((c) => c.top);
      const wrongNoMean = p.centered;
      const wrongAllNeighbors = allUsed.length ? allUsed.reduce((a, c) => a + c.sim * c.dev, 0) / allUsed.reduce((a, c) => a + Math.abs(c.sim), 0) + p.mean : p.rating;
      if (near(wrongNoMean, p.rating) || near(wrongAllNeighbors, p.rating) && allUsed.some((c) => !c.used)) continue;
      return { vars: { matrix: M, centeredM: { rows: C.rows, cols: C.cols, values: C.values }, sims: { rows: s.rows, cols: s.cols, values: s.values }, user: M.rows[u], item: M.cols[j], k,
        mean: p.mean, pred: p.centered, rating: p.rating, num: p.num, den: p.den, used: p.used, top: p.top, wrongNoMean, wrongAllNeighbors },
        misconceptions: [
          { var: 'wrongNoMean', feedback: 'That is the prediction in **centered** space. Add the user\'s mean μᵤ back to get a rating.' },
          { var: 'wrongAllNeighbors', feedback: 'Only neighbours with **sim > 0** are used; drop the negative ones from the top-k.' },
        ] };
    }
  }

  function ibPredictQ({ rng }) {
    for (;;) {
      const M = randMatrix(rng, 4, 5, 4);
      const u = rng.int(0, 3);
      const holes = M.cols.map((_, j) => j).filter((j) => M.values[u][j] === null);
      if (!holes.length) continue;
      const j = rng.pick(holes);
      const p = predict({ matrix: M, user: M.rows[u], item: M.cols[j], k: 2, mode: 'item' });
      if (p.blank || p.tieAtCutoff) continue;
      const C = center({ matrix: M });
      const s = simMatrix({ matrix: M, mode: 'item' });
      const wrongRaw = (() => { const used = p.neighbors.filter((c) => c.used); return used.reduce((a, c) => a + c.sim * M.values[u][M.cols.indexOf(c.label)], 0) / used.reduce((a, c) => a + c.sim, 0); })();
      if (near(wrongRaw, p.centered) || near(p.rating, p.centered)) continue;
      return { vars: { matrix: M, centeredM: { rows: C.rows, cols: C.cols, values: C.values }, sims: { rows: s.rows, cols: s.cols, values: s.values }, user: M.rows[u], item: M.cols[j], pred: p.centered, rating: p.rating, mean: p.mean, used: p.used, wrongRaw },
        misconceptions: [
          { var: 'wrongRaw', feedback: 'Use the user\'s **centered** ratings of the neighbour items, not the raw ratings.' },
          { var: 'rating', feedback: 'The question asks for the centered prediction ŝ (as on the slides), before adding μᵤ.' },
        ] };
    }
  }

  const DCG_IDS = ['A', 'B', 'C', 'D', 'E', 'F'];
  function dcgQ({ rng, difficulty }) {
    for (;;) {
      const n = difficulty === 1 ? 4 : 6;
      const ids = DCG_IDS.slice(0, n);
      const ratings = Object.fromEntries(ids.map((i) => [i, rng.int(0, 5)]));
      const k = difficulty === 1 ? 3 : 4;
      const list = rng.shuffle(ids).slice(0, k);
      const d = dcg({ ratings, list, k });
      const lin = dcg({ ratings, list, k, gain: 'linear' }).dcg;
      const wrongDisc = list.reduce((s, id, i) => s + (Math.pow(2, ratings[id]) - 1) / (i === 0 ? 1 : Math.log2(i + 1)), 0);
      if (d.dcg < 1 || near(lin, d.dcg, 0.05) || near(wrongDisc, d.dcg, 0.05)) continue;
      const nd = ndcg({ ratings, list, k });
      return { vars: { ratings, list, k, dcg: d.dcg, idcg: nd.idcg, ndcg: nd.ndcg, ideal: nd.ideal, wrongLinear: lin, wrongDisc,
        ratingsText: ids.map((i) => `${i}: ${ratings[i]}`).join(', '), terms: d.terms.map((t) => `(2^${t.rel}−1)/log₂(${t.pos + 1}) = ${Math.round(t.contrib * 100) / 100}`).join(' + ') },
        misconceptions: [
          { var: 'wrongLinear', feedback: 'The lecture uses gain **2^rel − 1**, not the raw rating.' },
          { var: 'wrongDisc', feedback: 'Position i is discounted by **log₂(i + 1)**: log₂2 = 1 for the top item, log₂3 for the second, and so on.' },
        ] };
    }
  }

  function ndcgQ({ rng }) {
    for (;;) {
      const ids = DCG_IDS.slice(0, 5);
      const ratings = Object.fromEntries(ids.map((i) => [i, rng.int(1, 5)]));
      const k = 3;
      const list = rng.shuffle(ids).slice(0, k);
      const nd = ndcg({ ratings, list, k });
      if (nd.ndcg > 0.97 || nd.ndcg < 0.2) continue;
      const wrongNoIdeal = nd.dcg;
      return { vars: { ratings, list, k, dcg: nd.dcg, idcg: nd.idcg, ndcg: nd.ndcg, ideal: nd.ideal, top: nd.ideal[0], topRel: ratings[nd.ideal[0]], wrongNoIdeal,
        ratingsText: ids.map((i) => `${i}: ${ratings[i]}`).join(', ') } };
    }
  }

  return {
    fns: { vecCos, center, rowMeans, sim, simMatrix, predict, fill, dcg, ndcg, dcgFromOrder, shrunkSim, recommend, holdout },
    generators: { meanQ, centerQ, simQ, neighborsQ, ubPredictQ, ibPredictQ, dcgQ, ndcgQ },
  };
}
