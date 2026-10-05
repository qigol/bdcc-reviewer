/**
 * Guided learning (guide §7.0): where each glossary term is introduced, and the module's learning path.
 * Pure functions over a parsed module; used by the validator and the web app.
 */
import type { Scene, Section, Term, Manifest, ApplicationFile } from './schemas';

/** term id → the first scene (and beat) whose `define` introduces it. */
export function termHomes(scenes: Scene[]): Record<string, { scene: string; beat: number }> {
  const out: Record<string, { scene: string; beat: number }> = {};
  for (const s of scenes) s.beats.forEach((b, i) => { for (const t of b.define ?? []) out[t] ??= { scene: s.id, beat: i }; });
  return out;
}

/** Glossary terms with `lessonRef` defaulting to the scene that introduces them. */
export function glossaryWithHomes(terms: Term[], scenes: Scene[]): Term[] {
  const homes = termHomes(scenes);
  return terms.map((t) => (t.lessonRef || !homes[t.id] ? t : { ...t, lessonRef: { tab: 'intuition' as const, id: homes[t.id].scene } }));
}

export type PathStep =
  | { kind: 'scene'; id: string; title: string; skills: string[]; terms: string[] }
  | { kind: 'section'; id: string; title: string; skills: string[]; tryIt: string[] }
  | { kind: 'case'; id: string; title: string; skills: string[] }
  | { kind: 'mastery'; id: 'mastery'; title: string; skills: string[] };

/**
 * The guided path: each Intuition scene, followed by the Math sections whose skills the scenes so far
 * have introduced (sections keep their own order), then the Application case, then a mastery check.
 */
export function learningPath(mod: { manifest: Manifest; intuition: Scene[]; mathCode: Section[]; application: ApplicationFile }): PathStep[] {
  const steps: PathStep[] = [];
  const covered = new Set<string>();
  const pending = [...mod.mathCode];
  const flush = (all: boolean) => {
    while (pending.length && (all || pending[0].skills.every((s) => covered.has(s)))) {
      const s = pending.shift()!;
      steps.push({ kind: 'section', id: s.id, title: s.title, skills: s.skills, tryIt: s.tryIt ?? [] });
    }
  };
  for (const sc of mod.intuition) {
    steps.push({ kind: 'scene', id: sc.id, title: sc.title, skills: sc.skills ?? [], terms: sc.beats.flatMap((b) => b.define ?? []) });
    (sc.skills ?? []).forEach((s) => covered.add(s));
    flush(false);
  }
  flush(true);
  const c = mod.application.case;
  steps.push({ kind: 'case', id: c.id, title: c.title, skills: [] });
  steps.push({ kind: 'mastery', id: 'mastery', title: 'Mastery check', skills: mod.manifest.skills.map((s) => s.id) });
  return steps;
}

/** Display name of the second study tab. */
export const workbenchTabLabel = (m: Pick<Manifest, 'workbench'>) => (m.workbench === 'journal' ? 'Math & Journal' : 'Math & Code');
