/**
 * Module registry: built-in modules (read-only, MODULES_BUILTIN) + imported modules
 * (DATA_DIR/modules/<id>@<version>/), with enabled/order/current in DATA_DIR/state.json.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { validateModule, type FileMap, type ValidationReport, type ParsedModule } from '@kodigo/schema';
import { createNodeHost, readModuleDir } from '@kodigo/schema/node';

export interface ModuleState { enabled: boolean; order?: number; current?: string; /** admin override of manifest.course */ course?: string }
export interface State { modules: Record<string, ModuleState> }

export interface Health { status: 'pending' | 'valid' | 'warnings' | 'errors'; errors: number; warnings: number; checkedAt?: string }

export interface ModuleEntry {
  id: string;
  version: string;
  title: string;
  shortTitle: string;
  summary: string;
  order: number;
  /** course code the module is filed under: admin override → manifest.course → the default course */
  course: string;
  /** where `course` came from */
  courseSource: 'admin' | 'manifest' | 'default';
  color?: string;
  icon?: string;
  enabled: boolean;
  origin: 'builtin' | 'imported';
  dir: string;
  versions: string[];
  hasBuiltin: boolean;
  prerequisites: string[];
  health: Health;
}

const cmpSemver = (a: string, b: string) => {
  const pa = a.split(/[.-]/).map((x) => (/^\d+$/.test(x) ? Number(x) : x));
  const pb = b.split(/[.-]/).map((x) => (/^\d+$/.test(x) ? Number(x) : x));
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return (pa[i] as number) - (pb[i] as number);
  return 0;
};
export { cmpSemver };

/** Course for modules whose manifest has no `course` (and no admin override). */
export const DEFAULT_COURSE = (process.env.DEFAULT_COURSE ?? '').trim() || 'BDCC';
/** Normalize a course code: trimmed, inner whitespace collapsed; '' means "none". */
export const normCourse = (c: unknown) => (typeof c === 'string' ? c.trim().replace(/\s+/g, ' ').slice(0, 40) : '');

export class Registry {
  private state: State = { modules: {} };
  private healthCache = new Map<string, { hash: string; report: ValidationReport }>();
  private pending = new Map<string, Promise<ValidationReport>>();

  constructor(private builtinDir: string, private dataDir: string, private log: (msg: string) => void = () => {}) {}

  get importedDir() { return path.join(this.dataDir, 'modules'); }
  get statePath() { return path.join(this.dataDir, 'state.json'); }

  async init() {
    await fs.mkdir(this.importedDir, { recursive: true });
    try { this.state = JSON.parse(await fs.readFile(this.statePath, 'utf8')); } catch { this.state = { modules: {} }; }
    this.state.modules ??= {};
  }

  private async saveState() {
    const tmp = this.statePath + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(this.state, null, 2));
    await fs.rename(tmp, this.statePath);
  }

  private async builtinIds(): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    try {
      for (const e of await fs.readdir(this.builtinDir, { withFileTypes: true })) {
        if (!e.isDirectory()) continue;
        const dir = path.join(this.builtinDir, e.name);
        try { await fs.access(path.join(dir, 'manifest.yaml')); out[e.name] = dir; } catch {}
      }
    } catch {}
    return out;
  }

  private async importedVersions(): Promise<Record<string, string[]>> {
    const out: Record<string, string[]> = {};
    try {
      for (const e of await fs.readdir(this.importedDir, { withFileTypes: true })) {
        const m = /^([a-z0-9-]+)@(.+)$/.exec(e.name);
        if (!e.isDirectory() || !m) continue;
        (out[m[1]] ??= []).push(m[2]);
      }
    } catch {}
    for (const k of Object.keys(out)) out[k].sort(cmpSemver);
    return out;
  }

  /** Resolve the directory currently serving a module id. */
  async resolve(id: string): Promise<{ dir: string; origin: 'builtin' | 'imported'; version?: string } | null> {
    const imported = await this.importedVersions();
    const vs = imported[id];
    if (vs?.length) {
      const cur = this.state.modules[id]?.current;
      const version = cur && vs.includes(cur) ? cur : vs[vs.length - 1];
      return { dir: path.join(this.importedDir, `${id}@${version}`), origin: 'imported', version };
    }
    const b = (await this.builtinIds())[id];
    return b ? { dir: b, origin: 'builtin' } : null;
  }

  async files(id: string): Promise<FileMap | null> {
    const r = await this.resolve(id);
    return r ? readModuleDir(r.dir) : null;
  }

  private hash(files: FileMap): string {
    const h = crypto.createHash('sha1');
    for (const k of Object.keys(files).sort()) { h.update(k); h.update(typeof files[k] === 'string' ? (files[k] as string) : Buffer.from(files[k] as Uint8Array)); }
    return h.digest('hex');
  }

  async validate(files: FileMap): Promise<ValidationReport & { module?: ParsedModule }> {
    return validateModule(files, { hostFactory: (src) => createNodeHost(src) });
  }

  /** Cached full report for the module currently serving `id`. */
  async report(id: string, wait = true): Promise<ValidationReport | null> {
    const files = await this.files(id);
    if (!files) return null;
    const hash = this.hash(files);
    const cached = this.healthCache.get(id);
    if (cached && cached.hash === hash) return cached.report;
    const key = `${id}:${hash}`;
    let p = this.pending.get(key);
    if (!p) {
      p = this.validate(files).then((r) => {
        const { module: _m, ...report } = r as any;
        this.healthCache.set(id, { hash, report });
        this.pending.delete(key);
        this.log(`validated ${id}: ${report.ok ? 'ok' : 'errors'} (${report.issues.length} issues)`);
        return report as ValidationReport;
      }).catch((e) => {
        this.pending.delete(key);
        const report: ValidationReport = { ok: false, issues: [{ level: 'error', step: 'logic', message: String(e?.message ?? e) }], steps: [] };
        this.healthCache.set(id, { hash, report });
        return report;
      });
      this.pending.set(key, p);
    }
    return wait ? p : null;
  }

  private healthOf(r: ValidationReport | null): Health {
    if (!r) return { status: 'pending', errors: 0, warnings: 0 };
    const errors = r.issues.filter((i) => i.level === 'error').length;
    const warnings = r.issues.length - errors;
    return { status: errors ? 'errors' : warnings ? 'warnings' : 'valid', errors, warnings };
  }

  async list(): Promise<ModuleEntry[]> {
    const builtin = await this.builtinIds();
    const imported = await this.importedVersions();
    const ids = [...new Set([...Object.keys(builtin), ...Object.keys(imported)])];
    const out: ModuleEntry[] = [];
    for (const id of ids) {
      const r = await this.resolve(id);
      if (!r) continue;
      let manifest: any = {};
      try {
        const YAML = await import('yaml');
        manifest = YAML.parse(await fs.readFile(path.join(r.dir, 'manifest.yaml'), 'utf8')) ?? {};
      } catch {}
      const st = this.state.modules[id];
      const report = await this.report(id, false);
      out.push({
        id,
        version: String(manifest.version ?? r.version ?? '0.0.0'),
        title: String(manifest.title ?? id),
        shortTitle: String(manifest.shortTitle ?? id),
        summary: String(manifest.summary ?? ''),
        order: st?.order ?? Number(manifest.order ?? 1000),
        course: normCourse(st?.course) || normCourse(manifest.course) || DEFAULT_COURSE,
        courseSource: normCourse(st?.course) ? 'admin' : normCourse(manifest.course) ? 'manifest' : 'default',
        color: manifest.color,
        icon: manifest.icon,
        enabled: st?.enabled ?? true,
        origin: r.origin,
        dir: r.dir,
        versions: imported[id] ?? [],
        hasBuiltin: !!builtin[id],
        prerequisites: manifest.prerequisites ?? [],
        health: this.healthOf(report),
      });
    }
    out.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    return out;
  }

  /** Warm the health cache in the background. */
  async warm() {
    for (const m of await this.list()) await this.report(m.id, true);
  }

  async patch(id: string, p: { enabled?: boolean; order?: number; current?: string; course?: string | null }) {
    const r = await this.resolve(id);
    if (!r) throw Object.assign(new Error(`no module ${id}`), { statusCode: 404 });
    const st = (this.state.modules[id] ??= { enabled: true });
    if (p.enabled !== undefined) st.enabled = !!p.enabled;
    if (p.order !== undefined) st.order = Number(p.order);
    if (p.course !== undefined) {
      // '' or null clears the override (back to manifest.course / the default course)
      const c = normCourse(p.course);
      if (c) st.course = c;
      else delete st.course;
    }
    if (p.current !== undefined) {
      const vs = (await this.importedVersions())[id] ?? [];
      if (!vs.includes(p.current)) throw Object.assign(new Error(`version ${p.current} is not stored`), { statusCode: 400 });
      st.current = p.current;
    }
    await this.saveState();
  }

  async install(files: FileMap, opts: { allowDowngrade?: boolean } = {}) {
    const report = await this.validate(files);
    const { module, ...rest } = report;
    if (!report.ok || !module) return { ok: false as const, status: 422, report: rest };
    const id = module.manifest.id;
    const version = module.manifest.version;
    const current = await this.list().then((l) => l.find((m) => m.id === id));
    if (current && cmpSemver(version, current.version) < 0 && !opts.allowDowngrade)
      return { ok: false as const, status: 409, report: rest, message: `Installed version is ${current.version}; importing ${version} is a downgrade. Confirm to proceed.` };
    const dir = path.join(this.importedDir, `${id}@${version}`);
    const tmp = dir + `.tmp-${Date.now()}`;
    await fs.rm(tmp, { recursive: true, force: true });
    for (const [p, content] of Object.entries(files)) {
      const safe = path.normalize(p).replace(/^(\.\.(\/|\\|$))+/, '');
      if (safe.startsWith('..') || path.isAbsolute(safe)) continue;
      const full = path.join(tmp, safe);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, content as any);
    }
    await fs.rm(dir, { recursive: true, force: true });
    await fs.rename(tmp, dir);
    const st = (this.state.modules[id] ??= { enabled: true });
    st.current = version;
    await this.saveState();
    // keep the newest 3 imported versions (plus the current one)
    const vs = (await this.importedVersions())[id] ?? [];
    const keep = new Set([...vs.slice(-3), version]);
    for (const v of vs) if (!keep.has(v)) await fs.rm(path.join(this.importedDir, `${id}@${v}`), { recursive: true, force: true });
    this.healthCache.set(id, { hash: this.hash(files), report: rest });
    return { ok: true as const, status: 200, report: rest, id, version, upgradedFrom: current?.version };
  }

  async remove(id: string) {
    const vs = (await this.importedVersions())[id] ?? [];
    if (!vs.length) throw Object.assign(new Error('Only imported modules can be deleted (built-ins can be disabled).'), { statusCode: 400 });
    for (const v of vs) await fs.rm(path.join(this.importedDir, `${id}@${v}`), { recursive: true, force: true });
    const hasBuiltin = !!(await this.builtinIds())[id];
    if (!hasBuiltin) delete this.state.modules[id];
    else if (this.state.modules[id]) delete this.state.modules[id].current;
    this.healthCache.delete(id);
    await this.saveState();
  }
}
