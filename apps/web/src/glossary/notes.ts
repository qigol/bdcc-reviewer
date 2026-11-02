import { collectTermLinks, glossaryWithHomes, type Term } from '@kodigo/schema';
import type { LoadedModule } from '../modules/store';

/**
 * The glossary as a set of linked notes (guide §5.6). A note is one term id across every module:
 * modules that define the same id share one note, which shows each module's definition.
 */

/** One module's definition of a note's term (lessonRef defaults to the scene that introduces it). */
export interface NoteDef { mod: LoadedModule; term: Term }

/** A lesson place whose text links the term with [[id]] or introduces it with `define:`. */
export interface Mention { mod: LoadedModule; kind: 'scene' | 'section' | 'case'; title: string; to: string }

export interface Note {
  id: string;
  /** the name most modules use; the other names join `aka` */
  title: string;
  aka: string[];
  defs: NoteDef[];
  /** notes this one links to: `related` plus [[links]] in its text */
  links: string[];
  /** notes that link here */
  backlinks: string[];
  mentions: Mention[];
}

export interface NoteIndex {
  notes: Map<string, Note>;
  /** sorted by title */
  list: Note[];
  /** undirected, each pair once */
  edges: [string, string][];
  neighbors: Map<string, Set<string>>;
}

export const noteHref = (id: string) => `/glossary/${id}`;

/** Every string inside a YAML-shaped value. */
function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out));
  return out;
}
const linkedIds = (v: unknown) => new Set(strings(v).flatMap((s) => collectTermLinks(s).map((l) => l.id)));

function mostCommon(names: string[]): string {
  const n = new Map<string, number>();
  names.forEach((x) => n.set(x, (n.get(x) ?? 0) + 1));
  return [...n.entries()].reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

export function buildNotes(mods: LoadedModule[]): NoteIndex {
  const defs = new Map<string, NoteDef[]>();
  const mentions = new Map<string, Mention[]>();
  const out = new Map<string, Set<string>>();
  const mention = (id: string, m: Mention) => {
    const list = mentions.get(id) ?? [];
    if (!list.some((x) => x.to === m.to)) list.push(m);
    mentions.set(id, list);
  };

  for (const mod of mods) {
    const p = mod.parsed;
    const known = new Set(p.glossary.map((t) => t.id));
    for (const term of glossaryWithHomes(p.glossary, p.intuition)) {
      defs.set(term.id, [...(defs.get(term.id) ?? []), { mod, term }]);
      const to = out.get(term.id) ?? new Set();
      for (const r of [...(term.related ?? []), ...linkedIds([term.short, term.long])]) if (r !== term.id && known.has(r)) to.add(r);
      out.set(term.id, to);
    }
    for (const s of p.intuition) {
      const ids = linkedIds(s);
      s.beats.forEach((b) => b.define?.forEach((d) => ids.add(d)));
      for (const id of ids) if (known.has(id)) mention(id, { mod, kind: 'scene', title: s.title, to: `/m/${mod.id}/intuition/${s.id}` });
    }
    for (const s of p.mathCode) for (const id of linkedIds(s)) if (known.has(id)) mention(id, { mod, kind: 'section', title: s.title, to: `/m/${mod.id}/math-code/${s.id}` });
    for (const id of linkedIds(p.application)) if (known.has(id)) mention(id, { mod, kind: 'case', title: 'Application case', to: `/m/${mod.id}/application` });
  }

  const back = new Map<string, Set<string>>();
  const neighbors = new Map<string, Set<string>>();
  const edges: [string, string][] = [];
  const seen = new Set<string>();
  for (const id of defs.keys()) neighbors.set(id, new Set());
  for (const [a, to] of out) {
    for (const b of to) {
      back.set(b, (back.get(b) ?? new Set()).add(a));
      neighbors.get(a)!.add(b);
      neighbors.get(b)!.add(a);
      const k = a < b ? `${a} ${b}` : `${b} ${a}`;
      if (!seen.has(k)) { seen.add(k); edges.push(a < b ? [a, b] : [b, a]); }
    }
  }

  const notes = new Map<string, Note>();
  for (const [id, ds] of defs) {
    const title = mostCommon(ds.map((d) => d.term.term));
    const aka = [...new Set(ds.flatMap((d) => [d.term.term, ...(d.term.aka ?? [])]))].filter((x) => x !== title);
    notes.set(id, { id, title, aka, defs: ds, links: [...(out.get(id) ?? [])], backlinks: [...(back.get(id) ?? [])], mentions: mentions.get(id) ?? [] });
  }
  const list = [...notes.values()].sort((a, b) => a.title.localeCompare(b.title));
  return { notes, list, edges, neighbors };
}

/** Ids within `depth` links of `id` (including it). */
export function around(index: NoteIndex, id: string, depth: number): Set<string> {
  const keep = new Set([id]);
  let frontier = [id];
  for (let d = 0; d < depth; d++) {
    const next: string[] = [];
    for (const x of frontier) for (const y of index.neighbors.get(x) ?? []) if (!keep.has(y)) { keep.add(y); next.push(y); }
    frontier = next;
  }
  return keep;
}
