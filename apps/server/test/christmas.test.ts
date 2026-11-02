import { describe, expect, it } from 'vitest';
import { christmasStatus, localDate, parseMode } from '../src/christmas/schedule';
import { DAYS } from '../src/christmas/days';

const at = (iso: string) => new Date(iso);
const open = (s: ReturnType<typeof christmasStatus>) => (s.active ? s.days.filter((d) => d.unlocked).map((d) => d.n) : []);

describe('christmas countdown', () => {
  it('has twelve days, 12 down to 1, each with questions whose answers exist', () => {
    expect(DAYS.map((d) => d.n)).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    for (const d of DAYS) {
      expect(d.questions.length).toBeGreaterThan(0);
      for (const q of d.questions) expect(q.options[q.answer]).toBeDefined();
    }
    expect(new Set(DAYS.flatMap((d) => d.questions.map((q) => q.id))).size).toBe(DAYS.reduce((a, d) => a + d.questions.length, 0));
  });

  it('is hidden out of season, with no content at all', () => {
    expect(christmasStatus(at('2026-11-03T04:00:00Z'), 'auto')).toEqual({ active: false });
    expect(christmasStatus(at('2026-12-12T15:00:00Z'), 'auto')).toEqual({ active: false }); // Dec 12, 11 PM Manila
    expect(christmasStatus(at('2027-01-07T01:00:00Z'), 'auto')).toEqual({ active: false });
  });

  it('opens a door a day, by Manila time, and sends only open days\' content', () => {
    const s = christmasStatus(at('2026-12-14T16:30:00Z'), 'auto'); // Dec 15, 00:30 Manila; still Dec 14 in UTC
    expect(s.active && s.today).toBe('2026-12-15');
    expect(s.active && s.current).toBe(10);
    expect(open(s)).toEqual([12, 11, 10]);
    if (!s.active) throw new Error('expected active');
    for (const d of s.days) {
      if (d.unlocked) expect(d.questions?.length).toBeGreaterThan(0);
      else expect(Object.keys(d).sort()).toEqual(['date', 'n', 'unlocked']);
    }
    expect(JSON.stringify(s)).not.toContain(DAYS.find((d) => d.n === 1)!.title);
  });

  it('opens day 12 on Dec 13 and day 1 on Christmas Eve, then keeps everything open until Epiphany', () => {
    expect(open(christmasStatus(new Date(), 'auto', 'Asia/Manila', '2026-12-13'))).toEqual([12]);
    const eve = christmasStatus(new Date(), 'auto', 'Asia/Manila', '2026-12-24');
    expect(eve.active && eve.current).toBe(1);
    expect(open(eve)).toHaveLength(12);
    const jan = christmasStatus(new Date(), 'auto', 'Asia/Manila', '2027-01-06');
    expect(jan.active && jan.year).toBe(2026);
    expect(jan.active && jan.current).toBeNull();
    expect(open(jan)).toHaveLength(12);
  });

  it('lets the host force it on or off', () => {
    expect(open(christmasStatus(at('2026-11-03T04:00:00Z'), 'on'))).toHaveLength(12);
    expect(christmasStatus(new Date(), 'off', 'Asia/Manila', '2026-12-20')).toEqual({ active: false });
    expect(parseMode(' ON ')).toBe('on');
    expect(parseMode('off')).toBe('off');
    expect(parseMode(undefined)).toBe('auto');
    expect(parseMode('yes please')).toBe('auto');
  });

  it('falls back to +08:00 for an unknown time zone', () => {
    expect(localDate(at('2026-12-14T16:30:00Z'), 'Not/AZone')).toEqual({ y: 2026, m: 12, d: 15 });
  });
});
