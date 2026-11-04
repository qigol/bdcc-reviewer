/** Row shapes of a progress export, mirroring db.ts. Unknown fields pass through; numbers must be finite. */
import { z } from 'zod';

const Time = z.number();

export const ROWS = {
  progress: z.looseObject({
    moduleId: z.string(), tab: z.enum(['intuition', 'math-code', 'application', 'quiz']), itemId: z.string(), status: z.enum(['seen', 'done']),
    beatIndex: z.number().optional(), moduleVersion: z.string().optional(), updatedAt: Time,
  }),
  attempts: z.looseObject({
    key: z.string(), templateId: z.string(), moduleId: z.string(), seed: z.number(), type: z.string(), skills: z.array(z.string()),
    score: z.number(), response: z.unknown(), timeMs: z.number(), mode: z.string(), at: Time, difficulty: z.number().optional(),
    confidence: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(), postSolution: z.literal(true).optional(), selfGraded: z.literal(true).optional(),
  }),
  srs: z.looseObject({ templateId: z.string(), moduleId: z.string(), ease: z.number(), interval: z.number(), due: z.number(), reps: z.number(), lapses: z.number(), updatedAt: Time }),
  mastery: z.looseObject({ skillKey: z.string(), score: z.number(), n: z.number(), updatedAt: Time }),
  notes: z.looseObject({ moduleId: z.string(), anchor: z.string(), text: z.string(), createdAt: Time, updatedAt: Time.optional() }),
  bookmarks: z.looseObject({ moduleId: z.string(), ref: z.string(), label: z.string(), createdAt: Time }),
  settings: z.looseObject({ key: z.string(), value: z.unknown(), updatedAt: Time.optional() }),
} as const;

export type TableName = keyof typeof ROWS;

/** The rows of `value` that match the table's shape, and how many didn't. */
export function validRows(table: TableName, value: unknown): { rows: any[]; skipped: number } {
  const list = Array.isArray(value) ? value : [];
  const rows = list.flatMap((r) => {
    const p = ROWS[table].safeParse(r);
    return p.success ? [p.data] : [];
  });
  return { rows, skipped: list.length - rows.length };
}
