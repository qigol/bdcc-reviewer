// Qdigo module: class-imbalance (ML2, Sessions 2–3)
// Every lesson number comes from these pure functions. No randomness outside generators (rng is seeded).
export default function register(sdk) {
  const { sum, mean } = sdk;

  // ------------------------------------------------------------ helpers
  const dn = (x, d = 2) => {
    if (x === null || x === undefined || !Number.isFinite(x)) return '—';
    const f = Math.pow(10, d);
    let r = Math.round((x + Number.EPSILON * Math.sign(x)) * f) / f;
    if (Object.is(r, -0)) r = 0;
    return String(r);
  };
  const pct = (x, d = 2) => (Number.isFinite(x) ? `${dn(100 * x, d)}\\%` : '—');
  const txt = (s) => `\\text{${String(s).replace(/_/g, '\\_')}}`;
  const div = (a, b) => (b === 0 ? null : a / b);
  const POS = 'Fraud';
  const OUTCOME_CELL = { TP: 'cell:Fraud,Fraud', FN: 'cell:Fraud,Legit', FP: 'cell:Legit,Fraud', TN: 'cell:Legit,Legit' };

  // table payload {columns, rows} → array of objects
  const records = (table) => table.rows.map((r) => Object.fromEntries(table.columns.map((c, i) => [c, r[i]])));

  // ------------------------------------------------------------ 1. the lazy model
  // Always predicts the majority class.
  function lazyModel({ N = 10000, ratePct = 1.41 }) {
    const nMin = Math.round((N * ratePct) / 100);
    const nMaj = N - nMin;
    const accuracy = nMaj / N;
    return {
      nMin, nMaj, N, accuracy, accuracyPct: 100 * accuracy, recall: 0, f1: 0, precision: null,
      bars: [{ name: 'learners', x: ['majority (stays)', 'minority (drops out)'], y: [nMaj, nMin] }],
      text: `${nMaj} of ${N} correct by doing nothing`,
    };
  }

  // roles: counts (Readout). anchors: n, acc, tp, rec
  function lazyCode({ nMaj, nMin }) {
    const n = nMaj + nMin;
    const acc = nMaj / n;
    return {
      accuracy: acc, recall: 0,
      trace: [
        { label: `Total learners $N = ${nMaj} + ${nMin} = ${n}$.`, code: 'n', math: 'n', vars: { n }, ops: [{ role: 'counts', cmd: 'highlight', args: { sel: ['item:0', 'item:1'], tone: 'accent' } }] },
        { label: `Every majority row is "correct": accuracy $= ${nMaj}/${n} = ${dn(acc, 4)}$.`, code: 'acc', math: 'acc', vars: { accuracy: acc }, ops: [{ role: 'counts', cmd: 'highlight', args: { sel: 'item:2', tone: 'good' } }] },
        { label: 'It never predicts the minority, so $TP = 0$.', code: 'tp', math: 'tp', vars: { tp: 0 }, ops: [{ role: 'counts', cmd: 'highlight', args: { sel: 'item:1', tone: 'bad' } }] },
        { label: `Recall $= 0/${nMin} = 0$: not one minority case found.`, code: 'rec', math: 'rec', vars: { recall: 0 }, ops: [{ role: 'counts', cmd: 'highlight', args: { sel: 'item:3', tone: 'bad' } }] },
      ],
    };
  }

  // ------------------------------------------------------------ 2. confusion matrix
  function outcomeOf(actual, predicted, positive = POS) {
    if (actual === positive) return predicted === positive ? 'TP' : 'FN';
    return predicted === positive ? 'FP' : 'TN';
  }

  function confusion({ table, positive = POS }) {
    const recs = records(table);
    const c = { TP: 0, FN: 0, FP: 0, TN: 0 };
    const outcomes = recs.map((r) => { const o = outcomeOf(r.actual, r.predicted, positive); c[o]++; return o; });
    return { tp: c.TP, fn: c.FN, fp: c.FP, tn: c.TN, n: recs.length, outcomes, ...metrics({ tp: c.TP, fn: c.FN, fp: c.FP, tn: c.TN }) };
  }

  // 2×2 confusion payload (rows = actual, cols = predicted). null cells = not yet tallied.
  function cmPayload({ tp, fn, fp, tn, blank = false }) {
    const v = (x) => (blank ? null : x);
    return { rows: ['Fraud', 'Legit'], cols: ['Fraud', 'Legit'], values: [[v(tp), v(fn)], [v(fp), v(tn)]] };
  }

  // Fraud table as a Matrix, with the Outcome column filled for the first `upTo` rows, and the running 2×2 tally.
  function fraudSheet({ table, upTo = 99 }) {
    const recs = records(table);
    const c = { TP: 0, FN: 0, FP: 0, TN: 0 };
    const values = recs.map((r, i) => {
      const o = outcomeOf(r.actual, r.predicted);
      if (i < upTo) c[o]++;
      return [`\\$${r.amount}`, txt(r.intl), txt(r.oddTime), txt(r.newMerch), txt(r.actual), txt(r.predicted), i < upTo ? `\\textbf{${o}}` : null];
    });
    const done = Math.min(upTo, recs.length);
    return {
      table: { rows: recs.map((r) => r.txn), cols: ['amount', 'intl', 'oddTime', 'newMerch', 'actual', 'predicted', 'outcome'], values },
      cm: { rows: ['Fraud', 'Legit'], cols: ['Fraud', 'Legit'], values: [[c.TP, c.FN], [c.FP, c.TN]] },
      tp: c.TP, fn: c.FN, fp: c.FP, tn: c.TN, done, correct: c.TP + c.TN,
    };
  }

  // roles: table (fraud Matrix), cm (2×2 Matrix). Patches tallyUpTo.
  function tallyWalk({ table }) {
    const recs = records(table);
    const c = { TP: 0, FN: 0, FP: 0, TN: 0 };
    const why = { TP: 'caught fraud', FN: 'missed fraud', FP: 'false alarm', TN: 'correct legit' };
    const trace = recs.map((r, i) => {
      const o = outcomeOf(r.actual, r.predicted);
      c[o]++;
      return {
        label: `${r.txn}: actual ${r.actual}, predicted ${r.predicted} → **${o}** (${why[o]}). ${o} $= ${c[o]}$.`,
        patch: { tallyUpTo: i + 1 },
        vars: { TP: c.TP, FN: c.FN, FP: c.FP, TN: c.TN },
        ops: [
          { role: 'table', cmd: 'highlight', args: { sel: `row:${r.txn}`, tone: o === 'TP' || o === 'TN' ? 'good' : 'bad' } },
          { role: 'cm', cmd: 'highlight', args: { sel: OUTCOME_CELL[o], tone: 'accent' } },
        ],
      };
    });
    trace.push({
      label: `Done: $TP + FN + FP + TN = ${c.TP} + ${c.FN} + ${c.FP} + ${c.TN} = ${recs.length}$ rows.`,
      patch: { tallyUpTo: recs.length }, vars: { TP: c.TP, FN: c.FN, FP: c.FP, TN: c.TN },
      ops: [{ role: 'cm', cmd: 'highlight', args: { sel: 'cell:Fraud,Legit', tone: 'bad' } }],
    });
    return { tp: c.TP, fn: c.FN, fp: c.FP, tn: c.TN, steps: trace.length, trace };
  }

  // Line-by-line trace of confusion_counts(). anchors: init, loop, tp, fn, fp, tn, ret. roles: fraud (Matrix), cm (Matrix)
  function confusionCode({ table }) {
    const recs = records(table);
    const c = { TP: 0, FN: 0, FP: 0, TN: 0 };
    const trace = [{ label: 'Start every counter at 0.', code: 'init', math: 'init', vars: { tp: 0, fn: 0, fp: 0, tn: 0 }, ops: [{ role: 'cm', cmd: 'clear' }, { role: 'fraud', cmd: 'clear' }] }];
    for (const r of recs) {
      const o = outcomeOf(r.actual, r.predicted);
      trace.push({ label: `Row ${r.txn}: a = ${r.actual}, p = ${r.predicted}.`, code: 'loop', math: 'loop', vars: { a: r.actual, p: r.predicted },
        ops: [{ role: 'fraud', cmd: 'highlight', args: { sel: `row:${r.txn}`, tone: 'accent' } }] });
      c[o]++;
      const anchor = o.toLowerCase();
      trace.push({ label: `Branch ${o}: ${o.toLowerCase()} $= ${c[o]}$.`, code: anchor, math: anchor, vars: { tp: c.TP, fn: c.FN, fp: c.FP, tn: c.TN },
        ops: [
          { role: 'fraud', cmd: 'annotate', args: { sel: `cell:${r.txn},predicted`, text: o } },
          { role: 'cm', cmd: 'fill', args: { cell: OUTCOME_CELL[o].slice(5), value: c[o] } },
          { role: 'cm', cmd: 'highlight', args: { sel: OUTCOME_CELL[o], tone: o === 'TP' || o === 'TN' ? 'good' : 'bad' } },
        ] });
    }
    trace.push({ label: `Return $(${c.TP}, ${c.FN}, ${c.FP}, ${c.TN})$.`, code: 'ret', math: 'ret', vars: { tp: c.TP, fn: c.FN, fp: c.FP, tn: c.TN }, ops: [{ role: 'cm', cmd: 'highlight', args: { sel: 'row:Fraud', tone: 'accent' } }] });
    return { tp: c.TP, fn: c.FN, fp: c.FP, tn: c.TN, trace };
  }

  // ------------------------------------------------------------ 3. metrics
  function metrics({ tp, fn, fp, tn }) {
    const n = tp + fn + fp + tn;
    const accuracy = div(tp + tn, n);
    const precision = div(tp, tp + fp);
    const recall = div(tp, tp + fn);
    const specificity = div(tn, tn + fp);
    const f1 = precision === null || recall === null || precision + recall === 0 ? (tp === 0 ? 0 : null) : (2 * precision * recall) / (precision + recall);
    const balanced = recall === null || specificity === null ? null : (recall + specificity) / 2;
    return { n, accuracy, precision, recall, specificity, f1, balanced, f1Arith: precision === null || recall === null ? null : (precision + recall) / 2 };
  }

  // Scene: fixed 4 frauds and 14 legit; the learner picks TP (frauds caught) and FP (false alarms).
  function sliderMetrics({ tp = 2, fp = 1, pos = 4, neg = 14 }) {
    const fn = pos - tp, tn = neg - fp;
    const m = metrics({ tp, fn, fp, tn });
    return { tp, fn, fp, tn, ...m, cm: cmPayload({ tp, fn, fp, tn }), precisionShown: m.precision === null ? 0 : m.precision };
  }

  // anchors: acc, prec, rec, f1. roles: cm (Matrix)
  function metricsCode({ tp, fn, fp, tn }) {
    const m = metrics({ tp, fn, fp, tn });
    const p = m.precision, r = m.recall;
    return {
      ...m,
      trace: [
        { label: `Accuracy $= (${tp} + ${tn}) / ${m.n} = ${dn(m.accuracy, 4)}$: every correct cell over all cells.`, code: 'acc', math: 'acc', vars: { accuracy: m.accuracy },
          ops: [{ role: 'cm', cmd: 'clear' }, { role: 'cm', cmd: 'highlight', args: { sel: ['cell:Fraud,Fraud', 'cell:Legit,Legit'], tone: 'good' } }] },
        { label: `Precision $= ${tp} / (${tp} + ${fp}) = ${dn(p, 4)}$: of the alarms raised, how many were fraud.`, code: 'prec', math: 'prec', vars: { precision: p },
          ops: [{ role: 'cm', cmd: 'highlight', args: { sel: 'col:Fraud', tone: 'accent' } }, { role: 'cm', cmd: 'annotate', args: { sel: 'cell:Legit,Fraud', text: `P ${dn(p, 2)}` } }] },
        { label: `Recall $= ${tp} / (${tp} + ${fn}) = ${dn(r, 4)}$: of the real frauds, how many were caught.`, code: 'rec', math: 'rec', vars: { recall: r },
          ops: [{ role: 'cm', cmd: 'highlight', args: { sel: 'row:Fraud', tone: 'accent' } }, { role: 'cm', cmd: 'annotate', args: { sel: 'cell:Fraud,Legit', text: `R ${dn(r, 2)}` } }] },
        { label: `F1 $= 2(${dn(p, 4)})(${dn(r, 4)}) / (${dn(p, 4)} + ${dn(r, 4)}) = ${dn(m.f1, 4)}$.`, code: 'f1', math: 'f1', vars: { f1: m.f1 },
          ops: [{ role: 'cm', cmd: 'highlight', args: { sel: ['cell:Fraud,Fraud', 'cell:Fraud,Legit', 'cell:Legit,Fraud'], tone: 'warn' } }] },
      ],
    };
  }

  // ------------------------------------------------------------ 4. per-class performance
  // Row-normalized input (every row sums to 1 up to slide rounding): the diagonal IS the recall.
  // Count input: recall = diagonal / row total.
  function isNormalized(M) { return M.values.every((row) => Math.abs(sum(row) - 1) <= 0.02); }
  function perClass({ M, classes = null, normalized = null }) {
    const names = classes ?? M.rows;
    const norm = normalized ?? isNormalized(M);
    const recalls = M.values.map((row, i) => (norm ? row[i] : div(row[i], sum(row))));
    const colSums = M.cols.map((_, j) => sum(M.values.map((r) => r[j])));
    const precisions = M.values.map((row, i) => div(row[i], colSums[i]));
    const valid = recalls.filter((x) => x !== null);
    const macroRecall = valid.length ? mean(valid) : null;
    const total = sum(M.values.flat());
    const accuracy = div(sum(M.values.map((r, i) => r[i])), total);
    let worst = 0;
    recalls.forEach((r, i) => { if (r !== null && r < recalls[worst]) worst = i; });
    return { recalls, precisions, macroRecall, accuracy, worst: names[worst], worstRecall: recalls[worst], classes: names };
  }

  function siglaView({ sigla, model = 'anthro' }) {
    const M = sigla[model];
    const pc = perClass({ M });
    const diag = M.rows.map((r) => `cell:${r},${r}`);
    return {
      M, ...pc, diag,
      normal: pc.recalls[2], sevuw: pc.recalls[0], uw: pc.recalls[1],
      label: model === 'anthro' ? 'Anthropometric (measured)' : 'Marker-derived (estimated)',
      bars: [{ name: 'recall', x: M.rows, y: pc.recalls.map((x) => x ?? 0) }],
    };
  }

  // anchors: row, loop, diag, macro. roles: sigla (Matrix)
  function perClassCode({ M }) {
    const norm = isNormalized(M);
    const trace = [];
    trace.push(norm
      ? { label: 'Rows already sum to 1 (row-normalized, slide 14): skip the division.', code: 'row', math: 'row', vars: { normalized: true }, ops: [{ role: 'sigla', cmd: 'clear' }] }
      : { label: 'Divide each row by its total so every row sums to 1.', code: 'row', math: 'row', vars: { normalized: false }, ops: [{ role: 'sigla', cmd: 'clear' }] });
    const rec = [];
    M.rows.forEach((c, i) => {
      trace.push({ label: `Class ${c}: row ${c} holds every learner truly in ${c}.`, code: 'loop', math: 'loop', vars: { i, c },
        ops: [{ role: 'sigla', cmd: 'highlight', args: { sel: `row:${c}`, tone: 'accent' } }] });
      const r = norm ? M.values[i][i] : M.values[i][i] / sum(M.values[i]);
      rec.push(r);
      trace.push({ label: `Recall(${c}) = diagonal cell $= ${dn(r, 2)}$${r < 0.3 ? ': mostly missed' : ''}.`, code: 'diag', math: 'diag', vars: { c, recall: r },
        ops: [{ role: 'sigla', cmd: 'highlight', args: { sel: `cell:${c},${c}`, tone: r < 0.3 ? 'bad' : 'good' } }, { role: 'sigla', cmd: 'annotate', args: { sel: `cell:${c},${c}`, text: `R ${dn(r, 2)}` } }] });
    });
    const macro = mean(rec);
    trace.push({ label: `Macro recall $= (${rec.map((x) => dn(x, 2)).join(' + ')}) / ${rec.length} = ${dn(macro, 3)}$.`, code: 'macro', math: 'macro', vars: { macro },
      ops: [{ role: 'sigla', cmd: 'highlight', args: { sel: M.rows.map((r) => `cell:${r},${r}`), tone: 'warn' } }] });
    return { recalls: rec, macro, trace };
  }

  // ------------------------------------------------------------ 5. random resampling
  function stratifiedSplit({ majority, minority, testSize = 0.25 }) {
    const total = majority + minority;
    const testRows = Math.ceil(testSize * total);
    const testMin = Math.round(minority * testSize);
    const testMaj = testRows - testMin;
    const trainMin = minority - testMin, trainMaj = majority - testMaj;
    return { total, testRows, trainRows: total - testRows, testMin, testMaj, trainMin, trainMaj, ratio: majority / minority, minRate: minority / total, trainMinRate: trainMin / (total - testRows) };
  }

  function resampleCounts({ nMaj, nMin, method = 'none' }) {
    let maj = nMaj, mi = nMin, removed = 0, added = 0;
    if (method === 'RUS') { removed = nMaj - nMin; maj = nMin; }
    if (method === 'ROS' || method === 'SMOTE' || method === 'SMOTE-NC') { added = nMaj - nMin; mi = nMaj; }
    return { maj, min: mi, rows: maj + mi, removed, added, minProp: mi / (maj + mi) };
  }

  function adultCounts({ adult, method = 'none' }) {
    const s = stratifiedSplit({ majority: adult.majority, minority: adult.minority, testSize: adult.testSize });
    const rc = resampleCounts({ nMaj: s.trainMaj, nMin: s.trainMin, method });
    return { ...s, ...rc, label: method === 'none' ? 'no resampling' : method };
  }

  function toyPoints(toy) {
    return records(toy).map((r) => ({ id: r.id, x: [r.x1, r.x2], cls: r.cls }));
  }
  const d2 = (a, b) => a.reduce((t, v, i) => t + (v - b[i]) ** 2, 0);

  // The fixed "random" draws used in lessons (a real run uses rng.choice; any draw gives the same counts).
  const RUS_KEEP = ['B2', 'B5', 'B7', 'B8', 'B10'];
  const ROS_EXTRA = ['M2', 'M5', 'M2', 'M1', 'M4'];

  function scatter(points, extra = []) {
    const S = (name, ps) => ({ name, x: ps.map((p) => p.x[0]), y: ps.map((p) => p.x[1]) });
    const out = [S('majority', points.filter((p) => p.cls === 'maj')), S('minority', points.filter((p) => p.cls === 'min'))];
    for (const e of extra) out.push(S(e.name, e.points));
    return out;
  }

  function resampleToy({ toy, method = 'none', keep = RUS_KEEP, extra = ROS_EXTRA }) {
    const pts = toyPoints(toy);
    const maj = pts.filter((p) => p.cls === 'maj'), mi = pts.filter((p) => p.cls === 'min');
    if (method === 'RUS') {
      const kept = maj.filter((p) => keep.includes(p.id));
      const S = (name, ps) => ({ name, x: ps.map((p) => p.x[0]), y: ps.map((p) => p.x[1]) });
      return { series: [S('majority (kept)', kept), S('minority', mi)], maj: kept.length, min: mi.length, rows: kept.length + mi.length, note: `kept ${keep.join(', ')}; dropped ${maj.length - kept.length} majority rows` };
    }
    if (method === 'ROS') {
      const copies = extra.map((id) => pts.find((p) => p.id === id));
      const counts = {};
      extra.forEach((id) => (counts[id] = (counts[id] ?? 0) + 1));
      return {
        series: scatter(pts, [{ name: 'duplicates (same spot)', points: copies }]), maj: maj.length, min: mi.length + copies.length, rows: pts.length + copies.length,
        note: `copied ${Object.entries(counts).map(([k, v]) => `${k}×${v}`).join(', ')}: no new locations`,
      };
    }
    return { series: scatter(pts), maj: maj.length, min: mi.length, rows: pts.length, note: '10 majority, 5 minority' };
  }

  // anchors: min, maj, draw, join. roles: plot (Chart), counts (Readout)
  function rusCode({ toy, keep = RUS_KEEP }) {
    const pts = toyPoints(toy);
    const mi = pts.filter((p) => p.cls === 'min').map((p) => p.id);
    const ma = pts.filter((p) => p.cls === 'maj').map((p) => p.id);
    const idxIn = (name, ids, all) => ids.map((id) => `point:${name},${all.indexOf(id)}`);
    return {
      kept: keep.length, rows: mi.length + keep.length,
      trace: [
        { label: `Minority rows: ${mi.join(', ')} (${mi.length}).`, code: 'min', math: 'min', vars: { n_min: mi.length }, ops: [{ role: 'plot', cmd: 'highlight', args: { sel: 'series:minority', tone: 'accent' } }] },
        { label: `Majority rows: ${ma.length} of them.`, code: 'maj', math: 'maj', vars: { n_maj: ma.length }, ops: [{ role: 'plot', cmd: 'highlight', args: { sel: 'series:majority', tone: 'accent' } }] },
        { label: `Draw ${mi.length} majority rows without replacement, e.g. ${keep.join(', ')}.`, code: 'draw', math: 'draw', vars: { keep: keep.join(',') }, ops: [{ role: 'plot', cmd: 'highlight', args: { sel: idxIn('majority', keep, ma), tone: 'good' } }] },
        { label: `Training set: ${mi.length} + ${keep.length} = ${mi.length + keep.length} rows, 50% minority.`, code: 'join', math: 'join', vars: { rows: mi.length + keep.length }, ops: [{ role: 'counts', cmd: 'highlight', args: { sel: 'item:0', tone: 'good' } }] },
      ],
    };
  }

  // anchors: min, maj, draw, join. roles: plot (Chart), counts (Readout)
  function rosCode({ toy, extra = ROS_EXTRA }) {
    const pts = toyPoints(toy);
    const mi = pts.filter((p) => p.cls === 'min').map((p) => p.id);
    const ma = pts.filter((p) => p.cls === 'maj').map((p) => p.id);
    const need = ma.length - mi.length;
    const trace = [
      { label: `Minority rows: ${mi.length}.`, code: 'min', math: 'min', vars: { n_min: mi.length }, ops: [{ role: 'plot', cmd: 'highlight', args: { sel: 'series:minority', tone: 'accent' } }] },
      { label: `Majority rows: ${ma.length}. Need ${ma.length} − ${mi.length} = ${need} extra minority rows.`, code: 'maj', math: 'maj', vars: { n_maj: ma.length, need }, ops: [{ role: 'plot', cmd: 'highlight', args: { sel: 'series:majority', tone: 'muted' } }] },
    ];
    const counts = {};
    extra.forEach((id, k) => {
      counts[id] = (counts[id] ?? 0) + 1;
      trace.push({ label: `Draw ${k + 1} of ${need} (with replacement): ${id}. Copies of ${id} so far: ${counts[id]}.`, code: 'draw', math: 'draw', vars: { pick: id, copies: counts[id] },
        ops: [{ role: 'plot', cmd: 'highlight', args: { sel: `point:minority,${mi.indexOf(id)}`, tone: 'good' } }, { role: 'plot', cmd: 'annotate', args: { sel: `point:minority,${mi.indexOf(id)}`, text: `×${counts[id] + 1}` } }] });
    });
    trace.push({ label: `Training set: ${pts.length} + ${need} = ${pts.length + need} rows; minority ${mi.length + need} = majority ${ma.length}.`, code: 'join', math: 'join', vars: { rows: pts.length + need },
      ops: [{ role: 'counts', cmd: 'highlight', args: { sel: 'item:0', tone: 'good' } }] });
    return { rows: pts.length + need, trace };
  }

  // ------------------------------------------------------------ 6. SMOTE
  function smoteInterp({ xi, xnb, lambda }) {
    const x = xi.map((v, d) => v + lambda * (xnb[d] - v));
    return { x, x1: x[0], x2: x.length > 1 ? x[1] : null };
  }

  function knn({ toy, target, k = 2, among = 'min' }) {
    const pts = toyPoints(toy);
    const t = pts.find((p) => p.id === target);
    const cands = pts.filter((p) => p.id !== target && (among === 'all' || p.cls === among));
    const ranked = cands.map((p) => ({ id: p.id, d2: d2(p.x, t.x), cls: p.cls })).sort((a, b) => a.d2 - b.d2 || (a.id < b.id ? -1 : 1));
    return { ranked, neighbours: ranked.slice(0, k).map((r) => r.id), nearest: ranked[0].id, d2: ranked.map((r) => r.d2), majorityCount: ranked.slice(0, k).filter((r) => r.cls === 'maj').length };
  }

  // SMOTE on the toy map: x_i, its k nearest minority neighbours, one chosen neighbour, λ.
  function smoteToy({ toy, i = 'M2', k = 2, nb = 'M4', lambda = 0.5 }) {
    const pts = toyPoints(toy);
    const xi = pts.find((p) => p.id === i).x;
    const kn = knn({ toy, target: i, k, among: 'min' });
    const nbId = kn.neighbours.includes(nb) ? nb : kn.neighbours[0];
    const xnb = pts.find((p) => p.id === nbId).x;
    const nw = smoteInterp({ xi, xnb, lambda });
    const seg = Array.from({ length: 11 }, (_, s) => smoteInterp({ xi, xnb, lambda: s / 10 }).x);
    const series = [
      ...scatter(pts),
      { name: 'segment (all possible λ)', x: seg.map((p) => p[0]), y: seg.map((p) => p[1]) },
      { name: 'new point', x: [nw.x[0]], y: [nw.x[1]] },
    ];
    return {
      xi, xnb, nb: nbId, lambda, x: nw.x, x1: nw.x[0], x2: nw.x[1], neighbours: kn.neighbours, ranked: kn.ranked, series,
      text: `(${xi.join(', ')}) + ${dn(lambda)}·((${xnb.join(', ')}) − (${xi.join(', ')})) = (${dn(nw.x[0])}, ${dn(nw.x[1])})`,
      tex: `\\begin{aligned} \\Delta &= x_{\\text{nb}} - x_i = (${xnb.map((v, q) => dn(v - xi[q])).join(', ')}) \\\\ \\lambda\\Delta &= (${xnb.map((v, q) => dn(lambda * (v - xi[q]))).join(', ')}) \\\\ x_{\\text{new}} &= (${xi.join(', ')}) + (${xnb.map((v, q) => dn(lambda * (v - xi[q]))).join(', ')}) \\\\ &= (${dn(nw.x[0])}, ${dn(nw.x[1])}) \\end{aligned}`,
    };
  }

  // Distances from one minority point to the other minority points, as a worksheet.
  function knnSheet({ toy, target = 'M2', upTo = 99, k = 2 }) {
    const pts = toyPoints(toy);
    const t = pts.find((p) => p.id === target);
    const others = pts.filter((p) => p.cls === 'min' && p.id !== target);
    const ranked = others.map((p) => d2(p.x, t.x)).slice().sort((a, b) => a - b);
    const cut = ranked[k - 1];
    const all = upTo >= others.length;
    const values = others.map((p, q) => {
      if (q >= upTo) return [`(${p.x.join(', ')})`, null, null, null];
      const dd = d2(p.x, t.x);
      return [`(${p.x.join(', ')})`, `(${p.x[0]} - ${t.x[0]})^2 + (${p.x[1]} - ${t.x[1]})^2`, dd, all ? (dd <= cut ? '\\checkmark' : '\\cdot') : null];
    });
    return { rows: others.map((p) => p.id), cols: ['point', 'squared distance', 'd²', `in ${k}-NN`], values, done: Math.min(upTo, others.length) };
  }

  // roles: sheet (Matrix from knnSheet), plot (Chart). Patches knnUpTo.
  function knnWalk({ toy, target = 'M2', k = 2 }) {
    const pts = toyPoints(toy);
    const t = pts.find((p) => p.id === target);
    const minIds = pts.filter((p) => p.cls === 'min').map((p) => p.id);
    const others = pts.filter((p) => p.cls === 'min' && p.id !== target);
    const trace = others.map((p, q) => {
      const dd = d2(p.x, t.x);
      return {
        label: `${p.id}: $(${p.x[0]} - ${t.x[0]})^2 + (${p.x[1]} - ${t.x[1]})^2 = ${(p.x[0] - t.x[0]) ** 2} + ${(p.x[1] - t.x[1]) ** 2} = ${dd}$`,
        patch: { knnUpTo: q + 1 }, vars: { d2: dd },
        ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: `row:${p.id}`, tone: 'accent' } }, { role: 'plot', cmd: 'highlight', args: { sel: `point:minority,${minIds.indexOf(p.id)}`, tone: 'accent' } }],
      };
    });
    const kn = knn({ toy, target, k, among: 'min' });
    trace.push({ label: `Smallest ${k}: ${kn.neighbours.map((id, j) => `${id} (${kn.ranked[j].d2})`).join(', ')}. These are ${target}'s neighbours.`, patch: { knnUpTo: others.length }, vars: { neighbours: kn.neighbours.join(',') },
      ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: kn.neighbours.map((id) => `row:${id}`), tone: 'good' } }] });
    return { neighbours: kn.neighbours, steps: trace.length, trace };
  }

  // Line-by-line trace of smote_point(). anchors: dist, knn, pick, lam, new. roles: plot (Chart), out (Readout)
  function smoteCode({ toy, i = 'M2', k = 2, nb = 'M4', lambda = 0.5 }) {
    const pts = toyPoints(toy);
    const minIds = pts.filter((p) => p.cls === 'min').map((p) => p.id);
    const xi = pts.find((p) => p.id === i).x;
    const trace = [];
    for (const p of pts.filter((q) => q.cls === 'min')) {
      if (p.id === i) { trace.push({ label: `${p.id} is $x_i$ itself: distance set to ∞ so it is never its own neighbour.`, code: 'dist', math: 'dist', vars: { j: p.id, d2: 'inf' }, ops: [{ role: 'plot', cmd: 'highlight', args: { sel: `point:minority,${minIds.indexOf(p.id)}`, tone: 'muted' } }] }); continue; }
      const dd = d2(p.x, xi);
      trace.push({ label: `$d^2(${i}, ${p.id}) = (${p.x[0]} - ${xi[0]})^2 + (${p.x[1]} - ${xi[1]})^2 = ${dd}$`, code: 'dist', math: 'dist', vars: { j: p.id, d2: dd },
        ops: [{ role: 'plot', cmd: 'highlight', args: { sel: `point:minority,${minIds.indexOf(p.id)}`, tone: 'accent' } }, { role: 'plot', cmd: 'annotate', args: { sel: `point:minority,${minIds.indexOf(p.id)}`, text: `d² ${dd}` } }] });
    }
    const kn = knn({ toy, target: i, k, among: 'min' });
    trace.push({ label: `argsort keeps the ${k} smallest: ${kn.neighbours.join(', ')}.`, code: 'knn', math: 'knn', vars: { neighbours: kn.neighbours.join(',') },
      ops: [{ role: 'plot', cmd: 'highlight', args: { sel: kn.neighbours.map((id) => `point:minority,${minIds.indexOf(id)}`), tone: 'good' } }] });
    const nbId = kn.neighbours.includes(nb) ? nb : kn.neighbours[0];
    const xnb = pts.find((p) => p.id === nbId).x;
    trace.push({ label: `Pick one neighbour at random: ${nbId} = (${xnb.join(', ')}).`, code: 'pick', math: 'pick', vars: { nb: nbId }, ops: [{ role: 'plot', cmd: 'highlight', args: { sel: `point:minority,${minIds.indexOf(nbId)}`, tone: 'warn' } }] });
    trace.push({ label: `Draw $\\lambda \\sim U(0,1)$: here $\\lambda = ${dn(lambda)}$.`, code: 'lam', math: 'lam', vars: { lam: lambda }, ops: [{ role: 'plot', cmd: 'highlight', args: { sel: 'series:segment (all possible λ)', tone: 'accent' } }] });
    const nw = smoteInterp({ xi, xnb, lambda });
    trace.push({ label: `$x_{new} = (${xi.join(', ')}) + ${dn(lambda)}((${xnb.join(', ')}) - (${xi.join(', ')})) = (${dn(nw.x[0])}, ${dn(nw.x[1])})$`, code: 'new', math: 'new', vars: { x_new: `(${dn(nw.x[0])}, ${dn(nw.x[1])})` },
      ops: [{ role: 'plot', cmd: 'highlight', args: { sel: 'series:new point', tone: 'good' } }, { role: 'out', cmd: 'highlight', args: { sel: 'item:0', tone: 'good' } }] });
    return { x: nw.x, trace };
  }

  // ------------------------------------------------------------ 7. SMOTE-NC
  const NUMERIC = ['age', 'hours'];
  const CATEGORICAL = ['marital', 'workclass'];

  function vote(values) {
    const counts = {};
    values.forEach((v) => (counts[v] = (counts[v] ?? 0) + 1));
    const best = Math.max(...Object.values(counts));
    const winners = Object.keys(counts).filter((k) => counts[k] === best).sort();
    return { winner: winners[0], counts, tie: winners.length > 1 };
  }

  function smoteNC({ rows, i = 'X', nb = 'N2', lambda = 0.5, blank = false }) {
    const recs = records(rows);
    const xi = recs.find((r) => r.id === i);
    const neigh = recs.filter((r) => r.id !== i);
    const chosen = recs.find((r) => r.id === nb);
    const out = { id: 'NEW' };
    for (const c of NUMERIC) out[c] = xi[c] + lambda * (chosen[c] - xi[c]);
    const votes = {};
    for (const c of CATEGORICAL) { const v = vote(neigh.map((r) => r[c])); out[c] = v.winner; votes[c] = v.counts; }
    const fmtRow = (r) => [r.age, r.hours, txt(r.marital), txt(r.workclass)];
    return {
      row: out, age: out.age, hours: out.hours, marital: out.marital, workclass: out.workclass, votes,
      maritalVotes: Object.entries(votes.marital).map(([k, v]) => `${k} ${v}`).join(', '),
      workclassVotes: Object.entries(votes.workclass).map(([k, v]) => `${k} ${v}`).join(', '),
      table: { rows: [...recs.map((r) => r.id), 'NEW'], cols: ['age', 'hours', 'marital', 'workclass'], values: [...recs.map(fmtRow), blank ? [null, null, null, null] : [out.age, out.hours, txt(out.marital), txt(out.workclass)]] },
      plainCode: 0 + lambda * (1 - 0),
      chosenMarital: chosen.marital,
    };
  }

  // anchors: numloop, interp, catloop, votes, mode. roles: snc (Matrix)
  function smoteNCCode({ rows, i = 'X', nb = 'N2', lambda = 0.5 }) {
    const recs = records(rows);
    const xi = recs.find((r) => r.id === i);
    const neigh = recs.filter((r) => r.id !== i);
    const chosen = recs.find((r) => r.id === nb);
    const trace = [];
    for (const c of NUMERIC) {
      trace.push({ label: `Numeric column **${c}**: interpolate.`, code: 'numloop', math: 'numloop', vars: { col: c }, ops: [{ role: 'snc', cmd: 'highlight', args: { sel: `col:${c}`, tone: 'accent' } }] });
      const v = xi[c] + lambda * (chosen[c] - xi[c]);
      trace.push({ label: `$${xi[c]} + ${dn(lambda)}(${chosen[c]} - ${xi[c]}) = ${dn(v)}$ (towards ${nb}).`, code: 'interp', math: 'interp', vars: { col: c, value: v },
        ops: [{ role: 'snc', cmd: 'highlight', args: { sel: [`cell:${i},${c}`, `cell:${nb},${c}`], tone: 'accent' } }, { role: 'snc', cmd: 'fill', args: { cell: `NEW,${c}`, value: v } }] });
    }
    for (const c of CATEGORICAL) {
      trace.push({ label: `Categorical column **${c}**: no averaging allowed.`, code: 'catloop', math: 'catloop', vars: { col: c }, ops: [{ role: 'snc', cmd: 'highlight', args: { sel: `col:${c}`, tone: 'warn' } }] });
      const v = vote(neigh.map((r) => r[c]));
      trace.push({ label: `Neighbours vote: ${Object.entries(v.counts).map(([k, n]) => `${k} ${n}`).join(', ')}.`, code: 'votes', math: 'votes', vars: { col: c, votes: Object.entries(v.counts).map(([k, n]) => `${k}:${n}`).join(' ') },
        ops: [{ role: 'snc', cmd: 'highlight', args: { sel: neigh.map((r) => `cell:${r.id},${c}`), tone: 'accent' } }] });
      trace.push({ label: `Most frequent wins: **${v.winner}**.`, code: 'mode', math: 'mode', vars: { col: c, value: v.winner },
        ops: [{ role: 'snc', cmd: 'annotate', args: { sel: `cell:NEW,${c}`, text: v.winner } }, { role: 'snc', cmd: 'highlight', args: { sel: neigh.filter((r) => r[c] === v.winner).map((r) => `cell:${r.id},${c}`), tone: 'good' } }] });
    }
    return { trace, ...smoteNC({ rows, i, nb, lambda }) };
  }

  // ------------------------------------------------------------ 8. ADASYN
  function adasyn({ toy, k = 3, beta = 1 }) {
    const pts = toyPoints(toy);
    const mi = pts.filter((p) => p.cls === 'min');
    const nMaj = pts.length - mi.length;
    const G = (nMaj - mi.length) * beta;
    const rows = mi.map((p) => {
      const kn = knn({ toy, target: p.id, k, among: 'all' });
      return { id: p.id, neighbours: kn.neighbours, delta: kn.majorityCount, r: kn.majorityCount / k };
    });
    const total = sum(rows.map((r) => r.r));
    rows.forEach((r) => { r.rhat = total === 0 ? 0 : r.r / total; r.gRaw = r.rhat * G; r.g = Math.round(r.gRaw); });
    const g = Object.fromEntries(rows.map((r) => [r.id, r.g]));
    return { G, k, rows, sumR: total, g, deltas: rows.map((r) => r.delta), gs: rows.map((r) => r.g), generated: sum(rows.map((r) => r.g)) };
  }

  function adasynSheet({ toy, k = 3, upTo = 99 }) {
    const a = adasyn({ toy, k });
    const show = upTo >= a.rows.length;
    const values = a.rows.map((r, i) => i < upTo
      ? [txt(r.neighbours.join(', ')), r.delta, `${r.delta}/${k}`, show ? r.rhat : null, show ? r.g : null]
      : [null, null, null, null, null]);
    return { rows: a.rows.map((r) => r.id), cols: ['nearest', 'Δ', 'r', 'r̂', 'g'], values, G: a.G, sumR: a.sumR, done: Math.min(upTo, a.rows.length) };
  }

  // roles: sheet (Matrix from adasynSheet), plot (Chart). Patches adaUpTo.
  function adasynWalk({ toy, k = 3 }) {
    const a = adasyn({ toy, k });
    const pts = toyPoints(toy);
    const minIds = pts.filter((p) => p.cls === 'min').map((p) => p.id);
    const majIds = pts.filter((p) => p.cls === 'maj').map((p) => p.id);
    const sel = (id) => (id.startsWith('M') ? `point:minority,${minIds.indexOf(id)}` : `point:majority,${majIds.indexOf(id)}`);
    const trace = a.rows.map((r, i) => ({
      label: `${r.id}: nearest ${k} = ${r.neighbours.join(', ')} → $\\Delta = ${r.delta}$, $r = ${r.delta}/${k} = ${dn(r.r, 3)}$`,
      patch: { adaUpTo: i + 1 }, vars: { delta: r.delta, r: r.r },
      ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: `row:${r.id}`, tone: 'accent' } }, { role: 'plot', cmd: 'highlight', args: { sel: [sel(r.id), ...r.neighbours.map(sel)], tone: r.delta ? 'bad' : 'good' } }],
    }));
    trace.push({ label: `$\\sum r = ${a.rows.map((r) => `${r.delta}/${k}`).join(' + ')} = ${dn(a.sumR, 3)}$. Normalize: $\\hat r_i = r_i / ${dn(a.sumR, 3)}$.`, patch: { adaUpTo: a.rows.length }, vars: { sumR: a.sumR },
      ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: 'col:r̂', tone: 'accent' } }] });
    trace.push({ label: `$g_i = \\hat r_i \\times G = \\hat r_i \\times ${a.G}$: ${a.rows.map((r) => `${r.id} ${r.g}`).join(', ')}.`, patch: { adaUpTo: a.rows.length }, vars: { G: a.G },
      ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: 'col:g', tone: 'good' } }] });
    return { steps: trace.length, g: a.g, trace };
  }

  // Line-by-line trace of adasyn_counts(). anchors: G, knn, delta, r, rhat, g. roles: sheet (Matrix), plot (Chart)
  function adasynCode({ toy, k = 3 }) {
    const a = adasyn({ toy, k });
    const pts = toyPoints(toy);
    const nMaj = pts.filter((p) => p.cls === 'maj').length;
    const trace = [{ label: `$G = ${nMaj} - ${a.rows.length} = ${a.G}$ synthetic points to make in total.`, code: 'budget', math: 'budget', vars: { G: a.G }, ops: [{ role: 'sheet', cmd: 'clear' }] }];
    for (const r of a.rows) {
      trace.push({ label: `${r.id}: its ${k} nearest among **all** points: ${r.neighbours.join(', ')}.`, code: 'knn', math: 'knn', vars: { i: r.id, nn: r.neighbours.join(',') }, ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: `row:${r.id}`, tone: 'accent' } }] });
      trace.push({ label: `Majority among them: $\\Delta = ${r.delta}$.`, code: 'delta', math: 'delta', vars: { delta: r.delta }, ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: `cell:${r.id},Δ`, tone: r.delta ? 'bad' : 'good' } }] });
      trace.push({ label: `$r = ${r.delta}/${k} = ${dn(r.r, 3)}$.`, code: 'r', math: 'r', vars: { r: r.r }, ops: [{ role: 'sheet', cmd: 'annotate', args: { sel: `cell:${r.id},r`, text: dn(r.r, 2) } }] });
    }
    trace.push({ label: `$\\hat r = r / ${dn(a.sumR, 3)}$ = (${a.rows.map((r) => dn(r.rhat, 2)).join(', ')}): sums to 1.`, code: 'rhat', math: 'rhat', vars: { sumR: a.sumR }, ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: 'col:r̂', tone: 'accent' } }] });
    trace.push({ label: `$g = \\text{round}(\\hat r \\cdot ${a.G})$ = (${a.gs.join(', ')}); total ${a.generated}.`, code: 'g', math: 'g', vars: { g: a.gs.join(',') }, ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: 'col:g', tone: 'good' } }] });
    return { g: a.gs, trace };
  }

  // ------------------------------------------------------------ 9. choosing by the decision
  // Reconstructs approximate test-set counts from (rounded) precision and recall, then prices the errors.
  function costCompare({ results, pos = 2922, neg = 9289, ratio = 1 }) {
    const recs = records(results);
    const rows = recs.map((r) => {
      const tp = Math.round(r.recall * pos);
      const fn = pos - tp;
      const fp = Math.round(tp / r.precision - tp);
      const cost = ratio * fn + fp;
      return { method: r.method, tp, fn, fp, cost, recall: r.recall, precision: r.precision };
    });
    let best = rows[0];
    for (const r of rows) if (r.cost < best.cost) best = r;
    return {
      rows, best: best.method, bestCost: best.cost,
      table: { rows: rows.map((r) => r.method), cols: ['missed (FN)', 'false alarms (FP)', 'cost'], values: rows.map((r) => [r.fn, r.fp, r.cost]) },
      bars: [{ name: 'cost', x: rows.map((r) => r.method), y: rows.map((r) => r.cost) }],
      bestRow: [`row:${best.method}`],
    };
  }

  function resultsView({ results, cols = ['accuracy', 'balanced_acc', 'precision', 'recall', 'f1', 'roc_auc', 'pr_auc'] }) {
    const recs = records(results);
    return { rows: recs.map((r) => r.method), cols, values: recs.map((r) => cols.map((c) => r[c])) };
  }

  // anchors: split, resample, fit, score. roles: counts (Matrix)
  function pipelineCode({ adult, method = 'RUS' }) {
    const s = stratifiedSplit({ majority: adult.majority, minority: adult.minority, testSize: adult.testSize });
    const rc = resampleCounts({ nMaj: s.trainMaj, nMin: s.trainMin, method });
    return {
      ...s, resampled: rc.rows,
      trace: [
        { label: `Split first. Test: $\\lceil 0.25 \\times ${s.total} \\rceil = ${s.testRows}$ rows, ${s.testMin} of them minority.`, code: 'split', math: 'split', vars: { train: s.trainRows, test: s.testRows },
          ops: [{ role: 'counts', cmd: 'highlight', args: { sel: 'row:test', tone: 'accent' } }] },
        { label: `Resample **train only** (${method}): ${s.trainMaj} + ${s.trainMin} → ${rc.maj} + ${rc.min} = ${rc.rows} rows.`, code: 'resample', math: 'resample', vars: { rows: rc.rows },
          ops: [{ role: 'counts', cmd: 'highlight', args: { sel: 'row:resampled', tone: 'good' } }] },
        { label: 'Fit the same logistic regression on the resampled rows.', code: 'fit', math: 'fit', vars: {}, ops: [{ role: 'counts', cmd: 'highlight', args: { sel: 'row:resampled', tone: 'accent' } }] },
        { label: `Score on the untouched test set: still ${dn(100 * s.testMin / s.testRows, 1)}% minority, like the real world.`, code: 'score', math: 'score', vars: { test_min_rate: s.testMin / s.testRows },
          ops: [{ role: 'counts', cmd: 'highlight', args: { sel: 'row:test', tone: 'good' } }] },
      ],
    };
  }

  function pipelineTable({ adult, method = 'RUS' }) {
    const s = stratifiedSplit({ majority: adult.majority, minority: adult.minority, testSize: adult.testSize });
    const rc = resampleCounts({ nMaj: s.trainMaj, nMin: s.trainMin, method });
    return {
      rows: ['all', 'train', 'test', 'resampled'], cols: ['majority', 'minority', 'rows', 'minority share'],
      values: [
        [adult.majority, adult.minority, s.total, s.minRate],
        [s.trainMaj, s.trainMin, s.trainRows, s.trainMinRate],
        [s.testMaj, s.testMin, s.testRows, s.testMin / s.testRows],
        [rc.maj, rc.min, rc.rows, rc.minProp],
      ],
    };
  }

  // ------------------------------------------------------------ application: screening learners
  function screening({ learners, threshold = 0.5 }) {
    const recs = records(learners);
    let tp = 0, fn = 0, fp = 0, tn = 0;
    const flagged = [];
    for (const r of recs) {
      const pred = r.score >= threshold;
      if (pred) flagged.push(r.id);
      if (r.dropout === 1) pred ? tp++ : fn++;
      else pred ? fp++ : tn++;
    }
    const m = metrics({ tp, fn, fp, tn });
    const pos = tp + fn;
    return {
      tp, fn, fp, tn, flagged: flagged.length, ...m, pos, n: recs.length, prevalence: pos / recs.length,
      lazyAccuracy: (recs.length - pos) / recs.length,
      cm: { rows: ['dropout', 'stays'], cols: ['flagged', 'not flagged'], values: [[tp, fn], [fp, tn]] },
      precisionShown: m.precision === null ? 0 : m.precision,
      tiers: tierCounts({ learners }),
    };
  }

  function tierCounts({ learners, cuts = [0.3, 0.6] }) {
    const recs = records(learners);
    const tier = (s) => (s >= cuts[1] ? 'High' : s >= cuts[0] ? 'Medium' : 'Low');
    const names = ['High', 'Medium', 'Low'];
    const values = names.map((t) => {
      const rs = recs.filter((r) => tier(r.score) === t);
      return [rs.length, rs.filter((r) => r.dropout === 1).length];
    });
    return { rows: names, cols: ['learners', 'actual dropouts'], values };
  }

  function scoreChart({ learners, threshold = 0.5 }) {
    const recs = records(learners);
    const S = (name, rs) => ({ name, x: rs.map((r) => r.score), y: rs.map((r) => (r.dropout === 1 ? 1 : 0) + (Number(r.id.slice(1)) % 5) * 0.04) });
    return {
      series: [S('stays', recs.filter((r) => r.dropout === 0)), S('dropout', recs.filter((r) => r.dropout === 1)), { name: 'threshold', x: [threshold, threshold], y: [-0.1, 1.3] }],
    };
  }

  // ------------------------------------------------------------ generators
  const POSL = '+', NEGL = '−';

  function lazyQ({ rng, difficulty }) {
    for (;;) {
      const N = difficulty === 1 ? rng.pick([1000, 2000, 5000, 10000]) : rng.pick([800, 1200, 2500, 4000, 6000]);
      const ratePct = difficulty === 1 ? rng.pick([1, 2, 4, 5]) : rng.pick([0.5, 1.5, 2.5, 3.5, 7.5]);
      const nMin = Math.round((N * ratePct) / 100);
      if (Math.abs((N * ratePct) / 100 - nMin) > 1e-9 || nMin < 2) continue;
      const nMaj = N - nMin;
      const acc = nMaj / N;
      return {
        vars: { N, ratePct, nMin, nMaj, accuracyPct: 100 * acc, accuracy: acc, wrongRate: ratePct, wrongMin: 100 * nMin / N, recall: 0 },
        misconceptions: [
          { var: 'wrongRate', feedback: 'That is the minority rate. The lazy model is right on every **majority** row, so accuracy = majority share.' },
          { value: 0, feedback: '0 is its **recall** on the minority. Accuracy counts the majority rows it gets right.' },
        ],
      };
    }
  }

  // A random actual/predicted table with every outcome present and precision ≠ recall.
  function drawConfusion(rng, difficulty) {
    for (;;) {
      const n = difficulty === 1 ? rng.int(10, 12) : difficulty === 2 ? rng.int(14, 18) : rng.int(20, 30);
      const pos = rng.int(3, Math.max(4, Math.floor(n / 3)));
      const tp = rng.int(1, pos - 1);
      const fn = pos - tp;
      const neg = n - pos;
      const fp = rng.int(1, Math.min(4, neg - 2));
      const tn = neg - fp;
      const m = metrics({ tp, fn, fp, tn });
      if (Math.abs(m.precision - m.recall) < 0.05) continue;
      if (Math.abs(m.f1 - m.accuracy) < 0.02) continue;
      const labels = [...Array(tp).fill(['+', '+']), ...Array(fn).fill(['+', '-']), ...Array(fp).fill(['-', '+']), ...Array(tn).fill(['-', '-'])];
      const order = rng.shuffle(labels);
      const table = { rows: order.map((_, i) => `R${i + 1}`), cols: ['actual', 'predicted'], values: order.map(([a, p]) => [a === '+' ? txt('pos') : txt('neg'), p === '+' ? txt('pos') : txt('neg')]) };
      return { n, pos, neg, tp, fn, fp, tn, ...m, table, cm: { rows: ['pos', 'neg'], cols: ['pred-pos', 'pred-neg'], values: [[tp, fn], [fp, tn]] } };
    }
  }

  function confusionQ({ rng, difficulty }) {
    const c = drawConfusion(rng, difficulty);
    return {
      vars: {
        ...c, accuracyPct: 100 * c.accuracy,
        wrongPrecAsRec: c.recall, wrongRecAsPrec: c.precision, wrongTpOverN: c.tp / c.n, wrongF1Arith: c.f1Arith, wrongPrecOverPos: c.tp / c.pos,
        wrongBalancedAcc: c.accuracy, wrongSpecificity: c.specificity,
      },
    };
  }

  function perClassQ({ rng, difficulty }) {
    const classes = ['A', 'B', 'C'];
    for (;;) {
      const M = classes.map((_, i) => classes.map((_, j) => (i === j ? rng.int(difficulty === 3 ? 4 : 6, 14) : rng.int(0, difficulty === 1 ? 4 : 6))));
      M[2][2] = rng.int(1, 4);
      M[2][0] = rng.int(2, 6);
      const target = difficulty === 1 ? 2 : rng.int(0, 2);
      const pc = perClass({ M: { rows: classes, cols: classes, values: M } });
      const rowSum = sum(M[target]), colSum = sum(M.map((r) => r[target]));
      if (rowSum === colSum) continue;
      if (pc.recalls.some((r) => r === null) || pc.precisions.some((p) => p === null)) continue;
      if (Math.abs(pc.macroRecall - pc.accuracy) < 0.03) continue;
      const names = { A: 'Normal', B: 'Underweight', C: 'Severely UW' };
      return {
        vars: {
          M: { rows: classes, cols: classes, values: M }, cls: classes[target], className: names[classes[target]], recall: pc.recalls[target], precision: pc.precisions[target],
          diag: M[target][target], rowSum, colSum, macroRecall: pc.macroRecall, accuracy: pc.accuracy, recalls: pc.recalls,
          meanPrecision: mean(pc.precisions), worst: pc.worst,
        },
      };
    }
  }

  function resampleQ({ rng, difficulty }) {
    for (;;) {
      const nMin = difficulty === 1 ? rng.pick([20, 50, 120, 300]) : rng.int(40, 900);
      const nMaj = nMin * (difficulty === 1 ? rng.pick([3, 4, 9]) : 1) + (difficulty === 1 ? 0 : rng.int(200, 4000));
      if (nMaj <= nMin * 2) continue;
      return {
        vars: {
          nMin, nMaj, n: nMin + nMaj, rus: 2 * nMin, ros: 2 * nMaj, removed: nMaj - nMin, added: nMaj - nMin,
          wrongKeepAll: nMaj + nMin, wrongDoubleMaj: 2 * nMaj, wrongDoubleMin: 2 * nMin, ratio: nMaj / nMin,
        },
      };
    }
  }

  function smoteQ({ rng, difficulty }) {
    for (;;) {
      const xi = [rng.int(0, 8), rng.int(0, 8)];
      const xn = [rng.int(0, 8), rng.int(0, 8)];
      if (xi[0] === xn[0] || xi[1] === xn[1]) continue;
      const lambda = difficulty === 1 ? rng.pick([0.25, 0.5, 0.75]) : rng.pick([0.2, 0.3, 0.4, 0.6, 0.7, 0.8]);
      const r = smoteInterp({ xi, xnb: xn, lambda });
      const wrongRev = xn[0] + lambda * (xi[0] - xn[0]);
      const wrongScale = lambda * xn[0];
      if (Math.abs(wrongRev - r.x1) < 1e-9 || Math.abs(wrongScale - r.x1) < 1e-9) continue;
      return {
        vars: { xi, xn, lambda, x1: r.x1, x2: r.x2, xi1: xi[0], xi2: xi[1], xn1: xn[0], xn2: xn[1], diff1: xn[0] - xi[0], diff2: xn[1] - xi[1], wrongRev, wrongScale, wrongMid: (xi[0] + xn[0]) / 2 },
      };
    }
  }

  // nearest-neighbour + SMOTE on a fresh mini map (squared distances)
  function knnQ({ rng, difficulty }) {
    for (;;) {
      const names = ['P', 'Q', 'R', 'S'];
      const xi = [rng.int(2, 6), rng.int(2, 6)];
      const others = names.map(() => [rng.int(0, 9), rng.int(0, 9)]);
      const ds = others.map((p) => d2(p, xi));
      if (ds.some((d) => d === 0)) continue;
      const sorted = ds.slice().sort((a, b) => a - b);
      if (sorted[0] === sorted[1] || sorted[1] === sorted[2]) continue;
      const nearest = ds.indexOf(sorted[0]);
      const second = ds.indexOf(sorted[1]);
      const lambda = difficulty === 1 ? 0.5 : rng.pick([0.25, 0.75]);
      const nw = smoteInterp({ xi, xnb: others[nearest], lambda });
      // a "manhattan" or x-only reading that points elsewhere makes a good distractor
      const man = others.map((p) => Math.abs(p[0] - xi[0]) + Math.abs(p[1] - xi[1]));
      return {
        vars: {
          xi, pts: names.map((n, k) => `${n} = (${others[k].join(', ')})`).join(', '), nearest: names[nearest], second: names[second],
          d2s: names.map((n, k) => `${n}: ${ds[k]}`).join(', '), dNearest: sorted[0], lambda, x1: nw.x1, x2: nw.x2, nb: others[nearest],
          table: { rows: names, cols: ['x1', 'x2'], values: others },
          manhattanNearest: names[man.indexOf(Math.min(...man))],
        },
        options: names.map((n) => `${n}`),
        answer: nearest,
      };
    }
  }

  function smotencQ({ rng, difficulty }) {
    const maritals = ['Married', 'Divorced', 'Never-married', 'Widowed'];
    for (;;) {
      const k = 3;
      const neigh = Array.from({ length: k }, () => rng.pick(maritals.slice(0, difficulty === 1 ? 2 : 3)));
      const v = vote(neigh);
      if (v.tie) continue;
      const chosenIdx = rng.int(0, k - 1);
      if (neigh[chosenIdx] === v.winner && difficulty > 1) continue;
      const age = rng.int(25, 55), nbAge = rng.int(25, 60);
      if (age === nbAge) continue;
      const lambda = rng.pick([0.25, 0.5, 0.75]);
      const newAge = age + lambda * (nbAge - age);
      const opts = [v.winner, ...maritals.filter((m) => m !== v.winner).slice(0, 2), `the code halfway between ${neigh[chosenIdx] === v.winner ? maritals.find((m) => m !== v.winner) : neigh[chosenIdx]} and ${v.winner}`];
      return {
        vars: {
          neigh: neigh.join(', '), winner: v.winner, chosen: `N${chosenIdx + 1}`, chosenMarital: neigh[chosenIdx], age, nbAge, lambda, newAge,
          table: { rows: ['X', 'N1', 'N2', 'N3'], cols: ['age', 'marital'], values: [[age, txt('Married')], ...neigh.map((m, j) => [j === chosenIdx ? nbAge : rng.int(25, 60), txt(m)])] },
          wrongRev: nbAge + lambda * (age - nbAge), wrongMid: (age + nbAge) / 2,
        },
        options: opts,
        answer: 0,
      };
    }
  }

  function adasynQ({ rng, difficulty }) {
    for (;;) {
      const nMin = difficulty === 1 ? 4 : 5;
      const k = difficulty === 3 ? 5 : 3;
      const deltas = Array.from({ length: nMin }, () => rng.int(0, k));
      const total = sum(deltas);
      if (total === 0) continue;
      const nMaj = nMin + rng.pick([4, 6, 8, 10, 12]);
      const G = nMaj - nMin;
      const g = deltas.map((d) => (d / total) * G);
      if (g.some((x) => Math.abs(x - Math.round(x)) > 1e-9)) continue;
      const target = deltas.indexOf(Math.max(...deltas));
      const tgt = rng.pick(deltas.map((d, i) => i).filter((i) => deltas[i] > 0));
      const wrongUnnorm = (deltas[tgt] / k) * G;
      const wrongUniform = G / nMin;
      if (Math.abs(wrongUnnorm - g[tgt]) < 1e-9 || Math.abs(wrongUniform - g[tgt]) < 1e-9) continue;
      const names = deltas.map((_, i) => `m${i + 1}`);
      return {
        vars: {
          k, nMin, nMaj, G, deltas, deltaList: names.map((n, i) => `${n}: ${deltas[i]}`).join(', '), target: names[tgt], deltaT: deltas[tgt], rT: deltas[tgt] / k,
          sumR: total / k, rhat: deltas[tgt] / total, g: g[tgt], gs: g, hardest: names[target], wrongUnnorm, wrongUniform,
          table: { rows: names, cols: ['Δ (majority among k)'], values: deltas.map((d) => [d]) },
        },
      };
    }
  }

  function costQ({ rng, difficulty }) {
    for (;;) {
      const fnA = rng.int(5, 40), fpA = rng.int(5, 60);
      const fnB = rng.int(5, 40), fpB = rng.int(5, 120);
      const cFN = difficulty === 1 ? rng.pick([5, 10]) : rng.pick([3, 4, 8, 15, 20]);
      const cFP = 1;
      const costA = cFN * fnA + cFP * fpA, costB = cFN * fnB + cFP * fpB;
      if (costA === costB || fnA === fnB) continue;
      const swapA = fnA + cFN * fpA;
      if (swapA === costA) continue;
      const better = costA < costB ? 'A' : 'B';
      const lowerFN = fnA < fnB ? 'A' : 'B';
      if (difficulty > 1 && better === lowerFN && rng.bool(0.7)) continue;
      return { vars: { fnA, fpA, fnB, fpB, cFN, cFP, costA, costB, better, swapA, wrongFnOnlyA: cFN * fnA, wrongUnitA: fnA + fpA } };
    }
  }

  function splitQ({ rng, difficulty }) {
    for (;;) {
      const minority = rng.int(80, 2000) * (difficulty === 1 ? 4 : 1);
      const majority = minority * rng.int(2, 9) + rng.int(0, 3) * 4;
      const testSize = difficulty === 1 ? 0.25 : rng.pick([0.2, 0.25]);
      const s = stratifiedSplit({ majority, minority, testSize });
      if (Math.abs(minority * testSize - Math.round(minority * testSize)) > 1e-9) continue;
      if (Math.abs(majority * testSize - Math.round(majority * testSize)) > 1e-9) continue;
      return { vars: { majority, minority, total: s.total, testSize, testPct: 100 * testSize, testMin: s.testMin, trainMin: s.trainMin, trainMaj: s.trainMaj, testRows: s.testRows, rus: 2 * s.trainMin, wrongAll: s.testRows, wrongTestMin: s.testMin, wrongNoSplit: 2 * minority } };
    }
  }

  return {
    fns: {
      lazyModel, lazyCode, confusion, cmPayload, fraudSheet, tallyWalk, confusionCode, metrics, sliderMetrics, metricsCode,
      perClass, siglaView, perClassCode, stratifiedSplit, resampleCounts, adultCounts, resampleToy, rusCode, rosCode,
      smoteInterp, knn, smoteToy, knnSheet, knnWalk, smoteCode, smoteNC, smoteNCCode, adasyn, adasynSheet, adasynWalk, adasynCode,
      costCompare, resultsView, pipelineCode, pipelineTable, screening, tierCounts, scoreChart,
    },
    generators: { lazyQ, confusionQ, perClassQ, resampleQ, smoteQ, knnQ, smotencQ, adasynQ, costQ, splitQ },
  };
}
