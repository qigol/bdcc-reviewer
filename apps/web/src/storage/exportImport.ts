import { db, DB_VERSION, type Note } from './db';
import { setSetting } from './progress';
import { validRows, type TableName } from './rows';

/** per-device settings: never exported, ignored on import */
const DEVICE_LOCAL = new Set(['adminToken', 'firstUseAt', 'persistRequestedAt', 'lastExportAt']);

export async function exportProgress(): Promise<string> {
  const data = {
    app: 'kodigo',
    dbVersion: DB_VERSION,
    exportedAt: new Date().toISOString(),
    tables: {
      progress: await db.progress.toArray(),
      attempts: await db.attempts.toArray(),
      srs: await db.srs.toArray(),
      mastery: await db.mastery.toArray(),
      notes: await db.notes.toArray(),
      bookmarks: await db.bookmarks.toArray(),
      settings: (await db.settings.toArray()).filter((s) => !DEVICE_LOCAL.has(s.key)),
    },
  };
  await setSetting('lastExportAt', Date.now());
  return JSON.stringify(data, null, 1);
}

/**
 * Merge by key; on conflicts the later updatedAt wins. Attempts are de-duplicated and notes keep one per anchor.
 * The file's version is checked before anything is written, and rows that don't match their table are skipped.
 */
export async function importProgress(json: string): Promise<{ added: number; updated: number; skipped: number }> {
  const data = JSON.parse(json);
  if (data?.app !== 'kodigo' || !data.tables) throw new Error('Not a Qdigo progress file');
  if (typeof data.dbVersion !== 'number') throw new Error('This progress file is missing its format version');
  if (data.dbVersion > DB_VERSION) throw new Error(`This progress file is from a newer version of Qdigo (format ${data.dbVersion}); update the app first`);
  let added = 0, updated = 0, skipped = 0;
  const valid = (table: TableName) => { const v = validRows(table, data.tables[table]); skipped += v.skipped; return v.rows; };
  const t = {
    progress: valid('progress'), srs: valid('srs'), mastery: valid('mastery'), bookmarks: valid('bookmarks'), attempts: valid('attempts'), notes: valid('notes'),
    settings: valid('settings').filter((s) => !DEVICE_LOCAL.has(s.key)),
  };
  await db.transaction('rw', [db.progress, db.attempts, db.srs, db.mastery, db.notes, db.bookmarks, db.settings], async () => {
    const mergeKeyed = async (table: any, rows: any[], keyOf: (r: any) => any, time = (r: any) => r.updatedAt ?? r.createdAt ?? 0) => {
      for (const r of rows) {
        const cur = await table.get(keyOf(r));
        if (!cur) { await table.put(r); added++; }
        else if (time(r) > time(cur)) { await table.put(r); updated++; }
      }
    };
    await mergeKeyed(db.progress, t.progress, (r) => [r.moduleId, r.tab, r.itemId]);
    await mergeKeyed(db.srs, t.srs, (r) => r.templateId);
    await mergeKeyed(db.mastery, t.mastery, (r) => r.skillKey);
    await mergeKeyed(db.bookmarks, t.bookmarks, (r) => [r.moduleId, r.ref]);
    await mergeKeyed(db.settings, t.settings, (r) => r.key);
    const seen = new Set((await db.attempts.toArray()).map((a) => `${a.key}|${a.seed}|${a.at}`));
    for (const a of t.attempts) {
      const k = `${a.key}|${a.seed}|${a.at}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const { id: _id, ...rest } = a;
      await db.attempts.add(rest);
      added++;
    }
    await mergeNotes(t.notes, (kind) => { if (kind === 'added') added++; else updated++; });
  });
  return { added, updated, skipped };
}

/** One note per (moduleId, anchor): the newest text wins, ties go to local; also cleans duplicates left by older imports. */
async function mergeNotes(imported: any[], count: (kind: 'added' | 'updated') => void) {
  const time = (n: { updatedAt?: number; createdAt: number }) => n.updatedAt ?? n.createdAt;
  const key = (n: { moduleId: string; anchor: string }) => `${n.moduleId}|${n.anchor}`;
  const groups = new Map<string, { local: Note[]; incoming: any[] }>();
  const group = (k: string) => { let g = groups.get(k); if (!g) groups.set(k, (g = { local: [], incoming: [] })); return g; };
  for (const n of await db.notes.toArray()) group(key(n)).local.push(n);
  for (const n of imported) group(key(n)).incoming.push(n);
  for (const { local, incoming } of groups.values()) {
    const newestLocal = local.reduce<Note | null>((best, n) => (!best || time(n) > time(best) ? n : best), null);
    const newestIn = incoming.reduce<any>((best, n) => (!best || time(n) > time(best) ? n : best), null);
    const importWins = !!newestIn && (!newestLocal || time(newestIn) > time(newestLocal));
    const keepId = local[0]?.id;
    if (importWins) {
      const { id: _id, ...rest } = newestIn;
      if (keepId === undefined) { await db.notes.add(rest); count('added'); }
      else { await db.notes.put({ ...rest, id: keepId }); count('updated'); }
    } else if (newestLocal && newestLocal.id !== keepId) {
      await db.notes.put({ ...newestLocal, id: keepId }); // the newest text moves to the anchor's first row
    }
    for (const n of local.slice(1)) await db.notes.delete(n.id!);
  }
}

export async function resetProgress(moduleId?: string) {
  if (!moduleId) {
    await Promise.all([db.progress.clear(), db.attempts.clear(), db.srs.clear(), db.mastery.clear(), db.notes.clear(), db.bookmarks.clear()]);
    return;
  }
  await db.progress.where('moduleId').equals(moduleId).delete();
  await db.attempts.where('moduleId').equals(moduleId).delete();
  await db.srs.where('moduleId').equals(moduleId).delete();
  await db.notes.where('moduleId').equals(moduleId).delete();
  await db.bookmarks.where('moduleId').equals(moduleId).delete();
  const keys = (await db.mastery.toArray()).filter((m) => m.skillKey.startsWith(moduleId + ':')).map((m) => m.skillKey);
  await db.mastery.bulkDelete(keys);
}
