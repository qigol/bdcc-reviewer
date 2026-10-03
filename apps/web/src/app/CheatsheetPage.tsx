import { Printer } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAllModules } from '../modules/useAll';
import { useCourses } from '../modules/courses';
import { useSetting } from '../storage/progress';
import { Markdown, Tex } from '../lib/md';

function collectErrata(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((v) => collectErrata(v, out));
  else if (value && typeof value === 'object') {
    const o = value as any;
    if (o.widget === 'Callout' && o.props?.kind === 'errata' && typeof o.props.body === 'string') out.push(o.props.body);
    Object.values(o).forEach((v) => collectErrata(v, out));
  }
  return out;
}

export function CheatsheetPage() {
  const { mods } = useAllModules();
  const { courses, courseOf } = useCourses();
  const [params, setParams] = useSearchParams();
  const [saved] = useSetting('course');
  // one course per sheet: ?course= → the course you last studied → the first course
  const has = (c?: string | null) => !!c && courses.some((g) => g.course === c);
  const course = has(params.get('course')) ? params.get('course')! : has(saved) ? saved! : courses[0]?.course;
  const order = courses.find((g) => g.course === course)?.modules.map((m) => m.id) ?? [];
  const shown = mods.filter((m) => courseOf(m.id) === course).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 py-6 print:max-w-none print:px-0">
      <div className="no-print mb-4 flex items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">Cheat sheet</h1>
        {courses.length > 1 && (
          <select className="input" value={course} onChange={(e) => setParams({ course: e.target.value }, { replace: true })} aria-label="Course">
            {courses.map((g) => <option key={g.course} value={g.course}>{g.course}</option>)}
          </select>
        )}
        <button className="btn" onClick={() => window.print()}><Printer size={15} /> Print</button>
      </div>
      <p className="no-print mb-4 text-sm text-muted">Built automatically from the key formulas, exam tips and slide errata of every {course ? <b>{course}</b> : null} module.</p>
      {course && <h2 className="mb-3 hidden text-lg font-semibold print:block">{course} cheat sheet</h2>}
      <div className="flex flex-col gap-6">
        {shown.map((mod) => {
          const m = mod.parsed.manifest;
          const errata = [...new Set([...mod.parsed.mathCode.flatMap((s) => s.errata ?? []), ...collectErrata(mod.parsed.intuition), ...collectErrata(mod.parsed.application)])];
          return (
            <section key={mod.id} className="card break-inside-avoid p-4">
              <h2 className="mb-2 border-b border-line pb-1 text-lg font-semibold" style={{ color: m.color }}>{m.title}</h2>
              <div className="grid gap-x-6 gap-y-1 md:grid-cols-2">
                {mod.parsed.mathCode.filter((s) => s.keyFormula).map((s) => (
                  <div key={s.id} className="break-inside-avoid py-1">
                    <div className="text-xs font-semibold text-muted">{s.title}{s.beyondSlides ? ' (beyond slides)' : ''}</div>
                    <Tex tex={s.keyFormula} className="text-[15px]" />
                  </div>
                ))}
              </div>
              {mod.parsed.mathCode.some((s) => s.examTip) && (
                <>
                  <h3 className="mt-3 text-sm font-semibold">Exam tips</h3>
                  <ul className="ml-4 list-disc text-sm">
                    {mod.parsed.mathCode.filter((s) => s.examTip).map((s) => <li key={s.id}><b>{s.title}:</b> <Markdown text={s.examTip} inline raw /></li>)}
                  </ul>
                </>
              )}
              {errata.length > 0 && (
                <>
                  <h3 className="mt-3 text-sm font-semibold text-bad">Slide errata</h3>
                  <ul className="ml-4 list-disc text-sm">{errata.map((e, i) => <li key={i}><Markdown text={e} inline raw /></li>)}</ul>
                </>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
