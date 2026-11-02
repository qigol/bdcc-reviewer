import { describe, expect, it } from 'vitest';
import { calibration, srsGrade } from '../src/storage/confidence';

describe('srsGrade', () => {
  it('follows the score when there is no rating', () => {
    expect(srsGrade(1)).toBe(5);
    expect(srsGrade(0.6)).toBe(3);
    expect(srsGrade(0)).toBe(1);
  });
  it('sends confidently wrong answers back soonest', () => {
    expect(srsGrade(0, 3)).toBe(0);
    expect(srsGrade(0, 3)).toBeLessThan(srsGrade(0, 1));
  });
  it('treats a lucky guess as a miss (grade < 3 means re-solve later today)', () => {
    expect(srsGrade(1, 1)).toBe(2);
  });
  it('caps "fairly sure" below a confident full mark', () => {
    expect(srsGrade(1, 2)).toBe(4);
    expect(srsGrade(1, 3)).toBe(5);
  });
});

describe('calibration', () => {
  it('counts per level, confidently wrong and lucky guesses', () => {
    const c = calibration([
      { confidence: 3, correct: true, score: 1 },
      { confidence: 3, correct: false, score: 0 },
      { confidence: 1, correct: true, score: 1 },
      { correct: false, score: 0 },
    ]);
    expect(c.rated).toBe(3);
    expect(c.byLevel[3]).toEqual({ n: 2, right: 1 });
    expect(c.confidentlyWrong).toBe(1);
    expect(c.luckyGuesses).toBe(1);
  });
});
