/**
 * Property 4 (preservation): a LogicHostFactory gives the same generator and fn outputs, and the same
 * validation reports, as the in-process host did before the audit fixes (baseline/*.json).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateModule, type LogicHostFactory } from '@kodigo/schema';
import { createNodeHost, readModuleDir } from '@kodigo/schema/node';
import { builtinIds, sampleModule } from './hostSamples';
import { repoModules } from './fixtures';
import { reportShape } from './baseline/shape';

const here = path.dirname(fileURLToPath(import.meta.url));
const hostBaseline = JSON.parse(fs.readFileSync(path.join(here, 'baseline/host-outputs.json'), 'utf8'));
const reportBaseline = JSON.parse(fs.readFileSync(path.join(here, 'baseline/validate-reports.json'), 'utf8'));

export const FACTORIES: [string, LogicHostFactory][] = [['in-process', (src) => createNodeHost(src)]];

describe.each(FACTORIES)('%s host', (_name, factory) => {
  it.each(builtinIds())('%s: outputs and report match the baseline', async (id) => {
    expect(await sampleModule(id, factory)).toEqual(hostBaseline[id]);
    const report = await validateModule(await readModuleDir(path.join(repoModules, id)), { hostFactory: factory, seeds: 10 });
    expect(reportShape(report)).toEqual(reportBaseline[id]);
  }, 120_000);

  it('Math.random still throws', async () => {
    const h = await factory('export default function () { return { fns: { r: () => Math.random() }, generators: {} }; }');
    try {
      await expect(h.call('r', {})).rejects.toThrow(/Math\.random is not allowed/);
    } finally {
      await h.dispose?.();
    }
  });
});
