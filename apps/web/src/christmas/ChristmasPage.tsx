import { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Check, Gift, Lock, X } from 'lucide-react';
import type { ChristmasDay, ChristmasQuestion } from '../lib/api';
import { readAnswers, useChristmas, writeAnswers } from './useChristmas';
import { Markdown } from '../lib/md';
import { cn } from '../lib/util';

const dateLabel = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export function ChristmasPage() {
  const s = useChristmas();
  const [params, setParams] = useSearchParams();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const year = s?.active ? s.year : 0;
  useEffect(() => { if (year) setAnswers(readAnswers(year)); }, [year]);

  if (!s) return <div className="mx-auto w-full max-w-[1000px] px-4 py-6"><div className="card h-64 animate-pulse" /></div>;
  if (!s.active) return <Navigate to="/" replace />;

  const open = s.days.filter((d) => d.unlocked);
  const wanted = Number(params.get('day'));
  const pick = open.find((d) => d.n === wanted) ?? open.find((d) => d.n === s.current) ?? open[open.length - 1];
  const scoreOf = (d: ChristmasDay) => (d.questions ?? []).filter((q) => answers[q.id] === q.answer).length;
  const answer = (q: ChristmasQuestion, i: number) => {
    if (answers[q.id] !== undefined) return;
    const next = { ...answers, [q.id]: i };
    setAnswers(next);
    writeAnswers(s.year, next);
  };
  const left = s.current;
  const after = s.today >= `${s.year}-12-25`;

  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 py-6" data-testid="christmas">
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><span aria-hidden>🎄</span> 12 Days to Christmas</h1>
        <p className="text-muted">
          Each day is a number, and the facts behind it.{' '}
          {left ? `${left} day${left === 1 ? '' : 's'} to go: a new door opens every day until Christmas Eve.`
            : after ? 'Merry Christmas! Every door is open, so catch up on any you missed.'
            : 'Preview: every door is open early.'}
        </p>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6" role="list" aria-label="Countdown days">
        {s.days.map((d) => {
          const on = d.n === pick?.n;
          const total = d.questions?.length ?? 0;
          const score = scoreOf(d);
          const done = total > 0 && (d.questions ?? []).every((q) => answers[q.id] !== undefined);
          return (
            <button
              key={d.n}
              role="listitem"
              type="button"
              disabled={!d.unlocked}
              onClick={() => setParams({ day: String(d.n) }, { replace: true })}
              aria-current={on ? 'true' : undefined}
              aria-label={d.unlocked ? `Day ${d.n}: ${d.title}` : `Day ${d.n}, opens ${dateLabel(d.date)}`}
              className={cn('xmas-door card relative flex aspect-square flex-col items-center justify-center gap-0.5 p-2 text-center transition', d.unlocked ? 'hover:bg-panel2' : 'xmas-door-locked cursor-not-allowed', on && 'ring-2 ring-[rgb(var(--xmas-red))]', d.n === s.current && 'xmas-today')}
            >
              <span className="text-2xl font-bold leading-none tabular-nums">{d.n}</span>
              {d.unlocked
                ? <span className="text-xl leading-none" aria-hidden>{d.emoji}</span>
                : <Lock size={16} className="text-muted" aria-hidden />}
              <span className="text-[10px] text-muted">{d.unlocked && done ? `${score}/${total}` : dateLabel(d.date)}</span>
              {done && score === total && <Check size={14} className="absolute right-1.5 top-1.5 text-[rgb(var(--xmas-green))]" aria-hidden />}
            </button>
          );
        })}
      </div>

      {pick && <DayView key={pick.n} day={pick} answers={answers} onAnswer={answer} />}
    </div>
  );
}

function DayView({ day, answers, onAnswer }: { day: ChristmasDay; answers: Record<string, number>; onAnswer: (q: ChristmasQuestion, i: number) => void }) {
  return (
    <section className="card overflow-hidden" aria-label={`Day ${day.n}`}>
      <div className="xmas-stripe h-1.5" />
      <div className="p-5">
        <div className="label">Number {day.n} · {dateLabel(day.date)}</div>
        <h2 className="mb-2 flex items-center gap-2 text-xl font-semibold"><span aria-hidden>{day.emoji}</span> {day.title}</h2>
        <Markdown text={day.lesson} raw className="text-[15px]" />
        <div className="mt-5 grid gap-4">
          {(day.questions ?? []).map((q, qi) => {
            const picked = answers[q.id];
            const shown = picked !== undefined;
            return (
              <div key={q.id} className="rounded-xl border border-line p-4">
                <div className="mb-2 font-medium"><span className="text-muted">{qi + 1}.</span> <Markdown text={q.prompt} raw inline /></div>
                <div className="grid gap-1.5">
                  {q.options.map((o, i) => {
                    const right = shown && i === q.answer;
                    const wrong = shown && i === picked && i !== q.answer;
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={shown}
                        onClick={() => onAnswer(q, i)}
                        className={cn('flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition', !shown && 'border-line hover:bg-panel2', right && 'tone-good mark-bg border-transparent', wrong && 'tone-bad mark-bg border-transparent', shown && !right && !wrong && 'border-line opacity-60')}
                      >
                        <span className="flex-1"><Markdown text={o} raw inline /></span>
                        {right && <Check size={15} className="mark-text tone-good" aria-label="correct" />}
                        {wrong && <X size={15} className="mark-text tone-bad" aria-label="your answer" />}
                      </button>
                    );
                  })}
                </div>
                {shown && (
                  <div className="mt-2 flex gap-2 text-sm text-muted">
                    <Gift size={15} className="mt-0.5 shrink-0 text-[rgb(var(--xmas-red))]" aria-hidden />
                    <Markdown text={q.explain} raw className="flex-1" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
