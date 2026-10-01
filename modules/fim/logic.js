// Kodigo module: fim (Frequent Itemset Mining & Association Rules)
// Pure functions only. Conventions (see SOURCE_NOTES.md):
//  - support is counted over whole transactions (a basket supports X if it contains every item of X)
//  - minsup < 1 is read as a relative threshold (fraction of |D|), otherwise as an absolute count
//  - the lecture's Apriori extends every frequent itemset by one later frequent item (slide 19 order)
//  - FP-growth as taught = successive filtering of prefix-projected databases in alphabetical order
export default function register(sdk) {
  const { isSubset, sortSet, key, powerset, combinations } = sdk;
  const APRIORI_ORDER = ['bread', 'butter', 'milk', 'eggs', 'yogurt', 'cheese']; // slide 19 listing order
  const EPS = 1e-9;

  const setText = (s) => '{' + s.join(', ') + '}';
  function itemsOf(transactions, order) {
    return sortSet([...new Set(transactions.flatMap((t) => t.items))], order);
  }
  function orderFor(transactions, order) {
    const items = itemsOf(transactions);
    if (order && items.every((i) => order.includes(i))) return order.filter((i) => items.includes(i));
    return items; // alphabetical
  }
  function threshold(minsup, n) {
    return minsup > 0 && minsup < 1 ? minsup * n : minsup;
  }

  // ---------------------------------------------------------------- count-along helpers
  const TX = (t) => `T${t.id}`;
  const txText = (t) => `${TX(t)} ${setText(t.items)}`;
  const missingOf = (X, t) => X.filter((x) => !t.items.includes(x));
  const r2 = (x) => (x === null || x === undefined ? '—' : +(+x).toFixed(2));
  const CHECK = '\\checkmark';
  const BLANK = '\\cdot';
  const texSet = (s) => (s.length ? `\\{${s.map((x) => `\\text{${x}}`).join(',\\,')}\\}` : '\\emptyset');
  const rowsText = (ids) => (ids.length ? ids.map((i) => `T${i}`).join(', ') : 'no rows');
  const inRows = (ids) => (ids.length ? `${ids.length === 1 ? 'row' : 'rows'} ${rowsText(ids)}` : 'no row');

  // Live-example ops for Math & Code traces. Role `table` = the section's TransactionTable.
  // highlight is transient (this step only); annotate / clear persist until the trace is rewound.
  const T_HL = (sel, tone = 'accent') => ({ role: 'table', cmd: 'highlight', args: { sel, tone } });
  const T_NOTE = (sel, text) => ({ role: 'table', cmd: 'annotate', args: { sel, text } });
  const T_CLEAR = () => ({ role: 'table', cmd: 'clear' });
  const rowSel = (ids) => ids.map((id) => `row:${id}`);
  const chipSel = (t, items) => items.filter((i) => t.items.includes(i)).map((i) => `chip:${t.id}:${i}`);
  const itemSel = (items) => items.map((i) => `item:${i}`);
  const hitIds = (transactions, X) => transactions.filter((t) => isSubset(X, t.items)).map((t) => t.id);

  // Count along, one transaction at a time.
  // roles: table (TransactionTable)
  function support({ transactions, itemset }) {
    const set = sortSet(itemset || []);
    const n = transactions.length;
    let count = 0;
    const hits = [];
    const tally = [];
    const trace = [];
    for (const t of transactions) {
      const miss = missingOf(set, t);
      const ok = miss.length === 0;
      if (ok) { count++; hits.push(t.id); }
      tally.push(ok ? 1 : 0);
      trace.push({
        label: ok
          ? `${txText(t)} holds every item of ${setText(set)} ✓ → count = ${count}`
          : `${txText(t)} is missing ${miss.join(', ')} ✗ → count stays ${count}`,
        vars: { count },
        ops: [
          { role: 'table', cmd: 'highlight', args: { sel: `row:${t.id}`, tone: ok ? 'good' : 'bad' } },
          { role: 'table', cmd: 'annotate', args: { sel: `row:${t.id}`, text: ok ? `✓ +1 → ${count}` : '✗ +0' } },
        ],
      });
    }
    const rel = n ? count / n : 0;
    const tallyTex = tally.join(' + ');
    trace.push({ label: `AbsSup = ${tallyTex} = ${count}; RelSup = ${count}/${n} = ${r2(rel)}`, vars: { abs: count, n, rel },
      ops: [{ role: 'table', cmd: 'highlight', args: { sel: hits.map((h) => `row:${h}`), tone: 'good' } }] });
    return { abs: count, rel, hits, n, itemset: set, tally, tallyTex, hitsText: rowsText(hits), trace };
  }

  // Line-by-line trace of abs_support / rel_support for the Math & Code tab.
  // anchors: init, loop, test, inc, ret, rel
  function supportCode({ transactions, itemset }) {
    const X = sortSet(itemset || []);
    const n = transactions.length;
    let count = 0;
    const trace = [{ label: '`count = 0`: nothing counted yet', code: 'init', math: 'init', vars: { count }, ops: [T_CLEAR()] }];
    for (const t of transactions) {
      trace.push({ label: `\`for T in transactions\`: T = ${txText(t)}`, code: 'loop', math: 'loop', vars: { T: TX(t), count }, ops: [T_HL([`row:${t.id}`])] });
      const miss = missingOf(X, t);
      const ok = miss.length === 0;
      trace.push({
        label: ok ? `Is ${setText(X)} ⊆ ${TX(t)}? **True**, every item is there` : `Is ${setText(X)} ⊆ ${TX(t)}? **False**: ${miss.join(', ')} missing, so skip`,
        code: 'test', math: 'test', vars: { subset: ok ? 'True' : 'False' },
        ops: [T_HL([`row:${t.id}`], ok ? 'good' : 'bad'), T_HL(chipSel(t, X), 'good'), ...(ok ? [] : [T_NOTE(`row:${t.id}`, `✗ no ${miss.join(', ')}`)])],
      });
      if (ok) { count++; trace.push({ label: `\`count += 1\` → count = ${count}`, code: 'inc', math: 'inc', vars: { count }, ops: [T_HL([`row:${t.id}`], 'good'), T_NOTE(`row:${t.id}`, `✓ count = ${count}`)] }); }
    }
    const hits = hitIds(transactions, X);
    trace.push({ label: `Loop finished: \`return count\` gives AbsSup = ${count}`, code: 'ret', math: 'ret', vars: { count }, ops: [T_HL(rowSel(hits), 'good')] });
    trace.push({ label: `\`rel_support\` = ${count} / len(transactions) = ${count}/${n} = ${r2(count / n)}`, code: 'rel', math: 'rel', vars: { rel: n ? count / n : 0 }, ops: [T_HL(rowSel(hits), 'good')] });
    return { abs: count, rel: n ? count / n : 0, trace };
  }

  // Worksheet for slides 8–13: one row per itemset, a tick per transaction that holds it, then the counts.
  // upTo = rows filled so far (patched by supportGridWalk); minsup (optional) fills the last column.
  function supportGrid({ transactions, itemsets, upTo = 99, minsup = null }) {
    const n = transactions.length;
    const hasMin = typeof minsup === 'number';
    const cols = ['itemset', ...transactions.map(TX), 'AbsSup', 'RelSup', 'frequent'];
    const rows = itemsets.map((_, k) => `X${k + 1}`);
    const freqRows = [];
    const values = itemsets.map((X, k) => {
      const done = k < upTo;
      const abs = transactions.filter((t) => isSubset(X, t.items)).length;
      const sup = minsup !== null && minsup < 1 ? abs / n : abs;
      const freq = hasMin && sup >= minsup - EPS;
      if (done && freq) freqRows.push(`row:X${k + 1}`);
      return [
        texSet(X),
        ...transactions.map((t) => (done ? (isSubset(X, t.items) ? CHECK : BLANK) : null)),
        done ? abs : null,
        done ? abs / n : null,
        done && hasMin ? (freq ? '\\text{yes}' : '\\text{no}') : null,
      ];
    });
    return { rows, cols, values, freqRows, n };
  }

  // roles: grid (Matrix from supportGrid), table (TransactionTable). Patches gridUpTo / gridMinsup.
  function supportGridWalk({ transactions, itemsets, thresholds = [3, 2, 0.5, 0.4] }) {
    const n = transactions.length;
    const trace = [];
    itemsets.forEach((X, k) => {
      const marks = transactions.map((t) => `${TX(t)} ${isSubset(X, t.items) ? '✓' : '✗'}`).join(', ');
      const hits = transactions.filter((t) => isSubset(X, t.items)).map((t) => t.id);
      trace.push({
        label: `${setText(X)}: ${marks} → AbsSup ${hits.length}, RelSup ${hits.length}/${n} = ${r2(hits.length / n)}`,
        patch: { gridUpTo: k + 1 },
        ops: [
          { role: 'grid', cmd: 'highlight', args: { sel: `row:X${k + 1}`, tone: 'accent' } },
          { role: 'table', cmd: 'highlight', args: { sel: hits.map((h) => `row:${h}`), tone: 'good' } },
        ],
      });
    });
    for (const m of thresholds) {
      const g = supportGrid({ transactions, itemsets, minsup: m });
      const kept = itemsets.filter((X, k) => g.freqRows.includes(`row:X${k + 1}`));
      trace.push({
        label: m < 1
          ? `minsup = ${m} (relative): keep RelSup ≥ ${m} → ${kept.map(setText).join(', ') || 'none'}`
          : `minsup = ${m} (absolute): keep AbsSup ≥ ${m} → ${kept.map(setText).join(', ') || 'none'}`,
        patch: { gridUpTo: itemsets.length, gridMinsup: m },
        ops: [{ role: 'grid', cmd: 'highlight', args: { sel: g.freqRows, tone: 'good' } }],
      });
    }
    return { steps: trace.length, trace };
  }

  // Line-by-line trace of frequent_itemsets() over a list of candidates.
  // anchors: init, loop, sup, rel, minsup, keep, ret
  function frequentCode({ transactions, itemsets, minsup }) {
    const n = transactions.length;
    const trace = [{ label: '`frequent = []`: start with an empty answer list', code: 'init', math: 'init', vars: { frequent: [] }, ops: [T_CLEAR()] }];
    const kept = [];
    for (const X of itemsets) {
      const hits = hitIds(transactions, X);
      const inX = (tone) => [T_HL(transactions.flatMap((t) => (hits.includes(t.id) ? chipSel(t, X) : [])), tone)];
      trace.push({ label: `\`for X in candidates\`: X = ${setText(X)}`, code: 'loop', math: 'loop', vars: { X: setText(X) }, ops: [T_CLEAR(), T_HL(itemSel(X))] });
      let sup = hits.length;
      trace.push({ label: `\`sup = abs_support(X)\`: ${inRows(hits)} → sup = ${sup}`, code: 'sup', math: 'sup', vars: { sup },
        ops: [T_HL(rowSel(hits), 'good'), ...inX('good'), ...hits.map((id, q) => T_NOTE(`row:${id}`, `✓ ${q + 1}`))] });
      if (minsup < 1) {
        sup = sup / n;
        trace.push({ label: `minsup ${minsup} < 1 is relative, so \`sup = ${hits.length} / ${n}\` = ${r2(sup)}`, code: 'rel', math: 'rel', vars: { sup }, ops: [T_HL(rowSel(hits), 'good')] });
      }
      const ok = sup >= minsup - EPS;
      trace.push({ label: `\`sup >= minsup\`: ${r2(sup)} ≥ ${minsup}? **${ok ? 'True' : 'False'}**${ok ? '' : ', so skip it'}`, code: 'minsup', math: 'minsup', vars: { frequent: ok ? 'True' : 'False' },
        ops: [T_HL(rowSel(hits), ok ? 'good' : 'bad')] });
      if (ok) {
        kept.push(X);
        trace.push({ label: `\`frequent.append(X)\` → ${kept.length} frequent so far`, code: 'keep', math: 'keep', vars: { frequent: kept.map(setText) }, ops: [T_HL(rowSel(hits), 'good'), ...inX('good')] });
      }
    }
    trace.push({ label: `\`return frequent\`: ${kept.map(setText).join(', ') || 'none'}`, code: 'ret', math: 'ret', vars: { count: kept.length }, ops: [T_CLEAR()] });
    return { frequent: kept, count: kept.length, trace };
  }

  function frequentItemsets({ transactions, minsup, order }) {
    const items = orderFor(transactions, order);
    const n = transactions.length;
    const thr = threshold(minsup, n);
    const supportMap = {};
    const frequent = [];
    const byLevel = [];
    for (const s of powerset(items)) {
      const abs = transactions.filter((t) => isSubset(s, t.items)).length;
      supportMap[key(s, items)] = abs;
      if (abs >= thr - EPS && abs > 0) {
        frequent.push({ itemset: s, abs, rel: abs / n, key: key(s, items) });
        byLevel[s.length - 1] = (byLevel[s.length - 1] || 0) + 1;
      }
    }
    frequent.sort((a, b) => b.abs - a.abs || b.itemset.length - a.itemset.length || (a.key < b.key ? -1 : 1));
    for (let i = 0; i < items.length; i++) byLevel[i] = byLevel[i] || 0;
    const singles = frequent.filter((f) => f.itemset.length === 1).length;
    return { supportMap, frequent, count: frequent.length, byLevel, singles, items, minsupAbs: thr, keys: frequent.map((f) => f.key), labels: frequent.map((f) => `${setText(f.itemset)} (${f.abs})`) };
  }

  // Frequent itemsets among a given list (the slides 10–13 only list itemsets over bread/butter/milk)
  function frequentAmong({ transactions, minsup, itemsets }) {
    const n = transactions.length;
    const thr = threshold(minsup, n);
    const rows = itemsets.map((X) => {
      const abs = transactions.filter((t) => isSubset(X, t.items)).length;
      return { itemset: sortSet(X), abs, rel: abs / n, frequent: abs >= thr - EPS && abs > 0 };
    });
    const frequent = rows.filter((r) => r.frequent);
    return { rows, frequent: frequent.map((r) => r.itemset), count: frequent.length };
  }

  // roles: lattice (ItemsetLattice), table
  function bruteForce({ transactions, minsup }) {
    const items = orderFor(transactions);
    const thr = threshold(minsup, transactions.length);
    const trace = [];
    let freq = 0;
    for (const s of powerset(items)) {
      const hits = transactions.filter((t) => isSubset(s, t.items)).map((t) => t.id);
      const ok = hits.length >= thr - EPS && hits.length > 0;
      if (ok) freq++;
      trace.push({
        label: `AbsSup(${setText(s)}) = ${hits.length}${ok ? ' ✓' : ''}`,
        code: 'loop', math: 'loop', vars: { checked: trace.length + 1, frequent: freq },
        ops: [
          { role: 'lattice', cmd: 'highlight', args: { sel: `set:${key(s, items)}`, tone: ok ? 'good' : 'bad' } },
          { role: 'table', cmd: 'highlight', args: { sel: hits.map((h) => `row:${h}`), tone: 'accent' } },
        ],
      });
    }
    return { evaluated: trace.length, count: freq, trace };
  }

  // Supports of the first `upTo` itemsets in brute-force order (level by level) → lattice support map.
  function bfSupport({ transactions, upTo = 999 }) {
    const items = orderFor(transactions);
    const supportMap = {};
    powerset(items).slice(0, upTo).forEach((s) => { supportMap[key(s, items)] = transactions.filter((t) => isSubset(s, t.items)).length; });
    return { supportMap, counted: Object.keys(supportMap).length };
  }

  // Brute force, one itemset per step: every one of the 2^n − 1 itemsets gets counted.
  // roles: lattice (ItemsetLattice), table (TransactionTable). Patches bfUpTo.
  function bruteForceWalk({ transactions, minsup }) {
    const items = orderFor(transactions);
    const thr = threshold(minsup, transactions.length);
    const all = powerset(items);
    const trace = [];
    let freq = 0;
    let level = 0;
    all.forEach((s, idx) => {
      if (s.length !== level) {
        level = s.length;
        const nk = all.filter((x) => x.length === level).length;
        trace.push({ label: nk === 1 ? `Level ${level}: the single itemset with all ${level} items` : `Level ${level}: all ${nk} itemsets of size ${level}, counted one by one`, patch: { bfUpTo: idx },
          ops: [{ role: 'lattice', cmd: 'highlight', args: { sel: `level:${level}`, tone: 'accent' } }] });
      }
      const hits = transactions.filter((t) => isSubset(s, t.items)).map((t) => t.id);
      const ok = hits.length >= thr - EPS && hits.length > 0;
      if (ok) freq++;
      trace.push({
        label: `${setText(s)}: ${hits.length ? `in ${rowsText(hits)}` : 'in no row'} → ${hits.length} ${ok ? `≥ ${thr} ✓` : `< ${thr} ✗`}`,
        vars: { counted: idx + 1, frequent: freq },
        patch: { bfUpTo: idx + 1 },
        ops: [
          { role: 'lattice', cmd: 'highlight', args: { sel: `set:${key(s, items)}`, tone: ok ? 'good' : 'bad' } },
          { role: 'table', cmd: 'highlight', args: { sel: hits.map((h) => `row:${h}`), tone: 'accent' } },
        ],
      });
    });
    trace.push({ label: `Done: ${all.length} support counts for ${freq} frequent itemsets`, patch: { bfUpTo: all.length }, vars: { counted: all.length, frequent: freq } });
    return { evaluated: all.length, count: freq, trace };
  }

  // Line-by-line trace of brute_force(). anchors: n, size, loop, count, test, keep, ret
  function bruteForceCode({ transactions, minsup }) {
    const items = orderFor(transactions);
    const thr = threshold(minsup, transactions.length);
    const trace = [{ label: `\`items\` = the ${items.length} distinct items: ${items.join(', ')}`, code: 'n', math: 'n', vars: { n: items.length }, ops: [T_CLEAR(), T_HL(itemSel(items))] }];
    let freq = 0;
    for (let k = 1; k <= items.length; k++) {
      const Xs = combinations(items, k);
      trace.push({ label: `\`for k\`: k = ${k}, so ${Xs.length} combinations of ${k} item${k > 1 ? 's' : ''} to check`, code: 'size', math: 'size', vars: { k }, ops: [T_CLEAR()] });
      for (const X of Xs) {
        const hits = hitIds(transactions, X);
        const chips = transactions.flatMap((t) => (hits.includes(t.id) ? chipSel(t, X) : []));
        trace.push({ label: `\`for X in combinations(items, ${k})\`: X = ${setText(X)}`, code: 'loop', math: 'loop', vars: { X: setText(X) }, ops: [T_HL(itemSel(X))] });
        trace.push({ label: `\`sup = abs_support(X)\`: ${hits.length ? rowsText(hits) : 'no row'} → sup = ${hits.length}`, code: 'count', math: 'count', vars: { sup: hits.length }, ops: [T_HL(itemSel(X), 'warn'), T_HL(rowSel(hits), 'good'), T_HL(chips, 'good')] });
        const ok = hits.length >= thr - EPS && hits.length > 0;
        trace.push({ label: `\`if sup >= minsup\`: ${hits.length} ≥ ${thr}? **${ok ? 'True' : 'False'}**${ok ? '' : ', not stored'}`, code: 'test', math: 'test', vars: { test: ok ? 'True' : 'False' }, ops: [T_HL(rowSel(hits), ok ? 'good' : 'bad')] });
        if (ok) {
          freq++;
          trace.push({ label: `\`frequent[X] = ${hits.length}\`: ${freq} frequent itemset${freq > 1 ? 's' : ''} stored so far`, code: 'keep', math: 'keep', vars: { frequent: freq }, ops: [T_HL(rowSel(hits), 'good'), T_HL(chips, 'good')] });
        }
      }
    }
    trace.push({ label: `\`return frequent\`: ${freq} frequent itemsets after ${Math.pow(2, items.length) - 1} counts`, code: 'ret', math: 'ret', vars: { frequent: freq }, ops: [T_CLEAR()] });
    return { count: freq, trace };
  }

  // Lecture Apriori (slide 19): level 1 = every item; level k+1 = every frequent k-itemset
  // extended by one frequent item that comes later in the lecture's order.
  // roles: lattice (ItemsetLattice), table (TransactionTable), code, formula
  function aprioriRun({ transactions, minsup, order }) {
    const ord = orderFor(transactions, order || APRIORI_ORDER);
    const latticeOrder = itemsOf(transactions);
    const n = transactions.length;
    const thr = threshold(minsup, n);
    const trace = [];
    const evaluated = [];
    const frequent = [];
    const levels = [];
    let candidates = ord.map((i) => [i]);
    let freqItems = [];
    let k = 1;
    while (candidates.length) {
      const Lk = [];
      trace.push({ label: `Level ${k}: ${candidates.length} candidate${candidates.length === 1 ? '' : 's'} to count`, code: 'level', math: 'level', vars: { k, candidates: candidates.length } });
      for (const c of candidates) {
        const hits = transactions.filter((t) => isSubset(c, t.items)).map((t) => t.id);
        const ok = hits.length >= thr - EPS && hits.length > 0;
        const kk = key(c, latticeOrder);
        evaluated.push({ itemset: c, abs: hits.length, frequent: ok, level: k });
        if (ok) { Lk.push(c); frequent.push({ itemset: sortSet(c, latticeOrder), abs: hits.length, rel: hits.length / n }); }
        const ops = [
          { role: 'lattice', cmd: 'highlight', args: { sel: `set:${kk}`, tone: ok ? 'good' : 'bad' } },
          { role: 'table', cmd: 'highlight', args: { sel: hits.map((h) => `row:${h}`), tone: 'accent' } },
        ];
        if (!ok) ops.push({ role: 'lattice', cmd: 'prune', args: { sel: `set:${kk}` } });
        trace.push({
          label: `AbsSup(${setText(c)}) = ${hits.length}: ${ok ? 'frequent, keep' : 'infrequent, never extend it'}`,
          code: ok ? 'keep' : 'count', math: ok ? 'keep' : 'count',
          vars: { abs: hits.length, evaluated: evaluated.length },
          ops,
        });
      }
      levels.push({ k, candidates: candidates.length, frequent: Lk.length });
      if (k === 1) freqItems = Lk.map((c) => c[0]);
      const next = [];
      for (const f of Lk) {
        const last = ord.indexOf(f[f.length - 1]);
        for (const i of freqItems) if (ord.indexOf(i) > last) next.push([...f, i]);
      }
      candidates = next;
      k++;
    }
    const bruteForce = Math.pow(2, ord.length) - 1;
    trace.push({ label: `Done: ${frequent.length} frequent itemsets after counting ${evaluated.length} candidates (brute force: ${bruteForce})`, code: 'level', math: 'level', vars: { evaluated: evaluated.length, bruteForce } });
    return { frequent, count: frequent.length, evaluated: evaluated.length, bruteForce, saved: bruteForce - evaluated.length, levels, candidates: evaluated, level2: levels[1] ? levels[1].candidates : 0, trace };
  }

  // Supports of the first `upTo` candidates Apriori counts (evaluation order) → lattice support map.
  function aprioriSupport({ transactions, minsup, upTo = 999 }) {
    const r = aprioriRun({ transactions, minsup });
    const items = itemsOf(transactions);
    const supportMap = {};
    r.candidates.slice(0, upTo).forEach((c) => { supportMap[key(c.itemset, items)] = c.abs; });
    return { supportMap, counted: Object.keys(supportMap).length };
  }

  // Apriori as taught (slide 19), one candidate per step, with the candidate-generation steps spelled out.
  // roles: lattice (ItemsetLattice), table (TransactionTable). Patches apUpTo.
  function aprioriWalk({ transactions, minsup, order }) {
    const ord = orderFor(transactions, order || APRIORI_ORDER);
    const items = itemsOf(transactions);
    const thr = threshold(minsup, transactions.length);
    const trace = [];
    let candidates = ord.map((i) => [i]);
    let freqItems = [];
    let counted = 0;
    let k = 1;
    let prevLevel = [];
    while (candidates.length) {
      const setsSel = candidates.map((c) => `set:${key(c, items)}`);
      trace.push({
        label: k === 1
          ? `Level 1: every single item is a candidate (${candidates.length} counts)`
          : `Level ${k}: extend each of ${setText(prevLevel.map((p) => p.join('+')))} by a later frequent item → ${candidates.length} candidates`,
        patch: { apUpTo: counted },
        ops: [{ role: 'lattice', cmd: 'highlight', args: { sel: setsSel, tone: 'accent' } }],
      });
      const Lk = [];
      for (const c of candidates) {
        const hits = transactions.filter((t) => isSubset(c, t.items)).map((t) => t.id);
        const ok = hits.length >= thr - EPS && hits.length > 0;
        counted++;
        if (ok) Lk.push(c);
        trace.push({
          label: `${setText(c)}: ${hits.length ? `in ${rowsText(hits)}` : 'in no row'} → ${hits.length} ${ok ? `≥ ${thr} ✓ keep` : `< ${thr} ✗ never extended`}`,
          vars: { counted },
          patch: { apUpTo: counted },
          ops: [
            { role: 'lattice', cmd: 'highlight', args: { sel: `set:${key(c, items)}`, tone: ok ? 'good' : 'bad' } },
            { role: 'table', cmd: 'highlight', args: { sel: hits.map((h) => `row:${h}`), tone: 'accent' } },
          ],
        });
      }
      if (k === 1) freqItems = Lk.map((c) => c[0]);
      const next = [];
      for (const f of Lk) {
        const last = ord.indexOf(f[f.length - 1]);
        for (const i of freqItems) if (ord.indexOf(i) > last) next.push([...f, i]);
      }
      prevLevel = Lk;
      candidates = next;
      k++;
    }
    const bf = Math.pow(2, ord.length) - 1;
    trace.push({ label: `No candidates left. ${counted} counts instead of brute force's ${bf}`, patch: { apUpTo: counted }, vars: { counted } });
    return { evaluated: counted, trace };
  }

  // Line-by-line trace of apriori(). anchors: level, while, loop, count, test, keep, items1, extend, ret
  function aprioriCode({ transactions, minsup, order }) {
    const ord = orderFor(transactions, order || APRIORI_ORDER);
    const thr = threshold(minsup, transactions.length);
    let candidates = ord.map((i) => [i]);
    const trace = [{ label: `\`candidates\` = every single item, in slide-19 order: ${candidates.length} of them`, code: 'level', math: 'level', vars: { candidates: candidates.map(setText) }, ops: [T_CLEAR(), T_HL(itemSel(ord))] }];
    let items1 = null;
    let nFreq = 0;
    let k = 1;
    while (true) {
      if (!candidates.length) { trace.push({ label: '`while candidates`: the list is empty, so the loop stops', code: 'while', math: 'while', vars: { candidates: [] } }); break; }
      trace.push({ label: `\`while candidates\`: ${candidates.length} candidate${candidates.length > 1 ? 's' : ''} of size ${k} to count`, code: 'while', math: 'while', vars: { k }, ops: [T_CLEAR()] });
      const level = [];
      for (const X of candidates) {
        const hits = hitIds(transactions, X);
        const chips = transactions.flatMap((t) => (hits.includes(t.id) ? chipSel(t, X) : []));
        trace.push({ label: `\`for X in candidates\`: X = ${setText(X)}`, code: 'loop', math: 'loop', vars: { X: setText(X) }, ops: [T_HL(itemSel(X))] });
        trace.push({ label: `\`sup = abs_support(X)\`: ${hits.length ? rowsText(hits) : 'no row'} → sup = ${hits.length}`, code: 'count', math: 'count', vars: { sup: hits.length }, ops: [T_HL(itemSel(X), 'warn'), T_HL(rowSel(hits), 'good'), T_HL(chips, 'good')] });
        const ok = hits.length >= thr - EPS && hits.length > 0;
        trace.push({ label: `\`if sup >= minsup\`: ${hits.length} ≥ ${thr}? **${ok ? 'True' : 'False'}**`, code: 'test', math: 'test', vars: { test: ok ? 'True' : 'False' }, ops: [T_HL(rowSel(hits), ok ? 'good' : 'bad')] });
        if (ok) {
          level.push(X);
          nFreq++;
          trace.push({ label: `store \`frequent[X] = ${hits.length}\` and append X to \`level\``, code: 'keep', math: 'keep', vars: { level: level.map(setText) }, ops: [T_HL(rowSel(hits), 'good'), T_HL(chips, 'good')] });
        }
      }
      if (items1 === null) {
        items1 = level.map((X) => X[0]);
        trace.push({ label: `First pass only: \`items1\` = the frequent single items (${items1.join(', ')})`, code: 'items1', math: 'items1', vars: { items1 }, ops: [T_HL(itemSel(items1), 'good')] });
      }
      const next = [];
      for (const X of level) {
        const last = ord.indexOf(X[X.length - 1]);
        for (const i of items1) if (ord.indexOf(i) > last) next.push([...X, i]);
      }
      trace.push({ label: `Extend every X in \`level\` by a later item of \`items1\` → ${next.length} new candidate${next.length === 1 ? '' : 's'}`, code: 'extend', math: 'extend', vars: { candidates: next.map(setText) } });
      candidates = next;
      k++;
    }
    trace.push({ label: `\`return frequent\`: ${nFreq} frequent itemsets`, code: 'ret', math: 'ret', vars: { frequent: nFreq } });
    return { count: nFreq, trace };
  }

  // Classic Apriori (beyond the slides): join frequent (k-1)-itemsets sharing a prefix, then prune
  // any candidate with an infrequent (k-1)-subset BEFORE counting.
  function aprioriClassic({ transactions, minsup }) {
    const items = itemsOf(transactions);
    const thr = threshold(minsup, transactions.length);
    const sup = (s) => transactions.filter((t) => isSubset(s, t.items)).length;
    let L = items.filter((i) => sup([i]) >= thr - EPS).map((i) => [i]);
    let evaluated = items.length;
    const pruned = [];
    const frequent = [...L];
    let k = 2;
    while (L.length) {
      const keys = new Set(L.map((s) => key(s, items)));
      const C = [];
      for (let i = 0; i < L.length; i++)
        for (let j = i + 1; j < L.length; j++) {
          const a = L[i], b = L[j];
          if (a.slice(0, k - 2).join() !== b.slice(0, k - 2).join()) continue;
          const c = sortSet([...a, b[b.length - 1]], items);
          if (c.length !== k) continue;
          const bad = combinations(c, k - 1).some((s) => !keys.has(key(s, items)));
          if (bad) pruned.push(c); else C.push(c);
        }
      evaluated += C.length;
      L = C.filter((c) => sup(c) >= thr - EPS);
      frequent.push(...L);
      k++;
    }
    return { evaluated, pruned, prunedCount: pruned.length, count: frequent.length, frequent };
  }

  // Lecture FP-growth: filter the database by a prefix, keep only items after the prefix, recurse.
  // roles: table (TransactionTable with itemOrder), tree (Tree), code, formula
  function fpGrowthRun({ transactions, minsup, order }) {
    const ord = orderFor(transactions, order);
    const thr = threshold(minsup, transactions.length);
    const trace = [];
    const frequent = [];
    const root = { id: 'root', label: 'all items', children: [] };
    const after = (items, item) => items.filter((x) => ord.indexOf(x) > ord.indexOf(item));
    function rec(prefix, rows, node) {
      const here = sortSet([...new Set(rows.flatMap((r) => r.items))], ord);
      for (const item of here) {
        const p = [...prefix, item];
        const proj = rows.filter((r) => r.items.includes(item)).map((r) => ({ id: r.id, items: after(r.items, item) }));
        const s = proj.length;
        const ok = s >= thr - EPS;
        const child = { id: p.join('-'), label: `${setText(p)} = ${s}`, tone: ok ? 'good' : 'muted', children: [] };
        node.children.push(child);
        trace.push({
          label: `${setText(p)} appears in ${s} row${s === 1 ? '' : 's'}: ${ok ? 'frequent, filter and recurse' : 'infrequent, stop here'}`,
          code: ok ? 'recurse' : 'filter', math: ok ? 'recurse' : 'filter',
          vars: { prefix: p, sup: s },
          ops: [
            { role: 'table', cmd: 'project', args: { prefix: p } },
            { role: 'tree', cmd: 'expand', args: { id: child.id } },
            { role: 'tree', cmd: 'highlight', args: { sel: `node:${child.id}`, tone: ok ? 'good' : 'bad' } },
          ],
        });
        if (ok) { frequent.push({ itemset: p, abs: s }); rec(p, proj, child); }
      }
    }
    rec([], transactions.map((t) => ({ id: t.id, items: sortSet(t.items, ord) })), root);
    trace.push({ label: `Done: ${frequent.length} frequent itemsets, without ever counting a candidate that isn't in some row`, code: 'recurse', math: 'recurse', vars: { count: frequent.length },
      ops: [{ role: 'table', cmd: 'unproject' }] });
    const cut = (n) => ({ ...n, children: (n.children || []).map(cut) });
    return { frequent, count: frequent.length, tree: cut(root), explored: trace.length - 1, trace };
  }

  // ---------------------------------------------------------------- FP-growth, counted by hand
  // Every prefix the lecture's recursion visits, in order (depth first, alphabetical).
  function fpVisits(transactions, minsup, order) {
    const ord = orderFor(transactions, order);
    const thr = threshold(minsup, transactions.length);
    const after = (items, item) => items.filter((x) => ord.indexOf(x) > ord.indexOf(item));
    const visits = [];
    function rec(prefix, rows) {
      const here = sortSet([...new Set(rows.flatMap((r) => r.items))], ord);
      for (const item of here) {
        const p = [...prefix, item];
        const holders = rows.filter((r) => r.items.includes(item));
        const proj = holders.map((r) => ({ id: r.id, items: after(r.items, item) }));
        const ok = proj.length >= thr - EPS;
        visits.push({ prefix: p, parent: prefix, item, holders: holders.map((r) => r.id), proj, sup: proj.length, ok });
        if (ok) rec(p, proj);
      }
    }
    rec([], transactions.map((t) => ({ id: t.id, items: sortSet(t.items, ord) })));
    return { visits, ord, thr };
  }
  // The projected (filtered) database for a prefix: rows containing it, only the items after it.
  function projectDb(transactions, prefix, ord) {
    let rows = transactions.map((t) => ({ id: t.id, items: sortSet(t.items, ord) }));
    for (const item of prefix) {
      rows = rows.filter((r) => r.items.includes(item)).map((r) => ({ id: r.id, items: r.items.filter((x) => ord.indexOf(x) > ord.indexOf(item)) }));
    }
    return rows;
  }
  const Dname = (p) => (p.length ? `$D_{${texSet(p)}}$` : 'the whole database');

  // Tick grid for the current (projected) database: one row per remaining item, one column per row of D.
  function fpCountGrid({ transactions, prefix = [], order, showCount = true, minsup = 2 }) {
    const ord = orderFor(transactions, order);
    const thr = threshold(minsup, transactions.length);
    const rowsD = projectDb(transactions, prefix, ord);
    const items = sortSet([...new Set(rowsD.flatMap((r) => r.items))], ord);
    const cols = [...rowsD.map((r) => `T${r.id}`), 'count'];
    const counts = items.map((it) => rowsD.filter((r) => r.items.includes(it)).length);
    const values = items.length
      ? items.map((it, k) => [...rowsD.map((r) => (r.items.includes(it) ? CHECK : BLANK)), showCount ? counts[k] : null])
      : [[...rowsD.map(() => BLANK), showCount ? 0 : null]];
    const title = prefix.length
      ? `Counting inside ${Dname(prefix)}: ${rowsD.length} row${rowsD.length === 1 ? '' : 's'}, Sup(${setText(prefix)}) = ${rowsD.length}`
      : `Counting inside the whole database: ${rowsD.length} rows`;
    return {
      rows: items.length ? items : ['(nothing left)'], cols, values, title, n: rowsD.length,
      counts: Object.fromEntries(items.map((it, k) => [it, counts[k]])),
      countsText: items.length ? items.map((it, k) => `${it} ${counts[k]}`).join(', ') : 'no items left',
      frequentRows: items.filter((_, k) => counts[k] >= thr - EPS).map((it) => `row:${it}`),
    };
  }

  // The recursion tree as far as it has been explored (first `upTo` prefixes).
  function fpTreeUpTo({ transactions, minsup, order, upTo = 999 }) {
    const { visits } = fpVisits(transactions, minsup, order);
    const root = { id: 'root', label: `all items (${transactions.length} rows)`, children: [] };
    const byId = { root };
    visits.slice(0, upTo).forEach((v) => {
      const node = { id: v.prefix.join('-'), label: `${setText(v.prefix)} = ${v.sup}`, note: v.ok ? `rows ${rowsText(v.holders)}` : 'stop', tone: v.ok ? 'good' : 'muted', children: [] };
      byId[node.id] = node;
      (byId[v.parent.length ? v.parent.join('-') : 'root'] || root).children.push(node);
    });
    const shown = Math.min(upTo, visits.length);
    return { tree: root, shown, frequent: visits.slice(0, upTo).filter((v) => v.ok).length };
  }

  // FP-growth as taught, one decision per step. roles: table (TransactionTable), grid (Matrix from fpCountGrid), tree (Tree).
  // Patches fpPrefix (which database the grid counts in) and fpStep (how much of the tree is drawn).
  function fpWalk({ transactions, minsup, order }) {
    const { visits, ord, thr } = fpVisits(transactions, minsup, order);
    const trace = [];
    const whole = fpCountGrid({ transactions, prefix: [], order: ord, minsup });
    trace.push({ label: `Whole database, one tick per row: ${whole.countsText}`, patch: { fpPrefix: [], fpStep: 0 },
      ops: [{ role: 'table', cmd: 'unproject' }, { role: 'grid', cmd: 'highlight', args: { sel: whole.frequentRows, tone: 'good' } }] });
    visits.forEach((v, i) => {
      trace.push({
        label: `In ${Dname(v.parent)}: ${v.item} is in ${rowsText(v.holders)} → Sup(${setText(v.prefix)}) = ${v.sup} ${v.ok ? `≥ ${thr} ✓` : `< ${thr} ✗ stop`}`,
        vars: { sup: v.sup },
        patch: { fpPrefix: v.parent, fpStep: i + 1 },
        ops: [
          { role: 'grid', cmd: 'highlight', args: { sel: `row:${v.item}`, tone: v.ok ? 'good' : 'bad' } },
          { role: 'table', cmd: 'project', args: { prefix: v.prefix } },
          { role: 'tree', cmd: 'highlight', args: { sel: `node:${v.prefix.join('-')}`, tone: v.ok ? 'good' : 'bad' } },
        ],
      });
      if (v.ok) {
        const g = fpCountGrid({ transactions, prefix: v.prefix, order: ord, minsup });
        trace.push({
          label: `Filter to ${rowsText(v.holders)}, keep items after ${v.item}. ${Dname(v.prefix)}: ${g.countsText}`,
          patch: { fpPrefix: v.prefix, fpStep: i + 1 },
          ops: [
            { role: 'table', cmd: 'project', args: { prefix: v.prefix } },
            { role: 'grid', cmd: 'highlight', args: { sel: g.frequentRows, tone: 'good' } },
            { role: 'tree', cmd: 'highlight', args: { sel: `path:${v.prefix.join('-')}`, tone: 'accent' } },
          ],
        });
      }
    });
    const nf = visits.filter((v) => v.ok).length;
    trace.push({ label: `Done: ${visits.length} prefixes tried, ${nf} frequent itemsets (slide 40)`, patch: { fpPrefix: [], fpStep: visits.length },
      ops: [{ role: 'table', cmd: 'unproject' }] });
    return { count: nf, explored: visits.length, trace };
  }

  // Line-by-line trace of the recursive fp_growth(). anchors: items, loop, filter, prefix, test, keep, recurse, ret
  function fpGrowthCode({ transactions, minsup, order }) {
    const ord = orderFor(transactions, order);
    const thr = threshold(minsup, transactions.length);
    const tup = (p) => `(${p.join(', ')})`;
    const list = (r) => `[${r.join(', ')}]`;
    const trace = [];
    let nf = 0;
    // the table shows the database the current call works on: `project` onto its prefix (unproject at the top level)
    const view = (prefix) => (prefix.length ? { role: 'table', cmd: 'project', args: { prefix } } : { role: 'table', cmd: 'unproject' });
    const holding = (X) => hitIds(transactions, X);
    function rec(prefix, rows) {
      const items = sortSet([...new Set(rows.flatMap((r) => r))], ord);
      trace.push({ label: `Call with prefix ${tup(prefix)} and ${rows.length} rows → \`items\` = ${items.length ? items.join(', ') : 'none'}`, code: 'items', math: 'items', vars: { prefix: tup(prefix), items }, ops: [view(prefix), T_HL(itemSel(items))] });
      for (const i of items) {
        const P = [...prefix, i];
        trace.push({ label: `\`for i in items\`: i = ${i}   (prefix so far ${tup(prefix)})`, code: 'loop', math: 'loop', vars: { i }, ops: [view(prefix), T_HL(itemSel([i]))] });
        const proj = rows.filter((r) => r.includes(i)).map((r) => r.filter((x) => ord.indexOf(x) > ord.indexOf(i)));
        trace.push({ label: `\`proj\` inside ${tup(prefix)}: ${proj.length} ${proj.length === 1 ? 'row contains' : 'rows contain'} ${i}; items after it → ${proj.map(list).join(' ')}`, code: 'filter', math: 'filter', vars: { proj: proj.map(list) }, ops: [view(prefix), T_HL(rowSel(holding(P)), 'good'), T_HL(itemSel([i]))] });
        trace.push({ label: `\`P = prefix + (i,)\` = ${tup(P)}`, code: 'prefix', math: 'prefix', vars: { P: tup(P) }, ops: [view(P)] });
        const ok = proj.length >= thr - EPS;
        trace.push({ label: `\`len(proj) >= minsup\`: ${proj.length} ≥ ${thr}? **${ok ? 'True' : 'False'}**${ok ? '' : ', so move on'}`, code: 'test', math: 'test', vars: { sup: proj.length }, ops: [T_HL(rowSel(holding(P)), ok ? 'good' : 'bad')] });
        if (ok) {
          nf++;
          trace.push({ label: `\`out[${tup(P)}] = ${proj.length}\` (${nf} frequent so far)`, code: 'keep', math: 'keep', vars: { found: nf }, ops: [T_HL(rowSel(holding(P)), 'good')] });
          trace.push({ label: `Recurse: mine the ${proj.length} projected rows with prefix ${tup(P)}`, code: 'recurse', math: 'recurse', vars: { depth: P.length } });
          rec(P, proj);
        }
      }
      trace.push({ label: `Items exhausted for prefix ${tup(prefix)}: \`return out\`${prefix.length ? ' to the caller' : ` with ${nf} itemsets`}`, code: 'ret', math: 'ret', vars: { found: nf }, ops: [view(prefix)] });
    }
    rec([], transactions.map((t) => sortSet(t.items, ord)));
    return { count: nf, trace };
  }

  // roles: table, code, formula
  function confidence({ transactions, A, B }) {
    const both = support({ transactions, itemset: [...A, ...B] });
    const ante = support({ transactions, itemset: A });
    const cons = support({ transactions, itemset: B });
    const conf = ante.abs === 0 ? null : both.abs / ante.abs;
    return {
      supAB: both.abs, supA: ante.abs, supB: cons.abs, n: transactions.length, conf,
      rule: `${setText(A)} → ${setText(B)}`,
      trace: [
        { label: `Baskets containing A ∪ B: ${both.abs}`, math: 'sup-ab', code: 'sup-ab', vars: { supAB: both.abs },
          ops: [{ role: 'table', cmd: 'highlight', args: { sel: both.hits.map((id) => `row:${id}`), tone: 'good' } }] },
        { label: `Baskets containing A: ${ante.abs}`, math: 'sup-a', code: 'sup-a', vars: { supA: ante.abs },
          ops: [{ role: 'table', cmd: 'highlight', args: { sel: ante.hits.map((id) => `row:${id}`), tone: 'accent' } }] },
        { label: `Confidence = ${both.abs} / ${ante.abs} = ${conf === null ? 'undefined' : +conf.toFixed(2)}`, math: 'ratio', code: 'ratio', vars: { supAB: both.abs, supA: ante.abs, conf } },
      ],
    };
  }

  // roles: table, code, formula
  function lift({ transactions, A, B }) {
    const c = confidence({ transactions, A, B });
    const relB = c.n ? c.supB / c.n : 0;
    const value = c.conf === null || relB === 0 ? null : c.conf / relB;
    const verdict = value === null ? 'undefined' : value > 1 + EPS ? 'positive' : value < 1 - EPS ? 'negative' : 'independent';
    const bHits = transactions.filter((t) => isSubset(B, t.items)).map((t) => `row:${t.id}`);
    return {
      conf: c.conf, supAB: c.supAB, supA: c.supA, supB: c.supB, n: c.n, relB, lift: value, verdict, rule: c.rule,
      relA: c.n ? c.supA / c.n : 0, relAB: c.n ? c.supAB / c.n : 0,
      trace: [
        { label: `Confidence of the rule = ${c.supAB}/${c.supA} = ${c.conf === null ? '—' : +c.conf.toFixed(2)}`, math: 'conf', code: 'conf', vars: { conf: c.conf } },
        { label: `RelSup of the consequent = ${c.supB}/${c.n} = ${+relB.toFixed(2)}`, math: 'relb', code: 'relb', vars: { relB },
          ops: [{ role: 'table', cmd: 'highlight', args: { sel: bHits, tone: 'accent' } }] },
        { label: `Lift = ${c.conf === null ? '—' : +c.conf.toFixed(2)} / ${+relB.toFixed(2)} = ${value === null ? '—' : +value.toFixed(2)} (${verdict})`, math: 'lift', code: 'lift', vars: { lift: value } },
      ],
    };
  }

  // Single-pass confidence, line by line. anchors: init, loop, has-a, sup-a, has-b, sup-ab, ratio
  function confidenceCode({ transactions, A, B }) {
    const a = sortSet(A), b = sortSet(B);
    let supA = 0, supAB = 0;
    const trace = [{ label: '`sup_a = sup_ab = 0`: both counters start at zero', code: 'init', math: 'init', vars: { sup_a: 0, sup_ab: 0 }, ops: [T_CLEAR()] }];
    for (const t of transactions) {
      const row = `row:${t.id}`;
      trace.push({ label: `\`for T in transactions\`: T = ${txText(t)}`, code: 'loop', math: 'loop', vars: { T: TX(t) }, ops: [T_HL([row])] });
      const missA = missingOf(a, t);
      const hasA = missA.length === 0;
      trace.push({ label: `A = ${setText(a)} ⊆ ${TX(t)}? **${hasA ? 'True' : 'False'}**${hasA ? '' : ` (${missA.join(', ')} missing): this basket says nothing about the rule`}`, code: 'has-a', math: 'has-a', vars: { has_a: hasA ? 'True' : 'False' },
        ops: [T_HL([row], hasA ? 'accent' : 'muted'), T_HL(chipSel(t, a), 'accent'), ...(hasA ? [] : [T_NOTE(row, 'no A: skipped')])] });
      if (!hasA) continue;
      supA++;
      trace.push({ label: `\`sup_a += 1\` → sup_a = ${supA}`, code: 'sup-a', math: 'sup-a', vars: { sup_a: supA }, ops: [T_HL([row]), T_HL(chipSel(t, a), 'accent'), T_NOTE(row, `A ✓ (sup_a = ${supA})`)] });
      const missB = missingOf(b, t);
      const hasB = missB.length === 0;
      trace.push({ label: `B = ${setText(b)} ⊆ ${TX(t)}? **${hasB ? 'True' : 'False'}**${hasB ? '' : ` (${missB.join(', ')} missing)`}`, code: 'has-b', math: 'has-b', vars: { has_b: hasB ? 'True' : 'False' },
        ops: [T_HL([row], hasB ? 'good' : 'bad'), T_HL(chipSel(t, b), 'good'), ...(hasB ? [] : [T_NOTE(row, `A ✓ · B ✗ (no ${missB.join(', ')})`)])] });
      if (hasB) { supAB++; trace.push({ label: `\`sup_ab += 1\` → sup_ab = ${supAB}`, code: 'sup-ab', math: 'sup-ab', vars: { sup_ab: supAB }, ops: [T_HL([row], 'good'), T_NOTE(row, `A ✓ · B ✓ (sup_ab = ${supAB})`)] }); }
    }
    const conf = supA ? supAB / supA : null;
    trace.push({ label: `\`return sup_ab / sup_a\` = ${supAB} / ${supA} = ${r2(conf)}`, code: 'ratio', math: 'ratio', vars: { conf }, ops: [T_HL(rowSel(hitIds(transactions, a)), 'accent'), T_HL(rowSel(hitIds(transactions, [...a, ...b])), 'good')] });
    return { conf, supA, supAB, trace };
  }

  // Every candidate rule from a list of frequent itemsets, in the order written (bigger antecedents first).
  function ruleCandidates(transactions, itemsets) {
    const sup = (s) => transactions.filter((t) => isSubset(s, t.items)).length;
    const out = [];
    for (const I of itemsets) {
      if (I.length < 2) continue;
      const supI = sup(I);
      for (let k = I.length - 1; k >= 1; k--) {
        for (const A of combinations(I, k)) {
          const B = I.filter((x) => !A.includes(x));
          out.push({ I, A, B, supI, supA: sup(A), supB: sup(B), conf: supI / sup(A) });
        }
      }
    }
    return out;
  }
  const ruleTex = (A, B) => `${texSet(A)} \\to ${texSet(B)}`;

  // Worksheet of every candidate rule (first `upTo` rows filled). cols: rule, Sup(A∪B), Sup(A), conf, verdict
  function rulesGrid({ transactions, itemsets, minconf, upTo = 999 }) {
    const c = ruleCandidates(transactions, itemsets);
    return {
      rows: c.map((_, k) => `R${k + 1}`),
      cols: ['rule', 'Sup(A∪B)', 'Sup(A)', 'conf', 'kept?'],
      values: c.map((r, k) => {
        const done = k < upTo;
        const ok = r.conf >= minconf - EPS;
        return [ruleTex(r.A, r.B), done ? r.supI : null, done ? r.supA : null, done ? r.conf : null, done ? (ok ? '\\text{keep}' : '\\text{drop}') : null];
      }),
      kept: c.filter((r) => r.conf >= minconf - EPS).length,
      considered: c.length,
    };
  }

  // roles: grid (Matrix from rulesGrid), table (TransactionTable). Patches ruleUpTo.
  function rulesWalk({ transactions, itemsets, minconf }) {
    const c = ruleCandidates(transactions, itemsets);
    const trace = [];
    let k = 0, kept = 0, lastI = null;
    for (const r of c) {
      if (r.I !== lastI) {
        lastI = r.I;
        const n = Math.pow(2, r.I.length) - 2;
        const hits = transactions.filter((t) => isSubset(r.I, t.items)).map((t) => `row:${t.id}`);
        trace.push({ label: `Frequent itemset ${setText(r.I)}, Sup = ${r.supI}: try its ${n} splits into A → B`, patch: { ruleUpTo: k },
          ops: [{ role: 'table', cmd: 'highlight', args: { sel: hits, tone: 'good' } }] });
      }
      k++;
      const ok = r.conf >= minconf - EPS;
      if (ok) kept++;
      const aHits = transactions.filter((t) => isSubset(r.A, t.items)).map((t) => `row:${t.id}`);
      trace.push({
        label: `$${ruleTex(r.A, r.B)}$: $\\frac{${r.supI}}{${r.supA}} = ${r2(r.conf)}$ ${ok ? `≥ ${minconf} ✓ keep` : `< ${minconf} ✗ drop`}`,
        vars: { conf: r.conf, kept },
        patch: { ruleUpTo: k },
        ops: [
          { role: 'grid', cmd: 'highlight', args: { sel: `row:R${k}`, tone: ok ? 'good' : 'bad' } },
          { role: 'table', cmd: 'highlight', args: { sel: aHits, tone: 'accent' } },
        ],
      });
    }
    trace.push({ label: `${kept} of ${c.length} candidate rules pass minconf = ${minconf} (slide 60)`, patch: { ruleUpTo: c.length }, vars: { kept } });
    return { kept, considered: c.length, trace };
  }

  // Lift worksheet for the rules that pass minconf (first `upTo` rows filled).
  function liftGrid({ transactions, itemsets, minconf, upTo = 999 }) {
    const n = transactions.length;
    const c = ruleCandidates(transactions, itemsets).filter((r) => r.conf >= minconf - EPS);
    const verdict = (l) => (l > 1 + EPS ? '\\text{positive}' : l < 1 - EPS ? '\\text{negative}' : '\\text{none}');
    return {
      rows: c.map((_, k) => `L${k + 1}`),
      cols: ['rule', 'conf', 'Sup(B)', 'RelSup(B)', 'lift', 'association'],
      values: c.map((r, k) => {
        const done = k < upTo;
        const lift = r.conf / (r.supB / n);
        return [ruleTex(r.A, r.B), r.conf, done ? r.supB : null, done ? r.supB / n : null, done ? lift : null, done ? verdict(lift) : null];
      }),
      count: c.length,
      ones: c.filter((r) => Math.abs(r.conf / (r.supB / n) - 1) < 1e-9).length,
    };
  }

  // roles: grid (Matrix from liftGrid). Patches liftUpTo.
  function liftWalk({ transactions, itemsets, minconf }) {
    const n = transactions.length;
    const c = ruleCandidates(transactions, itemsets).filter((r) => r.conf >= minconf - EPS);
    const trace = c.map((r, k) => {
      const lift = r.conf / (r.supB / n);
      const word = lift > 1 + EPS ? 'positive' : lift < 1 - EPS ? 'negative' : 'no association';
      return {
        label: `$${ruleTex(r.A, r.B)}$: lift $= \\frac{${r.supI}}{${r.supA}} \\div \\frac{${r.supB}}{${n}} = ${r2(lift)}$ → ${word}`,
        vars: { lift },
        patch: { liftUpTo: k + 1 },
        ops: [{ role: 'grid', cmd: 'highlight', args: { sel: `row:L${k + 1}`, tone: lift > 1 + EPS ? 'good' : lift < 1 - EPS ? 'bad' : 'warn' } }],
      };
    });
    const ones = c.filter((r) => Math.abs(r.conf / (r.supB / n) - 1) < 1e-9).length;
    trace.push({ label: `${ones} of the ${c.length} kept rules have lift exactly 1: no association at all`, patch: { liftUpTo: c.length } });
    return { count: c.length, ones, trace };
  }

  // Line-by-line rule generation. anchors: init, itemset, skip, size, split, conf, test, keep, ret
  function rulesCode({ transactions, itemsets, minconf }) {
    const sup = (s) => transactions.filter((t) => isSubset(s, t.items)).length;
    const trace = [{ label: '`out = []`: no rules yet', code: 'init', math: 'init', vars: { rules: 0 }, ops: [T_CLEAR()] }];
    let kept = 0;
    // rows holding A are accent, rows holding all of I (so A ∪ B) are good; the chips show which part is A and which is B
    const ruleOps = (A, B, I) => {
      const hA = hitIds(transactions, A), hI = hitIds(transactions, I);
      return [T_HL(rowSel(hA)), T_HL(rowSel(hI), 'good'),
        T_HL(transactions.flatMap((t) => (hA.includes(t.id) ? chipSel(t, A) : [])), 'accent'),
        T_HL(transactions.flatMap((t) => (hI.includes(t.id) ? chipSel(t, B) : [])), 'good')];
    };
    for (const I0 of itemsets) {
      const I = sortSet(I0);
      const supI = sup(I);
      const hI = hitIds(transactions, I);
      trace.push({ label: `\`for I, sup_I in frequent.items()\`: I = ${setText(I)}, sup_I = ${supI}`, code: 'itemset', math: 'itemset', vars: { I: setText(I), sup_I: supI }, ops: [T_HL(rowSel(hI), 'good'), T_HL(itemSel(I))] });
      if (I.length < 2) { trace.push({ label: `\`len(I) < 2\`: a single item can't be split into A and B, \`continue\``, code: 'skip', math: 'skip', ops: [T_HL(itemSel(I), 'muted')] }); continue; }
      for (let k = I.length - 1; k >= 1; k--) {
        trace.push({ label: `\`for k\`: antecedents with k = ${k} item${k > 1 ? 's' : ''}`, code: 'size', math: 'size', vars: { k }, ops: [T_HL(rowSel(hI), 'good')] });
        for (const A of combinations(I, k)) {
          const B = I.filter((x) => !A.includes(x));
          trace.push({ label: `\`for A in combinations\`: A = ${setText(A)}, so B = I − A = ${setText(B)}`, code: 'split', math: 'split', vars: { A: setText(A), B: setText(B) }, ops: ruleOps(A, B, I) });
          const supA = sup(A);
          const conf = supI / supA;
          trace.push({ label: `\`conf = sup_I / frequent[A]\` = ${supI} / ${supA} = ${r2(conf)}`, code: 'conf', math: 'conf', vars: { conf }, ops: ruleOps(A, B, I) });
          const ok = conf >= minconf - EPS;
          trace.push({ label: `\`conf >= minconf\`: ${r2(conf)} ≥ ${minconf}? **${ok ? 'True' : 'False'}**${ok ? '' : ', rule dropped'}`, code: 'test', math: 'test', vars: { test: ok ? 'True' : 'False' }, ops: ruleOps(A, B, I) });
          if (ok) { kept++; trace.push({ label: `\`out.append\`: ${setText(A)} → ${setText(B)} (${kept} rules so far)`, code: 'keep', math: 'keep', vars: { rules: kept }, ops: ruleOps(A, B, I) }); }
        }
      }
    }
    trace.push({ label: `\`return out\`: ${kept} rules`, code: 'ret', math: 'ret', vars: { rules: kept } });
    return { kept, trace };
  }

  // Line-by-line lift. anchors: n, sup-a, sup-ab, conf, sup-b, relb, lift
  function liftCode({ transactions, A, B }) {
    const n = transactions.length;
    const hit = (s) => transactions.filter((t) => isSubset(s, t.items)).map((t) => t.id);
    const ha = hit(A), hab = hit([...A, ...B]), hb = hit(B);
    const conf = ha.length ? hab.length / ha.length : null;
    const relB = hb.length / n;
    const lift = conf === null || relB === 0 ? null : conf / relB;
    const word = lift === null ? 'undefined' : lift > 1 + EPS ? 'positive association' : lift < 1 - EPS ? 'negative association' : 'no association';
    const chipsOf = (ids, X, tone) => T_HL(transactions.flatMap((t) => (ids.includes(t.id) ? chipSel(t, X) : [])), tone);
    const all = transactions.map((t) => t.id);
    return {
      lift, conf, relB,
      trace: [
        { label: `\`n = len(transactions)\` = ${n}`, code: 'n', math: 'n', vars: { n }, ops: [T_CLEAR(), T_HL(rowSel(all), 'muted')] },
        { label: `\`sup_a\`: ${setText(sortSet(A))} is in ${rowsText(ha)} → ${ha.length}`, code: 'sup-a', math: 'sup-a', vars: { sup_a: ha.length }, ops: [T_HL(rowSel(ha)), chipsOf(ha, A, 'accent')] },
        { label: `\`sup_ab\`: ${setText(sortSet([...A, ...B]))} is in ${rowsText(hab)} → ${hab.length}`, code: 'sup-ab', math: 'sup-ab', vars: { sup_ab: hab.length }, ops: [T_HL(rowSel(hab), 'good'), chipsOf(hab, [...A, ...B], 'good')] },
        { label: `\`conf = sup_ab / sup_a\` = ${hab.length} / ${ha.length} = ${r2(conf)}`, code: 'conf', math: 'conf', vars: { conf }, ops: [T_HL(rowSel(ha)), T_HL(rowSel(hab), 'good')] },
        { label: `\`sup_b\`: ${setText(sortSet(B))} is in ${rowsText(hb)} → ${hb.length}`, code: 'sup-b', math: 'sup-b', vars: { sup_b: hb.length }, ops: [T_HL(rowSel(hb), 'warn'), chipsOf(hb, B, 'warn')] },
        { label: `\`rel_b = sup_b / n\` = ${hb.length} / ${n} = ${r2(relB)}`, code: 'relb', math: 'relb', vars: { rel_b: relB }, ops: [T_HL(rowSel(all), 'muted'), T_HL(rowSel(hb), 'warn')] },
        { label: `\`return conf / rel_b\` = ${r2(conf)} / ${r2(relB)} = ${r2(lift)}: ${word}`, code: 'lift', math: 'lift', vars: { lift } },
      ],
    };
  }

  // Line-by-line leverage and conviction. anchors: rels, lev, conv
  function leverageCode({ transactions, A, B }) {
    const m = ruleMetrics({ transactions, A, B });
    const ha = hitIds(transactions, A), hb = hitIds(transactions, B), hab = hitIds(transactions, [...A, ...B]);
    // rows where the rule fires but fails: A without B
    const fails = ha.filter((id) => !hab.includes(id));
    return {
      leverage: m.leverage, conviction: m.conviction,
      trace: [
        { label: `Relative supports: A ${r2(m.relA)}, B ${r2(m.relB)}, A ∪ B ${r2(m.relAB)}`, code: 'rels', math: 'rels', vars: { s_a: m.relA, s_b: m.relB, s_ab: m.relAB },
          ops: [T_CLEAR(), T_HL(rowSel(ha)), T_HL(rowSel(hb), 'warn'), T_HL(rowSel(hab), 'good'),
            ...transactions.map((t) => T_NOTE(`row:${t.id}`, [ha.includes(t.id) && 'A', hb.includes(t.id) && 'B'].filter(Boolean).join(' + ') || '–'))] },
        { label: `\`s(A | B) - s(A) * s(B)\` = ${r2(m.relAB)} − ${r2(m.relA)} × ${r2(m.relB)} = ${+m.leverage.toFixed(3)}`, code: 'lev', math: 'lev', vars: { leverage: m.leverage }, ops: [T_HL(rowSel(hab), 'good')] },
        { label: m.convictionInfinite ? 'conf = 1, so the rule never fails: conviction = ∞' : `\`(1 - rel_b) / (1 - c)\` = (1 − ${r2(m.relB)}) / (1 − ${r2(m.conf)}) = ${r2(m.conviction)}`, code: 'conv', math: 'conv', vars: { conviction: m.convictionInfinite ? 'inf' : m.conviction },
          ops: [T_HL(rowSel(hab), 'good'), T_HL(rowSel(fails), 'bad')] },
      ],
    };
  }

  function ruleMetrics({ transactions, A, B }) {
    const l = lift({ transactions, A, B });
    const leverage = l.relAB - l.relA * l.relB;
    const conviction = l.conf === null ? null : l.conf >= 1 - EPS ? null : (1 - l.relB) / (1 - l.conf);
    return { ...l, trace: undefined, leverage, conviction, convictionInfinite: l.conf !== null && l.conf >= 1 - EPS };
  }

  function rules({ transactions, minsup, minconf, sortBy, top }) {
    const fi = frequentItemsets({ transactions, minsup });
    const items = fi.items;
    const n = transactions.length;
    const sup = (s) => fi.supportMap[key(s, items)];
    const out = [];
    let considered = 0;
    for (const f of fi.frequent) {
      if (f.itemset.length < 2) continue;
      for (const A of powerset(f.itemset, { min: 1, max: f.itemset.length - 1 })) {
        const B = f.itemset.filter((x) => !A.includes(x));
        const supA = sup(A);
        const conf = f.abs / supA;
        considered++;
        if (conf >= minconf - EPS) {
          const relB = sup(B) / n;
          out.push({ A, B, supAB: f.abs, supA, conf, lift: conf / relB, relAB: f.abs / n, label: `${A.join(' + ')} → ${B.join(' + ')}` });
        }
      }
    }
    const sorted = sortBy ? [...out].sort((a, b) => (sortBy === 'support' ? b.relAB - a.relAB : sortBy === 'confidence' ? b.conf - a.conf : b.lift - a.lift) || b.lift - a.lift) : out;
    const shown = top ? sorted.slice(0, top) : sorted;
    const best = [...out].sort((a, b) => b.lift - a.lift)[0] || null;
    return {
      rules: sorted, count: out.length, considered, frequentCount: fi.count,
      best,
      table: { rows: shown.map((r) => r.label), cols: ['support', 'confidence', 'lift'], values: shown.map((r) => [r.relAB, r.conf, r.lift]) },
    };
  }

  // roles: code, formula
  function rulesFromItemset({ transactions, itemset, minconf }) {
    const I = sortSet(itemset);
    const supI = support({ transactions, itemset: I }).abs;
    const trace = [];
    const passed = [];
    for (const A of powerset(I, { min: 1, max: I.length - 1 })) {
      const B = I.filter((x) => !A.includes(x));
      const supA = support({ transactions, itemset: A }).abs;
      const conf = supA ? supI / supA : 0;
      const ok = conf >= minconf - EPS;
      if (ok) passed.push({ A, B, conf });
      trace.push({ label: `${setText(A)} → ${setText(B)}: ${supI}/${supA} = ${+conf.toFixed(2)} ${ok ? '≥' : '<'} ${minconf} ${ok ? 'keep' : 'drop'}`, code: ok ? 'keep' : 'conf', math: 'conf', vars: { conf } });
    }
    return { passed, count: passed.length, candidates: trace.length, trace };
  }

  function vennCounts({ transactions, A, B }) {
    const nA = transactions.filter((t) => isSubset(A, t.items)).length;
    const nB = transactions.filter((t) => isSubset(B, t.items)).length;
    const nAB = transactions.filter((t) => isSubset([...A, ...B], t.items)).length;
    return { nA, nB, nAB, N: transactions.length };
  }

  function explosion({ n }) {
    const xs = [];
    const ys = [];
    for (let i = 1; i <= n; i++) { xs.push(i); ys.push(Math.pow(2, i) - 1); }
    return { count: Math.pow(2, n) - 1, pairs: (n * (n - 1)) / 2, x: xs, y: ys, series: [{ name: 'itemsets to check (2ⁿ − 1)', x: xs, y: ys }] };
  }

  function itemSupports({ transactions }) {
    const items = itemsOf(transactions);
    const counts = items.map((i) => transactions.filter((t) => t.items.includes(i)).length);
    return { items, counts, series: [{ name: 'baskets', x: items, y: counts }] };
  }

  // ---------------------------------------------------------------- quiz helpers
  const POOL = ['bread', 'butter', 'cheese', 'eggs', 'milk', 'yogurt'];
  function randomDb(rng, n, pool, lo, hi) {
    return Array.from({ length: n }, (_, i) => ({ id: i + 1, items: sortSet(rng.sample(pool, rng.int(lo, hi)), pool) }));
  }
  const approxEq = (a, b) => Math.abs(a - b) < 1e-6;

  function supportQ({ rng, difficulty }) {
    for (;;) {
      const n = difficulty === 1 ? 5 : difficulty === 2 ? 6 : 7;
      const pool = POOL.slice(0, difficulty === 3 ? 6 : 5);
      const transactions = randomDb(rng, n, pool, 2, 4);
      const k = difficulty === 3 ? 3 : 2;
      const X = sortSet(rng.sample(pool, k), pool);
      const s = support({ transactions, itemset: X });
      const anyCount = transactions.filter((t) => X.some((x) => t.items.includes(x))).length;
      if (s.abs === 0 || s.abs === n || anyCount === s.abs) continue;
      return { vars: { transactions, X, abs: s.abs, rel: s.rel, n, anyCount }, misconceptions: [
        { var: 'anyCount', feedback: 'You counted baskets containing **any** of the items. A basket supports an itemset only if it contains **all** of them.' },
        { var: 'rel', feedback: 'That is the **relative** support (a fraction). The question asks for the absolute count.' },
      ] };
    }
  }

  function supportRelQ({ rng, difficulty }) {
    for (;;) {
      const n = difficulty === 1 ? 5 : 8;
      const transactions = randomDb(rng, n, POOL, 2, 4);
      const X = sortSet(rng.sample(POOL, difficulty === 1 ? 1 : 2), POOL);
      const s = support({ transactions, itemset: X });
      const totalItems = transactions.reduce((a, t) => a + t.items.length, 0);
      if (s.abs === 0 || s.abs === n) continue;
      if (approxEq(s.abs / totalItems, s.rel)) continue;
      return { vars: { transactions, X, abs: s.abs, rel: s.rel, n, wrongItems: s.abs / totalItems, totalItems }, misconceptions: [
        { var: 'abs', feedback: 'That is the absolute count. Relative support divides it by |D|, the number of transactions.' },
        { var: 'wrongItems', feedback: 'You divided by the total number of **items**. Divide by the number of **transactions** instead.' },
      ] };
    }
  }

  function countFrequentQ({ rng, difficulty, fns }) {
    for (;;) {
      const pool = POOL.slice(0, difficulty === 3 ? 6 : 5);
      const transactions = randomDb(rng, difficulty === 3 ? 6 : 5, pool, 2, 4);
      const minsup = difficulty === 1 ? 3 : 2;
      const r = fns.frequentItemsets({ transactions, minsup });
      const strict = fns.frequentItemsets({ transactions, minsup: minsup + 1 }).count;
      if (r.count < 3 || r.count > 12 || r.count === r.singles || strict === r.count) continue;
      return { vars: { transactions, minsup, count: r.count, singles: r.singles, strict, byLevel: r.byLevel, list: r.labels.join(', ') }, misconceptions: [
        { var: 'singles', feedback: 'You only counted single items. Pairs and larger itemsets can be frequent too.' },
        { var: 'strict', feedback: 'You used support **>** minsup. Frequent means support **≥** minsup.' },
      ] };
    }
  }

  function confidenceQ({ rng, difficulty, fns }) {
    for (;;) {
      const n = difficulty === 1 ? 5 : 7;
      const transactions = randomDb(rng, n, POOL, 2, 4);
      const [a, b, c] = rng.sample(POOL, 3);
      const A = difficulty === 3 ? sortSet([a, c], POOL) : [a];
      const B = [b];
      const r = fns.confidence({ transactions, A, B });
      if (r.supA < 2 || r.supAB < 1 || r.supAB === r.supA || r.supB === 0) continue;
      if (r.supA === n || r.supB === r.supA) continue;
      return {
        vars: { transactions, A, B, supAB: r.supAB, supA: r.supA, supB: r.supB, conf: r.conf, n, wrongDivN: r.supAB / n, wrongReversed: r.supAB / r.supB },
        misconceptions: [
          { var: 'wrongDivN', feedback: 'You divided by the number of transactions. Confidence divides by **Sup(A)**, the baskets that contain the antecedent.' },
          { var: 'wrongReversed', feedback: 'That is conf(B → A). Direction matters: divide by the support of the **antecedent**.' },
        ],
      };
    }
  }

  function liftQ({ rng, difficulty, fns }) {
    for (;;) {
      const n = difficulty === 1 ? 5 : difficulty === 2 ? 6 : 8;
      const transactions = randomDb(rng, n, POOL, 2, 4);
      const [a, b] = rng.sample(POOL, 2);
      const r = fns.lift({ transactions, A: [a], B: [b] });
      if (r.lift === null || r.supAB === 0 || r.supB === n || r.supA === n) continue;
      if (approxEq(r.lift, 1)) continue;
      const wrongRelA = r.conf / r.relA;
      const wrongConf = r.conf;
      if (approxEq(wrongRelA, r.lift) || approxEq(wrongConf, r.lift)) continue;
      return { vars: { transactions, A: [a], B: [b], conf: r.conf, relB: r.relB, supB: r.supB, supA: r.supA, supAB: r.supAB, n, lift: r.lift, wrongRelA, wrongConf, verdict: r.verdict }, misconceptions: [
        { var: 'wrongRelA', feedback: 'You divided by RelSup(A). Lift compares the rule with how common the **consequent** B is: conf / RelSup(B).' },
        { var: 'wrongConf', feedback: 'That is just the confidence. Lift divides it by RelSup(B).' },
      ] };
    }
  }

  function liftVerdictQ({ rng, fns }) {
    for (;;) {
      const transactions = randomDb(rng, 6, POOL, 2, 4);
      const [a, b] = rng.sample(POOL, 2);
      const r = fns.lift({ transactions, A: [a], B: [b] });
      if (r.lift === null || r.supAB === 0) continue;
      const answer = r.verdict === 'positive' ? 0 : r.verdict === 'independent' ? 1 : 2;
      return { vars: { transactions, A: [a], B: [b], lift: r.lift, conf: r.conf, relB: r.relB, verdict: r.verdict }, answer,
        options: ['Positive association: A makes B more likely', 'No association: A and B are independent', 'Negative association: A makes B less likely', 'Cannot tell without the confidence threshold'] };
    }
  }

  function aprioriCandidatesQ({ rng }) {
    for (;;) {
      const transactions = randomDb(rng, 5, POOL.slice(0, 5), 2, 3);
      const minsup = 2;
      const items = itemsOf(transactions);
      const freq = items.filter((i) => transactions.filter((t) => t.items.includes(i)).length >= minsup);
      const infreq = items.filter((i) => !freq.includes(i));
      if (!infreq.length || freq.length < 3) continue;
      const pairs = combinations(items, 2);
      const opts = rng.sample(pairs, Math.min(5, pairs.length));
      const answer = opts.map((p, i) => (p.every((x) => freq.includes(x)) ? i : -1)).filter((i) => i >= 0);
      if (!answer.length || answer.length === opts.length) continue;
      const counts = Object.fromEntries(items.map((i) => [i, transactions.filter((t) => t.items.includes(i)).length]));
      return { vars: { transactions, minsup, infreq, freq, counts: items.map((i) => `${i}: ${counts[i]}`).join(', ') }, options: opts.map((p) => `{${p.join(', ')}}`), answer };
    }
  }

  function rulesPassQ({ rng, fns }) {
    for (;;) {
      const transactions = randomDb(rng, 6, POOL.slice(0, 5), 2, 4);
      const minconf = rng.pick([0.5, 0.6, 0.7]);
      const fi = fns.frequentItemsets({ transactions, minsup: 2 });
      const pairs = fi.frequent.filter((f) => f.itemset.length === 2);
      if (!pairs.length) continue;
      const I = rng.pick(pairs).itemset;
      const three = fi.frequent.filter((f) => f.itemset.length === 3);
      const itemset = three.length && rng.bool(0.5) ? rng.pick(three).itemset : I;
      const r = fns.rulesFromItemset({ transactions, itemset, minconf });
      const all = powerset(itemset, { min: 1, max: itemset.length - 1 }).map((A) => ({ A, B: itemset.filter((x) => !A.includes(x)) }));
      const answer = all.map((x, i) => (r.passed.some((p) => key(p.A) === key(x.A)) ? i : -1)).filter((i) => i >= 0);
      if (!answer.length || answer.length === all.length) continue;
      const supI = fns.support({ transactions, itemset }).abs;
      return { vars: { transactions, itemset, minconf, supI, detail: r.trace.map((s) => s.label).join('; ') }, options: all.map((x) => `{${x.A.join(', ')}} → {${x.B.join(', ')}}`), answer };
    }
  }

  function ruleCountQ({ rng }) {
    const k = rng.int(2, 5);
    return { vars: { k, count: Math.pow(2, k) - 2, wrongAll: Math.pow(2, k) - 1, wrongPairs: k * (k - 1) }, misconceptions: [
      { var: 'wrongAll', feedback: 'Both sides of a rule must be non-empty, so drop the empty antecedent **and** the full antecedent: 2^k − 2.' },
      { var: 'wrongPairs', feedback: 'Rules are not just ordered pairs of items: any non-empty proper subset can be the antecedent.' },
    ] };
  }

  function bruteCountQ({ rng }) {
    const n = rng.int(4, 12);
    return { vars: { n, count: Math.pow(2, n) - 1, wrongPow: Math.pow(2, n), wrongSq: n * n }, misconceptions: [
      { var: 'wrongPow', feedback: '2ⁿ counts the empty set too; it is never a useful itemset, so brute force checks 2ⁿ − 1.' },
      { var: 'wrongSq', feedback: 'Itemsets of every size count, not only pairs: the lattice has 2ⁿ − 1 non-empty subsets.' },
    ] };
  }

  function projectedQ({ rng, fns }) {
    for (;;) {
      const transactions = randomDb(rng, 6, POOL, 2, 4);
      const [a] = rng.sample(POOL.slice(0, 4), 1);
      const s = fns.support({ transactions, itemset: [a] });
      if (s.abs < 2) continue;
      const rows = transactions.filter((t) => t.items.includes(a));
      const after = rows.map((t) => t.items.filter((x) => POOL.indexOf(x) > POOL.indexOf(a)));
      const laterItems = sortSet([...new Set(after.flat())], POOL);
      if (!laterItems.length) continue;
      const b = rng.pick(laterItems);
      const supAB = after.filter((r) => r.includes(b)).length;
      const wrongAll = transactions.filter((t) => t.items.includes(b)).length;
      if (wrongAll === supAB) continue;
      return { vars: { transactions, a, b, rows: s.abs, supAB, wrongAll, prefix: [a], prefix2: [a, b] }, misconceptions: [
        { var: 'wrongAll', feedback: 'You counted in the whole database. Inside the {a}-projected database only rows that contain the prefix remain.' },
        { var: 'rows', feedback: 'That is the number of rows in the projected database, i.e. Sup of the prefix alone.' },
      ] };
    }
  }

  function trapQ({ rng, fns }) {
    for (;;) {
      const pool = POOL.slice(0, 5);
      const always = rng.pick(pool);
      const transactions = randomDb(rng, 5, pool.filter((x) => x !== always), 1, 3).map((t) => ({ ...t, items: sortSet([...t.items, always], pool) }));
      const a = rng.pick(pool.filter((x) => x !== always));
      const r = fns.lift({ transactions, A: [a], B: [always] });
      if (r.supA === 0) continue;
      return { vars: { transactions, a, always, conf: r.conf, lift: r.lift }, answer: 1,
        options: ['conf = 1 and lift > 1: a strong rule to act on', 'conf = 1 but lift = 1: the rule tells us nothing', 'conf < 1 and lift < 1: a negative association', 'Confidence is undefined here'] };
    }
  }

  function handRuleQ({ rng, difficulty, fns }) {
    for (;;) {
      const n = difficulty === 3 ? 7 : 5;
      const transactions = randomDb(rng, n, POOL, 2, 4);
      const [a, b, c] = rng.sample(POOL, 3);
      const A = difficulty === 3 ? sortSet([a, c], POOL) : [a];
      const B = [b];
      const r = fns.lift({ transactions, A, B });
      if (r.lift === null || r.supAB === 0 || r.supA === r.supAB || r.supB === n) continue;
      return { vars: { transactions, A, B, supAB: r.supAB, supA: r.supA, supB: r.supB, n, conf: r.conf, relB: r.relB, lift: r.lift,
        wrongConfN: r.supAB / n, wrongRelB: r.supB, wrongLift: r.conf / r.relA, verdict: r.verdict } };
    }
  }

  function handMineQ({ rng, fns }) {
    for (;;) {
      const pool = POOL.slice(0, 5);
      const transactions = randomDb(rng, 5, pool, 2, 4);
      const minconf = rng.pick([0.6, 0.7]);
      const fi = fns.frequentItemsets({ transactions, minsup: 2 });
      const r = fns.rules({ transactions, minsup: 2, minconf });
      const L = fi.byLevel;
      if (fi.count > 12 || (L[1] || 0) < 2 || r.count < 2 || r.count > 12) continue;
      return { vars: { transactions, minconf, l1: L[0] || 0, l2: L[1] || 0, l3: L[2] || 0, total: fi.count, rules: r.count, considered: r.considered,
        frequentList: fi.labels.join(', '), ruleList: r.rules.map((x) => `${x.label} (${+x.conf.toFixed(2)})`).join('; ') } };
    }
  }

  function vennConfQ({ rng }) {
    for (;;) {
      const N = rng.int(10, 40);
      const nA = rng.int(3, N - 2);
      const nB = rng.int(3, N - 2);
      const nAB = rng.int(1, Math.min(nA, nB) - 1);
      if (nA + nB - nAB > N) continue;
      const conf = nAB / nA;
      const lift = conf / (nB / N);
      if (approxEq(lift, 1)) continue;
      return { vars: { N, nA, nB, nAB, conf, lift, wrongN: nAB / N, wrongB: nAB / nB }, misconceptions: [
        { var: 'wrongN', feedback: 'nAB / N is the support of A ∪ B, not the confidence. Condition on A: divide by nA.' },
        { var: 'wrongB', feedback: 'You conditioned on B. conf(A → B) divides by the antecedent count nA.' },
      ] };
    }
  }

  return {
    fns: {
      support, supportCode, supportGrid, supportGridWalk, frequentItemsets, frequentAmong, frequentCode,
      bruteForce, bfSupport, bruteForceWalk, bruteForceCode,
      aprioriRun, aprioriSupport, aprioriWalk, aprioriCode, aprioriClassic,
      fpGrowthRun, fpCountGrid, fpTreeUpTo, fpWalk, fpGrowthCode,
      confidence, confidenceCode, lift, liftCode, ruleMetrics, leverageCode, rules, rulesFromItemset, rulesGrid, rulesWalk, rulesCode, liftGrid, liftWalk,
      vennCounts, explosion, itemSupports,
    },
    generators: { supportQ, supportRelQ, countFrequentQ, confidenceQ, liftQ, liftVerdictQ, aprioriCandidatesQ, rulesPassQ, ruleCountQ, bruteCountQ, projectedQ, trapQ, handRuleQ, handMineQ, vennConfQ },
  };
}
