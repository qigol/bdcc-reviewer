/** Quiz summary math, kept pure so it can be tested without React. */

export interface SummarySlot { inst?: unknown; error?: string; graded?: { score: number } | null }

/**
 * Questions that couldn't be generated are the app's fault, not the learner's: they are left out of the
 * score and listed in `failed`, and the summary says so.
 */
export function summarize<S extends SummarySlot>(slots: S[], items: { moduleId: string; templateId: string }[] = []) {
  const graded = slots.filter((s) => s.graded && s.inst);
  const failed = slots.flatMap((s, index) => (s.error ? [{ index, templateId: items[index]?.templateId ?? '', moduleId: items[index]?.moduleId ?? '', error: s.error }] : []));
  const score = graded.reduce((a, s) => a + s.graded!.score, 0);
  const denominator = graded.length;
  const pct = denominator ? score / denominator : 0;
  const note = failed.length ? `${failed.length} question${failed.length === 1 ? '' : 's'} couldn't be generated and ${failed.length === 1 ? "isn't" : "aren't"} counted` : '';
  return { graded, failed, score, denominator, pct, rule: 'excluded' as const, note };
}
