import type { ChristmasStatus } from '../lib/api';
import type { Highlight } from '../app/highlights';

/** Today's door as a dashboard banner. The id changes daily, so dismissing today's doesn't hide tomorrow's. */
export function christmasHighlight(s: ChristmasStatus | undefined): Highlight | null {
  if (!s?.active) return null;
  const day = s.days.find((d) => d.n === s.current && d.unlocked);
  if (day) return {
    id: `xmas-${s.year}-d${day.n}`,
    title: `${day.n} day${day.n === 1 ? '' : 's'} to Christmas: ${day.title}`,
    blurb: `Today's door is open. Learn the Christmas facts behind the number ${day.n}, then take its quick quiz.`,
    to: `/christmas?day=${day.n}`,
    badge: 'Today',
    festive: true,
  };
  if (s.today < `${s.year}-12-25`) return {
    id: `xmas-${s.year}-preview`,
    title: 'Christmas countdown preview: all 12 doors are open',
    blurb: 'Twelve days of Christmas facts, from the number 12 down to 1, each with a quick quiz.',
    to: '/christmas',
    badge: 'New',
    festive: true,
  };
  return {
    id: `xmas-${s.year}-all`,
    title: 'Merry Christmas! All 12 doors are open',
    blurb: 'Catch up on any day of the countdown you missed, from 12 down to 1.',
    to: '/christmas',
    badge: 'New',
    festive: true,
  };
}
