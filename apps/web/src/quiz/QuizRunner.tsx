import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, BookMarked, Clock, Flag, RotateCcw, Trophy } from 'lucide-react';
import type { QuizInstance } from '@kodigo/schema';
import { useModuleStore, type LoadedModule } from '../modules/store';
import { getRunState, getSession, instantiate, newSession, randomSeed, saveRunState, QTYPE_LABEL, MODE_LABEL, type QuizSession } from './session';
import { QuestionView, emptyResponse, grade, isAnswered, type Graded } from './Question';
import { recordAttempt } from '../storage/progress';
import { cn } from '../lib/util';
import { usePopup } from '../lib/popup';

interface Slot { inst?: QuizInstance; mod?: LoadedModule; error?: string; response?: any; graded?: Graded | null; startedAt?: number; timeMs?: number }

export function QuizRunner() {
  const { sessionId } = useParams();
  const session = useMemo(() => (sessionId ? getSession(sessionId) : undefined), [sessionId]);
  if (!session) return <div className="mx-auto max-w-xl p-10 text-center text-muted">This quiz session has expired. <Link className="text-accent underline" to="/quiz">Build a new one</Link>.</div>;
  return <Runner key={session.id} session={session} />;
}

function Runner({ session }: { session: QuizSession }) {
  const store = useModuleStore();
  const nav = useNavigate();
  const popup = usePopup();
  // Restore answers saved for this session (e.g. after opening the lesson or glossary and coming back).
  const [saved] = useState(() => getRunState(session.id));
  const [slots, setSlots] = useState<Slot[]>(() => session.items.map((_, i) => {
    const sv = saved?.slots[i];
    return sv ? { response: sv.response, graded: (sv.graded as Graded | null | undefined) ?? undefined, startedAt: sv.startedAt, timeMs: sv.timeMs } : {};
  }));
  const [idx, setIdx] = useState(() => Math.min(saved?.idx ?? 0, session.items.length - 1));
  const [finished, setFinished] = useState(() => saved?.finished ?? false);
  const exam = session.mode === 'exam';
  const practice = !exam;
  const [deadline] = useState(() => saved?.deadline ?? (session.timeLimitSec ? Date.now() + session.timeLimitSec * 1000 : null));
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    saveRunState(session.id, {
      idx, finished, deadline,
      slots: slots.map((s) => ({ response: s.response, graded: s.graded ?? undefined, startedAt: s.startedAt, timeMs: s.timeMs })),
    });
  }, [slots, idx, finished]);

  useEffect(() => {
    let alive = true;
    session.items.forEach(async (it, i) => {
      try {
        const mod = await store.load(it.moduleId);
        const inst = await instantiate(mod, it);
        if (alive) setSlots((s) => {
          const n = s.slice();
          const prev = n[i];
          n[i] = { ...prev, inst, mod, response: prev.response !== undefined ? prev.response : emptyResponse(inst), graded: prev.graded ?? null, startedAt: prev.startedAt ?? (i === idx ? Date.now() : undefined) };
          return n;
        });
      } catch (e: any) {
        if (alive) setSlots((s) => { const n = s.slice(); n[i] = { ...n[i], error: String(e?.message ?? e) }; return n; });
      }
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!deadline || finished) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [deadline, finished]);
  // (wait until every question is rebuilt, so a resumed exam whose time ran out grades all answers)
  useEffect(() => { if (deadline && now >= deadline && !finished && slots.every((s) => s.inst || s.error)) finishExam(); }, [now, slots]);

  useEffect(() => { setSlots((s) => { const n = s.slice(); if (n[idx] && !n[idx].startedAt) n[idx] = { ...n[idx], startedAt: Date.now() }; return n; }); }, [idx]);

  const slot = slots[idx];
  const setResponse = (r: any) => setSlots((s) => { const n = s.slice(); n[idx] = { ...n[idx], response: r }; return n; });

  const record = async (i: number, g: Graded, sl: Slot) => {
    if (!sl.inst || !sl.mod || sl.mod.preview) return;
    await recordAttempt({
      key: sl.inst.key, templateId: sl.inst.templateId, moduleId: sl.inst.moduleId, seed: sl.inst.seed, type: sl.inst.type,
      skills: sl.inst.skills, score: g.score, response: g.response, timeMs: sl.timeMs ?? (sl.startedAt ? Date.now() - sl.startedAt : 0), mode: session.mode, difficulty: sl.inst.difficulty,
    });
  };

  const submit = () => {
    if (!slot?.inst) return;
    const g = grade(slot.inst, slot.response);
    const timeMs = slot.startedAt ? Date.now() - slot.startedAt : 0;
    setSlots((s) => { const n = s.slice(); n[idx] = { ...n[idx], graded: g, timeMs }; return n; });
    if (practice) record(idx, g, { ...slot, timeMs });
    if (exam) goNext();
  };
  const goNext = () => {
    if (idx < session.items.length - 1) setIdx(idx + 1);
    else if (exam) finishExam(); else setFinished(true);
  };
  const finishExam = () => {
    setSlots((s) => {
      const n = s.map((sl) => {
        if (!sl.inst) return sl;
        const g = sl.graded ?? grade(sl.inst, sl.response);
        return { ...sl, graded: g };
      });
      n.forEach((sl, i) => sl.graded && record(i, sl.graded, sl));
      return n;
    });
    setFinished(true);
  };

  const retryWrong = () => {
    const items = session.items.filter((_, i) => (slots[i].graded?.score ?? 0) < 1).map((it) => ({ ...it, seed: randomSeed() }));
    if (!items.length) return;
    const s = newSession('retry', items);
    nav(`/quiz/run/${s.id}`);
  };

  const total = session.items.length;
  const answered = slots.filter((s) => s.graded).length;
  const remaining = deadline ? Math.max(0, Math.round((deadline - now) / 1000)) : null;

  if (finished) return <Summary session={session} slots={slots} onRetry={retryWrong} />;

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-5">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="text-xs font-medium uppercase tracking-wide text-muted">{MODE_LABEL[session.mode] ?? session.mode}</div>
        <div className="flex flex-1 gap-1">
          {session.items.map((_, i) => (
            <button key={i} onClick={() => (exam || slots[i].graded || i <= answered) && setIdx(i)} aria-label={`question ${i + 1}`}
              className={cn('h-1.5 flex-1 rounded-full transition', i === idx ? 'bg-accent' : slots[i].graded ? (exam ? 'bg-accent/40' : slots[i].graded!.correct ? 'bg-good' : slots[i].graded!.score > 0 ? 'bg-warn' : 'bg-bad') : 'bg-line')} />
          ))}
        </div>
        {remaining !== null && <span className={cn('flex items-center gap-1 font-mono text-sm', remaining < 60 && 'text-bad')}><Clock size={14} /> {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</span>}
        <button className="btn btn-sm" onClick={() => popup.open({ title: 'Glossary', src: '/glossary', note: 'Your quiz stays open underneath' })} data-testid="quiz-glossary"><BookMarked size={13} /> Glossary</button>
        {exam && <button className="btn btn-sm" onClick={finishExam}><Flag size={13} /> Finish</button>}
      </div>
      <div className="card p-5" data-testid="question">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="font-semibold text-ink">Question {idx + 1} of {total}</span>
          {slot?.inst && <>
            <span className="chip">{QTYPE_LABEL[slot.inst.type]}</span>
            <span className="chip">{['', 'warm-up', 'standard', 'exam-hard'][slot.inst.difficulty]}</span>
            <span className="chip" style={{ borderColor: slot.mod?.parsed.manifest.color }}>{slot.mod?.parsed.manifest.shortTitle}</span>
            {slot.inst.templateId.startsWith('glossary-') && <span className="chip">glossary</span>}
          </>}
        </div>
        {slot?.error ? <div className="text-sm text-bad">Couldn't generate this question: {slot.error}</div>
          : !slot?.inst ? <div className="h-40 animate-pulse rounded-lg bg-panel2" />
          : <QuestionView key={idx} inst={slot.inst} mod={slot.mod!} response={slot.response} setResponse={setResponse} graded={exam ? null : slot.graded ?? null} reveal={practice && !!slot.graded} practice={practice} />}
        <div className="mt-4 flex items-center justify-between gap-2">
          <button className="btn" onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0}>Back</button>
          {slot?.error ? <button className="btn-primary" onClick={goNext}>Skip <ArrowRight size={15} /></button>
            : practice && slot?.graded ? <button className="btn-primary" onClick={goNext} data-testid="next-question">{idx === total - 1 ? 'See results' : 'Next'} <ArrowRight size={15} /></button>
            : <button className="btn-primary" onClick={submit} disabled={!slot?.inst || (practice && !isAnswered(slot.inst, slot.response))} data-testid="submit-answer">{exam ? (idx === total - 1 ? 'Save & finish' : 'Save & next') : 'Check answer'}</button>}
        </div>
      </div>
      <div className="mt-2 text-center text-xs text-muted" data-testid="question-meta">Seed {slot?.inst?.seed} · {slot?.inst?.templateId}</div>
    </div>
  );
}

function Summary({ session, slots, onRetry }: { session: QuizSession; slots: Slot[]; onRetry: () => void }) {
  const graded = slots.filter((s) => s.graded && s.inst);
  const score = graded.reduce((a, s) => a + s.graded!.score, 0);
  const pct = graded.length ? score / graded.length : 0;
  const bySkill: Record<string, { label: string; sum: number; n: number }> = {};
  for (const s of graded) {
    for (const k of s.inst!.skills.length ? s.inst!.skills : ['(glossary)']) {
      const label = s.mod?.parsed.manifest.skills.find((x) => x.id === k)?.label ?? k;
      const key = `${s.inst!.moduleId}:${k}`;
      bySkill[key] ??= { label: `${s.mod?.parsed.manifest.shortTitle}: ${label}`, sum: 0, n: 0 };
      bySkill[key].sum += s.graded!.score;
      bySkill[key].n += 1;
    }
  }
  const [open, setOpen] = useState<number | null>(null);
  const wrong = slots.filter((s) => (s.graded?.score ?? 0) < 1).length;
  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-6">
      <div className="card flex flex-wrap items-center gap-4 p-5">
        <Trophy size={36} className={pct >= 0.8 ? 'text-good' : pct >= 0.5 ? 'text-warn' : 'text-bad'} />
        <div className="flex-1">
          <div className="text-2xl font-semibold">{Math.round(pct * 100)}%</div>
          <div className="text-sm text-muted">{score.toFixed(1)} / {graded.length} points · {MODE_LABEL[session.mode]}</div>
        </div>
        {wrong > 0 && <button className="btn" onClick={onRetry}><RotateCcw size={15} /> Retry {wrong} missed with new numbers</button>}
        <Link to="/quiz" className="btn-primary">New quiz</Link>
      </div>
      <h3 className="mb-2 mt-6 font-semibold">By skill</h3>
      <div className="card divide-y divide-line">
        {Object.entries(bySkill).sort((a, b) => a[1].sum / a[1].n - b[1].sum / b[1].n).map(([k, v]) => (
          <div key={k} className="flex items-center gap-3 px-4 py-2 text-sm">
            <span className="flex-1">{v.label}</span>
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-line"><div className={cn('h-full', v.sum / v.n >= 0.8 ? 'bg-good' : v.sum / v.n >= 0.5 ? 'bg-warn' : 'bg-bad')} style={{ width: `${(v.sum / v.n) * 100}%` }} /></div>
            <span className="w-12 text-right font-mono text-xs">{Math.round((v.sum / v.n) * 100)}%</span>
          </div>
        ))}
      </div>
      <h3 className="mb-2 mt-6 font-semibold">Questions</h3>
      <div className="flex flex-col gap-2">
        {slots.map((s, i) => s.inst && (
          <div key={i} className="card">
            <button className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm" onClick={() => setOpen(open === i ? null : i)}>
              <span className={cn('h-2.5 w-2.5 rounded-full', s.graded?.correct ? 'bg-good' : (s.graded?.score ?? 0) > 0 ? 'bg-warn' : 'bg-bad')} />
              <span className="font-medium">Q{i + 1}</span>
              <span className="truncate text-muted">{QTYPE_LABEL[s.inst.type]} · {s.mod?.parsed.manifest.shortTitle} · {s.inst.templateId}</span>
              <span className="ml-auto font-mono text-xs">{Math.round((s.graded?.score ?? 0) * 100)}%</span>
            </button>
            {open === i && s.mod && <div className="border-t border-line p-4"><QuestionView inst={s.inst} mod={s.mod} response={s.response} setResponse={() => {}} graded={s.graded ?? null} reveal practice={false} /></div>}
          </div>
        ))}
      </div>
    </div>
  );
}
