import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAllModules } from '../modules/useAll';
import { Markdown, Tex } from '../lib/md';
import { cn } from '../lib/util';

export function GlossaryPage() {
  const { mods } = useAllModules();
  const [params] = useSearchParams();
  const [q, setQ] = useState('');
  const [mod, setMod] = useState<string>('all');
  const focus = params.get('term');
  const terms = useMemo(() => mods.flatMap((m) => m.parsed.glossary.map((t) => ({ ...t, mod: m }))).sort((a, b) => a.term.localeCompare(b.term)), [mods]);
  const ql = q.toLowerCase();
  const shown = terms.filter((t) => (mod === 'all' || t.mod.id === mod) && (!ql || [t.term, t.short, ...(t.aka ?? [])].some((x) => x.toLowerCase().includes(ql))));
  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">Glossary</h1>
        <input className="input w-64" placeholder="Search terms…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        <select className="input" value={mod} onChange={(e) => setMod(e.target.value)}>
          <option value="all">All modules</option>
          {mods.map((m) => <option key={m.id} value={m.id}>{m.parsed.manifest.shortTitle}</option>)}
        </select>
      </div>
      <div className="text-xs text-muted">{shown.length} terms · glossary questions are added to quizzes automatically</div>
      <div className="mt-3 grid gap-2">
        {shown.map((t) => (
          <div key={t.mod.id + t.id} id={`term-${t.id}`} className={cn('card p-4', focus === t.id && 'ring-2 ring-accent')}>
            <div className="flex flex-wrap items-baseline gap-2">
              <h3 className="font-semibold">{t.term}</h3>
              {t.aka?.length ? <span className="text-xs text-muted">aka {t.aka.join(', ')}</span> : null}
              <span className="ml-auto chip" style={{ borderColor: t.mod.parsed.manifest.color }}>{t.mod.parsed.manifest.shortTitle}</span>
            </div>
            <p className="mt-1 text-sm">{t.short}</p>
            {t.formula && <Tex tex={t.formula} className="mt-1" />}
            {t.long && <Markdown text={t.long} raw className="mt-1 text-sm text-muted" />}
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {t.related?.map((r) => <a key={r} href={`#term-${r}`} className="chip hover:border-accent">{t.mod.parsed.glossary.find((x) => x.id === r)?.term ?? r}</a>)}
              {t.lessonRef && <Link className="text-accent underline" to={`/m/${t.mod.id}/${t.lessonRef.tab}${t.lessonRef.tab === 'application' ? '' : `/${t.lessonRef.id}`}`}>see lesson →</Link>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
