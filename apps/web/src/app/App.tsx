import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { BookMarked, Dumbbell, FileText, Moon, Repeat, Search, Settings as SettingsIcon, Shield, Sun } from 'lucide-react';
import { enabledModules, useModuleStore } from '../modules/store';
import { ModulePage } from '../tabs/ModulePage';
import { IntuitionTab } from '../tabs/IntuitionTab';
import { MathCodeTab } from '../tabs/MathCodeTab';
import { ApplicationTab } from '../tabs/ApplicationTab';
import { Dashboard } from './Dashboard';
import { GlossaryPage } from './GlossaryPage';
import { CheatsheetPage } from './CheatsheetPage';
import { SettingsPage } from './SettingsPage';
import { CommandPalette } from './CommandPalette';
import { QuizBuilder } from '../quiz/QuizBuilder';
import { QuizRunner } from '../quiz/QuizRunner';
import { ReviewPage } from '../quiz/ReviewPage';
import { AdminPage } from '../admin/AdminPage';
import { useDueReviews, useSetting } from '../storage/progress';
import { cn } from '../lib/util';

function useTheme() {
  const [theme, setTheme] = useSetting('theme');
  const [reduced] = useSetting('reducedMotion');
  useEffect(() => {
    const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem('kodigo-theme', theme === 'system' ? '' : theme); } catch {}
  }, [theme]);
  useEffect(() => { document.documentElement.classList.toggle('reduce-motion', !!reduced); }, [reduced]);
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  return { theme, toggle: () => setTheme(isDark ? 'light' : 'dark'), isDark };
}

function TopBar({ onSearch }: { onSearch: () => void }) {
  const { list } = useModuleStore();
  const mods = enabledModules(list);
  const due = useDueReviews();
  const { toggle, isDark } = useTheme();
  const loc = useLocation();
  const item = (to: string, label: React.ReactNode, active?: boolean) => (
    <NavLink to={to} className={({ isActive }) => cn('flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium transition', isActive || active ? 'bg-panel2 text-ink' : 'text-muted hover:text-ink')}>{label}</NavLink>
  );
  return (
    <header className="no-print sticky top-0 z-30 border-b border-line bg-panel/85 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-[1400px] items-center gap-1 px-3">
        <Link to="/" className="mr-2 flex items-center gap-2 font-semibold"><img src="/favicon.svg" className="h-6 w-6" alt="" /> <span className="hidden sm:inline">Kodigo</span></Link>
        <nav className="scrollbar-thin flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
          {mods.map((m) => item(`/m/${m.id}`, <><span className="h-2 w-2 rounded-full" style={{ background: m.color ?? 'rgb(var(--accent))' }} />{m.shortTitle}</>, loc.pathname.startsWith(`/m/${m.id}/`)))}
          <span className="mx-1 h-5 w-px bg-line" />
          {item('/quiz', <><Dumbbell size={15} />Quiz</>, loc.pathname.startsWith('/quiz'))}
          {item('/review', <><Repeat size={15} />Review{due.length > 0 && <span className="rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">{due.length}</span>}</>)}
          {item('/glossary', <><BookMarked size={15} />Glossary</>)}
        </nav>
        <button className="btn-ghost btn-sm hidden md:inline-flex" onClick={onSearch} title="Search (Ctrl/Cmd-K)"><Search size={15} /><span className="kbd">Ctrl K</span></button>
        <Link to="/cheatsheet" className="btn-ghost btn-sm" title="Cheat sheet"><FileText size={16} /></Link>
        <button className="btn-ghost btn-sm" onClick={toggle} title="Toggle theme">{isDark ? <Sun size={16} /> : <Moon size={16} />}</button>
        <Link to="/settings" className="btn-ghost btn-sm" title="Settings & progress"><SettingsIcon size={16} /></Link>
        <Link to="/admin" className="btn-ghost btn-sm" title="Admin"><Shield size={16} /></Link>
      </div>
    </header>
  );
}

export function App() {
  const [palette, setPalette] = useState(false);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  const moduleRoutes = (
    <>
      <Route index element={<Navigate to="intuition" replace />} />
      <Route path="intuition" element={<IntuitionTab />} />
      <Route path="intuition/:sceneId" element={<IntuitionTab />} />
      <Route path="math-code" element={<MathCodeTab />} />
      <Route path="math-code/:sectionId" element={<MathCodeTab />} />
      <Route path="application" element={<ApplicationTab />} />
    </>
  );
  return (
    <div className="flex min-h-full flex-col">
      <TopBar onSearch={() => setPalette(true)} />
      <main className="flex flex-1 flex-col">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/m/:id" element={<ModulePage />}>{moduleRoutes}</Route>
          <Route path="/preview/m/:id" element={<ModulePage preview />}>{moduleRoutes}</Route>
          <Route path="/quiz" element={<QuizBuilder />} />
          <Route path="/quiz/run/:sessionId" element={<QuizRunner />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/glossary" element={<GlossaryPage />} />
          <Route path="/cheatsheet" element={<CheatsheetPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<div className="p-10 text-center text-muted">Page not found. <Link className="text-accent underline" to="/">Home</Link></div>} />
        </Routes>
      </main>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  );
}
