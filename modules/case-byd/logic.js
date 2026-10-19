export default function register(sdk) {
  const round = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

  // ---------------------------------------------------------------- compare two numbers
  // roles: r (Readout: 0 base, 1 other, 2 difference, 3 ratio, 4 percent above the base), code, formula
  function compare({ base, other }) {
    const diff = other - base;
    const ratio = other / base;
    const over = ratio - 1;
    const under = (other - base) / other;
    return {
      diff, ratio, pctOver: over, pctUnder: under,
      trace: [
        { label: 'The base is {=base|comma}. The other number is {=other|comma}.', code: 'inputs', vars: { base, other },
          ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: ['item:0', 'item:1'] } }] },
        { label: 'Difference $= {=other|comma} - {=base|comma} = {=diff|comma}$.', code: 'diff', vars: { diff },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:2', tone: 'accent' } }] },
        { label: 'Ratio $= {=other|comma} \\div {=base|comma} = {=ratio|2}$, which is {=over|pct1} above the base.', code: 'over', vars: { ratio, over },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: ['item:3', 'item:4'], tone: 'good' } }] },
      ].map((s) => ({ ...s, vars: { ...s.vars, base, other, diff, ratio, over } })),
    };
  }

  // ---------------------------------------------------------------- growth multiple and yearly growth
  // roles: r (Readout: 0 start, 1 end, 2 times larger, 3 yearly growth), code, formula
  function growthRate({ start, end, years }) {
    const multiple = end / start;
    const cagr = multiple ** (1 / years) - 1;
    return {
      multiple, cagr,
      trace: [
        { label: 'Sales went from {=start|comma} to {=end|comma} in {=years} years.', code: 'inputs', vars: { start, end, years },
          ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: ['item:0', 'item:1'] } }] },
        { label: 'Times larger $= {=end|comma} \\div {=start|comma} = {=multiple|2}$.', code: 'multiple', vars: { multiple },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:2', tone: 'accent' } }] },
        { label: 'Yearly growth $= {=multiple|2}^{1/{=years}} - 1 = {=cagr|pct1}$.', code: 'cagr', vars: { cagr },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:3', tone: 'good' } }] },
      ].map((s) => ({ ...s, vars: { ...s.vars, start, end, years, multiple, cagr } })),
    };
  }

  // ---------------------------------------------------------------- overseas sales target
  // roles: r (Readout: 0 total, 1 overseas, 2 overseas share, 3 overseas needed, 4 extra needed), code, formula
  function overseasGap({ total, overseas, targetShare }) {
    const share = overseas / total;
    const needed = total * targetShare;
    const extra = needed - overseas;
    return {
      share, needed, extra,
      trace: [
        { label: 'Total sales {=total|comma}. Sold abroad {=overseas|comma}.', code: 'inputs', vars: { total, overseas },
          ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: ['item:0', 'item:1'] } }] },
        { label: 'Share abroad $= {=overseas|comma} \\div {=total|comma} = {=share|pct1}$.', code: 'share', vars: { share },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:2', tone: 'accent' } }] },
        { label: 'A {=targetShare|pct} target needs $ {=total|comma} \\times {=targetShare|2} = {=needed|comma}$ abroad.', code: 'needed', vars: { needed },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:3', tone: 'accent' } }] },
        { label: 'That is {=extra|comma} more than today.', code: 'extra', vars: { extra },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:4', tone: 'good' } }] },
      ].map((s) => ({ ...s, vars: { ...s.vars, total, overseas, targetShare, share, needed, extra } })),
    };
  }

  // ---------------------------------------------------------------- price after a tariff
  // roles: r (Readout: 0 price before tariff, 1 tariff rate, 2 duty, 3 price after tariff), code, formula
  function tariffedPrice({ price, tariff }) {
    const duty = price * tariff;
    const total = price + duty;
    return {
      duty, total, multiple: total / price,
      trace: [
        { label: 'The car costs {=price|comma} before the tariff. The tariff is {=tariff|pct}.', code: 'inputs', vars: { price, tariff },
          ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: ['item:0', 'item:1'] } }] },
        { label: 'Duty $= {=tariff|2} \\times {=price|comma} = {=duty|comma}$.', code: 'duty', vars: { duty },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:2', tone: 'accent' } }] },
        { label: 'Price after the tariff $= {=price|comma} + {=duty|comma} = {=total|comma}$.', code: 'total', vars: { total },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:3', tone: 'good' } }] },
      ].map((s) => ({ ...s, vars: { ...s.vars, price, tariff, duty, total } })),
    };
  }

  // ---------------------------------------------------------------- how much of an advantage came from subsidies
  // roles: r (Readout: 0 total advantage, 1 subsidy share, 2 from subsidies, 3 from everything else), code, formula
  function subsidyShare({ advantage, share }) {
    const part = advantage * share;
    const rest = advantage - part;
    return {
      part, rest,
      trace: [
        { label: 'The cost advantage is {=advantage|comma} per car. {=share|pct} of it came from subsidies.', code: 'inputs', vars: { advantage, share },
          ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: ['item:0', 'item:1'] } }] },
        { label: 'Subsidy part $= {=share|2} \\times {=advantage|comma} = {=part|comma}$.', code: 'part', vars: { part },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:2', tone: 'accent' } }] },
        { label: 'Everything else $= {=advantage|comma} - {=part|comma} = {=rest|comma}$.', code: 'rest', vars: { rest },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:3', tone: 'good' } }] },
      ].map((s) => ({ ...s, vars: { ...s.vars, advantage, share, part, rest } })),
    };
  }

  // ---------------------------------------------------------------- quiz generators
  function compareQ({ rng }) {
    for (;;) {
      const base = rng.pick([20000, 25000, 30000, 40000, 50, 100, 200]);
      const over = rng.pick([0.1, 0.2, 0.25, 0.5, 0.6, 1]);
      const other = base * (1 + over);
      const r = compare({ base, other });
      return {
        vars: {
          base, other, diff: r.diff, pctOver: r.pctOver, pctUnder: r.pctUnder, ratio: r.ratio,
          wrongSwap: (base - other) / base, wrongDivOther: r.diff / other,
        },
        misconceptions: [],
      };
    }
  }

  function growthQ({ rng }) {
    for (;;) {
      const [multiple, years, cagr] = rng.pick([[4, 2, 1], [9, 2, 2], [8, 3, 1], [16, 4, 1], [27, 3, 2], [81, 4, 2]]);
      const start = rng.pick([100, 200, 500, 1000]);
      const end = start * multiple;
      return {
        vars: { start, end, years, multiple, cagr, wrongTotalPct: multiple - 1, wrongPerYearSimple: (multiple - 1) / years, wrongInverse: start / end },
        misconceptions: [],
      };
    }
  }

  function overseasQ({ rng }) {
    for (;;) {
      const total = rng.pick([1000, 2000, 4000, 5000]);
      const share = rng.pick([0.1, 0.2, 0.25]);
      const overseas = total * share;
      const targetShare = rng.pick([0.4, 0.5, 0.6]);
      const r = overseasGap({ total, overseas, targetShare });
      if (r.extra === overseas || r.extra <= 0) continue;
      return {
        vars: { total, overseas, targetShare, share, needed: r.needed, extra: r.extra, wrongTarget: targetShare, wrongNeededOnly: r.needed, wrongInverse: total / overseas },
        misconceptions: [],
      };
    }
  }

  function tariffQ({ rng }) {
    for (;;) {
      const price = rng.pick([10000, 20000, 25000, 30000]);
      const tariff = rng.pick([0.1, 0.25, 0.5, 1]);
      const r = tariffedPrice({ price, tariff });
      return {
        vars: { price, tariff, duty: r.duty, total: r.total, multiple: r.multiple, wrongDutyOnly: r.duty, wrongAddRate: price + tariff },
        misconceptions: [],
      };
    }
  }

  function subsidyQ({ rng }) {
    for (;;) {
      const advantage = rng.pick([2000, 4000, 4700, 5000]);
      const share = rng.pick([0.05, 0.1, 0.2, 0.25]);
      const r = subsidyShare({ advantage, share });
      return {
        vars: { advantage, share, part: r.part, rest: r.rest, wrongShareAsAmount: share * 100, wrongAll: advantage },
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
      compare: sameAnchors(compare), growthRate: sameAnchors(growthRate), overseasGap: sameAnchors(overseasGap),
      tariffedPrice: sameAnchors(tariffedPrice), subsidyShare: sameAnchors(subsidyShare),
    },
    generators: { compareQ, growthQ, overseasQ, tariffQ, subsidyQ },
  };
}
