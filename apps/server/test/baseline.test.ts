/**
 * Preservation baselines (audit task 2 / Property 2): API contracts, /files media behavior, routing and
 * registry versioning, as recorded on the code before the audit fixes. Snapshots hold only the parts
 * the fixes must not change (status, body shape, content-type/length, ranges), not security headers.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readModuleDir } from '@kodigo/schema/node';
import { makeFixture, ADMIN, FIXTURE_MODULE, type Fixture } from './fixtures';

const shape = (v: unknown): unknown =>
  Array.isArray(v) ? (v.length ? [shape(v[0])] : []) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort().map(([k, x]) => [k, shape(x)])) : typeof v;
const pick = (h: Record<string, unknown>) => ({ 'content-type': h['content-type'], 'content-length': h['content-length'], 'accept-ranges': h['accept-ranges'], 'content-range': h['content-range'] });

describe('API contract baseline', () => {
  let fx: Fixture;
  beforeAll(async () => { fx = await makeFixture(); });
  afterAll(async () => { await fx.close(); });

  it('read routes keep status and body shape', async () => {
    const routes = ['/api/health', '/api/christmas', '/api/modules', `/api/modules/${FIXTURE_MODULE}/files`, `/api/modules/${FIXTURE_MODULE}/report`, '/api/widgets.md', '/api/modules/nope/files', '/api/modules/nope/report'];
    const out: Record<string, unknown> = {};
    for (const url of routes) {
      const r = await fx.app.inject({ url });
      const ct = String(r.headers['content-type'] ?? '');
      out[url] = { status: r.statusCode, type: ct.split(';')[0], body: ct.includes('json') ? shape(r.json()) : typeof r.body };
    }
    expect(out).toMatchSnapshot();
  }, 60_000);

  it('admin routes: 401 without token, 200 with it', async () => {
    expect((await fx.app.inject({ url: '/api/admin/check' })).statusCode).toBe(401);
    const ok = await fx.app.inject({ url: '/api/admin/check', headers: ADMIN });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({ ok: true });
  });

  it('module files: types, ranges, lengths and path escapes', async () => {
    const dir = path.join(fx.builtinDir, FIXTURE_MODULE);
    await fs.writeFile(path.join(dir, 'assets', 'a.png'), Buffer.alloc(300, 1));
    await fs.writeFile(path.join(dir, 'assets', 'v.mp4'), Buffer.alloc(1000, 2));
    await fs.writeFile(path.join(dir, 'assets', 'd.pdf'), Buffer.from('%PDF-1.4 test'));
    const base = `/api/modules/${FIXTURE_MODULE}/files`;
    const out: Record<string, unknown> = {};
    const cases: [string, Record<string, string>?][] = [
      ['assets/a.png'], ['assets/v.mp4'], ['assets/d.pdf'], ['manifest.yaml'],
      ['assets/v.mp4', { range: 'bytes=0-99' }], ['assets/v.mp4', { range: 'bytes=900-' }], ['assets/v.mp4', { range: 'bytes=-10' }],
      ['assets/v.mp4', { range: 'bytes=5000-' }], ['assets/missing.png'],
    ];
    for (const [p, headers] of cases) {
      const r = await fx.app.inject({ url: `${base}/${p}`, headers });
      out[`${p} ${headers?.range ?? ''}`] = { status: r.statusCode, ...pick(r.headers), bytes: r.rawPayload.length };
    }
    expect(out).toMatchSnapshot();
    expect((await fx.app.inject({ url: `${base}/..%2F..%2Fpackage.json` })).statusCode).toBe(400);
  });

  it('SPA fallback serves index.html; unknown /api/ paths get a JSON 404', async () => {
    const page = await fx.app.inject({ url: '/m/x/path' });
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain('qdigo');
    const api = await fx.app.inject({ url: '/api/nope' });
    expect(api.statusCode).toBe(404);
    expect(api.json()).toEqual({ error: 'not found' });
  });
});

describe('registry versioning baseline', () => {
  let fx: Fixture;
  beforeAll(async () => { fx = await makeFixture(); });
  afterAll(async () => { await fx.close(); });

  const bundle = async (version: string) => {
    const files = await readModuleDir(path.join(fx.builtinDir, FIXTURE_MODULE));
    delete files['assets/evil.svg'];
    files['manifest.yaml'] = String(files['manifest.yaml']).replace(/^version:.*$/m, `version: ${version}`);
    const json: Record<string, string | { base64: string }> = {};
    for (const [p, c] of Object.entries(files)) json[p] = typeof c === 'string' ? c : { base64: Buffer.from(c).toString('base64') };
    return { files: json };
  };
  const install = async (v: string, q = '') => fx.app.inject({ method: 'POST', url: `/api/modules${q}`, headers: ADMIN, payload: await bundle(v) });
  const entry = async () => (await fx.app.inject({ url: '/api/modules' })).json().find((m: any) => m.id === FIXTURE_MODULE);

  it('install stores <id>@<version>, keeps the newest 3, rolls back, downgrades need consent, remove', async () => {
    const r = await install('9.0.0');
    expect(r.statusCode).toBe(200);
    expect(await fs.readdir(path.join(fx.dataDir, 'modules'))).toContain(`${FIXTURE_MODULE}@9.0.0`);
    expect(await entry()).toMatchObject({ version: '9.0.0', origin: 'imported' });
    for (const v of ['9.1.0', '9.2.0', '9.3.0', '9.4.0']) expect((await install(v)).statusCode).toBe(200);
    expect((await entry()).versions).toEqual(['9.2.0', '9.3.0', '9.4.0']);
    expect((await fx.app.inject({ method: 'PATCH', url: `/api/modules/${FIXTURE_MODULE}`, headers: ADMIN, payload: { current: '9.2.0' } })).statusCode).toBe(200);
    expect((await entry()).version).toBe('9.2.0');
    expect((await install('1.0.0')).statusCode).toBe(409);
    expect((await install('1.0.0', '?allowDowngrade=1')).statusCode).toBe(200);
    const dry = await install('9.9.9', '?dryRun=1');
    expect(dry.statusCode).toBe(200);
    expect(dry.json().ok).toBe(true);
    const bad = await fx.app.inject({ method: 'POST', url: '/api/modules', headers: ADMIN, payload: { files: { 'manifest.yaml': 'id: x' } } });
    expect(bad.statusCode).toBe(422);
    expect((await fx.app.inject({ method: 'DELETE', url: `/api/modules/${FIXTURE_MODULE}`, headers: ADMIN })).statusCode).toBe(200);
    expect(await entry()).toMatchObject({ origin: 'builtin', versions: [] });
  }, 120_000);

  it('keepAssets keeps the installed version\'s assets for a text-only re-import', async () => {
    const full = await bundle('10.0.0');
    full.files['assets/keep.png'] = { base64: Buffer.alloc(10, 3).toString('base64') };
    expect((await fx.app.inject({ method: 'POST', url: '/api/modules', headers: ADMIN, payload: full })).statusCode).toBe(200);
    const text = await bundle('10.1.0');
    for (const k of Object.keys(text.files)) if (typeof text.files[k] !== 'string') delete text.files[k];
    expect((await fx.app.inject({ method: 'POST', url: '/api/modules?keepAssets=1', headers: ADMIN, payload: text })).statusCode).toBe(200);
    const files = await fs.readdir(path.join(fx.dataDir, 'modules', `${FIXTURE_MODULE}@10.1.0`, 'assets'));
    expect(files).toContain('keep.png');
  }, 120_000);
});
