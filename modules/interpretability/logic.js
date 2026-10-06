// Qdigo module: interpretability (ML2, Sessions 6–7)
// Toy models (two depth-2 trees, a 3-feature Shapley game, a 1-D LIME fit, a linear counterfactual model) make every
// mechanism computable by hand. The breast-cancer forest's own outputs are shown verbatim from the notebooks.
export default function register(sdk) {
  const { sum, mean } = sdk;

  // ------------------------------------------------------------ helpers
  // Compact axis labels for the 30 Wisconsin features: 'worst concave points' -> 'w.c.pts'.
  const SHORT = { radius: 'rad', texture: 'tex', perimeter: 'per', area: 'area', smoothness: 'smo', compactness: 'comp', concavity: 'conc', 'concave points': 'c.pts', symmetry: 'sym', 'fractal dimension': 'fd' };
  const shortName = (f) => {
    const m = /^(mean|worst) (.+)$/.exec(f) ?? /^(.+) (error)$/.exec(f);
    if (!m) return f;
    return m[2] === 'error' ? `se.${SHORT[m[1]] ?? m[1]}` : `${m[1][0]}.${SHORT[m[2]] ?? m[2]}`;
  };
  const dn = (x, d = 3) => {
    if (x === null || x === undefined || !Number.isFinite(x)) return '—';
    const f = Math.pow(10, d);
    let r = Math.round((x + Number.EPSILON * Math.sign(x)) * f) / f;
    if (Object.is(r, -0)) r = 0;
    return String(r);
  };
  const sg = (x, d = 3) => (x >= 0 ? `+${dn(x, d)}` : dn(x, d));
  const txt = (s) => `\\text{${String(s)}}`;
  const records = (table) => table.rows.map((r) => Object.fromEntries(table.columns.map((c, i) => [c, r[i]])));
  const FEATURES = ['radius', 'area', 'texture'];

  // ------------------------------------------------------------ trees
  const isLeaf = (n) => !n.feature;
  function route(node, row) {
    let n = node;
    const path = [n.id];
    while (!isLeaf(n)) { n = row[n.feature] <= n.threshold ? n.left : n.right; path.push(n.id); }
    return { leaf: n.id, path };
  }
  const gini = (b, m) => (b + m === 0 ? 0 : 1 - (b / (b + m)) ** 2 - (m / (b + m)) ** 2);

  // Every node with the training rows that reach it. Leaf P(benign) = benign fraction (as sklearn).
  function nodeStats(tree, rows) {
    const out = {};
    const walk = (n, rs) => {
      const b = rs.filter((r) => r.benign === 1).length, m = rs.length - b;
      out[n.id] = { id: n.id, n: rs.length, b, m, gini: gini(b, m), p: rs.length ? b / rs.length : 0, ids: rs.map((r) => r.id), feature: n.feature ?? null, threshold: n.threshold ?? null };
      if (!isLeaf(n)) {
        walk(n.left, rs.filter((r) => r[n.feature] <= n.threshold));
        walk(n.right, rs.filter((r) => r[n.feature] > n.threshold));
        out[n.id].left = n.left.id; out[n.id].right = n.right.id;
      }
    };
    walk(tree, rows);
    return out;
  }

  function probTree(tree, stats, row) { return stats[route(tree, row).leaf].p; }
  // sklearn's predict takes argmax of predict_proba; a 0.5 tie goes to class 0 (malignant)
  const classOf = (p) => (p > 0.5 ? 1 : 0);

  function model(trees, which = 'tree1') {
    const train = records(trees.train);
    const list = which === 'forest' ? [trees.tree1, trees.tree2] : [trees[which]];
    const stats = list.map((t) => nodeStats(t, train));
    return { list, stats, prob: (row) => mean(list.map((t, k) => probTree(t, stats[k], row))) };
  }

  // tumors payload + trees payload in one object
  const withTrain = (trees, tumors) => ({ ...trees, train: tumors });

  function treeView({ tumors, trees, which = 'tree1' }) {
    const rows = records(tumors);
    const tree = trees[which];
    const st = nodeStats(tree, rows);
    const build = (n) => {
      const s = st[n.id];
      const head = isLeaf(n) ? `leaf: P(benign) = ${dn(s.p, 2)}` : `**${n.feature} ≤ ${n.threshold}?**`;
      return {
        id: n.id, label: head, note: `${s.n} rows (${s.b}B, ${s.m}M), Gini ${dn(s.gini, 3)}`,
        tone: isLeaf(n) ? (s.p > 0.5 ? 'good' : 'bad') : undefined,
        ...(isLeaf(n) ? {} : { children: [build(n.left), build(n.right)] }),
      };
    };
    const strip = (o) => JSON.parse(JSON.stringify(o));
    return { root: strip(build(tree)), stats: st };
  }

  // ------------------------------------------------------------ 1. impurity (built-in) importance
  function impurity({ tumors, trees, which = 'tree1' }) {
    const rows = records(tumors);
    const tree = trees[which];
    const st = nodeStats(tree, rows);
    const N = rows.length;
    const splits = [];
    const visit = (n) => {
      if (isLeaf(n)) return;
      const s = st[n.id], L = st[n.left.id], R = st[n.right.id];
      const child = (L.n / s.n) * L.gini + (R.n / s.n) * R.gini;
      const dec = (s.n / N) * (s.gini - child);
      splits.push({ node: n.id, feature: n.feature, nt: s.n, giniT: s.gini, giniL: L.gini, giniR: R.gini, nL: L.n, nR: R.n, child, decrease: dec });
      visit(n.left); visit(n.right);
    };
    visit(tree);
    const raw = Object.fromEntries(FEATURES.map((f) => [f, sum(splits.filter((s) => s.feature === f).map((s) => s.decrease))]));
    const total = sum(Object.values(raw));
    const importance = Object.fromEntries(FEATURES.map((f) => [f, total ? raw[f] / total : 0]));
    return { splits, raw, total, importance, radius: importance.radius, texture: importance.texture, area: importance.area,
      bars: [{ name: 'importance', x: FEATURES, y: FEATURES.map((f) => importance[f]) }] };
  }

  function forestImportance({ tumors, trees }) {
    const a = impurity({ tumors, trees, which: 'tree1' }).importance;
    const b = impurity({ tumors, trees, which: 'tree2' }).importance;
    const imp = Object.fromEntries(FEATURES.map((f) => [f, (a[f] + b[f]) / 2]));
    return { importance: imp, radius: imp.radius, area: imp.area, texture: imp.texture, tree1: a, tree2: b,
      bars: [{ name: 'tree 1', x: FEATURES, y: FEATURES.map((f) => a[f]) }, { name: 'tree 2', x: FEATURES, y: FEATURES.map((f) => b[f]) }, { name: 'forest', x: FEATURES, y: FEATURES.map((f) => imp[f]) }] };
  }

  function impuritySheet({ tumors, trees, upTo = 99 }) {
    const im = impurity({ tumors, trees });
    const rows = im.splits.map((s) => s.node);
    const values = im.splits.map((s, k) => (k < upTo
      ? [txt(s.feature), `${s.nt}/10`, s.giniT, `\\tfrac{${s.nL}}{${s.nt}}(${dn(s.giniL, 3)}) + \\tfrac{${s.nR}}{${s.nt}}(${dn(s.giniR, 3)})`, s.decrease]
      : [txt(s.feature), null, null, null, null]));
    const done = upTo >= im.splits.length;
    return { rows, cols: ['feature', 'share', 'Gini', 'children', 'decrease'], values, done,
      summary: { rows: FEATURES, cols: ['raw', 'importance'], values: FEATURES.map((f) => (done ? [im.raw[f], im.importance[f]] : [null, null])) } };
  }

  // roles: sheet (Matrix), tree (Tree), sum (Matrix). Patches impUpTo.
  function impurityWalk({ tumors, trees }) {
    const im = impurity({ tumors, trees });
    const trace = im.splits.map((s, k) => ({
      label: `${s.node} splits on ${s.feature}: $\\tfrac{${s.nt}}{10}\\big(${dn(s.giniT, 3)} - ${dn(s.child, 3)}\\big) = ${dn(s.decrease, 4)}$`,
      patch: { impUpTo: k + 1 }, vars: { decrease: s.decrease },
      ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: `row:${s.node}`, tone: 'accent' } }, { role: 'tree', cmd: 'highlight', args: { sel: `node:${s.node}`, tone: 'accent' } }],
    }));
    trace.push({ label: `Sum per feature, then divide by the total ${dn(im.total, 4)}: radius ${dn(im.radius, 3)}, texture ${dn(im.texture, 3)}, area 0.`, patch: { impUpTo: im.splits.length }, vars: { total: im.total },
      ops: [{ role: 'sum', cmd: 'highlight', args: { sel: 'col:importance', tone: 'good' } }] });
    return { steps: trace.length, trace };
  }

  // Line-by-line trace of impurity_importance(). anchors: gini, child, weight, add, norm. roles: tree (Tree)
  function impurityCode({ tumors, trees }) {
    const im = impurity({ tumors, trees });
    const trace = [];
    for (const s of im.splits) {
      trace.push({ label: `Node ${s.node} (${s.feature}): Gini of its ${s.nt} rows $= ${dn(s.giniT, 4)}$.`, code: 'gini', math: 'gini', vars: { node: s.node, gini_t: s.giniT }, ops: [{ role: 'tree', cmd: 'highlight', args: { sel: `node:${s.node}`, tone: 'accent' } }] });
      trace.push({ label: `Weighted child Gini $= \\tfrac{${s.nL}}{${s.nt}}${dn(s.giniL, 3)} + \\tfrac{${s.nR}}{${s.nt}}${dn(s.giniR, 3)} = ${dn(s.child, 4)}$.`, code: 'child', math: 'child', vars: { child: s.child }, ops: [{ role: 'tree', cmd: 'highlight', args: { sel: `node:${s.node}`, tone: 'warn' } }] });
      trace.push({ label: `Weight by the share of rows reaching it: $\\tfrac{${s.nt}}{10}(${dn(s.giniT, 3)} - ${dn(s.child, 3)}) = ${dn(s.decrease, 4)}$.`, code: 'weight', math: 'weight', vars: { decrease: s.decrease }, ops: [{ role: 'tree', cmd: 'annotate', args: { sel: `node:${s.node}`, text: `−${dn(s.decrease, 3)}` } }] });
      trace.push({ label: `Add it to ${s.feature}: raw[${s.feature}] $= ${dn(sum(im.splits.filter((t) => t.feature === s.feature && im.splits.indexOf(t) <= im.splits.indexOf(s)).map((t) => t.decrease)), 4)}$.`, code: 'add', math: 'add', vars: { feature: s.feature }, ops: [] });
    }
    trace.push({ label: `Normalize by ${dn(im.total, 4)}: radius ${dn(im.radius, 3)}, texture ${dn(im.texture, 3)}, area ${dn(im.area, 3)}.`, code: 'norm', math: 'norm', vars: { radius: im.radius, texture: im.texture }, ops: [{ role: 'tree', cmd: 'highlight', args: { sel: ['node:root', 'node:n1'], tone: 'good' } }] });
    return { importance: im.importance, trace };
  }

  // ------------------------------------------------------------ 2. permutation importance
  function permute(rows, features, perm) {
    return rows.map((r, i) => {
      const src = rows[perm[i]];
      const out = { ...r };
      for (const f of features) out[f] = src[f];
      return out;
    });
  }
  function accuracy(m, rows) { return mean(rows.map((r) => (classOf(m.prob(r)) === r.benign ? 1 : 0))); }

  function shuffleView({ tumors, trees, which = 'tree1', feature = 'none', perm = 'reverse' }) {
    const rows = records(tumors);
    const m = model(withTrain(trees, tumors), which);
    const feats = feature === 'none' ? [] : feature === 'twins' ? ['radius', 'area'] : [feature];
    const P = trees.permutations[perm];
    const sh = permute(rows, feats, P);
    const base = accuracy(m, rows);
    const acc = accuracy(m, sh);
    const values = sh.map((r) => {
      const p = m.prob(r);
      const ok = classOf(p) === r.benign;
      return [r.radius, r.area, r.texture, r.benign, p, ok ? '\\checkmark' : '\\times'];
    });
    return {
      table: { rows: sh.map((r) => r.id), cols: ['radius', 'area', 'texture', 'benign', 'P(benign)', 'right?'], values },
      base, acc, drop: base - acc, correct: Math.round(acc * rows.length), shuffled: feats,
      wrongRows: sh.filter((r) => classOf(m.prob(r)) !== r.benign).map((r) => `row:${r.id}`),
      shuffledCols: feats.map((f) => `col:${f}`),
    };
  }

  function permImportance({ tumors, trees, which = 'tree1', features = ['radius', 'area', 'texture'], perms = ['reverse', 'shift'] }) {
    const rows = records(tumors);
    const m = model(withTrain(trees, tumors), which);
    const base = accuracy(m, rows);
    const res = {};
    for (const f of features) {
      const feats = f === 'twins' ? ['radius', 'area'] : [f];
      const drops = perms.map((p) => base - accuracy(m, permute(rows, feats, trees.permutations[p])));
      res[f] = { drops, mean: mean(drops) };
    }
    const imp = Object.fromEntries(features.map((f) => [f, res[f].mean]));
    return { base, res, importance: imp, ...imp, bars: [{ name: 'mean drop in accuracy', x: features, y: features.map((f) => imp[f]) }] };
  }

  // Line-by-line trace of permutation_importance(). anchors: base, shuffle, score, drop, avg. roles: data (Matrix)
  function permCode({ tumors, trees, which = 'tree1', features = ['radius', 'texture'], perms = ['reverse', 'shift'] }) {
    const rows = records(tumors);
    const m = model(withTrain(trees, tumors), which);
    const base = accuracy(m, rows);
    const trace = [{ label: `Baseline accuracy on the unshuffled rows: $${Math.round(base * 10)}/10 = ${dn(base, 2)}$.`, code: 'base', math: 'base', vars: { baseline: base }, ops: [{ role: 'data', cmd: 'clear' }] }];
    const out = {};
    for (const f of features) {
      const drops = [];
      for (const p of perms) {
        trace.push({ label: `Feature **${f}**, shuffle "${p}": the column is reordered, everything else stays.`, code: 'shuffle', math: 'shuffle', vars: { feature: f, perm: p },
          ops: [{ role: 'data', cmd: 'highlight', args: { sel: `col:${f}`, tone: 'warn' } }] });
        const acc = accuracy(m, permute(rows, [f], trees.permutations[p]));
        trace.push({ label: `Re-score: accuracy $= ${dn(acc, 2)}$.`, code: 'score', math: 'score', vars: { score: acc }, ops: [{ role: 'data', cmd: 'highlight', args: { sel: `col:${f}`, tone: 'accent' } }] });
        drops.push(base - acc);
        trace.push({ label: `Drop $= ${dn(base, 2)} - ${dn(acc, 2)} = ${dn(base - acc, 2)}$.`, code: 'drop', math: 'drop', vars: { drop: base - acc }, ops: [{ role: 'data', cmd: 'annotate', args: { sel: `col:${f}`, text: `${p}: ${sg(base - acc, 2)}` } }] });
      }
      out[f] = mean(drops);
      trace.push({ label: `Importance(${f}) = mean of ${drops.map((d) => dn(d, 2)).join(' and ')} $= ${dn(out[f], 2)}$.`, code: 'avg', math: 'avg', vars: { importance: out[f] }, ops: [{ role: 'data', cmd: 'highlight', args: { sel: `col:${f}`, tone: 'good' } }] });
    }
    return { base, importance: out, trace };
  }

  // ------------------------------------------------------------ 3. twins (correlated features)
  function twinsSummary({ tumors, trees }) {
    const fi = forestImportance({ tumors, trees });
    const single = permImportance({ tumors, trees, which: 'tree1', features: ['radius', 'area', 'texture', 'twins'] });
    const forest = permImportance({ tumors, trees, which: 'forest', features: ['radius', 'area', 'texture', 'twins'] });
    return {
      builtin: fi.importance, permTree: single.importance, permForest: forest.importance,
      table: {
        rows: ['radius', 'area', 'texture', 'radius+area'],
        cols: ['built-in (forest)', 'perm (tree 1)', 'perm (forest)'],
        values: [
          [fi.radius, single.radius, forest.radius], [fi.area, single.area, forest.area], [fi.texture, single.texture, forest.texture], [null, single.twins, forest.twins],
        ],
      },
      radiusForest: forest.radius, twinsForest: forest.twins,
    };
  }

  // anchors: avg, base, one, both, drops. roles: toy (Matrix of the shuffled rows)
  function twinsCode({ tumors, trees }) {
    const ts = twinsSummary({ tumors, trees });
    const one = shuffleView({ tumors, trees, which: 'forest', feature: 'radius', perm: 'reverse' });
    const both = shuffleView({ tumors, trees, which: 'forest', feature: 'twins', perm: 'reverse' });
    return {
      one: one.drop, both: both.drop,
      trace: [
        { label: 'The forest averages tree 1 (splits on radius) and tree 2 (splits on area).', code: 'avg', math: 'avg', vars: { trees: 2 }, ops: [{ role: 'toy', cmd: 'clear' }] },
        { label: `Baseline accuracy $= ${dn(one.base, 2)}$.`, code: 'base', math: 'base', vars: { base: one.base }, ops: [{ role: 'toy', cmd: 'highlight', args: { sel: 'col:right?', tone: 'accent' } }] },
        { label: `Reverse **radius** only: tree 2 still sees the true area. Accuracy $${dn(one.acc, 2)}$, drop ${sg(one.drop, 2)}.`, code: 'one', math: 'one', vars: { drop_radius: one.drop }, ops: [{ role: 'toy', cmd: 'highlight', args: { sel: 'col:radius', tone: 'warn' } }] },
        { label: `Reverse radius **and** area together: accuracy $${dn(both.acc, 2)}$, drop ${sg(both.drop, 2)}.`, code: 'both', math: 'both', vars: { drop_both: both.drop }, ops: [{ role: 'toy', cmd: 'highlight', args: { sel: ['col:radius', 'col:area'], tone: 'bad' } }] },
        { label: `Alone each twin looks useless (even harmful); together they matter. Mean over two shuffles: ${sg(ts.radiusForest, 2)} vs ${sg(ts.twinsForest, 2)}.`, code: 'drops', math: 'drops', vars: { radius: ts.radiusForest, twins: ts.twinsForest }, ops: [] },
      ],
    };
  }

  // Lecture: the twins on the real forest.
  function rankImportance({ bcimp, by = 'builtin', k = 10 }) {
    const recs = records(bcimp);
    const sorted = recs.slice().sort((a, b) => b[by] - a[by]);
    const rank = Object.fromEntries(sorted.map((r, i) => [r.feature, i + 1]));
    const top = sorted.slice(0, k);
    return {
      ranked: sorted.map((r) => r.feature), rank, top: top.map((r) => r.feature), total: sum(recs.map((r) => r[by])),
      series: [{ name: by, x: top.map((r) => shortName(r.feature)), y: top.map((r) => r[by]) }],
      worstRadius: rank['worst radius'], worstArea: rank['worst area'], worstPerimeter: rank['worst perimeter'],
      negatives: recs.filter((r) => r[by] < 0).length,
    };
  }

  function twinsLecture({ bcimp }) {
    const b = rankImportance({ bcimp, by: 'builtin' });
    const p = rankImportance({ bcimp, by: 'perm' });
    const fs = ['worst perimeter', 'worst area', 'worst radius', 'mean perimeter', 'mean radius', 'mean area'];
    const recs = Object.fromEntries(records(bcimp).map((r) => [r.feature, r]));
    return {
      table: { rows: fs.map((f) => f.replace(' ', '-')), cols: ['built-in', 'rank', 'permutation', 'rank '], values: fs.map((f) => [recs[f].builtin, b.rank[f], recs[f].perm, p.rank[f]]) },
      radiusBuiltinRank: b.rank['worst radius'], radiusPermRank: p.rank['worst radius'],
    };
  }

  // ------------------------------------------------------------ 4. partial dependence
  function pdpPoint({ tumors, trees, which = 'tree1', feature = 'radius', v = 13 }) {
    const rows = records(tumors);
    const m = model(withTrain(trees, tumors), which);
    const forced = rows.map((r) => ({ ...r, [feature]: v }));
    const ps = forced.map((r) => m.prob(r));
    const avg = mean(ps);
    const r2 = (x) => Math.sqrt(x / Math.PI);
    const impossible = forced.filter((r) => Math.abs(r2(r.area) - r.radius) > 1.5).length;
    return {
      v, avg, ps, impossible,
      table: { rows: rows.map((r) => r.id), cols: [feature, 'area', 'texture', 'P(benign)'], values: forced.map((r, i) => [r[feature], r.area, r.texture, ps[i]]) },
    };
  }

  function pdp({ tumors, trees, which = 'tree1', feature = 'radius', grid = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20] }) {
    const ys = grid.map((v) => pdpPoint({ tumors, trees, which, feature, v }).avg);
    return { grid, ys, series: [{ name: `PDP (${which})`, x: grid, y: ys }] };
  }

  function pdpBoth({ tumors, trees, feature = 'radius', v = null, grid = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20] }) {
    const a = pdp({ tumors, trees, which: 'tree1', feature, grid });
    const b = pdp({ tumors, trees, which: 'forest', feature, grid });
    const series = [{ name: 'tree 1 (radius only)', x: grid, y: a.ys }, { name: 'forest (radius + area twins)', x: grid, y: b.ys }];
    if (v !== null) {
      const p = pdpPoint({ tumors, trees, which: 'tree1', feature, v });
      series.push({ name: 'current value', x: [v], y: [p.avg] });
    }
    return { series, tree: a.ys, forest: b.ys, jumpTree: a.ys[0] - a.ys[a.ys.length - 1], jumpForest: b.ys[0] - b.ys[b.ys.length - 1] };
  }

  // Line-by-line trace of partial_dependence(). anchors: grid, force, predict, avg. roles: data (Matrix), curve (Chart)
  function pdpCode({ tumors, trees, which = 'tree1', feature = 'radius', grid = [12, 14, 16, 18] }) {
    const rows = records(tumors);
    const trace = [{ label: `Grid of ${feature} values: ${grid.join(', ')}.`, code: 'grid', math: 'grid', vars: { grid: grid.join(', ') }, ops: [{ role: 'curve', cmd: 'clear' }] }];
    const ys = [];
    grid.forEach((v, gi) => {
      trace.push({ label: `Set **every** row's ${feature} to ${v}; the other columns stay as they are.`, code: 'force', math: 'force', vars: { v },
        ops: [{ role: 'data', cmd: 'highlight', args: { sel: `col:${feature}`, tone: 'warn' } }] });
      const p = pdpPoint({ tumors, trees, which, feature, v });
      const counts = {};
      p.ps.forEach((x) => (counts[dn(x, 3)] = (counts[dn(x, 3)] ?? 0) + 1));
      trace.push({ label: `Predict all ${rows.length} rows: ${Object.entries(counts).map(([k, c]) => `${c}×${k}`).join(', ')}.`, code: 'predict', math: 'predict', vars: { v },
        ops: [{ role: 'data', cmd: 'highlight', args: { sel: 'col:P(benign)', tone: 'accent' } }] });
      ys.push(p.avg);
      trace.push({ label: `Average: $\\hat f(${v}) = ${dn(p.avg, 3)}$.`, code: 'avg', math: 'avg', vars: { pd: p.avg },
        ops: [{ role: 'curve', cmd: 'highlight', args: { sel: `point:PDP (${which}),${gi}`, tone: 'good' } }] });
    });
    return { ys, trace };
  }

  // ------------------------------------------------------------ 5. Shapley values
  const ORDERS = [['A', 'B', 'C'], ['A', 'C', 'B'], ['B', 'A', 'C'], ['B', 'C', 'A'], ['C', 'A', 'B'], ['C', 'B', 'A']];
  const keyOf = (set) => (set.length ? set.slice().sort().join('') : 'none');

  function shapley({ game }) {
    const v = game.v;
    const rows = ORDERS.map((o) => {
      const d = {};
      let known = [];
      for (const p of o) { d[p] = v[keyOf([...known, p])] - v[keyOf(known)]; known = [...known, p]; }
      return { order: o, d };
    });
    const phi = Object.fromEntries(game.players.map((p) => [p, mean(rows.map((r) => r.d[p]))]));
    const total = sum(Object.values(phi));
    return {
      rows, phi, A: phi.A, B: phi.B, C: phi.C, total, gap: v[keyOf(game.players)] - v.none, base: v.none, fx: v[keyOf(game.players)],
      rowSums: rows.map((r) => sum(Object.values(r.d))),
      bars: [{ name: 'φ', x: game.players, y: game.players.map((p) => phi[p]) }],
    };
  }

  function shapleySheet({ game, upTo = 99 }) {
    const s = shapley({ game });
    const values = s.rows.map((r, k) => (k < upTo ? [r.d.A, r.d.B, r.d.C, sum(Object.values(r.d))] : [null, null, null, null]));
    values.push(upTo >= 6 ? [s.A, s.B, s.C, s.total] : [null, null, null, null]);
    return { rows: [...s.rows.map((r) => r.order.join('-')), 'average'], cols: ['ΔA', 'ΔB', 'ΔC', 'sum'], values, done: Math.min(upTo, 6) };
  }

  // roles: sheet (Matrix). Patches shapUpTo.
  function shapleyWalk({ game }) {
    const s = shapley({ game });
    const v = game.v;
    const trace = s.rows.map((r, k) => {
      let known = [];
      const parts = r.order.map((p) => { const a = keyOf(known), b = keyOf([...known, p]); known = [...known, p]; return `${p}: ${dn(v[b], 2)} − ${dn(v[a], 2)} = ${sg(r.d[p], 2)}`; });
      return { label: `${r.order.join(' → ')}: ${parts.join('; ')}`, patch: { shapUpTo: k + 1 }, vars: { dA: r.d.A, dB: r.d.B, dC: r.d.C },
        ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: `row:${r.order.join('-')}`, tone: 'accent' } }] };
    });
    trace.push({ label: `Average each column: φ = (${dn(s.A, 2)}, ${sg(s.B, 2)}, ${dn(s.C, 2)}); sum ${dn(s.total, 2)}.`, patch: { shapUpTo: 6 }, vars: { phiA: s.A, phiB: s.B, phiC: s.C },
      ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: 'row:average', tone: 'good' } }] });
    return { steps: trace.length, phi: s.phi, trace };
  }

  // Line-by-line trace of shapley_by_orderings(). anchors: orders, before, after, delta, avg. roles: sheet (Matrix)
  function shapleyOrderCode({ game, player = 'A' }) {
    const v = game.v;
    const trace = [{ label: `All $3! = 6$ orderings of A, B, C.`, code: 'orders', math: 'orders', vars: { player }, ops: [{ role: 'sheet', cmd: 'clear' }] }];
    const ds = [];
    for (const o of ORDERS) {
      const before = o.slice(0, o.indexOf(player));
      const a = keyOf(before), b = keyOf([...before, player]);
      trace.push({ label: `${o.join('→')}: known before ${player} = {${before.join(', ')}}, $v = ${dn(v[a], 2)}$.`, code: 'before', math: 'before', vars: { S: `{${before.join(',')}}`, v_S: v[a] },
        ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: `row:${o.join('-')}`, tone: 'accent' } }] });
      trace.push({ label: `With ${player} added: $v = ${dn(v[b], 2)}$.`, code: 'after', math: 'after', vars: { v_S_j: v[b] }, ops: [] });
      ds.push(v[b] - v[a]);
      trace.push({ label: `Marginal contribution ${sg(v[b] - v[a], 2)}.`, code: 'delta', math: 'delta', vars: { delta: v[b] - v[a] },
        ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: `cell:${o.join('-')},Δ${player}`, tone: 'good' } }] });
    }
    trace.push({ label: `$\\phi_${player} = (${ds.map((d) => dn(d, 2)).join(' ')}) / 6 = ${dn(mean(ds), 3)}$.`, code: 'avg', math: 'avg', vars: { phi: mean(ds) },
      ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: `cell:average,Δ${player}`, tone: 'good' } }] });
    return { phi: mean(ds), trace };
  }

  const fact = (n) => (n <= 1 ? 1 : n * fact(n - 1));
  function shapleyWeights({ game, player = 'A' }) {
    const others = game.players.filter((p) => p !== player);
    const n = game.players.length;
    const subsets = [[], ...others.map((o) => [o]), others];
    const rows = subsets.map((S) => {
      const w = (fact(S.length) * fact(n - S.length - 1)) / fact(n);
      const gain = game.v[keyOf([...S, player])] - game.v[keyOf(S)];
      return { S, w, gain, term: w * gain };
    });
    const phi = sum(rows.map((r) => r.term));
    return {
      phi, rows,
      table: { rows: rows.map((r) => (r.S.length ? r.S.join('') : 'none')), cols: ['size', 'weight', 'gain', 'term'], values: rows.map((r) => [r.S.length, `${fact(r.S.length) * fact(n - r.S.length - 1)}/${fact(n)}`, r.gain, r.term]) },
    };
  }

  // anchors: subsets, weight, gain, term, phi. roles: weights (Matrix)
  function shapleyWeightCode({ game, player = 'A' }) {
    const sw = shapleyWeights({ game, player });
    const n = game.players.length;
    const trace = [{ label: `Subsets S of the other players: ${sw.rows.map((r) => `{${r.S.join(',')}}`).join(', ')}.`, code: 'subsets', math: 'subsets', vars: { player }, ops: [{ role: 'weights', cmd: 'clear' }] }];
    let acc = 0;
    for (const r of sw.rows) {
      const label = r.S.length ? r.S.join('') : 'none';
      trace.push({ label: `S = {${r.S.join(',')}}: weight $\\frac{${r.S.length}!\\,${n - r.S.length - 1}!}{${n}!} = ${fact(r.S.length) * fact(n - r.S.length - 1)}/${fact(n)}$.`, code: 'weight', math: 'weight', vars: { size: r.S.length, w: r.w },
        ops: [{ role: 'weights', cmd: 'highlight', args: { sel: `cell:${label},weight`, tone: 'accent' } }] });
      trace.push({ label: `Gain from adding ${player}: $${dn(game.v[keyOf([...r.S, player])], 2)} - ${dn(game.v[keyOf(r.S)], 2)} = ${sg(r.gain, 2)}$.`, code: 'gain', math: 'gain', vars: { gain: r.gain },
        ops: [{ role: 'weights', cmd: 'highlight', args: { sel: `cell:${label},gain`, tone: 'accent' } }] });
      acc += r.term;
      trace.push({ label: `Weighted term ${sg(r.term, 4)}; running total ${dn(acc, 4)}.`, code: 'term', math: 'term', vars: { term: r.term, phi: acc },
        ops: [{ role: 'weights', cmd: 'highlight', args: { sel: `row:${label}`, tone: 'good' } }] });
    }
    trace.push({ label: `$\\phi_${player} = ${dn(acc, 3)}$, the same as averaging over orderings.`, code: 'phi', math: 'phi', vars: { phi: acc }, ops: [] });
    return { phi: sw.phi, trace };
  }

  // SHAP additivity on the real patient, for either class.
  function additivity({ patient, cls = 1 }) {
    const base = cls === 1 ? patient.baseBenign : patient.baseMalignant;
    const s = cls === 1 ? patient.sumShap : -patient.sumShap;
    const fx = base + s;
    return {
      cls, base, sum: s, fx, label: cls === 1 ? 'P(benign)' : 'P(malignant)',
      bars: [{ name: 'probability', x: ['baseline E[f(x)]', 'sum of SHAP values', 'f(x)'], y: [base, s, fx] }],
      text: `${dn(base, 4)} ${s >= 0 ? '+' : '−'} ${dn(Math.abs(s), 4)} = ${dn(fx, 4)}`,
    };
  }

  // anchors: explain, slice, base, add, check. roles: none (pane only)
  function additivityCode({ patient }) {
    const a = additivity({ patient, cls: 1 });
    return {
      fx: a.fx,
      trace: [
        { label: '`TreeExplainer` computes exact SHAP values for every test row and both classes.', code: 'explain', math: 'explain', vars: { shape: '(143, 30, 2)' }, ops: [{ role: 'out', cmd: 'clear' }] },
        { label: 'Slice row 94 (dataset row 205), all 30 features, **class 1 = benign**.', code: 'slice', math: 'slice', vars: { cls: 1 }, ops: [] },
        { label: `Baseline $E[f(x)] = ${dn(patient.baseBenign, 4)}$: roughly the benign share of the data.`, code: 'base', math: 'base', vars: { base: patient.baseBenign }, ops: [{ role: 'out', cmd: 'highlight', args: { sel: 'item:0', tone: 'accent' } }] },
        { label: `The 30 contributions add to $${dn(patient.sumShap, 4)}$.`, code: 'add', math: 'add', vars: { sum: patient.sumShap }, ops: [{ role: 'out', cmd: 'highlight', args: { sel: 'item:1', tone: 'bad' } }] },
        { label: `$${dn(patient.baseBenign, 4)} + (${dn(patient.sumShap, 4)}) = ${dn(a.fx, 4)}$ = the forest's P(benign). Nothing left over.`, code: 'check', math: 'check', vars: { fx: a.fx }, ops: [{ role: 'out', cmd: 'highlight', args: { sel: 'item:2', tone: 'good' } }] },
      ],
    };
  }

  // ------------------------------------------------------------ 6. LIME (1-D toy)
  // The "complex model": P(benign) as a smooth function of radius.
  const F = (x) => 1 / (1 + Math.exp(1.5 * (x - 15)));
  const dF = (x) => -1.5 * F(x) * (1 - F(x));
  function limeCurve({ x }) { return { y: F(x) }; }

  function limeFit({ x0 = 16, sigma = 2, deltas = [-3, -2, -1, 0, 1, 2, 3] }) {
    const pts = deltas.map((d) => { const x = x0 + d; return { x, y: F(x), w: Math.exp(-(d * d) / (sigma * sigma)) }; });
    const W = sum(pts.map((p) => p.w));
    const xbar = sum(pts.map((p) => p.w * p.x)) / W;
    const ybar = sum(pts.map((p) => p.w * p.y)) / W;
    const sxy = sum(pts.map((p) => p.w * (p.x - xbar) * (p.y - ybar)));
    const sxx = sum(pts.map((p) => p.w * (p.x - xbar) ** 2));
    const b = sxy / sxx;
    const a = ybar - b * xbar;
    const xs = Array.from({ length: 41 }, (_, i) => 10 + i * 0.25);
    return {
      x0, sigma, b, a, xbar, ybar, W, sxy, sxx, trueSlope: dF(x0), fx0: F(x0), gap: Math.abs(b - dF(x0)),
      table: { rows: pts.map((_, i) => `z${i + 1}`), cols: ['x', 'f(x)', 'weight'], values: pts.map((p) => [p.x, p.y, p.w]) },
      series: [
        { name: 'model f', x: xs, y: xs.map(F) },
        { name: 'perturbed samples', x: pts.map((p) => p.x), y: pts.map((p) => p.y) },
        { name: 'LIME line', x: [x0 - 3, x0 + 3], y: [a + b * (x0 - 3), a + b * (x0 + 3)] },
      ],
    };
  }

  // anchors: sample, predict, kernel, wls, coef. roles: pts (Matrix)
  function limeCode({ x0 = 16, sigma = 2, deltas = [-2, 0, 2] }) {
    const L = limeFit({ x0, sigma, deltas });
    const pts = L.table.values;
    const trace = [{ label: `Perturb around $x_0 = ${x0}$: ${pts.map((p) => p[0]).join(', ')}.`, code: 'sample', math: 'sample', vars: { x0 }, ops: [{ role: 'pts', cmd: 'highlight', args: { sel: 'col:x', tone: 'accent' } }] }];
    pts.forEach((p, i) => trace.push({ label: `Ask the **original** model: $f(${p[0]}) = ${dn(p[1], 4)}$.`, code: 'predict', math: 'predict', vars: { x: p[0], fx: p[1] }, ops: [{ role: 'pts', cmd: 'highlight', args: { sel: `cell:z${i + 1},f(x)`, tone: 'accent' } }] }));
    pts.forEach((p, i) => trace.push({ label: `Weight $e^{-(${p[0]} - ${x0})^2/${sigma}^2} = ${dn(p[2], 4)}$.`, code: 'kernel', math: 'kernel', vars: { w: p[2] }, ops: [{ role: 'pts', cmd: 'highlight', args: { sel: `cell:z${i + 1},weight`, tone: 'warn' } }] }));
    trace.push({ label: `Weighted means: $\\bar x = ${dn(L.xbar, 3)}$, $\\bar y = ${dn(L.ybar, 4)}$.`, code: 'wls', math: 'wls', vars: { xbar: L.xbar, ybar: L.ybar }, ops: [] });
    trace.push({ label: `Slope $= ${dn(L.sxy, 5)} / ${dn(L.sxx, 4)} = ${dn(L.b, 4)}$ per unit of radius.`, code: 'coef', math: 'coef', vars: { b: L.b }, ops: [{ role: 'pts', cmd: 'highlight', args: { sel: 'col:weight', tone: 'good' } }] });
    return { b: L.b, trace };
  }

  const condTex = (c) => c.replace(/[A-Za-z][A-Za-z ]*[A-Za-z]/g, (m) => `\\text{${m}}`).replace(/<=/g, '\\le ').replace(/>=/g, '\\ge ');
  function limeRank({ lime }) {
    const recs = records(lime);
    const byAbs = recs.slice().sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
    return {
      top: byAbs[0].condition, topWeight: byAbs[0].weight,
      towardMalignant: recs.filter((r) => r.weight < 0).length, towardBenign: recs.filter((r) => r.weight > 0).length,
      table: { rows: recs.map((_, i) => `c${i + 1}`), cols: ['condition', 'weight'], values: recs.map((r) => [condTex(r.condition), r.weight]) },
      series: [{ name: 'weight', x: recs.map((_, i) => `c${i + 1}`), y: recs.map((r) => r.weight) }],
    };
  }

  // ------------------------------------------------------------ 7. counterfactuals (linear toy model)
  const CF = { w0: 8, wr: -0.3, wa: -0.004 };
  function cfModel({ radius = 17.77, area = 989.5 }) {
    const logit = CF.w0 + CF.wr * radius + CF.wa * area;
    const p = 1 / (1 + Math.exp(-logit));
    const impliedR = Math.sqrt(area / Math.PI);
    const mismatch = Math.abs(impliedR - radius);
    return { radius, area, logit, p, cls: p > 0.5 ? 1 : 0, label: p > 0.5 ? 'benign' : 'malignant', impliedR, mismatch, plausible: mismatch <= 1.5 };
  }

  // One feature moves, the other is held: where does the logit cross 0?
  function cfOneFeature({ radius = 17.77, area = 989.5, feature = 'area' }) {
    if (feature === 'area') {
      const a = -(CF.w0 + CF.wr * radius) / CF.wa;
      return { feature, value: a, change: a - area, ...cfModel({ radius, area: a }), needed: a };
    }
    const r = -(CF.w0 + CF.wa * area) / CF.wr;
    return { feature, value: r, change: r - radius, ...cfModel({ radius: r, area }), needed: r };
  }

  // Move radius and keep area = π r² (a geometry-respecting counterfactual).
  function cfGeometric({ radius = 17.77 }) {
    // 8 − 0.3 r − 0.004 π r² = 0 → r = (−0.3 + √(0.09 + 4·0.004π·8)) / (2·0.004π)
    const a = -CF.wa * Math.PI, b = -CF.wr, c = -CF.w0;
    const r = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
    return { r, area: Math.PI * r * r, change: r - radius };
  }

  // Scene helper: with lock on, area follows the radius (area = π r²), so every edit is a possible tumour.
  function cfScene({ radius = 17.77, area = 989.5, lock = false }) {
    const locked = lock === true || lock === 'geometry';
    const A = locked ? Math.PI * radius * radius : area;
    const m = cfModel({ radius, area: A });
    return { ...m, effArea: A, verdict: m.cls === 1 ? (m.plausible ? 'benign, and a possible tumour' : 'benign, but no such tumour exists') : 'still malignant' };
  }

  // anchors: score, solve, check, plaus. roles: cf (Readout)
  function cfCode({ radius = 17.77, area = 989.5 }) {
    const m = cfModel({ radius, area });
    const one = cfOneFeature({ radius, area, feature: 'area' });
    return {
      area: one.value,
      trace: [
        { label: `Score: $8 - 0.3(${radius}) - 0.004(${area}) = ${dn(m.logit, 3)}$ → malignant.`, code: 'score', math: 'score', vars: { logit: m.logit }, ops: [{ role: 'cf', cmd: 'highlight', args: { sel: 'item:0', tone: 'bad' } }] },
        { label: `Hold radius, solve for the area where the score hits 0: $${dn(one.value, 1)}$.`, code: 'solve', math: 'solve', vars: { area_cf: one.value }, ops: [{ role: 'cf', cmd: 'highlight', args: { sel: 'item:1', tone: 'accent' } }] },
        { label: `Just below it the model says benign: the counterfactual is **valid**.`, code: 'check', math: 'check', vars: { valid: true }, ops: [{ role: 'cf', cmd: 'highlight', args: { sel: 'item:1', tone: 'good' } }] },
        { label: `But $\\sqrt{${dn(one.value, 0)}/\\pi} = ${dn(one.impliedR, 2)} \\ne ${radius}$: area and radius disagree, so **not plausible**.`, code: 'plaus', math: 'plaus', vars: { implied_r: one.impliedR }, ops: [{ role: 'cf', cmd: 'highlight', args: { sel: 'item:2', tone: 'bad' } }] },
      ],
    };
  }

  // DiCE rows from the notebook: does each counterfactual still look like a possible tumour?
  function diceCheck({ dice }) {
    const recs = records(dice);
    const rows = recs.map((r) => {
      const fromP = r['worst perimeter'] / (2 * Math.PI);
      const fromA = Math.sqrt(r['worst area'] / Math.PI);
      return { row: r.row, fromP, fromA, ratio: fromP / fromA };
    });
    const base = rows[0].ratio;
    return {
      rows, baseRatio: base, implausible: rows.slice(1).filter((r) => Math.abs(r.ratio - base) > 0.25).map((r) => r.row), cf1Ratio: rows[1].ratio,
      table: { rows: rows.map((r) => r.row), cols: ['r from perimeter', 'r from area', 'ratio'], values: rows.map((r) => [r.fromP, r.fromA, r.ratio]) },
    };
  }

  // ------------------------------------------------------------ generators
  function giniQ({ rng, difficulty }) {
    for (;;) {
      const bL = rng.int(0, 6), mL = rng.int(0, 6), bR = rng.int(0, 6), mR = rng.int(0, 6);
      const nL = bL + mL, nR = bR + mR;
      if (nL < 2 || nR < 2) continue;
      const b = bL + bR, m = mL + mR, nt = nL + nR;
      const N = difficulty === 1 ? nt : nt + rng.int(2, 10);
      const gT = gini(b, m), gL = gini(bL, mL), gR = gini(bR, mR);
      const child = (nL / nt) * gL + (nR / nt) * gR;
      const dec = (nt / N) * (gT - child);
      if (dec < 0.02) continue;
      if (difficulty === 1 && nt !== N) continue;
      return {
        vars: {
          bL, mL, bR, mR, nL, nR, b, m, nt, N, giniT: gT, giniL: gL, giniR: gR, child, decrease: dec, unweighted: gT - child,
          wrongNoChildWeights: gT - (gL + gR) / 2, wrongNoNodeWeight: gT - child,
        },
      };
    }
  }

  function impurityQ({ rng, difficulty }) {
    for (;;) {
      const feats = ['radius', 'texture', 'smoothness'];
      const n = difficulty === 1 ? 2 : 3;
      const splits = Array.from({ length: n }, () => ({ feature: rng.pick(feats.slice(0, difficulty === 3 ? 3 : 2)), decrease: rng.int(1, 9) / 100 }));
      const raw = Object.fromEntries(feats.map((f) => [f, sum(splits.filter((s) => s.feature === f).map((s) => s.decrease))]));
      const total = sum(Object.values(raw));
      const target = rng.pick(feats.filter((f) => raw[f] > 0));
      const imp = raw[target] / total;
      if (Math.abs(imp - raw[target]) < 0.01 || imp === 1) continue;
      const firstOnly = splits.find((s) => s.feature === target).decrease / total;
      if (Math.abs(firstOnly - imp) < 1e-9 && splits.filter((s) => s.feature === target).length > 1) continue;
      return {
        vars: {
          splits: splits.map((s, i) => `split ${i + 1}: ${s.feature}, decrease ${s.decrease}`).join('; '), target, raw: raw[target], total, imp,
          wrongRaw: raw[target], wrongFirst: firstOnly,
          table: { rows: splits.map((_, i) => `split${i + 1}`), cols: ['feature', 'weighted decrease'], values: splits.map((s) => [txt(s.feature), s.decrease]) },
        },
      };
    }
  }

  function permQ({ rng, difficulty }) {
    for (;;) {
      const metric = difficulty === 1 ? 'accuracy' : rng.pick(['accuracy', 'ROC-AUC']);
      const base = metric === 'accuracy' ? rng.int(80, 96) / 100 : rng.int(900, 995) / 1000;
      const reps = difficulty === 3 ? 4 : 3;
      const shuffled = Array.from({ length: reps }, () => +(base - rng.int(-2, 15) / (metric === 'accuracy' ? 100 : 1000)).toFixed(3));
      const drops = shuffled.map((s) => base - s);
      const imp = mean(drops);
      if (Math.abs(imp) < 0.002) continue;
      const wrongRatio = mean(shuffled) / base;
      return { vars: { metric, base, shuffled, shuffledList: shuffled.join(', '), reps, imp, meanShuffled: mean(shuffled), wrongSign: -imp, wrongRatio, wrongFirst: drops[0] } };
    }
  }

  // PDP on a simple threshold model over a small table
  function pdpQ({ rng, difficulty }) {
    for (;;) {
      const n = difficulty === 1 ? 4 : 5;
      const t = rng.int(12, 16);
      const rows = Array.from({ length: n }, (_, i) => ({ id: `R${i + 1}`, radius: rng.int(9, 21), texture: rng.int(12, 30) }));
      const v = rng.int(9, 21);
      const tex = rng.int(17, 24);
      // model: if radius ≤ t: (texture ≤ tex ? 0.9 : 0.5) else 0.1
      const f = (r, x) => (r <= t ? (x <= tex ? 0.9 : 0.5) : 0.1);
      const ps = rows.map((r) => f(v, r.texture));
      const pd = mean(ps);
      const own = mean(rows.map((r) => f(r.radius, r.texture)));
      const single = f(v, rows[0].texture);
      if (Math.abs(own - pd) < 0.01 || Math.abs(single - pd) < 0.01) continue;
      return {
        vars: {
          t, tex, v, pd, own, ps, p1: ps[0], r1tex: rows[0].texture, rule: `P(benign) = 0.9 if radius ≤ ${t} and texture ≤ ${tex}; 0.5 if radius ≤ ${t} and texture > ${tex}; 0.1 if radius > ${t}`,
          table: { rows: rows.map((r) => r.id), cols: ['radius', 'texture'], values: rows.map((r) => [r.radius, r.texture]) },
          wrongOwn: own, wrongSingle: single,
        },
      };
    }
  }

  function shapleyQ({ rng, difficulty }) {
    for (;;) {
      const r2 = () => rng.int(5, 95) / 100;
      if (difficulty < 3) {
        const v = { none: r2(), A: r2(), B: r2(), AB: r2() };
        const phiA = ((v.A - v.none) + (v.AB - v.B)) / 2;
        const phiB = ((v.B - v.none) + (v.AB - v.A)) / 2;
        const firstOnly = v.A - v.none;
        if (Math.abs(phiA - firstOnly) < 0.02 || Math.abs(phiA) < 0.01) continue;
        return { vars: { players: 2, v, vNone: v.none, vA: v.A, vB: v.B, vAB: v.AB, phiA, phiB, gap: v.AB - v.none, wrongFirst: firstOnly, wrongLast: v.AB - v.B, sumCheck: phiA + phiB } };
      }
      const v = { none: r2(), A: r2(), B: r2(), C: r2(), AB: r2(), AC: r2(), BC: r2(), ABC: r2() };
      const s = shapley({ game: { players: ['A', 'B', 'C'], v } });
      const firstOnly = v.A - v.none;
      if (Math.abs(s.A - firstOnly) < 0.02) continue;
      return { vars: { players: 3, v, vNone: v.none, vA: v.A, vB: v.B, vC: v.C, vAB: v.AB, vAC: v.AC, vBC: v.BC, vABC: v.ABC, phiA: s.A, phiB: s.B, gap: v.ABC - v.none, wrongFirst: firstOnly, wrongLast: v.ABC - v.BC, sumCheck: s.total } };
    }
  }

  function additivityQ({ rng, difficulty }) {
    for (;;) {
      const base = rng.int(30, 80) / 100;
      const k = difficulty === 1 ? 3 : 4;
      const phis = Array.from({ length: k }, () => rng.int(-25, 20) / 100);
      const fx = base + sum(phis);
      if (fx <= 0.02 || fx >= 0.98) continue;
      const hide = rng.int(0, k - 1);
      const names = ['radius', 'texture', 'concavity', 'symmetry'].slice(0, k);
      const shown = phis.map((p, i) => (i === hide ? '?' : sg(p, 2)));
      return {
        vars: {
          base, fx, phis, missing: phis[hide], missingName: names[hide], list: names.map((n, i) => `${n}: ${shown[i]}`).join(', '), sumAll: sum(phis),
          wrongNoBase: fx - sum(phis.filter((_, i) => i !== hide)), wrongSign: -phis[hide], baseMal: 1 - base, fxMal: 1 - fx, flipped: -phis[0], firstName: names[0], first: phis[0],
        },
      };
    }
  }

  function limeQ({ rng, difficulty }) {
    for (;;) {
      const c0 = rng.int(3, 6);
      const xs = [c0 - 1, c0, c0 + 1];
      const ys = xs.map(() => rng.int(1, 9) / 10);
      const ws = difficulty === 1 ? [1, 2, 1] : [rng.int(1, 3), rng.int(2, 4), rng.int(1, 3)];
      const W = sum(ws);
      const xbar = sum(xs.map((x, i) => ws[i] * x)) / W;
      const ybar = sum(ys.map((y, i) => ws[i] * y)) / W;
      const sxy = sum(xs.map((x, i) => ws[i] * (x - xbar) * (ys[i] - ybar)));
      const sxx = sum(xs.map((x, i) => ws[i] * (x - xbar) ** 2));
      const b = sxy / sxx;
      const mx = mean(xs), my = mean(ys);
      const bu = sum(xs.map((x, i) => (x - mx) * (ys[i] - my))) / sum(xs.map((x) => (x - mx) ** 2));
      if (Math.abs(b) < 0.02 || (difficulty > 1 && Math.abs(b - bu) < 0.01)) continue;
      return { vars: { xs, ys, ws, xbar, ybar, sxy, sxx, b, unweighted: bu, wrongEnds: (ys[2] - ys[0]) / (xs[2] - xs[0]),
        table: { rows: ['z1', 'z2', 'z3'], cols: ['x', 'f(x)', 'weight'], values: xs.map((x, i) => [x, ys[i], ws[i]]) } } };
    }
  }

  function cfQ({ rng, difficulty }) {
    for (;;) {
      const w0 = rng.int(4, 12), w1 = -rng.int(1, 4), w2 = -rng.int(1, 3);
      const x1 = rng.int(2, 6), x2 = rng.int(1, 5);
      const s = w0 + w1 * x1 + w2 * x2;
      if (s >= 0 || s < -8) continue;
      const which = difficulty === 1 ? 1 : rng.pick([1, 2]);
      const w = which === 1 ? w1 : w2, x = which === 1 ? x1 : x2;
      const target = x - s / w; // value at which the score reaches 0
      const change = target - x;
      if (target < 0.5) continue;
      return { vars: { w0, w1, w2, x1, x2, s, which, feature: `x${which}`, target, change, wrongSign: x + s / w, wrongNoWeight: x - s,
        rule: `score = ${w0} ${w1 < 0 ? '−' : '+'} ${Math.abs(w1)}·x1 ${w2 < 0 ? '−' : '+'} ${Math.abs(w2)}·x2; benign when score ≥ 0` } };
    }
  }

  return {
    fns: {
      treeView, impurity, forestImportance, impuritySheet, impurityWalk, impurityCode,
      shuffleView, permImportance, permCode, twinsSummary, rankImportance, twinsLecture, twinsCode,
      pdpPoint, pdp, pdpBoth, pdpCode,
      shapley, shapleySheet, shapleyWalk, shapleyOrderCode, shapleyWeights, shapleyWeightCode, additivity, additivityCode,
      limeCurve, limeFit, limeCode, limeRank, cfModel, cfOneFeature, cfGeometric, cfScene, cfCode, diceCheck,
    },
    generators: { giniQ, impurityQ, permQ, pdpQ, shapleyQ, additivityQ, limeQ, cfQ },
  };
}
