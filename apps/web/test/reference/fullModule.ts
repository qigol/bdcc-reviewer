/**
 * Frozen reference (audit task 2/24): how cross-module pages derived their data from full parsed modules before
 * they moved to the module index. Do not change it to make a test pass.
 */
import { collectTermLinks, glossaryTemplateIds, glossaryKind, glossaryWithHomes, type ParsedModule } from '@kodigo/schema';

function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out));
  return out;
}
const linkedIds = (v: unknown) => new Set(strings(v).flatMap((s) => collectTermLinks(s).map((l) => l.id)));

export function refNotes(mods: ParsedModule[]) {
  const defs = new Map<string, { mod: string; term: string; short: string; lessonRef: unknown }[]>();
  const mentions = new Map<string, { mod: string; kind: string; title: string; to: string }[]>();
  const out = new Map<string, Set<string>>();
  const mention = (id: string, m: { mod: string; kind: string; title: string; to: string }) => {
    const list = mentions.get(id) ?? [];
    if (!list.some((x) => x.to === m.to)) list.push(m);
    mentions.set(id, list);
  };
  for (const p of mods) {
    const mod = p.manifest.id;
    const known = new Set(p.glossary.map((t) => t.id));
    for (const term of glossaryWithHomes(p.glossary, p.intuition)) {
      defs.set(term.id, [...(defs.get(term.id) ?? []), { mod, term: term.term, short: term.short, lessonRef: term.lessonRef ?? null }]);
      const to = out.get(term.id) ?? new Set();
      for (const r of [...(term.related ?? []), ...linkedIds([term.short, term.long])]) if (r !== term.id && known.has(r)) to.add(r);
      out.set(term.id, to);
    }
    for (const s of p.intuition) {
      const ids = linkedIds(s);
      s.beats.forEach((b) => b.define?.forEach((d) => ids.add(d)));
      for (const id of ids) if (known.has(id)) mention(id, { mod, kind: 'scene', title: s.title, to: `/m/${mod}/intuition/${s.id}` });
    }
    for (const s of p.mathCode) for (const id of linkedIds(s)) if (known.has(id)) mention(id, { mod, kind: 'section', title: s.title, to: `/m/${mod}/math-code/${s.id}` });
    for (const id of linkedIds(p.application)) if (known.has(id)) mention(id, { mod, kind: 'case', title: 'Application case', to: `/m/${mod}/application` });
  }
  return { defs, mentions, out };
}

export function refCandidates(mods: ParsedModule[], glossary: boolean) {
  const res: { moduleId: string; templateId: string; type: string; skills: string[]; difficulty: number; glossary?: boolean }[] = [];
  for (const p of mods) {
    const m = p.manifest.id;
    for (const t of p.quiz) res.push({ moduleId: m, templateId: t.id, type: t.type, skills: t.skills, difficulty: t.difficulty });
    if (glossary) {
      for (const id of glossaryTemplateIds(p.glossary)) {
        const kind = glossaryKind(id);
        const term = p.glossary.find((g) => id.endsWith(`-${g.id}`));
        res.push({ moduleId: m, templateId: id, type: kind.type, skills: term?.skills ?? [], difficulty: kind.difficulty, glossary: true });
      }
    }
  }
  return res;
}

export function refErrata(p: ParsedModule, collect: (v: unknown) => string[]) {
  return [...new Set([...p.mathCode.flatMap((s) => s.errata ?? []), ...collect(p.intuition), ...collect(p.application)])];
}
