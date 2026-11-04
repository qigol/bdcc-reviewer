/** Request body schemas for admin routes. Unknown keys are stripped, not rejected, so older clients keep working. */
import { z } from 'zod';

export const ModulePatch = z.object({
  enabled: z.boolean().optional(),
  order: z.number().finite().optional(),
  current: z.string().min(1).max(64).regex(/^[0-9A-Za-z.+-]+$/).optional(),
  course: z.string().max(80).nullable().optional(),
}).strip();
export type ModulePatch = z.infer<typeof ModulePatch>;

/** `invalid body: <path>: <message>` for the first issue */
export function bodyError(e: z.ZodError): string {
  const i = e.issues[0];
  return `invalid body: ${i.path.length ? i.path.join('.') + ': ' : ''}${i.message}`;
}
