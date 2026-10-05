export default function register(sdk) {
  const { fmt, sum } = sdk;
  const P = (x) => fmt(x, 'money');
  const P2 = (x) => fmt(x, 'money2');
  const C = (x) => fmt(x, 'comma');
  const PCT = (x) => fmt(x, 'pct1').replace('.0%', '%');
  const r2 = (x) => Math.round(x * 100) / 100;

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
  function keysOf(s) { return s.reveal ?? (s.row ? [s.row] : []); }
  function reveal(rows, steps, upTo) {
    if (upTo === undefined || upTo === null) return rows;
    const pending = new Set();
    steps.forEach((s, i) => { if (i >= upTo) keysOf(s).forEach((k) => pending.add(k)); });
    steps.slice(0, upTo).forEach((s) => keysOf(s).forEach((k) => pending.delete(k)));
    return rows.map((r) => {
      if (!r.id) return r;
      const out = { ...r };
      if (Array.isArray(out.amounts)) out.amounts = out.amounts.map((v, j) => (pending.has(r.id) || pending.has(`${r.id}:${j}`) ? null : v));
      else if ('amount' in out && pending.has(r.id)) out.amount = null;
      return out;
    });
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
  function toWalk(steps, key, role) {
    return steps.map((s, i) => clean({
      label: s.label, vars: s.vars ?? {}, patch: { [key]: i + 1 },
      ops: s.row ? [{ role: s.role ?? role, cmd: 'highlight', args: { sel: `row:${s.row}`, tone: s.tone ?? 'accent' } }] : [],
    }));
  }
  const totalOf = (p) => p.total ?? sum(p.use);
  const withRates = (pools) => pools.map((p) => ({ ...p, total: totalOf(p), rate: p.cost / totalOf(p) }));
  const rateText = (p) => `${P(p.rate)} per ${p.driver.replace(/s$/, '').replace(/^lb of .*/, 'lb')}`;

  // ------------------------------------------------------------------ Step 2: activity rates (Global Metals, slides 27–28)
  function rates({ pools }) {
    const R = withRates(pools);
    const total = sum(R.map((p) => p.cost));
    const rows = R.map((p) => ({ id: `rate-${p.id}`, label: p.name, amounts: [p.cost, `${C(p.total)} ${p.driver}`, P(p.rate)], anchor: 'rate' }))
      .concat([{ id: 'rate-total', label: 'Total budgeted overhead', amounts: [total, '', ''], style: 'total', anchor: 'pool' }]);
    const steps = [
      ...R.map((p) => ({ row: `rate-${p.id}`, math: 'rate', label: `${p.name}: ${C(p.cost)} ÷ ${C(p.total)} ${p.driver} = ${rateText(p)}`, vars: { [`rate_${p.id}`]: p.rate } })),
      { row: 'rate-total', math: 'pool', label: `The pools add up to ${P(total)} of overhead`, vars: { total }, tone: 'good' },
    ];
    return clean({ total, rates: Object.fromEntries(R.map((p) => [p.id, p.rate])), rows, trace: toTrace(steps) });
  }

  // ------------------------------------------------------------------ Step 3: a job's overhead, and the plantwide comparison (slides 29–31, 68–69, 74–75)
  function jobCore({ pools, job, totalMH }) {
    const R = withRates(pools);
    const lines = R.map((p, i) => ({ ...p, used: job.use[i], amount: p.rate * job.use[i] }));
    const abcTotal = sum(lines.map((l) => l.amount));
    const abcUnit = abcTotal / job.units;
    const pool = sum(R.map((p) => p.cost));
    const plant = totalMH ? { rate: pool / totalMH } : null;
    if (plant) { plant.oh = plant.rate * job.mh; plant.unit = plant.oh / job.units; plant.gap = abcTotal - plant.oh; }
    const ul = job.unitLabel ?? 'units';
    const rows = [
      ...lines.map((l) => ({ id: `use-${l.id}`, label: `${l.name}: ${C(l.used)} ${l.driver} × ${P(l.rate)}`, amount: l.amount, anchor: 'assign' })),
      { id: 'abc-total', label: 'Total overhead assigned (ABC)', amount: abcTotal, style: 'subtotal', anchor: 'total' },
      { id: 'abc-unit', label: `Overhead per ${ul.replace(/s$/, '')} (÷ ${C(job.units)} ${ul})`, amount: abcUnit, style: 'total', anchor: 'unit' },
    ];
    const plantRows = plant ? [
      { id: 'plant-rate', label: `Plantwide rate: ${C(pool)} ÷ ${C(totalMH)} MH`, amount: plant.rate, anchor: 'plant' },
      { id: 'plant-oh', label: `Overhead assigned: ${C(job.mh)} MH × ${P2(plant.rate)}`, amount: plant.oh, anchor: 'plant' },
      { id: 'plant-unit', label: `Overhead per ${ul.replace(/s$/, '')}`, amount: plant.unit, style: 'subtotal', anchor: 'plant' },
      { id: 'gap', label: 'ABC minus plantwide (undercosting by the single rate)', amount: plant.gap, style: 'total', anchor: 'gap' },
    ] : [];
    const steps = [
      ...lines.map((l) => ({ row: `use-${l.id}`, role: 'sheet', math: 'assign', label: `${l.name}: ${C(l.used)} × ${P(l.rate)} = ${P(l.amount)}`, vars: { [`oh_${l.id}`]: l.amount } })),
      { row: 'abc-total', role: 'sheet', math: 'total', label: `Total: ${lines.map((l) => C(l.amount)).join(' + ')} = ${P(abcTotal)}`, vars: { abcTotal } },
      { row: 'abc-unit', role: 'sheet', math: 'unit', label: `Per ${ul.replace(/s$/, '')}: ${C(abcTotal)} ÷ ${C(job.units)} = ${P2(abcUnit)}`, vars: { abcUnit }, tone: 'good' },
      ...(plant ? [
        { row: 'plant-rate', role: 'plant', math: 'plant', label: `One rate instead: ${C(pool)} ÷ ${C(totalMH)} = ${P2(plant.rate)} per MH`, vars: { plantRate: plant.rate } },
        { row: 'plant-oh', role: 'plant', reveal: ['plant-oh', 'plant-unit'], math: 'plant', label: `${C(job.mh)} MH × ${P2(plant.rate)} = ${P(plant.oh)}, ${P2(plant.unit)} per ${ul.replace(/s$/, '')}`, vars: { plantOH: plant.oh, plantUnit: plant.unit } },
        { row: 'gap', role: 'plant', math: 'gap', label: `The single rate misses ${P(plant.gap)} of this job's overhead`, vars: { gap: plant.gap }, tone: 'bad' },
      ] : []),
    ];
    return { lines, abcTotal, abcUnit, plant, rows, plantRows, steps };
  }
  // roles: journal, formula, code
  function job(args) {
    const r = jobCore(args);
    return clean({ abcTotal: r.abcTotal, abcUnit: r.abcUnit, plantRate: r.plant?.rate, plantOH: r.plant?.oh, plantUnit: r.plant?.unit, gap: r.plant?.gap,
      assigned: Object.fromEntries(r.lines.map((l) => [l.id, l.amount])), rows: r.rows, plantRows: r.plantRows, trace: toTrace(r.steps) });
  }
  function jobSheet(args) {
    const r = jobCore(args);
    const all = reveal([...r.rows, ...r.plantRows], r.steps, args.upTo);
    return clean({ rows: all.slice(0, r.rows.length), plantRows: all.slice(r.rows.length), abcTotal: r.abcTotal, abcUnit: r.abcUnit, gap: r.plant?.gap });
  }
  // roles: sheet, plant
  function jobWalk(args) {
    const r = jobCore(args);
    return clean({ steps: r.steps.length, abcTotal: r.abcTotal, trace: toWalk(r.steps, 'sheetUpTo', 'sheet') });
  }
  // Pick a Global Metals job by key (Choice in a section)
  function pickJob({ pools, jobs, key, totalMH }) {
    return job({ pools, job: jobs[key], totalMH });
  }

  // ------------------------------------------------------------------ Traditional vs ABC for several products (Laguna, slides 35–37; the caselets)
  function compareCore({ products, pools, baseLabel, unitLabel }) {
    const R = withRates(pools);
    const totalOH = sum(R.map((p) => p.cost));
    const hasBase = products.every((p) => p.base !== undefined);
    const totalBase = hasBase ? sum(products.map((p) => p.base)) : null;
    const tradRate = hasBase ? totalOH / totalBase : null;
    const prod = products.map((p, j) => {
      const lines = R.map((a) => ({ id: a.id, amount: a.rate * a.use[j] }));
      const abcTotal = sum(lines.map((l) => l.amount));
      const direct = (p.dm ?? 0) + (p.dl ?? 0);
      const tradTotal = hasBase ? p.base * tradRate : null;
      const o = { ...p, lines, abcTotal, abcOH: abcTotal / p.units, direct, tradTotal, tradOH: hasBase ? tradTotal / p.units : null };
      o.abcCost = direct + o.abcOH;
      o.tradCost = hasBase ? direct + o.tradOH : null;
      if (p.price !== undefined) { o.abcMargin = (p.price - o.abcCost) / p.price; o.tradMargin = hasBase ? (p.price - o.tradCost) / p.price : null; }
      o.diff = hasBase ? o.tradOH - o.abcOH : null; // + = traditional overcosts
      return o;
    });
    const hasDirect = prod.some((p) => p.direct > 0);
    const hasPrice = prod.every((p) => p.price !== undefined);
    const ul = unitLabel ?? 'unit';
    const rateRows = [
      ...(hasBase ? [{ id: 'trad-rate', label: `Single rate: ${C(totalOH)} ÷ ${C(totalBase)} ${baseLabel}`, amounts: [totalOH, `${C(totalBase)} ${baseLabel}`, P(tradRate)], anchor: 'trad' }] : []),
      ...R.map((a) => ({ id: `rate-${a.id}`, label: `ABC, ${a.name}`, amounts: [a.cost, `${C(a.total)} ${a.driver}`, P(a.rate)], anchor: 'rate' })),
    ];
    const assignRows = [
      ...R.map((a, i) => ({ id: `as-${a.id}`, label: `${a.name} @ ${P2(a.rate)}`, amounts: prod.map((p) => p.lines[i].amount), anchor: 'assign' })),
      { id: 'as-total', label: 'Overhead assigned (ABC)', amounts: prod.map((p) => p.abcTotal), style: 'subtotal', anchor: 'assign' },
      { id: 'as-units', label: `Volume (${ul}s)`, amounts: prod.map((p) => p.units), format: 'units', anchor: 'assign' },
      { id: 'as-unit', label: `ABC overhead per ${ul}`, amounts: prod.map((p) => p.abcOH), style: 'total', anchor: 'abc' },
    ];
    const costRows = [
      ...(hasBase ? [{ id: 'c-trad', label: `Traditional overhead per ${ul}`, amounts: prod.map((p) => p.tradOH), anchor: 'trad' }] : []),
      { id: 'c-abc', label: `ABC overhead per ${ul}`, amounts: prod.map((p) => p.abcOH), anchor: 'abc' },
      ...(hasBase ? [{ id: 'c-diff', label: 'Traditional minus ABC (+ overcosted, − undercosted)', amounts: prod.map((p) => p.diff), style: 'subtotal', anchor: 'diff' }] : []),
      ...(hasDirect ? [
        { id: 'c-direct', label: 'Direct costs per unit', amounts: prod.map((p) => p.direct), anchor: 'full' },
        ...(hasBase ? [{ id: 'c-tradfull', label: 'Full cost, traditional', amounts: prod.map((p) => p.tradCost), anchor: 'full' }] : []),
        { id: 'c-abcfull', label: 'Full cost, ABC', amounts: prod.map((p) => p.abcCost), style: 'total', anchor: 'full' },
      ] : []),
      ...(hasPrice ? [
        { id: 'c-price', label: 'Price', amounts: prod.map((p) => p.price), anchor: 'margin' },
        ...(hasBase ? [{ id: 'c-tradm', label: 'Margin, traditional', amounts: prod.map((p) => p.tradMargin), format: 'pct', anchor: 'margin' }] : []),
        { id: 'c-abcm', label: 'Margin, ABC', amounts: prod.map((p) => p.abcMargin), format: 'pct', style: 'total', anchor: 'margin' },
      ] : []),
    ];
    const over = prod.filter((p) => p.diff > 1e-9).map((p) => p.name);
    const under = prod.filter((p) => p.diff < -1e-9).map((p) => p.name);
    const steps = [
      ...(hasBase ? [{ row: 'trad-rate', role: 'rates', math: 'trad', label: `Single rate: ${C(totalOH)} ÷ ${C(totalBase)} = ${P2(tradRate)} per ${baseLabel.replace(/s$/, '')}`, vars: { tradRate } }] : []),
      ...R.map((a) => ({ row: `rate-${a.id}`, role: 'rates', math: 'rate', label: `${a.name}: ${C(a.cost)} ÷ ${C(a.total)} = ${P2(a.rate)} per ${a.driver.replace(/s$/, '')}`, vars: { [`rate_${a.id}`]: a.rate } })),
      { row: 'as-total', role: 'assign', reveal: [...R.map((a) => `as-${a.id}`), 'as-total', 'as-units'], math: 'assign', label: `Overhead each uses: ${prod.map((p) => `${p.name} ${P(p.abcTotal)}`).join('; ')}`, vars: Object.fromEntries(prod.map((p) => [`oh_${p.id}`, p.abcTotal])) },
      { row: 'as-unit', role: 'assign', math: 'abc', label: `Per ${ul}: ${prod.map((p) => `${p.name} ${P2(p.abcOH)}`).join('; ')}`, vars: Object.fromEntries(prod.map((p) => [`abc_${p.id}`, p.abcOH])) },
      ...(hasBase ? [
        { row: 'c-trad', role: 'cost', reveal: ['c-trad', 'c-abc'], math: 'trad', label: `Traditional per ${ul}: ${prod.map((p) => `${p.name} ${P2(p.tradOH)}`).join('; ')}`, vars: Object.fromEntries(prod.map((p) => [`trad_${p.id}`, p.tradOH])) },
        { row: 'c-diff', role: 'cost', math: 'diff', label: `${over.length ? `Overcosted: ${over.join(', ')}` : ''}${over.length && under.length ? '. ' : ''}${under.length ? `Undercosted: ${under.join(', ')}` : ''}`, vars: Object.fromEntries(prod.map((p) => [`diff_${p.id}`, p.diff])), tone: 'bad' },
      ] : [{ row: 'c-abc', role: 'cost', math: 'abc', label: `ABC cost per ${ul} compared`, vars: { lines: prod.length } }]),
      ...(hasDirect ? [{ row: 'c-abcfull', role: 'cost', reveal: ['c-direct', 'c-tradfull', 'c-abcfull'], math: 'full', label: `Full cost (direct + overhead): ${prod.map((p) => `${p.name} ${P2(p.abcCost)}`).join('; ')}`, vars: Object.fromEntries(prod.map((p) => [`full_${p.id}`, p.abcCost])) }] : []),
      ...(hasPrice ? [{ row: 'c-abcm', role: 'cost', reveal: ['c-price', 'c-tradm', 'c-abcm'], math: 'margin', label: `ABC margins: ${prod.map((p) => `${p.name} ${PCT(p.abcMargin)}`).join('; ')}`, vars: Object.fromEntries(prod.map((p) => [`margin_${p.id}`, p.abcMargin])), tone: 'good' }] : []),
    ];
    return { R, totalOH, totalBase, tradRate, prod, columns: prod.map((p) => p.name), rateRows, assignRows, costRows, steps, over, under, hasBase };
  }
  function compareOut(x) {
    const by = (k) => Object.fromEntries(x.prod.map((p) => [p.id, p[k]]));
    return {
      totalOH: x.totalOH, tradRate: x.tradRate, rates: Object.fromEntries(x.R.map((a) => [a.id, a.rate])),
      abcOH: by('abcOH'), tradOH: by('tradOH'), abcTotal: by('abcTotal'), abcCost: by('abcCost'), tradCost: by('tradCost'), abcMargin: by('abcMargin'), tradMargin: by('tradMargin'), diff: by('diff'),
      overTxt: x.over.join(', ') || 'none', underTxt: x.under.join(', ') || 'none',
      columns: x.columns, rateColumns: ['Pool cost', 'Driver total', 'Rate'], rateRows: x.rateRows, assignRows: x.assignRows, costRows: x.costRows,
    };
  }
  // roles: journal, formula, code
  function compare(args) {
    const x = compareCore(args);
    return clean({ ...compareOut(x), trace: toTrace(x.steps) });
  }
  function compareSheet(args) {
    const x = compareCore(args);
    const all = reveal([...x.rateRows, ...x.assignRows, ...x.costRows], x.steps, args.upTo);
    const a = x.rateRows.length;
    const b = a + x.assignRows.length;
    return clean({ ...compareOut(x), rateRows: all.slice(0, a), assignRows: all.slice(a, b), costRows: all.slice(b) });
  }
  // roles: rates, assign, cost
  function compareWalk(args) {
    const x = compareCore(args);
    return clean({ steps: x.steps.length, totalOH: x.totalOH, trace: toWalk(x.steps, 'sheetUpTo', 'rates') });
  }
  // Trad vs ABC for one costing system at a time (a Choice flips it)
  function compareView({ products, pools, baseLabel, unitLabel, system }) {
    const x = compareCore({ products, pools, baseLabel, unitLabel });
    const abc = system === 'abc';
    return clean({
      columns: ['Overhead per unit', 'Full cost per unit'],
      rows: x.prod.map((p) => ({ id: `v-${p.id}`, label: p.name, amounts: [abc ? p.abcOH : p.tradOH, abc ? p.abcCost : p.tradCost] })),
      total: sum(x.prod.map((p) => (abc ? p.abcTotal : p.tradTotal))),
      label: abc ? 'activity-based costing' : `one rate per ${baseLabel.replace(/s$/, '')}`,
    });
  }
  // One caselet from the workbook, picked by id
  // Product-by-row layout with fixed columns, so any number of products fits one schedule.
  function caselet({ caselets, id }) {
    const c = caselets.find((x) => x.id === id) ?? caselets[0];
    const x = compareCore(c);
    const pct = (v) => (v === null || v === undefined ? '' : PCT(v));
    const productAssignRows = x.prod.map((p) => ({ id: `pa-${p.id}`, label: p.name, amounts: [p.abcTotal, `${C(p.units)}`, p.abcOH], anchor: 'assign' }));
    const productRows = x.prod.map((p) => ({ id: `pc-${p.id}`, label: p.name, amounts: [p.tradOH, p.abcOH, p.diff, p.direct ? p.tradCost : '', p.direct ? p.abcCost : '', pct(p.tradMargin), pct(p.abcMargin)], anchor: 'diff' }));
    const remap = { abc: 'assign', full: 'diff', margin: 'diff' };
    const steps = x.steps.map((st) => ({ ...st, math: remap[st.math] ?? st.math, row: undefined }));
    return clean({ title: c.title, sector: c.sector, level: c.level, baseLabel: c.baseLabel, ...compareOut(x), productAssignRows, productRows, trace: toTrace(steps) });
  }

  // ------------------------------------------------------------------ The distortion spectrum (Pangasinan, slides 43–44)
  function distortion({ products }) {
    const rows = products.map((p, i) => ({ id: `d-${i + 1}`, label: `${p.name} (${p.volume.toLowerCase()} volume)`, amounts: [p.trad, p.abc, p.trad - p.abc, PCT((p.trad - p.abc) / p.trad)], anchor: p.trad >= p.abc ? 'over' : 'under' }));
    const steps = products.map((p, i) => ({
      row: `d-${i + 1}`, math: p.trad >= p.abc ? 'over' : 'under',
      label: `${p.name}: ${P2(p.trad)} − ${P2(p.abc)} = ${P2(p.trad - p.abc)} (${PCT(Math.abs(p.trad - p.abc) / p.trad)} of its traditional cost) → ${p.trad > p.abc ? 'overcosted' : 'undercosted'}`,
      vars: { [`diff_${i + 1}`]: p.trad - p.abc }, tone: Math.abs(p.trad - p.abc) / p.abc < 0.05 ? 'good' : 'bad',
    }));
    return clean({
      diffs: products.map((p) => p.trad - p.abc), pctOfTrad: products.map((p) => (p.trad - p.abc) / p.trad), pctOfAbc: products.map((p) => (p.trad - p.abc) / p.abc),
      columns: ['Traditional', 'ABC', 'Traditional − ABC', '% of traditional'], rows, trace: toTrace(steps),
    });
  }

  // ------------------------------------------------------------------ The cost hierarchy (slides 39–42), on a caselet with level tags
  const LEVELS = [
    { id: 'unit', name: 'Unit-level' }, { id: 'batch', name: 'Batch-level' }, { id: 'product', name: 'Product-level' }, { id: 'facility', name: 'Facility-level' },
  ];
  function hierarchy({ pools, facility = 0, caselets, id }) {
    const R = withRates(pools ?? (caselets.find((c) => c.id === id) ?? caselets[0]).pools);
    const byLevel = LEVELS.map((l) => ({ ...l, pools: R.filter((p) => p.level === l.id), cost: sum(R.filter((p) => p.level === l.id).map((p) => p.cost)) + (l.id === 'facility' ? facility : 0) }));
    const total = sum(byLevel.map((l) => l.cost));
    const rows = byLevel.map((l) => ({
      id: `lv-${l.id}`, label: `${l.name}: ${l.pools.map((p) => `${p.name} (per ${p.driver.replace(/s$/, '')})`).join(', ') || (l.id === 'facility' && facility ? 'plant administration, left unallocated' : 'none')}`,
      amount: l.cost, anchor: l.id,
    })).concat([{ id: 'lv-total', label: 'Total overhead', amount: total, style: 'total' }]);
    const nonVolume = sum(byLevel.filter((l) => l.id !== 'unit').map((l) => l.cost));
    const steps = byLevel.map((l) => ({ row: `lv-${l.id}`, math: l.id, label: `${l.name}: ${P(l.cost)}`, vars: { [l.id]: l.cost } }));
    return clean({ total, nonVolume, nonVolumeShare: nonVolume / total, byLevel: Object.fromEntries(byLevel.map((l) => [l.id, l.cost])), rows, trace: toTrace(steps) });
  }

  // ------------------------------------------------------------------ Customer profitability (Rizal, slides 70–71)
  function customerCore({ pools, customers }) {
    const R = pools.map((p, i) => { const total = sum(customers.map((c) => c.use[i])); return { ...p, total, rate: p.cost / total }; });
    const cust = customers.map((c) => {
      const lines = R.map((p, i) => p.rate * c.use[i]);
      const cost = sum(lines);
      return { ...c, lines, cost, profit: c.gm - cost };
    });
    const byGm = [...cust].sort((a, b) => b.gm - a.gm).map((c) => c.id);
    const byProfit = [...cust].sort((a, b) => b.profit - a.profit).map((c) => c.id);
    const rows = [
      ...R.map((p) => ({ id: `cr-${p.id}`, label: `${p.name}: ${C(p.cost)} ÷ ${C(p.total)} ${p.driver}`, amounts: cust.map(() => null).concat([p.rate]), anchor: 'rate' })),
      { id: 'c-gm', label: 'Gross margin', amounts: cust.map((c) => c.gm).concat([sum(cust.map((c) => c.gm))]), anchor: 'gm' },
      ...R.map((p, i) => ({ id: `c-${p.id}`, label: `Less ${p.name.toLowerCase()} @ ${P(p.rate)}`, amounts: cust.map((c) => -c.lines[i]).concat([-p.cost]), indent: 1, anchor: 'assign' })),
      { id: 'c-profit', label: 'Operating profit', amounts: cust.map((c) => c.profit).concat([sum(cust.map((c) => c.profit))]), style: 'total', anchor: 'profit' },
    ];
    const worst = cust.reduce((a, b) => (b.profit < a.profit ? b : a));
    const steps = [
      ...R.map((p) => ({ row: `cr-${p.id}`, math: 'rate', label: `${p.name}: ${C(p.cost)} ÷ ${C(p.total)} = ${P(p.rate)} per ${p.driver.replace(/s$/, '').replace(/ie$/, 'y')}`, vars: { [`rate_${p.id}`]: p.rate } })),
      ...R.map((p, i) => ({ row: `c-${p.id}`, math: 'assign', label: `${p.name} assigned: ${cust.map((c) => `${c.id} ${P(c.lines[i])}`).join('; ')}`, vars: Object.fromEntries(cust.map((c) => [`${p.id}_${c.id}`, c.lines[i]])) })),
      { row: 'c-profit', math: 'profit', label: `Operating profit: ${cust.map((c) => `${c.id} ${P(c.profit)}`).join('; ')}. ${worst.name} ${worst.profit < 0 ? 'loses money' : 'earns least'}.`, vars: Object.fromEntries(cust.map((c) => [`profit_${c.id}`, c.profit])), tone: worst.profit < 0 ? 'bad' : 'good' },
    ];
    return { R, cust, byGm, byProfit, worst, rows, steps };
  }
  // roles: journal, formula, code
  function customers(args) {
    const x = customerCore(args);
    return clean({
      rates: Object.fromEntries(x.R.map((p) => [p.id, p.rate])), cost: Object.fromEntries(x.cust.map((c) => [c.id, c.cost])), profit: Object.fromEntries(x.cust.map((c) => [c.id, c.profit])),
      rankGm: x.byGm.join(' > '), rankProfit: x.byProfit.join(' > '), worst: x.worst.name,
      columns: [...x.cust.map((c) => c.name), 'Total / rate'], rows: x.rows, trace: toTrace(x.steps),
    });
  }

  // ------------------------------------------------------------------ The application case: a bid priced two ways
  function bid({ products, pools, bid: b }) {
    const x = compareCore({ products, pools, baseLabel: 'machine hours' });
    const R = x.R;
    const lines = R.map((p, i) => ({ ...p, used: b.use[i], amount: p.rate * b.use[i] }));
    const abcOH = sum(lines.map((l) => l.amount));
    const tradOH = b.use[0] * x.tradRate;
    const direct = b.dm + b.dl;
    const abcUnit = direct + abcOH / b.units;
    const tradUnit = direct + tradOH / b.units;
    const rows = [
      { id: 'b-direct', label: 'Direct materials and labor per unit', amounts: [direct, direct], anchor: 'cost' },
      { id: 'b-oh', label: 'Overhead per unit', amounts: [tradOH / b.units, abcOH / b.units], anchor: 'cost' },
      { id: 'b-cost', label: 'Full cost per unit', amounts: [tradUnit, abcUnit], style: 'subtotal', anchor: 'cost' },
      { id: 'b-quote', label: `Quote at cost + ${PCT(b.markup)}`, amounts: [tradUnit * (1 + b.markup), abcUnit * (1 + b.markup)], style: 'total', anchor: 'quote' },
      { id: 'b-comp', label: `Profit per unit at the competitor's ${P(b.competitor)}`, amounts: [b.competitor - tradUnit, b.competitor - abcUnit], anchor: 'quote' },
    ];
    return clean({ tradOH, abcOH, tradUnit, abcUnit, tradQuote: tradUnit * (1 + b.markup), abcQuote: abcUnit * (1 + b.markup), compProfit: b.competitor - abcUnit,
      lineRows: lines.map((l) => ({ id: `bl-${l.id}`, label: `${l.name}: ${C(l.used)} ${l.driver} × ${P(l.rate)}`, amount: l.amount })).concat([{ id: 'bl-total', label: 'Overhead for the order (ABC)', amount: abcOH, style: 'total' }]),
      columns: ['Single MH rate', 'ABC'], rows });
  }

  // ------------------------------------------------------------------ quiz generators
  const nice = (rng, lo, hi, step) => rng.int(Math.ceil(lo / step), Math.floor(hi / step)) * step;
  const DRIVERS = [
    { name: 'Machine setups', driver: 'setups', rates: [250, 400, 500, 800, 1000, 1200], tot: [100, 1500] },
    { name: 'Quality inspections', driver: 'inspections', rates: [50, 60, 75, 100, 150], tot: [500, 4000] },
    { name: 'Material handling', driver: 'material moves', rates: [20, 40, 50, 120], tot: [1000, 6000] },
    { name: 'Purchase orders', driver: 'orders', rates: [30, 45, 60, 80], tot: [1000, 8000] },
    { name: 'Engineering changes', driver: 'change orders', rates: [500, 800, 1000, 1500], tot: [50, 500] },
    { name: 'Machining', driver: 'machine hours', rates: [8, 10, 12, 15, 20], tot: [10000, 60000] },
  ];
  function randomPools(rng, n) {
    return rng.sample(DRIVERS, n).map((d, i) => {
      const rate = rng.pick(d.rates);
      const total = nice(rng, d.tot[0], d.tot[1], d.tot[0] >= 1000 ? 100 : 10);
      return { id: `p${i + 1}`, name: d.name, driver: d.driver, rate, total, cost: rate * total };
    });
  }
  function rateQ({ rng }) {
    const [p] = randomPools(rng, 1);
    return { vars: { name: p.name, driver: p.driver, cost: p.cost, total: p.total, rate: p.rate, wrongInverse: p.total / p.cost, wrongPlant: p.cost / (p.total * 10) },
      misconceptions: [
        { var: 'wrongInverse', feedback: 'Inverted: the rate is pool cost ÷ driver quantity.' },
        { value: p.cost, feedback: 'That is the pool cost; divide it by the predicted driver level.' },
      ] };
  }
  function jobQ({ rng, difficulty }) {
    const n = difficulty >= 2 ? 4 : 3;
    const pools = randomPools(rng, n);
    const units = nice(rng, 500, 5000, 100);
    const use = pools.map((p) => Math.max(1, Math.round(p.total * rng.pick([0.005, 0.01, 0.02, 0.03]))));
    const r = jobCore({ pools, job: { units, use } });
    const table = pools.map((p, i) => `| ${p.name} | ${P(p.cost)} | ${C(p.total)} ${p.driver} | ${C(use[i])} |`).join('\n');
    const biggest = r.lines.reduce((a, b) => (b.amount > a.amount ? b : a));
    return { vars: { table, units, abcTotal: r.abcTotal, abcUnit: r.abcUnit, wrongPerUnitRate: sum(pools.map((p) => p.rate)) , biggestName: biggest.name, biggest: biggest.amount,
      rates: pools.map((p) => `${p.name} ${P(p.rate)}`).join('; '), rows: r.rows.filter((x) => x.id !== 'abc-unit').map((x) => clean({ label: x.label.replace(/ × .*$/, ''), amount: x.amount, style: x.style, blank: true })),
      rateRows: pools.map((p) => ({ label: `${p.name} (per ${p.driver.replace(/s$/, '')})`, amount: p.rate, blank: true })) },
      misconceptions: [
        { value: r.abcUnit, feedback: 'That is per unit; the question asks for the job total.' },
        { value: sum(pools.map((p) => p.rate)), feedback: 'Multiply each rate by the job\'s own driver quantity before adding.' },
      ] };
  }
  function plantQ({ rng }) {
    for (;;) {
      const pools = randomPools(rng, 3).map((p, i) => (i === 2 ? { ...p, name: 'Other overhead (machine hours)', driver: 'machine hours' } : p));
      const totalMH = nice(rng, 10000, 40000, 1000);
      pools[2].total = totalMH; pools[2].rate = rng.pick([8, 10, 12]); pools[2].cost = pools[2].rate * totalMH;
      const units = nice(rng, 1000, 4000, 500);
      const mh = Math.round(totalMH * rng.pick([0.01, 0.02, 0.025]));
      const use = [Math.max(2, Math.round(pools[0].total * 0.03)), Math.max(2, Math.round(pools[1].total * 0.03)), mh];
      const r = jobCore({ pools, job: { units, use, mh }, totalMH });
      if (Math.abs(r.plant.rate * 100 - Math.round(r.plant.rate * 100)) > 1e-6) continue;
      const table = pools.map((p, i) => `| ${p.name} | ${P(p.cost)} | ${C(p.total)} ${p.driver} | ${C(use[i])} |`).join('\n');
      return { vars: { table, units, mh, totalMH, totalOH: sum(pools.map((p) => p.cost)), plantRate: r.plant.rate, plantOH: r.plant.oh, abcTotal: r.abcTotal, gap: r.plant.gap, absGap: Math.abs(r.plant.gap),
        dirTxt: r.plant.gap > 0 ? 'undercosts' : 'overcosts' },
        misconceptions: [
          { value: r.abcTotal, feedback: 'That is the ABC figure; the question asks for the single plantwide rate.' },
          { value: mh * pools[2].rate, feedback: 'The plantwide rate spreads all the overhead, not just the machine-hour pool.' },
        ] };
    }
  }
  function compareQ({ rng, difficulty }) {
    for (;;) {
      const units = [nice(rng, 20000, 80000, 5000), nice(rng, 2000, 15000, 1000)];
      const mh = [Math.round(units[0] * rng.pick([0.5, 1, 1.5])), Math.round(units[1] * rng.pick([1, 1.5, 2]))];
      const setups = [nice(rng, 50, 400, 50), nice(rng, 500, 2000, 100)];
      const mRate = rng.pick([10, 15, 20, 25]);
      const sRate = rng.pick([200, 250, 400, 500]);
      const pools = [
        { id: 'machining', name: 'Machining', cost: mRate * (mh[0] + mh[1]), driver: 'machine hours', use: mh },
        { id: 'setups', name: 'Setups', cost: sRate * (setups[0] + setups[1]), driver: 'setups', use: setups },
      ];
      if (difficulty >= 3) {
        const insp = [nice(rng, 100, 600, 50), nice(rng, 400, 1600, 100)];
        pools.push({ id: 'inspections', name: 'Inspections', cost: rng.pick([40, 50, 75]) * (insp[0] + insp[1]), driver: 'inspections', use: insp });
      }
      const products = [{ id: 'hi', name: 'Standard', units: units[0], base: mh[0] }, { id: 'lo', name: 'Custom', units: units[1], base: mh[1] }];
      const x = compareCore({ products, pools, baseLabel: 'machine hours' });
      const vals = [x.tradRate, ...x.prod.flatMap((p) => [p.abcOH, p.tradOH])];
      if (vals.some((v) => Math.abs(v * 100 - Math.round(v * 100)) > 1e-6)) continue;
      const [hi, lo] = x.prod;
      if (!(hi.diff > 0 && lo.diff < 0)) continue;
      return { vars: {
        unitsHi: units[0], unitsLo: units[1], mhHi: mh[0], mhLo: mh[1], totalOH: x.totalOH, totalMH: mh[0] + mh[1],
        table: pools.map((p) => `| ${p.name} | ${P(p.cost)} | ${p.driver} | ${C(p.use[0])} | ${C(p.use[1])} |`).join('\n'),
        tradRate: x.tradRate, tradHi: hi.tradOH, tradLo: lo.tradOH, abcHi: hi.abcOH, abcLo: lo.abcOH, ohLo: lo.abcTotal, diffLo: -lo.diff, diffHi: hi.diff,
        wrongTotalLo: lo.abcTotal, wrongTradLo: lo.tradOH,
        rows: x.costRows.filter((r) => ['c-trad', 'c-abc', 'c-diff'].includes(r.id)).map((r) => clean({ label: r.label, amounts: r.amounts, style: r.style, blank: true })),
      },
      misconceptions: [
        { var: 'wrongTradLo', feedback: 'That is the single-rate figure. Under ABC, add up the activities Custom actually uses.' },
        { var: 'wrongTotalLo', feedback: 'That is Custom\'s total overhead; divide by its units.' },
      ] };
    }
  }
  function distortQ({ rng }) {
    const trad = rng.pick([40, 50, 60, 80, 120, 150, 200]);
    const factor = rng.pick([0.6, 0.75, 1.25, 1.5, 2, 2.5]);
    const abc = trad * factor;
    const diff = trad - abc;
    return { vars: { trad, abc, diff, absDiff: Math.abs(diff), dirTxt: diff > 0 ? 'overcosted' : 'undercosted', pctTrad: (100 * Math.abs(diff)) / trad, pctAbc: (100 * Math.abs(diff)) / abc },
      misconceptions: [
        { value: (100 * Math.abs(diff)) / abc, feedback: 'You divided by the ABC cost. The question asks for the difference as a percent of the traditional cost.' },
        { value: 100 * factor, feedback: 'That is ABC as a percent of traditional, not the size of the distortion.' },
      ] };
  }
  function serviceQ({ rng }) {
    for (;;) {
      const rates = [rng.pick([10, 15, 20, 25]), rng.pick([20, 30, 40, 50]), rng.pick([50, 60, 80, 100])];
      const visits = [nice(rng, 5000, 20000, 1000), nice(rng, 2000, 8000, 1000), nice(rng, 1000, 4000, 500)];
      const procs = visits.map((v, i) => v * [1, 1.5, 2][i]);
      const hours = visits.map(() => nice(rng, 500, 2000, 100));
      const pools = [
        { id: 'scheduling', name: 'Scheduling', cost: rates[0] * sum(visits), driver: 'visits', use: visits },
        { id: 'lab', name: 'Lab processing', cost: rates[1] * sum(procs), driver: 'procedures', use: procs },
        { id: 'consult', name: 'Consultation', cost: rates[2] * sum(hours), driver: 'consultation hours', use: hours },
      ];
      const products = ['Basic panel', 'Imaging', 'Executive package'].map((n, i) => ({ id: `s${i + 1}`, name: n, units: visits[i] }));
      const x = compareCore({ products, pools, unitLabel: 'visit' });
      const target = x.prod[2];
      if (Math.abs(target.abcOH * 100 - Math.round(target.abcOH * 100)) > 1e-6) continue;
      return { vars: {
        table: pools.map((p) => `| ${p.name} | ${P(p.cost)} | ${p.driver} | ${p.use.map(C).join(' | ')} |`).join('\n'),
        visits3: visits[2], cost3: target.abcTotal, perVisit3: target.abcOH, rates: pools.map((p) => `${p.name} ${P(p.cost / sum(p.use))}`).join('; '),
        wrongAvg: sum(pools.map((p) => p.cost)) / sum(visits),
      },
      misconceptions: [
        { var: 'wrongAvg', feedback: 'That is the average cost per visit across all lines, a single-rate answer.' },
        { value: target.abcTotal, feedback: 'That is the line\'s total cost; divide by its visits.' },
      ] };
    }
  }
  function customerQ({ rng }) {
    for (;;) {
      const oRate = rng.pick([50, 80, 100, 120]);
      const dRate = rng.pick([150, 200, 250]);
      const orders = [nice(rng, 300, 1200, 100), nice(rng, 300, 1200, 100), nice(rng, 100, 600, 100)];
      const dels = [nice(rng, 100, 900, 100), nice(rng, 100, 900, 100), nice(rng, 100, 600, 100)];
      const gm = [nice(rng, 100000, 250000, 10000), nice(rng, 100000, 250000, 10000), nice(rng, 60000, 150000, 10000)];
      const pools = [
        { id: 'orders', name: 'Order processing', cost: oRate * sum(orders), driver: 'orders' },
        { id: 'deliveries', name: 'Delivery', cost: dRate * sum(dels), driver: 'deliveries' },
      ];
      const cs = ['A', 'B', 'C'].map((id, i) => ({ id, name: `Customer ${id}`, gm: gm[i], use: [orders[i], dels[i]] }));
      const x = customerCore({ pools, customers: cs });
      const losers = x.cust.filter((c) => c.profit < 0);
      if (losers.length !== 1) continue;
      if (new Set(gm).size < 3) continue;
      if (x.byGm.join('') === x.byProfit.join('')) continue;
      const L = losers[0];
      return { vars: {
        table: cs.map((c) => `| ${c.name} | ${P(c.gm)} | ${C(c.use[0])} | ${C(c.use[1])} |`).join('\n'),
        orderCost: pools[0].cost, totalOrders: sum(orders), delCost: pools[1].cost, totalDels: sum(dels), oRate, dRate,
        loser: L.id, loserName: L.name, loserProfit: L.profit, loserCost: L.cost, loserGm: L.gm,
        rankGm: x.byGm.join(' > '), rankProfit: x.byProfit.join(' > '),
        options: ['A', 'B', 'C'].map((id) => `Customer ${id}`),
        loserIndex: ['A', 'B', 'C'].indexOf(L.id),
        rows: [
          { label: 'Gross margin', amounts: x.cust.map((c) => c.gm) },
          ...x.R.map((p, i) => ({ label: `Less ${p.name.toLowerCase()}`, amounts: x.cust.map((c) => -c.lines[i]), indent: 1, blank: true })),
          { label: 'Operating profit', amounts: x.cust.map((c) => c.profit), style: 'total', blank: true },
        ],
      },
      misconceptions: [
        { value: L.gm, feedback: 'That is gross margin before the ABC-assigned selling costs.' },
        { value: -L.cost, feedback: 'Start from the gross margin, then subtract the assigned cost.' },
      ] };
    }
  }

  return {
    fns: { rates, job, jobSheet, jobWalk, pickJob, compare, compareSheet, compareWalk, compareView, caselet, distortion, hierarchy, customers, bid },
    generators: { rateQ, jobQ, plantQ, compareQ, distortQ, serviceQ, customerQ },
  };
}
