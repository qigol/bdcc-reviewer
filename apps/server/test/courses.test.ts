import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Registry, DEFAULT_COURSE } from '../src/registry';

const modulesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../modules');

describe('module courses', () => {
  let dataDir: string;
  beforeEach(async () => { dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kodigo-courses-')); });
  afterEach(async () => { await fs.rm(dataDir, { recursive: true, force: true }); });

  it('files every built-in module under BDCC', async () => {
    const reg = new Registry(modulesDir, dataDir);
    await reg.init();
    const list = await reg.list();
    expect(list.map((m) => m.id).sort()).toEqual(['fim', 'lf-cf', 'nb-cf']);
    for (const m of list) {
      expect(m.course).toBe('BDCC');
      expect(m.courseSource).toBe('manifest');
    }
  });

  it('puts a module without `course` in the default course, and admin overrides win until cleared', async () => {
    const builtin = path.join(dataDir, 'builtin');
    await fs.cp(path.join(modulesDir, 'fim'), path.join(builtin, 'fim'), { recursive: true });
    const mf = path.join(builtin, 'fim', 'manifest.yaml');
    await fs.writeFile(mf, (await fs.readFile(mf, 'utf8')).replace(/^course:.*\n/m, ''));
    const reg = new Registry(builtin, path.join(dataDir, 'data'));
    await reg.init();
    const course = async () => (await reg.list()).find((m) => m.id === 'fim')!;

    expect(await course()).toMatchObject({ course: DEFAULT_COURSE, courseSource: 'default' });
    expect(DEFAULT_COURSE).toBe('BDCC');

    await reg.patch('fim', { course: '  MARK   3336 ' });
    expect(await course()).toMatchObject({ course: 'MARK 3336', courseSource: 'admin' });

    // the override survives a restart (stored in state.json)
    const again = new Registry(builtin, path.join(dataDir, 'data'));
    await again.init();
    expect((await again.list()).find((m) => m.id === 'fim')).toMatchObject({ course: 'MARK 3336', courseSource: 'admin' });

    await reg.patch('fim', { course: '' });
    expect(await course()).toMatchObject({ course: DEFAULT_COURSE, courseSource: 'default' });
  });
});
