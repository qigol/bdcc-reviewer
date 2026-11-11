import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Download, Plus, RotateCcw, Trash2, Upload } from 'lucide-react';
import { useSetting, type Exam } from '../storage/progress';
import { useAdminToken } from '../admin/token';
import { useBackupDue, usePersisted } from '../storage/persist';
import { useCourses } from '../modules/courses';
import { toYmd } from '../plan/studyPlan';
import { exportProgress, importProgress, resetProgress } from '../storage/exportImport';
import { useModuleStore } from '../modules/store';
import { groupByAssessment } from '../modules/courseGroups';
import { download } from '../lib/util';

export function SettingsPage() {
  const [theme, setTheme] = useSetting('theme');
  const [narration, setNarration] = useSetting('narration');
  const [reduced, setReduced] = useSetting('reducedMotion');
  const [, setToken] = useAdminToken();
  const [persisted, askPersist] = usePersisted();
  const backup = useBackupDue();
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
      </div>
      <ExamsEditor />
      <h2 className="mb-2 mt-6 font-semibold">Your progress</h2>
      <p className="mb-2 text-sm text-muted">Progress lives in this browser (IndexedDB). Download it to back it up or move it to another device (e.g. laptop → phone), then import it there. Imports merge; for conflicts, the newer entry wins.</p>
      {backup && <p className="mb-2 text-sm font-semibold text-warn" data-testid="backup-reminder">Back up your progress: download it below. This browser may clear it under storage pressure.</p>}
      {persisted !== null && (
        <p className="mb-2 flex flex-wrap items-center gap-2 text-sm text-muted" data-testid="storage-status">
          {persisted ? 'Storage: kept by the browser' : 'Storage: may be cleared by the browser'}
          {!persisted && <button className="btn btn-sm" onClick={askPersist}>Ask the browser to keep it</button>}
        </p>
      )}
      <div className="card flex flex-wrap items-center gap-2 p-4">
        <button className="btn" onClick={async () => download(`qdigo-progress-${new Date().toISOString().slice(0, 10)}.json`, await exportProgress(), 'application/json')}><Download size={15} /> Download my progress</button>
        <button className="btn" onClick={() => file.current?.click()}><Upload size={15} /> Import progress</button>
        <input ref={file} type="file" accept="application/json" hidden onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try { const r = await importProgress(await f.text()); setMsg(`Imported: ${r.added} added, ${r.updated} updated, ${r.skipped} skipped (invalid).`); } catch (err: any) { setMsg(`Import failed: ${err.message}`); }
          e.target.value = '';
        }} />
        {msg && <span className="text-sm text-muted">{msg}</span>}
      </div>
      <div className="card mt-3 flex flex-wrap items-center gap-2 p-4">
        <span className="text-sm font-medium">Reset</span>
        <select className="input min-w-0 max-w-full" value={resetTarget} onChange={(e) => setResetTarget(e.target.value)}>
          <option value="">everything</option>
          {list.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
        </select>
        <button className="btn border-bad/50 text-bad" onClick={async () => {
          if (!confirm(`Reset progress for ${resetTarget || 'ALL modules'}? This cannot be undone.`)) return;
          await resetProgress(resetTarget || undefined);
          setMsg('Progress reset.');
        }}><RotateCcw size={15} /> Reset progress</button>
        <button className="btn ml-auto" onClick={() => { setToken(null); setMsg('Admin token forgotten in this tab.'); }}>Forget admin token</button>
      </div>
    </div>
  );
}

/** Exams (one per course or part of a course) and the daily study budget the plan schedules into. */
function ExamsEditor() {
  const [exams, setExams] = useSetting('exams');
  const [hours, setHours] = useSetting('studyHoursPerDay');
  const [hoursDraft, setHoursDraft] = useState<string | null>(null);
  const { courses } = useCourses();
  const update = (id: string, patch: Partial<Exam>) => setExams(exams.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const add = () => {
    const course = courses[0]?.course;
    if (!course) return;
    setExams([...exams, { id: crypto.randomUUID(), name: `${course} exam`, course, date: toYmd(Date.now() + 14 * 86400000) }]);
  };
  return (
    <>
      <h2 className="mb-2 mt-6 flex items-center gap-2 font-semibold"><CalendarDays size={17} /> Exams &amp; study plan</h2>
      <p className="mb-2 text-sm text-muted">Add each exam and how long you can study a day. The <Link to="/plan" className="text-accent underline">study plan</Link> spreads your unfinished lessons over the days before each exam, with reviews first and practice the day before.</p>
      <div className="card divide-y divide-line" data-testid="exams-editor">
        <Row label="Study time per day (hours)">
          {/* a draft while typing, so an empty or half-typed value isn't snapped back; invalid ones revert on blur */}
          <input type="number" className="input w-24" min={0.5} max={16} step={0.5} value={hoursDraft ?? String(hours)} data-testid="study-hours"
            onChange={(e) => { setHoursDraft(e.target.value); const v = Number(e.target.value); if (v > 0 && v <= 16) setHours(v); }}
            onBlur={() => setHoursDraft(null)} />
        </Row>
        {exams.map((ex) => {
          const mods = courses.find((g) => g.course === ex.course)?.modules ?? [];
          const picked = ex.moduleIds?.length ? ex.moduleIds : null;
          return (
            <div key={ex.id} className="flex flex-col gap-2 px-4 py-3 text-sm" data-testid="exam-row">
              <div className="flex flex-wrap items-center gap-2">
                <input className="input min-w-0 flex-1" value={ex.name} aria-label="Exam name" onChange={(e) => update(ex.id, { name: e.target.value })} />
                <select className="input min-w-0 max-w-full" value={ex.course} aria-label="Course" onChange={(e) => update(ex.id, { course: e.target.value, moduleIds: undefined, ...(ex.name === `${ex.course} exam` && { name: `${e.target.value} exam` }) })}>
                  {!courses.some((g) => g.course === ex.course) && <option value={ex.course}>{ex.course}</option>}
                  {courses.map((g) => <option key={g.course} value={g.course}>{g.course}</option>)}
                </select>
                <input type="date" className="input" value={ex.date} aria-label="Exam date" onChange={(e) => e.target.value && update(ex.id, { date: e.target.value })} />
                <button className="btn-ghost btn-sm text-bad" title="Remove exam" aria-label={`Remove ${ex.name}`} onClick={() => setExams(exams.filter((e) => e.id !== ex.id))}><Trash2 size={15} /></button>
              </div>
              {mods.length > 1 && (
                <details>
                  <summary className="cursor-pointer text-xs text-muted">Covers {picked ? `${picked.length} of ${mods.length} modules` : `all ${mods.length} modules`}</summary>
                  {groupByAssessment(mods).filter((s) => s.assessment).length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-muted">Just one test:</span>
                      {groupByAssessment(mods).filter((s) => s.assessment).map((s) => (
                        <button key={s.assessment} type="button" className="btn btn-sm" data-testid="exam-assessment"
                          onClick={() => update(ex.id, { moduleIds: s.modules.length < mods.length ? s.modules.map((m) => m.id) : undefined, ...(ex.name === `${ex.course} exam` && { name: `${ex.course} ${s.assessment}` }) })}>
                          {s.assessment}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {mods.map((m) => (
                      <label key={m.id} className="flex items-center gap-1.5 text-xs">
                        <input type="checkbox" className="h-3.5 w-3.5 accent-[rgb(var(--accent))]" checked={!picked || picked.includes(m.id)}
                          onChange={(e) => {
                            const cur = picked ?? mods.map((x) => x.id);
                            const next = e.target.checked ? [...cur, m.id] : cur.filter((id) => id !== m.id);
                            // all checked (or none) means the whole course
                            update(ex.id, { moduleIds: next.length && next.length < mods.length ? mods.map((x) => x.id).filter((id) => next.includes(id)) : undefined });
                          }} />
                        {m.shortTitle}
                      </label>
                    ))}
                  </div>
                </details>
              )}
            </div>
          );
        })}
        <div className="px-4 py-3"><button className="btn btn-sm" onClick={add} disabled={!courses.length} data-testid="add-exam"><Plus size={14} /> Add exam</button></div>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm"><span>{label}</span>{children}</div>;
}
