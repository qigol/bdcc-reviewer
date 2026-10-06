/**
 * Qdigo server: serves the SPA, built-in modules (read-only) and imported modules (volume),
 * and the admin API. Re-validates every import with the same validator the browser uses.
 */
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import fastifyStatic from '@fastify/static';
import multipart from '@fastify/multipart';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { readZip, writeZip, widgetsMarkdown, normalizePath, isTextPath, type FileMap } from '@kodigo/schema';
import { Registry } from './registry';

const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? '0.0.0.0';
const DATA_DIR = path.resolve(process.env.DATA_DIR ?? './data');
const MODULES_BUILTIN = path.resolve(process.env.MODULES_BUILTIN ?? './modules');
const WEB_DIR = path.resolve(process.env.WEB_DIR ?? './web');
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB ?? 30);
const PROD = process.env.NODE_ENV === 'production';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? (PROD ? '' : 'dev');

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' }, bodyLimit: MAX_UPLOAD_MB * 1024 * 1024 });
const registry = new Registry(MODULES_BUILTIN, DATA_DIR, (m) => app.log.info(m));

await app.register(multipart, { limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 1 } });

function requireAdmin(req: FastifyRequest, reply: FastifyReply): boolean {
  if (!ADMIN_TOKEN) {
    reply.code(503).send({ error: 'ADMIN_TOKEN is not set on the server; admin is disabled.' });
    return false;
  }
  const h = req.headers.authorization ?? '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  const a = Buffer.from(token);
  const b = Buffer.from(ADMIN_TOKEN);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    reply.code(401).send({ error: 'Invalid admin token' });
    return false;
  }
  return true;
}

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' blob:",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'self'",
  "object-src 'self'",
].join('; ');

app.addHook('onSend', async (req, reply, payload) => {
  const type = String(reply.getHeader('content-type') ?? '');
  if (type.includes('text/html')) reply.header('content-security-policy', CSP);
  reply.header('x-content-type-options', 'nosniff');
  return payload;
});

// ------------------------------------------------------------ API
app.get('/api/health', async () => ({ ok: true, time: new Date().toISOString() }));

app.get('/api/modules', async () => {
  const list = await registry.list();
  return list.map(({ dir: _dir, ...m }) => m);
});

app.get<{ Params: { id: string } }>('/api/modules/:id/files', async (req, reply) => {
  const files = await registry.files(req.params.id);
  if (!files) return reply.code(404).send({ error: 'not found' });
  const text: Record<string, string> = {};
  const binary: string[] = [];
  for (const [p, c] of Object.entries(files)) typeof c === 'string' ? (text[p] = c) : binary.push(p);
  return { files: text, binary };
});

app.get<{ Params: { id: string; '*': string } }>('/api/modules/:id/files/*', async (req, reply) => {
  const r = await registry.resolve(req.params.id);
  if (!r) return reply.code(404).send({ error: 'not found' });
  const rel = normalizePath(req.params['*'] ?? '');
  const full = path.resolve(r.dir, rel);
  if (!full.startsWith(path.resolve(r.dir) + path.sep)) return reply.code(400).send({ error: 'bad path' });
  if (!fs.existsSync(full)) return reply.code(404).send({ error: 'not found' });
  const ext = path.extname(full).toLowerCase();
  const types: Record<string, string> = {
    '.pdf': 'application/pdf', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
    '.yaml': 'text/yaml; charset=utf-8', '.yml': 'text/yaml; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  };
  reply.header('content-type', types[ext] ?? (isTextPath(full) ? 'text/plain; charset=utf-8' : 'application/octet-stream'));
  return reply.send(fs.createReadStream(full));
});

app.get<{ Params: { id: string } }>('/api/modules/:id/report', async (req, reply) => {
  const r = await registry.report(req.params.id, true);
  if (!r) return reply.code(404).send({ error: 'not found' });
  return r;
});

app.get<{ Params: { id: string } }>('/api/modules/:id/export', async (req, reply) => {
  const files = await registry.files(req.params.id);
  if (!files) return reply.code(404).send({ error: 'not found' });
  const list = await registry.list();
  const m = list.find((x) => x.id === req.params.id);
  const zip = await writeZip(files, req.params.id);
  reply.header('content-type', 'application/zip');
  reply.header('content-disposition', `attachment; filename="${req.params.id}@${m?.version ?? 'current'}.zip"`);
  return reply.send(Buffer.from(zip));
});

app.get('/api/widgets.md', async (_req, reply) => {
  reply.header('content-type', 'text/markdown; charset=utf-8');
  reply.header('content-disposition', 'attachment; filename="WIDGETS.md"');
  return widgetsMarkdown();
});

app.get('/api/admin/check', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  return { ok: true };
});

async function filesFromRequest(req: FastifyRequest): Promise<FileMap> {
  if (req.isMultipart()) {
    const part = await req.file();
    if (!part) throw Object.assign(new Error('no file uploaded'), { statusCode: 400 });
    const buf = await part.toBuffer();
    return readZip(buf);
  }
  const body = req.body as { files?: Record<string, string | { base64: string }> };
  if (!body?.files || typeof body.files !== 'object') throw Object.assign(new Error('expected multipart zip or JSON {files: {path: content}}'), { statusCode: 400 });
  const files: FileMap = {};
  for (const [p, c] of Object.entries(body.files)) {
    const np = normalizePath(p);
    if (np.includes('..')) continue;
    files[np] = typeof c === 'string' ? c : new Uint8Array(Buffer.from(c.base64, 'base64'));
  }
  return files;
}

app.post<{ Querystring: { allowDowngrade?: string; dryRun?: string } }>('/api/modules', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const files = await filesFromRequest(req);
  if (req.query.dryRun) {
    const { module: _m, ...report } = await registry.validate(files);
    return { ok: report.ok, report };
  }
  const r = await registry.install(files, { allowDowngrade: !!req.query.allowDowngrade });
  return reply.code(r.status).send(r);
});

app.patch<{ Params: { id: string }; Body: { enabled?: boolean; order?: number; current?: string; course?: string | null } }>('/api/modules/:id', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  await registry.patch(req.params.id, req.body ?? {});
  return { ok: true };
});

app.delete<{ Params: { id: string } }>('/api/modules/:id', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  await registry.remove(req.params.id);
  return { ok: true };
});

app.setErrorHandler((err: any, _req, reply) => {
  const code = err.statusCode ?? 500;
  if (code >= 500) app.log.error(err);
  reply.code(code).send({ error: err.message ?? String(err) });
});

// ------------------------------------------------------------ SPA
if (fs.existsSync(path.join(WEB_DIR, 'index.html'))) {
  await app.register(fastifyStatic, { root: WEB_DIR, prefix: '/', wildcard: false, index: ['index.html'] });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'not found' });
    return reply.type('text/html').sendFile('index.html');
  });
} else {
  app.log.warn(`No web build at ${WEB_DIR} (API only). Run the Vite dev server for the UI.`);
}

await registry.init();
await app.listen({ port: PORT, host: HOST });
app.log.info(`Qdigo on :${PORT} · built-in modules ${MODULES_BUILTIN} · data ${DATA_DIR}${ADMIN_TOKEN ? '' : ' · ADMIN DISABLED (set ADMIN_TOKEN)'}`);
registry.warm().catch((e) => app.log.error(e));
