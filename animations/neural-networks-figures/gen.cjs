// Figure generator for modules/neural-networks/assets (run: node gen.cjs <assetsDir> [--preview <dir>])
const fs = require('fs');
const path = require('path');
const OUT = process.argv[2];
const PREV = process.argv.indexOf('--preview') > 0 ? process.argv[process.argv.indexOf('--preview') + 1] : null;
const FONT = "Inter, 'Segoe UI', Helvetica, Arial, sans-serif";
// Manim / 3Blue1Brown look, matching animations/kit/manim.js: black card, thin bright strokes on dark tinted fills.
// Blue = weights, teal = hidden units, yellow = output, red = loss, orange = gradients (the backward pass).
const BG = '#000000', CARD_LINE = '#2a2a33', TAG_BG = '#0a0a0e', TAG_LINE = '#3a3a46';
const C = {
  in: ['#17171d', '#ececec'], hid: ['#0d2622', '#5cd0b3'], out: ['#2b2608', '#ffe066'], loss: ['#2d1210', '#fc6255'],
  off: ['#16161a', '#6b6b76'], sum: ['#2b1a08', '#ff862f'],
  edge: '#8a8a96', w: '#58c4dd', back: '#ff862f', fwd: '#83c167', ink: '#ececec', mute: '#9a9aa6',
};

function rich(s, size) {
  const d = Math.round(size * 0.28);
  let out = '', i = 0;
  while (i < s.length) {
    if (s[i] === '_' && s[i + 1] === '{') {
      const j = s.indexOf('}', i);
      out += `<tspan dy="${d}" font-size="70%">${s.slice(i + 2, j)}</tspan><tspan dy="-${d}"> </tspan>`;
      i = j + 1;
    } else {
      out += s[i] === '&' ? '&amp;' : s[i] === '<' ? '&lt;' : s[i];
      i++;
    }
  }
  return out;
}
const text = (x, y, s, { size = 22, color = C.ink, weight = 500, anchor = 'middle', italic = false } = {}) =>
  `<text x="${x}" y="${(y + size * 0.35).toFixed(1)}" font-size="${size}" fill="${color}" font-weight="${weight}" text-anchor="${anchor}"${italic ? ' font-style="italic"' : ''}>${rich(s, size)}</text>`;
const plainLen = s => s.replace(/_\{([^}]*)\}/g, '$1').length;
function tag(x, y, lines, { size = 20, color = C.w, border = TAG_LINE, bg = TAG_BG, minW = 0 } = {}) {
  const arr = (Array.isArray(lines) ? lines : [lines]).map(l => (typeof l === 'string' ? { t: l } : l));
  const w = Math.max(minW, ...arr.map(l => plainLen(l.t) * size * 0.56 + 24));
  const h = arr.length * (size + 10) + 10;
  let s = `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="9" fill="${bg}" stroke="${border}" stroke-width="1.5"/>`;
  arr.forEach((l, k) => {
    s += text(x, y - h / 2 + 5 + (size + 10) * (k + 0.5), l.t, { size, color: l.c ?? color, weight: l.w ?? 600 });
  });
  return s;
}
function node(x, y, sym, kind, sub, r = 50) {
  const [f, s] = C[kind];
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}" stroke="${s}" stroke-width="3.5"/>` +
    text(x, sub ? y - 9 : y, sym, { size: 30, color: s, weight: 700 }) +
    (sub ? text(x, y + 22, sub, { size: 15, color: s, weight: 700 }) : '');
}
function box(x, y, w, h, kind, sym, sub) {
  const [f, s] = C[kind];
  return `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="14" fill="${f}" stroke="${s}" stroke-width="3.5"/>` +
    text(x, sub ? y - 11 : y, sym, { size: 30, color: s, weight: 700 }) +
    (sub ? text(x, y + 20, sub, { size: 15, color: s, weight: 700 }) : '');
}
function arrow(x1, y1, x2, y2, r1, r2, color = C.edge, width = 3) {
  const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy);
  const ax = x1 + dx / d * r1, ay = y1 + dy / d * r1, bx = x2 - dx / d * (r2 + 4), by = y2 - dy / d * (r2 + 4);
  return `<line x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" stroke="${color}" stroke-width="${width}" marker-end="url(#ah-${color.slice(1)})"/>`;
}
const markers = cols => [...new Set(cols)].map(c => `<marker id="ah-${c.slice(1)}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${c}"/></marker>`).join('');
function svg(w, h, body, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="${FONT}" role="img" aria-label="${title}">
<title>${title}</title>
<defs>${markers([C.edge, C.back, C.fwd, C.w, C.off[1], C.sum[1], C.hid[1]])}</defs>
<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="18" fill="${BG}" stroke="${CARD_LINE}" stroke-width="2"/>
${body}
</svg>\n`;
}
const fmt = v => String(Object.is(v, -0) ? 0 : v).replace('-', '−');

// ---------------------------------------------------------------- 2–2–1 networks (mode: params | forward | backward)
// Drawn for a ~700 px stage: 960-wide canvas, 22–24 px labels.
function net221(p, mode, title, extra = {}) {
  const W = 960, H = 640;
  const X1 = [100, 240], X2 = [100, 480], H1 = [420, 240], H2 = [420, 480], O = [700, 360], LB = [878, 360];
  const off2 = extra.dead2 && mode !== 'params';
  const g = extra.grads || {}, f = extra.fwd || {};
  const back = mode === 'backward';
  const S = 23;
  let b = '';
  b += text(X1[0], 40, 'inputs', { size: 21, color: C.in[1], weight: 700 });
  b += text(H1[0], 40, 'hidden layer (ReLU)', { size: 21, color: C.hid[1], weight: 700 });
  b += text(O[0], 40, 'output', { size: 21, color: C.out[1], weight: 700 });
  b += text(LB[0], 40, 'loss', { size: 21, color: C.loss[1], weight: 700 });
  const e2 = off2 ? C.off[1] : C.edge;
  b += arrow(...X1, ...H1, 48, 48) + arrow(...X2, ...H1, 48, 48) + arrow(...X1, ...H2, 48, 48, e2) + arrow(...X2, ...H2, 48, 48, e2);
  b += arrow(...H1, ...O, 48, 48) + arrow(...H2, ...O, 48, 48, e2) + arrow(O[0], O[1], LB[0] - 56, LB[1], 48, 0);
  b += node(...X1, 'x_{1}', 'in', null, 48) + node(...X2, 'x_{2}', 'in', null, 48);
  b += node(...H1, 'h_{1}', 'hid', null, 48) + node(...H2, 'h_{2}', off2 ? 'off' : 'hid', off2 ? 'off' : null, 48);
  b += node(...O, 'ŷ', 'out', null, 48);
  b += box(LB[0], LB[1], 112, 84, 'loss', 'L');
  b += tag(X1[0], X1[1] + 76, 'x_{1} = ' + fmt(p.x1), { size: S, color: C.in[1] });
  b += tag(X2[0], X2[1] + 76, 'x_{2} = ' + fmt(p.x2), { size: S, color: C.in[1] });
  b += tag(LB[0], LB[1] + 80, 'y = ' + fmt(p.y), { size: S, color: C.loss[1], border: '#8a2f28' });
  b += text(LB[0], LB[1] + 122, '(target)', { size: 17, color: C.loss[1], weight: 600 });
  // one tag per parameter: its value (params / forward) or its loss gradient (backward)
  const pt = (name, sym, x, y, border = TAG_LINE) => tag(x, y,
    back ? { t: '∂L/∂' + sym + ' = ' + fmt(g[name]), c: C.back } : { t: sym + ' = ' + fmt(p[name]), c: C.w },
    { size: back ? 21 : S, border: back ? '#8a4a14' : border, bg: back ? '#1f1405' : TAG_BG });
  const on = (from, to, t, dy) => [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t + dy];
  b += pt('w11', 'w_{11}', ...on(X1, H1, 0.5, -30));
  b += pt('w22', 'w_{22}', ...on(X2, H2, 0.5, 30));
  b += pt('w21', 'w_{21}', ...on(X2, H1, 0.62, 0));
  b += pt('w12', 'w_{12}', ...on(X1, H2, 0.62, 0));
  b += pt('v1', 'v_{1}', ...on(H1, O, back ? 0.54 : 0.5, back ? -48 : -34));
  b += pt('v2', 'v_{2}', ...on(H2, O, 0.5, back ? 48 : 34));
  b += pt('b1', 'b_{1}', H1[0], H1[1] - 84, '#2d6f60');
  b += pt('b2', 'b_{2}', H2[0], H2[1] + 84, '#2d6f60');
  b += pt('c', 'c', back ? O[0] + 56 : O[0], O[1] - 84, '#2d6f60');
  if (mode === 'forward') {
    const fc = { size: S, color: C.fwd, border: '#3f7a30', bg: '#0b1608' };
    b += tag(606, H1[1] - 96, ['z_{1} = ' + fmt(f.z1), 'a_{1} = ' + fmt(f.a1)], fc);
    b += tag(606, H2[1] + 96, ['z_{2} = ' + fmt(f.z2), 'a_{2} = ' + fmt(f.a2)], fc);
    b += tag(O[0], O[1] + 80, 'ŷ = ' + fmt(f.yh), fc);
    b += tag(LB[0], LB[1] - 84, 'L = ' + fmt(f.L), { ...fc, color: C.loss[1], border: '#8a2f28', bg: '#1c0d0c' });
    b += text(W - 24, H - 30, 'forward pass →', { size: 21, color: C.fwd, weight: 700, anchor: 'end' });
  }
  if (back) {
    const bc = { size: S, color: C.back, border: '#8a4a14', bg: '#1f1405' };
    b += tag(612, H1[1] - 100, ['∂L/∂a_{1} = ' + fmt(f.da1), '∂L/∂z_{1} = ' + fmt(f.dz1)], bc);
    b += tag(612, H2[1] + 100, ['∂L/∂a_{2} = ' + fmt(f.da2), '∂L/∂z_{2} = ' + fmt(f.dz2)], bc);
    b += tag(O[0] + 32, O[1] + 80, '∂L/∂ŷ = ' + fmt(f.dy), bc);
    b += text(W - 24, H - 30, '← backward pass', { size: 21, color: C.back, weight: 700, anchor: 'end' });
  }
  return svg(W, H, b, title);
}

// ---------------------------------------------------------------- one neuron (lecture example, z left as ?)
function neuron() {
  const W = 960, H = 500, S = 24;
  const Sg = [500, 270];
  const ins = [['x_{1} = 2', 'w_{1} = 0.5', 120], ['x_{2} = 1', 'w_{2} = −1', 270], ['x_{3} = 3', 'w_{3} = 0.25', 420]];
  let b = '';
  b += text(100, 40, 'inputs', { size: 21, color: C.in[1], weight: 700 });
  b += text(300, 40, 'weights', { size: 21, color: C.w, weight: 700 });
  for (const [x, w, y] of ins) {
    b += '<rect x="30" y="' + (y - 32) + '" width="150" height="64" rx="12" fill="' + C.in[0] + '" stroke="' + C.in[1] + '" stroke-width="3"/>';
    b += text(105, y, x, { size: 26, color: C.in[1], weight: 700 });
    b += arrow(180, y, Sg[0], Sg[1], 0, 62, C.w, 3);
    const t = 0.45, lx = 180 + (Sg[0] - 180) * t, ly = y + (Sg[1] - y) * t;
    b += tag(lx, ly + (y < Sg[1] ? -28 : y > Sg[1] ? 28 : -28), w, { size: S });
  }
  b += '<circle cx="' + Sg[0] + '" cy="' + Sg[1] + '" r="62" fill="' + C.sum[0] + '" stroke="' + C.sum[1] + '" stroke-width="3.5"/>' + text(Sg[0], Sg[1] - 2, 'Σ', { size: 46, color: C.sum[1], weight: 700 });
  b += text(Sg[0], Sg[1] + 92, 'weighted sum', { size: 20, color: C.sum[1], weight: 700 });
  b += tag(Sg[0], 74, 'bias b = 0.1', { size: S, color: C.hid[1], border: '#2d6f60' });
  b += '<line x1="' + Sg[0] + '" y1="98" x2="' + Sg[0] + '" y2="' + (Sg[1] - 68) + '" stroke="' + C.hid[1] + '" stroke-width="3" marker-end="url(#ah-' + C.hid[1].slice(1) + ')"/>';
  b += arrow(Sg[0] + 62, Sg[1], 640, Sg[1], 0, 0, C.edge, 3);
  b += tag(690, Sg[1], 'z = ?', { size: 26, color: C.sum[1], border: '#8a4a14', bg: '#1f1405', minW: 96 });
  b += arrow(740, Sg[1], 778, Sg[1], 0, 0, C.edge, 3);
  b += box(860, Sg[1], 150, 96, 'out', 'a = g(z)', 'activation');
  return svg(W, H, b, 'One artificial neuron: three inputs times their weights, plus a bias, give the sum z; the activation g turns z into the output a');
}

// ---------------------------------------------------------------- XOR with one hidden layer (step units)
function xorNet() {
  const W = 960, H = 560, S = 23;
  const X1 = [100, 180], X2 = [100, 410], H1 = [430, 180], H2 = [430, 410], Y = [780, 295];
  let b = '';
  b += text(100, 36, 'inputs', { size: 21, color: C.in[1], weight: 700 });
  b += text(430, 36, 'hidden layer (step)', { size: 21, color: C.hid[1], weight: 700 });
  b += text(780, 36, 'output (step)', { size: 21, color: C.out[1], weight: 700 });
  b += arrow(...X1, ...H1, 48, 52) + arrow(...X2, ...H1, 48, 52) + arrow(...X1, ...H2, 48, 52) + arrow(...X2, ...H2, 48, 52);
  b += arrow(...H1, ...Y, 52, 52) + arrow(...H2, ...Y, 52, 52);
  b += node(...X1, 'x_{1}', 'in', null, 48) + node(...X2, 'x_{2}', 'in', null, 48);
  b += node(...H1, 'h_{1}', 'hid', 'OR', 52) + node(...H2, 'h_{2}', 'hid', 'AND', 52) + node(...Y, 'y', 'out', 'XOR', 52);
  const lt = (from, to, t, dy, s) => tag(from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t + dy, s, { size: S });
  b += lt(X1, H1, 0.5, -26, '1') + lt(X2, H2, 0.5, 26, '1') + lt(X2, H1, 0.66, 0, '1') + lt(X1, H2, 0.66, 0, '1');
  b += lt(H1, Y, 0.5, -30, '+1') + lt(H2, Y, 0.5, 30, '−1');
  b += tag(430, H1[1] - 90, 'fires if x_{1} + x_{2} − 0.5 > 0', { size: 21, color: C.hid[1], border: '#2d6f60' });
  b += tag(430, H2[1] + 90, 'fires if x_{1} + x_{2} − 1.5 > 0', { size: 21, color: C.hid[1], border: '#2d6f60' });
  b += tag(780, Y[1] + 100, 'fires if h_{1} − h_{2} − 0.5 > 0', { size: 21, color: C.out[1], border: '#8a7a26' });
  b += text(780, Y[1] + 146, '“OR but not AND”', { size: 20, color: C.mute, weight: 600, italic: true });
  return svg(W, H, b, 'A network for XOR: an OR unit and an AND unit feed one output that fires for OR but not AND');
}

// ---------------------------------------------------------------- 3–4–2 layers
function net342() {
  const W = 900, H = 580;
  const L0 = [0, 1, 2].map(i => [150, 170 + i * 130]);
  const L1 = [0, 1, 2, 3].map(i => [450, 105 + i * 125]);
  const L2 = [0, 1].map(i => [750, 230 + i * 130]);
  let b = '';
  for (const a of L0) for (const c of L1) b += arrow(...a, ...c, 40, 40, C.edge, 2.2);
  for (const a of L1) for (const c of L2) b += arrow(...a, ...c, 40, 40, C.edge, 2.2);
  L0.forEach((p, i) => (b += node(...p, 'x_{' + (i + 1) + '}', 'in', null, 40)));
  L1.forEach((p, i) => (b += node(...p, 'h_{' + (i + 1) + '}', 'hid', null, 40)));
  L2.forEach((p, i) => (b += node(...p, 'ŷ_{' + (i + 1) + '}', 'out', null, 40)));
  b += text(150, 538, 'input layer', { size: 22, color: C.in[1], weight: 700 });
  b += text(450, 538, 'hidden layer', { size: 22, color: C.hid[1], weight: 700 });
  b += text(750, 538, 'output layer', { size: 22, color: C.out[1], weight: 700 });
  b += text(450, 34, 'every arrow is one weight', { size: 21, color: C.mute, weight: 600 });
  return svg(W, H, b, 'A 3–4–2 network: 3 inputs, 4 hidden neurons and 2 outputs; every input connects to every hidden neuron and every hidden neuron to every output');
}

// ---------------------------------------------------------------- the chain from w11 to L
function chainPath() {
  const W = 960, H = 470, y = 220;
  const xs = [80, 280, 480, 680, 880];
  const kinds = ['in', 'hid', 'hid', 'out', 'loss'];
  const syms = ['w_{11}', 'z_{1}', 'a_{1}', 'ŷ', 'L'];
  const subs = ['weight', 'sum', 'activation', 'prediction', 'loss'];
  const loc = ['∂z_{1}/∂w_{11} = x_{1}', '∂a_{1}/∂z_{1} = ReLU′(z_{1})', '∂ŷ/∂a_{1} = v_{1}', '∂L/∂ŷ = ŷ − y'];
  let b = '';
  b += text(W / 2, 36, 'how a nudge to w_{11} reaches the loss', { size: 21, color: C.mute, weight: 600 });
  xs.forEach((x, i) => (b += box(x, y, 130, 92, kinds[i], syms[i], subs[i])));
  for (let i = 0; i < 4; i++) {
    b += '<line x1="' + (xs[i] + 67) + '" y1="' + y + '" x2="' + (xs[i + 1] - 71) + '" y2="' + y + '" stroke="' + C.edge + '" stroke-width="3" marker-end="url(#ah-' + C.edge.slice(1) + ')"/>';
    b += tag((xs[i] + xs[i + 1]) / 2, i % 2 === 0 ? y - 96 : y + 96, loc[i], { size: 22, color: C.back, border: '#8a4a14', bg: '#1f1405' });
  }
  b += text(W / 2, 382, '∂L/∂w_{11} = (∂L/∂ŷ)(∂ŷ/∂a_{1})(∂a_{1}/∂z_{1})(∂z_{1}/∂w_{11})', { size: 24, color: C.ink, weight: 700 });
  b += text(W / 2, 426, '= (ŷ − y) · v_{1} · ReLU′(z_{1}) · x_{1}', { size: 24, color: C.ink, weight: 700 });
  return svg(W, H, b, 'The chain from weight w11 to the loss: w11 feeds z1, z1 feeds a1, a1 feeds the prediction, the prediction feeds the loss; the gradient multiplies the four local derivatives');
}

// ---------------------------------------------------------------- the deeper chain (one unit per layer)
function deepChain() {
  const W = 960, H = 400, y = 170;
  const xs = [70, 265, 490, 715, 885];
  let b = '';
  b += text(xs[0], 40, 'input', { size: 21, color: C.in[1], weight: 700 });
  b += text(xs[1], 40, 'hidden 1', { size: 21, color: C.hid[1], weight: 700 });
  b += text(xs[2], 40, 'hidden 2', { size: 21, color: C.hid[1], weight: 700 });
  b += text(xs[3], 40, 'output', { size: 21, color: C.out[1], weight: 700 });
  b += text(xs[4], 40, 'loss', { size: 21, color: C.loss[1], weight: 700 });
  b += node(xs[0], y, 'x', 'in', null, 44);
  b += box(xs[1], y, 150, 92, 'hid', 'z_{1} → a_{1}', 'ReLU');
  b += box(xs[2], y, 150, 92, 'hid', 'z_{2} → a_{2}', 'ReLU');
  b += node(xs[3], y, 'ŷ', 'out', null, 46);
  b += box(xs[4], y, 100, 80, 'loss', 'L');
  const ar = (x1, x2) => '<line x1="' + x1 + '" y1="' + y + '" x2="' + x2 + '" y2="' + y + '" stroke="' + C.edge + '" stroke-width="3" marker-end="url(#ah-' + C.edge.slice(1) + ')"/>';
  b += ar(116, 184) + ar(342, 409) + ar(567, 663) + ar(763, 829);
  b += tag(150, y - 38, 'w_{1}', { size: 23 }) + tag(376, y - 38, 'w_{2}', { size: 23 }) + tag(614, y - 38, 'v', { size: 23 });
  b += tag(xs[1], y + 86, 'bias b_{1}', { size: 22, color: C.hid[1], border: '#2d6f60' });
  b += tag(xs[2], y + 86, 'bias b_{2}', { size: 22, color: C.hid[1], border: '#2d6f60' });
  b += tag(xs[3], y + 86, 'bias c', { size: 22, color: C.hid[1], border: '#2d6f60' });
  b += tag(xs[4], y + 86, 'target y', { size: 22, color: C.loss[1], border: '#8a2f28' });
  b += text(W / 2, 330, 'z_{1} = w_{1}x + b_{1}\u2003\u2003z_{2} = w_{2}a_{1} + b_{2}\u2003\u2003ŷ = v a_{2} + c', { size: 23, color: C.ink, weight: 600 });
  b += text(W / 2, 368, 'a_{1} = ReLU(z_{1})\u2003\u2003a_{2} = ReLU(z_{2})\u2003\u2003L = ½(ŷ − y)²', { size: 23, color: C.ink, weight: 600 });
  return svg(W, H, b, 'A deeper chain: one input, two hidden layers of one ReLU unit each and one linear output, six parameters');
}

function solve(p) {
  const z1 = p.w11 * p.x1 + p.w21 * p.x2 + p.b1, z2 = p.w12 * p.x1 + p.w22 * p.x2 + p.b2;
  const a1 = Math.max(0, z1), a2 = Math.max(0, z2), yh = p.v1 * a1 + p.v2 * a2 + p.c;
  const r = v => +v.toFixed(10);
  const dy = yh - p.y, da1 = dy * p.v1, dz1 = da1 * (z1 > 0 ? 1 : 0), da2 = dy * p.v2, dz2 = da2 * (z2 > 0 ? 1 : 0);
  const fwd = { z1: r(z1), a1: r(a1), z2: r(z2), a2: r(a2), yh: r(yh), L: r(0.5 * dy * dy), dy: r(dy), da1: r(da1), dz1: r(dz1), da2: r(da2), dz2: r(dz2) };
  const grads = { w11: r(dz1 * p.x1), w21: r(dz1 * p.x2), b1: r(dz1), w12: r(dz2 * p.x1), w22: r(dz2 * p.x2), b2: r(dz2), v1: r(dy * a1), v2: r(dy * a2), c: r(dy) };
  return { fwd, grads };
}
const lab = { x1: 2, x2: -1, y: 2.5, w11: 0.5, w21: -0.5, b1: 0.5, w12: -0.5, w22: -1, b2: 1, v1: -0.5, v2: 1, c: 0.5 };
const you = { x1: 1, x2: 2, y: 3.5, w11: -1, w21: 0.5, b1: 0.5, w12: 0.5, w22: -1, b2: 0.5, v1: 1, v2: 1, c: 0.5 };
const { fwd: labFwd, grads: labG } = solve(lab);
const { fwd: youFwd, grads: youG } = solve(you);
console.error(JSON.stringify({ labFwd, labG, youFwd, youG }));

const files = {
  'lab-net.svg': net221(lab, 'params', 'The lab network: two inputs, two ReLU hidden units and one linear output, with every weight and bias labelled'),
  'lab-net-forward.svg': net221(lab, 'forward', 'The lab network after the forward pass: z1 = 2, a1 = 2, z2 = 1, a2 = 1, prediction 0.5, loss 2', { fwd: labFwd }),
  'lab-net-backward.svg': net221(lab, 'backward', 'The lab network after the backward pass, with the loss gradient of every weight, bias and hidden value', { fwd: labFwd, grads: labG }),
  'your-net.svg': net221(you, 'params', 'Your network: two inputs, two ReLU hidden units and one linear output, with every weight and bias labelled'),
  'your-net-forward.svg': net221(you, 'forward', 'Your network after the forward pass: hidden unit 2 is off, prediction 1, loss 3.125', { fwd: youFwd, dead2: true }),
  'your-net-backward.svg': net221(you, 'backward', 'Your network after the backward pass: the switched-off unit 2 passes no gradient to its weights', { fwd: youFwd, grads: youG, dead2: true }),
  'neuron.svg': neuron(),
  'xor-net.svg': xorNet(),
  'net-342.svg': net342(),
  'chain-path.svg': chainPath(),
  'deep-chain.svg': deepChain(),
};
for (const [name, s] of Object.entries(files)) {
  fs.writeFileSync(path.join(OUT, name), s);
  if (PREV) {
    const m = s.match(/viewBox="0 0 (\d+) (\d+)"/);
    const side = Math.max(+m[1], +m[2]);
    fs.writeFileSync(path.join(PREV, name), s.replace(/viewBox="0 0 \d+ \d+" width="\d+" height="\d+"/, `viewBox="0 0 ${side} ${side}" width="${side}" height="${side}"`));
  }
}
console.log(Object.keys(files).join(' '));
