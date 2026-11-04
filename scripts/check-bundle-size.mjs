// Fails when the web app's main entry chunk grows past the limit (minified, before compression).
import fs from 'node:fs';
import path from 'node:path';

const LIMIT_KB = 450;
const dir = path.resolve('apps/web/dist/assets');
const main = fs.readdirSync(dir).filter((f) => /^index-[\w-]+\.js$/.test(f));
if (!main.length) {
  console.error(`no index-*.js in ${dir}; run pnpm build first`);
  process.exit(1);
}
let bad = false;
for (const f of main) {
  const kb = fs.statSync(path.join(dir, f)).size / 1024;
  console.log(`${f}: ${kb.toFixed(0)} KB (limit ${LIMIT_KB} KB)`);
  if (kb > LIMIT_KB) bad = true;
}
process.exit(bad ? 1 : 0);
