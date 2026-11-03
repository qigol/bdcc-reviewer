import type { ValidationReport } from '@kodigo/schema';

/** The parts of a validation report that must not change: ok, and per issue level/step/file/path (not wording). */
export const reportShape = (r: ValidationReport) => ({
  ok: r.ok,
  issues: r.issues.map((i) => ({ level: i.level, step: i.step, file: i.file ?? null, path: i.path ?? null })),
});
