/**
 * Removes network, storage and nested-worker globals from the logic worker before module code runs.
 * Plain assignment is not enough: many of these are setter-less accessors on a prototype (for example
 * `indexedDB` on WorkerGlobalScope.prototype), where `self.indexedDB = undefined` silently does nothing.
 */

export const BLOCKED = [
  'fetch', 'XMLHttpRequest', 'WebSocket', 'WebSocketStream', 'EventSource', 'importScripts', 'indexedDB', 'caches',
  'Worker', 'SharedWorker', 'BroadcastChannel', 'WebTransport', 'RTCPeerConnection', 'IDBFactory', 'CacheStorage',
] as const;

/** Make `name` read `undefined` on `obj`: clear it along the prototype chain, then pin an own non-writable undefined. */
function block(obj: any, name: string) {
  for (let o = obj; o; o = Object.getPrototypeOf(o)) {
    const d = Object.getOwnPropertyDescriptor(o, name);
    if (!d) continue;
    if (d.configurable) {
      try { delete o[name]; } catch { /* checked below */ }
    } else if (d.writable) {
      // non-configurable but writable data: may still be turned read-only
      try { Object.defineProperty(o, name, { value: undefined, writable: false }); } catch { /* checked below */ }
    }
  }
  const own = Object.getOwnPropertyDescriptor(obj, name);
  if (!own || own.configurable) {
    try { Object.defineProperty(obj, name, { value: undefined, writable: false, configurable: false, enumerable: false }); } catch { /* checked below */ }
  }
}

/** Throws if any blocked name is still reachable, so module code never runs unprotected (fail closed). */
export function hardenWorkerGlobal(g: any, blocked: readonly string[] = BLOCKED) {
  for (const k of blocked) block(g, k);
  const nav = g.navigator;
  if (nav) {
    block(nav, 'storage');
    const WN = g.WorkerNavigator?.prototype;
    if (WN) block(WN, 'storage');
  }
  for (const k of blocked) if (typeof g[k] !== 'undefined') throw new Error(`logic sandbox setup failed: ${k} still reachable`);
  if (nav && typeof nav.storage !== 'undefined') throw new Error('logic sandbox setup failed: navigator.storage still reachable');
}
