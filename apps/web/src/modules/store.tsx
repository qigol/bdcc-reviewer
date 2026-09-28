import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { parseModule, checkIntegrity, allDatasetPayloads, type ParsedModule, type Issue, type FileMap } from '@kodigo/schema';
import { api, type ModuleListEntry } from '../lib/api';
import { LogicClient } from './logic';

export interface LoadedModule {
  id: string;
  version: string;
  parsed: ParsedModule;
  logic: LogicClient;
  datasets: Record<string, any>;
  labels: Record<string, string>;
  issues: Issue[];
  files: FileMap;
  binary: string[];
  preview?: boolean;
  /** base URL for assets/sources */
  fileUrl: (path: string) => string;
}

interface Store {
  list: ModuleListEntry[];
  listError: string | null;
  listLoaded: boolean;
  refresh: () => Promise<void>;
  load: (id: string) => Promise<LoadedModule>;
  get: (id: string) => LoadedModule | undefined;
  setPreview: (files: FileMap) => LoadedModule;
  clearPreview: () => void;
  preview: LoadedModule | null;
}

const Ctx = createContext<Store | null>(null);
const cache = new Map<string, Promise<LoadedModule>>();
const loadedMap = new Map<string, LoadedModule>();

export function buildLoaded(files: FileMap, opts: { preview?: boolean; binary?: string[]; fileUrl?: (p: string) => string } = {}): LoadedModule {
  const { module, issues } = parseModule(files);
  if (!module) {
    const msg = issues.filter((i) => i.level === 'error').slice(0, 5).map((i) => `${i.file ?? ''} ${i.path ?? ''} ${i.message}`).join('\n');
    throw new Error(`Module failed to parse:\n${msg}`);
  }
  const integ = checkIntegrity(module);
  const id = module.manifest.id;
  const blobUrls: Record<string, string> = {};
  const fileUrl = opts.fileUrl ?? ((p: string) => {
    const c = files[p];
    if (c === undefined) return '';
    if (!blobUrls[p]) blobUrls[p] = URL.createObjectURL(new Blob([c as BlobPart], { type: p.endsWith('.svg') ? 'image/svg+xml' : p.endsWith('.pdf') ? 'application/pdf' : undefined }));
    return blobUrls[p];
  });
  return {
    id,
    version: module.manifest.version,
    parsed: module,
    logic: new LogicClient(module.logic),
    datasets: allDatasetPayloads(module),
    labels: module.labels,
    issues: [...issues, ...integ.issues],
    files,
    binary: opts.binary ?? [],
    preview: opts.preview,
    fileUrl,
  };
}

export function ModuleStoreProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<ModuleListEntry[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [listLoaded, setListLoaded] = useState(false);
  const [preview, setPreviewState] = useState<LoadedModule | null>(null);
  const [, force] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const l = await api.list();
      setList(l);
      setListError(null);
      // drop cached modules whose version changed
      for (const m of l) {
        const got = loadedMap.get(m.id);
        if (got && got.version !== m.version) {
          got.logic.dispose();
          loadedMap.delete(m.id);
          cache.delete(m.id);
        }
      }
    } catch (e: any) {
      setListError(String(e?.message ?? e));
    } finally {
      setListLoaded(true);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const load = useCallback((id: string) => {
    if (preview && preview.id === id && location.pathname.startsWith('/preview')) return Promise.resolve(preview);
    let p = cache.get(id);
    if (!p) {
      p = api.files(id).then(({ files, binary }) => {
        const m = buildLoaded(files, { binary, fileUrl: (path) => api.fileUrl(id, path) });
        loadedMap.set(id, m);
        force((x) => x + 1);
        return m;
      });
      cache.set(id, p);
      p.catch(() => cache.delete(id));
    }
    return p;
  }, [preview]);

  const setPreview = useCallback((files: FileMap) => {
    preview?.logic.dispose();
    const m = buildLoaded(files, { preview: true });
    setPreviewState(m);
    return m;
  }, [preview]);

  const clearPreview = useCallback(() => {
    preview?.logic.dispose();
    setPreviewState(null);
  }, [preview]);

  const value = useMemo<Store>(
    () => ({ list, listError, listLoaded, refresh, load, get: (id) => loadedMap.get(id), setPreview, clearPreview, preview }),
    [list, listError, listLoaded, refresh, load, setPreview, clearPreview, preview],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useModuleStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('ModuleStoreProvider missing');
  return s;
}

/** Load a module by id (or the admin preview when `preview` is true). */
export function useModule(id: string | undefined, preview = false): { mod?: LoadedModule; error?: string; loading: boolean } {
  const store = useModuleStore();
  const [state, setState] = useState<{ mod?: LoadedModule; error?: string; loading: boolean }>({ loading: true });
  useEffect(() => {
    if (!id) return;
    if (preview) {
      setState(store.preview && store.preview.id === id ? { mod: store.preview, loading: false } : { error: 'No preview loaded (open it from Admin → Import).', loading: false });
      return;
    }
    let alive = true;
    const got = store.get(id);
    if (got) setState({ mod: got, loading: false });
    else setState({ loading: true });
    store.load(id).then(
      (mod) => alive && setState({ mod, loading: false }),
      (e) => alive && setState({ error: String(e?.message ?? e), loading: false }),
    );
    return () => { alive = false; };
  }, [id, preview, store.preview, store.list]);
  return state;
}

export function enabledModules(list: ModuleListEntry[]) {
  return list.filter((m) => m.enabled);
}
