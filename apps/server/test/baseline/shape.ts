import type { ValidationReport } from '@kodigo/schema';

/** "generator took N ms (limit 50 ms)" depends on machine load, not on behavior */
const timing = (m: string) => /took \d+ ms \(limit \d+ ms\)/.test(m);

/** The parts of a validation report that must not change: ok, and per issue level/step/file/path (not wording). */
export const reportShape = (r: ValidationReport) => ({
  ok: r.ok,
  issues: r.issues.filter((i) => !timing(i.message)).map((i) => ({ level: i.level, step: i.step, file: i.file ?? null, path: i.path ?? null })),
});
