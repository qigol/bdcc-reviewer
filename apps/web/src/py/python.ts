/**
 * A Python kernel in the browser (Pyodide in a Web Worker), shaped like a notebook: cells run in one shared namespace,
 * numbered like Jupyter's counter, and `restart()` forgets every variable. A run that takes longer than `timeoutMs`
 * (an infinite loop, a huge loop) terminates the worker, so the kernel restarts and Python loads again.
 */
export interface CellResult { out: string; err: string; ms: number; timedOut?: boolean }
type Pending = { resolve: (v: any) => void; reject: (e: Error) => void };

export class PythonKernel {
  private worker: Worker | null = null;
  private pending = new Map<number, Pending>();
  private nextId = 1;
  private counter = 0;
  private ready: Promise<void> | null = null;
  /** load progress for the UI: 'Loading Python…', 'Loading pandas…', 'ready', or an error */
  onStage: (stage: string) => void = () => {};

  private start() {
    const w = new Worker(new URL('./pyodide.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e) => {
      const d = e.data;
      if (d.type === 'progress') return this.onStage(d.stage);
      const p = this.pending.get(d.id);
      if (!p) return;
      this.pending.delete(d.id);
      d.ok ? p.resolve(d) : p.reject(new Error(d.error));
    };
    w.onerror = (e) => { this.onStage(`error: ${e.message}`); };
    this.worker = w;
  }

  private call(msg: Record<string, unknown>): Promise<any> {
    if (!this.worker) this.start();
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker!.postMessage({ ...msg, id });
    });
  }

  /** Start loading Python and pandas (about 23 MB the first time, then from the browser cache). */
  load(): Promise<void> {
    this.ready ??= this.call({ type: 'load' }).then(() => undefined, (e) => { this.ready = null; this.onStage(`error: ${e.message}`); throw e; });
    return this.ready;
  }

  /** Run one cell. `files` are written into Python's file system first (path → text). */
  async run(code: string, files?: Record<string, string>, timeoutMs = 20_000): Promise<CellResult> {
    await this.load();
    const cell = ++this.counter;
    const t0 = performance.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<CellResult>((resolve) => {
      timer = setTimeout(() => {
        this.kill();
        resolve({ out: '', err: `Stopped after ${timeoutMs / 1000} s (an endless loop?). The kernel restarted: run your cells again.`, ms: timeoutMs, timedOut: true });
      }, timeoutMs);
    });
    const done = this.call({ type: 'run', code, cell, files }).then((d) => ({ out: d.out as string, err: d.err as string, ms: performance.now() - t0 }));
    try { return await Promise.race([done, timeout]); } finally { clearTimeout(timer); }
  }

  /** Forget every variable and import, like Restart kernel. */
  async restart(): Promise<void> {
    this.counter = 0;
    if (this.worker) await this.call({ type: 'reset' });
  }

  private kill() {
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
    this.counter = 0;
    for (const p of this.pending.values()) p.reject(new Error('kernel stopped'));
    this.pending.clear();
    this.onStage('Restarting Python…');
    void this.load().catch(() => {});
  }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
    this.pending.clear();
  }
}
