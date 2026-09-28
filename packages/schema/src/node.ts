/**
 * Node-side LogicHost: runs a module's logic.js inside a node:vm context with timeouts.
 * Used by the server (import re-validation, health) and the CLI. The vm context has no
 * require/process/fs; Math.random throws (logic must be deterministic). It is not a hard
 * security boundary, which is why import is admin-only.
 */
import vm from 'node:vm';
import { sdk, createRng } from '@kodigo/sdk';
import { transformLogicSource, type LogicHost } from './validate';

export async function createNodeHost(source: string, opts: { timeoutMs?: number } = {}): Promise<LogicHost> {
  const timeout = opts.timeoutMs ?? 2000;
  const body = transformLogicSource(source);
  const noop = () => {};
  const ctx = vm.createContext({ console: { log: noop, warn: noop, error: noop, info: noop, debug: noop }, __sdk: sdk });
  vm.runInContext(
    `Math.random = function () { throw new Error('Math.random is not allowed in logic.js; use the seeded rng passed to generators'); };`,
    ctx,
  );
  ctx.__reg = vm.runInContext(`(function () {\n${body}\n})()`, ctx, { timeout, filename: 'logic.js' });
  if (typeof ctx.__reg !== 'function') throw new Error('logic.js default export must be a function register(sdk)');
  vm.runInContext('var __api = __reg(__sdk);', ctx, { timeout, filename: 'logic.js' });
  const listed = JSON.parse(
    vm.runInContext(
      `JSON.stringify({ fns: Object.keys((__api && __api.fns) || {}), generators: Object.keys((__api && __api.generators) || {}) })`,
      ctx,
      { timeout },
    ),
  );
  return {
    fns: listed.fns,
    generators: listed.generators,
    async call(fn, args) {
      ctx.__fnName = fn;
      ctx.__args = JSON.parse(JSON.stringify(args ?? {}));
      const out = vm.runInContext(
        `(function(){ var f = __api.fns[__fnName]; if (typeof f !== 'function') throw new Error('no fn ' + __fnName); var r = f(__args); return JSON.stringify(r === undefined ? null : r); })()`,
        ctx,
        { timeout, filename: 'logic.js' },
      );
      return JSON.parse(out);
    },
    async generate(name, seed, difficulty) {
      ctx.__gen = name;
      ctx.__ctxArg = { rng: createRng(seed), difficulty, sdk };
      const t0 = performance.now();
      try {
        const out = vm.runInContext(
          `(function(){ var g = __api.generators[__gen]; if (typeof g !== 'function') throw new Error('no generator ' + __gen); var a = __ctxArg; return JSON.stringify(g({ rng: a.rng, difficulty: a.difficulty, sdk: a.sdk, fns: __api.fns })); })()`,
          ctx,
          { timeout, filename: 'logic.js' },
        );
        return { output: JSON.parse(out), ms: performance.now() - t0 };
      } catch (e: any) {
        return { ms: performance.now() - t0, error: String(e?.message ?? e) };
      }
    },
  };
}

/** Read a module folder from disk into a FileMap. */
export async function readModuleDir(dir: string): Promise<Record<string, string | Uint8Array>> {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const { isTextPath } = await import('./bundle');
  const files: Record<string, string | Uint8Array> = {};
  async function walk(rel: string) {
    const entries = await fs.readdir(path.join(dir, rel), { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) await walk(r);
      else files[r] = isTextPath(r) ? await fs.readFile(path.join(dir, r), 'utf8') : new Uint8Array(await fs.readFile(path.join(dir, r)));
    }
  }
  await walk('');
  return files;
}
