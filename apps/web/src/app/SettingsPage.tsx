import { useRef, useState } from 'react';
import { Download, RotateCcw, Upload } from 'lucide-react';
import { useSetting } from '../storage/progress';
import { exportProgress, importProgress, resetProgress } from '../storage/exportImport';
import { useModuleStore } from '../modules/store';
import { download } from '../lib/util';

export function SettingsPage() {
  const [theme, setTheme] = useSetting('theme');
  const [narration, setNarration] = useSetting('narration');
  const [reduced, setReduced] = useSetting('reducedMotion');
  const [examDate, setExamDate] = useSetting('examDate');
  const [, setToken] = useSetting('adminToken');
  const { list } = useModuleStore();
  const [msg, setMsg] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState('');
  const file = useRef<HTMLInputElement>(null);
  return (
    <div className="mx-auto w-full max-w-[760px] px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold">Settings &amp; progress</h1>
      <div className="card divide-y divide-line">
        <Row label="Theme"><select className="input" value={theme} onChange={(e) => setTheme(e.target.value as any)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></Row>
        <Row label="Narrate scenes (text-to-speech)"><input type="checkbox" checked={narration} onChange={(e) => setNarration(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--accent))]" /></Row>
        <Row label="Reduce motion (fades instead of tweens)"><input type="checkbox" checked={reduced} onChange={(e) => setReduced(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--accent))]" /></Row>
        <Row label="Exam date"><input type="date" className="input" value={examDate ?? ''} onChange={(e) => setExamDate(e.target.value || null)} /></Row>
      </div>
      <h2 className="mb-2 mt-6 font-semibold">Your progress</h2>
      <p className="mb-2 text-sm text-muted">Progress lives in this browser (IndexedDB). Download it to back it up or move it to another device (e.g. laptop → phone), then import it there. Imports merge; for conflicts, the newer entry wins.</p>
      <div className="card flex flex-wrap items-center gap-2 p-4">
        <button className="btn" onClick={async () => download(`kodigo-progress-${new Date().toISOString().slice(0, 10)}.json`, await exportProgress(), 'application/json')}><Download size={15} /> Download my progress</button>
        <button className="btn" onClick={() => file.current?.click()}><Upload size={15} /> Import progress</button>
        <input ref={file} type="file" accept="application/json" hidden onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try { const r = await importProgress(await f.text()); setMsg(`Imported: ${r.added} added, ${r.updated} updated.`); } catch (err: any) { setMsg(`Import failed: ${err.message}`); }
          e.target.value = '';
        }} />
        {msg && <span className="text-sm text-muted">{msg}</span>}
      </div>
      <div className="card mt-3 flex flex-wrap items-center gap-2 p-4">
        <span className="text-sm font-medium">Reset</span>
        <select className="input" value={resetTarget} onChange={(e) => setResetTarget(e.target.value)}>
          <option value="">everything</option>
          {list.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
        </select>
        <button className="btn border-bad/50 text-bad" onClick={async () => {
          if (!confirm(`Reset progress for ${resetTarget || 'ALL modules'}? This cannot be undone.`)) return;
          await resetProgress(resetTarget || undefined);
          setMsg('Progress reset.');
        }}><RotateCcw size={15} /> Reset progress</button>
        <button className="btn ml-auto" onClick={() => { setToken(null); setMsg('Admin token forgotten on this device.'); }}>Forget admin token</button>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm"><span>{label}</span>{children}</div>;
}
