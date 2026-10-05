import { useMemo } from 'react';
import type { JournalEntry } from '@kodigo/schema';
import type { WidgetRenderProps } from '../engine/types';
import { ownCmds } from '../engine/marks';
import { EntriesView } from './accounting';
import { WidgetCard } from './common';

interface P { entries: JournalEntry[]; posted?: string[] | number; currency?: string; decimals?: number; showTotals?: boolean; title?: string }

/** General journal. `posted` + the `post`/`unpost` commands reveal entries one at a time. */
export default function Journal({ props, cmds, marks, ctx }: WidgetRenderProps<P>) {
  const entries = Array.isArray(props.entries) ? props.entries : [];
  const visible = useMemo(() => {
    if (props.posted === undefined && !ownCmds(cmds).some((c) => c.cmd === 'post')) return undefined;
    const v = new Set<string>(typeof props.posted === 'number' ? entries.slice(0, props.posted).map((e) => e.id) : Array.isArray(props.posted) ? props.posted : []);
    for (const c of ownCmds(cmds)) {
      const id = String(c.args?.id ?? '');
      if (c.cmd === 'post') v.add(id);
      if (c.cmd === 'unpost') v.delete(id);
    }
    return v;
  }, [props.posted, cmds, entries]);
  const currency = props.currency ?? ctx.mod.parsed.manifest.currency;
  return (
    <WidgetCard title={props.title}>
      <EntriesView entries={entries} money={{ currency, decimals: props.decimals }} marks={marks} visible={visible} showTotals={props.showTotals}
        anchors={{ hoverAnchor: ctx.hoverAnchor, setHoverAnchor: ctx.setHoverAnchor }} />
    </WidgetCard>
  );
}
