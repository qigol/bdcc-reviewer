// Export a coding mock exam for the real-pandas check (check.py). For each seed: the data files the learner gets, and
// the cells to run in order, exactly as shipped in exam.yaml: the setup cell, then for every problem its walkthrough
// steps and test cells, then every twist's solution and tests. Nothing here is shown to learners.
//
//   npx tsx scripts/exam-check/export.mts <module dir> [seeds=25] [out=exam-cases.json]
// (writes a UTF-8 file itself: a shell redirect in Windows PowerShell would write UTF-16)
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseModule, interpolate, type FileMap } from '../../packages/schema/src/index.ts';
import { createNodeHost } from '../../packages/schema/src/node.ts';

const [dir, seedsArg, outArg] = process.argv.slice(2);
if (!dir) throw new Error('usage: export.mts <module dir> [seeds]');
const files: FileMap = {};
async function walk(rel: string) {
  for (const e of await fs.readdir(path.join(dir, rel), { withFileTypes: true })) {
    const p = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) { if (!p.startsWith('assets')) await walk(p); } else if (/\.(ya?ml|js|md|json)$/.test(e.name)) files[p] = await fs.readFile(path.join(dir, p), 'utf8');
  }
}
await walk('');
const { module: mod, issues } = parseModule(files);
if (!mod) throw new Error(issues.map((i) => i.message).join('\n'));
const coding = mod.exam?.coding;
if (!coding) throw new Error('this module has no coding exam');
const host = await createNodeHost(mod.logic);
const seeds = Number(seedsArg ?? 25);
const cases = [];
for (let seed = 1; seed <= seeds; seed++) {
  const r = await host.generate(coding.story, seed, 3);
  if (r.error || !r.output) throw new Error(`seed ${seed}: ${r.error}`);
  const vars = r.output.vars;
  const fill = (t: string) => interpolate(t, vars, { mode: 'md' }).text;
  const cells: { label: string; code: string }[] = [{ label: 'setup', code: fill(coding.setup) }];
  for (const p of coding.problems) {
    (p.walkthrough ?? []).forEach((s, i) => cells.push({ label: `${p.id} walkthrough step ${i + 1}`, code: fill(s.code) }));
    p.tests.forEach((t, i) => cells.push({ label: `${p.id} test ${i + 1}`, code: fill(t.code) }));
  }
  for (const p of coding.problems) for (const t of p.twists ?? []) {
    cells.push({ label: `${p.id} twist ${t.id}: solution`, code: fill(t.solution) });
    t.tests.forEach((code, i) => cells.push({ label: `${p.id} twist ${t.id}: test ${i + 1}`, code: fill(code) }));
  }
  const dataFiles = Object.fromEntries(Object.entries(coding.files).map(([p, v]) => [fill(p), String(vars[v])]));
  cases.push({ seed, dataDir: String(vars.dataDir ?? ''), files: dataFiles, cells });
}
host.dispose?.();
const out = outArg ?? 'exam-cases.json';
await fs.writeFile(out, JSON.stringify({ module: mod.manifest.id, version: mod.manifest.version, cases }), 'utf8');
console.log(`wrote ${cases.length} seeds to ${out}`);
