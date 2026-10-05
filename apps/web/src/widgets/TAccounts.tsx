import type { TAccount } from '@kodigo/schema';
import type { WidgetRenderProps } from '../engine/types';
import { TAccountsView } from './accounting';
import { WidgetCard } from './common';

interface P { accounts: TAccount[]; showBalance?: boolean; currency?: string; decimals?: number; title?: string }

export default function TAccounts({ props, marks, ctx }: WidgetRenderProps<P>) {
  return (
    <WidgetCard title={props.title}>
      <TAccountsView accounts={Array.isArray(props.accounts) ? props.accounts : []} money={{ currency: props.currency ?? ctx.mod.parsed.manifest.currency, decimals: props.decimals }}
        marks={marks} showBalance={props.showBalance} anchors={{ hoverAnchor: ctx.hoverAnchor, setHoverAnchor: ctx.setHoverAnchor }} />
    </WidgetCard>
  );
}
