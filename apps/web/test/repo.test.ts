/** O2–O4: CI runs every check, lint exists, the pnpm store stays out of git, and each audited area has tests. */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

describe('repo hygiene', () => {
  it('CI runs install, lint, typecheck, tests, module validation, build, bundle size, audit and smoke', () => {
    const ci = read('.github/workflows/ci.yml');
    for (const step of ['--frozen-lockfile', 'pnpm lint', 'pnpm typecheck', 'pnpm test', 'pnpm kodigo validate modules --warnings', 'pnpm build', 'check-bundle-size.mjs', 'pnpm audit --prod --audit-level=moderate', 'pnpm smoke', 'docker build']) {
      expect(ci, step).toContain(step);
    }
  });

  it('lint is configured', () => {
    expect(JSON.parse(read('package.json')).scripts.lint).toBe('eslint .');
    expect(fs.existsSync(path.join(root, 'eslint.config.js'))).toBe(true);
  });

  it('the pnpm store is not tracked', () => {
    expect(execFileSync('git', ['ls-files', '.pnpm-store'], { cwd: root }).toString().trim()).toBe('');
    expect(read('.gitignore')).toMatch(/^\.pnpm-store$/m);
  });

  it('each audited area has a test suite', () => {
    for (const f of [
      'apps/server/test/baseline.test.ts', // registry install, rollback, version retention, ranges, path safety
      'apps/server/test/admin.test.ts', // auth and rate limiting
      'apps/server/test/phase2.test.ts', // security headers, errors, PATCH
      'apps/web/test/phase4.test.ts', // import and merge, SRS and mastery
      'apps/web/e2e/audit.spec.ts', // exam runners
    ]) expect(fs.existsSync(path.join(root, f)), f).toBe(true);
  });
});
