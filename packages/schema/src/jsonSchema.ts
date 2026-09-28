/** JSON Schema export of the module format (handy for LLMs and editors). */
import { zodToJsonSchema } from 'zod-to-json-schema';
import { Manifest, Dataset, ExamplesFile, GlossaryFile, IntuitionFile, MathCodeFile, ApplicationFile, QuizFile } from './schemas';

export function moduleJsonSchemas(): Record<string, unknown> {
  const entries: [string, any][] = [
    ['manifest.yaml', Manifest],
    ['datasets/<id>.yaml', Dataset],
    ['examples.yaml', ExamplesFile],
    ['glossary.yaml', GlossaryFile],
    ['intuition.yaml', IntuitionFile],
    ['math-code.yaml', MathCodeFile],
    ['application.yaml', ApplicationFile],
    ['quiz.yaml', QuizFile],
  ];
  return Object.fromEntries(entries.map(([k, s]) => [k, zodToJsonSchema(s, { $refStrategy: 'none' })]));
}
