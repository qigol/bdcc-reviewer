/**
 * Bundle text format (guide §3.2) and zip helpers. Isomorphic.
 *   <<<BUNDLE fim@1.0.0>>>
 *   <<<FILE manifest.yaml>>>
 *   …
 *   <<<END FILE>>>
 *   <<<END BUNDLE>>>
 */
import JSZip from 'jszip';

export type FileMap = Record<string, string | Uint8Array>;

export interface ParsedBundle {
  id?: string;
  version?: string;
  files: Record<string, string>;
  errors: string[];
  /** true if the text ends with <<<CONTINUE>>> (more pastes expected) */
  continued: boolean;
  /** file that was started but not finished */
  incomplete?: string;
}

const FILE_RE = /^<<<FILE\s+(.+?)>>>\s*$/;
const END_FILE_RE = /^<<<END FILE>>>\s*$/;
const BUNDLE_RE = /^<<<BUNDLE\s+([a-z0-9-]+)(?:@([^>\s]+))?\s*>>>\s*$/;

export function parseBundle(text: string): ParsedBundle {
  const res: ParsedBundle = { files: {}, errors: [], continued: false };
  const lines = (text ?? '').replace(/\r\n/g, '\n').split('\n');
  let cur: string | null = null;
  let buf: string[] = [];
  for (const line of lines) {
    if (cur !== null) {
      if (END_FILE_RE.test(line)) {
        res.files[normalizePath(cur)] = buf.join('\n') + '\n';
        cur = null;
        buf = [];
      } else if (FILE_RE.test(line)) {
        res.errors.push(`File "${cur}" has no <<<END FILE>>> before the next <<<FILE>>>.`);
        cur = FILE_RE.exec(line)![1].trim();
        buf = [];
      } else buf.push(line);
      continue;
    }
    const b = BUNDLE_RE.exec(line);
    if (b) { res.id = b[1]; res.version = b[2]; continue; }
    const f = FILE_RE.exec(line);
    if (f) { cur = f[1].trim(); buf = []; continue; }
    if (/^<<<CONTINUE>>>\s*$/.test(line)) { res.continued = true; continue; }
    if (/^<<<END BUNDLE>>>\s*$/.test(line)) { res.continued = false; continue; }
    // anything else between files (commentary, code fences) is ignored
  }
  if (cur !== null) {
    res.incomplete = cur;
    res.errors.push(`File "${cur}" is incomplete (no <<<END FILE>>>). Ask the LLM to continue, then paste the rest.`);
  }
  if (!Object.keys(res.files).length) res.errors.push('No <<<FILE …>>> blocks found. Paste the whole bundle output.');
  return res;
}

export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

const ORDER = ['manifest.yaml', 'SOURCE_NOTES.md', 'datasets/', 'logic.js', 'examples.yaml', 'glossary.yaml', 'math-code.yaml', 'intuition.yaml', 'application.yaml', 'quiz.yaml'];
export function sortModuleFiles(paths: string[]): string[] {
  const rank = (p: string) => {
    const i = ORDER.findIndex((o) => (o.endsWith('/') ? p.startsWith(o) : p === o));
    return i === -1 ? ORDER.length : i;
  };
  return [...paths].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

export function formatBundle(id: string, version: string, files: FileMap): string {
  const out = [`<<<BUNDLE ${id}@${version}>>>`];
  for (const p of sortModuleFiles(Object.keys(files))) {
    const c = files[p];
    if (typeof c !== 'string') continue; // binary assets are not part of text bundles
    if (p.startsWith('sources/')) continue;
    out.push(`<<<FILE ${p}>>>`);
    out.push(c.replace(/\n+$/, ''));
    out.push('<<<END FILE>>>');
  }
  out.push('<<<END BUNDLE>>>');
  return out.join('\n') + '\n';
}

const TEXT_EXT = /\.(ya?ml|json|md|js|mjs|txt|csv|svg|py)$/i;
export const isTextPath = (p: string) => TEXT_EXT.test(p);

/** Read a zip into a FileMap. Strips a single common top-level folder and OS junk. */
export async function readZip(data: ArrayBuffer | Uint8Array): Promise<FileMap> {
  const zip = await JSZip.loadAsync(data);
  const entries = Object.values(zip.files).filter(
    (f) => !f.dir && !f.name.startsWith('__MACOSX/') && !/(^|\/)\.DS_Store$/.test(f.name) && !/(^|\/)Thumbs\.db$/.test(f.name),
  );
  const names = entries.map((e) => normalizePath(e.name));
  let prefix = '';
  if (names.length && !names.includes('manifest.yaml')) {
    const m = names.find((n) => /(^|\/)manifest\.(ya?ml|json)$/.test(n));
    if (m && m.includes('/')) prefix = m.slice(0, m.lastIndexOf('/') + 1);
  }
  const files: FileMap = {};
  for (const e of entries) {
    let p = normalizePath(e.name);
    if (prefix) {
      if (!p.startsWith(prefix)) continue;
      p = p.slice(prefix.length);
    }
    files[p] = isTextPath(p) ? await e.async('string') : await e.async('uint8array');
  }
  return files;
}

export async function writeZip(files: FileMap, folder?: string): Promise<Uint8Array> {
  const zip = new JSZip();
  const root = folder ? zip.folder(folder)! : zip;
  for (const p of sortModuleFiles(Object.keys(files))) root.file(p, files[p]);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
