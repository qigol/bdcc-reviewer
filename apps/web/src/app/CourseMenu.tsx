import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, Dumbbell, GraduationCap } from 'lucide-react';
import type { CourseGroup } from '../modules/courses';
import { ModuleIcon } from './icons';
import { cn } from '../lib/util';

/**
 * One top-bar dropdown per course. The trigger shows the course code (plus the open module when
 * you're inside one); the menu lists the course's modules and links to a quiz for that course.
 * The menu is portalled and fixed-positioned so the horizontally scrolling nav can't clip it.
 */
export function CourseMenu({ group, open, onOpenChange }: { group: CourseGroup; open: boolean; onOpenChange: (open: boolean) => void }) {
  const loc = useLocation();
  const nav = useNavigate();
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [focus, setFocus] = useState(0);
  const current = group.modules.find((m) => loc.pathname.startsWith(`/m/${m.id}/`) || loc.pathname === `/m/${m.id}`);
  const quizTo = `/quiz?course=${encodeURIComponent(group.course)}`;
  const itemCount = group.modules.length + 1; // modules + "Quiz this course"

  // place under the trigger, clamped to the viewport (16px gutter)
  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const place = () => {
      const r = btn.current!.getBoundingClientRect();
      const width = Math.min(340, window.innerWidth - 32);
      const left = Math.max(16, Math.min(r.left, window.innerWidth - width - 16));
      setPos({ top: r.bottom + 6, left, width });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open]);

  // close on outside click, scroll of the page, or route change
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !btn.current?.contains(t)) onOpenChange(false);
    };
    const scroll = (e: Event) => { if (!menu.current?.contains(e.target as Node)) onOpenChange(false); };
    document.addEventListener('pointerdown', down);
    window.addEventListener('scroll', scroll, true);
    return () => { document.removeEventListener('pointerdown', down); window.removeEventListener('scroll', scroll, true); };
  }, [open]);
  useEffect(() => { if (open) onOpenChange(false); }, [loc.pathname, loc.search]);

  // keyboard: focus the current module (or the first) when opening
  useEffect(() => {
    if (!open) return;
    const i = Math.max(0, group.modules.findIndex((m) => m.id === current?.id));
    setFocus(i);
    requestAnimationFrame(() => menu.current?.querySelectorAll<HTMLElement>('[role=menuitem]')[i]?.focus());
  }, [open]);
  const move = (i: number) => {
    const n = ((i % itemCount) + itemCount) % itemCount;
    setFocus(n);
    menu.current?.querySelectorAll<HTMLElement>('[role=menuitem]')[n]?.focus();
  };
  const onMenuKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(focus + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(focus - 1); }
    else if (e.key === 'Home') { e.preventDefault(); move(0); }
    else if (e.key === 'End') { e.preventDefault(); move(itemCount - 1); }
    else if (e.key === 'Escape') { e.preventDefault(); onOpenChange(false); btn.current?.focus(); }
    else if (e.key === 'Tab') onOpenChange(false);
  };

  const menuId = `course-menu-${group.course.replace(/[^A-Za-z0-9_-]/g, '_')}`;
  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        data-testid="course-menu"
        data-course={group.course}
        onClick={() => onOpenChange(!open)}
        onKeyDown={(e) => {
          if (!open) { if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenChange(true); } }
          // focus may still be on the trigger right after opening: menu keys (Escape, arrows) work from here too
          else if (e.key !== 'Enter' && e.key !== ' ') onMenuKey(e);
        }}
        className={cn('flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium transition', current || open ? 'bg-panel2 text-ink' : 'text-muted hover:text-ink')}
      >
        <GraduationCap size={15} />
        <span>{group.course}</span>
        {current && (
          <>
            <span className="text-muted">/</span>
            <span className="h-2 w-2 rounded-full" style={{ background: current.color ?? 'rgb(var(--accent))' }} />
            <span>{current.shortTitle}</span>
          </>
        )}
        <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && pos && createPortal(
        <div
          ref={menu}
          id={menuId}
          role="menu"
          aria-label={`${group.course} modules`}
          onKeyDown={onMenuKey}
          className="card fixed z-50 overflow-hidden p-1 shadow-2xl"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          <div className="flex items-baseline justify-between px-2.5 pb-1 pt-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">{group.course}</span>
            <span className="text-[11px] text-muted">{group.modules.length} module{group.modules.length === 1 ? '' : 's'}</span>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {group.modules.map((m, i) => {
              const active = m.id === current?.id;
              return (
                <Link
                  key={m.id}
                  to={`/m/${m.id}`}
                  role="menuitem"
                  tabIndex={focus === i ? 0 : -1}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => onOpenChange(false)}
                  onMouseEnter={() => setFocus(i)}
                  className={cn('flex items-center gap-3 rounded-lg px-2.5 py-2 outline-none transition focus-visible:bg-panel2 hover:bg-panel2', active && 'bg-panel2')}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: m.color ?? 'rgb(var(--accent))' }}><ModuleIcon name={m.icon} size={16} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{m.shortTitle}</span>
                    <span className="block truncate text-xs text-muted">{m.title}</span>
                  </span>
                  {active && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />}
                </Link>
              );
            })}
          </div>
          <div className="mt-1 border-t border-line pt-1">
            <button
              type="button"
              role="menuitem"
              tabIndex={focus === group.modules.length ? 0 : -1}
              onMouseEnter={() => setFocus(group.modules.length)}
              onClick={() => { onOpenChange(false); nav(quizTo); }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-muted outline-none transition hover:bg-panel2 hover:text-ink focus-visible:bg-panel2 focus-visible:text-ink"
            >
              <Dumbbell size={15} /> Quiz on {group.course}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
