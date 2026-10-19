export default function register(sdk) {
  const { sum } = sdk;
  const STRATEGY = {
    'low|low': 'Home replication',
    'low|high': 'Multidomestic',
    'high|low': 'Global',
    'high|high': 'Transnational',
  };
  const round = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

  // ---------------------------------------------------------------- economic value creation
  // roles: r (Readout: 0 willingness to pay, 1 price, 2 unit cost, 3 value created, 4 customer surplus, 5 profit per unit), code, formula
  function valueCreation({ willingness, price, unitCost }) {
    const created = willingness - unitCost;
    const surplus = willingness - price;
    const profit = price - unitCost;
    return {
      created, surplus, profit, balanced: Math.abs(created - (surplus + profit)) < 1e-9,
      trace: [
        { label: 'Customers will pay up to {=willingness}. The firm charges {=price}. A unit costs {=unitCost} to make.', code: 'inputs', vars: { willingness, price, unitCost },
          ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: ['item:0', 'item:1', 'item:2'] } }] },
        { label: 'Value created $= {=willingness} - {=unitCost} = {=created}$.', code: 'created', vars: { created },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:3', tone: 'good' } }] },
        { label: 'Customers keep $ {=willingness} - {=price} = {=surplus}$.', code: 'surplus', vars: { surplus },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:4', tone: 'accent' } }] },
        { label: 'The firm keeps $ {=price} - {=unitCost} = {=profit}$.', code: 'profit', vars: { profit },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:5', tone: 'accent' } }] },
      ].map((s) => ({ ...s, vars: { ...s.vars, willingness, price, unitCost, created, surplus, profit } })),
    };
  }

  // ---------------------------------------------------------------- economies of scale
  // roles: r (Readout: 0 fixed cost, 1 variable cost per unit, 2 units, 3 fixed cost per unit, 4 average cost), code, formula
  function averageCost({ fixedCost, variableCost, units }) {
    const spread = fixedCost / units;
    const average = spread + variableCost;
    return {
      spread, average,
      trace: [
        { label: 'Fixed cost {=fixedCost|comma}; variable cost {=variableCost} per unit; output {=units|comma} units.', code: 'inputs', vars: { fixedCost, variableCost, units },
          ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: ['item:0', 'item:1', 'item:2'] } }] },
        { label: 'Fixed cost per unit $= {=fixedCost|comma} \\div {=units|comma} = {=spread|comma2}$.', code: 'spread', vars: { spread },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:3', tone: 'accent' } }] },
        { label: 'Average cost $= {=spread|comma2} + {=variableCost} = {=average|comma2}$.', code: 'average', vars: { average },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:4', tone: 'good' } }] },
      ].map((s) => ({ ...s, vars: { ...s.vars, fixedCost, variableCost, units, spread, average } })),
    };
  }

  // ---------------------------------------------------------------- learning curve
  // roles: r (Readout: 0 first unit cost, 1 rate, 2 doublings, 3 cost after), code, formula
  function learningCurve({ firstCost, rate, doublings }) {
    let cost = firstCost;
    const trace = [{ label: 'The first unit costs {=firstCost}. Each doubling of output multiplies cost by {=rate}.', code: 'inputs', vars: { firstCost, rate },
      ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: ['item:0', 'item:1'] } }] }];
    for (let i = 1; i <= doublings; i++) {
      cost *= rate;
      trace.push({ label: `Doubling ${i}: cost falls to ${round(cost, 2)}.`, code: 'loop', vars: { doubling: i, cost },
        ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:2', tone: 'accent' } }] });
    }
    trace.push({ label: `After ${doublings} doublings each unit costs ${round(cost, 2)}.`, code: 'cost', vars: { cost },
      ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:3', tone: 'good' } }] });
    return { cost, saving: firstCost - cost, factor: cost / firstCost, trace };
  }

  // ---------------------------------------------------------------- which strategy fits
  // roles: r (Readout: 0 cost pressure, 1 adaptation pressure, 2 strategy), code, formula
  function chooseStrategy({ cost, adapt }) {
    const strategy = STRATEGY[`${cost}|${adapt}`];
    return {
      strategy,
      trace: [
        { label: 'Cost pressure is {=cost}. Pressure to adapt is {=adapt}.', code: 'inputs', vars: { cost, adapt },
          ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: ['item:0', 'item:1'] } }] },
        { label: 'That combination calls for a {=strategy} strategy.', code: 'pick', vars: { strategy },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:2', tone: 'good' } }] },
      ].map((s) => ({ ...s, vars: { ...s.vars, cost, adapt, strategy } })),
    };
  }

  // ---------------------------------------------------------------- sales forecast and budget
  // roles: r (Readout: 0 sales last year, 1 forecast, 2 expenses, 3 profit), code, formula
  function budgetPlan({ lastSales, growth, costRatio, fixedExpenses }) {
    const forecast = lastSales * (1 + growth);
    const expenses = forecast * costRatio + fixedExpenses;
    const net = forecast - expenses;
    return {
      forecast, expenses, net,
      trace: [
        { label: 'Last year sales were {=lastSales|comma}. Expected growth is {=growth|pct}.', code: 'inputs', vars: { lastSales, growth },
          ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: 'item:0' } }] },
        { label: 'Forecast $= {=lastSales|comma} \\times (1 + {=growth|2}) = {=forecast|comma}$.', code: 'forecast', vars: { forecast },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:1', tone: 'accent' } }] },
        { label: 'Expenses $= {=costRatio|pct} \\times {=forecast|comma} + {=fixedExpenses|comma} = {=expenses|comma}$.', code: 'expenses', vars: { expenses },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:2', tone: 'accent' } }] },
        { label: 'Budgeted profit $= {=forecast|comma} - {=expenses|comma} = {=net|comma}$.', code: 'net', vars: { net },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:3', tone: 'good' } }] },
      ].map((s) => ({ ...s, vars: { ...s.vars, lastSales, growth, costRatio, fixedExpenses, forecast, expenses, net } })),
    };
  }

  // ---------------------------------------------------------------- scenario planning: actions common to every story
  // roles: r (Readout: 0 actions still common, 1 different actions seen), code, formula
  function commonActions({ scenarios }) {
    const names = Object.keys(scenarios);
    let common = null;
    const seen = new Set();
    const trace = [];
    names.forEach((name) => {
      scenarios[name].forEach((a) => seen.add(a));
      common = common === null ? [...scenarios[name]] : common.filter((a) => scenarios[name].includes(a));
      trace.push({
        label: `After the "${name}" story, ${common.length} actions appear in every story so far.`, code: 'loop', vars: { story: name, stillCommon: common.length, seenCount: seen.size },
        ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: 'item:0', tone: 'accent' } }, { role: 'r', cmd: 'highlight', args: { sel: 'item:1' } }],
      });
    });
    trace.push({ label: `${common.length} actions appear in all ${names.length} stories: do these first.`, code: 'common', vars: { stillCommon: common.length },
      ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:0', tone: 'good' } }] });
    return { common, count: common.length, total: seen.size, stories: names.length, trace };
  }

  // ---------------------------------------------------------------- quiz generators
  function valueQ({ rng }) {
    for (;;) {
      const unitCost = rng.pick([30, 40, 50, 60]);
      const price = unitCost + rng.pick([10, 20, 30]);
      const willingness = price + rng.pick([10, 20, 30, 40]);
      const r = valueCreation({ willingness, price, unitCost });
      if (r.created === price || r.surplus === r.profit) continue;
      return {
        vars: { willingness, price, unitCost, created: r.created, surplus: r.surplus, profit: r.profit, wrongSum: willingness + unitCost, wrongPrice: price },
        misconceptions: [],
      };
    }
  }

  function avgCostQ({ rng }) {
    for (;;) {
      const fixedCost = rng.pick([10000, 20000, 50000, 100000]);
      const variableCost = rng.pick([2, 5, 8, 10]);
      const units = rng.pick([1000, 2000, 5000, 10000]);
      const r = averageCost({ fixedCost, variableCost, units });
      return {
        vars: { fixedCost, variableCost, units, spread: r.spread, average: r.average, wrongFixed: fixedCost / units, wrongSumAll: fixedCost + variableCost },
        misconceptions: [],
      };
    }
  }

  function learnQ({ rng }) {
    for (;;) {
      const firstCost = rng.pick([100, 200, 400, 800]);
      const rate = rng.pick([0.5, 0.8, 0.9]);
      const doublings = rng.int(2, 3);
      const r = learningCurve({ firstCost, rate, doublings });
      return {
        vars: { firstCost, rate, doublings, cost: r.cost, wrongOnce: firstCost * rate, wrongLinear: firstCost * (1 - (1 - rate) * doublings), pct: rate * 100 },
        misconceptions: [],
      };
    }
  }

  function budgetQ({ rng }) {
    for (;;) {
      const lastSales = rng.pick([100000, 200000, 500000, 1000000]);
      const growth = rng.pick([0.05, 0.1, 0.2]);
      const costRatio = rng.pick([0.4, 0.5, 0.6]);
      const fixedExpenses = lastSales * rng.pick([0.05, 0.1, 0.15]);
      const r = budgetPlan({ lastSales, growth, costRatio, fixedExpenses });
      return {
        vars: {
          lastSales, growth, costRatio, fixedExpenses, forecast: r.forecast, expenses: r.expenses, net: r.net,
          wrongNoGrowth: lastSales, wrongAddRate: lastSales + growth, wrongNetOld: lastSales - (lastSales * costRatio + fixedExpenses),
        },
        misconceptions: [],
      };
    }
  }

  function commonQ({ rng }) {
    const pool = ['expand', 'hire-local-staff', 'cut-costs', 'adapt-product', 'raise-prices', 'open-online', 'form-alliance', 'delay-launch'];
    for (;;) {
      const k = rng.int(2, 3);
      const shared = rng.sample(pool, rng.int(1, 3));
      const rest = pool.filter((p) => !shared.includes(p));
      const scenarios = {};
      ['boom', 'steady', 'bust'].slice(0, k).forEach((name) => {
        scenarios[name] = [...shared, ...rng.sample(rest, rng.int(1, 2))];
      });
      const r = commonActions({ scenarios });
      if (r.count !== shared.length) continue; // an extra shared action crept in
      const text = Object.entries(scenarios).map(([n, a]) => `${n}: ${a.join(', ')}`).join(' | ');
      return {
        vars: { scenarios, text, count: r.count, total: r.total, stories: k, wrongTotal: r.total, wrongFirst: scenarios[Object.keys(scenarios)[0]].length },
        misconceptions: [],
      };
    }
  }

  function strategyQ({ rng }) {
    const cost = rng.pick(['low', 'high']);
    const adapt = rng.pick(['low', 'high']);
    const strategy = chooseStrategy({ cost, adapt }).strategy;
    const options = ['Home replication', 'Multidomestic', 'Global', 'Transnational'];
    return { vars: { cost, adapt, strategy }, options, answer: options.indexOf(strategy), misconceptions: [] };
  }

  // Every trace step lights the same anchor name in the derivation (math) and in the code pane (code).
  const sameAnchors = (f) => (args) => {
    const r = f(args);
    if (r && r.trace) r.trace = r.trace.map((s) => ({ ...s, math: s.code }));
    return r;
  };

  return {
    fns: {
      valueCreation: sameAnchors(valueCreation), averageCost: sameAnchors(averageCost), learningCurve: sameAnchors(learningCurve),
      chooseStrategy: sameAnchors(chooseStrategy), budgetPlan: sameAnchors(budgetPlan), commonActions: sameAnchors(commonActions),
    },
    generators: { valueQ, avgCostQ, learnQ, budgetQ, commonQ, strategyQ },
  };
}
