import { describe, expect, it } from 'vitest';
import { parseSeasonMode, seasonStatus } from '../src/season';
import { loadConfig } from '../src/config';
import { christmasStatus } from '../src/christmas/schedule';

const on = (day: string, mode = parseSeasonMode(undefined), xmas: 'auto' | 'on' | 'off' = 'auto') => seasonStatus(new Date(), mode, 'Asia/Manila', day, xmas).season;

describe('seasonal look', () => {
  it('follows the calendar: Hell Week, then the Immaculate Conception, then Christmas', () => {
    expect(on('2026-11-09')).toBeNull();
    expect(on('2026-11-10')).toBe('hellweek');
    expect(on('2026-12-07')).toBe('hellweek');
    expect(on('2026-12-08')).toBe('immaculate');
    expect(on('2026-12-09')).toBe('christmas');
    expect(on('2026-12-25')).toBe('christmas');
    expect(on('2027-01-06')).toBe('christmas');
    expect(on('2027-01-07')).toBeNull();
    expect(on('2027-07-01')).toBeNull();
  });

  it('uses Manila time at the day boundaries', () => {
    // Dec 7, 23:59 Manila
    expect(seasonStatus(new Date('2026-12-07T15:59:00Z'), 'auto').season).toBe('hellweek');
    // Dec 8, 00:01 Manila, still Dec 7 in UTC
    const s = seasonStatus(new Date('2026-12-07T16:01:00Z'), 'auto');
    expect(s).toEqual({ season: 'immaculate', today: '2026-12-08', range: { start: '2026-12-08', end: '2026-12-08' } });
    expect(seasonStatus(new Date(), 'auto', 'Asia/Manila', '2026-11-11').range).toEqual({ start: '2026-11-10', end: '2026-12-07' });
    expect(seasonStatus(new Date(), 'auto', 'Asia/Manila', '2027-01-03').range).toEqual({ start: '2026-12-09', end: '2027-01-06' });
    expect(seasonStatus(new Date(), 'auto', 'Asia/Manila', '2027-03-01')).toEqual({ season: null, today: '2027-03-01' });
    expect(seasonStatus(new Date('2026-12-08T16:30:00Z'), 'auto').season).toBe('christmas');
  });

  it('shows the Christmas look from Dec 9 while the countdown still opens on Dec 13', () => {
    expect(on('2026-12-12')).toBe('christmas');
    expect(christmasStatus(new Date(), 'auto', 'Asia/Manila', '2026-12-12')).toEqual({ active: false });
  });

  it('turning Christmas off drops the Christmas look but keeps the others', () => {
    expect(on('2026-12-20', 'auto', 'off')).toBeNull();
    expect(on('2026-11-20', 'auto', 'off')).toBe('hellweek');
  });

  it('SEASON_THEME forces or disables a theme', () => {
    expect(parseSeasonMode('IMMACULATE')).toBe('immaculate');
    expect(parseSeasonMode('nonsense')).toBe('auto');
    expect(on('2026-07-01', 'hellweek')).toBe('hellweek');
    expect(on('2026-11-20', 'off')).toBeNull();
    expect(loadConfig({ SEASON_THEME: 'off' }).season.mode).toBe('off');
    expect(loadConfig({}).season.mode).toBe('auto');
  });
});
