#!/usr/bin/env node
// Download the pinned Pyodide release (Python 3.12 + pandas 2.2, the course's runtime) into
// apps/web/public/pyodide/, so the coding exam runs Python in the browser from our own origin.
// The files are not committed (.gitignore). Every file is checked by sha256: core files against the
// hashes pinned below, wheels against Pyodide's own lock file. Files already present and valid are skipped.
//
//   node scripts/fetch-pyodide.mjs              fetch or verify (fails on a network or hash error)
//   node scripts/fetch-pyodide.mjs --optional   same, but only warns on failure (used by `pnpm dev`)
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '0.27.8';
const BASE = `https://cdn.jsdelivr.net/pyodide/v${VERSION}/full/`;
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../apps/web/public/pyodide');
const CORE = {
  'pyodide.mjs': '0119dc60b71b676b53d61ef63f8847973f845d2c8cf2eee32a61773ed8b5b01e',
  'pyodide.asm.js': '8bd8175d6b97ee4ffff85c5aaf44130fad3e9322939826f2a52d27d786ef8908',
  'pyodide.asm.wasm': '92160102d09feeb8c738a07c870bde47fd4c141fd70b5376188bdd951df9ea23',
  'python_stdlib.zip': 'cb5f8d7eae384fcf27c574d8b13901de1753a50f93038130c326f85b88c9012b',
  'pyodide-lock.json': 'cb18729b18db7ce2482d196209c8051d8122441b817fc2f644d643b44e5e1b0f',
};
// pandas and everything it depends on in the lock file
const PACKAGES = ['pandas', 'numpy', 'python-dateutil', 'pytz', 'six'];

const optional = process.argv.includes('--optional');
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

async function ensure(name, hash) {
  const file = path.join(OUT, name);
  try {
    if (sha256(await fs.readFile(file)) === hash) return false;
  } catch { /* missing: download it */ }
  const res = await fetch(BASE + name);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const got = sha256(buf);
  if (got !== hash) throw new Error(`${name}: sha256 ${got} does not match the pinned ${hash}`);
  await fs.writeFile(file, buf);
  return true;
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  let fetched = 0;
  for (const [name, hash] of Object.entries(CORE)) if (await ensure(name, hash)) fetched++;
  const lock = JSON.parse(await fs.readFile(path.join(OUT, 'pyodide-lock.json'), 'utf8'));
  if (lock.info.version !== VERSION) throw new Error(`lock file is for Pyodide ${lock.info.version}, expected ${VERSION}`);
  for (const name of PACKAGES) {
    const p = lock.packages[name];
    if (!p) throw new Error(`package ${name} is not in the lock file`);
    for (const d of p.depends) if (!PACKAGES.includes(d)) throw new Error(`${name} depends on ${d}, which is not fetched`);
    if (await ensure(p.file_name, p.sha256)) fetched++;
  }
  let bytes = 0;
  for (const f of await fs.readdir(OUT)) bytes += (await fs.stat(path.join(OUT, f))).size;
  console.log(`pyodide ${VERSION} (Python ${lock.info.python}): ${fetched ? `fetched ${fetched} file(s)` : 'up to date'}, ${(bytes / 1e6).toFixed(1)} MB in apps/web/public/pyodide`);
}

main().catch((e) => {
  const msg = `pyodide fetch failed: ${e.message}`;
  if (optional) console.warn(`${msg} (the coding exam will not run until it succeeds)`);
  else { console.error(msg); process.exit(1); }
});
