import { db, DB_VERSION } from './db';

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
      settings: (await db.settings.toArray()).filter((s) => s.key !== 'adminToken'),
    },
  };
  return JSON.stringify(data, null, 1);
}

/** Merge by key; on conflicts the later updatedAt wins. Attempts and notes are de-duplicated. */
export async function importProgress(json: string): Promise<{ added: number; updated: number }> {
  const data = JSON.parse(json);
  if (data?.app !== 'kodigo' || !data.tables) throw new Error('Not a Qdigo progress file');
  let added = 0, updated = 0;
  const t = data.tables;
  await db.transaction('rw', [db.progress, db.attempts, db.srs, db.mastery, db.notes, db.bookmarks, db.settings], async () => {
    const mergeKeyed = async (table: any, rows: any[], keyOf: (r: any) => any, time = (r: any) => r.updatedAt ?? r.createdAt ?? 0) => {
      for (const r of rows ?? []) {
        const cur = await table.get(keyOf(r));
        if (!cur) { await table.put(r); added++; }
        else if (time(r) > time(cur)) { await table.put(r); updated++; }
      }
    };
    await mergeKeyed(db.progress, t.progress, (r) => [r.moduleId, r.tab, r.itemId]);
    await mergeKeyed(db.srs, t.srs, (r) => r.templateId);
    await mergeKeyed(db.mastery, t.mastery, (r) => r.skillKey);
    await mergeKeyed(db.bookmarks, t.bookmarks, (r) => [r.moduleId, r.ref]);
    await mergeKeyed(db.settings, (t.settings ?? []).filter((s: any) => s.key !== 'adminToken'), (r) => r.key);
    const seen = new Set((await db.attempts.toArray()).map((a) => `${a.key}|${a.seed}|${a.at}`));
    for (const a of t.attempts ?? []) {
      const k = `${a.key}|${a.seed}|${a.at}`;
      if (seen.has(k)) continue;
      const { id: _id, ...rest } = a;
      await db.attempts.add(rest);
      added++;
    }
    const notes = new Set((await db.notes.toArray()).map((n) => `${n.moduleId}|${n.anchor}|${n.createdAt}`));
    for (const n of t.notes ?? []) {
      const k = `${n.moduleId}|${n.anchor}|${n.createdAt}`;
      if (notes.has(k)) continue;
      const { id: _id, ...rest } = n;
      await db.notes.add(rest);
      added++;
    }
  });
  return { added, updated };
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
