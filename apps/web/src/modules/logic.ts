import * as Comlink from 'comlink';
import type { LogicHost, GeneratorOutput } from '@kodigo/schema';
import type { LogicWorkerApi } from './logic.worker';
import { stableHash } from '../lib/util';

const TIMEOUT = 4000;

/** Client for one module's Logic Worker, with a small result cache keyed by input hash. */
export class LogicClient {
  private worker!: Worker;
  private remote!: Comlink.Remote<LogicWorkerApi>;
  private cache = new Map<string, Promise<any>>();
  ready!: Promise<{ fns: string[]; generators: string[] }>;
  fns: string[] = [];
  generators: string[] = [];

  constructor(private source: string) {
    this.start();
  }

  private start() {
    this.worker = new Worker(new URL('./logic.worker.ts', import.meta.url), { type: 'module' });
    this.remote = Comlink.wrap<LogicWorkerApi>(this.worker);
    this.ready = this.withTimeout(this.remote.load(this.source), 'load').then((r) => {
      this.fns = r.fns;
      this.generators = r.generators;
      return r;
    });
  }

  private withTimeout<T>(p: Promise<T>, what: string): Promise<T> {
    let t: any;
    const timeout = new Promise<never>((_, rej) => {
      t = setTimeout(() => {
        rej(new Error(`logic ${what} timed out after ${TIMEOUT} ms (infinite loop?)`));
        this.worker.terminate();
        this.cache.clear();
        this.start();
      }, TIMEOUT);
    });
    return Promise.race([p, timeout]).finally(() => clearTimeout(t));
  }

  async call<T = any>(fn: string, args: unknown): Promise<T> {
    const key = fn + ':' + stableHash(args);
    const hit = this.cache.get(key);
    if (hit) return hit as Promise<T>;
    const p = this.ready.then(() => this.withTimeout(this.remote.call(fn, args), `fn ${fn}`));
    this.cache.set(key, p);
    p.catch(() => this.cache.delete(key));
    if (this.cache.size > 800) this.cache.delete(this.cache.keys().next().value!);
    return p as Promise<T>;
  }

  async generate(name: string, seed: number, difficulty: number): Promise<{ output?: GeneratorOutput; ms: number; error?: string }> {
    await this.ready;
    return this.withTimeout(this.remote.generate(name, seed, difficulty) as Promise<{ output?: GeneratorOutput; ms: number; error?: string }>, `generator ${name}`);
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
    this.worker.terminate();
    this.cache.clear();
  }
}

/** LogicHostFactory for validateModule() in the browser (fresh worker, disposed after). */
export async function browserHostFactory(source: string): Promise<LogicHost> {
  const c = new LogicClient(source);
  await c.ready;
  const h = c.asHost();
  return { ...h, fns: c.fns, generators: c.generators, dispose: () => c.dispose() };
}
