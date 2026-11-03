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
  admin: { token: string };
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
    admin: { token: env.ADMIN_TOKEN ?? (prod ? '' : 'dev') },
    // Christmas countdown: auto (calendar) | on (open everything now) | off; CHRISTMAS_NOW=YYYY-MM-DD fakes the date
    christmas: { mode: parseMode(env.CHRISTMAS_QUIZ), tz: env.CHRISTMAS_TZ || 'Asia/Manila', now: env.CHRISTMAS_NOW },
    logLevel: env.LOG_LEVEL ?? 'info',
    defaultCourse: (env.DEFAULT_COURSE ?? '').trim() || 'BDCC',
  };
}
