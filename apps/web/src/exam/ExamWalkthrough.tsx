import { useState } from 'react';
import { Eye, Shuffle } from 'lucide-react';
import type { ExamFile } from '@kodigo/schema';
import { Markdown } from '../lib/md';
import type { CellResult } from '../py/python';
import { CodeCell } from './CodeCell';

type CodingProblem = NonNullable<ExamFile['coding']>['problems'][number];

/**
 * After submit: one problem rebuilt step by step on the attempt's own data (every step runs in the same kernel), then
 * its twists: the spec changed so the code must change, with a test cell and the solution on request. The walkthrough
 * steps and twist solutions are the reference that scripts/exam-check runs in real pandas.
 */
export function ProblemWalkthrough({ problem, vars, fill, run, outputs, running, ready }: {
  problem: CodingProblem; vars: Record<string, any>; fill: (t: string) => string;
  run: (key: string, code: string) => Promise<CellResult | null>;
  outputs: Record<string, CellResult>; running: string | null; ready: boolean;
}) {
  const [twistCode, setTwistCode] = useState<Record<string, string>>({});
  const [passed, setPassed] = useState<Record<string, boolean>>({});
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const steps = problem.walkthrough ?? [];
  const twists = problem.twists ?? [];
  const runTest = async (key: string, code: string) => {
    const r = await run(key, code);
    if (r) setPassed((p) => ({ ...p, [key]: !r.err && !r.timedOut }));
  };
  return (
    <div className="mt-2 flex flex-col gap-3 rounded-xl border border-accent/40 bg-accent/5 p-4" data-walkthrough={problem.id}>
      {steps.length > 0 && <div className="label text-accent">Walkthrough: run each step in order</div>}
      {steps.map((s, i) => {
        const key = `wt:${problem.id}:${i}`;
        return (
          <div key={key} className="flex flex-col gap-1.5">
            <div className="text-sm"><b>Step {i + 1}.</b> <Markdown text={s.say} scope={vars} inline /></div>
            <CodeCell label={`Step ${i + 1}`} code={fill(s.code)} readOnly onRun={() => run(key, fill(s.code))}
              result={outputs[key]} running={running === key} disabled={!ready} testId={`step-${problem.id}-${i}`} />
          </div>
        );
      })}
      {twists.length > 0 && <div className="label mt-2 flex items-center gap-1.5 text-accent"><Shuffle size={13} /> Try a twist: the spec changes, so the code must change</div>}
      {twists.map((t) => {
        const ck = `tw:${problem.id}:${t.id}`;
        const src = twistCode[ck] ?? fill(t.stub);
        return (
          <div key={ck} className="flex flex-col gap-2 rounded-xl border border-line bg-panel p-3" data-twist={`${problem.id}:${t.id}`}>
            <div className="font-semibold">{t.title}</div>
            <div className="rounded-lg bg-warn/10 px-3 py-1.5 text-sm"><b>What changed:</b> <Markdown text={t.change} scope={vars} inline /></div>
            <Markdown text={t.spec} scope={vars} />
            <CodeCell label="Your code" code={src} onChange={(c) => setTwistCode((s) => ({ ...s, [ck]: c }))} onRun={() => run(ck, src)}
              result={outputs[ck]} running={running === ck} disabled={!ready} testId={`twist-${problem.id}-${t.id}`} />
            {t.tests.map((tc, i) => {
              const tk = `${ck}:test${i}`;
              return <CodeCell key={tk} label="Test cell" code={fill(tc)} readOnly onRun={() => runTest(tk, fill(tc))} result={outputs[tk]}
                running={running === tk} disabled={!ready} status={tk in passed ? (passed[tk] ? 'pass' : 'fail') : null} testId={`twist-test-${problem.id}-${t.id}-${i}`} />;
            })}
            {!shown[ck]
              ? <button className="btn btn-sm self-start" onClick={() => setShown((s) => ({ ...s, [ck]: true }))}><Eye size={13} /> Show solution</button>
              : <CodeCell label="Solution (run it, then the test cell)" code={fill(t.solution)} readOnly onRun={() => run(`${ck}:solution`, fill(t.solution))}
                  result={outputs[`${ck}:solution`]} running={running === `${ck}:solution`} disabled={!ready} testId={`twist-solution-${problem.id}-${t.id}`} />}
          </div>
        );
      })}
    </div>
  );
}
