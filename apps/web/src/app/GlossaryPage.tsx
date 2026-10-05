import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAllModules } from '../modules/useAll';
import { useCourses } from '../modules/courses';
import { Markdown, Tex } from '../lib/md';
import { glossaryWithHomes } from '@kodigo/schema';
import { cn } from '../lib/util';

export function GlossaryPage() {
  const { mods } = useAllModules();
  const [params] = useSearchParams();
  const [q, setQ] = useState('');
  const { courses, courseOf } = useCourses();
  // filter: 'all', 'course:<code>' or a module id (?course= opens on a course, e.g. from a running quiz)
  const [mod, setMod] = useState<string>(() => (params.get('course') ? `course:${params.get('course')}` : 'all'));
  const focus = params.get('term');
  // a term's lesson defaults to the Intuition scene that introduces it
  const terms = useMemo(() => mods.flatMap((m) => glossaryWithHomes(m.parsed.glossary, m.parsed.intuition).map((t) => ({ ...t, mod: m }))).sort((a, b) => a.term.localeCompare(b.term)), [mods]);
  const ql = q.toLowerCase();
  const inFilter = (id: string) => mod === 'all' || (mod.startsWith('course:') ? courseOf(id) === mod.slice(7) : id === mod);
  const multi = courses.length > 1;
  const shown = terms.filter((t) => inFilter(t.mod.id) && (!ql || [t.term, t.short, ...(t.aka ?? [])].some((x) => x.toLowerCase().includes(ql))));
  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">Glossary</h1>
        <input className="input w-64" placeholder="Search terms…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        <select className="input" value={mod} onChange={(e) => setMod(e.target.value)} aria-label="Filter by course or module">
          <option value="all">{multi ? 'All courses' : 'All modules'}</option>
          {courses.map((g) => (
            <optgroup key={g.course} label={g.course}>
              <option value={`course:${g.course}`}>All {g.course} modules</option>
              {g.modules.filter((e) => mods.some((m) => m.id === e.id)).map((e) => <option key={e.id} value={e.id}>{e.shortTitle}</option>)}
            </optgroup>
          ))}
        </select>
      </div>
      <div className="text-xs text-muted">{shown.length} terms · glossary questions are added to quizzes automatically</div>
      <div className="mt-3 grid gap-2">
        {shown.map((t) => (
          <div key={t.mod.id + t.id} id={`term-${t.id}`} className={cn('card p-4', focus === t.id && 'ring-2 ring-accent')}>
            <div className="flex flex-wrap items-baseline gap-2">
              <h3 className="font-semibold">{t.term}</h3>
              {t.aka?.length ? <span className="text-xs text-muted">aka {t.aka.join(', ')}</span> : null}
              <span className="ml-auto chip" style={{ borderColor: t.mod.parsed.manifest.color }}>{multi ? `${courseOf(t.mod.id) ?? ''} · ` : ''}{t.mod.parsed.manifest.shortTitle}</span>
            </div>
            <p className="mt-1 text-sm">{t.short}</p>
            {t.formula && <Tex tex={t.formula} className="mt-1" />}
            {t.long && <Markdown text={t.long} raw className="mt-1 text-sm text-muted" />}
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {t.related?.map((r) => <a key={r} href={`#term-${r}`} className="chip hover:border-accent">{t.mod.parsed.glossary.find((x) => x.id === r)?.term ?? r}</a>)}
              {t.lessonRef && <Link className="text-accent underline" to={`/m/${t.mod.id}/${t.lessonRef.tab}${t.lessonRef.tab === 'application' ? '' : `/${t.lessonRef.id}`}`}>{t.lessonRef.tab === 'intuition' ? `introduced in “${t.mod.parsed.intuition.find((s) => s.id === t.lessonRef!.id)?.title ?? t.lessonRef.id}” →` : 'see lesson →'}</Link>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
