import { useEffect, useState, type RefObject } from 'react';
import { HelpCircle, NotebookPen, X } from 'lucide-react';
import { cn } from '../lib/util';

/** What an exam question asks for, said once, before the first question. */
export function ExamGuide({ coding = false, defaultOpen = true, className }: { coding?: boolean; defaultOpen?: boolean; className?: string }) {
  return (
    <details className={cn('rounded-xl border border-line bg-panel p-3 text-sm', className)} open={defaultOpen || undefined} data-testid="exam-guide">
      <summary className="flex cursor-pointer items-center gap-1.5 font-semibold"><HelpCircle size={15} /> How this exam works</summary>
      <div className="mt-2 flex flex-col gap-1.5 text-muted">
        {coding ? (
          <>
            <p><b className="text-ink">You write the code.</b> Each problem gives a spec and a stub, as in the midterm. Write the function, press Run, and the test cell checks it with <code>assert_equal</code>, printing ACTUAL and DESIRED when it fails.</p>
            <p>Python and pandas run in your browser. The data files are at the path the spec gives, so start by reading them. All problems are open at once, like a notebook; the scratch cell is for exploring, and the scratchpad keeps notes for this attempt.</p>
            <p><b className="text-ink">After you submit:</b> walk through every problem, or only the ones you missed. Each is rebuilt step by step on your data, then twisted so the code has to change.</p>
          </>
        ) : (
          <>
            <p><b className="text-ink">Each question asks for what a correct function would return.</b> In the midterm you write the function and a hidden test checks its output. Here nothing runs, so you work out that output from the tables shown.</p>
            <p>If you can say what the right answer is, you know which rows the code must select. Open a problem's hint to see which pandas step it checks.</p>
            <p>Items open one at a time and lock when you move on, because later items show results that would give earlier answers away. Submit at any point; then every answer and worked solution is shown.</p>
            <p><b className="text-ink">Tools:</b> click a row in any table to mark it while you count; the scratchpad keeps notes for this attempt.</p>
          </>
        )}
      </div>
    </details>
  );
}

/** A problem's hint: which pandas step it checks. Closed until the learner opens it. */
export function ProblemHint({ children }: { children: React.ReactNode }) {
  return (
    <details className="mb-3 rounded-lg border border-line bg-panel2 px-3 py-2 text-sm" data-testid="problem-hint">
      <summary className="cursor-pointer font-medium text-muted">Hint: which pandas step this checks</summary>
      <div className="mt-1.5">{children}</div>
    </details>
  );
}

/** Notes for one attempt. Kept in sessionStorage (per tab), never in study progress. */
export function ScratchPad({ storageKey, open, onClose }: { storageKey: string; open: boolean; onClose: () => void }) {
  const [text, setText] = useState('');
  useEffect(() => {
    try { setText(sessionStorage.getItem(storageKey) ?? ''); } catch { setText(''); }
  }, [storageKey]);
  const save = (t: string) => {
    setText(t);
    try { sessionStorage.setItem(storageKey, t); } catch { /* private mode: notes live only in memory */ }
  };
  if (!open) return null;
  return (
    <aside className="fixed bottom-4 right-4 z-40 flex w-[min(360px,calc(100vw-2rem))] flex-col rounded-xl border border-line bg-panel shadow-xl" data-testid="scratchpad">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2 text-sm font-semibold">
        <NotebookPen size={15} /> Scratchpad
        <span className="text-xs font-normal text-muted">this attempt only</span>
        <button className="btn-ghost btn-sm ml-auto" onClick={onClose} aria-label="Close scratchpad"><X size={14} /></button>
      </div>
      <textarea className="input m-2 h-56 resize-y font-mono text-xs" value={text} onChange={(e) => save(e.target.value)}
        placeholder={'Counts, ids, lists…\n452: 4 ratings\n741: 3'} aria-label="Scratchpad notes" />
    </aside>
  );
}

/** Click a table row inside `ref` to mark it (and again to unmark). Marks are visual only. */
export function useRowMarking(ref: RefObject<HTMLElement | null>, resetKey: unknown) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onClick = (e: MouseEvent) => {
      const tr = (e.target as HTMLElement).closest('tbody tr');
      if (!tr || !el.contains(tr) || (e.target as HTMLElement).closest('input, textarea, button, a')) return;
      tr.classList.toggle('exam-marked');
      tr.classList.toggle('bg-accent/20');
    };
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, [ref, resetKey]);
  // a new attempt starts unmarked
  useEffect(() => {
    ref.current?.querySelectorAll('tr.exam-marked').forEach((tr) => tr.classList.remove('exam-marked', 'bg-accent/20'));
  }, [ref, resetKey]);
}
