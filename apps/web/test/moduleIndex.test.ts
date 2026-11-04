/**
 * Preservation (3.6, 3.20, 3.24): pages that moved from full modules to the module index derive the same data
 * as the frozen full-module reference, for every built-in module.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildModuleIndex, collectErrata, learningPath, parseModule, type ModuleIndex, type ParsedModule } from '@kodigo/schema';
import { readModuleDir } from '@kodigo/schema/node';
import { buildNotes } from '../src/glossary/notes';
import { candidates } from '../src/quiz/session';
import { refCandidates, refErrata, refNotes } from './reference/fullModule';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../modules');
const ids = fs.readdirSync(root).filter((d) => fs.existsSync(path.join(root, d, 'manifest.yaml'))).sort();
const sorted = <T>(a: T[]) => [...a].map((x) => JSON.stringify(x)).sort();

describe('module index matches the full modules', () => {
  let parsed: ParsedModule[];
  let indexes: ModuleIndex[];
  beforeAll(async () => {
    parsed = [];
    for (const id of ids) {
      const { module } = parseModule(await readModuleDir(path.join(root, id)));
      parsed.push(module!);
    }
    indexes = parsed.map(buildModuleIndex);
  }, 120_000);

  it('glossary notes: definitions, links, mentions', () => {
    const ref = refNotes(parsed);
    const got = buildNotes(indexes);
    expect([...got.notes.keys()].sort()).toEqual([...ref.defs.keys()].sort());
    for (const [id, note] of got.notes) {
      expect(note.defs.map((d) => ({ mod: d.mod.id, term: d.term.term, short: d.term.short, lessonRef: d.term.lessonRef ?? null })), id).toEqual(ref.defs.get(id));
      expect(new Set(note.links), id).toEqual(ref.out.get(id) ?? new Set());
      expect(sorted(note.mentions.map((m) => ({ mod: m.mod.id, kind: m.kind, title: m.title, to: m.to }))), id).toEqual(sorted(ref.mentions.get(id) ?? []));
    }
  });

  it('quiz candidates', () => {
    const cfg = { modules: ids, types: [], skills: [], difficulties: [] };
    expect(candidates(indexes, { ...cfg, glossary: true })).toEqual(refCandidates(parsed, true));
    expect(candidates(indexes, { ...cfg, glossary: false })).toEqual(refCandidates(parsed, false));
  });

  it('learning path, cheat sheet errata and dashboard counts', () => {
    parsed.forEach((p, i) => {
      const x = indexes[i];
      expect(x.path).toEqual(learningPath(p));
      const errata = [...new Set([...x.sections.flatMap((s) => s.errata ?? []), ...x.scenes.flatMap((s) => s.errata), ...x.application.errata])];
      expect(errata).toEqual(refErrata(p, (v) => collectErrata(v)));
      expect([x.scenes.length, x.sections.length]).toEqual([p.intuition.length, p.mathCode.length]);
      expect(x.application.decisions).toEqual(p.application.case.cells.filter((c) => c.decision).map((c) => c.id));
      expect(x.scenes.map((s) => s.beats)).toEqual(p.intuition.map((s) => s.beats.length));
      expect(x.sections.map((s) => s.steps)).toEqual(p.mathCode.map((s) => s.steps.length));
    });
  });
});
