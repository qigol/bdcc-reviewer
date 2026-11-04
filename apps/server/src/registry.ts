/**
 * Module registry: built-in modules (read-only, MODULES_BUILTIN) + imported modules
 * (DATA_DIR/modules/<id>@<version>/), with enabled/order/current in DATA_DIR/state.json.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { buildModuleIndex, parseModule, validateModule, type FileMap, type ModuleIndex, type ValidationReport, type ParsedModule, type LogicHostFactory } from '@kodigo/schema';
import { listModuleDir, readModuleDir, walkModuleDir } from '@kodigo/schema/node';
import { createIsolatedHost, killAllLogicChildren } from './logic/isolatedHost';

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

const FP_TTL_MS = 500;

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
  /** per module id, keyed by fingerprint: list() and report() read no file contents while it matches */
  private snapshots = new Map<string, { fp: string; manifest?: any; report?: ValidationReport; index?: ModuleIndex | { id: string; error: string } }>();
  private fpMemo = new Map<string, { at: number; fp: string }>();
  private pending = new Map<string, Promise<ValidationReport>>();

  private hostFactory: LogicHostFactory;

  constructor(private builtinDir: string, private dataDir: string, private log: (msg: string) => void = () => {}, opts: { hostFactory?: LogicHostFactory } = {}) {
    // logic.js runs in an isolated child process by default (tests may inject the in-process host)
    this.hostFactory = opts.hostFactory ?? ((src) => createIsolatedHost(src));
  }

  /** Stop live logic child processes. */
  close() { killAllLogicChildren(); }

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
    return this.resolveFrom(id, await this.builtinIds(), await this.importedVersions());
  }

  private resolveFrom(id: string, builtin: Record<string, string>, imported: Record<string, string[]>): { dir: string; origin: 'builtin' | 'imported'; version?: string } | null {
    const vs = imported[id];
    if (vs?.length) {
      const cur = this.state.modules[id]?.current;
      const version = cur && vs.includes(cur) ? cur : vs[vs.length - 1];
      return { dir: path.join(this.importedDir, `${id}@${version}`), origin: 'imported', version };
    }
    const b = builtin[id];
    return b ? { dir: b, origin: 'builtin' } : null;
  }

  async files(id: string): Promise<FileMap | null> {
    const r = await this.resolve(id);
    return r ? readModuleDir(r.dir) : null;
  }

  /** The module's lightweight index, from its text files only; cached by fingerprint. */
  async index(id: string): Promise<{ fp: string; index: ModuleIndex | { id: string; error: string } } | null> {
    const r = await this.resolve(id);
    if (!r) return null;
    const fp = await this.fingerprint(r.dir);
    const snap = this.snapshots.get(id);
    if (snap?.fp === fp && snap.index) return { fp, index: snap.index };
    const { files, binary } = await listModuleDir(r.dir);
    const all: FileMap = { ...files };
    for (const p of binary) all[p] = new Uint8Array(0); // the parser only needs to see that they exist
    const { module, issues } = parseModule(all);
    const index = module ? buildModuleIndex(module) : { id, error: issues.find((i) => i.level === 'error')?.message ?? 'failed to parse' };
    this.remember(id, fp, { index });
    return { fp, index };
  }

  /** Every module's index, with an ETag over all fingerprints. */
  async indexes(): Promise<{ etag: string; modules: (ModuleIndex | { id: string; error: string })[] }> {
    const ids = [...new Set([...Object.keys(await this.builtinIds()), ...Object.keys(await this.importedVersions())])].sort();
    const h = crypto.createHash('sha1');
    const modules: (ModuleIndex | { id: string; error: string })[] = [];
    for (const id of ids) {
      const got = await this.index(id);
      if (!got) continue;
      h.update(id).update(got.fp);
      modules.push(got.index);
    }
    return { etag: `W/"${h.digest('hex')}"`, modules };
  }

  /** Text files plus a list of binary paths; binaries are not read. */
  async listing(id: string): Promise<{ files: Record<string, string>; binary: string[]; fp: string } | null> {
    const r = await this.resolve(id);
    if (!r) return null;
    return { ...(await listModuleDir(r.dir)), fp: await this.fingerprint(r.dir) };
  }

  /** Content identity of a module folder from a stat-only walk: path, size and mtime of every file. Memoized for 500 ms. */
  async fingerprint(dir: string): Promise<string> {
    const memo = this.fpMemo.get(dir);
    if (memo && Date.now() - memo.at < FP_TTL_MS) return memo.fp;
    const rows: string[] = [];
    for (const rel of await walkModuleDir(dir)) {
      const st = await fs.stat(path.join(dir, rel));
      rows.push(`${rel}\0${st.size}\0${st.mtimeMs}`);
    }
    const fp = crypto.createHash('sha1').update(dir).update(rows.sort().join('\n')).digest('hex');
    this.fpMemo.set(dir, { at: Date.now(), fp });
    return fp;
  }

  async validate(files: FileMap): Promise<ValidationReport & { module?: ParsedModule }> {
    return validateModule(files, { hostFactory: this.hostFactory });
  }

  /** Cached full report for the module currently serving `id`. */
  async report(id: string, wait = true): Promise<ValidationReport | null> {
    const r = await this.resolve(id);
    if (!r) return null;
    const fp = await this.fingerprint(r.dir);
    const snap = this.snapshots.get(id);
    if (snap?.fp === fp && snap.report) return snap.report;
    const key = `${id}:${fp}`;
    let p = this.pending.get(key);
    if (!p) {
      // validation is the only path that reads binaries, once per fingerprint change
      p = readModuleDir(r.dir).then((files) => this.validate(files)).then((v) => {
        const { module: _m, ...report } = v as any;
        this.remember(id, fp, { report });
        this.pending.delete(key);
        this.log(`validated ${id}: ${report.ok ? 'ok' : 'errors'} (${report.issues.length} issues)`);
        return report as ValidationReport;
      }).catch((e) => {
        this.pending.delete(key);
        const report: ValidationReport = { ok: false, issues: [{ level: 'error', step: 'logic', message: String(e?.message ?? e) }], steps: [] };
        this.remember(id, fp, { report });
        return report;
      });
      this.pending.set(key, p);
    }
    return wait ? p : null;
  }

  /** Merge into the id's snapshot; a new fingerprint starts it over. */
  private remember(id: string, fp: string, part: { manifest?: any; report?: ValidationReport; index?: ModuleIndex | { id: string; error: string } }) {
    const cur = this.snapshots.get(id);
    this.snapshots.set(id, { ...(cur?.fp === fp ? cur : {}), fp, ...part });
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
      const r = this.resolveFrom(id, builtin, imported);
      if (!r) continue;
      const fp = await this.fingerprint(r.dir);
      const snap = this.snapshots.get(id);
      let manifest: any = snap?.fp === fp ? snap.manifest : undefined;
      if (manifest === undefined) {
        manifest = {};
        try {
          const YAML = await import('yaml');
          manifest = YAML.parse(await fs.readFile(path.join(r.dir, 'manifest.yaml'), 'utf8')) ?? {};
        } catch {}
        this.remember(id, fp, { manifest });
      }
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
    // work on a copy, so a rejected patch leaves memory and state.json untouched
    const st: ModuleState = { ...(this.state.modules[id] ?? { enabled: true }) };
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
    this.state.modules[id] = st;
    await this.saveState();
  }

  /**
   * Install a module version. With `keepAssets` (a re-import from pasted bundle text, which carries text files only),
   * the installed version's assets/ and sources/ files that the import doesn't include are kept (guide §9a.2).
   */
  async install(files: FileMap, opts: { allowDowngrade?: boolean; keepAssets?: boolean } = {}) {
    if (opts.keepAssets) files = await this.withInstalledAssets(files);
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
    this.fpMemo.clear();
    this.remember(id, await this.fingerprint(dir), { report: rest });
    return { ok: true as const, status: 200, report: rest, id, version, upgradedFrom: current?.version };
  }

  /** Add the currently installed version's assets/ and sources/ files that `files` lacks. */
  async withInstalledAssets(files: FileMap): Promise<FileMap> {
    const id = await idFromManifest(files);
    const installed = id ? await this.files(id) : null;
    if (!installed) return files;
    const out: FileMap = { ...files };
    for (const [p, c] of Object.entries(installed)) if (/^(assets|sources)\//.test(p) && !(p in out)) out[p] = c;
    return out;
  }

  async remove(id: string) {
    const vs = (await this.importedVersions())[id] ?? [];
    if (!vs.length) throw Object.assign(new Error('Only imported modules can be deleted (built-ins can be disabled).'), { statusCode: 400 });
    for (const v of vs) await fs.rm(path.join(this.importedDir, `${id}@${v}`), { recursive: true, force: true });
    const hasBuiltin = !!(await this.builtinIds())[id];
    if (!hasBuiltin) delete this.state.modules[id];
    else if (this.state.modules[id]) delete this.state.modules[id].current;
    this.snapshots.delete(id);
    this.fpMemo.clear();
    await this.saveState();
  }
}

/** The module id declared in a file map's manifest (without validating it). */
async function idFromManifest(files: FileMap): Promise<string | null> {
  const text = files['manifest.yaml'] ?? files['manifest.yml'] ?? files['manifest.json'];
  if (typeof text !== 'string') return null;
  try {
    const YAML = await import('yaml');
    const m = YAML.parse(text);
    return typeof m?.id === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(m.id) ? m.id : null;
  } catch { return null; }
}
