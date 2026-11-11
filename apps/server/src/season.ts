/**
 * Seasonal look: which cosmetic theme the site wears today. Purely visual; it changes no content or study data.
 * Hell Week Nov 10 – Dec 7 · Immaculate Conception Dec 8 · Christmas Dec 9 – Jan 6 (the 12-door countdown in
 * `christmas/schedule.ts` still opens its first door on Dec 13) · no theme otherwise.
 */
import { localDate, type ChristmasMode } from './christmas/schedule';

export type Season = 'hellweek' | 'immaculate' | 'christmas';
/** `auto`: follow the calendar · `off`: never · a season's name: always that one (host preview) */
export type SeasonMode = 'auto' | 'off' | Season;
export interface SeasonStatus { season: Season | null; today: string }

const SEASONS: Season[] = ['hellweek', 'immaculate', 'christmas'];
export const parseSeasonMode = (s: string | undefined): SeasonMode => {
  const v = (s ?? '').trim().toLowerCase();
  return v === 'off' || (SEASONS as string[]).includes(v) ? (v as SeasonMode) : 'auto';
};

const pad = (n: number) => String(n).padStart(2, '0');

/** The calendar season. `christmasMode` 'off' also drops the Christmas look, so turning Christmas off turns all of it off. */
export function seasonFor(m: number, d: number, christmasMode: ChristmasMode = 'auto'): Season | null {
  if ((m === 11 && d >= 10) || (m === 12 && d <= 7)) return 'hellweek';
  if (m === 12 && d === 8) return 'immaculate';
  if ((m === 12 && d >= 9) || (m === 1 && d <= 6)) return christmasMode === 'off' ? null : 'christmas';
  return null;
}

/** `fakeToday` (YYYY-MM-DD) replaces the clock, for previews and tests (same as the Christmas countdown). */
export function seasonStatus(now: Date, mode: SeasonMode, tz = 'Asia/Manila', fakeToday?: string, christmasMode: ChristmasMode = 'auto'): SeasonStatus {
  const fake = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fakeToday?.trim() ?? '');
  const { y, m, d } = fake ? { y: +fake[1], m: +fake[2], d: +fake[3] } : localDate(now, tz);
  const today = `${y}-${pad(m)}-${pad(d)}`;
  if (mode === 'off') return { season: null, today };
  if (mode !== 'auto') return { season: mode, today };
  return { season: seasonFor(m, d, christmasMode), today };
}
