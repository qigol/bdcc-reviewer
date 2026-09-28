import type { WidgetRenderProps } from '../engine/types';
import { Markdown } from '../lib/md';
import { AnimatedNumber } from './common';
import { cn } from '../lib/util';

interface Item { label: string; value: any; tone?: string; format?: string | number }
export default function Readout({ props, marks, ctx }: WidgetRenderProps<{ items: Item[] }>) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-2">
      {(props.items ?? []).map((it, i) => {
        const t = marks.tone(`item:${i}`) ?? it.tone;
        return (
          <div key={i} className={cn('card px-3 py-2', t && `tone-${t}`, marks.tone(`item:${i}`) && 'mark-bg', marks.pulse(`item:${i}`) && 'pulse')} key-pulse={marks.pulse(`item:${i}`)}>
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted"><Markdown text={it.label} inline /></div>
            <div className={cn('text-2xl font-semibold tabular-nums', t && 'mark-text')}>
              {typeof it.value === 'number' ? <AnimatedNumber value={it.value} format={it.format} reduced={ctx.reducedMotion} /> : it.value === null || it.value === undefined ? '—' : Array.isArray(it.value) ? it.value.join(', ') : <Markdown text={String(it.value)} inline />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
