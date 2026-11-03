import { CheckCircle2, Loader2, Play, XCircle } from 'lucide-react';
import { cn } from '../lib/util';
import type { CellResult } from '../py/python';

/** One notebook cell: a plain code editor (Tab indents, Shift+Enter runs) and its output underneath. */
export function CodeCell({ label, code, onChange, onRun, result, running, readOnly, disabled, status, testId }: {
  label: string; code: string; onChange?: (c: string) => void; onRun: () => void; result?: CellResult | null; running?: boolean;
  readOnly?: boolean; disabled?: boolean; status?: 'pass' | 'fail' | null; testId?: string;
}) {
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); if (!disabled) onRun(); return; }
    if (e.key === 'Tab' && !readOnly) {
      e.preventDefault();
      const el = e.currentTarget, { selectionStart: a, selectionEnd: b } = el;
      const next = code.slice(0, a) + '    ' + code.slice(b);
      onChange?.(next);
      requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = a + 4; });
    }
  };
  const rows = Math.max(3, code.split('\n').length + (readOnly ? 0 : 1));
  return (
    <div className={cn('rounded-xl border bg-panel', status === 'pass' ? 'border-good/60' : status === 'fail' ? 'border-bad/60' : 'border-line')} data-testid={testId}>
      <div className="flex items-center gap-2 border-b border-line px-3 py-1.5 text-xs text-muted">
        <span className="font-mono">{label}</span>
        {status === 'pass' && <span className="flex items-center gap-1 font-semibold text-good"><CheckCircle2 size={13} /> passed</span>}
        {status === 'fail' && <span className="flex items-center gap-1 font-semibold text-bad"><XCircle size={13} /> failed</span>}
        <button className="btn btn-sm ml-auto" onClick={onRun} disabled={disabled || running} title="Run (Shift+Enter)" data-run>
          {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />} Run
        </button>
      </div>
      <textarea className={cn('block w-full resize-y bg-transparent px-3 py-2 font-mono text-[13px] leading-5 outline-none', readOnly && 'text-muted')}
        value={code} onChange={(e) => onChange?.(e.target.value)} onKeyDown={onKeyDown} readOnly={readOnly} rows={rows}
        spellCheck={false} autoCapitalize="off" autoCorrect="off" aria-label={label} />
      {result && (result.out || result.err) && (
        <pre className="max-h-80 overflow-auto border-t border-line px-3 py-2 font-mono text-xs leading-5">
          {result.out}{result.err && <span className="text-bad">{result.err}</span>}
        </pre>
      )}
    </div>
  );
}
