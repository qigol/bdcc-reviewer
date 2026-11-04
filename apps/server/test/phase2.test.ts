/**
 * Phase 2 (S6–S9).
 * Property 6: header matrix. Counterexample before the fix: page CSP had 'unsafe-eval' and no frame-ancestors,
 *   no referrer-policy anywhere, no HSTS option.
 * S7: 5xx bodies leaked err.message (`/secret/path`).
 * Property 8: PATCH {"order":"abc"} returned 200 and wrote "order": null to state.json.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import fc from 'fast-check';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { securityHeaders } from '../src/headers';
import { ModulePatch } from '../src/validation';
import { makeFixture, ADMIN, FIXTURE_MODULE, type Fixture } from './fixtures';

const PATHS = fc.oneof(
  fc.constantFrom('/', '/index.html', '/m/x/path', '/glossary/a', '/quiz', '/api/modules', '/api/health', '/api/modules/x/report'),
  fc.stringMatching(/^[a-z0-9]{1,8}$/).map((h) => `/assets/index-${h}.js`),
  fc.stringMatching(/^[A-Za-z0-9_-]{1,8}$/).map((h) => `/assets/logic.worker-${h}.js`),
  fc.stringMatching(/^[A-Za-z0-9_-]{1,8}$/).map((h) => `/assets/pyodide.worker-${h}.js`),
  fc.constantFrom('svg', 'png', 'mp4', 'pdf', 'js', 'html', 'yaml').map((e) => `/api/modules/x/files/assets/a.${e}`),
);
const TYPES = fc.constantFrom('text/html; charset=utf-8', 'text/javascript', 'application/json; charset=utf-8', 'image/svg+xml', 'application/pdf', 'text/plain; charset=utf-8', 'video/mp4');

describe('header matrix (Property 6)', () => {
  it('securityHeaders over paths × types × hsts', () => {
    fc.assert(fc.property(PATHS, TYPES, fc.boolean(), (p, ct, hsts) => {
      const h = securityHeaders({ path: p, contentType: ct, hsts });
      expect(h['x-content-type-options']).toBe('nosniff');
      expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect('strict-transport-security' in h).toBe(hsts);
      const csp = h['content-security-policy'] ?? '';
      if (ct.includes('text/html')) {
        expect(csp).not.toContain("'unsafe-eval'");
        expect(csp).toContain("frame-ancestors 'self'");
        expect(h['x-frame-options']).toBe('SAMEORIGIN');
      } else if (/^\/assets\/pyodide\.worker-/.test(p)) {
        expect(csp).toContain("'wasm-unsafe-eval'");
        expect(csp).toContain("connect-src 'self'");
      } else if (/^\/assets\/logic\.worker-/.test(p)) {
        expect(csp).toContain("connect-src 'none'");
      } else if (/\/files\//.test(p) && !ct.startsWith('application/pdf')) {
        expect(csp).toContain('sandbox');
      }
    }), { numRuns: 500 });
  });

  describe('over HTTP', () => {
    let fx: Fixture;
    beforeAll(async () => { fx = await makeFixture({ env: { HSTS: '1' } }); });
    afterAll(async () => { await fx.close(); });

    it('page, workers, files and API responses', async () => {
      const page = await fx.app.inject({ url: '/m/x/path' });
      expect(page.headers['content-security-policy']).not.toContain("'unsafe-eval'");
      expect(page.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(page.headers['strict-transport-security']).toBe('max-age=31536000');
      expect((await fx.app.inject({ url: '/assets/pyodide.worker-test.js' })).headers['content-security-policy']).toContain("'wasm-unsafe-eval'");
      const api = await fx.app.inject({ url: '/api/health' });
      expect(api.headers['content-security-policy']).toContain("frame-ancestors 'none'");
      expect(api.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });
  });
});

describe('5xx bodies (S7)', () => {
  let fx: Fixture;
  const logged: unknown[] = [];
  beforeAll(async () => {
    const stream = { write: (s: string) => { logged.push(s); } };
    fx = await makeFixture({ deps: { logger: { level: 'error', stream } as any, routes: (app) => app.get('/api/test-throw', async () => { throw new Error('/secret/path'); }) } });
  });
  afterAll(async () => { await fx.close(); });

  it('the client gets a generic message and a request id; the log gets the details', async () => {
    const r = await fx.app.inject({ url: '/api/test-throw' });
    expect(r.statusCode).toBe(500);
    expect(r.body).not.toContain('/secret/path');
    expect(r.json()).toEqual({ error: 'Internal server error', requestId: expect.any(String) });
    expect(logged.join('\n')).toContain('/secret/path');
  });

  it('4xx keeps its specific message', async () => {
    const r = await fx.app.inject({ method: 'PATCH', url: '/api/modules/nope', headers: ADMIN, payload: {} });
    expect(r.statusCode).toBe(404);
    expect(r.json().error).toBe('no module nope');
  });
});

describe('PATCH validation (Property 8)', () => {
  let fx: Fixture;
  beforeAll(async () => { fx = await makeFixture(); });
  afterAll(async () => { await fx.close(); });
  const statePath = () => path.join(fx.dataDir, 'state.json');
  const readState = () => fs.readFile(statePath(), 'utf8').catch(() => '');

  const val = fc.oneof(
    fc.double(), fc.constantFrom(-0, Infinity, 'abc', 'NaN', '', null, true, false, [], {}, [1], { a: 1 }),
    fc.string({ maxLength: 90 }), fc.integer(), fc.boolean(),
  );
  it('valid bodies apply; invalid ones answer 400 and leave state.json byte-for-byte unchanged', async () => {
    await fc.assert(fc.asyncProperty(fc.record({ enabled: val, order: val, current: val, course: val }, { requiredKeys: [] }), async (body) => {
      const before = await readState();
      const json = JSON.stringify(body); // what the server receives: 1e309 → null, -0 → 0
      const r = await fx.app.inject({ method: 'PATCH', url: `/api/modules/${FIXTURE_MODULE}`, headers: { ...ADMIN, 'content-type': 'application/json' }, payload: json });
      const parsed = ModulePatch.safeParse(JSON.parse(json));
      if (parsed.success && parsed.data.current === undefined) {
        expect(r.statusCode).toBe(200);
        const st = JSON.parse(await readState()).modules[FIXTURE_MODULE];
        if (parsed.data.order !== undefined) expect(st.order).toBe(parsed.data.order);
        if (parsed.data.enabled !== undefined) expect(st.enabled).toBe(parsed.data.enabled);
      } else {
        // invalid, or a `current` version that isn't stored (also 400)
        expect(r.statusCode).toBe(400);
        expect(await readState()).toBe(before);
      }
    }), { numRuns: 150 });
  }, 120_000);

  it('the audit counterexample and unknown keys', async () => {
    const before = await readState();
    const bad = await fx.app.inject({ method: 'PATCH', url: `/api/modules/${FIXTURE_MODULE}`, headers: ADMIN, payload: { order: 'abc' } });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error).toMatch(/^invalid body: order: /);
    expect(await readState()).toBe(before);
    const ok = await fx.app.inject({ method: 'PATCH', url: `/api/modules/${FIXTURE_MODULE}`, headers: ADMIN, payload: { order: 5, extra: 'ignored' } });
    expect(ok.statusCode).toBe(200);
    expect(JSON.parse(await readState()).modules[FIXTURE_MODULE]).toEqual(expect.not.objectContaining({ extra: expect.anything() }));
  });
});
