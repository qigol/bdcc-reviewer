import { useState } from 'react';
import { Check, HelpCircle, MessageSquareText, X } from 'lucide-react';
import { parseNumber, type Gate } from '@kodigo/schema';
import { Markdown } from '../lib/md';
import { cn } from '../lib/util';
import type { LoadedModule } from '../modules/store';
import { PracticeBox } from '../quiz/PracticeBox';
import { saveNote } from '../storage/progress';

export interface GateState { answered?: boolean; correct?: boolean; choice?: number | string; skipped?: boolean; event?: boolean }

export function gateSatisfied(g: Gate | undefined, s: GateState, whenTrue: boolean): boolean {
  if (!g || g.type === 'continue') return true;
  if (g.type === 'predict') return !!s.answered;
  if (g.type === 'when') return whenTrue || !!s.skipped;
  if (g.type === 'event') return !!s.event || !!s.skipped;
  if (g.type === 'practice' || g.type === 'reflect') return !!s.answered || !!s.skipped;
  return true;
}

export function GateView({ gate, state, setState, whenTrue, onAnswer, mod, noteAnchor }: {
  gate: Gate; state: GateState; setState: (s: GateState) => void; whenTrue: boolean; onAnswer?: (correct: boolean, response: unknown) => void;
  /** needed by practice gates (to build the question) and reflect gates (to save the note) */
  mod?: LoadedModule; noteAnchor?: string;
}) {
  const [input, setInput] = useState('');
  const [hint, setHint] = useState(false);
  if (gate.type === 'continue') return null;
  if (gate.type === 'practice') {
    if (!mod) return null;
    return (
      <div data-testid="gate-practice">
        <PracticeBox mod={mod} templateId={gate.template} title="Try it yourself" prompt={gate.prompt}
          onGraded={(g) => setState({ ...state, answered: true, correct: g.correct })} />
        {!state.answered && gate.skippable !== false && (
          <div className="mt-1 flex justify-end"><button className="btn-ghost btn-sm text-muted" onClick={() => setState({ ...state, skipped: true })}>{state.skipped ? 'Skipped' : 'Skip for now'}</button></div>
        )}
      </div>
    );
  }
  if (gate.type === 'reflect') return <ReflectGate gate={gate} state={state} setState={setState} mod={mod} noteAnchor={noteAnchor} />;
  if (gate.type === 'predict') {
    const ans = typeof gate.answer === 'number' ? { value: gate.answer, tol: 0.01 } : { value: gate.answer.value, tol: gate.answer.tol ?? 0.01 };
    const submit = (choice: number | string) => {
      if (state.answered) return;
      const v = typeof choice === 'number' ? choice : parseNumber(choice, ['decimal', 'fraction', 'percent']);
      if (v === null) return;
      const correct = gate.options ? v === ans.value : Math.abs(v - ans.value) <= ans.tol + 1e-9;
      setState({ ...state, answered: true, correct, choice });
      onAnswer?.(correct, choice);
    };
    return (
      <div className="rounded-xl border border-accent/40 bg-accent/5 p-3" data-testid="gate-predict">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-accent"><HelpCircle size={14} /> Predict before we reveal it</div>
        <Markdown text={gate.question} className="text-sm font-medium" />
        {gate.options ? (
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {gate.options.map((o, i) => {
              const picked = state.answered && state.choice === i;
              const right = state.answered && i === ans.value;
              return (
                <button key={i} data-testid="predict-option" disabled={state.answered} onClick={() => submit(i)}
                  className={cn('rounded-lg border px-3 py-2 text-left text-sm transition', right ? 'tone-good mark-bg' : picked ? 'tone-bad mark-bg' : 'border-line bg-panel hover:border-accent/50', state.answered && !right && !picked && 'opacity-60')}>
                  <Markdown text={o} inline />
                </button>
              );
            })}
          </div>
        ) : (
          <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); submit(input); }}>
            <input className="input w-40" value={input} disabled={state.answered} onChange={(e) => setInput(e.target.value)} placeholder="your answer" aria-label="prediction" />
            <button className="btn-primary" disabled={state.answered || !input.trim()}>Lock it in</button>
          </form>
        )}
        {state.answered && (
          <div className={cn('mt-2 rounded-lg px-3 py-2 text-sm', state.correct ? 'bg-good/10' : 'bg-warn/10')}>
            <div className="mb-0.5 flex items-center gap-1 font-semibold">{state.correct ? <><Check size={14} className="text-good" /> Nice.</> : <><X size={14} className="text-warn" /> Not quite. That's fine, now watch.</>}</div>
            <Markdown text={gate.explain} />
          </div>
        )}
      </div>
    );
  }
  if (gate.type !== 'when' && gate.type !== 'event') return null;
  const done = gate.type === 'when' ? whenTrue : !!state.event;
  return (
    <div className={cn('rounded-xl border p-3 transition', done ? 'border-good/50 bg-good/5' : 'border-warn/50 bg-warn/5')} data-testid={`gate-${gate.type}`}>
      <div className="flex items-start gap-2">
        <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white', done ? 'bg-good' : 'bg-warn')}>{done ? <Check size={13} /> : '!'}</span>
        <div className="flex-1 text-sm">
          <Markdown text={gate.prompt} className="font-medium" />
          {hint && gate.hint && <div className="mt-1 text-muted"><Markdown text={gate.hint} /></div>}
        </div>
      </div>
      {!done && (
        <div className="mt-2 flex gap-2 pl-7">
          {gate.hint && !hint && <button className="btn-ghost btn-sm" onClick={() => setHint(true)}>Hint</button>}
          {gate.skippable !== false && <button className="btn-ghost btn-sm text-muted" onClick={() => setState({ ...state, skipped: true })}>{state.skipped ? 'Skipped' : 'Skip'}</button>}
        </div>
      )}
    </div>
  );
}

/** Self-explanation: write first, then compare with the model answer (saved to your notes). */
function ReflectGate({ gate, state, setState, mod, noteAnchor }: { gate: Extract<Gate, { type: 'reflect' }>; state: GateState; setState: (s: GateState) => void; mod?: LoadedModule; noteAnchor?: string }) {
  const [text, setText] = useState(typeof state.choice === 'string' ? state.choice : '');
  const compare = async () => {
    setState({ ...state, answered: true, choice: text });
    if (mod && !mod.preview && noteAnchor && text.trim()) await saveNote(mod.id, noteAnchor, text);
  };
  return (
    <div className="rounded-xl border border-accent/40 bg-accent/5 p-3" data-testid="gate-reflect">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-accent"><MessageSquareText size={14} /> In your own words</div>
      <Markdown text={gate.prompt} className="text-sm font-medium" />
      <textarea className="input mt-2 min-h-[64px] w-full" value={text} disabled={state.answered} onChange={(e) => setText(e.target.value)} placeholder="Write it before you peek." aria-label="your explanation" />
      {!state.answered ? (
        <div className="mt-1 flex justify-end gap-2">
          {gate.skippable !== false && <button className="btn-ghost btn-sm text-muted" onClick={() => setState({ ...state, skipped: true })}>{state.skipped ? 'Skipped' : 'Skip'}</button>}
          <button className="btn btn-sm" disabled={text.trim().split(/\s+/).length < 3} onClick={compare} data-testid="reflect-compare">Compare with a model answer</button>
        </div>
      ) : (
        <div className="mt-2 rounded-lg bg-panel px-3 py-2 text-sm">
          <div className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-muted">A model answer</div>
          <Markdown text={gate.model} />
          <div className="mt-1 text-xs text-muted">Did yours say the same thing in different words? That's the goal.{mod && !mod.preview ? ' Saved to your notes.' : ''}</div>
        </div>
      )}
    </div>
  );
}
