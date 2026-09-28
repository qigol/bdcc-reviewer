import { NavLink, Outlet, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { AlertTriangle, Dumbbell, Eye } from 'lucide-react';
import { useModule, type LoadedModule } from '../modules/store';
import { Markdown } from '../lib/md';
import { cn } from '../lib/util';
import { ModuleIcon } from '../app/icons';

export interface ModuleOutletCtx { mod: LoadedModule; base: string }
export const useModuleCtx = () => useOutletContext<ModuleOutletCtx>();

export function ModulePage({ preview = false }: { preview?: boolean }) {
  const { id } = useParams();
  const { mod, error, loading } = useModule(id, preview);
  const loc = useLocation();
  const nav = useNavigate();
  const base = `${preview ? '/preview' : ''}/m/${id}`;
  if (loading && !mod) return <div className="p-8"><div className="h-8 w-64 animate-pulse rounded bg-panel2" /><div className="mt-4 h-64 animate-pulse rounded-xl bg-panel2" /></div>;
  if (error || !mod) return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="card border-bad/40 p-5">
        <div className="mb-2 flex items-center gap-2 font-semibold text-bad"><AlertTriangle size={18} /> Couldn't open module “{id}”</div>
        <pre className="whitespace-pre-wrap text-xs text-muted">{error}</pre>
      </div>
    </div>
  );
  const m = mod.parsed.manifest;
  const tabs = [
    { to: 'intuition', label: 'Intuition' },
    { to: 'math-code', label: 'Math & Code' },
    { to: 'application', label: 'Application' },
  ];
  const errors = mod.issues.filter((i) => i.level === 'error');
  return (
    <div style={{ ['--mod' as any]: m.color }} className="flex min-h-full flex-col">
      {preview && (
        <div className="flex items-center gap-2 bg-warn/15 px-4 py-1.5 text-xs font-medium text-warn"><Eye size={14} /> Preview of an uploaded module: nothing is installed yet. <button className="ml-auto underline" onClick={() => nav('/admin')}>Back to admin</button></div>
      )}
      <div className="border-b border-line bg-panel">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-end gap-x-6 gap-y-2 px-4 pt-4">
          <div className="flex min-w-0 flex-1 items-center gap-3 pb-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: m.color ?? 'rgb(var(--accent))' }}><ModuleIcon name={m.icon} size={20} /></div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold">{m.title}</h1>
              <div className="truncate text-xs text-muted"><Markdown text={m.summary} inline raw /></div>
            </div>
          </div>
          <nav className="flex gap-1" role="tablist">
            {tabs.map((t) => (
              <NavLink key={t.to} to={`${base}/${t.to}`} role="tab"
                className={({ isActive }) => cn('rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium transition', isActive || loc.pathname.includes(`/${t.to}`) ? 'border-[color:var(--mod,rgb(var(--accent)))] text-ink' : 'border-transparent text-muted hover:text-ink')}
                style={({ isActive }) => (isActive ? { borderColor: m.color } : undefined)}>
                {t.label}
              </NavLink>
            ))}
            {!preview && (
              <button className="btn mb-1.5 ml-2" onClick={() => nav(`/quiz?modules=${m.id}&start=1`)}><Dumbbell size={15} /> Practice</button>
            )}
          </nav>
        </div>
        {errors.length > 0 && <div className="mx-auto max-w-[1400px] px-4 pb-2 text-xs text-warn">⚠ This module has {errors.length} validation error(s); some parts may not render. See Admin → Run checks.</div>}
      </div>
      <Outlet context={{ mod, base } satisfies ModuleOutletCtx} />
    </div>
  );
}
