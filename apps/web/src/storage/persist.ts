/**
 * Asks the browser not to evict progress, and decides when to remind about backups. Progress lives only in
 * this browser, so a browser under storage pressure could otherwise silently delete it.
 */
import { useEffect, useState } from 'react';
import { getSetting, setSetting, useSetting } from './progress';

const DAY = 86_400_000;
export const BACKUP_AFTER_DAYS = 14;

/** Once, at first use: record the date and ask for persistent storage. */
export async function initStorage(now = Date.now()) {
  if (await getSetting('firstUseAt')) return;
  await setSetting('firstUseAt', now);
  if (!navigator.storage?.persist) return;
  await setSetting('persistRequestedAt', now);
  await navigator.storage.persist().catch(() => false);
}

/** Not persisted, and more than 14 days since the last export (or first use). */
export function backupDue(persisted: boolean, lastExportAt: number | null, firstUseAt: number | null, now = Date.now()): boolean {
  const since = lastExportAt ?? firstUseAt;
  return !persisted && since !== null && now - since > BACKUP_AFTER_DAYS * DAY;
}

/** null until known, or when the browser has no storage manager */
export function usePersisted(): [boolean | null, () => Promise<void>] {
  const [persisted, setPersisted] = useState<boolean | null>(null);
  useEffect(() => { navigator.storage?.persisted?.().then(setPersisted, () => {}); }, []);
  const ask = async () => { if (navigator.storage?.persist) setPersisted(await navigator.storage.persist().catch(() => false)); };
  return [persisted, ask];
}

export function useBackupDue(): boolean {
  const [persisted] = usePersisted();
  const [lastExportAt] = useSetting('lastExportAt');
  const [firstUseAt] = useSetting('firstUseAt');
  return persisted === false && backupDue(false, lastExportAt, firstUseAt);
}
