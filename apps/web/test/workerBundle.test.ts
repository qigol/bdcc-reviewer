/** The built logic worker must be self-contained: its CSP (script-src 'unsafe-eval' only) lets no script URL load. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const assets = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist/assets');
const workers = fs.existsSync(assets) ? fs.readdirSync(assets).filter((f) => /^logic\.worker-[\w-]+\.js$/.test(f)) : [];

describe.skipIf(!workers.length)('built logic worker (run after pnpm build)', () => {
  it('has exactly one file with no import statement and no dynamic import()', () => {
    expect(workers).toHaveLength(1);
    const code = fs.readFileSync(path.join(assets, workers[0]), 'utf8');
    // a static import (`import 'x'` or `import … from 'x'`) at a statement boundary, not the word inside a string
    expect(code).not.toMatch(/(^|[;}])\s*import\s*(["'`]|[\w*{][^;]*?\bfrom\s*["'`])/m);
    expect(code).not.toMatch(/\bimport\s*\(/);
  });
});
