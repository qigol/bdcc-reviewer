/**
 * Isolated LogicHost for the server: runs logic.js in a short-lived child process with an empty env,
 * the Node permission model (fs reads limited to the child script), a 128 MB heap and a per-request
 * watchdog. The permission model is a seat belt, not a hard sandbox: import stays admin-only.
 */
import { fork, type ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LogicHost } from '@kodigo/schema';

const SLACK_MS = 500;
const BUDGET_MS = 120_000;
const MAX_CHILDREN = 2;

// ------------------------------------------------------------ semaphore
let running = 0;
const waiting: (() => void)[] = [];
async function acquire() {
  if (running < MAX_CHILDREN) { running++; return; }
  await new Promise<void>((r) => waiting.push(r));
}
function release() {
  const next = waiting.shift();
  if (next) next();
  else running--;
}

const live = new Set<ChildProcess>();
/** Kill every live logic child (server shutdown). */
export function killAllLogicChildren() {
  for (const c of live) c.kill('SIGKILL');
  live.clear();
}

// ------------------------------------------------------------ child script
let childScript: Promise<string> | null = null;
/** Path of the child entry: dist/logic-child.mjs next to the bundle, or (dev/test) src/logic/child.ts bundled once into the temp dir. */
export function ensureChildScript(): Promise<string> {
  return (childScript ??= (async () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const built = path.join(here, 'logic-child.mjs');
    if (fs.existsSync(built)) return built;
    const src = path.join(here, 'child.ts');
    const { build } = await import('esbuild');
    const out = await build({
      entryPoints: [src], bundle: true, platform: 'node', format: 'esm', target: 'node20', write: false, logLevel: 'silent',
      banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
    });
    const code = out.outputFiles[0].text;
    const file = path.join(os.tmpdir(), `kodigo-logic-child-${crypto.createHash('sha1').update(code).digest('hex').slice(0, 12)}.mjs`);
    if (!fs.existsSync(file)) fs.writeFileSync(file, code);
    return file;
  })());
}

const permFlag = () => (process.allowedNodeEnvironmentFlags.has('--permission') ? '--permission' : '--experimental-permission');

// ------------------------------------------------------------ host
export async function createIsolatedHost(source: string, opts: { timeoutMs?: number } = {}): Promise<LogicHost> {
  const timeoutMs = opts.timeoutMs ?? 2000;
  const script = await ensureChildScript();
  await acquire();
  // env: {} keeps ADMIN_TOKEN and every other secret out (on Windows libuv still adds a few system vars such as PATH)
  const child = fork(script, [], {
    env: {},
    execArgv: [permFlag(), `--allow-fs-read=${script}`, '--max-old-space-size=128'],
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    serialization: 'json',
  });
  live.add(child);
  let stderr = '';
  child.stderr?.on('data', (d) => { stderr = (stderr + d).slice(-2048); });

  let dead: Error | null = null;
  let released = false;
  const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>();
  const stop = (err: Error) => {
    if (!dead) dead = err;
    for (const p of pending.values()) { clearTimeout(p.timer); p.reject(err); }
    pending.clear();
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    live.delete(child);
    clearTimeout(budget);
    if (!released) { released = true; release(); }
  };
  const budget = setTimeout(() => stop(new Error(`logic validation exceeded ${BUDGET_MS / 1000} s and was stopped`)), BUDGET_MS);
  child.on('message', (m: any) => {
    const p = pending.get(m?.id);
    if (!p) return;
    pending.delete(m.id);
    clearTimeout(p.timer);
    m.ok ? p.resolve(m) : p.reject(new Error(m.error));
  });
  child.on('exit', (code, signal) => {
    if (!dead) stop(new Error(`logic process exited (code ${code}, signal ${signal})${stderr ? `: ${stderr.trim()}` : ''}`));
  });
  child.on('error', (e) => stop(e));

  let nextId = 1;
  const request = (msg: Record<string, unknown>): Promise<any> => {
    if (dead) return Promise.reject(dead);
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => stop(new Error(`logic.js did not finish within ${timeoutMs} ms and was stopped`)), timeoutMs + SLACK_MS);
      pending.set(id, { resolve, reject, timer });
      child.send({ id, ...msg });
    });
  };

  let init: { fns: string[]; generators: string[] };
  try {
    init = await request({ op: 'init', source, timeoutMs });
  } catch (e) {
    stop(e as Error);
    throw e;
  }
  return {
    fns: init.fns,
    generators: init.generators,
    async call(fn, args) {
      return (await request({ op: 'call', fn, args: JSON.parse(JSON.stringify(args ?? {})) })).result;
    },
    async generate(name, seed, difficulty) {
      const t0 = performance.now();
      try {
        return (await request({ op: 'generate', name, seed, difficulty })).result;
      } catch (e: any) {
        return { ms: performance.now() - t0, error: String(e?.message ?? e) };
      }
    },
    dispose() { stop(new Error('logic host disposed')); },
  };
}
