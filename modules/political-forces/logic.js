export default function register(sdk) {
  const { sum } = sdk;
  const REGIONS = ['Africa', 'Asia', 'Latin America and the Caribbean', 'Rest of world'];
  // Table 5.1, embedded so quiz generators can draw years from the lecture's own data.
  const PIRACY = [
    ['2013', 79, 167, 18, 0, 264], ['2014', 55, 183, 5, 2, 245], ['2015', 70, 202, 8, 1, 281],
    ['2016', 122, 101, 27, 1, 251], ['2017', 151, 95, 71, 4, 321], ['2018', 121, 98, 85, 0, 304],
    ['2019', 110, 89, 84, 0, 283], ['2020', 47, 62, 22, 64, 195], ['2021', 30, 39, 28, 35, 132],
    ['2022', 16, 56, 23, 20, 115], ['2023', 23, 58, 18, 0, 99],
  ];
  const money = (x) => Math.round(x * 100) / 100;

  // ---------------------------------------------------------------- Table 5.1: add the regions and compare with the printed total
  // roles: r (Readout: 0 Africa, 1 Asia, 2 Latin America, 3 Rest of world, 4 sum of regions), code, formula
  function piracyYear({ table, year }) {
    const row = table.rows.find((r) => String(r[0]) === String(year));
    const parts = row.slice(1, 5);
    const printed = row[5];
    const total = sum(parts);
    const top = parts.indexOf(Math.max(...parts));
    const trace = [{ label: 'Start with year {=year} and a running total of 0.', code: 'start', vars: { year, running: 0 },
      ops: [{ role: 'r', cmd: 'clear' }] }];
    let running = 0;
    parts.forEach((p, i) => {
      running += p;
      trace.push({
        label: `${REGIONS[i]}: ${p} incidents. Running total ${running}.`,
        code: 'region', vars: { region: REGIONS[i], incidents: p, running },
        ops: [{ role: 'r', cmd: 'highlight', args: { sel: `item:${i}`, tone: 'accent' } }],
      });
    });
    trace.push({
      label: `The regions add to ${total}; the table prints ${printed}.`, code: 'check', vars: { total, printed },
      ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:4', tone: total === printed ? 'good' : 'bad' } }],
    });
    return {
      africa: parts[0], asia: parts[1], latam: parts[2], rest: parts[3], total, printed, matches: total === printed,
      topRegion: REGIONS[top], topShare: parts[top] / total,
      shareAfrica: parts[0] / total, shareAsia: parts[1] / total, shareLatam: parts[2] / total, shareRest: parts[3] / total,
      trace,
    };
  }

  function piracyChange({ table, from, to }) {
    const a = table.rows.find((r) => String(r[0]) === String(from))[5];
    const b = table.rows.find((r) => String(r[0]) === String(to))[5];
    return { from: a, to: b, change: b - a, pct: (b - a) / a };
  }

  // ---------------------------------------------------------------- import duties
  // roles: r (Readout: 0 value, 1 ad valorem part, 2 specific part, 3 duty, 4 landed cost), code, formula
  function importDuty({ value, units, adValoremRate, specificPerUnit }) {
    const adValorem = adValoremRate * value;
    const specific = specificPerUnit * units;
    const duty = adValorem + specific;
    const kind = adValoremRate > 0 && specificPerUnit > 0 ? 'compound' : specificPerUnit > 0 ? 'specific' : 'ad valorem';
    return {
      adValorem, specific, duty, landed: value + duty, dutyPct: value === 0 ? 0 : duty / value, kind,
      trace: [
        { label: 'Invoice value {=value|comma}, {=units|comma} units. This is a {=kind} duty.', code: 'inputs', vars: { value, units, kind },
          ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: 'item:0' } }] },
        { label: 'Ad valorem part $= {=adValoremRate|pct1} \\times {=value|comma} = {=adValorem|comma2}$.', code: 'ad-valorem', vars: { adValorem },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:1', tone: 'accent' } }] },
        { label: 'Specific part $= {=specificPerUnit|comma2} \\times {=units|comma} = {=specific|comma2}$.', code: 'specific', vars: { specific },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:2', tone: 'accent' } }] },
        { label: 'Duty $= {=adValorem|comma2} + {=specific|comma2} = {=duty|comma2}$.', code: 'duty', vars: { duty },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:3', tone: 'good' } }] },
        { label: 'Landed cost $= {=value|comma} + {=duty|comma2} = {=landed|comma2}$.', code: 'landed', vars: { landed: value + duty },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:4', tone: 'good' } }] },
      ].map((s) => ({ ...s, vars: { ...s.vars, value, units, adValoremRate, specificPerUnit, adValorem, specific, duty, kind, landed: value + duty } })),
    };
  }

  // ---------------------------------------------------------------- variable levy
  // roles: r (Readout: 0 world price, 1 supported price, 2 levy, 3 entry price), code, formula
  function variableLevy({ worldPrice, supportedPrice }) {
    const levy = Math.max(0, supportedPrice - worldPrice);
    return {
      levy, entryPrice: worldPrice + levy,
      trace: [
        { label: 'World price {=worldPrice}. Government-supported local price {=supportedPrice}.', code: 'inputs', vars: { worldPrice, supportedPrice },
          ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: ['item:0', 'item:1'] } }] },
        { label: 'Levy $= {=supportedPrice} - {=worldPrice} = {=levy}$ (never below zero).', code: 'levy', vars: { levy },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:2', tone: 'accent' } }] },
        { label: 'Imports now enter at $ {=worldPrice} + {=levy} = {=entry}$.', code: 'entry', vars: { entry: worldPrice + levy },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:3', tone: 'good' } }] },
      ].map((s) => ({ ...s, vars: { ...s.vars, worldPrice, supportedPrice, levy, entry: worldPrice + levy } })),
    };
  }

  // ---------------------------------------------------------------- dumping test and countervailing duty
  // roles: r (Readout: 0 export price, 1 home price, 2 cost, 3 below home?, 4 below cost?), code, formula
  function dumpingTest({ exportPrice, homePrice, cost }) {
    const belowHome = exportPrice < homePrice;
    const belowCost = exportPrice < cost;
    return {
      belowHome, belowCost, dumping: belowHome || belowCost, marginVsHome: Math.max(0, homePrice - exportPrice),
      marginPct: homePrice === 0 ? 0 : Math.max(0, homePrice - exportPrice) / homePrice,
      trace: [
        { label: 'Export price {=exportPrice}. Home price {=homePrice}. Cost {=cost}.', code: 'inputs', vars: { exportPrice, homePrice, cost },
          ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: ['item:0', 'item:1', 'item:2'] } }] },
        { label: belowHome ? 'The export price is below the home price: that counts as dumping.' : 'The export price is not below the home price.', code: 'below-home', vars: { belowHome },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:3', tone: belowHome ? 'bad' : 'good' } }] },
        { label: belowCost ? 'The export price is below cost: that counts as dumping.' : 'The export price covers cost.', code: 'below-cost', vars: { belowCost },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:4', tone: belowCost ? 'bad' : 'good' } }] },
      ].map((s) => ({ ...s, vars: { ...s.vars, exportPrice, homePrice, cost } })),
    };
  }

  function countervailing({ subsidyPerUnit, units, importValue }) {
    const duty = subsidyPerUnit * units;
    return { duty, rate: importValue === 0 ? 0 : duty / importValue, newValue: importValue + duty };
  }

  // ---------------------------------------------------------------- who pays for protection
  // roles: r (Readout: 0 price rise per unit, 1 units bought, 2 cost to buyers, 3 jobs protected, 4 cost per job), code, formula
  function protectionCost({ risePerUnit, quantity, jobsProtected }) {
    const buyersPay = risePerUnit * quantity;
    const perJob = jobsProtected === 0 ? null : buyersPay / jobsProtected;
    return {
      buyersPay, perJob,
      trace: [
        { label: 'The tariff raises the price by {=risePerUnit} per unit, and buyers purchase {=quantity|comma} units.', code: 'inputs', vars: { risePerUnit, quantity },
          ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: ['item:0', 'item:1'] } }] },
        { label: 'Buyers pay extra $= {=risePerUnit} \\times {=quantity|comma} = {=buyersPay|comma}$.', code: 'cost', vars: { buyersPay },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:2', tone: 'bad' } }] },
        { label: 'Spread over {=jobsProtected} jobs, that is {=perJob|comma} per job protected.', code: 'per-job', vars: { perJob },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: ['item:3', 'item:4'], tone: 'accent' } }] },
      ].map((s) => ({ ...s, vars: { ...s.vars, risePerUnit, quantity, jobsProtected, buyersPay, perJob } })),
    };
  }

  // ---------------------------------------------------------------- quiz generators
  function protectQ({ rng }) {
    for (;;) {
      const risePerUnit = rng.pick([1, 2, 5]);
      const quantity = rng.pick([10000, 20000, 50000]);
      const jobsProtected = rng.pick([10, 20, 25, 50]);
      const r = protectionCost({ risePerUnit, quantity, jobsProtected });
      return {
        vars: {
          risePerUnit, quantity, jobsProtected, buyersPay: r.buyersPay, perJob: r.perJob,
          wrongNoJobs: r.buyersPay, wrongPerUnit: risePerUnit / jobsProtected,
        },
        misconceptions: [],
      };
    }
  }

  function dutyQ({ rng, difficulty }) {
    for (;;) {
      const units = rng.pick([100, 200, 500, 1000]);
      const unitPrice = rng.pick([10, 20, 25, 40, 50]);
      const value = units * unitPrice;
      const adValoremRate = rng.pick([0.05, 0.1, 0.15, 0.2]);
      const specificPerUnit = difficulty === 1 ? 0 : rng.pick([1, 2, 3]);
      const r = importDuty({ value, units, adValoremRate, specificPerUnit });
      if (difficulty >= 2 && Math.abs(r.adValorem - r.specific) < 1) continue;
      return {
        vars: {
          value, units, rate: adValoremRate, specific: specificPerUnit, specificPart: r.specific, adValorem: r.adValorem,
          duty: r.duty, landed: r.landed, kind: r.kind,
          wrongLanded: r.duty, wrongAddRate: value + adValoremRate, wrongPerUnit: adValoremRate * unitPrice,
          wrongSpecificAsRate: specificPerUnit * value,
        },
        misconceptions: [],
      };
    }
  }

  function levyQ({ rng }) {
    for (;;) {
      const worldPrice = rng.pick([200, 250, 300, 350, 400]);
      const supportedPrice = worldPrice + rng.pick([-50, 30, 50, 80, 100]);
      const r = variableLevy({ worldPrice, supportedPrice });
      if (r.levy === 0) continue;
      return {
        vars: { worldPrice, supportedPrice, levy: r.levy, entry: r.entryPrice, wrongSum: worldPrice + supportedPrice, wrongWorld: worldPrice },
        misconceptions: [],
      };
    }
  }

  function piracyQ({ rng, difficulty }) {
    for (;;) {
      const row = rng.pick(PIRACY.filter((r) => r[5] > 100 && r[4] > 0));
      const idx = rng.int(1, 4);
      const count = row[idx];
      if (count === 0) continue;
      const total = row[5];
      const share = count / total;
      const other = rng.pick([1, 2, 3, 4].filter((k) => k !== idx));
      if (Math.abs(row[other] / total - share) < 0.03) continue;
      return {
        vars: {
          year: row[0], region: REGIONS[idx - 1], count, total, share, wrongShare: row[other] / total, wrongCount: count, pct: share * 100,
          africa: row[1], asia: row[2], latam: row[3], rest: row[4], wrongRegions: row[1] + row[2] + row[3],
        },
        misconceptions: [],
      };
    }
  }

  function dumpQ({ rng }) {
    for (;;) {
      const homePrice = rng.pick([80, 100, 120, 150]);
      const cost = homePrice - rng.pick([10, 20, 30]);
      const exportPrice = homePrice + rng.pick([-40, -30, -15, -5, 10, 20]);
      const r = dumpingTest({ exportPrice, homePrice, cost });
      return {
        vars: { exportPrice, homePrice, cost, dumping: r.dumping ? 'yes' : 'no', belowHome: r.belowHome, belowCost: r.belowCost, margin: r.marginVsHome },
        options: ['Yes, it is dumping', 'No, it is not dumping'],
        answer: r.dumping ? 0 : 1,
        misconceptions: [],
      };
    }
  }

  function changeQ({ rng }) {
    for (;;) {
      const a = rng.pick(PIRACY);
      const b = rng.pick(PIRACY);
      if (a[0] >= b[0]) continue;
      const pct = (b[5] - a[5]) / a[5];
      return { vars: { from: a[0], to: b[0], totalFrom: a[5], totalTo: b[5], pct, wrongRev: (a[5] - b[5]) / b[5], wrongDiff: b[5] - a[5] }, misconceptions: [] };
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
      piracyYear: sameAnchors(piracyYear), piracyChange, importDuty: sameAnchors(importDuty),
      variableLevy: sameAnchors(variableLevy), dumpingTest: sameAnchors(dumpingTest), countervailing,
      protectionCost: sameAnchors(protectionCost),
    },
    generators: { dutyQ, levyQ, piracyQ, dumpQ, changeQ, protectQ },
  };
}
