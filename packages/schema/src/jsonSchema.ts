/** JSON Schema export of the module format (handy for LLMs and editors). */
import { z } from 'zod';
import { Manifest, Dataset, ExamplesFile, GlossaryFile, IntuitionFile, MathCodeFile, ApplicationFile, QuizFile, ExamFile } from './schemas';

export function moduleJsonSchemas(): Record<string, unknown> {
  const entries: [string, z.ZodType][] = [
    ['manifest.yaml', Manifest],
    ['datasets/<id>.yaml', Dataset],
    ['examples.yaml', ExamplesFile],
    ['glossary.yaml', GlossaryFile],
    ['intuition.yaml', IntuitionFile],
    ['math-code.yaml', MathCodeFile],
    ['application.yaml', ApplicationFile],
    ['quiz.yaml', QuizFile],
    ['exam.yaml (optional)', ExamFile],
  ];
  return Object.fromEntries(entries.map(([k, s]) => [k, z.toJSONSchema(s, { unrepresentable: 'any', cycles: 'ref' })]));
}
