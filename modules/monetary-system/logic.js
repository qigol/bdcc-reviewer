export default function register(sdk) {
  const { sum, mean } = sdk;
  const YEARS = ['2009', '2014', '2019', '2022'];
  // Row ids of the regimes table (Table 8.1), in printed order.
  const REGIME_IDS = ['hard', 'nt', 'cb', 'soft', 'cp', 'sa', 'cr', 'cl', 'hb', 'float', 'fl', 'ff', 'res'];

  const isCleanRate = (x) => Math.abs(x * 100 - Math.round(x * 100)) < 1e-9;

  // ---------------------------------------------------------------- Table 8.1: shares of exchange rate arrangements
  // roles: grid (Schedule of the table), code, formula
  function regimeShares({ table, year }) {
    const ci = YEARS.indexOf(String(year)) + 2;
    const groups = [];
    let cur = null;
    table.rows.forEach((r, i) => {
      if (r[0] === 'group') {
        cur = { label: r[1], printed: r[ci], subs: [], rowId: REGIME_IDS[i] };
        groups.push(cur);
      } else {
        cur.subs.push({ label: r[1], value: r[ci], rowId: REGIME_IDS[i] });
      }
    });
    groups.forEach((g) => { g.subSum = sum(g.subs.map((s) => s.value)); });
    const total = sum(groups.map((g) => g.printed));
    const trace = [{ label: 'Start with the printed group totals for {=year}.', code: 'groups', vars: { year },
      ops: [{ role: 'grid', cmd: 'clear' }] }];
    groups.forEach((g) => {
      trace.push({
        label: `${g.label}: printed ${g.printed}%` + (g.subs.length ? `, its parts add to ${Math.round(g.subSum * 10) / 10}%` : ', no parts listed'),
        code: 'group', vars: { group: g.label, printed: g.printed, subSum: g.subSum },
        ops: [{ role: 'grid', cmd: 'highlight', args: { sel: `row:${g.rowId}`, tone: 'accent' } }],
      });
    });
    trace.push({ label: 'The four group totals add up to {=total|1}%.', code: 'total', vars: { total },
      ops: [{ role: 'grid', cmd: 'highlight', args: { sel: groups.map((g) => `row:${g.rowId}`), tone: 'good' } }] });
    return {
      hard: groups[0].printed, soft: groups[1].printed, floating: groups[2].printed, residual: groups[3].printed,
      hardSubSum: groups[0].subSum, softSubSum: groups[1].subSum, floatSubSum: groups[2].subSum,
      total, groups, trace,
    };
  }

  // The Table 8.1 worksheet: rows fill in one group at a time (upTo = how many table rows are shown).
  function regimeGrid({ table, year, upTo }) {
    const ci = YEARS.indexOf(String(year)) + 2;
    const rows = table.rows.map((r, i) => ({
      id: REGIME_IDS[i],
      label: r[1],
      indent: r[0] === 'sub' ? 1 : 0,
      style: r[0] === 'group' ? 'subtotal' : 'line',
      format: 'number',
      amount: i < upTo ? r[ci] : null,
    }));
    return { rows, shown: Math.min(upTo, table.rows.length) };
  }

  // ---------------------------------------------------------------- bid, ask, spread, reciprocal
  // roles: r (Readout: 0 bid, 1 ask, 2 spread, 3 midpoint, 4 reciprocal bid, 5 reciprocal ask), code, formula
  function spreadQuote({ bid, ask }) {
    const spread = ask - bid;
    const mid = (bid + ask) / 2;
    const recipBid = 1 / ask;
    const recipAsk = 1 / bid;
    return {
      spread, pips: spread * 10000, mid, recipBid, recipAsk,
      trace: [
        { label: 'The bank buys at the bid {=bid} and sells at the ask {=ask}.', code: 'quote', math: 'bid-ask', vars: { bid, ask },
          ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: ['item:0', 'item:1'] } }] },
        { label: 'Spread $= {=ask} - {=bid} = {=spread|5}$.', code: 'spread', math: 'spread', vars: { spread },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:2', tone: 'accent' } }] },
        { label: 'Midpoint $= ({=bid} + {=ask}) / 2 = {=mid|5}$.', code: 'mid', math: 'mid', vars: { mid },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:3', tone: 'accent' } }] },
        { label: 'Flip the pair: the new bid is $1 / {=ask} = {=recipBid|4}$.', code: 'recip-bid', math: 'recip', vars: { recipBid },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:4', tone: 'good' } }] },
        { label: 'The new ask is $1 / {=bid} = {=recipAsk|4}$.', code: 'recip-ask', math: 'recip', vars: { recipAsk },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:5', tone: 'good' } }] },
      ].map((s) => ({ ...s, vars: { ...s.vars, bid, ask, spread, mid, recipBid, recipAsk } })),
    };
  }

  // ---------------------------------------------------------------- cross rates
  // roles: r (Readout: 0 bid1, 1 ask1, 2 bid2, 3 ask2, 4 cross bid, 5 cross ask), code, formula
  function crossRate({ bid1, ask1, bid2, ask2 }) {
    const bid = bid1 * bid2;
    const ask = ask1 * ask2;
    return {
      bid, ask, spread: ask - bid, mid: (bid + ask) / 2,
      trace: [
        { label: 'Quote 1 is {=bid1} / {=ask1}. Quote 2 is {=bid2} / {=ask2}.', code: 'inputs', math: 'cross', vars: { bid1, ask1, bid2, ask2 },
          ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: ['item:0', 'item:1', 'item:2', 'item:3'] } }] },
        { label: 'Cross bid $= {=bid1} \\times {=bid2} = {=bid|4}$.', code: 'cross-bid', math: 'cross-bid', vars: { bid },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: ['item:0', 'item:2'], tone: 'accent' } }, { role: 'r', cmd: 'highlight', args: { sel: 'item:4', tone: 'good' } }] },
        { label: 'Cross ask $= {=ask1} \\times {=ask2} = {=ask|4}$.', code: 'cross-ask', math: 'cross-ask', vars: { ask },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: ['item:1', 'item:3'], tone: 'accent' } }, { role: 'r', cmd: 'highlight', args: { sel: 'item:5', tone: 'good' } }] },
      ].map((s) => ({ ...s, vars: { ...s.vars, bid1, ask1, bid2, ask2, bid, ask } })),
    };
  }

  // ---------------------------------------------------------------- converting an amount
  // roles: r (Readout: 0 rate used, 1 result), code, formula
  function convertFx({ amount, bid, ask, action }) {
    const buying = action === 'buy';
    const rate = buying ? ask : bid;
    const result = amount * rate;
    return {
      rate, result, buying,
      trace: [
        { label: buying ? 'The customer buys, so the bank sells at the ask {=rate}.' : 'The customer sells, so the bank buys at the bid {=rate}.',
          code: 'pick', math: 'rate', vars: { rate, amount },
          ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: 'item:0', tone: 'accent' } }] },
        { label: 'Amount $= {=amount|comma} \\times {=rate} = {=result|comma2}$.', code: 'result', math: 'result', vars: { result, rate, amount },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:1', tone: 'good' } }] },
      ],
    };
  }

  // ---------------------------------------------------------------- forward rate from interest rates
  // roles: r (Readout: 0 spot, 1 home rate, 2 foreign rate, 3 difference, 4 forward), code, formula
  function forwardRate({ spot, iHome, iForeign }) {
    const diff = iHome - iForeign;
    const forward = spot * (1 + diff);
    const exactForward = spot * (1 + iHome) / (1 + iForeign);
    return {
      diff, forward, exactForward, premium: forward - spot, direction: diff > 0 ? 'premium' : diff < 0 ? 'discount' : 'flat',
      trace: [
        { label: 'Spot is {=spot}. Home interest is {=iHome|pct1}; foreign is {=iForeign|pct1}.', code: 'inputs', math: 'forward', vars: { spot, iHome, iForeign },
          ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: ['item:0', 'item:1', 'item:2'] } }] },
        { label: 'The interest gap is $ {=iHome|pct1} - {=iForeign|pct1} = {=diff|pct1}$.', code: 'diff', math: 'diff', vars: { diff },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:3', tone: 'accent' } }] },
        { label: 'Forward $= {=spot} \\times (1 + {=diff|3}) = {=forward|4}$.', code: 'forward', math: 'forward-rate', vars: { forward },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:4', tone: 'good' } }] },
      ].map((s) => ({ ...s, vars: { ...s.vars, spot, iHome, iForeign, diff, forward } })),
    };
  }

  // ---------------------------------------------------------------- purchasing power parity
  // roles: r (Readout: 0 spot, 1 home inflation, 2 foreign inflation, 3 gap, 4 expected spot), code, formula
  function pppRate({ spot, piHome, piForeign }) {
    const gap = piHome - piForeign;
    const expected = spot * (1 + gap);
    const exactExpected = spot * (1 + piHome) / (1 + piForeign);
    return {
      gap, expected, exactExpected, change: expected - spot,
      trace: [
        { label: 'Today\'s rate is {=spot}. Home prices rise {=piHome|pct1}; foreign prices rise {=piForeign|pct1}.', code: 'inputs', math: 'ppp', vars: { spot, piHome, piForeign },
          ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: ['item:0', 'item:1', 'item:2'] } }] },
        { label: 'The inflation gap is $ {=piHome|pct1} - {=piForeign|pct1} = {=gap|pct1}$.', code: 'gap', math: 'gap', vars: { gap },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:3', tone: 'accent' } }] },
        { label: 'Expected rate $= {=spot} \\times (1 + {=gap|3}) = {=expected|4}$.', code: 'expected', math: 'expected', vars: { expected },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:4', tone: 'good' } }] },
      ].map((s) => ({ ...s, vars: { ...s.vars, spot, piHome, piForeign, gap, expected } })),
    };
  }

  // ---------------------------------------------------------------- Fisher effect
  // roles: r (Readout: 0 nominal, 1 inflation, 2 real), code, formula
  function fisher({ nominal, inflation }) {
    const real = nominal - inflation;
    const exactReal = (1 + nominal) / (1 + inflation) - 1;
    return {
      real, exactReal,
      trace: [
        { label: 'A loan pays {=nominal|pct1} a year. Prices are expected to rise {=inflation|pct1}.', code: 'inputs', math: 'fisher', vars: { nominal, inflation },
          ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: ['item:0', 'item:1'] } }] },
        { label: 'Real rate $= {=nominal|pct1} - {=inflation|pct1} = {=real|pct1}$.', code: 'real', math: 'real', vars: { real },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:2', tone: 'good' } }] },
      ].map((s) => ({ ...s, vars: { ...s.vars, nominal, inflation, real } })),
    };
  }

  // ---------------------------------------------------------------- forecasting: random walk and a moving average
  // roles: r (Readout: 0 last value, 1 forecast, 2 actual, 3 error), code, formula
  function randomWalk({ series, window }) {
    const w = window || 3;
    const forecasts = series.map((_, i) => (i >= 1 ? series[i - 1] : null));
    const errors = series.map((y, i) => (i >= 1 ? y - series[i - 1] : null));
    const maForecasts = series.map((_, i) => (i >= w ? mean(series.slice(i - w, i)) : null));
    const maErrors = series.map((y, i) => (i >= w ? y - maForecasts[i] : null));
    const rwAbs = errors.filter((e) => e !== null).map(Math.abs);
    const maAbs = maErrors.filter((e) => e !== null).map(Math.abs);
    const trace = [];
    series.forEach((y, i) => {
      if (i < 1) return;
      trace.push({
        label: `Month ${i + 1}: forecast = last value ${series[i - 1]}; actual ${y}; error ${Math.round((y - series[i - 1]) * 1e4) / 1e4}.`,
        code: 'loop', math: 'rw', vars: { t: i + 1, last: series[i - 1], actual: y, error: y - series[i - 1] },
        ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: ['item:0', 'item:1'], tone: 'accent' } }, { role: 'r', cmd: 'highlight', args: { sel: ['item:2', 'item:3'], tone: 'good' } }],
      });
    });
    return {
      forecasts, errors, maForecasts, maErrors,
      mae: mean(rwAbs), maMae: maAbs.length ? mean(maAbs) : null,
      n: rwAbs.length, firstForecast: series[0], lastError: errors[errors.length - 1], trace,
    };
  }

  // ---------------------------------------------------------------- value-added tax along a supply chain
  // roles: r (Readout: 0 price, 1 tax collected, 2 credit, 3 tax paid to government), code, formula
  function vatChain({ prices, rate }) {
    const stages = prices.map((p, i) => {
      const prev = i === 0 ? 0 : prices[i - 1];
      return { price: p, added: p - prev, collected: rate * p, credit: rate * prev, remit: rate * p - rate * prev };
    });
    const totalRemit = sum(stages.map((s) => s.remit));
    return {
      stages, totalRemit, finalTax: rate * prices[prices.length - 1],
      trace: stages.map((s, i) => ({
        label: `Stage ${i + 1}: sells at ${s.price}, collects ${Math.round(s.collected * 100) / 100}, credits ${Math.round(s.credit * 100) / 100}, pays ${Math.round(s.remit * 100) / 100}.`,
        code: 'loop', math: 'vat', vars: { stage: i + 1, price: s.price, collected: s.collected, credit: s.credit, remit: s.remit },
        ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: ['item:0', 'item:1'], tone: 'accent' } }, { role: 'r', cmd: 'highlight', args: { sel: ['item:2'], tone: 'warn' } }, { role: 'r', cmd: 'highlight', args: { sel: 'item:3', tone: 'good' } }],
      })),
    };
  }

  // ---------------------------------------------------------------- balance of payments
  // roles: r (Readout: 0 current account, 1 capital account, 2 official reserves, 3 total), code, formula
  function bopSummary({ table, reserves }) {
    const by = (acc) => sum(table.rows.filter((r) => r[0] === acc).map((r) => r[2]));
    const current = by('current');
    const capital = by('capital');
    const official = reserves === undefined ? -(current + capital) : reserves;
    const net = current + capital + official;
    return {
      current, capital, official, net,
      currentSide: current < 0 ? 'deficit' : current > 0 ? 'surplus' : 'balanced',
      trace: [
        { label: 'Add every current account line: goods bought and sold. Result {=current}.', code: 'current', math: 'current', vars: { current },
          ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: 'item:0', tone: current < 0 ? 'bad' : 'good' } }] },
        { label: 'Add every capital account line: investment flows. Result {=capital}.', code: 'capital', math: 'capital', vars: { capital },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:1', tone: capital < 0 ? 'bad' : 'good' } }] },
        { label: 'Official reserves must absorb the rest: {=official}.', code: 'official', math: 'official', vars: { official },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:2', tone: 'accent' } }] },
        { label: 'All three together: $ {=current} + {=capital} + {=official} = {=net}$.', code: 'net', math: 'net', vars: { net },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:3', tone: 'good' } }] },
      ],
    };
  }

  // ---------------------------------------------------------------- quiz generators
  function spreadQ({ rng, difficulty }) {
    for (;;) {
      const base = rng.pick([1.0840, 1.0955, 1.2610, 0.9285, 0.7838, 1.3347]);
      const pips = rng.int(1, difficulty === 1 ? 3 : 6);
      const bid = Math.round(base * 1e4) / 1e4;
      const ask = Math.round((bid + pips / 1e4) * 1e4) / 1e4;
      const r = spreadQuote({ bid, ask });
      const mid = r.mid;
      return {
        vars: { bid, ask, pips: Math.round(r.pips), spread: r.spread, mid, wrongMid: mid, wrongSum: bid + ask },
        misconceptions: [
          { var: 'wrongSum', feedback: 'You added bid and ask. The spread is the **difference**: ask minus bid.' },
        ],
      };
    }
  }

  function reciprocalQ({ rng }) {
    for (;;) {
      const rate = rng.pick([0.5, 0.8, 1.25, 1.6, 2, 2.5, 4, 0.4, 0.25, 5]);
      const flip = 1 / rate;
      if (Math.abs(flip - rate) < 1e-9) continue;
      return {
        vars: { rate, flip, wrongSame: rate, wrongOneMinus: 1 - rate },
        misconceptions: [
          { var: 'wrongSame', feedback: 'That is the quote you started with. The reciprocal flips the pair: divide **1** by the rate.' },
          { var: 'wrongOneMinus', feedback: 'You subtracted from 1. Reverse a quote by dividing 1 by it, not by subtracting.' },
        ],
      };
    }
  }

  function crossQ({ rng, difficulty }) {
    for (;;) {
      const a = rng.pick([1.1, 1.2, 1.25, 1.5, 2]);
      const b = rng.pick([0.5, 0.6, 0.75, 0.8, 0.9]);
      const cross = a * b;
      const wrongDiv = a / b;
      if (!isCleanRate(cross)) continue;
      if (Math.abs(wrongDiv - cross) < 0.01) continue;
      const spreadA = difficulty >= 2 ? 0.02 : 0;
      return {
        vars: { a, b, cross, wrongDiv, wrongAdd: a + b, bid1: a, ask1: a + spreadA, bid2: b, ask2: b, crossAsk: (a + spreadA) * b, spreadA },
        misconceptions: [
          { var: 'wrongDiv', feedback: 'You divided. Both quotes are "per unit of the first currency", so the two rates **multiply**.' },
          { var: 'wrongAdd', feedback: 'Rates are ratios, not amounts. Multiply the two quotes; never add them.' },
        ],
      };
    }
  }

  function convertQ({ rng, difficulty }) {
    for (;;) {
      const bid = rng.pick([1.08, 1.10, 1.20, 1.50]);
      const gap = rng.pick([0.02, 0.04]);
      const ask = Math.round((bid + gap) * 100) / 100;
      const amount = rng.pick([100, 200, 500, 1000, 2000]);
      const action = rng.pick(['buy', 'sell']);
      const r = convertFx({ amount, bid, ask, action });
      const wrong = amount * (action === 'buy' ? bid : ask);
      const wrongDiv = amount / r.rate;
      if (Math.abs(wrong - r.result) < 1e-9) continue;
      return {
        vars: { amount, bid, ask, action, rate: r.rate, result: r.result, wrong, wrongDiv, verb: action === 'buy' ? 'buys' : 'sells', side: action === 'buy' ? 'ask' : 'bid' },
        misconceptions: [
          { var: 'wrong', feedback: 'You used the wrong side of the quote. The bank sells at the **ask** and buys at the **bid**; the customer does the opposite.' },
          { var: 'wrongDiv', feedback: 'You divided by the rate. The quote is dollars per euro, so multiply euros by it.' },
        ],
      };
    }
  }

  function forwardQ({ rng, difficulty }) {
    for (;;) {
      const spot = rng.pick([1.00, 1.20, 1.25, 1.50, 2.00]);
      const iHome = rng.pick([0.02, 0.04, 0.05, 0.06, 0.08]);
      const iForeign = rng.pick([0.00, 0.01, 0.02, 0.03, 0.04]);
      if (iHome === iForeign) continue;
      const r = forwardRate({ spot, iHome, iForeign });
      const wrongSwap = spot * (1 + iForeign - iHome);
      const wrongAdd = spot * (1 + iHome + iForeign);
      if (Math.abs(wrongSwap - r.forward) < 0.0051 || Math.abs(wrongAdd - r.forward) < 0.0051) continue;
      return {
        vars: { spot, iHome, iForeign, diff: r.diff, forward: r.forward, wrongSwap, wrongAdd, direction: r.direction },
        misconceptions: [
          { var: 'wrongSwap', feedback: 'You subtracted the interest rates the wrong way round. Take the **home** rate minus the **foreign** rate.' },
          { var: 'wrongAdd', feedback: 'You added the two interest rates. The forward premium is their **difference**.' },
        ],
      };
    }
  }

  function pppQ({ rng }) {
    for (;;) {
      const spot = rng.pick([1.00, 1.20, 1.25, 1.50, 2.00, 50]);
      const piHome = rng.pick([0.02, 0.03, 0.04, 0.06, 0.08]);
      const piForeign = rng.pick([0.00, 0.01, 0.02, 0.03]);
      if (piHome === piForeign) continue;
      const r = pppRate({ spot, piHome, piForeign });
      const wrongSwap = spot * (1 + piForeign - piHome);
      if (Math.abs(wrongSwap - r.expected) < 0.0051 * Math.max(1, spot / 2)) continue;
      return {
        vars: { spot, piHome, piForeign, gap: r.gap, expected: r.expected, wrongSwap, change: r.change },
        misconceptions: [
          { var: 'wrongSwap', feedback: 'You used foreign minus home inflation. The home price level rising faster makes the foreign currency **cost more** at home: use home minus foreign.' },
        ],
      };
    }
  }

  function fisherQ({ rng }) {
    for (;;) {
      const nominal = rng.pick([0.04, 0.05, 0.06, 0.08, 0.10, 0.12]);
      const inflation = rng.pick([0.01, 0.02, 0.03, 0.04, 0.05, 0.07]);
      if (inflation === nominal) continue;
      const r = fisher({ nominal, inflation });
      return {
        vars: { nominal, inflation, real: r.real, wrongAdd: nominal + inflation, wrongRatio: nominal / inflation },
        misconceptions: [
          { var: 'wrongAdd', feedback: 'You added inflation. Rising prices **eat into** the interest, so subtract it.' },
          { var: 'wrongRatio', feedback: 'You divided. The real rate is the nominal rate **minus** expected inflation.' },
        ],
      };
    }
  }

  function randomWalkQ({ rng, difficulty }) {
    for (;;) {
      const n = difficulty === 1 ? 4 : 5;
      let y = rng.pick([1.00, 1.10, 1.20]);
      const series = [Math.round(y * 100) / 100];
      for (let i = 1; i < n; i++) {
        y += rng.pick([-0.03, -0.02, -0.01, 0.01, 0.02, 0.03]);
        series.push(Math.round(y * 100) / 100);
      }
      const r = randomWalk({ series });
      const last = series[series.length - 1];
      const prev = series[series.length - 2];
      if (last === prev) continue;
      const trend = last - prev;
      if (Math.abs(trend) < 0.0051 || Math.abs(mean(series) - last) < 0.0051) continue;
      return {
        vars: { series, seriesText: series.join(', '), last, prev, forecast: last, error: r.lastError, mae: r.mae, wrongTrend: last + trend, wrongMean: mean(series) },
        misconceptions: [
          { var: 'wrongTrend', feedback: 'That extends the latest move. A random walk predicts **no** move: tomorrow equals today.' },
          { var: 'wrongMean', feedback: 'That is the average of the whole series. A random walk forecasts with just the **latest** value.' },
        ],
      };
    }
  }

  function vatQ({ rng, difficulty }) {
    for (;;) {
      const rate = rng.pick([0.10, 0.12, 0.20]);
      const n = difficulty === 1 ? 3 : 4;
      const prices = [];
      let p = rng.pick([100, 200, 300]);
      for (let i = 0; i < n; i++) {
        prices.push(p);
        p += rng.pick([50, 100, 150]);
      }
      const r = vatChain({ prices, rate });
      const last = prices[n - 1];
      const stage = rng.int(1, n - 1);
      const s = r.stages[stage];
      return {
        vars: { rate, prices, pricesText: prices.join(', '), last, stage: stage + 1, price: s.price, prevPrice: prices[stage - 1], remit: s.remit, total: r.totalRemit, wrongFull: s.collected, wrongNoCredit: rate * s.price },
        misconceptions: [
          { var: 'wrongFull', feedback: 'That is all the tax collected at this stage. The firm gets a **credit** for the tax already paid on its inputs, so it only passes on the tax on the value it added.' },
        ],
      };
    }
  }

  function bopQ({ rng }) {
    for (;;) {
      const exp = rng.pick([80, 100, 120, 150, 200]);
      const imp = rng.pick([90, 110, 130, 160, 210]);
      const inv = rng.pick([20, 30, 40, 60]);
      const out = rng.pick([10, 20, 30]);
      const table = { rows: [['current', 'Exports', exp], ['current', 'Imports', -imp], ['capital', 'Foreign investment in', inv], ['capital', 'Investment abroad', -out]] };
      const r = bopSummary({ table });
      if (r.current === 0 || r.official === 0) continue;
      return {
        vars: { exp, imp, inv, out, current: r.current, capital: r.capital, official: r.official, wrongNet: r.current + r.capital + Math.abs(r.official), side: r.current < 0 ? 'deficit' : 'surplus' },
        misconceptions: [
          { var: 'wrongNet', feedback: 'The reserves entry has the **opposite sign** of current plus capital, so that everything adds to zero.' },
        ],
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
      regimeShares: sameAnchors(regimeShares), regimeGrid,
      spreadQuote: sameAnchors(spreadQuote), crossRate: sameAnchors(crossRate), convertFx: sameAnchors(convertFx),
      forwardRate: sameAnchors(forwardRate), pppRate: sameAnchors(pppRate), fisher: sameAnchors(fisher),
      randomWalk: sameAnchors(randomWalk), vatChain: sameAnchors(vatChain), bopSummary: sameAnchors(bopSummary),
    },
    generators: { spreadQ, reciprocalQ, crossQ, convertQ, forwardQ, pppQ, fisherQ, randomWalkQ, vatQ, bopQ },
  };
}
