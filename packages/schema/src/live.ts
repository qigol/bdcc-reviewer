import type { Dataset, StageWidget } from './schemas';

/**
 * Math & Code live-example widgets.
 *
 * A section shows `live` widgets if it declares them; otherwise one widget per dataset in `data`
 * (TransactionTable for transactions, Matrix for matrices, a Text dump for anything else), with ids `ds-<datasetId>`.
 */
export function defaultLiveWidgets(datasets: Record<string, Dataset>, ids: string[] = []): StageWidget[] {
  return ids.map((id): StageWidget => {
    const ds = datasets[id] as any;
    if (ds?.kind === 'transactions') return { id: `ds-${id}`, widget: 'TransactionTable', props: { transactions: `@${id}`, title: ds.title ?? id } };
    if (ds?.kind === 'matrix') return { id: `ds-${id}`, widget: 'Matrix', props: { data: `@${id}`, title: ds.title ?? id, showRowMeans: false } };
    return { id: `ds-${id}`, widget: 'Text', props: { body: `**${ds?.title ?? id}**: \`${JSON.stringify(ds?.value ?? ds?.items ?? ds?.rows ?? '').slice(0, 300)}\`` } };
  });
}

export function sectionLiveWidgets(section: { data?: string[]; live?: StageWidget[] }, datasets: Record<string, Dataset>): StageWidget[] {
  return section.live?.length ? section.live : defaultLiveWidgets(datasets, section.data);
}

/** Roles that address the section's own panes rather than a live widget. */
export const PANE_ROLES = new Set(['code', 'formula']);

/**
 * Which live widget a trace op's `role` addresses, in order of preference:
 * an exact widget id → `ds-<role>` (a dataset id) → `table` = first TransactionTable, `matrix` = first Matrix,
 * `data` = first live widget → the first widget whose catalog name matches the role case-insensitively (`ranklist`).
 */
export function liveRoleTarget(role: string, widgets: StageWidget[]): string | null {
  const byId = widgets.find((w) => w.id === role) ?? widgets.find((w) => w.id === `ds-${role}`);
  if (byId) return byId.id;
  if (role === 'table') return widgets.find((w) => w.widget === 'TransactionTable')?.id ?? null;
  if (role === 'matrix') return widgets.find((w) => w.widget === 'Matrix')?.id ?? null;
  if (role === 'data') return widgets[0]?.id ?? null;
  return widgets.find((w) => w.widget.toLowerCase() === role.toLowerCase())?.id ?? null;
}
