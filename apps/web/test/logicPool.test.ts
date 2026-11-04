/**
 * Property 19 (P3c): live logic workers never exceed the cap, none starts before its first call, idle ones stop,
 * and a suspended client still answers. Counterexample before the fix: every loaded module started a worker at once.
 */
import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLogicPool, POOL_CAP, POOL_IDLE_MS, type PoolClient } from '../src/modules/logicPool';

class Client implements PoolClient {
  live = false;
  calls = 0;
  flight = 0;
  constructor(private pool: ReturnType<typeof createLogicPool>, private onChange: () => void) {}
  busy() { return this.flight > 0; }
  suspend() { this.live = false; this.onChange(); }
  async call() {
    this.flight++;
    await this.pool.acquire(this);
    this.live = true;
    this.onChange();
    this.calls++;
    await Promise.resolve();
    this.flight--;
    this.pool.touch(this);
  }
}

describe('logic pool (Property 19)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('never exceeds the cap across schedules; idle workers stop; calls after suspension work', async () => {
    await fc.assert(fc.asyncProperty(
      fc.array(fc.record({ m: fc.integer({ min: 0, max: 28 }), wait: fc.constantFrom(0, 10, POOL_IDLE_MS + 1) }), { maxLength: 60 }),
      async (schedule) => {
        const pool = createLogicPool();
        let peak = 0;
        const clients: Client[] = [];
        const onChange = () => { peak = Math.max(peak, clients.filter((c) => c.live).length); };
        for (let i = 0; i < 29; i++) clients.push(new Client(pool, onChange));
        expect(clients.filter((c) => c.live)).toHaveLength(0); // nothing starts before its first call
        for (const s of schedule) {
          await clients[s.m].call();
          expect(clients[s.m].calls).toBeGreaterThan(0);
          await vi.advanceTimersByTimeAsync(s.wait);
          expect(pool.size()).toBeLessThanOrEqual(POOL_CAP);
        }
        expect(peak).toBeLessThanOrEqual(POOL_CAP);
        await vi.advanceTimersByTimeAsync(POOL_IDLE_MS + 1);
        expect(clients.filter((c) => c.live)).toHaveLength(0);
        expect(pool.size()).toBe(0);
      },
    ), { numRuns: 100 });
  });

  it('when all are busy, acquire waits in FIFO order until a slot frees', async () => {
    const pool = createLogicPool(1);
    const a: PoolClient = { busy: () => true, suspend: () => {} };
    const order: string[] = [];
    const b: PoolClient = { busy: () => false, suspend: () => {} };
    const c: PoolClient = { busy: () => false, suspend: () => {} };
    await pool.acquire(a);
    const pb = pool.acquire(b).then(() => order.push('b'));
    const pc = pool.acquire(c).then(() => order.push('c'));
    await Promise.resolve();
    expect(order).toEqual([]);
    pool.release(a);
    await pb;
    pool.release(b);
    await pc;
    expect(order).toEqual(['b', 'c']);
  });
});
