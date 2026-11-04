/** Server configuration: the only place that reads environment variables. */
import path from 'node:path';
import { parseMode, type ChristmasMode } from './christmas/schedule';

export interface ServerConfig {
  port: number;
  host: string;
  dataDir: string;
  modulesBuiltin: string;
  webDir: string;
  maxUploadMb: number;
  prod: boolean;
  /** token is '' when admin is disabled; disabledReason says why (never contains the token) */
  admin: { token: string; disabledReason?: string };
  /** Fastify trustProxy: true, or a comma-separated list of proxy addresses/CIDRs (set when behind a reverse proxy) */
  trustProxy: boolean | string;
  /** HSTS=1: send strict-transport-security (only when every client reaches the site over HTTPS) */
  hsts: boolean;
  christmas: { mode: ChristmasMode; tz: string; now?: string };
  logLevel: string;
  defaultCourse: string;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
  const prod = env.NODE_ENV === 'production';
  return {
    port: Number(env.PORT ?? 8080),
    host: env.HOST ?? '0.0.0.0',
    dataDir: path.resolve(env.DATA_DIR ?? './data'),
    modulesBuiltin: path.resolve(env.MODULES_BUILTIN ?? './modules'),
    webDir: path.resolve(env.WEB_DIR ?? './web'),
    maxUploadMb: Number(env.MAX_UPLOAD_MB ?? 30),
    prod,
    admin: adminConfig(env.ADMIN_TOKEN, prod),
    trustProxy: parseTrustProxy(env.TRUST_PROXY),
    hsts: env.HSTS === '1' || env.HSTS?.toLowerCase() === 'true',
    // Christmas countdown: auto (calendar) | on (open everything now) | off; CHRISTMAS_NOW=YYYY-MM-DD fakes the date
    christmas: { mode: parseMode(env.CHRISTMAS_QUIZ), tz: env.CHRISTMAS_TZ || 'Asia/Manila', now: env.CHRISTMAS_NOW },
    logLevel: env.LOG_LEVEL ?? 'info',
    defaultCourse: (env.DEFAULT_COURSE ?? '').trim() || 'BDCC',
  };
}

export const WEAK_TOKEN_REASON = 'ADMIN_TOKEN is too weak (min 16 chars, not the example value)';

/** In production a missing, example or short token disables admin; outside production `dev` is the default. */
function adminConfig(raw: string | undefined, prod: boolean): ServerConfig['admin'] {
  const token = raw ?? (prod ? '' : 'dev');
  if (!token) return { token: '', disabledReason: 'ADMIN_TOKEN is not set' };
  if (prod && (token.trim().toLowerCase() === 'change-me' || token.length < 16)) return { token: '', disabledReason: WEAK_TOKEN_REASON };
  return { token };
}

function parseTrustProxy(v: string | undefined): boolean | string {
  const t = (v ?? '').trim();
  if (!t || t === '0' || t.toLowerCase() === 'false') return false;
  if (t === '1' || t.toLowerCase() === 'true') return true;
  return t;
}
