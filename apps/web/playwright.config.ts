import { defineConfig } from '@playwright/test';

// Smoke test against a running Qdigo server (build first: `pnpm build`).
// By default this starts the bundled server on :8080 with the built-in modules;
// set KODIGO_URL to test an already running instance instead.
const url = process.env.KODIGO_URL ?? 'http://localhost:8080';

export default defineConfig({
  testDir: './e2e',
  timeout: 10 * 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: url, actionTimeout: 5_000, navigationTimeout: 20_000, viewport: { width: 1400, height: 1000 } },
  webServer: process.env.KODIGO_URL
    ? undefined
    : {
        command: 'node ../server/dist/index.js',
        url: `${url}/api/health`,
        reuseExistingServer: true,
        env: { MODULES_BUILTIN: '../../modules', WEB_DIR: './dist', DATA_DIR: './test-results/data', ADMIN_TOKEN: 'smoke', LOG_LEVEL: 'warn' },
      },
});
