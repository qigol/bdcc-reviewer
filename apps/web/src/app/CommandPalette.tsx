import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BookMarked, Clapperboard, FunctionSquare, Search, Sigma } from 'lucide-react';
import { useAllModules } from '../modules/useAll';
import { useCourses } from '../modules/courses';
import { renderTex } from '../lib/md';
import { cn } from '../lib/util';
import { usePopup } from '../lib/popup';

interface Entry { kind: 'term' | 'section' | 'scene' | 'formula'; title: string; sub: string; to: string; tex?: string }

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mods } = useAllModules();
  const { courses, courseOf } = useCourses();
  const nav = useNavigate();
  const loc = useLocation();
  const popup = usePopup();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const entries = useMemo<Entry[]>(() => mods.flatMap((m) => {
    // with several courses, results say which course they're from (and the course name is searchable)
    const t = courses.length > 1 ? `${courseOf(m.id) ?? ''} · ${m.parsed.manifest.shortTitle}` : m.parsed.manifest.shortTitle;
    return [
      ...m.parsed.intuition.map((s) => ({ kind: 'scene' as const, title: s.title, sub: `${t} · Intuition · ${s.goal}`, to: `/m/${m.id}/intuition/${s.id}` })),
      ...m.parsed.mathCode.map((s) => ({ kind: 'section' as const, title: s.title, sub: `${t} · Math & Code`, to: `/m/${m.id}/math-code/${s.id}` })),
      ...m.parsed.mathCode.filter((s) => s.keyFormula).map((s) => ({ kind: 'formula' as const, title: s.title, sub: `${t} · formula`, to: `/m/${m.id}/math-code/${s.id}`, tex: s.keyFormula })),
      ...m.parsed.glossary.map((g) => ({ kind: 'term' as const, title: g.term, sub: `${t} · ${g.short}`, to: `/glossary?term=${g.id}` })),
    ];
  }), [mods, courses]);
  const ql = q.toLowerCase().trim();
  const results = (ql ? entries.filter((e) => (e.title + ' ' + e.sub).toLowerCase().includes(ql)) : entries.filter((e) => e.kind !== 'formula')).slice(0, 40);
  useEffect(() => { if (open) { setQ(''); setSel(0); setTimeout(() => input.current?.focus(), 10); } }, [open]);
  useEffect(() => setSel(0), [q]);
  if (!open) return null;
  const go = (e?: Entry) => {
    if (!e) return;
    // mid-quiz: show the result over the quiz instead of navigating away from it
    if (loc.pathname.startsWith('/quiz/run/')) popup.open({ title: e.title, src: e.to, note: 'Your quiz stays open underneath' });
    else nav(e.to);
    onClose();
  };
  const Icon = { term: BookMarked, section: Sigma, scene: Clapperboard, formula: FunctionSquare };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh]" onClick={onClose}>
      <div className="card w-full max-w-xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="search">
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Search size={16} className="text-muted" />
          <input ref={input} className="w-full bg-transparent py-3 text-sm outline-none" placeholder="Search terms, sections, scenes, formulas…" value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(results.length - 1, s + 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
              if (e.key === 'Enter') go(results[sel]);
              if (e.key === 'Escape') onClose();
            }} />
          <span className="kbd">Esc</span>
        </div>
        <ul className="max-h-[60vh] overflow-auto p-1">
          {results.map((r, i) => {
            const I = Icon[r.kind];
            return (
              <li key={r.kind + r.to + r.title}>
                <button onMouseEnter={() => setSel(i)} onClick={() => go(r)} className={cn('flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left', i === sel && 'bg-panel2')}>
                  <I size={16} className="mt-0.5 shrink-0 text-muted" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{r.title}</span>
                    {r.tex ? <span className="block text-sm" dangerouslySetInnerHTML={{ __html: renderTex(r.tex, false) }} /> : <span className="block truncate text-xs text-muted">{r.sub}</span>}
                  </span>
                </button>
              </li>
            );
          })}
          {!results.length && <li className="p-4 text-center text-sm text-muted">No matches.</li>}
        </ul>
      </div>
    </div>
  );
}
