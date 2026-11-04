/**
 * Property 7 (S5a, S5b): weak production tokens disable admin, and an IP gets 429 after 10 failed
 * attempts in 15 minutes. Counterexamples before the fix: `change-me` enabled admin in production, and
 * 20 wrong tokens in a row all returned 401. Also the preservation side (3.13, 3.14).
 */
import fc from 'fast-check';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig, WEAK_TOKEN_REASON } from '../src/config';
import { createFailureLimiter } from '../src/rateLimit';
import { makeFixture, type Fixture } from './fixtures';

const prod = (ADMIN_TOKEN?: string) => loadConfig({ NODE_ENV: 'production', ...(ADMIN_TOKEN !== undefined ? { ADMIN_TOKEN } : {}) });

describe('admin token strength', () => {
  it('disables admin in production for the example value in any case/whitespace, or anything under 16 chars', () => {
    const changeMe = fc.tuple(fc.constantFrom(' ', '', '\t'), fc.constantFrom('change-me', 'CHANGE-ME', 'Change-Me'), fc.constantFrom(' ', '', '\n'))
      .map(([a, t, b]) => a + t + b);
    fc.assert(fc.property(fc.oneof(changeMe, fc.string({ maxLength: 15 })), (t) => {
      const cfg = prod(t);
      expect(cfg.admin.token).toBe('');
      // a fixed message, so it never echoes the token
      expect(['ADMIN_TOKEN is not set', WEAK_TOKEN_REASON]).toContain(cfg.admin.disabledReason);
    }));
  });

  it('keeps strong tokens (16+ chars, not the example) in production, and `dev` outside it', () => {
    fc.assert(fc.property(fc.string({ minLength: 16, maxLength: 64 }).filter((t) => t.trim().toLowerCase() !== 'change-me'), (t) => {
      expect(prod(t).admin.token).toBe(t);
    }));
    expect(loadConfig({}).admin.token).toBe('dev');
    expect(prod().admin.token).toBe('');
  });

  it('a weak production token answers 503 with the reason; unset answers 503', async () => {
    for (const [token, msg] of [['change-me', /too weak/], [undefined, /not set/]] as const) {
      const fx = await makeFixture({ env: { NODE_ENV: 'production', ...(token ? { ADMIN_TOKEN: token } : { ADMIN_TOKEN: '' }) } });
      try {
        const r = await fx.app.inject({ url: '/api/admin/check', headers: { authorization: `Bearer ${token}` } });
        expect(r.statusCode).toBe(503);
        expect(r.json().error).toMatch(msg);
      } finally { await fx.close(); }
    }
  });
});

describe('failed-auth limiter (reference model)', () => {
  it('blocks a key exactly when it has 10+ failures in its current 15-minute window; keys are independent', () => {
    const ev = fc.record({ ip: fc.constantFrom('a', 'b', 'c'), dt: fc.integer({ min: 0, max: 5 * 60_000 }), ok: fc.boolean() });
    fc.assert(fc.property(fc.array(ev, { maxLength: 80 }), (events) => {
      let t = 0;
      const lim = createFailureLimiter({ now: () => t });
      const model = new Map<string, { count: number; resetAt: number }>();
      for (const e of events) {
        t += e.dt;
        const m = model.get(e.ip);
        if (m && m.resetAt <= t) model.delete(e.ip);
        const cur = model.get(e.ip);
        const blocked = !!cur && cur.count >= 10;
        expect(lim.blocked(e.ip) > 0).toBe(blocked);
        if (blocked || e.ok) continue; // a blocked request is not counted; successes never count
        lim.fail(e.ip);
        if (cur) cur.count++; else model.set(e.ip, { count: 1, resetAt: t + 15 * 60_000 });
      }
    }), { numRuns: 300 });
  });

  it('memory stays bounded', () => {
    const lim = createFailureLimiter({ maxKeys: 100, now: () => 0 });
    for (let i = 0; i < 1000; i++) lim.fail(`ip${i}`);
    expect(lim.size()).toBeLessThanOrEqual(100);
  });
});

describe('admin over HTTP', () => {
  let fx: Fixture;
  let t = 0;
  beforeAll(async () => { fx = await makeFixture({ deps: { now: () => new Date(1_700_000_000_000 + t) } }); });
  afterAll(async () => { await fx.close(); });
  const check = (token: string, ip = '10.0.0.1') => fx.app.inject({ url: '/api/admin/check', remoteAddress: ip, headers: { authorization: `Bearer ${token}` } });

  it('401 for the first 10 wrong tokens, then 429 with retry-after (even for the right token), other IPs unaffected, reset after the window', async () => {
    for (let i = 0; i < 10; i++) expect((await check('wrong-token-' + i)).statusCode).toBe(401);
    const blocked = await check('wrong-again');
    expect(blocked.statusCode).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect(blocked.json().error).toBe('Too many failed admin attempts; try again later');
    expect((await check('test-token-0123456789')).statusCode).toBe(429);
    expect((await check('test-token-0123456789', '10.0.0.2')).statusCode).toBe(200);
    t += 15 * 60_000 + 1;
    expect((await check('test-token-0123456789')).statusCode).toBe(200);
  });
});
