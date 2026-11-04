/**
 * The admin token lives in this tab's sessionStorage, never in IndexedDB: workers (where module logic runs)
 * have no sessionStorage, and it is gone when the tab closes. Falls back to memory when storage is blocked.
 */
import { useSyncExternalStore } from 'react';
import { db } from '../storage/db';

const KEY = 'kodigo-admin-token';
let memory: string | null = null;
const listeners = new Set<() => void>();

export function getAdminToken(): string | null {
  try { return sessionStorage.getItem(KEY) ?? memory; } catch { return memory; }
}

export function setAdminToken(t: string | null) {
  memory = t;
  try { t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY); } catch { /* memory only */ }
  for (const l of listeners) l();
}

export function useAdminToken(): [string | null, (t: string | null) => void] {
  const t = useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, getAdminToken);
  return [t, setAdminToken];
}

/** Older versions kept the token in the IndexedDB settings table; delete it once at startup. */
export async function purgeLegacyAdminToken() {
  await db.settings.delete('adminToken');
}
