export default function register(sdk) {
  const { round, fmt, sum } = sdk;
  const P = (x) => fmt(x, 'money');
  const P2 = (x) => fmt(x, 'money2');
  const C = (x) => fmt(x, 'comma');
  const R4 = (x) => String(round(x, 4));

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
  // A "step" is { row?, reveal?: [rowId | 'rowId:col'], label, math?, code?, vars?, tone?, data? }.
  // Math & Journal trace: roles journal (the section's pane), formula, code.
  function toTrace(steps, role = 'journal') {
    return steps.map((s, i) => {
      const ops = [];
      if (i === 0) ops.push({ role, cmd: 'clear' });
      if (s.row) ops.push({ role, cmd: 'highlight', args: { sel: `row:${s.row}`, tone: s.tone ?? 'accent' } });
      return clean({ label: s.label, math: s.math, code: s.code ?? s.math, vars: s.vars ?? {}, ops });
    });
  }
  // Intuition walk: each step reveals the next worksheet cells through `patch: {key: n}`.
  // `data` names a Matrix row to light up in the role `data`.
  function toWalk(steps, role, key) {
    return steps.map((s, i) => {
      const ops = [];
      if (s.row) ops.push({ role, cmd: 'highlight', args: { sel: `row:${s.row}`, tone: s.tone ?? 'accent' } });
      if (s.data) {
        for (const d of s.data) ops.push({ role: 'data', cmd: 'highlight', args: { sel: `row:${d.row}`, tone: d.tone ?? 'accent' } });
      }
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
      if (Array.isArray(out.amounts)) out.amounts = out.amounts.map((v, j) => (pending.has(r.id) || pending.has(`${r.id}:${j}`) ? null : v));
      else if ('amount' in out && pending.has(r.id)) out.amount = null;
      return out;
    });
  }
  const nice = (rng, lo, hi, step) => rng.int(Math.ceil(lo / step), Math.floor(hi / step)) * step;
  const twoDp = (x) => Math.abs(x * 100 - Math.round(x * 100)) < 1e-9;

  // ------------------------------------------------------------------ fixed cost per unit (Example 1, slides 15–16)
  // roles: journal, formula, code
  function fixedPerUnitCore({ total, volumes }) {
    const units = volumes.map((v) => total / v);
    const rows = [];
    const steps = [];
    volumes.forEach((v, i) => {
      rows.push({ id: `h${i}`, label: `At ${C(v)} units produced`, style: 'heading' });
      rows.push({ id: `t${i}`, label: 'Total fixed cost', amount: total, indent: 1, anchor: 'total' });
      rows.push({ id: `u${i}`, label: `Cost per unit: ${C(total)} ÷ ${C(v)}`, amount: units[i], indent: 1, anchor: 'unit' });
      steps.push({ row: `t${i}`, math: 'total', label: `At ${C(v)} units the total is still ${P(total)}`, vars: { total, volume: v } });
      steps.push({ row: `u${i}`, math: 'unit', label: `${C(total)} ÷ ${C(v)} = ${P2(units[i])} per unit`, vars: { unit: units[i] }, tone: 'good' });
    });
    return { units, rows, steps };
  }
  // Pass `volumes: [v1, v2]` or the two volumes as `v1` and `v2`.
  function fixedPerUnit({ total, volumes, v1, v2 }) {
    const r = fixedPerUnitCore({ total, volumes: volumes ?? [v1, v2] });
    return clean({ unit1: r.units[0], unit2: r.units[1], total, ratio: r.units[1] / r.units[0], rows: r.rows, trace: toTrace(r.steps) });
  }

  // ------------------------------------------------------------------ one cost, one volume, any pattern (slides 11–21)
  // kind: variable | fixed | mixed | step. A step cost is ceil(volume / stepWidth) × stepAmount (module convention).
  function behaviorAt({ kind, fixed = 0, rate = 0, volume, stepWidth = 1, stepAmount = 0 }) {
    let fixedPart = 0;
    let varPart = 0;
    let stepsUsed = null;
    if (kind === 'variable') varPart = rate * volume;
    else if (kind === 'fixed') fixedPart = fixed;
    else if (kind === 'mixed') { fixedPart = fixed; varPart = rate * volume; }
    else if (kind === 'step') { stepsUsed = Math.ceil(volume / stepWidth); fixedPart = stepsUsed * stepAmount; }
    const total = fixedPart + varPart;
    const perUnit = volume > 0 ? total / volume : null;
    return clean({
      total, perUnit, fixedPart, varPart, steps: stepsUsed,
      rows: [
        { id: 'total', label: `Total cost at ${C(volume)} units`, amount: total, style: 'subtotal' },
        { id: 'unit', label: 'Cost per unit', amount: perUnit },
      ],
    });
  }
  // The four patterns side by side for a Chart: x from 0 to maxVolume.
  function patternCurves({ variableRate, fixedTotal, mixedFixed, mixedRate, stepWidth, stepAmount, maxVolume }) {
    const x = [];
    const variable = [];
    const fixedLine = [];
    const mixed = [];
    const step = [];
    for (let v = 0; v <= maxVolume; v += 1) {
      x.push(v);
      variable.push(variableRate * v);
      fixedLine.push(fixedTotal);
      mixed.push(mixedFixed + mixedRate * v);
      step.push(v === 0 ? 0 : Math.ceil(v / stepWidth) * stepAmount);
    }
    return { x, variable, fixed: fixedLine, mixed, step };
  }

  // Is a volume inside the range the formula was estimated from? (slides 26–29, 71)
  function rangeCheck({ volume, low, high }) {
    const status = volume < low ? 'below' : volume > high ? 'above' : 'inside';
    const text = status === 'inside'
      ? 'Inside the relevant range: the formula can be trusted.'
      : status === 'below' ? 'Below the range the formula was built from: be careful.' : 'Above the range the formula was built from: be careful.';
    return { inside: status === 'inside', status, text };
  }

  // ------------------------------------------------------------------ the cost formula y = a + bx (slides 20, 50, 68–69, 74)
  // roles: journal, formula, code
  function costFormulaCore({ a, b, x }) {
    const varPart = b * x;
    const y = a + varPart;
    const rows = [
      { id: 'a', label: 'Fixed cost component (a)', amount: a, anchor: 'a' },
      { id: 'bx', label: `Variable cost: ${R4(b)} × ${C(x)}`, amount: varPart, anchor: 'bx' },
      { id: 'y', label: 'Estimated total cost (y′)', amount: y, style: 'total', anchor: 'y' },
    ];
    const steps = [
      { row: 'a', math: 'a', label: `Fixed part is ${P2(a)} whatever the activity`, vars: { a } },
      { row: 'bx', math: 'bx', label: `Variable part: ${R4(b)} × ${C(x)} = ${P2(varPart)}`, vars: { varPart } },
      { row: 'y', math: 'y', label: `y′ = ${C(a)} + ${C(varPart)} = ${P2(y)}`, vars: { y }, tone: 'good' },
    ];
    return { y, varPart, rows, steps };
  }
  function costFormula(args) {
    const r = costFormulaCore(args);
    return clean({ y: r.y, varPart: r.varPart, fixedPart: args.a, perUnit: args.x > 0 ? r.y / args.x : null, rows: r.rows, trace: toTrace(r.steps) });
  }

  // ------------------------------------------------------------------ high-low method (slides 42–50, 73–74)
  // High and low are chosen by ACTIVITY (x), never by cost (slide 42). Ties for an extreme take the first listed.
  // roles: journal, formula, code. Scene walk roles: sheet (Schedule), data (Matrix of the points).
  function highLowCore({ points }) {
    let hi = points[0];
    let lo = points[0];
    for (const p of points) {
      if (p.x > hi.x) hi = p;
      if (p.x < lo.x) lo = p;
    }
    const dx = hi.x - lo.x;
    const dy = hi.y - lo.y;
    const b = dx === 0 ? null : dy / dx;
    const varHi = b === null ? null : b * hi.x;
    const varLo = b === null ? null : b * lo.x;
    const aHigh = b === null ? null : hi.y - varHi;
    const aLow = b === null ? null : lo.y - varLo;
    return { hi, lo, dx, dy, b, varHi, varLo, aHigh, aLow };
  }
  function highLowSteps(r) {
    const { hi, lo, dx, dy, b, varHi, varLo, aHigh, aLow } = r;
    return [
      { row: 'hi-x', math: 'dx', label: `Highest activity: ${hi.label}, ${C(hi.x)} hours, cost ${P(hi.y)}`, vars: { highX: hi.x, highY: hi.y } },
      { row: 'lo-x', math: 'dx', label: `Lowest activity: ${lo.label}, ${C(lo.x)} hours, cost ${P(lo.y)}`, vars: { lowX: lo.x, lowY: lo.y } },
      { row: 'dx', math: 'dx', label: `Change in activity: ${C(hi.x)} − ${C(lo.x)} = ${C(dx)}`, vars: { dx } },
      { row: 'dy', math: 'dy', label: `Change in cost: ${C(hi.y)} − ${C(lo.y)} = ${P(dy)}`, vars: { dy } },
      { row: 'b', math: 'b', label: `b = ${C(dy)} ÷ ${C(dx)} = ${P(round(b, 4))} per hour`, vars: { b }, tone: 'good' },
      { row: 'fx-var', math: 'varcost', label: `Variable cost: ${R4(b)} × ${C(hi.x)} = ${P2(varHi)} at high, ${P2(varLo)} at low`, vars: { varHigh: varHi, varLow: varLo } },
      { row: 'fx-a', math: 'a', label: `Fixed cost: ${C(hi.y)} − ${C(varHi)} = ${P2(aHigh)}; low point gives ${P2(aLow)}`, vars: { a: aHigh }, tone: 'good' },
    ];
  }
  function highLowRows(r) {
    const { hi, lo, dx, dy, b, varHi, varLo, aHigh, aLow } = r;
    return {
      rows: [
        { id: 'hi-x', label: `High point, ${hi.label}: activity`, amount: hi.x, format: 'number', anchor: 'dx' },
        { id: 'hi-y', label: `High point, ${hi.label}: total cost`, amount: hi.y, anchor: 'dy' },
        { id: 'lo-x', label: `Low point, ${lo.label}: activity`, amount: lo.x, format: 'number', anchor: 'dx' },
        { id: 'lo-y', label: `Low point, ${lo.label}: total cost`, amount: lo.y, anchor: 'dy' },
        { id: 'dx', label: 'Difference in activity', amount: dx, format: 'number', style: 'subtotal', anchor: 'dx' },
        { id: 'dy', label: 'Difference in cost', amount: dy, style: 'subtotal', anchor: 'dy' },
        { id: 'b', label: `Variable rate b = ${C(dy)} ÷ ${C(dx)} (per unit of activity)`, amount: b, format: 'number', style: 'total', anchor: 'b' },
      ],
      fixedColumns: [`High (${hi.label})`, `Low (${lo.label})`],
      fixedRows: [
        { id: 'fx-total', label: 'Total cost', amounts: [hi.y, lo.y], anchor: 'total' },
        { id: 'fx-var', label: 'Less: variable cost (b × activity)', amounts: [varHi, varLo], indent: 1, anchor: 'varcost' },
        { id: 'fx-a', label: 'Fixed cost component (a)', amounts: [aHigh, aLow], style: 'total', anchor: 'a' },
      ],
    };
  }
  function highLow({ points }) {
    const r = highLowCore({ points });
    const rr = highLowRows(r);
    return clean({
      hiLabel: r.hi.label, loLabel: r.lo.label, hiX: r.hi.x, hiY: r.hi.y, loX: r.lo.x, loY: r.lo.y,
      dx: r.dx, dy: r.dy, b: r.b, varHigh: r.varHi, varLow: r.varLo, aHigh: r.aHigh, aLow: r.aLow, a: r.aHigh,
      formula: r.b === null ? null : `y′ = ${P2(r.aHigh)} + ${P(round(r.b, 4))}x`,
      rows: rr.rows, fixedColumns: rr.fixedColumns, fixedRows: rr.fixedRows,
      trace: toTrace(highLowSteps(r)),
    });
  }
  // The same computation as one single-column worksheet that fills in step by step.
  function highLowSheetRows(r) {
    const { hi, lo, dx, dy, b, varHi, varLo, aHigh, aLow } = r;
    const rows = [
      { id: 'h-head', label: 'High and low points (by activity)', style: 'heading' },
      { id: 'hi-x', label: `High, ${hi.label}: activity`, amount: hi.x, format: 'number', indent: 1 },
      { id: 'hi-y', label: `High, ${hi.label}: total cost`, amount: hi.y, indent: 1 },
      { id: 'lo-x', label: `Low, ${lo.label}: activity`, amount: lo.x, format: 'number', indent: 1 },
      { id: 'lo-y', label: `Low, ${lo.label}: total cost`, amount: lo.y, indent: 1 },
      { id: 'r-head', label: 'Variable rate', style: 'heading' },
      { id: 'dx', label: 'Difference in activity', amount: dx, format: 'number', indent: 1 },
      { id: 'dy', label: 'Difference in cost', amount: dy, indent: 1 },
      { id: 'b', label: 'b = difference in cost ÷ difference in activity', amount: b, format: 'number', style: 'subtotal' },
      { id: 'f-head', label: 'Fixed cost', style: 'heading' },
      { id: 'fx-hi-var', label: 'Variable cost at the high point', amount: varHi, indent: 1 },
      { id: 'fx-hi-a', label: 'Fixed cost from the high point', amount: aHigh, indent: 1 },
      { id: 'fx-lo-var', label: 'Variable cost at the low point', amount: varLo, indent: 1 },
      { id: 'fx-lo-a', label: 'Fixed cost from the low point', amount: aLow, style: 'total' },
    ];
    const steps = [
      { reveal: ['hi-x', 'hi-y'], row: 'hi-x', label: `Highest activity is ${hi.label}: ${C(hi.x)} hours at ${P(hi.y)}`, vars: { highX: hi.x, highY: hi.y }, data: [{ row: hi.label, tone: 'good' }] },
      { reveal: ['lo-x', 'lo-y'], row: 'lo-x', label: `Lowest activity is ${lo.label}: ${C(lo.x)} hours at ${P(lo.y)}`, vars: { lowX: lo.x, lowY: lo.y }, data: [{ row: hi.label, tone: 'good' }, { row: lo.label, tone: 'bad' }] },
      { row: 'dx', label: `Activity moved ${C(hi.x)} − ${C(lo.x)} = ${C(dx)} hours`, vars: { dx } },
      { row: 'dy', label: `Cost moved ${C(hi.y)} − ${C(lo.y)} = ${P(dy)}`, vars: { dy } },
      { row: 'b', label: `${C(dy)} ÷ ${C(dx)} = ${P(round(b, 4))} per hour`, vars: { b }, tone: 'good' },
      { row: 'fx-hi-var', label: `At the high point variable cost is ${R4(b)} × ${C(hi.x)} = ${P2(varHi)}`, vars: { varHigh: varHi } },
      { row: 'fx-hi-a', label: `Fixed cost is ${C(hi.y)} − ${C(varHi)} = ${P2(aHigh)}`, vars: { a: aHigh }, tone: 'good' },
      { row: 'fx-lo-var', label: `At the low point variable cost is ${R4(b)} × ${C(lo.x)} = ${P2(varLo)}`, vars: { varLow: varLo } },
      { row: 'fx-lo-a', label: `Fixed cost is ${C(lo.y)} − ${C(varLo)} = ${P2(aLow)}: the same`, vars: { a: aLow }, tone: 'good' },
    ];
    return { rows, steps };
  }
  function highLowSheet({ points, upTo }) {
    const r = highLowCore({ points });
    const s = highLowSheetRows(r);
    return clean({ rows: reveal(s.rows, s.steps, upTo), b: r.b, a: r.aHigh });
  }
  // roles: sheet (Schedule), data (Matrix)
  function highLowWalk({ points }) {
    const r = highLowCore({ points });
    const s = highLowSheetRows(r);
    return clean({ steps: s.steps.length, b: r.b, a: r.aHigh, trace: toWalk(s.steps, 'sheet', 'hlUpTo') });
  }
  // A points list as a Matrix payload (month × [activity, cost]).
  function pointsMatrix({ points, xName = 'DLH', yName = 'Overhead' }) {
    return { data: { rows: points.map((p) => p.label), cols: [xName, yName], values: points.map((p) => [p.x, p.y]) } };
  }

  // ------------------------------------------------------------------ scattergraph (slides 55–58)
  // roundRate: round b to this many decimals before predicting (the slide's 0.8261; omit for full precision).
  // roles: journal, formula, code
  function scatterFormula({ a, x, y, roundRate }) {
    const varPart = y - a;
    const bExact = varPart / x;
    const b = roundRate === undefined || roundRate === null ? bExact : round(bExact, roundRate);
    const rows = [
      { id: 'pt', label: `Total cost on the line at ${C(x)} hours`, amount: y, anchor: 'y' },
      { id: 'int', label: 'Less: fixed cost read at the vertical axis', amount: a, indent: 1, anchor: 'a' },
      { id: 'var', label: 'Variable cost at that point', amount: varPart, style: 'subtotal', anchor: 'var' },
      { id: 'rate', label: `Variable rate b = ${C(varPart)} ÷ ${C(x)}`, amount: b, format: 'number', style: 'total', anchor: 'b' },
    ];
    const steps = [
      { row: 'int', math: 'a', label: `The line crosses the cost axis at ${P(a)}: the fixed cost`, vars: { a } },
      { row: 'pt', math: 'y', label: `A point on the line: ${C(x)} hours at ${P(y)}`, vars: { x, y } },
      { row: 'var', math: 'var', label: `${C(y)} − ${C(a)} = ${P(varPart)} is variable`, vars: { varPart } },
      { row: 'rate', math: 'b', label: `${C(varPart)} ÷ ${C(x)} = ${R4(bExact)} per hour`, vars: { b: bExact }, tone: 'good' },
    ];
    return clean({ a, varPart, b, bExact, formula: `y′ = ${P(a)} + ${R4(b)}x`, rows, trace: toTrace(steps) });
  }
  // Dots and the fitted line for a Chart. The line pivots about the point (px, py) as the intercept moves.
  function scatterPlot({ points, intercept, px, py, xMax }) {
    const b = (py - intercept) / px;
    const lineX = [];
    const lineY = [];
    const n = 40;
    for (let i = 0; i <= n; i += 1) {
      const xv = (xMax * i) / n;
      lineX.push(xv);
      lineY.push(intercept + b * xv);
    }
    return { dotsX: points.map((p) => p.x), dotsY: points.map((p) => p.y), lineX, lineY, b, varPart: py - intercept };
  }

  // ------------------------------------------------------------------ head to head (slide 64)
  // Both formulas predict at each activity level. Flat arguments so each can be bound to a slider.
  function compareCore({ hlA, hlB, sgA, sgB, levels }) {
    const preds = levels.map((x) => {
      const hl = hlA + hlB * x;
      const sg = sgA + sgB * x;
      return { x, hl, sg, gap: hl - sg };
    });
    const rows = [
      { id: 'f-hl', label: `High-low formula: y′ = ${C(hlA)} + ${R4(hlB)}x`, style: 'heading', anchor: 'hl' },
      { id: 'f-sg', label: `Scattergraph formula: y′ = ${C(sgA)} + ${R4(sgB)}x`, style: 'heading', anchor: 'sg' },
      ...preds.map((p, i) => ({ id: `l${i}`, label: `Predicted overhead at ${C(p.x)} DLH`, amounts: [p.hl, p.sg, p.gap], anchor: 'gap' })),
    ];
    const steps = [];
    preds.forEach((p, i) => {
      steps.push({ reveal: [`l${i}:0`], row: `l${i}`, label: `High-low at ${C(p.x)}: ${C(hlA)} + ${R4(hlB)} × ${C(p.x)} = ${P(p.hl)}`, vars: { x: p.x, hl: p.hl } });
      steps.push({ reveal: [`l${i}:1`], row: `l${i}`, label: `Scattergraph at ${C(p.x)}: ${C(sgA)} + ${R4(sgB)} × ${C(p.x)} = ${P(p.sg)}`, vars: { x: p.x, sg: p.sg } });
      steps.push({ reveal: [`l${i}:2`], row: `l${i}`, label: `Gap: ${P(p.hl)} − ${P(p.sg)} = ${P(p.gap)}`, vars: { gap: p.gap }, tone: p.gap >= 0 ? 'accent' : 'warn' });
    });
    return { preds, rows, steps };
  }
  function compareMethods(args) {
    const r = compareCore(args);
    return clean({ predictions: r.preds, rows: r.rows, widest: Math.max(...r.preds.map((p) => Math.abs(p.gap))), trace: toTrace(r.steps.map((s) => ({ ...s, math: undefined }))) });
  }
  function compareSheet(args) {
    const r = compareCore(args);
    return clean({ rows: reveal(r.rows, r.steps, args.upTo) });
  }
  // roles: sheet (Schedule)
  function compareWalk(args) {
    const r = compareCore(args);
    return clean({ steps: r.steps.length, trace: toWalk(r.steps, 'sheet', 'cmpUpTo') });
  }

  // ------------------------------------------------------------------ incremental overhead for one order (slides 77–78)
  function incremental({ a, b, hours, deptHours }) {
    const inc = b * hours;
    const wholeDept = a + b * deptHours;
    const wrongWithFixed = a + inc;
    const wrongAllocated = (a * hours) / deptHours + inc;
    const rows = [
      { id: 'fixed', label: 'Fixed overhead, incurred with or without the order', amount: a, anchor: 'a' },
      { id: 'inc', label: `Variable overhead the order causes: ${C(hours)} × ${R4(b)}`, amount: inc, style: 'total', anchor: 'inc' },
    ];
    const steps = [
      { row: 'fixed', math: 'a', label: `${P(a)} is paid whether or not the order is accepted`, vars: { a } },
      { row: 'inc', math: 'inc', label: `Only ${C(hours)} × ${R4(b)} = ${P(inc)} changes with the order`, vars: { incremental: inc }, tone: 'good' },
    ];
    return clean({ incremental: inc, wholeDept, wrongWithFixed, wrongAllocated, rows, trace: toTrace(steps) });
  }

  // ------------------------------------------------------------------ the outlier (slides 62, 75–76)
  // Columns: all months, then without the outlier. at: an activity level to predict.
  function outlierScreen({ points, outlier, at }) {
    const all = highLowCore({ points });
    const rest = points.filter((p) => p.label !== outlier);
    const clean2 = highLowCore({ points: rest });
    const pred = (r) => r.aHigh + r.b * at;
    const rows = [
      { id: 'hi-x', label: 'Activity at the high point', amounts: [all.hi.x, clean2.hi.x], format: 'number' },
      { id: 'hi-y', label: 'Cost at the high point', amounts: [all.hi.y, clean2.hi.y] },
      { id: 'lo-x', label: 'Activity at the low point', amounts: [all.lo.x, clean2.lo.x], format: 'number' },
      { id: 'lo-y', label: 'Cost at the low point', amounts: [all.lo.y, clean2.lo.y] },
      { id: 'b', label: 'Variable rate b', amounts: [all.b, clean2.b], format: 'number', style: 'subtotal', anchor: 'b' },
      { id: 'a', label: 'Fixed cost a', amounts: [all.aHigh, clean2.aHigh], style: 'subtotal', anchor: 'a' },
      { id: 'pred', label: `Predicted cost at ${C(at)}`, amounts: [pred(all), pred(clean2)], style: 'total', anchor: 'pred' },
    ];
    const steps = [
      { row: 'hi-y', math: 'b', label: `With ${outlier}, the high point is ${all.hi.label} at ${P(all.hi.y)}`, vars: { highY: all.hi.y } },
      { row: 'b', math: 'b', label: `Rate with it ${R4(all.b)}; without it ${R4(clean2.b)}`, vars: { bWith: all.b, bWithout: clean2.b }, tone: 'bad' },
      { row: 'a', math: 'a', label: `Fixed cost ${P(all.aHigh)} with it; ${P(clean2.aHigh)} without`, vars: { aWith: all.aHigh, aWithout: clean2.aHigh } },
      { row: 'pred', math: 'pred', label: `At ${C(at)}: ${P(pred(all))} against ${P(pred(clean2))}`, vars: { predWith: pred(all), predWithout: pred(clean2) }, tone: 'good' },
    ];
    return clean({
      bWith: all.b, aWith: all.aHigh, bWithout: clean2.b, aWithout: clean2.aHigh,
      predWith: pred(all), predWithout: pred(clean2), hiWith: all.hi.label, hiWithout: clean2.hi.label,
      columns: [`With ${outlier}`, `Without ${outlier}`], rows, trace: toTrace(steps),
    });
  }

  // The dots and the high-low line, with the outlier month in or out. include: 'yes' | 'no'.
  function outlierView({ points, outlier, include, xMax }) {
    const used = include === 'no' ? points.filter((p) => p.label !== outlier) : points;
    const r = highLowCore({ points: used });
    const lineX = [];
    const lineY = [];
    const n = 40;
    for (let i = 0; i <= n; i += 1) {
      const xv = (xMax * i) / n;
      lineX.push(xv);
      lineY.push(r.aHigh + r.b * xv);
    }
    const out = points.find((p) => p.label === outlier);
    return {
      dotsX: used.map((p) => p.x), dotsY: used.map((p) => p.y), lineX, lineY,
      b: r.b, a: r.aHigh, hiLabel: r.hi.label, loLabel: r.lo.label, outX: out.x, outY: out.y,
    };
  }

  // ------------------------------------------------------------------ quiz generators
  const WORDS = {
    variable: 'Variable',
    fixed: 'Fixed',
    mixed: 'Mixed',
    step: 'Step',
  };
  const BEHAVIOR_ITEMS = [
    { text: 'Wood used to build each dining table', kind: 'variable' },
    { text: 'Sales commissions of 4% of sales', kind: 'variable' },
    { text: 'Fuel for delivery trucks, a fixed amount per kilometer driven', kind: 'variable' },
    { text: 'Straight-line depreciation on the factory building', kind: 'fixed' },
    { text: 'Annual property insurance on the plant', kind: 'fixed' },
    { text: 'Salary of the plant manager', kind: 'fixed' },
    { text: 'A truck rental: ₱12,000 a month plus ₱8 per kilometer', kind: 'mixed' },
    { text: 'Electric power: a base charge plus a charge per kWh used', kind: 'mixed' },
    { text: 'Sales staff pay: a base salary plus a commission', kind: 'mixed' },
    { text: 'One extra delivery truck for every 2,000 deliveries a month', kind: 'step' },
    { text: 'One quality inspector for every 20 production workers', kind: 'step' },
    { text: 'Warehouse space leased in blocks of 10,000 square feet', kind: 'step' },
  ];
  function behaviorClassQ({ rng }) {
    const item = rng.pick(BEHAVIOR_ITEMS);
    const kinds = ['variable', 'fixed', 'mixed', 'step'];
    const options = rng.shuffle(kinds.map((k) => WORDS[k]));
    return { vars: { item: item.text, kindName: WORDS[item.kind] }, options, answer: options.indexOf(WORDS[item.kind]) };
  }
  const COMMIT_ITEMS = [
    { text: 'Rent on a factory under a 10-year lease', kind: 'committed' },
    { text: 'Depreciation on owned machinery', kind: 'committed' },
    { text: 'Property taxes and insurance on the plant', kind: 'committed' },
    { text: 'Salaries of long-tenured senior executives', kind: 'committed' },
    { text: 'The annual advertising budget', kind: 'discretionary' },
    { text: 'The annual employee training budget', kind: 'discretionary' },
    { text: 'Research and development spending this year', kind: 'discretionary' },
    { text: 'Sponsorship of a local trade fair', kind: 'discretionary' },
  ];
  function commitQ({ rng }) {
    const item = rng.pick(COMMIT_ITEMS);
    const options = rng.shuffle(['Committed fixed cost', 'Discretionary fixed cost', 'Variable cost', 'Mixed cost']);
    const right = item.kind === 'committed' ? 'Committed fixed cost' : 'Discretionary fixed cost';
    return { vars: { item: item.text, kindName: right }, options, answer: options.indexOf(right) };
  }

  // Fixed cost per unit at a second volume.
  function unitQ({ rng, difficulty }) {
    for (;;) {
      const volumePool = difficulty === 1 ? [1000, 2000, 4000, 5000, 10000] : [1000, 1500, 2000, 2500, 4000, 5000, 8000, 10000, 12500];
      const v1 = rng.pick(volumePool);
      const v2 = rng.pick(volumePool);
      if (v2 <= v1) continue;
      const total = nice(rng, 12000, 90000, 3000);
      const r = fixedPerUnit({ total, volumes: [v1, v2] });
      if (!twoDp(r.unit1) || !twoDp(r.unit2)) continue;
      if (Math.abs(r.unit1 - r.unit2) < 0.05) continue;
      return {
        vars: { total, v1, v2, unit1: r.unit1, unit2: r.unit2, ratio: r.ratio, wrongScaled: (total * v2) / v1, wrongSame: r.unit1, wrongTotalPerUnit: total },
        misconceptions: [
          { var: 'wrongSame', feedback: 'You kept the per-unit cost the same. Total fixed cost stays put, so each extra unit **shares** it and the cost per unit falls.' },
          { var: 'wrongScaled', feedback: 'That scales the total with volume, which is how a **variable** cost behaves. Total fixed cost does not change within the relevant range.' },
        ],
      };
    }
  }

  // A variable cost: constant per unit, proportional in total.
  function variableQ({ rng }) {
    for (;;) {
      const rate = rng.pick([2.5, 4, 6, 7.5, 12, 15, 20, 36]);
      const v1 = nice(rng, 1000, 8000, 500);
      const v2 = nice(rng, 1000, 12000, 500);
      if (v1 === v2) continue;
      const total1 = rate * v1;
      const total2 = rate * v2;
      if (!twoDp(total1 / v2) || Math.abs(total1 / v2 - rate) < 0.01) continue;
      return {
        vars: { rate, v1, v2, total1, total2, wrongDivNew: total1 / v2, wrongTotal: total1 },
        misconceptions: [
          { var: 'wrongDivNew', feedback: 'You divided the old total by the new volume. A variable cost has the **same** cost per unit at every volume: divide the old total by the old volume.' },
          { var: 'wrongTotal', feedback: 'That is the total at the first volume. The question asks for the cost **per unit**.' },
        ],
      };
    }
  }

  // y = a + bx at a new activity level.
  function formulaQ({ rng, difficulty }) {
    for (;;) {
      const a = nice(rng, 2000, difficulty >= 2 ? 30000 : 12000, 500);
      const b = rng.pick(difficulty === 1 ? [0.5, 1, 2, 3, 4] : [0.5, 0.75, 1.25, 1.5, 2.5, 6, 8]);
      const x = nice(rng, 1000, 20000, 500);
      const r = costFormula({ a, b, x });
      if (!twoDp(r.y)) continue;
      return {
        vars: { a, b, x, y: r.y, varPart: r.varPart, perUnit: r.perUnit, wrongNoA: r.varPart, wrongSwap: b + a * x, wrongAdd: a + b + x },
        misconceptions: [
          { var: 'wrongNoA', feedback: 'You left out the fixed cost component. The estimate is a + bx, and the fixed part is paid at every level of activity.' },
          { var: 'wrongSwap', feedback: 'You multiplied the fixed cost by activity. In y = a + bx, **b** is the rate that multiplies x and **a** is added once.' },
        ],
      };
    }
  }

  // A small data table whose high and low points sit exactly on y = a + bx, so b and a come out clean.
  // At difficulty 2 and up a decoy month has the HIGHEST COST but not the highest activity.
  function highLowQ({ rng, difficulty }) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
    for (;;) {
      const b = rng.pick([0.5, 1, 1.25, 2, 2.5, 3, 4]);
      const a = nice(rng, 2000, 20000, 1000);
      const n = difficulty === 1 ? 4 : difficulty === 2 ? 5 : 6;
      const loX = nice(rng, 1000, 4000, 500);
      const hiX = loX + nice(rng, 3000, 8000, 500);
      const pts = [{ x: loX, y: a + b * loX }, { x: hiX, y: a + b * hiX }];
      const used = new Set([loX, hiX]);
      let decoy = null;
      if (difficulty >= 2) {
        const dx = hiX - 500;
        if (dx > loX && !used.has(dx)) {
          used.add(dx);
          decoy = { x: dx, y: a + b * hiX + nice(rng, 500, 1500, 250) };
          pts.push(decoy);
        }
      }
      let guard = 0;
      while (pts.length < n && guard < 50) {
        guard += 1;
        const x = nice(rng, loX + 500, hiX - 500, 500);
        if (used.has(x)) continue;
        used.add(x);
        pts.push({ x, y: a + b * x + rng.pick([-600, -400, -250, 250, 400, 600]) });
      }
      if (pts.length < n) continue;
      const labelled = rng.shuffle(pts).map((p, i) => ({ label: months[i], x: p.x, y: p.y }));
      const r = highLowCore({ points: labelled });
      if (r.hi.x !== hiX || r.lo.x !== loX) continue;
      // The method picks by cost instead of activity: what a student who confuses the two would get.
      let cHi = labelled[0];
      let cLo = labelled[0];
      for (const p of labelled) { if (p.y > cHi.y) cHi = p; if (p.y < cLo.y) cLo = p; }
      const wrongB = cHi.x === cLo.x ? null : (cHi.y - cLo.y) / (cHi.x - cLo.x);
      if (difficulty >= 2 && (wrongB === null || Math.abs(wrongB - b) < 0.01)) continue;
      const predictAt = nice(rng, loX + 500, hiX + 1500, 500);
      const predicted = a + b * predictAt;
      // Four distinct month pairs for the "which two months" question.
      const pairOf = (p, q) => `${p.label} and ${q.label}`;
      const correctPair = pairOf(r.hi, r.lo);
      const optionSet = [correctPair];
      const candidates = [pairOf(cHi, cLo), pairOf(cHi, r.lo), pairOf(r.hi, cLo)];
      for (const c of candidates) if (!optionSet.includes(c)) optionSet.push(c);
      const pool = rng.shuffle(labelled);
      let g = 0;
      while (optionSet.length < 4 && g < 40) {
        g += 1;
        const [p, q] = rng.sample(pool, 2);
        const c = pairOf(p, q);
        if (!optionSet.includes(c) && c !== pairOf(q, p) && !optionSet.includes(pairOf(q, p))) optionSet.push(c);
      }
      if (optionSet.length < 4) continue;
      const options = rng.shuffle(optionSet);
      return {
        options,
        answer: options.indexOf(correctPair),
        vars: {
          points: labelled,
          table: { rows: labelled.map((p) => p.label), cols: ['Activity', 'Cost'], values: labelled.map((p) => [p.x, p.y]) },
          hiLabel: r.hi.label, loLabel: r.lo.label, hiX, hiY: r.hi.y, loX, loY: r.lo.y,
          dx: r.dx, dy: r.dy, b: r.b, a: r.aHigh, aLow: r.aLow, predictAt, predicted,
          wrongB: wrongB ?? 0, wrongFixedLow: r.lo.y, wrongNoA: b * predictAt,
        },
        misconceptions: [
          { var: 'wrongB', feedback: 'That uses the highest and lowest **cost**. The high-low method picks the highest and lowest **activity**; one month can have a big cost at middling activity.' },
          { var: 'wrongFixedLow', feedback: 'That is the total cost at the low point, which still contains variable cost. Subtract b × activity to get the fixed part.' },
        ],
      };
    }
  }

  // Scattergraph: intercept and one point on the line give the rate.
  function scatterQ({ rng, difficulty }) {
    for (;;) {
      const a = nice(rng, 2000, 12000, 1000);
      const b = rng.pick(difficulty === 1 ? [0.5, 1, 2, 3] : [0.4, 0.6, 0.8, 1.2, 1.5, 2.5]);
      const x = nice(rng, 4000, 20000, 1000);
      const y = a + b * x;
      if (!twoDp(y)) continue;
      const x2 = nice(rng, 2000, 24000, 1000);
      if (x2 === x) continue;
      const pred = a + b * x2;
      if (!twoDp(pred)) continue;
      return {
        vars: { a, x, y, b, varPart: y - a, x2, pred, wrongNoSub: y / x, wrongDivA: (y - a) / a },
        misconceptions: [
          { var: 'wrongNoSub', feedback: 'You divided the **total** cost by activity. Subtract the fixed cost (the intercept) first, then divide the variable part by activity.' },
          { var: 'wrongDivA', feedback: 'You divided by the fixed cost. The variable rate is variable cost ÷ **activity**.' },
        ],
      };
    }
  }

  // Incremental cost of a special order.
  function incrementalQ({ rng }) {
    for (;;) {
      const a = nice(rng, 6000, 30000, 1000);
      const b = rng.pick([4, 5, 6, 8, 10, 12]);
      const deptHours = nice(rng, 300, 800, 100);
      const hours = nice(rng, 20, 100, 10);
      const r = incremental({ a, b, hours, deptHours });
      if (!twoDp(r.wrongAllocated)) continue;
      return {
        vars: { a, b, hours, deptHours, inc: r.incremental, wholeDept: r.wholeDept, wrongWithFixed: r.wrongWithFixed, wrongAllocated: r.wrongAllocated },
        misconceptions: [
          { var: 'wrongWithFixed', feedback: 'You added the whole fixed cost. It is paid whether or not the order is accepted, so it is not **incremental**.' },
          { var: 'wrongAllocated', feedback: 'You loaded a share of the fixed cost onto the order. That share is paid anyway; only the variable part changes with the order.' },
        ],
      };
    }
  }

  // An outlier month that happens to be the highest-activity month.
  function outlierQ({ rng }) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
    for (;;) {
      const b = rng.pick([2, 2.5, 3, 4]);
      const a = nice(rng, 5000, 20000, 1000);
      const xs = rng.sample([6000, 7000, 8000, 9000, 10000, 11000, 12000, 13000, 14000], 5).sort((p, q) => p - q);
      const outX = xs[xs.length - 1] + nice(rng, 2000, 5000, 1000);
      const spike = nice(rng, 8000, 16000, 1000);
      const normal = xs.map((x) => ({ x, y: a + b * x }));
      const pts = rng.shuffle([...normal, { x: outX, y: a + b * outX + spike, out: true }]).map((p, i) => ({ label: months[i], x: p.x, y: p.y, out: !!p.out }));
      const outLabel = pts.find((p) => p.out).label;
      const view = pts.map(({ label, x, y }) => ({ label, x, y }));
      const r = outlierScreen({ points: view, outlier: outLabel, at: outX });
      return {
        vars: {
          table: { rows: view.map((p) => p.label), cols: ['Activity', 'Cost'], values: view.map((p) => [p.x, p.y]) },
          outLabel, outX, outY: a + b * outX + spike, spike, b, a, bClean: r.bWithout, aClean: r.aWithout, bDirty: r.bWith, aDirty: r.aWith,
          bAverage: (r.bWith + r.bWithout) / 2,
        },
        misconceptions: [
          { var: 'bDirty', feedback: 'That includes the abnormal month. It is the highest-activity month, so the high-low method used it automatically and it dragged the rate up.' },
          { var: 'bAverage', feedback: 'Do not average a good figure with a distorted one. Leave the abnormal month out and recompute from the remaining months.' },
        ],
      };
    }
  }

  return {
    fns: {
      fixedPerUnit, behaviorAt, patternCurves, rangeCheck, costFormula, highLow, highLowSheet, highLowWalk, pointsMatrix,
      scatterFormula, scatterPlot, compareMethods, compareSheet, compareWalk, incremental, outlierScreen, outlierView,
    },
    generators: { behaviorClassQ, commitQ, unitQ, variableQ, formulaQ, highLowQ, scatterQ, incrementalQ, outlierQ },
  };
}
