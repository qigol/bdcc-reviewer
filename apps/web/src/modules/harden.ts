/** Removes network and storage globals from the logic worker before module code runs. */

export function hardenWorkerGlobal(g: any, blocked: readonly string[]) {
  for (const k of blocked) {
    try { g[k] = undefined; } catch { /* ignore */ }
  }
}
