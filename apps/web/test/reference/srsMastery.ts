/** Frozen copies of the SRS and mastery formulas before the audit fixes (3.21). Pure: previous row in, next row out. Do not change. */
import { srsGrade, type Confidence } from '../../src/storage/confidence';

const ALPHA = 0.3;
const W_D: Record<number, number> = { 1: 0.8, 2: 1, 3: 1.2 };
const DAY = 86400000;

export function refMastery(cur: { score: number; n: number } | undefined, score: number, difficulty = 2) {
  const c = cur ?? { score: 0, n: 0 };
  const w = W_D[difficulty] ?? 1;
  return { score: Math.min(1, Math.max(0, c.score + ALPHA * w * (score - c.score))), n: c.n + 1 };
}

export function refSrs(cur: { ease: number; interval: number; reps: number; lapses: number } | undefined, now: number, score: number, confidence?: Confidence) {
  let { ease, interval, reps, lapses } = cur ?? { ease: 2.5, interval: 0, reps: 0, lapses: 0 };
  const grade = srsGrade(score, confidence);
  if (grade < 3) {
    reps = 0;
    lapses += 1;
    interval = 0.25;
  } else {
    reps += 1;
    interval = reps === 1 ? 1 : reps === 2 ? 3 : Math.round(interval * ease);
  }
  ease = Math.max(1.3, ease + 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
  return { ease, interval, reps, lapses, due: now + interval * DAY };
}
