export default function register(sdk) {
  const { round, fmt } = sdk;
  const peso = (x) => fmt(x, 'money');

  // ---------------------------------------------------------------- predetermined overhead rate
  // roles: journal (rows of the journal pane), code, formula
  function poRate({ estOH, estBase }) {
    const rate = estBase ? estOH / estBase : null;
    return {
      rate,
      rows: [
        { id: 'est-oh', label: 'Estimated manufacturing overhead', amount: estOH, anchor: 'est-oh' },
        { id: 'est-base', label: '÷ Estimated direct labor-hours', amount: estBase, format: 'number', anchor: 'est-base' },
        { id: 'rate', label: '= Predetermined overhead rate (per DLH)', amount: rate, style: 'total', anchor: 'rate' },
      ],
      trace: [
        { label: 'Budgeted overhead for the year: {=estOH|money}', math: 'est-oh', code: 'est-oh', vars: { estOH },
          ops: [{ role: 'journal', cmd: 'clear' }, { role: 'journal', cmd: 'highlight', args: { sel: 'row:est-oh' } }] },
        { label: 'Budgeted activity: {=estBase|comma} direct labor-hours', math: 'est-base', code: 'est-base', vars: { estBase },
          ops: [{ role: 'journal', cmd: 'highlight', args: { sel: 'row:est-base' } }] },
        { label: 'Rate $= {=estOH|comma} \\div {=estBase|comma} = {=rate|money2}$ per DLH', math: 'rate', code: 'rate', vars: { rate },
          ops: [{ role: 'journal', cmd: 'highlight', args: { sel: 'row:rate', tone: 'good' } }, { role: 'journal', cmd: 'annotate', args: { sel: 'row:rate', text: 'set before the year starts' } }] },
      ],
    };
  }

  // ---------------------------------------------------------------- job cost
  // roles: journal (rows of the journal pane), code, formula
  function jobCost({ dm, dl, hours, rate }) {
    const oh = rate * hours;
    const total = dm + dl + oh;
    return {
      dm, dl, oh, total, hours, rate,
      rows: [
        { id: 'dm', label: 'Direct materials', amount: dm, anchor: 'dm' },
        { id: 'dl', label: 'Direct labor', amount: dl, anchor: 'dl' },
        { id: 'oh', label: `Overhead applied (${fmt(hours, 'comma')} DLH × ${peso(rate)})`, amount: oh, anchor: 'applied' },
        { id: 'total', label: 'Total job cost', amount: total, style: 'total', anchor: 'total' },
      ],
      trace: [
        { label: 'Materials requisitioned for the job: {=dm|money} → debit WIP', math: 'dm', code: 'dm', vars: { dm },
          ops: [{ role: 'journal', cmd: 'clear' }, { role: 'journal', cmd: 'highlight', args: { sel: 'row:dm' } }] },
        { label: 'Direct labor charged to the job: {=dl|money} → debit WIP', math: 'dl', code: 'dl', vars: { dl },
          ops: [{ role: 'journal', cmd: 'highlight', args: { sel: 'row:dl' } }] },
        { label: 'Overhead applied $= {=hours|comma} \\times {=rate|comma} = {=oh|comma}$', math: 'applied', code: 'applied', vars: { hours, rate, oh },
          ops: [{ role: 'journal', cmd: 'highlight', args: { sel: 'row:oh' } }] },
        { label: 'Job finished: $ {=dm|comma} + {=dl|comma} + {=oh|comma} = {=total|comma}$ moves to Finished Goods', math: 'total', code: 'total', vars: { total },
          ops: [{ role: 'journal', cmd: 'highlight', args: { sel: 'row:total', tone: 'good' } }] },
      ],
    };
  }

  // ---------------------------------------------------------------- closing over/underapplied overhead
  // roles: journal (rows of the journal pane), code, formula
  function overheadClose({ actualOH, rate, actualBase }) {
    const applied = rate * actualBase;
    const diff = actualOH - applied;
    const under = diff > 0;
    const amt = Math.abs(diff);
    const lines = under
      ? [{ account: 'Cost of Goods Sold', debit: amt, anchor: 'diff' }, { account: 'Manufacturing Overhead', credit: amt, anchor: 'diff' }]
      : [{ account: 'Manufacturing Overhead', debit: amt, anchor: 'diff' }, { account: 'Cost of Goods Sold', credit: amt, anchor: 'diff' }];
    return {
      applied, actualOH, diff, amt, under, kind: under ? 'underapplied' : 'overapplied',
      rows: [
        { id: 'actual', label: 'Actual overhead incurred', amount: actualOH, anchor: 'actual' },
        { id: 'applied', label: 'Overhead applied (POHR × actual DLH)', amount: applied, anchor: 'applied' },
        { id: 'diff', label: under ? 'Underapplied overhead' : 'Overapplied overhead', amount: amt, style: 'total', anchor: 'diff' },
      ],
      entries: [{ id: 'close', date: 'Dec 31', lines, memo: under ? 'Too little overhead was applied: COGS goes up.' : 'Too much overhead was applied: COGS goes down.' }],
      trace: [
        { label: 'Actual overhead (the debits in the MOH account): {=actualOH|money}', math: 'actual', code: 'actual', vars: { actualOH },
          ops: [{ role: 'journal', cmd: 'clear' }, { role: 'journal', cmd: 'highlight', args: { sel: 'row:actual' } }] },
        { label: 'Applied $= {=rate|comma} \\times {=actualBase|comma} = {=applied|comma}$ (the credits)', math: 'applied', code: 'applied', vars: { applied },
          ops: [{ role: 'journal', cmd: 'highlight', args: { sel: 'row:applied' } }] },
        { label: '$ {=actualOH|comma} - {=applied|comma} = {=diff|comma}$: {=kind}, closed to COGS', math: 'diff', code: 'diff', vars: { diff },
          ops: [{ role: 'journal', cmd: 'highlight', args: { sel: 'row:diff', tone: under ? 'bad' : 'good' } }] },
      ],
    };
  }

  // ---------------------------------------------------------------- the flow of one job's cost (worksheet + walk)
  const FLOW = [
    { id: 'e1', dr: 'wip', cr: 'rm', key: 'dm', what: 'materials requisitioned' },
    { id: 'e2', dr: 'wip', cr: 'wages', key: 'dl', what: 'direct labor used' },
    { id: 'e3', dr: 'wip', cr: 'moh', key: 'oh', what: 'overhead applied' },
    { id: 'e4', dr: 'fg', cr: 'wip', key: 'total', what: 'job completed' },
    { id: 'e5', dr: 'cogs', cr: 'fg', key: 'total', what: 'job sold' },
  ];
  const NAMES = { rm: 'Raw Materials', wages: 'Wages Payable', moh: 'Manufacturing Overhead', wip: 'Work in Process', fg: 'Finished Goods', cogs: 'Cost of Goods Sold' };

  function jobEntries({ dm, dl, hours, rate }) {
    const j = jobCost({ dm, dl, hours, rate });
    return {
      entries: FLOW.map((f, i) => ({
        id: f.id, date: `Step ${i + 1}`,
        lines: [{ account: NAMES[f.dr], debit: j[f.key] }, { account: NAMES[f.cr], credit: j[f.key] }],
        memo: f.what,
      })),
    };
  }

  // T-accounts after the first `upTo` entries
  function costFlow({ dm, dl, hours, rate, upTo }) {
    const j = jobCost({ dm, dl, hours, rate });
    const acc = {};
    for (const k of ['rm', 'wages', 'moh', 'wip', 'fg', 'cogs']) acc[k] = { id: k, name: NAMES[k], debits: [], credits: [] };
    FLOW.slice(0, upTo).forEach((f, i) => {
      acc[f.dr].debits.push({ amount: j[f.key], ref: `(${i + 1})` });
      acc[f.cr].credits.push({ amount: j[f.key], ref: `(${i + 1})` });
    });
    return { accounts: ['rm', 'wages', 'moh', 'wip', 'fg', 'cogs'].map((k) => acc[k]), posted: upTo };
  }

  // roles: jr (Journal), ta (TAccounts)
  function costFlowWalk({ dm, dl, hours, rate }) {
    const j = jobCost({ dm, dl, hours, rate });
    return {
      steps: FLOW.length,
      total: j.total,
      trace: FLOW.map((f, i) => ({
        label: `(${i + 1}) ${f.what}: debit ${NAMES[f.dr]}, credit ${NAMES[f.cr]} {=amt|money}`,
        vars: { amt: j[f.key] },
        patch: { flowUpTo: i + 1 },
        ops: [
          { role: 'jr', cmd: 'post', args: { id: f.id } },
          { role: 'jr', cmd: 'highlight', args: { sel: `entry:${f.id}` } },
          { role: 'ta', cmd: 'highlight', args: { sel: [`account:${f.dr}`, `account:${f.cr}`] } },
        ],
      })),
    };
  }

  // ---------------------------------------------------------------- quiz generators
  function nice(rng, lo, hi, step) { return rng.int(lo / step, hi / step) * step; }

  function rateQ({ rng }) {
    for (;;) {
      const estBase = nice(rng, 20000, 60000, 5000);
      const rate = rng.pick([8, 10, 12, 15, 18, 20, 25]);
      const estOH = rate * estBase;
      const actualBase = estBase + nice(rng, -4000, 4000, 500);
      if (actualBase === estBase) continue;
      return {
        vars: { estOH, estBase, rate, actualBase, wrongActual: estOH / actualBase },
        misconceptions: [
          { var: 'wrongActual', feedback: 'You divided by the **actual** hours. The predetermined rate uses the **estimated** base, because it is set before the year starts.' },
          { value: estBase / estOH, feedback: 'That is hours per peso of overhead: the rate is overhead **÷** base, not base ÷ overhead.' },
        ],
      };
    }
  }

  function jobQ({ rng, difficulty }) {
    const rate = rng.pick([10, 12, 15, 18, 20]);
    const hours = nice(rng, 200, 1500, 50);
    const dm = nice(rng, 10000, 60000, 500);
    const dl = hours * rng.pick([90, 100, 110, 120]);
    const j = jobCost({ dm, dl, hours, rate });
    const units = difficulty >= 2 ? rng.pick([50, 100, 200, 250]) : null;
    return {
      vars: { rate, hours, dm, dl, oh: j.oh, total: j.total, units, unitCost: units ? j.total / units : null, wrongOh: rate * dl, wrongTotal: dm + dl, wrongTotalOh: dm + dl + rate * dl },
      misconceptions: [
        { var: 'wrongOh', feedback: 'You multiplied the rate by direct labor **pesos**. This rate is per direct labor-**hour**.' },
        { value: dm + dl, feedback: 'You left out applied overhead: a job carries materials, labor **and** overhead.' },
      ],
    };
  }

  function closeQ({ rng }) {
    for (;;) {
      const rate = rng.pick([10, 12, 15, 20]);
      const actualBase = nice(rng, 20000, 50000, 1000);
      const actualOH = rate * actualBase + nice(rng, -30000, 30000, 1000);
      const r = overheadClose({ actualOH, rate, actualBase });
      if (r.amt === 0) continue;
      const accounts = rng.shuffle(['Cost of Goods Sold', 'Manufacturing Overhead', 'Work in Process', 'Finished Goods', 'Raw Materials', 'Accounts Payable']);
      return {
        vars: { rate, actualBase, actualOH, applied: r.applied, amt: r.amt, kind: r.kind, accounts,
          entries: [{ lines: r.entries[0].lines.map(({ account, debit, credit }) => (debit !== undefined ? { account, debit } : { account, credit })) }] },
      };
    }
  }

  return {
    fns: { poRate, jobCost, overheadClose, jobEntries, costFlow, costFlowWalk },
    generators: { rateQ, jobQ, closeQ },
  };
}
