/**
 * Christmas countdown: which of the 12 days are open. Day n opens on Dec (25 - n): "12" on Dec 13, down to "1" on
 * Christmas Eve. Opened days stay open; from Christmas Day to Epiphany (Jan 6) all 12 are open, then it hides again.
 * Only open days' content leaves the server, so a locked day can't be read from the page.
 */
import { DAYS, type ChristmasDay } from './days';

/** `auto`: follow the calendar · `on`: everything open now (host preview) · `off`: hidden */
export type ChristmasMode = 'auto' | 'on' | 'off';

export interface DayStatus extends Partial<Omit<ChristmasDay, 'n'>> { n: number; date: string; unlocked: boolean }
export type ChristmasStatus =
  | { active: false }
  | { active: true; year: number; today: string; mode: ChristmasMode; /** the number whose day is today (null on/after Christmas) */ current: number | null; days: DayStatus[] };

export const parseMode = (s: string | undefined): ChristmasMode => {
  const v = (s ?? '').trim().toLowerCase();
  return v === 'on' || v === 'off' ? v : 'auto';
};

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** The calendar date at `now` in `tz` (Manila has no DST, so +08:00 is the fallback if the zone is unknown). */
export function localDate(now: Date, tz: string): { y: number; m: number; d: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    return { y: get('year'), m: get('month'), d: get('day') };
  } catch {
    const t = new Date(now.getTime() + 8 * 3600_000);
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
  }
}

/** `fakeToday` (YYYY-MM-DD) replaces the clock, for previews and tests. */
export function christmasStatus(now: Date, mode: ChristmasMode, tz = 'Asia/Manila', fakeToday?: string): ChristmasStatus {
  if (mode === 'off') return { active: false };
  const fake = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fakeToday?.trim() ?? '');
  const { y, m, d } = fake ? { y: +fake[1], m: +fake[2], d: +fake[3] } : localDate(now, tz);
  // Jan 1-6 still belong to last year's Christmas
  const year = m === 1 ? y - 1 : y;
  const inSeason = (m === 12 && d >= 13) || (m === 1 && d <= 6);
  if (mode === 'auto' && !inSeason) return { active: false };
  const today = iso(y, m, d);
  const days = DAYS.map((day): DayStatus => {
    const date = iso(year, 12, 25 - day.n);
    const unlocked = mode === 'on' || today >= date;
    return unlocked ? { ...day, date, unlocked } : { n: day.n, date, unlocked };
  });
  const current = m === 12 && d >= 13 && d <= 24 ? 25 - d : null;
  return { active: true, year, today, mode, current, days };
}
