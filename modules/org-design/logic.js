export default function register(sdk) {
  const { sum } = sdk;
  const CULTURE = {
    'home replication': ['Ethnocentric', 'transfers existing products and processes'],
    global: ['None named', 'offers standardized products and services worldwide'],
    multidomestic: ['Polycentric', 'adapts to local preferences, rules and cultures'],
    transnational: ['Geocentric', 'standardizes when possible and adapts when necessary'],
  };
  const STRUCT = {
    'international-division': ['Gives overseas operations one home as they start to grow', 'Often dropped as overseas operations grow'],
    product: ['Avoids duplicating product experts', 'Duplicates area experts'],
    geographic: ['Every country is under someone in contact with headquarters', 'Best for products with low or stable technology'],
    functional: ['Suits a narrow, highly integrated product mix such as oil', 'Few international companies use it at the top'],
    hybrid: ['Uses more than one dimension at the top level', 'Often grows out of adding a new product line to a regional company'],
    matrix: ['Meshes product, regional and functional expertise', 'Multiple reporting lines keep most worldwide firms from adopting it'],
  };
  const money = (x) => Math.round(x * 100) / 100;

  // ---------------------------------------------------------------- transfer pricing and taxes (Tables 10.2 and 10.3)
  // roles: r (Readout: 0 Alpha after-tax, 1 Beta after-tax, 2 total after-tax, 3 total tax), code, formula
  function transferPricing({ alphaPretax, betaPretax, alphaRate, betaRate }) {
    const alphaTax = alphaPretax * alphaRate;
    const betaTax = betaPretax * betaRate;
    const alphaAfter = alphaPretax - alphaTax;
    const betaAfter = betaPretax - betaTax;
    const totalAfter = alphaAfter + betaAfter;
    const totalTax = alphaTax + betaTax;
    return {
      alphaTax, betaTax, alphaAfter, betaAfter, totalAfter, totalTax, totalPretax: alphaPretax + betaPretax,
      trace: [
        { label: 'Alpha earns {=alphaPretax} before tax and pays {=alphaRate|pct}. Tax $= {=alphaTax}$, leaving {=alphaAfter}.', code: 'alpha', vars: { alphaTax, alphaAfter },
          ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: 'item:0', tone: 'accent' } }] },
        { label: 'Beta earns {=betaPretax} before tax and pays {=betaRate|pct}. Tax $= {=betaTax}$, leaving {=betaAfter}.', code: 'beta', vars: { betaTax, betaAfter },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:1', tone: 'accent' } }] },
        { label: 'Together the firms keep $ {=alphaAfter} + {=betaAfter} = {=totalAfter}$ and pay {=totalTax} in tax.', code: 'total', vars: { totalAfter, totalTax },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: ['item:2', 'item:3'], tone: 'good' } }] },
      ].map((s) => ({ ...s, vars: { ...s.vars, alphaPretax, betaPretax, alphaRate, betaRate, alphaTax, betaTax, alphaAfter, betaAfter, totalAfter, totalTax } })),
    };
  }

  function shiftGain({ shift, highRate, lowRate }) {
    return { gain: shift * (highRate - lowRate), taxSaved: shift * (highRate - lowRate) };
  }

  // ---------------------------------------------------------------- levels of hierarchy for a given span of control
  // roles: r (Readout: 0 employees, 1 span of control, 2 manager layers, 3 managers in all), code, formula
  function hierarchyLevels({ employees, span }) {
    let people = employees;
    let layers = 0;
    let managers = 0;
    const trace = [{ label: '{=employees|comma} employees. Each manager oversees {=span} people.', code: 'inputs', vars: { employees, span },
      ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: ['item:0', 'item:1'] } }] }];
    while (people > 1) {
      const next = Math.ceil(people / span);
      layers += 1;
      managers += next;
      trace.push({
        label: `Layer ${layers}: ${people} people need ${next} managers. Managers so far ${managers}.`, code: 'loop', vars: { layer: layers, people, next, managers },
        ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:2', tone: 'accent' } }],
      });
      people = next;
    }
    trace.push({ label: `The top is reached after ${layers} layers of management, ${managers} managers in all.`, code: 'levels', vars: { layers, managers },
      ops: [{ role: 'r', cmd: 'highlight', args: { sel: ['item:2', 'item:3'], tone: 'good' } }] });
    return { layers, managers, trace };
  }

  // ---------------------------------------------------------------- how centralized are decisions?
  // roles: r (Readout: 0 decisions at headquarters, 1 all decisions, 2 share at headquarters), code, formula
  function centralization({ hq, total }) {
    const share = hq / total;
    return {
      share, local: total - hq, label: share >= 0.6 ? 'mostly centralized' : share <= 0.4 ? 'mostly decentralized' : 'balanced',
      trace: [
        { label: 'Headquarters makes {=hq} of the {=total} decisions.', code: 'inputs', vars: { hq, total },
          ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: ['item:0', 'item:1'] } }] },
        { label: 'Share at headquarters $= {=hq} \\div {=total} = {=share|pct}$.', code: 'share', vars: { share },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:2', tone: 'good' } }] },
      ].map((s) => ({ ...s, vars: { ...s.vars, hq, total, share } })),
    };
  }

  // ---------------------------------------------------------------- strategy and culture
  // roles: r (Readout: 0 strategy, 1 culture, 2 idea), code, formula
  function cultureFor({ strategy }) {
    const hit = CULTURE[strategy] || ['Unknown', 'no match'];
    return {
      culture: hit[0], idea: hit[1],
      trace: [
        { label: 'The strategy is {=strategy}.', code: 'lookup', vars: { strategy },
          ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: 'item:0', tone: 'accent' } }] },
        { label: 'It leads to a {=culture} culture: it {=idea}.', code: 'answer', vars: { culture: hit[0], idea: hit[1] },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: ['item:1', 'item:2'], tone: 'good' } }] },
      ].map((s) => ({ ...s, vars: { ...s.vars, strategy, culture: hit[0], idea: hit[1] } })),
    };
  }

  // ---------------------------------------------------------------- what each structure offers
  // roles: r (Readout: 0 structure, 1 strength, 2 weakness), code, formula
  function structureInfo({ structure }) {
    const hit = STRUCT[structure] || ['No match', 'No match'];
    return {
      strength: hit[0], weakness: hit[1],
      trace: [
        { label: 'The structure is {=structure}.', code: 'lookup', vars: { structure },
          ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: 'item:0', tone: 'accent' } }] },
        { label: 'Strength: {=strength}. Cost: {=weakness}.', code: 'answer', vars: { strength: hit[0], weakness: hit[1] },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: ['item:1', 'item:2'], tone: 'good' } }] },
      ].map((s) => ({ ...s, vars: { ...s.vars, structure, strength: hit[0], weakness: hit[1] } })),
    };
  }

  // ---------------------------------------------------------------- control through ownership
  // roles: r (Readout: 0 voting stock owned, 1 type of company, 2 ways to keep control), code, formula
  function ownershipControl({ sharePct }) {
    const majority = sharePct > 50;
    const type = majority ? 'Subsidiary' : 'Affiliate';
    const tools = majority ? 'elect a majority of the board' : 'management contract, finances, technology, people in key jobs';
    return {
      type, majority, tools,
      trace: [
        { label: 'The parent owns {=sharePct}% of the voting stock.', code: 'inputs', vars: { sharePct },
          ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: 'item:0' } }] },
        { label: sharePct > 50 ? 'More than half: it can elect a majority of the board, so this is a subsidiary.' : 'Half or less: this is an affiliate, so control must come from other tools.', code: 'type', vars: { type },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:1', tone: 'accent' } }] },
        { label: 'Tools of control: {=tools}.', code: 'tools', vars: { tools },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:2', tone: 'good' } }] },
      ].map((s) => ({ ...s, vars: { ...s.vars, sharePct, type, tools } })),
    };
  }

  // ---------------------------------------------------------------- quiz generators
  function transQ({ rng }) {
    for (;;) {
      const alphaRate = rng.pick([0.5, 0.4, 0.3]);
      const betaRate = rng.pick([0.1, 0.2]);
      const alphaPretax = rng.pick([40, 60, 70, 80]);
      const betaPretax = rng.pick([20, 30, 40, 60]);
      if (alphaPretax === betaPretax) continue;
      const r = transferPricing({ alphaPretax, betaPretax, alphaRate, betaRate });
      const shift = rng.pick([10, 20]);
      const g = shiftGain({ shift, highRate: alphaRate, lowRate: betaRate });
      return {
        vars: {
          alphaPretax, betaPretax, alphaRate, betaRate, totalAfter: r.totalAfter, totalTax: r.totalTax, totalPretax: r.totalPretax,
          alphaTax: r.alphaTax, betaTax: r.betaTax, shift, gain: g.gain, newAfter: r.totalAfter + g.gain,
          wrongSumRates: shift * (alphaRate + betaRate), wrongPretax: r.totalPretax, wrongSwapRates: alphaPretax * (1 - betaRate) + betaPretax * (1 - alphaRate), wrongShiftAll: shift,
        },
        misconceptions: [],
      };
    }
  }

  function hierQ({ rng }) {
    for (;;) {
      const span = rng.pick([5, 10]);
      const k = rng.int(2, 3);
      const employees = span ** k * rng.pick([1, 1, 2]);
      const r = hierarchyLevels({ employees, span });
      return {
        vars: { employees, span, layers: r.layers, managers: r.managers, wrongDiv: employees / span, wrongSpan: span },
        misconceptions: [],
      };
    }
  }

  function centralQ({ rng }) {
    for (;;) {
      const total = rng.pick([20, 25, 40, 50]);
      const hq = Math.round(total * rng.pick([0.2, 0.4, 0.6, 0.8]));
      const r = centralization({ hq, total });
      return {
        vars: { hq, total, local: total - hq, share: r.share, label: r.label, wrongLocal: (total - hq) / total, wrongRatio: hq / (total - hq) },
        misconceptions: [],
      };
    }
  }

  function ownerQ({ rng }) {
    const sharePct = rng.pick([20, 40, 49, 51, 60, 75, 100]);
    const r = ownershipControl({ sharePct });
    return { vars: { sharePct, type: r.type }, options: ['Subsidiary', 'Affiliate'], answer: r.majority ? 0 : 1, misconceptions: [] };
  }

  function cultureQ({ rng }) {
    const strategy = rng.pick(['home replication', 'multidomestic', 'transnational']);
    const culture = cultureFor({ strategy }).culture;
    const options = ['Ethnocentric', 'Polycentric', 'Geocentric'];
    return { vars: { strategy, culture }, options, answer: options.indexOf(culture), misconceptions: [] };
  }

  // Every trace step lights the same anchor name in the derivation (math) and in the code pane (code).
  const sameAnchors = (f) => (args) => {
    const r = f(args);
    if (r && r.trace) r.trace = r.trace.map((s) => ({ ...s, math: s.code }));
    return r;
  };

  return {
    fns: {
      transferPricing: sameAnchors(transferPricing), shiftGain, hierarchyLevels: sameAnchors(hierarchyLevels),
      centralization: sameAnchors(centralization), cultureFor: sameAnchors(cultureFor), structureInfo: sameAnchors(structureInfo),
      ownershipControl: sameAnchors(ownershipControl),
    },
    generators: { transQ, hierQ, centralQ, ownerQ, cultureQ },
  };
}
