import { useEffect, useState } from 'react';
import { Dices, PenLine } from 'lucide-react';
import type { QuizInstance } from '@kodigo/schema';
import type { LoadedModule } from '../modules/store';
import { instantiate, randomSeed, QTYPE_LABEL } from './session';
import { QuestionView, emptyResponse, grade, isAnswered, type Graded } from './Question';
import { recordAttempt } from '../storage/progress';
import { cn } from '../lib/util';

/**
 * One quiz question solved inside a lesson (practice gate, "Your turn"): fresh numbers on demand,
 * instant feedback, hints, and the attempt counts toward mastery like any practice question.
 */
export function PracticeBox({ mod, templateId, title = 'Your turn', prompt, onGraded, className }: {
  mod: LoadedModule; templateId: string; title?: string; prompt?: string; onGraded?: (g: Graded) => void; className?: string;
}) {
  const [seed, setSeed] = useState(randomSeed);
  const [inst, setInst] = useState<QuizInstance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<any>(null);
  const [graded, setGraded] = useState<Graded | null>(null);
  const [startedAt, setStartedAt] = useState(Date.now());
  useEffect(() => {
    let alive = true;
    setInst(null); setGraded(null); setError(null);
    instantiate(mod, { moduleId: mod.id, templateId, seed }).then(
      (i) => { if (!alive) return; setInst(i); setResponse(emptyResponse(i)); setStartedAt(Date.now()); },
      (e) => alive && setError(String(e?.message ?? e)),
    );
    return () => { alive = false; };
  }, [mod, templateId, seed]);
  const check = () => {
    if (!inst) return;
    const g = grade(inst, response);
    setGraded(g);
    onGraded?.(g);
    if (!mod.preview) recordAttempt({ key: inst.key, templateId: inst.templateId, moduleId: inst.moduleId, seed: inst.seed, type: inst.type, skills: inst.skills, score: g.score, response: g.response, timeMs: Date.now() - startedAt, mode: 'lesson', difficulty: inst.difficulty });
  };
  return (
    <div className={cn('rounded-xl border border-accent/40 bg-panel p-3', className)} data-testid="practice-box" data-template={templateId}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-accent"><PenLine size={14} /> {title}</span>
        {inst && <span className="chip">{QTYPE_LABEL[inst.type] ?? inst.type}</span>}
        <button className="btn-ghost btn-sm ml-auto" onClick={() => setSeed(randomSeed())} title="Same question, new numbers" data-testid="new-numbers"><Dices size={13} /> New numbers</button>
      </div>
      {prompt && <div className="mb-2 text-sm text-muted">{prompt}</div>}
      {error ? <div className="text-sm text-bad">Couldn't build this question: {error}</div>
        : !inst ? <div className="h-24 animate-pulse rounded-lg bg-panel2" />
        : (
          <>
            <QuestionView inst={inst} mod={mod} response={response} setResponse={setResponse} graded={graded} reveal={!!graded} practice />
            <div className="mt-3 flex justify-end gap-2">
              {graded
                ? <button className="btn" onClick={() => setSeed(randomSeed())}><Dices size={14} /> Try another</button>
                : <button className="btn-primary" onClick={check} disabled={!isAnswered(inst, response)} data-testid="practice-check">Check answer</button>}
            </div>
          </>
        )}
    </div>
  );
}
