/** Qdigo server entry: config → app → listen → warm the health cache. */
import { loadConfig } from './config';
import { buildApp } from './app';

const cfg = loadConfig();
const { app, registry } = await buildApp(cfg);
await app.listen({ port: cfg.port, host: cfg.host });
app.log.info(`Qdigo on :${cfg.port} · built-in modules ${cfg.modulesBuiltin} · data ${cfg.dataDir}${cfg.admin.token ? '' : ' · ADMIN DISABLED (set ADMIN_TOKEN)'}`);
registry.warm().catch((e) => app.log.error(e));
