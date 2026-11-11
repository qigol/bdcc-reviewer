import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { BookMarked, CalendarDays, Dumbbell, FileText, Moon, Repeat, Search, Settings as SettingsIcon, Shield, Sun } from 'lucide-react';
import { useCourses } from '../modules/courses';
import { CourseMenu } from './CourseMenu';
import { getSession } from '../quiz/sessionStore';
import { Decorations } from '../christmas/Decorations';
import { SeasonDecor } from '../season/SeasonDecor';
import { migrateExamDate, useDueReviews, useSetting } from '../storage/progress';
import { cn } from '../lib/util';
import { useReducedMotion } from '../lib/reducedMotion';
import { PopupProvider, isEmbedded, useEmbeddedEscape, usePopup } from '../lib/popup';

/**
 * Route-level code splitting. A failed chunk load usually means a rebuild replaced the hashed files
 * this page knew about, so reload once to get the new asset list.
 */
function page<K extends string>(load: () => Promise<Record<K, ComponentType<any>>>, name: K) {
  return lazy(async () => {
    try {
      const m = await load();
      try { sessionStorage.removeItem('kodigo-chunk-reload'); } catch {}
      return { default: m[name] };
    } catch (e) {
      let first = false;
      try { first = !sessionStorage.getItem('kodigo-chunk-reload'); sessionStorage.setItem('kodigo-chunk-reload', '1'); } catch {}
      if (first) {
        location.reload();
        return new Promise<never>(() => {});
      }
      throw e;
    }
  });
}
const ModulePage = page(() => import('../tabs/ModulePage'), 'ModulePage');
const IntuitionTab = page(() => import('../tabs/IntuitionTab'), 'IntuitionTab');
const PathTab = page(() => import('../tabs/PathTab'), 'PathTab');
const MathCodeTab = page(() => import('../tabs/MathCodeTab'), 'MathCodeTab');
const ApplicationTab = page(() => import('../tabs/ApplicationTab'), 'ApplicationTab');
const ExamTab = page(() => import('../exam/ExamTab'), 'ExamTab');
const Dashboard = page(() => import('./Dashboard'), 'Dashboard');
const GlossaryPage = page(() => import('./GlossaryPage'), 'GlossaryPage');
const CheatsheetPage = page(() => import('./CheatsheetPage'), 'CheatsheetPage');
const SettingsPage = page(() => import('./SettingsPage'), 'SettingsPage');
const PlanPage = page(() => import('./PlanPage'), 'PlanPage');
const CommandPalette = page(() => import('./CommandPalette'), 'CommandPalette');
const QuizBuilder = page(() => import('../quiz/QuizBuilder'), 'QuizBuilder');
const QuizRunner = page(() => import('../quiz/QuizRunner'), 'QuizRunner');
const ReviewPage = page(() => import('../quiz/ReviewPage'), 'ReviewPage');
const AdminPage = page(() => import('../admin/AdminPage'), 'AdminPage');
const ChristmasPage = page(() => import('../christmas/ChristmasPage'), 'ChristmasPage');

function PageSkeleton() {
  return <div className="p-10 text-center text-sm text-muted" role="status">Loading…</div>;
}

function useTheme() {
  const [theme, setTheme] = useSetting('theme');
  const reduced = useReducedMotion();
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
  const courseKey = courses.map((g) => g.course).join('\n');
  useEffect(() => { if (courseKey) migrateExamDate(courseKey.split('\n')); }, [courseKey]);
  const due = useDueReviews();
  const { toggle, isDark } = useTheme();
  const loc = useLocation();
  const popup = usePopup();
  const inQuiz = loc.pathname.startsWith('/quiz/run/');
  const quizCourse = inQuiz ? getSession(loc.pathname.split('/')[3] ?? '')?.course : undefined;
  // page links: on phones they come first and show only their icon, so they stay on screen ahead of the course menus
  const pageItem = 'relative order-first flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 text-sm font-medium transition sm:order-none sm:px-2.5';
  const text = (s: string) => <span className="sr-only sm:not-sr-only">{s}</span>;
  const item = (to: string, title: string, label: React.ReactNode, active?: boolean) => (
    <NavLink to={to} title={title} className={({ isActive }) => cn(pageItem, isActive || active ? 'bg-panel2 text-ink' : 'text-muted hover:text-ink')}>{label}</NavLink>
  );
  return (
    <header className="no-print sticky top-0 z-30 border-b border-line bg-panel/85 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-[1400px] items-center gap-1 px-3">
        <Link to="/" className="mr-2 flex items-center gap-2 font-semibold" title="Qdigo · Q's got your Qs"><img src="/favicon.svg" className="h-6 w-6" alt="" /> <span className="hidden sm:inline">Qdigo</span></Link>
        <nav className="scrollbar-thin flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
          {courses.map((g) => (
            <CourseMenu key={g.course} group={g} open={openCourse === g.course} onOpenChange={(o) => setOpenCourse(o ? g.course : null)} />
          ))}
          {courses.length > 0 && <span className="order-[-1] mx-1 h-5 w-px shrink-0 bg-line sm:order-none" />}
          {item('/quiz', 'Quiz', <><Dumbbell size={15} />{text('Quiz')}</>, loc.pathname.startsWith('/quiz'))}
          {item('/plan', 'Plan', <><CalendarDays size={15} />{text('Plan')}</>)}
          {item('/review', 'Review', <><Repeat size={15} />{text('Review')}{due.length > 0 && <span className="absolute right-0 top-0 rounded-full bg-accent px-1 text-[9px] font-bold leading-[14px] text-white sm:static sm:px-1.5 sm:text-[10px] sm:leading-normal">{due.length}</span>}</>)}
          {inQuiz
            // mid-quiz: open the glossary over the quiz instead of leaving it
            ? <button className={cn(pageItem, 'text-muted hover:text-ink')} title="Glossary" onClick={() => popup.open({ title: 'Glossary', src: quizCourse ? `/glossary?course=${encodeURIComponent(quizCourse)}` : '/glossary', note: 'Your quiz stays open underneath' })}><BookMarked size={15} />{text('Glossary')}</button>
            : item('/glossary', 'Glossary', <><BookMarked size={15} />{text('Glossary')}</>)}
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
      <Route path="exam" element={<ExamTab />} />
    </>
  );
  return (
    <div className="flex min-h-full flex-col">
      {!isEmbedded && <TopBar onSearch={() => setPalette(true)} />}
      {!isEmbedded && <Decorations />}
      <SeasonDecor decorate={!isEmbedded} />
      <main className="flex flex-1 flex-col">
        <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/m/:id" element={<ModulePage />}>{moduleRoutes}</Route>
          <Route path="/preview/m/:id" element={<ModulePage preview />}>{moduleRoutes}</Route>
          <Route path="/quiz" element={<QuizBuilder />} />
          <Route path="/quiz/run/:sessionId" element={<QuizRunner />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/glossary/*" element={<GlossaryPage />} />
          <Route path="/cheatsheet" element={<CheatsheetPage />} />
          <Route path="/plan" element={<PlanPage />} />
          <Route path="/christmas" element={<ChristmasPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<div className="p-10 text-center text-muted">Page not found. <Link className="text-accent underline" to="/">Home</Link></div>} />
        </Routes>
        </Suspense>
      </main>
      {!isEmbedded && palette && <Suspense fallback={null}><CommandPalette open onClose={() => setPalette(false)} /></Suspense>}
    </div>
  );
}
