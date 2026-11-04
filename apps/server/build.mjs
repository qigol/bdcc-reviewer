// Bundle the server (and the workspace packages it uses) into ESM files: dist/index.js and the
// isolated logic host's child entry dist/logic-child.mjs (.mjs so Node needs no package.json to load it).
import fs from 'node:fs';
import { build } from 'esbuild';
await build({
  entryPoints: { index: 'src/index.ts', 'logic-child': 'src/logic/child.ts' },
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  sourcemap: true,
  // esbuild is only used in dev/test to bundle the child on the fly (isolatedHost.ts)
  external: ['esbuild'],
  // CJS deps inside an ESM bundle need require()
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: 'info',
});
fs.renameSync('dist/logic-child.js', 'dist/logic-child.mjs');
