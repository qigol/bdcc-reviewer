/**
 * kodigo animation <render> <out-prefix> [options]   (guide §9a.5)
 *
 * Converts a HyperFrames render (mp4, webm, mov, gif, png-sequence folder or hls folder) into what the Animation
 * widget plays: <prefix>.webm (VP9, keeps transparency), <prefix>.mp4 (H.264, plays everywhere, transparency
 * flattened onto --bg) and <prefix>.poster.jpg. It also scales to ≤ --width, strips audio and adds the fast-start
 * flag, then prints the YAML to paste. Needs ffmpeg and ffprobe on the PATH.
 *
 *   pnpm kodigo animation renders/overhead-spreads.webm modules/joc-demo/assets/anim/overhead-spreads
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export interface AnimationOptions {
  width: number;          // max output width (px)
  fps: number;            // frame folders: input frame rate
  poster: 'end' | 'start' | number;
  flatten: boolean;       // drop transparency in the .webm too
  bg: string;             // colour transparency is flattened onto
  crfWebm: number;
  crfMp4: number;
  mp4: boolean;
  webm: boolean;
}

export const ANIMATION_USAGE = `usage: kodigo animation <render> <out-prefix> [--width 1280] [--fps 30] [--poster end|start|<s>] [--flatten] [--bg '#ffffff'] [--crf-webm 34] [--crf-mp4 23] [--no-mp4] [--no-webm]
  <render>      a HyperFrames render: .mp4, .webm, .mov, .gif, an animated .webp/.apng, a png-sequence folder or an hls folder
  <out-prefix>  e.g. modules/<id>/assets/anim/<clip-id>  →  <clip-id>.webm, <clip-id>.mp4, <clip-id>.poster.jpg`;

export function parseAnimationArgs(argv: string[]): { input: string; out: string; opts: AnimationOptions } {
  const opts: AnimationOptions = { width: 1280, fps: 30, poster: 'end', flatten: false, bg: '#ffffff', crfWebm: 34, crfMp4: 23, mp4: true, webm: true };
  const pos: string[] = [];
  const num = (flag: string, v: string | undefined) => {
    const n = Number(v);
    if (v === undefined || !Number.isFinite(n)) throw new Error(`${flag} needs a number\n${ANIMATION_USAGE}`);
    return n;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const [flag, inline] = a.startsWith('--') && a.includes('=') ? [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)] : [a, undefined];
    const val = () => inline ?? argv[++i];
    switch (flag) {
      case '--width': opts.width = num(flag, val()); break;
      case '--fps': opts.fps = num(flag, val()); break;
      case '--poster': {
        const v = val();
        opts.poster = v === 'end' || v === 'start' ? v : num(flag, v);
        break;
      }
      case '--flatten': opts.flatten = true; break;
      case '--bg': opts.bg = val() ?? opts.bg; break;
      case '--crf-webm': opts.crfWebm = num(flag, val()); break;
      case '--crf-mp4': opts.crfMp4 = num(flag, val()); break;
      case '--no-mp4': opts.mp4 = false; break;
      case '--no-webm': opts.webm = false; break;
      default:
        if (a.startsWith('-')) throw new Error(`unknown option ${a}\n${ANIMATION_USAGE}`);
        pos.push(a);
    }
  }
  if (pos.length !== 2) throw new Error(ANIMATION_USAGE);
  if (!opts.mp4 && !opts.webm) throw new Error('--no-mp4 and --no-webm together leave nothing to write');
  if (!/^#?[0-9a-f]{6}$/i.test(opts.bg)) throw new Error(`--bg must be a hex colour like '#ffffff' (got ${opts.bg})`);
  return { input: pos[0], out: pos[1].replace(/\.(webm|mp4)$/i, ''), opts };
}

function run(cmd: string, args: string[]): string {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) {
    if ((r.error as NodeJS.ErrnoException).code === 'ENOENT') throw new Error(`${cmd} not found. Install FFmpeg (it includes ffprobe) and put it on your PATH: https://ffmpeg.org/download.html`);
    throw r.error;
  }
  if (r.status !== 0) throw new Error(`${cmd} failed:\n${(r.stderr || r.stdout).split('\n').slice(-12).join('\n')}`);
  return r.stdout;
}

interface Source { args: string[]; width: number; height: number; duration: number; fps: number; alpha: boolean; label: string }

const FRAME_EXT = /\.(png|jpe?g|webp)$/i;

/** Work out how ffmpeg should read the render, and what it is. */
function probeSource(input: string, opts: AnimationOptions): Source {
  if (!fs.existsSync(input)) throw new Error(`no such file or folder: ${input}`);
  let args: string[];
  let label: string;
  let frames = 0;
  let probeTarget = input;
  let vp9alpha = false;
  if (fs.statSync(input).isDirectory()) {
    const names = fs.readdirSync(input).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const m3u8 = names.find((n) => n === 'master.m3u8') ?? names.find((n) => n.endsWith('.m3u8'));
    if (m3u8) {
      args = ['-i', path.join(input, m3u8)];
      probeTarget = path.join(input, m3u8);
      label = 'hls folder';
    } else {
      const imgs = names.filter((n) => FRAME_EXT.test(n));
      if (imgs.length < 2) throw new Error(`${input}: a frame folder needs at least 2 .png/.jpg/.webp frames`);
      const ext = path.extname(imgs[0]);
      frames = imgs.filter((n) => path.extname(n) === ext).length;
      probeTarget = path.join(input, imgs[0]);
      // concat list keeps natural sort order and works with any file names
      const list = path.join(fs.mkdtempSync(path.join(fs.realpathSync(path.dirname(path.resolve(input))), '.kodigo-anim-')), 'frames.txt');
      fs.writeFileSync(list, imgs.filter((n) => path.extname(n) === ext).map((n) => `file '${path.resolve(input, n).replace(/'/g, "'\\''")}'\nduration ${1 / opts.fps}`).join('\n') + '\n');
      args = ['-f', 'concat', '-safe', '0', '-r', String(opts.fps), '-i', list];
      label = `frame folder (${frames} frames at ${opts.fps} fps)`;
    }
  } else {
    const ext = path.extname(input).toLowerCase();
    if (ext === '.html' || ext === '.htm') throw new Error(`${input} is a composition: render it first (npx hyperframes render … -o renders/<clip-id>.webm)`);
    // VP9 alpha is only decoded by libvpx, not ffmpeg's native decoder
    const tags = run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name:stream_tags=alpha_mode', '-of', 'json', input]);
    const st = JSON.parse(tags).streams?.[0] ?? {};
    vp9alpha = st.codec_name === 'vp9' && /1/.test(String(st.tags?.alpha_mode ?? st.tags?.ALPHA_MODE ?? ''));
    args = [...(vp9alpha ? ['-c:v', 'libvpx-vp9'] : []), '-i', input];
    label = ext.slice(1);
  }
  const info = JSON.parse(run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,pix_fmt,r_frame_rate,nb_frames,duration,codec_name:stream_tags=alpha_mode:format=duration', '-of', 'json', probeTarget]));
  const s = info.streams?.[0];
  if (!s) throw new Error(`${input}: no video stream found`);
  const [fn, fd] = String(s.r_frame_rate ?? '30/1').split('/').map(Number);
  const fps = frames ? opts.fps : fd ? fn / fd : 30;
  const duration = frames ? frames / opts.fps : Number(s.duration ?? info.format?.duration ?? 0) || Number(s.nb_frames ?? 0) / (fps || 30);
  const pix = String(s.pix_fmt ?? '');
  // pixel formats with an alpha channel (pal8: GIF/PNG palettes may carry transparency). HyperFrames tags every webm
  // as alpha even when the background is painted, so sample the alpha plane and treat an all-opaque clip as opaque.
  let alpha = vp9alpha || /^(yuva|rgba|bgra|argb|abgr|gbrap|ya[0-9]|pal8)/.test(pix);
  if (alpha) alpha = [0, 0.5, 0.95].some((k) => minAlpha(args, duration * k) < 255);
  return { args, width: Number(s.width), height: Number(s.height), duration, fps, alpha, label };
}

/** Smallest alpha value in the frame at time t (255 = fully opaque). */
function minAlpha(inputArgs: string[], t: number): number {
  const i = inputArgs.lastIndexOf('-i');
  const r = spawnSync('ffmpeg', ['-v', 'error', ...inputArgs.slice(0, i), '-ss', t.toFixed(3), ...inputArgs.slice(i), '-frames:v', '1',
    '-vf', 'scale=320:-2,format=rgba,alphaextract', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: 16 * 1024 * 1024 });
  const b = r.stdout as Buffer | null;
  if (r.status !== 0 || !b || !b.length) return 0; // can't tell: keep the alpha
  let m = 255;
  for (const v of b) if (v < m) m = v;
  return m;
}

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
const kb = (p: string) => `${(fs.statSync(p).size / 1024).toFixed(0)} KB`;

export function convertAnimation(input: string, out: string, opts: AnimationOptions): string[] {
  run('ffmpeg', ['-version']);
  run('ffprobe', ['-version']);
  const src = probeSource(input, opts);
  const w = even(Math.min(opts.width, src.width));
  const h = even((src.height * w) / src.width);
  const bg = opts.bg.startsWith('#') ? opts.bg : `#${opts.bg}`;
  const keepAlpha = src.alpha && !opts.flatten;
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  const scale = `scale=${w}:${h}:flags=lanczos`;
  // flatten transparency onto the background colour
  const flat = (extra = '') => ['-f', 'lavfi', '-i', `color=c=${bg}:s=${w}x${h}:r=${Math.round(src.fps) || 30}`,
    '-filter_complex', `[0:v]${scale},format=rgba[fg];[1:v][fg]overlay=shortest=1:format=auto${extra},format=yuv420p[v]`, '-map', '[v]'];
  const written: string[] = [];
  const common = ['-y', '-v', 'error', ...src.args];

  if (opts.webm) {
    const file = `${out}.webm`;
    const video = keepAlpha
      ? ['-vf', `${scale},format=yuva420p`, '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-auto-alt-ref', '0']
      : src.alpha ? [...flat(), '-c:v', 'libvpx-vp9'] : ['-vf', `${scale},format=yuv420p`, '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuv420p'];
    run('ffmpeg', [...common, ...video, '-crf', String(opts.crfWebm), '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', '-an', file]);
    written.push(file);
  }
  if (opts.mp4) {
    const file = `${out}.mp4`;
    const video = src.alpha ? flat() : ['-vf', `${scale},format=yuv420p`];
    run('ffmpeg', [...common, ...video, '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-x264-params', 'aq-mode=3', '-crf', String(opts.crfMp4), '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', file]);
    written.push(file);
  }
  // poster: a still of the chosen frame, flattened (JPEG has no alpha)
  const poster = `${out}.poster.jpg`;
  // read a clip we just wrote (same size); prefer the always-opaque .mp4
  const from = written.find((f) => f.endsWith('.mp4')) ?? written[0];
  const frameDur = 1 / (src.fps || 30);
  const t = opts.poster === 'start' ? 0 : opts.poster === 'end' ? Math.max(0, src.duration - frameDur * 1.5) : Math.min(Math.max(0, opts.poster), Math.max(0, src.duration - frameDur));
  const alphaWebm = from.endsWith('.webm') && keepAlpha;
  run('ffmpeg', ['-y', '-v', 'error', ...(alphaWebm ? ['-c:v', 'libvpx-vp9'] : []), '-ss', t.toFixed(3), '-i', from,
    ...(alphaWebm ? ['-f', 'lavfi', '-i', `color=c=${bg}:s=${w}x${h}:d=1`, '-filter_complex',
      '[0:v]setpts=PTS-STARTPTS,format=rgba[fg];[1:v]setpts=PTS-STARTPTS[bg];[bg][fg]overlay=eof_action=pass:repeatlast=1:format=auto,format=yuvj420p[v]', '-map', '[v]'] : []),
    '-frames:v', '1', '-q:v', '3', poster]);
  written.push(poster);

  const rel = (p: string) => {
    const norm = p.split(path.sep).join('/');
    const i = norm.lastIndexOf('assets/');
    return i >= 0 ? norm.slice(i) : norm;
  };
  const id = path.basename(out);
  const srcs = written.filter((f) => !f.endsWith('.jpg')).map(rel);
  const yaml = [
    `- id: ${id}`,
    '  widget: Animation',
    '  props:',
    `    src: [${srcs.join(', ')}]`,
    `    poster: ${rel(poster)}`,
    `    alt: <one sentence: what the clip shows>`,
    ...(w / h < 1.2 && w / h > 0.85 ? ["    aspect: '1:1'"] : Math.abs(w / h - 16 / 9) > 0.02 ? [`    aspect: '${w}:${h}'`] : []),
  ].join('\n');
  console.log(`${src.label} · ${src.width}×${src.height} → ${w}×${h} · ${src.duration.toFixed(2)} s${src.alpha ? (keepAlpha ? ' · transparency kept in .webm' : ` · transparency flattened onto ${bg}`) : ''}`);
  for (const f of written) console.log(`  wrote ${f}  (${kb(f)})`);
  console.log('\nPaste into a stage:\n\n' + yaml + '\n');
  return written;
}
