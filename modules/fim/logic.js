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

  // roles: table (TransactionTable), code, formula
  function support({ transactions, itemset }) {
    const set = sortSet(itemset || []);
    const n = transactions.length;
    let count = 0;
    const hits = [];
    const trace = [];
    for (const t of transactions) {
      const ok = isSubset(set, t.items);
      if (ok) { count++; hits.push(t.id); }
      trace.push({
        label: `T${t.id} ${ok ? 'contains' : 'does not contain'} ${setText(set)} → count = ${count}`,
        code: 'abs',
        math: 'abs',
        vars: { count },
        ops: [{ role: 'table', cmd: 'highlight', args: { sel: `row:${t.id}`, tone: ok ? 'good' : 'bad' } }],
      });
    }
    trace.push({ label: `Relative support = ${count} / ${n} = ${n ? +(count / n).toFixed(2) : 0}`, code: 'rel', math: 'rel', vars: { abs: count, n, rel: n ? count / n : 0 },
      ops: [{ role: 'table', cmd: 'highlight', args: { sel: hits.map((h) => `row:${h}`), tone: 'good' } }] });
    return { abs: count, rel: n ? count / n : 0, hits, n, itemset: set, trace };
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
    fns: { support, frequentItemsets, frequentAmong, bruteForce, aprioriRun, aprioriClassic, fpGrowthRun, confidence, lift, ruleMetrics, rules, rulesFromItemset, vennCounts, explosion, itemSupports },
    generators: { supportQ, supportRelQ, countFrequentQ, confidenceQ, liftQ, liftVerdictQ, aprioriCandidatesQ, rulesPassQ, ruleCountQ, bruteCountQ, projectedQ, trapQ, handRuleQ, handMineQ, vennConfQ },
  };
}
