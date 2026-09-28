import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TraceStep } from '@kodigo/schema';
import { TRANSIENT_COMMANDS } from '@kodigo/schema';
import type { LoadedModule } from '../modules/store';
import type { WidgetCommand } from './types';
import { stableHash } from '../lib/util';

const EMPTY: TraceStep[] = [];

export interface TraceState {
  steps: TraceStep[];
  result: any;
  index: number; // -1 = reset (nothing applied)
  playing: boolean;
  speed: number;
  error: string | null;
  setIndex: (n: number) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  step: () => void;
  back: () => void;
  reset: () => void;
  setSpeed: (s: number) => void;
}

export function useTracePlayer(mod: LoadedModule | undefined, fn: string | undefined, input: unknown, opts: { speed?: number; autoplay?: boolean; loop?: boolean } = {}): TraceState {
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndexRaw] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(opts.speed ?? 1);
  const key = stableHash(input);
  const steps: TraceStep[] = useMemo(() => (Array.isArray(result?.trace) ? result.trace : EMPTY), [result]);
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  useEffect(() => {
    if (!mod || !fn) return;
    let alive = true;
    mod.logic.call(fn, input).then(
      (r) => { if (!alive) return; setResult(r); setError(null); setIndexRaw(-1); setPlaying(!!opts.autoplay); },
      (e) => alive && setError(String(e?.message ?? e)),
    );
    return () => { alive = false; };
  }, [mod, fn, key]);

  const setIndex = useCallback((n: number) => setIndexRaw(Math.max(-1, Math.min(n, stepsRef.current.length - 1))), []);

  useEffect(() => {
    if (!playing || !steps.length) return;
    const t = setTimeout(() => {
      setIndexRaw((i) => {
        if (i >= steps.length - 1) {
          if (opts.loop) return -1;
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, index === -1 ? 250 : 1000 / Math.max(0.1, speed));
    return () => clearTimeout(t);
  }, [playing, index, speed, steps.length, opts.loop]);

  useEffect(() => {
    if (playing && index >= steps.length - 1 && !opts.loop && steps.length) setPlaying(false);
  }, [index, steps.length, playing, opts.loop]);

  return {
    steps, result, index, playing, speed, error,
    setIndex,
    play: () => { if (index >= steps.length - 1) setIndexRaw(-1); setPlaying(true); },
    pause: () => setPlaying(false),
    toggle: () => setPlaying((p) => { if (!p && index >= steps.length - 1) setIndexRaw(-1); return !p; }),
    step: () => { setPlaying(false); setIndex(index + 1); },
    back: () => { setPlaying(false); setIndex(index - 1); },
    reset: () => { setPlaying(false); setIndexRaw(-1); },
    setSpeed,
  };
}

/** Commands per role for trace position `index` (persistent ops ≤ index, transient ops of index). */
export function traceCommands(steps: TraceStep[], index: number): { byRole: Record<string, WidgetCommand[]>; patch: Record<string, any> } {
  const byRole: Record<string, WidgetCommand[]> = {};
  const patch: Record<string, any> = {};
  for (let i = 0; i <= index && i < steps.length; i++) {
    const s = steps[i];
    for (const [k, op] of (s.ops ?? []).entries()) {
      const transient = TRANSIENT_COMMANDS.has(op.cmd);
      if (transient && i !== index) continue;
      (byRole[op.role] ??= []).push({ cmd: op.cmd, args: op.args, transient, seq: i * 100 + k + 1 });
    }
    if (s.patch) Object.assign(patch, s.patch);
  }
  return { byRole, patch };
}

export function useTraceView(steps: TraceStep[], index: number) {
  return useMemo(() => traceCommands(steps, index), [steps, index]);
}
