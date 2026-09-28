import { useEffect, useState } from 'react';
import { enabledModules, useModuleStore, type LoadedModule } from './store';

/** Load every enabled module (cached by the store). */
export function useAllModules(): { mods: LoadedModule[]; loading: boolean; errors: Record<string, string> } {
  const store = useModuleStore();
  const [mods, setMods] = useState<LoadedModule[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const ids = enabledModules(store.list).map((m) => m.id).join(',');
  useEffect(() => {
    if (!store.listLoaded) return;
    let alive = true;
    const list = enabledModules(store.list);
    Promise.allSettled(list.map((m) => store.load(m.id))).then((rs) => {
      if (!alive) return;
      const ok: LoadedModule[] = [];
      const errs: Record<string, string> = {};
      rs.forEach((r, i) => (r.status === 'fulfilled' ? ok.push(r.value) : (errs[list[i].id] = String((r as any).reason?.message ?? r))));
      setMods(ok);
      setErrors(errs);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [ids, store.listLoaded]);
  return { mods, loading, errors };
}
