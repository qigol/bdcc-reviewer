import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../lib/reducedMotion';
import { useSeason, useSeasonAttribute } from './useSeason';

// fixed pseudo-random layout so the flames don't jump between renders
const rnd = (i: number, k: number) => ((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1;
const W = 1440;
const B = 110;

function tongues(step: number, offset: number, hMin: number, hMax: number, w: number, k: number) {
  let d = '';
  for (let x = offset; x <= W + step; x += step) {
    const h = hMin + rnd(x, k) * (hMax - hMin);
    d += `M${x - w / 2} ${B} C${x - w / 2} ${B - h * 0.5} ${x - w * 0.15} ${B - h * 0.7} ${x} ${B - h} C${x + w * 0.2} ${B - h * 0.65} ${x + w / 2} ${B - h * 0.45} ${x + w / 2} ${B} Z `;
  }
  return d;
}
const FIRE = [tongues(40, 10, 55, 95, 60, 1), tongues(42, 30, 35, 65, 50, 2), tongues(44, 18, 18, 38, 36, 3)];
const ROCKS = Array.from({ length: 7 }, (_, i) => {
  const x = 40 + i * 220 + rnd(i, 4) * 60;
  return { rock: `${x},${B} ${x + 8},${B - 16} ${x + 26},${B - 22} ${x + 42},${B - 13} ${x + 50},${B}`, crack: `${x + 12},${B - 6} ${x + 24},${B - 15} ${x + 34},${B - 6}` };
});

/** Seasonal decorations and the <html data-season> attribute. Purely visual. */
export function SeasonDecor({ decorate }: { decorate: boolean }) {
  const season = useSeason();
  useSeasonAttribute(season);
  if (!decorate) return null;
  if (season === 'hellweek') return <HellWeek />;
  if (season === 'immaculate') return <Immaculate />;
  return null;
}

function HellWeek() {
  return (
    <div className="no-print pointer-events-none" aria-hidden data-testid="hellweek-decor">
      <div className="hw-heat"><span /><span /><span /></div>
      <svg className="hw-fire" viewBox={`0 0 ${W} ${B}`} preserveAspectRatio="xMidYMax slice">
        <path d={FIRE[0]} fill="#E5484D" fillOpacity="0.5" />
        <path d={FIRE[1]} fill="#FF7A3D" fillOpacity="0.7" />
        <path d={FIRE[2]} fill="#FBBF24" fillOpacity="0.85" />
        {ROCKS.map((r, i) => (
          <g key={i}>
            <polygon points={r.rock} fill="#2B1D18" />
            <polyline points={r.crack} fill="none" stroke="#FF7A3D" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        ))}
      </svg>
      <Devil />
    </div>
  );
}

/** A little devil that strolls along the flames now and then. Hidden when motion is reduced. */
function Devil() {
  const reduced = useReducedMotion();
  const [walk, setWalk] = useState<{ ltr: boolean; dur: number; n: number } | null>(null);
  const timer = useRef<number>();
  useEffect(() => {
    if (reduced) { setWalk(null); return; }
    let n = 0;
    const queue = (min: number) => {
      timer.current = window.setTimeout(() => {
        const dur = 6 + Math.round(Math.random() * 4);
        setWalk({ ltr: Math.random() < 0.5, dur, n: ++n });
        timer.current = window.setTimeout(() => { setWalk(null); queue(15000); }, dur * 1000 + 200);
      }, min + Math.random() * 30000);
    };
    queue(4000);
    return () => window.clearTimeout(timer.current);
  }, [reduced]);
  if (!walk) return null;
  return (
    <div key={walk.n} className={walk.ltr ? 'hw-devil hw-ltr' : 'hw-devil hw-rtl'} style={{ animationDuration: `${walk.dur}s` }}>
      <div style={walk.ltr ? undefined : { transform: 'scaleX(-1)' }}>
        <svg className="hw-bob" width="40" height="46" viewBox="0 0 44 50">
          <path d="M29 36 C40 37 43 28 38 23" fill="none" stroke="#E5484D" strokeWidth="2.5" strokeLinecap="round" />
          <polygon points="36,19 42,21 37,25" fill="#E5484D" />
          <line x1="16" y1="40" x2="14" y2="48" stroke="#B3262B" strokeWidth="3" strokeLinecap="round" />
          <line x1="24" y1="40" x2="26" y2="48" stroke="#B3262B" strokeWidth="3" strokeLinecap="round" />
          <ellipse cx="20" cy="33" rx="10" ry="9" fill="#E5484D" />
          <circle cx="20" cy="18" r="10" fill="#E5484D" />
          <polygon points="12,12 9,2 17,9" fill="#7A1F22" />
          <polygon points="28,12 31,2 23,9" fill="#7A1F22" />
          <circle cx="16" cy="17" r="2.2" fill="#FBBF24" />
          <circle cx="24" cy="17" r="2.2" fill="#FBBF24" />
          <circle cx="16.6" cy="17" r="1" fill="#1A0E08" />
          <circle cx="24.6" cy="17" r="1" fill="#1A0E08" />
          <path d="M15 22 Q20 26.5 25 22" fill="none" stroke="#1A0E08" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="5" y1="12" x2="5" y2="48" stroke="#969AAC" strokeWidth="2" strokeLinecap="round" />
          <path d="M1 5v4a4 4 0 0 0 8 0V5M5 3v6" fill="none" stroke="#969AAC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="9" y1="31" x2="5" y2="29" stroke="#E5484D" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

function star(cx: number, cy: number, R: number, r: number) {
  let d = '';
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rad = k % 2 ? r : R;
    d += `${k ? 'L' : 'M'}${(cx + rad * Math.cos(a)).toFixed(1)} ${(cy + rad * Math.sin(a)).toFixed(1)} `;
  }
  return `${d}Z `;
}
// a crown of twelve stars on an arc
const CROWN = Array.from({ length: 12 }, (_, i) => {
  const a = ((200 + (i * 140) / 11) * Math.PI) / 180;
  return star(160 + 150 * Math.cos(a), 120 + 100 * Math.sin(a), 6, 2.6);
}).join('');

function Lily({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 80 C0 55 -2 35 2 14" fill="none" strokeWidth="1.6" />
      <ellipse cx="-8" cy="6" rx="5" ry="13" transform="rotate(-30 -8 6)" />
      <ellipse cx="8" cy="6" rx="5" ry="13" transform="rotate(30 8 6)" />
      <ellipse cx="0" cy="2" rx="5" ry="14" />
    </g>
  );
}

function Immaculate() {
  return (
    <div className="no-print pointer-events-none" aria-hidden data-testid="immaculate-decor">
      <div className="ic-ribbon"><span /><span /><span /></div>
      <svg className="ic-crown" viewBox="0 0 320 60"><path d={CROWN} /></svg>
      <svg className="ic-lilies ic-left" viewBox="0 0 160 120">
        <Lily x={40} y={40} s={1} />
        <Lily x={80} y={58} s={0.8} />
      </svg>
      <svg className="ic-lilies ic-right" viewBox="0 0 160 120">
        <circle className="ic-moon" cx="110" cy="30" r="16" />
        <circle className="ic-moon-cut" cx="117" cy="25" r="14" />
        <Lily x={70} y={50} s={0.9} />
      </svg>
    </div>
  );
}
