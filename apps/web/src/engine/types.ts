import type { Scope, StageWidget } from '@kodigo/schema';
import type { LoadedModule } from '../modules/store';

export interface WidgetCommand {
  cmd: string;
  args?: any;
  transient?: boolean;
  /** monotonically increasing; used to re-trigger animations */
  seq: number;
}

export interface TraceView {
  /** widget id → commands produced by the trace so far */
  cmds: Record<string, WidgetCommand[]>;
  patch: Record<string, any>;
  code?: string;
  math?: string;
  vars?: Record<string, any>;
  label?: string;
  /** widget ids that play the code / formula roles */
  codeTargets: string[];
  formulaTargets: string[];
}

export interface StageCtxValue {
  mod: LoadedModule;
  scope: Scope;
  labels: Record<string, string>;
  hoverAnchor: string | null;
  setHoverAnchor: (a: string | null) => void;
  setState: (key: string, value: any) => void;
  emit: (widgetId: string, event: string, payload?: any) => void;
  cmdsFor: (widgetId: string) => WidgetCommand[];
  traces: Record<string, TraceView>;
  registerTrace: (playerId: string, view: TraceView | null) => void;
  registerPlayer: (playerId: string, api: PlayerApi | null) => void;
  reducedMotion: boolean;
  /** key that changes when a beat is replayed (re-triggers transient animations) */
  replayKey: number;
  players: Record<string, PlayerApi>;
}

export interface PlayerApi {
  toggle: () => void;
  play: () => void;
  pause: () => void;
  step: () => void;
  back: () => void;
  reset: () => void;
  goto: (n: number) => void;
}

export interface Marks {
  tone: (sel: string) => string | undefined;
  pulse: (sel: string) => number | undefined;
  note: (sel: string) => string | undefined;
  any: (prefix: string) => boolean;
  /** all highlighted selectors → tone */
  tones: Record<string, string>;
}

export interface WidgetRenderProps<P = any> {
  id: string;
  widget: StageWidget;
  props: P;
  cmds: WidgetCommand[];
  marks: Marks;
  emit: (event: string, payload?: any) => void;
  bind: (output: string, value: any) => void;
  isBound: (output: string) => boolean;
  ctx: StageCtxValue;
}
