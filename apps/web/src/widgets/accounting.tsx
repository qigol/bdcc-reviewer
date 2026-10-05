/**
 * Accounting views shared by the Math & Journal pane, the Journal / TAccounts / Schedule widgets and the
 * journal-entry / schedule-fill quiz questions. Amounts arrive already resolved (numbers, null or display strings).
 */
import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatAmount, entryTotals, amountOf, paneDecimals, DEFAULT_CURRENCY, type JournalEntry, type ScheduleRow, type TAccount, type ResolvedJournalPane } from '@kodigo/schema';
import { Markdown } from '../lib/md';
import { cn } from '../lib/util';
import { anchorColor } from './CodeView';
import type { Marks } from '../engine/types';

export interface AnchorProps {
  hoverAnchor?: string | null;
  setHoverAnchor?: (a: string | null) => void;
  /** anchor lit by a trace step */
  activeAnchor?: string | null;
  /** value badges per anchor (shown on the anchor's last row) */
  badges?: Record<string, string>;
  anchorOrder?: string[];
}
export interface MoneyProps { currency?: string; decimals?: number }

const fmtMoney = (v: unknown, m: MoneyProps, format?: ScheduleRow['format'], symbol = true) => formatAmount(v, format ?? 'money', { currency: m.currency ?? DEFAULT_CURRENCY, decimals: m.decimals, symbol });

function rowAnchorClass(anchor: string | undefined, a: AnchorProps) {
  if (!anchor) return undefined;
  if (a.activeAnchor === anchor) return 'trace-on';
  if (a.hoverAnchor === anchor) return 'anc-hover';
  return undefined;
}
function markClass(marks: Marks | undefined, ...sels: (string | undefined)[]) {
  for (const s of sels) { if (!s) continue; const t = marks?.tone(s); if (t) return `tone-${t} mark-bg`; }
  return undefined;
}
function markNote(marks: Marks | undefined, ...sels: (string | undefined)[]) {
  for (const s of sels) { if (!s) continue; const n = marks?.note(s); if (n) return n; }
  return undefined;
}
/** Colored bar marking an anchored row; only where anchors pair with a derivation (the Math pane passes anchorOrder). */
function AnchorBar({ anchor, order }: { anchor?: string; order?: string[] }) {
  if (!order) return null;
  return <span className="inline-block w-1.5 shrink-0 self-stretch rounded-sm" style={{ background: anchor ? anchorColor(anchor, order) : 'transparent' }} />;
}
function Badge({ text }: { text?: string }) {
  return text ? <span className="ml-2 whitespace-nowrap rounded bg-warn/20 px-1.5 py-0.5 font-sans text-[11px] font-semibold text-warn">{text}</span> : null;
}

// ------------------------------------------------------------ journal entries
export function EntriesView({ entries, money, marks, visible, showTotals, anchors = {}, compact }: {
  entries: JournalEntry[]; money: MoneyProps; marks?: Marks; visible?: Set<string>; showTotals?: boolean; anchors?: AnchorProps; compact?: boolean;
}) {
  const lastAnchorRow: Record<string, string> = {};
  entries.forEach((e) => e.lines.forEach((l, i) => { if (l.anchor) lastAnchorRow[l.anchor] = `${e.id}:${i}`; }));
  const shown = entries.filter((e) => !visible || visible.has(e.id));
  return (
    <div className={cn('overflow-x-auto', compact ? 'text-[13px]' : 'text-sm')}>
      <table className="w-full border-collapse tabular-nums" data-journal>
        <thead>
          <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-muted">
            <th className="w-20 py-1 pr-2 font-medium">Date</th>
            <th className="py-1 pr-2 font-medium">Account</th>
            <th className="w-28 py-1 pr-2 text-right font-medium">Debit</th>
            <th className="w-28 py-1 text-right font-medium">Credit</th>
          </tr>
        </thead>
        <AnimatePresence initial={false}>
          {shown.map((e, k) => {
            const t = entryTotals(e);
            const eMark = markClass(marks, `entry:${e.id}`, e.anchor && `anchor:${e.anchor}`);
            return (
              <motion.tbody key={e.id} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={cn(k > 0 && 'border-t border-line/70', eMark)} data-entry={e.id}>
                {e.lines.map((l, i) => {
                  const isCredit = l.credit !== undefined;
                  const cls = markClass(marks, `line:${e.id}:${i + 1}`, `account:${l.account}`, l.anchor && `anchor:${l.anchor}`);
                  const note = markNote(marks, `line:${e.id}:${i + 1}`, `entry:${e.id}`);
                  return (
                    <tr key={i} className={cn('acct-row', rowAnchorClass(l.anchor ?? e.anchor, anchors), cls)}
                      onMouseEnter={() => (l.anchor ?? e.anchor) && anchors.setHoverAnchor?.(l.anchor ?? e.anchor!)}
                      onMouseLeave={() => (l.anchor ?? e.anchor) && anchors.setHoverAnchor?.(null)}>
                      <td className="py-0.5 pr-2 align-top text-xs text-muted">{i === 0 ? e.date ?? '' : ''}</td>
                      <td className="py-0.5 pr-2">
                        <span className="flex items-center gap-2">
                          <AnchorBar anchor={l.anchor ?? e.anchor} order={anchors.anchorOrder} />
                          <span className={cn(isCredit && 'pl-8')}>{l.account}</span>
                          {l.note && <span className="text-xs text-muted"><Markdown text={l.note} inline /></span>}
                          {i === e.lines.length - 1 && note && <span className="rounded bg-accent/10 px-1.5 text-[11px] text-accent">{note}</span>}
                          {lastAnchorRow[l.anchor ?? ''] === `${e.id}:${i}` && <Badge text={anchors.badges?.[l.anchor!]} />}
                        </span>
                      </td>
                      <td className="py-0.5 pr-2 text-right font-mono">{isCredit ? '' : fmtMoney(l.debit, money)}</td>
                      <td className="py-0.5 text-right font-mono">{isCredit ? fmtMoney(l.credit, money) : ''}</td>
                    </tr>
                  );
                })}
                {e.memo && (
                  <tr><td /><td colSpan={3} className="pb-1 pl-10 text-xs italic text-muted"><Markdown text={e.memo} inline /></td></tr>
                )}
                {showTotals && (
                  <tr className="text-xs text-muted">
                    <td /><td className="pl-3">Totals {Math.abs(t.debit - t.credit) < 0.005 ? '✓ balanced' : '✗ unbalanced'}</td>
                    <td className="border-t border-line pr-2 text-right font-mono">{fmtMoney(t.debit, money)}</td>
                    <td className="border-t border-line text-right font-mono">{fmtMoney(t.credit, money)}</td>
                  </tr>
                )}
              </motion.tbody>
            );
          })}
        </AnimatePresence>
      </table>
      {visible && shown.length < entries.length && <div className="mt-1 text-xs text-muted">{entries.length - shown.length} more entr{entries.length - shown.length === 1 ? 'y' : 'ies'} to post…</div>}
    </div>
  );
}

// ------------------------------------------------------------ schedules / statements
export function ScheduleView({ rows, columns, money, marks, anchors = {}, renderCell, compact }: {
  rows: (ScheduleRow & { blank?: boolean })[]; columns?: string[]; money: MoneyProps; marks?: Marks; anchors?: AnchorProps;
  /** quiz: render an input in place of a blank cell */
  renderCell?: (row: number, col: number) => ReactNode | undefined; compact?: boolean;
}) {
  const nCols = Math.max(1, columns?.length ?? 1);
  const lastAnchorRow: Record<string, number> = {};
  rows.forEach((r, i) => { if (r.anchor) lastAnchorRow[r.anchor] = i; });
  return (
    <div className={cn('overflow-x-auto', compact ? 'text-[13px]' : 'text-sm')}>
      <table className="w-full border-collapse tabular-nums" data-schedule>
        {columns?.length ? (
          <thead>
            <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
              <th />
              {columns.map((c, j) => <th key={j} className="w-32 py-1 pl-2 text-right font-medium">{c}</th>)}
            </tr>
          </thead>
        ) : null}
        <tbody>
          {rows.map((r, i) => {
            const cells = r.amounts ?? (r.amount !== undefined ? [r.amount] : []);
            const sel = `row:${r.id ?? i + 1}`;
            const cls = markClass(marks, sel, `row:${i + 1}`, r.anchor && `anchor:${r.anchor}`);
            const note = markNote(marks, sel, `row:${i + 1}`);
            const style = r.style ?? 'line';
            return (
              <tr key={r.id ?? i} data-row={r.id ?? i + 1}
                className={cn('acct-row', rowAnchorClass(r.anchor, anchors), cls, style === 'heading' && 'font-semibold', (style === 'subtotal' || style === 'total') && 'font-semibold')}
                onMouseEnter={() => r.anchor && anchors.setHoverAnchor?.(r.anchor)} onMouseLeave={() => r.anchor && anchors.setHoverAnchor?.(null)}>
                <td className="py-0.5 pr-3">
                  <span className="flex items-center gap-2" style={{ paddingLeft: `${(r.indent ?? 0) * 1.25}rem` }}>
                    <AnchorBar anchor={r.anchor} order={anchors.anchorOrder} />
                    <Markdown text={r.label} inline />
                    {note && <span className="rounded bg-accent/10 px-1.5 text-[11px] font-normal text-accent">{note}</span>}
                    {r.anchor && lastAnchorRow[r.anchor] === i && <Badge text={anchors.badges?.[r.anchor]} />}
                  </span>
                </td>
                {Array.from({ length: nCols }, (_, j) => {
                  const custom = renderCell?.(i, j);
                  const v = cells[j];
                  const cellMark = markClass(marks, `cell:${r.id ?? i + 1},${j + 1}`);
                  return (
                    <td key={j} className={cn('w-32 py-0.5 pl-2 text-right font-mono', style === 'subtotal' && 'border-t border-line', style === 'total' && 'border-b-4 border-double border-t border-line', cellMark)}>
                      {custom !== undefined ? custom : typeof v === 'string' && amountOf(v) === null && !/^-?[\d.,]+$/.test(v) ? <Markdown text={v} inline /> : fmtMoney(v, money, r.format)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------ T-accounts
export function TAccountsView({ accounts, money, marks, showBalance = true, anchors = {} }: {
  accounts: TAccount[]; money: MoneyProps; marks?: Marks; showBalance?: boolean; anchors?: AnchorProps;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3" data-taccounts>
      {accounts.map((a) => {
        const dr = a.debits.reduce((s, p) => s + (amountOf(p.amount) ?? 0), 0);
        const cr = a.credits.reduce((s, p) => s + (amountOf(p.amount) ?? 0), 0);
        const bal = dr - cr;
        const n = Math.max(a.debits.length, a.credits.length, 1);
        const acctMark = markClass(marks, `account:${a.id}`, a.anchor && `anchor:${a.anchor}`);
        const side = (list: TAccount['debits'], key: 'dr' | 'cr') => (
          <div className={cn('flex flex-col', key === 'dr' ? 'border-r-2 border-ink/70 pr-2' : 'pl-2')}>
            <AnimatePresence initial={false}>
              {list.map((p, i) => (
                <motion.div key={`${key}${i}`} initial={{ opacity: 0, x: key === 'dr' ? -6 : 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                  className={cn('acct-row flex items-baseline justify-between gap-1 rounded px-1 font-mono text-[13px]', rowAnchorClass(p.anchor, anchors), markClass(marks, `${key}:${a.id}:${i + 1}`, p.anchor && `anchor:${p.anchor}`))}
                  onMouseEnter={() => p.anchor && anchors.setHoverAnchor?.(p.anchor)} onMouseLeave={() => p.anchor && anchors.setHoverAnchor?.(null)}>
                  <span className="text-[10px] text-muted">{p.ref ?? ''}</span>
                  <span>{fmtMoney(p.amount, money, 'money', false)}</span>
                </motion.div>
              ))}
            </AnimatePresence>
            {Array.from({ length: n - list.length }, (_, i) => <div key={`pad${i}`} className="h-[1.35rem]" />)}
          </div>
        );
        return (
          <div key={a.id} className={cn('rounded-lg border border-line bg-panel px-2 pb-2 pt-1 transition', acctMark)} data-account={a.id}>
            <div className="border-b-2 border-ink/70 pb-0.5 text-center text-xs font-semibold">{a.name}</div>
            <div className="grid grid-cols-2 pt-1">{side(a.debits, 'dr')}{side(a.credits, 'cr')}</div>
            {(a.showBalance ?? showBalance) && (a.debits.length || a.credits.length) ? (
              <div className={cn('mt-1 grid grid-cols-2 border-t border-line pt-0.5 font-mono text-[12px] font-semibold', markClass(marks, `bal:${a.id}`))}>
                <span className="pr-2 text-right">{bal > 0.004 ? fmtMoney(bal, money, 'money', false) : ''}</span>
                <span className="pl-2 text-right">{bal < -0.004 ? fmtMoney(-bal, money, 'money', false) : ''}</span>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------ the Math & Journal pane
/** A section's journal pane: its blocks (entries, schedules, T-accounts) in order, sharing anchors with the derivation. */
export function JournalPaneView({ pane, money, marks, anchors, maxHeight }: { pane: ResolvedJournalPane; money: MoneyProps; marks?: Marks; anchors: AnchorProps; maxHeight?: number }) {
  const m = { ...money, decimals: money.decimals ?? paneDecimals(pane) };
  // a trace badge shows once: in the first block that has the anchor (usually the schedule that computes it)
  const badgeBlock: Record<string, number> = {};
  pane.blocks.forEach((b, i) => {
    const names: (string | undefined)[] = b.kind === 'entries' && Array.isArray(b.entries) ? b.entries.flatMap((e) => [e.anchor, ...e.lines.map((l) => l.anchor)])
      : b.kind === 'schedule' && Array.isArray(b.rows) ? b.rows.map((r) => r.anchor)
      : b.kind === 'taccounts' && Array.isArray(b.accounts) ? b.accounts.flatMap((a) => [a.anchor, ...a.debits.map((p) => p.anchor), ...a.credits.map((p) => p.anchor)]) : [];
    for (const n of names) if (n && badgeBlock[n] === undefined) badgeBlock[n] = i;
  });
  const anchorsFor = (i: number): AnchorProps => ({ ...anchors, badges: Object.fromEntries(Object.entries(anchors.badges ?? {}).filter(([k]) => badgeBlock[k] === i)) });
  return (
    <div className="scrollbar-thin flex flex-col gap-4 overflow-auto rounded-xl border border-line bg-panel p-3" style={{ maxHeight }} data-testid="journal-pane">
      {pane.title && <div className="-mb-2 text-xs font-medium text-muted">{pane.title}</div>}
      {pane.blocks.map((b, i) => (
        <section key={i}>
          {b.title && <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{b.title}</div>}
          {b.kind === 'entries' && Array.isArray(b.entries) && <EntriesView entries={b.entries} money={m} marks={marks} anchors={anchorsFor(i)} compact />}
          {b.kind === 'schedule' && Array.isArray(b.rows) && <ScheduleView rows={b.rows} columns={b.columns} money={m} marks={marks} anchors={anchorsFor(i)} compact />}
          {b.kind === 'taccounts' && Array.isArray(b.accounts) && <TAccountsView accounts={b.accounts} money={m} marks={marks} anchors={anchorsFor(i)} />}
          {!Array.isArray(b.kind === 'entries' ? b.entries : b.kind === 'schedule' ? b.rows : b.accounts) && <div className="text-xs text-bad">This block's data didn't resolve for these inputs.</div>}
        </section>
      ))}
    </div>
  );
}
