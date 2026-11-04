import { useEffect, useState } from 'react';
import type { ModuleIndex } from '@kodigo/schema';
import { api } from '../lib/api';
import { enabledModules, useModuleStore } from './store';

/** one fetch per module list (GET /api/index also revalidates by ETag) */
let cached: { key: string; p: ReturnType<typeof api.index> } | null = null;

/** The lightweight index of every enabled module, for pages that span modules (no module downloads, no logic workers). */
export function useModuleIndex(): { mods: ModuleIndex[]; loading: boolean; errors: Record<string, string> } {
  const store = useModuleStore();
  const [state, setState] = useState<{ mods: ModuleIndex[]; loading: boolean; errors: Record<string, string> }>({ mods: [], loading: true, errors: {} });
  const list = enabledModules(store.list);
  const key = store.list.map((m) => `${m.id}@${m.version}:${m.enabled}`).join(',');
  useEffect(() => {
    if (!store.listLoaded) return;
    let alive = true;
    if (cached?.key !== key) cached = { key, p: api.index() };
    const p = cached.p;
    p.then(({ modules }) => {
      if (!alive) return;
      const mods: ModuleIndex[] = [];
      const errors: Record<string, string> = {};
      for (const e of list) {
        const m = modules.find((x) => x.id === e.id);
        if (!m) continue;
        if ('error' in m) errors[e.id] = m.error;
        else mods.push(m);
      }
      setState({ mods, loading: false, errors });
    }, (e) => {
      if (cached?.p === p) cached = null;
      if (alive) setState({ mods: [], loading: false, errors: { index: String(e?.message ?? e) } });
    });
    return () => { alive = false; };
  }, [key, store.listLoaded]);
  return state;
}
