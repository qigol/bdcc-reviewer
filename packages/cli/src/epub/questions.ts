/**
 * Quiz instances → printable questions, with the worked answer for the Answers chapter.
 * The instance's own scope fills {=…} in its texts, as in the web quiz runner.
 */
import { groupThousands, round } from '@kodigo/sdk';
import { formatAmount, type QuizInstance, type NumericSpec } from '@kodigo/schema';
import { esc } from './markdown';
import { mdi, scheduleTable, table, type RenderCtx, widgetHtml } from './widgets';

export interface RenderedQuestion { question: string; answer: string }

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const letter = (i: number) => LETTERS[i] ?? String(i + 1);

export function numText(spec: NumericSpec | undefined): string {
  if (!spec || typeof spec.value !== 'number') return '?';
  const v = spec.value;
  if (spec.percent) return `${groupThousands(String(round(v, 4)))}%`;
  return groupThousands(String(round(v, Math.abs(v) >= 100 ? 2 : 4)));
}

const optionList = (ctx: RenderCtx, opts: string[] = [], code = false) =>
  `<ol class="options">${opts.map((o, i) => `<li><span class="letter">${letter(i)}.</span> ${code ? `<code>${esc(o)}</code>` : mdi(ctx, o, true)}</li>`).join('')}</ol>`;

const writeIn = '<p class="blank">Answer: ______________</p>';

function body(ctx: RenderCtx, q: QuizInstance, skip: (k: string) => void): RenderedQuestion {
  const show = (q.show ?? []).filter((w) => !w.hidden).map((w) => widgetHtml(ctx, w)).join('');
  const prompt = mdi(ctx, q.prompt) + show;
  const explanation = q.explanation ? `<div class="explanation">${mdi(ctx, q.explanation)}</div>` : '';
  const pick = (i: number | undefined, opts?: string[]) =>
    i === undefined || !opts ? '?' : `<b>${letter(i)}.</b> ${mdi(ctx, opts[i], true)}`;
  switch (q.type) {
    case 'mcq':
      return { question: prompt + optionList(ctx, q.options), answer: `<p>${pick(q.answer as number, q.options)}</p>${explanation}` };
    case 'multi': {
      const ans = (Array.isArray(q.answer) ? q.answer : []).map((i) => pick(i, q.options)).join('<br />');
      return { question: `${prompt}<p class="muted">Choose all that apply.</p>${optionList(ctx, q.options)}`, answer: `<p>${ans}</p>${explanation}` };
    }
    case 'numeric': {
      const est = q.estimate ? `<p class="muted">First estimate: ${mdi(ctx, q.estimate.prompt, true)}</p>${optionList(ctx, q.estimate.options)}` : '';
      const estAns = q.estimate ? `<p>Estimate: ${pick(q.estimate.answer, q.estimate.options)}</p>` : '';
      return { question: prompt + est + writeIn, answer: `${estAns}<p><b>${esc(numText(q.numeric))}</b></p>${explanation}` };
    }
    case 'hand-calc': {
      const steps = q.steps ?? [];
      return {
        question: `${prompt}<ol class="steps">${steps.map((s) => `<li>${mdi(ctx, s.prompt, true)} ______</li>`).join('')}</ol>`,
        answer: `<ol class="steps">${steps.map((s) => `<li>${mdi(ctx, s.prompt, true)} <b>${esc(numText(s.numeric))}</b></li>`).join('')}</ol>${explanation}`,
      };
    }
    case 'two-tier':
      return {
        question: `${prompt}${optionList(ctx, q.options)}<p>${mdi(ctx, q.reasonPrompt ?? 'Because…', true)}</p>${optionList(ctx, q.reasons)}`,
        answer: `<p>${pick(q.answer as number, q.options)}</p><p>Reason: ${pick(q.reasonAnswer, q.reasons)}</p>${explanation}`,
      };
    case 'find-error': {
      const lines = q.lines ?? [];
      const list = `<ol class="steps">${lines.map((l) => `<li>${q.codeLines ? `<code>${esc(l)}</code>` : mdi(ctx, l, true)}</li>`).join('')}</ol>`;
      const fixQ = q.fix ? `<p>${mdi(ctx, q.fixPrompt ?? 'What should that step give?', true)}</p>${writeIn}` : '';
      const fixA = q.fix ? `<p>Corrected value: <b>${esc(numText(q.fix))}</b></p>` : '';
      return { question: `${prompt}<p class="muted">Which step is wrong?</p>${list}${fixQ}`, answer: `<p>Step <b>${(q.wrong ?? 0) + 1}</b> is wrong.</p>${fixA}${explanation}` };
    }
    case 'explain':
      return {
        question: `${prompt}<p class="blank">Write your answer, then compare it with the model answer.</p>`,
        answer: `<div class="model">${mdi(ctx, q.model)}</div><p class="muted">Did you cover:</p><ul>${(q.checklist ?? []).map((c) => `<li>${mdi(ctx, c, true)}</li>`).join('')}</ul>${explanation}`,
      };
    case 'code-fill': {
      const isText = q.lang === 'text';
      const src = (q.code ?? '').replace(/\n+$/, '');
      const filled = (fill: (n: string) => string) => src.replace(/__BLANK_(\d+)__/g, (_, n) => fill(n));
      const accept = (n: string) => q.blanks?.[n]?.accept?.[0] ?? q.blanks?.[n]?.regex ?? '?';
      const render = (s: string) => (isText ? mdi(ctx, s) : `<pre class="code"><code>${esc(s)}</code></pre>`);
      return {
        question: prompt + render(filled((n) => `___(${n})___`)),
        answer: `<ol class="blanks">${Object.keys(q.blanks ?? {}).sort((a, b) => Number(a) - Number(b)).map((n) => `<li value="${esc(n)}"><code>${esc(accept(n))}</code></li>`).join('')}</ol>${isText ? '' : render(filled(accept))}${explanation}`,
      };
    }
    case 'match': {
      const pairs = q.pairs ?? [];
      const right = q.rightOrder ?? pairs.map((_, i) => i);
      const rows = pairs.map((p, i) => [`${i + 1}. ${mdi(ctx, p[0], true)}`, `${letter(i)}. ${mdi(ctx, pairs[right[i]][1], true)}`]);
      const key = pairs.map((_, i) => `${i + 1} → ${letter(right.indexOf(i))}`).join(' · ');
      return { question: `${prompt}<p class="muted">Match each item on the left with one on the right.</p>${table(undefined, rows, 'match')}`, answer: `<p><b>${esc(key)}</b></p>${explanation}` };
    }
    case 'order': {
      const items = q.items ?? [];
      const order = q.startOrder ?? items.map((_, i) => i);
      const n = q.nCorrect ?? items.length;
      const line = (s: string) => (q.codeLines ? `<code>${esc(s)}</code>` : mdi(ctx, s, true));
      const extra = n < items.length ? '<p class="muted">Some lines do not belong.</p>' : '';
      const ans = Array.from({ length: n }, (_, i) => letter(order.indexOf(i))).join(', ');
      return {
        question: `${prompt}<p class="muted">Put these in order.</p>${extra}<ol class="options">${order.map((k, i) => `<li><span class="letter">${letter(i)}.</span> ${line(items[k])}</li>`).join('')}</ol>`,
        answer: `<p><b>${esc(ans)}</b></p><ol class="steps">${items.slice(0, n).map((s) => `<li>${line(s)}</li>`).join('')}</ol>${explanation}`,
      };
    }
    case 'schedule-fill': {
      const s = q.schedule;
      if (!s) break;
      const blank = (r: any, i: number) => (r.blank && !r.given?.includes(i) ? '______' : undefined);
      const sched = (b?: typeof blank) => scheduleTable(ctx, { columns: s.columns, rows: s.rows }, b);
      return { question: prompt + sched(blank), answer: sched() + explanation };
    }
    case 'journal-entry': {
      const entries = q.entries ?? [];
      const amt = (v: number | null | undefined) => (v === null || v === undefined ? '' : esc(formatAmount(v, 'money', { currency: ctx.currency, symbol: false })));
      const accounts = q.accounts?.length ? `<p class="muted">Accounts: ${esc(q.accounts.join(' · '))}</p>` : '';
      const prompts = entries.map((e, i) => (e.prompt || e.date ? `<p>${i + 1}. ${e.date ? `${esc(e.date)}: ` : ''}${mdi(ctx, e.prompt ?? '', true)}</p>` : '')).join('');
      const rows: string[] = [];
      for (const e of entries) e.lines.forEach((l, i) => {
        const cr = l.credit !== null && l.credit !== undefined;
        rows.push(`<tr><td>${i === 0 ? esc(e.date ?? '') : ''}</td><td${cr ? ' class="credit"' : ''}>${esc(l.account)}</td><td class="num">${cr ? '' : amt(l.debit)}</td><td class="num">${cr ? amt(l.credit) : ''}</td></tr>`);
      });
      return {
        question: `${prompt}${prompts}${accounts}<p class="blank">Write the journal entr${entries.length > 1 ? 'ies' : 'y'}.</p>`,
        answer: `<table class="journal"><thead><tr><th>Date</th><th>Account</th><th class="num">Dr</th><th class="num">Cr</th></tr></thead><tbody>${rows.join('')}</tbody></table>${explanation}`,
      };
    }
    case 'case': {
      const parts = (q.parts ?? []).map((p) => {
        const pctx = { ...ctx, scope: p.scope };
        return body(pctx, p, skip);
      });
      return {
        question: `${prompt}${parts.map((p, i) => `<div class="part"><p class="part-label">Part ${i + 1}</p>${p.question}</div>`).join('')}`,
        answer: `${parts.map((p, i) => `<div class="part"><p class="part-label">Part ${i + 1}</p>${p.answer}</div>`).join('')}${explanation}`,
      };
    }
  }
  skip(`question: ${q.type}`);
  return { question: prompt, answer: explanation || '<p>See Qdigo.</p>' };
}

export function renderQuestion(ctx: RenderCtx, q: QuizInstance): RenderedQuestion {
  return body({ ...ctx, scope: q.scope }, q, ctx.skip);
}
