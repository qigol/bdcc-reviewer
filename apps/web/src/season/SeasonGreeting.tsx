import { useEffect, useState } from 'react';
import { Flame, RotateCw } from 'lucide-react';
import { useReducedMotion } from '../lib/reducedMotion';
import { useSeason } from './useSeason';

interface Quote { text: string; by: string }

// real quotes, with satirical twists on famous ones in between (attributions on those are invented and say so by their tone)
export const HELL_WEEK_QUOTES: Quote[] = [
  { text: "If you're going through hell, keep going.", by: 'Often attributed to Winston Churchill' },
  { text: 'Study 25 hours a day, 8 days a week. Sleep is a group project nobody showed up to.', by: 'Hell Week management' },
  { text: 'The best way out is always through.', by: 'Robert Frost' },
  { text: 'To sleep, perchance to pass.', by: 'Hamlet, finals week' },
  { text: 'Hell is empty, and all the devils are here.', by: 'Shakespeare, The Tempest' },
  { text: 'You miss 100% of the exams you sleep through.', by: 'Your alarm, snoozed 6 times' },
  { text: 'Fall seven times, stand up eight.', by: 'Japanese proverb' },
  { text: 'I think, therefore I am late.', by: "Descartes' roommate" },
  { text: "Rest when you're dead. Or after Friday, whichever comes first.", by: 'Your study plan' },
  { text: 'It always seems impossible until it is done.', by: 'Often attributed to Nelson Mandela' },
  { text: 'Veni, vidi, crammed.', by: 'Julius, the night before' },
  { text: "Don't count the days. The days are counting you.", by: 'The countdown' },
  { text: 'That which does not kill me had better not be cumulative.', by: "Nietzsche's study group" },
  { text: 'This too shall pass. Hopefully with a 75.', by: 'Persian adage, revised' },
  { text: 'Give me caffeine, or give me an extension.', by: 'Patrick, sophomore' },
  { text: 'Caffeine is just optimism with a deadline.', by: 'Your third iced coffee' },
  { text: 'The only thing we have to fear is the curve itself.', by: 'A fireside chat at 2 AM' },
  { text: 'The mind is its own place, and in itself can make a heaven of hell.', by: 'John Milton, Paradise Lost' },
  { text: 'Ask not what your notes can do for you. Ask why you never took any.', by: 'The inaugural cram session' },
  { text: 'Keep calm and cram on.', by: 'Poster, redrafted' },
  { text: 'Carpe diem. Carpe noctem too, apparently.', by: 'Latin elective' },
  { text: 'Dream big. Then wake up: it is 3 AM and the exam is at 9.', by: 'Your group chat' },
  { text: 'Hope is the thing with feathers. Panic is the thing with deadlines.', by: 'Emily, cramming' },
];

export const MARIAN_VERSES: Quote[] = [
  { text: 'Hail, full of grace, the Lord is with thee: blessed art thou among women.', by: 'Luke 1:28 (Douay-Rheims)' },
  { text: 'My soul doth magnify the Lord.', by: 'Luke 1:46 (Douay-Rheims)' },
  { text: 'Behold the handmaid of the Lord; be it done to me according to thy word.', by: 'Luke 1:38 (Douay-Rheims)' },
];

function useRotation(length: number, ms: number) {
  const reduced = useReducedMotion();
  const [i, setI] = useState(() => Math.floor(Math.random() * length));
  useEffect(() => {
    if (reduced) return;
    const t = window.setInterval(() => setI((x) => x + 1), ms);
    return () => window.clearInterval(t);
  }, [reduced, ms]);
  return [i % length, () => setI((x) => x + 1)] as const;
}

function Rotating({ list, ms, label, quoteClass }: { list: Quote[]; ms: number; label: string; quoteClass: string }) {
  const [i, next] = useRotation(list.length, ms);
  const q = list[i];
  return (
    <figure className="mt-2 flex max-w-2xl items-start gap-2">
      <div className="min-w-0 flex-1" aria-live="polite">
        <blockquote className={quoteClass}>{q.text}</blockquote>
        <figcaption className="mt-0.5 text-xs text-muted">{q.by}</figcaption>
      </div>
      <button className="btn-ghost btn-sm shrink-0" onClick={next} aria-label={label} title={label}><RotateCw size={15} /></button>
    </figure>
  );
}

/** The dashboard's title block, dressed for the season. */
export function SeasonGreeting() {
  const season = useSeason();
  if (season === 'hellweek') return (
    <div className="mb-5" data-testid="season-greeting">
      <h1 className="flex items-center gap-2 text-2xl font-bold"><Flame size={24} className="text-accent" aria-hidden /> Survive the week.</h1>
      <Rotating list={HELL_WEEK_QUOTES} ms={12000} label="Another quote" quoteClass="italic text-ink/80" />
    </div>
  );
  if (season === 'immaculate') return (
    <div className="mb-5" data-testid="season-greeting">
      <div className="label text-accent">Solemnity of the Immaculate Conception</div>
      <h1 className="mt-1 font-serif text-3xl font-semibold">A day of grace.</h1>
      <Rotating list={MARIAN_VERSES} ms={15000} label="Another verse" quoteClass="font-serif text-lg italic text-ink/85" />
    </div>
  );
  return (
    <div className="mb-5">
      <h1 className="text-2xl font-bold">Qdigo</h1>
      <p className="text-muted">Q's got your Qs.</p>
    </div>
  );
}
