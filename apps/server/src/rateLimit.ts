/**
 * Counts failed admin authentications per key (client IP) in fixed windows. Only failures count, so
 * normal admin use is never throttled. Memory is bounded: expired entries are pruned on access and the
 * oldest entry is evicted once `maxKeys` is reached.
 */

export interface FailureLimiter {
  /** seconds until the key may try again, or 0 when it is not blocked */
  blocked(key: string): number;
  fail(key: string): void;
  size(): number;
}

export function createFailureLimiter(opts: { max?: number; windowMs?: number; maxKeys?: number; now?: () => number } = {}): FailureLimiter {
  const max = opts.max ?? 10;
  const windowMs = opts.windowMs ?? 15 * 60_000;
  const maxKeys = opts.maxKeys ?? 10_000;
  const now = opts.now ?? Date.now;
  const m = new Map<string, { count: number; resetAt: number }>();
  const get = (key: string) => {
    const e = m.get(key);
    if (e && e.resetAt <= now()) { m.delete(key); return undefined; }
    return e;
  };
  return {
    blocked(key) {
      const e = get(key);
      return e && e.count >= max ? Math.max(1, Math.ceil((e.resetAt - now()) / 1000)) : 0;
    },
    fail(key) {
      const e = get(key);
      if (e) { e.count++; return; }
      if (m.size >= maxKeys) {
        const t = now();
        for (const [k, v] of m) if (v.resetAt <= t) m.delete(k);
        if (m.size >= maxKeys) m.delete(m.keys().next().value!);
      }
      m.set(key, { count: 1, resetAt: now() + windowMs });
    },
    size: () => m.size,
  };
}
