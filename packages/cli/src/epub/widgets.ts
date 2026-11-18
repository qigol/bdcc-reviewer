/**
 * Static renderings of stage widgets for the EPUB. Only widgets that carry readable content are drawn
 * (text, tables, schedules, journals, formulas, code, images); interactive ones become a short note.
 * Charts become a data table: Kindle advises against SVG.
 */
import {
  formatAmount, formatValue, interpolate, parseCodeAnchors, resolveRefs, resolveJournal, paneDecimals,
  type Scope, type StageWidget, type JournalPane, type ResolvedJournalPane,
} from '@kodigo/schema';
import { esc, md, tex, type RenderLog, type TermHref } from './markdown';

export interface RenderCtx {
  log: RenderLog;
  termHref: TermHref;
  scope: Scope;
  labels: Record<string, string>;
  currency: string;
  /** asset path in the module → href inside the book (undefined when not shippable) */
  asset: (src: string) => string | undefined;
  /** count something left out of the book, by kind */
  skip: (kind: string) => void;
  /** turn a self-checking widget into a question with its answer at the back (absent: show the question only) */
  exercise?: (label: string, question: string, answer: string) => string;
}

/** Interpolate {=…} in Markdown, then render it. */
export function mdi(ctx: RenderCtx, text: unknown, inline = false): string {
  const r = interpolate(String(text ?? ''), ctx.scope, { mode: 'md', labels: ctx.labels });
  if (r.missing.length) ctx.skip(`unresolved {=${r.missing[0]}}`);
  return md(r.text, ctx, { inline });
}
/** Interpolate {=…} in TeX, then render it as display math. */
export function texi(ctx: RenderCtx, t: unknown): string {
  const r = interpolate(String(t ?? ''), ctx.scope, { mode: 'tex', labels: ctx.labels });
  if (r.missing.length) ctx.skip(`unresolved {=${r.missing[0]}}`);
  return tex(r.text, ctx.log);
}

export function codeBlock(source: string, lang?: string, title?: string): string {
  const clean = parseCodeAnchors(source ?? '', lang ?? 'python').code;
  return `${title ? `<p class="caption">${esc(title)}</p>` : ''}<pre class="code"><code>${esc(clean)}</code></pre>`;
}

const caption = (ctx: RenderCtx, t: unknown) => (t ? `<p class="caption">${mdi(ctx, t, true)}</p>` : '');
const interactive = (what: string) => `<p class="interactive">[${esc(what)}: interactive in Qdigo]</p>`;

function cellText(ctx: RenderCtx, v: unknown, format?: string): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return esc(formatValue(v, format, false, ctx.labels));
  if (typeof v === 'string') return mdi(ctx, v, true);
  if (Array.isArray(v)) return esc(v.map((x) => (typeof x === 'string' ? ctx.labels[x] ?? x : String(x))).join(', '));
  return esc(JSON.stringify(v));
}

export function table(head: string[] | undefined, rows: string[][], cls = ''): string {
  const h = head?.length ? `<thead><tr>${head.map((x) => `<th>${x}</th>`).join('')}</tr></thead>` : '';
  return `<table${cls ? ` class="${cls}"` : ''}>${h}<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

// ------------------------------------------------------------ accounting
export function scheduleTable(ctx: RenderCtx, p: { title?: string; columns?: string[]; rows: any[]; decimals?: number }, blanks?: (row: any, col: number) => string | undefined): string {
  const rows = Array.isArray(p.rows) ? p.rows : [];
  const nCols = Math.max(1, p.columns?.length ?? 0, ...rows.map((r) => (r.cells ?? r.amounts ?? [r.amount]).length));
  const body = rows.map((r) => {
    const cells: unknown[] = r.cells ?? r.amounts ?? [r.amount];
    const label = `<span class="indent${Math.min(3, r.indent ?? 0)}">${mdi(ctx, r.label, true)}</span>`;
    const amounts = Array.from({ length: nCols }, (_, i) => blanks?.(r, i) ?? esc(formatAmount(cells[i], r.format, { currency: ctx.currency, decimals: p.decimals })));
    return { cls: r.style ?? 'line', cells: [label, ...amounts] };
  });
  const head = p.columns?.length ? `<thead><tr><th></th>${p.columns.map((c) => `<th class="num">${esc(c)}</th>`).join('')}</tr></thead>` : '';
  return `${caption(ctx, p.title)}<table class="schedule">${head}<tbody>${body
    .map((r) => `<tr class="${esc(r.cls)}">${r.cells.map((c, i) => `<td${i ? ' class="num"' : ''}>${c}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>`;
}

export function journalTable(ctx: RenderCtx, p: { title?: string; entries: any[]; decimals?: number }): string {
  const entries = Array.isArray(p.entries) ? p.entries : [];
  const amt = (v: unknown) => esc(formatAmount(v, 'money', { currency: ctx.currency, decimals: p.decimals, symbol: false }));
  const rows: string[] = [];
  for (const e of entries) {
    (e.lines ?? []).forEach((l: any, i: number) => {
      const credit = l.credit !== undefined && l.credit !== null;
      rows.push(`<tr><td>${i === 0 ? esc(e.date ?? '') : ''}</td><td${credit ? ' class="credit"' : ''}>${esc(l.account)}</td><td class="num">${credit ? '' : amt(l.debit)}</td><td class="num">${credit ? amt(l.credit) : ''}</td></tr>`);
    });
    if (e.memo) rows.push(`<tr class="memo"><td></td><td colspan="3">${mdi(ctx, e.memo, true)}</td></tr>`);
  }
  return `${caption(ctx, p.title)}<table class="journal"><thead><tr><th>Date</th><th>Account</th><th class="num">Dr</th><th class="num">Cr</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
}

export function taccountsHtml(ctx: RenderCtx, p: { title?: string; accounts: any[]; decimals?: number; showBalance?: boolean }): string {
  const amt = (v: unknown) => esc(formatAmount(v, 'money', { currency: ctx.currency, decimals: p.decimals, symbol: false }));
  const out = (Array.isArray(p.accounts) ? p.accounts : []).map((a) => {
    const n = Math.max(a.debits?.length ?? 0, a.credits?.length ?? 0);
    const rows = Array.from({ length: n }, (_, i) => {
      const d = a.debits?.[i], c = a.credits?.[i];
      return [d ? `${amt(d.amount)}${d.ref ? ` <span class="muted">(${esc(d.ref)})</span>` : ''}` : '', c ? `${amt(c.amount)}${c.ref ? ` <span class="muted">(${esc(c.ref)})</span>` : ''}` : ''];
    });
    const sum = (l: any[] = []) => l.reduce((s, x) => s + (typeof x.amount === 'number' ? x.amount : 0), 0);
    const bal = sum(a.debits) - sum(a.credits);
    if ((a.showBalance ?? p.showBalance ?? true) && n) rows.push([bal >= 0 ? `<b>Bal. ${amt(bal)}</b>` : '', bal < 0 ? `<b>Bal. ${amt(-bal)}</b>` : '']);
    return `<table class="taccount"><thead><tr><th colspan="2">${esc(a.name)}</th></tr><tr><th>Dr</th><th>Cr</th></tr></thead><tbody>${rows.map((r) => `<tr><td class="num">${r[0]}</td><td class="num">${r[1]}</td></tr>`).join('')}</tbody></table>`;
  });
  return caption(ctx, p.title) + out.join('');
}

/** A resolved journal pane (Math & Journal sections). */
export function journalPane(ctx: RenderCtx, pane: JournalPane): string {
  const missing: string[] = [];
  const r: ResolvedJournalPane = resolveJournal(pane, ctx.scope, missing);
  const decimals = paneDecimals(r);
  const parts = r.blocks.map((b) => {
    if (b.kind === 'entries') return journalTable(ctx, { title: b.title, entries: b.entries, decimals });
    if (b.kind === 'schedule') return scheduleTable(ctx, { title: b.title, columns: b.columns, rows: b.rows, decimals });
    return taccountsHtml(ctx, { title: b.title, accounts: b.accounts, decimals });
  });
  return `${r.title ? `<p class="caption">${esc(r.title)}</p>` : ''}${parts.join('')}`;
}

// ------------------------------------------------------------ one stage widget
const CALLOUT_TITLE: Record<string, string> = { note: 'Note', tip: 'Tip', warn: 'Watch out', exam: 'Exam tip', errata: 'Errata', beyond: 'Beyond the slides', define: 'Definition' };

export function widgetHtml(ctx: RenderCtx, w: StageWidget): string {
  const missing: string[] = [];
  const p = resolveRefs(w.props ?? {}, ctx.scope, missing) as Record<string, any>;
  // bound props read their value from state
  for (const [prop, key] of Object.entries(w.bind ?? {})) if (ctx.scope[key] !== undefined) p[prop] = ctx.scope[key];
  try {
    switch (w.widget) {
      case 'Text': return `<div class="stage-text">${mdi(ctx, p.body)}</div>`;
      case 'Callout': {
        const kind = String(p.kind ?? 'note');
        return `<div class="callout ${esc(kind)}"><p class="callout-title">${esc(p.title ?? CALLOUT_TITLE[kind] ?? 'Note')}</p>${mdi(ctx, p.body)}</div>`;
      }
      case 'Readout': {
        const items = Array.isArray(p.items) ? p.items : [];
        return table(undefined, items.map((it: any) => [`${esc(it.label)}`, `<b>${cellText(ctx, it.value, it.format)}</b>`]), 'readout');
      }
      case 'Schedule': return scheduleTable(ctx, { title: p.title, columns: p.columns, rows: p.rows, decimals: p.decimals });
      case 'Journal': return journalTable(ctx, { title: p.title, entries: p.entries, decimals: p.decimals });
      case 'TAccounts': return taccountsHtml(ctx, { title: p.title, accounts: p.accounts, decimals: p.decimals, showBalance: p.showBalance });
      case 'Formula': {
        const steps: string[] = Array.isArray(p.steps) ? p.steps : [];
        const t = p.tex ?? (steps.length ? steps[steps.length - 1] : '');
        return texi(ctx, t);
      }
      case 'Code': return codeBlock(String(p.source ?? ''), p.lang, p.title);
      case 'Matrix': {
        const d = p.data ?? {};
        const rows: string[] = p.rows ?? d.rows ?? [];
        const cols: string[] = p.cols ?? d.cols ?? [];
        const values: any[][] = p.values ?? d.values ?? [];
        const lab = (x: string) => esc(ctx.labels[x] ?? d.labels?.[x] ?? x);
        const fmt = (v: any) => (v === null || v === undefined ? esc(p.emptyLabel ?? '') : typeof v === 'number' ? esc(formatValue(v, String(p.format ?? 2), false)) : texi(ctx, v).replace(/^<div class="math">|<\/div>$/g, ''));
        return `${caption(ctx, p.title)}${table([esc(p.rowHeader ?? ''), ...cols.map(lab)], rows.map((r, i) => [`<b>${lab(r)}</b>`, ...cols.map((_, j) => fmt(values[i]?.[j]))]), 'matrix')}`;
      }
      case 'TransactionTable': {
        const tx: any[] = Array.isArray(p.transactions) ? p.transactions : p.transactions?.transactions ?? [];
        return `${caption(ctx, p.title)}${table(['ID', 'Items'], tx.map((t) => [esc(t.id), esc((t.items ?? []).map((i: string) => ctx.labels[i] ?? i).join(', '))]), 'transactions')}`;
      }
      case 'Chart': {
        const series: any[] = (Array.isArray(p.series) ? p.series : []).filter((s) => Array.isArray(s?.y));
        if (!series.length) return '';
        const title = caption(ctx, p.title ?? (p.yLabel ? `${p.yLabel}${p.xLabel ? ` by ${p.xLabel}` : ''}` : 'Chart data'));
        // long series are sampled to about 20 rows, keeping the first and last point
        const MAX = 20;
        const xsOf = (s: any) => (Array.isArray(s.x) ? s.x : s.y.map((_: unknown, i: number) => i + 1));
        const chartTable = (group: any[]) => {
          const xs = xsOf(group[0]);
          const n = Math.max(...group.map((s) => s.y.length));
          const idx = n <= MAX ? Array.from({ length: n }, (_, i) => i) : [...new Set(Array.from({ length: MAX }, (_, k) => Math.round((k * (n - 1)) / (MAX - 1))))];
          const head = [esc(p.xLabel ?? 'x'), ...group.map((s) => esc(s.name ?? p.yLabel ?? 'y'))];
          const rows = idx.map((i) => [cellText(ctx, xs[i]), ...group.map((s) => cellText(ctx, s.y[i]))]);
          if (n > MAX) rows.push([`<span class="muted">${idx.length} of ${n} points shown</span>`, ...group.map(() => '')]);
          return table(head, rows, 'chart');
        };
        // series that share x values share a table; the others get one each
        const groups = new Map<string, any[]>();
        for (const s of series) {
          const key = JSON.stringify(xsOf(s));
          groups.set(key, [...(groups.get(key) ?? []), s]);
        }
        return title + [...groups.values()].map(chartTable).join('');
      }
      case 'Image': {
        const href = ctx.asset(String(p.src ?? ''));
        if (!href) { ctx.skip('Image (format)'); return ''; }
        return `<figure><img src="${esc(href)}" alt="${esc(p.alt ?? '')}" />${p.caption ? `<figcaption>${mdi(ctx, p.caption, true)}</figcaption>` : ''}</figure>`;
      }
      case 'Animation': {
        const href = p.poster ? ctx.asset(String(p.poster)) : undefined;
        ctx.skip('Animation');
        if (!href) return interactive(`Animation: ${p.alt ?? ''}`);
        return `<figure><img src="${esc(href)}" alt="${esc(p.alt ?? '')}" /><figcaption>${p.caption ? mdi(ctx, p.caption, true) : esc(p.alt ?? '')} (animated in Qdigo)</figcaption></figure>`;
      }
      case 'DropBins': {
        const chips: any[] = Array.isArray(p.chips) ? p.chips : [];
        const bins: any[] = Array.isArray(p.bins) ? p.bins : [];
        if (!chips.length || !bins.length) return '';
        const binLabel = new Map(bins.map((b) => [b.id, mdi(ctx, b.label, true)]));
        const q = `<p class="muted">Sort each item into one of: ${bins.map((b) => `<b>${binLabel.get(b.id)}</b>`).join(' · ')}</p>${table(undefined, chips.map((c) => [mdi(ctx, c.label, true), '______']), 'sort')}`;
        const sol = p.solution as Record<string, string> | undefined;
        if (!sol || !ctx.exercise) return q;
        const a = table(undefined, chips.map((c) => [mdi(ctx, c.label, true), `<b>${binLabel.get(sol[c.id]) ?? '?'}</b>`]), 'sort');
        return ctx.exercise('Sort it', q, a);
      }
      case 'Tree': {
        const node = (n: any, depth: number): string =>
          depth > 12 || !n ? '' : `<li>${mdi(ctx, n.label, true)}${n.note ? ` <span class="muted">${mdi(ctx, n.note, true)}</span>` : ''}${Array.isArray(n.children) && n.children.length ? `<ul>${n.children.map((c: any) => node(c, depth + 1)).join('')}</ul>` : ''}</li>`;
        return p.root ? `<ul class="tree">${node(p.root, 0)}</ul>` : '';
      }
      case 'MatrixProduct': {
        const m = (x: any) => ({ rows: x?.rows ?? [], cols: x?.cols ?? [], values: x?.values ?? x ?? [] });
        const U = m(p.U), V = m(p.V);
        const grid = (title: string, rows: string[], cols: string[], values: any[][]) =>
          `${caption(ctx, title)}${table(['', ...cols.map(esc)], values.map((r, i) => [`<b>${esc(rows[i] ?? i + 1)}</b>`, ...r.map((v) => (typeof v === 'number' ? esc(formatValue(v, String(p.format ?? 2), false)) : v === null || v === undefined ? '' : texi(ctx, v).replace(/^<div class="math">|<\/div>$/g, '')))]), 'matrix')}`;
        const parts = [grid('U', U.rows, U.cols, U.values), grid('V', V.rows, V.cols, V.values)];
        const numeric = [...U.values, ...V.values].every((r: any[]) => Array.isArray(r) && r.every((v) => typeof v === 'number'));
        if (numeric && U.values[0]?.length === V.values.length) {
          const P = U.values.map((r: number[]) => V.values[0].map((_: number, j: number) => r.reduce((s, u, k) => s + u * V.values[k][j], 0)));
          parts.push(grid('P = U × V', U.rows, V.cols, P));
        }
        if (p.R) { const R = m(p.R); parts.push(grid('R (ratings)', R.rows, R.cols, R.values)); }
        return parts.join('');
      }
      case 'RankList': {
        const items: any[] = Array.isArray(p.items) ? p.items : [];
        const byId = new Map(items.map((i) => [i.id, i]));
        const order: string[] = Array.isArray(p.order) ? p.order : items.map((i) => i.id);
        const rel = p.showRelevance && p.relevance ? (id: string) => ` <span class="muted">(relevance ${esc(p.relevance[id])})</span>` : () => '';
        return `<ol class="rank">${order.map((id) => `<li>${mdi(ctx, byId.get(id)?.label ?? id, true)}${rel(id)}</li>`).join('')}</ol>`;
      }
      // inputs and players: their effect shows in the other widgets
      case 'Slider': case 'Choice': case 'StepPlayer':
        ctx.skip(w.widget);
        return '';
      default:
        ctx.skip(w.widget);
        return interactive(w.widget);
    }
  } catch {
    ctx.skip(`${w.widget} (error)`);
    return interactive(w.widget);
  }
}
