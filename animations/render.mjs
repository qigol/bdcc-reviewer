#!/usr/bin/env node
/**
 * Render the HyperFrames clips in animations/clips/<module-id>/<clip-id>.html and convert them into the module:
 *   modules/<module-id>/assets/anim/<clip-id>.webm, .mp4, .poster.jpg   (guide §9a.2, steps 4–5)
 *
 *   pnpm anim:render                      every clip
 *   pnpm anim:render nationalization …    only these clip ids (or module ids)
 *   pnpm anim:render --draft …            fast, low-quality renders for checking motion (not converted)
 *
 * Needs ffmpeg/ffprobe on the PATH; the HyperFrames CLI downloads its own pinned Chrome on first use.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HYPERFRAMES = 'hyperframes@0.8.175';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const args = process.argv.slice(2);
const draft = args.includes('--draft');
const only = args.filter((a) => !a.startsWith('--'));

const clips = [];
for (const mod of fs.readdirSync(path.join(here, 'clips')).sort()) {
  const dir = path.join(here, 'clips', mod);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir).sort()) if (f.endsWith('.html')) clips.push({ mod, id: f.slice(0, -5) });
}
const todo = only.length ? clips.filter((c) => only.includes(c.id) || only.includes(c.mod)) : clips;
if (!todo.length) {
  console.error(`No clips match ${only.join(', ')}. Clips: ${clips.map((c) => c.id).join(', ')}`);
  process.exit(1);
}

// clips the widget plays in one piece (no start/end segments): their poster must be the first frame, not the ending
const FIRST_FRAME_POSTER = new Set(['cost-gap', 'follow-the-money', 'transfer-pricing']);

const run = (cmd, argv) => {
  const r = spawnSync(cmd, argv, { stdio: 'inherit', cwd: root, env: { ...process.env, HYPERFRAMES_SKIP_SKILLS: '1' } });
  if (r.status !== 0) throw new Error(`${cmd} ${argv.join(' ')} failed`);
};

fs.mkdirSync(path.join(here, 'renders'), { recursive: true });
for (const { mod, id } of todo) {
  const render = path.join('animations', 'renders', `${id}${draft ? '.draft' : ''}.webm`);
  console.log(`\n▶ ${mod}/${id}`);
  run('npx', ['--yes', HYPERFRAMES, 'render', 'animations', '-c', `clips/${mod}/${id}.html`, '--format', 'webm', '--fps', '30',
    '--quality', draft ? 'draft' : 'high', '--quiet', '-o', render]);
  if (draft) continue;
  // the clips paint their own navy background, so the alpha HyperFrames writes into every webm is dropped
  run('pnpm', ['-s', 'kodigo', 'animation', render, path.join('modules', mod, 'assets', 'anim', id), '--flatten', '--bg', '#0B1D3A',
    ...(FIRST_FRAME_POSTER.has(id) ? ['--poster', 'start'] : [])]);
}
