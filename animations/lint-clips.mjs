#!/usr/bin/env node
/**
 * Lint every clip in animations/clips/<module-id>/<clip-id>.html with the HyperFrames linter.
 * `hyperframes lint <dir>` only checks the project's index.html, so each clip is copied into a throwaway project
 * (as its index.html, with the kit linked next to it) and linted there.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HYPERFRAMES = 'hyperframes@0.8.175';
const here = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'anim-lint-'));
fs.symlinkSync(path.join(here, 'kit'), path.join(tmp, 'kit'));
fs.copyFileSync(path.join(here, 'hyperframes.json'), path.join(tmp, 'hyperframes.json'));

let failed = 0;
for (const mod of fs.readdirSync(path.join(here, 'clips')).sort()) {
  const dir = path.join(here, 'clips', mod);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir).sort().filter((x) => x.endsWith('.html'))) {
    fs.writeFileSync(path.join(tmp, 'index.html'), fs.readFileSync(path.join(dir, f), 'utf8').replaceAll('../../kit/', 'kit/'));
    const r = spawnSync('npx', ['--yes', HYPERFRAMES, 'lint', tmp], { encoding: 'utf8', env: { ...process.env, HYPERFRAMES_SKIP_SKILLS: '1' } });
    const ok = r.status === 0;
    if (!ok) failed++;
    console.log(`${ok ? '✓' : '✗'} ${mod}/${f}`);
    if (!ok) console.log((r.stdout + r.stderr).split('\n').filter((l) => !/telemetry|anonymous|File paths|HeyGen|^\s*$/.test(l)).join('\n'));
  }
}
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
