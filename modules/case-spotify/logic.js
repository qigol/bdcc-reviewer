export default function register(sdk) {
  const YEARS = ['2010', '2011', '2012', '2013'];
  // Exhibit 2a, embedded so quiz generators can draw years from the case's own data.
  const FORMATS = [
    ['CD', 3389, 3101, 2486, 2124], ['CD Single', 3, 4, 3, 2], ['Download Single', 1336, 1522, 1624, 1568],
    ['Download Album', 872, 1071, 1205, 1232], ['Paid Subscriptions', 249, 292, 462, 590],
    ['On-Demand Streaming (Ad Supported)', 212, 248, 400, 693],
  ];

  // ---------------------------------------------------------------- US recorded music revenue by kind of format
  // roles: r (Readout: 0 physical, 1 downloads, 2 streaming, 3 total, 4 streaming share), code, formula
  function formatShares({ table, year }) {
    const c = YEARS.indexOf(String(year)) + 1;
    const rows = table.rows;
    const physical = rows[0][c] + rows[1][c];
    const downloads = rows[2][c] + rows[3][c];
    const streaming = rows[4][c] + rows[5][c];
    const total = physical + downloads + streaming;
    const share = streaming / total;
    return {
      physical, downloads, streaming, total, share, physicalShare: physical / total,
      trace: [
        { label: 'Physical: CD plus CD single $= {=physical|comma}$ million in {=year}.', code: 'physical', vars: { year, physical },
          ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: 'item:0', tone: 'accent' } }] },
        { label: 'Downloads: single plus album $= {=downloads|comma}$ million.', code: 'downloads', vars: { downloads },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:1', tone: 'accent' } }] },
        { label: 'Streaming: paid plus ad-supported $= {=streaming|comma}$ million.', code: 'streaming', vars: { streaming },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:2', tone: 'accent' } }] },
        { label: 'Streaming share $= {=streaming|comma} \\div {=total|comma} = {=share|pct1}$.', code: 'share', vars: { total, share },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: ['item:3', 'item:4'], tone: 'good' } }] },
      ].map((s) => ({ ...s, vars: { ...s.vars, year, physical, downloads, streaming, total, share } })),
    };
  }

  // ---------------------------------------------------------------- percentage change
  // roles: r (Readout: 0 before, 1 after, 2 change, 3 percent change), code, formula
  function growthPct({ before, after }) {
    const change = after - before;
    const pct = change / Math.abs(before);
    return {
      change, pct,
      trace: [
        { label: 'Before: {=before|comma}. After: {=after|comma}.', code: 'inputs', vars: { before, after },
          ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: ['item:0', 'item:1'] } }] },
        { label: 'Change $= {=after|comma} - {=before|comma} = {=change|comma}$.', code: 'change', vars: { change },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:2', tone: 'accent' } }] },
        { label: 'Percent change $= {=change|comma} \\div {=before|comma} = {=pct|pct1}$.', code: 'pct', vars: { pct },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:3', tone: 'good' } }] },
      ].map((s) => ({ ...s, vars: { ...s.vars, before, after, change, pct } })),
    };
  }

  // ---------------------------------------------------------------- a part as a share of a whole
  // roles: r (Readout: 0 part, 1 whole, 2 share), code, formula
  function shareOf({ part, whole }) {
    const share = part / whole;
    return {
      share,
      trace: [
        { label: 'The part is {=part|comma}. The whole is {=whole|comma}.', code: 'inputs', vars: { part, whole },
          ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: ['item:0', 'item:1'] } }] },
        { label: 'Share $= {=part|comma} \\div {=whole|comma} = {=share|pct1}$.', code: 'share', vars: { share },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:2', tone: 'good' } }] },
      ].map((s) => ({ ...s, vars: { ...s.vars, part, whole, share } })),
    };
  }

  // ---------------------------------------------------------------- the royalty chain
  // roles: r (Readout: 0 revenue, 1 paid to rights holders, 2 one rights holder gets, 3 the artist gets), code, formula
  function royaltyPayout({ revenue, payoutRate, streamShare, artistCut }) {
    const pool = revenue * payoutRate;
    const holder = pool * streamShare;
    const artist = holder * artistCut;
    return {
      pool, holder, artist,
      trace: [
        { label: 'Revenue is {=revenue|comma}. About {=payoutRate|pct} goes to rights holders.', code: 'inputs', vars: { revenue, payoutRate },
          ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: 'item:0' } }] },
        { label: 'Pool $= {=payoutRate|2} \\times {=revenue|comma} = {=pool|comma2}$.', code: 'pool', vars: { pool },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:1', tone: 'accent' } }] },
        { label: 'A rights holder with {=streamShare|pct} of streams gets $ {=streamShare|2} \\times {=pool|comma2} = {=holder|comma2}$.', code: 'holder', vars: { holder },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:2', tone: 'accent' } }] },
        { label: 'The artist keeps {=artistCut|pct}: $ {=artistCut|2} \\times {=holder|comma2} = {=artist|comma2}$.', code: 'artist', vars: { artist },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:3', tone: 'good' } }] },
      ].map((s) => ({ ...s, vars: { ...s.vars, revenue, payoutRate, streamShare, artistCut, pool, holder, artist } })),
    };
  }

  // ---------------------------------------------------------------- how many streams make a payout
  // roles: r (Readout: 0 payout, 1 pay per stream, 2 streams), code, formula
  function streamsFor({ payout, perStream }) {
    const streams = payout / perStream;
    return {
      streams,
      trace: [
        { label: 'The payout is {=payout|comma} dollars and each stream pays {=perStream|3} dollars.', code: 'inputs', vars: { payout, perStream },
          ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: ['item:0', 'item:1'] } }] },
        { label: 'Streams $= {=payout|comma} \\div {=perStream|3} = {=streams|comma0}$.', code: 'streams', vars: { streams },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:2', tone: 'good' } }] },
      ].map((s) => ({ ...s, vars: { ...s.vars, payout, perStream, streams } })),
    };
  }

  // ---------------------------------------------------------------- one download against many streams
  // roles: r (Readout: 0 price, 1 label gets, 2 pay per stream, 3 streams to match), code, formula
  function downloadVsStream({ price, retailerCut, perStream }) {
    const net = price * (1 - retailerCut);
    const streams = net / perStream;
    return {
      net, streams,
      trace: [
        { label: 'A song sells for {=price|2} dollars. The retailer keeps {=retailerCut|pct}.', code: 'inputs', vars: { price, retailerCut },
          ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: 'item:0' } }] },
        { label: 'The label gets $ {=price|2} \\times (1 - {=retailerCut|2}) = {=net|3}$.', code: 'net', vars: { net },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:1', tone: 'accent' } }] },
        { label: 'One stream pays {=perStream|3}. It takes $ {=net|3} \\div {=perStream|3} = {=streams|1}$ streams to match one download.', code: 'streams', vars: { streams },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: ['item:2', 'item:3'], tone: 'good' } }] },
      ].map((s) => ({ ...s, vars: { ...s.vars, price, retailerCut, perStream, net, streams } })),
    };
  }

  // ---------------------------------------------------------------- subscription revenue
  // roles: r (Readout: 0 subscribers, 1 monthly price, 2 revenue), code, formula
  function subscriptionRevenue({ subscribers, price, months }) {
    const revenue = subscribers * price * months;
    return {
      revenue,
      trace: [
        { label: '{=subscribers|comma2} million subscribers pay {=price} dollars a month for {=months} months.', code: 'inputs', vars: { subscribers, price, months },
          ops: [{ role: 'r', cmd: 'clear' }, { role: 'r', cmd: 'highlight', args: { sel: ['item:0', 'item:1'] } }] },
        { label: 'Revenue $= {=subscribers|comma2} \\times {=price} \\times {=months} = {=revenue|comma2}$ million dollars.', code: 'revenue', vars: { revenue },
          ops: [{ role: 'r', cmd: 'highlight', args: { sel: 'item:2', tone: 'good' } }] },
      ].map((s) => ({ ...s, vars: { ...s.vars, subscribers, price, months, revenue } })),
    };
  }

  // ---------------------------------------------------------------- quiz generators
  function formatQ({ rng }) {
    for (;;) {
      const year = rng.pick(YEARS);
      const c = YEARS.indexOf(year) + 1;
      const physical = FORMATS[0][c] + FORMATS[1][c];
      const downloads = FORMATS[2][c] + FORMATS[3][c];
      const streaming = FORMATS[4][c] + FORMATS[5][c];
      const total = physical + downloads + streaming;
      return {
        vars: {
          year, physical, downloads, streaming, total, share: streaming / total,
          wrongPaidOnly: FORMATS[4][c] / total, wrongOverPhysical: streaming / physical, wrongCdShare: physical / total,
          paid: FORMATS[4][c], adSupported: FORMATS[5][c],
        },
        misconceptions: [],
      };
    }
  }

  function growthQ({ rng }) {
    for (;;) {
      const before = rng.pick([50, 100, 200, 400, 800]);
      const pct = rng.pick([0.1, 0.25, 0.5, 1, -0.2, -0.5]);
      const after = before * (1 + pct);
      return {
        vars: { before, after, change: after - before, pct, wrongOverAfter: (after - before) / after, wrongRatio: after / before },
        misconceptions: [],
      };
    }
  }

  function shareQ({ rng }) {
    for (;;) {
      const whole = rng.pick([10, 20, 40, 50, 100, 200]);
      const share = rng.pick([0.1, 0.2, 0.25, 0.4]);
      const part = whole * share;
      return {
        vars: { part, whole, share, wrongInverse: whole / part, wrongRest: 1 - share },
        misconceptions: [],
      };
    }
  }

  function royaltyQ({ rng }) {
    for (;;) {
      const revenue = rng.pick([100, 200, 400, 1000]);
      const streamShare = rng.pick([0.02, 0.05, 0.1]);
      const artistCut = rng.pick([0.15, 0.2]);
      const payoutRate = 0.7;
      const r = royaltyPayout({ revenue, payoutRate, streamShare, artistCut });
      return {
        vars: {
          revenue, streamShare, artistCut, payoutRate, pool: r.pool, holder: r.holder, artist: r.artist,
          wrongNoPayout: revenue * streamShare, wrongArtistFull: r.holder, wrongAllRevenue: revenue * artistCut,
        },
        misconceptions: [],
      };
    }
  }

  function streamsQ({ rng }) {
    for (;;) {
      const perStream = rng.pick([0.005, 0.0075, 0.01]);
      const streams = rng.pick([100000, 200000, 400000, 1000000]);
      const payout = streams * perStream;
      return {
        vars: { payout, perStream, streams, wrongMul: payout * perStream, wrongCents: payout / (perStream * 100) },
        misconceptions: [],
      };
    }
  }

  function dlQ({ rng }) {
    for (;;) {
      const price = rng.pick([0.69, 0.99, 1.29]);
      const perStream = rng.pick([0.006, 0.007, 0.008]);
      const retailerCut = 0.3;
      const r = downloadVsStream({ price, retailerCut, perStream });
      return {
        vars: { price, perStream, retailerCut, net: r.net, streams: r.streams, wrongNoCut: price / perStream, retailerShare: price * retailerCut },
        misconceptions: [],
      };
    }
  }

  function subQ({ rng }) {
    for (;;) {
      const subscribers = rng.pick([2, 5, 8, 10, 12.5]);
      const price = rng.pick([4.99, 9.99]);
      const months = rng.pick([3, 6, 12]);
      const revenue = subscribers * price * months;
      return {
        vars: { subscribers, price, months, revenue, wrongNoMonths: subscribers * price, wrongNoSubs: price * months },
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
      formatShares: sameAnchors(formatShares), growthPct: sameAnchors(growthPct), shareOf: sameAnchors(shareOf),
      royaltyPayout: sameAnchors(royaltyPayout), streamsFor: sameAnchors(streamsFor), downloadVsStream: sameAnchors(downloadVsStream),
      subscriptionRevenue: sameAnchors(subscriptionRevenue),
    },
    generators: { formatQ, growthQ, shareQ, royaltyQ, streamsQ, dlQ, subQ },
  };
}
