/*
 * Qdigo motion kit (classic script, global `HF`). A clip in animations/clips/<module-id>/<clip-id>.html loads it after GSAP
 * (HyperFrames injects its own runtime when it previews or renders):
 *
 *   <link rel="stylesheet" href="../../kit/kit.css">
 *   <script src="../../kit/vendor/gsap.min.js"></script>
 *   <script src="../../kit/kit.js"></script>
 *
 * It encodes the house style so every composition looks and moves the same way:
 *  - shapes: flat, rounded, no outlines; each gets one soft inner highlight and one darker shade of its own hue
 *  - motion: pop-ins overshoot (0 → 110% → 100% in 0.3 s), moves ease in-out and settle with a small wobble,
 *    coins fall in arcs, the camera pushes slowly instead of cutting, numbers count up
 *  - determinism: everything is a tween on ONE paused GSAP timeline (no Math.random, no clocks), so HyperFrames
 *    can seek any frame. Counters are pure functions of timeline time, re-rendered on every seek.
 *
 * Coordinates are a 1280×720 stage. Build actors with the shape helpers, then choreograph them on `HF.timeline()`.
 */
(function () {
  'use strict';
  const SVGNS = 'http://www.w3.org/2000/svg';

  // ------------------------------------------------------------------ palette
  const C = {
    teal: '#2EC4B6', coral: '#FF6B6B', gold: '#FFC94A', violet: '#9B5DE5', text: '#F4F1DE',
    navy: '#0B1D3A', indigo: '#1B2B5E', green: '#3DDC84', sea: '#1F3F7A', ink: '#13254B',
  };

  function hexToHsl(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    let r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0; const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h /= 6;
    }
    return [h, s, l];
  }
  function hslToHex(h, s, l) {
    const f = (n) => {
      const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l);
      const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      return Math.round(c * 255).toString(16).padStart(2, '0');
    };
    return '#' + f(0) + f(8) + f(4);
  }
  /** darker shade of the same hue */
  const shade = (hex, k = 0.14) => { const [h, s, l] = hexToHsl(hex); return hslToHex(h, Math.min(1, s * 1.05), Math.max(0, l - k)); };
  /** lighter tint of the same hue (for the inner highlight) */
  const light = (hex, k = 0.16) => { const [h, s, l] = hexToHsl(hex); return hslToHex(h, s, Math.min(0.97, l + k)); };

  // ------------------------------------------------------------------ DOM
  const stage = () => document.getElementById('stage');
  let _uid = 0;
  const uid = (p = 'hf') => `${p}${++_uid}`;

  /** Create an SVG element: HF.el('rect', {x, y, …}, parent) */
  function el(tag, attrs = {}, parent) {
    const n = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) n.setAttribute(k, String(v));
    if (parent) parent.appendChild(n);
    return n;
  }
  const g = (parent, attrs = {}) => el('g', attrs, parent);

  /** The world (camera) wrapper, its SVG and the label layer. Created once. */
  function world() {
    let w = stage().querySelector('.hf-world');
    if (w) return { world: w, svg: w.querySelector('svg'), defs: w.querySelector('defs') };
    w = document.createElement('div');
    w.className = 'hf-world';
    stage().appendChild(w);
    const svg = el('svg', { viewBox: '0 0 1280 720', width: 1280, height: 720 });
    w.appendChild(svg);
    const defs = el('defs', {}, svg);
    // soft glow filter (for glowing tracks, orbs, gold) — a glow, not a drop shadow
    const f = el('filter', { id: 'hf-glow', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
    el('feGaussianBlur', { stdDeviation: 10, result: 'b' }, f);
    const m = el('feMerge', {}, f);
    el('feMergeNode', { in: 'b' }, m);
    el('feMergeNode', { in: 'SourceGraphic' }, m);
    const f2 = el('filter', { id: 'hf-blur', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
    el('feGaussianBlur', { stdDeviation: 14 }, f2);
    return { world: w, svg, defs };
  }
  /**
   * Heads-up layer: an SVG + label layer above the world that the camera does NOT move (price counters, tags).
   * Returns { hud, svg }.
   */
  function hud() {
    let h = stage().querySelector('.hf-hud');
    if (h) return { hud: h, svg: h.querySelector('svg') };
    world();
    h = document.createElement('div');
    h.className = 'hf-hud';
    stage().appendChild(h);
    const svg = el('svg', { viewBox: '0 0 1280 720', width: 1280, height: 720 });
    h.appendChild(svg);
    return { hud: h, svg };
  }

  /** A named layer (SVG <g>) in back-to-front order of creation */
  const layer = (name) => g(world().svg, { class: `hf-layer-${name}` });

  // ------------------------------------------------------------------ shapes (flat, rounded, highlight + shade)
  /**
   * Rounded box. The bottom band (or right band) is the darker shade, an inner rounded patch near the top-left is
   * the highlight. Returns the <g>; its origin is the box's top-left.
   */
  function box(parent, { x = 0, y = 0, w, h, r = 14, color = C.coral, shadeSide = 'bottom', shadeK = 0.13, hi = true, opacity } = {}) {
    const grp = g(parent, { transform: `translate(${x} ${y})`, opacity });
    el('rect', { x: 0, y: 0, width: w, height: h, rx: r, fill: shade(color, shadeK) }, grp);
    const band = shadeSide === 'right' ? { width: w - Math.max(6, w * 0.16), height: h } : { width: w, height: h - Math.max(6, h * 0.16) };
    el('rect', { x: 0, y: 0, ...band, rx: r, fill: color }, grp);
    if (hi && w > 18 && h > 18) {
      const hw = Math.max(8, w * 0.32), hh = Math.max(5, Math.min(h * 0.16, 16));
      el('rect', { x: Math.min(r * 0.7 + 4, w * 0.15), y: Math.min(r * 0.5 + 4, h * 0.14), width: hw, height: hh, rx: hh / 2, fill: light(color, 0.18), opacity: 0.55 }, grp);
    }
    return grp;
  }

  /** Disc with a crescent shade at the lower right and a highlight at the upper left. Origin is the centre. */
  function disc(parent, { x = 0, y = 0, r = 20, color = C.gold, hi = true, shadeK = 0.14 } = {}) {
    const grp = g(parent, { transform: `translate(${x} ${y})` });
    el('circle', { cx: 0, cy: 0, r, fill: shade(color, shadeK) }, grp);
    el('circle', { cx: -r * 0.1, cy: -r * 0.1, r: r * 0.9, fill: color }, grp);
    if (hi && r > 7) el('ellipse', { cx: -r * 0.38, cy: -r * 0.42, rx: r * 0.3, ry: r * 0.18, fill: light(color, 0.2), opacity: 0.6, transform: `rotate(-30 ${-r * 0.38} ${-r * 0.42})` }, grp);
    return grp;
  }

  /** Gold coin (side view: a disc with a rim). Origin is the centre. */
  function coin(parent, { x = 0, y = 0, r = 14, color = C.gold, mark = '' } = {}) {
    const grp = disc(parent, { x, y, r, color });
    el('circle', { cx: -r * 0.1, cy: -r * 0.1, r: r * 0.62, fill: 'none', stroke: shade(color, 0.1), 'stroke-width': Math.max(1.5, r * 0.12) }, grp);
    if (mark) text(grp, mark, { x: -r * 0.1, y: r * 0.22 - r * 0.1, size: r * 0.9, color: shade(color, 0.22), weight: 900 });
    return grp;
  }

  /** Stack of flat coins seen from the side (n coins). Origin: bottom centre. */
  function coinStack(parent, { x = 0, y = 0, n = 5, w = 64, h = 12, color = C.gold } = {}) {
    const grp = g(parent, { transform: `translate(${x} ${y})` });
    for (let i = 0; i < n; i++) {
      const cy = -(i + 1) * (h - 2);
      el('rect', { x: -w / 2, y: cy, width: w, height: h, rx: h / 2, fill: shade(color, 0.12) }, grp);
      el('rect', { x: -w / 2, y: cy, width: w, height: h - 4, rx: (h - 4) / 2, fill: color }, grp);
      el('rect', { x: -w / 2 + 8, y: cy + 2, width: w * 0.3, height: 3, rx: 1.5, fill: light(color, 0.2), opacity: 0.7 }, grp);
    }
    return grp;
  }

  /**
   * A little round character: body, dot eyes, no mouth. Origin is the feet (bottom centre).
   * Returns { g, body, eyes, hat } so scenes can swap caps or blink.
   */
  function character(parent, { x = 0, y = 0, color = C.teal, size = 1, look = 0, arm = false } = {}) {
    const grp = g(parent, { transform: `translate(${x} ${y})` });
    const inner = g(grp, { transform: `scale(${size})` });
    // optional waving arm (behind the body), pivoting at the shoulder (20, -40)
    let armG = null;
    if (arm) {
      armG = g(inner);
      el('rect', { x: 14, y: -45, width: 26, height: 11, rx: 5.5, fill: shade(color, 0.08) }, armG);
      el('circle', { cx: 40, cy: -39.5, r: 7, fill: color }, armG);
    }
    const body = g(inner);
    el('ellipse', { cx: 0, cy: -34, rx: 26, ry: 32, fill: shade(color, 0.12) }, body);
    el('ellipse', { cx: -2.5, cy: -36, rx: 23.5, ry: 29.5, fill: color }, body);
    el('ellipse', { cx: -11, cy: -52, rx: 7, ry: 4.5, fill: light(color, 0.2), opacity: 0.6, transform: 'rotate(-30 -11 -52)' }, body);
    const eyes = g(inner, { transform: `translate(${look * 5} 0)` });
    el('circle', { cx: -8, cy: -40, r: 3.6, fill: C.navy }, eyes);
    el('circle', { cx: 8, cy: -40, r: 3.6, fill: C.navy }, eyes);
    const hat = g(inner);
    return { g: grp, inner, body, eyes, hat, arm: armG };
  }

  /** A cap for a character (put in ch.hat). */
  function cap(parent, { color = C.teal, badge = false } = {}) {
    const grp = g(parent);
    el('path', { d: 'M-22 -58 Q-22 -78 0 -78 Q22 -78 22 -58 Z', fill: color }, grp);
    el('rect', { x: -4, y: -62, width: 36, height: 7, rx: 3.5, fill: shade(color, 0.14) }, grp);
    el('ellipse', { cx: -8, cy: -71, rx: 6, ry: 3, fill: light(color, 0.2), opacity: 0.6 }, grp);
    if (badge) el('path', { d: star(0, -67, 6, 2.6), fill: C.gold }, grp);
    return grp;
  }

  /** A wavy band: sine crest at `y`, filled down to `bottom`, from x0 to x1. Loop its x by one wavelength to roll it. */
  function wave(parent, { y = 500, amp = 8, len = 120, x0 = -240, x1 = 2200, bottom = 760, color = C.sea, opacity } = {}) {
    let d = `M${x0} ${bottom} L${x0} ${y}`;
    for (let x = x0; x <= x1; x += len / 2) {
      const cx = x + len / 4, up = ((x - x0) / (len / 2)) % 2 === 0;
      d += ` Q${cx} ${up ? y - amp * 2 : y + amp * 2} ${x + len / 2} ${y}`;
    }
    d += ` L${x1} ${bottom} Z`;
    return el('path', { d, fill: color, opacity }, parent);
  }

  /** Five-point star path */
  function star(cx, cy, R, r) {
    let d = '';
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r : R;
      d += (i ? 'L' : 'M') + (cx + rr * Math.cos(a)).toFixed(2) + ' ' + (cy + rr * Math.sin(a)).toFixed(2);
    }
    return d + 'Z';
  }

  /** Sparkle (4-point star). Origin at centre. */
  function sparkle(parent, { x = 0, y = 0, r = 16, color = C.text } = {}) {
    const grp = g(parent, { transform: `translate(${x} ${y})` });
    const q = r * 0.22;
    el('path', { d: `M0 ${-r} Q${q} ${-q} ${r} 0 Q${q} ${q} 0 ${r} Q${-q} ${q} ${-r} 0 Q${-q} ${-q} 0 ${-r}Z`, fill: color }, grp);
    return grp;
  }

  /** SVG text (Nunito). Origin is the baseline centre unless anchor is set. */
  function text(parent, str, { x = 0, y = 0, size = 24, color = C.text, weight = 800, anchor = 'middle', opacity } = {}) {
    const t = el('text', { x, y, 'font-size': size, 'font-weight': weight, fill: color, 'text-anchor': anchor, 'font-family': 'Nunito, ui-rounded, system-ui, sans-serif', opacity }, parent);
    t.textContent = str;
    return t;
  }

  /**
   * HTML label in the world layer. x, y is the anchor point; `anchor` picks which side of the label sits on it
   * (center | left | right | top | bottom). Starts hidden at scale 0: reveal it with HF.say / HF.pop.
   */
  function label(str, { x, y, anchor = 'center', cls = '', html = false, hud: onHud = false } = {}) {
    const d = document.createElement('div');
    d.className = `hf-label ${cls}`.trim();
    if (html) d.innerHTML = str; else d.textContent = str;
    d.style.left = `${x}px`;
    d.style.top = `${y}px`;
    (onHud ? hud().hud : world().world).appendChild(d);
    const off = { center: [-50, -50], left: [0, -50], right: [-100, -50], top: [-50, 0], bottom: [-50, -100] }[anchor] ?? [-50, -50];
    const origin = { center: '50% 50%', left: '0% 50%', right: '100% 50%', top: '50% 0%', bottom: '50% 100%' }[anchor] ?? '50% 50%';
    gsap.set(d, { xPercent: off[0], yPercent: off[1], scale: 0, transformOrigin: origin });
    return d;
  }

  // ------------------------------------------------------------------ timeline + motion vocabulary
  let _tl = null;
  const derived = [];

  /**
   * The composition's single paused timeline, registered for HyperFrames under the root's data-composition-id.
   * `duration` pins the length (the last 0.5–1 s should be a hold).
   */
  function timeline(duration) {
    if (_tl) return _tl;
    const root = document.querySelector('[data-composition-id]');
    const id = root.getAttribute('data-composition-id');
    _tl = gsap.timeline({ paused: true, onUpdate: renderDerived });
    if (duration) {
      _tl.set({}, {}, duration);
      // after the scene script has built the timeline: a tween that runs past the declared length is an authoring bug
      queueMicrotask(() => {
        if (_tl.duration() > duration + 1e-6) console.error(`[HF] timeline "${id}" runs ${_tl.duration().toFixed(2)} s, longer than its declared ${duration} s: shorten the tweens that end late`);
      });
    }
    window.__timelines = window.__timelines || {};
    window.__timelines[id] = _tl;
    return _tl;
  }

  /** Render every time-derived value (counters, drifting things) for timeline time t. */
  function renderDerived() {
    if (!_tl) return;
    const t = _tl.time();
    for (const f of derived) f(t);
  }
  window.addEventListener('hf-seek', () => renderDerived());

  /** Register f(t), re-run whenever the timeline time changes (play, seek, scrub). Must be a pure function of t. */
  function every(f) { derived.push(f); }

  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const ease = (name) => gsap.parseEase(name);

  /** Pop in: scale 0 → 110% → 100% over `dur` (0.3 s), from the element's centre (or `origin`). */
  function pop(tl, targets, at, { dur = 0.3, origin = '50% 50%', stagger = 0 } = {}) {
    tl.fromTo(targets, { scale: 0, transformOrigin: origin },
      { keyframes: { scale: [0, 1.1, 1], easeEach: 'sine.out' }, duration: dur, ease: 'none', stagger, immediateRender: true }, at);
    return tl;
  }

  /** Pop out: a quick shrink to nothing. */
  function popOut(tl, targets, at, { dur = 0.2 } = {}) {
    tl.to(targets, { keyframes: { scale: [1, 1.08, 0], easeEach: 'sine.in' }, duration: dur, ease: 'none' }, at);
    return tl;
  }

  /**
   * Move with ease-in-out, then settle with a tiny wobble (rotation about `origin`, default bottom centre).
   * `vars` are GSAP props (x, y, …).
   */
  function move(tl, target, vars, at, dur, { wobble = 4, origin = '50% 100%' } = {}) {
    tl.to(target, { ...vars, duration: dur, ease: 'power2.inOut' }, at);
    if (wobble) tl.to(target, { keyframes: { rotation: [0, wobble, -wobble * 0.55, wobble * 0.2, 0], easeEach: 'sine.inOut' }, transformOrigin: origin, duration: 0.42, ease: 'none' }, at + dur - 0.05);
    return tl;
  }

  /** Settle wobble on its own (e.g. after a drop), around rotation `base` (default 0). */
  function wobble(tl, target, at, { amount = 4, origin = '50% 100%', dur = 0.42, base = 0 } = {}) {
    const b = base;
    tl.to(target, { keyframes: { rotation: [b, b + amount, b - amount * 0.55, b + amount * 0.2, b], easeEach: 'sine.inOut' }, transformOrigin: origin, duration: dur, ease: 'none' }, at);
    return tl;
  }

  /** Squash-and-settle for a landing (scaleY dips, scaleX bulges). */
  function land(tl, target, at, { amount = 0.12, origin = '50% 100%' } = {}) {
    tl.to(target, { keyframes: { scaleY: [1, 1 - amount, 1 + amount * 0.4, 1], scaleX: [1, 1 + amount * 0.6, 1 - amount * 0.2, 1], easeEach: 'sine.inOut' }, transformOrigin: origin, duration: 0.36, ease: 'none' }, at);
    return tl;
  }

  /**
   * Arc: an <g> moves from (x0, y0) to (x1, y1) while rising `h` px and falling back (a parabola).
   * The element needs one child <g> (created here if missing) that carries the vertical arc offset.
   */
  function arc(tl, outer, { x0, y0, x1, y1, h = 80 }, at, dur, { fall = 'power1.in', spin = 0 } = {}) {
    let inner = outer.firstElementChild;
    if (!inner || inner.getAttribute('data-arc') !== '1') {
      inner = g(null, { 'data-arc': '1' });
      while (outer.firstChild) inner.appendChild(outer.firstChild);
      outer.appendChild(inner);
    }
    tl.fromTo(outer, { x: x0 }, { x: x1, duration: dur, ease: 'none', immediateRender: false }, at);
    tl.fromTo(outer, { y: y0 }, { y: y1, duration: dur, ease: fall, immediateRender: false }, at);
    tl.fromTo(inner, { y: 0 }, { y: -h, duration: dur, ease: (p) => 4 * p * (1 - p), immediateRender: false }, at);
    if (spin) tl.fromTo(inner, { rotation: 0 }, { rotation: spin, duration: dur, ease: 'none', transformOrigin: '50% 50%', immediateRender: false }, at);
    return tl;
  }

  /**
   * Count a number up (or down) from `from` to `to` between `at` and `at + dur`, writing it into `node`
   * (an HTML element or SVG <text>). `format(v)` turns the value into text. Pure function of time.
   */
  const counters = new Map(); // node → [{from, to, at, dur, e, format}] in time order
  function count(node, from, to, at, dur, { format = (v) => Math.round(v).toLocaleString('en-US'), easeName = 'power2.out' } = {}) {
    let list = counters.get(node);
    if (!list) {
      list = [];
      counters.set(node, list);
      every((t) => {
        // the latest count that has started owns the node; before the first one starts, show its `from`
        let c = list[0];
        for (const k of list) if (t >= k.at) c = k;
        const v = t < c.at ? c.from : c.from + (c.to - c.from) * c.e(clamp01((t - c.at) / c.dur));
        const s = c.format(v);
        if (node.textContent !== s) node.textContent = s;
      });
    }
    list.push({ from, to, at, dur, e: ease(easeName), format });
    list.sort((a, b) => a.at - b.at);
    node.textContent = list[0].format(list[0].from);
  }

  /** Show a label at `at` (pop in) and, if `until` is given, pop it out then. One label at a time. */
  function say(tl, node, at, until) {
    pop(tl, node, at);
    if (until !== undefined) popOut(tl, node, until);
    return tl;
  }

  /** Camera: push / pan the world. scale 1.05 is the house "slow push"; x/y pan in px. */
  function camera(tl, vars, at, dur, { easeName = 'sine.inOut' } = {}) {
    tl.to(world().world, { ...vars, duration: dur, ease: easeName }, at);
    return tl;
  }

  /** Gentle bob (y oscillation) for `dur` seconds, deterministic. */
  function bob(tl, target, at, dur, { amp = 6, period = 1.2, phase = 0 } = {}) {
    const cycles = Math.max(1, Math.round(dur / period));
    tl.fromTo(target, { y: 0 }, { y: -amp, duration: period / 2, ease: 'sine.inOut', yoyo: true, repeat: cycles * 2 - 1, immediateRender: false }, at + phase);
    return tl;
  }

  /**
   * Repeat a fromTo tween every `period` seconds from `start`, as many whole times as fit before `end`
   * (so loops never stretch the film past its length).
   */
  function loop(tl, target, from, to, start, period, end) {
    const reps = Math.floor((end - start) / period);
    if (reps < 1) return tl;
    tl.fromTo(target, from, { ...to, duration: period, repeat: reps - 1, immediateRender: false }, start);
    return tl;
  }

  /** Deterministic PRNG (mulberry32) for seeded scatter. */
  function rng(seed = 1) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Sparkle burst: n sparkles fly out from (x, y) and fade. */
  function burst(tl, parent, { x, y, n = 8, r = 70, size = 10, color = C.text, seed = 7 }, at, dur = 0.6) {
    const rand = rng(seed);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand() * 0.4;
      const d = r * (0.65 + rand() * 0.5);
      const s = sparkle(parent, { x: 0, y: 0, r: size * (0.6 + rand() * 0.6), color });
      gsap.set(s, { x, y, scale: 0, transformOrigin: '50% 50%' });
      tl.to(s, { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, duration: dur, ease: 'power2.out' }, at);
      tl.to(s, { keyframes: { scale: [0, 1.15, 0], easeEach: 'sine.inOut' }, rotation: 90, duration: dur, ease: 'none' }, at);
    }
    return tl;
  }

  // Hold HyperFrames' "ready" until the Three.js sky (a deferred module) has drawn its first frame, so the player
  // never shows a blank background. Released after 4 s regardless, in case the module can't load.
  let skyReady;
  window.__hf = window.__hf || {};
  window.__hf.buildReady = window.__hf.buildReady || {};
  window.__hf.buildReady['hf-sky'] = new Promise((res) => { skyReady = res; setTimeout(res, 4000); });

  window.HF = {
    skyReady: () => skyReady && skyReady(),
    C, shade, light, el, g, world, hud, layer, wave, box, disc, coin, coinStack, character, cap, star, sparkle, text, label,
    timeline, every, loop, pop, popOut, move, wobble, land, arc, count, say, camera, bob, rng, burst, uid, clamp01,
    /** money: 1234 → "1,234" ; with decimals */
    fmt: (v, d = 0) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }),
  };
})();
