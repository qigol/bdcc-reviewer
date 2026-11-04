/**
 * A module's lightweight index: what cross-module pages (Dashboard, Glossary, Cheatsheet, quiz builder, Plan,
 * command palette) need, without its datasets, logic, widgets or binary files. The server builds it from
 * text files and serves all of them at GET /api/index, so those pages don't download every module.
 */
import { collectTermLinks } from './interpolate';
import { glossaryWithHomes, learningPath, type PathStep } from './guided';
import { variantCount } from './quiz';
import type { Manifest, Term } from './schemas';
import type { ParsedModule } from './validate';

export interface ModuleIndex {
  id: string;
  version: string;
  manifest: Manifest;
  /** with `lessonRef` defaulted to the scene that introduces the term */
  glossary: Term[];
  scenes: { id: string; title: string; goal: string; skills: string[]; beats: number; termLinks: string[]; errata: string[] }[];
  sections: { id: string; title: string; skills: string[]; steps: number; keyFormula?: string; examTip?: string; errata?: string[]; beyondSlides?: boolean; termLinks: string[] }[];
  application: { decisions: string[]; errata: string[]; termLinks: string[] };
  quiz: { id: string; type: string; difficulty: number; skills: string[]; generator?: string; variants: number }[];
  path: PathStep[];
  hasExam: boolean;
  hasCodingExam: boolean;
}

/** Every string inside a YAML-shaped value. */
function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out));
  return out;
}

/** Term ids linked with [[id]] anywhere inside a YAML-shaped value. */
export const linkedTermIds = (v: unknown) => new Set(strings(v).flatMap((s) => collectTermLinks(s).map((l) => l.id)));

/** The bodies of `Callout` widgets of kind `errata` anywhere inside a YAML-shaped value. */
export function collectErrata(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((v) => collectErrata(v, out));
  else if (value && typeof value === 'object') {
    const o = value as any;
    if (o.widget === 'Callout' && o.props?.kind === 'errata' && typeof o.props.body === 'string') out.push(o.props.body);
    Object.values(o).forEach((v) => collectErrata(v, out));
  }
  return out;
}

export function buildModuleIndex(p: ParsedModule): ModuleIndex {
  return {
    id: p.manifest.id,
    version: p.manifest.version,
    manifest: p.manifest,
    glossary: glossaryWithHomes(p.glossary, p.intuition),
    scenes: p.intuition.map((s) => {
      const ids = linkedTermIds(s);
      s.beats.forEach((b) => b.define?.forEach((d) => ids.add(d)));
      return { id: s.id, title: s.title, goal: s.goal, skills: s.skills ?? [], beats: s.beats.length, termLinks: [...ids], errata: collectErrata(s) };
    }),
    sections: p.mathCode.map((s) => ({
      id: s.id, title: s.title, skills: s.skills, steps: s.steps.length, keyFormula: s.keyFormula, examTip: s.examTip, errata: s.errata,
      beyondSlides: s.beyondSlides, termLinks: [...linkedTermIds(s)],
    })),
    application: {
      decisions: p.application.case.cells.filter((c) => c.decision).map((c) => c.id),
      errata: collectErrata(p.application),
      termLinks: [...linkedTermIds(p.application)],
    },
    quiz: p.quiz.map((t) => ({ id: t.id, type: t.type, difficulty: t.difficulty, skills: t.skills, generator: (t as { generator?: string }).generator, variants: variantCount(t) })),
    path: learningPath(p),
    hasExam: !!p.exam,
    hasCodingExam: !!p.exam?.coding,
  };
}
