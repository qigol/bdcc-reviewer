import { describe, expect, it } from 'vitest';
import { calculatorMode } from '@kodigo/schema';
import { CalcError, evalCalc, formatCalc, plainCalc } from '../src/lib/calc';

describe('evalCalc', () => {
  it('does arithmetic with precedence and parentheses', () => {
    expect(evalCalc('2 + 3 * 4')).toBe(14);
    expect(evalCalc('(2 + 3) * 4')).toBe(20);
    expect(evalCalc('10 / 4 - 1')).toBe(1.5);
    expect(evalCalc('-3 + 5')).toBe(2);
    expect(evalCalc('2(3 + 4)')).toBe(14);
    expect(evalCalc('(1 + 1)(2 + 3)')).toBe(10);
  });

  it('reads what learners copy from accounting questions', () => {
    expect(evalCalc('₱12,500 + 1,234.50')).toBe(13734.5);
    expect(evalCalc('85,000 + 220 × 95 + 220 × 150')).toBe(138900);
    expect(evalCalc('147,000 ÷ 81,500')).toBeCloseTo(1.8037, 4);
    expect(evalCalc('5 − 2')).toBe(3);
    expect(evalCalc('12.')).toBe(12);
    expect(evalCalc('.5 + .25')).toBe(0.75);
  });

  it('handles percent like a desk calculator', () => {
    expect(evalCalc('15%')).toBe(0.15);
    expect(evalCalc('20,900 × 150%')).toBe(31350);
    expect(evalCalc('200 + 10%')).toBe(220);
    expect(evalCalc('200 - 10%')).toBe(180);
    expect(evalCalc('(1 + 1)%')).toBe(0.02);
  });

  it('hides floating-point noise', () => {
    expect(evalCalc('0.1 + 0.2')).toBe(0.3);
    expect(evalCalc('40000 * 15.1046')).toBe(604184);
  });

  it('uses the previous answer', () => {
    expect(evalCalc('Ans * 2', 21)).toBe(42);
    expect(() => evalCalc('Ans + 1', null)).toThrow(/No previous answer/);
  });

  it('explains mistakes', () => {
    const msg = (s: string) => { try { evalCalc(s); return ''; } catch (e) { expect(e).toBeInstanceOf(CalcError); return (e as Error).message; } };
    expect(msg('')).toMatch(/Type a calculation/);
    expect(msg('2,5')).toMatch(/commas/);
    expect(msg('1,2345')).toMatch(/commas/);
    expect(msg('1.2.3')).toMatch(/two decimal points/);
    expect(msg('(2 + 3')).toMatch(/missing its "\)"/);
    expect(msg('2 + 3)')).toMatch(/no "\("/);
    expect(msg('4 / 0')).toMatch(/divide by zero/);
    expect(msg('2 +')).toMatch(/ends too soon/);
    expect(msg('2 # 3')).toMatch(/isn't something/);
  });

  it('formats for display and for answer boxes', () => {
    expect(formatCalc(1234567.891)).toBe('1,234,567.891');
    expect(plainCalc(15.104545454545)).toBe('15.104545');
    expect(plainCalc(-1200)).toBe('-1200');
  });
});

describe('calculatorMode', () => {
  it('opens by itself for computational questions in accounting modules', () => {
    for (const type of ['numeric', 'hand-calc', 'schedule-fill', 'journal-entry'] as const) expect(calculatorMode({ type }, 'journal')).toBe('auto');
    for (const type of ['mcq', 'multi', 'match', 'order'] as const) expect(calculatorMode({ type }, 'journal')).toBe('available');
  });

  it('respects the template flag', () => {
    expect(calculatorMode({ type: 'mcq', calculator: true }, 'journal')).toBe('auto');
    expect(calculatorMode({ type: 'journal-entry', calculator: false }, 'journal')).toBe('available');
    expect(calculatorMode({ type: 'numeric', calculator: true }, 'code')).toBe('auto');
  });

  it('stays out of code-workbench courses unless asked', () => {
    expect(calculatorMode({ type: 'numeric' }, 'code')).toBe('off');
    expect(calculatorMode({ type: 'numeric' }, undefined)).toBe('off');
    expect(calculatorMode({ type: 'numeric', calculator: false }, 'code')).toBe('off');
  });
});

describe('hand-calc grading with "Show step"', async () => {
  const { grade, solutionShown } = await import('../src/quiz/Question');
  const step = (value: number) => ({ prompt: '', numeric: { value, tol: 0.5, accept: ['decimal' as const] }, misconceptions: [] });
  const inst = { type: 'hand-calc', steps: [step(1), step(2000), step(7000)] } as any;
  const resp = (revealed: boolean[]) => ({ inputs: ['1', '2000', '7000'], revealed, tries: [1, 1, 1], done: [true, true, true], hints: [false, false, false] });

  it('a fully shown solution earns no credit but is labelled as shown, not wrong', () => {
    const g = grade(inst, resp([true, true, true]));
    expect(g.score).toBe(0);
    expect(solutionShown(inst, g)).toBe(true);
    expect(g.feedback.join(' ')).toMatch(/every step/);
  });

  it('partly shown solutions say how many steps were shown', () => {
    const g = grade(inst, resp([false, true, true]));
    expect(g.score).toBeCloseTo(1 / 3);
    expect(solutionShown(inst, g)).toBe(false);
    expect(g.feedback.join(' ')).toMatch(/2 of 3 steps/);
  });

  it('worked answers get full credit and no shown-step note', () => {
    const g = grade(inst, resp([false, false, false]));
    expect(g.correct).toBe(true);
    expect(g.feedback).toEqual([]);
  });
});
