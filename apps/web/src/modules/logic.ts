import * as Comlink from 'comlink';
import type { LogicHost, GeneratorOutput } from '@kodigo/schema';
import type { LogicWorkerApi } from './logic.worker';
import { logicPool, type PoolClient } from './logicPool';
import { stableHash } from '../lib/util';

const TIMEOUT = 4000;

/**
 * Client for one module's Logic Worker, with a small result cache keyed by input hash. The worker starts
 * on the first call, through a capped pool (logicPool.ts), and may be suspended while idle; the cache survives.
 */
export class LogicClient implements PoolClient {
  private worker: Worker | null = null;
  private remote!: Comlink.Remote<LogicWorkerApi>;
  private cache = new Map<string, Promise<any>>();
  private started: Promise<{ fns: string[]; generators: string[] }> | null = null;
  private inFlight = 0;
  fns: string[] = [];
  generators: string[] = [];

  constructor(private source: string) {}

  /** Worker running and logic.js loaded (starts it when needed). */
  get ready(): Promise<{ fns: string[]; generators: string[] }> {
    return (this.started ??= this.start());
  }

  private async start() {
    await logicPool.acquire(this);
    this.worker = new Worker(new URL('./logic.worker.ts', import.meta.url), { type: 'module' });
    this.remote = Comlink.wrap<LogicWorkerApi>(this.worker);
    const r = await this.withTimeout(this.remote.load(this.source), 'load');
    this.fns = r.fns;
    this.generators = r.generators;
    logicPool.touch(this);
    return r;
  }

  busy() { return this.inFlight > 0; }

  suspend() {
    this.worker?.terminate();
    this.worker = null;
    this.started = null;
  }

  private withTimeout<T>(p: Promise<T>, what: string): Promise<T> {
    let t: any;
    this.inFlight++;
    const timeout = new Promise<never>((_, rej) => {
      t = setTimeout(() => {
        rej(new Error(`logic ${what} timed out after ${TIMEOUT} ms (infinite loop?)`));
        this.cache.clear();
        this.suspend();
        logicPool.release(this);
      }, TIMEOUT);
    });
    return Promise.race([p, timeout]).finally(() => {
      clearTimeout(t);
      this.inFlight--;
      logicPool.touch(this);
    });
  }

  async call<T = any>(fn: string, args: unknown): Promise<T> {
    const key = fn + ':' + stableHash(args);
    const hit = this.cache.get(key);
    if (hit) return hit as Promise<T>;
    const p = this.pinned(() => this.withTimeout(this.remote.call(fn, args), `fn ${fn}`));
    this.cache.set(key, p);
    p.catch(() => this.cache.delete(key));
    if (this.cache.size > 800) this.cache.delete(this.cache.keys().next().value!);
    return p as Promise<T>;
  }

  async generate(name: string, seed: number, difficulty: number): Promise<{ output?: GeneratorOutput; ms: number; error?: string }> {
    return this.pinned(() => this.withTimeout(this.remote.generate(name, seed, difficulty) as Promise<{ output?: GeneratorOutput; ms: number; error?: string }>, `generator ${name}`));
  }

  /** Run `f` once the worker is ready, counted as busy throughout so the pool can't suspend it in between. */
  private pinned<T>(f: () => Promise<T>): Promise<T> {
    this.inFlight++;
    return this.ready.then(f).finally(() => { this.inFlight--; });
  }

  asHost(): LogicHost {
    return {
      fns: this.fns,
      generators: this.generators,
      call: (fn, args) => this.call(fn, args),
      generate: (n, s, d) => this.generate(n, s, d),
    };
  }

  dispose() {
    this.suspend();
    this.cache.clear();
    logicPool.release(this);
  }
}

/** LogicHostFactory for validateModule() in the browser (fresh worker, disposed after). */
export async function browserHostFactory(source: string): Promise<LogicHost> {
  const c = new LogicClient(source);
  await c.ready;
  const h = c.asHost();
  return { ...h, fns: c.fns, generators: c.generators, dispose: () => c.dispose() };
}
