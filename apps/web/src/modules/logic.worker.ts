/// <reference lib="webworker" />
/**
 * Logic Worker: runs one module's logic.js isolated from the DOM and storage.
 * Network APIs are removed before the module code runs (defence in depth; CSP connect-src 'self' too).
 */
import * as Comlink from 'comlink';
import { sdk, createRng } from '@kodigo/sdk';
import { transformLogicSource } from '@kodigo/schema/logic-source';

const g = self as any;
for (const k of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts', 'indexedDB', 'caches']) {
  try { g[k] = undefined; } catch { /* ignore */ }
}

let api: { fns: Record<string, (a: any) => any>; generators: Record<string, (c: any) => any> } | null = null;

const clean = (v: unknown) => JSON.parse(JSON.stringify(v === undefined ? null : v));

const impl = {
  load(source: string) {
    const body = transformLogicSource(source);
    // eslint-disable-next-line no-new-func
    const register = new Function(body)();
    if (typeof register !== 'function') throw new Error('logic.js default export must be a function register(sdk)');
    api = register(sdk);
    if (!api || typeof api !== 'object') throw new Error('register(sdk) must return { fns, generators }');
    return { fns: Object.keys(api.fns ?? {}), generators: Object.keys(api.generators ?? {}) };
  },
  call(fn: string, args: unknown) {
    if (!api) throw new Error('logic not loaded');
    const f = api.fns?.[fn];
    if (typeof f !== 'function') throw new Error(`logic.js has no fn "${fn}"`);
    return clean(f(args));
  },
  generate(name: string, seed: number, difficulty: number) {
    if (!api) throw new Error('logic not loaded');
    const gen = api.generators?.[name];
    const t0 = performance.now();
    try {
      if (typeof gen !== 'function') throw new Error(`logic.js has no generator "${name}"`);
      const out = gen({ rng: createRng(seed), difficulty, fns: api.fns, sdk });
      return { output: clean(out), ms: performance.now() - t0 };
    } catch (e: any) {
      return { ms: performance.now() - t0, error: String(e?.message ?? e) };
    }
  },
};
export type LogicWorkerApi = typeof impl;
Comlink.expose(impl);
