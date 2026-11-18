/**
 * kodigo epub <module dir | folder of modules | zip> [outDir] [--course <name>] [--title <text>] [--seed <n>]
 *
 * One EPUB per module, or with --course one book holding every module of that course (in manifest order).
 * Modules are validated first, like `pack`; an invalid module is refused.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { validateModule, formatIssue, parseModule, readZip, type FileMap, type ParsedModule } from '@kodigo/schema';
import { createNodeHost, readModuleDir } from '@kodigo/schema/node';
import { buildEpub, type EpubModule } from './epub/index';

const USAGE = 'usage: kodigo epub <module dir|folder of modules|zip> [outDir] [--course <name>] [--title <text>] [--seed <n>]';

async function isModuleDir(p: string) {
  try { await fs.access(path.join(p, 'manifest.yaml')); return true; } catch { return false; }
}

async function loadTargets(target: string): Promise<{ src: string; files: FileMap }[]> {
  const st = await fs.stat(target);
  if (!st.isDirectory()) {
    if (!target.endsWith('.zip')) throw new Error(USAGE);
    return [{ src: target, files: readZip(await fs.readFile(target)) as any }];
  }
  if (await isModuleDir(target)) return [{ src: target, files: await readModuleDir(target) }];
  const out: { src: string; files: FileMap }[] = [];
  for (const e of await fs.readdir(target, { withFileTypes: true })) {
    const p = path.join(target, e.name);
    if (e.isDirectory() && (await isModuleDir(p))) out.push({ src: p, files: await readModuleDir(p) });
  }
  return out;
}

async function prepare(src: string, files: FileMap): Promise<EpubModule> {
  const report = await validateModule(files, { hostFactory: (s) => createNodeHost(s) });
  if (!report.ok) {
    for (const e of report.issues.filter((i) => i.level === 'error')) console.error(`  ${formatIssue(e)}`);
    throw new Error(`${src} is invalid; fix it before exporting`);
  }
  const { module } = parseModule(files);
  return { parsed: module as ParsedModule, files: files as Record<string, string | Uint8Array> };
}

export async function cmdEpub(rest: string[]) {
  const opt = (name: string) => {
    const i = rest.indexOf(name);
    if (i < 0) return undefined;
    const v = rest[i + 1];
    if (v === undefined || v.startsWith('--')) throw new Error(`${name} needs a value\n${USAGE}`);
    rest.splice(i, 2);
    return v;
  };
  const course = opt('--course');
  const title = opt('--title');
  const seedArg = opt('--seed');
  const seed = seedArg === undefined ? undefined : Number(seedArg);
  if (seed !== undefined && !Number.isInteger(seed)) throw new Error('--seed must be an integer');
  const [target, outDir = 'dist/epub'] = rest.filter((a) => !a.startsWith('-'));
  if (!target) throw new Error(USAGE);

  let targets = await loadTargets(target);
  if (!targets.length) throw new Error(`no modules found in ${target}`);
  await fs.mkdir(outDir, { recursive: true });
  const hostFactory = (logic: string) => createNodeHost(logic);

  const write = async (name: string, mods: EpubModule[]) => {
    const r = await buildEpub(mods, { hostFactory, title, seed });
    const file = path.join(outDir, `${name}.epub`);
    await fs.writeFile(file, r.bytes);
    const kb = Math.round(r.bytes.length / 1024);
    console.log(`\x1b[32mwrote ${file}\x1b[0m  ${r.chapters} chapters · ${kb} KB`);
    const skipped = Object.entries(r.skipped).sort((a, b) => b[1] - a[1]);
    if (skipped.length) console.log(`\x1b[2m  left out (interactive): ${skipped.map(([k, n]) => `${k} ×${n}`).join(', ')}\x1b[0m`);
    if (r.mathErrors.length) {
      console.log(`\x1b[33m  ${r.mathErrors.length} math error(s):\x1b[0m`);
      for (const e of r.mathErrors.slice(0, 10)) console.log(`\x1b[33m    ${e}\x1b[0m`);
    }
  };

  if (course) {
    const parsed = targets.map((t) => ({ t, p: parseModule(t.files).module }));
    const picked = parsed.filter((x) => x.p?.manifest.course === course).sort((a, b) => (a.p!.manifest.order ?? 0) - (b.p!.manifest.order ?? 0) || a.p!.manifest.id.localeCompare(b.p!.manifest.id));
    if (!picked.length) {
      const known = [...new Set(parsed.map((x) => x.p?.manifest.course).filter(Boolean))].join(', ');
      throw new Error(`no module has course "${course}" (courses: ${known || 'none'})`);
    }
    targets = picked.map((x) => x.t);
    const mods: EpubModule[] = [];
    for (const t of targets) mods.push(await prepare(t.src, t.files));
    const slug = course.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'course';
    return write(slug, mods);
  }
  for (const t of targets) {
    const m = await prepare(t.src, t.files);
    await write(`${m.parsed.manifest.id}@${m.parsed.manifest.version}`, [m]);
  }
}
