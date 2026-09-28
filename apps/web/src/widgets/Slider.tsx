import type { WidgetRenderProps } from '../engine/types';
import { Markdown } from '../lib/md';
import { fmtNum } from './common';

export default function Slider({ props, bind, emit }: WidgetRenderProps<{ label: string; min: number; max: number; step: number; format?: string | number; marks?: number[]; value?: number }>) {
  const v = typeof props.value === 'number' ? props.value : props.min;
  const set = (x: number) => { bind('value', x); emit('change', x); };
  return (
    <div className="card px-3 py-2.5">
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium"><Markdown text={props.label} inline /></span>
        <span className="rounded-md bg-accent/10 px-2 py-0.5 font-mono text-sm font-semibold text-accent tabular-nums">{fmtNum(v, props.format)}</span>
      </div>
      <input
        type="range"
        aria-label={props.label}
        className="w-full accent-[rgb(var(--accent))]"
        min={props.min}
        max={props.max}
        step={props.step}
        value={v}
        onChange={(e) => set(Number(e.target.value))}
        list={props.marks ? `marks-${props.label}` : undefined}
      />
      <div className="flex justify-between text-[10px] text-muted"><span>{fmtNum(props.min, props.format)}</span><span>{fmtNum(props.max, props.format)}</span></div>
      {props.marks && <datalist id={`marks-${props.label}`}>{props.marks.map((m) => <option key={m} value={m} />)}</datalist>}
    </div>
  );
}
