/**
 * S5c, S5d: the admin token is kept in sessionStorage (not IndexedDB, which module logic workers can reach),
 * a legacy IndexedDB row is purged, and compose publishes the port on localhost only.
 * Counterexample before the fix: signing in wrote an `adminToken` row to the settings table; compose bound 8080:8080.
 */
import 'fake-indexeddb/auto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { installStorage } from './helpers';
import { db } from '../src/storage/db';
import { getAdminToken, purgeLegacyAdminToken, setAdminToken } from '../src/admin/token';
import { exportProgress } from '../src/storage/exportImport';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('admin token storage', () => {
  let session: Storage;
  beforeEach(async () => { ({ session } = installStorage()); await db.settings.clear(); });

  it('sign-in stores the token in sessionStorage only', async () => {
    setAdminToken('secret-token-0123456789');
    expect(session.getItem('kodigo-admin-token')).toBe('secret-token-0123456789');
    expect(getAdminToken()).toBe('secret-token-0123456789');
    expect(await db.settings.get('adminToken')).toBeUndefined();
    setAdminToken(null);
    expect(session.getItem('kodigo-admin-token')).toBeNull();
    expect(getAdminToken()).toBeNull();
  });

  it('a legacy adminToken row is deleted at startup and other settings stay', async () => {
    await db.settings.bulkPut([{ key: 'adminToken', value: 'old', updatedAt: 1 }, { key: 'theme', value: 'dark', updatedAt: 1 }]);
    await purgeLegacyAdminToken();
    expect(await db.settings.get('adminToken')).toBeUndefined();
    expect((await db.settings.get('theme'))?.value).toBe('dark');
  });

  it('export never includes the admin token', async () => {
    await db.settings.bulkPut([{ key: 'adminToken', value: 'old', updatedAt: 1 }, { key: 'theme', value: 'dark', updatedAt: 1 }]);
    const out = await exportProgress();
    const text = typeof out === 'string' ? out : JSON.stringify(out);
    expect(text).not.toContain('"adminToken"');
    expect(text).toContain('"theme"');
  });
});

describe('compose', () => {
  it('publishes the port on 127.0.0.1 only', () => {
    const ports = fs.readFileSync(path.join(root, 'docker/compose.yml'), 'utf8').split('\n').filter((l) => /^\s*ports:/.test(l));
    expect(ports).toEqual(['    ports: ["127.0.0.1:8080:8080"]']);
  });
});
