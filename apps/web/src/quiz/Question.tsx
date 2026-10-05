import { useMemo, useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { BookOpen, Check, GripVertical, Lightbulb, Plus, X } from 'lucide-react';
import { checkBlank, checkMatch, checkMcq, checkMulti, checkNumeric, checkOrder, checkJournalEntry, parseNumber, normAccount, DEFAULT_CURRENCY, type QuizInstance, type NumericSpec } from '@kodigo/schema';
import { frac, moneyText } from '@kodigo/sdk';
import { EntriesView, ScheduleView } from '../widgets/accounting';
import { GlossaryProvider } from '../lib/md';
import type { LoadedModule } from '../modules/store';
import { StageProvider, Stage } from '../engine/Stage';
import { Markdown } from '../lib/md';
import { cn } from '../lib/util';
import { usePopup } from '../lib/popup';
import { fmtNum } from '../widgets/common';

export interface Graded { score: number; correct: boolean; response: unknown; feedback: string[] }

export function emptyResponse(inst: QuizInstance): any {
  switch (inst.type) {
    case 'mcq': return null;
    case 'multi': return [];
    case 'numeric': return '';
    case 'code-fill': return {};
    case 'match': return inst.rightOrder!.slice();
    case 'order': return inst.startOrder!.slice();
    case 'hand-calc': return { inputs: inst.steps!.map(() => ''), revealed: inst.steps!.map(() => false), tries: inst.steps!.map(() => 0), done: inst.steps!.map(() => false), hints: inst.steps!.map(() => false) };
    case 'journal-entry': return { entries: inst.entries!.map(() => [emptyLine(), emptyLine()]) };
    case 'schedule-fill': return { cells: {} as Record<string, string> };
  }
}

const emptyLine = () => ({ account: '', debit: '', credit: '' });
const parseAmount = (s: string) => parseNumber(s, ['decimal']);

/** Each blank cell of a schedule-fill question as a numeric spec. */
function scheduleBlanks(inst: QuizInstance): { key: string; spec: NumericSpec }[] {
  const out: { key: string; spec: NumericSpec }[] = [];
  inst.schedule?.rows.forEach((r, i) => {
    if (!r.blank) return;
    r.cells.forEach((v, j) => {
      if (typeof v !== 'number') return;
      out.push({ key: `${i}:${j}`, spec: { value: v, tol: r.tol ?? inst.amountTol?.tol ?? 0.01, relTol: inst.amountTol?.relTol, accept: r.format === 'pct' ? ['decimal', 'fraction', 'percent'] : ['decimal', 'fraction'] } });
    });
  });
  return out;
}

export function moneyOf(inst: QuizInstance, currency?: string) {
  return (n: number) => moneyText(n, undefined, currency ?? DEFAULT_CURRENCY);
}

export function grade(inst: QuizInstance, r: any): Graded {
  const fb: string[] = [];
  switch (inst.type) {
    case 'mcq': {
      const s = checkMcq(r, inst.answer as number);
      if (r !== null && inst.optionFeedback?.[r]) fb.push(inst.optionFeedback[r]);
      return { score: s, correct: s === 1, response: r, feedback: fb };
    }
    case 'multi': {
      const s = checkMulti(r, inst.answer as number[]);
      return { score: s, correct: s === 1, response: r, feedback: fb };
    }
    case 'numeric': {
      const res = checkNumeric(r, inst.numeric!, inst.misconceptions);
      if (res.feedback) fb.push(res.feedback);
      return { score: res.score, correct: res.correct, response: r, feedback: fb };
    }
    case 'code-fill': {
      const keys = Object.keys(inst.blanks!);
      const ok = keys.filter((k) => checkBlank(r[k] ?? '', inst.blanks![k]));
      const s = ok.length / Math.max(1, keys.length);
      return { score: s, correct: s === 1, response: r, feedback: fb };
    }
    case 'match': {
      const s = checkMatch(r);
      return { score: s, correct: s === 1, response: r, feedback: fb };
    }
    case 'order': {
      const s = checkOrder(r);
      return { score: s, correct: s === 1, response: r, feedback: fb };
    }
    case 'hand-calc': {
      const steps = inst.steps!;
      const scores = steps.map((st, i) => {
        if (r.revealed[i]) return 0;
        const res = checkNumeric(r.inputs[i], st.numeric, st.misconceptions);
        if (!res.correct) return 0;
        const base = r.tries[i] > 1 ? 0.5 : 1;
        return r.hints[i] ? base * 0.75 : base;
      });
      const s = scores.reduce((a: number, b: number) => a + b, 0) / steps.length;
      return { score: s, correct: s === 1, response: r, feedback: fb };
    }
    case 'journal-entry': {
      const exp = inst.entries!;
      const checks = exp.map((e, k) => checkJournalEntry(r.entries[k] ?? [], e, { tol: inst.amountTol?.tol, relTol: inst.amountTol?.relTol, parse: parseAmount, money: moneyOf(inst) }));
      checks.forEach((c, k) => c.feedback.forEach((f) => fb.push(exp.length > 1 ? `Entry ${k + 1}: ${f}` : f)));
      const s = checks.reduce((a, c) => a + c.score, 0) / Math.max(1, checks.length);
      return { score: s, correct: s === 1, response: r, feedback: fb };
    }
    case 'schedule-fill': {
      const blanks = scheduleBlanks(inst);
      const ok = blanks.filter((b) => checkNumeric(r.cells[b.key] ?? '', b.spec).correct).length;
      const s = ok / Math.max(1, blanks.length);
      if (s < 1 && ok > 0) fb.push(`${ok} of ${blanks.length} amounts are right.`);
      return { score: s, correct: s === 1, response: r, feedback: fb };
    }
  }
  return { score: 0, correct: false, response: r, feedback: fb };
}

function numText(v: number) {
  const f = frac(v, 12);
  const d = fmtNum(v, 4);
  return f.includes('/') ? `${d} (= ${f})` : d;
}

function SortRow({ id, children, locked, tone }: { id: string; children: React.ReactNode; locked: boolean; tone?: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: locked });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn('flex items-center gap-2 rounded-lg border bg-panel px-3 py-2 text-sm', tone ? `tone-${tone} mark-bg` : 'border-line', isDragging && 'z-10 shadow-lg')}>
      {!locked && <button aria-label="drag" className="cursor-grab text-muted" {...attributes} {...listeners}><GripVertical size={15} /></button>}
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}

function Sortable({ ids, onMove, render, locked, toneOf }: { ids: string[]; onMove: (from: number, to: number) => void; render: (id: string, i: number) => React.ReactNode; locked: boolean; toneOf?: (id: string, i: number) => string | undefined }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onDragEnd = (e: DragEndEvent) => { if (e.over && e.active.id !== e.over.id) onMove(ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id))); };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ol className="flex flex-col gap-1.5">{ids.map((id, i) => <SortRow key={id} id={id} locked={locked} tone={toneOf?.(id, i)}>{render(id, i)}</SortRow>)}</ol>
      </SortableContext>
    </DndContext>
  );
}

export function QuestionView({ inst, mod, response, setResponse, graded, reveal, practice }: {
  inst: QuizInstance; mod: LoadedModule; response: any; setResponse: (r: any) => void; graded: Graded | null; reveal: boolean; practice: boolean;
}) {
  const locked = !!graded;
  const popup = usePopup();
  const [hintsShown, setHintsShown] = useState(0);
  const hints = inst.hints ?? [];
  const extraScope = useMemo(() => inst.scope, [inst]);
  const lessonHref = inst.lessonRef ? `/m/${inst.moduleId}/${inst.lessonRef.tab}${inst.lessonRef.tab === 'application' ? '' : `/${inst.lessonRef.id}`}` : null;
  // Open the lesson in a popup over the quiz instead of navigating away (which used to wipe quiz progress).
  const openLesson = () => lessonHref && popup.open({ title: `Lesson · ${mod.parsed.manifest.shortTitle}`, src: lessonHref, note: 'Your quiz stays open underneath' });
  return (
    <GlossaryProvider terms={mod.parsed.glossary}>
    <StageProvider mod={mod} spec={{}} state={{}} extraScope={extraScope}>
      <div className="flex flex-col gap-3">
        <Markdown text={inst.prompt} className="text-[15px]" />
        {inst.show?.length ? <Stage widgets={inst.show} /> : null}

        {inst.type === 'mcq' && (
          <div className="grid gap-1.5" role="radiogroup">
            {inst.options!.map((o, i) => {
              const right = reveal && i === inst.answer;
              const wrong = reveal && response === i && i !== inst.answer;
              return (
                <button key={i} role="radio" aria-checked={response === i} disabled={locked} onClick={() => setResponse(i)}
                  className={cn('flex items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm transition', right ? 'tone-good mark-bg' : wrong ? 'tone-bad mark-bg' : response === i ? 'border-accent bg-accent/10' : 'border-line bg-panel hover:border-accent/50')}>
                  <span className={cn('mt-0.5 h-4 w-4 shrink-0 rounded-full border-2', response === i ? 'border-accent bg-accent' : 'border-line')} />
                  <Markdown text={o} inline />
                </button>
              );
            })}
          </div>
        )}

        {inst.type === 'multi' && (
          <div className="grid gap-1.5">
            <div className="text-xs text-muted">Select all that apply.</div>
            {inst.options!.map((o, i) => {
              const on = (response as number[]).includes(i);
              const isAns = (inst.answer as number[]).includes(i);
              return (
                <button key={i} role="checkbox" aria-checked={on} disabled={locked} onClick={() => setResponse(on ? response.filter((x: number) => x !== i) : [...response, i])}
                  className={cn('flex items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm transition', reveal && isAns ? 'tone-good mark-bg' : reveal && on && !isAns ? 'tone-bad mark-bg' : on ? 'border-accent bg-accent/10' : 'border-line bg-panel hover:border-accent/50')}>
                  <span className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2', on ? 'border-accent bg-accent text-white' : 'border-line')}>{on && <Check size={11} />}</span>
                  <Markdown text={o} inline />
                </button>
              );
            })}
          </div>
        )}

        {inst.type === 'numeric' && (
          <div className="flex flex-wrap items-center gap-2">
            <input className="input w-48 font-mono" aria-label="answer" value={response} disabled={locked} onChange={(e) => setResponse(e.target.value)} placeholder="e.g. 0.67 or 2/3" inputMode="decimal" />
            <span className="text-xs text-muted">accepts {inst.numeric!.accept.join(', ')} · tolerance ±{inst.numeric!.tol}</span>
            {reveal && <span className="ml-auto rounded-lg bg-good/10 px-2 py-1 text-sm">Answer: <b className="font-mono">{numText(inst.numeric!.value)}</b></span>}
          </div>
        )}

        {inst.type === 'code-fill' && <CodeFill inst={inst} response={response} setResponse={setResponse} locked={locked} reveal={reveal} />}

        {inst.type === 'match' && (
          <div className="grid grid-cols-2 gap-2">
            <ol className="flex flex-col gap-1.5">
              {inst.pairs!.map((p, i) => <li key={i} className="flex min-h-[42px] items-center rounded-lg border border-line bg-panel2 px-3 py-2 text-sm font-medium"><Markdown text={p[0]} inline /></li>)}
            </ol>
            <Sortable ids={(response as number[]).map(String)} locked={locked} onMove={(a, b) => setResponse(arrayMove(response, a, b))}
              toneOf={(id, i) => (reveal ? (Number(id) === i ? 'good' : 'bad') : undefined)}
              render={(id) => <Markdown text={inst.pairs![Number(id)][1]} inline />} />
            <div className="col-span-2 text-xs text-muted">Drag the right-hand cards so each lines up with its partner.</div>
          </div>
        )}

        {inst.type === 'order' && (
          <div>
            <Sortable ids={(response as number[]).map(String)} locked={locked} onMove={(a, b) => setResponse(arrayMove(response, a, b))}
              toneOf={(id, i) => (reveal ? (Number(id) === i ? 'good' : 'bad') : undefined)}
              render={(id, i) => <span className="flex gap-2"><b className="text-muted">{i + 1}.</b><Markdown text={inst.items![Number(id)]} inline /></span>} />
            <div className="mt-1 text-xs text-muted">Drag into the correct order (top = first).</div>
            {reveal && !graded?.correct && <ol className="mt-2 list-decimal pl-5 text-sm text-good">{inst.items!.map((it, i) => <li key={i}><Markdown text={it} inline /></li>)}</ol>}
          </div>
        )}

        {inst.type === 'hand-calc' && <HandCalc inst={inst} response={response} setResponse={setResponse} locked={locked} practice={practice} reveal={reveal} />}

        {inst.type === 'journal-entry' && <JournalEntryInput inst={inst} mod={mod} response={response} setResponse={setResponse} locked={locked} reveal={reveal} />}

        {inst.type === 'schedule-fill' && <ScheduleFill inst={inst} mod={mod} response={response} setResponse={setResponse} locked={locked} reveal={reveal} />}

        {practice && !reveal && hints.length > 0 && (
          <div className="flex flex-col gap-1.5" data-testid="hints">
            {hints.slice(0, hintsShown).map((h, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg bg-warn/10 px-3 py-1.5 text-sm"><Lightbulb size={14} className="mt-0.5 shrink-0 text-warn" /><Markdown text={h} /></div>
            ))}
            {hintsShown < hints.length && (
              <button className="btn-ghost btn-sm self-start" onClick={() => setHintsShown(hintsShown + 1)} data-testid="hint-button"><Lightbulb size={13} /> {hintsShown ? 'Another hint' : 'Hint'} ({hintsShown + 1}/{hints.length})</button>
            )}
          </div>
        )}

        {reveal && graded && (
          <div className={cn('rounded-xl border p-3', graded.correct ? 'border-good/50 bg-good/5' : graded.score > 0 ? 'border-warn/50 bg-warn/5' : 'border-bad/40 bg-bad/5')} data-testid="feedback">
            <div className="mb-1 flex items-center gap-1.5 font-semibold">
              {graded.correct ? <><Check size={16} className="text-good" /> Correct</> : graded.score > 0 ? <>Partly right · {Math.round(graded.score * 100)}%</> : <><X size={16} className="text-bad" /> Not quite</>}
            </div>
            {graded.feedback.map((f, i) => <Markdown key={i} text={f} className="mb-1 text-sm font-medium text-warn" />)}
            <Markdown text={inst.explanation} className="text-sm" />
            {lessonHref && <button onClick={openLesson} className="mt-2 inline-flex items-center gap-1 text-sm text-accent underline"><BookOpen size={13} /> Show me in the lesson</button>}
          </div>
        )}
        {!reveal && practice && lessonHref && (
          <button className="inline-flex items-center gap-1 self-start text-xs text-muted underline hover:text-accent" onClick={openLesson} title="Opens the lesson in a popup; your answers stay put" data-testid="nudge"><BookOpen size={12} /> Need a nudge?</button>
        )}
      </div>
    </StageProvider>
    </GlossaryProvider>
  );
}

// ------------------------------------------------------------ journal-entry
function JournalEntryInput({ inst, mod, response, setResponse, locked, reveal }: { inst: QuizInstance; mod: LoadedModule; response: any; setResponse: (r: any) => void; locked: boolean; reveal: boolean }) {
  const currency = mod.parsed.manifest.currency;
  const money = moneyOf(inst, currency);
  const upd = (k: number, fn: (lines: any[]) => any[]) => { const r = structuredClone(response); r.entries[k] = fn(r.entries[k]); setResponse(r); };
  return (
    <div className="flex flex-col gap-3" data-testid="journal-entry">
      {inst.entries!.map((exp, k) => {
        const lines = response.entries[k] as { account: string; debit: string; credit: string }[];
        const check = reveal ? checkJournalEntry(lines, exp, { tol: inst.amountTol?.tol, relTol: inst.amountTol?.relTol, parse: parseAmount, money }) : null;
        const dr = lines.reduce((a, l) => a + (parseAmount(l.debit) ?? 0), 0);
        const cr = lines.reduce((a, l) => a + (parseAmount(l.credit) ?? 0), 0);
        const anything = lines.some((l) => l.debit.trim() || l.credit.trim());
        return (
          <div key={k} className="rounded-xl border border-line bg-panel p-3">
            {(inst.entries!.length > 1 || exp.prompt || exp.date) && (
              <div className="mb-2 flex gap-2 text-sm">{inst.entries!.length > 1 && <b>Entry {k + 1}</b>}{exp.date && <span className="text-muted">{exp.date}</span>}{exp.prompt && <Markdown text={exp.prompt} inline />}</div>
            )}
            <table className="w-full border-collapse text-sm tabular-nums">
              <thead><tr className="text-left text-[11px] uppercase tracking-wide text-muted"><th className="pb-1 font-medium">Account</th><th className="w-32 pb-1 pl-2 text-right font-medium">Debit</th><th className="w-32 pb-1 pl-2 text-right font-medium">Credit</th><th className="w-8" /></tr></thead>
              <tbody>
                {lines.map((l, i) => {
                  const verdict = check?.marks[normAccount(l.account)];
                  const tone = verdict === 'ok' ? 'tone-good mark-bg' : verdict === 'side' || verdict === 'amount' ? 'tone-warn mark-bg' : verdict === 'extra' ? 'tone-bad mark-bg' : undefined;
                  const isCredit = !l.debit.trim() && !!l.credit.trim();
                  return (
                    <tr key={i} className={tone}>
                      <td className="py-0.5 pr-2">
                        <select className={cn('input w-full py-1', isCredit && 'pl-8')} aria-label={`entry ${k + 1} line ${i + 1} account`} value={l.account} disabled={locked}
                          onChange={(e) => upd(k, (ls) => { ls[i] = { ...ls[i], account: e.target.value }; return ls; })}>
                          <option value="">— choose an account —</option>
                          {inst.accounts!.map((a) => <option key={a} value={a}>{a}</option>)}
                        </select>
                      </td>
                      {(['debit', 'credit'] as const).map((side) => (
                        <td key={side} className="py-0.5 pl-2">
                          <input className="input w-full py-1 text-right font-mono" inputMode="decimal" aria-label={`entry ${k + 1} line ${i + 1} ${side}`} value={l[side]} disabled={locked} placeholder="0"
                            onChange={(e) => upd(k, (ls) => { ls[i] = { ...ls[i], [side]: e.target.value }; return ls; })} />
                        </td>
                      ))}
                      <td className="pl-1 text-center">
                        {!locked && lines.length > 2 && <button className="text-muted hover:text-bad" aria-label="remove line" onClick={() => upd(k, (ls) => ls.filter((_, j) => j !== i))}><X size={14} /></button>}
                      </td>
                    </tr>
                  );
                })}
                <tr className="text-xs text-muted">
                  <td className="pt-1">
                    {!locked && <button className="btn-ghost btn-sm" onClick={() => upd(k, (ls) => [...ls, emptyLine()])} data-testid="add-line"><Plus size={13} /> Add line</button>}
                  </td>
                  <td className="border-t border-line pl-2 pt-1 text-right font-mono">{anything ? money(dr) : ''}</td>
                  <td className="border-t border-line pl-2 pt-1 text-right font-mono">{anything ? money(cr) : ''}</td>
                  <td className="pt-1 text-center">{anything && (Math.abs(dr - cr) < 0.005 ? <Check size={14} className="inline text-good" aria-label="balanced" /> : <span className="text-warn" title="debits ≠ credits">≠</span>)}</td>
                </tr>
              </tbody>
            </table>
            {reveal && check && check.score < 1 && (
              <div className="mt-2 rounded-lg bg-good/5 p-2">
                <div className="label mb-1">Correct entry</div>
                <EntriesView entries={[{ id: `ans${k}`, date: exp.date, lines: exp.lines.map((l) => (l.debit !== null && l.debit !== undefined ? { account: l.account, debit: l.debit } : { account: l.account, credit: l.credit })) }]} money={{ currency }} compact />
              </div>
            )}
          </div>
        );
      })}
      {!locked && <div className="text-xs text-muted">Pick each account, then put its amount in the Debit or the Credit column. Line order doesn't matter.</div>}
    </div>
  );
}

// ------------------------------------------------------------ schedule-fill
function ScheduleFill({ inst, mod, response, setResponse, locked, reveal }: { inst: QuizInstance; mod: LoadedModule; response: any; setResponse: (r: any) => void; locked: boolean; reveal: boolean }) {
  const sched = inst.schedule!;
  const specs = Object.fromEntries(scheduleBlanks(inst).map((b) => [b.key, b.spec]));
  const currency = mod.parsed.manifest.currency;
  const rows = sched.rows.map((r) => ({ label: r.label, indent: r.indent, style: r.style, format: r.format, amounts: r.blank ? r.cells.map(() => null) : r.cells }));
  return (
    <div className="rounded-xl border border-line bg-panel p-3" data-testid="schedule-fill">
      <ScheduleView rows={rows as any} columns={sched.columns} money={{ currency }}
        renderCell={(i, j) => {
          const key = `${i}:${j}`;
          const spec = specs[key];
          if (!spec) return undefined;
          const v = response.cells[key] ?? '';
          const ok = reveal ? checkNumeric(v, spec).correct : undefined;
          return (
            <span className="inline-flex flex-col items-end">
              <input className={cn('input w-28 py-0.5 text-right font-mono', ok === true && 'border-good', ok === false && 'border-bad')} inputMode="decimal" value={v} disabled={locked} placeholder="?"
                aria-label={`${sched.rows[i].label} ${sched.columns?.[j] ?? ''}`.trim()} onChange={(e) => setResponse({ ...response, cells: { ...response.cells, [key]: e.target.value } })} />
              {reveal && ok === false && <span className="text-[11px] text-good">{sched.rows[i].format && sched.rows[i].format !== 'money' ? numText(spec.value) : moneyText(spec.value, undefined, currency ?? DEFAULT_CURRENCY)}</span>}
            </span>
          );
        }} />
    </div>
  );
}

function CodeFill({ inst, response, setResponse, locked, reveal }: { inst: QuizInstance; response: Record<string, string>; setResponse: (r: any) => void; locked: boolean; reveal: boolean }) {
  const parts = inst.code!.replace(/\n+$/, '').split(/(__BLANK_\d+__)/);
  return (
    <div>
      <pre className="overflow-x-auto rounded-xl border border-line bg-panel2 p-3 font-mono text-[13px] leading-7">
        {parts.map((p, i) => {
          const m = /^__BLANK_(\d+)__$/.exec(p);
          if (!m) return <span key={i}>{p}</span>;
          const k = m[1];
          const b = inst.blanks![k];
          const v = response[k] ?? '';
          const ok = reveal ? checkBlank(v, b) : undefined;
          return (
            <input key={i} aria-label={`blank ${k}`} value={v} disabled={locked} onChange={(e) => setResponse({ ...response, [k]: e.target.value })} placeholder={b?.hint ?? `blank ${k}`}
              className={cn('mx-0.5 rounded border-b-2 bg-panel px-1.5 py-0 font-mono text-[13px] outline-none', ok === true ? 'border-good' : ok === false ? 'border-bad' : 'border-accent')}
              style={{ width: `${Math.max(6, (v || b?.hint || '').length + 2)}ch` }} spellCheck={false} autoCapitalize="off" autoCorrect="off" />
          );
        })}
      </pre>
      {reveal && (
        <div className="mt-1 text-xs text-muted">
          {Object.entries(inst.blanks!).map(([k, b]) => <span key={k} className="mr-3">blank {k}: <code className="text-good">{b.accept?.[0] ?? b.regex}</code></span>)}
        </div>
      )}
    </div>
  );
}

function HandCalc({ inst, response, setResponse, locked, practice, reveal }: { inst: QuizInstance; response: any; setResponse: (r: any) => void; locked: boolean; practice: boolean; reveal: boolean }) {
  const steps = inst.steps!;
  const firstOpen = practice ? response.done.findIndex((d: boolean) => !d) : steps.length;
  const current = firstOpen === -1 ? steps.length : firstOpen;
  const [feedback, setFeedback] = useState<Record<number, string | null>>({});
  const upd = (patch: (r: any) => void) => { const r = structuredClone(response); patch(r); setResponse(r); };
  return (
    <ol className="flex flex-col gap-2">
      {steps.map((st, i) => {
        const visible = !practice || i <= current;
        if (!visible) return <li key={i} className="rounded-lg border border-dashed border-line px-3 py-2 text-sm text-muted">Step {i + 1} unlocks after step {i}.</li>;
        const res = checkNumeric(response.inputs[i], st.numeric, st.misconceptions);
        const done = response.done[i];
        const showRes = (practice && (done || response.tries[i] > 0)) || reveal;
        return (
          <li key={i} className={cn('rounded-lg border px-3 py-2', done && !response.revealed[i] ? 'border-good/50 bg-good/5' : response.revealed[i] ? 'border-warn/50 bg-warn/5' : 'border-line bg-panel')}>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-panel2 text-[10px] font-bold">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <Markdown text={st.prompt} className="text-sm" />
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <input className="input w-36 py-1 font-mono" aria-label={`step ${i + 1} answer`} value={response.inputs[i]} disabled={locked || done}
                    onChange={(e) => upd((r) => { r.inputs[i] = e.target.value; })}
                    onKeyDown={(e) => { if (e.key === 'Enter' && practice && !done) (e.currentTarget.parentElement?.querySelector('[data-check]') as HTMLButtonElement)?.click(); }} />
                  {practice && !done && !locked && (
                    <>
                      <button data-check className="btn btn-sm" disabled={!response.inputs[i].trim()} onClick={() => {
                        const r2 = checkNumeric(response.inputs[i], st.numeric, st.misconceptions);
                        upd((r) => { r.tries[i] += 1; if (r2.correct) r.done[i] = true; });
                        setFeedback((f) => ({ ...f, [i]: r2.correct ? null : r2.feedback ?? 'Not yet. Check your arithmetic.' }));
                      }}>Check</button>
                      {st.hint && !response.hints[i] && <button className="btn-ghost btn-sm" onClick={() => upd((r) => { r.hints[i] = true; })}><Lightbulb size={13} /> Hint</button>}
                      <button className="btn-ghost btn-sm text-muted" onClick={() => upd((r) => { r.revealed[i] = true; r.done[i] = true; r.inputs[i] = String(Number(st.numeric.value.toFixed(4))); })}>Show step</button>
                    </>
                  )}
                  {showRes && (response.revealed[i] ? <span className="text-xs text-warn">revealed: {numText(st.numeric.value)}</span> : res.correct ? <Check size={16} className="text-good" /> : reveal ? <span className="text-xs text-bad">answer: {numText(st.numeric.value)}</span> : null)}
                </div>
                {response.hints[i] && st.hint && <Markdown text={st.hint} className="mt-1 text-xs text-muted" />}
                {practice && feedback[i] && !done && <Markdown text={feedback[i]!} className="mt-1 text-xs font-medium text-warn" />}
                {reveal && !res.correct && res.feedback && !response.revealed[i] && <Markdown text={res.feedback} className="mt-1 text-xs font-medium text-warn" />}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function isAnswered(inst: QuizInstance, r: any): boolean {
  switch (inst.type) {
    case 'mcq': return r !== null && r !== undefined;
    case 'multi': return r.length > 0;
    case 'numeric': return String(r).trim().length > 0;
    case 'code-fill': return Object.keys(inst.blanks!).every((k) => (r[k] ?? '').trim());
    case 'match': case 'order': return true;
    case 'hand-calc': return r.done.every(Boolean) || r.inputs.every((x: string) => x.trim());
    case 'journal-entry': return (r.entries as any[]).every((ls: any[]) => ls.filter((l) => l.account && (l.debit.trim() || l.credit.trim())).length >= 2);
    case 'schedule-fill': return scheduleBlanks(inst).every((b) => String(r.cells[b.key] ?? '').trim());
  }
  return true;
}
