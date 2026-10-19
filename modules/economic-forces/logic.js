export default function register(sdk) {
  const { sum } = sdk;
  const GROUPS = ['High income', 'Upper-middle income', 'Lower-middle income', 'Low income'];
  // Tables embedded so quiz generators can draw rows from the lecture's own data.
  const GNICAP = [
    ['Norway', 95510, 118440], ['Qatar', 70500, 110640], ['United States', 76370, 77530], ['Saudi Arabia', 27590, 59660],
    ['Canada', 52960, 57820], ['United Kingdom', 48890, 54920], ['Japan', 42440, 48470], ['Turkey', 10590, 36920],
    ['Russian Federation', 12830, 35770], ['Malaysia', 11780, 32250], ['China', 12850, 21250], ['Mexico', 10410, 21060],
    ['Ecuador', 6310, 12630], ['Iraq', 5270, 10820], ['India', 2380, 8210], ['Nigeria', 2140, 5650],
  ];
  const DEBT = [
    ['China', 5, 2389], ['India', 21, 617], ['Mexico', 58, 600], ['Brazil', 72, 579],
    ['Turkey', 19, 459], ['Indonesia', 21, 396], ['Argentina', 27, 248],
  ];

  // World Bank groups from slide 8 (fiscal year 2024).
  function incomeGroup({ perCapita }) {
    const label = perCapita > 13845 ? GROUPS[0] : perCapita >= 4466 ? GROUPS[1] : perCapita >= 1136 ? GROUPS[2] : GROUPS[3];
    return { label, index: GROUPS.indexOf(label) };
  }

  // ---------------------------------------------------------------- GNI per capita and its income group
  // roles: r (Readout: 0 GNI, 1 population, 2 GNI per capita, 3 income group), code, formula
  function gniPerCapita({ gni, population }) {
    const perCapita = (gni * 1000) / population;
    const g = incomeGroup({ perCapita });
    return {
      perCapita, group: g.label, groupIndex: g.index,
      trace: [
        { label: 'GNI is {=gni|comma} billion dollars. The population is {=population|comma} million people.', code: 'inputs', vars: { gni, population },
          ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: ['item:0', 'item:1'] } }] },
        { label: 'Per person $= {=gni|comma} \\times 1000 \\div {=population|comma} = {=perCapita|comma}$ dollars.', code: 'percap', vars: { perCapita },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:2', tone: 'accent' } }] },
        { label: 'Compare with the World Bank cutoffs: {=group}.', code: 'group', vars: { group: g.label },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:3', tone: 'good' } }] },
      ].map((s) => ({ ...s, vars: { ...s.vars, gni, population, perCapita, group: g.label } })),
    };
  }

  // ---------------------------------------------------------------- the PPP basket
  // roles: r (Readout: 0 baht total so far, 1 dollar total so far, 2 implied baht per dollar), code, formula
  function basketPPP({ table }) {
    let baht = 0;
    let usd = 0;
    const trace = [];
    const ratios = [];
    table.rows.forEach((row) => {
      baht += row[1];
      usd += row[2];
      ratios.push(row[1] / row[2]);
      trace.push({
        label: `${row[0]}: ${row[1]} baht, ${row[2]} dollars. Totals so far: ${Math.round(baht * 100) / 100} baht and ${Math.round(usd * 100) / 100} dollars.`,
        code: 'loop', vars: { good: row[0], bahtSoFar: baht, usdSoFar: usd },
        ops: [{ role: 'r', cmd: 'highlight', args: { sel: ['item:0', 'item:1'], tone: 'accent' } }],
      });
    });
    const rate = baht / usd;
    trace.push({ label: `Implied rate $= ${Math.round(baht * 100) / 100} \\div ${Math.round(usd * 100) / 100} = ${Math.round(rate * 100) / 100}$ baht per dollar.`, code: 'rate', vars: { rate },
      ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:2', tone: 'good' } }] });
    const dearest = ratios.indexOf(Math.max(...ratios));
    const cheapest = ratios.indexOf(Math.min(...ratios));
    return { bahtTotal: baht, usdTotal: usd, rate, dearest: table.rows[dearest][0], cheapest: table.rows[cheapest][0], ratios, trace };
  }

  // ---------------------------------------------------------------- Atlas versus PPP
  // roles: r (Readout: 0 Atlas, 1 PPP, 2 ratio, 3 extra dollars), code, formula
  function atlasVsPpp({ atlas, ppp }) {
    const ratio = ppp / atlas;
    return {
      ratio, gap: ppp - atlas, pctHigher: ratio - 1,
      trace: [
        { label: 'Atlas income {=atlas|comma} dollars. PPP income {=ppp|comma} dollars.', code: 'inputs', vars: { atlas, ppp },
          ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: ['item:0', 'item:1'] } }] },
        { label: 'Ratio $= {=ppp|comma} \\div {=atlas|comma} = {=ratio|2}$.', code: 'ratio', vars: { ratio },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:2', tone: 'accent' } }] },
        { label: 'Money goes {=ratio|2} times as far, a gap of {=gap|comma} dollars.', code: 'gap', vars: { gap: ppp - atlas },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:3', tone: 'good' } }] },
      ].map((s) => ({ ...s, vars: { ...s.vars, atlas, ppp, ratio, gap: ppp - atlas } })),
    };
  }

  // ---------------------------------------------------------------- external debt growth
  // roles: r (Readout: 0 debt 1980, 1 debt 2022, 2 ratio, 3 percent of 1980 debt), code, formula
  function debtGrowth({ table, country }) {
    const row = table.rows.find((r) => r[0] === country);
    const first = row[1];
    const last = row[6];
    const ratio = last / first;
    return {
      first, last, ratio, pct: ratio * 100, increase: last - first,
      trace: [
        { label: '{=country} owed {=first|comma} billion dollars in 1980 and {=last|comma} billion in 2022.', code: 'inputs', vars: { country, first, last },
          ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: ['item:0', 'item:1'] } }] },
        { label: 'Ratio $= {=last|comma} \\div {=first|comma} = {=ratio|2}$ times.', code: 'ratio', vars: { ratio },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:2', tone: 'accent' } }] },
        { label: 'As a percent of the 1980 debt: {=pct|comma0}%.', code: 'pct', vars: { pct: ratio * 100 },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:3', tone: 'good' } }] },
      ].map((s) => ({ ...s, vars: { ...s.vars, country, first, last, ratio, pct: ratio * 100 } })),
    };
  }

  // ---------------------------------------------------------------- unit labor cost
  // roles: r (Readout: 0 labor cost, 1 units, 2 unit labor cost), code, formula
  function unitLaborCost({ totalLabor, units }) {
    const ulc = totalLabor / units;
    return {
      ulc,
      trace: [
        { label: 'Total direct labor cost is {=totalLabor|comma}. The factory made {=units|comma} units.', code: 'inputs', vars: { totalLabor, units },
          ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: ['item:0', 'item:1'] } }] },
        { label: 'Unit labor cost $= {=totalLabor|comma} \\div {=units|comma} = {=ulc|comma2}$.', code: 'ulc', vars: { ulc },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:2', tone: 'good' } }] },
      ].map((s) => ({ ...s, vars: { ...s.vars, totalLabor, units, ulc } })),
    };
  }

  // ---------------------------------------------------------------- disposable and discretionary income
  // roles: r (Readout: 0 income, 1 disposable, 2 discretionary), code, formula
  function discretionary({ income, tax, essentials }) {
    const disposable = income - tax;
    const free = disposable - essentials;
    return {
      disposable, discretionary: free,
      trace: [
        { label: 'Income {=income|comma}, taxes {=tax|comma}.', code: 'inputs', vars: { income, tax },
          ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: 'item:0' } }] },
        { label: 'Disposable income $= {=income|comma} - {=tax|comma} = {=disposable|comma}$.', code: 'disposable', vars: { disposable },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:1', tone: 'accent' } }] },
        { label: 'Discretionary $= {=disposable|comma} - {=essentials|comma} = {=free|comma}$.', code: 'discretionary', vars: { free },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:2', tone: 'good' } }] },
      ].map((s) => ({ ...s, vars: { ...s.vars, income, tax, essentials, disposable, free } })),
    };
  }

  // ---------------------------------------------------------------- population density
  // roles: r (Readout: 0 population, 1 area, 2 density), code, formula
  function populationDensity({ population, area }) {
    const density = population / area;
    return {
      density,
      trace: [
        { label: '{=population|comma} people live on {=area|comma} square kilometers.', code: 'inputs', vars: { population, area },
          ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: ['item:0', 'item:1'] } }] },
        { label: 'Density $= {=population|comma} \\div {=area|comma} = {=density|comma2}$ people per square kilometer.', code: 'density', vars: { density },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:2', tone: 'good' } }] },
      ].map((s) => ({ ...s, vars: { ...s.vars, population, area, density } })),
    };
  }

  // ---------------------------------------------------------------- quiz generators
  function perCapQ({ rng }) {
    for (;;) {
      const gni = rng.pick([60, 120, 150, 300, 600, 900]);
      const population = rng.pick([10, 20, 30, 40, 60]);
      const perCapita = (gni * 1000) / population;
      const g = incomeGroup({ perCapita });
      return {
        vars: { gni, population, perCapita, group: g.label, wrongNoScale: gni / population, wrongInverse: population / gni },
        misconceptions: [],
      };
    }
  }

  function classQ({ rng }) {
    const ranges = [[15000, 60000], [4500, 13800], [1200, 4400], [300, 1100]];
    const g = rng.int(0, 3);
    const perCapita = Math.round(rng.int(ranges[g][0], ranges[g][1]) / 50) * 50;
    return {
      vars: { perCapita, group: GROUPS[g] },
      options: GROUPS,
      answer: incomeGroup({ perCapita }).index,
      misconceptions: [],
    };
  }

  function basketQ({ rng, difficulty }) {
    for (;;) {
      const rate = rng.pick([10, 12, 15, 20, 25, 40]);
      const n = difficulty === 1 ? 2 : 3;
      const usdItems = Array.from({ length: n }, () => rng.pick([2, 4, 5, 8, 10, 20]));
      const usdTotal = sum(usdItems);
      const localItems = usdItems.map((u) => u * rate);
      const localTotal = sum(localItems);
      return {
        vars: {
          usdItems, localItems, usdText: usdItems.join(', '), localText: localItems.join(', '),
          usdTotal, localTotal, rate, wrongInverse: usdTotal / localTotal, wrongProduct: usdTotal * localTotal,
        },
        misconceptions: [],
      };
    }
  }

  function atlasQ({ rng }) {
    for (;;) {
      const row = rng.pick(GNICAP);
      const ratio = row[2] / row[1];
      if (ratio < 1.5 && rng.bool(0.7)) continue;
      return {
        vars: { country: row[0], atlas: row[1], ppp: row[2], ratio, gap: row[2] - row[1], wrongInverse: row[1] / row[2], wrongPct: ratio - 1 },
        misconceptions: [],
      };
    }
  }

  function debtQ({ rng }) {
    for (;;) {
      const row = rng.pick(DEBT);
      const ratio = row[2] / row[1];
      return {
        vars: { country: row[0], first: row[1], last: row[2], ratio, pct: ratio * 100, increase: row[2] - row[1], wrongInverse: row[1] / row[2] },
        misconceptions: [],
      };
    }
  }

  function ulcQ({ rng }) {
    for (;;) {
      const units = rng.pick([1000, 2000, 5000, 10000]);
      const unitCost = rng.pick([4, 5, 8, 10, 12]);
      const totalLabor = units * unitCost;
      return {
        vars: { totalLabor, units, ulc: unitCost, wrongInverse: units / totalLabor, wrongTotal: totalLabor },
        misconceptions: [],
      };
    }
  }

  function discQ({ rng }) {
    for (;;) {
      const income = rng.pick([20000, 30000, 40000, 60000]);
      const tax = rng.pick([2000, 4000, 6000, 8000]);
      const essentials = rng.pick([8000, 10000, 12000, 15000]);
      const r = discretionary({ income, tax, essentials });
      if (r.discretionary <= 0) continue;
      return {
        vars: { income, tax, essentials, disposable: r.disposable, free: r.discretionary, wrongNoTax: income - essentials },
        misconceptions: [],
      };
    }
  }

  function densityQ({ rng }) {
    for (;;) {
      const area = rng.pick([50000, 100000, 200000, 500000]);
      const density = rng.pick([20, 50, 100, 150, 300]);
      const population = area * density;
      return {
        vars: { population, area, density, wrongInverse: area / population, wrongRaw: population },
        misconceptions: [],
      };
    }
  }

  // Every trace step lights the same anchor name in the derivation (math) and in the code pane (code).
  const sameAnchors = (f) => (args) => {
    const r = f(args);
    if (r && r.trace) r.trace = r.trace.map((s) => ({ ...s, math: s.code }));
    return r;
  };

  return {
    fns: {
      incomeGroup, gniPerCapita: sameAnchors(gniPerCapita), basketPPP: sameAnchors(basketPPP), atlasVsPpp: sameAnchors(atlasVsPpp),
      debtGrowth: sameAnchors(debtGrowth), unitLaborCost: sameAnchors(unitLaborCost), discretionary: sameAnchors(discretionary),
      populationDensity: sameAnchors(populationDensity),
    },
    generators: { perCapQ, classQ, basketQ, atlasQ, debtQ, ulcQ, discQ, densityQ },
  };
}
