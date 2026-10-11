export default function register(sdk) {
  const { round, fmt, sum } = sdk;
  const P = (x) => fmt(x, 'money');
  const C = (x) => fmt(x, 'comma');
  const PCT = (x) => fmt(x, 'pct1').replace('.0%', '%');

  // Account titles as the job-order module prints them (the Session 1 deck names the accounts only in words).
  const AC = {
    rm: 'Raw Materials Inventory',
    wages: 'Wages Payable',
    foh: 'Factory Overhead',
    wip: 'Work in Process',
    fg: 'Finished Goods',
    cogs: 'Cost of Goods Sold',
  };

  // ------------------------------------------------------------------ shared helpers
  function clean(o) {
    if (Array.isArray(o)) return o.map(clean);
    if (o && typeof o === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = clean(v);
      return out;
    }
    return o;
  }
  // A "step" is { row?, entry?, reveal?: [rowId], label, math?, code?, vars?, tone? }.
  function toTrace(steps, role = 'journal') {
    return steps.map((s, i) => {
      const ops = [];
      if (i === 0) ops.push({ role, cmd: 'clear' });
      if (s.row) ops.push({ role, cmd: 'highlight', args: { sel: `row:${s.row}`, tone: s.tone ?? 'accent' } });
      if (s.entry) ops.push({ role, cmd: 'highlight', args: { sel: `entry:${s.entry}`, tone: s.tone ?? 'accent' } });
      return clean({ label: s.label, math: s.math, code: s.code ?? s.math, vars: s.vars ?? {}, ops });
    });
  }
  function toWalk(steps, role, key) {
    return steps.map((s, i) => {
      const ops = [];
      if (s.row) ops.push({ role, cmd: 'highlight', args: { sel: `row:${s.row}`, tone: s.tone ?? 'accent' } });
      return clean({ label: s.label, vars: s.vars ?? {}, patch: { [key]: i + 1 }, ops });
    });
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
      if ('amount' in out && pending.has(r.id)) out.amount = null;
      return out;
    });
  }
  const line = (account, side, amount, anchor) => clean(side === 'dr' ? { account, debit: amount, anchor } : { account, credit: amount, anchor });
  const quizLines = (lines) => lines.map(({ account, debit, credit }) => (debit !== undefined ? { account, debit } : { account, credit }));
  const nice = (rng, lo, hi, step) => rng.int(Math.ceil(lo / step), Math.floor(hi / step)) * step;

  // ------------------------------------------------------------------ total manufacturing cost (slides 62–69, 74–75)
  // materials and labor are lists of { label, amount }; overhead is a number.
  // roles: journal, formula, code. Scene walk role: sheet (Schedule).
  function mfgCore({ materials, labor, overhead }) {
    const dm = sum(materials.map((m) => m.amount));
    const dl = sum(labor.map((l) => l.amount));
    const oh = overhead;
    const prime = dm + dl;
    const conversion = dl + oh;
    const total = dm + dl + oh;
    const rows = [
      { id: 'dm-head', label: 'Direct materials', style: 'heading' },
      ...materials.map((m, i) => ({ id: `mat-${i + 1}`, label: m.label, amount: m.amount, indent: 1, anchor: 'dm' })),
      { id: 'dm', label: 'Total direct materials', amount: dm, style: 'subtotal', anchor: 'dm' },
      { id: 'dl-head', label: 'Direct labor', style: 'heading' },
      ...labor.map((l, i) => ({ id: `lab-${i + 1}`, label: l.label, amount: l.amount, indent: 1, anchor: 'dl' })),
      { id: 'dl', label: 'Total direct labor', amount: dl, style: 'subtotal', anchor: 'dl' },
      { id: 'oh', label: 'Applied factory overhead', amount: oh, anchor: 'oh' },
      { id: 'prime', label: 'Prime cost (direct materials + direct labor)', amount: prime, style: 'subtotal', anchor: 'prime' },
      { id: 'conv', label: 'Conversion cost (direct labor + overhead)', amount: conversion, style: 'subtotal', anchor: 'conv' },
      { id: 'total', label: 'Total manufacturing cost', amount: total, style: 'total', anchor: 'total' },
    ];
    const steps = [
      ...materials.map((m, i) => ({ row: `mat-${i + 1}`, math: 'dm', label: `${m.label}: ${P(m.amount)} of direct materials`, vars: { material: m.amount } })),
      { row: 'dm', math: 'dm', label: `Direct materials: ${materials.map((m) => C(m.amount)).join(' + ')} = ${P(dm)}`, vars: { dm } },
      ...labor.map((l, i) => ({ row: `lab-${i + 1}`, math: 'dl', label: `${l.label}: ${P(l.amount)} of direct labor`, vars: { labor: l.amount } })),
      { row: 'dl', math: 'dl', label: `Direct labor: ${labor.map((l) => C(l.amount)).join(' + ')} = ${P(dl)}`, vars: { dl } },
      { row: 'oh', math: 'oh', label: `Applied overhead: ${P(oh)}`, vars: { oh } },
      { row: 'prime', math: 'prime', label: `Prime cost: ${C(dm)} + ${C(dl)} = ${P(prime)}`, vars: { prime } },
      { row: 'conv', math: 'conv', label: `Conversion cost: ${C(dl)} + ${C(oh)} = ${P(conversion)}; direct labor is in both`, vars: { conversion } },
      { row: 'total', math: 'total', label: `Total manufacturing cost: ${C(dm)} + ${C(dl)} + ${C(oh)} = ${P(total)}`, vars: { total }, tone: 'good' },
    ];
    return { dm, dl, oh, prime, conversion, total, rows, steps };
  }
  function mfgCost(args) {
    const r = mfgCore(args);
    return clean({ dm: r.dm, dl: r.dl, oh: r.oh, prime: r.prime, conversion: r.conversion, total: r.total,
      overlap: r.prime + r.conversion - r.total, rows: r.rows, trace: toTrace(r.steps) });
  }
  function mfgSheet(args) {
    const r = mfgCore(args);
    return clean({ rows: reveal(r.rows, r.steps, args.upTo), total: r.total, prime: r.prime, conversion: r.conversion });
  }
  // roles: sheet
  function mfgWalk(args) {
    const r = mfgCore(args);
    return clean({ steps: r.steps.length, total: r.total, trace: toWalk(r.steps, 'sheet', 'mfgUpTo') });
  }

  // ------------------------------------------------------------------ where a product cost sits (slides 59–61)
  // soldPct: the share of the finished units that have been sold (0 to 1). Module-built entries (beyond the slides).
  // roles: journal, formula, code
  function costFlow({ dm, dl, oh, soldPct }) {
    const total = dm + dl + oh;
    const sold = total * soldPct;
    const fg = total - sold;
    const entries = [
      { id: 'e-dm', memo: 'Materials used: a product cost enters Work in Process', lines: [line(AC.wip, 'dr', dm, 'wip'), line(AC.rm, 'cr', dm)] },
      { id: 'e-dl', memo: 'Direct labor of the job', lines: [line(AC.wip, 'dr', dl, 'wip'), line(AC.wages, 'cr', dl)] },
      { id: 'e-oh', memo: 'Overhead applied to the job', lines: [line(AC.wip, 'dr', oh, 'wip'), line(AC.foh, 'cr', oh)] },
      { id: 'e-fg', memo: 'Job finished: the cost moves to Finished Goods, still an asset', lines: [line(AC.fg, 'dr', total, 'fg'), line(AC.wip, 'cr', total, 'wip')] },
    ];
    if (sold > 0) {
      entries.push({ id: 'e-sold', memo: 'Units sold: the cost leaves inventory and becomes an expense', lines: [line(AC.cogs, 'dr', sold, 'cogs'), line(AC.fg, 'cr', sold, 'fg')] });
    }
    const rows = [
      { id: 'total', label: 'Product cost of the job', amount: total, style: 'subtotal', anchor: 'wip' },
      { id: 'fg', label: `Still in Finished Goods (asset): ${PCT(1 - soldPct)} of units`, amount: fg, indent: 1, anchor: 'fg' },
      { id: 'cogs', label: `Cost of Goods Sold (expense): ${PCT(soldPct)} of units`, amount: sold, indent: 1, anchor: 'cogs' },
    ];
    const steps = [
      { entry: 'e-dm', math: 'wip', label: `Materials ${P(dm)} enter Work in Process`, vars: { dm } },
      { entry: 'e-dl', math: 'wip', label: `Labor ${P(dl)} enters Work in Process`, vars: { dl } },
      { entry: 'e-oh', math: 'wip', label: `Overhead ${P(oh)} enters Work in Process`, vars: { oh } },
      { row: 'total', entry: 'e-fg', math: 'fg', label: `All ${P(total)} moves to Finished Goods: still an asset`, vars: { total } },
      { row: 'cogs', math: 'cogs', label: `${PCT(soldPct)} sold: ${P(sold)} becomes expense; ${P(fg)} stays an asset`, vars: { cogs: sold, fg }, tone: 'good' },
    ];
    return clean({ total, sold, fg, cogs: sold, rows, entries, trace: toTrace(steps) });
  }

  // ------------------------------------------------------------------ the 1 : 10 : 100 rule (slide 38)
  function qualityRule({ defects }) {
    const design = defects * 1;
    const production = defects * 10;
    const customer = defects * 100;
    const rows = [
      { id: 'design', label: `Caught at design: ${C(defects)} × ₱1`, amount: design, anchor: 'design' },
      { id: 'production', label: `Caught in production: ${C(defects)} × ₱10`, amount: production, anchor: 'production' },
      { id: 'customer', label: `Caught by the customer: ${C(defects)} × ₱100`, amount: customer, style: 'total', anchor: 'customer' },
    ];
    const steps = [
      { row: 'design', math: 'design', label: `At design each defect costs ₱1: ${P(design)}`, vars: { design } },
      { row: 'production', math: 'production', label: `In production ₱10 each: ${P(production)}`, vars: { production } },
      { row: 'customer', math: 'customer', label: `At the customer ₱100 each: ${P(customer)}`, vars: { customer }, tone: 'bad' },
    ];
    return clean({ design, production, customer, rows, trace: toTrace(steps) });
  }

  // ------------------------------------------------------------------ quiz generators
  const PRODUCT_ITEMS = [
    'Fan motor components purchased for assembly',
    'Wages of assembly-line workers',
    "The factory supervisor's salary",
    'Depreciation on factory equipment',
    'Factory utilities and maintenance',
    'Glue and nails used in the factory',
  ];
  const PERIOD_ITEMS = [
    'Sales commissions paid to distributors',
    "The CEO's office rent",
    'Depreciation on delivery trucks',
    'Advertising for the new product line',
    'Audit fees',
    'Executive salaries',
  ];
  function productPeriodQ({ rng }) {
    const isProduct = rng.bool(0.5);
    const item = rng.pick(isProduct ? PRODUCT_ITEMS : PERIOD_ITEMS);
    const options = rng.shuffle(['Product cost', 'Period cost']);
    const right = isProduct ? 'Product cost' : 'Period cost';
    return { vars: { item, kindName: right }, options, answer: options.indexOf(right) };
  }
  const ELEMENTS = [
    { text: 'Steel used to build a car chassis', kind: 'Direct materials' },
    { text: 'Wood used to build a dining table', kind: 'Direct materials' },
    { text: 'Wages of carpenters assembling furniture', kind: 'Direct labor' },
    { text: 'Wages of machine operators running production equipment', kind: 'Direct labor' },
    { text: 'Factory rent and insurance', kind: 'Factory overhead' },
    { text: "The factory supervisor's salary", kind: 'Factory overhead' },
    { text: 'Glue and nails, too small to trace to each unit', kind: 'Factory overhead' },
    { text: 'Wages of janitors and security guards at the plant', kind: 'Factory overhead' },
  ];
  function elementQ({ rng }) {
    const item = rng.pick(ELEMENTS);
    const options = rng.shuffle(['Direct materials', 'Direct labor', 'Factory overhead', 'Selling and administrative']);
    return { vars: { item: item.text, kindName: item.kind }, options, answer: options.indexOf(item.kind) };
  }

  // A job costed from two material items, two labor items and applied overhead.
  function mfgQ({ rng, difficulty }) {
    const m1 = nice(rng, 8000, 60000, 500);
    const m2 = nice(rng, 5000, 40000, 500);
    const l1 = nice(rng, 2000, 15000, 100);
    const l2 = nice(rng, 2000, 15000, 100);
    const oh = nice(rng, 2000, difficulty >= 2 ? 30000 : 12000, 100);
    const materials = [{ label: 'Material A', amount: m1 }, { label: 'Material B', amount: m2 }];
    const labor = [{ label: 'Labor, first operator', amount: l1 }, { label: 'Labor, second operator', amount: l2 }];
    const r = mfgCost({ materials, labor, overhead: oh });
    return {
      vars: {
        m1, m2, l1, l2, oh, materials, labor, dm: r.dm, dl: r.dl, prime: r.prime, conversion: r.conversion, total: r.total,
        wrongPrimeOh: r.dm + r.oh, wrongConvDm: r.dm + r.oh, wrongTotalDouble: r.prime + r.conversion, wrongNoOh: r.dm + r.dl,
        wrongConvNoDl: r.oh,
      },
      misconceptions: [
        { var: 'wrongTotalDouble', feedback: 'You added prime and conversion cost. Direct labor is in **both**, so that counts it twice. Total manufacturing cost is DM + DL + OH.' },
        { var: 'wrongNoOh', feedback: 'You left out factory overhead. Every unit absorbs materials, labor and overhead.' },
      ],
    };
  }
  function primeQ(args) {
    const base = mfgQ(args);
    base.misconceptions = [
      { var: 'wrongPrimeOh', feedback: 'You added overhead. Prime cost is only **direct materials + direct labor**.' },
      { var: 'total', feedback: 'That is total manufacturing cost. Prime cost leaves overhead out.' },
    ];
    return base;
  }
  function conversionQ(args) {
    const base = mfgQ(args);
    base.misconceptions = [
      { var: 'wrongConvDm', feedback: 'You added direct materials. Conversion cost is **direct labor + factory overhead**: the cost of converting materials into product.' },
      { var: 'wrongConvNoDl', feedback: 'That is overhead alone. Conversion cost includes the direct labor too.' },
    ];
    return base;
  }

  // Units made, unit cost and the share sold.
  function cogsQ({ rng }) {
    for (;;) {
      const units = nice(rng, 500, 5000, 500);
      const unitCost = rng.pick([12, 15, 20, 24, 30, 45, 60]);
      const soldUnits = nice(rng, units * 0.2, units * 0.9, 100);
      if (soldUnits >= units || soldUnits <= 0) continue;
      const total = units * unitCost;
      const cogs = soldUnits * unitCost;
      const fg = total - cogs;
      return {
        vars: { units, unitCost, soldUnits, total, cogs, fg, unsold: units - soldUnits, wrongAll: total, wrongSwap: fg },
        misconceptions: [
          { var: 'wrongAll', feedback: 'That is the cost of every unit made. Only the units **sold** become Cost of Goods Sold; the rest stay in inventory as an asset.' },
          { var: 'wrongSwap', feedback: 'That is the cost still in Finished Goods. Cost of Goods Sold is the cost of the units that were sold.' },
        ],
      };
    }
  }
  function unitCostQ({ rng }) {
    for (;;) {
      const units = nice(rng, 200, 2000, 100);
      const unitCost = rng.pick([12, 18, 25, 32, 40, 55, 75]);
      const total = units * unitCost;
      return {
        vars: { units, total, unitCost, wrongTimes: total * units, wrongInverse: units / total },
        misconceptions: [
          { var: 'wrongTimes', feedback: 'You multiplied. Unit cost is total manufacturing cost **divided by** the units made.' },
          { var: 'wrongInverse', feedback: 'You divided the other way round, which gives units per peso. Unit cost is total cost ÷ units.' },
        ],
      };
    }
  }
  function defectQ({ rng }) {
    const defects = rng.pick([5, 8, 10, 12, 20, 25, 40]);
    const r = qualityRule({ defects });
    return {
      vars: { defects, design: r.design, production: r.production, customer: r.customer, wrongTen: r.production, wrongOne: r.design },
      misconceptions: [
        { var: 'wrongTen', feedback: 'That is the production-stage cost (₱10 per defect). A defect found by the customer costs ₱100.' },
        { var: 'wrongOne', feedback: 'That is the design-stage cost (₱1 per defect). Finding it at the customer is 100 times as costly.' },
      ],
    };
  }

  // A month's costs, split into product and period.
  function periodSumQ({ rng }) {
    const pick = (list, n) => rng.sample(list, n);
    const prod = pick(PRODUCT_ITEMS, 3).map((t) => ({ text: t, amount: nice(rng, 5000, 40000, 500), kind: 'product' }));
    const per = pick(PERIOD_ITEMS, 3).map((t) => ({ text: t, amount: nice(rng, 3000, 25000, 500), kind: 'period' }));
    const all = rng.shuffle([...prod, ...per]);
    const productTotal = sum(prod.map((x) => x.amount));
    const periodTotal = sum(per.map((x) => x.amount));
    return {
      vars: {
        items: all, productTotal, periodTotal, all: productTotal + periodTotal,
        table: { rows: all.map((_, i) => `C${i + 1}`), cols: ['Amount'], values: all.map((x) => [x.amount]) },
        itemText: all.map((x, i) => `C${i + 1}: ${x.text} (${P(x.amount)})`).join('; '),
        wrongAll: productTotal + periodTotal, wrongSwap: periodTotal,
      },
      misconceptions: [
        { var: 'wrongAll', feedback: 'You added every cost. Only manufacturing costs are product costs; selling and administrative costs are period costs.' },
        { var: 'wrongSwap', feedback: 'That is the total of the **period** costs. Product costs are the ones incurred inside the factory to make the product.' },
      ],
    };
  }

  // The completion entry, with a shuffled chart of accounts.
  function completeQ({ rng }) {
    const total = nice(rng, 20000, 200000, 1000);
    const sold = rng.bool(0.5);
    const accounts = rng.shuffle([AC.wip, AC.fg, AC.cogs, AC.rm, AC.wages, AC.foh]);
    const entry = sold
      ? [{ lines: quizLines([line(AC.cogs, 'dr', total), line(AC.fg, 'cr', total)]) }]
      : [{ lines: quizLines([line(AC.fg, 'dr', total), line(AC.wip, 'cr', total)]) }];
    return {
      vars: {
        total, accounts, entries: entry,
        eventText: sold ? 'The finished units are sold; record the cost leaving inventory.' : 'The job is finished and moved to the warehouse; record the transfer of its cost.',
      },
    };
  }

  return {
    fns: { mfgCost, mfgSheet, mfgWalk, costFlow, qualityRule },
    generators: { productPeriodQ, elementQ, mfgQ, primeQ, conversionQ, cogsQ, unitCostQ, defectQ, periodSumQ, completeQ },
  };
}
