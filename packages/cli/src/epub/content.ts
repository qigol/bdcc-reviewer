/**
 * One module → the chapters of the book, in the order of its learning path (scenes and sections interleaved,
 * then the case), then practice questions and the glossary. Every question is followed by its answer on the
 * next page (page breaks in style.ts). Numbers come from logic.js: every
 * scope is datasets + state + derive, run in the given LogicHost, before any text is interpolated.
 */
import {
  buildInstance, datasetScope, allDatasetPayloads, learningPath, resolveRefs, runDerive, workbenchTabLabel, DEFAULT_CURRENCY,
  type LogicHost, type ParsedModule, type QuizInstance, type Scene, type Section, type Scope, type StageWidget, type Template,
} from '@kodigo/schema';
import { esc, type RenderLog } from './markdown';
import { numText, renderQuestion } from './questions';
import { codeBlock, journalPane, mdi, texi, widgetHtml, type RenderCtx } from './widgets';

export interface Chapter {
  /** file name inside OEBPS/ */
  file: string;
  title: string;
  /** XHTML body content */
  body: string;
}

export interface ModuleBook {
  id: string;
  title: string;
  /** the module's accent colour (manifest `color`), used for headings and question labels */
  color?: string;
  chapters: Chapter[];
  /** module asset path → book path, for every image the chapters use */
  assets: Map<string, string>;
}

export interface ContentOptions {
  /** seed for questions under sections and in scenes (practice chapter uses seed + 1) */
  seed?: number;
  skip: (kind: string) => void;
  log: RenderLog;
  /** asset paths present in the module */
  assetFiles: Set<string>;
}

const IMAGE_RE = /\.(png|jpe?g|gif|svg)$/i;

export async function moduleChapters(mod: ParsedModule, host: LogicHost, opts: ContentOptions): Promise<ModuleBook> {
  const id = mod.manifest.id;
  const seed = opts.seed ?? 1;
  const terms = new Map(mod.glossary.map((t) => [t.id, t]));
  const assets = new Map<string, string>();
  const f = {
    intro: `${id}-intro.xhtml`,
    step: (i: number) => `${id}-${String(i + 1).padStart(2, '0')}.xhtml`,
    practice: `${id}-practice.xhtml`,
    glossary: `${id}-glossary.xhtml`,
  };
  const base: Omit<RenderCtx, 'scope'> = {
    log: opts.log,
    skip: opts.skip,
    labels: mod.labels,
    currency: mod.manifest.currency ?? DEFAULT_CURRENCY,
    termHref: (tid) => {
      const t = terms.get(tid);
      return t ? { href: `${f.glossary}#term-${id}-${tid}`, label: t.term } : undefined;
    },
    asset: (src) => {
      const clean = src.replace(/^\.?\//, '');
      if (!opts.assetFiles.has(clean) || !IMAGE_RE.test(clean)) return undefined;
      const out = `images/${id}/${clean.replace(/^assets\//, '')}`;
      assets.set(clean, out);
      return out;
    },
  };
  const ctxFor = (scope: Scope): RenderCtx => ({ ...base, scope, exercise: (label, q, a) => qa(label, q, a, 'question check') });
  const data = allDatasetPayloads(mod);

  // ---------------------------------------------------------- questions: the question on one page, its answer on the next
  let current = '';
  const counters = new Map<string, number>();
  // the same question in the same chapter (a stage widget drawn again) keeps its number and answer
  const seen = new Map<string, string>();
  const qa = (label: string, question: string, answer: string, cls = 'question') => {
    const key = JSON.stringify([current, label, question, answer]);
    const prev = seen.get(key);
    if (prev) return prev;
    const n = (counters.get(current) ?? 0) + 1;
    counters.set(current, n);
    const html =
      `<div class="${cls}" id="q-${n}"><p class="q-label">${esc(label)} ${n}</p>${question}<p class="turn">Answer on the next page</p></div>` +
      `<div class="answer" id="a-${n}"><p class="a-label">Answer · ${esc(label)} ${n}</p>${answer}</div>`;
    seen.set(key, html);
    return html;
  };

  // ---------------------------------------------------------- quiz instances
  const templates = new Map(mod.quiz.map((t) => [t.id, t]));
  const instance = async (t: Template, s: number): Promise<QuizInstance | null> => {
    let gen;
    if (t.generator) {
      const r = await host.generate(t.generator, s, t.difficulty);
      if (r.error || !r.output) { opts.skip('question (generator error)'); return null; }
      gen = r.output;
    }
    return buildInstance({ moduleId: id, datasets: data }, t, s, gen);
  };
  // a template asked again (scene gate, then a section's "Your turn", then the practice chapter) gets new numbers
  const uses = new Map<string, number>();
  const question = async (templateId: string, s: number, label: string) => {
    const t = templates.get(templateId);
    if (!t) return '';
    const n = uses.get(templateId) ?? 0;
    uses.set(templateId, n + 1);
    const inst = await instance(t, s + n * 100);
    if (!inst) return '';
    const r = renderQuestion(ctxFor(inst.scope), inst);
    return qa(label, r.question, r.answer);
  };

  // ---------------------------------------------------------- scenes
  const scene = async (sc: Scene): Promise<string> => {
    const dataScope = datasetScope(mod, sc.data);
    const out: string[] = [`<h2>${esc(sc.title)}</h2>`, `<p class="goal">${esc(sc.goal)}</p>`];
    const visible = new Set(sc.stage.filter((w) => !w.hidden).map((w) => w.id));
    const lastHtml = new Map<string, string>();
    let state: Record<string, any> = structuredClone(sc.state ?? {});
    let scope: Scope = {};
    let scopeKey = '';
    const derive = async () => {
      const key = JSON.stringify(state);
      if (key === scopeKey) return;
      scopeKey = key;
      try { scope = await runDerive(host, sc.derive, { ...dataScope, ...structuredClone(state) }); }
      catch { opts.skip('scene derive (error)'); scope = { ...dataScope, ...state }; }
    };
    const stageNow = () => {
      const parts: string[] = [];
      for (const w of sc.stage) {
        if (!visible.has(w.id)) continue;
        const html = widgetHtml(ctxFor(scope), w);
        if (!html || lastHtml.get(w.id) === html) continue;
        lastHtml.set(w.id, html);
        parts.push(html);
      }
      return parts.length ? `<div class="stage">${parts.join('')}</div>` : '';
    };
    for (const [i, b] of sc.beats.entries()) {
      if (b.set) state = { ...state, ...resolveRefs(b.set, { ...dataScope, ...state }) };
      for (const s of b.show ?? []) visible.add(s);
      for (const s of b.hide ?? []) visible.delete(s);
      await derive();
      const ctx = ctxFor(scope);
      out.push(`<div class="beat">${mdi(ctx, b.say)}</div>`);
      for (const tid of b.define ?? []) {
        const t = terms.get(tid);
        if (t) out.push(`<div class="define"><p><b>${esc(t.term)}</b>: ${mdi(ctx, t.short, true)}</p>${t.formula ? texi(ctx, t.formula) : ''}</div>`);
      }
      out.push(stageNow());
      const g = b.gate;
      if (g?.type === 'predict') {
        const opt = g.options ? `<ol class="options">${g.options.map((o, k) => `<li><span class="letter">${'ABCDEFGH'[k]}.</span> ${mdi(ctx, o, true)}</li>`).join('')}</ol>` : '<p class="blank">Answer: ______________</p>';
        const value = typeof g.answer === 'number' ? g.answer : g.answer.value;
        const ans = g.options ? `<b>${'ABCDEFGH'[value] ?? value}.</b> ${mdi(ctx, g.options[value] ?? '', true)}` : `<b>${esc(numText({ value, tol: 0, accept: [], percent: typeof g.answer === 'object' && g.answer.percent }))}</b>`;
        out.push(qa('Predict', mdi(ctx, g.question) + opt, `<p>${ans}</p>${mdi(ctx, g.explain)}`, 'question check'));
      } else if (g?.type === 'reflect') {
        out.push(qa('Explain it', mdi(ctx, g.prompt), `<div class="model">${mdi(ctx, g.model)}</div>`, 'question check'));
      } else if (g?.type === 'practice') {
        if (g.prompt) out.push(mdi(ctx, g.prompt));
        out.push(await question(g.template, seed, 'Practice'));
      } else if (g && g.type !== 'continue') opts.skip(`gate: ${g.type}`);
      if (i === sc.beats.length - 1) out.push(`<div class="callout takeaway"><p class="callout-title">Takeaway</p>${mdi(ctx, sc.takeaway)}</div>`);
    }
    return out.filter(Boolean).join('\n');
  };

  // ---------------------------------------------------------- sections
  const section = async (s: Section): Promise<string> => {
    let scope: Scope;
    try { scope = await runDerive(host, s.derive, { ...datasetScope(mod, s.data), ...structuredClone(s.state ?? {}) }); }
    catch { opts.skip('section derive (error)'); scope = { ...datasetScope(mod, s.data), ...(s.state ?? {}) }; }
    const ctx = ctxFor(scope);
    const out: string[] = [`<h2>${esc(s.title)}</h2>`, mdi(ctx, s.summary)];
    if (s.keyFormula) out.push(`<div class="key-formula"><p class="callout-title">Key formula</p>${texi(ctx, s.keyFormula)}</div>`);
    const live = (s.live ?? []).map((w: StageWidget) => widgetHtml(ctx, w)).filter(Boolean);
    if (live.length) out.push(`<div class="stage">${live.join('')}</div>`);
    out.push('<h3>Step by step</h3><ol class="derivation">');
    for (const st of s.steps) out.push(`<li>${texi(ctx, st.tex)}${mdi(ctx, st.say)}</li>`);
    out.push('</ol>');
    if (s.code) { out.push('<h3>In code</h3>', codeBlock(s.code.source, s.code.lang, s.code.title)); }
    if (s.journal) out.push('<h3>In the books</h3>', journalPane(ctx, s.journal));
    for (const x of s.extraCode ?? []) out.push(codeBlock(x.source, x.lang, x.title));
    if (s.links.length) out.push(`<ul class="links">${s.links.map((l) => `<li><b>${esc(l.label)}</b>${l.say ? `: ${mdi(ctx, l.say, true)}` : ''}</li>`).join('')}</ul>`);
    if (s.pitfalls?.length) out.push(`<div class="callout warn"><p class="callout-title">Pitfalls</p><ul>${s.pitfalls.map((p) => `<li>${mdi(ctx, p, true)}</li>`).join('')}</ul></div>`);
    if (s.examTip) out.push(`<div class="callout exam"><p class="callout-title">Exam tip</p>${mdi(ctx, s.examTip)}</div>`);
    if (s.errata?.length) out.push(`<div class="callout errata"><p class="callout-title">Errata</p><ul>${s.errata.map((p) => `<li>${mdi(ctx, p, true)}</li>`).join('')}</ul></div>`);
    if (s.tryIt?.length) {
      out.push('<h3>Your turn</h3>');
      for (const tid of s.tryIt) out.push(await question(tid, seed, 'Your turn'));
    }
    return out.join('\n');
  };

  // ---------------------------------------------------------- application case
  const application = async (): Promise<string> => {
    const app = mod.application;
    const c = app.case;
    let scope: Scope;
    try { scope = await runDerive(host, c.derive, { ...datasetScope(mod, c.data), ...structuredClone(c.state ?? {}) }); }
    catch { opts.skip('case derive (error)'); scope = { ...datasetScope(mod, c.data), ...(c.state ?? {}) }; }
    const ctx = ctxFor(scope);
    const out: string[] = [`<h2>${esc(c.title)}</h2>`, mdi(ctx, app.intro), mdi(ctx, c.story)];
    for (const cell of c.cells) {
      if (cell.title) out.push(`<h3>${esc(cell.title)}</h3>`);
      out.push(mdi(ctx, cell.say));
      const st = (cell.stage ?? []).filter((w) => !w.hidden).map((w) => widgetHtml(ctx, w)).filter(Boolean);
      if (st.length) out.push(`<div class="stage">${st.join('')}</div>`);
      const d = cell.decision;
      if (d) {
        const opt = d.type === 'mcq' && d.options ? `<ol class="options">${d.options.map((o, k) => `<li><span class="letter">${'ABCDEFGH'[k]}.</span> ${mdi(ctx, o, true)}</li>`).join('')}</ol>` : '<p class="blank">Write your answer.</p>';
        const pick = d.type === 'mcq' && d.answer !== undefined && d.options ? `<p><b>${'ABCDEFGH'[d.answer]}.</b> ${mdi(ctx, d.options[d.answer], true)}</p>` : '';
        out.push(qa('Decide', mdi(ctx, d.prompt) + opt, `${pick}<div class="model">${mdi(ctx, d.model)}</div>`, 'question check'));
      }
    }
    if (app.atScale) {
      out.push(`<h3>${esc(app.atScale.title)}</h3>`, mdi(ctx, app.atScale.body));
      for (const x of app.atScale.code ?? []) out.push(codeBlock(x.source, x.lang, x.title));
    }
    if (app.tradeoffs) {
      const t = app.tradeoffs;
      out.push(`<h3>${esc(t.title)}</h3><table><thead><tr>${t.columns.map((h) => `<th>${mdi(ctx, h, true)}</th>`).join('')}</tr></thead><tbody>${t.rows.map((r) => `<tr>${r.map((x) => `<td>${mdi(ctx, x, true)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
    }
    if (app.connections?.length) out.push(`<h3>Connections</h3><ul>${app.connections.map((x) => `<li><b>${esc(x.module)}</b>: ${mdi(ctx, x.note, true)}</li>`).join('')}</ul>`);
    out.push('<h3>Explain it back</h3>', qa('Explain it', mdi(ctx, app.explainBack.prompt), `<p class="muted">A good answer covers:</p><ul>${app.explainBack.rubric.map((r) => `<li>${mdi(ctx, r, true)}</li>`).join('')}</ul>`, 'question check'));
    return out.join('\n');
  };

  // ---------------------------------------------------------- assemble
  const chapters: Chapter[] = [];
  const m = mod.manifest;
  const ctx0 = ctxFor({});
  const sceneById = new Map(mod.intuition.map((s) => [s.id, s]));
  const sectionById = new Map(mod.mathCode.map((s) => [s.id, s]));
  const path = learningPath(mod).filter((p) => p.kind !== 'mastery');
  const wb = workbenchTabLabel(m);

  current = f.intro;
  chapters.push({
    file: f.intro,
    title: m.title,
    body: [
      `<h1>${esc(m.title)}</h1>`,
      m.course ? `<p class="course">${esc(m.course)}${m.assessment ? ` · ${esc(m.assessment)}` : ''}</p>` : '',
      mdi(ctx0, m.summary),
      m.objectives?.length ? `<h3>After this module you can</h3><ul>${m.objectives.map((o) => `<li>${mdi(ctx0, o.text, true)}</li>`).join('')}</ul>` : '',
      `<h3>Contents</h3><ol class="toc">${path.map((p, i) => `<li><a href="${f.step(i)}">${esc(p.title)}</a> <span class="muted">(${p.kind === 'scene' ? 'Intuition' : p.kind === 'section' ? esc(wb) : 'Application'})</span></li>`).join('')}<li><a href="${f.practice}">Practice questions</a></li><li><a href="${f.glossary}">Glossary</a></li></ol>`,
      m.sources.length ? `<p class="muted">Sources: ${esc(m.sources.map((s) => s.title + (s.sessions ? ` (${s.sessions})` : '')).join('; '))}</p>` : '',
    ].join('\n'),
  });

  for (const [i, p] of path.entries()) {
    current = f.step(i);
    const kind = p.kind === 'scene' ? 'Intuition' : p.kind === 'section' ? wb : 'Application';
    const body = p.kind === 'scene' ? await scene(sceneById.get(p.id)!) : p.kind === 'section' ? await section(sectionById.get(p.id)!) : await application();
    chapters.push({ file: current, title: p.title, body: `<p class="kind">${esc(kind)}</p>\n${body}` });
  }

  current = f.practice;
  const practice: string[] = ['<h1>Practice questions</h1>', '<p class="muted">New numbers from the quiz bank. Work each one, then check the answer.</p>'];
  for (const t of mod.quiz) practice.push(await question(t.id, seed + 1, 'Question'));
  chapters.push({ file: f.practice, title: 'Practice questions', body: practice.join('\n') });

  current = f.glossary;
  chapters.push({
    file: f.glossary,
    title: 'Glossary',
    body: ['<h1>Glossary</h1>', '<dl class="glossary">', ...[...mod.glossary].sort((a, b) => a.term.localeCompare(b.term)).map((t) =>
      `<dt id="term-${id}-${t.id}">${esc(t.term)}${t.aka?.length ? ` <span class="muted">(${esc(t.aka.join(', '))})</span>` : ''}</dt><dd>${mdi(ctx0, t.short)}${t.formula ? texi(ctx0, t.formula) : ''}${t.long ? mdi(ctx0, t.long) : ''}</dd>`), '</dl>'].join('\n'),
  });

  return { id, title: m.title, color: m.color, chapters, assets };
}
