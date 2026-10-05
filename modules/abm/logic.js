export default function register(sdk) {
  const { fmt, sum } = sdk;
  const P = (x) => fmt(x, 'money');
  const P2 = (x) => fmt(x, 'money2');
  const C = (x) => fmt(x, 'comma');
  const PCT = (x) => fmt(x, 'pct1').replace('.0%', '%');
  const N = (x) => fmt(x, '2'); // up to 2 decimals, trailing zeros stripped

  // ------------------------------------------------------------------ helpers
  function clean(o) {
    if (Array.isArray(o)) return o.map(clean);
    if (o && typeof o === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = clean(v);
      return out;
    }
    return o;
  }
  // roles: journal (pane), formula, code
  function toTrace(steps) {
    return steps.map((s, i) => {
      const ops = [];
      if (i === 0) ops.push({ role: 'journal', cmd: 'clear' });
      if (s.row) ops.push({ role: 'journal', cmd: 'highlight', args: { sel: `row:${s.row}`, tone: s.tone ?? 'accent' } });
      return clean({ label: s.label, math: s.math, code: s.code ?? s.math, vars: s.vars ?? {}, ops });
    });
  }

  // ------------------------------------------------------------------ process-value analysis (Cordillera, Luzon Savings Bank)
  const ACTION = { eliminate: 'Eliminate', reduce: 'Reduce', select: 'Select', share: 'Share' };
  function classify({ activities }) {
    const va = activities.filter((a) => a.va);
    const nva = activities.filter((a) => !a.va);
    const rows = activities.map((a, i) => ({ id: `a-${i + 1}`, label: a.name, amounts: [a.va ? 'Value-added' : 'Non-value-added', a.va ? '' : ACTION[a.action] ?? ''], anchor: a.va ? 'va' : 'nva' }));
    const steps = activities.map((a, i) => ({
      row: `a-${i + 1}`, math: a.va ? 'va' : 'nva',
      label: `${a.name}: ${a.va ? 'value-added, it changes what the customer gets' : `non-value-added${a.action ? `; ${a.action} it` : ''}`}`,
      vars: { va: activities.slice(0, i + 1).filter((x) => x.va).length, nva: activities.slice(0, i + 1).filter((x) => !x.va).length },
      tone: a.va ? 'good' : 'bad',
    }));
    const eliminate = nva.filter((a) => a.action === 'eliminate').map((a) => a.name);
    return clean({ va: va.length, nva: nva.length, total: activities.length, nvaShare: nva.length / activities.length, eliminate: eliminate.join('; ') || 'none', rows, trace: toTrace(steps) });
  }

  // ------------------------------------------------------------------ driver analysis: setups per unit (Cavite Precision, slide 36)
  function setups({ products, costPerSetup }) {
    const prod = products.map((p) => ({ ...p, cost: p.setups * costPerSetup, perUnit: (p.setups * costPerSetup) / p.units, batch: p.units / p.setups }));
    const [a, b] = prod;
    const rows = [
      { id: 's-setups', label: 'Setups per year', amounts: prod.map((p) => p.setups), format: 'units', anchor: 'setups' },
      { id: 's-units', label: 'Units per year', amounts: prod.map((p) => p.units), format: 'units', anchor: 'setups' },
      { id: 's-batch', label: 'Average batch size (units per setup)', amounts: prod.map((p) => p.batch), format: 'units', anchor: 'batch' },
      { id: 's-cost', label: `Setup cost at ${P(costPerSetup)} per setup`, amounts: prod.map((p) => p.cost), anchor: 'cost' },
      { id: 's-unit', label: 'Setup cost per unit', amounts: prod.map((p) => p.perUnit), style: 'total', anchor: 'cost' },
    ];
    const steps = [
      { row: 's-setups', math: 'setups', label: `${a.name}: ${C(a.setups)} setups vs ${C(b.setups)}, ${N(a.setups / b.setups)} times as many on a quarter of the volume`, vars: { ratio: a.setups / b.setups } },
      { row: 's-batch', math: 'batch', label: `Batch size: ${C(a.units)} ÷ ${C(a.setups)} = ${C(a.batch)} units vs ${C(b.batch)}`, vars: { batchA: a.batch, batchB: b.batch } },
      { row: 's-unit', math: 'cost', label: `Setup cost per unit: ${P2(a.perUnit)} vs ${P2(b.perUnit)}`, vars: { perUnitA: a.perUnit, perUnitB: b.perUnit }, tone: 'bad' },
    ];
    return clean({ ratio: a.setups / b.setups, costA: a.cost, costB: b.cost, perUnitA: a.perUnit, perUnitB: b.perUnit, batchA: a.batch, batchB: b.batch, columns: prod.map((p) => p.name), rows, trace: toTrace(steps) });
  }
  // Batangas Steel: how much of a cost increase volume explains (slide 72)
  function costGrowth({ before, after, volumeGrowth }) {
    const expected = before * (1 + volumeGrowth);
    const unexplained = after - expected;
    const rows = [
      { id: 'g-before', label: 'Inspection cost last year', amount: before, anchor: 'expected' },
      { id: 'g-expected', label: `Expected this year if only volume drove it (+${PCT(volumeGrowth)})`, amount: expected, style: 'subtotal', anchor: 'expected' },
      { id: 'g-after', label: 'Actual inspection cost this year', amount: after, anchor: 'unexplained' },
      { id: 'g-gap', label: 'Increase volume cannot explain', amount: unexplained, style: 'total', anchor: 'unexplained' },
    ];
    const steps = [
      { row: 'g-expected', math: 'expected', label: `Volume alone: ${C(before)} × ${N(1 + volumeGrowth)} = ${P(expected)}`, vars: { expected } },
      { row: 'g-after', math: 'unexplained', label: `Actual this year: ${P(after)}, ${N(after / before)} times last year`, vars: { after } },
      { row: 'g-gap', math: 'unexplained', label: `${C(after)} − ${C(expected)} = ${P(unexplained)} needs a root cause`, vars: { unexplained }, tone: 'bad' },
    ];
    return clean({ expected, unexplained, multiple: after / before, perVolume: after / before / (1 + volumeGrowth), rows, trace: toTrace(steps) });
  }

  // ------------------------------------------------------------------ customer profitability (Rizal, slides 47–48 and 73)
  function customerCore({ pools, customers }) {
    const R = pools.map((p, i) => { const total = p.total ?? sum(customers.map((c) => c.use[i])); return { ...p, total, rate: p.cost / total }; });
    const cust = customers.map((c) => {
      const lines = R.map((p, i) => p.rate * c.use[i]);
      const cost = sum(lines);
      return { ...c, lines, cost, profit: c.gm - cost };
    });
    return { R, cust };
  }
  function customers({ pools, customers: list, consolidated, scenario }) {
    const applied = scenario === 'consolidated' && consolidated ? list.map((c) => (c.id === consolidated.id ? { ...c, use: consolidated.use } : c)) : list;
    const { R, cust } = customerCore({ pools, customers: applied });
    const hasSales = cust.every((c) => c.sales !== undefined);
    const rows = [
      ...(hasSales ? [{ id: 'c-sales', label: 'Sales', amounts: cust.map((c) => c.sales), anchor: 'gm' }] : []),
      { id: 'c-gm', label: 'Gross margin', amounts: cust.map((c) => c.gm), anchor: 'gm' },
      ...R.map((p, i) => ({ id: `c-${p.id}`, label: `Less ${p.name.toLowerCase()} (${P(p.rate)} per ${p.driver.replace(/ies$/, 'y').replace(/s$/, '')})`, amounts: cust.map((c) => -c.lines[i]), indent: 1, anchor: 'assign' })),
      { id: 'c-cost', label: 'ABC-assigned cost to serve', amounts: cust.map((c) => -c.cost), style: 'subtotal', anchor: 'assign' },
      { id: 'c-profit', label: 'Operating profit', amounts: cust.map((c) => c.profit), style: 'total', anchor: 'profit' },
    ];
    const byGm = [...cust].sort((a, b) => b.gm - a.gm).map((c) => c.id).join(' > ');
    const byProfit = [...cust].sort((a, b) => b.profit - a.profit).map((c) => c.id).join(' > ');
    const steps = [
      ...R.map((p) => ({ row: `c-${p.id}`, math: 'assign', label: `${p.name}: ${C(p.cost)} ÷ ${C(p.total)} = ${P(p.rate)} per ${p.driver.replace(/ies$/, 'y').replace(/s$/, '')}`, vars: { [`rate_${p.id}`]: p.rate } })),
      { row: 'c-cost', math: 'assign', label: `Cost to serve: ${cust.map((c) => `${c.id} ${P(c.cost)}`).join('; ')}`, vars: Object.fromEntries(cust.map((c) => [`cost_${c.id}`, c.cost])) },
      { row: 'c-profit', math: 'profit', label: `Operating profit: ${cust.map((c) => `${c.id} ${P(c.profit)}`).join('; ')}`, vars: Object.fromEntries(cust.map((c) => [`profit_${c.id}`, c.profit])), tone: 'good' },
    ];
    const by = (k) => Object.fromEntries(cust.map((c) => [c.id, c[k]]));
    return clean({ rates: Object.fromEntries(R.map((p) => [p.id, p.rate])), cost: by('cost'), profit: by('profit'), total: sum(cust.map((c) => c.profit)), rankGm: byGm, rankProfit: byProfit,
      columns: cust.map((c) => c.name), rows, trace: toTrace(steps) });
  }
  // The whale curve: customers from most to least profitable, cumulative share of total profit
  function whale({ pools, customers: list }) {
    const { cust } = customerCore({ pools, customers: list });
    const total = sum(cust.map((c) => c.profit));
    const sorted = [...cust].sort((a, b) => b.profit - a.profit);
    let run = 0;
    const pts = sorted.map((c) => { run += c.profit; return { ...c, cum: run, share: run / total }; });
    const peak = pts.reduce((a, b) => (b.share > a.share ? b : a));
    const losers = pts.filter((c) => c.profit < 0);
    const rows = pts.map((c, i) => ({ id: `w-${i + 1}`, label: `${i + 1}. ${c.name}`, amounts: [c.gm, -c.cost, c.profit, c.cum, PCT(c.share)], style: c.id === peak.id ? 'subtotal' : undefined, anchor: c.profit >= 0 ? 'peak' : 'tail' }));
    const steps = [
      { row: `w-${pts.indexOf(peak) + 1}`, math: 'peak', label: `The ${pts.indexOf(peak) + 1} profitable customers earn ${P(peak.cum)}, ${PCT(peak.share)} of total profit`, vars: { peak: peak.share } },
      { row: `w-${pts.length}`, math: 'tail', label: `${losers.length} customers lose ${P(-sum(losers.map((c) => c.profit)))}, bringing it back down to ${P(total)}`, vars: { tail: sum(losers.map((c) => c.profit)) }, tone: 'bad' },
    ];
    return clean({ total, peakShare: peak.share, peakCount: pts.indexOf(peak) + 1, losers: losers.length, lossTotal: -sum(losers.map((c) => c.profit)), worst: pts[pts.length - 1].name, worstLoss: -pts[pts.length - 1].profit,
      chart: pts.map((c, i) => ({ x: i + 1, y: 100 * c.share })), rows, trace: toTrace(steps) });
  }

  // ------------------------------------------------------------------ supplier total cost of ownership (slides 55–56, 75)
  function tco({ qty, suppliers, activities }) {
    const sup = suppliers.map((s, j) => {
      const lines = activities.map((a) => a.rate * a.use[j]);
      const hidden = sum(lines);
      const base = s.price * qty;
      return { ...s, lines, hidden, base, total: base + hidden, perUnit: (base + hidden) / qty };
    });
    const rows = [
      { id: 't-price', label: `Purchase price (${C(qty)} units × ${sup.map((s) => P2(s.price)).join(' vs ')})`, amounts: sup.map((s) => s.base), anchor: 'price' },
      ...activities.map((a, i) => ({ id: `t-${a.id}`, label: `${a.name}: ${P(a.rate)} × ${a.driver} (${a.use.map(C).join(' vs ')})`, amounts: sup.map((s) => s.lines[i]), indent: 1, anchor: 'hidden' })),
      { id: 't-hidden', label: 'Hidden activity costs', amounts: sup.map((s) => s.hidden), style: 'subtotal', anchor: 'hidden' },
      { id: 't-total', label: 'Total cost of ownership', amounts: sup.map((s) => s.total), style: 'total', anchor: 'tco' },
      { id: 't-unit', label: 'Total cost of ownership per unit', amounts: sup.map((s) => s.perUnit), anchor: 'tco' },
    ];
    const best = sup.reduce((a, b) => (b.total < a.total ? b : a));
    const cheapest = sup.reduce((a, b) => (b.price < a.price ? b : a));
    const steps = [
      { row: 't-price', math: 'price', label: `On the invoice: ${sup.map((s) => `${s.name} ${P(s.base)}`).join(', ')}`, vars: Object.fromEntries(sup.map((s) => [`price_${s.id}`, s.base])) },
      ...activities.map((a, i) => ({ row: `t-${a.id}`, math: 'hidden', label: `${a.name}: ${sup.map((s, j) => `${C(a.use[j])} × ${P(a.rate)} = ${P(s.lines[i])}`).join(' vs ')}`, vars: Object.fromEntries(sup.map((s) => [`${a.id}_${s.id}`, s.lines[i]])) })),
      { row: 't-hidden', math: 'hidden', label: `Below the waterline: ${sup.map((s) => `${s.name} ${P(s.hidden)}`).join(' vs ')}`, vars: Object.fromEntries(sup.map((s) => [`hidden_${s.id}`, s.hidden])) },
      { row: 't-total', math: 'tco', label: `TCO: ${sup.map((s) => `${s.name} ${P(s.total)}`).join(' vs ')}; per unit ${sup.map((s) => P2(s.perUnit)).join(' vs ')}`, vars: Object.fromEntries(sup.map((s) => [`tco_${s.id}`, s.total])), tone: 'good' },
    ];
    const by = (k) => Object.fromEntries(sup.map((s) => [s.id, s[k]]));
    return clean({ base: by('base'), hidden: by('hidden'), total: by('total'), perUnit: by('perUnit'), best: best.name, cheapest: cheapest.name,
      diff: Math.abs(sup[0].total - sup[1].total), columns: sup.map((s) => s.name), rows, trace: toTrace(steps) });
  }

  // ------------------------------------------------------------------ cycle time, MCE, velocity (slides 61–68, 74)
  function cycleCore({ process, inspect, move, wait, units }) {
    const total = process + inspect + move + wait;
    return { total, nva: inspect + move + wait, mce: process / total, velocity: units ? units / total : null };
  }
  function cycle({ process, inspect, move, wait, units, unit = 'hour' }) {
    const c = cycleCore({ process, inspect, move, wait, units });
    const rows = [
      { id: 'y-p', label: 'Processing (value-added)', amount: process, format: 'number', anchor: 'va' },
      { id: 'y-i', label: 'Inspection', amount: inspect, format: 'number', anchor: 'cycle' },
      { id: 'y-m', label: 'Moving', amount: move, format: 'number', anchor: 'cycle' },
      { id: 'y-w', label: 'Waiting', amount: wait, format: 'number', anchor: 'cycle' },
      { id: 'y-t', label: `Cycle time (${unit}s)`, amount: c.total, format: 'number', style: 'subtotal', anchor: 'cycle' },
      { id: 'y-mce', label: 'Manufacturing cycle efficiency', amount: c.mce, format: 'pct', style: 'total', anchor: 'mce' },
      ...(units ? [{ id: 'y-v', label: `Velocity (units per ${unit})`, amount: c.velocity, format: 'number', anchor: 'velocity' }] : []),
    ];
    const biggest = [['inspection', inspect], ['moving', move], ['waiting', wait]].reduce((a, b) => (b[1] > a[1] ? b : a));
    const steps = [
      { row: 'y-p', math: 'va', label: `Processing, the only value-added time: ${N(process)} ${unit}s`, vars: { process } },
      { row: 'y-t', math: 'cycle', label: `Cycle time: ${N(process)} + ${N(inspect)} + ${N(move)} + ${N(wait)} = ${N(c.total)} ${unit}s`, vars: { cycle: c.total } },
      { row: 'y-mce', math: 'mce', label: `MCE: ${N(process)} ÷ ${N(c.total)} = ${PCT(c.mce)}; the largest waste is ${biggest[0]} (${N(biggest[1])} ${unit}s)`, vars: { mce: c.mce }, tone: c.mce >= 0.5 ? 'good' : 'bad' },
      ...(units ? [{ row: 'y-v', math: 'velocity', label: `Velocity: ${C(units)} ÷ ${N(c.total)} = ${N(c.velocity)} units per ${unit}`, vars: { velocity: c.velocity } }] : []),
    ];
    return clean({ total: c.total, nva: c.nva, mce: c.mce, velocity: c.velocity, nvaShare: 1 - c.mce, biggest: biggest[0], rows, trace: toTrace(steps) });
  }
  function cycleCompare({ before, after, units, unit = 'hour' }) {
    const b = cycleCore({ ...before, units });
    const a = cycleCore({ ...after, units });
    const rows = [
      { id: 'k-p', label: 'Processing', amounts: [before.process, after.process], format: 'number', anchor: 'va' },
      { id: 'k-i', label: 'Inspection', amounts: [before.inspect, after.inspect], format: 'number', anchor: 'cycle' },
      { id: 'k-m', label: 'Moving', amounts: [before.move, after.move], format: 'number', anchor: 'cycle' },
      { id: 'k-w', label: 'Waiting (queue)', amounts: [before.wait, after.wait], format: 'number', anchor: 'cycle' },
      { id: 'k-t', label: `Cycle time (${unit}s)`, amounts: [b.total, a.total], format: 'number', style: 'subtotal', anchor: 'cycle' },
      { id: 'k-mce', label: 'MCE', amounts: [b.mce, a.mce], format: 'pct', style: 'total', anchor: 'mce' },
      ...(units ? [{ id: 'k-v', label: `Velocity (units per ${unit})`, amounts: [b.velocity, a.velocity], format: 'number', anchor: 'velocity' }] : []),
    ];
    const cut = 1 - a.total / b.total;
    const steps = [
      { row: 'k-t', math: 'cycle', label: `Cycle time ${N(b.total)} → ${N(a.total)} ${unit}s (${PCT(cut)} shorter); processing unchanged`, vars: { before: b.total, after: a.total } },
      { row: 'k-mce', math: 'mce', label: `MCE ${PCT(b.mce)} → ${PCT(a.mce)}`, vars: { mceBefore: b.mce, mceAfter: a.mce }, tone: 'good' },
      ...(units ? [{ row: 'k-v', math: 'velocity', label: `Velocity ${N(b.velocity)} → ${N(a.velocity)} units per ${unit} (${N(a.velocity / b.velocity)}×)`, vars: { velBefore: b.velocity, velAfter: a.velocity } }] : []),
    ];
    return clean({ before: b.total, after: a.total, cut, mceBefore: b.mce, mceAfter: a.mce, velBefore: b.velocity, velAfter: a.velocity, speedup: b.total / a.total, rows, trace: toTrace(steps) });
  }

  // ------------------------------------------------------------------ quiz generators
  const nice = (rng, lo, hi, step) => rng.int(Math.ceil(lo / step), Math.floor(hi / step)) * step;
  function mceQ({ rng }) {
    const process = rng.pick([2, 2.5, 3, 3.5, 4]);
    const inspect = rng.pick([0.5, 1, 1.5]);
    const move = rng.pick([0.5, 1, 1.5, 2]);
    const wait = rng.pick([2, 3, 4, 4.5, 5, 6]);
    const c = cycleCore({ process, inspect, move, wait });
    const newWait = Math.max(0.5, wait - rng.pick([1.5, 2, 3]));
    const n = cycleCore({ process, inspect, move, wait: newWait });
    return { vars: { process, inspect, move, wait, total: c.total, mcePct: 100 * c.mce, mce: c.mce, newWait, newTotal: n.total, newMcePct: 100 * n.mce,
      wrongNvaPct: 100 * (1 - c.mce), wrongWaitOnly: (100 * process) / (process + wait) },
      misconceptions: [
        { var: 'wrongNvaPct', feedback: 'That is the non-value-added share. MCE is value-added (processing) time ÷ cycle time.' },
        { var: 'wrongWaitOnly', feedback: 'Cycle time includes inspection and moving time too.' },
      ] };
  }
  function velocityQ({ rng }) {
    const units = rng.pick([50, 60, 100, 120, 200, 240]);
    const before = { process: rng.pick([1, 2, 3]), inspect: rng.pick([0.5, 1]), move: rng.pick([0.5, 1, 1.5]), wait: rng.pick([3.5, 4.5, 5, 6.5]) };
    const after = { ...before, move: before.move / 2, wait: before.wait - rng.pick([2, 2.5, 3]) };
    const b = cycleCore({ ...before, units });
    const a = cycleCore({ ...after, units });
    return { vars: { units, ...Object.fromEntries(Object.entries(before).map(([k, v]) => [`b_${k}`, v])), a_move: after.move, a_wait: after.wait,
      before: b.total, after: a.total, velBefore: b.velocity, velAfter: a.velocity, speedup: b.total / a.total, cutPct: 100 * (1 - a.total / b.total) },
      misconceptions: [
        { var: 'velBefore', feedback: 'That is the velocity before the change.' },
        { value: units / after.process, feedback: 'Velocity divides by the whole cycle time, not processing time alone.' },
      ] };
  }
  function customerQ({ rng }) {
    for (;;) {
      const oRate = rng.pick([50, 80, 100, 120]);
      const dRate = rng.pick([150, 200, 250, 300]);
      const gm = nice(rng, 100000, 250000, 10000);
      const orders = nice(rng, 600, 1400, 100);
      const dels = nice(rng, 400, 1000, 100);
      const newOrders = Math.round(orders * rng.pick([0.2, 0.25, 0.3]) / 10) * 10;
      const newDels = Math.round(dels * rng.pick([0.25, 0.3, 0.4]) / 10) * 10;
      const cost = orders * oRate + dels * dRate;
      const newCost = newOrders * oRate + newDels * dRate;
      if (gm - cost >= 0 || gm - newCost <= 0) continue;
      return { vars: { oRate, dRate, gm, orders, dels, newOrders, newDels, cost, newCost, profit: gm - cost, newProfit: gm - newCost, swing: cost - newCost,
        rows: [
          { label: 'Gross margin', amounts: [gm, gm] },
          { label: `Order processing (₱${oRate} per order)`, amounts: [orders * oRate, newOrders * oRate], indent: 1, blank: true },
          { label: `Delivery (₱${dRate} per delivery)`, amounts: [dels * dRate, newDels * dRate], indent: 1, blank: true },
          { label: 'Cost to serve', amounts: [cost, newCost], style: 'subtotal', blank: true },
          { label: 'Operating profit', amounts: [gm - cost, gm - newCost], style: 'total', blank: true },
        ] },
        misconceptions: [
          { value: gm - cost, feedback: 'That is the profit before consolidation.' },
          { value: newCost, feedback: 'That is the new cost to serve; subtract it from the gross margin.' },
        ] };
    }
  }
  function tcoQ({ rng }) {
    for (;;) {
      const qty = rng.pick([1000, 2000, 5000]);
      const pA = rng.pick([40, 50, 95, 120]);
      const pB = pA + rng.pick([3, 5, 8]);
      const acts = [
        { id: 'receiving', name: 'Receiving', rate: rng.pick([300, 500, 800]), driver: 'deliveries', use: [rng.pick([10, 12, 20]), rng.pick([4, 5, 6])] },
        { id: 'inspection', name: 'Inspection', rate: rng.pick([5, 8, 10]), driver: 'units checked', use: [qty, qty / 10] },
        { id: 'rework', name: 'Rework', rate: rng.pick([100, 120, 150]), driver: 'defects', use: [qty * rng.pick([0.03, 0.05]), qty * 0.005] },
        { id: 'expediting', name: 'Expediting', rate: rng.pick([1000, 1500, 2000]), driver: 'rush orders', use: [rng.pick([2, 3, 4]), 0] },
      ];
      const r = tco({ qty, suppliers: [{ id: 'A', name: 'Supplier A', price: pA }, { id: 'B', name: 'Supplier B', price: pB }], activities: acts });
      if (!(r.total.A > r.total.B)) continue;
      const per = { deliveries: 'delivery', 'units checked': 'unit checked', defects: 'defect', 'rush orders': 'rush order' };
      const table = acts.map((a) => `| ${a.name} | ${P(a.rate)} per ${per[a.driver]} | ${C(a.use[0])} | ${C(a.use[1])} |`).join('\n');
      return { vars: { qty, pA, pB, table, tcoA: r.total.A, tcoB: r.total.B, unitA: r.perUnit.A, unitB: r.perUnit.B, hiddenA: r.hidden.A, hiddenB: r.hidden.B, diff: r.total.A - r.total.B,
        wrongPriceOnly: pA * qty, wrongHiddenOnly: r.hidden.A,
        rows: r.rows.filter((x) => x.id !== 't-unit').map((x) => clean({ label: x.label.replace(/:.*$/, ''), amounts: x.amounts, indent: x.indent, style: x.style, blank: x.id !== 't-price' || undefined })) },
        misconceptions: [
          { var: 'wrongPriceOnly', feedback: 'That is only the invoice price. Add the hidden activity costs.' },
          { var: 'wrongHiddenOnly', feedback: 'Those are only the hidden costs. Add the purchase price.' },
        ] };
    }
  }
  function defectQ({ rng }) {
    const units = nice(rng, 50000, 300000, 10000);
    const price = rng.pick([12, 15, 18, 20, 25]);
    const oldRate = rng.pick([0.01, 0.02]);
    const newRate = oldRate + rng.pick([0.02, 0.03]);
    const rework = rng.pick([100, 120, 150, 200]);
    const rush = rng.pick([1, 2, 3]);
    const rushCost = rng.pick([20000, 40000, 50000]);
    const base = units * price;
    const tcoOld = base + units * oldRate * rework;
    const tcoNew = base + units * newRate * rework + rush * rushCost;
    return { vars: { units, price, oldPct: 100 * oldRate, newPct: 100 * newRate, rework, rush, rushCost, base, tcoOld, tcoNew, increase: tcoNew - tcoOld, increasePct: (100 * (tcoNew - tcoOld)) / tcoOld,
        rows: [
          { label: 'Purchase price', amounts: [base, base] },
          { label: 'Rework of defective units', amounts: [units * oldRate * rework, units * newRate * rework], indent: 1, blank: true },
          { label: 'Rush replacement shipments', amounts: [0, rush * rushCost], indent: 1, blank: true },
          { label: 'Total cost of ownership', amounts: [tcoOld, tcoNew], style: 'total', blank: true },
        ] },
      misconceptions: [
        { value: base + units * newRate * rework, feedback: 'Add the rush replacement shipments too.' },
        { value: units * newRate * rework + rush * rushCost, feedback: 'Total cost of ownership includes the purchase price.' },
      ] };
  }
  function setupQ({ rng }) {
    for (;;) {
    const cost = rng.pick([500, 800, 1000, 1200, 1500]);
    const unitsA = nice(rng, 10000, 30000, 5000);
    const setupsA = nice(rng, 400, 1000, 100);
    const unitsB = unitsA * rng.pick([3, 4, 5]);
    const setupsB = nice(rng, 50, 200, 50);
    const perA = (setupsA * cost) / unitsA;
    const perB = (setupsB * cost) / unitsB;
    if ([perA, perB].some((v) => Math.abs(v * 100 - Math.round(v * 100)) > 1e-6)) continue;
    return { vars: { cost, unitsA, setupsA, unitsB, setupsB, perA, perB, batchA: unitsA / setupsA, batchB: unitsB / setupsB, gap: perA - perB, wrongTotal: setupsA * cost,
        rows: [
          { label: 'Setups per year', amounts: [setupsA, setupsB], format: 'units' },
          { label: 'Units per year', amounts: [unitsA, unitsB], format: 'units' },
          { label: `Setup cost at ₱${C(cost)} per setup`, amounts: [setupsA * cost, setupsB * cost], blank: true },
          { label: 'Setup cost per unit', amounts: [perA, perB], style: 'total', blank: true },
        ] },
      misconceptions: [
        { var: 'wrongTotal', feedback: 'That is the total setup cost; divide by the units produced.' },
        { value: cost / unitsA, feedback: 'Multiply the cost per setup by the number of setups first.' },
      ] };
    }
  }
  function growthQ({ rng }) {
    const before = nice(rng, 100000, 600000, 50000);
    const g = rng.pick([0.05, 0.1, 0.15, 0.2]);
    const mult = rng.pick([1.8, 2, 2.5, 3]);
    const after = before * mult;
    const expected = before * (1 + g);
    return { vars: { before, after, gPct: 100 * g, expected, unexplained: after - expected, wrongTotalInc: after - before },
      misconceptions: [
        { var: 'wrongTotalInc', feedback: 'That is the whole increase. Volume growth explains part of it; subtract that part.' },
        { value: before * g, feedback: 'That is the increase volume explains; the question asks for what it does not.' },
      ] };
  }

  return {
    fns: { classify, setups, costGrowth, customers, whale, tco, cycle, cycleCompare },
    generators: { mceQ, velocityQ, customerQ, tcoQ, defectQ, setupQ, growthQ },
  };
}
