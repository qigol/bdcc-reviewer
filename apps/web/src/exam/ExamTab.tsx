import { useEffect, useMemo, useRef, useState } from 'react';
import { Calculator as CalcIcon, Clock, Code2, Dices, Flag, NotebookPen, PencilLine, Play, Trophy } from 'lucide-react';
import type { QuizInstance } from '@kodigo/schema';
import { useModuleCtx } from '../tabs/ModulePage';
import { Markdown } from '../lib/md';
import { cn } from '../lib/util';
import { instantiate, randomSeed } from '../quiz/session';
import { QuestionView, emptyResponse, grade, isAnswered, type Graded } from '../quiz/Question';
import { Calculator } from '../quiz/Calculator';
import { recordAttempt } from '../storage/progress';
import { ExamGuide, ProblemHint, ScratchPad, useRowMarking } from './ExamTools';
import { CodingExam } from './CodingExam';

/**
 * A mock exam (exam.yaml): one story, one seed per attempt, problems in a fixed order. Every scored item's generator
 * draws the same data from the seed (the validator checks storyKey), so the problems build on one dataset. Answers
 * stay hidden until the learner submits, as in the quiz's exam mode.
 */
interface Item { problemId: string; template: string; points: number; inst?: QuizInstance; error?: string; response?: any; graded?: Graded }
type Phase = 'intro' | 'running' | 'done';

export function ExamTab() {
  const { mod } = useModuleCtx();
  // reopen on the hand-worked exam when an attempt at it is still running
  const [mode, setMode] = useState<'code' | 'hand'>(() => (loadAttempt(mod.id, mod.version, mod.preview) ? 'hand' : 'code'));
  if (!mod.parsed.exam) return <div className="p-10 text-center text-muted">This module has no mock exam.</div>;
  if (!mod.parsed.exam.coding) return <ExamRunner />;
  return (
    <>
      <div className="mx-auto flex w-full max-w-[1000px] gap-1 px-4 pt-5" role="tablist" aria-label="Exam version">
        {([['code', <><Code2 size={14} /> Write the code</>], ['hand', <><PencilLine size={14} /> Work it out by hand</>]] as const).map(([m, label]) => (
          <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} data-testid={`exam-mode-${m}`}
            className={cn('flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition', mode === m ? 'border-accent bg-accent/10 text-ink' : 'border-line text-muted hover:text-ink')}>{label}</button>
        ))}
      </div>
      {mode === 'code' ? <CodingExam /> : <ExamRunner />}
    </>
  );
}

/** A running attempt, in localStorage so leaving, reloading or closing the tab resumes it. */
interface SavedAttempt { v: 1; moduleVersion: string; seed: number; phase: 'running'; current: number; startedAt: number; responses: unknown[] }
const attemptKey = (moduleId: string) => `kodigo-exam-attempt:${moduleId}`;
function loadAttempt(moduleId: string, version: string, preview?: boolean): SavedAttempt | null {
  if (preview) return null;
  try {
    const a = JSON.parse(localStorage.getItem(attemptKey(moduleId)) ?? 'null') as SavedAttempt | null;
    if (a?.v === 1 && a.moduleVersion === version) return a;
    if (a) localStorage.removeItem(attemptKey(moduleId));
  } catch { /* storage blocked: no resume */ }
  return null;
}

function ExamRunner() {
  const { mod } = useModuleCtx();
  const exam = mod.parsed.exam!;
  const [saved] = useState(() => loadAttempt(mod.id, mod.version, mod.preview));
  const [seed, setSeed] = useState(() => saved?.seed ?? randomSeed());
  const [story, setStory] = useState<Record<string, any> | null>(null);
  const [storyError, setStoryError] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [phase, setPhase] = useState<Phase>(saved ? 'running' : 'intro');
  // items are revealed and locked in order: later prompts may show earlier results (the matrix, the estimates)
  const [current, setCurrent] = useState(saved?.current ?? 0);
  const [startedAt, setStartedAt] = useState(saved?.startedAt ?? 0);
  const [now, setNow] = useState(Date.now());
  // note-taking tools: scratchpad, calculator (types into the last answer box clicked), row marking
  const [notesOpen, setNotesOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcTarget, setCalcTarget] = useState<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  useRowMarking(rootRef, seed);
  const trackAnswerField = (e: React.FocusEvent) => {
    const el = e.target;
    if (el instanceof HTMLInputElement && el.type === 'text' && !el.disabled) setCalcTarget(el);
  };

  // build the story and every item from one seed
  useEffect(() => {
    let alive = true;
    setStory(null); setStoryError(null);
    const list: Item[] = exam.problems.flatMap((p) => p.items.map((it) => ({ problemId: p.id, template: it.template, points: it.points })));
    setItems(list);
    mod.logic.generate(exam.story, seed, 3).then(
      (r) => { if (!alive) return; if (r.error || !r.output) setStoryError(r.error ?? 'no output'); else setStory(r.output.vars); },
      (e) => alive && setStoryError(String(e?.message ?? e)),
    );
    list.forEach((it, i) => instantiate(mod, { moduleId: mod.id, templateId: it.template, seed }).then(
      (inst) => alive && setItems((s) => { const n = s.slice(); n[i] = { ...n[i], inst, response: saved?.seed === seed && saved.responses[i] !== undefined ? saved.responses[i] : emptyResponse(inst) }; return n; }),
      (e) => alive && setItems((s) => { const n = s.slice(); n[i] = { ...n[i], error: String(e?.message ?? e) }; return n; }),
    ));
    return () => { alive = false; };
  }, [mod, exam, seed]);

  const limitMs = exam.timeLimitMin ? exam.timeLimitMin * 60_000 : null;
  const leftMs = limitMs && phase === 'running' ? Math.max(0, limitMs - (now - startedAt)) : null;
  useEffect(() => {
    if (phase !== 'running' || !limitMs) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase, limitMs]);

  const clearAttempt = () => { try { localStorage.removeItem(attemptKey(mod.id)); } catch { /* nothing saved */ } };
  const submit = () => {
    clearAttempt();
    const timeMs = Date.now() - startedAt;
    const graded = items.map((it) => (it.inst ? { ...it, graded: grade(it.inst, it.response) } : it));
    setItems(graded);
    setPhase('done');
    if (mod.preview) return;
    for (const it of graded) if (it.inst && it.graded) recordAttempt({
      key: it.inst.key, templateId: it.inst.templateId, moduleId: it.inst.moduleId, seed: it.inst.seed, type: it.inst.type, skills: it.inst.skills,
      score: it.graded.score, response: it.graded.response, timeMs: Math.round(timeMs / graded.length), mode: 'exam', difficulty: it.inst.difficulty,
    });
  };
  const ready = !!story && items.every((it) => it.inst || it.error);
  useEffect(() => { if (leftMs === 0 && ready) submit(); }, [leftMs, ready]); // time is up (a resumed attempt may expire while its items rebuild)

  // keep the running attempt, once its items exist so a resume never overwrites saved answers with blanks
  const responses = items.map((it) => it.response);
  useEffect(() => {
    if (phase !== 'running' || mod.preview || !ready) return;
    const t = setTimeout(() => {
      try { localStorage.setItem(attemptKey(mod.id), JSON.stringify({ v: 1, moduleVersion: mod.version, seed, phase: 'running', current, startedAt, responses } satisfies SavedAttempt)); } catch { /* no resume */ }
    }, 300);
    return () => clearTimeout(t);
  }, [phase, ready, current, seed, startedAt, JSON.stringify(responses)]);

  // leaving mid-exam asks first; the attempt is saved either way
  useEffect(() => {
    if (phase !== 'running') return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [phase]);

  /** The Submit button: blanks score 0, so confirm them. The timer submits without asking. */
  const askSubmit = () => {
    const blank = items.filter((it) => it.inst && !isAnswered(it.inst, it.response)).length;
    if (blank && !confirm(`${blank} item${blank === 1 ? ' is' : 's are'} unanswered and will score 0. Submit anyway?`)) return;
    submit();
  };
  const score = useMemo(() => {
    const per = exam.problems.map((p) => {
      const its = items.filter((it) => it.problemId === p.id);
      return { id: p.id, title: p.title, max: its.reduce((a, it) => a + it.points, 0), got: its.reduce((a, it) => a + it.points * (it.graded?.score ?? 0), 0) };
    });
    return { per, max: per.reduce((a, p) => a + p.max, 0), got: per.reduce((a, p) => a + p.got, 0) };
  }, [items, exam]);

  const newExam = () => { clearAttempt(); setPhase('intro'); setCurrent(0); setSeed(randomSeed()); };
  const fmtTime = (ms: number) => `${Math.floor(ms / 60_000)}:${String(Math.floor((ms % 60_000) / 1000)).padStart(2, '0')}`;
  const pts = (x: number) => (Math.round(x * 10) / 10).toString();

  return (
    <div ref={rootRef} onFocus={trackAnswerField} className="mx-auto w-full max-w-[1000px] px-4 py-5" data-testid="exam">
      <div className="card mb-4 border-l-4 p-5" style={{ borderLeftColor: mod.parsed.manifest.color }}>
        <div className="label">Mock exam</div>
        <h2 className="mb-1 text-xl font-semibold">{exam.title}</h2>
        {storyError ? <div className="text-sm text-bad">Couldn't build the story: {storyError}</div>
          : story ? <Markdown text={exam.intro} scope={story} /> : <div className="h-24 animate-pulse rounded-lg bg-panel2" />}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
          <span className="chip">{exam.problems.length} problems · {pts(score.max)} points</span>
          {exam.timeLimitMin && <span className="chip"><Clock size={12} /> {exam.timeLimitMin} min</span>}
          {phase === 'intro' && <>
            <button className="btn-ghost btn-sm" onClick={() => setSeed(randomSeed())} title="A new dataset"><Dices size={13} /> Different data</button>
            <button className="btn-primary ml-auto" disabled={!ready} onClick={() => { setCurrent(0); setStartedAt(Date.now()); setNow(Date.now()); setPhase('running'); }} data-testid="exam-start"><Play size={14} /> Start the exam</button>
          </>}
          {phase === 'running' && leftMs !== null && <span className={cn('ml-auto font-mono font-semibold', leftMs < 5 * 60_000 ? 'text-bad' : 'text-ink')}><Clock size={14} className="inline" /> {fmtTime(leftMs)}</span>}
        </div>
        {phase === 'intro' && <ExamGuide className="mt-4" />}
      </div>

      {phase === 'running' && (
        <div className="sticky top-2 z-30 mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-panel/95 px-3 py-2 text-sm shadow-sm backdrop-blur" data-testid="exam-tools">
          <button className={cn('btn btn-sm', notesOpen && 'border-accent text-accent')} onClick={() => setNotesOpen((o) => !o)} aria-pressed={notesOpen} data-testid="exam-notes"><NotebookPen size={13} /> Scratchpad</button>
          <button className={cn('btn btn-sm', calcOpen && 'border-accent text-accent')} onClick={() => setCalcOpen((o) => !o)} aria-pressed={calcOpen} data-testid="exam-calc"><CalcIcon size={13} /> Calculator</button>
          <span className="text-xs text-muted">Click a table row to mark it while you count.</span>
        </div>
      )}
      <ScratchPad storageKey={`kodigo-exam-notes:${mod.id}:${seed}`} open={phase !== 'intro' && notesOpen} onClose={() => setNotesOpen(false)} />
      <Calculator open={phase === 'running' && calcOpen} onClose={() => setCalcOpen(false)} target={calcTarget} focusOnOpen />
      {phase === 'running' && <ExamGuide className="mb-4" defaultOpen={false} />}

      {phase === 'done' && (
        <div className="card mb-4 p-5" data-testid="exam-score">
          <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold"><Trophy size={18} /> {pts(score.got)} / {pts(score.max)} points</h3>
          <table className="w-full text-sm">
            <tbody>{score.per.map((p) => (
              <tr key={p.id} className="border-t border-line"><td className="py-1.5">{p.title}</td><td className="py-1.5 text-right font-mono">{pts(p.got)} / {pts(p.max)}</td></tr>
            ))}</tbody>
          </table>
          <p className="mt-2 text-sm text-muted">Every answer and worked solution is shown below. A new exam draws different data.</p>
          <button className="btn mt-2" onClick={newExam}><Dices size={14} /> New exam</button>
        </div>
      )}

      {phase !== 'intro' && story && exam.problems.map((p) => {
        const its = items.map((it, i) => ({ it, i })).filter(({ it, i }) => it.problemId === p.id && (phase === 'done' || i <= current));
        if (!its.length) return null;
        const max = items.filter((it) => it.problemId === p.id).reduce((a, it) => a + it.points, 0);
        return (
          <section key={p.id} className="card mb-4 p-5" data-problem={p.id}>
            <div className="mb-2 flex items-baseline gap-2">
              <h3 className="text-lg font-semibold">{p.title}</h3>
              <span className="chip ml-auto">{pts(max)} pts</span>
            </div>
            <Markdown text={p.spec} scope={story} className="mb-3" />
            {p.hint && <ProblemHint><Markdown text={p.hint} scope={story} /></ProblemHint>}
            <div className="flex flex-col gap-4">
              {its.map(({ it, i }) => (
                <div key={i} className="rounded-xl border border-line p-3">
                  <div className="mb-1 text-xs text-muted">{pts(it.points)} pts{it.graded && ` · scored ${pts(it.points * it.graded.score)}`}</div>
                  {it.error ? <div className="text-sm text-bad">Couldn't build this item: {it.error}</div>
                    : !it.inst ? <div className="h-24 animate-pulse rounded-lg bg-panel2" />
                    : phase === 'running' && i < current ? <div className="text-sm text-muted" data-saved={i}>Answer saved. You'll see it with the solution after you submit.</div>
                    : <QuestionView key={`${i}:${seed}`} inst={it.inst} mod={mod} response={it.response}
                        setResponse={(r) => setItems((s) => { const n = s.slice(); n[i] = { ...n[i], response: r }; return n; })}
                        graded={phase === 'done' ? it.graded ?? null : null} reveal={phase === 'done'} practice={false} />}
                  {phase === 'running' && i === current && i < items.length - 1 && (
                    <div className="mt-3 flex justify-end"><button className="btn-primary" onClick={() => setCurrent(i + 1)} data-testid="exam-next">Save and continue</button></div>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {phase === 'running' && (
        <div className="flex items-center justify-end gap-3">
          <span className="text-sm text-muted">Item {current + 1} of {items.length}{current < items.length - 1 && ' · unanswered items score 0'}</span>
          <button className={current === items.length - 1 ? 'btn-primary' : 'btn'} onClick={askSubmit} data-testid="exam-submit"><Flag size={14} /> Submit the exam</button>
        </div>
      )}
    </div>
  );
}
