import type { ScheduleRow } from '@kodigo/schema';
import type { WidgetRenderProps } from '../engine/types';
import { ScheduleView } from './accounting';
import { WidgetCard } from './common';
import { Markdown } from '../lib/md';

interface P { rows: ScheduleRow[]; columns?: string[]; currency?: string; decimals?: number; title?: string }

export default function Schedule({ props, marks, ctx }: WidgetRenderProps<P>) {
  return (
    <WidgetCard title={props.title ? <Markdown text={props.title} inline /> : undefined}>
      <ScheduleView rows={Array.isArray(props.rows) ? props.rows : []} columns={props.columns} money={{ currency: props.currency ?? ctx.mod.parsed.manifest.currency, decimals: props.decimals }}
        marks={marks} anchors={{ hoverAnchor: ctx.hoverAnchor, setHoverAnchor: ctx.setHoverAnchor }} />
    </WidgetCard>
  );
}
