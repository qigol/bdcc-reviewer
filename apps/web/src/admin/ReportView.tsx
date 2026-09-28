import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Circle, Copy, XCircle } from 'lucide-react';
import { fixRequest, type ValidationReport } from '@kodigo/schema';
import { copyText, cn } from '../lib/util';

export function ReportView({ report, title }: { report: ValidationReport; title?: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [showWarn, setShowWarn] = useState(false);
  const errors = report.issues.filter((i) => i.level === 'error');
  const warnings = report.issues.filter((i) => i.level === 'warning');
  const copy = async () => {
    const ok = await copyText(fixRequest(report));
    setCopied(ok ? 'Copied! Paste it into the same LLM chat.' : 'Copy blocked: select the text below manually.');
  };
  return (
    <div className="card p-4" data-testid="report">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {report.ok ? <CheckCircle2 className="text-good" size={20} /> : <XCircle className="text-bad" size={20} />}
        <div className="font-semibold">{title ?? 'Validation'}: {report.id ?? '?'}@{report.version ?? '?'} {report.ok ? 'is valid' : `has ${errors.length} error${errors.length === 1 ? '' : 's'}`}</div>
        <span className="text-sm text-muted">{warnings.length} warning{warnings.length === 1 ? '' : 's'}</span>
        {!report.ok && <button className="btn-primary btn-sm ml-auto" onClick={copy} data-testid="copy-fix"><Copy size={13} /> Copy fix request for LLM</button>}
      </div>
      {copied && <div className="mb-2 text-xs text-muted">{copied}</div>}
      <div className="mb-3 grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
        {report.steps.map((s) => (
          <div key={s.step} className="flex items-center gap-1.5 text-sm">
            {s.status === 'ok' ? <CheckCircle2 size={15} className="text-good" /> : s.status === 'warn' ? <AlertTriangle size={15} className="text-warn" /> : s.status === 'error' ? <XCircle size={15} className="text-bad" /> : <Circle size={15} className="text-muted" />}
            {s.label}
          </div>
        ))}
      </div>
      {report.stats && <div className="mb-3 text-xs text-muted">examples {report.stats.examplesPassed}/{report.stats.examples} · {report.stats.scenes} scenes · {report.stats.sections} sections · {report.stats.templates} templates · {report.stats.instances} quiz instances generated</div>}
      {errors.length > 0 && (
        <ul className="mb-2 flex max-h-72 flex-col gap-1 overflow-auto text-sm">
          {errors.map((e, i) => (
            <li key={i} className="rounded-lg bg-bad/5 px-3 py-1.5">
              <span className="mr-2 rounded bg-bad/15 px-1 text-[10px] font-semibold uppercase text-bad">{e.step}</span>
              {e.file && <span className="font-mono text-xs text-muted">{e.file}{e.line ? `:${e.line}:${e.col ?? 1}` : ''} </span>}
              {e.path && <span className="font-mono text-xs text-muted">({e.path}) </span>}
              {e.message}
            </li>
          ))}
        </ul>
      )}
      {warnings.length > 0 && (
        <div>
          <button className="text-xs text-muted underline" onClick={() => setShowWarn(!showWarn)}>{showWarn ? 'Hide' : 'Show'} {warnings.length} warnings</button>
          {showWarn && (
            <ul className="mt-1 flex max-h-72 flex-col gap-1 overflow-auto text-xs">
              {warnings.map((e, i) => (
                <li key={i} className={cn('rounded-lg bg-warn/5 px-3 py-1')}>
                  <span className="mr-2 font-semibold uppercase text-warn">{e.step}</span>
                  {e.file && <span className="font-mono text-muted">{e.file}{e.line ? `:${e.line}` : ''} </span>}
                  {e.path && <span className="font-mono text-muted">({e.path}) </span>}
                  {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {!report.ok && copied?.startsWith('Copy blocked') && <textarea readOnly className="input mt-2 h-40 w-full font-mono text-xs" value={fixRequest(report)} onFocus={(e) => e.target.select()} />}
    </div>
  );
}
