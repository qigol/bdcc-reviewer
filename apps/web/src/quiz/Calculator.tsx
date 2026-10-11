import { useEffect, useMemo, useRef, useState } from 'react';
import { Calculator as CalcIcon, CornerDownLeft, Delete, GripHorizontal, X } from 'lucide-react';
import { CalcError, evalCalc, formatCalc, plainCalc } from '../lib/calc';
import { cn } from '../lib/util';

interface TapeLine { expr: string; value: number }

const POS_KEY = 'qdigo.calc.pos';
const AUTO_KEY = 'qdigo.calc.auto';
const WIDTH = 288;

/** Whether the calculator may open itself on calculation questions (per-browser preference). */
export function calcAutoOpenPref(): boolean {
  try { return localStorage.getItem(AUTO_KEY) !== 'off'; } catch { return true; }
}

function loadPos(): { x: number; y: number } | null {
  try { const p = JSON.parse(localStorage.getItem(POS_KEY) ?? 'null'); return p && typeof p.x === 'number' && typeof p.y === 'number' ? p : null; } catch { return null; }
}

/** Put a value into a React-controlled <input> as if the learner typed it. */
function typeInto(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.focus();
}

/**
 * A floating desk calculator for quizzes. It stays mounted while hidden, so the tape and the
 * expression survive moving between questions. `target` is the answer field the learner last
 * focused; "Use" types the result into it. It takes the keyboard only when `focusOnOpen` (opened
 * by hand), so an auto-opened panel never steals typing meant for the answer. `onDockedChange`
 * reports whether it sits in its default corner (false once the learner drags it), so the page
 * can keep that corner clear.
 */
export function Calculator({ open, onClose, target, focusOnOpen, onDockedChange }: {
  open: boolean; onClose: () => void; target: HTMLInputElement | null; focusOnOpen: boolean; onDockedChange?: (docked: boolean) => void;
}) {
  const [expr, setExpr] = useState('');
  const [tape, setTape] = useState<TapeLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState(false); // the field shows a result; a digit starts over, an operator continues
  const [auto, setAuto] = useState(calcAutoOpenPref);
  const [pos, setPos] = useState(loadPos);
  const inputRef = useRef<HTMLInputElement>(null);
  const tapeRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const ans = tape.length ? tape[tape.length - 1].value : null;

  // live result while typing; null while the expression is empty or not finished yet
  const preview = useMemo((): number | null => {
    if (!expr.trim() || fresh) return null;
    try { return evalCalc(expr, ans); } catch { return null; }
  }, [expr, ans, fresh]);

  useEffect(() => { if (open && focusOnOpen) setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0); }, [open, focusOnOpen]);
  useEffect(() => { onDockedChange?.(pos === null); }, [pos === null]);
  useEffect(() => { tapeRef.current?.scrollTo({ top: tapeRef.current.scrollHeight }); }, [tape.length]);
  // keep a dragged panel on screen when the window shrinks
  useEffect(() => {
    const fit = () => setPos((p) => p && clamp(p.x, p.y));
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const clamp = (x: number, y: number) => {
    const h = panelRef.current?.offsetHeight ?? 420;
    return { x: Math.min(Math.max(8, x), window.innerWidth - WIDTH - 8), y: Math.min(Math.max(8, y), window.innerHeight - Math.min(h, window.innerHeight - 16) - 8) };
  };

  const evaluate = () => {
    if (!expr.trim()) return;
    try {
      const value = evalCalc(expr, ans);
      setTape((t) => [...t.slice(-49), { expr: expr.trim(), value }]);
      setExpr(plainCalc(value));
      setFresh(true);
      setError(null);
    } catch (e) {
      setError(e instanceof CalcError ? e.message : 'Not a calculation');
    }
  };

  const press = (k: string) => {
    setError(null);
    const isOperator = ['+', '−', '×', '÷', '%', ')'].includes(k);
    setExpr((cur) => (fresh && !isOperator ? k : cur + k));
    setFresh(false);
    inputRef.current?.focus({ preventScroll: true });
  };

  const current = fresh ? ans : preview;
  const targetUsable = !!target && target.isConnected && !target.disabled && !target.readOnly;
  const useResult = () => {
    if (current === null || !targetUsable) return;
    typeInto(target!, plainCalc(current));
  };

  const startDrag = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const rect = panelRef.current!.getBoundingClientRect();
    const dx = e.clientX - rect.left, dy = e.clientY - rect.top;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => setPos(clamp(ev.clientX - dx, ev.clientY - dy));
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const p = clamp(ev.clientX - dx, ev.clientY - dy);
      try { localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch { /* storage blocked: position just isn't remembered */ }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const toggleAuto = () => {
    const next = !auto;
    setAuto(next);
    try { localStorage.setItem(AUTO_KEY, next ? 'on' : 'off'); } catch { /* not remembered */ }
  };

  const keys: { k: string; label?: React.ReactNode; cls?: string; title?: string }[] = [
    { k: 'C', cls: 'text-bad', title: 'Clear (Esc)' }, { k: '(' }, { k: ')' }, { k: '⌫', label: <Delete size={15} />, title: 'Backspace' },
    { k: '7' }, { k: '8' }, { k: '9' }, { k: '÷', cls: 'text-accent' },
    { k: '4' }, { k: '5' }, { k: '6' }, { k: '×', cls: 'text-accent' },
    { k: '1' }, { k: '2' }, { k: '3' }, { k: '−', cls: 'text-accent' },
    { k: '0' }, { k: '.' }, { k: '%', cls: 'text-accent', title: '15% = 0.15; 200 + 10% = 220' }, { k: '+', cls: 'text-accent' },
  ];
  const onKey = (k: string) => {
    if (k === 'C') { setExpr(''); setError(null); setFresh(false); inputRef.current?.focus({ preventScroll: true }); return; }
    if (k === '⌫') { setExpr((c) => (fresh ? '' : c.slice(0, -1))); setFresh(false); setError(null); inputRef.current?.focus({ preventScroll: true }); return; }
    press(k);
  };

  return (
    <div ref={panelRef} role="dialog" aria-label="Calculator" data-testid="calculator" aria-hidden={!open}
      className={cn('fixed z-40 flex-col overflow-hidden rounded-xl border border-line bg-panel shadow-xl', open ? 'flex' : 'hidden')}
      style={pos ? { left: pos.x, top: pos.y, width: `min(${WIDTH}px, calc(100vw - 16px))` } : { right: 16, bottom: 16, width: `min(${WIDTH}px, calc(100vw - 32px))` }}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); if (expr) onKey('C'); else onClose(); } }}>
      <div className="flex cursor-move touch-none select-none items-center gap-1.5 border-b border-line bg-panel2 px-3 py-1.5 text-xs font-semibold" onPointerDown={startDrag}>
        <CalcIcon size={13} className="text-accent" /> Calculator
        <GripHorizontal size={13} className="ml-1 text-muted" aria-hidden />
        <button className="ml-auto rounded p-0.5 text-muted hover:text-ink" onClick={onClose} aria-label="Close calculator" title="Close (Esc on an empty line)"><X size={14} /></button>
      </div>

      <div ref={tapeRef} className="max-h-28 min-h-[2.25rem] overflow-y-auto px-3 pt-2 font-mono text-xs" data-testid="calc-tape">
        {tape.length === 0 ? <div className="text-muted">Past results show here. Click one to reuse it.</div>
          : tape.map((l, i) => (
            <button key={i} className="flex w-full items-baseline justify-end gap-2 rounded px-1 py-0.5 text-right hover:bg-panel2" title="Add this result to the calculation"
              onClick={() => { setExpr((c) => (fresh ? plainCalc(l.value) : c + plainCalc(l.value))); setFresh(false); setError(null); inputRef.current?.focus({ preventScroll: true }); }}>
              <span className="truncate text-muted">{l.expr} =</span><span className="shrink-0 tabular-nums">{formatCalc(l.value)}</span>
            </button>
          ))}
      </div>

      <div className="px-3 pb-2 pt-1">
        <input ref={inputRef} className="input w-full text-right font-mono text-base" aria-label="calculation" value={expr} spellCheck={false} autoComplete="off" inputMode="decimal"
          placeholder="e.g. 20,900 × 150%"
          onChange={(e) => { setExpr(e.target.value); setFresh(false); setError(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); evaluate(); } }} />
        <div className={cn('mt-1 min-h-[1.25rem] text-right font-mono text-sm', error ? 'text-bad' : 'text-muted')} aria-live="polite" data-testid="calc-result">
          {error ? <span className="font-sans text-xs">{error}</span>
            : current !== null ? <span className={cn(fresh && 'font-semibold text-ink')}>= {formatCalc(current)}</span> : null}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1 px-3">
        {keys.map(({ k, label, cls, title }) => (
          <button key={k} className={cn('btn h-9 px-0 font-mono text-base', cls)} title={title} aria-label={title ?? k} onClick={() => onKey(k)}>{label ?? k}</button>
        ))}
        <button className="btn h-9 px-0 text-xs" onClick={() => press('Ans')} disabled={ans === null} aria-label="Ans (last result)" title={ans === null ? 'No result yet' : `Last result: ${formatCalc(ans)}`}>Ans</button>
        <button className="btn col-span-2 h-9 px-1 text-xs" onClick={useResult} disabled={current === null || !targetUsable} data-testid="calc-use" aria-label="Use in answer"
          title={targetUsable ? `Type the result into “${target!.getAttribute('aria-label') ?? 'the answer box'}”` : 'Click an answer box first, then use the result'}>
          <CornerDownLeft size={13} /> Use in answer
        </button>
        <button className="btn-primary h-9 px-0 font-mono text-base" onClick={evaluate} aria-label="equals" title="Equals (Enter)">=</button>
      </div>

      <label className="flex cursor-pointer items-center gap-1.5 px-3 pb-2 pt-2 text-[11px] text-muted">
        <input type="checkbox" checked={auto} onChange={toggleAuto} /> Open by itself on calculation questions
      </label>
    </div>
  );
}
