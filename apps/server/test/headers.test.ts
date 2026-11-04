/**
 * Property 1 (S3a, S4): the logic worker and module files carry a CSP, and module .js is served as text.
 * Counterexample before the fix: neither response had a CSP, and .js was text/javascript.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeFixture, FIXTURE_MODULE, SVG_WITH_SCRIPT, type Fixture } from './fixtures';

describe('worker and module-file headers', () => {
  let fx: Fixture;
  beforeAll(async () => { fx = await makeFixture(); });
  afterAll(async () => { await fx.close(); });

  it('the logic worker asset forbids network and nested workers', async () => {
    const r = await fx.app.inject({ url: '/assets/logic.worker-test.js' });
    expect(r.statusCode).toBe(200);
    const csp = String(r.headers['content-security-policy']);
    expect(csp).toContain("connect-src 'none'");
    expect(csp).toContain("worker-src 'none'");
  });

  it('a module SVG with a script is sandboxed', async () => {
    const r = await fx.app.inject({ url: `/api/modules/${FIXTURE_MODULE}/files/${SVG_WITH_SCRIPT}` });
    expect(r.statusCode).toBe(200);
    expect(String(r.headers['content-security-policy'])).toContain('sandbox');
  });

  it('module .js files are served as plain text', async () => {
    const r = await fx.app.inject({ url: `/api/modules/${FIXTURE_MODULE}/files/logic.js` });
    expect(r.headers['content-type']).toBe('text/plain; charset=utf-8');
    expect(String(r.headers['content-security-policy'])).toContain('sandbox');
  });
});
