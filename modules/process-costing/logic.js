export default function register(sdk) {
  const { fmt, sum } = sdk;
  const P = (x) => fmt(x, 'money');
  const C = (x) => fmt(x, 'comma');
  const N4 = (x) => fmt(x, '4');
  const PCT = (x) => fmt(x, 'pct1').replace('.0%', '%');
  const CATS = ['ti', 'mat', 'conv'];
  const CAT_NAME = { ti: 'Transferred-in', mat: 'Materials', conv: 'Conversion' };
  const CAT_SHORT = { ti: 'TI', mat: 'materials', conv: 'conversion' };

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
  // Math & Journal trace: role journal (the pane), formula, code
  function toTrace(steps) {
    return steps.map((s, i) => {
      const ops = [];
      if (i === 0) ops.push({ role: 'journal', cmd: 'clear' });
      if (s.row) ops.push({ role: 'journal', cmd: 'highlight', args: { sel: `row:${s.row}`, tone: s.tone ?? 'accent' } });
      if (s.entry) ops.push({ role: 'journal', cmd: 'highlight', args: { sel: `entry:${s.entry}`, tone: s.tone ?? 'accent' } });
      return clean({ label: s.label, math: s.math, code: s.code ?? s.math, vars: s.vars ?? {}, ops });
    });
  }
  // Scene walk: steps reveal worksheet cells via patch {key: n}; role chosen per step (s.role) or the default.
  function toWalk(steps, key, defRole) {
    return steps.map((s, i) => clean({
      label: s.label, vars: s.vars ?? {}, patch: { [key]: i + 1 },
      ops: s.row ? [{ role: s.role ?? defRole, cmd: 'highlight', args: { sel: `row:${s.row}`, tone: s.tone ?? 'accent' } }] : [],
    }));
  }
  const line = (account, side, amount, anchor) => clean(side === 'dr' ? { account, debit: amount, anchor } : { account, credit: amount, anchor });
  const quizLines = (lines) => lines.map(({ account, debit, credit }) => (debit !== undefined ? { account, debit } : { account, credit }));
  const wipAcct = (dept) => `Work-in-Process – ${dept} Department`;
  const FG = 'Finished Goods Inventory';

  // ------------------------------------------------------------------ step 1: the physical flow (slide 22, Example 2)
  // Solves for whichever of the four quantities is null.
  function physicalFlow({ beg, started, completed, end }) {
    let b = beg ?? 0, s = started, c = completed, e = end;
    let solved = null;
    if (e === null || e === undefined) { e = b + s - c; solved = 'end'; }
    else if (c === null || c === undefined) { c = b + s - e; solved = 'completed'; }
    else if (s === null || s === undefined) { s = c + e - b; solved = 'started'; }
    const left = b + s, right = c + e;
    return clean({
      beg: b, started: s, completed: c, end: e, left, right, balanced: left === right, solved,
      rows: [
        { id: 'beg', label: 'Beginning Work-in-Process', amount: b, format: 'units', anchor: 'beg' },
        { id: 'started', label: '+ Units started', amount: s, format: 'units', anchor: 'started' },
        { id: 'left', label: '= Units to account for', amount: left, format: 'units', style: 'subtotal', anchor: 'left' },
        { id: 'completed', label: 'Units completed and transferred out', amount: c, format: 'units', anchor: 'completed' },
        { id: 'end', label: '+ Ending Work-in-Process', amount: e, format: 'units', anchor: 'end' },
        { id: 'right', label: '= Units accounted for', amount: right, format: 'units', style: 'total', anchor: 'right' },
      ],
      trace: toTrace([
        { row: 'beg', math: 'beg', label: `Beginning WIP: ${C(b)} units`, vars: { beg: b } },
        { row: 'started', math: 'started', label: `Started this period: ${C(s)} units`, vars: { started: s } },
        { row: 'left', math: 'left', label: `To account for: ${C(b)} + ${C(s)} = ${C(left)}`, vars: { left } },
        { row: 'completed', math: 'completed', label: `Completed and transferred out: ${C(c)}`, vars: { completed: c } },
        { row: 'end', math: 'end', label: solved === 'end' ? `Ending WIP = ${C(left)} − ${C(c)} = ${C(e)}` : `Ending WIP: ${C(e)}`, vars: { end: e } },
        { row: 'right', math: 'right', label: `Accounted for: ${C(c)} + ${C(e)} = ${C(right)} ${left === right ? '✓ balances' : '✗ does not balance'}`, vars: { right }, tone: left === right ? 'good' : 'bad' },
      ]),
    });
  }

  // ------------------------------------------------------------------ step 2: equivalent units with no beginning WIP (slides 28–34)
  // timing: where materials enter (start | evenly | end); conv: ending WIP's conversion %.
  function euSimple({ completed, endUnits, timing = 'start', conv }) {
    const matPct = timing === 'start' ? 1 : timing === 'end' ? 0 : conv;
    const eMat = endUnits * matPct, eConv = endUnits * conv;
    const euMat = completed + eMat, euConv = completed + eConv;
    const timingTxt = timing === 'start' ? 'added at the start' : timing === 'end' ? 'added at the end' : 'added evenly';
    return clean({
      matPct, euMat, euConv, timingTxt,
      rows: [
        { id: 'done', label: 'Units completed and transferred', amounts: [completed, completed, completed], format: 'units', anchor: 'done' },
        { id: 'endw', label: `Ending WIP (${C(endUnits)} × ${PCT(matPct)} / ${PCT(conv)})`, amounts: [endUnits, eMat, eConv], format: 'units', anchor: 'endw' },
        { id: 'eu', label: 'Equivalent units', amounts: [completed + endUnits, euMat, euConv], format: 'units', style: 'total', anchor: 'eu' },
      ],
      trace: toTrace([
        { row: 'done', math: 'done', label: `Completed units are 100% complete for both: ${C(completed)} each`, vars: { completed } },
        { row: 'endw', math: 'endw', label: `Ending WIP, materials ${timingTxt}: ${C(endUnits)} × ${PCT(matPct)} = ${C(eMat)}`, vars: { endMat: eMat } },
        { row: 'endw', math: 'endw', label: `Ending WIP, conversion: ${C(endUnits)} × ${PCT(conv)} = ${C(eConv)}`, vars: { endConv: eConv } },
        { row: 'eu', math: 'eu', label: `EU: materials ${C(completed)} + ${C(eMat)} = ${C(euMat)}; conversion ${C(completed)} + ${C(eConv)} = ${C(euConv)}`, vars: { euMat, euConv }, tone: 'good' },
      ]),
    });
  }

  // ------------------------------------------------------------------ the cost-of-production report (five steps; WA or FIFO)
  // data: { beg: {units, <cat>: pct, cost: {<cat>: ₱}} | null, started, completed, end: {units, <cat>: pct}, added: {<cat>: ₱} }
  // Transferred-in units (cat ti) are 100% complete for TI by definition.
  function reportCore({ data, method = 'wa', tiCost }) {
    const fifo = method === 'fifo';
    const added = { ...(data.added ?? {}) };
    if (tiCost !== undefined && tiCost !== null) added.ti = tiCost;
    const cats = CATS.filter((k) => added[k] !== undefined || (k !== 'ti' && data.end[k] !== undefined));
    const beg = data.beg ?? null;
    const begU = beg ? beg.units : 0;
    const begPct = (k) => (k === 'ti' ? 1 : beg ? beg[k] ?? 0 : 0);
    const endPct = (k) => (k === 'ti' ? 1 : data.end[k] ?? 0);
    const begCost = (k) => (beg && beg.cost ? beg.cost[k] ?? 0 : 0);
    const startedU = data.started ?? data.completed + data.end.units - begU;
    const endU = data.end.units;
    const completedU = data.completed;
    const sc = completedU - begU; // started and completed (FIFO)
    const eu = {}, waEu = {}, toFinish = {}, endEu = {}, unit = {}, totalCost = {}, unitBase = {};
    for (const k of cats) {
      endEu[k] = endU * endPct(k);
      waEu[k] = completedU + endEu[k];
      toFinish[k] = begU * (1 - begPct(k));
      eu[k] = fifo ? waEu[k] - begU * begPct(k) : waEu[k];
      totalCost[k] = begCost(k) + (added[k] ?? 0);
      unitBase[k] = fifo ? (added[k] ?? 0) : totalCost[k];
      unit[k] = eu[k] ? unitBase[k] / eu[k] : 0;
    }
    const combined = sum(cats.map((k) => unit[k]));
    const begTotal = sum(cats.map(begCost));
    const addedTotal = sum(cats.map((k) => added[k] ?? 0));
    const total = begTotal + addedTotal;
    const finishCost = {};
    cats.forEach((k) => { finishCost[k] = toFinish[k] * unit[k]; });
    const completedCost = fifo ? begTotal + sum(cats.map((k) => finishCost[k])) + sc * combined : completedU * combined;
    const endCost = {};
    cats.forEach((k) => { endCost[k] = endEu[k] * unit[k]; });
    const endWip = sum(cats.map((k) => endCost[k]));
    const ncols = cats.length + 1;
    const pad = (first, f) => [first, ...cats.map(f)];
    const pctTxt = (fn) => cats.map((k) => PCT(fn(k))).join(' / ');

    // block 1: quantity schedule and equivalent units
    const q = [
      { id: 'q-head-in', label: 'Units to account for', style: 'heading' },
      ...(begU ? [{ id: 'q-beg', label: `Beginning WIP (${pctTxt(begPct)} complete)`, amounts: pad(begU, () => null), format: 'units', indent: 1, anchor: 'phys' }] : []),
      { id: 'q-started', label: cats.includes('ti') ? 'Transferred in this period' : 'Started this period', amounts: pad(startedU, () => null), format: 'units', indent: 1, anchor: 'phys' },
      { id: 'q-total', label: 'Total units to account for', amounts: pad(begU + startedU, () => null), format: 'units', style: 'subtotal', anchor: 'phys' },
      { id: 'q-head-out', label: 'Units accounted for', style: 'heading' },
      ...(fifo
        ? [
            ...(begU ? [{ id: 'q-finish', label: `From beginning WIP: work to finish it (${pctTxt((k) => 1 - begPct(k))})`, amounts: pad(begU, (k) => toFinish[k]), format: 'units', indent: 1, anchor: 'eu' }] : []),
            { id: 'q-sc', label: 'Started and completed this period', amounts: pad(sc, () => sc), format: 'units', indent: 1, anchor: 'eu' },
          ]
        : [{ id: 'q-done', label: 'Completed and transferred out', amounts: pad(completedU, () => completedU), format: 'units', indent: 1, anchor: 'eu' }]),
      { id: 'q-end', label: `Ending WIP (${pctTxt(endPct)} complete)`, amounts: pad(endU, (k) => endEu[k]), format: 'units', indent: 1, anchor: 'eu' },
      { id: 'q-eu', label: `Equivalent units (${fifo ? 'FIFO' : 'weighted-average'})`, amounts: pad(completedU + endU, (k) => eu[k]), format: 'units', style: 'total', anchor: 'eu' },
    ];
    // block 2: costs and unit costs
    const k2 = [
      ...(begTotal ? [{ id: 'c-beg', label: fifo ? 'Beginning WIP (kept separate under FIFO)' : 'Beginning WIP', amounts: pad(begTotal, begCost), indent: 1, anchor: 'costs' }] : []),
      { id: 'c-added', label: 'Costs added this period', amounts: pad(addedTotal, (k) => added[k] ?? 0), indent: 1, anchor: 'costs' },
      { id: 'c-total', label: 'Total costs to account for', amounts: pad(total, (k) => totalCost[k]), style: 'subtotal', anchor: 'costs' },
      ...(fifo && begTotal ? [{ id: 'c-base', label: 'Costs used for unit cost (current period only)', amounts: pad(addedTotal, (k) => added[k] ?? 0), anchor: 'unit' }] : []),
      { id: 'c-eu', label: '÷ Equivalent units', amounts: pad(null, (k) => eu[k]), format: 'number', anchor: 'unit' },
      { id: 'c-unit', label: 'Cost per equivalent unit', amounts: pad(combined, (k) => unit[k]), format: 'number', style: 'total', anchor: 'unit' },
    ];
    // block 3: assign costs and reconcile
    const a = [];
    if (fifo) {
      if (begU) {
        a.push({ id: 'a-beg', label: 'Beginning WIP cost carried in', amount: begTotal, indent: 1, anchor: 'completed' });
        cats.filter((k) => toFinish[k] > 0).forEach((k) => a.push({ id: `a-fin-${k}`, label: `To finish beginning WIP, ${CAT_SHORT[k]}: ${C(toFinish[k])} × ${N4(unit[k])}`, amount: finishCost[k], indent: 1, anchor: 'completed' }));
      }
      a.push({ id: 'a-sc', label: `Started and completed: ${C(sc)} × ${N4(combined)}`, amount: sc * combined, indent: 1, anchor: 'completed' });
      a.push({ id: 'a-done', label: 'Total cost transferred out', amount: completedCost, style: 'subtotal', anchor: 'completed' });
    } else {
      a.push({ id: 'a-done', label: `Completed and transferred out: ${C(completedU)} × ${N4(combined)}`, amount: completedCost, anchor: 'completed' });
    }
    cats.forEach((k) => a.push({ id: `a-end-${k}`, label: `Ending WIP, ${CAT_SHORT[k]}: ${C(endEu[k])} × ${N4(unit[k])}`, amount: endCost[k], indent: 1, anchor: 'end-wip' }));
    a.push({ id: 'a-end', label: 'Total ending WIP', amount: endWip, style: 'subtotal', anchor: 'end-wip' });
    a.push({ id: 'a-check', label: 'Total costs accounted for', amount: completedCost + endWip, style: 'total', anchor: 'reconcile' });

    // the accountant's order of work
    const steps = [];
    steps.push({ row: 'q-total', role: 'qty', reveal: ['q-beg', 'q-started', 'q-total'], math: 'phys', label: `Step 1: ${begU ? `${C(begU)} in beginning WIP + ` : ''}${C(startedU)} ${cats.includes('ti') ? 'transferred in' : 'started'} = ${C(begU + startedU)} units to account for`, vars: { unitsToAccount: begU + startedU } });
    if (fifo) {
      if (begU) steps.push({ row: 'q-finish', role: 'qty', reveal: ['q-finish'], math: 'eu', label: `FIFO: ${C(begU)} beginning units still needed ${pctTxt((k) => 1 - begPct(k))} more work`, vars: { begUnits: begU } });
      steps.push({ row: 'q-sc', role: 'qty', reveal: ['q-sc'], math: 'eu', label: `Started and completed: ${C(completedU)} − ${C(begU)} = ${C(sc)}, 100% for every category`, vars: { startedCompleted: sc } });
    } else {
      steps.push({ row: 'q-done', role: 'qty', reveal: ['q-done'], math: 'eu', label: `${C(completedU)} completed units are 100% complete for every category`, vars: { completed: completedU } });
    }
    steps.push({ row: 'q-end', role: 'qty', reveal: ['q-end'], math: 'eu', label: `Ending WIP: ${cats.map((k) => `${C(endU)} × ${PCT(endPct(k))} = ${C(endEu[k])}`).join('; ')}`, vars: { endUnits: endU } });
    cats.forEach((k, j) => steps.push({ row: 'q-eu', role: 'qty', reveal: [`q-eu:${j + 1}`, ...(j === 0 ? ['q-eu:0'] : [])], math: 'eu',
      label: `Step 2, ${CAT_SHORT[k]} EU: ${fifo ? `${C(begU ? toFinish[k] : 0)} + ${C(sc)}` : C(completedU)} + ${C(endEu[k])} = ${C(eu[k])}`, vars: { [`eu_${k}`]: eu[k] } }));
    steps.push({ row: 'c-total', role: 'cost', reveal: ['c-beg', 'c-added', 'c-total'], math: 'costs', label: `Step 3: costs to account for ${begTotal ? `${C(begTotal)} + ` : ''}${C(addedTotal)} = ${P(total)}`, vars: { total } });
    if (fifo && begTotal) steps.push({ row: 'c-base', role: 'cost', reveal: ['c-base', 'c-eu'], math: 'unit', label: 'FIFO divides only this period\'s costs; beginning WIP cost stays separate', vars: { currentCost: addedTotal } });
    cats.forEach((k, j) => steps.push({ row: 'c-unit', role: 'cost', reveal: [`c-unit:${j + 1}`, ...(j === 0 && !(fifo && begTotal) ? ['c-eu'] : [])], math: 'unit',
      label: `Step 4, ${CAT_SHORT[k]}: ${C(unitBase[k])} ÷ ${C(eu[k])} = ${N4(unit[k])} per EU`, vars: { [`unit_${k}`]: unit[k] } }));
    steps.push({ row: 'c-unit', role: 'cost', reveal: ['c-unit:0'], math: 'unit', label: `Combined cost per equivalent unit: ${cats.map((k) => N4(unit[k])).join(' + ')} = ${N4(combined)}`, vars: { combined }, tone: 'good' });
    if (fifo) {
      if (begU) {
        steps.push({ row: 'a-beg', role: 'assign', reveal: ['a-beg', ...cats.map((k) => `a-fin-${k}`)], math: 'completed', label: `Step 5: beginning WIP ${P(begTotal)} plus the cost to finish it`, vars: { begCost: begTotal } });
      }
      steps.push({ row: 'a-done', role: 'assign', reveal: ['a-sc', 'a-done'], math: 'completed', label: `Transferred out: ${P(completedCost)}`, vars: { completedCost }, tone: 'good' });
    } else {
      steps.push({ row: 'a-done', role: 'assign', reveal: ['a-done'], math: 'completed', label: `Step 5: ${C(completedU)} × ${N4(combined)} = ${P(completedCost)} transferred out`, vars: { completedCost }, tone: 'good' });
    }
    steps.push({ row: 'a-end', role: 'assign', reveal: [...cats.map((k) => `a-end-${k}`), 'a-end'], math: 'end-wip', label: `Ending WIP: ${cats.map((k) => C(Math.round(endCost[k]))).join(' + ')} = ${P(endWip)} (each category at its own unit cost)`, vars: { endWip } });
    steps.push({ row: 'a-check', role: 'assign', reveal: ['a-check'], math: 'reconcile', label: `Check: ${C(Math.round(completedCost))} + ${C(Math.round(endWip))} = ${P(completedCost + endWip)} = costs to account for ✓`, vars: { accounted: completedCost + endWip }, tone: 'good' });

    const columns = ['Total', ...cats.map((k) => CAT_NAME[k])];
    const qColumns = ['Physical units', ...cats.map((k) => CAT_NAME[k])];
    return { fifo, cats, begU, startedU, completedU, endU, sc, eu, waEu, endEu, toFinish, unit, combined, totalCost, begTotal, addedTotal, total,
      completedCost, endWip, endCost, finishCost, q, k2, a, steps, columns, qColumns, ncols };
  }
  function reportOut(r) {
    const o = { method: r.fifo ? 'FIFO' : 'weighted-average', completedCost: r.completedCost, endWip: r.endWip, total: r.total, combined: r.combined,
      check: r.completedCost + r.endWip - r.total, units: { beg: r.begU, started: r.startedU, completed: r.completedU, end: r.endU, sc: r.sc },
      qRows: r.q, costRows: r.k2, assignRows: r.a, columns: r.columns, qColumns: r.qColumns, steps: r.steps.length };
    for (const k of r.cats) { o[`eu_${k}`] = r.eu[k]; o[`unit_${k}`] = r.unit[k]; o[`end_${k}`] = r.endCost[k]; o[`cost_${k}`] = r.totalCost[k]; }
    return o;
  }
  // roles: journal, formula, code
  function report(args) {
    const r = reportCore(args);
    return clean({ ...reportOut(r), trace: toTrace(r.steps) });
  }
  // A worksheet that fills in as the walk advances.
  function reportSheet(args) {
    const r = reportCore(args);
    const rows = reveal([...r.q, ...r.k2, ...r.a], r.steps, args.upTo);
    const n1 = r.q.length, n2 = r.k2.length;
    return clean({ ...reportOut(r), qRows: rows.slice(0, n1), costRows: rows.slice(n1, n1 + n2), assignRows: rows.slice(n1 + n2) });
  }
  // roles: qty, cost, assign (three Schedules)
  function reportWalk(args) {
    const r = reportCore(args);
    return clean({ steps: r.steps.length, completedCost: r.completedCost, endWip: r.endWip, total: r.total, trace: toWalk(r.steps, 'sheetUpTo', 'qty') });
  }

  // Weighted-average vs FIFO side by side (slide 58).
  function compareMethods({ data }) {
    const wa = reportCore({ data, method: 'wa' }), ff = reportCore({ data, method: 'fifo' });
    const both = (f, fmtKind) => ({ amounts: [f(wa), f(ff)], format: fmtKind });
    return clean({
      wa: reportOut(wa), fifo: reportOut(ff), diffCompleted: ff.completedCost - wa.completedCost,
      rows: [
        { id: 'eu-mat', label: 'Equivalent units, materials', ...both((r) => r.eu.mat, 'units') },
        { id: 'eu-conv', label: 'Equivalent units, conversion', ...both((r) => r.eu.conv, 'units') },
        { id: 'u-mat', label: 'Unit cost, materials', ...both((r) => r.unit.mat, 'number') },
        { id: 'u-conv', label: 'Unit cost, conversion', ...both((r) => r.unit.conv, 'number') },
        { id: 'done', label: `Cost of goods completed (${C(wa.completedU)} units)`, ...both((r) => r.completedCost, 'money') },
        { id: 'end', label: 'Ending Work-in-Process', ...both((r) => r.endWip, 'money') },
        { id: 'tot', label: 'Total accounted for', ...both((r) => r.completedCost + r.endWip, 'money'), style: 'total' },
      ],
    });
  }
  function methodPick({ data, method }) {
    const r = reportCore({ data, method });
    return clean({ ...reportOut(r) });
  }

  // Equivalent units both ways, no costs (Examples 5, 7, 11).
  function euBoth({ data, waOnly = false }) {
    const begU = data.beg ? data.beg.units : 0;
    const cats = ['mat', 'conv'];
    const out = { rows: [] };
    const res = {};
    for (const k of cats) {
      const endEu = data.end.units * data.end[k];
      const wa = data.completed + endEu;
      const prior = begU * (data.beg ? data.beg[k] : 0);
      res[k] = { endEu, wa, prior, fifo: wa - prior };
    }
    out.wa_mat = res.mat.wa; out.wa_conv = res.conv.wa; out.fifo_mat = res.mat.fifo; out.fifo_conv = res.conv.fifo;
    out.prior_mat = res.mat.prior; out.prior_conv = res.conv.prior;
    out.rows = [
      { id: 'done', label: 'Units completed and transferred', amounts: [data.completed, data.completed], format: 'units', anchor: 'wa' },
      { id: 'endw', label: `+ Ending WIP (${C(data.end.units)} × ${PCT(data.end.mat)} / ${PCT(data.end.conv)})`, amounts: [res.mat.endEu, res.conv.endEu], format: 'units', anchor: 'wa' },
      { id: 'wa', label: 'Weighted-average equivalent units', amounts: [res.mat.wa, res.conv.wa], format: 'units', style: 'subtotal', anchor: 'wa' },
      { id: 'prior', label: `− Beginning WIP already done (${C(begU)} × ${data.beg ? `${PCT(data.beg.mat)} / ${PCT(data.beg.conv)}` : '0'})`, amounts: [res.mat.prior, res.conv.prior], format: 'units', anchor: 'prior' },
      { id: 'fifo', label: 'FIFO equivalent units', amounts: [res.mat.fifo, res.conv.fifo], format: 'units', style: 'total', anchor: 'fifo' },
    ];
    out.trace = toTrace([
      { row: 'done', math: 'wa', label: `Completed: ${C(data.completed)} units, 100% for materials and conversion`, vars: { completed: data.completed } },
      { row: 'endw', math: 'wa', label: `Ending WIP adds ${C(res.mat.endEu)} (materials) and ${C(res.conv.endEu)} (conversion)`, vars: { endMat: res.mat.endEu, endConv: res.conv.endEu } },
      { row: 'wa', math: 'wa', label: `Weighted-average EU: ${C(res.mat.wa)} materials, ${C(res.conv.wa)} conversion`, vars: { waMat: res.mat.wa, waConv: res.conv.wa } },
      { row: 'prior', math: 'prior', label: `Work done last period on beginning WIP: ${C(res.mat.prior)} and ${C(res.conv.prior)}`, vars: { priorMat: res.mat.prior, priorConv: res.conv.prior } },
      { row: 'fifo', math: 'fifo', label: `FIFO EU: ${C(res.mat.fifo)} materials, ${C(res.conv.fifo)} conversion`, vars: { fifoMat: res.mat.fifo, fifoConv: res.conv.fifo }, tone: 'good' },
    ]);
    if (waOnly) { out.rows = out.rows.slice(0, 3); out.trace = out.trace.slice(0, 3); }
    return clean(out);
  }

  // ------------------------------------------------------------------ journal entries between departments (slide 61, Example 6.5; Example 9)
  function transferEntries({ amount, from, to }) {
    const toAcct = to ? wipAcct(to) : FG;
    return clean({
      toAcct,
      entries: [{ id: 'transfer', memo: to ? `Units completed in ${from} move on to ${to}` : `Units completed in ${from}, the final department, go to finished goods`,
        lines: [line(toAcct, 'dr', amount, 'transfer'), line(wipAcct(from), 'cr', amount, 'transfer')] }],
    });
  }
  // Report + entry together, for a section or a case cell.
  function deptWithEntry({ data, method = 'wa', tiCost, final = false }) {
    const r = reportCore({ data, method, tiCost });
    const e = transferEntries({ amount: r.completedCost, from: data.dept, to: final ? null : data.next });
    const steps = [...r.steps, { entry: 'transfer', math: 'transfer', label: `Record it: debit ${e.toAcct}, credit ${wipAcct(data.dept)} ${P(r.completedCost)}`, vars: { transferred: r.completedCost }, tone: 'good' }];
    return clean({ ...reportOut(r), entries: e.entries, toAcct: e.toAcct, trace: toTrace(steps) });
  }

  // ------------------------------------------------------------------ classification board (slide 13)
  function classifyBoard({ items }) {
    return clean({
      chips: items.map((x) => ({ id: x.id, label: x.label })),
      bins: [{ id: 'job', label: 'Job-order costing' }, { id: 'process', label: 'Process costing' }],
      solution: Object.fromEntries(items.map((x) => [x.id, x.system])),
    });
  }

  // Diagnosing a reconciliation gap (slide 68).
  function reconcileGap({ toAccount, completed, endWip }) {
    const accounted = completed + endWip;
    return clean({ accounted, gap: toAccount - accounted, rows: [
      { id: 'ta', label: 'Total costs to account for (Step 3)', amount: toAccount },
      { id: 'done', label: 'Cost of units completed', amount: completed, indent: 1 },
      { id: 'end', label: 'Ending WIP as computed', amount: endWip, indent: 1 },
      { id: 'acc', label: 'Total accounted for (Step 5)', amount: accounted, style: 'subtotal' },
      { id: 'gap', label: 'Unexplained gap', amount: toAccount - accounted, style: 'total' },
    ] });
  }

  // ------------------------------------------------------------------ quiz generators
  const nice = (rng, lo, hi, step) => rng.int(Math.ceil(lo / step), Math.floor(hi / step)) * step;
  const pctPool = [0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.75, 0.8];

  function flowQ({ rng, difficulty }) {
    const beg = difficulty === 1 ? 0 : nice(rng, 500, 4000, 100);
    const started = nice(rng, 8000, 40000, 500);
    const end = nice(rng, 500, Math.min(started, 8000), 100);
    const completed = beg + started - end;
    const ask = difficulty >= 2 ? rng.pick(['end', 'started', 'completed']) : 'end';
    return {
      vars: { beg, started, completed, end, ask, answer: { end, started, completed }[ask],
        given: ask === 'end' ? `${C(started)} units started and ${C(completed)} completed` : ask === 'started' ? `${C(completed)} units completed and ${C(end)} left in ending WIP` : `${C(started)} units started and ${C(end)} left in ending WIP`,
        askText: ask === 'end' ? 'How many units are in ending Work-in-Process?' : ask === 'started' ? 'How many units were started this period?' : 'How many units were completed and transferred out?',
        wrongNoBeg: { end: started - completed, started: completed + end, completed: started - end }[ask],
        wrongSign: { end: started - completed - beg, started: completed + end + beg, completed: started - end - beg }[ask] },
      misconceptions: [
        { var: 'wrongNoBeg', feedback: 'You left out beginning WIP. Beginning + started = completed + ending.' },
        { var: 'wrongSign', feedback: 'Beginning WIP sits on the same side as units started: it adds to the units to account for.' },
      ],
    };
  }

  function euQ({ rng, difficulty }) {
    for (;;) {
      const timing = difficulty === 1 ? 'start' : rng.pick(['start', 'end', 'evenly']);
      const completed = nice(rng, 4000, 30000, 500);
      const endUnits = nice(rng, 1000, 10000, 500);
      const conv = rng.pick(pctPool);
      const r = euSimple({ completed, endUnits, timing, conv });
      if (r.euMat === r.euConv) continue;
      return {
        vars: { timing, timingTxt: r.timingTxt, completed, endUnits, conv, matPct: r.matPct, euMat: r.euMat, euConv: r.euConv,
          wrongSamePct: completed + endUnits * conv, wrongFull: completed + endUnits, wrongOnlyEnd: endUnits * conv },
        misconceptions: [
          { var: 'wrongFull', feedback: 'Ending WIP is only partly converted: count it at its percent complete.' },
          { var: 'wrongOnlyEnd', feedback: 'Completed units count too, at 100%.' },
        ],
      };
    }
  }

  // Weighted-average or FIFO report data with clean unit costs.
  function makeDept(rng, method, opts = {}) {
    for (;;) {
      const begU = opts.noBeg ? 0 : nice(rng, 500, 3000, 100);
      const started = nice(rng, 8000, 30000, 500);
      const endU = nice(rng, 1000, 6000, 500);
      const completed = begU + started - endU;
      if (completed <= begU) continue;
      const begConv = rng.pick([0.2, 0.4, 0.5, 0.6, 0.8]);
      const endConv = rng.pick([0.2, 0.25, 0.4, 0.5, 0.6, 0.8]);
      const matStart = !opts.matEnd;
      const beg = begU ? { units: begU, mat: matStart ? 1 : 0, conv: begConv, cost: {} } : null;
      const end = { units: endU, mat: matStart ? 1 : 0, conv: endConv };
      const uMat = rng.pick([1.5, 2, 2.5, 3, 4, 4.5, 5, 6]);
      const uConv = rng.pick([1.2, 2, 2.4, 3, 3.5, 4, 5, 8]);
      const data = { beg, started, completed, end, added: {} };
      const euWA = { mat: completed + endU * end.mat, conv: completed + endU * end.conv };
      const euFF = { mat: euWA.mat - begU * (beg ? beg.mat : 0), conv: euWA.conv - begU * (beg ? beg.conv : 0) };
      if (method === 'fifo') {
        data.added = { mat: uMat * euFF.mat, conv: uConv * euFF.conv };
        if (beg) beg.cost = { mat: begU * beg.mat * nice(rng, 1, 5, 0.5), conv: Math.round(begU * begConv * nice(rng, 1, 6, 0.5)) };
      } else {
        const totMat = uMat * euWA.mat, totConv = uConv * euWA.conv;
        if (beg) {
          beg.cost = { mat: Math.round((totMat * begU * beg.mat) / Math.max(1, euWA.mat) * rng.pick([0.8, 0.9, 1, 1.1])), conv: Math.round((totConv * begU * begConv) / euWA.conv * rng.pick([0.8, 0.9, 1, 1.1])) };
          data.added = { mat: totMat - beg.cost.mat, conv: totConv - beg.cost.conv };
        } else data.added = { mat: totMat, conv: totConv };
      }
      if (Object.values(data.added).some((x) => x <= 0 || Math.abs(x - Math.round(x)) > 1e-6)) continue;
      return data;
    }
  }
  const deptVars = (data, r) => ({
    begU: r.begU, started: r.startedU, completed: r.completedU, endU: r.endU, sc: r.sc,
    begMat: data.beg ? data.beg.mat : 0, begConv: data.beg ? data.beg.conv : 0, endMat: data.end.mat, endConv: data.end.conv,
    begCostMat: data.beg ? data.beg.cost.mat : 0, begCostConv: data.beg ? data.beg.cost.conv : 0, begCost: r.begTotal,
    addMat: data.added.mat, addConv: data.added.conv,
    euMat: r.eu.mat, euConv: r.eu.conv, unitMat: r.unit.mat, unitConv: r.unit.conv, combined: r.combined,
    completedCost: r.completedCost, endWip: r.endWip, total: r.total,
    begText: data.beg ? `Beginning WIP: ${C(r.begU)} units, ${PCT(data.beg.mat)} complete for materials and ${PCT(data.beg.conv)} for conversion, carrying ${P(data.beg.cost.mat)} of materials and ${P(data.beg.cost.conv)} of conversion cost.` : 'No beginning WIP.',
  });

  function waQ({ rng, difficulty }) {
    const data = makeDept(rng, 'wa', { noBeg: difficulty === 1 });
    const r = reportCore({ data, method: 'wa' });
    const ff = reportCore({ data, method: 'fifo' });
    return {
      vars: { ...deptVars(data, r), wrongFifoConv: ff.eu.conv, wrongAddedOnly: data.added.conv / r.eu.conv, wrongSamePct: r.completedU + r.endU * data.end.mat,
        rows: [...r.q.filter((x) => x.id !== 'q-head-in' && x.id !== 'q-head-out').map((x) => clean({ label: x.label, amounts: x.amounts, format: x.format, style: x.style, blank: x.id === 'q-eu' || undefined }))],
        accounts: rng.shuffle([wipAcct('Mixing'), wipAcct('Packaging'), FG, 'Cost of Goods Sold', 'Raw Materials Inventory']),
        entries: [{ lines: [{ account: wipAcct('Packaging'), debit: r.completedCost }, { account: wipAcct('Mixing'), credit: r.completedCost }] }] },
      misconceptions: [
        { var: 'wrongFifoConv', feedback: 'That is the FIFO count. Weighted-average keeps beginning WIP\'s earlier work in the equivalent units.' },
        { var: 'wrongAddedOnly', feedback: 'Weighted-average divides beginning WIP cost **plus** current cost by the equivalent units.' },
      ],
    };
  }

  function fifoQ({ rng, difficulty }) {
    const data = makeDept(rng, 'fifo', { matEnd: difficulty === 3 && rng.bool(0.5) });
    const r = reportCore({ data, method: 'fifo' });
    const wa = reportCore({ data, method: 'wa' });
    return {
      vars: { ...deptVars(data, r), waEuMat: wa.eu.mat, waEuConv: wa.eu.conv, toFinishConv: r.toFinish.conv, toFinishMat: r.toFinish.mat,
        wrongWaUnitConv: (data.added.conv + data.beg.cost.conv) / r.eu.conv,
        rows: [...r.q.filter((x) => x.id !== 'q-head-in' && x.id !== 'q-head-out').map((x) => clean({ label: x.label, amounts: x.amounts, format: x.format, style: x.style, blank: (x.id === 'q-eu' || x.id === 'q-finish') || undefined }))] },
      misconceptions: [
        { var: 'waEuConv', feedback: 'That is the weighted-average count. FIFO subtracts the work done on beginning WIP last period.' },
        { var: 'wrongWaUnitConv', feedback: 'Under FIFO only **this period\'s** cost is divided; beginning WIP cost is kept separate.' },
      ],
    };
  }

  function reportQ({ rng, difficulty }) {
    const method = difficulty >= 3 ? 'fifo' : 'wa';
    const data = makeDept(rng, method, { noBeg: difficulty === 1 });
    const r = reportCore({ data, method });
    return {
      vars: { ...deptVars(data, r), method: method === 'fifo' ? 'FIFO' : 'weighted-average',
        wrongEndFull: r.endU * r.combined, wrongCompletedEu: r.eu.conv * r.combined,
        assign: [
          { label: 'Cost of units completed and transferred out', amount: r.completedCost, blank: true },
          { label: 'Ending WIP: materials', amount: r.endCost.mat, indent: 1, blank: true },
          { label: 'Ending WIP: conversion', amount: r.endCost.conv, indent: 1, blank: true },
          { label: 'Total costs accounted for', amount: r.completedCost + r.endWip, style: 'total' },
        ] },
      misconceptions: [
        { var: 'wrongEndFull', feedback: 'Ending WIP is only partly converted: cost each category on its own equivalent units.' },
        { var: 'wrongCompletedEu', feedback: 'Completed units are costed at the full combined unit cost, per physical unit.' },
      ],
    };
  }

  function tiQ({ rng }) {
    for (;;) {
      const tiUnits = nice(rng, 5000, 20000, 500);
      const endU = nice(rng, 500, Math.floor(tiUnits / 3), 100);
      const completed = tiUnits - endU;
      const uTi = rng.pick([10, 12, 15, 18, 20, 25]);
      const uMat = rng.pick([2, 4, 5, 6, 8]);
      const uConv = rng.pick([3, 4, 6, 9, 12]);
      const conv = rng.pick([0.2, 0.4, 0.5, 0.6, 0.75]);
      const matEnd = rng.bool(0.6);
      const end = { units: endU, ti: 1, mat: matEnd ? 0 : 1, conv };
      const data = { beg: null, started: tiUnits, completed, end, added: { ti: uTi * tiUnits, mat: uMat * (completed + endU * end.mat), conv: uConv * (completed + endU * conv) }, dept: 'Blending' };
      if (Object.values(data.added).some((x) => Math.abs(x - Math.round(x)) > 1e-6)) continue;
      const r = reportCore({ data, method: 'wa' });
      return {
        vars: { tiUnits, endU, completed, conv, matEnd, matTxt: matEnd ? 'at the end of the process' : 'at the start of the process', tiCost: data.added.ti, addMat: data.added.mat, addConv: data.added.conv,
          euTi: r.eu.ti, euMat: r.eu.mat, euConv: r.eu.conv, unitTi: r.unit.ti, unitMat: r.unit.mat, unitConv: r.unit.conv, combined: r.combined,
          completedCost: r.completedCost, endWip: r.endWip, endMatPct: end.mat,
          wrongTiPartial: completed + endU * conv, wrongNoTi: completed * (r.unit.mat + r.unit.conv),
          accounts: rng.shuffle([FG, wipAcct('Blending'), wipAcct('Mixing'), 'Cost of Goods Sold', 'Raw Materials Inventory']),
          entries: [{ lines: [{ account: FG, debit: r.completedCost }, { account: wipAcct('Blending'), credit: r.completedCost }] }] },
        misconceptions: [
          { var: 'wrongNoTi', feedback: 'Units carry their transferred-in cost with them: include the TI unit cost in the combined cost.' },
          { value: completed * (r.unit.ti + r.unit.conv), feedback: 'Include the materials added in this department too.' },
        ],
      };
    }
  }

  return {
    fns: { physicalFlow, euSimple, report, reportSheet, reportWalk, compareMethods, methodPick, euBoth, transferEntries, deptWithEntry, reconcileGap },
    generators: { flowQ, euQ, waQ, fifoQ, reportQ, tiQ },
  };
}
