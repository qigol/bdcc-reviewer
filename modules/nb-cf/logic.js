// Qdigo module: nb-cf (Neighborhood-based Collaborative Filtering + DCG/NDCG)
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
    const side = (lab) => (mode === 'item' ? `col:${lab}` : `row:${lab}`);
    const coCells = [...cells(a), ...cells(b)];
    const r2 = (x) => Math.round(x * 100) / 100;
    const p2 = (x) => `(${r2(x)})`;
    const dotT = idx.length ? xa.map((x, q) => `${p2(x)}${p2(xb[q])}`).join(' + ') : '0';
    const sqT = (xs) => (xs.length ? xs.map((x) => `${r2(x)}^2`).join(' + ') : '0');
    return {
      sim: value, corated, overlap: idx.length, xa, xb, dot, na, nb,
      trace: [
        { label: `\`both\` is True where neither rating is NaN: ${idx.length} co-rated ${mode === 'item' ? 'users' : 'items'}. \`a\`, \`b\` keep only those.`, code: 'corated', math: 'corated', vars: { 'co-rated': corated.join(', ') || 'none', a: `[${xa.map(r2).join(', ')}]`, b: `[${xb.map(r2).join(', ')}]` },
          ops: [{ role: 'matrix', cmd: 'clear' }, { role: 'matrix', cmd: 'highlight', args: { sel: [side(a), side(b)], tone: 'muted' } }, { role: 'matrix', cmd: 'highlight', args: { sel: coCells, tone: 'good' } }] },
        { label: `\`a @ b\` multiplies pairwise and adds: $${dotT} = ${r2(dot)}$`, code: 'dot', math: 'dot', vars: { dot },
          ops: [{ role: 'matrix', cmd: 'highlight', args: { sel: coCells, tone: 'accent' } }] },
        { label: `Lengths over the same entries: $\\sqrt{${sqT(xa)}} = ${r2(na)}$, $\\sqrt{${sqT(xb)}} = ${r2(nb)}$`, code: 'norm', math: 'norm', vars: { na, nb },
          ops: [{ role: 'matrix', cmd: 'highlight', args: { sel: coCells, tone: 'good' } }] },
        { label: na < EPS || nb < EPS ? `A length is 0, so \`norm == 0\` and sim(${a}, ${b}) = 0` : `sim(${a}, ${b}) $= \\frac{${r2(dot)}}{${r2(na)} \\times ${r2(nb)}} = ${r2(value)}$`, code: 'sim', math: 'sim', vars: { sim: value },
          ops: [{ role: 'matrix', cmd: 'highlight', args: { sel: coCells, tone: 'good' } }] },
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
  // reveal (predict gates, guide §7.1b): 0 = centered values only, symbolic formula; 1 = + products and the dot
  // product; 2 = + squares and their sums (formula stops before the division); 3 (default) = everything.
  function simSheet({ matrix, a, b, mode = 'user', reveal = 3 }) {
    const st = styleOf(matrix);
    const s = sim({ matrix, a, b, mode });
    const over = mode === 'item' ? 'users' : 'items';
    const rows = s.corated.length ? [...s.corated, 'Σ'] : ['Σ'];
    const cols = [`s(${a})`, `s(${b})`, 'product', `s(${a})²`, `s(${b})²`];
    const r1 = reveal >= 1, r2 = reveal >= 2;
    const values = s.corated.map((o, k) => [s.xa[k], s.xb[k], r1 ? s.xa[k] * s.xb[k] : null, r2 ? s.xa[k] ** 2 : null, r2 ? s.xb[k] ** 2 : null]);
    const ssa = s.na ** 2, ssb = s.nb ** 2;
    values.push([null, null, r1 ? s.dot : null, r2 ? ssa : null, r2 ? ssb : null]);
    const pair = `\\text{sim}(${lab(a)}, ${lab(b)})`;
    const dotTex = s.overlap ? s.xa.map((x, k) => `${pn(x, st)}${pn(s.xb[k], st)}`).join(' + ') : '0';
    const zero = s.na < EPS || s.nb < EPS;
    const lens = `\\|${lab(a)}\\|\\,\\|${lab(b)}\\|`;
    let simTex;
    if (reveal < 1) simTex = `${pair} = \\frac{\\sum s_{${lab(a)}}\\, s_{${lab(b)}}}{${lens}} \\quad (\\text{co-rated ${over} only})`;
    else if (reveal < 3 && s.overlap && !zero) simTex = reveal < 2
      ? `${pair} = \\frac{${dotTex}}{${lens}} = \\frac{${tn(s.dot, st)}}{${lens}}`
      : `${pair} = \\frac{${dotTex}}{\\sqrt{${tn(ssa, st)}}\\,\\sqrt{${tn(ssb, st)}}} = \\frac{${tn(s.dot, st)}}{${tr(s.na, st)} \\times ${tr(s.nb, st)}}`;
    else if (reveal < 3) simTex = `${pair} = \\frac{\\sum s_{${lab(a)}}\\, s_{${lab(b)}}}{${lens}}`;
    else if (!s.overlap) simTex = `${pair} = 0 \\quad (\\text{no co-rated ${over}})`;
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
  // reveal (predict gates, guide §7.1b): 0 = candidates, similarities and ranks only, symbolic formula; 1 = + which
  // neighbours are used; 2 = + products and sums (formula stops before the division); 3 (default) = everything.
  function predictSheet({ matrix, user, item, k, mode = 'user', reveal = 3 }) {
    const st = styleOf(matrix);
    const p = predict({ matrix, user, item, k, mode });
    const ranked = p.neighbors;
    const rows = ranked.length ? [...ranked.map((c) => c.label), 'Σ'] : ['Σ'];
    const cols = ['sim', mode === 'user' ? `s(·, ${item})` : `s(${user}, ·)`, 'rank', 'used?', 'sim × s'];
    const values = ranked.map((c, r) => [c.sim, c.dev, r + 1,
      reveal < 1 ? null : c.used ? '\\checkmark' : c.top ? '\\text{sim} \\le 0' : '\\text{beyond } k',
      reveal >= 2 && c.used ? c.sim * c.dev : null]);
    values.push([p.blank || reveal < 2 ? null : p.den, null, null, null, p.blank || reveal < 2 ? null : p.num]);
    const used = ranked.filter((c) => c.used);
    const tgt = `\\hat s_{${lab(user)},${lab(item)}}`;
    const numTex = used.map((c) => `${pn(+c.sim.toFixed(2), 'dec')}${pn(c.dev, st)}`).join(' + ');
    const denTex = used.map((c) => dec(c.sim)).join(' + ');
    const symbolic = `${tgt} = \\frac{\\sum \\text{sim} \\times s}{\\sum \\text{sim}} \\quad (\\text{over the neighbours used})`;
    const predTex = reveal < 2 || (p.blank && reveal < 3)
      ? symbolic
      : p.blank
        ? `${tgt} = \\text{blank (no positive neighbour among the top ${k})}`
        : reveal < 3
          ? `${tgt} = \\frac{${numTex}}{${denTex}}`
          : `${tgt} = \\frac{${numTex}}{${denTex}} = \\frac{${dec(p.num)}}{${dec(p.den)}} = ${dec(p.centered)}`;
    const ratingTex = reveal < 3
      ? `\\hat r_{${lab(user)},${lab(item)}} = \\hat s + \\mu_{${lab(user)}}`
      : p.blank ? `\\hat r_{${lab(user)},${lab(item)}} = \\text{blank}` : `\\hat r_{${lab(user)},${lab(item)}} = \\hat s + \\mu_{${lab(user)}} = ${dec(p.centered)} + ${tn(p.mean, st)} = ${dec(p.rating)}`;
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

  // ---------------------------------------------------------------- numpy code traces (Math & Code tab)
  // The Math & Code tab shows numpy code. Each trace takes one step per line of that code; a few lines get extra
  // steps that open up what the line does (how broadcasting repeats the means, which products make up dot[A, B]).
  // The array a line produces is printed as TeX in the step label; vars carry shapes and single values for the badge.
  function fracStr(x) { const f = fracParts(x, 12); return f && f[1] !== 1 ? `${f[0]}/${f[1]}` : dec(x); }
  const NAN = '{\\color{gray}\\text{nan}}';
  const TF = (b) => (b ? '\\text{T}' : '\\text{F}');
  const txt = (s) => `\\text{${s}}`;
  const shp = (A) => `(${A.length}, ${A[0].length})`;
  const numF = (st) => (x) => tn(x, st);
  const cellT = (x, f) => (typeof x === 'string' ? x : x === null || Number.isNaN(x) ? NAN : f(x));
  // TeX table of an array, with optional row / column labels; hl = [[i, j], …] entries to box
  function arr(V, { rows = null, cols = null, f = dec, hl = [] } = {}) {
    const cell = (x, i, j) => {
      const t = cellT(x, f);
      return hl.some(([a, b]) => a === i && b === j) ? `\\boxed{${t}}` : t;
    };
    const head = cols ? `${rows ? ' & ' : ''}${cols.map((c) => `\\scriptstyle\\text{${c}}`).join(' & ')} \\\\ \\hline ` : '';
    const body = V.map((r, i) => `${rows ? `\\scriptstyle\\text{${rows[i]}} & ` : ''}${r.map((x, j) => cell(x, i, j)).join(' & ')}`).join(' \\\\ ');
    return `\\begin{array}{${rows ? 'r|' : ''}${'r'.repeat(V[0].length)}}${head}${body}\\end{array}`;
  }
  // a 1-D array, printed the way numpy prints it
  const vec = (v, f = dec) => `[\\,${v.map((x) => cellT(x, f)).join(',\\ ')}\\,]`;
  const pyList = (v, f = dec) => `[${v.map((x) => (x === null ? 'nan' : typeof x === 'string' ? x : f(x))).join(', ')}]`;
  const pp = (x, f) => `(${f(x)})`;

  // Live-example ops for Math & Code traces. Role `matrix` = the section's rating Matrix, `ranklist` = its RankList.
  // highlight is transient (this step only); fill / annotate / center / sortIdeal persist until the trace is rewound.
  const M_HL = (sel, tone = 'accent') => ({ role: 'matrix', cmd: 'highlight', args: { sel, tone } });
  const M_NOTE = (cell, text) => ({ role: 'matrix', cmd: 'annotate', args: { sel: cell, text } });
  const M_FILL = (cell, value) => ({ role: 'matrix', cmd: 'fill', args: { cell, value } });
  const M_CLEAR = () => ({ role: 'matrix', cmd: 'clear' });
  const cellOf = (M, i, j) => `cell:${M.rows[i]},${M.cols[j]}`;
  const observedCells = (M) => M.values.flatMap((r, i) => r.flatMap((x, j) => (x === null ? [] : [cellOf(M, i, j)])));
  const L_HL = (sel, tone = 'accent') => ({ role: 'ranklist', cmd: 'highlight', args: { sel, tone } });
  const posSel = (k) => Array.from({ length: k }, (_, t) => `pos:${t + 1}`);

  // Every intermediate array of user_sims / item_sims (mode 'item' compares columns).
  function npSims(C, mode) {
    const Z0 = C.map((r) => r.map((x) => (x === null ? 0 : x)));
    const M0 = C.map((r) => r.map((x) => (x === null ? 0 : 1)));
    const Z = mode === 'item' ? sdk.transpose(Z0) : Z0; // the compared things on rows
    const M = mode === 'item' ? sdk.transpose(M0) : M0;
    const dot = sdk.matmul(Z, sdk.transpose(Z));
    const sq = Z0.map((r) => r.map((x) => x * x));
    const ss = sdk.matmul(Z.map((r) => r.map((x) => x * x)), sdk.transpose(M));
    const nu = ss.map((r) => r.map((x) => Math.sqrt(x)));
    const nv = sdk.transpose(nu);
    const den = nu.map((r, i) => r.map((x, j) => x * nv[i][j]));
    const safe = den.map((r) => r.map((x) => (x > EPS ? x : 1)));
    const sims = den.map((r, i) => r.map((x, j) => (x > EPS ? dot[i][j] / x : 0)));
    return { Z0, M0, dot, sq, ss, nu, nv, den, safe, sims };
  }

  // anchors: rated, count, total, mu, s, ret
  function centerCode({ matrix }) {
    const st = styleOf(matrix), f = numF(st);
    const { rows, cols, values: R } = matrix;
    const m = R.length, n = R[0].length;
    const M = R.map((r) => r.map((x) => x !== null));
    const counts = M.map((r) => r.filter(Boolean).length);
    const obs = R.map((r) => r.filter((x) => x !== null));
    const totals = obs.map((o) => o.reduce((a, b) => a + b, 0));
    const mu = totals.map((t, i) => t / counts[i]);
    const S = R.map((r, i) => r.map((x) => (x === null ? null : x - mu[i])));
    const col = (v, g) => arr(v.map((x) => [x]), { rows, f: g });
    const muTex = (i) => `\\tfrac{${totals[i]}}{${counts[i]}} ${st === 'frac' && fracParts(mu[i], 12)[1] !== 1 ? `\\approx ${dec(mu[i])}` : `= ${dec(mu[i])}`}`;
    const obsCells = observedCells(matrix);
    const meanSel = rows.map((u) => `mean:${u}`);
    const trace = [
      { label: `\`np.isnan(R)\` is True at every blank; \`~\` flips it, so **T = rated**, F = blank.\n\n$M = ${arr(M.map((r) => r.map(TF)), { rows, cols })}$`,
        code: 'rated', math: 'rated', vars: { shape: shp(M) }, ops: [M_CLEAR(), M_HL(obsCells, 'good'), M_HL('missing', 'muted')] },
      { label: `\`M.sum(axis=1)\` adds along each row, counting True as 1. \`keepdims=True\` keeps a ${m}×1 column.\n\n$\\text{counts} = ${col(counts, String)}$`,
        code: 'count', math: 'count', vars: { shape: `(${m}, 1)` }, ops: [M_HL(obsCells, 'good'), ...rows.map((u, i) => M_NOTE(cellOf(matrix, i, n - 1), `${counts[i]} rated`))] },
      { label: `\`np.nansum(R, axis=1)\` adds each row's ratings and skips NaN (a plain sum would give NaN).\n\n$${rows.map((u, i) => `${txt(u)}{:}\\ ${obs[i].join(' + ')} = ${totals[i]}`).join(',\\quad ')}$`,
        code: 'total', math: 'total', vars: { shape: `(${m}, 1)` }, ops: [M_HL(obsCells, 'good'), ...rows.map((u, i) => M_NOTE(cellOf(matrix, i, n - 1), `Σ ${totals[i]}`))] },
      { label: `Both are ${m}×1 columns, so \`/\` divides row by row: each user's average.\n\n$\\text{mu} = ${arr(rows.map((u, i) => [muTex(i)]), { rows })}$`,
        code: 'mu', math: 'mu', vars: { shape: `(${m}, 1)` }, ops: [M_CLEAR(), M_HL(meanSel)] },
      { label: `\`R\` is ${m}×${n} but \`mu\` is ${m}×1, so numpy **broadcasts**: it repeats each row's mean across all ${n} columns.\n\n$${arr(R.map((r, i) => r.map(() => mu[i])), { rows, cols, f })}$`,
        code: 's', math: 's', vars: { broadcast: `(${m}, 1) → (${m}, ${n})` }, ops: [M_HL(meanSel), M_HL(rows.map((u) => `row:${u}`), 'warn')] },
    ];
    rows.forEach((u, i) => {
      trace.push({
        label: `Row ${u}: each rating minus ${u}'s mean. A NaN minus anything stays NaN, so blanks stay blank.\n\n$${obs[i].map((x) => `${x} - ${f(mu[i])} = ${f(x - mu[i])}`).join(',\\quad ')}$`,
        code: 's', math: 's', vars: { [`S[${i}]`]: pyList(S[i], st === 'frac' ? fracStr : dec) },
        ops: [M_HL([`row:${u}`, `mean:${u}`]), ...R[i].flatMap((x, j) => (x === null ? [] : [M_FILL(`${u},${cols[j]}`, x - mu[i])]))],
      });
    });
    trace.push({ label: `Same ${m}×${n} shape as \`R\`, NaN in the same places; each row's ratings now add up to 0.\n\n$S = ${arr(S, { rows, cols, f })}$`,
      code: 's', math: 's', vars: { shape: shp(S) }, ops: [M_HL(obsCells, 'good')] });
    trace.push({ label: `\`mu.ravel()\` flattens the ${m}×1 column into a plain 1-D array of ${m} means.\n\n$\\text{mu} = ${vec(mu, f)}$`,
      code: 'ret', math: 'ret', vars: { shape: `(${m},)` }, ops: [M_HL(meanSel)] });
    return { means: mu, trace };
  }

  // anchors: mask, fill, dot, sq, ss, nu, nv, den, zero, sim   (mode user: rows of S; mode item: columns)
  function simCode({ matrix, a, b, mode = 'user' }) {
    const st = styleOf(matrix), f = numF(st);
    const I = mode === 'item';
    const C = centered(matrix);
    const P = I ? matrix.cols : matrix.rows; // the things compared
    const O = I ? matrix.rows : matrix.cols; // what they are compared over
    const pa = P.indexOf(a), pb = P.indexOf(b);
    if (pa < 0 || pb < 0) throw new Error(`unknown ${I ? 'item' : 'user'} ${pa < 0 ? a : b}`);
    const X = npSims(C, mode);
    const R = { rows: matrix.rows, cols: matrix.cols };
    const PP = { rows: P, cols: P, f };
    const hl = [[pa, pb]];
    const [DOT, SS, NU, NV] = I ? ['Z.T @ Z', 'sq.T @ M', 'ni', 'nj'] : ['Z @ Z.T', 'sq @ M.T', 'nu', 'nv'];
    const colOf = (A, q) => (I ? A.map((r) => r[q]) : A[q]);
    const za = colOf(X.Z0, pa), zb = colOf(X.Z0, pb), ma = colOf(X.M0, pa), mb = colOf(X.M0, pb);
    const nP = P.length, nO = O.length;
    const other = I ? 'users' : 'items';
    const ent = (A) => A[pa][pb];
    const zeros = X.den.flat().filter((x) => x <= EPS).length;
    const idx = (nm) => `${nm}[${pa}, ${pb}]`;
    // live matrix: the two users (rows) or items (columns) being compared, and the cells they share
    const side = (p) => (I ? `col:${p}` : `row:${p}`);
    const at = (p, q) => (I ? `cell:${O[q]},${p}` : `cell:${p},${O[q]}`);
    const pair = [side(a), side(b)];
    const co = O.map((_, q) => q).filter((q) => ma[q] && mb[q]);
    const lone = O.map((_, q) => q).filter((q) => (ma[q] || mb[q]) && !(ma[q] && mb[q]));
    const coCells = co.flatMap((q) => [at(a, q), at(b, q)]);
    const loneCells = lone.flatMap((q) => [at(a, q), at(b, q)]);
    const zFill = matrix.rows.flatMap((r, i) => matrix.cols.map((c, j) => M_FILL(`${r},${c}`, X.Z0[i][j])));
    const trace = [
      { label: `\`~np.isnan(S)\` marks the rated cells; \`.astype(float)\` turns True/False into 1/0.\n\n$M = ${arr(X.M0, { ...R, f: String })}$`,
        code: 'mask', math: 'mask', vars: { shape: shp(X.M0) } },
      { label: `\`np.nan_to_num(S)\` replaces every NaN with 0. A 0 adds nothing to a sum, so blanks will drop out.\n\n$Z = ${arr(X.Z0, { ...R, f })}$`,
        code: 'fill', math: 'fill', vars: { shape: shp(X.Z0) } },
      { label: `\`${DOT}\` is a matrix product: (${nP}×${nO})(${nO}×${nP}) gives ${nP}×${nP}. Entry (${I ? 'i, j' : 'u, v'}) = ${I ? 'column i · column j' : 'row u · row v'} of Z.\n\n$\\text{dot} = ${arr(X.dot, { ...PP, hl })}$`,
        code: 'dot', math: 'dot', vars: { shape: shp(X.dot) } },
      { label: `Entry (${a}, ${b}) term by term: a blank is 0, so its product vanishes and only co-rated ${other} count.\n\n$\\text{dot}[${txt(a)}, ${txt(b)}] = ${za.map((x, q) => `${pp(x, f)}${pp(zb[q], f)}`).join(' + ')} = ${f(ent(X.dot))}$`,
        code: 'dot', math: 'dot', vars: { [idx('dot')]: ent(X.dot) } },
      { label: `\`Z ** 2\` squares every entry on its own (element-wise, not a matrix product).\n\n$\\text{sq} = ${arr(X.sq, { ...R, f })}$`,
        code: 'sq', math: 'sq', vars: { shape: shp(X.sq) } },
      { label: `\`${SS}\`: entry (${I ? 'i, j' : 'u, v'}) adds ${I ? "i's squares only for users who also rated j" : "u's squares only over items v also rated"}.\n\n$\\text{ss} = ${arr(X.ss, { ...PP, hl: [[pa, pb], [pb, pa]] })}$`,
        code: 'ss', math: 'ss', vars: { shape: shp(X.ss) } },
      { label: `The two entries we need: each side's squares, masked by the other side's ratings.\n\n$\\text{ss}[${txt(a)}, ${txt(b)}] = ${za.map((x, q) => `${f(x * x)}\\cdot${mb[q]}`).join(' + ')} = ${f(ent(X.ss))},\\quad \\text{ss}[${txt(b)}, ${txt(a)}] = ${zb.map((x, q) => `${f(x * x)}\\cdot${ma[q]}`).join(' + ')} = ${f(X.ss[pb][pa])}$`,
        code: 'ss', math: 'ss', vars: { [idx('ss')]: ent(X.ss), [`ss[${pb}, ${pa}]`]: X.ss[pb][pa] } },
      { label: `\`np.sqrt\` takes the square root of every entry: each ${I ? 'item' : 'user'}'s length over the co-rated ${other}.\n\n$\\text{${NU}} = ${arr(X.nu, { ...PP, hl })}$`,
        code: 'nu', math: 'nu', vars: { [idx(NU)]: ent(X.nu) } },
      { label: `\`.T\` transposes (swaps rows and columns): ${NV}[${I ? 'i, j' : 'u, v'}] = ${NU}[${I ? 'j, i' : 'v, u'}], the other side's length over the same ${other}.\n\n$\\text{${NV}} = ${arr(X.nv, { ...PP, hl })}$`,
        code: 'nv', math: 'nv', vars: { [idx(NV)]: ent(X.nv) } },
      { label: `\`${NU} * ${NV}\` multiplies entry by entry: the denominator for every pair at once.\n\n$\\text{den} = ${arr(X.den, { ...PP, hl })}$`,
        code: 'den', math: 'den', vars: { [idx('den')]: ent(X.den) } },
      { label: `\`np.where(c, x, y)\` takes x where c is True, else y: zeros in den become 1. ${zeros ? `(${zeros} zeros here.)` : '(No zeros here.)'}\n\n$\\text{safe} = ${arr(X.safe, { ...PP, hl })}$`,
        code: 'zero', math: 'zero', vars: { 'zeros in den': zeros } },
      { label: `\`dot / safe\` divides entry by entry; the outer \`np.where\` writes 0 wherever den was 0.\n\n$\\text{sims} = ${arr(X.sims, { ...PP, hl })}$`,
        code: 'sim', math: 'sim', vars: { shape: shp(X.sims) } },
      { label: `Entry (${a}, ${b}), the similarity itself.\n\n$\\text{sims}[${txt(a)}, ${txt(b)}] = ${ent(X.den) > EPS ? `\\frac{${dec(ent(X.dot))}}{${dec(ent(X.nu))} \\times ${dec(ent(X.nv))}} = \\frac{${dec(ent(X.dot))}}{${dec(ent(X.den))}} = ${dec(ent(X.sims))}` : `0 \\quad (\\text{den} = 0)`}$`,
        code: 'sim', math: 'sim', vars: { [idx('sims')]: ent(X.sims) } },
    ];
    const live = [
      [M_CLEAR(), M_HL(observedCells(matrix), 'good'), M_HL('missing', 'muted')], // mask
      [...zFill, M_HL('missing', 'muted')], // fill: the matrix now shows Z (centered, blanks 0)
      [M_HL(pair)], // dot (all pairs)
      [M_HL(pair), M_HL(coCells, 'good'), M_HL(loneCells, 'muted')], // dot entry
      [M_HL(pair)], // sq
      [M_HL(pair)], // ss
      [M_HL(pair), M_HL(coCells, 'good'), M_HL(loneCells, 'muted')], // ss entries
      [M_HL(pair)], [M_HL(pair)], [M_HL(pair)], [M_HL(pair)], [M_HL(pair)], // nu, nv, den, zero, sims
      [M_HL(pair), M_HL(coCells, 'good')], // the entry
    ];
    trace.forEach((t, q) => { if (live[q]) t.ops = live[q]; });
    return { sim: ent(X.sims), trace };
  }

  // anchors: raters, self, idx, sort, topk, pos   (user-based neighbours)
  function nbrSteps(matrix, user, item, k) {
    const st = styleOf(matrix), f = numF(st);
    const C = centered(matrix);
    const u = matrix.rows.indexOf(user), j = matrix.cols.indexOf(item);
    if (u < 0 || j < 0) throw new Error('unknown user or item');
    const sims = npSims(C, 'user').sims;
    const colj = C.map((r) => r[j]);
    const raters = colj.map((x) => x !== null);
    const was = raters[u];
    const raters2 = raters.map((x, q) => (q === u ? false : x));
    const cands = raters2.map((x, q) => (x ? q : -1)).filter((q) => q >= 0);
    const sc = cands.map((q) => sims[u][q]);
    const order = cands.map((_, t) => t).sort((x, y) => sc[y] - sc[x] || x - y);
    const top = order.slice(0, k).map((t) => cands[t]);
    const keep = top.map((q) => sims[u][q] > EPS);
    const N = top.filter((_, t) => keep[t]);
    const nm = (qs) => qs.map((q) => matrix.rows[q]).join(', ') || 'none';
    const U = { cols: matrix.rows };
    // live matrix: column `item`, the target cell, and the candidates' cells with their similarity to `user`
    const tgt = cellOf(matrix, u, j);
    const cAt = (qs) => qs.map((q) => cellOf(matrix, q, j));
    const simNotes = cands.map((q) => M_NOTE(cellOf(matrix, q, j), `sim ${dec(sims[u][q])}`));
    const steps = [
      { label: `\`S[:, j]\` is column ${item}: every user's centered rating of it. \`~np.isnan\` marks who rated it.\n\n$\\text{S[:, j]} = ${arr([colj], { ...U, f })} \\;\\Rightarrow\\; ${arr([raters.map(TF)], U)}$`,
        code: 'raters', math: 'raters', vars: { j: `${j} (${item})` } },
      { label: `\`raters[u] = False\`: ${user} is the target and can't vote for itself${was ? '' : ` (already False: ${user} never rated ${item})`}.\n\n$\\text{raters} = ${arr([raters2.map(TF)], U)}$`,
        code: 'self', math: 'self', vars: { u: `${u} (${user})` } },
      { label: '`np.flatnonzero` returns the positions of the True entries: the candidates\' row numbers.\n\n' + `$\\text{cands} = ${vec(cands, String)} \\quad (${txt(nm(cands))})$`,
        code: 'idx', math: 'idx', vars: { cands: pyList(cands, String) } },
      { label: `\`sims[u, cands]\` reads row ${user} at those columns. \`argsort\` sorts ascending, so sort the negatives: most similar first.\n\n$\\text{sims[u, cands]} = ${vec(sc)} \\;\\Rightarrow\\; \\text{order} = ${vec(order, String)}$`,
        code: 'sort', math: 'sort', vars: { order: pyList(order, String) } },
      { label: `\`order[:k]\` keeps the first k = ${k} positions; \`cands[…]\` turns them back into row numbers.\n\n$\\text{top} = ${vec(top, String)} \\quad (${txt(nm(top))})$`,
        code: 'topk', math: 'topk', vars: { top: pyList(top, String) } },
      { label: `\`sims[u, top] > 0\` gives True/False per neighbour; indexing \`top\` with it keeps the True ones.\n\n$${vec(top.map((q) => sims[u][q]))} > 0 = ${vec(keep.map(TF))} \\;\\Rightarrow\\; N = ${vec(N, String)} \\quad (${txt(N.length ? nm(N) : 'nobody')})$`,
        code: 'pos', math: 'pos', vars: { N: pyList(N, String) } },
    ];
    const live = [
      [M_CLEAR(), M_HL(`col:${item}`), M_HL(cAt(raters.map((x, q) => (x ? q : -1)).filter((q) => q >= 0)), 'good')],
      [M_HL(`col:${item}`), M_HL(tgt, 'warn'), M_HL(`row:${user}`, 'warn')],
      [M_HL(tgt, 'warn'), M_HL(cAt(cands), 'good')],
      [M_HL(tgt, 'warn'), M_HL(cAt(cands), 'good'), ...simNotes],
      [M_HL(tgt, 'warn'), M_HL(cAt(cands), 'muted'), M_HL(cAt(top), 'good')],
      [M_HL(tgt, 'warn'), M_HL(cAt(top), 'bad'), M_HL(cAt(N), 'good')],
    ];
    steps.forEach((t, q) => { t.ops = live[q]; });
    return { u, j, C, sims, cands, top, N, steps, f, st, nm, tgt, cAt, simNotes };
  }
  function neighborsCode({ matrix, user, item, k }) {
    const r = nbrSteps(matrix, user, item, k);
    return { used: r.N.map((q) => matrix.rows[q]), trace: r.steps };
  }

  // anchors: nbrs, blank, w, s, num, den, pred, mean   (user-based prediction)
  function predictCode({ matrix, user, item, k }) {
    const r = nbrSteps(matrix, user, item, k);
    const { u, j, C, sims, N, f, st, tgt, cAt } = r;
    const mu = means(matrix);
    const nCells = cAt(N);
    const base = [M_HL(tgt, 'warn'), M_HL(nCells, 'good')];
    const trace = [
      { label: `\`neighbors(S, sims, u, j, k)\` (previous section): raters of ${item}, top ${k} by similarity, then sim > 0.\n\n$${r.cands.length ? `${txt(r.nm(r.cands))} \\to \\text{top-}${k}{:}\\ ${txt(r.nm(r.top))} \\to N = ${vec(N, String)}\\ (${N.length ? txt(r.nm(N)) : '\\text{nobody}'})` : '\\text{nobody rated it} \\Rightarrow N = [\\,]'}$`,
        code: 'nbrs', math: 'nbrs', vars: { N: pyList(N, String) }, ops: [M_CLEAR(), M_HL(`col:${item}`), ...base, ...N.map((q) => M_NOTE(cellOf(matrix, q, j), `w ${dec(sims[u][q])}`))] },
    ];
    if (!N.length) {
      trace.push({ label: '`N.size == 0`: nobody is left to vote, so `return np.nan` and the cell stays blank.', code: 'blank', math: 'blank', vars: { 'N.size': 0 }, ops: [M_HL(tgt, 'bad')] });
      return { centered: null, rating: null, trace };
    }
    const w = N.map((q) => sims[u][q]);
    const s = N.map((q) => C[q][j]);
    const num = w.reduce((t, x, q) => t + x * s[q], 0);
    const den = w.reduce((t, x) => t + x, 0);
    const sh = num / den;
    trace.push(
      { label: `\`N.size\` is ${N.length}, not 0, so the function carries on.`, code: 'blank', math: 'blank', vars: { 'N.size': N.length }, ops: base },
      { label: `Fancy indexing: \`sims[u, N]\` reads row ${user} at the columns in N, in N's order.\n\n$\\mathbf{w} = ${vec(w)}$`,
        code: 'w', math: 'w', vars: { w: pyList(w) }, ops: base },
      { label: `\`S[N, j]\` reads rows N of column ${item}: the neighbours' centered ratings, in the same order.\n\n$\\mathbf{s} = ${vec(s, f)}$`,
        code: 's', math: 's', vars: { s: pyList(s, st === 'frac' ? fracStr : dec) }, ops: [...base, ...N.map((q, t) => M_FILL(`${matrix.rows[q]},${item}`, s[t]))] },
      { label: `\`w @ s\` on two 1-D arrays is a dot product: multiply pairwise, then add.\n\n$${w.map((x, q) => `(${dec(x)})${pp(s[q], f)}`).join(' + ')}${w.length > 1 ? ` = ${w.map((x, q) => dec(x * s[q])).join(' + ').replace(/\+ -/g, '- ')}` : ''} = ${dec(num)}$`,
        code: 'num', math: 'num', vars: { num }, ops: base },
      { label: w.length > 1 ? '`w.sum()` adds the weights.\n\n' + `$${w.map((x) => dec(x)).join(' + ')} = ${dec(den)}$` : `\`w.sum()\` adds the weights; with one neighbour it is just $${dec(den)}$.`, code: 'den', math: 'den', vars: { den }, ops: base },
      { label: 'Divide: the similarity-weighted average of the neighbours\' centered ratings.\n\n' + `$\\hat s = \\frac{${dec(num)}}{${dec(den)}} = ${dec(sh)}$`, code: 'pred', math: 'pred', vars: { s_hat: sh }, ops: [...base, M_FILL(`${user},${item}`, sh)] },
      { label: `\`mu[u]\` is ${user}'s mean; adding it undoes the centering and gives a rating.\n\n$${dec(sh)} + ${tn(mu[u], st)} = ${dec(sh + mu[u])}$`,
        code: 'mean', math: 'mean', vars: { rating: sh + mu[u] }, ops: [M_HL(tgt, 'good'), M_FILL(`${user},${item}`, sh + mu[u]), M_NOTE(tgt, `+ μ ${dec(mu[u])}`)] },
    );
    return { centered: sh, rating: sh + mu[u], trace };
  }

  // anchors: rated, self, idx, sort, topk, pos, blank, w, s, num, den, pred, mean   (item-based prediction)
  function ibPredictCode({ matrix, user, item, k }) {
    const st = styleOf(matrix), f = numF(st);
    const C = centered(matrix);
    const mu = means(matrix);
    const u = matrix.rows.indexOf(user), j = matrix.cols.indexOf(item);
    if (u < 0 || j < 0) throw new Error('unknown user or item');
    const isims = npSims(C, 'item').sims;
    const rowu = C[u];
    const rated = rowu.map((x) => x !== null);
    const rated2 = rated.map((x, q) => (q === j ? false : x));
    const cands = rated2.map((x, q) => (x ? q : -1)).filter((q) => q >= 0);
    const sc = cands.map((q) => isims[j][q]);
    const order = cands.map((_, t) => t).sort((x, y) => sc[y] - sc[x] || x - y);
    const top = order.slice(0, k).map((t) => cands[t]);
    const keep = top.map((q) => isims[j][q] > EPS);
    const N = top.filter((_, t) => keep[t]);
    const nm = (qs) => qs.map((q) => matrix.cols[q]).join(', ') || 'none';
    const It = { cols: matrix.cols };
    // live matrix: row `user`, the target cell, and the candidate items' cells in that row
    const tgt = cellOf(matrix, u, j);
    const rAt = (qs) => qs.map((q) => cellOf(matrix, u, q));
    const trace = [
      { label: `\`S[u]\` is row ${user}: ${user}'s centered ratings. \`~np.isnan\` marks the items ${user} rated.\n\n$\\text{S[u]} = ${arr([rowu], { ...It, f })} \\;\\Rightarrow\\; ${arr([rated.map(TF)], It)}$`,
        code: 'rated', math: 'rated', vars: { u: `${u} (${user})` } },
      { label: `\`rated[j] = False\`: ${item} is the target item, not a neighbour${rated[j] ? '' : ` (already False: ${user} never rated it)`}.\n\n$\\text{rated} = ${arr([rated2.map(TF)], It)}$`,
        code: 'self', math: 'self', vars: { j: `${j} (${item})` } },
      { label: '`np.flatnonzero` returns the positions of the True entries: the candidate items\' column numbers.\n\n' + `$\\text{cands} = ${vec(cands, String)} \\quad (${txt(nm(cands))})$`,
        code: 'idx', math: 'idx', vars: { cands: pyList(cands, String) } },
      { label: `\`isims[j, cands]\` reads row ${item} of the item similarities there; sorting the negatives puts the most similar first.\n\n$\\text{isims[j, cands]} = ${vec(sc)} \\;\\Rightarrow\\; \\text{order} = ${vec(order, String)}$`,
        code: 'sort', math: 'sort', vars: { order: pyList(order, String) } },
      { label: `\`order[:k]\` keeps the first k = ${k}; \`cands[…]\` turns them back into column numbers.\n\n$\\text{top} = ${vec(top, String)} \\quad (${txt(nm(top))})$`,
        code: 'topk', math: 'topk', vars: { top: pyList(top, String) } },
      { label: '`isims[j, top] > 0` gives True/False per item; boolean indexing keeps the True ones.\n\n' + `$${vec(top.map((q) => isims[j][q]))} > 0 = ${vec(keep.map(TF))} \\;\\Rightarrow\\; N = ${vec(N, String)} \\quad (${txt(N.length ? nm(N) : 'nothing')})$`,
        code: 'pos', math: 'pos', vars: { N: pyList(N, String) } },
    ];
    const live0 = [
      [M_CLEAR(), M_HL(`row:${user}`), M_HL(rAt(rated.map((x, q) => (x ? q : -1)).filter((q) => q >= 0)), 'good')],
      [M_HL(`row:${user}`), M_HL(tgt, 'warn'), M_HL(`col:${item}`, 'warn')],
      [M_HL(tgt, 'warn'), M_HL(rAt(cands), 'good')],
      [M_HL(tgt, 'warn'), M_HL(rAt(cands), 'good'), ...cands.map((q) => M_NOTE(cellOf(matrix, u, q), `sim ${dec(isims[j][q])}`))],
      [M_HL(tgt, 'warn'), M_HL(rAt(cands), 'muted'), M_HL(rAt(top), 'good')],
      [M_HL(tgt, 'warn'), M_HL(rAt(top), 'bad'), M_HL(rAt(N), 'good')],
    ];
    trace.forEach((t, q) => { t.ops = live0[q]; });
    if (!N.length) {
      trace.push({ label: '`N.size == 0`: no similar item is left, so `return np.nan` and the cell stays blank.', code: 'blank', math: 'blank', vars: { 'N.size': 0 }, ops: [M_HL(tgt, 'bad')] });
      return { centered: null, rating: null, trace };
    }
    const w = N.map((q) => isims[j][q]);
    const s = N.map((q) => C[u][q]);
    const base = [M_HL(tgt, 'warn'), M_HL(rAt(N), 'good')];
    const num = w.reduce((t, x, q) => t + x * s[q], 0);
    const den = w.reduce((t, x) => t + x, 0);
    const sh = num / den;
    trace.push(
      { label: `\`N.size\` is ${N.length}, not 0, so the function carries on.`, code: 'blank', math: 'blank', vars: { 'N.size': N.length }, ops: base },
      { label: `\`isims[j, N]\` reads row ${item} at the columns in N: the weights.\n\n$\\mathbf{w} = ${vec(w)}$`, code: 'w', math: 'w', vars: { w: pyList(w) }, ops: base },
      { label: `\`S[u, N]\` reads row ${user} at the same columns: ${user}'s **own** centered ratings of those items.\n\n$\\mathbf{s} = ${vec(s, f)}$`,
        code: 's', math: 's', vars: { s: pyList(s, st === 'frac' ? fracStr : dec) }, ops: [...base, ...N.map((q, t) => M_FILL(`${user},${matrix.cols[q]}`, s[t]))] },
      { label: '`w @ s` is a dot product: multiply pairwise, then add.\n\n' + `$${w.map((x, q) => `(${dec(x)})${pp(s[q], f)}`).join(' + ')} = ${dec(num)}$`, code: 'num', math: 'num', vars: { num }, ops: base },
      { label: w.length > 1 ? '`w.sum()` adds the weights.\n\n' + `$${w.map((x) => dec(x)).join(' + ')} = ${dec(den)}$` : `\`w.sum()\` adds the weights; with one neighbour it is just $${dec(den)}$.`, code: 'den', math: 'den', vars: { den }, ops: base },
      { label: 'Divide: the similarity-weighted average of the user\'s own centered ratings.\n\n' + `$\\hat s = \\frac{${dec(num)}}{${dec(den)}} = ${dec(sh)}$`, code: 'pred', math: 'pred', vars: { s_hat: sh }, ops: [...base, M_FILL(`${user},${item}`, sh)] },
      { label: `\`mu[u]\` is ${user}'s mean; adding it gives the rating.\n\n$${dec(sh)} + ${tn(mu[u], st)} = ${dec(sh + mu[u])}$`, code: 'mean', math: 'mean', vars: { rating: sh + mu[u] }, ops: [M_HL(tgt, 'good'), M_FILL(`${user},${item}`, sh + mu[u]), M_NOTE(tgt, `+ μ ${dec(mu[u])}`)] },
    );
    return { centered: sh, rating: sh + mu[u], trace };
  }

  // anchors: rel, pos, gain, disc, terms, add
  function dcgSteps(rels, k, names) {
    const kk = Math.min(k, rels.length);
    const rel = rels.slice(0, kk);
    const pos = rel.map((_, t) => t + 1);
    const gain = rel.map((r) => Math.pow(2, r) - 1);
    const disc = pos.map((i) => Math.log2(i + 1));
    const terms = gain.map((g, t) => g / disc[t]);
    const total = terms.reduce((a, b) => a + b, 0);
    const d3 = (x) => String(+x.toFixed(3));
    const steps = [
      { label: `\`rel[:k]\` keeps the first ${kk} positions; \`np.asarray(…, dtype=float)\` makes a float array of the true ratings.\n\n$\\text{rel} = ${vec(rel, String)}${names ? ` \\quad (${txt(names.slice(0, kk).join(', '))})` : ''}$`,
        code: 'rel', math: 'rel', vars: { shape: `(${kk},)` } },
      { label: `\`np.arange(1, ${kk + 1})\` counts from 1 up to ${kk} (the stop value ${kk + 1} is left out): the positions.\n\n$\\mathbf{i} = ${vec(pos, String)}$`,
        code: 'pos', math: 'pos', vars: { i: pyList(pos, String) } },
      { label: '`2.0 ** rel` raises 2 to each rating (element-wise), then `- 1` subtracts 1 from each: the gains.\n\n' + `$${rel.map((r) => `2^{${r}} - 1`).join(',\\ ')} \\;\\Rightarrow\\; \\text{gain} = ${vec(gain, String)}$`,
        code: 'gain', math: 'gain', vars: { gain: pyList(gain, String) } },
      { label: '`i + 1` adds 1 to each position, then `np.log2` takes log base 2 of each: the discounts.\n\n' + `$${pos.map((i) => `\\log_2 ${i + 1}`).join(',\\ ')} \\;\\Rightarrow\\; \\text{disc} = ${vec(disc, d3)}$`,
        code: 'disc', math: 'disc', vars: { disc: pyList(disc, d3) } },
      { label: '`gain / disc` divides position by position: one term per position.\n\n' + `$${gain.map((g, t) => `\\tfrac{${g}}{${d3(disc[t])}}`).join(',\\ ')} \\;\\Rightarrow\\; \\text{terms} = ${vec(terms)}$`,
        code: 'terms', math: 'terms', vars: { terms: pyList(terms) } },
      { label: '`.sum()` adds every term: the DCG.\n\n' + `$${terms.map((x) => dec(x)).join(' + ')} = ${dec(total)}$`, code: 'add', math: 'add', vars: { dcg: total } },
    ];
    return { rel, gain, disc, terms, total, steps };
  }
  function dcgCode({ ratings, list, k }) {
    const r = dcgSteps(list.map((id) => ratings[id] ?? 0), k ?? list.length, list);
    const top = posSel(r.rel.length);
    const tones = ['accent', 'accent', 'good', 'warn', 'good', 'good']; // rel, pos, gain, disc, terms, add
    r.steps.forEach((t, q) => { t.ops = [L_HL(top, tones[q])]; });
    return { dcg: r.total, trace: r.steps };
  }

  // anchors: dcg, ideal, idcg, ndcg
  function ndcgCode({ ratings, list, k }) {
    const kk = Math.min(k ?? list.length, list.length);
    const ids = Object.keys(ratings);
    const all = ids.map((id) => ratings[id]);
    const d = dcgSteps(list.map((id) => ratings[id] ?? 0), kk);
    const asc = all.slice().sort((x, y) => x - y);
    const desc = asc.slice().reverse();
    const idealIds = ids.slice().sort((x, y) => ratings[y] - ratings[x] || (x < y ? -1 : 1));
    const id = dcgSteps(desc, kk);
    const v = id.total > 0 ? d.total / id.total : 0;
    return {
      ndcg: v,
      trace: [
        { label: `\`dcg(rel, ${kk})\` (previous section) on the recommended order ${list.slice(0, kk).join(', ')}.\n\n$\\text{rel} = ${vec(d.rel, String)} \\;\\Rightarrow\\; \\text{terms} = ${vec(d.terms)} \\;\\Rightarrow\\; d = ${dec(d.total)}$`,
          code: 'dcg', math: 'dcg', vars: { d: d.total }, ops: [L_HL(posSel(kk))] },
        { label: '`np.sort(all_rel)` sorts every item\'s true rating, smallest first.\n\n' + `$\\text{all\\_rel} = ${vec(all, String)} \\ (${txt(ids.join(', '))}) \\;\\Rightarrow\\; ${vec(asc, String)}$`,
          code: 'ideal', math: 'ideal', vars: { 'all_rel': pyList(all, String) }, ops: [L_HL(ids.map((x) => `item:${x}`), 'muted')] },
        { label: '`[::-1]` reads the array backwards (a slice with step −1): best first, the ideal order.\n\n' + `$\\text{ideal} = ${vec(desc, String)} \\ (${txt(idealIds.join(', '))})$`,
          code: 'ideal', math: 'ideal', vars: { ideal: pyList(desc, String) }, ops: [{ role: 'ranklist', cmd: 'setOrder', args: { order: idealIds } }, L_HL(posSel(ids.length), 'warn')] },
        { label: `\`dcg(ideal, ${kk})\` keeps only the best ${kk}${desc.length > kk ? ` (${desc.slice(kk).join(', ')} drops out)` : ''} and scores them the same way: the IDCG.\n\n$${vec(id.rel, String)} \\;\\Rightarrow\\; \\text{terms} = ${vec(id.terms)} \\;\\Rightarrow\\; i = ${dec(id.total)}$`,
          code: 'idcg', math: 'idcg', vars: { i: id.total }, ops: [L_HL(posSel(kk), 'good')] },
        { label: 'Divide: how close the recommended list comes to the best possible ordering (1 = perfect).\n\n' + `$\\text{NDCG} = \\frac{${dec(d.total)}}{${dec(id.total)}} = ${+v.toFixed(3)}$`,
          code: 'ndcg', math: 'ndcg', vars: { ndcg: v } },
      ],
    };
  }

  // anchors: mask, both, w, shrunk   (significance weighting on user similarities)
  function shrunkCode({ matrix, a, b, beta = 3 }) {
    const st = styleOf(matrix);
    const C = centered(matrix);
    const X = npSims(C, 'user');
    const P = matrix.rows;
    const pa = P.indexOf(a), pb = P.indexOf(b);
    if (pa < 0 || pb < 0) throw new Error(`unknown user ${pa < 0 ? a : b}`);
    const M = X.M0;
    const both = sdk.matmul(M, sdk.transpose(M));
    const w = both.map((r) => r.map((x) => Math.min(x, beta) / beta));
    const out = w.map((r, i) => r.map((x, j) => x * X.sims[i][j]));
    const PP = { rows: P, cols: P };
    const hl = [[pa, pb]];
    const wF = (x) => tn(x, 'frac');
    const pair = [`row:${a}`, `row:${b}`];
    const co = matrix.cols.map((c, q) => q).filter((q) => M[pa][q] && M[pb][q]);
    const coCells = co.flatMap((q) => [cellOf(matrix, pa, q), cellOf(matrix, pb, q)]);
    const liveOps = [
      [M_CLEAR(), M_HL(observedCells(matrix), 'good'), M_HL('missing', 'muted')],
      [M_HL(pair)],
      [M_HL(pair), M_HL(coCells, 'good'), ...co.map((q, t) => M_NOTE(cellOf(matrix, pb, q), `both ${t + 1}`))],
      [M_HL(pair), M_HL(coCells, 'good')],
      [M_HL(pair)],
      [M_HL(pair), M_HL(coCells, 'good')],
    ];
    return {
      shrunk: out[pa][pb],
      trace: [
        { label: '`~np.isnan(S)` marks rated cells; `.astype(int)` turns True/False into 1/0.\n\n' + `$M = ${arr(M, { rows: P, cols: matrix.cols, f: String })}$`,
          code: 'mask', math: 'mask', vars: { shape: shp(M) } },
        { label: '`M @ M.T`: entry (u, v) is row u · row v of the mask, which counts the items both rated.\n\n' + `$\\text{both} = ${arr(both, { ...PP, f: String, hl })}$`,
          code: 'both', math: 'both', vars: { shape: shp(both) } },
        { label: `Entry (${a}, ${b}): a 1·1 only where both rated. The diagonal is how many items each user rated.\n\n$\\text{both}[${txt(a)}, ${txt(b)}] = ${M[pa].map((x, q) => `${x}\\cdot${M[pb][q]}`).join(' + ')} = ${both[pa][pb]}$`,
          code: 'both', math: 'both', vars: { [`both[${pa}, ${pb}]`]: both[pa][pb] } },
        { label: `\`np.minimum(both, ${beta})\` caps each count at β = ${beta}; dividing by β gives weights from 0 to 1.\n\n$w = ${arr(w, { ...PP, f: wF, hl })}$`,
          code: 'w', math: 'w', vars: { [`w[${pa}, ${pb}]`]: w[pa][pb] } },
        { label: '`w * sims` multiplies entry by entry: each similarity scaled by how much evidence it rests on.\n\n' + `$\\text{sims} = ${arr(X.sims, { ...PP, hl })} \\;\\Rightarrow\\; ${arr(out, { ...PP, hl })}$`,
          code: 'shrunk', math: 'shrunk', vars: { [`shrunk[${pa}, ${pb}]`]: out[pa][pb] } },
        { label: `Entry (${a}, ${b}).\n\n$${wF(w[pa][pb])} \\times ${dec(X.sims[pa][pb])} = ${dec(out[pa][pb])}$`,
          code: 'shrunk', math: 'shrunk', vars: { [`shrunk[${pa}, ${pb}]`]: out[pa][pb] } },
      ].map((t, q) => ({ ...t, ops: liveOps[q] })),
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
      if (near(mu, wrongAll, 0.04)) continue;
      return { vars: { matrix: M, user: M.rows[u], mean: mu, wrongAll, sum: obs.reduce((a, b) => a + b, 0), n: obs.length, ni: row.length }, misconceptions: [
        { var: 'wrongAll', for: 'mean', feedback: 'You divided by every item, including the ones the user never rated. μᵤ averages only the **observed** ratings.' },
        { var: 'sum', for: 'mean', feedback: 'That is the sum; divide by the number of ratings.' },
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
      if (near(wrongCol, dev, 0.04)) continue;
      return { vars: { matrix: M, user: M.rows[u], item: M.cols[j], r: M.values[u][j], mean: mu, dev, wrongSign: -dev, wrongCol }, misconceptions: [
        { var: 'wrongSign', for: 'dev', feedback: 'Sign flipped: centered value = rating − μᵤ.' },
        { var: 'wrongCol', for: 'dev', feedback: 'You subtracted the **item** (column) mean. The lecture centers by the **user** (row) mean.' },
      ] };
    }
  }

  // cosine of two equal-length lists (0 if either is all zeros)
  const cosL = (x, y) => {
    const d = x.reduce((t, v, q) => t + v * y[q], 0);
    const nx = Math.sqrt(x.reduce((t, v) => t + v * v, 0)), ny = Math.sqrt(y.reduce((t, v) => t + v * v, 0));
    return nx < EPS || ny < EPS ? 0 : d / (nx * ny);
  };
  const normL = (x) => Math.sqrt(x.reduce((t, v) => t + v * v, 0));

  // user–user similarity of A and B. Difficulty ≥ 2: each user also rated an item the other did not, so the
  // "norms over every rating" mistake gives a different number.
  function simQ({ rng, difficulty }) {
    for (;;) {
      const ni = difficulty === 3 ? 6 : 5;
      const M = randMatrix(rng, 2, ni, difficulty === 1 ? 1 : 3);
      const s = sim({ matrix: M, a: 'A', b: 'B', mode: 'user' });
      if (s.overlap < 2 || s.na < 1e-9 || s.nb < 1e-9) continue;
      if (Math.abs(s.sim) > 0.999 || Math.abs(s.sim) < 0.05) continue;
      const onlyA = M.cols.some((_, j) => M.values[0][j] !== null && M.values[1][j] === null);
      const onlyB = M.cols.some((_, j) => M.values[1][j] !== null && M.values[0][j] === null);
      if (difficulty >= 2 && !(onlyA && onlyB)) continue;
      const idx = M.cols.map((_, j) => j).filter((j) => M.values[0][j] !== null && M.values[1][j] !== null);
      const ra = idx.map((j) => M.values[0][j]), rb = idx.map((j) => M.values[1][j]);
      const rawCos = cosL(ra, rb);
      const C = centered(M);
      const wrongNormA = normL(C[0].filter((x) => x !== null)), wrongNormB = normL(C[1].filter((x) => x !== null));
      const wrongAllNorms = s.dot / (wrongNormA * wrongNormB);
      if (near(rawCos, s.sim, 0.03) || (difficulty >= 2 && near(wrongAllNorms, s.sim, 0.03))) continue;
      if (difficulty >= 2 && (near(wrongNormA, s.na, 0.06) || near(wrongNormB, s.nb, 0.06))) continue;
      const mu = means(M);
      return { vars: { matrix: M, sim: s.sim, overlap: s.overlap, corated: s.corated, dot: s.dot, na: s.na, nb: s.nb, rawCos, wrongAllNorms, wrongNormA, wrongNormB, negSim: -s.sim, muA: mu[0], muB: mu[1] }, misconceptions: [
        { var: 'rawCos', for: 'sim', feedback: 'You used the raw ratings. Mean-center each user first (subtract μᵤ), then take the cosine.' },
        { var: 'negSim', for: 'sim', feedback: 'Check the signs of the centered values: the size is right but the sign is flipped.' },
        ...(difficulty >= 2 ? [
          { var: 'wrongAllNorms', for: 'sim', feedback: 'Your lengths used **every** rating of each user. Both lengths run only over the co-rated items, like the dot product.' },
          { var: 'wrongNormA', for: 'na', feedback: 'That length uses all of A\'s ratings. Use only the items B also rated.' },
          { var: 'wrongNormB', for: 'nb', feedback: 'That length uses all of B\'s ratings. Use only the items A also rated.' },
        ] : []),
      ] };
    }
  }

  // item–item adjusted cosine between two columns. Each item also has a rater the other lacks, so
  // "norms over every rater" (Spark's columnSimilarities on centered data) gives a different number.
  function isimQ({ rng, difficulty }) {
    for (;;) {
      const big = difficulty >= 3;
      const nu = big ? 5 : 4, ni = big ? 5 : 4;
      const M = randMatrix(rng, nu, ni, big ? 5 : 4);
      const pairIdx = rng.sample(M.cols.map((_, q) => q), 2).sort((x, y) => x - y);
      const [x, y] = pairIdx;
      const a = M.cols[x], b = M.cols[y];
      const s = sim({ matrix: M, a, b, mode: 'item' });
      if (s.overlap < (big ? 3 : 2) || s.na < 1e-9 || s.nb < 1e-9) continue;
      if (Math.abs(s.sim) > 0.999 || Math.abs(s.sim) < 0.05) continue;
      const onlyA = M.rows.some((_, i) => M.values[i][x] !== null && M.values[i][y] === null);
      const onlyB = M.rows.some((_, i) => M.values[i][y] !== null && M.values[i][x] === null);
      if (!(onlyA && onlyB)) continue;
      const C = centered(M);
      const co = M.rows.map((_, i) => i).filter((i) => M.values[i][x] !== null && M.values[i][y] !== null);
      const colMean = (q) => { const o = M.values.map((r) => r[q]).filter((v) => v !== null); return o.reduce((t, v) => t + v, 0) / o.length; };
      const wrongItemMean = cosL(co.map((i) => M.values[i][x] - colMean(x)), co.map((i) => M.values[i][y] - colMean(y)));
      const rawCos = cosL(co.map((i) => M.values[i][x]), co.map((i) => M.values[i][y]));
      const wrongNormA = normL(C.map((r) => r[x]).filter((v) => v !== null));
      const wrongNormB = normL(C.map((r) => r[y]).filter((v) => v !== null));
      const wrongAllNorms = s.dot / (wrongNormA * wrongNormB);
      if ([wrongItemMean, rawCos, wrongAllNorms].some((w) => near(w, s.sim, 0.03))) continue;
      if (near(wrongNormA, s.na, 0.06) || near(wrongNormB, s.nb, 0.06)) continue;
      const mu = means(M);
      const cen = center({ matrix: M });
      return {
        vars: { matrix: M, centeredM: { rows: cen.rows, cols: cen.cols, values: cen.values }, a, b, sim: s.sim, overlap: s.overlap, corated: s.corated, dot: s.dot, na: s.na, nb: s.nb,
          wrongItemMean, rawCos, wrongAllNorms, wrongNormA, wrongNormB,
          meansText: M.rows.map((r, i) => `μ_${r} = ${dec(mu[i])}`).join(', ') },
        misconceptions: [
          { var: 'wrongItemMean', for: 'sim', feedback: 'You centered by the **item** (column) mean. The adjusted cosine centers each rating by the mean of the **user** who gave it.' },
          { var: 'rawCos', for: 'sim', feedback: 'You used raw ratings. Center each rating by its user\'s mean first.' },
          { var: 'wrongAllNorms', for: 'sim', feedback: 'Your lengths used **every** rater of each item. Both lengths run only over the users who rated both items.' },
          { var: 'wrongNormA', for: 'na', feedback: `That length uses every rater of ${a}. Use only the users who also rated ${b}.` },
          { var: 'wrongNormB', for: 'nb', feedback: `That length uses every rater of ${b}. Use only the users who also rated ${a}.` },
        ],
      };
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

  // User-based prediction. Difficulty ≥ 2: k = 3, at least two positive neighbours (each from ≥ 2 co-rated items)
  // and a negative one inside the top 3, so "use every top-k neighbour" gives a different answer.
  // Ratings outside the 1–5 scale are redrawn, so a learner who clips is never marked wrong.
  function ubPredictQ({ rng, difficulty }) {
    for (;;) {
      const big = difficulty >= 2;
      const M = randMatrix(rng, big ? 5 : 4, 5, big ? 5 : 4);
      const u = rng.int(0, M.rows.length - 1);
      const holes = M.cols.map((_, j) => j).filter((j) => M.values[u][j] === null);
      if (!holes.length) continue;
      const j = rng.pick(holes);
      const k = big ? 3 : 2;
      const p = predict({ matrix: M, user: M.rows[u], item: M.cols[j], k, mode: 'user' });
      if (p.blank || p.tieAtCutoff || p.used.length < (big ? 2 : 1)) continue;
      if (p.rating < 1 || p.rating > 5) continue;
      const top = p.neighbors.filter((c) => c.top);
      const neg = top.filter((c) => !c.used);
      if (big && !neg.some((c) => c.sim < -0.05 && Math.abs(c.sim * c.dev) > 0.06)) continue;
      if (big && p.neighbors.filter((c) => c.used).some((c) => sim({ matrix: M, a: M.rows[u], b: c.label, mode: 'user' }).overlap < 2)) continue;
      const allNum = top.reduce((a, c) => a + c.sim * c.dev, 0);
      const allDen = top.reduce((a, c) => a + Math.abs(c.sim), 0);
      const wrongAllCentered = allDen > EPS ? allNum / allDen : p.centered;
      const wrongAllRating = wrongAllCentered + p.mean;
      if (big && near(wrongAllCentered, p.centered, 0.06)) continue;
      // the natural mistake: keep the negative neighbour and add its signed similarity to the denominator
      const signedDen = top.reduce((a, c) => a + c.sim, 0);
      if (big && Math.abs(signedDen) < 0.3) continue;
      const wrongSignedCentered = Math.abs(signedDen) > EPS ? allNum / signedDen : p.centered;
      const wrongSignedRating = wrongSignedCentered + p.mean;
      if (big && near(wrongSignedCentered, p.centered, 0.06)) continue;
      const C = center({ matrix: M });
      const s = simMatrix({ matrix: M, mode: 'user' });
      return { vars: { matrix: M, centeredM: { rows: C.rows, cols: C.cols, values: C.values }, sims: { rows: s.rows, cols: s.cols, values: s.values }, user: M.rows[u], item: M.cols[j], k,
        mean: p.mean, pred: p.centered, rating: p.rating, num: p.num, den: p.den, used: p.used, top: p.top,
        wrongNoMean: p.centered, wrongAllCentered, wrongAllRating, wrongAllNum: allNum, wrongAllDen: allDen,
        wrongSignedCentered, wrongSignedRating, wrongSignedDen: signedDen },
        misconceptions: [
          { var: 'wrongNoMean', for: 'rating', feedback: 'That is the prediction in **centered** space. Add the user\'s mean μᵤ back to get a rating.' },
          ...(big ? [
            { var: 'wrongSignedRating', for: 'rating', feedback: 'You included a negative neighbour; its negative weight shrinks the denominator. Keep only neighbours with **sim > 0**.' },
            { var: 'wrongSignedCentered', for: 'pred', feedback: 'You included a negative neighbour; its negative weight shrinks the denominator. Keep only neighbours with **sim > 0**.' },
            { var: 'wrongSignedDen', for: 'den', feedback: 'You added a negative similarity, which shrinks the denominator. Keep only sim > 0, and add only the similarities you used.' },
            { var: 'wrongAllRating', for: 'rating', feedback: 'Only neighbours with **sim > 0** are used; drop the negative ones from the top-k.' },
            { var: 'wrongAllCentered', for: 'pred', feedback: 'Only neighbours with **sim > 0** are used; drop the negative ones from the top-k.' },
            { var: 'wrongAllNum', for: 'num', feedback: 'You included a neighbour with a negative similarity. Keep only sim > 0.' },
            { var: 'wrongAllDen', for: 'den', feedback: 'You included a neighbour with a negative similarity (as |sim|). Add only the similarities of the neighbours used.' },
          ] : []),
        ] };
    }
  }

  // Full user-based pipeline from raw ratings: exactly two other users rated the target item, both positive,
  // each from ≥ 2 co-rated items. The learner computes the mean, both similarities, ŝ and the rating.
  function ubPipelineQ({ rng }) {
    for (;;) {
      const M = randMatrix(rng, 4, 5, 5);
      const u = rng.int(0, 3);
      const holes = M.cols.map((_, j) => j).filter((j) => M.values[u][j] === null);
      if (!holes.length) continue;
      const j = rng.pick(holes);
      const p = predict({ matrix: M, user: M.rows[u], item: M.cols[j], k: 2, mode: 'user' });
      if (p.neighbors.length !== 2 || p.used.length !== 2 || p.tieAtCutoff) continue;
      if (p.rating < 1 || p.rating > 5) continue;
      const [n1, n2] = p.neighbors;
      const s1 = sim({ matrix: M, a: M.rows[u], b: n1.label, mode: 'user' });
      const s2 = sim({ matrix: M, a: M.rows[u], b: n2.label, mode: 'user' });
      if (s1.overlap < 2 || s2.overlap < 2 || s1.sim > 0.999 || s2.sim > 0.999) continue;
      const raw = (b) => {
        const ib = M.rows.indexOf(b);
        const idx = M.cols.map((_, q) => q).filter((q) => M.values[u][q] !== null && M.values[ib][q] !== null);
        return cosL(idx.map((q) => M.values[u][q]), idx.map((q) => M.values[ib][q]));
      };
      const rawSim1 = raw(n1.label), rawSim2 = raw(n2.label);
      if (near(rawSim1, s1.sim, 0.03) || near(rawSim2, s2.sim, 0.03)) continue;
      return {
        vars: { matrix: M, user: M.rows[u], item: M.cols[j], n1: n1.label, n2: n2.label, sim1: s1.sim, sim2: s2.sim, co1: s1.corated, co2: s2.corated,
          dev1: n1.dev, dev2: n2.dev, mean: p.mean, pred: p.centered, rating: p.rating, num: p.num, den: p.den, rawSim1, rawSim2, wrongNoMean: p.centered },
        misconceptions: [
          { var: 'rawSim1', for: 'sim1', feedback: 'You took the cosine of the raw ratings. Center each user by their own mean first.' },
          { var: 'rawSim2', for: 'sim2', feedback: 'You took the cosine of the raw ratings. Center each user by their own mean first.' },
          { var: 'wrongNoMean', for: 'rating', feedback: 'That is still the centered prediction ŝ. Add the user\'s mean back.' },
        ],
      };
    }
  }

  // Full item-based pipeline from raw ratings: the user rated exactly two other items, both positively similar to the
  // target (each from ≥ 2 co-raters). The learner computes the user's mean, both adjusted cosines, ŝ and the rating.
  function ibPipelineQ({ rng }) {
    for (;;) {
      const M = randMatrix(rng, 5, 4, 5);
      const u = rng.int(0, M.rows.length - 1);
      const j = rng.int(0, M.cols.length - 1);
      // build the user's row by hand: exactly two other items rated (with different ratings), the target blank
      const keep = rng.sample(M.cols.map((_, q) => q).filter((q) => q !== j), 2);
      M.values[u] = M.values[u].map((x, q) => (keep.includes(q) ? (x === null ? rng.int(1, 5) : x) : null));
      if (M.values[u][keep[0]] === M.values[u][keep[1]]) continue;
      // each kept item must share ≥ 2 raters with the target before any similarity is computed
      const shared = (q) => M.values.filter((r) => r[j] !== null && r[q] !== null).length;
      if (keep.some((q) => shared(q) < 2)) continue;
      const p = predict({ matrix: M, user: M.rows[u], item: M.cols[j], k: 2, mode: 'item' });
      if (p.neighbors.length !== 2 || p.used.length !== 2 || p.tieAtCutoff) continue;
      if (p.rating < 1 || p.rating > 5) continue;
      const [n1, n2] = p.neighbors;
      const s1 = sim({ matrix: M, a: M.cols[j], b: n1.label, mode: 'item' });
      const s2 = sim({ matrix: M, a: M.cols[j], b: n2.label, mode: 'item' });
      if (s1.overlap < 2 || s2.overlap < 2 || s1.sim > 0.999 || s2.sim > 0.999) continue;
      // equal similarities would make ŝ exactly 0 (the user's two centered ratings are ±d)
      if (near(s1.sim, s2.sim, 0.03) || Math.abs(p.centered) < 0.05) continue;
      const raw = (b) => {
        const q = M.cols.indexOf(b);
        const idx = M.rows.map((_, i) => i).filter((i) => M.values[i][j] !== null && M.values[i][q] !== null);
        return cosL(idx.map((i) => M.values[i][j]), idx.map((i) => M.values[i][q]));
      };
      const rawSim1 = raw(n1.label), rawSim2 = raw(n2.label);
      if (near(rawSim1, s1.sim, 0.03) || near(rawSim2, s2.sim, 0.03)) continue;
      const mu = means(M);
      return {
        vars: { matrix: M, user: M.rows[u], item: M.cols[j], n1: n1.label, n2: n2.label, sim1: s1.sim, sim2: s2.sim, co1: s1.corated, co2: s2.corated,
          mean: p.mean, pred: p.centered, rating: p.rating, num: p.num, den: p.den, rawSim1, rawSim2,
          meansText: M.rows.map((r, i) => `μ_${r} = ${dec(mu[i])}`).join(', ') },
        misconceptions: [
          { var: 'rawSim1', for: 'sim1', feedback: 'You took the cosine of raw ratings. Center every rating by its user\'s mean first.' },
          { var: 'rawSim2', for: 'sim2', feedback: 'You took the cosine of raw ratings. Center every rating by its user\'s mean first.' },
          { var: 'pred', for: 'rating', feedback: 'That is still the centered prediction ŝ. Add the user\'s mean back.' },
        ],
      };
    }
  }

  // Item-based prediction. Difficulty ≥ 2: at least two positive similar items, each sharing ≥ 2 raters with the target.
  function ibPredictQ({ rng, difficulty }) {
    for (;;) {
      const big = difficulty >= 2;
      const M = randMatrix(rng, big ? 5 : 4, 5, big ? 5 : 4);
      const u = rng.int(0, M.rows.length - 1);
      const holes = M.cols.map((_, j) => j).filter((j) => M.values[u][j] === null);
      if (!holes.length) continue;
      const j = rng.pick(holes);
      const p = predict({ matrix: M, user: M.rows[u], item: M.cols[j], k: 2, mode: 'item' });
      if (p.blank || p.tieAtCutoff) continue;
      if (big && (p.used.length < 2 || p.used.some((it) => sim({ matrix: M, a: M.cols[j], b: it, mode: 'item' }).overlap < 2))) continue;
      if (p.rating < 1 || p.rating > 5) continue;
      const used = p.neighbors.filter((c) => c.used);
      const rawNum = used.reduce((a, c) => a + c.sim * M.values[u][M.cols.indexOf(c.label)], 0);
      const wrongRaw = rawNum / used.reduce((a, c) => a + c.sim, 0);
      if (near(wrongRaw, p.centered, 0.06)) continue;
      const C = center({ matrix: M });
      const s = simMatrix({ matrix: M, mode: 'item' });
      return { vars: { matrix: M, centeredM: { rows: C.rows, cols: C.cols, values: C.values }, sims: { rows: s.rows, cols: s.cols, values: s.values }, user: M.rows[u], item: M.cols[j],
        pred: p.centered, rating: p.rating, mean: p.mean, num: p.num, den: p.den, used: p.used, top: p.top, wrongRaw, wrongRawNum: rawNum },
        misconceptions: [
          { var: 'wrongRaw', for: 'pred', feedback: 'Use the user\'s **centered** ratings of the neighbour items, not the raw ratings.' },
          { var: 'rating', for: 'pred', feedback: 'You added the mean back. This step asks for the centered prediction ŝ, before adding μᵤ.' },
          { var: 'wrongRawNum', for: 'num', feedback: 'Multiply each similarity by the user\'s **centered** rating of that item, not the raw rating.' },
          { var: 'pred', for: 'rating', feedback: 'That is still the centered prediction ŝ. Add the user\'s mean back to get a rating.' },
        ] };
    }
  }

  const DCG_IDS = ['A', 'B', 'C', 'D', 'E', 'F'];
  // explanation text for a list of DCG terms, each bracketed so no false equation appears
  const termsText = (terms) => terms.map((t) => `[(2^${t.rel} − 1)/log₂(${t.pos + 1}) = ${Math.round(t.contrib * 100) / 100}]`).join(' + ');
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
      if (d.dcg < 1 || near(lin, d.dcg, 0.15) || near(wrongDisc, d.dcg, 0.15)) continue;
      // swapping the top two positions (difficulty ≥ 2 template)
      const swapped = [list[1], list[0], ...list.slice(2)];
      const swapDelta = dcg({ ratings, list: swapped, k }).dcg - d.dcg;
      const swapLinear = dcg({ ratings, list: swapped, k, gain: 'linear' }).dcg - lin;
      if (difficulty >= 2 && (Math.abs(swapDelta) < 0.3 || near(swapLinear, swapDelta, 0.15))) continue;
      const nd = ndcg({ ratings, list, k });
      if (near(nd.dcg, nd.ndcg, 0.03) || near(nd.idcg, nd.ndcg, 0.03)) continue;
      return { vars: { ratings, list, swapped, k, dcg: d.dcg, idcg: nd.idcg, ndcg: nd.ndcg, ideal: nd.ideal, wrongLinear: lin, wrongDisc, swapDelta, negSwap: -swapDelta, swapLinear,
        top1: list[0], top2: list[1],
        ratingsText: ids.map((i) => `${i}: ${ratings[i]}`).join(', '), terms: termsText(d.terms),
        swapTerms: termsText(dcg({ ratings, list: swapped, k }).terms) },
        misconceptions: [
          { var: 'wrongLinear', for: 'dcg', feedback: 'The lecture uses gain **2^rel − 1**, not the raw rating.' },
          { var: 'wrongDisc', for: 'dcg', feedback: 'Position i is discounted by **log₂(i + 1)**: log₂2 = 1 for the top item, log₂3 for the second, and so on.' },
          { var: 'negSwap', for: 'swapDelta', feedback: 'Right size, wrong sign: subtract the old DCG from the new one.' },
          { var: 'swapLinear', for: 'swapDelta', feedback: 'The gain is **2^rel − 1**, not the raw rating.' },
        ] };
    }
  }

  // NDCG@k. Difficulty 3 (transfer): 6 items with relevance 0–5, k = 4, and the item that belongs first in the ideal
  // list is missing from the recommended list, so "sort the recommended items" fails at every later step.
  function ndcgQ({ rng, difficulty }) {
    for (;;) {
      const hard = difficulty >= 3;
      const ids = DCG_IDS.slice(0, hard ? 6 : 5);
      const ratings = Object.fromEntries(ids.map((i) => [i, rng.int(hard ? 0 : 1, 5)]));
      const k = hard ? 4 : 3;
      const list = rng.shuffle(ids).slice(0, k);
      const nd = ndcg({ ratings, list, k });
      if (nd.idcg < 1 || nd.ndcg > 0.97 || nd.ndcg < 0.2) continue;
      // the mistake: build the "ideal" list from the recommended items only
      const recSorted = list.slice().sort((a, b) => ratings[b] - ratings[a]);
      const wrongIdcgRec = dcg({ ratings, list: recSorted, k }).dcg;
      if (near(wrongIdcgRec, nd.idcg, 0.15)) continue;
      const wrongNdcgRec = nd.dcg / wrongIdcgRec;
      if (near(wrongNdcgRec, nd.ndcg, 0.03) || near(nd.dcg, nd.ndcg, 0.03)) continue;
      const topRel = ratings[nd.ideal[0]];
      const wrongTopRec = ratings[recSorted[0]];
      const wrongLinear = dcg({ ratings, list, k, gain: 'linear' }).dcg;
      if (hard && (wrongTopRec === topRel || near(wrongLinear, nd.dcg, 0.15))) continue;
      return { vars: { ratings, list, k, dcg: nd.dcg, idcg: nd.idcg, ndcg: nd.ndcg, ideal: nd.ideal, top: nd.ideal[0], topRel, wrongNoIdeal: nd.dcg,
        wrongIdcgRec, wrongNdcgRec, wrongTopRec, wrongLinear, terms: termsText(nd.terms), idealTerms: termsText(nd.idealTerms),
        ratingsText: ids.map((i) => `${i}: ${ratings[i]}`).join(', ') },
        misconceptions: [
          { var: 'wrongIdcgRec', for: 'idcg', feedback: 'You sorted only the recommended items. The ideal list takes the best k of **all** rated items.' },
          { var: 'wrongNdcgRec', for: 'ndcg', feedback: 'Your IDCG used only the recommended items. The ideal list takes the best k of **all** rated items.' },
          { var: 'wrongNoIdeal', for: 'ndcg', feedback: 'That is still DCG; divide by IDCG.' },
          ...(hard ? [
            { var: 'wrongTopRec', for: 'topRel', feedback: 'That is the best of the **recommended** items. The ideal list can start with an item the recommender missed.' },
            { var: 'wrongLinear', for: 'dcg', feedback: 'The lecture uses gain **2^rel − 1**, not the raw relevance.' },
          ] : []),
        ] };
    }
  }

  // Significance weighting (beyond the lecture): sim of two users from raw ratings, then shrink it by min(overlap, β)/β.
  // The overlap is always below β, so forgetting the weight gives a different number.
  function sigSimQ({ rng }) {
    for (;;) {
      const beta = rng.pick([3, 4]);
      const M = randMatrix(rng, 2, 6, 4);
      const s = sim({ matrix: M, a: 'A', b: 'B', mode: 'user' });
      if (s.overlap < 2 || s.overlap >= beta || s.na < 1e-9 || s.nb < 1e-9) continue;
      if (Math.abs(s.sim) > 0.999 || Math.abs(s.sim) < 0.2) continue;
      const idx = M.cols.map((_, j) => j).filter((j) => M.values[0][j] !== null && M.values[1][j] !== null);
      const rawCos = cosL(idx.map((j) => M.values[0][j]), idx.map((j) => M.values[1][j]));
      if (near(rawCos, s.sim, 0.03)) continue;
      const weight = Math.min(s.overlap, beta) / beta;
      const shrunk = s.sim * weight;
      // dividing the overlap by the number of items instead of β
      const wrongWeight = s.overlap / M.cols.length;
      if (near(wrongWeight, weight, 0.02) || near(s.sim * wrongWeight, shrunk, 0.03)) continue;
      if (near(s.sim, shrunk, 0.03) || near(rawCos * weight, shrunk, 0.03)) continue;
      const mu = means(M);
      return {
        vars: { matrix: M, beta, overlap: s.overlap, corated: s.corated, sim: s.sim, weight, shrunk, rawCos, rawShrunk: rawCos * weight,
          wrongWeight, wrongShrunk: s.sim * wrongWeight, muA: mu[0], muB: mu[1] },
        misconceptions: [
          { var: 'rawCos', for: 'sim', feedback: 'You used the raw ratings. Mean-center each user first (subtract μᵤ), then take the cosine.' },
          { var: 'wrongWeight', for: 'weight', feedback: 'Divide the capped overlap by **β**, not by the number of items.' },
          { var: 'sim', for: 'shrunk', feedback: 'That is the plain similarity. Multiply it by the weight min(overlap, β)/β.' },
          { var: 'wrongShrunk', for: 'shrunk', feedback: 'Your weight divided by the number of items. The weight is min(overlap, β)/β.' },
          { var: 'rawShrunk', for: 'shrunk', feedback: 'The weight is right, but the similarity came from raw ratings. Center each user first.' },
        ],
      };
    }
  }

  // The prediction and the numbers that common mistakes give (Application decision options).
  function predictMistakes({ matrix, user, item, k, mode = 'user' }) {
    const p = predict({ matrix, user, item, k, mode });
    const used = p.neighbors.filter((c) => c.used);
    const rawOf = (c) => (mode === 'user' ? matrix.values[matrix.rows.indexOf(c.label)][matrix.cols.indexOf(item)] : matrix.values[matrix.rows.indexOf(user)][matrix.cols.indexOf(c.label)]);
    const rawAvg = used.length ? used.reduce((a, c) => a + c.sim * rawOf(c), 0) / p.den : null;
    const mu = means(matrix);
    const nbMean = used.length && mode === 'user' ? p.centered + mu[matrix.rows.indexOf(used[0].label)] : null;
    return { rating: p.rating, centered: p.centered, mean: p.mean, rawAvg, nbMean, used: p.used, neighbors: p.neighbors };
  }

  return {
    fns: {
      vecCos, center, rowMeans, sim, simMatrix, predict, fill, dcg, ndcg, dcgFromOrder, shrunkSim, recommend, holdout,
      simSheet, simWalk, centerWalk, predictSheet, predictWalk, dcgSheet, dcgWalk,
      centerCode, simCode, neighborsCode, predictCode, ibPredictCode, dcgCode, ndcgCode, shrunkCode, predictMistakes,
    },
    generators: { meanQ, centerQ, simQ, isimQ, neighborsQ, ubPredictQ, ubPipelineQ, ibPipelineQ, ibPredictQ, dcgQ, ndcgQ, sigSimQ },
  };
}
