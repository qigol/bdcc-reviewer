/**
 * Caps live logic workers: at most 4 at once, none idle for more than 60 s. When the cap is reached the
 * least-recently-used client with no calls in flight is suspended; if all are busy, acquire waits in FIFO order.
 * A suspended client keeps its fns, generators and result cache and restarts its worker on the next call.
 */

export interface PoolClient {
  /** calls in flight */
  busy(): boolean;
  /** terminate the worker but keep cached state */
  suspend(): void;
}

export const POOL_CAP = 4;
export const POOL_IDLE_MS = 60_000;

export function createLogicPool(cap = POOL_CAP, idleMs = POOL_IDLE_MS) {
  /** most recently used last */
  const live: PoolClient[] = [];
  const timers = new Map<PoolClient, ReturnType<typeof setTimeout>>();
  const waiting: { client: PoolClient; resolve: () => void }[] = [];

  const stopTimer = (c: PoolClient) => {
    const t = timers.get(c);
    if (t !== undefined) clearTimeout(t);
    timers.delete(c);
  };
  const remove = (c: PoolClient) => {
    stopTimer(c);
    const i = live.indexOf(c);
    if (i >= 0) live.splice(i, 1);
  };
  const evictIdle = () => {
    const victim = live.find((c) => !c.busy());
    if (!victim) return false;
    remove(victim);
    victim.suspend();
    return true;
  };
  const drain = () => {
    while (waiting.length && (live.length < cap || evictIdle())) {
      const w = waiting.shift()!;
      live.push(w.client);
      w.resolve();
    }
  };

  return {
    /** Resolves once `client` may run a worker. */
    acquire(client: PoolClient): Promise<void> {
      if (live.includes(client)) return Promise.resolve();
      return new Promise<void>((resolve) => {
        waiting.push({ client, resolve });
        drain();
      });
    },
    /** A call finished or started: mark most recently used and restart the idle timer. */
    touch(client: PoolClient) {
      const i = live.indexOf(client);
      if (i < 0) return;
      live.splice(i, 1);
      live.push(client);
      stopTimer(client);
      timers.set(client, setTimeout(() => {
        if (client.busy()) { this.touch(client); return; }
        remove(client);
        client.suspend();
        drain();
      }, idleMs));
      drain();
    },
    /** The client's worker is gone (disposed or killed after a timeout). */
    release(client: PoolClient) {
      remove(client);
      const w = waiting.findIndex((x) => x.client === client);
      if (w >= 0) waiting.splice(w, 1);
      drain();
    },
    size: () => live.length,
  };
}

export const logicPool = createLogicPool();
