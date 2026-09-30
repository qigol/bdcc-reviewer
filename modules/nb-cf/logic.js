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
    const d = (x) => String(+(+x).toFixed(2));
    const p = (x) => `(${d(x)})`;
    const dot = a.x * b.x + a.y * b.y;
    const cos = na < EPS || nb < EPS ? 0 : dot / (na * nb);
    return {
      cos, dot, na, nb,
      tex: `\\frac{${p(a.x)}${p(b.x)} + ${p(a.y)}${p(b.y)}}{\\sqrt{${d(a.x)}^2 + ${d(a.y)}^2}\\,\\sqrt{${d(b.x)}^2 + ${d(b.y)}^2}} = \\frac{${d(dot)}}{${d(na)} \\times ${d(nb)}} = ${d(cos)}`,
    };
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

  // ---------------------------------------------------------------- solve-along helpers
  // Numbers are shown the way the slides show them: thirds as fractions (HP matrix), tenths as decimals (a–f matrix).
  function fracParts(x, maxDen = 12) {
    for (let den = 1; den <= maxDen; den++) {
      const num = Math.round(x * den);
      if (Math.abs(num / den - x) < 1e-9) return [num, den];
    }
    return null;
  }
  const dec = (x) => String(+(+x).toFixed(2)).replace(/^-0$/, '0');
  // TeX for a number in a style ('frac' | 'dec')
  function tn(x, style = 'dec') {
    if (x === null || x === undefined) return '\\text{—}';
    if (style === 'frac') {
      const f = fracParts(x, 12);
      if (f && f[1] !== 1) return `${f[0] < 0 ? '-' : ''}\\tfrac{${Math.abs(f[0])}}{${f[1]}}`;
      if (f) return String(f[0]);
      const g = fracParts(x, 81);
      if (g && g[1] !== 1) return `${g[0] < 0 ? '-' : ''}\\tfrac{${Math.abs(g[0])}}{${g[1]}}`;
    }
    return dec(x);
  }
  const pn = (x, style) => `(${tn(x, style)})`; // parenthesized, as the slides write products
  // a derived value (norm, product): a small fraction when exact in the frac style, else 2 dp
  const tr = (x, style) => (style === 'frac' && fracParts(x, 12) ? tn(x, 'frac') : dec(x));
  const approxT = (x, style) => (style === 'frac' && fracParts(x, 81) && fracParts(x, 81)[1] !== 1 ? ` \\approx ${dec(x)}` : '');
  function styleOf(M) {
    const C = centered(M);
    return C.flat().every((x) => x === null || Math.abs(x * 100 - Math.round(x * 100)) < 1e-9) ? 'dec' : 'frac';
  }
  const lab = (x) => `\\text{${x}}`;

  // Worksheet for one similarity: the co-rated entries side by side, their products and squares, and the sums.
  function simSheet({ matrix, a, b, mode = 'user' }) {
    const st = styleOf(matrix);
    const s = sim({ matrix, a, b, mode });
    const over = mode === 'item' ? 'users' : 'items';
    const rows = s.corated.length ? [...s.corated, 'Σ'] : ['Σ'];
    const cols = [`s(${a})`, `s(${b})`, 'product', `s(${a})²`, `s(${b})²`];
    const values = s.corated.map((o, k) => [s.xa[k], s.xb[k], s.xa[k] * s.xb[k], s.xa[k] ** 2, s.xb[k] ** 2]);
    const ssa = s.na ** 2, ssb = s.nb ** 2;
    values.push([null, null, s.dot, ssa, ssb]);
    const pair = `\\text{sim}(${lab(a)}, ${lab(b)})`;
    const dotTex = s.overlap ? s.xa.map((x, k) => `${pn(x, st)}${pn(s.xb[k], st)}`).join(' + ') : '0';
    const zero = s.na < EPS || s.nb < EPS;
    let simTex;
    if (!s.overlap) simTex = `${pair} = 0 \\quad (\\text{no co-rated ${over}})`;
    else if (zero) simTex = `${pair}: \\ \\|${lab(s.na < EPS ? a : b)}\\| = 0 \\;\\Rightarrow\\; ${pair} = 0`;
    else simTex = `${pair} = \\frac{${dotTex}}{\\sqrt{${tn(ssa, st)}}\\,\\sqrt{${tn(ssb, st)}}} = \\frac{${tn(s.dot, st)}}{${tr(s.na, st)} \\times ${tr(s.nb, st)}} = \\frac{${dec(s.dot)}}{${dec(s.na * s.nb)}} = ${dec(s.sim)}`;
    const why = !s.overlap
      ? `${a} and ${b} have no co-rated ${over}, so there is nothing to compare: similarity 0.`
      : zero
        ? `${s.na < EPS ? a : b}'s centered values on the co-rated ${over} are all 0: a zero vector has no direction, so similarity 0.`
        : `${s.overlap} co-rated ${over}: ${s.corated.join(', ')}.`;
    return {
      rows, cols, values, sim: s.sim, dot: s.dot, na: s.na, nb: s.nb, ssa, ssb, overlap: s.overlap, corated: s.corated,
      style: st, dotTex, simTex, why, title: `${mode === 'item' ? 'Item' : 'User'} pair (${a}, ${b}): ${s.overlap ? `co-rated ${over} ${s.corated.join(', ')}` : `no co-rated ${over}`}`,
      cells: [...s.corated.map((o) => (mode === 'item' ? `cell:${o},${a}` : `cell:${a},${o}`)), ...s.corated.map((o) => (mode === 'item' ? `cell:${o},${b}` : `cell:${b},${o}`))],
    };
  }

  // Every pair, fully solved: co-rated entries, dot product, norms, similarity.
  // roles: matrix (centered ratings), sheet (Matrix from simSheet), sims (similarity Matrix, starts empty). Patches pair.
  function simWalk({ matrix, mode = 'user' }) {
    const labels = mode === 'item' ? matrix.cols : matrix.rows;
    const trace = [];
    let n = 0;
    for (let i = 1; i < labels.length; i++) {
      for (let j = 0; j < i; j++) {
        const a = labels[i], b = labels[j];
        const ws = simSheet({ matrix, a, b, mode });
        const st = ws.style;
        const pair = { a, b };
        const fill = [
          { role: 'sims', cmd: 'fill', args: { cell: `${a},${b}`, value: ws.sim } },
          { role: 'sims', cmd: 'fill', args: { cell: `${b},${a}`, value: ws.sim } },
        ];
        n++;
        if (!ws.overlap) {
          trace.push({ label: `sim(${a}, ${b}): no ${mode === 'item' ? 'user rated both' : 'item rated by both'} → **0**`, vars: { sim: 0 }, patch: { pair },
            ops: [...fill, { role: 'sims', cmd: 'highlight', args: { sel: `cell:${a},${b}`, tone: 'muted' } }] });
          continue;
        }
        trace.push({ label: `sim(${a}, ${b}): co-rated ${mode === 'item' ? 'users' : 'items'} ${ws.corated.join(', ')}. Line up the centered values.`, patch: { pair },
          ops: [{ role: 'matrix', cmd: 'mask', args: { sel: ws.cells } }, { role: 'sims', cmd: 'highlight', args: { sel: `cell:${a},${b}`, tone: 'accent' } }] });
        trace.push({ label: `Dot product: $${ws.dotTex} = ${tn(ws.dot, st)}$`, vars: { dot: ws.dot }, patch: { pair },
          ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: 'col:product', tone: 'accent' } }, { role: 'matrix', cmd: 'mask', args: { sel: ws.cells } }] });
        if (ws.na < EPS || ws.nb < EPS) {
          trace.push({ label: `${ws.na < EPS ? a : b} is all zeros here, so its norm is 0 → sim = **0**`, vars: { sim: 0 }, patch: { pair },
            ops: [...fill, { role: 'sheet', cmd: 'highlight', args: { sel: ['row:Σ'], tone: 'warn' } }] });
        } else {
          trace.push({ label: `Norms $\\sqrt{${tn(ws.ssa, st)}} = ${tr(ws.na, st)}$ and $\\sqrt{${tn(ws.ssb, st)}} = ${tr(ws.nb, st)}$ → sim $= \\frac{${dec(ws.dot)}}{${dec(ws.na)} \\times ${dec(ws.nb)}} = \\frac{${dec(ws.dot)}}{${dec(ws.na * ws.nb)}} = ${dec(ws.sim)}$`,
            vars: { sim: ws.sim }, patch: { pair },
            ops: [...fill, { role: 'sheet', cmd: 'highlight', args: { sel: ['row:Σ'], tone: 'good' } }, { role: 'sims', cmd: 'highlight', args: { sel: `cell:${a},${b}`, tone: 'good' } }] });
        }
      }
    }
    trace.push({ label: `All ${n} pairs done. The matrix is symmetric: sim(u, v) = sim(v, u).`, patch: { pair: { a: labels[1], b: labels[0] } } });
    return { pairs: n, trace };
  }

  // Means and centered values, one user at a time. roles: raw (ratings Matrix with row means), cen (centered Matrix, starts empty)
  function centerWalk({ matrix }) {
    const st = styleOf(matrix);
    const mu = means(matrix);
    const trace = [];
    matrix.rows.forEach((u, i) => {
      const obs = matrix.values[i].map((x, j) => ({ x, j })).filter((o) => o.x !== null);
      const sum = obs.reduce((t, o) => t + o.x, 0);
      trace.push({
        label: `$\\mu_{${lab(u)}} = \\frac{${obs.map((o) => o.x).join(' + ')}}{${obs.length}} = \\frac{${sum}}{${obs.length}} = ${tn(mu[i], st)}${approxT(mu[i], st)}$ (${obs.length} ratings; blanks ignored)`,
        vars: { mean: mu[i] },
        ops: [{ role: 'raw', cmd: 'highlight', args: { sel: [`row:${u}`, `mean:${u}`], tone: 'accent' } }],
      });
      for (const o of obs) {
        const c = matrix.cols[o.j];
        trace.push({
          label: `$s_{${lab(u)},${lab(c)}} = ${o.x} - ${tn(mu[i], st)} = ${tn(o.x - mu[i], st)}$ ${o.x - mu[i] > EPS ? '(above usual)' : o.x - mu[i] < -EPS ? '(below usual)' : '(exactly usual)'}`,
          vars: { s: o.x - mu[i] },
          ops: [
            { role: 'raw', cmd: 'highlight', args: { sel: [`cell:${u},${c}`, `mean:${u}`], tone: 'accent' } },
            { role: 'cen', cmd: 'fill', args: { cell: `${u},${c}`, value: o.x - mu[i] } },
          ],
        });
      }
    });
    return { steps: trace.length, empty: { rows: matrix.rows, cols: matrix.cols, values: matrix.values.map((r) => r.map(() => null)) }, trace };
  }

  // Worksheet for one prediction: every candidate neighbour, its similarity and centered rating, and whether it is used.
  function predictSheet({ matrix, user, item, k, mode = 'user' }) {
    const st = styleOf(matrix);
    const p = predict({ matrix, user, item, k, mode });
    const ranked = p.neighbors;
    const rows = ranked.length ? [...ranked.map((c) => c.label), 'Σ'] : ['Σ'];
    const cols = ['sim', mode === 'user' ? `s(·, ${item})` : `s(${user}, ·)`, 'rank', 'used?', 'sim × s'];
    const values = ranked.map((c, r) => [c.sim, c.dev, r + 1,
      c.used ? '\\checkmark' : c.top ? '\\text{sim} \\le 0' : '\\text{beyond } k',
      c.used ? c.sim * c.dev : null]);
    values.push([p.blank ? null : p.den, null, null, null, p.blank ? null : p.num]);
    const used = ranked.filter((c) => c.used);
    const tgt = `\\hat s_{${lab(user)},${lab(item)}}`;
    const numTex = used.map((c) => `${pn(+c.sim.toFixed(2), 'dec')}${pn(c.dev, st)}`).join(' + ');
    const denTex = used.map((c) => dec(c.sim)).join(' + ');
    const predTex = p.blank
      ? `${tgt} = \\text{blank (no positive neighbour among the top ${k})}`
      : `${tgt} = \\frac{${numTex}}{${denTex}} = \\frac{${dec(p.num)}}{${dec(p.den)}} = ${dec(p.centered)}`;
    const ratingTex = p.blank ? `\\hat r_{${lab(user)},${lab(item)}} = \\text{blank}` : `\\hat r_{${lab(user)},${lab(item)}} = \\hat s + \\mu_{${lab(user)}} = ${dec(p.centered)} + ${tn(p.mean, st)} = ${dec(p.rating)}`;
    const who = mode === 'user' ? `users who rated ${item}` : `items ${user} rated`;
    return {
      rows, cols, values, predTex, ratingTex, centered: p.centered, rating: p.rating, mean: p.mean, blank: p.blank, used: p.used, top: p.top,
      title: `Predict ${user} · ${item}: candidates = ${who}${ranked.length ? '' : ' (none)'}`,
      candText: ranked.map((c) => `${c.label} (${dec(c.sim).replace('-', '−')})`).join(', ') || 'none',
    };
  }

  // Solve every requested missing cell. roles: matrix (centered ratings), sims (similarity Matrix), sheet (predictSheet), out (Matrix to fill).
  // Patches target.
  function predictWalk({ matrix, k, mode = 'user', cells, fillWith = 'centered', order = 'row' }) {
    const missing = [];
    if (order === 'col') matrix.cols.forEach((c, j) => matrix.rows.forEach((u, i) => { if (matrix.values[i][j] === null) missing.push({ user: u, item: c }); }));
    else matrix.rows.forEach((u, i) => matrix.cols.forEach((c, j) => { if (matrix.values[i][j] === null) missing.push({ user: u, item: c }); }));
    const targets = cells && cells.length ? cells : missing;
    const trace = [];
    let solved = 0, blanks = 0;
    for (const t of targets) {
      const ps = predictSheet({ matrix, user: t.user, item: t.item, k, mode });
      const p = predict({ matrix, user: t.user, item: t.item, k, mode });
      const target = { user: t.user, item: t.item };
      const devCells = p.neighbors.map((c) => (mode === 'user' ? `cell:${c.label},${t.item}` : `cell:${t.user},${c.label}`));
      const simCells = p.neighbors.map((c) => (mode === 'user' ? `cell:${t.user},${c.label}` : `cell:${t.item},${c.label}`));
      trace.push({
        label: `${t.user} · ${t.item}: candidates ${mode === 'user' ? `who rated ${t.item}` : `${t.user} rated`}: ${ps.candText}`,
        patch: { target },
        ops: [
          { role: 'matrix', cmd: 'highlight', args: { sel: [`cell:${t.user},${t.item}`], tone: 'warn' } },
          { role: 'sims', cmd: 'highlight', args: { sel: simCells, tone: 'accent' } },
        ],
      });
      const usedSims = p.neighbors.filter((c) => c.used).map((c) => (mode === 'user' ? `cell:${t.user},${c.label}` : `cell:${t.item},${c.label}`));
      trace.push({
        label: `Top ${k}: ${p.top.join(', ') || 'none'}; with sim > 0: **${p.used.join(', ') || 'nobody'}**`,
        patch: { target },
        ops: [
          { role: 'sims', cmd: 'highlight', args: { sel: usedSims, tone: 'good' } },
          { role: 'matrix', cmd: 'highlight', args: { sel: devCells.filter((_, q) => p.neighbors[q].used), tone: 'good' } },
          { role: 'sheet', cmd: 'highlight', args: { sel: 'col:used?', tone: 'accent' } },
        ],
      });
      if (p.blank) {
        blanks++;
        trace.push({ label: `No positive neighbour, so ${t.user} · ${t.item} stays **blank**`, patch: { target },
          ops: [{ role: 'out', cmd: 'highlight', args: { sel: `cell:${t.user},${t.item}`, tone: 'muted' } }] });
      } else {
        solved++;
        const v = fillWith === 'rating' ? p.rating : p.centered;
        trace.push({
          label: fillWith === 'rating' ? `$\\hat s = ${dec(p.centered)}$, add $\\mu_{${lab(t.user)}} = ${tn(p.mean, styleOf(matrix))}$ → rating **${dec(p.rating)}**` : `$${ps.predTex}$`,

          vars: { pred: v }, patch: { target },
          ops: [{ role: 'out', cmd: 'fill', args: { cell: `${t.user},${t.item}`, value: v } }, { role: 'sheet', cmd: 'highlight', args: { sel: 'row:Σ', tone: 'good' } }],
        });
      }
    }
    trace.push({ label: `${solved} predicted, ${blanks} left blank`, patch: { target: targets[0] ? { user: targets[0].user, item: targets[0].item } : null } });
    return { solved, blanks, trace };
  }

  // DCG worksheet (first `upTo` positions filled): position, item, rel, gain, discount, term, running total.
  function dcgSheet({ ratings, list, k, upTo = 99 }) {
    const kk = Math.min(k ?? list.length, list.length);
    let run = 0;
    const values = list.slice(0, kk).map((id, i) => {
      const rel = ratings[id] ?? 0;
      const gain = Math.pow(2, rel) - 1, disc = Math.log2(i + 2), term = gain / disc;
      run += term;
      const done = i < upTo;
      return [`\\text{${id}}`, done ? rel : null, done ? gain : null, done ? disc : null, done ? term : null, done ? run : null];
    });
    return { rows: values.map((_, i) => `${i + 1}`), cols: ['item', 'rel', '2^rel − 1', 'log₂(i+1)', 'term', 'running DCG'], values, total: run };
  }

  // DCG of the list, then IDCG of the ideal list, then NDCG, one term per step.
  // roles: list (RankList), dsheet / isheet (Matrix from dcgSheet). Patches dUp, iUp.
  function dcgWalk({ ratings, list, k }) {
    const nd = ndcg({ ratings, list, k });
    const kk = nd.terms.length;
    const trace = [];
    nd.terms.forEach((t, i) => {
      trace.push({
        label: `DCG position ${t.pos}: ${t.id}, $\\frac{2^{${t.rel}} - 1}{\\log_2(${t.pos} + 1)} = \\frac{${t.gain}}{${+t.disc.toFixed(3)}} = ${dec(t.contrib)}$; total ${dec(nd.terms.slice(0, i + 1).reduce((s, x) => s + x.contrib, 0))}`,
        patch: { dUp: i + 1, iUp: 0 },
        ops: [{ role: 'list', cmd: 'highlight', args: { sel: `pos:${t.pos}`, tone: 'accent' } }, { role: 'dsheet', cmd: 'highlight', args: { sel: `row:${t.pos}`, tone: 'accent' } }],
      });
    });
    trace.push({ label: `Ideal order: sort all items by true rating and keep the best ${kk}: ${nd.ideal.join(', ')}`, patch: { dUp: kk, iUp: 0 } });
    nd.idealTerms.forEach((t, i) => {
      trace.push({
        label: `IDCG position ${t.pos}: ${t.id}, $\\frac{2^{${t.rel}} - 1}{\\log_2(${t.pos} + 1)} = \\frac{${t.gain}}{${+t.disc.toFixed(3)}} = ${dec(t.contrib)}$; total ${dec(nd.idealTerms.slice(0, i + 1).reduce((s, x) => s + x.contrib, 0))}`,
        patch: { dUp: kk, iUp: i + 1 },
        ops: [{ role: 'isheet', cmd: 'highlight', args: { sel: `row:${t.pos}`, tone: 'good' } }],
      });
    });
    trace.push({ label: `NDCG $= \\frac{\\text{DCG}}{\\text{IDCG}} = \\frac{${dec(nd.dcg)}}{${dec(nd.idcg)}} = ${+nd.ndcg.toFixed(3)}$`, patch: { dUp: kk, iUp: kk } });
    return { dcg: nd.dcg, idcg: nd.idcg, ndcg: nd.ndcg, trace };
  }

  // ---------------------------------------------------------------- line-by-line code traces (Math & Code tab)
  const row = (M, i) => `[${M.values[i].map((x) => (x === null ? 'None' : x)).join(', ')}]`;
  const rowC = (C, st) => `[${C.map((x) => (x === null ? 'None' : st === 'frac' ? (fracParts(x) ? fracStr(x) : dec(x)) : dec(x))).join(', ')}]`;
  function fracStr(x) { const f = fracParts(x, 12); return f && f[1] !== 1 ? `${f[0]}/${f[1]}` : dec(x); }

  // anchors: loop, rated, mu, s
  function centerCode({ matrix }) {
    const st = styleOf(matrix);
    const mu = means(matrix);
    const C = centered(matrix);
    const trace = [];
    matrix.rows.forEach((u, i) => {
      const obs = matrix.values[i].filter((x) => x !== null);
      trace.push({ label: `\`for row in R\`: user ${u}, row = ${row(matrix, i)}`, code: 'loop', math: 'loop', vars: { user: u } });
      trace.push({ label: `\`rated\` keeps the ${obs.length} numbers: [${obs.join(', ')}] (blanks are not zeros)`, code: 'rated', math: 'rated', vars: { rated: obs } });
      trace.push({ label: `\`m = sum(rated) / len(rated)\` = ${obs.reduce((a, b) => a + b, 0)} / ${obs.length} = ${fracStr(mu[i])}${st === 'frac' && fracParts(mu[i])[1] !== 1 ? ` ≈ ${dec(mu[i])}` : ''}`, code: 'mu', math: 'mu', vars: { m: mu[i] } });
      trace.push({ label: `Subtract ${fracStr(mu[i])} from every rating (None stays None) → ${rowC(C[i], st)}`, code: 's', math: 's', vars: { s: rowC(C[i], st) } });
    });
    return { means: mu, trace };
  }

  // anchors: init, loop, corated, dot, nu, nv, zero, sim
  function simCode({ matrix, a, b, mode = 'user' }) {
    const st = styleOf(matrix);
    const C = centered(matrix);
    const va = vector(C, matrix, mode, a), vb = vector(C, matrix, mode, b);
    const other = mode === 'item' ? matrix.rows : matrix.cols;
    const f = (x) => (st === 'frac' ? fracStr(x) : dec(x));
    const g = (x) => (x < -EPS ? `(${f(x)})` : f(x));
    let dot = 0, nu = 0, nv = 0;
    const [NU, NV] = mode === 'item' ? ['ni', 'nj'] : ['nu', 'nv'];
    const trace = [{ label: `\`dot = ${NU} = ${NV} = 0.0\`: three running sums`, code: 'init', math: 'init', vars: { dot: 0, [NU]: 0, [NV]: 0 } }];
    for (let q = 0; q < va.length; q++) {
      const x = va[q], y = vb[q];
      trace.push({ label: `\`for ${mode === 'item' ? 'u' : 'j'}\`: ${mode === 'item' ? 'user' : 'item'} ${other[q]}: ${a} → ${x === null ? 'None' : f(x)}, ${b} → ${y === null ? 'None' : f(y)}`, code: 'loop', math: 'loop', vars: { [mode === 'item' ? 'u' : 'j']: other[q], a: x === null ? 'None' : f(x), b: y === null ? 'None' : f(y) } });
      if (x === null || y === null) {
        trace.push({ label: mode === 'item' ? `User ${other[q]} didn't rate ${x === null ? a : b} → \`continue\` (not a co-rater)` : `${x === null ? a : b} didn't rate ${other[q]} → \`continue\` (not co-rated)`, code: 'corated', math: 'corated', vars: { skip: 'True' } });
        continue;
      }
      trace.push({ label: mode === 'item' ? `User ${other[q]} rated both ${a} and ${b}: a co-rater, so it counts` : `Both ${a} and ${b} rated ${other[q]}: co-rated, so it counts`, code: 'corated', math: 'corated', vars: { skip: 'False' } });
      dot += x * y;
      trace.push({ label: `\`dot += a * b\`: + (${f(x)})(${f(y)}) = + ${g(x * y)} → dot = ${f(dot)}`, code: 'dot', math: 'dot', vars: { dot } });
      nu += x * x;
      trace.push({ label: `\`${NU} += a * a\`: + ${f(x * x)} → ${NU} = ${f(nu)}`, code: 'nu', math: 'nu', vars: { [NU]: nu } });
      nv += y * y;
      trace.push({ label: `\`${NV} += b * b\`: + ${f(y * y)} → ${NV} = ${f(nv)}`, code: 'nv', math: 'nv', vars: { [NV]: nv } });
    }
    const zero = nu < EPS || nv < EPS;
    trace.push({ label: zero ? `\`${NU} == 0 or ${NV} == 0\`: **True** → return 0.0 (no overlap, or a zero vector)` : `\`${NU} == 0 or ${NV} == 0\`: **False**, both vectors have length`, code: 'zero', math: 'zero', vars: { [NU]: nu, [NV]: nv } });
    const s = zero ? 0 : dot / (Math.sqrt(nu) * Math.sqrt(nv));
    if (!zero) trace.push({ label: `\`dot / (sqrt(${NU}) * sqrt(${NV}))\` = ${dec(dot)} / (${dec(Math.sqrt(nu))} × ${dec(Math.sqrt(nv))}) = ${dec(dot)} / ${dec(Math.sqrt(nu) * Math.sqrt(nv))} = ${dec(s)}`, code: 'sim', math: 'sim', vars: { sim: s } });
    return { sim: s, trace };
  }

  // anchors: loop, cands, topk, pos, acc, num, den, pred, mean   (mode user or item)
  function predictCode({ matrix, user, item, k, mode = 'user', stopAt = null }) {
    const st = styleOf(matrix);
    const f = (x) => (st === 'frac' ? fracStr(x) : dec(x));
    const C = centered(matrix);
    const mu = means(matrix);
    const ui = matrix.rows.indexOf(user), ij = matrix.cols.indexOf(item);
    const p = predict({ matrix, user, item, k, mode });
    const peers = mode === 'user' ? matrix.rows : matrix.cols;
    const trace = [];
    const cands = [];
    peers.forEach((v, q) => {
      const self = mode === 'user' ? q === ui : q === ij;
      const val = mode === 'user' ? C[q][ij] : C[ui][q];
      const V = mode === 'user' ? 'v' : 'i';
      trace.push({ label: `\`for ${V}\`: ${mode === 'user' ? 'user' : 'item'} ${v}${self ? ' (the target itself)' : ''}`, code: 'loop', math: 'loop', vars: { [V]: v } });
      const ok = !self && val !== null;
      if (ok) cands.push(v);
      trace.push({
        label: self ? `${mode === 'user' ? 'v' : 'i'} is the target → not a candidate` : ok ? `${mode === 'user' ? `${v} rated ${item}` : `${user} rated ${v}`} → candidate (${cands.length} so far)` : `${mode === 'user' ? `${v} didn't rate ${item}` : `${user} didn't rate ${v}`} → skip`,
        code: 'cands', math: 'cands', vars: { cands: [...cands] },
      });
    });
    const simOf = (v) => p.neighbors.find((c) => c.label === v).sim;
    trace.push({ label: `Sort by similarity and cut at k = ${k}: ${p.neighbors.map((c) => `${c.label} ${dec(c.sim)}`).join(', ')} → top = ${p.top.join(', ') || 'none'}`, code: 'topk', math: 'topk', vars: { top: p.top } });
    trace.push({ label: `Keep only sim > 0 → used = ${p.used.join(', ') || 'nobody'}`, code: 'pos', math: 'pos', vars: { used: p.used } });
    if (stopAt === 'pos') return { used: p.used, trace };
    if (p.blank) {
      trace.push({ label: '`if not used`: nobody left, so `return None` (the cell stays blank)', code: 'pos', math: 'pos', vars: { result: 'None' } });
      return { centered: null, trace };
    }
    let num = 0, den = 0;
    for (const v of p.used) {
      const q = peers.indexOf(v);
      const sv = mode === 'user' ? C[q][ij] : C[ui][q];
      const sm = simOf(v);
      trace.push({ label: `\`for ${mode === 'user' ? 'v' : 'i'} in used\`: ${v}, sim = ${dec(sm)}, centered rating s = ${f(sv)}`, code: 'acc', math: 'acc', vars: { [mode === 'user' ? 'v' : 'i']: v, sim: sm, s: sv } });
      num += sm * sv;
      trace.push({ label: `\`num += sim * s\`: + (${dec(sm)})(${f(sv)}) = + ${sm * sv < -EPS ? `(${dec(sm * sv)})` : dec(sm * sv)} → num = ${dec(num)}`, code: 'num', math: 'num', vars: { num } });
      den += sm;
      trace.push({ label: `\`den += sim\`: + ${dec(sm)} → den = ${dec(den)}`, code: 'den', math: 'den', vars: { den } });
    }
    trace.push({ label: `\`s_hat = num / den\` = ${dec(num)} / ${dec(den)} = ${dec(num / den)}`, code: 'pred', math: 'pred', vars: { s_hat: num / den } });
    trace.push({ label: `\`return s_hat + mu[u]\` = ${dec(num / den)} + ${f(mu[ui])} = ${dec(num / den + mu[ui])}`, code: 'mean', math: 'mean', vars: { rating: num / den + mu[ui] } });
    return { centered: num / den, rating: num / den + mu[ui], trace };
  }

  // anchors: init, loop, gain, disc, add, ret
  function dcgCode({ ratings, list, k }) {
    const kk = Math.min(k ?? list.length, list.length);
    let total = 0;
    const trace = [{ label: '`total = 0.0`', code: 'init', math: 'init', vars: { total: 0 } }];
    for (let i = 1; i <= kk; i++) {
      const id = list[i - 1], rel = ratings[id] ?? 0, gain = Math.pow(2, rel) - 1, disc = Math.log2(i + 1);
      trace.push({ label: `\`for i, item\`: position i = ${i}, item = ${id} (true rating ${rel})`, code: 'loop', math: 'loop', vars: { i, item: id } });
      trace.push({ label: `\`gain = 2 ** ${rel} - 1\` = ${gain}`, code: 'gain', math: 'gain', vars: { gain } });
      trace.push({ label: `\`disc = log2(${i} + 1)\` = ${+disc.toFixed(3)}`, code: 'disc', math: 'disc', vars: { disc } });
      total += gain / disc;
      trace.push({ label: `\`total += gain / disc\`: + ${gain}/${+disc.toFixed(3)} = + ${dec(gain / disc)} → total = ${dec(total)}`, code: 'add', math: 'add', vars: { total } });
    }
    trace.push({ label: `\`return total\` = ${dec(total)}`, code: 'ret', math: 'ret', vars: { dcg: total } });
    return { dcg: total, trace };
  }

  // anchors: ideal, dcg, idcg, ndcg
  function ndcgCode({ ratings, list, k }) {
    const nd = ndcg({ ratings, list, k });
    const all = Object.keys(ratings).sort((a, b) => ratings[b] - ratings[a] || (a < b ? -1 : 1));
    return {
      ndcg: nd.ndcg,
      trace: [
        { label: `\`ideal\` = all items sorted by true rating: ${all.map((i) => `${i} ${ratings[i]}`).join(', ')}`, code: 'ideal', math: 'ideal', vars: { ideal: all } },
        ...nd.terms.map((t) => ({ label: `\`dcg(ranked)\` position ${t.pos}: ${t.id}, (2^${t.rel} − 1)/log₂(${t.pos + 1}) = ${dec(t.contrib)}`, code: 'dcg', math: 'dcg', vars: { term: t.contrib } })),
        { label: `DCG of the recommended list = ${dec(nd.dcg)}`, code: 'dcg', math: 'dcg', vars: { dcg: nd.dcg } },
        ...nd.idealTerms.map((t) => ({ label: `\`dcg(ideal)\` position ${t.pos}: ${t.id}, (2^${t.rel} − 1)/log₂(${t.pos + 1}) = ${dec(t.contrib)}`, code: 'idcg', math: 'idcg', vars: { term: t.contrib } })),
        { label: `IDCG (only the top ${nd.ideal.length} of the ideal list count) = ${dec(nd.idcg)}`, code: 'idcg', math: 'idcg', vars: { idcg: nd.idcg } },
        { label: `\`return\` ${dec(nd.dcg)} / ${dec(nd.idcg)} = ${+nd.ndcg.toFixed(3)}`, code: 'ndcg', math: 'ndcg', vars: { ndcg: nd.ndcg } },
      ],
    };
  }

  // anchors: both, w, shrunk
  function shrunkCode({ matrix, a, b, mode = 'user', beta = 3 }) {
    const s = shrunkSim({ matrix, a, b, mode, beta });
    const sm = sim({ matrix, a, b, mode });
    return {
      shrunk: s.shrunk,
      trace: [
        { label: `\`both\`: co-rated entries of ${a} and ${b} → ${sm.corated.join(', ') || 'none'} (${s.overlap})`, code: 'both', math: 'both', vars: { overlap: s.overlap } },
        { label: `\`w = min(${s.overlap}, ${beta}) / ${beta}\` = ${dec(s.weight)}`, code: 'w', math: 'w', vars: { w: s.weight } },
        { label: `\`w * sim\` = ${dec(s.weight)} × ${dec(s.sim)} = ${dec(s.shrunk)}`, code: 'shrunk', math: 'shrunk', vars: { shrunk: s.shrunk } },
      ],
    };
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
    fns: {
      vecCos, center, rowMeans, sim, simMatrix, predict, fill, dcg, ndcg, dcgFromOrder, shrunkSim, recommend, holdout,
      simSheet, simWalk, centerWalk, predictSheet, predictWalk, dcgSheet, dcgWalk,
      centerCode, simCode, predictCode, dcgCode, ndcgCode, shrunkCode,
    },
    generators: { meanQ, centerQ, simQ, neighborsQ, ubPredictQ, ibPredictQ, dcgQ, ndcgQ },
  };
}
