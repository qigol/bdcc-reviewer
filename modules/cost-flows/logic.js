export default function register(sdk) {
  const { fmt, sum } = sdk;
  const P = (x) => fmt(x, 'money');
  const P2 = (x) => fmt(x, 'money2');
  const C = (x) => fmt(x, 'comma');
  const PCT = (x) => fmt(x, 'pct1').replace('.0%', '%');

  // Account titles as the supplemental notes print them (slides 11–16), in title case.
  const A = {
    rm: 'Raw Materials', ap: 'Accounts Payable', wip: 'Work in Process', moh: 'Manufacturing Overhead',
    wse: 'Wage and Salary Expense', swp: 'Salaries and Wages Payable', ie: 'Insurance Expense', pi: 'Prepaid Insurance',
    ae: 'Advertising Expense', de: 'Depreciation Expense', ad: 'Accumulated Depreciation', fg: 'Finished Goods',
    ar: 'Accounts Receivable', sales: 'Sales', cogs: 'Cost of Goods Sold',
  };

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
      if (s.entry) ops.push({ role: 'journal', cmd: 'highlight', args: { sel: `entry:${s.entry}`, tone: s.tone ?? 'accent' } });
      if (s.account) ops.push({ role: 'journal', cmd: 'highlight', args: { sel: `account:${s.account}`, tone: s.tone ?? 'accent' } });
      return clean({ label: s.label, math: s.math, code: s.code ?? s.math, vars: s.vars ?? {}, ops });
    });
  }
  function toWalk(steps, key, role) {
    return steps.map((s, i) => clean({
      label: s.label, vars: s.vars ?? {}, patch: { [key]: i + 1 },
      ops: s.row ? [{ role: s.role ?? role, cmd: 'highlight', args: { sel: `row:${s.row}`, tone: s.tone ?? 'accent' } }] : [],
    }));
  }
  const line = (account, side, amount, anchor) => clean(side === 'dr' ? { account, debit: amount, anchor } : { account, credit: amount, anchor });
  const quizLines = (lines) => lines.map(({ account, debit, credit }) => (debit !== undefined ? { account, debit } : { account, credit }));

  // ------------------------------------------------------------------ cost terms and a cost equation (slides 2–4)
  function costEquation({ intercept, slope, x }) {
    const y = intercept + slope * x;
    return clean({
      y, variable: slope * x,
      rows: [
        { id: 'fixed', label: 'Fixed part (intercept)', amount: intercept, anchor: 'fixed' },
        { id: 'var', label: `Variable part: ₱${fmt(slope, '2f')} × ${C(x)} DLH`, amount: slope * x, anchor: 'var' },
        { id: 'y', label: 'Predicted utilities cost', amount: y, style: 'total', anchor: 'y' },
      ],
      trace: toTrace([
        { row: 'fixed', math: 'fixed', label: `Fixed part: ${P(intercept)} a month, whatever the hours`, vars: { intercept } },
        { row: 'var', math: 'var', label: `Variable part: ${fmt(slope, '2f')} × ${C(x)} = ${P(slope * x)}`, vars: { variable: slope * x } },
        { row: 'y', math: 'y', label: `Predicted cost: ${C(intercept)} + ${C(slope * x)} = ${P(y)}`, vars: { y }, tone: 'good' },
      ]),
    });
  }
  // DM, DL, MOH totals into prime and conversion cost
  function costTotals({ dm, dl, moh, selling, admin }) {
    return clean({
      prime: dm + dl, conversion: dl + moh, product: dm + dl + moh, period: selling + admin,
      rows: [
        { id: 'dm', label: 'Direct materials', amount: dm, anchor: 'prime' },
        { id: 'dl', label: 'Direct labor', amount: dl, anchor: 'prime' },
        { id: 'moh', label: 'Manufacturing overhead', amount: moh, anchor: 'conv' },
        { id: 'prime', label: 'Prime cost (DM + DL)', amount: dm + dl, style: 'subtotal', anchor: 'prime' },
        { id: 'conv', label: 'Conversion cost (DL + MOH)', amount: dl + moh, style: 'subtotal', anchor: 'conv' },
        { id: 'product', label: 'Product (manufacturing) costs', amount: dm + dl + moh, style: 'total', anchor: 'product' },
        { id: 'period', label: 'Period costs (selling + administrative)', amount: selling + admin, style: 'total', anchor: 'period' },
      ],
    });
  }

  // ------------------------------------------------------------------ POHR and a job (Parker, slides 6–7)
  function parkerJob({ budgetOH, budgetMH, job }) {
    const rate = budgetOH / budgetMH;
    const oh = rate * job.mh;
    const total = job.dm + job.dl + oh;
    const steps = [
      { row: 'rate', math: 'rate', label: `POHR = ${C(budgetOH)} ÷ ${C(budgetMH)} MH = ${P(rate)} per MH`, vars: { rate } },
      { row: 'dm', math: 'total', label: `Direct materials ${P(job.dm)} and direct labor ${P(job.dl)} are traced`, vars: { dm: job.dm, dl: job.dl } },
      { row: 'oh', math: 'oh', label: `Overhead applied: ${C(job.mh)} MH × ${P(rate)} = ${P(oh)}`, vars: { oh } },
      { row: 'total', math: 'total', label: `Job cost: ${C(job.dm)} + ${C(job.dl)} + ${C(oh)} = ${P(total)}`, vars: { total }, tone: 'good' },
    ];
    return clean({
      rate, oh, total,
      rows: [
        { id: 'rate', label: `POHR: ${C(budgetOH)} ÷ ${C(budgetMH)} machine-hours`, amount: rate, anchor: 'rate' },
        { id: 'dm', label: 'Direct materials', amount: job.dm, anchor: 'total' },
        { id: 'dl', label: 'Direct labor', amount: job.dl, anchor: 'total' },
        { id: 'oh', label: `Manufacturing overhead (${C(job.mh)} MH × ${P(rate)}/MH)`, amount: oh, anchor: 'oh' },
        { id: 'total', label: 'Total cost', amount: total, style: 'total', anchor: 'total' },
      ],
      entries: [{ id: 'apply', memo: 'Overhead applied to the job', lines: [line(A.wip, 'dr', oh, 'oh'), line(A.moh, 'cr', oh, 'oh')] }],
      trace: toTrace(steps),
    });
  }

  // Job 2B47's cost sheet from its documents (slide 9).
  function sheetCore({ requisition, reqs, tickets, rate, units }) {
    const reqLines = requisition.lines.map((l) => l.qty * l.cost);
    const dm = sum(reqs.map((r) => r.amount));
    const dl = sum(tickets.map((t) => t.amount));
    const hours = sum(tickets.map((t) => t.hours));
    const oh = hours * rate;
    const total = dm + dl + oh;
    const unit = total / units;
    const rows = [
      { id: 'dm-head', label: 'Direct materials (requisitions)', style: 'heading' },
      ...reqs.map((r, i) => ({ id: `req-${i + 1}`, label: `Req. No. ${r.no}`, amount: r.amount, indent: 1, anchor: 'dm' })),
      { id: 'dm', label: 'Total direct materials', amount: dm, style: 'subtotal', anchor: 'dm' },
      { id: 'dl-head', label: 'Direct labor (time tickets)', style: 'heading' },
      ...tickets.map((t, i) => ({ id: `tt-${i + 1}`, label: `Ticket ${t.no}: ${t.hours} hours`, amount: t.amount, indent: 1, anchor: 'dl' })),
      { id: 'dl', label: `Total direct labor (${hours} hours)`, amount: dl, style: 'subtotal', anchor: 'dl' },
      { id: 'oh', label: `Manufacturing overhead: ${hours} DLH × ${P(rate)}/DLH`, amount: oh, anchor: 'oh' },
      { id: 'total', label: 'Total cost', amount: total, style: 'total', anchor: 'total' },
      { id: 'unit', label: `Unit cost (${C(units)} units)`, amount: unit, style: 'subtotal', anchor: 'unit' },
    ];
    const steps = [
      { row: 'req-1', math: 'dm', label: `Req. ${requisition.no}: ${requisition.lines.map((l, i) => `${l.qty} × ${P2(l.cost)} = ${P(reqLines[i])}`).join('; ')}`, vars: { req: reqLines[0] + reqLines[1] } },
      ...reqs.slice(1).map((r, i) => ({ row: `req-${i + 2}`, math: 'dm', label: `Req. ${r.no}: ${P(r.amount)}`, vars: { req: r.amount } })),
      { row: 'dm', math: 'dm', label: `Direct materials: ${reqs.map((r) => C(r.amount)).join(' + ')} = ${P(dm)}`, vars: { dm } },
      ...tickets.map((t, i) => ({ row: `tt-${i + 1}`, math: 'dl', label: `Ticket ${t.no}: ${t.hours} hours, ${P(t.amount)}`, vars: { hours: t.hours } })),
      { row: 'dl', math: 'dl', label: `Direct labor: ${P(dl)} for ${hours} hours`, vars: { dl, hours } },
      { row: 'oh', math: 'oh', label: `Overhead: ${hours} DLH × ${P(rate)} = ${P(oh)}`, vars: { oh } },
      { row: 'total', math: 'total', label: `Total: ${C(dm)} + ${C(dl)} + ${C(oh)} = ${P(total)}`, vars: { total }, tone: 'good' },
      { row: 'unit', math: 'unit', label: `Unit cost: ${C(total)} ÷ ${units} = ${P2(unit)}`, vars: { unit }, tone: 'good' },
    ];
    return { dm, dl, hours, oh, total, unit, reqTotal: sum(reqLines), rows, steps };
  }
  function jobSheet(args) {
    const r = sheetCore(args);
    return clean({ dm: r.dm, dl: r.dl, hours: r.hours, oh: r.oh, total: r.total, unit: r.unit, req14873: Math.round(r.reqTotal * 100) / 100, rows: r.rows, trace: toTrace(r.steps) });
  }
  function jobSheetSheet(args) {
    const r = sheetCore(args);
    return clean({ rows: reveal(r.rows, r.steps, args.upTo), total: r.total, unit: r.unit });
  }
  // roles: sheet
  function jobSheetWalk(args) {
    const r = sheetCore(args);
    return clean({ steps: r.steps.length, total: r.total, unit: r.unit, trace: toWalk(r.steps, 'sheetUpTo', 'sheet') });
  }
  // Mary Holden's time ticket: direct vs indirect labor (slide 9)
  function timeTicket({ holden }) {
    const lines = holden.map((t) => ({ ...t, amount: t.hours * t.rate }));
    const total = sum(lines.map((l) => l.amount));
    const indirect = sum(lines.filter((l) => l.job === 'Maintenance').map((l) => l.amount));
    return clean({ total, indirect, direct: total - indirect,
      rows: lines.map((l, i) => ({ id: `h-${i + 1}`, label: `${l.start}–${l.end}, ${l.job === 'Maintenance' ? 'maintenance (indirect labor)' : `Job ${l.job}`}: ${l.hours} h × ${P(l.rate)}`, amount: l.amount }))
        .concat([{ id: 'h-total', label: 'Total for the day', amount: total, style: 'total' }]) });
  }

  // ------------------------------------------------------------------ the full job-order cycle (Reeder, slides 11–16)
  // Returns entries a–k plus the numbers the slides derive.
  function cycleCore(d) {
    const rate = d.est.oh / d.est.dl;
    const applied = rate * d.labor.direct;
    const insFactory = d.insurance.total * d.insurance.factoryPct;
    const insSA = d.insurance.total - insFactory;
    const actualOH = d.issued.indirect + d.labor.indirect + d.utilities + insFactory + d.depreciation.factory;
    const E = [
      { id: 'a', memo: `Raw materials purchased on account`, lines: [line(A.rm, 'dr', d.purchases, 'a'), line(A.ap, 'cr', d.purchases, 'a')] },
      { id: 'b', memo: `Materials issued: ${P(d.issued.direct)} direct, ${P(d.issued.indirect)} indirect`, lines: [line(A.wip, 'dr', d.issued.direct, 'b'), line(A.moh, 'dr', d.issued.indirect, 'b'), line(A.rm, 'cr', d.issued.direct + d.issued.indirect, 'b')] },
      { id: 'c', memo: 'Employee services: direct labor, indirect labor, selling and administrative salaries', lines: [line(A.wip, 'dr', d.labor.direct, 'c'), line(A.moh, 'dr', d.labor.indirect, 'c'), line(A.wse, 'dr', d.labor.sa, 'c'), line(A.swp, 'cr', d.labor.direct + d.labor.indirect + d.labor.sa, 'c')] },
      { id: 'd', memo: 'Factory utilities', lines: [line(A.moh, 'dr', d.utilities, 'd'), line(A.ap, 'cr', d.utilities, 'd')] },
      { id: 'e', memo: `Insurance expired: ${PCT(d.insurance.factoryPct)} factory, the rest selling and administrative`, lines: [line(A.moh, 'dr', insFactory, 'e'), line(A.ie, 'dr', insSA, 'e'), line(A.pi, 'cr', d.insurance.total, 'e')] },
      { id: 'f', memo: 'Advertising', lines: [line(A.ae, 'dr', d.advertising, 'f'), line(A.ap, 'cr', d.advertising, 'f')] },
      { id: 'g', memo: 'Depreciation on factory and on selling and administrative assets', lines: [line(A.moh, 'dr', d.depreciation.factory, 'g'), line(A.de, 'dr', d.depreciation.sa, 'g'), line(A.ad, 'cr', d.depreciation.factory + d.depreciation.sa, 'g')] },
      { id: 'h', memo: `Overhead applied: ${PCT(rate)} of ${P(d.labor.direct)} direct labor cost`, lines: [line(A.wip, 'dr', applied, 'h'), line(A.moh, 'cr', applied, 'h')] },
      { id: 'i', memo: 'Jobs completed and transferred to the finished goods warehouse', lines: [line(A.fg, 'dr', d.completed, 'i'), line(A.wip, 'cr', d.completed, 'i')] },
      { id: 'j', memo: 'Sales on account', lines: [line(A.ar, 'dr', d.sales, 'j'), line(A.sales, 'cr', d.sales, 'j')] },
      { id: 'k', memo: 'Cost of the goods sold', lines: [line(A.cogs, 'dr', d.costSold, 'k'), line(A.fg, 'cr', d.costSold, 'k')] },
    ];
    const bal = {
      rm: d.opening.rm + d.purchases - d.issued.direct - d.issued.indirect,
      wip: d.opening.wip + d.issued.direct + d.labor.direct + applied - d.completed,
      fg: d.opening.fg + d.completed - d.costSold,
      cogs: d.costSold,
    };
    const diff = actualOH - applied;
    return { rate, applied, actualOH, diff, under: diff > 0, amt: Math.abs(diff), insFactory, insSA, E, bal, d };
  }
  // T-accounts after the first `upTo` entries (opening balances shown as "Bal")
  const TA = [
    { id: 'rm', name: A.rm, open: 'rm' }, { id: 'wip', name: A.wip, open: 'wip' }, { id: 'moh', name: A.moh },
    { id: 'fg', name: A.fg, open: 'fg' }, { id: 'cogs', name: A.cogs },
  ];
  function accountsAfter(c, upTo) {
    const acc = Object.fromEntries(TA.map((t) => [t.id, { id: t.id, name: t.name, debits: t.open ? [{ amount: c.d.opening[t.open], ref: 'Bal' }] : [], credits: [] }]));
    const byName = Object.fromEntries(TA.map((t) => [t.name, t.id]));
    c.E.slice(0, upTo).forEach((e) => e.lines.forEach((l) => {
      const id = byName[l.account];
      if (!id) return;
      if (l.debit !== undefined) acc[id].debits.push({ amount: l.debit, ref: `(${e.id})` });
      else acc[id].credits.push({ amount: l.credit, ref: `(${e.id})` });
    }));
    return TA.map((t) => acc[t.id]);
  }
  // roles: journal, formula, code
  function cycle({ d }) {
    const c = cycleCore(d);
    const steps = c.E.map((e) => ({ entry: e.id, math: e.id,
      label: `(${e.id}) ${e.memo}`, vars: Object.fromEntries([[`entry_${e.id}`, sum(e.lines.filter((l) => l.debit !== undefined).map((l) => l.debit))]]) }));
    return clean({
      rate: c.rate, applied: c.applied, actualOH: c.actualOH, diff: c.diff, amt: c.amt, kind: c.under ? 'underapplied' : 'overapplied',
      insFactory: c.insFactory, insSA: c.insSA, endRM: c.bal.rm, endWIP: c.bal.wip, endFG: c.bal.fg,
      entries: c.E, accounts: accountsAfter(c, 11),
      rateRows: [
        { id: 'est-oh', label: 'Estimated manufacturing overhead', amount: d.est.oh, anchor: 'applied' },
        { id: 'est-dl', label: '÷ Estimated direct labor cost', amount: d.est.dl, anchor: 'applied' },
        { id: 'rate', label: '= Predetermined rate (of direct labor cost)', amount: c.rate, format: 'pct', style: 'subtotal', anchor: 'applied' },
        { id: 'applied', label: `Applied: ${PCT(c.rate)} × ${P(d.labor.direct)}`, amount: c.applied, style: 'total', anchor: 'applied' },
      ],
      trace: toTrace(steps),
    });
  }
  function ledgerSheet({ d, upTo }) {
    const c = cycleCore(d);
    return clean({ accounts: accountsAfter(c, upTo ?? 11), entries: c.E, posted: upTo ?? 11 });
  }
  const touched = (e) => [...new Set(e.lines.map((l) => TA.find((t) => t.name === l.account)?.id).filter(Boolean))];
  // roles: jr (Journal), ta (TAccounts)
  function ledgerWalk({ d }) {
    const c = cycleCore(d);
    return clean({
      steps: c.E.length, applied: c.applied, actualOH: c.actualOH,
      trace: c.E.map((e, i) => ({
        label: `(${e.id}) ${e.memo}`,
        vars: { [`entry_${e.id}`]: sum(e.lines.filter((l) => l.debit !== undefined).map((l) => l.debit)) },
        patch: { ledgerUpTo: i + 1 },
        ops: [
          { role: 'jr', cmd: 'post', args: { id: e.id } },
          { role: 'jr', cmd: 'highlight', args: { sel: `entry:${e.id}` } },
          ...touched(e).length ? [{ role: 'ta', cmd: 'highlight', args: { sel: touched(e).map((k) => `account:${k}`) } }] : [],
        ],
      })),
    });
  }
  // Ending balances with the T-accounts (roles: journal)
  function balances({ d }) {
    const c = cycleCore(d);
    const steps = [
      { account: 'rm', math: 'rm', label: `Raw Materials: ${C(d.opening.rm)} + ${C(d.purchases)} − ${C(d.issued.direct + d.issued.indirect)} = ${P(c.bal.rm)}`, vars: { rm: c.bal.rm } },
      { account: 'wip', math: 'wip', label: `WIP: ${C(d.opening.wip)} + ${C(d.issued.direct)} + ${C(d.labor.direct)} + ${C(c.applied)} − ${C(d.completed)} = ${P(c.bal.wip)}`, vars: { wip: c.bal.wip } },
      { account: 'moh', math: 'moh', label: `Manufacturing Overhead: ${C(c.actualOH)} debits − ${C(c.applied)} credit = ${P(c.amt)} ${c.under ? 'debit (underapplied)' : 'credit (overapplied)'}`, vars: { moh: c.diff } },
      { account: 'fg', math: 'fg', label: `Finished Goods: ${C(d.opening.fg)} + ${C(d.completed)} − ${C(d.costSold)} = ${P(c.bal.fg)}`, vars: { fg: c.bal.fg } },
      { account: 'cogs', math: 'cogs', label: `Cost of Goods Sold before adjustment: ${P(d.costSold)}`, vars: { cogs: d.costSold } },
    ];
    const accounts = accountsAfter(c, 11).map((a) => ({ ...a, debits: a.debits.map((x) => ({ ...x, anchor: a.id })), credits: a.credits.map((x) => ({ ...x, anchor: a.id })) }));
    return clean({ rm: c.bal.rm, wip: c.bal.wip, fg: c.bal.fg, moh: c.diff, cogs: d.costSold, cogm: d.completed, accounts, trace: toTrace(steps) });
  }

  // Disposition: close to COGS, or allocate on ending balances (slide 14)
  function disposeCore(d, method) {
    const c = cycleCore(d);
    const base = { wip: c.bal.wip, fg: c.bal.fg, cogs: c.bal.cogs };
    const tot = base.wip + base.fg + base.cogs;
    const share = { wip: base.wip / tot, fg: base.fg / tot, cogs: base.cogs / tot };
    // Whole pesos; COGS takes the rounding difference so the three add to the balance.
    const adj = { wip: Math.round(c.amt * share.wip), fg: Math.round(c.amt * share.fg) };
    adj.cogs = c.amt - adj.wip - adj.fg;
    const names = { wip: A.wip, fg: A.fg, cogs: A.cogs };
    let lines;
    if (method === 'allocate') {
      lines = c.under
        ? [...['wip', 'fg', 'cogs'].map((k) => line(names[k], 'dr', adj[k], 'dispose')), line(A.moh, 'cr', c.amt, 'dispose')]
        : [line(A.moh, 'dr', c.amt, 'dispose'), ...['wip', 'fg', 'cogs'].map((k) => line(names[k], 'cr', adj[k], 'dispose'))];
    } else {
      lines = c.under ? [line(A.cogs, 'dr', c.amt, 'dispose'), line(A.moh, 'cr', c.amt, 'dispose')] : [line(A.moh, 'dr', c.amt, 'dispose'), line(A.cogs, 'cr', c.amt, 'dispose')];
    }
    const cogsAdj = method === 'allocate' ? adj.cogs : c.amt;
    const adjustedCogs = c.bal.cogs + (c.under ? cogsAdj : -cogsAdj);
    return { c, base, tot, share, adj, lines, adjustedCogs, cogsAdj };
  }
  // roles: journal, formula, code
  function dispose({ d, method = 'close' }) {
    const r = disposeCore(d, method);
    const c = r.c;
    const rows = [
      { id: 'actual', label: 'Actual overhead costs incurred', amount: c.actualOH, anchor: 'diff' },
      { id: 'applied', label: `Applied overhead (${PCT(c.rate)} of ${P(d.labor.direct)})`, amount: c.applied, anchor: 'diff' },
      { id: 'diff', label: c.under ? 'Underapplied overhead' : 'Overapplied overhead', amount: c.amt, style: 'total', anchor: 'diff' },
    ];
    const allocRows = ['wip', 'fg', 'cogs'].map((k) => ({ id: `al-${k}`, label: `${{ wip: A.wip, fg: A.fg, cogs: A.cogs }[k]} (${PCT(r.share[k])} of ${P(r.tot)})`, amounts: [r.base[k], r.adj[k]], anchor: 'alloc' }))
      .concat([{ id: 'al-tot', label: 'Total', amounts: [r.tot, c.amt], style: 'total', anchor: 'alloc' }]);
    const steps = [
      { row: 'actual', math: 'diff', label: `Actual overhead (debits in the account): ${P(c.actualOH)}`, vars: { actualOH: c.actualOH } },
      { row: 'applied', math: 'diff', label: `Applied (the credit): ${P(c.applied)}`, vars: { applied: c.applied } },
      { row: 'diff', math: 'diff', label: `${c.under ? 'Underapplied' : 'Overapplied'} by ${P(c.amt)}`, vars: { amt: c.amt }, tone: c.under ? 'bad' : 'good' },
      ...(method === 'allocate'
        ? ['wip', 'fg', 'cogs'].map((k) => ({ row: `al-${k}`, math: 'alloc', label: `${{ wip: 'WIP', fg: 'Finished Goods', cogs: 'COGS' }[k]}: ${C(r.base[k])} ÷ ${C(r.tot)} = ${PCT(r.share[k])} → ${P(r.adj[k])}`, vars: { [`adj_${k}`]: r.adj[k] } }))
        : []),
      { entry: 'dispose', math: 'dispose', label: method === 'allocate' ? 'Allocate the balance to the three accounts' : `Close the balance to Cost of Goods Sold: COGS becomes ${P(r.adjustedCogs)}`, vars: { adjustedCogs: r.adjustedCogs }, tone: 'good' },
    ];
    return clean({
      amt: c.amt, kind: c.under ? 'underapplied' : 'overapplied', actualOH: c.actualOH, applied: c.applied,
      wipShare: r.share.wip, fgShare: r.share.fg, cogsShare: r.share.cogs, wipAdj: r.adj.wip, fgAdj: r.adj.fg, cogsAdj: r.adj.cogs,
      adjustedCogs: r.adjustedCogs, rows, allocRows,
      entries: [{ id: 'dispose', date: 'Year end', memo: method === 'allocate' ? 'Allocate the balance in proportion to ending balances' : 'Close the balance to Cost of Goods Sold', lines: r.lines }],
      trace: toTrace(steps),
    });
  }

  // The income statement (slide 15)
  function incomeCore(d, method) {
    const r = disposeCore(d, method);
    const sa = [
      { label: 'Wage and Salary Expense', amount: d.labor.sa },
      { label: 'Insurance Expense', amount: r.c.insSA },
      { label: 'Advertising Expense', amount: d.advertising },
      { label: 'Depreciation Expense', amount: d.depreciation.sa },
    ];
    const totalSA = sum(sa.map((x) => x.amount));
    const gm = d.sales - r.adjustedCogs;
    const ni = gm - totalSA;
    const rows = [
      { id: 'sales', label: 'Sales', amount: d.sales, anchor: 'sales' },
      { id: 'cogs', label: `Cost of Goods Sold (${C(d.costSold)} ${r.c.under ? '+' : '−'} ${C(r.cogsAdj)} ${r.c.under ? 'underapplied' : 'overapplied'})`, amount: r.adjustedCogs, anchor: 'cogs' },
      { id: 'gm', label: 'Gross Margin', amount: gm, style: 'subtotal', anchor: 'gm' },
      { id: 'sa-head', label: 'Less Selling and Administrative Expenses', style: 'heading' },
      ...sa.map((x, i) => ({ id: `sa-${i + 1}`, label: x.label, amount: x.amount, indent: 1, anchor: 'sa' })),
      { id: 'sa', label: 'Total selling and administrative expenses', amount: totalSA, style: 'subtotal', anchor: 'sa' },
      { id: 'ni', label: 'Net Income', amount: ni, style: 'total', anchor: 'ni' },
    ];
    const steps = [
      { row: 'sales', math: 'sales', label: `Sales for the year: ${P(d.sales)}`, vars: { sales: d.sales } },
      { row: 'cogs', math: 'cogs', label: `COGS after the year-end adjustment: ${P(r.adjustedCogs)}`, vars: { cogs: r.adjustedCogs } },
      { row: 'gm', math: 'gm', label: `Gross margin: ${C(d.sales)} − ${C(r.adjustedCogs)} = ${P(gm)}`, vars: { gm } },
      ...sa.map((x, i) => ({ row: `sa-${i + 1}`, math: 'sa', label: `${x.label}: ${P(x.amount)} (a period cost)`, vars: { [`sa${i + 1}`]: x.amount } })),
      { row: 'sa', math: 'sa', label: `Selling and administrative total: ${P(totalSA)}`, vars: { totalSA } },
      { row: 'ni', math: 'ni', label: `Net income: ${C(gm)} − ${C(totalSA)} = ${P(ni)}`, vars: { ni }, tone: 'good' },
    ];
    return { gm, ni, totalSA, adjustedCogs: r.adjustedCogs, rows, steps };
  }
  // roles: journal, formula, code
  function income({ d, method = 'close' }) {
    const r = incomeCore(d, method);
    return clean({ gm: r.gm, ni: r.ni, totalSA: r.totalSA, cogs: r.adjustedCogs, rows: r.rows, trace: toTrace(r.steps) });
  }
  function incomeSheet({ d, method = 'close', upTo }) {
    const r = incomeCore(d, method);
    return clean({ rows: reveal(r.rows, r.steps, upTo), ni: r.ni, gm: r.gm });
  }
  // roles: sheet
  function incomeWalk({ d, method = 'close' }) {
    const r = incomeCore(d, method);
    return clean({ steps: r.steps.length, ni: r.ni, trace: toWalk(r.steps, 'sheetUpTo', 'sheet') });
  }

  // ------------------------------------------------------------------ equivalent units, WA and FIFO (Halsey, slides 21–23)
  function euCore({ beg, completed, end, method }) {
    const cats = ['mat', 'conv'];
    const fifo = method === 'fifo';
    const sc = completed - beg.units;
    const r6 = (x) => Math.round(x * 1e6) / 1e6;
    const finish = { mat: r6(beg.units * (1 - beg.mat)), conv: r6(beg.units * (1 - beg.conv)) };
    const endEu = { mat: r6(end.units * end.mat), conv: r6(end.units * end.conv) };
    const eu = {};
    cats.forEach((k) => { eu[k] = fifo ? finish[k] + sc + endEu[k] : completed + endEu[k]; });
    const rows = fifo
      ? [
          { id: 'finish', label: `Work to complete beginning inventory: ${C(beg.units)} × (100% − ${PCT(beg.mat)} / ${PCT(beg.conv)})`, amounts: [finish.mat, finish.conv], format: 'units', anchor: 'out' },
          { id: 'sc', label: `Units started and completed (${C(completed)} − ${C(beg.units)})`, amounts: [sc, sc], format: 'units', anchor: 'out' },
          { id: 'end', label: `Work in process, ending: ${C(end.units)} × ${PCT(end.mat)} / ${PCT(end.conv)}`, amounts: [endEu.mat, endEu.conv], format: 'units', anchor: 'endw' },
          { id: 'eu', label: 'Equivalent units of production (FIFO)', amounts: [eu.mat, eu.conv], format: 'units', style: 'total', anchor: 'eu' },
        ]
      : [
          { id: 'done', label: 'Units completed and transferred out', amounts: [completed, completed], format: 'units', anchor: 'out' },
          { id: 'end', label: `Work in process, ending: ${C(end.units)} × ${PCT(end.mat)} / ${PCT(end.conv)}`, amounts: [endEu.mat, endEu.conv], format: 'units', anchor: 'endw' },
          { id: 'eu', label: 'Equivalent units of production (weighted-average)', amounts: [eu.mat, eu.conv], format: 'units', style: 'total', anchor: 'eu' },
        ];
    const steps = fifo
      ? [
          { row: 'finish', math: 'out', label: `Finish beginning inventory: materials ${C(finish.mat)}, conversion ${C(finish.conv)}`, vars: { finishConv: finish.conv } },
          { row: 'sc', math: 'out', label: `Started and completed: ${C(completed)} − ${C(beg.units)} = ${C(sc)}`, vars: { sc } },
          { row: 'end', math: 'endw', label: `Ending inventory: ${C(endEu.mat)} materials, ${C(endEu.conv)} conversion`, vars: { endConv: endEu.conv } },
          { row: 'eu', math: 'eu', label: `FIFO EU: ${C(eu.mat)} materials, ${C(eu.conv)} conversion`, vars: { euMat: eu.mat, euConv: eu.conv }, tone: 'good' },
        ]
      : [
          { row: 'done', math: 'out', label: `Transferred out: ${C(completed)} units, 100% for both`, vars: { completed } },
          { row: 'end', math: 'endw', label: `Ending inventory: ${C(end.units)} × ${PCT(end.mat)} = ${C(endEu.mat)}; × ${PCT(end.conv)} = ${C(endEu.conv)}`, vars: { endMat: endEu.mat, endConv: endEu.conv } },
          { row: 'eu', math: 'eu', label: `Weighted-average EU: ${C(eu.mat)} materials, ${C(eu.conv)} conversion`, vars: { euMat: eu.mat, euConv: eu.conv }, tone: 'good' },
        ];
    return { eu, sc, finish, endEu, rows, steps };
  }
  function equivUnits(args) {
    const r = euCore(args);
    return clean({ euMat: r.eu.mat, euConv: r.eu.conv, sc: r.sc, finishMat: r.finish.mat, finishConv: r.finish.conv, rows: r.rows, trace: toTrace(r.steps) });
  }

  // ------------------------------------------------------------------ the production report, WA and FIFO (slides 24–27)
  // Three parts: quantity schedule with EU, unit costs, cost reconciliation.
  function reportCore({ beg, started, completed, end, added, method }) {
    const fifo = method === 'fifo';
    const cats = ['mat', 'conv'];
    const name = { mat: 'Materials', conv: 'Conversion' };
    const e = euCore({ beg, completed, end, method });
    const begCost = { mat: beg.cost.mat, conv: beg.cost.conv };
    const begTotal = begCost.mat + begCost.conv;
    const addedTotal = added.mat + added.conv;
    const totalCost = { mat: begCost.mat + added.mat, conv: begCost.conv + added.conv };
    const unit = {};
    cats.forEach((k) => { unit[k] = (fifo ? added[k] : totalCost[k]) / e.eu[k]; });
    const total = begTotal + addedTotal;
    const q = [
      { id: 'q-head', label: 'Units to be accounted for:', style: 'heading' },
      { id: 'q-beg', label: 'Units in process, beginning', amounts: [beg.units, null, null], format: 'units', indent: 1, anchor: 'qty' },
      { id: 'q-start', label: 'Units started into production', amounts: [started, null, null], format: 'units', indent: 1, anchor: 'qty' },
      { id: 'q-tot', label: 'Total units to account for', amounts: [beg.units + started, null, null], format: 'units', style: 'subtotal', anchor: 'qty' },
      { id: 'q-head2', label: 'Units accounted for as follows:', style: 'heading' },
      ...(fifo
        ? [
            { id: 'q-from-beg', label: 'Units from beginning inventory', amounts: [beg.units, e.finish.mat, e.finish.conv], format: 'units', indent: 1, anchor: 'eu' },
            { id: 'q-sc', label: 'Units started and completed', amounts: [e.sc, e.sc, e.sc], format: 'units', indent: 1, anchor: 'eu' },
          ]
        : [{ id: 'q-done', label: 'Units completed and transferred', amounts: [completed, completed, completed], format: 'units', indent: 1, anchor: 'eu' }]),
      { id: 'q-end', label: 'Units in process, ending', amounts: [end.units, e.endEu.mat, e.endEu.conv], format: 'units', indent: 1, anchor: 'eu' },
      { id: 'q-acc', label: 'Total units accounted for', amounts: [completed + end.units, e.eu.mat, e.eu.conv], format: 'units', style: 'total', anchor: 'eu' },
    ];
    const u = [
      ...(fifo ? [] : [{ id: 'u-beg', label: 'Work in process, beginning', amounts: [begTotal, begCost.mat, begCost.conv], anchor: 'unit' }]),
      { id: 'u-add', label: 'Costs added by the department', amounts: [addedTotal, added.mat, added.conv], anchor: 'unit' },
      ...(fifo ? [] : [{ id: 'u-tot', label: 'Total cost (a)', amounts: [total, totalCost.mat, totalCost.conv], style: 'subtotal', anchor: 'unit' }]),
      { id: 'u-eu', label: 'Equivalent units (b)', amounts: [null, e.eu.mat, e.eu.conv], format: 'units', anchor: 'unit' },
      { id: 'u-unit', label: 'Unit cost (a) ÷ (b)', amounts: [unit.mat + unit.conv, unit.mat, unit.conv], format: 'number', style: 'total', anchor: 'unit' },
    ];
    const r = [];
    let transferred;
    if (fifo) {
      const finishCost = { mat: e.finish.mat * unit.mat, conv: e.finish.conv * unit.conv };
      const fromBeg = begTotal + finishCost.mat + finishCost.conv;
      const scCost = { mat: e.sc * unit.mat, conv: e.sc * unit.conv };
      transferred = fromBeg + scCost.mat + scCost.conv;
      r.push({ id: 'r-head', label: 'Transferred out, units from beginning inventory:', style: 'heading' });
      r.push({ id: 'r-beg', label: 'Cost in beginning inventory', amount: begTotal, indent: 1, anchor: 'recon' });
      cats.forEach((k) => r.push({ id: `r-fin-${k}`, label: `Cost to complete: ${name[k].toLowerCase()} ${C(e.finish[k])} EU @ ${fmt(unit[k], '3')}`, amount: finishCost[k], indent: 1, anchor: 'recon' }));
      r.push({ id: 'r-fromBeg', label: 'Total from beginning inventory', amount: fromBeg, style: 'subtotal', anchor: 'recon' });
      cats.forEach((k) => r.push({ id: `r-sc-${k}`, label: `Started and completed: ${name[k].toLowerCase()} ${C(e.sc)} EU @ ${fmt(unit[k], '3')}`, amount: scCost[k], indent: 1, anchor: 'recon' }));
      r.push({ id: 'r-out', label: 'Total cost transferred', amount: transferred, style: 'subtotal', anchor: 'recon' });
    } else {
      cats.forEach((k) => r.push({ id: `r-out-${k}`, label: `Transferred out, ${name[k].toLowerCase()} ${C(completed)} EU @ ${fmt(unit[k], '3')}`, amount: completed * unit[k], indent: 1, anchor: 'recon' }));
      transferred = completed * (unit.mat + unit.conv);
      r.push({ id: 'r-out', label: 'Total transferred out', amount: transferred, style: 'subtotal', anchor: 'recon' });
    }
    const endCost = { mat: e.endEu.mat * unit.mat, conv: e.endEu.conv * unit.conv };
    cats.forEach((k) => r.push({ id: `r-end-${k}`, label: `Work in process, ending: ${name[k].toLowerCase()} ${C(e.endEu[k])} EU @ ${fmt(unit[k], '3')}`, amount: endCost[k], indent: 1, anchor: 'recon' }));
    const endWip = endCost.mat + endCost.conv;
    r.push({ id: 'r-end', label: 'Total work in process, ending', amount: endWip, style: 'subtotal', anchor: 'recon' });
    r.push({ id: 'r-check', label: 'Total cost accounted for', amount: transferred + endWip, style: 'total', anchor: 'recon' });

    const steps = [
      { row: 'q-tot', role: 'qty', reveal: ['q-beg', 'q-start', 'q-tot'], math: 'qty', label: `Part 1: ${C(beg.units)} + ${C(started)} = ${C(beg.units + started)} units to account for`, vars: { units: beg.units + started } },
      ...(fifo
        ? [
            { row: 'q-from-beg', role: 'qty', reveal: ['q-from-beg'], math: 'eu', label: `Beginning units still need ${PCT(1 - beg.mat)} / ${PCT(1 - beg.conv)} more: ${C(e.finish.mat)} and ${C(e.finish.conv)} EU`, vars: { finishConv: e.finish.conv } },
            { row: 'q-sc', role: 'qty', reveal: ['q-sc'], math: 'eu', label: `Started and completed: ${C(completed)} − ${C(beg.units)} = ${C(e.sc)}`, vars: { sc: e.sc } },
          ]
        : [{ row: 'q-done', role: 'qty', reveal: ['q-done'], math: 'eu', label: `${C(completed)} completed: 100% for both, in one figure`, vars: { completed } }]),
      { row: 'q-end', role: 'qty', reveal: ['q-end'], math: 'eu', label: `Ending: ${C(end.units)} at ${PCT(end.mat)} / ${PCT(end.conv)} = ${C(e.endEu.mat)} and ${C(e.endEu.conv)} EU`, vars: { endConv: e.endEu.conv } },
      { row: 'q-acc', role: 'qty', reveal: ['q-acc'], math: 'eu', label: `EU: ${C(e.eu.mat)} materials, ${C(e.eu.conv)} conversion`, vars: { euMat: e.eu.mat, euConv: e.eu.conv } },
      { row: fifo ? 'u-add' : 'u-tot', role: 'unit', reveal: ['u-beg', 'u-add', 'u-tot', 'u-eu'], math: 'unit', label: fifo ? `Part 2 (FIFO): only this period's ${P(addedTotal)} is divided` : `Part 2: ${C(begTotal)} beginning + ${C(addedTotal)} added = ${P(total)}`, vars: { costs: fifo ? addedTotal : total } },
      ...cats.map((k, j) => ({ row: 'u-unit', role: 'unit', reveal: [`u-unit:${j + 1}`, ...(j === 1 ? ['u-unit:0'] : [])], math: 'unit', label: `${name[k]}: ${C(fifo ? added[k] : totalCost[k])} ÷ ${C(e.eu[k])} = ${fmt(unit[k], '3')} per EU`, vars: { [`unit_${k}`]: unit[k] } })),
      { row: 'r-out', role: 'recon', reveal: r.filter((x) => x.id.startsWith('r-') && !x.id.startsWith('r-end') && x.id !== 'r-check').map((x) => x.id), math: 'recon', label: `Part 3: transferred out ${P(transferred)}`, vars: { transferred }, tone: 'good' },
      { row: 'r-end', role: 'recon', reveal: ['r-end-mat', 'r-end-conv', 'r-end'], math: 'recon', label: `Ending inventory: ${C(endCost.mat)} + ${C(endCost.conv)} = ${P(endWip)}`, vars: { endWip } },
      { row: 'r-check', role: 'recon', reveal: ['r-check'], math: 'recon', label: `Check: ${C(transferred)} + ${C(endWip)} = ${P(transferred + endWip)} ✓`, vars: { accounted: transferred + endWip }, tone: 'good' },
    ];
    return { fifo, eu: e.eu, unit, transferred, endWip, total, endCost, q, u, r, steps };
  }
  function reportOut(x) {
    return { method: x.fifo ? 'FIFO' : 'weighted-average', euMat: x.eu.mat, euConv: x.eu.conv, unitMat: x.unit.mat, unitConv: x.unit.conv, unitTotal: x.unit.mat + x.unit.conv,
      transferred: x.transferred, endWip: x.endWip, endMat: x.endCost.mat, endConv: x.endCost.conv, total: x.total, qRows: x.q, unitRows: x.u, reconRows: x.r };
  }
  // roles: journal, formula, code
  function productionReport(args) {
    const x = reportCore(args);
    return clean({ ...reportOut(x), trace: toTrace(x.steps) });
  }
  function reportSheet(args) {
    const x = reportCore(args);
    const all = reveal([...x.q, ...x.u, ...x.r], x.steps, args.upTo);
    return clean({ ...reportOut(x), qRows: all.slice(0, x.q.length), unitRows: all.slice(x.q.length, x.q.length + x.u.length), reconRows: all.slice(x.q.length + x.u.length) });
  }
  // roles: qty, unit, recon
  function reportWalk(args) {
    const x = reportCore(args);
    return clean({ steps: x.steps.length, transferred: x.transferred, trace: toWalk(x.steps, 'sheetUpTo', 'qty') });
  }

  // ------------------------------------------------------------------ JIT: manufacturing time (slide 29)
  // The slide gives the formula; the numbers here are illustrative.
  function mfgTime({ process, inspect, move, wait }) {
    const total = process + inspect + move + wait;
    const nva = inspect + move + wait;
    return clean({
      total, nva, vaShare: process / total,
      rows: [
        { id: 'p', label: 'Processing time (value-added)', amount: process, format: 'number', anchor: 'va' },
        { id: 'i', label: 'Inspection time', amount: inspect, format: 'number', anchor: 'nva' },
        { id: 'm', label: 'Move time', amount: move, format: 'number', anchor: 'nva' },
        { id: 'w', label: 'Wait time', amount: wait, format: 'number', anchor: 'nva' },
        { id: 't', label: 'Manufacturing time (hours)', amount: total, format: 'number', style: 'total', anchor: 'total' },
        { id: 's', label: 'Share that adds value', amount: process / total, format: 'pct', anchor: 'va' },
      ],
      trace: toTrace([
        { row: 'p', math: 'va', label: `Processing: ${process} hours, the only value-added time`, vars: { process } },
        { row: 'i', math: 'nva', label: `Inspection, move and wait: ${inspect} + ${move} + ${wait} = ${nva} non-value-added hours`, vars: { nva } },
        { row: 't', math: 'total', label: `Manufacturing time: ${process} + ${nva} = ${total} hours`, vars: { total } },
        { row: 's', math: 'va', label: `Value-added share: ${process} ÷ ${total} = ${PCT(process / total)}`, vars: { vaShare: process / total }, tone: 'good' },
      ]),
    });
  }

  // ------------------------------------------------------------------ ABC preview: Sarver Company (slides 30–32)
  function sarverCore({ totalOH, totalDLH, products, activities }) {
    const trad = totalOH / totalDLH;
    const rates = activities.map((a) => ({ ...a, total: sum(a.use), rate: a.cost / sum(a.use) }));
    const prod = products.map((p, j) => {
      const tradOH = p.dlh * trad;
      const abcLines = rates.map((a) => ({ id: a.id, name: a.name, rate: a.rate, qty: a.use[j], amount: a.rate * a.use[j] }));
      const abcTotal = sum(abcLines.map((l) => l.amount));
      const abcOH = abcTotal / p.units;
      return { ...p, tradOH, tradCost: p.dm + p.dl + tradOH, abcLines, abcTotal, abcOH, abcCost: p.dm + p.dl + abcOH };
    });
    return { trad, rates, prod };
  }
  // roles: journal, formula, code
  function sarver(args) {
    const s = sarverCore(args);
    const [pa, pb] = s.prod;
    const rateRows = s.rates.map((a) => ({ id: `rate-${a.id}`, label: `${a.name}: ${C(a.cost)} ÷ ${C(a.total)}`, amount: a.rate, anchor: 'rate' }));
    const prodRows = s.rates.map((a, i) => ({ id: `use-${a.id}`, label: `${a.name} @ ${P2(a.rate)}`, amounts: [pa.abcLines[i].amount, pb.abcLines[i].amount], anchor: 'assign' }))
      .concat([
        { id: 'oh-total', label: 'Total overhead (a)', amounts: [pa.abcTotal, pb.abcTotal], style: 'subtotal', anchor: 'assign' },
        { id: 'units', label: 'Number of units (b)', amounts: [pa.units, pb.units], format: 'units', anchor: 'assign' },
        { id: 'oh-unit', label: 'Overhead per unit (a) ÷ (b)', amounts: [pa.abcOH, pb.abcOH], style: 'total', anchor: 'assign' },
      ]);
    const costRows = [
      { id: 'c-dm', label: 'Direct materials', amounts: [pa.dm, pb.dm], anchor: 'cost' },
      { id: 'c-dl', label: 'Direct labor', amounts: [pa.dl, pb.dl], anchor: 'cost' },
      { id: 'c-trad', label: `Overhead, old system (DLH × ${P(s.trad)})`, amounts: [pa.tradOH, pb.tradOH], anchor: 'trad' },
      { id: 'c-abc', label: 'Overhead, ABC', amounts: [pa.abcOH, pb.abcOH], anchor: 'cost' },
      { id: 'c-tradtot', label: 'Unit cost, old system', amounts: [pa.tradCost, pb.tradCost], style: 'subtotal', anchor: 'trad' },
      { id: 'c-abctot', label: 'Unit cost, ABC', amounts: [pa.abcCost, pb.abcCost], style: 'total', anchor: 'cost' },
    ];
    const steps = [
      { row: 'c-trad', math: 'trad', label: `Old rate: ${C(args.totalOH)} ÷ ${C(args.totalDLH)} DLH = ${P(s.trad)} per DLH`, vars: { tradRate: s.trad } },
      ...s.rates.map((a) => ({ row: `rate-${a.id}`, math: 'rate', label: `${a.name}: ${C(a.cost)} ÷ ${C(a.total)} = ${P2(a.rate)} per ${a.unit}`, vars: { [`rate_${a.id}`]: a.rate } })),
      { row: 'oh-total', math: 'assign', label: `Product A uses ${P(pa.abcTotal)} of overhead; Product B ${P(pb.abcTotal)}`, vars: { ohA: pa.abcTotal, ohB: pb.abcTotal } },
      { row: 'oh-unit', math: 'assign', label: `Per unit: A ${C(pa.abcTotal)} ÷ ${C(pa.units)} = ${P2(pa.abcOH)}; B ${C(pb.abcTotal)} ÷ ${C(pb.units)} = ${P2(pb.abcOH)}`, vars: { unitA: pa.abcOH, unitB: pb.abcOH } },
      { row: 'c-abctot', math: 'cost', label: `ABC unit cost: A ${P2(pa.abcCost)} (was ${P2(pa.tradCost)}); B ${P2(pb.abcCost)} (was ${P2(pb.tradCost)})`, vars: { costA: pa.abcCost, costB: pb.abcCost }, tone: 'good' },
    ];
    return clean({
      tradRate: s.trad, tradOHA: pa.tradOH, tradOHB: pb.tradOH, tradCostA: pa.tradCost, tradCostB: pb.tradCost,
      ohTotalA: pa.abcTotal, ohTotalB: pb.abcTotal, abcOHA: pa.abcOH, abcOHB: pb.abcOH, abcCostA: pa.abcCost, abcCostB: pb.abcCost,
      rates: Object.fromEntries(s.rates.map((a) => [a.id, a.rate])),
      rateRows, prodRows, costRows, trace: toTrace(steps),
    });
  }
  function sarverView({ totalOH, totalDLH, products, activities, system }) {
    const s = sarverCore({ totalOH, totalDLH, products, activities });
    const abc = system === 'abc';
    return clean({
      rows: s.prod.map((p) => ({ id: `p-${p.id}`, label: `Product ${p.id} (${C(p.units)} units)`, amounts: [p.dm + p.dl, abc ? p.abcOH : p.tradOH, abc ? p.abcCost : p.tradCost] })),
      costA: abc ? s.prod[0].abcCost : s.prod[0].tradCost, costB: abc ? s.prod[1].abcCost : s.prod[1].tradCost,
    });
  }
  // The spreadsheet on slide 30: one activity rate
  function activityRate({ cost, driver }) {
    return clean({ rate: cost / driver });
  }

  // ------------------------------------------------------------------ quiz generators
  const nice = (rng, lo, hi, step) => rng.int(Math.ceil(lo / step), Math.floor(hi / step)) * step;
  const shuffled = (rng, list) => rng.shuffle([...new Set(list)]);
  const ALL_ACCOUNTS = Object.values(A);

  function randomYear(rng) {
    for (;;) {
      const dl = nice(rng, 100000, 400000, 10000);
      const d = {
        opening: { rm: nice(rng, 10000, 50000, 1000), wip: nice(rng, 20000, 90000, 1000), fg: nice(rng, 20000, 90000, 1000) },
        purchases: nice(rng, 100000, 300000, 10000),
        issued: { direct: nice(rng, 80000, 250000, 1000), indirect: nice(rng, 5000, 40000, 1000) },
        labor: { direct: dl, indirect: nice(rng, 20000, 100000, 1000), sa: nice(rng, 30000, 120000, 1000) },
        utilities: nice(rng, 10000, 60000, 1000),
        insurance: { total: nice(rng, 10000, 40000, 1000), factoryPct: rng.pick([0.6, 0.7, 0.75, 0.8]) },
        advertising: nice(rng, 20000, 100000, 1000),
        depreciation: { factory: nice(rng, 40000, 180000, 1000), sa: nice(rng, 5000, 30000, 1000) },
        est: { oh: 0, dl: 0 },
        completed: 0, sales: 0, costSold: 0,
      };
      // Pick a rate that lands applied overhead within a few percent of actual, as a real estimate would.
      const actual = cycleCore({ ...d, est: { oh: 1, dl: 1 } }).actualOH;
      const rate = Math.round(((actual / dl) * rng.pick([0.9, 0.94, 0.97, 1.03, 1.06, 1.1])) * 20) / 20;
      if (rate < 0.5 || rate > 2.5) continue;
      const estDL = dl + nice(rng, -30000, 30000, 10000);
      d.est = { oh: Math.round(rate * estDL), dl: estDL };
      const c0 = cycleCore(d);
      const intoWip = d.opening.wip + d.issued.direct + d.labor.direct + c0.applied;
      d.completed = Math.round((intoWip * rng.pick([0.75, 0.8, 0.85, 0.9])) / 1000) * 1000;
      d.costSold = Math.round(((d.opening.fg + d.completed) * rng.pick([0.8, 0.85, 0.9])) / 1000) * 1000;
      d.sales = Math.round((d.costSold * rng.pick([1.3, 1.4, 1.5])) / 1000) * 1000;
      const c = cycleCore(d);
      if (c.amt < 1000 || Math.abs(c.applied - Math.round(c.applied)) > 1e-6 || Math.abs(c.insFactory - Math.round(c.insFactory)) > 1e-6) continue;
      if (c.bal.rm < 0) continue;
      return d;
    }
  }
  // One of entries b, c, e, g or h, on fresh numbers
  function entryQ({ rng, difficulty }) {
    const d = randomYear(rng);
    const c = cycleCore(d);
    const pick = rng.pick(difficulty === 1 ? ['a', 'd', 'h', 'i', 'k'] : ['b', 'c', 'e', 'g', 'h']);
    const e = c.E.find((x) => x.id === pick);
    const text = {
      a: `Raw materials were purchased on account for ${P(d.purchases)}.`,
      b: `Raw materials costing ${P(d.issued.direct + d.issued.indirect)} were issued to production: ${P(d.issued.direct)} direct and ${P(d.issued.indirect)} indirect.`,
      c: `Employee costs for the year: direct labor ${P(d.labor.direct)}, indirect labor ${P(d.labor.indirect)}, selling and administrative salaries ${P(d.labor.sa)}, all still unpaid.`,
      d: `Factory utilities of ${P(d.utilities)} were incurred on account.`,
      e: `Prepaid insurance of ${P(d.insurance.total)} expired; ${PCT(d.insurance.factoryPct)} relates to the factory and the rest to selling and administration.`,
      g: `Depreciation was ${P(d.depreciation.factory)} on factory assets and ${P(d.depreciation.sa)} on selling and administrative assets.`,
      h: `Overhead is applied at ${PCT(c.rate)} of direct labor cost (estimated ${P(d.est.oh)} of overhead on ${P(d.est.dl)} of direct labor). Direct labor this year was ${P(d.labor.direct)}. Apply the overhead.`,
      i: `Jobs costing ${P(d.completed)} were completed and moved to the finished goods warehouse.`,
      k: `The goods sold this year had cost ${P(d.costSold)} to manufacture.`,
    }[pick];
    return { vars: { text, rate: c.rate, applied: c.applied, accounts: shuffled(rng, [...e.lines.map((l) => l.account), ...rng.sample(ALL_ACCOUNTS, 4)]), entries: [{ lines: quizLines(e.lines) }] } };
  }
  function yearVars(d, c) {
    return {
      ...d.opening, begRM: d.opening.rm, begWIP: d.opening.wip, begFG: d.opening.fg, purchases: d.purchases, dmUsed: d.issued.direct, indirectMat: d.issued.indirect,
      dl: d.labor.direct, indirectLabor: d.labor.indirect, utilities: d.utilities, insFactory: c.insFactory, deprFactory: d.depreciation.factory,
      estOH: d.est.oh, estDL: d.est.dl, rate: c.rate, applied: c.applied, actualOH: c.actualOH, amt: c.amt, kindTxt: c.under ? 'underapplied' : 'overapplied',
      completed: d.completed, costSold: d.costSold, endRM: c.bal.rm, endWIP: c.bal.wip, endFG: c.bal.fg,
    };
  }
  function overheadQ({ rng }) {
    const d = randomYear(rng);
    const c = cycleCore(d);
    return {
      vars: { ...yearVars(d, c), wrongEstRate: d.est.oh, wrongWithSA: c.actualOH + c.insSA + d.depreciation.sa },
      misconceptions: [
        { var: 'wrongWithSA', feedback: 'Only factory costs are overhead. Selling and administrative insurance and depreciation are period expenses.' },
        { value: c.actualOH + d.labor.direct, feedback: 'Direct labor goes to Work in Process, not to Manufacturing Overhead.' },
      ],
    };
  }
  function balanceQ({ rng }) {
    const d = randomYear(rng);
    const c = cycleCore(d);
    return {
      vars: { ...yearVars(d, c), wrongWipNoOH: c.bal.wip - c.applied, wrongWipActual: c.bal.wip - c.applied + c.actualOH },
      misconceptions: [
        { var: 'wrongWipNoOH', feedback: 'Work in Process is also debited for overhead **applied**.' },
        { var: 'wrongWipActual', feedback: 'WIP receives **applied** overhead, not actual overhead; actual overhead sits in Manufacturing Overhead.' },
      ],
    };
  }
  function disposeQ({ rng, difficulty }) {
    for (;;) {
      const d = randomYear(rng);
      const c = cycleCore(d);
      const method = difficulty >= 2 ? 'allocate' : 'close';
      const r = dispose({ d, method });
      return {
        vars: { ...yearVars(d, c), method, wipAdj: r.wipAdj, fgAdj: r.fgAdj, cogsAdj: r.cogsAdj, wipShare: r.wipShare, fgShare: r.fgShare, cogsShare: r.cogsShare,
          adjustedCogs: r.adjustedCogs, accounts: shuffled(rng, [A.cogs, A.moh, A.wip, A.fg, A.rm, A.sales, A.ap]), entries: [{ lines: quizLines(r.entries[0].lines) }],
          wrongWrongWay: c.under ? d.costSold - c.amt : d.costSold + c.amt },
        misconceptions: [
          { var: 'wrongWrongWay', feedback: 'Wrong direction: underapplied overhead **adds** to COGS; overapplied subtracts.' },
          { value: d.costSold, feedback: 'You left COGS unadjusted. The Manufacturing Overhead balance must be closed out.' },
        ],
      };
    }
  }
  function incomeQ({ rng }) {
    const d = randomYear(rng);
    const c = cycleCore(d);
    const r = incomeCore(d, 'close');
    return {
      vars: { ...yearVars(d, c), sales: d.sales, saWages: d.labor.sa, insSA: c.insSA, advertising: d.advertising, deprSA: d.depreciation.sa,
        cogs: r.adjustedCogs, gm: r.gm, totalSA: r.totalSA, ni: r.ni,
        rows: r.rows.map((x) => clean({ label: x.label, amount: x.amount, style: x.style, indent: x.indent, blank: ['cogs', 'gm', 'sa', 'ni'].includes(x.id) || undefined })) },
      misconceptions: [
        { value: d.sales - d.costSold - r.totalSA, feedback: 'Adjust COGS for the under- or overapplied overhead before computing net income.' },
        { value: r.gm, feedback: 'That is gross margin. Subtract the selling and administrative (period) expenses too.' },
      ],
    };
  }
  function euQ({ rng, difficulty }) {
    for (;;) {
      const method = difficulty >= 2 ? 'fifo' : 'wa';
      const beg = { units: nice(rng, 1000, 20000, 1000), mat: rng.pick([1, 1, 0.6, 0.8]), conv: rng.pick([0.4, 0.5, 0.6, 0.8, 0.9]) };
      const started = nice(rng, 50000, 200000, 5000);
      const end = { units: nice(rng, 5000, 30000, 1000), mat: rng.pick([1, 0.7, 0.5]), conv: rng.pick([0.2, 0.25, 0.3, 0.4, 0.5]) };
      const completed = beg.units + started - end.units;
      if (completed <= beg.units) continue;
      const r = equivUnits({ beg, completed, end, method });
      const wa = equivUnits({ beg, completed, end, method: 'wa' });
      return {
        vars: { method: method === 'fifo' ? 'FIFO' : 'weighted-average', begUnits: beg.units, begMat: beg.mat, begConv: beg.conv, started, completed, endUnits: end.units, endMat: end.mat, endConv: end.conv,
          euMat: r.euMat, euConv: r.euConv, sc: r.sc, waConv: wa.euConv, finishConv: r.finishConv },
        misconceptions: method === 'fifo'
          ? [{ var: 'waConv', feedback: 'That is the weighted-average figure. FIFO counts only the work done this period.' }, { value: r.sc + end.units * end.conv, feedback: 'You left out the work needed to finish the beginning inventory.' }]
          : [{ value: completed + end.units, feedback: 'Ending inventory counts only at its percent complete.' }, { value: r.euConv - beg.units * beg.conv, feedback: 'That subtracts beginning inventory, which is FIFO. Weighted-average does not.' }],
      };
    }
  }
  function reportQ({ rng, difficulty }) {
    for (;;) {
      const method = difficulty >= 3 ? 'fifo' : 'wa';
      const beg = { units: nice(rng, 2000, 15000, 1000), mat: 1, conv: rng.pick([0.4, 0.5, 0.6, 0.8, 0.9]), cost: {} };
      const started = nice(rng, 40000, 200000, 10000);
      const end = { units: nice(rng, 4000, 30000, 1000), mat: 1, conv: rng.pick([0.2, 0.25, 0.4, 0.5]) };
      const completed = beg.units + started - end.units;
      if (completed <= beg.units) continue;
      const uMat = rng.pick([0.3, 0.39, 0.4, 0.5, 0.6]);
      const uConv = rng.pick([0.7, 0.8, 0.84, 0.9, 1.2]);
      const euWA = { mat: completed + end.units, conv: completed + end.units * end.conv };
      const euFF = { mat: euWA.mat - beg.units, conv: euWA.conv - beg.units * beg.conv };
      let added;
      if (method === 'fifo') {
        added = { mat: Math.round(uMat * euFF.mat * 100) / 100, conv: Math.round(uConv * euFF.conv * 100) / 100 };
        beg.cost = { mat: Math.round(beg.units * uMat * 0.95), conv: Math.round(beg.units * beg.conv * uConv * 0.95) };
      } else {
        beg.cost = { mat: Math.round(beg.units * uMat * 0.95), conv: Math.round(beg.units * beg.conv * uConv * 0.95) };
        added = { mat: Math.round((uMat * euWA.mat - beg.cost.mat) * 100) / 100, conv: Math.round((uConv * euWA.conv - beg.cost.conv) * 100) / 100 };
      }
      if (added.mat <= 0 || added.conv <= 0) continue;
      const x = reportCore({ beg, started, completed, end, added, method });
      return {
        vars: { method: x.fifo ? 'FIFO' : 'weighted-average', begUnits: beg.units, begConv: beg.conv, begMatCost: beg.cost.mat, begConvCost: beg.cost.conv, started, completed, endUnits: end.units, endConv: end.conv,
          addMat: added.mat, addConv: added.conv, euMat: x.eu.mat, euConv: x.eu.conv, unitMat: x.unit.mat, unitConv: x.unit.conv, unitTotal: x.unit.mat + x.unit.conv,
          transferred: x.transferred, endWip: x.endWip, total: x.total, begTotal: beg.cost.mat + beg.cost.conv, sc: completed - beg.units,
          wrongNoBeg: x.transferred - beg.cost.mat - beg.cost.conv, wrongAllAtUnit: completed * (x.unit.mat + x.unit.conv), wrongUnitAddedOnly: added.conv / x.eu.conv, wrongUnitWithBeg: (added.conv + beg.cost.conv) / x.eu.conv,
          recon: x.r.map((y) => clean({ label: y.label, amount: y.amount, style: y.style, indent: y.indent, blank: ['r-out', 'r-end', 'r-check'].includes(y.id) || undefined })) },
        misconceptions: x.fifo
          ? [{ var: 'wrongUnitWithBeg', feedback: 'FIFO unit costs exclude beginning inventory cost.' }, { value: added.conv / (completed + end.units * end.conv), feedback: 'FIFO equivalent units exclude work done on beginning inventory last period.' }]
          : [{ var: 'wrongUnitAddedOnly', feedback: 'Weighted-average adds beginning inventory cost to the costs added.' }, { value: (added.conv + beg.cost.conv) / (completed + end.units), feedback: 'Ending inventory counts only at its percent converted.' }],
      };
    }
  }
  function timeQ({ rng }) {
    const process = rng.pick([1.5, 2, 2.5, 3, 4]);
    const inspect = rng.pick([0.5, 1, 1.5]);
    const move = rng.pick([0.5, 1, 2]);
    const wait = rng.pick([2, 3, 4, 5, 6]);
    const r = mfgTime({ process, inspect, move, wait });
    return {
      vars: { process, inspect, move, wait, total: r.total, vaShare: r.vaShare, nva: r.nva, vaPct: 100 * r.vaShare, wrongNvaPct: (100 * r.nva) / r.total, wrongOnlyWaitPct: (100 * process) / (process + wait) },
      misconceptions: [
        { var: 'wrongNvaPct', feedback: 'That is the non-value-added share. Only processing time adds value.' },
        { var: 'wrongOnlyWaitPct', feedback: 'Manufacturing time includes inspection and move time too.' },
      ],
    };
  }
  function abcQ({ rng, difficulty }) {
    for (;;) {
      const units = [nice(rng, 1000, 5000, 500), nice(rng, 10000, 40000, 1000)];
      const acts = [
        { id: 'setups', name: 'Machine setups', unit: 'setup', rate: rng.pick([40, 50, 60, 75]), use: [nice(rng, 1000, 4000, 100), nice(rng, 1000, 4000, 100)] },
        { id: 'inspections', name: 'Quality inspections', unit: 'inspection', rate: rng.pick([15, 20, 25]), use: [nice(rng, 2000, 6000, 100), nice(rng, 2000, 6000, 100)] },
        { id: 'mh', name: 'Machine-hours worked', unit: 'hour', rate: rng.pick([6, 7.5, 8, 10]), use: [nice(rng, 5000, 15000, 500), nice(rng, 15000, 40000, 500)] },
      ];
      if (difficulty === 1) acts.splice(1, 1);
      const activities = acts.map((a) => ({ id: a.id, name: a.name, unit: a.unit, cost: a.rate * (a.use[0] + a.use[1]), use: a.use }));
      const products = [{ id: 'A', units: units[0], dlh: 2, dm: 30, dl: 15 }, { id: 'B', units: units[1], dlh: 2, dm: 25, dl: 15 }];
      const totalOH = sum(activities.map((a) => a.cost));
      const totalDLH = units[0] * 2 + units[1] * 2;
      const s = sarver({ totalOH, totalDLH, products, activities });
      if ([s.abcOHA, s.abcOHB].some((v) => Math.abs(v * 100 - Math.round(v * 100)) > 1e-6)) continue;
      return {
        vars: { unitsA: units[0], unitsB: units[1], table: activities.map((a) => `| ${a.name} | ${P(a.cost)} | ${C(a.use[0] + a.use[1])} | ${C(a.use[0])} | ${C(a.use[1])} |`).join('\n'),
          firstName: activities[0].name, firstRate: activities[0].cost / (activities[0].use[0] + activities[0].use[1]), firstCost: activities[0].cost, firstTotal: activities[0].use[0] + activities[0].use[1],
          ohTotalA: s.ohTotalA, abcOHA: s.abcOHA, abcOHB: s.abcOHB, tradRate: s.tradRate, tradOHA: s.tradOHA, wrongTradA: s.tradOHA, wrongNoUnits: s.ohTotalA,
          wrongRateInverse: (activities[0].use[0] + activities[0].use[1]) / activities[0].cost, wrongRateA: activities[0].cost / activities[0].use[0] },
        misconceptions: [
          { var: 'wrongTradA', feedback: 'That is the old direct-labor-hour overhead. ABC sums the activities Product A actually uses.' },
          { var: 'wrongNoUnits', feedback: 'That is Product A\'s total overhead; divide by its units for a per-unit figure.' },
        ],
      };
    }
  }
  function costEqQ({ rng }) {
    const intercept = nice(rng, 10000, 60000, 1000);
    const slope = rng.pick([2.5, 4, 6.25, 8.5, 12]);
    const x = nice(rng, 1000, 6000, 100);
    const y = intercept + slope * x;
    return { vars: { intercept, slope, x, y, wrongNoFixed: slope * x, wrongFixedOnly: intercept + slope },
      misconceptions: [
        { var: 'wrongNoFixed', feedback: 'You left out the fixed part (the intercept).' },
        { var: 'wrongFixedOnly', feedback: 'Multiply the slope by the number of hours.' },
      ] };
  }
  function pohrQ({ rng }) {
    const rate = rng.pick([6, 8, 10, 12, 15]);
    const mh = nice(rng, 40000, 100000, 5000);
    const job = { dm: nice(rng, 2000, 9000, 100), dl: nice(rng, 1000, 6000, 100), mh: nice(rng, 100, 900, 10) };
    const r = parkerJob({ budgetOH: rate * mh, budgetMH: mh, job });
    return { vars: { budgetOH: rate * mh, budgetMH: mh, dm: job.dm, dl: job.dl, jobMH: job.mh, rate, oh: r.oh, total: r.total, wrongInverse: mh / (rate * mh), wrongNoOH: job.dm + job.dl },
      misconceptions: [
        { var: 'wrongNoOH', feedback: 'Add the overhead applied (machine-hours × rate).' },
        { value: job.dm + job.dl + rate * job.dl, feedback: 'The rate is per machine-hour, not per peso of labor.' },
      ] };
  }

  return {
    fns: {
      costEquation, costTotals, parkerJob, jobSheet, jobSheetSheet, jobSheetWalk, timeTicket, cycle, ledgerSheet, ledgerWalk, balances,
      dispose, income, incomeSheet, incomeWalk, equivUnits, productionReport, reportSheet, reportWalk, mfgTime, sarver, sarverView, activityRate,
    },
    generators: { entryQ, overheadQ, balanceQ, disposeQ, incomeQ, euQ, reportQ, timeQ, abcQ, costEqQ, pohrQ },
  };
}
