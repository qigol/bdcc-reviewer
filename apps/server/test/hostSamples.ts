/** Samples a module's logic through a LogicHostFactory: fixed seeds × difficulties per generator, examples.yaml args per fn. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import YAML from 'yaml';
import type { LogicHost, LogicHostFactory } from '@kodigo/schema';
import { repoModules } from './fixtures';

export const builtinIds = () => fs.readdirSync(repoModules).filter((d) => fs.existsSync(path.join(repoModules, d, 'manifest.yaml'))).sort();
export const SEEDS = [1, 7, 42, 1234, 99991];
export const DIFFICULTIES = [1, 2, 3];

const hasRef = (v: unknown): boolean => (typeof v === 'string' ? v.startsWith('@') : v && typeof v === 'object' ? Object.values(v).some(hasRef) : false);

/** fn calls from examples.yaml whose args are literal (no @dataset refs). */
export function exampleCalls(id: string): { fn: string; args: unknown }[] {
  const f = path.join(repoModules, id, 'examples.yaml');
  if (!fs.existsSync(f)) return [];
  const ex = (YAML.parse(fs.readFileSync(f, 'utf8'))?.examples ?? []) as { fn?: string; in?: unknown }[];
  return ex.filter((e) => e.fn && !hasRef(e.in)).map((e) => ({ fn: e.fn!, args: e.in ?? {} }));
}

/** outputs are compared by digest so the baseline file stays small */
export const digest = (v: unknown) => crypto.createHash('sha1').update(JSON.stringify(v ?? null)).digest('hex').slice(0, 16);

const settle = async <T>(p: Promise<T>) => { try { return { ok: await p }; } catch (e: any) { return { error: String(e?.message ?? e) }; } };

export async function sampleModule(id: string, factory: LogicHostFactory) {
  const source = fs.readFileSync(path.join(repoModules, id, 'logic.js'), 'utf8');
  const host: LogicHost = await factory(source);
  try {
    const gens: Record<string, unknown> = {};
    for (const g of [...host.generators].sort())
      for (const s of SEEDS)
        for (const d of DIFFICULTIES) {
          const r = await host.generate(g, s, d);
          gens[`${g}|${s}|${d}`] = r.error !== undefined ? { error: r.error } : { output: digest(r.output) };
        }
    const fns = [];
    for (const c of exampleCalls(id)) { const r = await settle(host.call(c.fn, c.args)); fns.push({ fn: c.fn, ...('ok' in r ? { ok: digest(r.ok) } : r) }); }
    return { fns: [...host.fns].sort(), generators: [...host.generators].sort(), gens, calls: fns };
  } finally {
    await host.dispose?.();
  }
}
