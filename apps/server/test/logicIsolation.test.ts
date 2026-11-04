/**
 * Property 3 (S1, S2): server-side logic.js cannot reach secrets or files, and cannot block the server.
 * Counterexample on the pre-fix in-process host: `sdk.constructor.constructor('return process')()` returned
 * the server's process, so `env.KODIGO_SENTINEL` and files under DATA_DIR were readable.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import fc from 'fast-check';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { validateModule, type LogicHostFactory } from '@kodigo/schema';
import { readModuleDir } from '@kodigo/schema/node';
import { createIsolatedHost } from '../src/logic/isolatedHost';
import { makeFixture, ADMIN, FIXTURE_MODULE, type Fixture } from './fixtures';

const factory: LogicHostFactory = (src) => createIsolatedHost(src);
const SENTINEL = 'kodigo-sentinel-' + Math.random().toString(36).slice(2);
let secretFile: string;

const escape = `const p = sdk.constructor.constructor('return process')();`;
const SNIPPETS: Record<string, (file: string) => string> = {
  envViaEscape: () => `${escape} return { fns: { x: () => p.env.KODIGO_SENTINEL ?? null }, generators: {} };`,
  fsViaBuiltin: (f) => `${escape} return { fns: { x: () => p.getBuiltinModule('node:fs').readFileSync(${JSON.stringify(f)}, 'utf8') }, generators: {} };`,
  fsViaBinding: (f) => `${escape} return { fns: { x: () => { const fs = p.binding('fs'); return String(fs.readFileUtf8 ? fs.readFileUtf8(${JSON.stringify(f)}, 0) : fs); } }, generators: {} };`,
  syncLoop: () => `return { fns: { x: () => { for (;;) {} } }, generators: {} };`,
  microtaskLoop: () => `return { fns: { x: () => { Promise.resolve().then(() => { for (;;) {} }); return 1; } }, generators: {} };`,
  bigAlloc: () => `return { fns: { x: () => { const a = []; for (;;) a.push(new Array(1e6).fill(1)); } }, generators: {} };`,
  valid: () => `return { fns: { x: (a) => (a.n ?? 0) + 1 }, generators: { g: ({ rng }) => ({ n: rng.int(1, 9) }) } };`,
};
const moduleOf = (body: string) => `export default function (sdk) { ${body} }`;

describe('isolated logic host (Property 3)', () => {
  beforeAll(async () => {
    process.env.KODIGO_SENTINEL = SENTINEL;
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kodigo-secret-'));
    secretFile = path.join(dir, 'state.json');
    await fs.writeFile(secretFile, SENTINEL);
  });
  afterAll(() => { delete process.env.KODIGO_SENTINEL; });

  it('hostile and valid logic: no secret leaks, every call ends in time', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...Object.keys(SNIPPETS)), async (name) => {
        const t0 = Date.now();
        let host;
        try {
          host = await factory(moduleOf(SNIPPETS[name](secretFile)));
        } catch (e: any) {
          expect(String(e.message)).not.toContain(SENTINEL);
          return;
        }
        try {
          const out = await host.call('x', { n: 1 }).then((v) => JSON.stringify(v), (e) => String(e?.message ?? e));
          expect(out).not.toContain(SENTINEL);
          if (name === 'valid') expect(out).toBe('2');
          if (name.startsWith('fs')) expect(out).toMatch(/ERR_ACCESS_DENIED|Access to this API has been restricted|not a function|binding/i);
        } finally {
          host.dispose?.();
        }
        expect(Date.now() - t0).toBeLessThan(2000 + 500 + 1500); // timeout + watchdog slack + process start
      }),
      { numRuns: 25 },
    );
  }, 180_000);

  it('a hanging module shows up as an error issue in a normal report', async () => {
    const files = await readModuleDir(path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../../../modules', FIXTURE_MODULE));
    files['logic.js'] = moduleOf(SNIPPETS.microtaskLoop(''));
    const report = await validateModule(files, { hostFactory: factory, seeds: 1 });
    expect(report.ok).toBe(false);
    expect(report.issues.some((i) => i.level === 'error' && i.step === 'logic')).toBe(true);
  }, 60_000);

  describe('server stays responsive', () => {
    let fx: Fixture;
    beforeAll(async () => { fx = await makeFixture({ deps: { hostFactory: factory } }); });
    afterAll(async () => { await fx.close(); });

    it('GET /api/health answers while a hanging import is validated', async () => {
      const files = await readModuleDir(path.join(fx.builtinDir, FIXTURE_MODULE));
      const json: Record<string, string | { base64: string }> = {};
      for (const [p, c] of Object.entries(files)) json[p] = typeof c === 'string' ? c : { base64: Buffer.from(c).toString('base64') };
      json['logic.js'] = moduleOf(SNIPPETS.syncLoop(''));
      const install = fx.app.inject({ method: 'POST', url: '/api/modules?dryRun=1', headers: ADMIN, payload: { files: json } });
      await new Promise((r) => setTimeout(r, 300));
      const t0 = Date.now();
      const health = await fx.app.inject({ url: '/api/health' });
      expect(health.statusCode).toBe(200);
      expect(Date.now() - t0).toBeLessThan(500);
      const r = await install;
      expect(r.statusCode).toBe(200);
      expect(r.json().ok).toBe(false);
    }, 60_000);
  });

  it('the permission model denies fs reads in the child on this Node version', async () => {
    // design hypothesis 16: recorded per Node version in the test output
    const host = await factory(moduleOf(SNIPPETS.fsViaBuiltin(secretFile)));
    try {
      const err = await host.call('x', {}).then(() => 'read', (e) => String(e?.message ?? e));
      console.info(`node ${process.version}: child fs read → ${err.slice(0, 80)}`);
      expect(err).toMatch(/ERR_ACCESS_DENIED|Access to this API has been restricted/);
    } finally {
      host.dispose?.();
    }
  });
});
