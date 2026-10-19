export default function register(sdk) {
  const YEARS = ['2022', '2019', '2014', '2009', '2004', '1999'];
  // Table 6.4, embedded so quiz generators can draw countries from the lecture's own data.
  const CPI = [
    ['Denmark', 1, 1, 1, 2, 3, 1], ['New Zealand', 2, 1, 2, 1, 2, 3], ['Finland', 2, 3, 3, 6, 1, 2],
    ['Singapore', 5, 4, 7, 3, 5, 7], ['Switzerland', 7, 4, 5, 5, 7, 9], ['Germany', 9, 9, 12, 14, 15, 14],
    ['Australia', 13, 12, 11, 8, 9, 12], ['Canada', 14, 12, 10, 8, 12, 5], ['United Kingdom', 18, 12, 14, 17, 11, 13],
    ['Japan', 18, 20, 15, 17, 24, 25], ['France', 21, 23, 27, 24, 22, 22], ['United States', 24, 23, 17, 19, 17, 18],
    ['South Korea', 31, 39, 44, 39, 47, 50], ['Spain', 35, 30, 38, 32, 22, 22], ['Italy', 41, 51, 69, 63, 42, 38],
    ['China', 65, 80, 100, 79, 71, 58], ['South Africa', 72, 70, 67, 55, 44, 34], ['India', 85, 80, 85, 84, 90, 72],
    ['Brazil', 94, 106, 69, 75, 59, 45], ['Mexico', 120, 130, 103, 89, 64, 58], ['Russia', 137, 137, 136, 146, 90, 82],
    ['Nigeria', 150, 146, 136, 130, 144, 98],
  ];
  const ci = (y) => YEARS.indexOf(String(y)) + 1;

  // ---------------------------------------------------------------- Corruption Perceptions Index: how far did a rank move?
  // roles: r (Readout: 0 earlier rank, 1 later rank, 2 change), code, formula
  function cpiRank({ table, country, from, to }) {
    const row = table.rows.find((r) => r[0] === country);
    const a = row[ci(from)];
    const b = row[ci(to)];
    const change = a - b;
    return {
      earlier: a, later: b, change, direction: change > 0 ? 'improved' : change < 0 ? 'worsened' : 'unchanged',
      trace: [
        { label: '{=country} ranked {=earlier} in {=from}.', code: 'earlier', vars: { country, from, earlier: a },
          ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: 'item:0', tone: 'accent' } }] },
        { label: 'It ranked {=later} in {=to}.', code: 'later', vars: { to, later: b },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:1', tone: 'accent' } }] },
        { label: 'Change $= {=earlier} - {=later} = {=change}$: the rank {=direction}.', code: 'change', vars: { change, direction: change > 0 ? 'improved' : change < 0 ? 'worsened' : 'unchanged' },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:2', tone: change > 0 ? 'good' : change < 0 ? 'bad' : 'muted' } }] },
      ].map((s) => ({ ...s, vars: { ...s.vars, country, from, to, earlier: a, later: b, change, direction: change > 0 ? 'improved' : change < 0 ? 'worsened' : 'unchanged' } })),
    };
  }

  // The best-ranked country in a year (smallest rank number).
  function cpiBest({ table, year }) {
    const i = ci(year);
    let best = table.rows[0];
    table.rows.forEach((r) => { if (r[i] < best[i]) best = r; });
    return { country: best[0], rank: best[i] };
  }

  // ---------------------------------------------------------------- Incoterms: what price does each term quote?
  // roles: r (Readout: 0 price at the ship's rail (FOB), 1 freight, 2 insurance, 3 quoted price, 4 buyer pays on top), code, formula
  function incotermPrice({ fob, freight, insurance, loading, term }) {
    const price = term === 'FAS' ? fob - loading : term === 'FOB' ? fob : term === 'CFR' ? fob + freight : fob + freight + insurance;
    const total = fob + freight + insurance;
    const buyerExtra = total - price;
    const riskPassesAt = term === 'FAS' ? 'alongside the ship' : 'on board the ship';
    return {
      price, total, buyerExtra, riskPassesAt,
      includesFreight: term === 'CFR' || term === 'CIF',
      includesInsurance: term === 'CIF',
      trace: [
        { label: 'Goods on board the ship cost {=fob|comma} (the FOB price).', code: 'fob', vars: { fob },
          ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: 'item:0' } }] },
        { label: 'Under {=term}, the seller adds freight {=addFreight|comma}.', code: 'freight', vars: { addFreight: (term === 'CFR' || term === 'CIF') ? freight : 0 },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:1', tone: (term === 'CFR' || term === 'CIF') ? 'accent' : 'muted' } }] },
        { label: 'Under {=term}, the seller adds insurance {=addInsurance|comma}.', code: 'insurance', vars: { addInsurance: term === 'CIF' ? insurance : 0 },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:2', tone: term === 'CIF' ? 'accent' : 'muted' } }] },
        { label: 'Quoted price $= {=price|comma}$. The buyer pays {=buyerExtra|comma} on top.', code: 'price', vars: { price, buyerExtra },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: ['item:3', 'item:4'], tone: 'good' } }] },
      ].map((s) => ({ ...s, vars: { ...s.vars, term, fob, freight, insurance, price, buyerExtra } })),
    };
  }

  // ---------------------------------------------------------------- which rule applies?
  // roles: r (Readout: 0 situation, 1 rule that applies, 2 area of law), code, formula
  const RULES = {
    invention: ['Patent', 'intellectual property'],
    'brand-sign': ['Trademark', 'intellectual property'],
    'business-name': ['Trade name', 'intellectual property'],
    'creative-work': ['Copyright', 'intellectual property'],
    'confidential-info': ['Trade secret', 'intellectual property'],
    'price-fixing': ['Antitrust law', 'national law'],
    'careless-injury': ['Tort', 'national law'],
    'product-harm': ['Strict liability', 'national law'],
    'accounting-scandal': ['Sarbanes-Oxley Act', 'national law'],
    'eu-accounting': ['International Financial Reporting Standards', 'national law'],
  };
  function whichLaw({ issue }) {
    const hit = RULES[issue] || ['No rule found', 'unknown'];
    return {
      law: hit[0], area: hit[1],
      trace: [
        { label: 'The situation is "{=issue}".', code: 'lookup', vars: { issue },
          ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: 'item:0', tone: 'accent' } }] },
        { label: 'The rule that applies is {=law}, part of {=area}.', code: 'answer', vars: { law: hit[0], area: hit[1] },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: ['item:1', 'item:2'], tone: 'good' } }] },
      ].map((s) => ({ ...s, vars: { ...s.vars, issue, law: hit[0], area: hit[1] } })),
    };
  }

  // ---------------------------------------------------------------- quiz generators
  function cpiQ({ rng }) {
    for (;;) {
      const row = rng.pick(CPI);
      const a = rng.int(1, 6);
      const b = rng.int(1, 6);
      if (a === b) continue;
      const from = YEARS[Math.max(a, b) - 1];
      const to = YEARS[Math.min(a, b) - 1];
      const earlier = row[ci(from)];
      const later = row[ci(to)];
      const change = earlier - later;
      if (change === 0) continue;
      const wrongSign = later - earlier;
      if (Math.abs(wrongSign) < 1) continue;
      return {
        vars: { country: row[0], from, to, earlier, later, change, wrongSign, wrongEarlier: earlier, direction: change > 0 ? 'improved' : 'worsened', absChange: Math.abs(change) },
        misconceptions: [],
      };
    }
  }

  function cpiGapQ({ rng }) {
    for (;;) {
      const [x, y] = rng.sample(CPI, 2);
      const year = rng.pick(YEARS);
      const rx = x[ci(year)];
      const ry = y[ci(year)];
      if (rx === ry) continue;
      const gap = Math.abs(rx - ry);
      return {
        vars: { a: x[0], b: y[0], year, ra: rx, rb: ry, gap, wrongSum: rx + ry, cleaner: rx < ry ? x[0] : y[0] },
        options: [x[0], y[0]],
        answer: rx < ry ? 0 : 1,
        misconceptions: [],
      };
    }
  }

  function incoQ({ rng, difficulty }) {
    for (;;) {
      const fob = rng.pick([10000, 20000, 40000, 50000]);
      const freight = rng.pick([1000, 1500, 2000, 3000]);
      const insurance = rng.pick([200, 300, 500, 800]);
      const loading = rng.pick([300, 500, 800]);
      const term = difficulty === 1 ? rng.pick(['CFR', 'CIF']) : difficulty === 2 ? rng.pick(['FAS', 'CFR', 'CIF']) : rng.pick(['FAS', 'CFR']);
      const r = incotermPrice({ fob, freight, insurance, loading, term });
      return {
        vars: {
          fob, freight, insurance, loading, term, price: r.price, buyerExtra: r.buyerExtra, total: r.total,
          wrongFob: fob, wrongAll: fob + freight + insurance + loading, wrongNoIns: fob + freight, wrongBuyer: r.price,
          priceCfr: fob + freight, priceCif: fob + freight + insurance,
        },
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
    fns: { cpiRank: sameAnchors(cpiRank), cpiBest, incotermPrice: sameAnchors(incotermPrice), whichLaw: sameAnchors(whichLaw) },
    generators: { cpiQ, cpiGapQ, incoQ },
  };
}
