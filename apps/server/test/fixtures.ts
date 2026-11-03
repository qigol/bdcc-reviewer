/** Test fixture: temp DATA_DIR, MODULES_BUILTIN (copies of built-in modules) and WEB_DIR, served by buildApp. */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createNodeHost } from '@kodigo/schema/node';
import { buildApp, type AppDeps } from '../src/app';
import { loadConfig } from '../src/config';

export const repoModules = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../modules');
export const FIXTURE_MODULE = 'cost-concepts';
export const SVG_WITH_SCRIPT = 'assets/evil.svg';

export interface Fixture {
  root: string;
  dataDir: string;
  builtinDir: string;
  webDir: string;
  app: Awaited<ReturnType<typeof buildApp>>['app'];
  registry: Awaited<ReturnType<typeof buildApp>>['registry'];
  close: () => Promise<void>;
}

export async function makeFixture(opts: { env?: Record<string, string>; deps?: AppDeps; modules?: string[] } = {}): Promise<Fixture> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kodigo-app-'));
  const dataDir = path.join(root, 'data');
  const builtinDir = path.join(root, 'modules');
  const webDir = path.join(root, 'web');
  for (const id of opts.modules ?? [FIXTURE_MODULE]) await fs.cp(path.join(repoModules, id), path.join(builtinDir, id), { recursive: true });
  const first = path.join(builtinDir, (opts.modules ?? [FIXTURE_MODULE])[0]);
  await fs.mkdir(path.join(first, 'assets'), { recursive: true });
  await fs.writeFile(path.join(first, SVG_WITH_SCRIPT), '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  await fs.mkdir(path.join(webDir, 'assets'), { recursive: true });
  await fs.writeFile(path.join(webDir, 'index.html'), '<!doctype html><html><body>qdigo</body></html>');
  await fs.writeFile(path.join(webDir, 'assets', 'logic.worker-test.js'), 'self.x = 1;');
  await fs.writeFile(path.join(webDir, 'assets', 'pyodide.worker-test.js'), 'self.y = 1;');
  await fs.writeFile(path.join(webDir, 'assets', 'index-test.js'), 'console.log(1);'.repeat(200));
  const cfg = loadConfig({ DATA_DIR: dataDir, MODULES_BUILTIN: builtinDir, WEB_DIR: webDir, ADMIN_TOKEN: 'test-token-0123456789', ...opts.env });
  const built = await buildApp(cfg, { logger: false, hostFactory: (src) => createNodeHost(src), ...opts.deps });
  return {
    root, dataDir, builtinDir, webDir, app: built.app, registry: built.registry,
    close: async () => { await built.close(); await fs.rm(root, { recursive: true, force: true }); },
  };
}

export const ADMIN = { authorization: 'Bearer test-token-0123456789' };
