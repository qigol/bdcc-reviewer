/**
 * Phase 3 server side.
 * Property 9 (P1, P2, P4c): list and /files read no binary contents, /files has a stable ETag that changes with the
 *   files. Counterexample before the fix: every GET /api/modules hashed every binary, and /files read them all.
 * P4a, P4b, P6: compression, cache policy, and files added after startup are served.
 */
import fsp from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import fc from 'fast-check';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { etagMatches } from '../src/app';
import { makeFixture, ADMIN, FIXTURE_MODULE, type Fixture } from './fixtures';

const pause = (ms = 600) => new Promise((r) => setTimeout(r, ms)); // past the 500 ms fingerprint memo

describe('registry caching and /files ETag (Property 9)', () => {
  let fx: Fixture;
  const files = `/api/modules/${FIXTURE_MODULE}/files`;
  beforeAll(async () => {
    fx = await makeFixture();
    await fsp.writeFile(path.join(fx.builtinDir, FIXTURE_MODULE, 'assets', 'big.png'), Buffer.alloc(2048, 7));
    await fx.registry.report(FIXTURE_MODULE, true); // warm
  }, 60_000);
  afterAll(async () => { await fx.close(); vi.restoreAllMocks(); });

  it('warm list and /files read no binary contents', async () => {
    await pause();
    await fx.registry.report(FIXTURE_MODULE, true);
    const spy = vi.spyOn(fsp, 'readFile');
    await fx.app.inject({ url: '/api/modules' });
    const r = await fx.app.inject({ url: files });
    expect(r.json().binary).toContain('assets/big.png');
    const read = spy.mock.calls.map((c) => String(c[0]));
    spy.mockRestore();
    expect(read.some((p) => p.endsWith('.yaml'))).toBe(true); // the spy does see this code path's reads
    expect(read.filter((p) => p.endsWith('.png'))).toEqual([]);
  }, 30_000);

  it('304 exactly when If-None-Match matches; a mutation changes the ETag', async () => {
    await fc.assert(fc.asyncProperty(fc.constantFrom('add', 'resize', 'remove'), fc.integer({ min: 1, max: 500 }), async (op, n) => {
      await pause();
      const a = await fx.app.inject({ url: files });
      const tag = String(a.headers.etag);
      expect(tag).toMatch(/^W\/"/);
      expect(a.headers['cache-control']).toBe('no-cache');
      const same = await fx.app.inject({ url: files, headers: { 'if-none-match': `"x", ${tag}` } });
      expect(same.statusCode).toBe(304);
      expect(same.body).toBe('');
      expect((await fx.app.inject({ url: files, headers: { 'if-none-match': 'W/"nope"' } })).statusCode).toBe(200);
      const p = path.join(fx.builtinDir, FIXTURE_MODULE, 'assets', 'mut.bin');
      if (op === 'remove') await fsp.rm(p, { force: true }).then(() => fsp.writeFile(p + n, 'x'));
      else await fsp.writeFile(p, Buffer.alloc(n + (op === 'resize' ? 7 : 0)));
      await pause();
      const b = await fx.app.inject({ url: files, headers: { 'if-none-match': tag } });
      expect(b.statusCode).toBe(200);
      expect(b.headers.etag).not.toBe(tag);
    }), { numRuns: 6 });
  }, 60_000);

  it('etagMatches handles weak, strong, lists and *', () => {
    expect(etagMatches('W/"a"', 'W/"a"')).toBe(true);
    expect(etagMatches('"a"', 'W/"a"')).toBe(true);
    expect(etagMatches('"b", W/"a"', 'W/"a"')).toBe(true);
    expect(etagMatches('*', 'W/"a"')).toBe(true);
    expect(etagMatches('"b"', 'W/"a"')).toBe(false);
    expect(etagMatches(undefined, 'W/"a"')).toBe(false);
  });

  it('after a patch or install the next list reflects it', async () => {
    await fx.app.inject({ method: 'PATCH', url: `/api/modules/${FIXTURE_MODULE}`, headers: ADMIN, payload: { order: 42 } });
    const m = (await fx.app.inject({ url: '/api/modules' })).json().find((x: any) => x.id === FIXTURE_MODULE);
    expect(m.order).toBe(42);
  });

  it('GET /api/index: same module data, ETag and 304', async () => {
    const a = await fx.app.inject({ url: '/api/index' });
    expect(a.statusCode).toBe(200);
    const idx = a.json().modules.find((x: any) => x.id === FIXTURE_MODULE);
    expect(idx.manifest.id).toBe(FIXTURE_MODULE);
    expect(idx.scenes.length).toBeGreaterThan(0);
    expect(idx.path.length).toBeGreaterThan(0);
    expect(a.body).not.toContain('"logic"');
    const b = await fx.app.inject({ url: '/api/index', headers: { 'if-none-match': String(a.headers.etag) } });
    expect(b.statusCode).toBe(304);
  });
});

describe('transport (P4, P6)', () => {
  let fx: Fixture;
  beforeAll(async () => { fx = await makeFixture(); });
  afterAll(async () => { await fx.close(); });

  it('compresses JSON and JS for clients that accept br; decompressed body is intact', async () => {
    const r = await fx.app.inject({ url: `/api/modules/${FIXTURE_MODULE}/files`, headers: { 'accept-encoding': 'br' } });
    expect(r.headers['content-encoding']).toBe('br');
    expect(JSON.parse(zlib.brotliDecompressSync(r.rawPayload).toString()).files['manifest.yaml']).toBeTruthy();
    const js = await fx.app.inject({ url: '/assets/index-test.js', headers: { 'accept-encoding': 'br' } });
    expect(js.headers['content-encoding']).toBe('br');
    const plain = await fx.app.inject({ url: `/api/modules/${FIXTURE_MODULE}/files` });
    expect(plain.headers['content-encoding']).toBeUndefined();
  });

  it('raw module files are never compressed, so lengths and ranges stay exact', async () => {
    const r = await fx.app.inject({ url: `/api/modules/${FIXTURE_MODULE}/files/manifest.yaml`, headers: { 'accept-encoding': 'br' } });
    expect(r.headers['content-encoding']).toBeUndefined();
    expect(Number(r.headers['content-length'])).toBe(r.rawPayload.length);
    const part = await fx.app.inject({ url: `/api/modules/${FIXTURE_MODULE}/files/manifest.yaml`, headers: { 'accept-encoding': 'br', range: 'bytes=0-9' } });
    expect(part.statusCode).toBe(206);
    expect(part.rawPayload.length).toBe(10);
  });

  it('cache policy: hashed assets immutable, HTML no-cache', async () => {
    expect((await fx.app.inject({ url: '/assets/index-test.js' })).headers['cache-control']).toBe('public, max-age=31536000, immutable');
    for (const url of ['/', '/index.html', '/m/x/path']) expect((await fx.app.inject({ url })).headers['cache-control'], url).toBe('no-cache');
    expect((await fx.app.inject({ url: '/api/christmas' })).headers['cache-control']).toBe('no-store');
  });

  it('a file written after startup is served without a restart; SPA fallback and JSON 404 still work', async () => {
    await fsp.writeFile(path.join(fx.webDir, 'assets', 'new-abc.js'), 'console.log(2)');
    const r = await fx.app.inject({ url: '/assets/new-abc.js' });
    expect(r.statusCode).toBe(200);
    expect(r.body).toContain('console.log(2)');
    expect((await fx.app.inject({ url: '/glossary/some/deep' })).body).toContain('qdigo');
    const api = await fx.app.inject({ url: '/api/missing' });
    expect(api.statusCode).toBe(404);
    expect(api.json()).toEqual({ error: 'not found' });
  });
});
