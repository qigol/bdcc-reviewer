import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Network, StickyNote } from 'lucide-react';
import { useAllModules } from '../modules/useAll';
import { useCourses } from '../modules/courses';
import { GlossaryProvider, Markdown, TermHrefContext, Tex } from '../lib/md';
import { isEmbedded } from '../lib/popup';
import { cn } from '../lib/util';
import { around, buildNotes, noteHref, type Note, type NoteIndex } from '../glossary/notes';
import { ForceGraph, type GLink, type GNode } from '../glossary/ForceGraph';

/** Course colours in the graph (readable on light and dark panels). */
const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#0ea5e9', '#a855f7', '#ef4444', '#14b8a6'];

/**
 * The glossary as linked notes: /glossary (list), /glossary/:termId (a note with its links, backlinks and
 * lesson mentions, plus a local graph) and /glossary/graph (every note). Old ?term= links redirect to the note;
 * ?course= opens the list filtered to a course (the quiz popup uses it).
 */
export function GlossaryPage() {
  const { mods, loading } = useAllModules();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const sub = useParams()['*'] ?? '';
  const view = sub === 'graph' ? 'graph' : sub ? 'note' : 'index';
  const { courses, courseOf } = useCourses();
  const [q, setQ] = useState('');
  // filter: 'all', 'course:<code>' or a module id
  const [filter, setFilter] = useState<string>(() => (params.get('course') ? `course:${params.get('course')}` : 'all'));
  const [showLonely, setShowLonely] = useState(false);
  const index = useMemo(() => buildNotes(mods), [mods]);
  const multi = courses.length > 1;

  const legacyTerm = params.get('term');
  useEffect(() => { if (legacyTerm) nav(noteHref(legacyTerm), { replace: true }); }, [legacyTerm]);

  const colorOf = useMemo(() => {
    const byCourse = new Map(courses.map((g, i) => [g.course, PALETTE[i % PALETTE.length]]));
    return (n: Note) => (multi ? byCourse.get(courseOf(n.defs[0].mod.id) ?? '') : n.defs[0].mod.parsed.manifest.color) ?? PALETTE[0];
  }, [courses, courseOf, multi]);
  const inFilter = (n: Note) => filter === 'all' || n.defs.some((d) => (filter.startsWith('course:') ? courseOf(d.mod.id) === filter.slice(7) : d.mod.id === filter));
  const ql = q.toLowerCase();
  const matches = (n: Note) => !ql || [n.title, ...n.aka, ...n.defs.map((d) => d.term.short)].some((x) => x.toLowerCase().includes(ql));
  const filtered = index.list.filter(inFilter);
  const shown = filtered.filter(matches);
  const note = view === 'note' ? index.notes.get(sub) : undefined;

  useEffect(() => { if (note) document.querySelector(`[data-note="${note.id}"]`)?.scrollIntoView({ block: 'center' }); }, [note?.id, loading]);

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
      <h1 className="text-xl font-semibold">Glossary</h1>
      <div className="mr-auto flex gap-0.5 rounded-lg bg-panel2 p-0.5" role="tablist" aria-label="Glossary view">
        <Link role="tab" aria-selected={view !== 'graph'} to={note ? noteHref(note.id) : '/glossary'} className={cn('flex items-center gap-1 rounded-md px-2.5 py-1 text-sm', view !== 'graph' ? 'bg-panel shadow-sm' : 'text-muted hover:text-ink')}><StickyNote size={14} />Notes</Link>
        <Link role="tab" aria-selected={view === 'graph'} to="/glossary/graph" className={cn('flex items-center gap-1 rounded-md px-2.5 py-1 text-sm', view === 'graph' ? 'bg-panel shadow-sm' : 'text-muted hover:text-ink')}><Network size={14} />Graph</Link>
      </div>
      <input className="input w-full sm:w-56" placeholder={view === 'graph' ? 'Highlight terms…' : 'Search terms…'} value={q} onChange={(e) => setQ(e.target.value)} autoFocus={view === 'index'} />
      <select className="input" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by course or module">
        <option value="all">{multi ? 'All courses' : 'All modules'}</option>
        {/* the course row itself selects the whole course; its modules are indented under it */}
        {courses.flatMap((g) => [
          <option key={g.course} value={`course:${g.course}`} className="font-semibold">{g.course}</option>,
          ...g.modules.filter((e) => mods.some((m) => m.id === e.id)).map((e) => <option key={e.id} value={e.id}>{' '}{e.shortTitle}</option>),
        ])}
      </select>
    </div>
  );

  const height = isEmbedded ? 'md:h-screen' : 'md:h-[calc(100dvh-3rem)]';
  if (view === 'graph') {
    return (
      <div className={cn('mx-auto flex w-full max-w-[1400px] flex-col', height)}>
        {toolbar}
        <GlossaryGraph index={index} notes={filtered} q={ql} matches={matches} colorOf={colorOf} showLonely={showLonely} onSelect={(id) => nav(noteHref(id))} />
        <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-2 text-xs text-muted">
          {multi && courses.map((g, i) => <span key={g.course} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />{g.course}</span>)}
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={showLonely} onChange={(e) => setShowLonely(e.target.checked)} /> Show unlinked terms</label>
          <span className="ml-auto">Drag to pan · scroll to zoom · click a term to open it</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('mx-auto flex w-full max-w-[1400px] flex-col', height)}>
      {toolbar}
      <div className="flex min-h-0 flex-1">
        <aside className={cn('w-full shrink-0 flex-col border-line md:flex md:w-72 md:border-r', view === 'note' ? 'hidden' : 'flex')} aria-label="Terms">
          <div className="px-4 py-2 text-xs text-muted">{loading ? 'Loading…' : `${shown.length} terms`}</div>
          <ul className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2 pb-4">
            {shown.map((n) => (
              <li key={n.id}>
                <Link to={noteHref(n.id)} data-note={n.id} aria-current={note?.id === n.id ? 'page' : undefined}
                  className={cn('flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm', note?.id === n.id ? 'bg-panel2 font-medium' : 'hover:bg-panel2')}>
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: colorOf(n) }} />
                  <span className="min-w-0"><span className="block truncate">{n.title}</span><span className="block truncate text-xs text-muted">{n.defs[0].term.short}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        </aside>
        <section className={cn('scrollbar-thin min-w-0 flex-1 overflow-y-auto', view === 'note' ? 'block' : 'hidden md:block')}>
          {note ? (
            <NoteView key={note.id} note={note} index={index} filter={inFilter} colorOf={colorOf} courseOf={multi ? courseOf : undefined} />
          ) : view === 'note' ? (
            <div className="p-10 text-center text-muted">{loading ? 'Loading…' : <>No term “{sub}”. <Link className="text-accent underline" to="/glossary">All terms</Link></>}</div>
          ) : (
            <div className="mx-auto max-w-md p-10 text-center text-sm text-muted">
              <Network size={28} className="mx-auto mb-3 text-accent" />
              <p>{index.list.length} terms, {index.edges.length} links between them. Pick a term to read its note, or <Link to="/glossary/graph" className="text-accent underline">open the graph</Link> to see how they connect.</p>
              <p className="mt-2 text-xs">Glossary questions are added to quizzes automatically.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function NoteView({ note, index, filter, colorOf, courseOf }: { note: Note; index: NoteIndex; filter: (n: Note) => boolean; colorOf: (n: Note) => string; courseOf?: (id: string) => string | undefined }) {
  // the definition shown first: one from a module in the current filter
  const [tab, setTab] = useState(() => Math.max(0, note.defs.findIndex((d) => filter({ ...note, defs: [d] }))));
  const [depth, setDepth] = useState(1);
  const nav = useNavigate();
  const { mod, term } = note.defs[tab];
  const ref = term.lessonRef;
  const chip = (id: string) => {
    const n = index.notes.get(id);
    return n && <Link key={id} to={noteHref(id)} className="chip gap-1.5 hover:border-accent"><span className="h-1.5 w-1.5 rounded-full" style={{ background: colorOf(n) }} />{n.title}</Link>;
  };
  const byModule = [...new Set(note.mentions.map((m) => m.mod))];
  const label = (m: typeof mod) => `${courseOf ? `${courseOf(m.id) ?? ''} · ` : ''}${m.parsed.manifest.shortTitle}`;

  const local = useMemo(() => {
    const keep = around(index, note.id, depth);
    const nodes: GNode[] = [...keep].map((id) => {
      const n = index.notes.get(id)!;
      return { id, label: n.title, color: colorOf(n), r: id === note.id ? 7 : 4.5 };
    });
    const links: GLink[] = index.edges.filter(([a, b]) => keep.has(a) && keep.has(b)).map(([a, b]) => ({ source: a, target: b }));
    return { nodes, links };
  }, [index, note.id, depth, colorOf]);

  return (
    <div className="lg:flex">
      <article className="min-w-0 flex-1 px-5 py-5 md:px-8" data-testid="glossary-note">
        <Link to="/glossary" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink md:hidden"><ArrowLeft size={14} /> All terms</Link>
        <h2 className="text-2xl font-semibold">{note.title}</h2>
        {note.aka.length > 0 && <div className="mt-1 text-sm text-muted">aka {note.aka.join(', ')}</div>}
        <div className="mt-3 flex flex-wrap gap-1.5" role={note.defs.length > 1 ? 'tablist' : undefined} aria-label="Definition from module">
          {note.defs.map((d, i) => (
            note.defs.length > 1
              ? <button key={d.mod.id} role="tab" aria-selected={i === tab} onClick={() => setTab(i)} className={cn('chip', i === tab ? 'border-accent text-ink' : 'text-muted hover:text-ink')}>{label(d.mod)}</button>
              : <span key={d.mod.id} className="chip" style={{ borderColor: d.mod.parsed.manifest.color }}>{label(d.mod)}</span>
          ))}
        </div>

        <p className="mt-4 text-base">{term.short}</p>
        {term.formula && <Tex tex={term.formula} className="mt-2" />}
        {term.long && (
          <GlossaryProvider terms={mod.parsed.glossary}>
            <TermHrefContext.Provider value={noteHref}>
              <Markdown text={term.long} raw className="mt-3 text-sm text-muted" />
            </TermHrefContext.Provider>
          </GlossaryProvider>
        )}
        {ref && (
          <Link className="mt-3 inline-flex items-center gap-1 text-sm text-accent underline" to={`/m/${mod.id}/${ref.tab}${ref.tab === 'application' ? '' : `/${ref.id}`}`}>
            <BookOpen size={14} />{ref.tab === 'intuition' ? `Introduced in “${mod.parsed.intuition.find((s) => s.id === ref.id)?.title ?? ref.id}”` : 'See the lesson'} →
          </Link>
        )}

        {note.links.length > 0 && <Group title="Links">{note.links.map(chip)}</Group>}
        {note.backlinks.length > 0 && <Group title="Backlinks">{note.backlinks.map(chip)}</Group>}
        {note.mentions.length > 0 && (
          <div className="mt-6">
            <div className="label mb-2">Mentioned in</div>
            {byModule.map((m) => (
              <div key={m.id} className="mb-2">
                {byModule.length > 1 && <div className="mb-1 text-xs text-muted">{label(m)}</div>}
                <ul className="grid gap-1 text-sm">
                  {note.mentions.filter((x) => x.mod === m).map((x) => (
                    <li key={x.to}><Link to={x.to} className="hover:text-accent hover:underline"><span className="text-muted">{x.kind === 'scene' ? 'Intuition' : x.kind === 'section' ? 'Math' : 'Application'} · </span>{x.title}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </article>
      <aside className="border-line px-5 pb-6 md:px-8 lg:w-80 lg:shrink-0 lg:border-l lg:px-4 lg:py-5" aria-label="Local graph">
        <div className="mb-2 flex items-center gap-2">
          <span className="label mr-auto">Local graph</span>
          {[1, 2].map((d) => <button key={d} className={cn('btn-sm rounded-md', depth === d ? 'bg-panel2 text-ink' : 'text-muted hover:text-ink')} onClick={() => setDepth(d)} aria-pressed={depth === d}>{d} step{d > 1 ? 's' : ''}</button>)}
        </div>
        {local.nodes.length > 1
          ? <ForceGraph nodes={local.nodes} links={local.links} focus={note.id} labels={local.nodes.length <= 25 ? 'always' : 'zoom'} onSelect={(id) => id !== note.id && nav(noteHref(id))} className="card h-72" ariaLabel={`Terms linked to ${note.title}`} />
          : <div className="card p-4 text-sm text-muted">No linked terms yet.</div>}
      </aside>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <div className="label mb-2">{title}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function GlossaryGraph({ index, notes, q, matches, colorOf, showLonely, onSelect }: {
  index: NoteIndex; notes: Note[]; q: string; matches: (n: Note) => boolean; colorOf: (n: Note) => string; showLonely: boolean; onSelect: (id: string) => void;
}) {
  const ids = notes.map((n) => n.id).join(' ');
  const graph = useMemo(() => {
    const keep = new Set(notes.map((n) => n.id));
    const links: GLink[] = index.edges.filter(([a, b]) => keep.has(a) && keep.has(b)).map(([a, b]) => ({ source: a, target: b }));
    const linked = new Set(links.flatMap((l) => [l.source, l.target]));
    const nodes: GNode[] = notes.filter((n) => showLonely || linked.has(n.id)).map((n) => ({ id: n.id, label: n.title, color: colorOf(n), r: 3 + Math.sqrt(index.neighbors.get(n.id)?.size ?? 0) * 1.6 }));
    return { nodes, links };
  }, [index, ids, showLonely, colorOf]);
  const highlight = useMemo(() => (q ? new Set(notes.filter(matches).map((n) => n.id)) : null), [q, ids]);
  return <ForceGraph nodes={graph.nodes} links={graph.links} highlight={highlight} onSelect={onSelect} className="min-h-[60vh] flex-1" ariaLabel={`Graph of ${graph.nodes.length} glossary terms and their links`} />;
}
