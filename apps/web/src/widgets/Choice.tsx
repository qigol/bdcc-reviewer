import type { WidgetRenderProps } from '../engine/types';
import { Markdown } from '../lib/md';
import { cn } from '../lib/util';

interface Opt { value: any; label: string }
export default function Choice({ props, bind, emit }: WidgetRenderProps<{ label?: string; options: Opt[]; style?: string; value?: any }>) {
  const eq = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);
  const set = (v: any) => { bind('value', v); emit('change', v); };
  const style = props.style ?? 'segmented';
  return (
    <div className="card px-3 py-2.5">
      {props.label && <div className="mb-1.5 text-sm font-medium"><Markdown text={props.label} inline /></div>}
      {style === 'dropdown' ? (
        <select className="input w-full" value={props.options.findIndex((o) => eq(o.value, props.value))} onChange={(e) => set(props.options[Number(e.target.value)]?.value)}>
          {props.options.map((o, i) => <option key={i} value={i}>{o.label}</option>)}
        </select>
      ) : style === 'toggle' ? (
        <button className={cn('btn w-full', eq(props.value, props.options[1]?.value) && 'bg-accent/15 border-accent/50')} onClick={() => set(eq(props.value, props.options[0]?.value) ? props.options[1]?.value : props.options[0]?.value)}>
          <Markdown text={(props.options.find((o) => eq(o.value, props.value)) ?? props.options[0])?.label ?? ''} inline />
        </button>
      ) : (
        <div role="radiogroup" className="flex flex-wrap gap-1 rounded-lg bg-panel2 p-1">
          {props.options.map((o, i) => (
            <button key={i} role="radio" aria-checked={eq(o.value, props.value)} onClick={() => set(o.value)}
              className={cn('flex-1 rounded-md px-2.5 py-1 text-sm transition', eq(o.value, props.value) ? 'bg-panel font-semibold text-accent shadow-sm' : 'text-muted hover:text-ink')}>
              <Markdown text={o.label} inline />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
