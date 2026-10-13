// Qdigo module: time-series (ML2, Sessions 10–12)
// The real Mauna Loa CO₂ and Niño 1+2 series are datasets; every score, autocorrelation and forecast below is
// recomputed from them. Synthetic teaching series use a seeded generator, so they are identical on every load.
export default function register(sdk) {
  const { sum, mean, solve } = sdk;

  // ------------------------------------------------------------ helpers
  const dn = (x, d = 3) => {
    if (x === null || x === undefined || !Number.isFinite(x)) return '—';
    const f = Math.pow(10, d);
    let r = Math.round((x + Number.EPSILON * Math.sign(x)) * f) / f;
    if (Object.is(r, -0)) r = 0;
    return String(r);
  };
  const sg = (x, d = 3) => (x >= 0 ? `+${dn(x, d)}` : dn(x, d));
  const START = { y: 1959, m: 1 };
  const label = (i, start = START) => {
    const t = start.y * 12 + (start.m - 1) + i;
    return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
  };
  const idx = (lab, start = START) => {
    const [y, m] = lab.split('-').map(Number);
    return (y * 12 + m - 1) - (start.y * 12 + start.m - 1);
  };
  const xYear = (i, start = START) => start.y + (start.m - 1 + i) / 12;
  const TRAIN_END = '1997-12';
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // seeded PRNG (mulberry32) + Box–Muller, for deterministic synthetic series
  function prng(seed) {
    let a = seed >>> 0;
    const u = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const n = () => { const u1 = Math.max(u(), 1e-12), u2 = u(); return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); };
    return { u, n };
  }

  // ------------------------------------------------------------ 1. structure: trend + season + remainder
  // Series A (level), B (level + trend), C (trend + season): 60 months, the last 12 can be hidden.
  function forecaster({ which = 'A', reveal = false }) {
    if (reveal === 'show') reveal = true; else if (reveal === 'hide') reveal = false;
    const r = prng({ A: 11, B: 22, C: 33 }[which]);
    const y = Array.from({ length: 60 }, (_, t) => {
      const trend = which === 'A' ? 0 : 0.35 * t;
      const season = which === 'C' ? 6 * Math.sin((2 * Math.PI * t) / 12) : 0;
      return 50 + trend + season + 2 * r.n();
    });
    const shown = reveal ? 60 : 48;
    const series = [{ name: 'observed', x: Array.from({ length: shown }, (_, t) => t + 1), y: y.slice(0, shown) }];
    if (!reveal) {
      // An outline box over the hidden months: it marks *where* the gap is without suggesting a level or a direction.
      const obs = y.slice(0, 48);
      const lo = Math.min(...obs), hi = Math.max(...obs), m = 0.25 * (hi - lo);
      series.push({ name: 'hidden months', x: [48.5, 48.5, 60.5, 60.5, 48.5], y: [lo - m, hi + m, hi + m, lo - m, lo - m] });
    }
    return { series, used: { A: 'the typical level', B: 'the direction', C: "the direction and last year's shape" }[which] };
  }

  // mode 'add': y = T + S + R. mode 'multiply': the seasonal swing grows in proportion to the level (T × S style).
  function decompose({ slope = 0.5, amp = 5, noise = 1.5, n = 48, mode = 'add' }) {
    const r = prng(7);
    const T = [], S = [], R = [], y = [];
    for (let t = 0; t < n; t++) {
      T.push(30 + slope * t);
      const s = amp * Math.sin((2 * Math.PI * t) / 12);
      S.push(mode === 'multiply' ? s * (T[t] / 30) : s);
      R.push(noise * r.n());
      y.push(T[t] + S[t] + R[t]);
    }
    const x = Array.from({ length: n }, (_, t) => t + 1);
    return {
      series: [{ name: mode === 'multiply' ? 'y (swing grows with the level)' : 'y = T + S + R', x, y }, { name: 'trend T', x, y: T }, { name: 'seasonal S', x, y: S.map((s) => s + 30) }],
      parts: [{ name: 'remainder R', x, y: R }],
      hasTrend: Math.abs(slope) > 0.05, hasSeason: Math.abs(amp) > 0.5,
    };
  }

  // Classical additive decomposition at one month (2×12 centered moving average, monthly means of the detrended values).
  function trendAt(y, t) {
    if (t < 6 || t + 6 >= y.length) return null;
    let s = 0.5 * y[t - 6] + 0.5 * y[t + 6];
    for (let k = -5; k <= 5; k++) s += y[t + k];
    return s / 12;
  }
  function seasonalComponent(y) {
    const det = y.map((v, t) => { const T = trendAt(y, t); return T === null ? null : v - T; });
    const raw = Array.from({ length: 12 }, (_, m) => mean(det.filter((d, t) => d !== null && t % 12 === m)));
    const c = mean(raw);
    return raw.map((s) => s - c);
  }
  function decomposeAt({ co2, month = '1999-06' }) {
    const t = idx(month);
    const T = trendAt(co2, t);
    const S = seasonalComponent(co2)[t % 12];
    const y = co2[t];
    return { month, y, T, S, R: y - T - S, monthName: MONTHS[t % 12], window: co2.slice(t - 6, t + 7) };
  }

  // anchors: window, trend, detrend, season, rem. roles: parts (Readout)
  function decomposeCode({ co2, month = '1999-06' }) {
    const d = decomposeAt({ co2, month });
    const t = idx(month);
    return {
      R: d.R,
      trace: [
        { label: `13 months centred on ${month}: ${label(t - 6)} … ${label(t + 6)}; the two ends get half weight.`, code: 'window', math: 'window', vars: { y_t: d.y }, ops: [{ role: 'parts', cmd: 'clear' }] },
        { label: `Trend $T_t$ = weighted average $= ${dn(d.T, 3)}$ ppm.`, code: 'trend', math: 'trend', vars: { T: d.T }, ops: [{ role: 'parts', cmd: 'highlight', args: { sel: 'item:1', tone: 'accent' } }] },
        { label: `Every month's detrended value $y - T$ is computed the same way.`, code: 'detrend', math: 'detrend', vars: {}, ops: [] },
        { label: `Seasonal effect of ${d.monthName}: average detrended ${d.monthName}, centred $= ${sg(d.S, 3)}$.`, code: 'season', math: 'season', vars: { S: d.S }, ops: [{ role: 'parts', cmd: 'highlight', args: { sel: 'item:2', tone: 'accent' } }] },
        { label: `Remainder $= ${dn(d.y, 3)} - ${dn(d.T, 3)} - (${dn(d.S, 3)}) = ${dn(d.R, 3)}$.`, code: 'rem', math: 'rem', vars: { R: d.R }, ops: [{ role: 'parts', cmd: 'highlight', args: { sel: 'item:3', tone: 'good' } }] },
      ],
    };
  }

  // ------------------------------------------------------------ 2. lags
  function lagAt({ co2, month, k = 1 }) { const t = idx(month); return { month, k, value: co2[t - k], source: label(t - k), y: co2[t] }; }

  function lagView({ co2, k = 1, from = '1995-01', to = '2001-12' }) {
    const a = idx(from), b = idx(to);
    const xs = [], y = [], yk = [];
    for (let t = a; t <= b; t++) { xs.push(xYear(t)); y.push(co2[t]); yk.push(co2[t - k]); }
    return { series: [{ name: 'y_t', x: xs, y }, { name: `y_(t−${k})`, x: xs, y: yk }], k, peaksAligned: k % 12 === 0 && k > 0 };
  }

  // anchors: shift, lag1, lag12. roles: rows (Matrix)
  function lagCode({ rows }) {
    const recs = rows.rows.map((r) => ({ month: r[0], y: r[1], lag1: r[2], lag12: r[3] }));
    const trace = [{ label: '`shift(k)` moves the column down k rows: row t receives the value from row t − k.', code: 'shift', math: 'shift', vars: {}, ops: [{ role: 'rows', cmd: 'clear' }] }];
    for (const r of recs) {
      trace.push({ label: `${r.month}: $y_{t-1}$ = last month = ${r.lag1}.`, code: 'lag1', math: 'lag1', vars: { t: r.month, lag_1: r.lag1 }, ops: [{ role: 'rows', cmd: 'highlight', args: { sel: `cell:${r.month},lag1`, tone: 'accent' } }] });
      trace.push({ label: `${r.month}: $y_{t-12}$ = same month last year = ${r.lag12}.`, code: 'lag12', math: 'lag12', vars: { t: r.month, lag_12: r.lag12 }, ops: [{ role: 'rows', cmd: 'highlight', args: { sel: `cell:${r.month},lag12`, tone: 'warn' } }] });
    }
    return { trace };
  }

  // A y-only lookup table of monthly CO₂ (one decimal, as on the lecture's table). The lag columns appear only once
  // `reveal` is true, so the scene's lag predicts are answered by counting back rows, not by reading a labelled column.
  function lagLookup({ co2, from = '1998-04', to = '1999-06', reveal = false }) {
    const a = idx(from), b = idx(to);
    const rows = [], values = [];
    // One decimal, rounded the way pandas/NumPy print it: on the exact binary value, ties to even
    // (June 1999 = 370.25 shows as 370.2, matching the lecture table and the lagrows dataset).
    const r1 = (v) => {
      const s = Math.abs(v).toFixed(60), i = s.indexOf('.');
      const down = Number(s.slice(0, i + 2)), rest = s.slice(i + 2);
      const tie = rest[0] === '5' && !/[1-9]/.test(rest.slice(1));
      const up = rest[0] > '5' || (rest[0] === '5' && !tie) || (tie && Number(s[i + 1]) % 2 === 1);
      const r = up ? Math.round((down + 0.1) * 10) / 10 : down;
      return v < 0 ? -r : r;
    };
    for (let t = a; t <= b; t++) {
      rows.push(label(t));
      values.push(reveal ? [r1(co2[t]), r1(co2[t - 1]), r1(co2[t - 12])] : [r1(co2[t])]);
    }
    return { rows, cols: reveal ? ['y', 'lag_1', 'lag_12'] : ['y'], values };
  }

  // A table dataset as a Matrix payload: the first column becomes the row labels.
  function tableMatrix({ table }) {
    return { rows: table.rows.map((r) => String(r[0])), cols: table.columns.slice(1), values: table.rows.map((r) => r.slice(1)) };
  }

  // ------------------------------------------------------------ 3. order is information
  function shuffleOrder({ co2, mode = 'ordered', from = '1995-01', to = '2001-12' }) {
    const a = idx(from), b = idx(to);
    const vals = co2.slice(a, b + 1);
    const n = vals.length;
    // deterministic shuffle (Fisher–Yates with a fixed seed)
    const r = prng(42);
    const order = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(r.u() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const shown = mode === 'shuffled' ? order.map((i) => vals[i]) : vals;
    const xs = vals.map((_, i) => xYear(a + i));
    return { series: [{ name: mode === 'shuffled' ? 'same numbers, rows shuffled' : 'chronological order', x: xs, y: shown }], n, sum: sum(shown), mean: mean(shown), min: Math.min(...shown), max: Math.max(...shown) };
  }

  function chronoSplit({ co2, trainEnd = TRAIN_END }) {
    const e = idx(trainEnd);
    return { train: e + 1, test: co2.length - e - 1, trainFrom: label(0), trainTo: label(e), testFrom: label(e + 1), testTo: label(co2.length - 1), trainMax: Math.max(...co2.slice(0, e + 1)), testAboveMax: co2.slice(e + 1).filter((v) => v > Math.max(...co2.slice(0, e + 1))).length };
  }

  // anchors: cut, train, test. roles: split (Readout)
  function splitCode({ co2, trainEnd = TRAIN_END }) {
    const s = chronoSplit({ co2, trainEnd });
    return {
      ...s,
      trace: [
        { label: `Cut at a date, not at random: everything up to ${trainEnd} is the past.`, code: 'cut', math: 'cut', vars: { cut: trainEnd }, ops: [{ role: 'split', cmd: 'clear' }] },
        { label: `Train: ${s.trainFrom} → ${s.trainTo}, ${s.train} months.`, code: 'train', math: 'train', vars: { train: s.train }, ops: [{ role: 'split', cmd: 'highlight', args: { sel: 'item:0', tone: 'accent' } }] },
        { label: `Test: ${s.testFrom} → ${s.testTo}, ${s.test} months the model never sees.`, code: 'test', math: 'test', vars: { test: s.test }, ops: [{ role: 'split', cmd: 'highlight', args: { sel: 'item:1', tone: 'good' } }] },
      ],
    };
  }

  // ------------------------------------------------------------ 4. stationarity gallery (synthetic, seeded) + ADF
  function gallery({ co2, which = 'noise' }) {
    const r = prng(5);
    const n = 200;
    let y;
    if (which === 'noise') y = Array.from({ length: n }, () => r.n());
    else if (which === 'cycles') {
      // irregular cycles: the period wanders between 8 and 14 steps, amplitude varies
      let ph = 0; y = [];
      for (let t = 0; t < n; t++) { ph += (2 * Math.PI) / (11 + 3 * Math.sin(t / 37)); y.push(70 + (50 + 25 * Math.sin(t / 23)) * Math.sin(ph) + 8 * r.n()); }
    } else if (which === 'co2') y = co2.slice(idx('1990-01'), idx('2001-12') + 1);
    else if (which === 'walk') { let s = 0; y = Array.from({ length: n }, () => (s += r.n())); }
    else if (which === 'shift') y = Array.from({ length: n }, (_, t) => (t < 30 ? 1100 : 850) + 120 * r.n());
    else y = Array.from({ length: n }, (_, t) => (0.3 + (2.5 * t) / n) * r.n());
    const verdict = { noise: 'stationary', cycles: 'stationary', co2: 'not stationary', walk: 'not stationary', shift: 'not stationary', volatility: 'not stationary' }[which];
    const why = {
      noise: 'no drift, steady spread', cycles: 'big swings, but cycles are not of fixed length and the level returns',
      co2: 'trend and seasonality', walk: 'wanders; no level to return to', shift: 'the level shifts part-way through', volatility: 'level is stable, spread is not',
    }[which];
    const half = Math.floor(y.length / 2);
    const m1 = mean(y.slice(0, half)), m2 = mean(y.slice(half));
    const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) ** 2))); };
    return { series: [{ name: which, y }], verdict, why, mean1: m1, mean2: m2, sd1: sd(y.slice(0, half)), sd2: sd(y.slice(half)) };
  }

  function adfDecision({ stat, crit, p, alpha = 0.05 }) {
    const reject = p < alpha;
    return { reject, byStat: stat < crit, consistent: reject === (stat < crit), text: reject ? 'reject H₀: evidence consistent with stationarity' : 'fail to reject H₀: no evidence against a unit root' };
  }

  // runs: optional list of run ids to show (e.g. only the level run before differencing has been taught).
  function adfView({ adf, runs = null }) {
    const rows = adf.rows.map((r) => Object.fromEntries(adf.columns.map((c, i) => [c, r[i]]))).filter((r) => !runs || runs.includes(r.run));
    return {
      table: { rows: rows.map((r) => r.run), cols: ['statistic', '5% critical', 'p-value', 'decision'], values: rows.map((r) => [r.stat, r.crit5, r.p, adfDecision({ stat: r.stat, crit: r.crit5, p: r.p }).reject ? '\\text{reject } H_0' : '\\text{fail to reject}']) },
      rejects: rows.filter((r) => r.p < 0.05).map((r) => r.run),
    };
  }

  // anchors: hyp, stat, pval, decide. roles: adf (Matrix)
  function adfCode({ adf }) {
    const rows = adf.rows.map((r) => Object.fromEntries(adf.columns.map((c, i) => [c, r[i]])));
    const trace = [{ label: 'H₀: unit root (random-walk-like, non-stationary). H₁: no unit root.', code: 'hyp', math: 'hyp', vars: {}, ops: [{ role: 'adf', cmd: 'clear' }] }];
    for (const r of rows) {
      trace.push({ label: `${r.run}: statistic ${r.stat} vs 5% critical value ${r.crit5}.`, code: 'stat', math: 'stat', vars: { stat: r.stat, crit: r.crit5 }, ops: [{ role: 'adf', cmd: 'highlight', args: { sel: `row:${r.run}`, tone: 'accent' } }] });
      trace.push({ label: `p-value ${r.p} ${r.p < 0.05 ? '<' : '≥'} 0.05.`, code: 'pval', math: 'pval', vars: { p: r.p }, ops: [{ role: 'adf', cmd: 'highlight', args: { sel: `cell:${r.run},p-value`, tone: r.p < 0.05 ? 'good' : 'bad' } }] });
      trace.push({ label: r.p < 0.05 ? 'Reject H₀: evidence consistent with stationarity.' : 'Fail to reject H₀ (not proof of non-stationarity).', code: 'decide', math: 'decide', vars: { reject: r.p < 0.05 }, ops: [{ role: 'adf', cmd: 'highlight', args: { sel: `cell:${r.run},decision`, tone: r.p < 0.05 ? 'good' : 'warn' } }] });
    }
    return { trace };
  }

  // ------------------------------------------------------------ 5. differencing
  function difference({ y, lag = 1 }) {
    const d = y.slice(lag).map((v, i) => v - y[i]);
    return { d, n: y.length, nd: d.length, mean: mean(d), lost: lag };
  }

  function annualDiff({ annual, upTo = 99 }) {
    const rows = annual.rows;
    const vals = rows.map((r) => r[1]);
    const d = difference({ y: vals });
    const values = rows.map((r, i) => [r[1], i === 0 ? null : i <= upTo ? d.d[i - 1] : null]);
    return {
      rows: rows.map((r) => String(r[0])), cols: ['value', 'Δy'], values, diffs: d.d, mean: d.mean, n: d.n, nd: d.nd,
      done: Math.min(upTo, d.nd), series: [{ name: 'level y_t', x: rows.map((r) => r[0]), y: vals }],
      diffSeries: [{ name: 'change Δy_t', x: rows.slice(1).map((r) => r[0]), y: d.d }],
    };
  }

  // roles: sheet (Matrix). Patches diffUpTo. One step per difference; the average is left for the learner to work out
  // (the scene asks for it right after the walk), so no step prints it.
  function diffWalk({ annual }) {
    const rows = annual.rows;
    const trace = rows.slice(1).map((r, i) => ({
      label: `${r[0]}: $${r[1]} - ${rows[i][1]} = ${sg(r[1] - rows[i][1], 1)}$`,
      patch: { diffUpTo: i + 1 }, vars: { dy: r[1] - rows[i][1] },
      ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: [`cell:${r[0]},Δy`, `cell:${r[0]},value`, `cell:${rows[i][0]},value`], tone: 'accent' } }],
    }));
    const d = difference({ y: rows.map((r) => r[1]) });
    return { steps: trace.length, mean: d.mean, trace };
  }

  // anchors: lag, sub, lose. roles: sheet (Matrix; its 'Δy' column starts blank and is filled step by step)
  function diffCode({ annual, lag = 1 }) {
    const rows = annual.rows;
    const trace = [{ label: `Pair each value with the one ${lag} step${lag > 1 ? 's' : ''} earlier.`, code: 'lag', math: 'lag', vars: { lag }, ops: [{ role: 'sheet', cmd: 'clear' }] }];
    rows.slice(lag).forEach((r, i) => {
      const dy = r[1] - rows[i][1];
      trace.push({ label: `${r[0]}: $${r[1]} - ${rows[i][1]} = ${sg(dy, 1)}$.`, code: 'sub', math: 'sub', vars: { t: r[0], dy },
        ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: [`cell:${r[0]},value`, `cell:${rows[i][0]},value`], tone: 'accent' } }, { role: 'sheet', cmd: 'fill', args: { cell: `${r[0]},Δy`, value: Math.round(dy * 10) / 10 } }] });
    });
    trace.push({ label: `${rows.length} values in, ${rows.length - lag} changes out: the first ${lag} cannot be differenced.`, code: 'lose', math: 'lose', vars: { n_out: rows.length - lag },
      ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: `row:${rows[0][0]}`, tone: 'bad' } }] });
    return { diffs: difference({ y: rows.map((r) => r[1]), lag }).d, trace };
  }

  function trainDiff({ co2, trainEnd = TRAIN_END, lag = 1 }) {
    const e = idx(trainEnd);
    const tr = co2.slice(0, e + 1);
    const d = difference({ y: tr, lag });
    return { n: tr.length, nd: d.nd, mean: d.mean, series: [{ name: lag === 1 ? 'Δy_t' : `Δ${lag} y_t`, x: d.d.map((_, i) => xYear(i + lag)), y: d.d }] };
  }

  // ------------------------------------------------------------ 6. autocorrelation
  function acf({ y, nlags = 24 }) {
    const n = y.length, m = mean(y);
    const den = sum(y.map((v) => (v - m) ** 2));
    const r = [1];
    for (let k = 1; k <= nlags; k++) {
      let s = 0;
      for (let t = k; t < n; t++) s += (y[t] - m) * (y[t - k] - m);
      r.push(s / den);
    }
    return { r, n, mean: m, den };
  }

  function acfDiff({ co2, trainEnd = TRAIN_END, nlags = 36, lags = [1, 2, 3, 6, 11, 12, 13] }) {
    const e = idx(trainEnd);
    const d = difference({ y: co2.slice(0, e + 1) }).d;
    const a = acf({ y: d, nlags });
    const band = 1.96 / Math.sqrt(d.length);
    return {
      r: a.r, pick: Object.fromEntries(lags.map((k) => [`lag${k}`, a.r[k]])), lag1: a.r[1], lag2: a.r[2], lag12: a.r[12], lag6: a.r[6], band, n: d.length,
      bars: [{ name: 'ACF', x: Array.from({ length: nlags }, (_, i) => i + 1), y: a.r.slice(1) }],
      table: { rows: lags.map((k) => `lag${k}`), cols: ['r_k'], values: lags.map((k) => [a.r[k]]) },
    };
  }

  function pearson(a, b) {
    const ma = mean(a), mb = mean(b);
    const sab = sum(a.map((v, i) => (v - ma) * (b[i] - mb)));
    return sab / Math.sqrt(sum(a.map((v) => (v - ma) ** 2)) * sum(b.map((v) => (v - mb) ** 2)));
  }

  function lagScatter({ y, k = 1 }) {
    const a = y.slice(k), b = y.slice(0, y.length - k);
    return { r: pearson(a, b), k, pairs: a.length, series: [{ name: `lag ${k}`, x: b, y: a }] };
  }

  // anchors: mean, den, num, rk. roles: acf (Matrix)
  function acfCode({ co2, trainEnd = TRAIN_END, lags = [1, 2, 12] }) {
    const e = idx(trainEnd);
    const d = difference({ y: co2.slice(0, e + 1) }).d;
    const a = acf({ y: d, nlags: Math.max(...lags) });
    const trace = [
      { label: `Mean of the ${d.length} monthly changes: $\\bar y = ${dn(a.mean, 4)}$.`, code: 'mean', math: 'mean', vars: { ybar: a.mean }, ops: [{ role: 'acf', cmd: 'clear' }] },
      { label: `Denominator $\\sum (y_t - \\bar y)^2 = ${dn(a.den, 2)}$, shared by every lag.`, code: 'den', math: 'den', vars: { den: a.den }, ops: [] },
    ];
    for (const k of lags) {
      const num = a.r[k] * a.den;
      trace.push({ label: `Lag ${k}: $\\sum_{t} (y_t - \\bar y)(y_{t-${k}} - \\bar y) = ${dn(num, 2)}$ over ${d.length - k} pairs.`, code: 'num', math: 'num', vars: { k, num }, ops: [{ role: 'acf', cmd: 'highlight', args: { sel: `row:lag${k}`, tone: 'accent' } }] });
      trace.push({ label: `$r_{${k}} = ${dn(num, 2)} / ${dn(a.den, 2)} = ${dn(a.r[k], 3)}$.`, code: 'rk', math: 'rk', vars: { r: a.r[k] }, ops: [{ role: 'acf', cmd: 'highlight', args: { sel: `row:lag${k}`, tone: 'good' } }] });
    }
    return { r: lags.map((k) => a.r[k]), trace };
  }

  // Partial autocorrelations from autocorrelations r[0..n] (Durbin–Levinson). Applied to the statsmodels ACF estimator
  // this is statsmodels' pacf(method="ywm"), the method the notebook plots.
  function pacfFromAcf(r, n) {
    const out = [1];
    let phi = [];
    for (let k = 1; k <= n; k++) {
      let num = r[k], den = 1;
      for (let j = 1; j < k; j++) { num -= phi[j - 1] * r[k - j]; den -= phi[j - 1] * r[j]; }
      const pk = num / den;
      const next = [];
      for (let j = 1; j < k; j++) next.push(phi[j - 1] - pk * phi[k - j - 1]);
      next.push(pk);
      phi = next;
      out.push(pk);
    }
    return out;
  }

  // ACF and PACF of the differenced CO₂ training series, side by side (lags 1..nlags).
  function pacfDiff({ co2, trainEnd = TRAIN_END, nlags = 12 }) {
    const e = idx(trainEnd);
    const d = difference({ y: co2.slice(0, e + 1) }).d;
    const a = acf({ y: d, nlags });
    const p = pacfFromAcf(a.r, nlags);
    const ks = Array.from({ length: nlags }, (_, i) => i + 1);
    return {
      r1: a.r[1], r2: a.r[2], p1: p[1], p2: p[2], pacf: p, acf: a.r,
      bars: [{ name: 'ACF', x: ks, y: a.r.slice(1) }, { name: 'PACF', x: ks, y: p.slice(1) }],
      table: { rows: ks.map((k) => `lag${k}`), cols: ['ACF', 'PACF'], values: ks.map((k) => [a.r[k], p[k]]) },
    };
  }

  // anchors: r1, rsq, num, den, p22. roles: pacf (Matrix with rows lag1, lag2)
  function pacfCode({ co2, trainEnd = TRAIN_END }) {
    const v = pacfDiff({ co2, trainEnd, nlags: 2 });
    const { r1, r2 } = v;
    const num = r2 - r1 * r1, den = 1 - r1 * r1;
    return {
      p22: num / den,
      trace: [
        { label: `From the ACF: $r_1 = ${dn(r1, 3)}$, $r_2 = ${dn(r2, 3)}$.`, code: 'r1', math: 'r1', vars: { r1, r2 }, ops: [{ role: 'pacf', cmd: 'clear' }, { role: 'pacf', cmd: 'highlight', args: { sel: 'col:ACF', tone: 'accent' } }] },
        { label: `If lag 2 only echoed lag 1, $r_2$ would be $r_1^2 = ${dn(r1 * r1, 3)}$.`, code: 'rsq', math: 'rsq', vars: { r1sq: r1 * r1 }, ops: [{ role: 'pacf', cmd: 'highlight', args: { sel: 'cell:lag1,ACF', tone: 'accent' } }] },
        { label: `Top: what lag 2 adds beyond that echo, $${dn(r2, 3)} - ${dn(r1 * r1, 3)} = ${dn(num, 3)}$.`, code: 'num', math: 'num', vars: { num }, ops: [{ role: 'pacf', cmd: 'highlight', args: { sel: 'cell:lag2,ACF', tone: 'accent' } }] },
        { label: `Bottom: $1 - r_1^2 = ${dn(den, 3)}$, the part lag 1 does not explain.`, code: 'den', math: 'den', vars: { den }, ops: [] },
        { label: `$\\phi_{22} = ${dn(num, 3)} / ${dn(den, 3)} = ${dn(num / den, 3)}$.`, code: 'p22', math: 'p22', vars: { p22: num / den }, ops: [{ role: 'pacf', cmd: 'highlight', args: { sel: 'cell:lag2,PACF', tone: 'good' } }] },
      ],
    };
  }

  // In-sample residuals of the fitted ARIMA(1,1,1) on the training changes, by running the model's own recursion
  // (ε_t = Δy_t − c − φ(Δy_{t−1} − c) − θ ε_{t−1}, started at 0). Reproduces the notebook's last residual (0.7249) and
  // its residual ACF spike at lag 12 (0.58).
  function residualAcf({ co2, arima, trainEnd = TRAIN_END, nlags = 24 }) {
    const e = idx(trainEnd);
    const d = difference({ y: co2.slice(0, e + 1) }).d;
    const { drift: c, phi, theta } = arima;
    let eps = 0;
    const res = [];
    for (let t = 1; t < d.length; t++) { eps = d[t] - (c + phi * (d[t - 1] - c) + theta * eps); res.push(eps); }
    const a = acf({ y: res, nlags });
    const ks = Array.from({ length: nlags }, (_, i) => i + 1);
    return { lastResid: eps, lag1: a.r[1], lag12: a.r[12], lag24: a.r[24] ?? null, bars: [{ name: 'residual ACF', x: ks, y: a.r.slice(1) }] };
  }

  // Theoretical ACF or PACF of the two textbook processes (beyond the slides).
  // AR(1): ACF fades as φ, φ², φ³…; PACF is φ at lag 1, then 0. MA(1): ACF is θ/(1+θ²) at lag 1, then 0; PACF fades.
  function arMaAcf({ phi = 0.8, theta = 0.8, nlags = 10, kind = 'acf' }) {
    const ks = Array.from({ length: nlags }, (_, i) => i + 1);
    const arAcf = ks.map((k) => phi ** k), maAcf = ks.map((k) => (k === 1 ? theta / (1 + theta * theta) : 0));
    const arPacf = ks.map((k) => (k === 1 ? phi : 0));
    const maPacf = ks.map((k) => (-((-theta) ** k) * (1 - theta * theta)) / (1 - theta ** (2 * (k + 1))));
    const isP = kind === 'pacf';
    return {
      ar: arAcf, ma: maAcf, arPacf, maPacf,
      bars: [
        { name: isP ? 'built from past values: PACF stops after lag 1' : 'built from past values: ACF fades', x: ks, y: isP ? arPacf : arAcf },
        { name: isP ? 'built from past shocks: PACF fades' : 'built from past shocks: ACF stops after lag 1', x: ks, y: isP ? maPacf : maAcf },
      ],
    };
  }

  // ------------------------------------------------------------ 7. baselines and metrics
  function forecastScores({ actual, forecast }) {
    const e = actual.map((a, i) => a - forecast[i]);
    const mae = mean(e.map(Math.abs));
    const rmse = Math.sqrt(mean(e.map((x) => x * x)));
    const mape = (100 * mean(e.map((x, i) => Math.abs(x / actual[i]))));
    return { mae, rmse, mape, n: e.length, errors: e };
  }

  function naive({ co2, trainEnd = TRAIN_END, h = null }) {
    const e = idx(trainEnd);
    const H = h ?? co2.length - e - 1;
    return { forecast: Array(H).fill(co2[e]), last: co2[e], lastLabel: label(e) };
  }
  function seasonalNaive({ co2, trainEnd = TRAIN_END, m = 12, h = null }) {
    const e = idx(trainEnd);
    const H = h ?? co2.length - e - 1;
    const lastYear = co2.slice(e + 1 - m, e + 1);
    return { forecast: Array.from({ length: H }, (_, i) => lastYear[i % m]), lastYear, source: Array.from({ length: H }, (_, i) => label(e + 1 - m + (i % m))) };
  }

  // ARIMA(1,1,1) with drift: multi-step forecasts from the end of training.
  // statsmodels' trend="t" with d = 1 means the differences Δy have mean `drift`, and (Δy − drift) follows ARMA(1,1).
  function arimaForecast({ co2, arima, trainEnd = TRAIN_END, steps = 48 }) {
    const e = idx(trainEnd);
    const { drift: c, phi, theta, lastResid } = arima;
    let prevD = co2[e] - co2[e - 1];
    let level = co2[e];
    const out = [], dHat = [];
    for (let h = 1; h <= steps; h++) {
      const dh = c + phi * (prevD - c) + (h === 1 ? theta * lastResid : 0);
      level += dh;
      out.push(level); dHat.push(dh);
      prevD = dh;
    }
    return { forecast: out, dHat, first3: out.slice(0, 3), lastDiff: co2[e] - co2[e - 1] };
  }

  // The notebook's written equation, with 0.1156 used as the constant: only to show the errata.
  function arimaAsWritten({ co2, arima, trainEnd = TRAIN_END }) {
    const e = idx(trainEnd);
    const dh = arima.drift + arima.phi * (co2[e] - co2[e - 1]) + arima.theta * arima.lastResid;
    const right = arimaForecast({ co2, arima, trainEnd, steps: 1 }).forecast[0];
    return { asWritten: co2[e] + dh, correct: right, constant: arima.drift * (1 - arima.phi) };
  }

  // One-step-ahead ARIMA forecasts over the test months (the fitted model runs through the data, no re-estimation).
  function arimaOneStep({ co2, arima, trainEnd = TRAIN_END }) {
    const e = idx(trainEnd);
    const { drift: c, phi, theta } = arima;
    let eps = arima.lastResid;
    const out = [];
    for (let t = e + 1; t < co2.length; t++) {
      const dh = c + phi * (co2[t - 1] - co2[t - 2] - c) + theta * eps;
      out.push(co2[t - 1] + dh);
      eps = (co2[t] - co2[t - 1]) - dh;
    }
    return { forecast: out };
  }

  function testActual(co2, trainEnd = TRAIN_END) { return co2.slice(idx(trainEnd) + 1); }

  function baselineCompare({ co2, arima, method = 'naive', trainEnd = TRAIN_END }) {
    const act = testActual(co2, trainEnd);
    const e = idx(trainEnd);
    const fc = method === 'naive' ? naive({ co2, trainEnd }).forecast : method === 'seasonal' ? seasonalNaive({ co2, trainEnd }).forecast : arimaForecast({ co2, arima, trainEnd }).forecast;
    const s = forecastScores({ actual: act, forecast: fc });
    const xs = act.map((_, i) => xYear(e + 1 + i));
    const ctx = co2.slice(e - 35, e + 1);
    return {
      ...s, method,
      series: [
        { name: 'train (last 3 years)', x: ctx.map((_, i) => xYear(e - 35 + i)), y: ctx },
        { name: 'actual (test)', x: xs, y: act },
        { name: { naive: 'naive', seasonal: 'seasonal naive', arima: 'ARIMA(1,1,1) with drift' }[method], x: xs, y: fc },
      ],
    };
  }

  function allScores({ co2, arima }) {
    const act = testActual(co2);
    const rows = [
      ['naive', naive({ co2 }).forecast], ['seasonal naive', seasonalNaive({ co2 }).forecast], ['ARIMA multi-step', arimaForecast({ co2, arima }).forecast],
      ['naive one-step', co2.slice(idx(TRAIN_END), co2.length - 1)], ['ARIMA one-step', arimaOneStep({ co2, arima }).forecast],
    ].map(([n, f]) => [n, forecastScores({ actual: act, forecast: f })]);
    const o = Object.fromEntries(rows.map(([n, s]) => [n.replace(/[^a-zA-Z]/g, ''), s]));
    return {
      naive: o.naive, seasonal: o.seasonalnaive, arima: o.ARIMAmultistep, naive1: o.naiveonestep, arima1: o.ARIMAonestep,
      table: { rows: rows.map(([n]) => n.replace(/ /g, '-')), cols: ['MAE', 'RMSE', 'MAPE %'], values: rows.map(([, s]) => [s.mae, s.rmse, s.mape]) },
    };
  }

  // Worksheet: absolute errors of the naive forecast, month by month.
  function maeSheet({ co2, method = 'naive', upTo = 99 }) {
    const act = testActual(co2);
    const fc = method === 'naive' ? naive({ co2 }).forecast : seasonalNaive({ co2 }).forecast;
    const e = idx(TRAIN_END);
    let run = 0;
    const values = act.map((a, i) => {
      if (i >= upTo) return [a, fc[i], null, null];
      run += Math.abs(a - fc[i]);
      return [a, fc[i], Math.abs(a - fc[i]), run];
    });
    const done = Math.min(upTo, act.length);
    return { rows: act.map((_, i) => label(e + 1 + i)), cols: ['actual', 'forecast', '|error|', 'running sum'], values, done, mae: done ? run / done : null };
  }

  // roles: sheet (Matrix). Patches maeUpTo.
  function maeWalk({ co2, method = 'naive' }) {
    const act = testActual(co2);
    const fc = method === 'naive' ? naive({ co2 }).forecast : seasonalNaive({ co2 }).forecast;
    const e = idx(TRAIN_END);
    let run = 0;
    const trace = act.map((a, i) => {
      run += Math.abs(a - fc[i]);
      return { label: `${label(e + 1 + i)}: $|${dn(a, 3)} - ${dn(fc[i], 3)}| = ${dn(Math.abs(a - fc[i]), 3)}$; sum ${dn(run, 2)}`, patch: { maeUpTo: i + 1 }, vars: { err: Math.abs(a - fc[i]), sum: run },
        ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: `row:${label(e + 1 + i)}`, tone: 'accent' } }] };
    });
    trace.push({ label: `MAE $= ${dn(run, 2)} / ${act.length} = ${dn(run / act.length, 3)}$ ppm.`, patch: { maeUpTo: act.length }, vars: { mae: run / act.length },
      ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: 'col:|error|', tone: 'good' } }] });
    return { steps: trace.length, mae: run / act.length, trace };
  }

  // anchors: err, abs, sq, pct, avg. roles: test (Matrix)
  function metricsCode({ co2, method = 'naive', show = 4 }) {
    const act = testActual(co2);
    const fc = method === 'naive' ? naive({ co2 }).forecast : seasonalNaive({ co2 }).forecast;
    const e = idx(TRAIN_END);
    const trace = [];
    for (let i = 0; i < show; i++) {
      const err = act[i] - fc[i];
      const lab = label(e + 1 + i);
      trace.push({ label: `${lab}: error $= ${dn(act[i], 3)} - ${dn(fc[i], 3)} = ${dn(err, 3)}$.`, code: 'err', math: 'err', vars: { t: lab, e: err }, ops: [{ role: 'test', cmd: 'highlight', args: { sel: `row:${lab}`, tone: 'accent' } }] });
      trace.push({ label: `$|e| = ${dn(Math.abs(err), 3)}$.`, code: 'abs', math: 'abs', vars: { abs_e: Math.abs(err) }, ops: [{ role: 'test', cmd: 'annotate', args: { sel: `cell:${lab},forecast`, text: `|e| ${dn(Math.abs(err), 2)}` } }] });
      trace.push({ label: `$e^2 = ${dn(err * err, 3)}$.`, code: 'sq', math: 'sq', vars: { e2: err * err }, ops: [] });
      trace.push({ label: `$|e/y| = ${dn(Math.abs(err / act[i]) * 100, 3)}\\%$.`, code: 'pct', math: 'pct', vars: { pct: Math.abs(err / act[i]) * 100 }, ops: [] });
    }
    const s = forecastScores({ actual: act, forecast: fc });
    trace.push({ label: `… all ${act.length} months, then average: MAE ${dn(s.mae, 3)}, RMSE ${dn(s.rmse, 3)}, MAPE ${dn(s.mape, 3)}%.`, code: 'avg', math: 'avg', vars: { mae: s.mae, rmse: s.rmse, mape: s.mape },
      ops: [{ role: 'test', cmd: 'highlight', args: { sel: 'col:actual', tone: 'good' } }] });
    return { ...s, trace };
  }

  function testTable({ co2, method = 'naive', n = 12 }) {
    const act = testActual(co2);
    const fc = method === 'naive' ? naive({ co2 }).forecast : seasonalNaive({ co2 }).forecast;
    const e = idx(TRAIN_END);
    return { rows: act.slice(0, n).map((_, i) => label(e + 1 + i)), cols: ['actual', 'forecast'], values: act.slice(0, n).map((a, i) => [a, fc[i]]) };
  }

  // anchors: last, naive, season, copy. roles: fc (Matrix)
  function baselineCode({ co2, trainEnd = TRAIN_END, show = 14 }) {
    const e = idx(trainEnd);
    const sn = seasonalNaive({ co2, trainEnd });
    const trace = [{ label: `Last training value: ${label(e)} = ${co2[e]}.`, code: 'last', math: 'last', vars: { y_T: co2[e] }, ops: [{ role: 'fc', cmd: 'clear' }] }];
    trace.push({ label: `Naive: every future month = ${co2[e]}, a horizontal line.`, code: 'naive', math: 'naive', vars: { naive: co2[e] }, ops: [{ role: 'fc', cmd: 'highlight', args: { sel: 'col:naive', tone: 'accent' } }] });
    trace.push({ label: `Seasonal naive: keep the last 12 training months, ${label(e - 11)} … ${label(e)}.`, code: 'season', math: 'season', vars: { m: 12 }, ops: [] });
    for (let i = 0; i < show; i++) {
      const lab = label(e + 1 + i);
      trace.push({ label: `${lab}: $i = ${i}$, $i \\bmod 12 = ${i % 12}$ → copy ${sn.source[i]} = ${dn(sn.forecast[i], 3)}.`, code: 'copy', math: 'copy', vars: { i, src: sn.source[i], value: sn.forecast[i] },
        ops: [{ role: 'fc', cmd: 'highlight', args: { sel: `cell:${lab},seasonal`, tone: 'good' } }] });
    }
    return { trace };
  }

  function baselineTable({ co2, arima, n = 14 }) {
    const e = idx(TRAIN_END);
    const nv = naive({ co2 }).forecast, sn = seasonalNaive({ co2 });
    const act = testActual(co2);
    return { rows: act.slice(0, n).map((_, i) => label(e + 1 + i)), cols: ['actual', 'naive', 'seasonal', 'source'], values: act.slice(0, n).map((a, i) => [a, nv[i], sn.forecast[i], `\\text{${sn.source[i]}}`]) };
  }

  // ------------------------------------------------------------ 8. ARIMA
  // anchors: diff, ar, ma, drift, undiff. roles: fc (Matrix)
  function arimaCode({ co2, arima, steps = 3 }) {
    const e = idx(TRAIN_END);
    const { drift: c, phi, theta, lastResid } = arima;
    const trace = [];
    let prevD = co2[e] - co2[e - 1];
    let level = co2[e];
    trace.push({ label: `Last change $\\Delta y_T = ${co2[e]} - ${co2[e - 1]} = ${dn(prevD, 3)}$; last shock $\\varepsilon_T = ${dn(lastResid, 3)}$.`, code: 'diff', math: 'diff', vars: { dy_T: prevD, eps_T: lastResid }, ops: [{ role: 'fc', cmd: 'clear' }] });
    for (let h = 1; h <= steps; h++) {
      const lab = label(e + h);
      trace.push({ label: `${lab}: drift ${dn(c, 4)} is the long-run average change.`, code: 'drift', math: 'drift', vars: { c }, ops: [{ role: 'fc', cmd: 'highlight', args: { sel: `row:${lab}`, tone: 'accent' } }] });
      const arPart = phi * (prevD - c);
      trace.push({ label: `AR: $${dn(phi, 4)} \\times (${dn(prevD, 3)} - ${dn(c, 4)}) = ${sg(arPart, 4)}$.`, code: 'ar', math: 'ar', vars: { ar: arPart }, ops: [] });
      const maPart = h === 1 ? theta * lastResid : 0;
      trace.push({ label: h === 1 ? `MA: $${dn(theta, 4)} \\times ${dn(lastResid, 3)} = ${sg(maPart, 4)}$.` : 'MA: future shocks are unknown, so their forecast is 0.', code: 'ma', math: 'ma', vars: { ma: maPart }, ops: [] });
      const dh = c + arPart + maPart;
      level += dh;
      trace.push({ label: `$\\hat y = ${dn(level - dh, 3)} + ${dn(dh, 4)} = ${dn(level, 2)}$.`, code: 'undiff', math: 'undiff', vars: { dy_hat: dh, y_hat: level },
        ops: [{ role: 'fc', cmd: 'fill', args: { cell: `${lab},forecast`, value: level } }, { role: 'fc', cmd: 'highlight', args: { sel: `cell:${lab},forecast`, tone: 'good' } }] });
      prevD = dh;
    }
    return { forecast: arimaForecast({ co2, arima, steps }).forecast, trace };
  }

  function arimaTable({ co2, arima, n = 6, blank = false }) {
    const e = idx(TRAIN_END);
    const f = arimaForecast({ co2, arima, steps: n }).forecast;
    const act = testActual(co2);
    return { rows: f.map((_, i) => label(e + 1 + i)), cols: ['actual', 'forecast'], values: f.map((v, i) => [act[i], blank ? null : v]) };
  }

  // roles: fc (Matrix). Patches arUpTo.
  function arimaWalk({ co2, arima }) {
    const e = idx(TRAIN_END);
    const { drift: c, phi, theta, lastResid } = arima;
    let prevD = co2[e] - co2[e - 1];
    let level = co2[e];
    const trace = [];
    for (let h = 1; h <= 3; h++) {
      const ma = h === 1 ? theta * lastResid : 0;
      const dh = c + phi * (prevD - c) + ma;
      trace.push({ label: `${label(e + h)}: $\\Delta\\hat y = ${dn(c, 4)} + ${dn(phi, 4)}(${dn(prevD, 3)} - ${dn(c, 4)})${h === 1 ? ` + ${dn(theta, 4)}(${dn(lastResid, 3)})` : ''} = ${dn(dh, 3)}$ → $${dn(level + dh, 2)}$`,
        patch: { arUpTo: h }, vars: { dy: dh, y: level + dh }, ops: [{ role: 'fc', cmd: 'highlight', args: { sel: `row:${label(e + h)}`, tone: 'accent' } }] });
      level += dh; prevD = dh;
    }
    return { steps: trace.length, trace };
  }

  function arimaScene({ co2, arima, upTo = 0 }) {
    const e = idx(TRAIN_END);
    const f = arimaForecast({ co2, arima, steps: 48 }).forecast;
    const act = testActual(co2);
    const xs = act.map((_, i) => xYear(e + 1 + i));
    const ctx = co2.slice(e - 35, e + 1);
    return {
      table: { rows: [1, 2, 3].map((h) => label(e + h)), cols: ['actual', 'ARIMA forecast'], values: [0, 1, 2].map((i) => [act[i], i < upTo ? f[i] : null]) },
      series: [{ name: 'train (last 3 years)', x: ctx.map((_, i) => xYear(e - 35 + i)), y: ctx }, { name: 'actual (test)', x: xs, y: act }, { name: 'ARIMA(1,1,1) with drift', x: xs, y: f }],
    };
  }

  // ------------------------------------------------------------ 9. lag features and linear regression
  function buildFeatures(co2) {
    const rows = [];
    for (let t = 0; t < co2.length; t++) {
      const r = { t, label: label(t), y: co2[t], month: (t % 12) + 1 };
      for (let k = 1; k <= 12; k++) r[`lag_${k}`] = t - k >= 0 ? co2[t - k] : null;
      r.roll_mean_3 = t >= 3 ? (co2[t - 1] + co2[t - 2] + co2[t - 3]) / 3 : null;
      r.roll_mean_3_leaky = t >= 2 ? (co2[t] + co2[t - 1] + co2[t - 2]) / 3 : null;
      for (let m = 2; m <= 12; m++) r[`month_${m}`] = r.month === m ? 1 : 0;
      rows.push(r);
    }
    return rows;
  }
  const SCEN = {
    lag1: ['lag_1'],
    A: ['lag_1', 'lag_2', 'lag_12', 'roll_mean_3'],
    B: ['lag_1', 'lag_2', 'lag_12', 'roll_mean_3', ...Array.from({ length: 11 }, (_, i) => `month_${i + 2}`)],
    C: [...Array.from({ length: 12 }, (_, i) => `lag_${i + 1}`), 'roll_mean_3', ...Array.from({ length: 11 }, (_, i) => `month_${i + 2}`)],
    leaky: ['lag_1', 'lag_2', 'lag_12', 'roll_mean_3_leaky', ...Array.from({ length: 11 }, (_, i) => `month_${i + 2}`)],
  };

  // OLS with an intercept, solved on centred features (normal equations), as LinearRegression does.
  function ols(X, y) {
    const p = X[0].length, n = X.length;
    const mx = Array.from({ length: p }, (_, j) => mean(X.map((r) => r[j])));
    const my = mean(y);
    const A = Array.from({ length: p }, () => Array(p).fill(0));
    const b = Array(p).fill(0);
    for (let i = 0; i < n; i++) {
      const xc = X[i].map((v, j) => v - mx[j]);
      const yc = y[i] - my;
      for (let j = 0; j < p; j++) { b[j] += xc[j] * yc; for (let k = j; k < p; k++) A[j][k] += xc[j] * xc[k]; }
    }
    for (let j = 0; j < p; j++) for (let k = 0; k < j; k++) A[j][k] = A[k][j];
    const w = solve(A, b);
    return { w, b0: my - sum(w.map((v, j) => v * mx[j])) };
  }

  function lrScenario({ co2, scenario = 'B' }) {
    const cols = SCEN[scenario];
    const rows = buildFeatures(co2).filter((r) => r.t >= 12);
    const e = idx(TRAIN_END);
    const tr = rows.filter((r) => r.t <= e), te = rows.filter((r) => r.t > e);
    const fit = ols(tr.map((r) => cols.map((c) => r[c])), tr.map((r) => r.y));
    const pred = te.map((r) => fit.b0 + sum(cols.map((c, j) => fit.w[j] * r[c])));
    const s = forecastScores({ actual: te.map((r) => r.y), forecast: pred });
    const coef = Object.fromEntries(cols.slice(0, 4).map((c, j) => [c, fit.w[j]]));
    return { scenario, nFeatures: cols.length, trainRows: tr.length, testRows: te.length, ...s, coef, coefList: cols.slice(0, 4).map((c, j) => `${c}: ${dn(fit.w[j], 4)}`).join(', '), intercept: fit.b0, forecast: pred,
      lag1Coef: fit.w[0] };
  }

  function featureSheet({ co2, upTo = 99, n = 14 }) {
    const rows = buildFeatures(co2).slice(0, n);
    const values = rows.map((r, i) => (i < upTo ? [r.y, r.lag_1, r.lag_2, r.roll_mean_3, r.roll_mean_3_leaky] : [r.y, null, null, null, null]));
    return { rows: rows.map((r) => r.label), cols: ['co2', 'lag_1', 'lag_2', 'roll_mean_3', 'leaky'], values, done: Math.min(upTo, n) };
  }

  // roles: sheet (Matrix). Patches featUpTo.
  function featureWalk({ co2, n = 6 }) {
    const rows = buildFeatures(co2).slice(0, n);
    const trace = rows.map((r, i) => {
      const parts = [];
      parts.push(r.lag_1 === null ? 'no lag_1 yet' : `lag_1 = ${dn(r.lag_1, 2)}`);
      if (r.roll_mean_3 !== null) parts.push(`roll = $(${dn(co2[r.t - 1], 2)} + ${dn(co2[r.t - 2], 2)} + ${dn(co2[r.t - 3], 2)})/3 = ${dn(r.roll_mean_3, 3)}$`);
      return { label: `${r.label}: ${parts.join('; ')}`, patch: { featUpTo: i + 1 }, vars: { lag_1: r.lag_1, roll_mean_3: r.roll_mean_3 },
        ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: `row:${r.label}`, tone: 'accent' } }] };
    });
    const r = rows[3];
    trace.push({ label: `Leaky in ${r.label}: $(${dn(co2[3], 2)} + ${dn(co2[2], 2)} + ${dn(co2[1], 2)})/3 = ${dn(r.roll_mean_3_leaky, 3)}$ includes the target itself.`, patch: { featUpTo: n }, vars: { leaky: r.roll_mean_3_leaky },
      ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: `cell:${r.label},leaky`, tone: 'bad' } }] });
    return { steps: trace.length, trace };
  }

  // anchors: lags, roll, month, drop, split, fit. roles: feats (Matrix)
  function featuresCode({ co2 }) {
    const rows = buildFeatures(co2);
    const r = rows[12];
    const e = idx(TRAIN_END);
    const lr = lrScenario({ co2, scenario: 'B' });
    return {
      mae: lr.mae,
      trace: [
        { label: `Lags: row ${r.label} gets lag_1 = ${dn(r.lag_1, 3)} (${label(11)}) … lag_12 = ${dn(r.lag_12, 3)} (${label(0)}).`, code: 'lags', math: 'lags', vars: { lag_1: r.lag_1, lag_12: r.lag_12 }, ops: [{ role: 'feats', cmd: 'highlight', args: { sel: 'col:lag_1', tone: 'accent' } }] },
        { label: `shift(1) **then** rolling(3): ${label(3)} averages ${label(0)}–${label(2)} = ${dn(rows[3].roll_mean_3, 3)}.`, code: 'roll', math: 'roll', vars: { roll_mean_3: rows[3].roll_mean_3 }, ops: [{ role: 'feats', cmd: 'highlight', args: { sel: 'col:roll_mean_3', tone: 'accent' } }] },
        { label: 'Month as 11 one-hot columns (January is the reference).', code: 'month', math: 'month', vars: { columns: 11 }, ops: [] },
        { label: `Drop the 12 rows with missing lags: ${co2.length} → ${co2.length - 12}; first usable ${label(12)}.`, code: 'drop', math: 'drop', vars: { rows: co2.length - 12 }, ops: [{ role: 'feats', cmd: 'highlight', args: { sel: 'row:1959-01', tone: 'bad' } }] },
        { label: `Split by date: ${lr.trainRows} training rows (to ${label(e)}), ${lr.testRows} test rows.`, code: 'split', math: 'split', vars: { train: lr.trainRows, test: lr.testRows }, ops: [] },
        { label: `Fit, predict one step ahead: scenario B MAE = ${dn(lr.mae, 3)} ppm.`, code: 'fit', math: 'fit', vars: { mae: lr.mae }, ops: [] },
      ],
    };
  }

  function scenarioTable({ co2 }) {
    const names = ['lag1', 'A', 'B', 'C'];
    const res = names.map((s) => lrScenario({ co2, scenario: s }));
    return { rows: names.map((s) => `LR-${s}`), cols: ['features', 'MAE', 'RMSE', 'MAPE %'], values: res.map((r) => [r.nFeatures, r.mae, r.rmse, r.mape]) };
  }

  function scenarioView({ co2, arima, scenario = 'A' }) {
    const lr = lrScenario({ co2, scenario });
    const e = idx(TRAIN_END);
    const act = testActual(co2);
    const xs = act.map((_, i) => xYear(e + 1 + i));
    return { ...lr, series: [{ name: 'actual (test)', x: xs, y: act }, { name: `LR ${scenario} (one-step)`, x: xs, y: lr.forecast }, { name: 'ARIMA one-step', x: xs, y: arimaOneStep({ co2, arima }).forecast }] };
  }


  // ------------------------------------------------------------ application: a short monthly series
  const COOP = { y: 2022, m: 1 };
  function appView({ y, trainN = 28 }) {
    const xs = y.map((_, i) => xYear(i, COOP));
    return {
      series: [{ name: 'train', x: xs.slice(0, trainN), y: y.slice(0, trainN) }, { name: 'test (held out)', x: xs.slice(trainN), y: y.slice(trainN) }],
      trainFrom: label(0, COOP), trainTo: label(trainN - 1, COOP), testFrom: label(trainN, COOP), testTo: label(y.length - 1, COOP), train: trainN, test: y.length - trainN,
    };
  }
  function appBaselines({ y, trainN = 28, method = 'naive' }) {
    const act = y.slice(trainN);
    const last = y[trainN - 1];
    const lastYear = y.slice(trainN - 12, trainN);
    const fc = method === 'naive' ? act.map(() => last) : act.map((_, i) => lastYear[i % 12]);
    const s = forecastScores({ actual: act, forecast: fc });
    const xs = act.map((_, i) => xYear(trainN + i, COOP));
    return { ...s, series: [{ name: 'train', x: y.slice(0, trainN).map((_, i) => xYear(i, COOP)), y: y.slice(0, trainN) }, { name: 'actual', x: xs, y: act }, { name: method === 'naive' ? 'naive' : 'seasonal naive', x: xs, y: fc }] };
  }
  function appAcf({ y, trainN = 28, lag = 1 }) {
    const d = difference({ y: y.slice(0, trainN), lag }).d;
    const a = acf({ y: d, nlags: 12 });
    return { r1: a.r[1], r12: a.r[12], n: d.length, bars: [{ name: lag === 1 ? 'ACF of Δy' : 'ACF of Δ12 y', x: Array.from({ length: 12 }, (_, i) => i + 1), y: a.r.slice(1) }], diffSeries: [{ name: lag === 1 ? 'Δy' : 'Δ12 y', x: d.map((_, i) => xYear(i + lag, COOP)), y: d }] };
  }
  // One-step regression on lag features, trained on the rows that have every lag.
  function appLR({ y, trainN = 28, features = 'lag1+lag12' }) {
    const sets = { lag1: [1], lag12: [12], 'lag1+lag12': [1, 12], leaky: ['leaky', 1, 2] };
    const cols = sets[features];
    const maxLag = Math.max(...cols.filter((c) => typeof c === 'number'));
    const feat = (t) => cols.map((c) => (c === 'leaky' ? (y[t] + y[t - 1] + y[t - 2]) / 3 : y[t - c]));
    const trRows = [];
    for (let t = maxLag; t < trainN; t++) trRows.push(t);
    const fit = ols(trRows.map(feat), trRows.map((t) => y[t]));
    const te = []; for (let t = trainN; t < y.length; t++) te.push(t);
    const pred = te.map((t) => fit.b0 + sum(feat(t).map((v, j) => v * fit.w[j])));
    const s = forecastScores({ actual: te.map((t) => y[t]), forecast: pred });
    const xs = te.map((t) => xYear(t, COOP));
    return { ...s, trainRows: trRows.length, coef: fit.w, intercept: fit.b0, series: [{ name: 'actual', x: xs, y: te.map((t) => y[t]) }, { name: `LR (${features}), one-step`, x: xs, y: pred }] };
  }
  function appNaive1({ y, trainN = 28 }) {
    const act = y.slice(trainN);
    return forecastScores({ actual: act, forecast: y.slice(trainN - 1, y.length - 1) });
  }

  // ------------------------------------------------------------ generators
  function lagQ({ rng, difficulty }) {
    for (;;) {
      const freq = difficulty === 1 ? 'monthly' : rng.pick(['monthly', 'quarterly', 'daily']);
      const per = { monthly: 12, quarterly: 4, daily: 7 }[freq];
      const n = per + 3;
      const base = rng.int(200, 400);
      const vals = Array.from({ length: n }, (_, i) => base + rng.int(-5, 5) + i);
      const k = difficulty === 1 ? rng.pick([1, 2, 3]) : rng.pick([1, per, per - 1, 2]);
      if (k >= n - 1) continue;
      const t = n - 1;
      const value = vals[t - k], wrongForward = vals[t - k + 1], wrongOff = vals[t - k - 1];
      // the two off-by-one rows must differ from the answer, or the misconception can never be told apart
      if (wrongForward === value || wrongOff === value) continue;
      const rows = vals.map((_, i) => `t${i - t === 0 ? '' : i - t}`);
      return { vars: { freq, per, k, vals, value, wrongForward, wrongOff, yt: vals[t],
        table: { rows: vals.map((_, i) => (i === t ? 't' : `t-${t - i}`)), cols: ['y'], values: vals.map((v) => [v]) }, rowsLabel: rows.join(',') } };
    }
  }

  function diffQ({ rng, difficulty }) {
    for (;;) {
      const n = difficulty === 3 ? 16 : 6;
      const lag = difficulty === 3 ? 12 : 1;
      const vals = Array.from({ length: n }, (_, i) => +(300 + 0.7 * i + rng.int(-6, 6) / 10 + (lag === 12 ? 3 * Math.sin((2 * Math.PI * i) / 12) : 0)).toFixed(1));
      const d = difference({ y: vals, lag }).d;
      const pick = d.length - 1;
      return { vars: { vals, lag, n, nd: d.length, dLast: d[pick], meanD: mean(d), wrongRev: -d[pick], wrongN: n, valsList: vals.join(', '),
        table: { rows: vals.map((_, i) => `t${i + 1}`), cols: ['y'], values: vals.map((v) => [v]) }, last: vals[n - 1], prev: vals[n - 1 - lag] } };
    }
  }

  function naiveQ({ rng, difficulty }) {
    const months = MONTHS;
    for (;;) {
      const last12 = Array.from({ length: 12 }, () => +(360 + rng.int(-40, 40) / 10).toFixed(1));
      const h = difficulty === 1 ? rng.int(1, 12) : rng.int(13, 30);
      const target = (h - 1) % 12;
      const sn = last12[target];
      const nv = last12[11];
      const wrongShift = last12[h % 12];
      if (sn === nv || wrongShift === sn) continue;
      return { vars: { last12, h, sn, nv, targetMonth: months[target], wrongShift, years: Math.floor((h - 1) / 12), table: { rows: months.map((m) => `${m}-97`), cols: ['y'], values: last12.map((v) => [v]) } } };
    }
  }

  function metricsQ({ rng, difficulty }) {
    for (;;) {
      const n = difficulty === 1 ? 3 : 4;
      const act = Array.from({ length: n }, () => rng.int(90, 130));
      const fc = act.map((a) => a + rng.pick([-6, -4, -3, -2, 2, 3, 4, 5, 8]));
      const s = forecastScores({ actual: act, forecast: fc });
      const me = mean(act.map((a, i) => a - fc[i]));
      const wrongMapeByF = 100 * mean(act.map((a, i) => Math.abs((a - fc[i]) / fc[i])));
      if (Math.abs(me) < 0.2 || Math.abs(s.mae - s.rmse) < 0.2) continue;
      // values near 100 make MAE and MAPE (%) almost equal; keep every warned-against value clear of each answer
      if (Math.abs(s.mae - s.mape) < 0.03 || Math.abs(wrongMapeByF - s.mape) < 0.03 || Math.abs(s.rmse - s.mape) < 0.03) continue;
      return { vars: { act, fc, mae: s.mae, rmse: s.rmse, mape: s.mape, me, mse: s.rmse ** 2, errors: s.errors, table: { rows: act.map((_, i) => `m${i + 1}`), cols: ['actual', 'forecast'], values: act.map((a, i) => [a, fc[i]]) }, wrongMapeByF } };
    }
  }

  function acfQ({ rng, difficulty }) {
    for (;;) {
      const n = difficulty === 1 ? 5 : 6;
      const y = Array.from({ length: n }, () => rng.int(1, 9));
      const a = acf({ y, nlags: 2 });
      if (a.den === 0 || Math.abs(a.r[1]) < 0.05) continue;
      if (Math.abs(a.mean - Math.round(a.mean)) > 1e-9) continue;
      const pr = pearson(y.slice(1), y.slice(0, n - 1));
      const num1 = a.r[1] * a.den;
      if (Math.abs(pr - a.r[1]) < 0.02) continue;
      return { vars: { y, n, mean: a.mean, den: a.den, num1, r1: a.r[1], r2: a.r[2], wrongPearson: pr, yList: y.join(', ') } };
    }
  }

  function arimaQ({ rng, difficulty }) {
    for (;;) {
      const c = rng.int(5, 20) / 100, phi = rng.int(3, 8) / 10, theta = rng.int(2, 6) / 10;
      const y1 = rng.int(3500, 3700) / 10, dy = rng.int(-15, 25) / 10, eps = rng.int(-10, 10) / 10;
      const y0 = +(y1 - dy).toFixed(1);
      const dh = c + phi * (dy - c) + theta * eps;
      const yhat = y1 + dh;
      const wrongNoC = y1 + phi * dy + theta * eps;                 // drift left out entirely
      const wrongAsWritten = y1 + c + phi * dy + theta * eps;       // c used as a plain constant (the notebook's written form)
      const wrongLevel = c + phi * (dy - c) + theta * eps;          // the change, not added back to the last value
      const wrongNoMa = y1 + c + phi * (dy - c);                   // surprise term dropped at step 1
      const dh2 = c + phi * (dh - c);
      const wrongKeepMa = yhat + dh2 + theta * eps;                 // surprise term kept at step 2
      const far = (a) => Math.abs(a - yhat) >= 0.03;
      if (!far(wrongNoC) || !far(wrongAsWritten) || !far(wrongNoMa) || Math.abs(wrongKeepMa - (yhat + dh2)) < 0.03) continue;
      return { vars: { c, phi, theta, y1, y0, dy, eps, dh, yhat, yhat2: yhat + dh2, dh2, wrongNoC, wrongAsWritten, wrongLevel, wrongNoMa, wrongKeepMa } };
    }
  }

  function adfQ({ rng, difficulty }) {
    const crit = rng.pick([-2.868, -2.87, -3.42, -2.89]);
    const reject = rng.bool(0.5);
    // p follows the statistic: just past the cut-off gives p just under 0.05, far past it a tiny p; just short of the
    // cut-off gives p a little above 0.05, far above it p near 1. (Pairs like "statistic barely above, p = 0.9989" are
    // impossible for a real ADF test.)
    const off = reject ? rng.int(5, 200) / 100 : rng.int(10, 500) / 100;
    const stat = +(reject ? crit - off : crit + off).toFixed(3);
    const p = reject ? (off < 0.3 ? 0.031 : off < 0.8 ? 0.012 : off < 1.4 ? 0.003 : 0.0006)
      : (off < 0.6 ? 0.08 : off < 1.5 ? 0.21 : off < 3 ? 0.51 : 0.9989);
    return {
      vars: { stat, crit, p, reject },
      options: ['Reject H₀: the data give evidence that the series is stationary', 'Fail to reject H₀: the data give no evidence against a random walk', 'Reject H₀: the test proves that the series is stationary', 'Fail to reject H₀: the test proves the series is a random walk'],
      answer: reject ? 0 : 1,
    };
  }

  function rollQ({ rng, difficulty }) {
    for (;;) {
      const vals = Array.from({ length: 5 }, () => +(310 + rng.int(0, 80) / 10).toFixed(1));
      const t = 4;
      const ok = (vals[t - 1] + vals[t - 2] + vals[t - 3]) / 3;
      const leaky = (vals[t] + vals[t - 1] + vals[t - 2]) / 3;
      if (Math.abs(ok - leaky) < 0.05) continue;
      return { vars: { vals, roll: ok, leaky, valsList: vals.join(', '), table: { rows: ['t1', 't2', 't3', 't4', 't5'], cols: ['y'], values: vals.map((v) => [v]) }, wrongFour: (vals[1] + vals[2] + vals[3] + vals[4]) / 4 } };
    }
  }

  function pacfQ({ rng, difficulty }) {
    for (;;) {
      const r1 = rng.int(3, 9) / 10, r2 = rng.int(0, 8) / 10;
      // A real stationary series needs r2 ≥ 2·r1² − 1 (otherwise |φ22| > 1 is impossible, e.g. r1 = 0.9, r2 = 0.1).
      if (r2 < 2 * r1 * r1 - 1) continue;
      const p2 = (r2 - r1 * r1) / (1 - r1 * r1);
      if (Math.abs(p2) >= 1) continue;
      if (Math.abs(p2 - r2) < 0.03 || Math.abs(p2 - (r2 - r1 * r1)) < 0.03) continue;
      return { vars: { r1, r2, p2, wrongR2: r2, wrongNoDen: r2 - r1 * r1 } };
    }
  }

  // A short new quarterly series: the last training year and the next four quarters. Used for one-step vs
  // multi-step naive scores and for naive vs seasonal naive on the same hidden quarters.
  function horizonQ({ rng, difficulty }) {
    const Q = ['Q1', 'Q2', 'Q3', 'Q4'];
    for (;;) {
      // sometimes the yearly growth beats the seasonal swing (naive wins), sometimes the swing dominates (seasonal naive wins)
      const big = rng.bool(0.5);
      const base = rng.int(40, 80), growth = big ? rng.int(10, 16) : rng.int(1, 4);
      const amp = big ? 1 : 2;
      const swing = [rng.int(-3, -1) * amp, rng.int(0, 2) * amp, rng.int(2, 4) * amp, rng.int(-2, 0) * amp];
      const val = (yr, q) => base + growth * (4 * yr + q) / 4 + swing[q] + rng.int(-1, 1);
      const train = Q.map((_, q) => Math.round(val(0, q)));
      const test = Q.map((_, q) => Math.round(val(1, q)));
      const last = train[3];
      const multi = test.map(() => last);
      const one = test.map((_, i) => (i === 0 ? last : test[i - 1]));
      const sn = train.slice();
      const mae = (f) => forecastScores({ actual: test, forecast: f }).mae;
      const maeMulti = mae(multi), maeOne = mae(one), maeSn = mae(sn);
      const vals = [maeMulti, maeOne, maeSn];
      if (new Set(test).size < 3 || maeMulti === maeOne) continue;
      if (Math.abs(maeMulti - maeOne) < 0.5 || Math.abs(maeMulti - maeSn) < 0.5) continue;
      if (Math.abs(maeOne - maeSn) < 0.5 || vals.some((v) => v === 0)) continue;
      return {
        vars: {
          train, test, last, maeMulti, maeOne, maeSn,
          snWins: maeSn < maeMulti ? 'seasonal naive' : 'naive',
          table: { rows: ['Q1-train', 'Q2-train', 'Q3-train', 'Q4-train', 'Q1-test', 'Q2-test', 'Q3-test', 'Q4-test'], cols: ['sales'], values: [...train, ...test].map((v) => [v]) },
          testList: test.join(', '), trainList: train.join(', '),
          oneList: one.join(', '),
        },
      };
    }
  }

  // A short monthly series that keeps climbing: the last training month and the next five months. Multi-step naive
  // repeats the last training value for all five; one-step naive repeats each month's real predecessor.
  function stepQ({ rng, difficulty }) {
    for (;;) {
      const last = rng.int(200, 400), g = rng.int(1, 3);
      const test = Array.from({ length: 5 }, (_, i) => last + g * (i + 1) + rng.int(-1, 1));
      if (test.some((v, i) => v === (i === 0 ? last : test[i - 1]))) continue;
      const one = test.map((_, i) => (i === 0 ? last : test[i - 1]));
      const sc = (f) => forecastScores({ actual: test, forecast: f });
      const maeMulti = sc(test.map(() => last)).mae, maeOne = sc(one).mae;
      const meOne = mean(test.map((a, i) => a - one[i]));
      const wrongSumMulti = sum(test.map((a) => Math.abs(a - last)));
      if (Math.abs(maeMulti - maeOne) < 0.5 || Math.abs(meOne - maeOne) < 0.03) continue;
      return {
        vars: {
          last, test, maeMulti, maeOne, meOne, wrongSumMulti, ratio: maeMulti / maeOne, testList: test.join(', '), oneList: one.join(', '),
          table: { rows: ['last-train', 'h1', 'h2', 'h3', 'h4', 'h5'], cols: ['value'], values: [last, ...test].map((v) => [v]) },
        },
      };
    }
  }

  // ------------------------------------------------------------ level-3 transfer generators (new series, not CO₂)

  // Reading p and q off a new set of sample ACF/PACF values (lags 1–5). The pattern is drawn from AR(1), AR(2), MA(1),
  // ARMA(1,1) or a not-yet-stationary series; values are the model's theoretical ones plus a little sampling noise.
  function pqQ({ rng, difficulty }) {
    const L = 5;
    const noise = () => rng.int(-3, 3) / 100;
    const r2 = (v) => Math.round(v * 100) / 100;
    for (;;) {
      const kind = rng.pick(['ar1', 'ar2', 'ma1', 'arma', 'nonstat']);
      const r = [1];
      if (kind === 'ar1') {
        const phi = rng.pick([-1, 1]) * rng.int(55, 80) / 100;
        for (let k = 1; k <= L; k++) r.push(phi ** k);
      } else if (kind === 'ar2') {
        const p1 = rng.int(20, 60) / 100, p2 = rng.pick([-1, 1]) * rng.int(35, 50) / 100;
        if (p1 + p2 >= 0.95 || p2 - p1 >= 0.95) continue;
        r.push(p1 / (1 - p2));
        for (let k = 2; k <= L; k++) r.push(p1 * r[k - 1] + p2 * r[k - 2]);
      } else if (kind === 'ma1') {
        const th = rng.pick([-1, 1]) * rng.int(55, 90) / 100;
        for (let k = 1; k <= L; k++) r.push(k === 1 ? th / (1 + th * th) : 0);
      } else if (kind === 'arma') {
        const phi = rng.int(50, 75) / 100, th = rng.int(30, 60) / 100;
        r.push(((1 + phi * th) * (phi + th)) / (1 + 2 * phi * th + th * th));
        for (let k = 2; k <= L; k++) r.push(phi * r[k - 1]);
      } else {
        const a = rng.int(2, 4) / 100;
        for (let k = 1; k <= L; k++) r.push(1 - a * k);
      }
      const pTrue = pacfFromAcf(r, L);
      // a random walk's sample PACF: one big bar at lag 1, then nothing
      if (kind === 'nonstat') for (let k = 2; k <= L; k++) pTrue[k] = 0;
      const pacfV0 = pTrue.slice(1).map((v) => r2(v + noise()));
      const pacfV = pacfV0.map((v) => Math.max(-0.99, Math.min(0.99, v)));
      const acfV = r.slice(1).map((v) => r2(v + noise()));
      // the pattern must be readable: cut-offs near 0, fades clearly non-zero for a few lags
      const small = (a, from) => a.slice(from).every((v) => Math.abs(v) <= 0.06);
      const fades = (a) => Math.abs(a[1]) >= 0.12 && Math.abs(a[2]) >= 0.1;   // a gap above the ±0.06 "nothing" band
      const ok = {
        ar1: small(pacfV, 1) && fades(acfV) && Math.abs(acfV[4]) < 0.5,
        ar2: small(pacfV, 2) && Math.abs(pacfV[1]) >= 0.3 && fades(acfV),
        ma1: small(acfV, 1) && Math.abs(acfV[0]) >= 0.35 && fades(pacfV),
        arma: fades(acfV) && fades(pacfV) && Math.abs(acfV[4]) < 0.5,
        nonstat: acfV[4] >= 0.75 && small(pacfV, 1),
      }[kind];
      if (!ok) continue;
      const answer = { ar1: 0, ar2: 1, ma1: 2, arma: 3, nonstat: 4 }[kind];
      return {
        vars: { kind, acf: acfV, pacf: pacfV, table: { rows: ['lag 1', 'lag 2', 'lag 3', 'lag 4', 'lag 5'], cols: ['ACF', 'PACF'], values: acfV.map((v, i) => [v, pacfV[i]]) } },
        options: ['AR(1): p = 1, q = 0', 'AR(2): p = 2, q = 0', 'MA(1): p = 0, q = 1', 'ARMA(1,1): p = 1, q = 1', 'Difference first: not stationary yet'],
        answer,
      };
    }
  }

  // Seasonal difference on a new monthly series (15 months: a full year plus Jan–Mar), then a forecast for April that
  // adds the average yearly change back to April a year earlier.
  function seasonQ({ rng, difficulty }) {
    for (;;) {
      const base = rng.int(150, 300), g = rng.int(3, 8) / 10, amp = rng.int(30, 60) / 10;
      const y = Array.from({ length: 15 }, (_, t) => +(base + g * t + amp * Math.sin((2 * Math.PI * (t - 2)) / 12) + rng.int(-4, 4) / 10).toFixed(1));
      const d12 = difference({ y, lag: 12 }).d;
      const d1 = difference({ y }).d;
      const mD = mean(d12);
      const fc = y[3] + mD;
      const dLast = d12[2];
      const wrongLast = y[14] + mD, wrongSn = y[3], wrongSum = sum(d12), wrongD1 = d1[d1.length - 1];
      const far = (a, b) => Math.abs(a - b) >= 0.05;
      if (!far(wrongLast, fc) || !far(wrongSn, fc) || !far(wrongD1, dLast) || !far(-dLast, dLast) || !far(wrongSum, mD)) continue;
      const names = [...MONTHS, 'Jan', 'Feb', 'Mar'].map((m, i) => `${m}-${i < 12 ? 1 : 2}`);
      return {
        vars: { y, d12, mD, fc, nd: d12.length, aprPrev: y[3], marNow: y[14], marPrev: y[2], dLast, d12List: d12.map((v) => dn(v, 2)).join(', '),
          table: { rows: names, cols: ['GWh'], values: y.map((v) => [v]) } },
        misconceptions: [
          { value: 14, feedback: 'That is the count for a first difference (n − 1). A seasonal difference loses the first 12 values.', for: 'nd' },
          { value: 15, feedback: 'The first 12 months have no value a year earlier, so they give no seasonal difference.', for: 'nd' },
          { value: wrongD1, feedback: 'That is March minus February, a first difference. Δ12 compares March with March a year earlier.', for: 'dLast' },
          { value: -dLast, feedback: 'Later minus earlier: Δ12 y_t = y_t − y_(t−12).', for: 'dLast' },
          { value: wrongSum, feedback: 'That is the total of the three changes. Divide by 3 for the average.', for: 'mD' },
          { value: wrongLast, feedback: 'A yearly change is added to the same month last year (April), not to the latest month (March).', for: 'fc' },
          { value: wrongSn, feedback: 'That is the plain seasonal naive forecast. Add the average yearly change to bring it up to this year.', for: 'fc' },
        ],
      };
    }
  }

  // A fitted ARIMA(1,1,0) or ARIMA(0,1,1) with drift on a new weekly series: forecast three steps. Same recipe as the
  // lesson's ARIMA(1,1,1), with the missing part left out.
  function arimaTQ({ rng, difficulty }) {
    for (;;) {
      const order = rng.pick(['110', '011']);
      const c = rng.int(3, 15) / 10;
      const phi = order === '110' ? rng.int(3, 7) / 10 : 0, theta = order === '011' ? rng.int(3, 7) / 10 : 0;
      const y1 = rng.int(1200, 2500) / 10, dy = rng.int(-30, 40) / 10, eps = order === '011' ? rng.int(-20, 20) / 10 : 0;
      const y0 = +(y1 - dy).toFixed(1);
      const step = (last, e) => c + phi * (last - c) + theta * e;
      const dh1 = step(dy, eps), dh2 = step(dh1, 0), dh3 = step(dh2, 0);
      const f1 = y1 + dh1, f2 = f1 + dh2, f3 = f2 + dh3;
      const wrongNoC = order === '110' ? phi * dy : theta * eps;   // drift left out entirely
      const wrongNoDrift = phi * (dy - c) + theta * eps;            // c subtracted inside but never added back
      const wrongStale2 = f1 + step(dy, eps);                       // step 2 reuses the real last change (and surprise)
      const wrongStraight3 = y1 + 3 * dh1;                          // the step-1 change repeated every step
      const far = (a, b) => Math.abs(a - b) >= 0.03;
      if (!far(wrongNoC, dh1) || !far(wrongNoDrift, dh1) || !far(dh1, f1) || !far(wrongStale2, f2) || !far(wrongStraight3, f3)) continue;
      if (Math.abs(dy) < 0.1) continue;
      const modelText = order === '110'
        ? `ARIMA(1,1,0) with drift: average change c = ${c}, φ = ${phi} (no MA part)`
        : `ARIMA(0,1,1) with drift: average change c = ${c}, θ = ${theta} (no AR part); the last surprise was ε = ${eps}`;
      const misc0 = [
        { value: wrongNoC, feedback: 'The drift c is missing: the forecast change starts from c.', for: 'dh1' },
        { value: wrongNoDrift, feedback: 'You left out the drift c itself; add it to the rest of the change.', for: 'dh1' },
        { value: dh1, feedback: 'That is the forecast **change**. Add it to the last value.', for: 'f1' },
        { value: wrongStale2, feedback: order === '110' ? 'Step 2 builds on the step-1 forecast change, not the real last change again.' : 'From step 2 on the next surprise is unknown and set to 0, so the change is just c.', for: 'f2' },
        { value: wrongStraight3, feedback: 'The change is not repeated unchanged: each step recomputes it from the one before.', for: 'f3' },
      ];
      // with φ = 0 the two drift mistakes give the same number: keep the first
      const misc = misc0.filter((m, i) => !misc0.slice(0, i).some((o) => o.for === m.for && Math.abs(o.value - m.value) < 1e-9));
      return { vars: { order, c, phi, theta, y0, y1, dy, eps, dh1, dh2, dh3, f1, f2, f3, modelText }, misconceptions: misc };
    }
  }

  // One row of lag features for a new monthly series (Jan year 1 to Feb year 2), then the regression forecast for
  // February of year 2 from given weights.
  function featQ({ rng, difficulty }) {
    for (;;) {
      const base = rng.int(40, 70);
      const y = Array.from({ length: 14 }, (_, t) => base + Math.round(0.5 * t + 6 * Math.sin((2 * Math.PI * t) / 12)) + rng.int(-2, 2));
      const t = 13;
      const lag1 = y[t - 1], lag12 = y[t - 12], roll = (y[t - 1] + y[t - 2] + y[t - 3]) / 3, leaky = (y[t] + y[t - 1] + y[t - 2]) / 3;
      const b0 = rng.int(1, 5), w1 = rng.pick([0.4, 0.5]), w12 = rng.pick([0.2, 0.3]), w3 = Math.round((1 - w1 - w12) * 10) / 10;
      const fc = b0 + w1 * lag1 + w12 * lag12 + w3 * roll;
      const wrongLeaky = b0 + w1 * lag1 + w12 * lag12 + w3 * leaky, wrongNoB0 = fc - b0;
      const far = (a, b) => Math.abs(a - b) >= 0.05;
      if (lag1 === lag12 || !far(leaky, roll) || !far(y[t - 11], lag12) || !far(y[t], lag12) || !far(y[t], lag1) || !far(y[t - 2], lag1) || !far(wrongLeaky, fc)) continue;
      const names = MONTHS.map((m) => `${m}-1`).concat(['Jan-2', 'Feb-2']);
      return {
        vars: { y, lag1, lag12, roll, leaky, b0, w1, w12, w3, fc, actual: y[t],
          table: { rows: names, cols: ['sales'], values: y.map((v) => [v]) } },
        misconceptions: [
          { value: y[t], feedback: 'That is February itself, the month being forecast. lag_1 is the month before it.', for: 'lag1' },
          { value: y[t - 2], feedback: 'Count one step back from February: lag_1 is January.', for: 'lag1' },
          { value: y[t - 11], feedback: 'That is 11 steps back. lag_12 is February of the year before.', for: 'lag12' },
          { value: y[t], feedback: 'lag_12 is the same month **last** year, not this February.', for: 'lag12' },
          { value: leaky, feedback: 'That window includes February, the month being predicted (leakage). Shift first: average Nov, Dec and Jan.', for: 'roll' },
          { value: wrongLeaky, feedback: 'You used the leaky rolling mean, which contains February itself.', for: 'fc' },
          { value: wrongNoB0, feedback: 'Add the intercept as well as the weighted columns.', for: 'fc' },
        ],
      };
    }
  }

  return {
    fns: {
      forecaster, tableMatrix, decompose, decomposeAt, decomposeCode, lagAt, lagView, lagLookup, lagCode, shuffleOrder, chronoSplit, splitCode,
      gallery, adfDecision, adfView, adfCode, difference, annualDiff, diffWalk, diffCode, trainDiff,
      acf, acfDiff, pacfDiff, pacfCode, residualAcf, lagScatter, acfCode, arMaAcf, forecastScores, naive, seasonalNaive, arimaForecast, arimaAsWritten, arimaOneStep,
      baselineCompare, allScores, maeSheet, maeWalk, metricsCode, testTable, baselineCode, baselineTable,
      arimaCode, arimaTable, arimaWalk, arimaScene, lrScenario, featureSheet, appView, appBaselines, appAcf, appLR, appNaive1, featureWalk, featuresCode, scenarioTable, scenarioView,
    },
    generators: { lagQ, diffQ, naiveQ, metricsQ, acfQ, arimaQ, adfQ, rollQ, pacfQ, horizonQ, stepQ, pqQ, seasonQ, arimaTQ, featQ },
  };
}
