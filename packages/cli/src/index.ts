#!/usr/bin/env tsx
/**
 * kodigo CLI
 *   kodigo validate <dir|zip> [...]     validate modules (all 7 steps, logic runs in node:vm)
 *   kodigo pack <dir> [outDir]          write <id>@<version>.zip and .bundle.txt
 *   kodigo unbundle <file.txt> [outDir] split LLM bundle text into a module folder
 *   kodigo widgets-doc <out.md>         generate WIDGETS.md from the widget catalog
 *   kodigo json-schema <out.json>       export the module JSON Schemas
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  validateModule, formatIssue, fixRequest, parseBundle, formatBundle, readZip, writeZip, widgetsMarkdown, moduleJsonSchemas,
  type FileMap,
} from '@kodigo/schema';
import { createNodeHost, readModuleDir } from '@kodigo/schema/node';

const c = {
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

async function load(target: string): Promise<FileMap> {
  const st = await fs.stat(target);
  if (st.isDirectory()) return readModuleDir(target);
  if (target.endsWith('.zip')) return readZip(await fs.readFile(target));
  if (target.endsWith('.txt') || target.endsWith('.md')) return parseBundle(await fs.readFile(target, 'utf8')).files;
  throw new Error(`Don't know how to read ${target} (folder, .zip or bundle .txt)`);
}

async function cmdValidate(targets: string[], flags: Set<string>) {
  let failed = 0;
  const expanded: string[] = [];
  for (const t of targets) {
    try {
      const st = await fs.stat(t);
      if (st.isDirectory() && !(await exists(path.join(t, 'manifest.yaml'))) && !(await exists(path.join(t, 'manifest.json')))) {
        // a folder of modules
        for (const e of await fs.readdir(t, { withFileTypes: true })) if (e.isDirectory()) expanded.push(path.join(t, e.name));
        continue;
      }
    } catch {}
    expanded.push(t);
  }
  for (const target of expanded) {
    const files = await load(target);
    const t0 = Date.now();
    const report = await validateModule(files, { hostFactory: (src) => createNodeHost(src) });
    const errors = report.issues.filter((i) => i.level === 'error');
    const warnings = report.issues.filter((i) => i.level === 'warning');
    console.log('');
    console.log(c.bold(`${report.ok ? c.green('✓') : c.red('✗')} ${report.id ?? target}@${report.version ?? '?'}  ${c.dim(target)}  ${c.dim(`${Date.now() - t0} ms`)}`));
    for (const s of report.steps) {
      const icon = s.status === 'ok' ? c.green('✓') : s.status === 'warn' ? c.yellow('⚠') : s.status === 'error' ? c.red('✗') : c.dim('–');
      console.log(`  ${icon} ${s.label}`);
    }
    if (report.stats) console.log(c.dim(`  examples ${report.stats.examplesPassed}/${report.stats.examples} · ${report.stats.scenes} scenes · ${report.stats.sections} sections · ${report.stats.templates} templates · ${report.stats.instances} quiz instances`));
    for (const e of errors) console.log('  ' + c.red(formatIssue(e)));
    const showWarn = flags.has('--warnings') || flags.has('-w');
    if (warnings.length) {
      if (showWarn) for (const w of warnings) console.log('  ' + c.yellow(formatIssue(w)));
      else console.log(c.dim(`  ${warnings.length} warning(s) (use --warnings to list)`));
    }
    if (!report.ok) {
      failed++;
      if (flags.has('--fix-request')) { console.log('\n' + fixRequest(report)); }
    }
    if (flags.has('--strict') && warnings.length) failed++;
  }
  if (failed) process.exitCode = 1;
}

async function exists(p: string) { try { await fs.access(p); return true; } catch { return false; } }

async function cmdPack(dir: string, outDir = 'dist/modules') {
  const files = await readModuleDir(dir);
  const report = await validateModule(files, { hostFactory: (src) => createNodeHost(src) });
  if (!report.ok) {
    for (const e of report.issues.filter((i) => i.level === 'error')) console.log(c.red(formatIssue(e)));
    throw new Error('module is invalid; fix it before packing');
  }
  await fs.mkdir(outDir, { recursive: true });
  const base = `${report.id}@${report.version}`;
  await fs.writeFile(path.join(outDir, `${base}.zip`), await writeZip(files, report.id));
  await fs.writeFile(path.join(outDir, `${base}.bundle.txt`), formatBundle(report.id!, report.version!, files));
  console.log(c.green(`packed ${path.join(outDir, base)}.zip and .bundle.txt`));
}

async function cmdUnbundle(file: string, outDir?: string) {
  const b = parseBundle(await fs.readFile(file, 'utf8'));
  for (const e of b.errors) console.log(c.yellow(e));
  const dir = outDir ?? path.join('modules', b.id ?? 'unbundled');
  for (const [p, content] of Object.entries(b.files)) {
    const full = path.join(dir, p);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content);
  }
  console.log(c.green(`wrote ${Object.keys(b.files).length} files to ${dir}`));
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const flags = new Set(rest.filter((a) => a.startsWith('-')));
  const args = rest.filter((a) => !a.startsWith('-'));
  switch (cmd) {
    case 'validate':
      if (!args.length) throw new Error('usage: kodigo validate <dir|zip|bundle.txt> [...] [--warnings] [--fix-request] [--strict]');
      return cmdValidate(args, flags);
    case 'pack':
      if (!args[0]) throw new Error('usage: kodigo pack <dir> [outDir]');
      return cmdPack(args[0], args[1]);
    case 'unbundle':
      if (!args[0]) throw new Error('usage: kodigo unbundle <bundle.txt> [outDir]');
      return cmdUnbundle(args[0], args[1]);
    case 'widgets-doc': {
      const out = args[0] ?? 'docs/WIDGETS.md';
      await fs.writeFile(out, widgetsMarkdown());
      return console.log(c.green(`wrote ${out}`));
    }
    case 'json-schema': {
      const out = args[0] ?? 'docs/module.schema.json';
      await fs.writeFile(out, JSON.stringify(moduleJsonSchemas(), null, 2));
      return console.log(c.green(`wrote ${out}`));
    }
    default:
      console.log('kodigo <validate|pack|unbundle|widgets-doc|json-schema> …');
      if (cmd) process.exitCode = 1;
  }
}

main().catch((e) => { console.error(c.red(String(e?.message ?? e))); process.exitCode = 1; });
