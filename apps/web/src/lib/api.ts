import type { ValidationReport } from '@kodigo/schema';

export interface ModuleListEntry {
  id: string; version: string; title: string; shortTitle: string; summary: string; order: number;
  /** course code (manifest `course`, or the admin override, or the server's default course) */
  course: string;
  courseSource: 'admin' | 'manifest' | 'default';
  color?: string; icon?: string; enabled: boolean; origin: 'builtin' | 'imported'; versions: string[]; hasBuiltin: boolean;
  prerequisites: string[];
  health: { status: 'pending' | 'valid' | 'warnings' | 'errors'; errors: number; warnings: number };
}

async function j<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error((body as any)?.error ?? (body as any)?.message ?? res.statusText), { status: res.status, body });
  return body as T;
}

export const api = {
  list: () => fetch('/api/modules').then((r) => j<ModuleListEntry[]>(r)),
  files: (id: string) => fetch(`/api/modules/${id}/files`).then((r) => j<{ files: Record<string, string>; binary: string[] }>(r)),
  report: (id: string) => fetch(`/api/modules/${id}/report`).then((r) => j<ValidationReport>(r)),
  fileUrl: (id: string, path: string) => `/api/modules/${id}/files/${path}`,
  exportUrl: (id: string) => `/api/modules/${id}/export`,
  checkAdmin: (token: string) => fetch('/api/admin/check', { headers: { authorization: `Bearer ${token}` } }).then((r) => j<{ ok: true }>(r)),
  install: (token: string, body: FormData | { files: Record<string, string | { base64: string }> }, opts: { allowDowngrade?: boolean; dryRun?: boolean } = {}) => {
    const q = new URLSearchParams();
    if (opts.allowDowngrade) q.set('allowDowngrade', '1');
    if (opts.dryRun) q.set('dryRun', '1');
    const isForm = body instanceof FormData;
    return fetch(`/api/modules${q.toString() ? `?${q}` : ''}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, ...(isForm ? {} : { 'content-type': 'application/json' }) },
      body: isForm ? body : JSON.stringify(body),
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  },
  patch: (token: string, id: string, p: { enabled?: boolean; order?: number; current?: string; course?: string | null }) =>
    fetch(`/api/modules/${id}`, { method: 'PATCH', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(p) }).then((r) => j(r)),
  remove: (token: string, id: string) => fetch(`/api/modules/${id}`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } }).then((r) => j(r)),
};
