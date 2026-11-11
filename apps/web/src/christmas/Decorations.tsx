import { useChristmas } from './useChristmas';
import { useSeason } from '../season/useSeason';

const BULBS = 28;
const FLAKES = 26;
// fixed pseudo-random layout so flakes don't jump between renders
const rnd = (i: number, k: number) => ((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1;

/** String lights under the top bar and light snowfall, from Dec 9 (the Christmas season look) or while the countdown is live. Purely visual. */
export function Decorations() {
  const s = useChristmas();
  const season = useSeason();
  if (!s?.active && season !== 'christmas') return null;
  return (
    <div className="no-print pointer-events-none" aria-hidden data-testid="xmas-decor">
      <div className="xmas-lights">
        {Array.from({ length: BULBS }, (_, i) => <span key={i} className={`xmas-bulb xmas-bulb-${i % 4}`} style={{ animationDelay: `${(i % 7) * 0.35}s` }} />)}
      </div>
      <div className="xmas-snow">
        {Array.from({ length: FLAKES }, (_, i) => (
          <span
            key={i}
            className="xmas-flake"
            style={{
              left: `${rnd(i, 1) * 100}%`,
              fontSize: `${8 + rnd(i, 2) * 10}px`,
              animationDuration: `${11 + rnd(i, 3) * 12}s`,
              animationDelay: `${-rnd(i, 4) * 20}s`,
              ['--drift' as string]: `${(rnd(i, 5) - 0.5) * 80}px`,
            }}
          >{'❄︎' /* text style, so it takes the CSS colour instead of the emoji's */}</span>
        ))}
      </div>
    </div>
  );
}
