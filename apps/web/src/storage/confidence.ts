/** How sure the learner said they were before checking: 1 = guessing, 2 = fairly sure, 3 = certain. */
export type Confidence = 1 | 2 | 3;
export const CONFIDENCE_LABEL: Record<Confidence, string> = { 1: 'Guessing', 2: 'Fairly sure', 3: 'Certain' };

/**
 * SM-2 grade (0–5) for an attempt. Without a confidence rating it follows the score alone. With one:
 * - confidently wrong (certain, score < 0.5) → 0: the shortest interval and the biggest ease drop, since
 *   high-confidence errors are the ones feedback corrects best (hypercorrection) and must come back soon;
 * - a lucky guess (guessing, but right) → 2: rescheduled like a miss, not counted as known;
 * - right but only fairly sure → at most 4.
 */
export function srsGrade(score: number, confidence?: Confidence): number {
  const g = score >= 0.95 ? 5 : score >= 0.75 ? 4 : score >= 0.5 ? 3 : score >= 0.25 ? 2 : 1;
  if (!confidence) return g;
  if (confidence === 3 && score < 0.5) return 0;
  if (confidence === 1 && g >= 3) return 2;
  if (confidence === 2) return Math.min(g, 4);
  return g;
}

export interface Calibration { rated: number; byLevel: Record<Confidence, { n: number; right: number }>; confidentlyWrong: number; luckyGuesses: number }

/** Summary of how well confidence matched results ("right" = full credit). */
export function calibration(items: { confidence?: Confidence; correct: boolean; score: number }[]): Calibration {
  const byLevel: Calibration['byLevel'] = { 1: { n: 0, right: 0 }, 2: { n: 0, right: 0 }, 3: { n: 0, right: 0 } };
  let confidentlyWrong = 0, luckyGuesses = 0, rated = 0;
  for (const it of items) {
    if (!it.confidence) continue;
    rated++;
    byLevel[it.confidence].n++;
    if (it.correct) byLevel[it.confidence].right++;
    if (it.confidence === 3 && it.score < 0.5) confidentlyWrong++;
    if (it.confidence === 1 && it.correct) luckyGuesses++;
  }
  return { rated, byLevel, confidentlyWrong, luckyGuesses };
}
