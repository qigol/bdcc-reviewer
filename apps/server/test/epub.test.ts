import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeFixture, type Fixture } from './fixtures';

describe('e-reader downloads', () => {
  let fx: Fixture;
  let epubDir: string;
  beforeAll(async () => {
    epubDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kodigo-epub-'));
    await fs.writeFile(path.join(epubDir, 'bdcc.epub'), 'PK-fake-epub');
    await fs.writeFile(path.join(epubDir, 'secret.epub'), 'not listed');
    await fs.writeFile(path.join(epubDir, 'index.json'), JSON.stringify({
      books: [
        { file: 'bdcc.epub', kind: 'course', title: 'BDCC', course: 'BDCC', modules: 1, chapters: 3, bytes: 12 },
        { file: '../evil.epub', kind: 'module', title: 'x', chapters: 1, bytes: 1 },
      ],
    }));
    fx = await makeFixture({ env: { EPUB_DIR: epubDir } });
  });
  afterAll(async () => { await fx.close(); await fs.rm(epubDir, { recursive: true, force: true }); });

  it('lists only well-formed book file names', async () => {
    const r = await fx.app.inject({ url: '/api/epub' });
    expect(r.statusCode).toBe(200);
    expect(r.json().books.map((b: any) => b.file)).toEqual(['bdcc.epub']);
  });

  it('serves a listed book as an attachment, uncompressed', async () => {
    const r = await fx.app.inject({ url: '/api/epub/bdcc.epub', headers: { 'accept-encoding': 'br, gzip' } });
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-type']).toBe('application/epub+zip');
    expect(r.headers['content-disposition']).toBe('attachment; filename="bdcc.epub"');
    expect(r.headers['content-encoding']).toBeUndefined();
    expect(r.body).toBe('PK-fake-epub');
  });

  it('refuses files that index.json does not list', async () => {
    expect((await fx.app.inject({ url: '/api/epub/secret.epub' })).statusCode).toBe(404);
    expect((await fx.app.inject({ url: '/api/epub/index.json' })).statusCode).toBe(404);
    expect((await fx.app.inject({ url: '/api/epub/..%2Fevil.epub' })).statusCode).toBe(404);
  });

  it('lists nothing when no books were built', async () => {
    const empty = await makeFixture({ env: { EPUB_DIR: path.join(epubDir, 'missing') } });
    try {
      expect((await empty.app.inject({ url: '/api/epub' })).json()).toEqual({ books: [] });
    } finally { await empty.close(); }
  });
});
