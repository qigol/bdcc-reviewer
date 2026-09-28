import { createContext, Suspense, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { resolveRefs, type Derive, type StageWidget } from '@kodigo/schema';
import type { LoadedModule } from '../modules/store';
import type { PlayerApi, StageCtxValue, TraceView, WidgetCommand } from './types';
import { computeMarks } from './marks';
import { useScope } from './useScope';
import { getWidget } from '../widgets/registry';
import { ErrorBoundary } from '../lib/ErrorBoundary';
import { InterpContext } from '../lib/md';
import { cn } from '../lib/util';

export const StageContext = createContext<StageCtxValue | null>(null);
export function useStage(): StageCtxValue {
  const c = useContext(StageContext);
  if (!c) throw new Error('StageProvider missing');
  return c;
}

export interface StageProviderProps {
  mod: LoadedModule;
  spec: { data?: string[]; derive?: Derive[] };
  state: Record<string, any>;
  setState?: (key: string, value: any) => void;
  /** commands from beats (persistent up to now + transient of the current beat) */
  cmds?: Record<string, WidgetCommand[]>;
  onEvent?: (widgetId: string, event: string, payload?: any) => void;
  /** extra values merged into scope (e.g. quiz generator vars) */
  extraScope?: Record<string, any>;
  reducedMotion?: boolean;
  replayKey?: number;
  children: ReactNode | ((scope: Record<string, any>) => ReactNode);
}

export function StageProvider({ mod, spec, state, setState, cmds, onEvent, extraScope, reducedMotion = false, replayKey = 0, children }: StageProviderProps) {
  const [traces, setTraces] = useState<Record<string, TraceView>>({});
  const [hoverAnchor, setHoverAnchor] = useState<string | null>(null);
  const players = useRef<Record<string, PlayerApi>>({});
  const patch = useMemo(() => Object.assign({}, ...Object.values(traces).map((t) => t.patch)), [traces]);
  const effState = useMemo(() => ({ ...state, ...patch }), [state, patch]);
  const { scope: s0 } = useScope(mod, spec, effState);
  const scope = useMemo(() => (extraScope ? { ...s0, ...extraScope } : s0), [s0, extraScope]);

  const registerTrace = useCallback((id: string, view: TraceView | null) => {
    setTraces((cur) => {
      if (!view) { if (!(id in cur)) return cur; const { [id]: _, ...rest } = cur; return rest; }
      return { ...cur, [id]: view };
    });
  }, []);
  const registerPlayer = useCallback((id: string, api: PlayerApi | null) => {
    if (api) players.current[id] = api; else delete players.current[id];
  }, []);

  const value = useMemo<StageCtxValue>(() => ({
    mod,
    scope,
    labels: mod.labels,
    hoverAnchor,
    setHoverAnchor,
    setState: setState ?? (() => {}),
    emit: (w, e, p) => onEvent?.(w, e, p),
    cmdsFor: (id) => {
      const base = (cmds?.[id] ?? []).map((c) => (c.args === undefined ? c : { ...c, args: resolveRefs(c.args, scope) }));
      const fromTraces = Object.values(traces).flatMap((t) => t.cmds[id] ?? []);
      return fromTraces.length ? [...base, ...fromTraces] : base;
    },
    traces,
    registerTrace,
    registerPlayer,
    reducedMotion,
    replayKey,
    players: players.current,
  }), [mod, scope, hoverAnchor, setState, onEvent, cmds, traces, registerTrace, registerPlayer, reducedMotion, replayKey]);

  return (
    <StageContext.Provider value={value}>
      <InterpContext.Provider value={{ scope, labels: mod.labels }}>
        {typeof children === 'function' ? children(scope) : children}
      </InterpContext.Provider>
    </StageContext.Provider>
  );
}

export function WidgetHost({ w }: { w: StageWidget }) {
  const ctx = useStage();
  const Comp = getWidget(w.widget);
  const props = useMemo(() => {
    const p = resolveRefs(w.props ?? {}, ctx.scope) as Record<string, any>;
    for (const [out, key] of Object.entries(w.bind ?? {})) if (p[out] === undefined) p[out] = ctx.scope[key];
    return p;
  }, [w, ctx.scope]);
  const cmds = ctx.cmdsFor(w.id);
  const marks = useMemo(() => computeMarks(cmds), [cmds]);
  const bind = useCallback((out: string, v: any) => {
    const key = w.bind?.[out];
    if (key) ctx.setState(key, v);
  }, [w.bind, ctx.setState]);
  const emit = useCallback((event: string, payload?: any) => ctx.emit(w.id, event, payload), [ctx.emit, w.id]);
  if (!Comp) {
    return (
      <div className="rounded-lg border border-dashed border-warn/60 bg-warn/5 p-4 text-sm text-warn" data-widget-missing={w.widget}>
        Widget <b>{w.widget}</b> is not in this site's catalog yet. (See WIDGET_REQUESTS.md in the module.)
      </div>
    );
  }
  return (
    <ErrorBoundary name={`${w.widget} #${w.id}`}>
      <Suspense fallback={<div className="h-24 animate-pulse rounded-lg bg-panel2" />}>
        <div data-widget={w.widget} data-widget-id={w.id}>
          <Comp id={w.id} widget={w} props={props} cmds={cmds} marks={marks} emit={emit} bind={bind} isBound={(o: string) => !!w.bind?.[o]} ctx={ctx} />
        </div>
      </Suspense>
    </ErrorBoundary>
  );
}

/** Lays out stage widgets by region: top, main + side, bottom. */
export function Stage({ widgets, hidden, className, compact }: { widgets: StageWidget[]; hidden?: Set<string>; className?: string; compact?: boolean }) {
  const ctx = useStage();
  const visible = (w: StageWidget) => !hidden?.has(w.id);
  const by = (r: string) => widgets.filter((w) => (w.region ?? 'main') === r);
  const render = (list: StageWidget[]) => (
    <AnimatePresence initial={false}>
      {list.filter(visible).map((w) => (
        <motion.div
          key={w.id}
          layout={!ctx.reducedMotion}
          initial={ctx.reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: ctx.reducedMotion ? 0 : -8 }}
          transition={{ duration: ctx.reducedMotion ? 0.12 : 0.3 }}
        >
          <WidgetHost w={w} />
        </motion.div>
      ))}
    </AnimatePresence>
  );
  const side = by('side');
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {by('top').length > 0 && <div className="flex flex-col gap-3">{render(by('top'))}</div>}
      <div className={cn('grid gap-4', side.some(visible) && !compact ? 'lg:grid-cols-[minmax(0,1fr)_300px]' : 'grid-cols-1')}>
        <div className="flex min-w-0 flex-col gap-4">{render(by('main'))}</div>
        {side.some(visible) && <div className="flex min-w-0 flex-col gap-3">{render(side)}</div>}
      </div>
      {by('bottom').length > 0 && <div className="flex flex-col gap-3">{render(by('bottom'))}</div>}
    </div>
  );
}
