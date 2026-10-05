export default function register(sdk) {
  const { round, fmt, sum } = sdk;
  const P = (x) => fmt(x, 'money');
  const P2 = (x) => fmt(x, 'money2');
  const C = (x) => fmt(x, 'comma');
  const PCT = (x) => fmt(x, 'pct1').replace('.0%', '%');

  // Account titles exactly as Session 5 prints them (slides 46 and 61).
  const AC = {
    rm: 'Raw Materials Inventory',
    ap: 'Accounts Payable',
    wip: 'Work in Process',
    wages: 'Wages Payable',
    foh: 'Factory Overhead',
    fg: 'Finished Goods',
    cogs: 'Cost of Goods Sold',
  };

  // ------------------------------------------------------------------ shared helpers
  // Drop undefined keys so every result is plain JSON.
  function clean(o) {
    if (Array.isArray(o)) return o.map(clean);
    if (o && typeof o === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = clean(v);
      return out;
    }
    return o;
  }
  // A "step" is { row?, entry?, reveal?: [rowId | 'rowId:col'], label, math?, code?, vars?, tone?, note? }.
  // Math & Journal trace: roles journal (the section's pane), formula, code.
  function toTrace(steps, role = 'journal') {
    return steps.map((s, i) => {
      const ops = [];
      if (i === 0) ops.push({ role, cmd: 'clear' });
      if (s.row) ops.push({ role, cmd: 'highlight', args: { sel: `row:${s.row}`, tone: s.tone ?? 'accent' } });
      if (s.entry) ops.push({ role, cmd: 'highlight', args: { sel: `entry:${s.entry}`, tone: s.tone ?? 'accent' } });
      if (s.note) ops.push({ role, cmd: 'annotate', args: { sel: s.row ? `row:${s.row}` : `entry:${s.entry}`, text: s.note } });
      return clean({ label: s.label, math: s.math, code: s.code ?? s.math, vars: s.vars ?? {}, ops });
    });
  }
  // Intuition walk: each step reveals the next worksheet cells through `patch: {key: n}`.
  function toWalk(steps, role, key, extra) {
    return steps.map((s, i) => {
      const ops = [];
      if (s.row) ops.push({ role, cmd: 'highlight', args: { sel: `row:${s.row}`, tone: s.tone ?? 'accent' } });
      if (extra) ops.push(...extra(s, i));
      return clean({ label: s.label, vars: s.vars ?? {}, patch: { [key]: i + 1 }, ops });
    });
  }
  function keysOf(s) { return s.reveal ?? (s.row ? [s.row] : []); }
  // Blank out the cells that later steps compute; null cells stay empty in a Schedule.
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
  const line = (account, side, amount, anchor) => clean(side === 'dr' ? { account, debit: amount, anchor } : { account, credit: amount, anchor });
  const quizLines = (lines) => lines.map(({ account, debit, credit }) => (debit !== undefined ? { account, debit } : { account, credit }));

  // ------------------------------------------------------------------ job cost sheet (Chiphard, slide 22)
  // roles: journal (pane), formula, code. Scene walk role: sheet (Schedule).
  function jobSheetCore({ issues, labor, rate, markup }) {
    const dm = sum(issues.map((x) => x.amount));
    const dlParts = labor.map((t) => t.hours * t.wage);
    const dl = sum(dlParts);
    const hours = sum(labor.map((t) => t.hours));
    const oh = hours * rate;
    const total = dm + dl + oh;
    const markupAmt = markup * total;
    const price = total + markupAmt;
    const rows = [
      { id: 'dm-head', label: 'Direct materials (requisitions)', style: 'heading' },
      ...issues.map((x, i) => ({ id: `req-${i + 1}`, label: `Issued ${x.date}`, amount: x.amount, indent: 1, anchor: 'dm' })),
      { id: 'dm', label: 'Total direct materials', amount: dm, style: 'subtotal', anchor: 'dm' },
      { id: 'dl-head', label: 'Direct labor (time tickets)', style: 'heading' },
      ...labor.map((t, i) => ({ id: `tt-${i + 1}`, label: `${t.week}: ${C(t.hours)} h × ${P2(t.wage)}`, amount: dlParts[i], indent: 1, anchor: 'dl' })),
      { id: 'dl', label: 'Total direct labor', amount: dl, style: 'subtotal', anchor: 'dl' },
      { id: 'oh', label: `Applied overhead: ${C(hours)} DLH × ${P2(rate)}`, amount: oh, anchor: 'oh' },
      { id: 'total', label: 'Total job cost', amount: total, style: 'total', anchor: 'total' },
      { id: 'markup', label: `Markup: ${PCT(markup)} of cost`, amount: markupAmt, indent: 1, anchor: 'price' },
      { id: 'price', label: 'Sales price', amount: price, style: 'total', anchor: 'price' },
    ];
    const steps = [
      ...issues.map((x, i) => ({ row: `req-${i + 1}`, math: 'dm', label: `Requisition ${x.date}: ${P(x.amount)} of materials charged to the job`, vars: { requisition: x.amount } })),
      { row: 'dm', math: 'dm', label: `Direct materials: ${issues.map((x) => C(x.amount)).join(' + ')} = ${P(dm)}`, vars: { dm } },
      ...labor.map((t, i) => ({ row: `tt-${i + 1}`, math: 'dl', label: `${t.week}: ${C(t.hours)} × ${P2(t.wage)} = ${P(dlParts[i])}`, vars: { hours: t.hours, wage: t.wage, ticket: dlParts[i] } })),
      { row: 'dl', math: 'dl', label: `Direct labor: ${dlParts.map(C).join(' + ')} = ${P(dl)}`, vars: { dl } },
      { row: 'oh', math: 'oh', label: `Overhead: ${C(hours)} total DLH × ${P2(rate)} = ${P(oh)}`, vars: { hours, oh } },
      { row: 'total', math: 'total', label: `Job cost: ${C(dm)} + ${C(dl)} + ${C(oh)} = ${P(total)}`, vars: { total }, tone: 'good' },
      { row: 'markup', math: 'price', label: `Markup: ${PCT(markup)} × ${C(total)} = ${P(markupAmt)}`, vars: { markupAmt } },
      { row: 'price', math: 'price', label: `Price: ${C(total)} + ${C(markupAmt)} = ${P(price)}`, vars: { price }, tone: 'good' },
    ];
    const entries = [
      { id: 'e-dm', memo: 'Materials requisitioned for the job', lines: [line(AC.wip, 'dr', dm, 'dm'), line(AC.rm, 'cr', dm, 'dm')] },
      { id: 'e-dl', memo: 'Direct labor from the time tickets', lines: [line(AC.wip, 'dr', dl, 'dl'), line(AC.wages, 'cr', dl, 'dl')] },
      { id: 'e-oh', memo: 'Overhead applied at the predetermined rate', lines: [line(AC.wip, 'dr', oh, 'oh'), line(AC.foh, 'cr', oh, 'oh')] },
    ];
    return { dm, dl, hours, oh, total, markupAmt, price, rows, steps, entries };
  }
  function jobSheet(args) {
    const r = jobSheetCore(args);
    return clean({ dm: r.dm, dl: r.dl, hours: r.hours, oh: r.oh, total: r.total, markupAmt: r.markupAmt, price: r.price,
      rows: r.rows, entries: r.entries, steps: r.steps.length, trace: toTrace(r.steps) });
  }
  function jobSheetSheet(args) {
    const r = jobSheetCore(args);
    return clean({ rows: reveal(r.rows, r.steps, args.upTo), total: r.total, price: r.price, dl: r.dl, dm: r.dm, oh: r.oh });
  }
  // roles: sheet (Schedule)
  function jobSheetWalk(args) {
    const r = jobSheetCore(args);
    return clean({ steps: r.steps.length, total: r.total, price: r.price, trace: toWalk(r.steps, 'sheet', 'sheetUpTo') });
  }

  // ------------------------------------------------------------------ predetermined overhead rate + one job (Quezon, slide 31)
  // roles: journal, formula, code
  function pohrCore({ budgetOH, budgetBase, dm, hours, wage }) {
    const rate = budgetOH / budgetBase;
    const dl = hours * wage;
    const oh = hours * rate;
    const total = dm + dl + oh;
    const rows = [
      { id: 'boh', label: 'Budgeted annual overhead', amount: budgetOH, anchor: 'boh' },
      { id: 'bbase', label: '÷ Budgeted direct labor hours', amount: budgetBase, format: 'number', anchor: 'bbase' },
      { id: 'rate', label: '= POHR per direct labor hour', amount: rate, style: 'total', anchor: 'rate' },
      { id: 'job-head', label: 'The job', style: 'heading' },
      { id: 'dm', label: 'Direct materials', amount: dm, indent: 1, anchor: 'dm' },
      { id: 'dl', label: `Direct labor: ${C(hours)} h × ${P(wage)}`, amount: dl, indent: 1, anchor: 'dl' },
      { id: 'oh', label: `Applied overhead: ${C(hours)} h × ${P2(rate)}`, amount: oh, indent: 1, anchor: 'applied' },
      { id: 'total', label: 'Total job cost', amount: total, style: 'total', anchor: 'total' },
    ];
    const steps = [
      { row: 'boh', math: 'boh', label: `Budgeted overhead for the year: ${P(budgetOH)} (set before January)`, vars: { budgetOH } },
      { row: 'bbase', math: 'bbase', label: `Budgeted activity: ${C(budgetBase)} direct labor hours`, vars: { budgetBase } },
      { row: 'rate', math: 'rate', label: `POHR = ${C(budgetOH)} ÷ ${C(budgetBase)} = ${P2(rate)} per DLH`, vars: { rate }, tone: 'good' },
      { row: 'dm', math: 'dm', label: `Direct materials traced from requisitions: ${P(dm)}`, vars: { dm } },
      { row: 'dl', math: 'dl', label: `Direct labor: ${C(hours)} × ${P(wage)} = ${P(dl)}`, vars: { dl } },
      { row: 'oh', math: 'applied', label: `Applied overhead: ${C(hours)} actual hours × ${P2(rate)} = ${P(oh)}`, vars: { oh } },
      { row: 'total', math: 'total', label: `Job cost: ${C(dm)} + ${C(dl)} + ${C(oh)} = ${P(total)}`, vars: { total }, tone: 'good' },
    ];
    const entries = [{ id: 'e-apply', memo: 'Overhead applied to the job', lines: [line(AC.wip, 'dr', oh, 'applied'), line(AC.foh, 'cr', oh, 'applied')] }];
    return { rate, dl, oh, total, rows, steps, entries };
  }
  function pohr(args) {
    const r = pohrCore(args);
    return clean({ rate: r.rate, dl: r.dl, oh: r.oh, total: r.total, rows: r.rows, entries: r.entries, trace: toTrace(r.steps) });
  }
  // Just the rate, for sliders (no job).
  function rateOnly({ budgetOH, budgetBase }) {
    const rate = budgetBase ? budgetOH / budgetBase : null;
    return clean({
      rate,
      rows: [
        { id: 'boh', label: 'Budgeted annual overhead', amount: budgetOH },
        { id: 'bbase', label: '÷ Budgeted direct labor hours', amount: budgetBase, format: 'number' },
        { id: 'rate', label: '= Predetermined overhead rate (per DLH)', amount: rate, style: 'total' },
      ],
    });
  }
  function pohrSheet(args) {
    const r = pohrCore(args);
    return clean({ rows: reveal(r.rows, r.steps, args.upTo), rate: r.rate, total: r.total, oh: r.oh, dl: r.dl });
  }
  // roles: sheet
  function pohrWalk(args) {
    const r = pohrCore(args);
    return clean({ steps: r.steps.length, rate: r.rate, total: r.total, trace: toWalk(r.steps, 'sheet', 'sheetUpTo') });
  }

  // ------------------------------------------------------------------ applied vs actual, and the closing entry (slides 34, 40–46, 67)
  // kind: 'hour' (rate per hour or machine hour) or 'pct' (rate as a % of direct labor cost)
  // roles: journal, formula, code
  function overheadClose({ actualOH, rate, actualBase, kind = 'hour', baseName = 'actual hours' }) {
    const applied = rate * actualBase;
    const diff = actualOH - applied;
    const under = diff > 0;
    const amt = Math.abs(diff);
    const kindTxt = diff === 0 ? 'exactly applied' : under ? 'underapplied' : 'overapplied';
    const rateTxt = kind === 'pct' ? `${PCT(rate)} of ${P(actualBase)}` : `${C(actualBase)} ${baseName} × ${P2(rate)}`;
    const lines = under
      ? [line(AC.cogs, 'dr', amt, 'diff'), line(AC.foh, 'cr', amt, 'diff')]
      : [line(AC.foh, 'dr', amt, 'diff'), line(AC.cogs, 'cr', amt, 'diff')];
    const rows = [
      { id: 'actual', label: 'Actual overhead incurred (debits to Factory Overhead)', amount: actualOH, anchor: 'actual' },
      { id: 'applied', label: `Applied overhead: ${rateTxt}`, amount: applied, anchor: 'applied' },
      { id: 'diff', label: under ? 'Underapplied overhead' : 'Overapplied overhead', amount: amt, style: 'total', anchor: 'diff' },
    ];
    const steps = [
      { row: 'actual', math: 'actual', label: `Actual overhead for the year: ${P(actualOH)}`, vars: { actualOH } },
      { row: 'applied', math: 'applied', label: `Applied = ${kind === 'pct' ? `${PCT(rate)} × ${C(actualBase)}` : `${C(actualBase)} × ${P2(rate)}`} = ${P(applied)}`, vars: { applied } },
      { row: 'diff', math: 'diff', label: `${C(actualOH)} − ${C(applied)}: ${kindTxt} by ${P(amt)}`, vars: { diff }, tone: under ? 'bad' : 'good' },
      { entry: 'close', code: 'diff', math: 'diff', label: under ? 'Underapplied → debit COGS, credit Factory Overhead' : 'Overapplied → debit Factory Overhead, credit COGS', vars: { cogsChange: under ? amt : -amt }, tone: 'good' },
    ];
    return clean({
      applied, actualOH, diff, amt, under, kind: kindTxt,
      cogsEffect: under ? 'increases' : 'decreases',
      rows,
      entries: [{ id: 'close', date: 'Dec 31', memo: under ? 'Close the shortfall: COGS goes up.' : 'Remove the excess: COGS goes down.', lines }],
      trace: toTrace(steps),
    });
  }
  // Company X and Company Y side by side (slide 34)
  function twoCompanies({ x, y }) {
    const ax = overheadClose({ actualOH: x.actualOH, rate: x.rate, actualBase: x.actualBase, kind: x.kind });
    const ay = overheadClose({ actualOH: y.actualOH, rate: y.rate, actualBase: y.actualBase, kind: y.kind });
    const signed = (r) => r.diff;
    return clean({
      x: ax, y: ay,
      rows: [
        { id: 'actual', label: 'Actual overhead', amounts: [x.actualOH, y.actualOH] },
        { id: 'base', label: 'Actual base (machine hours · DL cost)', amounts: [x.actualBase, y.actualBase], format: 'number' },
        { id: 'applied', label: 'Applied overhead', amounts: [ax.applied, ay.applied] },
        { id: 'diff', label: 'Under / (over)applied', amounts: [signed(ax), signed(ay)], style: 'total' },
      ],
    });
  }

  // Scene view: one company at a time (x, y or Pampanga p).
  function pickCompany({ twoco, pampanga, which }) {
    if (which === 'p') return overheadClose({ actualOH: pampanga.actualOH, rate: pampanga.budgetOH / pampanga.budgetDLH, actualBase: pampanga.actualDLH, baseName: 'actual DLH' });
    const c = which === 'y' ? twoco.y : twoco.x;
    return overheadClose({ actualOH: c.actualOH, rate: c.rate, actualBase: c.actualBase, kind: c.kind, baseName: 'machine hours' });
  }

  // ------------------------------------------------------------------ proration (Cavite, slide 44)
  // roles: journal, formula, code
  function prorateCore({ amount, kind, wip, fg, cogs }) {
    const total = wip + fg + cogs;
    const accts = [
      { id: 'wip', name: AC.wip, bal: wip },
      { id: 'fg', name: AC.fg, bal: fg },
      { id: 'cogs', name: AC.cogs, bal: cogs },
    ].map((a) => ({ ...a, share: a.bal / total, adj: (amount * a.bal) / total }));
    const over = kind === 'over';
    const dir = over ? 'Decrease' : 'Increase';
    const rows = [
      ...accts.map((a) => ({ id: a.id, label: `${a.name} (${PCT(a.share)} of total)`, amounts: [a.bal, a.adj], anchor: 'share' })),
      { id: 'total', label: 'Total', amounts: [total, amount], style: 'total', anchor: 'total' },
    ];
    const lines = over
      ? [line(AC.foh, 'dr', amount, 'total'), ...accts.map((a) => line(a.name, 'cr', a.adj, 'share'))]
      : [...accts.map((a) => line(a.name, 'dr', a.adj, 'share')), line(AC.foh, 'cr', amount, 'total')];
    const steps = [
      { row: 'total', math: 'total', label: `Applied overhead left in the three accounts: ${C(wip)} + ${C(fg)} + ${C(cogs)} = ${P(total)}`, vars: { total } },
      ...accts.map((a) => ({ row: a.id, math: 'share', label: `${a.name}: ${C(a.bal)} ÷ ${C(total)} = ${PCT(a.share)}; × ${C(amount)} = ${P(a.adj)}`, vars: { share: a.share, adj: a.adj } })),
      { entry: 'prorate', math: 'total', code: 'total', label: `${dir} all three; Factory Overhead is ${over ? 'debited' : 'credited'} ${P(amount)} and closes to zero`, vars: { factoryOverhead: 0 }, tone: 'good' },
    ];
    return { total, accts, rows, steps, over,
      entries: [{ id: 'prorate', date: 'Dec 31', memo: over ? 'Overapplied: every account carried too much overhead.' : 'Underapplied: every account carried too little overhead.', lines }] };
  }
  function prorate(args) {
    const r = prorateCore(args);
    const byId = Object.fromEntries(r.accts.map((a) => [a.id, a]));
    return clean({
      total: r.total,
      wipShare: byId.wip.share, fgShare: byId.fg.share, cogsShare: byId.cogs.share,
      wipAdj: byId.wip.adj, fgAdj: byId.fg.adj, cogsAdj: byId.cogs.adj,
      direction: r.over ? 'decrease' : 'increase',
      rows: r.rows, entries: r.entries, trace: toTrace(r.steps),
    });
  }
  function prorateSheet(args) {
    const r = prorateCore(args);
    return clean({ rows: reveal(r.rows, r.steps, args.upTo), total: r.total });
  }
  // roles: sheet
  function prorateWalk(args) {
    const r = prorateCore(args);
    return clean({ steps: r.steps.length, total: r.total, trace: toWalk(r.steps, 'sheet', 'sheetUpTo') });
  }

  // ------------------------------------------------------------------ departmental and plantwide rates (slides 49–53)
  function rateOf(d) { return d.budgetOH / d.budgetBase; }
  function ohOf(kind, rate, dept) {
    if (kind === 'dlcost') return rate * dept.dl;
    if (kind === 'mh') return rate * dept.mh;
    return rate * (dept.dlh ?? 0);
  }
  const baseTxt = (kind) => (kind === 'dlcost' ? 'of direct labor cost' : kind === 'mh' ? 'per machine hour' : 'per direct labor hour');
  const rateTxt = (kind, rate) => (kind === 'dlcost' ? `${PCT(rate)} of DL cost` : `${P2(rate)} ${baseTxt(kind)}`);
  // Example 6: one rate per department.
  function deptRates({ budget }) {
    const ra = rateOf(budget.a), rb = rateOf(budget.b);
    const plant = budget.plantDLCost ? (budget.a.budgetOH + budget.b.budgetOH) / budget.plantDLCost : null;
    return clean({
      rateA: ra, rateB: rb, plantRate: plant,
      rows: [
        { id: 'a', label: `${budget.a.name}: ${C(budget.a.budgetOH)} ÷ ${C(budget.a.budgetBase)}`, amount: ra, format: kind2fmt(budget.a.kind) },
        { id: 'b', label: `${budget.b.name}: ${C(budget.b.budgetOH)} ÷ ${C(budget.b.budgetBase)}`, amount: rb, format: kind2fmt(budget.b.kind) },
      ],
    });
  }
  function kind2fmt(kind) { return kind === 'dlcost' ? 'pct' : 'money'; }

  // Examples 7–8: Job 105 under departmental rates vs one plantwide DL-cost rate.
  // roles: journal, formula, code. Scene walk role: sheet.
  function deptJobCore({ budget, a, b, units, plantRate, method = 'dept' }) {
    const ra = rateOf(budget.a), rb = rateOf(budget.b);
    const ohA = ohOf(budget.a.kind, ra, a), ohB = ohOf(budget.b.kind, rb, b);
    const dm = a.dm + b.dm, dl = a.dl + b.dl, oh = ohA + ohB;
    const total = dm + dl + oh;
    const unit = total / units;
    const plantOH = plantRate * dl;
    const plantTotal = dm + dl + plantOH;
    const plantUnit = plantTotal / units;
    const gap = total - plantTotal;
    const rows = [
      { id: 'dm', label: 'Direct materials', amounts: [a.dm, b.dm, dm], anchor: 'dm' },
      { id: 'dl', label: 'Direct labor', amounts: [a.dl, b.dl, dl], anchor: 'dl' },
      { id: 'oh', label: `Applied overhead (A: ${rateTxt(budget.a.kind, ra)}; B: ${rateTxt(budget.b.kind, rb)})`, amounts: [ohA, ohB, oh], anchor: 'dept-oh' },
      { id: 'total', label: 'Total job cost', amounts: [a.dm + a.dl + ohA, b.dm + b.dl + ohB, total], style: 'total', anchor: 'dept-total' },
    ];
    const plantRows = [
      { id: 'p-oh', label: `Plantwide: ${C(dl)} DL cost × ${PCT(plantRate)}`, amount: plantOH, anchor: 'plant-oh' },
      { id: 'p-total', label: `Plantwide job cost: ${C(dm)} + ${C(dl)} + ${C(plantOH)}`, amount: plantTotal, style: 'subtotal', anchor: 'plant-total' },
      { id: 'gap', label: 'Departmental − plantwide (undercosting)', amount: gap, style: 'total', anchor: 'gap' },
    ];
    const steps = [
      { reveal: ['dm:0', 'dl:0'], row: 'dm', math: 'dm', label: `Dept. A traces ${P2(a.dm)} of materials and ${P2(a.dl)} of labor`, vars: { dmA: a.dm, dlA: a.dl } },
      { reveal: ['oh:0'], row: 'oh', math: 'dept-oh', label: `Dept. A overhead: ${C(a.dl)} × ${PCT(ra)} = ${P2(ohA)} (labor-cost base)`, vars: { ohA } },
      { reveal: ['total:0'], row: 'total', math: 'dept-total', label: `Dept. A subtotal: ${C(a.dm)} + ${C(a.dl)} + ${fmt(ohA, '2f')} = ${P2(a.dm + a.dl + ohA)}`, vars: { subtotalA: a.dm + a.dl + ohA } },
      { reveal: ['dm:1', 'dl:1'], row: 'dl', math: 'dl', label: `Dept. B traces ${P2(b.dm)} of materials and ${P2(b.dl)} of labor`, vars: { dmB: b.dm, dlB: b.dl } },
      { reveal: ['oh:1'], row: 'oh', math: 'dept-oh', label: `Dept. B overhead: ${C(b.mh)} MH × ${P2(rb)} = ${P2(ohB)} (machine-hour base)`, vars: { ohB } },
      { reveal: ['total:1'], row: 'total', math: 'dept-total', label: `Dept. B subtotal: ${C(b.dm)} + ${C(b.dl)} + ${fmt(ohB, '2f')} = ${P2(b.dm + b.dl + ohB)}`, vars: { subtotalB: b.dm + b.dl + ohB } },
      { reveal: ['dm:2', 'dl:2', 'oh:2', 'total:2'], row: 'total', math: 'dept-total', label: `Job 105: ${P2(total)}; unit cost ${P2(total)} ÷ ${units} = ${P2(unit)}`, vars: { total, unit }, tone: 'good' },
      { reveal: ['p-oh'], row: 'p-oh', math: 'plant-oh', label: `One plantwide rate: ${C(dl)} × ${PCT(plantRate)} = ${P2(plantOH)} of overhead`, vars: { plantOH } },
      { reveal: ['p-total'], row: 'p-total', math: 'plant-total', label: `Plantwide job cost: ${C(dm)} + ${C(dl)} + ${fmt(plantOH, '2f')} = ${P2(plantTotal)}`, vars: { plantTotal } },
      { reveal: ['gap'], row: 'gap', math: 'gap', label: `Gap: ${fmt(total, '2f')} − ${fmt(plantTotal, '2f')} = ${P2(gap)} understated by the plantwide rate`, vars: { gap }, tone: 'bad' },
    ];
    return { ra, rb, ohA, ohB, dm, dl, oh, total, unit, plantOH, plantTotal, plantUnit, gap, rows: [...rows, ...plantRows], steps };
  }
  function deptJob(args) {
    const r = deptJobCore(args);
    return clean({ rateA: r.ra, rateB: r.rb, ohA: r.ohA, ohB: r.ohB, oh: r.oh, total: r.total, unit: r.unit,
      plantOH: r.plantOH, plantTotal: r.plantTotal, plantUnit: r.plantUnit, gap: r.gap,
      rows: r.rows.slice(0, 4), plantRows: r.rows.slice(4), trace: toTrace(r.steps) });
  }
  function deptJobSheet(args) {
    const r = deptJobCore(args);
    const rows = reveal(r.rows, r.steps, args.upTo);
    return clean({ rows: rows.slice(0, 4), plantRows: rows.slice(4), total: r.total, plantTotal: r.plantTotal, gap: r.gap, unit: r.unit });
  }
  // roles: sheet (departmental schedule), plant (plantwide schedule)
  function deptJobWalk(args) {
    const r = deptJobCore(args);
    const trace = r.steps.map((s, i) => clean({
      label: s.label, vars: s.vars ?? {}, patch: { sheetUpTo: i + 1 },
      ops: [{ role: i < 7 ? 'sheet' : 'plant', cmd: 'highlight', args: { sel: `row:${s.row}`, tone: s.tone ?? 'accent' } }],
    }));
    return clean({ steps: r.steps.length, total: r.total, gap: r.gap, trace });
  }
  // Toggle view for the scene: one method at a time.
  function methodView({ budget, a, b, units, plantRate, method }) {
    const r = deptJobCore({ budget, a, b, units, plantRate });
    const dept = method === 'dept';
    const oh = dept ? r.oh : r.plantOH;
    const total = dept ? r.total : r.plantTotal;
    return clean({
      oh, total, unit: total / units,
      rows: [
        { id: 'dm', label: 'Direct materials', amount: r.dm },
        { id: 'dl', label: 'Direct labor', amount: r.dl },
        { id: 'oh', label: dept ? 'Overhead: departmental rates' : `Overhead: plantwide ${PCT(plantRate)} of DL cost`, amount: oh },
        { id: 'total', label: 'Total cost of Job 105', amount: total, style: 'total' },
        { id: 'unit', label: `Unit cost (${units} units)`, amount: total / units, style: 'subtotal' },
      ],
    });
  }

  // ------------------------------------------------------------------ the full cost flow of one job (Bulacan Prints, slides 57–61)
  const FLOW = [
    { id: 'e1', dr: 'wip', cr: 'rm', key: 'dm', what: 'Issue materials to the job', anchor: 'dm' },
    { id: 'e2', dr: 'wip', cr: 'wages', key: 'dl', what: 'Direct labor on the job', anchor: 'dl' },
    { id: 'e3', dr: 'wip', cr: 'foh', key: 'oh', what: 'Apply overhead to the job', anchor: 'oh' },
    { id: 'e4', dr: 'fg', cr: 'wip', key: 'total', what: 'Job completed', anchor: 'total' },
    { id: 'e5', dr: 'cogs', cr: 'fg', key: 'total', what: 'Job sold', anchor: 'total' },
  ];
  function flowCore({ dm, dl, oh, price }) {
    const total = dm + dl + oh;
    const gm = price - total;
    const v = { dm, dl, oh, total };
    const entries = FLOW.map((f) => ({ id: f.id, memo: f.what, lines: [line(AC[f.dr], 'dr', v[f.key], f.anchor), line(AC[f.cr], 'cr', v[f.key], f.anchor)] }));
    return { total, gm, margin: gm / price, v, entries };
  }
  // roles: journal, formula, code
  function costFlow({ dm, dl, oh, price }) {
    const r = flowCore({ dm, dl, oh, price });
    const steps = [
      { entry: 'e1', math: 'dm', label: `(1) Debit WIP, credit Raw Materials Inventory ${P(dm)}`, vars: { dm } },
      { entry: 'e2', math: 'dl', label: `(2) Debit WIP, credit Wages Payable ${P(dl)}`, vars: { dl } },
      { entry: 'e3', math: 'oh', label: `(3) Debit WIP, credit Factory Overhead ${P(oh)}`, vars: { oh } },
      { row: 'total', math: 'total', label: `WIP now holds ${C(dm)} + ${C(dl)} + ${C(oh)} = ${P(r.total)}, an asset`, vars: { total: r.total } },
      { entry: 'e4', math: 'total', label: `(4) Finished: debit Finished Goods, credit WIP ${P(r.total)}`, vars: { wip: 0, fg: r.total } },
      { entry: 'e5', math: 'total', label: `(5) Sold: debit COGS, credit Finished Goods ${P(r.total)}; now an expense`, vars: { fg: 0, cogs: r.total } },
      { row: 'gm', math: 'gm', label: `Gross margin: ${C(price)} − ${C(r.total)} = ${P(r.gm)} (${fmt(r.margin, 'pct1')})`, vars: { gm: r.gm }, tone: 'good' },
    ];
    return clean({
      total: r.total, gm: r.gm, margin: r.margin,
      rows: [
        { id: 'dm', label: 'Direct materials', amount: dm, anchor: 'dm' },
        { id: 'dl', label: 'Direct labor', amount: dl, anchor: 'dl' },
        { id: 'oh', label: 'Applied overhead', amount: oh, anchor: 'oh' },
        { id: 'total', label: 'Total job cost', amount: r.total, style: 'total', anchor: 'total' },
        { id: 'price', label: 'Sales price', amount: price },
        { id: 'gm', label: 'Gross margin on the job', amount: r.gm, style: 'total', anchor: 'gm' },
      ],
      entries: r.entries,
      accounts: flowAccounts(r, 5),
      trace: toTrace(steps),
    });
  }
  function flowAccounts(r, upTo) {
    const acc = {};
    for (const k of ['wip', 'fg', 'cogs']) acc[k] = { id: k, name: AC[k], debits: [], credits: [] };
    FLOW.slice(0, upTo).forEach((f, i) => {
      if (acc[f.dr]) acc[f.dr].debits.push({ amount: r.v[f.key], ref: `(${i + 1})` });
      if (acc[f.cr]) acc[f.cr].credits.push({ amount: r.v[f.key], ref: `(${i + 1})` });
    });
    return ['wip', 'fg', 'cogs'].map((k) => acc[k]);
  }
  function flowSheet({ dm, dl, oh, price, upTo }) {
    const r = flowCore({ dm, dl, oh, price });
    const n = upTo ?? 5;
    const where = n <= 3 ? 'Work in Process (asset)' : n === 4 ? 'Finished Goods (asset)' : 'Cost of Goods Sold (expense)';
    return clean({ accounts: flowAccounts(r, n), posted: n, where: n === 0 ? 'not started' : where, total: r.total, gm: r.gm, entries: r.entries });
  }
  // roles: jr (Journal), ta (TAccounts)
  function flowWalk({ dm, dl, oh, price }) {
    const r = flowCore({ dm, dl, oh, price });
    return clean({
      steps: FLOW.length, total: r.total,
      trace: FLOW.map((f, i) => ({
        label: `(${i + 1}) ${f.what}: debit ${AC[f.dr]}, credit ${AC[f.cr]} ${P(r.v[f.key])}`,
        vars: { amt: r.v[f.key] },
        patch: { flowUpTo: i + 1 },
        ops: [
          { role: 'jr', cmd: 'post', args: { id: f.id } },
          { role: 'jr', cmd: 'highlight', args: { sel: `entry:${f.id}` } },
          ...(['wip', 'fg', 'cogs'].includes(f.dr) || ['wip', 'fg', 'cogs'].includes(f.cr)
            ? [{ role: 'ta', cmd: 'highlight', args: { sel: [f.dr, f.cr].filter((k) => ['wip', 'fg', 'cogs'].includes(k)).map((k) => `account:${k}`) } }]
            : []),
        ],
      })),
    });
  }

  // ------------------------------------------------------------------ several jobs: COGM, ending WIP, COGS, ending FG (slide 62)
  function cogmCore({ jobs, begFG }) {
    const begWip = sum(jobs.map((j) => j.beg));
    const added = sum(jobs.map((j) => j.added));
    const toAccount = begWip + added;
    const jt = jobs.map((j) => ({ ...j, total: j.beg + j.added }));
    const endWip = sum(jt.filter((j) => j.status === 'wip').map((j) => j.total));
    const cogm = sum(jt.filter((j) => j.status !== 'wip').map((j) => j.total));
    const available = begFG + cogm;
    const endFG = sum(jt.filter((j) => j.status === 'finished').map((j) => j.total));
    const cogs = available - endFG;
    const names = (st) => jt.filter((j) => j.status === st).map((j) => `Job ${j.id}`).join(', ');
    const rows = [
      { id: 'beg-wip', label: 'Beginning Work in Process', amount: begWip, anchor: 'beg-wip' },
      { id: 'added', label: `Costs added this month (${jt.map((j) => C(j.added)).join(' + ')})`, amount: added, anchor: 'added' },
      { id: 'to-account', label: 'Total manufacturing costs to account for', amount: toAccount, style: 'subtotal' },
      { id: 'end-wip', label: `Less ending Work in Process (${names('wip') || 'none'})`, amount: endWip, indent: 1, anchor: 'end-wip' },
      { id: 'cogm', label: 'Cost of goods manufactured', amount: cogm, style: 'total', anchor: 'cogm' },
      { id: 'beg-fg', label: 'Beginning Finished Goods', amount: begFG, anchor: 'beg-fg' },
      { id: 'available', label: 'Goods available for sale', amount: available, style: 'subtotal' },
      { id: 'end-fg', label: `Less ending Finished Goods (${names('finished') || 'none'})`, amount: endFG, indent: 1, anchor: 'end-fg' },
      { id: 'cogs', label: 'Cost of goods sold', amount: cogs, style: 'total', anchor: 'cogs' },
    ];
    const steps = [
      { row: 'beg-wip', math: 'beg-wip', label: `Carried in from last month: ${P(begWip)} of work in process`, vars: { begWip } },
      { row: 'added', math: 'added', label: `This month's DM + DL + applied OH on all jobs: ${P(added)}`, vars: { added } },
      { row: 'to-account', math: 'added', code: 'added', label: `To account for: ${C(begWip)} + ${C(added)} = ${P(toAccount)}`, vars: { toAccount } },
      { row: 'end-wip', math: 'end-wip', label: `Still in process: ${names('wip')}, ${P(endWip)}`, vars: { endWip } },
      { row: 'cogm', math: 'cogm', label: `COGM = ${C(toAccount)} − ${C(endWip)} = ${P(cogm)} (completed jobs only)`, vars: { cogm }, tone: 'good' },
      { row: 'beg-fg', math: 'beg-fg', label: `Finished goods on hand at the start: ${P(begFG)}`, vars: { begFG } },
      { row: 'available', math: 'cogm', code: 'cogm', label: `Available for sale: ${C(begFG)} + ${C(cogm)} = ${P(available)}`, vars: { available } },
      { row: 'end-fg', math: 'end-fg', label: `Finished but unsold: ${names('finished')}, ${P(endFG)}`, vars: { endFG } },
      { row: 'cogs', math: 'cogs', label: `COGS = ${C(available)} − ${C(endFG)} = ${P(cogs)} (sold jobs only)`, vars: { cogs }, tone: 'good' },
    ];
    const jobRows = jt.map((j) => ({ id: `job-${j.id}`, label: `Job ${j.id}`, amounts: [j.beg, j.added, j.total, j.status === 'sold' ? 'sold' : j.status === 'finished' ? 'finished, unsold' : 'in process'] }));
    return { begWip, added, toAccount, endWip, cogm, available, endFG, cogs, rows, steps, jobRows };
  }
  // roles: journal, formula, code
  function jobsCogm(args) {
    const r = cogmCore(args);
    return clean({ begWip: r.begWip, added: r.added, toAccount: r.toAccount, endWip: r.endWip, cogm: r.cogm, available: r.available, endFG: r.endFG, cogs: r.cogs,
      rows: r.rows, jobRows: r.jobRows, trace: toTrace(r.steps) });
  }
  function cogmSheet(args) {
    const r = cogmCore(args);
    return clean({ rows: reveal(r.rows, r.steps, args.upTo), jobRows: r.jobRows, cogm: r.cogm, cogs: r.cogs, endFG: r.endFG, endWip: r.endWip });
  }
  // roles: sheet
  function cogmWalk(args) {
    const r = cogmCore(args);
    return clean({ steps: r.steps.length, cogm: r.cogm, cogs: r.cogs, trace: toWalk(r.steps, 'sheet', 'sheetUpTo') });
  }

  // ------------------------------------------------------------------ a professional-services engagement (slide 69)
  // roles: journal, formula, code
  function engagement({ staff, direct, ohPct }) {
    const parts = staff.map((s) => s.hours * s.rate);
    const labor = sum(parts);
    const oh = ohPct * labor;
    const total = labor + direct + oh;
    const rows = [
      ...staff.map((s, i) => ({ id: `s-${i + 1}`, label: `${s.role}: ${C(s.hours)} h × ${P(s.rate)}`, amount: parts[i], indent: 1, anchor: 'labor' })),
      { id: 'labor', label: 'Direct labor (professional time)', amount: labor, style: 'subtotal', anchor: 'labor' },
      { id: 'direct', label: 'Direct costs (filing and registration fees)', amount: direct, anchor: 'direct' },
      { id: 'oh', label: `Applied overhead: ${PCT(ohPct)} of professional labor`, amount: oh, anchor: 'oh' },
      { id: 'total', label: 'Total engagement cost', amount: total, style: 'total', anchor: 'total' },
    ];
    const steps = [
      ...staff.map((s, i) => ({ row: `s-${i + 1}`, math: 'labor', label: `${s.role} time: ${C(s.hours)} × ${C(s.rate)} = ${P(parts[i])}`, vars: { [s.role.toLowerCase()]: parts[i] } })),
      { row: 'labor', math: 'labor', label: `Professional labor: ${parts.map(C).join(' + ')} = ${P(labor)}`, vars: { labor } },
      { row: 'direct', math: 'direct', label: `Fees paid for the client are traced like direct materials: ${P(direct)}`, vars: { direct } },
      { row: 'oh', math: 'oh', label: `Overhead: ${PCT(ohPct)} × ${C(labor)} = ${P(oh)}`, vars: { oh } },
      { row: 'total', math: 'total', label: `Engagement cost: ${C(labor)} + ${C(direct)} + ${C(oh)} = ${P(total)}`, vars: { total }, tone: 'good' },
    ];
    return clean({ labor, oh, total, rows, trace: toTrace(steps) });
  }

  // ------------------------------------------------------------------ job profitability after the fact (slide 73)
  function jobProfit({ price, est, actual }) {
    const estCost = est.dm + est.dl + est.oh;
    const actCost = actual.dm + actual.dl + actual.oh;
    const estProfit = price - estCost;
    const profit = price - actCost;
    return clean({
      estCost, actCost, estProfit, profit,
      markupOnEst: estProfit / estCost,
      plannedMargin: estProfit / price,
      margin: profit / price,
      dmVar: actual.dm - est.dm, dlVar: actual.dl - est.dl, ohVar: actual.oh - est.oh,
      rows: [
        { id: 'dm', label: 'Direct materials', amounts: [est.dm, actual.dm, actual.dm - est.dm] },
        { id: 'dl', label: 'Direct labor', amounts: [est.dl, actual.dl, actual.dl - est.dl] },
        { id: 'oh', label: 'Applied overhead', amounts: [est.oh, actual.oh, actual.oh - est.oh] },
        { id: 'cost', label: 'Total cost', amounts: [estCost, actCost, actCost - estCost], style: 'subtotal', anchor: 'act-cost' },
        { id: 'price', label: 'Quoted price', amounts: [price, price, 0] },
        { id: 'profit', label: 'Profit on the job', amounts: [estProfit, profit, profit - estProfit], style: 'total', anchor: 'profit' },
        { id: 'margin', label: 'Profit ÷ price', amounts: [estProfit / price, profit / price, profit / price - estProfit / price], format: 'pct', anchor: 'profit' },
      ],
    });
  }

  // ------------------------------------------------------------------ classification board (slide 17)
  function classifyBoard({ items }) {
    return clean({
      chips: items.map((x) => ({ id: x.id, label: x.label })),
      bins: [{ id: 'job', label: 'Job-order costing' }, { id: 'process', label: 'Process costing' }],
      solution: Object.fromEntries(items.map((x) => [x.id, x.system])),
    });
  }

  // ------------------------------------------------------------------ application case: Malolos Signs & Steel (synthetic)
  function caseQuote({ budget, job, markup }) {
    const rf = rateOf(budget.fab), rp = rateOf(budget.paint);
    const ohF = rf * job.fab.mh, ohP = rp * job.paint.dl;
    const dm = job.fab.dm + job.paint.dm, dl = job.fab.dl + job.paint.dl;
    const total = dm + dl + ohF + ohP;
    const plantRate = (budget.fab.budgetOH + budget.paint.budgetOH) / budget.plantDLCost;
    const plantOH = plantRate * dl;
    const plantTotal = dm + dl + plantOH;
    return clean({
      rateFab: rf, ratePaint: rp, ohFab: ohF, ohPaint: ohP, oh: ohF + ohP, dm, dl, total, unit: total / job.units,
      price: total * (1 + markup), plantRate, plantOH, plantTotal, plantPrice: plantTotal * (1 + markup),
      rateRows: [
        { id: 'fab', label: `${budget.fab.name}: ${C(budget.fab.budgetOH)} ÷ ${C(budget.fab.budgetBase)} MH`, amount: rf },
        { id: 'paint', label: `${budget.paint.name}: ${C(budget.paint.budgetOH)} ÷ ${C(budget.paint.budgetBase)} DL cost`, amount: rp, format: 'pct' },
        { id: 'plant', label: `Plantwide: ${C(budget.fab.budgetOH + budget.paint.budgetOH)} ÷ ${C(budget.plantDLCost)} DL cost`, amount: plantRate, format: 'pct' },
      ],
      sheet: [
        { id: 'dm', label: 'Direct materials', amounts: [job.fab.dm, job.paint.dm, dm] },
        { id: 'dl', label: 'Direct labor', amounts: [job.fab.dl, job.paint.dl, dl] },
        { id: 'oh', label: 'Applied overhead', amounts: [ohF, ohP, ohF + ohP] },
        { id: 'total', label: 'Job cost', amounts: [job.fab.dm + job.fab.dl + ohF, job.paint.dm + job.paint.dl + ohP, total], style: 'total' },
      ],
      quoteRows: [
        { id: 'dept', label: 'Departmental rates: cost', amounts: [total, total * (1 + markup)] },
        { id: 'plant', label: 'One plantwide rate: cost', amounts: [plantTotal, plantTotal * (1 + markup)] },
      ],
    });
  }
  function caseYearEnd({ budget, year, treatment = 'close' }) {
    const rf = rateOf(budget.fab), rp = rateOf(budget.paint);
    const applied = rf * year.fabMH + rp * year.paintDL;
    const close = overheadClose({ actualOH: year.actualOH, rate: 1, actualBase: applied });
    const pr = prorate({ amount: close.amt, kind: close.under ? 'under' : 'over', wip: year.wip, fg: year.fg, cogs: year.cogs });
    return clean({
      applied, actualOH: year.actualOH, amt: close.amt, kind: close.kind, pctOfOH: close.amt / year.actualOH,
      rows: [
        { id: 'fab', label: `Fabrication applied: ${C(year.fabMH)} MH × ${P(rf)}`, amount: rf * year.fabMH },
        { id: 'paint', label: `Painting applied: ${PCT(rp)} × ${C(year.paintDL)}`, amount: rp * year.paintDL },
        { id: 'applied', label: 'Total applied overhead', amount: applied, style: 'subtotal' },
        { id: 'actual', label: 'Actual overhead', amount: year.actualOH },
        { id: 'diff', label: close.under ? 'Underapplied overhead' : 'Overapplied overhead', amount: close.amt, style: 'total' },
      ],
      closeEntries: close.entries,
      prorateEntries: pr.entries,
      prorateRows: pr.rows,
      entries: treatment === 'prorate' ? pr.entries : close.entries,
      cogsHit: treatment === 'prorate' ? pr.cogsAdj : close.amt,
    });
  }

  // ------------------------------------------------------------------ quiz generators
  const nice = (rng, lo, hi, step) => rng.int(Math.ceil(lo / step), Math.floor(hi / step)) * step;
  const shuffleAccounts = (rng, extra = []) => rng.shuffle([...new Set([AC.wip, AC.foh, AC.cogs, AC.fg, AC.rm, AC.wages, AC.ap, ...extra])]);

  function pohrQ({ rng, difficulty }) {
    for (;;) {
      const rate = rng.pick(difficulty === 1 ? [20, 25, 40, 50, 60] : [45, 60, 75, 80, 120, 150]);
      const budgetBase = nice(rng, 20000, 60000, 5000);
      const budgetOH = rate * budgetBase;
      const actualBase = budgetBase + nice(rng, -4000, 4000, 500);
      if (actualBase === budgetBase) continue;
      const dm = nice(rng, 20000, 90000, 1000);
      const hours = nice(rng, 100, 300, 10);
      const wage = rng.pick([80, 90, 95, 100, 110, 120]);
      const r = pohrCore({ budgetOH, budgetBase, dm, hours, wage });
      return {
        vars: { budgetOH, budgetBase, actualBase, rate, dm, hours, wage, dl: r.dl, oh: r.oh, total: r.total,
          wrongActual: budgetOH / actualBase, wrongInverse: budgetBase / budgetOH, wrongOhWage: rate * r.dl, wrongNoOh: dm + r.dl },
        misconceptions: [
          { var: 'wrongActual', feedback: 'You divided by **actual** hours. The predetermined rate is set before the year starts, from **budgeted** hours.' },
          { var: 'wrongInverse', feedback: 'That is hours per peso. The rate is budgeted overhead **÷** budgeted activity.' },
        ],
      };
    }
  }

  function jobQ({ rng, difficulty }) {
    for (;;) {
      const nIss = difficulty >= 2 ? 3 : 2;
      const issues = Array.from({ length: nIss }, (_, i) => ({ date: `8/${3 + i * 5}`, amount: nice(rng, 300, 2500, 50) }));
      const labor = [
        { week: 'Week 1', hours: nice(rng, 80, 200, 10), wage: rng.pick([6, 6.5, 7, 7.5, 8]) },
        { week: 'Week 2', hours: nice(rng, 60, 180, 10), wage: rng.pick([6.25, 7.25, 8.5, 9]) },
      ];
      const rate = rng.pick([3, 3.5, 4, 4.5, 5]);
      const markup = rng.pick([0.25, 0.3, 0.4, 0.5]);
      const r = jobSheetCore({ issues, labor, rate, markup });
      if (labor[0].wage === labor[1].wage) continue;
      const wrongOhPeso = rate * r.dl;
      const wrongMarkupOnPrice = r.total / (1 - markup);
      return {
        vars: { issues, labor, rate, markup, dm: r.dm, dl: r.dl, hours: r.hours, oh: r.oh, total: r.total, price: r.price, markupAmt: r.markupAmt,
          i1: issues[0].amount, i2: issues[1].amount, i3: issues[2]?.amount ?? 0, issueText: issues.map((x) => `${P(x.amount)} on ${x.date}`).join(', '),
          h1: labor[0].hours, w1: labor[0].wage, h2: labor[1].hours, w2: labor[1].wage,
          wrongOhPeso, wrongNoOh: r.dm + r.dl, wrongMarkupOnPrice, wrongOneWage: r.hours * labor[0].wage },
        misconceptions: [
          { var: 'wrongNoOh', feedback: 'You left out applied overhead. Every job cost sheet carries DM + DL + **applied overhead**.' },
          { var: 'wrongOhPeso', feedback: 'You applied the rate to labor **pesos**. This rate is per direct labor **hour**.' },
        ],
      };
    }
  }

  function closeQ({ rng, difficulty }) {
    for (;;) {
      const kind = difficulty >= 2 && rng.bool(0.5) ? 'pct' : 'hour';
      const rate = kind === 'pct' ? rng.pick([0.8, 1.2, 1.25, 1.5, 1.75]) : rng.pick([2, 4, 12, 15, 60, 150]);
      const actualBase = kind === 'pct' ? nice(rng, 100000, 400000, 2000) : nice(rng, 10000, 100000, 500);
      const applied = rate * actualBase;
      const actualOH = Math.round((applied + nice(rng, -0.08 * applied, 0.08 * applied, 1000)) / 1000) * 1000;
      const r = overheadClose({ actualOH, rate, actualBase, kind });
      if (r.amt === 0 || r.amt < 1000) continue;
      return {
        vars: { kind, rate, actualBase, actualOH, applied: r.applied, amt: r.amt, diff: r.diff, kindTxt: r.kind,
          rateText: kind === 'pct' ? `${PCT(rate)} of direct labor cost` : `${P2(rate)} per machine hour`,
          baseText: kind === 'pct' ? `${P(actualBase)} of direct labor cost` : `${C(actualBase)} machine hours`,
          accounts: shuffleAccounts(rng), entries: [{ lines: quizLines(r.entries[0].lines) }],
          signedDiff: r.diff, wrongBudget: Math.abs(actualOH - rate * actualBase * 1.05) },
        options: [
          `${r.under ? 'Underapplied' : 'Overapplied'} by ${P(r.amt)}; Cost of Goods Sold ${r.under ? 'increases' : 'decreases'}`,
          `${r.under ? 'Overapplied' : 'Underapplied'} by ${P(r.amt)}; Cost of Goods Sold ${r.under ? 'decreases' : 'increases'}`,
          `${r.under ? 'Underapplied' : 'Overapplied'} by ${P(r.amt)}; Cost of Goods Sold ${r.under ? 'decreases' : 'increases'}`,
          `No adjustment: a predetermined rate always applies exactly the actual overhead`,
        ],
        answer: 0,
      };
    }
  }

  function prorateQ({ rng, difficulty }) {
    for (;;) {
      const sharesPool = [[20, 30, 50], [10, 20, 70], [25, 25, 50], [15, 25, 60], [8, 12, 80], [30, 20, 50]];
      const sh = rng.pick(sharesPool);
      const total = nice(rng, 400000, 2000000, 100000);
      const wip = (total * sh[0]) / 100, fg = (total * sh[1]) / 100, cogs = (total * sh[2]) / 100;
      const amount = nice(rng, 10000, 120000, 5000);
      const kind = rng.bool(0.5) ? 'over' : 'under';
      const r = prorate({ amount, kind, wip, fg, cogs });
      const pc = prorateCore({ amount, kind, wip, fg, cogs });
      if ([r.wipAdj, r.fgAdj, r.cogsAdj].some((x) => Math.abs(x - Math.round(x)) > 1e-9)) continue;
      if (difficulty === 1 && kind === 'under') continue;
      return {
        vars: { amount, kind, kindTxt: kind === 'over' ? 'overapplied' : 'underapplied', wip, fg, cogs, total: r.total,
          wipAdj: r.wipAdj, fgAdj: r.fgAdj, cogsAdj: r.cogsAdj, wipPct: sh[0] / 100, fgPct: sh[1] / 100, cogsPct: sh[2] / 100,
          direction: r.direction,
          accounts: shuffleAccounts(rng), entries: [{ lines: quizLines(pc.entries[0].lines) }],
          wrongEqual: amount / 3, wrongAll: amount },
        misconceptions: [
          { var: 'wrongEqual', feedback: 'You split the amount equally. Proration follows each account\'s **share of applied overhead**.' },
          { var: 'wrongAll', feedback: 'That is the whole amount, the immaterial treatment (all to COGS). A material amount is **prorated**.' },
        ],
      };
    }
  }

  function deptQ({ rng, difficulty }) {
    for (;;) {
      const aPct = rng.pick([1.25, 1.5, 0.8, 1.125, 2]);
      const bRate = rng.pick([6, 7.5, 8, 10, 12.5]);
      const a = { dm: nice(rng, 20, 80, 5), dl: nice(rng, 20, 60, 4), mh: rng.int(2, 8) };
      const b = { dm: nice(rng, 20, 80, 5), dl: nice(rng, 10, 40, 5), mh: rng.int(8, 25) };
      const units = rng.pick([10, 20, 25, 40, 50]);
      const budget = { a: { budgetOH: aPct * 80000, budgetBase: 80000, kind: 'dlcost', name: 'Department A' }, b: { budgetOH: bRate * 10000, budgetBase: 10000, kind: 'mh', name: 'Department B' } };
      const plantRate = rng.pick([1.6, 1.8, 2, 2.2]);
      const r = deptJobCore({ budget, a, b, units, plantRate });
      if (Math.abs(r.gap) < 1) continue;
      const ohAWrong = aPct * a.mh;
      return {
        vars: { aPct, bRate, a, b, units, plantRate, ohA: r.ohA, ohB: r.ohB, oh: r.oh, total: r.total, unit: r.unit,
          plantOH: r.plantOH, plantTotal: r.plantTotal, gap: r.gap, absGap: Math.abs(r.gap), gapDir: r.gap > 0 ? 'undercosts' : 'overcosts',
          aDm: a.dm, aDl: a.dl, aMh: a.mh, bDm: b.dm, bDl: b.dl, bMh: b.mh, dl: a.dl + b.dl, dm: a.dm + b.dm,
          wrongBothDL: aPct * a.dl + bRate * b.dl, wrongNoUnits: r.total, wrongPlantMH: plantRate * (a.mh + b.mh) },
        misconceptions: [
          { var: 'wrongBothDL', feedback: 'Department B applies overhead per **machine hour**, not on labor pesos. Each department uses its own base.' },
          { value: r.ohA + bRate * b.dl, feedback: 'Department B\'s base is machine hours; you multiplied its rate by direct labor cost.' },
        ],
      };
    }
  }

  function flowQ({ rng }) {
    const dm = nice(rng, 20000, 90000, 500);
    const dl = nice(rng, 5000, 30000, 100);
    const oh = nice(rng, 3000, 20000, 100);
    const price = Math.round(((dm + dl + oh) * rng.pick([1.4, 1.6, 1.8, 2])) / 1000) * 1000;
    const r = flowCore({ dm, dl, oh, price });
    const pick = rng.pick([0, 2, 3, 4]);
    const e = r.entries[pick];
    return {
      vars: { dm, dl, oh, price, total: r.total, gm: r.gm, margin: r.margin,
        event: ['The materials were issued to the job.', '', 'Overhead was applied to the job.', 'The job was completed.', 'The job was delivered to the customer and sold.'][pick],
        accounts: rng.shuffle([AC.wip, AC.rm, AC.wages, AC.foh, AC.fg, AC.cogs, AC.ap]),
        entries: [{ lines: quizLines(e.lines) }],
        wrongCogsDm: dm, wrongGmNoOh: price - dm - dl },
      misconceptions: [
        { var: 'wrongGmNoOh', feedback: 'Gross margin subtracts the **full** job cost, including applied overhead.' },
        { value: price, feedback: 'That is the price. Gross margin is price minus the job cost that moved to COGS.' },
      ],
    };
  }

  function cogmQ({ rng, difficulty }) {
    for (;;) {
      const jobs = [
        { id: String(rng.int(201, 209)), beg: nice(rng, 10000, 50000, 1000), added: nice(rng, 10000, 60000, 1000), status: 'sold' },
        { id: String(rng.int(210, 219)), beg: 0, added: nice(rng, 20000, 80000, 1000), status: 'finished' },
        { id: String(rng.int(220, 229)), beg: 0, added: nice(rng, 5000, 40000, 100), status: 'wip' },
      ];
      if (difficulty >= 2) jobs.push({ id: String(rng.int(230, 239)), beg: 0, added: nice(rng, 10000, 50000, 1000), status: 'sold' });
      const begFG = nice(rng, 5000, 40000, 1000);
      const r = cogmCore({ jobs, begFG });
      const rows = r.rows.map((x) => ({ ...x }));
      const blanks = new Set(['cogm', 'cogs', 'end-wip', ...(difficulty >= 2 ? ['end-fg'] : [])]);
      return {
        vars: {
          jobs, begFG, cogm: r.cogm, cogs: r.cogs, endWip: r.endWip, endFG: r.endFG, begWip: r.begWip, added: r.added,
          jobText: jobs.map((j) => `Job ${j.id}: ${j.beg ? `beginning WIP ${P(j.beg)}, ` : ''}costs added ${P(j.added)}, ${j.status === 'sold' ? 'completed and sold' : j.status === 'finished' ? 'completed, not yet sold' : 'still in process'}`).join('; '),
          rows: rows.map((x) => clean({ label: x.label, amount: x.amount, style: x.style, indent: x.indent, blank: blanks.has(x.id) || undefined })),
          wrongCogmAll: r.toAccount, wrongCogsNoBeg: r.cogs - begFG,
        },
        misconceptions: [
          { var: 'wrongCogmAll', feedback: 'COGM counts **completed** jobs only. The job still in process stays in ending WIP.' },
          { var: 'wrongCogsNoBeg', feedback: 'COGS includes the beginning finished goods that were sold this period.' },
        ],
      };
    }
  }

  function engagementQ({ rng }) {
    const staff = [
      { role: 'Partner', hours: nice(rng, 10, 60, 5), rate: rng.pick([6000, 7500, 8000, 9000]) },
      { role: 'Associate', hours: nice(rng, 40, 200, 10), rate: rng.pick([1800, 2000, 2500, 3000]) },
    ];
    const direct = nice(rng, 5000, 40000, 1000);
    const ohPct = rng.pick([0.4, 0.5, 0.6, 0.75]);
    const r = engagement({ staff, direct, ohPct });
    return {
      vars: { ph: staff[0].hours, pr: staff[0].rate, ah: staff[1].hours, ar: staff[1].rate, direct, ohPct, labor: r.labor, oh: r.oh, total: r.total,
        wrongOhOnAll: ohPct * (r.labor + direct), wrongNoOh: r.labor + direct },
      misconceptions: [
        { value: r.labor + direct + ohPct * (r.labor + direct), feedback: 'Overhead is a percentage of **professional labor** only, not of labor plus the client fees.' },
        { var: 'wrongNoOh', feedback: 'You left out the firm overhead applied to the engagement.' },
      ],
    };
  }

  function markupQ({ rng }) {
    const total = nice(rng, 3000, 150000, 25);
    const markup = rng.pick([0.2, 0.25, 0.3, 0.4, 0.5]);
    return {
      vars: { total, markup, price: total * (1 + markup), wrongMargin: total / (1 - markup), wrongOnlyMarkup: total * markup },
      misconceptions: [
        { var: 'wrongMargin', feedback: 'You treated the markup as a margin on price (cost ÷ (1 − m)). A markup **on cost** is cost × (1 + m).' },
        { var: 'wrongOnlyMarkup', feedback: 'That is only the markup. The price is cost **plus** the markup.' },
      ],
    };
  }

  function profitQ({ rng }) {
    for (;;) {
      const est = { dm: nice(rng, 30000, 80000, 1000), dl: nice(rng, 20000, 50000, 1000), oh: nice(rng, 10000, 30000, 1000) };
      const estCost = est.dm + est.dl + est.oh;
      const markup = rng.pick([0.2, 0.25, 0.3]);
      const price = Math.round((estCost * (1 + markup)) / 1000) * 1000;
      const actual = { dm: est.dm + nice(rng, -2000, 12000, 1000), dl: est.dl + nice(rng, -2000, 5000, 1000), oh: est.oh };
      const r = jobProfit({ price, est, actual });
      if (r.profit <= 0 || r.actCost === estCost) continue;
      return {
        vars: { price, estCost, ...Object.fromEntries(Object.entries(actual).map(([k, v]) => [`a_${k}`, v])), actCost: r.actCost, profit: r.profit, margin: r.margin,
          markupPct: markup, wrongOnCost: r.profit / r.actCost, wrongEstProfit: (price - estCost) / price },
        misconceptions: [
          { var: 'wrongOnCost', feedback: 'You divided by cost. A profit **margin** divides profit by the **price**.' },
          { var: 'wrongEstProfit', feedback: 'That is the margin the quote planned on the estimate, not the actual margin.' },
        ],
      };
    }
  }

  function appliedQ({ rng }) {
    for (;;) {
      const rate = rng.pick([40, 60, 75, 90, 120, 150]);
      const actualBase = nice(rng, 10000, 40000, 500);
      const applied = rate * actualBase;
      const actualOH = applied + nice(rng, -200000, 200000, 5000);
      if (actualOH === applied) continue;
      const r = overheadClose({ actualOH, rate, actualBase });
      return {
        vars: { rate, actualBase, actualOH, applied, amt: r.amt, kindTxt: r.kind, budgetBase: actualBase + nice(rng, 500, 3000, 500) },
        misconceptions: [
          { value: actualOH, feedback: 'That is actual overhead. Applied overhead is the predetermined rate × the **actual** base.' },
          { value: rate * (actualBase + 1000), feedback: 'Use the actual base worked, not the budgeted base.' },
        ],
      };
    }
  }

  return {
    fns: {
      jobSheet, jobSheetSheet, jobSheetWalk, pohr, rateOnly, pohrSheet, pohrWalk, overheadClose, twoCompanies,
      prorate, prorateSheet, prorateWalk, deptRates, deptJob, deptJobSheet, deptJobWalk, methodView,
      pickCompany, costFlow, flowSheet, flowWalk, jobsCogm, cogmSheet, cogmWalk, engagement, jobProfit,
      caseQuote, caseYearEnd,
    },
    generators: { pohrQ, jobQ, closeQ, prorateQ, deptQ, flowQ, cogmQ, engagementQ, markupQ, profitQ, appliedQ },
  };
}
