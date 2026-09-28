import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, CheckCircle2, Download, Eye, FileCode2, FileText, GripVertical, KeyRound, Loader2, PlayCircle, Shield, Trash2, Upload, XCircle } from 'lucide-react';
import { formatBundle, validateModule, type ValidationReport } from '@kodigo/schema';
import { useModuleStore } from '../modules/store';
import { useSetting } from '../storage/progress';
import { api, type ModuleListEntry } from '../lib/api';
import { download, cn } from '../lib/util';
import { ImportPanel } from './ImportPanel';
import { ReportView } from './ReportView';
import { browserHostFactory } from '../modules/logic';
import { ModuleIcon } from '../app/icons';

function TokenGate({ onOk }: { onOk: (t: string) => void }) {
  const [t, setT] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="card p-6">
        <div className="mb-2 flex items-center gap-2 font-semibold"><KeyRound size={18} /> Admin</div>
        <p className="mb-3 text-sm text-muted">Enter the server's <code>ADMIN_TOKEN</code>. It's stored in this browser only. (Meant for use behind Tailscale, not the open internet.)</p>
        <form onSubmit={async (e) => { e.preventDefault(); setBusy(true); setErr(null); try { await api.checkAdmin(t); onOk(t); } catch (x: any) { setErr(x.message); } finally { setBusy(false); } }} className="flex gap-2">
          <input className="input flex-1" type="password" value={t} onChange={(e) => setT(e.target.value)} placeholder="ADMIN_TOKEN" autoFocus data-testid="admin-token" />
          <button className="btn-primary" disabled={!t || busy}>{busy ? <Loader2 size={15} className="animate-spin" /> : 'Unlock'}</button>
        </form>
        {err && <div className="mt-2 text-sm text-bad">{err}</div>}
      </div>
    </div>
  );
}

function Health({ h }: { h: ModuleListEntry['health'] }) {
  if (h.status === 'pending') return <span className="flex items-center gap-1 text-xs text-muted"><Loader2 size={13} className="animate-spin" /> checking</span>;
  if (h.status === 'valid') return <span className="flex items-center gap-1 text-xs text-good"><CheckCircle2 size={14} /> valid</span>;
  if (h.status === 'warnings') return <span className="flex items-center gap-1 text-xs text-warn" title={`${h.warnings} warnings`}><AlertTriangle size={14} /> {h.warnings} warnings</span>;
  return <span className="flex items-center gap-1 text-xs text-bad"><XCircle size={14} /> {h.errors} errors</span>;
}

function Row({ m, token, onChange, onReport }: { m: ModuleListEntry; token: string; onChange: () => void; onReport: (r: ValidationReport, title: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: m.id });
  const store = useModuleStore();
  const nav = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const act = async (label: string, fn: () => Promise<any>) => { setBusy(label); try { await fn(); } catch (e: any) { alert(e.message); } finally { setBusy(null); } };
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn('card flex flex-wrap items-center gap-3 px-3 py-2.5', !m.enabled && 'opacity-60')} data-testid={`admin-row-${m.id}`}>
      <button className="cursor-grab text-muted" aria-label="reorder" {...attributes} {...listeners}><GripVertical size={16} /></button>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg text-white" style={{ background: m.color ?? 'rgb(var(--accent))' }}><ModuleIcon name={m.icon} size={16} /></div>
      <div className="min-w-[180px] flex-1">
        <div className="font-medium">{m.title}</div>
        <div className="text-xs text-muted"><code>{m.id}</code> · v{m.version} · {m.origin}{m.origin === 'imported' && m.hasBuiltin ? ' (overrides built-in)' : ''}</div>
      </div>
      <Health h={m.health} />
      <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={m.enabled} onChange={(e) => act('toggle', async () => { await api.patch(token, m.id, { enabled: e.target.checked }); onChange(); })} className="accent-[rgb(var(--accent))]" /> enabled</label>
      {m.versions.length > 1 && (
        <select className="input py-0.5 text-xs" value={m.version} onChange={(e) => act('rollback', async () => { await api.patch(token, m.id, { current: e.target.value }); onChange(); })} title="stored versions (rollback)">
          {m.versions.map((v) => <option key={v} value={v}>v{v}</option>)}
        </select>
      )}
      <div className="flex flex-wrap gap-1">
        <button className="btn btn-sm" title="Preview" onClick={() => nav(`/m/${m.id}/intuition`)}><Eye size={13} /></button>
        <button className="btn btn-sm" title="Run checks (server)" onClick={() => act('checks', async () => onReport(await api.report(m.id), `Server check · ${m.id}`))}>{busy === 'checks' ? <Loader2 size={13} className="animate-spin" /> : <PlayCircle size={13} />} Checks</button>
        <button className="btn btn-sm" title="Run checks in this browser" onClick={() => act('bchecks', async () => { const { files } = await api.files(m.id); const r = await validateModule(files, { hostFactory: browserHostFactory }); const { module: _m, ...rest } = r as any; onReport(rest, `Browser check · ${m.id}`); })}>{busy === 'bchecks' ? <Loader2 size={13} className="animate-spin" /> : 'in browser'}</button>
        <a className="btn btn-sm" title="Export zip" href={api.exportUrl(m.id)}><Download size={13} /> zip</a>
        <button className="btn btn-sm" title="Export as bundle text (for an LLM)" onClick={() => act('bundle', async () => { const { files } = await api.files(m.id); download(`${m.id}@${m.version}.bundle.txt`, formatBundle(m.id, m.version, files), 'text/plain'); })}><FileCode2 size={13} /> bundle</button>
        {m.origin === 'imported' && <button className="btn btn-sm text-bad" title="Delete imported module" onClick={() => { if (confirm(`Delete imported module ${m.id} (all stored versions)?${m.hasBuiltin ? ' The built-in version will be used again.' : ''}`)) act('delete', async () => { await api.remove(token, m.id); await store.refresh(); onChange(); }); }}><Trash2 size={13} /></button>}
      </div>
    </li>
  );
}

export function AdminPage() {
  const [token, setToken] = useSetting('adminToken');
  const store = useModuleStore();
  const [report, setReport] = useState<{ r: ValidationReport; title: string } | null>(null);
  const [tab, setTab] = useState<'modules' | 'import'>('modules');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  if (!token) return <TokenGate onOk={(t) => setToken(t)} />;
  const list = store.list;
  const onDragEnd = async (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = list.map((m) => m.id);
    const next = arrayMove(ids, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id)));
    try { await Promise.all(next.map((id, i) => api.patch(token, id, { order: (i + 1) * 10 }))); } catch (x: any) { alert(x.message); }
    store.refresh();
  };
  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto flex items-center gap-2 text-xl font-semibold"><Shield size={20} /> Admin</h1>
        <a className="btn" href="/api/widgets.md"><Download size={15} /> Widget reference (WIDGETS.md)</a>
        <a className="btn" href="/docs/MODULE_AUTHORING_GUIDE.md" download><FileText size={15} /> Authoring guide</a>
        <button className="btn-ghost btn-sm" onClick={() => setToken(null)}>Lock</button>
      </div>
      <div className="mb-4 flex gap-1">
        <button className={cn('btn', tab === 'modules' && 'border-accent/60 bg-accent/10 text-accent')} onClick={() => setTab('modules')}>Modules ({list.length})</button>
        <button className={cn('btn', tab === 'import' && 'border-accent/60 bg-accent/10 text-accent')} onClick={() => setTab('import')} data-testid="tab-import"><Upload size={15} /> Import</button>
      </div>
      {tab === 'modules' ? (
        <>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={list.map((m) => m.id)} strategy={verticalListSortingStrategy}>
              <ul className="flex flex-col gap-2">{list.map((m) => <Row key={m.id} m={m} token={token} onChange={() => store.refresh()} onReport={(r, title) => setReport({ r, title })} />)}</ul>
            </SortableContext>
          </DndContext>
          <p className="mt-2 text-xs text-muted">Drag to reorder the tab bar. Built-in modules can be disabled but not deleted; importing the same id with a higher version upgrades it (the last 3 versions are kept for rollback).</p>
          {report && <div className="mt-4"><ReportView report={report.r} title={report.title} /></div>}
        </>
      ) : (
        <ImportPanel token={token} onInstalled={() => store.refresh()} />
      )}
    </div>
  );
}
