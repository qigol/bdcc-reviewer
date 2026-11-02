import { useMemo, useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { BookOpen, Check, Eye, Lightbulb, Plus, X } from 'lucide-react';
import { SortCard } from '../lib/SortCard';
import { variantCount, checkBlank, checkMatch, matchSlotRight, checkMcq, checkMulti, checkNumeric, checkOrder, checkParsons, checkFindError, checkTwoTier, checkExplain, checkJournalEntry, parseNumber, normAccount, DEFAULT_CURRENCY, type QuizInstance, type NumericSpec } from '@kodigo/schema';
import { frac, moneyText } from '@kodigo/sdk';
import { EntriesView, ScheduleView } from '../widgets/accounting';
import { GlossaryProvider, useInterp } from '../lib/md';
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
    case 'numeric': return inst.estimate ? { value: '', estimate: null } : '';
    case 'code-fill': return {};
    case 'match': return inst.rightOrder!.slice();
    case 'order': return isParsons(inst) ? { used: [], spare: inst.startOrder!.slice() } : inst.startOrder!.slice();
    case 'hand-calc': return { inputs: inst.steps!.map(() => ''), revealed: inst.steps!.map(() => false), tries: inst.steps!.map(() => 0), done: inst.steps!.map(() => false), hints: inst.steps!.map(() => false) };
    case 'journal-entry': return { entries: inst.entries!.map(() => [emptyLine(), emptyLine()]) };
    case 'schedule-fill': return { cells: {} as Record<string, string> };
    case 'find-error': return { pick: null, fix: '' };
    case 'two-tier': return { choice: null, reason: null };
    case 'explain': return { text: '', compared: false, ticks: [] };
    case 'case': return { parts: inst.parts!.map(emptyResponse), graded: inst.parts!.map(() => null) };
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
      if (typeof v !== 'number' || r.given?.includes(j)) return;
      out.push({ key: `${i}:${j}`, spec: { value: v, tol: r.tol ?? inst.amountTol?.tol ?? 0.01, relTol: inst.amountTol?.relTol, accept: r.format === 'pct' ? ['decimal', 'fraction', 'percent'] : ['decimal', 'fraction'], parenNegative: !r.format || r.format === 'money' } });
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
      // explain each wrong pick and each missed option that has feedback
      const ans = inst.answer as number[];
      inst.options!.forEach((_, i) => { if (r.includes(i) !== ans.includes(i) && inst.optionFeedback?.[i]) fb.push(inst.optionFeedback[i]); });
      return { score: s, correct: s === 1, response: r, feedback: fb };
    }
    case 'numeric': {
      const res = checkNumeric(numValue(r), inst.numeric!, inst.misconceptions);
      if (res.feedback) fb.push(res.feedback);
      let score = res.score;
      if (inst.estimate) {
        // the estimate is worth a quarter of the question
        const estOk = r.estimate === inst.estimate.answer;
        if (!estOk) fb.push(inst.estimate.feedback ?? `Your estimate was off: the right range was **${inst.estimate.options[inst.estimate.answer]}**.`);
        score = 0.75 * res.score + (estOk ? 0.25 : 0);
      }
      return { score, correct: score === 1, response: r, feedback: fb };
    }
    case 'code-fill': {
      const keys = Object.keys(inst.blanks!);
      const ok = keys.filter((k) => checkBlank(r[k] ?? '', inst.blanks![k], { ignoreCase: inst.lang === 'text' }));
      const s = ok.length / Math.max(1, keys.length);
      return { score: s, correct: s === 1, response: r, feedback: fb };
    }
    case 'match': {
      const s = checkMatch(r, inst.pairs);
      return { score: s, correct: s === 1, response: r, feedback: fb };
    }
    case 'order': {
      if (isParsons(inst)) {
        const s = checkParsons(r.used, inst.nCorrect!);
        const decoys = r.used.filter((i: number) => i >= inst.nCorrect!).length;
        const missing = inst.nCorrect! - r.used.filter((i: number) => i < inst.nCorrect!).length;
        if (decoys) fb.push(decoys > 1 ? `${decoys} lines in your solution don't belong.` : "One line in your solution doesn't belong.");
        if (missing) fb.push(missing > 1 ? `${missing} needed lines are still in the bank.` : 'One needed line is still in the bank.');
        return { score: s, correct: s === 1, response: r, feedback: fb };
      }
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
      // "Show step" earns no credit for that step; say so, so a shown solution doesn't read as a wrong answer
      const shown = (r.revealed as boolean[]).filter(Boolean).length;
      if (shown === steps.length) fb.push('You used **Show step** on every step, so this one earns no credit.');
      else if (shown) fb.push(`${shown} of ${steps.length} steps were shown with **Show step**, and shown steps earn no credit.`);
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
    case 'find-error': {
      const res = checkFindError(r.pick, r.fix, inst);
      fb.push(...res.feedback);
      if (!res.pickRight) fb.push(`The wrong step was **step ${inst.wrong! + 1}**.`);
      else if (res.fixRight === false) fb.push('You found the wrong step, but the corrected value is off.');
      return { score: res.score, correct: res.score === 1, response: r, feedback: fb };
    }
    case 'two-tier': {
      const res = checkTwoTier(r.choice, r.reason, inst.answer as number, inst.reasonAnswer!);
      if (r.choice !== null && !res.answerRight && inst.optionFeedback?.[r.choice]) fb.push(inst.optionFeedback[r.choice]);
      if (r.reason !== null && !res.reasonRight && inst.reasonFeedback?.[r.reason]) fb.push(inst.reasonFeedback[r.reason]);
      if (res.answerRight && !res.reasonRight) fb.push('Right answer, wrong reason. The reasoning is what carries over to the next problem, so look at why the marked reason holds.');
      return { score: res.score, correct: res.score === 1, response: r, feedback: fb };
    }
    case 'explain': {
      const s = checkExplain(r.ticks, inst.checklist!.length);
      return { score: s, correct: s === 1, response: r, feedback: fb };
    }
    case 'case': {
      const gs: Graded[] = inst.parts!.map((p, i) => r.graded?.[i] ?? grade(p, r.parts[i]));
      const s = gs.reduce((a, g) => a + g.score, 0) / Math.max(1, gs.length);
      const right = gs.filter((g) => g.correct).length;
      if (s < 1) fb.push(`${right} of ${gs.length} parts fully right.`);
      return { score: s, correct: s === 1, response: { ...r, graded: gs }, feedback: fb };
    }
  }
  return { score: 0, correct: false, response: r, feedback: fb };
}

/** True when a hand-calc answer earned nothing only because every step was shown, not because it was wrong. */
export function solutionShown(inst: QuizInstance, g: Graded | null | undefined): boolean {
  const r = g?.response as { revealed?: boolean[] } | undefined;
  return inst.type === 'hand-calc' && !!r?.revealed?.length && r.revealed.every(Boolean);
}

function numText(v: number) {
  const f = frac(v, 12);
  const d = fmtNum(v, 4);
  return f.includes('/') ? `${d} (= ${f})` : d;
}

function SortRow({ id, children, locked, tone }: { id: string; children: React.ReactNode; locked: boolean; tone?: string }) {
  return (
    <SortCard id={id} locked={locked} className={cn('flex items-center gap-2 rounded-lg border bg-panel px-3 py-2 text-sm', tone ? `tone-${tone} mark-bg` : 'border-line')}>
      {(grip) => <>{grip}<div className="min-w-0 flex-1">{children}</div></>}
    </SortCard>
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

/**
 * Match questions: each left item and the card currently beside it share one grid row, so the row is
 * as tall as the taller of the two and the pairs always line up, however the text wraps.
 */
function MatchCard({ id, children, locked, tone }: { id: string; children: React.ReactNode; locked: boolean; tone?: string }) {
  return (
    <SortCard id={id} locked={locked} as="div" fill className={cn('flex items-center gap-2 rounded-lg border bg-panel px-3 py-2 text-sm', tone ? `tone-${tone} mark-bg` : 'border-line')}>
      {(grip) => <>{grip}<div className="min-w-0 flex-1">{children}</div></>}
    </SortCard>
  );
}

function MatchRows({ pairs, ids, onMove, locked, toneOf }: { pairs: [string, string][]; ids: string[]; onMove: (from: number, to: number) => void; locked: boolean; toneOf?: (id: string, i: number) => string | undefined }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onDragEnd = (e: DragEndEvent) => { if (e.over && e.active.id !== e.over.id) onMove(ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id))); };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ol className="flex flex-col gap-1.5" data-testid="match-rows">
          {pairs.map((p, i) => (
            <li key={i} className="grid grid-cols-2 items-stretch gap-2">
              <div className="flex min-h-[42px] items-center rounded-lg border border-line bg-panel2 px-3 py-2 text-sm font-medium"><Markdown text={p[0]} inline /></div>
              {ids[i] !== undefined && <MatchCard key={ids[i]} id={ids[i]} locked={locked} tone={toneOf?.(ids[i], i)}><Markdown text={pairs[Number(ids[i])][1]} inline /></MatchCard>}
            </li>
          ))}
        </ol>
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
  // only templates with a generator get different figures from a new seed
  // a generator gives new figures, and a template with variants gives a different scenario
  const tpl = mod.parsed.quiz.find((t) => t.id === inst.templateId);
  const newNumbersPossible = !!tpl && (!!tpl.generator || variantCount(tpl) > 1);
  const lessonHref = inst.lessonRef ? `/m/${inst.moduleId}/${inst.lessonRef.tab}${inst.lessonRef.tab === 'application' ? '' : `/${inst.lessonRef.id}`}` : null;
  // Open the lesson in a popup over the quiz instead of navigating away (which used to wipe quiz progress).
  const openLesson = () => lessonHref && popup.open({ title: `Lesson · ${mod.parsed.manifest.shortTitle}`, src: lessonHref, note: 'Your quiz stays open underneath' });
  return (
    <GlossaryProvider terms={mod.parsed.glossary}>
    <StageProvider mod={mod} spec={{}} state={{}} extraScope={extraScope}>
      <div className="flex flex-col gap-3">
        <Markdown text={inst.prompt} className="text-[15px]" />
        {inst.show?.length ? <Stage widgets={inst.show} /> : null}

        <AnswerArea inst={inst} mod={mod} response={response} setResponse={setResponse} graded={graded} reveal={reveal} practice={practice} />

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
          <div className={cn('rounded-xl border p-3', graded.correct ? 'border-good/50 bg-good/5' : graded.score > 0 || solutionShown(inst, graded) ? 'border-warn/50 bg-warn/5' : 'border-bad/40 bg-bad/5')} data-testid="feedback">
            <div className="mb-1 flex items-center gap-1.5 font-semibold">
              {graded.correct ? <><Check size={16} className="text-good" /> Correct</>
                : solutionShown(inst, graded) ? <><Eye size={16} className="text-warn" /> Solution shown · no credit</>
                : graded.score > 0 ? <>Partly right · {Math.round(graded.score * 100)}%</>
                : <><X size={16} className="text-bad" /> Not quite</>}
            </div>
            {graded.feedback.map((f, i) => <Markdown key={i} text={f} className="mb-1 text-sm font-medium text-warn" />)}
            {practice && !graded.correct && newNumbersPossible && (
              <div className="mb-1 text-sm text-muted">Press <b>New numbers</b> to get the same question with different figures and try it yourself.</div>
            )}
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

/** The answer controls of one question (or one part of a case), by type. */
function AnswerArea({ inst, mod, response, setResponse, graded, reveal, practice }: {
  inst: QuizInstance; mod: LoadedModule; response: any; setResponse: (r: any) => void; graded: Graded | null; reveal: boolean; practice: boolean;
}) {
  const locked = !!graded;
  return (
    <>
      {inst.type === 'mcq' && <Choice options={inst.options!} value={response} onPick={setResponse} locked={locked} answer={reveal ? (inst.answer as number) : undefined} />}

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

      {inst.type === 'numeric' && <NumericInput inst={inst} response={response} setResponse={setResponse} locked={locked} reveal={reveal} />}

      {inst.type === 'code-fill' && (inst.lang === 'text' ? <Cloze inst={inst} response={response} setResponse={setResponse} locked={locked} reveal={reveal} /> : <CodeFill inst={inst} response={response} setResponse={setResponse} locked={locked} reveal={reveal} />)}

      {inst.type === 'match' && (
        <div>
          <MatchRows pairs={inst.pairs!} ids={(response as number[]).map(String)} locked={locked} onMove={(a, b) => setResponse(arrayMove(response, a, b))}
            toneOf={(id, i) => (reveal ? (matchSlotRight(Number(id), i, inst.pairs) ? 'good' : 'bad') : undefined)} />
          <div className="mt-1 text-xs text-muted">Drag the right-hand cards so each lines up with its partner.</div>
        </div>
      )}

      {inst.type === 'order' && (isParsons(inst) ? <Parsons inst={inst} response={response} setResponse={setResponse} locked={locked} reveal={reveal} graded={graded} /> : (
        <div>
          <Sortable ids={(response as number[]).map(String)} locked={locked} onMove={(a, b) => setResponse(arrayMove(response, a, b))}
            toneOf={(id, i) => (reveal ? (Number(id) === i ? 'good' : 'bad') : undefined)}
            render={(id, i) => <span className="flex gap-2"><b className="text-muted">{i + 1}.</b><Line text={inst.items![Number(id)]} code={inst.codeLines} /></span>} />
          <div className="mt-1 text-xs text-muted">Drag into the correct order (top = first).</div>
          {reveal && !graded?.correct && <ol className="mt-2 list-decimal pl-5 text-sm text-good">{inst.items!.map((it, i) => <li key={i}><Line text={it} code={inst.codeLines} /></li>)}</ol>}
        </div>
      ))}

      {inst.type === 'hand-calc' && <HandCalc inst={inst} response={response} setResponse={setResponse} locked={locked} practice={practice} reveal={reveal} />}

      {inst.type === 'journal-entry' && <JournalEntryInput inst={inst} mod={mod} response={response} setResponse={setResponse} locked={locked} reveal={reveal} />}

      {inst.type === 'schedule-fill' && <ScheduleFill inst={inst} mod={mod} response={response} setResponse={setResponse} locked={locked} reveal={reveal} />}

      {inst.type === 'find-error' && <FindError inst={inst} response={response} setResponse={setResponse} locked={locked} reveal={reveal} />}

      {inst.type === 'two-tier' && (
        <div className="flex flex-col gap-3" data-testid="two-tier">
          <Choice options={inst.options!} value={response.choice} onPick={(i) => setResponse({ ...response, choice: i })} locked={locked} answer={reveal ? inst.answer as number : undefined} />
          <div className={cn('flex flex-col gap-1.5', response.choice === null && 'opacity-50')}>
            <Markdown text={inst.reasonPrompt ?? '**Why?** Pick the reason that supports your answer.'} className="text-sm" />
            <Choice options={inst.reasons!} value={response.reason} onPick={(i) => setResponse({ ...response, reason: i })} locked={locked || response.choice === null} answer={reveal ? inst.reasonAnswer : undefined} label="reason" />
          </div>
        </div>
      )}

      {inst.type === 'explain' && <Explain inst={inst} response={response} setResponse={setResponse} locked={locked} reveal={reveal} />}

      {inst.type === 'case' && <Case inst={inst} mod={mod} response={response} setResponse={setResponse} locked={locked} reveal={reveal} practice={practice} />}
    </>
  );
}

/** A single-choice option list (mcq, two-tier). `answer` is set only when the answer is revealed. */
function Choice({ options, value, onPick, locked, answer, label }: { options: string[]; value: number | null; onPick: (i: number) => void; locked: boolean; answer?: number; label?: string }) {
  return (
    <div className="grid gap-1.5" role="radiogroup" aria-label={label}>
      {options.map((o, i) => {
        const right = answer !== undefined && i === answer;
        const wrong = answer !== undefined && value === i && i !== answer;
        return (
          <button key={i} role="radio" aria-checked={value === i} disabled={locked} onClick={() => onPick(i)}
            className={cn('flex items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm transition', right ? 'tone-good mark-bg' : wrong ? 'tone-bad mark-bg' : value === i ? 'border-accent bg-accent/10' : 'border-line bg-panel hover:border-accent/50')}>
            <span className={cn('mt-0.5 h-4 w-4 shrink-0 rounded-full border-2', value === i ? 'border-accent bg-accent' : 'border-line')} />
            <Markdown text={o} inline />
          </button>
        );
      })}
    </div>
  );
}

/** One line of an order/Parsons/find-error list; code lines keep their spacing and still get {=} numbers. */
function Line({ text, code }: { text: string; code?: boolean }) {
  const { md } = useInterp();
  return code ? <code className="whitespace-pre-wrap font-mono text-[13px]">{md(text)}</code> : <Markdown text={text} inline />;
}

const numValue = (r: any): string => (typeof r === 'string' ? r : r?.value ?? '');

function NumericInput({ inst, response, setResponse, locked, reveal }: { inst: QuizInstance; response: any; setResponse: (r: any) => void; locked: boolean; reveal: boolean }) {
  const est = inst.estimate;
  const value = numValue(response);
  const waiting = !!est && response.estimate === null;
  return (
    <div className="flex flex-col gap-2">
      {est && (
        <div className="rounded-lg border border-line bg-panel2/50 p-2.5" data-testid="estimate">
          <Markdown text={`**Estimate first.** ${est.prompt}`} className="mb-1.5 text-sm" />
          <Choice options={est.options} value={response.estimate} onPick={(i) => setResponse({ ...response, estimate: i })} locked={locked || response.estimate !== null} answer={reveal ? est.answer : undefined} label="estimate" />
        </div>
      )}
      <div className={cn('flex flex-wrap items-center gap-2', waiting && 'opacity-50')}>
        <input className="input w-48 font-mono" aria-label="answer" value={value} disabled={locked || waiting} onChange={(e) => setResponse(est ? { ...response, value: e.target.value } : e.target.value)} placeholder={waiting ? 'estimate first' : 'e.g. 0.67 or 2/3'} inputMode="decimal" />
        <span className="text-xs text-muted">accepts {inst.numeric!.accept.join(', ')} · tolerance ±{inst.numeric!.tol}</span>
        {reveal && <span className="ml-auto rounded-lg bg-good/10 px-2 py-1 text-sm">Answer: <b className="font-mono">{numText(inst.numeric!.value)}</b></span>}
      </div>
    </div>
  );
}

const isParsons = (inst: QuizInstance) => (inst.nCorrect ?? inst.items?.length ?? 0) < (inst.items?.length ?? 0);

/** Parsons: build the solution from the line bank; decoy lines stay in the bank. */
function Parsons({ inst, response, setResponse, locked, reveal, graded }: { inst: QuizInstance; response: { used: number[]; spare: number[] }; setResponse: (r: any) => void; locked: boolean; reveal: boolean; graded: Graded | null }) {
  const n = inst.nCorrect!;
  const move = (id: number, to: 'used' | 'spare') => {
    if (locked) return;
    const used = response.used.filter((x) => x !== id);
    const spare = response.spare.filter((x) => x !== id);
    setResponse(to === 'used' ? { used: [...used, id], spare } : { used, spare: [...spare, id] });
  };
  return (
    <div className="grid gap-3 sm:grid-cols-2" data-testid="parsons">
      <div>
        <div className="label mb-1">Your solution (top = first)</div>
        {response.used.length ? (
          <Sortable ids={response.used.map(String)} locked={locked} onMove={(a, b) => setResponse({ ...response, used: arrayMove(response.used, a, b) })}
            toneOf={(id) => {
              if (!reveal) return undefined;
              if (Number(id) >= n) return 'bad';
              // a right line is in place when it sits at its own position among the right lines used (decoys don't shift it)
              return response.used.filter((x) => x < n).indexOf(Number(id)) === Number(id) ? 'good' : 'warn';
            }}
            render={(id) => (
              <span className="flex items-start gap-2">
                <span className="flex-1"><Line text={inst.items![Number(id)]} code={inst.codeLines} /></span>
                {!locked && <button className="text-muted hover:text-bad" aria-label="move back to the line bank" onClick={() => move(Number(id), 'spare')}><X size={13} /></button>}
              </span>
            )} />
        ) : <div className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-xs text-muted">Click lines in the bank to add them here.</div>}
      </div>
      <div>
        <div className="label mb-1">Line bank: some lines don't belong</div>
        <div className="flex flex-col gap-1.5">
          {response.spare.map((id) => (
            <button key={id} disabled={locked} onClick={() => move(id, 'used')} className={cn('rounded-lg border px-3 py-2 text-left text-sm', reveal && id < n ? 'tone-warn mark-bg' : 'border-line bg-panel hover:border-accent/50')}>
              <Line text={inst.items![id]} code={inst.codeLines} />
            </button>
          ))}
          {!response.spare.length && <div className="text-xs text-muted">(empty)</div>}
        </div>
      </div>
      {reveal && !graded?.correct && <ol className="col-span-full list-decimal pl-5 text-sm text-good">{inst.items!.slice(0, n).map((it, i) => <li key={i}><Line text={it} code={inst.codeLines} /></li>)}</ol>}
    </div>
  );
}

/** Prose cloze (`code-fill` with `lang: text`): Markdown with inline blanks, matched case-insensitively. */
function Cloze({ inst, response, setResponse, locked, reveal }: { inst: QuizInstance; response: Record<string, string>; setResponse: (r: any) => void; locked: boolean; reveal: boolean }) {
  const parts = inst.code!.replace(/\n+$/, '').split(/(__BLANK_\d+__)/);
  return (
    <div data-testid="cloze">
      <div className="rounded-xl border border-line bg-panel p-3 text-[15px] leading-8">
        {parts.map((p, i) => {
          const m = /^__BLANK_(\d+)__$/.exec(p);
          if (!m) return <Markdown key={i} text={p} inline />;
          const k = m[1];
          const b = inst.blanks![k];
          const v = response[k] ?? '';
          const ok = reveal ? checkBlank(v, b, { ignoreCase: true }) : undefined;
          return (
            <input key={i} aria-label={`blank ${k}`} value={v} disabled={locked} onChange={(e) => setResponse({ ...response, [k]: e.target.value })} placeholder={b?.hint ?? '…'}
              className={cn('mx-1 rounded border-b-2 bg-panel2 px-1.5 py-0 text-[15px] outline-none', ok === true ? 'border-good' : ok === false ? 'border-bad' : 'border-accent')}
              style={{ width: `${Math.max(10, (v || b?.hint || '').length + 2)}ch` }} spellCheck={false} />
          );
        })}
      </div>
      {reveal && (
        <div className="mt-1 text-xs text-muted">
          {Object.entries(inst.blanks!).map(([k, b]) => <span key={k} className="mr-3">blank {k}: <b className="text-good">{b.accept?.[0] ?? b.regex}</b></span>)}
        </div>
      )}
    </div>
  );
}

function FindError({ inst, response, setResponse, locked, reveal }: { inst: QuizInstance; response: { pick: number | null; fix: string }; setResponse: (r: any) => void; locked: boolean; reveal: boolean }) {
  return (
    <div className="flex flex-col gap-2" data-testid="find-error">
      <div className="text-xs text-muted">One step below is wrong. Click it.</div>
      <ol className="flex flex-col gap-1.5" role="radiogroup" aria-label="steps">
        {inst.lines!.map((l, i) => {
          const picked = response.pick === i;
          const tone = reveal ? (i === inst.wrong ? 'tone-bad mark-bg' : picked ? 'tone-warn mark-bg' : 'border-line bg-panel') : picked ? 'border-accent bg-accent/10' : 'border-line bg-panel hover:border-accent/50';
          return (
            <li key={i}>
              <button role="radio" aria-checked={picked} disabled={locked} onClick={() => setResponse({ ...response, pick: i })} className={cn('flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm transition', tone)}>
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-panel2 text-[10px] font-bold">{i + 1}</span>
                <span className="min-w-0 flex-1"><Line text={l} code={inst.codeLines} /></span>
                {reveal && i === inst.wrong && <span className="shrink-0 text-xs font-semibold text-bad">the error</span>}
              </button>
            </li>
          );
        })}
      </ol>
      {inst.fix && (
        <div className={cn('flex flex-wrap items-center gap-2', response.pick === null && 'opacity-50')}>
          <Markdown text={inst.fixPrompt ?? 'What should that step give?'} className="text-sm" />
          <input className="input w-40 font-mono" aria-label="corrected value" value={response.fix} disabled={locked || response.pick === null} onChange={(e) => setResponse({ ...response, fix: e.target.value })} inputMode="decimal" />
          {reveal && <span className="rounded-lg bg-good/10 px-2 py-1 text-sm">Corrected: <b className="font-mono">{numText(inst.fix.value)}</b></span>}
        </div>
      )}
    </div>
  );
}

function Explain({ inst, response, setResponse, locked, reveal }: { inst: QuizInstance; response: { text: string; compared: boolean; ticks: boolean[] }; setResponse: (r: any) => void; locked: boolean; reveal: boolean }) {
  return (
    <div className="flex flex-col gap-2" data-testid="explain">
      <textarea className="input min-h-[110px] w-full text-sm" aria-label="your explanation" value={response.text} disabled={locked || response.compared}
        onChange={(e) => setResponse({ ...response, text: e.target.value })} placeholder="Explain in your own words, as if to a classmate." />
      {!response.compared && !locked && (
        <button className="btn btn-sm self-start" disabled={response.text.trim().length < 15} onClick={() => setResponse({ ...response, compared: true })} data-testid="explain-compare">
          <Eye size={13} /> Compare with a model answer
        </button>
      )}
      {(response.compared || reveal) && (
        <div className="rounded-lg border border-line bg-panel2/50 p-3">
          <div className="label mb-1">Model answer</div>
          <Markdown text={inst.model!} className="text-sm" />
          <div className="label mb-1 mt-3">Tick each point your explanation covered</div>
          <div className="flex flex-col gap-1">
            {inst.checklist!.map((c, i) => (
              <label key={i} className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1 accent-[rgb(var(--accent))]" checked={!!response.ticks[i]} disabled={locked}
                  onChange={(e) => { const ticks = inst.checklist!.map((_, j) => (j === i ? e.target.checked : !!response.ticks[j])); setResponse({ ...response, ticks }); }} />
                <Markdown text={c} inline />
              </label>
            ))}
          </div>
          <div className="mt-2 text-xs text-muted">Be honest: this is for your own practice and isn't used in exams.</div>
        </div>
      )}
    </div>
  );
}

/**
 * A multi-part case. In practice the parts unlock one at a time: each is checked on its own and then
 * shows its correct answer, so a slip in one part doesn't spoil the next (the correct value carries forward).
 * Outside practice every part is open and graded at the end.
 */
function Case({ inst, mod, response, setResponse, locked, reveal, practice }: { inst: QuizInstance; mod: LoadedModule; response: any; setResponse: (r: any) => void; locked: boolean; reveal: boolean; practice: boolean }) {
  const parts = inst.parts!;
  const current = practice ? Math.max(0, response.graded.findIndex((g: Graded | null) => !g)) : parts.length;
  const upto = practice ? (response.graded.every(Boolean) ? parts.length : current + 1) : parts.length;
  const setPart = (i: number, r: any) => { const n = structuredClone(response); n.parts[i] = r; setResponse(n); };
  const checkPart = (i: number) => { const n = structuredClone(response); n.graded[i] = grade(parts[i], response.parts[i]); setResponse(n); };
  return (
    <ol className="flex flex-col gap-3" data-testid="case">
      {parts.map((p, i) => {
        if (i >= upto) return <li key={i} className="rounded-lg border border-dashed border-line px-3 py-2 text-sm text-muted">Part {i + 1} opens after part {i}.</li>;
        const g: Graded | null = response.graded[i] ?? (reveal ? grade(p, response.parts[i]) : null);
        const partReveal = reveal || (practice && !!response.graded[i]);
        return (
          <li key={i} className="rounded-xl border border-line bg-panel p-3" data-testid={`case-part-${i + 1}`}>
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">Part {i + 1} <span className="chip normal-case">{QTYPE_LABEL_SHORT[p.type] ?? p.type}</span></div>
            <Markdown text={p.prompt} className="mb-2 text-sm" />
            {p.show?.length ? <Stage widgets={p.show} /> : null}
            <AnswerArea inst={p} mod={mod} response={response.parts[i]} setResponse={(r) => setPart(i, r)} graded={locked || response.graded[i] ? g ?? grade(p, response.parts[i]) : null} reveal={partReveal} practice={practice} />
            {practice && !response.graded[i] && !locked && (
              <button className="btn btn-sm mt-2" disabled={!isAnswered(p, response.parts[i])} onClick={() => checkPart(i)} data-testid="case-check-part">Check part {i + 1}</button>
            )}
            {partReveal && g && (
              <div className={cn('mt-2 rounded-lg p-2 text-sm', g.correct ? 'bg-good/5' : g.score > 0 ? 'bg-warn/5' : 'bg-bad/5')}>
                <b>{g.correct ? 'Right.' : g.score > 0 ? `Partly right (${Math.round(g.score * 100)}%).` : 'Not quite.'}</b>
                {g.feedback.map((f, k) => <Markdown key={k} text={f} className="text-warn" />)}
                {p.explanation && <Markdown text={p.explanation} />}
                {!g.correct && practice && !reveal && i < parts.length - 1 && <div className="mt-1 text-xs text-muted">Carry the correct value into the next part.</div>}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
const QTYPE_LABEL_SHORT: Record<string, string> = { mcq: 'choose', multi: 'select all', numeric: 'number', 'code-fill': 'fill in', match: 'match', order: 'order', 'hand-calc': 'steps', 'journal-entry': 'entry', 'schedule-fill': 'schedule', 'find-error': 'spot the error', 'two-tier': 'answer + reason' };

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
  const rows = sched.rows.map((r) => ({ label: r.label, indent: r.indent, style: r.style, format: r.format, amounts: r.blank ? r.cells.map((c, j) => (r.given?.includes(j) ? c : null)) : r.cells }));
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
    case 'numeric': return numValue(r).trim().length > 0 && (!inst.estimate || r.estimate !== null);
    case 'code-fill': return Object.keys(inst.blanks!).every((k) => (r[k] ?? '').trim());
    case 'match': return true;
    case 'order': return isParsons(inst) ? r.used.length > 0 : true;
    case 'hand-calc': return r.done.every(Boolean) || r.inputs.every((x: string) => x.trim());
    case 'journal-entry': return (r.entries as any[]).every((ls: any[]) => ls.filter((l) => l.account && (l.debit.trim() || l.credit.trim())).length >= 2);
    case 'schedule-fill': return scheduleBlanks(inst).every((b) => String(r.cells[b.key] ?? '').trim());
    case 'find-error': return r.pick !== null && (!inst.fix || r.fix.trim().length > 0);
    case 'two-tier': return r.choice !== null && r.reason !== null;
    case 'explain': return r.compared && r.text.trim().length > 0;
    case 'case': return inst.parts!.every((p, i) => !!r.graded?.[i] || isAnswered(p, r.parts[i]));
  }
  return true;
}
