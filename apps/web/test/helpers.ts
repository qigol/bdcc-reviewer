/** Test helpers for web unit tests that run in node: fake Web Storage and a fake Worker constructor. */

export class FakeStorage implements Storage {
  private m = new Map<string, string>();
  quota = Infinity;
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) {
    const size = [...this.m.entries()].reduce((n, [a, b]) => (a === k ? n : n + a.length + b.length), 0) + k.length + String(v).length;
    if (size > this.quota) throw Object.assign(new Error('quota exceeded'), { name: 'QuotaExceededError' });
    this.m.set(k, String(v));
  }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}

/** Install fresh localStorage/sessionStorage on globalThis; returns them. */
export function installStorage(): { local: FakeStorage; session: FakeStorage } {
  const local = new FakeStorage();
  const session = new FakeStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: local, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'sessionStorage', { value: session, configurable: true, writable: true });
  return { local, session };
}

/** A Worker stand-in that records instances; `onPost` handles messages. */
export class FakeWorker {
  static live = new Set<FakeWorker>();
  static started = 0;
  terminated = false;
  onmessage: ((e: MessageEvent) => void) | null = null;
  private listeners = new Set<(e: MessageEvent) => void>();
  constructor(public url: string | URL, public opts?: WorkerOptions) {
    FakeWorker.live.add(this);
    FakeWorker.started++;
  }
  postMessage(_m: unknown) {}
  addEventListener(_t: string, l: (e: MessageEvent) => void) { this.listeners.add(l); }
  removeEventListener(_t: string, l: (e: MessageEvent) => void) { this.listeners.delete(l); }
  terminate() { this.terminated = true; FakeWorker.live.delete(this); }
  static reset() { FakeWorker.live.clear(); FakeWorker.started = 0; }
}
