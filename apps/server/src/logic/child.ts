/**
 * Child-process entry for the isolated logic host. Runs one module's logic.js with the in-process
 * node:vm host, unchanged, and answers the parent over IPC. Started with an empty env and the Node
 * permission model (no fs reads beyond this file, no child processes, workers, addons or WASI).
 */
import { createNodeHost } from '@kodigo/schema/node';
import type { LogicHost } from '@kodigo/schema';

type Msg =
  | { id: number; op: 'init'; source: string; timeoutMs?: number }
  | { id: number; op: 'call'; fn: string; args: unknown }
  | { id: number; op: 'generate'; name: string; seed: number; difficulty: number };

let host: LogicHost | null = null;

process.on('message', async (m: Msg) => {
  try {
    if (m.op === 'init') {
      host = await createNodeHost(m.source, { timeoutMs: m.timeoutMs });
      process.send!({ id: m.id, ok: true, fns: host.fns, generators: host.generators });
    } else if (!host) {
      throw new Error('logic not loaded');
    } else if (m.op === 'call') {
      process.send!({ id: m.id, ok: true, result: await host.call(m.fn, m.args) });
    } else {
      process.send!({ id: m.id, ok: true, result: await host.generate(m.name, m.seed, m.difficulty) });
    }
  } catch (e: any) {
    process.send!({ id: m.id, ok: false, error: String(e?.message ?? e) });
  }
});
