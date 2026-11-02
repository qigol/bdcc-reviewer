import { useEffect, useRef } from 'react';
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type Simulation, type SimulationLinkDatum, type SimulationNodeDatum } from 'd3-force';
import { cn } from '../lib/util';

export interface GNode { id: string; label: string; color: string; r: number }
export interface GLink { source: string; target: string }
type SNode = GNode & SimulationNodeDatum;
type SLink = SimulationLinkDatum<SNode>;

/** Theme colours as CSS colour strings (the tokens are "r g b" triples). */
function theme() {
  const s = getComputedStyle(document.documentElement);
  const c = (v: string, a = 1) => {
    const rgb = s.getPropertyValue(v).trim().split(/\s+/).join(',');
    return a < 1 ? `rgba(${rgb},${a})` : `rgb(${rgb})`;
  };
  return { ink: c('--ink'), muted: c('--muted'), line: c('--line'), accent: c('--accent'), panel: c('--panel'), fade: c('--line', 0.35) };
}

/**
 * A force-directed graph on a canvas: drag nodes, drag the background to pan, wheel to zoom, click a node to select it.
 * `highlight` (when set) dims every other node; `focus` gets a ring and its links stay lit.
 */
export function ForceGraph({ nodes, links, focus, highlight, onSelect, labels = 'zoom', className, ariaLabel }: {
  nodes: GNode[];
  links: GLink[];
  focus?: string;
  highlight?: Set<string> | null;
  onSelect: (id: string) => void;
  labels?: 'always' | 'zoom';
  className?: string;
  ariaLabel: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const st = useRef({
    w: 0, h: 0, k: 1, x: 0, y: 0, moved: false, hover: null as string | null,
    sim: null as Simulation<SNode, SLink> | null, nodes: [] as SNode[], links: [] as SLink[],
    pos: new Map<string, { x: number; y: number }>(), colors: null as ReturnType<typeof theme> | null,
    focus, highlight, labels, onSelect, draw: () => {},
  });
  const s = st.current;
  s.focus = focus;
  s.highlight = highlight;
  s.labels = labels;
  s.onSelect = onSelect;

  // drawing
  s.draw = () => {
    const cv = canvas.current;
    if (!cv || !s.w) return;
    const ctx = cv.getContext('2d')!;
    const col = (s.colors ??= theme());
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, s.w, s.h);
    const sx = (v: number) => v * s.k + s.x;
    const sy = (v: number) => v * s.k + s.y;
    const active = s.hover ?? s.focus ?? null;
    const lit = new Set<string>();
    if (active) {
      lit.add(active);
      for (const l of s.links) {
        const a = (l.source as SNode).id, b = (l.target as SNode).id;
        if (a === active) lit.add(b);
        if (b === active) lit.add(a);
      }
    }
    const dim = (id: string) => (s.highlight ? !s.highlight.has(id) : false) || (s.hover ? !lit.has(id) : false);

    ctx.lineWidth = 1;
    for (const l of s.links) {
      const a = l.source as SNode, b = l.target as SNode;
      const on = active && (a.id === active || b.id === active);
      ctx.strokeStyle = on ? col.accent : dim(a.id) || dim(b.id) ? col.fade : col.line;
      ctx.lineWidth = on ? 1.6 : 1;
      ctx.beginPath();
      ctx.moveTo(sx(a.x!), sy(a.y!));
      ctx.lineTo(sx(b.x!), sy(b.y!));
      ctx.stroke();
    }
    const r = (n: SNode) => n.r * Math.min(1.6, Math.max(0.7, Math.sqrt(s.k)));
    for (const n of s.nodes) {
      ctx.globalAlpha = dim(n.id) ? 0.18 : 1;
      ctx.fillStyle = n.color;
      ctx.beginPath();
      ctx.arc(sx(n.x!), sy(n.y!), r(n), 0, Math.PI * 2);
      ctx.fill();
      if (n.id === s.focus || n.id === s.hover) {
        ctx.strokeStyle = col.accent;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(sx(n.x!), sy(n.y!), r(n) + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.font = '500 11px Inter, ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const fewHighlighted = s.highlight && s.highlight.size <= 40;
    for (const n of s.nodes) {
      const show = s.labels === 'always' || s.k >= 1.5 || lit.has(n.id) || (fewHighlighted && s.highlight!.has(n.id));
      if (!show || (dim(n.id) && !lit.has(n.id))) continue;
      const tx = sx(n.x!), ty = sy(n.y!) + r(n) + 3;
      ctx.lineWidth = 3;
      ctx.strokeStyle = col.panel;
      ctx.strokeText(n.label, tx, ty);
      ctx.fillStyle = n.id === active ? col.ink : col.muted;
      ctx.fillText(n.label, tx, ty);
    }
  };

  /** Scale and centre the graph to fit the canvas. */
  const fit = () => {
    if (!s.nodes.length || !s.w) return;
    const xs = s.nodes.map((n) => n.x!), ys = s.nodes.map((n) => n.y!);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const pad = 40;
    s.k = Math.min(2.2, (s.w - pad * 2) / Math.max(1, x1 - x0), (s.h - pad * 2) / Math.max(1, y1 - y0));
    s.x = s.w / 2 - ((x0 + x1) / 2) * s.k;
    s.y = s.h / 2 - ((y0 + y1) / 2) * s.k;
  };

  // size, theme changes
  useEffect(() => {
    const el = wrap.current!, cv = canvas.current!;
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      s.w = el.clientWidth;
      s.h = el.clientHeight;
      cv.width = s.w * dpr;
      cv.height = s.h * dpr;
      cv.style.width = `${s.w}px`;
      cv.style.height = `${s.h}px`;
      if (!s.moved) fit();
      s.draw();
    });
    ro.observe(el);
    const mo = new MutationObserver(() => { s.colors = null; s.draw(); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => { ro.disconnect(); mo.disconnect(); };
  }, []);

  // simulation (positions survive a change of the node set)
  useEffect(() => {
    s.sim?.stop();
    s.nodes = nodes.map((n) => ({ ...n, ...(s.pos.get(n.id) ?? {}) }));
    const byId = new Map(s.nodes.map((n) => [n.id, n]));
    s.links = links.filter((l) => byId.has(l.source) && byId.has(l.target)).map((l) => ({ source: byId.get(l.source)!, target: byId.get(l.target)! }));
    const fresh = s.nodes.some((n) => n.x === undefined);
    const sim = forceSimulation<SNode>(s.nodes)
      .force('link', forceLink<SNode, SLink>(s.links).distance(42).strength(0.5))
      .force('charge', forceManyBody<SNode>().strength(-70).distanceMax(400))
      .force('x', forceX<SNode>(0).strength(0.06))
      .force('y', forceY<SNode>(0).strength(0.06))
      .force('collide', forceCollide<SNode>((n) => n.r + 3))
      .alpha(fresh ? 1 : 0.3)
      .stop();
    s.sim = sim;
    const save = () => s.nodes.forEach((n) => s.pos.set(n.id, { x: n.x!, y: n.y! }));
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      sim.tick(300);
      save();
      if (!s.moved) fit();
      s.draw();
      return;
    }
    let ticks = 0;
    sim.on('tick', () => {
      ticks++;
      if (!s.moved && (ticks < 80 || ticks % 20 === 0)) fit();
      save();
      s.draw();
    });
    sim.on('end', () => { if (!s.moved) fit(); s.draw(); });
    sim.restart();
    return () => { sim.stop(); };
  }, [nodes, links]);

  // highlight / focus / labels changes only need a redraw
  useEffect(() => { s.draw(); }, [focus, highlight, labels]);

  // pointer: drag a node, pan the background, click to select, wheel to zoom
  useEffect(() => {
    const cv = canvas.current!;
    const at = (e: { clientX: number; clientY: number }) => {
      const b = cv.getBoundingClientRect();
      return { px: e.clientX - b.left, py: e.clientY - b.top };
    };
    const hit = (px: number, py: number) => {
      const gx = (px - s.x) / s.k, gy = (py - s.y) / s.k;
      let best: SNode | null = null, bd = Infinity;
      for (const n of s.nodes) {
        const d = Math.hypot(n.x! - gx, n.y! - gy);
        if (d < bd) { bd = d; best = n; }
      }
      return best && bd * s.k <= Math.max(best.r * Math.max(1, Math.sqrt(s.k)) + 4, 8) ? best : null;
    };
    let drag: { node: SNode | null; px: number; py: number; x: number; y: number; travelled: number } | null = null;
    const down = (e: PointerEvent) => {
      const { px, py } = at(e);
      cv.setPointerCapture(e.pointerId);
      drag = { node: hit(px, py), px, py, x: s.x, y: s.y, travelled: 0 };
    };
    const move = (e: PointerEvent) => {
      const { px, py } = at(e);
      if (!drag) {
        const n = hit(px, py);
        if ((n?.id ?? null) !== s.hover) { s.hover = n?.id ?? null; cv.style.cursor = n ? 'pointer' : 'grab'; s.draw(); }
        return;
      }
      drag.travelled = Math.max(drag.travelled, Math.hypot(px - drag.px, py - drag.py));
      if (drag.travelled < 4) return;
      if (drag.node) {
        drag.node.fx = (px - s.x) / s.k;
        drag.node.fy = (py - s.y) / s.k;
        s.sim?.alphaTarget(0.25).restart();
      } else {
        s.moved = true;
        cv.style.cursor = 'grabbing';
        s.x = drag.x + px - drag.px;
        s.y = drag.y + py - drag.py;
        s.draw();
      }
    };
    const up = () => {
      if (!drag) return;
      if (drag.node) {
        if (drag.travelled < 4) s.onSelect(drag.node.id);
        drag.node.fx = drag.node.fy = null;
        s.sim?.alphaTarget(0);
      }
      cv.style.cursor = s.hover ? 'pointer' : 'grab';
      drag = null;
    };
    const leave = () => { if (!drag && s.hover) { s.hover = null; s.draw(); } };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const { px, py } = at(e);
      const k = Math.min(6, Math.max(0.15, s.k * Math.exp(-e.deltaY * 0.0015)));
      s.x = px - ((px - s.x) / s.k) * k;
      s.y = py - ((py - s.y) / s.k) * k;
      s.k = k;
      s.moved = true;
      s.draw();
    };
    cv.addEventListener('pointerdown', down);
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', leave);
    cv.addEventListener('wheel', wheel, { passive: false });
    return () => {
      cv.removeEventListener('pointerdown', down);
      cv.removeEventListener('pointermove', move);
      cv.removeEventListener('pointerup', up);
      cv.removeEventListener('pointercancel', up);
      cv.removeEventListener('pointerleave', leave);
      cv.removeEventListener('wheel', wheel);
    };
  }, []);

  return (
    <div ref={wrap} className={cn('relative overflow-hidden', className)}>
      <canvas ref={canvas} role="img" aria-label={ariaLabel} className="absolute inset-0 touch-none" style={{ cursor: 'grab' }} />
      <button className="btn-ghost btn-sm absolute bottom-1.5 right-1.5 bg-panel/80" onClick={() => { s.moved = false; fit(); s.draw(); }}>Fit</button>
    </div>
  );
}
