/**
 * Property 20 (O1): served docs equal docs/. Counterexample before the fix: apps/web/public/docs held
 * hand-maintained copies, and the served authoring guide was 135 lines behind.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { widgetsMarkdown } from '@kodigo/schema';
import { docsAssets } from '../docsPlugin';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(web, '../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

describe('served docs', () => {
  it('come from docs/, with no copy to drift', () => {
    const assets = docsAssets(root);
    expect(assets.map((a) => a.fileName)).toEqual(['docs/MODULE_AUTHORING_GUIDE.md', 'docs/WIDGETS.md']);
    for (const a of assets) expect(a.source).toBe(read(a.fileName));
    expect(fs.existsSync(path.join(web, 'public/docs'))).toBe(false);
  });

  it('a build holds byte-equal copies', () => {
    const dist = path.join(web, 'dist/docs');
    if (!fs.existsSync(dist)) return;
    for (const a of docsAssets(root)) expect(fs.readFileSync(path.join(web, 'dist', a.fileName), 'utf8')).toBe(a.source);
  });

  it('docs/WIDGETS.md is what the catalog generates', () => {
    expect(read('docs/WIDGETS.md').replace(/\r\n/g, '\n')).toBe(widgetsMarkdown().replace(/\r\n/g, '\n'));
  });
});
