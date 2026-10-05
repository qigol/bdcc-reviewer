/**
 * Journal workbench (guide §5.8b): journal entries, schedules and T-accounts.
 * Isomorphic helpers shared by the validator, the quiz engine and the web renderer.
 */
import { moneyText, groupThousands, round } from '@kodigo/sdk';
import { JournalEntry as JournalEntrySchema, ScheduleRow as ScheduleRowSchema, TAccount as TAccountSchema, type JournalPane, type ResolvedJournalPane, type ScheduleRow } from './schemas';
import { resolveRefs, type Scope } from './interpolate';
import { withinTol } from './quiz';

export const DEFAULT_CURRENCY = '₱';

/** Does any block take its list from a '@ref' (so its anchors are only known once resolved)? */
export const journalIsDynamic = (pane: JournalPane | undefined) =>
  !!pane?.blocks.some((b) => typeof (b.kind === 'entries' ? b.entries : b.kind === 'schedule' ? b.rows : b.accounts) === 'string');

/** Every anchor name used in a journal pane (lines, entries, rows, T-accounts and their postings). Lists given as '@refs' are skipped. */
export function journalAnchors(pane: JournalPane | ResolvedJournalPane | undefined): Set<string> {
  const out = new Set<string>();
  for (const b of (pane?.blocks ?? []) as any[]) {
    const list = b.kind === 'entries' ? b.entries : b.kind === 'schedule' ? b.rows : b.accounts;
    if (!Array.isArray(list)) continue;
    if (b.kind === 'entries') for (const e of b.entries) { if (e.anchor) out.add(e.anchor); for (const l of e.lines) if (l.anchor) out.add(l.anchor); }
    if (b.kind === 'schedule') for (const r of b.rows) if (r.anchor) out.add(r.anchor);
    if (b.kind === 'taccounts') for (const a of b.accounts) {
      if (a.anchor) out.add(a.anchor);
      for (const p of [...a.debits, ...a.credits]) if (p.anchor) out.add(p.anchor);
    }
  }
  return out;
}

/**
 * Replace '@refs' in a pane by scope values: whole lists first (entries: '@close.entries'), then the
 * amounts inside them. Missing refs become null and are reported in `missing`.
 */
export function resolveJournal(pane: JournalPane, scope: Scope, missing?: string[]): ResolvedJournalPane {
  return resolveRefs(resolveRefs(pane, scope, missing), scope, missing) as ResolvedJournalPane;
}

export const amountOf = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function entryTotals(e: { lines: { debit?: unknown; credit?: unknown }[] }): { debit: number; credit: number } {
  let debit = 0, credit = 0;
  for (const l of e.lines) { debit += amountOf(l.debit) ?? 0; credit += amountOf(l.credit) ?? 0; }
  return { debit, credit };
}

export const balanced = (e: { lines: { debit?: unknown; credit?: unknown }[] }, tol = 0.005) => {
  const t = entryTotals(e);
  return Math.abs(t.debit - t.credit) <= tol + 1e-9;
};

/** Problems in a resolved pane: lists of the wrong shape, amounts that are not numbers, entries whose debits ≠ credits. */
export function journalProblems(pane: ResolvedJournalPane): string[] {
  const out: string[] = [];
  for (const [j, b] of pane.blocks.entries()) {
    const list: unknown = b.kind === 'entries' ? b.entries : b.kind === 'schedule' ? b.rows : b.accounts;
    if (!Array.isArray(list)) { out.push(`block ${j + 1} (${b.kind}): the '@ref' must resolve to a list (got ${JSON.stringify(list)?.slice(0, 60)})`); continue; }
    const schema = b.kind === 'entries' ? JournalEntrySchema : b.kind === 'schedule' ? ScheduleRowSchema : TAccountSchema;
    const bad = list.map((x, i) => [i, schema.safeParse(x)] as const).find(([, r]) => !r.success);
    if (bad) { const r = bad[1] as any; out.push(`block ${j + 1} (${b.kind}) item ${bad[0] + 1}: ${r.error.issues[0]?.message} at ${r.error.issues[0]?.path.join('.')}`); continue; }
    if (b.kind === 'entries') {
      for (const e of b.entries) {
        e.lines.forEach((l, i) => {
          const v = l.debit !== undefined ? l.debit : l.credit;
          if (amountOf(v) === null) out.push(`entry "${e.id}" line ${i + 1} (${l.account}): amount ${JSON.stringify(v)} is not a number`);
          else if ((v as number) < 0) out.push(`entry "${e.id}" line ${i + 1} (${l.account}): amounts are positive; put the line on the other side instead of using a negative`);
        });
        const t = entryTotals(e);
        if (Math.abs(t.debit - t.credit) > 0.005) out.push(`entry "${e.id}" does not balance: debits ${t.debit} ≠ credits ${t.credit}`);
      }
    }
    if (b.kind === 'taccounts') {
      for (const a of b.accounts) for (const p of [...a.debits, ...a.credits]) if (amountOf(p.amount) === null) out.push(`T-account "${a.id}": posting ${JSON.stringify(p.amount)} is not a number`);
    }
  }
  return out;
}

/** Every amount in the pane is whole → 0 decimals, else 2. */
export function paneDecimals(pane: ResolvedJournalPane): number {
  if (pane.decimals !== undefined) return pane.decimals;
  const all: number[] = [];
  for (const b of pane.blocks) {
    if (!Array.isArray((b as any)[b.kind === 'entries' ? 'entries' : b.kind === 'schedule' ? 'rows' : 'accounts'])) continue;
    if (b.kind === 'entries') b.entries.forEach((e) => e.lines.forEach((l) => { const v = amountOf(l.debit ?? l.credit); if (v !== null) all.push(v); }));
    if (b.kind === 'schedule') b.rows.forEach((r) => { if ((r.format ?? 'money') === 'money') [r.amount, ...(r.amounts ?? [])].forEach((v) => { const n = amountOf(v); if (n !== null) all.push(n); }); });
    if (b.kind === 'taccounts') b.accounts.forEach((a) => [...a.debits, ...a.credits].forEach((p) => { const n = amountOf(p.amount); if (n !== null) all.push(n); }));
  }
  return all.every((v) => Math.abs(v - Math.round(v)) < 0.005) ? 0 : 2;
}

/** How a schedule cell prints. Strings (e.g. '?', TeX) are returned as-is. */
export function formatAmount(v: unknown, format: ScheduleRow['format'] = 'money', opts: { currency?: string; decimals?: number; symbol?: boolean } = {}): string {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v !== 'number') return String(v);
  switch (format) {
    case 'pct': return `${groupThousands(String(round(v * 100, 2)))}%`;
    case 'ratio': return groupThousands(round(v, 2).toFixed(2));
    case 'units':
    case 'number': return groupThousands(String(round(v, 4)));
    default: return opts.symbol === false
      ? (v < 0 ? '−' : '') + groupThousands(round(Math.abs(v), opts.decimals ?? 2).toFixed(opts.decimals ?? (Math.abs(v - Math.round(v)) < 0.005 ? 0 : 2)))
      : moneyText(v, opts.decimals, opts.currency ?? DEFAULT_CURRENCY);
  }
}

// ------------------------------------------------------------ grading journal-entry answers
export const normAccount = (s: string) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

export interface LearnerLine { account: string; debit: string; credit: string }
export interface ExpectedEntry { date?: string; prompt?: string; lines: { account: string; debit?: number | null; credit?: number | null }[] }

/** account → net amount (debit positive, credit negative). */
function netMap(lines: { account: string; debit?: number | null; credit?: number | null }[]): Map<string, { name: string; net: number }> {
  const m = new Map<string, { name: string; net: number }>();
  for (const l of lines) {
    const k = normAccount(l.account);
    if (!k) continue;
    const cur = m.get(k) ?? { name: l.account, net: 0 };
    cur.net += (l.debit ?? 0) - (l.credit ?? 0);
    m.set(k, cur);
  }
  return m;
}

export interface EntryCheck {
  score: number;
  feedback: string[];
  /** normalized account → verdict, for marking rows */
  marks: Record<string, 'ok' | 'side' | 'amount' | 'extra'>;
  missing: string[];
  balanced: boolean;
}

/**
 * Grade one entry. Accounts are matched case-insensitively, repeated accounts are netted, and
 * each expected account earns credit when it sits on the right side with the right amount.
 * Accounts that don't belong cost one line each. Score = max(0, (right − extra) / expected).
 */
export function checkJournalEntry(
  learner: LearnerLine[],
  expected: ExpectedEntry,
  opts: { tol?: number; relTol?: number; parse: (s: string) => number | null; money?: (n: number) => string },
): EntryCheck {
  const money = opts.money ?? ((n: number) => String(n));
  const tol = opts.tol ?? 0.01;
  const relTol = opts.relTol ?? 0.0005;
  const parsed = learner
    .filter((l) => normAccount(l.account) || String(l.debit).trim() || String(l.credit).trim())
    .map((l) => ({ account: l.account, debit: opts.parse(l.debit) ?? 0, credit: opts.parse(l.credit) ?? 0 }));
  const exp = netMap(expected.lines);
  const got = netMap(parsed);
  const feedback: string[] = [];
  const marks: EntryCheck['marks'] = {};
  const missing: string[] = [];
  let right = 0, reversed = 0;
  for (const [k, e] of exp) {
    const g = got.get(k);
    if (!g || Math.abs(g.net) < 1e-9) { missing.push(e.name); continue; }
    const sameSide = Math.sign(g.net) === Math.sign(e.net);
    if (!sameSide) { marks[k] = 'side'; reversed++; feedback.push(`**${e.name}** belongs on the **${e.net > 0 ? 'debit' : 'credit'}** side.`); continue; }
    if (withinTol(Math.abs(g.net), Math.abs(e.net), tol, relTol)) { marks[k] = 'ok'; right++; }
    else { marks[k] = 'amount'; feedback.push(`The amount for **${e.name}** is off (you have ${money(Math.abs(g.net))}).`); }
  }
  let extra = 0;
  for (const [k, g] of got) {
    if (exp.has(k) || Math.abs(g.net) < 1e-9) continue;
    marks[k] = 'extra';
    extra++;
    feedback.push(`**${g.name}** doesn't belong in this entry.`);
  }
  if (missing.length) feedback.push(`Missing: ${missing.map((m) => `**${m}**`).join(', ')}.`);
  if (reversed === exp.size && exp.size > 1) feedback.splice(0, feedback.length, 'Debits and credits are reversed: swap the sides of every line.');
  const dr = parsed.reduce((a, l) => a + l.debit, 0);
  const cr = parsed.reduce((a, l) => a + l.credit, 0);
  const isBalanced = Math.abs(dr - cr) <= Math.max(tol, 0.005);
  if (!isBalanced && parsed.length) feedback.push(`Your debits (${money(dr)}) don't equal your credits (${money(cr)}).`);
  const score = exp.size ? Math.max(0, (right - extra) / exp.size) : 0;
  return { score, feedback, marks, missing, balanced: isBalanced };
}
