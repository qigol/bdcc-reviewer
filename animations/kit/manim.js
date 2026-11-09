/*
 * Manim-style helpers for the math modules (global `MN`). Classic script: load it AFTER kit.js (it extends the kit, it does
 * not replace it) and after vendor/katex/katex.min.js. The 8 INTB clips keep using kit.js alone and are unaffected.
 *
 *   <link rel="stylesheet" href="../../kit/kit.css">
 *   <link rel="stylesheet" href="../../kit/vendor/katex/katex.min.css">
 *   <link rel="stylesheet" href="../../kit/manim.css">
 *   <script src="../../kit/vendor/gsap.min.js"></script>
 *   <script src="../../kit/kit.js"></script>
 *   <script src="../../kit/vendor/katex/katex.min.js"></script>
 *   <script src="../../kit/manim.js"></script>
 *
 * The look: black background, thin bright strokes drawn on, glowing dots that carry signals along lines, math typeset
 * with KaTeX, slow camera push. Coordinates are the kit's 1280×720 stage. Everything is a tween on the ONE paused
 * timeline from HF.timeline(), so every frame is a pure function of time (no Math.random, clocks or timers).
 * Use HF.rng(seed), HF.count, HF.camera, HF.timeline from kit.js as usual.
 */
(function () {
  'use strict';
  if (!window.HF || !window.katex) throw new Error('manim.js needs kit.js (global HF) and KaTeX (global katex) loaded first');
  const { el, g, world } = HF;

  const C = {
    bg: '#000000', ink: '#ECECEC', grey: '#8A8A96', dim: '#2A2A33',
    blue: '#58C4DD', teal: '#5CD0B3', green: '#83C167', yellow: '#FFE066', orange: '#FF862F', red: '#FC6255', purple: '#B189C6',
  };

  const ANCHOR = { center: [-50, -50], left: [0, -50], right: [-100, -50], top: [-50, 0], bottom: [-50, -100] };

  /**
   * Typeset TeX with KaTeX, placed in the world layer at (x, y) (`anchor` picks which point of the label sits there).
   * Starts hidden: reveal it with MN.show. Returns the <div>.
   */
  function tex(str, { x = 0, y = 0, size = 34, color = C.ink, anchor = 'center', halo = false } = {}) {
    const d = document.createElement('div');
    d.className = `mn-tex${halo ? ' mn-halo' : ''}`;
    d.innerHTML = katex.renderToString(str, { throwOnError: true });
    d.style.left = `${x}px`;
    d.style.top = `${y}px`;
    d.style.fontSize = `${size}px`;
    d.style.color = color;
    world().world.appendChild(d);
    const [xp, yp] = ANCHOR[anchor] || ANCHOR.center;
    gsap.set(d, { xPercent: xp, yPercent: yp });
    return d;
  }

  /** A plain number label (so HF.count can write into it). Starts hidden; reveal with MN.show. */
  function num(str, { x = 0, y = 0, size = 34, color = C.ink, anchor = 'center', halo = false } = {}) {
    const d = document.createElement('div');
    d.className = `mn-num${halo ? ' mn-halo' : ''}`;
    d.textContent = str;
    d.style.left = `${x}px`;
    d.style.top = `${y}px`;
    d.style.fontSize = `${size}px`;
    d.style.color = color;
    world().world.appendChild(d);
    const [xp, yp] = ANCHOR[anchor] || ANCHOR.center;
    gsap.set(d, { xPercent: xp, yPercent: yp });
    return d;
  }

  /** Fade in (and settle up by `dy` px). Hidden from the first frame. */
  function show(tl, node, at, { dur = 0.45, dy = 0 } = {}) {
    tl.fromTo(node, { opacity: 0, y: dy }, { opacity: 1, y: 0, duration: dur, ease: 'power2.out', immediateRender: true }, at);
    return tl;
  }
  function hide(tl, node, at, { dur = 0.35 } = {}) {
    tl.to(node, { opacity: 0, duration: dur, ease: 'power1.in' }, at);
    return tl;
  }
  /** Dim to `to` opacity (for what is no longer the focus). */
  function dim(tl, node, at, { to = 0.25, dur = 0.4 } = {}) {
    tl.to(node, { opacity: to, duration: dur, ease: 'power1.inOut' }, at);
    return tl;
  }

  /** Draw a stroked shape (line, path, circle outline) on, like Manim's Create. Invisible until `at`. */
  function drawOn(tl, node, at, dur = 0.8, ease = 'power2.inOut') {
    const L = node.getTotalLength();
    gsap.set(node, { strokeDasharray: L, strokeDashoffset: L });
    tl.to(node, { strokeDashoffset: 0, duration: dur, ease }, at);
    return tl;
  }

  const line = (parent, x1, y1, x2, y2, { color = C.grey, width = 3, opacity } = {}) =>
    el('line', { x1, y1, x2, y2, stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', opacity }, parent);
  const path = (parent, d, { color = C.ink, width = 3, fill = 'none', opacity } = {}) =>
    el('path', { d, stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill, opacity }, parent);

  /**
   * A neuron: an outline ring plus a fill that can glow (MN.glow). Origin of the group is the centre, so scaling it
   * (MN.indicate) grows it in place. Returns { g, ring, fill, x, y, r }.
   */
  function neuron(parent, { x, y, r = 40, color = C.ink, width = 3.5 } = {}) {
    const grp = g(parent);
    gsap.set(grp, { x, y });
    const fill = el('circle', { cx: 0, cy: 0, r, fill: color, 'fill-opacity': 0 }, grp);
    const ring = el('circle', { cx: 0, cy: 0, r, fill: 'none', stroke: color, 'stroke-width': width }, grp);
    return { g: grp, ring, fill, x, y, r };
  }

  /** Fill a neuron to `to` (0–1) opacity: how strongly it is "on". */
  function glow(tl, n, at, { to = 0.4, dur = 0.4 } = {}) {
    tl.to(n.fill, { attr: { 'fill-opacity': to }, duration: dur, ease: 'power2.out' }, at);
    return tl;
  }

  /** A glowing dot carrying a signal from (x0, y0) to (x1, y1). Visible only while it travels. */
  function pulse(tl, parent, { x0, y0, x1, y1 }, at, dur, { color = C.yellow, r = 8 } = {}) {
    const grp = g(parent);
    el('circle', { cx: 0, cy: 0, r: r * 2.4, fill: color, opacity: 0.22 }, grp);
    el('circle', { cx: 0, cy: 0, r, fill: color }, grp);
    gsap.set(grp, { x: x0, y: y0, opacity: 0 });
    tl.to(grp, { opacity: 1, duration: 0.08 }, at);
    tl.to(grp, { x: x1, y: y1, duration: dur, ease: 'power1.inOut' }, at);
    tl.to(grp, { opacity: 0, duration: 0.12 }, at + dur - 0.08);
    return tl;
  }

  /** Grow-and-settle emphasis (Manim's Indicate), from the node's centre. */
  function indicate(tl, node, at, { scale = 1.18, dur = 0.5 } = {}) {
    tl.to(node, { keyframes: { scale: [1, scale, 1], easeEach: 'sine.inOut' }, transformOrigin: '50% 50%', duration: dur, ease: 'none' }, at);
    return tl;
  }

  /** Recolour a stroke or text over time (the "this part matters now" change). */
  function tint(tl, node, color, at, { dur = 0.4, prop = 'stroke' } = {}) {
    tl.to(node, { [prop]: color, duration: dur, ease: 'power1.inOut' }, at);
    return tl;
  }

  window.MN = { C, tex, num, show, hide, dim, drawOn, line, path, neuron, glow, pulse, indicate, tint };

  // this theme has no Three.js sky; release the kit's hold on HyperFrames' "ready" straight away
  HF.skyReady();
})();
