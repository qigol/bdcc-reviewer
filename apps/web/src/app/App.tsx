import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { BookMarked, Dumbbell, FileText, Moon, Repeat, Search, Settings as SettingsIcon, Shield, Sun } from 'lucide-react';
import { useCourses } from '../modules/courses';
import { CourseMenu } from './CourseMenu';
import { getSession } from '../quiz/session';
import { ModulePage } from '../tabs/ModulePage';
import { IntuitionTab } from '../tabs/IntuitionTab';
import { PathTab } from '../tabs/PathTab';
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
import { PopupProvider, isEmbedded, useEmbeddedEscape, usePopup } from '../lib/popup';

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
  const { courses } = useCourses();
  const [openCourse, setOpenCourse] = useState<string | null>(null);
  const due = useDueReviews();
  const { toggle, isDark } = useTheme();
  const loc = useLocation();
  const popup = usePopup();
  const inQuiz = loc.pathname.startsWith('/quiz/run/');
  const quizCourse = inQuiz ? getSession(loc.pathname.split('/')[3] ?? '')?.course : undefined;
  const item = (to: string, label: React.ReactNode, active?: boolean) => (
    <NavLink to={to} className={({ isActive }) => cn('flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium transition', isActive || active ? 'bg-panel2 text-ink' : 'text-muted hover:text-ink')}>{label}</NavLink>
  );
  return (
    <header className="no-print sticky top-0 z-30 border-b border-line bg-panel/85 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-[1400px] items-center gap-1 px-3">
        <Link to="/" className="mr-2 flex items-center gap-2 font-semibold" title="Qdigo · Q's got your Qs"><img src="/favicon.svg" className="h-6 w-6" alt="" /> <span className="hidden sm:inline">Qdigo</span></Link>
        <nav className="scrollbar-thin flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
          {courses.map((g) => (
            <CourseMenu key={g.course} group={g} open={openCourse === g.course} onOpenChange={(o) => setOpenCourse(o ? g.course : null)} />
          ))}
          {courses.length > 0 && <span className="mx-1 h-5 w-px shrink-0 bg-line" />}
          {item('/quiz', <><Dumbbell size={15} />Quiz</>, loc.pathname.startsWith('/quiz'))}
          {item('/review', <><Repeat size={15} />Review{due.length > 0 && <span className="rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">{due.length}</span>}</>)}
          {inQuiz
            // mid-quiz: open the glossary over the quiz instead of leaving it
            ? <button className="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted transition hover:text-ink" onClick={() => popup.open({ title: 'Glossary', src: quizCourse ? `/glossary?course=${encodeURIComponent(quizCourse)}` : '/glossary', note: 'Your quiz stays open underneath' })}><BookMarked size={15} />Glossary</button>
            : item('/glossary', <><BookMarked size={15} />Glossary</>)}
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
  return <PopupProvider><Shell /></PopupProvider>;
}

function Shell() {
  const [palette, setPalette] = useState(false);
  useEmbeddedEscape();
  useEffect(() => {
    if (isEmbedded) return;
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  const moduleRoutes = (
    <>
      <Route index element={<Navigate to="path" replace />} />
      <Route path="path" element={<PathTab />} />
      <Route path="intuition" element={<IntuitionTab />} />
      <Route path="intuition/:sceneId" element={<IntuitionTab />} />
      <Route path="math-code" element={<MathCodeTab />} />
      <Route path="math-code/:sectionId" element={<MathCodeTab />} />
      <Route path="application" element={<ApplicationTab />} />
    </>
  );
  return (
    <div className="flex min-h-full flex-col">
      {!isEmbedded && <TopBar onSearch={() => setPalette(true)} />}
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
      {!isEmbedded && <CommandPalette open={palette} onClose={() => setPalette(false)} />}
    </div>
  );
}
