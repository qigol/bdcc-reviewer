import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Dices, Flag, Loader2, NotebookPen, Play, RotateCcw, Trophy } from 'lucide-react';
import { interpolate } from '@kodigo/schema';
import { useModuleCtx } from '../tabs/ModulePage';
import { Markdown } from '../lib/md';
import { cn } from '../lib/util';
import { randomSeed } from '../quiz/session';
import { PythonKernel, type CellResult } from '../py/python';
import { CodeCell } from './CodeCell';
import { ExamGuide, ProblemHint, ScratchPad } from './ExamTools';

/**
 * The coding mock exam (exam.yaml `coding`): the learner writes each function in Python, which runs in the browser.
 * One seed per attempt draws the data files and the test values. Test cells score their points when they run without
 * an error. On submit the kernel restarts and every cell runs top to bottom before the tests, as a grader would.
 */
type Phase = 'intro' | 'running' | 'grading' | 'done';
interface TestState { pass: boolean; result: CellResult }

// an attempt in progress survives a reload: same seed (so the same data and saved code), same clock
interface SavedAttempt { seed: number; startedAt: number }
const attemptKey = (moduleId: string) => `kodigo-coding-attempt:${moduleId}`;
function readAttempt(moduleId: string): SavedAttempt | null {
  try { return JSON.parse(sessionStorage.getItem(attemptKey(moduleId)) ?? 'null'); } catch { return null; }
}

export function CodingExam() {
  const { mod } = useModuleCtx();
  const coding = mod.parsed.exam!.coding!;
  const [resumed] = useState(() => readAttempt(mod.id));
  const [seed, setSeed] = useState(() => resumed?.seed ?? randomSeed());
  const [vars, setVars] = useState<Record<string, any> | null>(null);
  const [varsError, setVarsError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>(resumed ? 'running' : 'intro');
  const [stage, setStage] = useState('Loading Python…');
  const [code, setCode] = useState<Record<string, string>>({});
  const [outputs, setOutputs] = useState<Record<string, CellResult>>({});
  const [running, setRunning] = useState<string | null>(null);
  const [tests, setTests] = useState<Record<string, TestState>>({});
  const [startedAt, setStartedAt] = useState(() => resumed?.startedAt ?? 0);
  const [now, setNow] = useState(Date.now());
  const [notesOpen, setNotesOpen] = useState(false);
  const kernel = useRef<PythonKernel | null>(null);
  const storeKey = `kodigo-coding:${mod.id}:${seed}`;
  const start = () => {
    const t = Date.now();
    setStartedAt(t); setNow(t); setPhase('running');
    try { sessionStorage.setItem(attemptKey(mod.id), JSON.stringify({ seed, startedAt: t } satisfies SavedAttempt)); } catch { /* no resume in private mode */ }
  };
  const clearAttempt = () => { try { sessionStorage.removeItem(attemptKey(mod.id)); } catch { /* nothing saved */ } };

  // one Python kernel per visit; start loading at once, so the download doesn't eat exam time
  useEffect(() => {
    const k = new PythonKernel();
    k.onStage = setStage;
    kernel.current = k;
    k.load().catch(() => {});
    return () => k.dispose();
  }, []);

  // the attempt's data and test values
  useEffect(() => {
    let alive = true;
    setVars(null); setVarsError(null); setOutputs({}); setTests({});
    mod.logic.generate(coding.story, seed, 3).then(
      (r) => { if (!alive) return; if (r.error || !r.output) setVarsError(r.error ?? 'no output'); else setVars(r.output.vars); },
      (e) => alive && setVarsError(String(e?.message ?? e)),
    );
    const fresh: Record<string, string> = { setup: coding.setup, scratch: '' };
    for (const p of coding.problems) fresh[p.id] = p.stub;
    let saved: Record<string, string> = {};
    try { saved = JSON.parse(sessionStorage.getItem(storeKey) ?? '{}'); } catch { /* storage blocked: start fresh */ }
    setCode({ ...fresh, ...saved });
    return () => { alive = false; };
  }, [mod, coding, seed]);

  const setCell = (key: string, c: string) => setCode((s) => {
    const n = { ...s, [key]: c };
    try { sessionStorage.setItem(storeKey, JSON.stringify(n)); } catch { /* notes stay in memory */ }
    return n;
  });

  const fill = (text: string) => (vars ? interpolate(text, vars, { mode: 'md' }).text : text);
  const files = useMemo(() => {
    if (!vars) return {};
    return Object.fromEntries(Object.entries(coding.files).map(([p, v]) => [interpolate(p, vars, { mode: 'md' }).text, String(vars[v])]));
  }, [vars, coding]);
  const testCode = (pid: string, i: number) => fill(coding.problems.find((p) => p.id === pid)!.tests[i].code);
  const ready = stage === 'ready';

  const runCell = async (key: string, src: string) => {
    if (!kernel.current) return null;
    setRunning(key);
    try {
      const r = await kernel.current.run(src, files);
      setOutputs((o) => ({ ...o, [key]: r }));
      return r;
    } catch (e: any) {
      const r = { out: '', err: String(e?.message ?? e), ms: 0 };
      setOutputs((o) => ({ ...o, [key]: r }));
      return r;
    } finally { setRunning(null); }
  };
  const runTest = async (pid: string, i: number) => {
    const key = `${pid}:test${i}`;
    const r = await runCell(key, testCode(pid, i));
    if (r) setTests((t) => ({ ...t, [key]: { pass: !r.err, result: r } }));
  };
  const restart = async () => { await kernel.current?.restart(); setOutputs({}); };

  // grade like a grader: fresh kernel, every cell top to bottom, then every test cell. A run that times out replaces the
  // kernel, so the cells that ran fine are run again before going on: one endless loop costs only its own problem.
  const submit = async () => {
    if (!kernel.current || phase !== 'running') return;
    setPhase('grading');
    clearAttempt();
    const k = kernel.current;
    const outs: Record<string, CellResult> = {};
    const res: Record<string, TestState> = {};
    const safeRun = async (src: string): Promise<CellResult> => {
      try { return await k.run(src, files); } catch (e: any) { return { out: '', err: String(e?.message ?? e), ms: 0 }; }
    };
    const good: string[] = [];
    const rerunGood = async () => { for (const g of good) await safeRun(code[g] ?? ''); };
    try {
      await k.restart().catch(() => {});
      for (const key of ['setup', ...coding.problems.map((p) => p.id)]) {
        const r = await safeRun(code[key] ?? '');
        outs[key] = r;
        if (r.timedOut) await rerunGood(); else good.push(key);
      }
      for (const p of coding.problems) for (let i = 0; i < p.tests.length; i++) {
        const r = await safeRun(testCode(p.id, i));
        outs[`${p.id}:test${i}`] = r;
        res[`${p.id}:test${i}`] = { pass: !r.err && !r.timedOut, result: r };
        if (r.timedOut) await rerunGood();
      }
    } finally {
      setOutputs(outs); setTests(res); setPhase('done');
    }
  };

  const limitMs = coding.timeLimitMin ? coding.timeLimitMin * 60_000 : null;
  const leftMs = limitMs && phase === 'running' ? Math.max(0, limitMs - (now - startedAt)) : null;
  useEffect(() => {
    if (phase !== 'running' || !limitMs) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase, limitMs]);
  useEffect(() => { if (leftMs === 0) void submit(); }, [leftMs]); // time is up

  const per = coding.problems.map((p) => ({ id: p.id, title: p.title, max: p.tests.reduce((a, t) => a + t.points, 0),
    got: p.tests.reduce((a, t, i) => a + (tests[`${p.id}:test${i}`]?.pass ? t.points : 0), 0) }));
  const total = { max: per.reduce((a, p) => a + p.max, 0), got: per.reduce((a, p) => a + p.got, 0) };
  const fmtTime = (ms: number) => `${Math.floor(ms / 60_000)}:${String(Math.floor((ms % 60_000) / 1000)).padStart(2, '0')}`;
  const locked = phase === 'grading' || phase === 'done';

  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 py-5" data-testid="coding-exam">
      <div className="card mb-4 border-l-4 p-5" style={{ borderLeftColor: mod.parsed.manifest.color }}>
        <div className="label">Mock exam · write the code</div>
        <h2 className="mb-1 text-xl font-semibold">{coding.title}</h2>
        {varsError ? <div className="text-sm text-bad">Couldn't build the data: {varsError}</div>
          : vars ? <Markdown text={coding.intro} scope={vars} /> : <div className="h-24 animate-pulse rounded-lg bg-panel2" />}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
          <span className="chip">{coding.problems.length} problems · {total.max} points</span>
          {coding.timeLimitMin && <span className="chip"><Clock size={12} /> {coding.timeLimitMin} min</span>}
          <span className={cn('chip', ready ? 'text-good' : stage.startsWith('error') ? 'text-bad' : '')} data-testid="python-stage">
            {ready ? 'Python ready' : stage.startsWith('error') ? `Python failed to load: ${stage.slice(7)}` : <><Loader2 size={12} className="animate-spin" /> {stage}</>}
          </span>
          {phase === 'intro' && <>
            <button className="btn-ghost btn-sm" onClick={() => setSeed(randomSeed())} title="A new dataset"><Dices size={13} /> Different data</button>
            <button className="btn-primary ml-auto" disabled={!vars} onClick={start} data-testid="coding-start"><Play size={14} /> Start the exam</button>
          </>}
          {phase === 'running' && leftMs !== null && <span className={cn('ml-auto font-mono font-semibold', leftMs < 10 * 60_000 ? 'text-bad' : 'text-ink')}><Clock size={14} className="inline" /> {fmtTime(leftMs)}</span>}
        </div>
        {phase === 'intro' && <ExamGuide coding className="mt-4" />}
      </div>

      {(phase === 'done' || phase === 'grading') && (
        <div className="card mb-4 p-5" data-testid="coding-score">
          {phase === 'grading' ? <div className="flex items-center gap-2 text-sm"><Loader2 size={16} className="animate-spin" /> Restarting the kernel and running every cell, then the tests…</div> : <>
            <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold"><Trophy size={18} /> {total.got} / {total.max} points</h3>
            <table className="w-full text-sm"><tbody>{per.map((p) => (
              <tr key={p.id} className="border-t border-line"><td className="py-1.5">{p.title}</td><td className="py-1.5 text-right font-mono">{p.got} / {p.max}</td></tr>
            ))}</tbody></table>
            <p className="mt-2 text-sm text-muted">Graded in a fresh kernel: cells top to bottom, then the tests. Each test cell's output is below.</p>
            <button className="btn mt-2" onClick={() => { clearAttempt(); setPhase('intro'); setSeed(randomSeed()); }}><Dices size={14} /> New exam</button>
          </>}
        </div>
      )}

      {phase !== 'intro' && vars && (
        <>
          {phase === 'running' && (
            <div className="sticky top-2 z-30 mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-panel/95 px-3 py-2 text-sm shadow-sm backdrop-blur" data-testid="coding-tools">
              <button className={cn('btn btn-sm', notesOpen && 'border-accent text-accent')} onClick={() => setNotesOpen((o) => !o)} aria-pressed={notesOpen}><NotebookPen size={13} /> Scratchpad</button>
              <button className="btn btn-sm" onClick={restart} disabled={!ready} title="Forget every variable, like Kernel → Restart"><RotateCcw size={13} /> Restart kernel</button>
              <span className="text-xs text-muted">Shift+Enter runs a cell. Cells share one kernel, like a notebook.</span>
              <button className="btn-primary btn-sm ml-auto" onClick={submit} data-testid="coding-submit"><Flag size={13} /> Submit</button>
            </div>
          )}
          <ScratchPad storageKey={`kodigo-exam-notes:${mod.id}:code:${seed}`} open={phase === 'running' && notesOpen} onClose={() => setNotesOpen(false)} />
          {phase === 'running' && <ExamGuide coding className="mb-4" defaultOpen={false} />}

          <section className="card mb-4 flex flex-col gap-3 p-5">
            <CodeCell label="Imports" code={code.setup ?? ''} onChange={(c) => setCell('setup', c)} onRun={() => runCell('setup', code.setup ?? '')}
              result={outputs.setup} running={running === 'setup'} disabled={!ready || locked} readOnly={locked} testId="cell-setup" />
            {!locked && <CodeCell label="Scratch cell (not graded): explore the files here" code={code.scratch ?? ''} onChange={(c) => setCell('scratch', c)}
              onRun={() => runCell('scratch', code.scratch ?? '')} result={outputs.scratch} running={running === 'scratch'} disabled={!ready} testId="cell-scratch" />}
          </section>

          {coding.problems.map((p) => (
            <section key={p.id} className="card mb-4 flex flex-col gap-3 p-5" data-coding-problem={p.id}>
              <h3 className="text-lg font-semibold">{p.title}</h3>
              <Markdown text={p.spec} scope={vars} />
              {p.hint && phase === 'running' && <ProblemHint><Markdown text={p.hint} scope={vars} /></ProblemHint>}
              <CodeCell label="Your code" code={code[p.id] ?? ''} onChange={(c) => setCell(p.id, c)} onRun={() => runCell(p.id, code[p.id] ?? '')}
                result={outputs[p.id]} running={running === p.id} disabled={!ready || locked} readOnly={locked} testId={`cell-${p.id}`} />
              {p.tests.map((t, i) => {
                const key = `${p.id}:test${i}`;
                return (
                  <CodeCell key={key} label={`Test cell · ${t.points} pts`} code={fill(t.code)} readOnly onRun={() => runTest(p.id, i)}
                    result={outputs[key]} running={running === key} disabled={!ready || locked} status={tests[key] ? (tests[key].pass ? 'pass' : 'fail') : null} testId={`test-${p.id}-${i}`} />
                );
              })}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
