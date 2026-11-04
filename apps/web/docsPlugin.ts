/**
 * Serves the authoring guide and widget reference at /docs/*.md from the repo's docs/ folder (the admin panel
 * links to them), so there is no copy to keep in sync: emitted into the build, read directly in dev.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const FILES = ['MODULE_AUTHORING_GUIDE.md', 'WIDGETS.md'];
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function docsAssets(root = repoRoot) {
  return FILES.map((f) => ({ fileName: `docs/${f}`, source: fs.readFileSync(path.join(root, 'docs', f), 'utf8') }));
}

export function docsPlugin(): Plugin {
  return {
    name: 'qdigo-docs',
    generateBundle() {
      for (const a of docsAssets()) this.emitFile({ type: 'asset', fileName: a.fileName, source: a.source });
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const asset = docsAssets().find((a) => `/${a.fileName}` === req.url?.split('?')[0]);
        if (!asset) return next();
        res.setHeader('content-type', 'text/markdown; charset=utf-8');
        res.end(asset.source);
      });
    },
  };
}
