import { useEffect, useMemo, useRef, useState } from 'react';
import { resolveRefs, datasetScope, type Derive, type Scope } from '@kodigo/schema';
import type { LoadedModule } from '../modules/store';
import { stableHash } from '../lib/util';

/**
 * scope = datasets (data:) + state + derive outputs (re-run in order when state changes).
 * Previous derived values are kept while a recompute is in flight, so widgets never flicker.
 */
export function useScope(mod: LoadedModule | undefined, spec: { data?: string[]; derive?: Derive[] }, state: Record<string, any>) {
  const [derived, setDerived] = useState<Scope>({});
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(!spec.derive?.length);
  const run = useRef(0);
  const base = useMemo(() => (mod ? datasetScope(mod.parsed, spec.data) : {}), [mod, stableHash(spec.data ?? [])]);
  const stateKey = stableHash(state);
  const deriveKey = stableHash(spec.derive ?? []);

  useEffect(() => {
    if (!mod || !spec.derive?.length) { setReady(true); return; }
    const my = ++run.current;
    const t = setTimeout(async () => {
      const scope: Scope = { ...base, ...state };
      const out: Scope = {};
      try {
        for (const d of spec.derive!) {
          const args = resolveRefs(d.in, scope);
          const r = await mod.logic.call(d.fn, args);
          scope[d.out] = r;
          out[d.out] = r;
        }
        if (my === run.current) { setDerived(out); setError(null); setReady(true); }
      } catch (e: any) {
        if (my === run.current) { setError(String(e?.message ?? e)); setReady(true); }
      }
    }, 20);
    return () => clearTimeout(t);
  }, [mod, base, stateKey, deriveKey]);

  const scope = useMemo(() => ({ ...base, ...state, ...derived }), [base, stateKey, derived]);
  return { scope, error, ready };
}
