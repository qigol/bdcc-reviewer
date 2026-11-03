/** Quiz summary math, kept pure so it can be tested without React. */

export interface SummarySlot { inst?: unknown; error?: string; graded?: { score: number } | null }

export function summarize<S extends SummarySlot>(slots: S[]) {
  const graded = slots.filter((s) => s.graded && s.inst);
  const score = graded.reduce((a, s) => a + s.graded!.score, 0);
  const denominator = graded.length;
  const pct = denominator ? score / denominator : 0;
  return { graded, score, denominator, pct };
}
