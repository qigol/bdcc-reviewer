import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardPaste, Eye, FileArchive, FolderOpen, Loader2, Paperclip, Terminal, Upload } from 'lucide-react';
import { parseBundle, readZip, validateModule, normalizePath, type FileMap, type ValidationReport } from '@kodigo/schema';
import { browserHostFactory } from '../modules/logic';
import { useModuleStore } from '../modules/store';
import { api } from '../lib/api';
import { ReportView } from './ReportView';
import { cn } from '../lib/util';

type Src = 'zip' | 'paste' | 'cli';

function toBase64(u8: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
}

export function ImportPanel({ token, onInstalled }: { token: string; onInstalled: () => void }) {
  const [src, setSrc] = useState<Src>('zip');
  const [files, setFiles] = useState<FileMap | null>(null);
  const [pastes, setPastes] = useState<string[]>([]);
  const [paste, setPaste] = useState('');
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [serverReport, setServerReport] = useState<ValidationReport | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'good' | 'bad' | 'warn'; text: string } | null>(null);
  const [drag, setDrag] = useState(false);
  const store = useModuleStore();
  const nav = useNavigate();
  const zipInput = useRef<HTMLInputElement>(null);
  const dirInput = useRef<HTMLInputElement>(null);
  const pdfInput = useRef<HTMLInputElement>(null);
  const bundle = useMemo(() => (pastes.length ? parseBundle(pastes.join('\n')) : null), [pastes]);

  const run = async (fm: FileMap) => {
    setFiles(fm);
    setReport(null);
    setServerReport(null);
    setMsg(null);
    setBusy('Validating in your browser (structure, schema, references, lecture examples, 25 seeds per quiz template)…');
    try {
      const r = await validateModule(fm, { hostFactory: browserHostFactory });
      const { module: _m, ...rest } = r as any;
      setReport(rest);
    } catch (e: any) {
      setMsg({ tone: 'bad', text: String(e?.message ?? e) });
    } finally { setBusy(null); }
  };

  const onZip = async (f: File) => run(await readZip(await f.arrayBuffer()));
  const onDir = async (list: FileList) => {
    const fm: FileMap = {};
    const all = [...list];
    const manifest = all.find((f) => /(^|\/)manifest\.(ya?ml|json)$/.test((f as any).webkitRelativePath || f.name));
    const rel0 = manifest ? ((manifest as any).webkitRelativePath as string) : '';
    const prefix = rel0.includes('/') ? rel0.slice(0, rel0.lastIndexOf('/') + 1) : '';
    for (const f of all) {
      let p = normalizePath((f as any).webkitRelativePath || f.name);
      if (prefix && p.startsWith(prefix)) p = p.slice(prefix.length);
      if (/(^|\/)\./.test(p)) continue;
      fm[p] = /\.(ya?ml|json|md|js|txt|svg|csv)$/i.test(p) ? await f.text() : new Uint8Array(await f.arrayBuffer());
    }
    run(fm);
  };
  const addPaste = () => {
    if (!paste.trim()) return;
    const next = [...pastes, paste];
    setPastes(next);
    setPaste('');
    const b = parseBundle(next.join('\n'));
    if (!b.incomplete && !b.continued && Object.keys(b.files).length) run({ ...(files ?? {}), ...b.files });
  };
  const attachPdf = async (f: File) => {
    if (!files) return;
    const fm = { ...files, [`sources/${f.name}`]: new Uint8Array(await f.arrayBuffer()) };
    setFiles(fm);
    setMsg({ tone: 'good', text: `Attached sources/${f.name}. "Open slide" links will work if manifest.sources[].file is "${f.name}".` });
  };

  const install = async (allowDowngrade = false) => {
    if (!files) return;
    setBusy('Uploading; the server validates again…');
    try {
      const body: Record<string, string | { base64: string }> = {};
      for (const [p, c] of Object.entries(files)) body[p] = typeof c === 'string' ? c : { base64: toBase64(c) };
      const r = await api.install(token, { files: body }, { allowDowngrade });
      if (r.status === 409) {
        if (confirm(`${r.body.message}\n\nInstall anyway?`)) { setBusy(null); return install(true); }
        setMsg({ tone: 'warn', text: 'Import cancelled.' });
      } else if (r.status === 200) {
        setServerReport(r.body.report);
        setMsg({ tone: 'good', text: `Installed ${r.body.id}@${r.body.version}${r.body.upgradedFrom ? ` (upgraded from ${r.body.upgradedFrom})` : ''}. Progress keyed by stable IDs carries over.` });
        onInstalled();
      } else if (r.status === 422) {
        setServerReport(r.body.report);
        setMsg({ tone: 'bad', text: 'The server rejected the module (see its report below).' });
      } else setMsg({ tone: 'bad', text: r.body?.error ?? `HTTP ${r.status}` });
    } catch (e: any) { setMsg({ tone: 'bad', text: String(e?.message ?? e) }); }
    finally { setBusy(null); }
  };

  const preview = () => {
    if (!files) return;
    try { const m = store.setPreview(files); nav(`/preview/m/${m.id}/intuition`); } catch (e: any) { setMsg({ tone: 'bad', text: String(e?.message ?? e) }); }
  };

  const tabs: { id: Src; label: string; icon: any }[] = [
    { id: 'zip', label: 'Zip or folder', icon: FileArchive },
    { id: 'paste', label: 'Paste LLM output', icon: ClipboardPaste },
    { id: 'cli', label: 'CLI', icon: Terminal },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1">
        {tabs.map((t) => <button key={t.id} className={cn('btn', src === t.id && 'border-accent/60 bg-accent/10 text-accent')} onClick={() => setSrc(t.id)}><t.icon size={15} /> {t.label}</button>)}
      </div>
      {src === 'zip' && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) onZip(f); }}
          className={cn('flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center', drag ? 'border-accent bg-accent/5' : 'border-line')}
        >
          <Upload size={28} className="text-muted" />
          <div className="text-sm">Drop a module <b>.zip</b> here</div>
          <div className="flex gap-2">
            <button className="btn" onClick={() => zipInput.current?.click()}><FileArchive size={15} /> Choose zip</button>
            <button className="btn" onClick={() => dirInput.current?.click()}><FolderOpen size={15} /> Choose folder</button>
          </div>
          <input ref={zipInput} type="file" accept=".zip,application/zip" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onZip(f); e.target.value = ''; }} />
          <input ref={dirInput} type="file" hidden {...({ webkitdirectory: '', directory: '' } as any)} multiple onChange={(e) => { if (e.target.files?.length) onDir(e.target.files); e.target.value = ''; }} />
        </div>
      )}
      {src === 'paste' && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted">Paste the whole answer from the LLM (<code>&lt;&lt;&lt;BUNDLE …&gt;&gt;&gt;</code> … <code>&lt;&lt;&lt;END BUNDLE&gt;&gt;&gt;</code>). If the answer was split across messages (<code>&lt;&lt;&lt;CONTINUE&gt;&gt;&gt;</code>), add each part in order. A fix-request answer with only some files is merged over the previous import.</p>
          <textarea className="input h-56 w-full font-mono text-xs" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="<<<BUNDLE my-module@1.0.0>>>" data-testid="paste-box" />
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn-primary" onClick={addPaste} disabled={!paste.trim()}>{pastes.length ? 'Add next part' : 'Add paste'}</button>
            {pastes.length > 0 && <button className="btn" onClick={() => { setPastes([]); }}>Clear pastes ({pastes.length})</button>}
            {bundle && <span className="text-xs text-muted">{Object.keys(bundle.files).length} files parsed{bundle.id ? ` · ${bundle.id}@${bundle.version}` : ''}{bundle.continued ? ' · waiting for the next part (<<<CONTINUE>>>)' : ''}</span>}
            {bundle && (bundle.continued || bundle.incomplete) && <button className="btn btn-sm" onClick={() => run({ ...(files ?? {}), ...bundle.files })}>Validate what I have</button>}
          </div>
          {bundle?.errors.map((e, i) => <div key={i} className="text-xs text-warn">{e}</div>)}
        </div>
      )}
      {src === 'cli' && (
        <div className="card p-4 text-sm">
          <p className="mb-2">With repo access (e.g. a Claude Code session):</p>
          <pre className="rounded-lg bg-panel2 p-3 font-mono text-xs">{`pnpm kodigo unbundle answer.txt modules/<id>   # if you have bundle text
pnpm kodigo validate modules/<id> --warnings     # repeat until clean
pnpm kodigo pack modules/<id>                    # zip + bundle in dist/modules
git add modules/<id> && git commit`}</pre>
          <p className="mt-2 text-muted">Built-in modules live in <code>modules/</code> and ship inside the Docker image; the image build fails if any of them is invalid.</p>
        </div>
      )}
      {busy && <div className="flex items-center gap-2 text-sm text-muted"><Loader2 size={15} className="animate-spin" /> {busy}</div>}
      {msg && <div className={cn('rounded-lg px-3 py-2 text-sm', msg.tone === 'good' ? 'bg-good/10 text-good' : msg.tone === 'bad' ? 'bg-bad/10 text-bad' : 'bg-warn/10 text-warn')}>{msg.text}</div>}
      {files && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>{Object.keys(files).length} files: {Object.keys(files).slice(0, 14).join(', ')}{Object.keys(files).length > 14 ? '…' : ''}</span>
          <button className="btn btn-sm" onClick={() => pdfInput.current?.click()}><Paperclip size={13} /> Attach source PDF</button>
          <input ref={pdfInput} type="file" accept="application/pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) attachPdf(f); e.target.value = ''; }} />
        </div>
      )}
      {report && <ReportView report={report} title="Browser check" />}
      {report && files && (
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={preview} disabled={!!busy}><Eye size={15} /> Preview</button>
          <button className="btn-primary" onClick={() => install()} disabled={!report.ok || !!busy} data-testid="install">Install{report.ok ? '' : ' (fix errors first)'}</button>
        </div>
      )}
      {serverReport && <ReportView report={serverReport} title="Server check" />}
    </div>
  );
}
