/**
 * Records behavior of the unfixed code as JSON baselines (audit task 2). Run once before a fix lands:
 *   pnpm exec tsx apps/server/test/baseline/record.ts
 * Tests compare later behavior against these files; never regenerate them to make a test pass.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateModule } from '@kodigo/schema';
import { createNodeHost, readModuleDir } from '@kodigo/schema/node';
import { builtinIds, sampleModule } from '../hostSamples';
import { repoModules } from '../fixtures';
import { reportShape } from './shape';

const here = path.dirname(fileURLToPath(import.meta.url));
const hostFactory = (src: string) => createNodeHost(src);


const host: Record<string, unknown> = {};
const reports: Record<string, unknown> = {};
for (const id of builtinIds()) {
  host[id] = await sampleModule(id, hostFactory);
  reports[id] = reportShape(await validateModule(await readModuleDir(path.join(repoModules, id)), { hostFactory, seeds: 10 }));
  console.log('recorded', id);
}
fs.writeFileSync(path.join(here, 'host-outputs.json'), JSON.stringify(host));
fs.writeFileSync(path.join(here, 'validate-reports.json'), JSON.stringify(reports, null, 1));
