/// <reference lib="webworker" />
/**
 * Logic Worker: runs one module's logic.js isolated from the DOM and storage.
 * Network, storage and nested-worker globals are removed before the module code runs (harden.ts), and the
 * built server sends this file with connect-src 'none' and worker-src 'none' (headers.ts).
 */
import * as Comlink from 'comlink';
import { sdk, createRng } from '@kodigo/sdk';
import { transformLogicSource } from '@kodigo/schema/logic-source';
import { BLOCKED, hardenWorkerGlobal } from './harden';

// fail closed: if hardening didn't take, load() refuses to run module code
let hardenError: Error | null = null;
try { hardenWorkerGlobal(self, BLOCKED); } catch (e: any) { hardenError = e; }

let api: { fns: Record<string, (a: any) => any>; generators: Record<string, (c: any) => any> } | null = null;

const clean = (v: unknown) => JSON.parse(JSON.stringify(v === undefined ? null : v));

const impl = {
  load(source: string) {
    if (hardenError) throw hardenError;
    const body = transformLogicSource(source);
    // the blocked names are also parameters (all undefined), so bare identifiers can't reach them
    // eslint-disable-next-line no-new-func
    const register = new Function(...BLOCKED, body)(...BLOCKED.map(() => undefined));
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
