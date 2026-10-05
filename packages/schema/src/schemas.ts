/**
 * Zod schemas for the Qdigo module format, schemaVersion 1.
 * These implement the normative TypeScript types in MODULE_AUTHORING_GUIDE.md §5.
 */
import { z } from 'zod';

export const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const LABEL_RE = /^[A-Za-z0-9_-]+$/;
export const SEMVER_RE = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

export const Id = z.string().regex(ID_RE, 'must be kebab-case (a-z, 0-9, single hyphens)');
export const Ident = z.string().regex(IDENT_RE, 'must be an identifier like minsup or supAB');
export const Markdown = z.string();
export const Tex = z.string();

export type Value = string | number | boolean | null | Value[] | { [k: string]: Value };
export const Value: z.ZodType<Value> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(Value), z.record(z.string(), Value)]),
);
export const Prop = Value;
export const Tone = z.enum(['accent', 'good', 'bad', 'warn', 'muted']);
export const LessonRef = z.object({ tab: z.enum(['intuition', 'math-code', 'application']), id: Id }).strict();
/** Anchor names shared by TeX (\\anchor{name}{…}), code markers and journal lines (guide §4.3). */
export const AnchorName = z.string().regex(/^[a-z0-9_-]+$/, 'anchor names are lowercase: a-z, 0-9, _ or -');
/** What the second study tab pairs with the derivation: Python code (default) or accounting records. */
export const Workbench = z.enum(['code', 'journal']);

// ------------------------------------------------------------ manifest
export const Manifest = z
  .object({
    schemaVersion: z.literal(1),
    id: Id,
    version: z.string().regex(SEMVER_RE, 'must be semver, e.g. 1.0.0'),
    title: z.string().min(1),
    shortTitle: z.string().min(1).max(12, 'shortTitle must be ≤ 12 characters'),
    summary: Markdown,
    course: z.string().optional(),
    order: z.number().optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{3,8}$/, 'hex color like #7c3aed').optional(),
    icon: z.string().optional(),
    sources: z
      .array(z.object({ title: z.string(), file: z.string().optional(), sessions: z.string().optional(), date: z.string().optional() }).strict())
      .min(1),
    prerequisites: z.array(Id).optional(),
    skills: z.array(z.object({ id: Id, label: z.string(), description: z.string().optional() }).strict()).min(1),
    requires: z.object({ widgets: z.array(z.string()) }).strict(),
    /** authoring-guide edition the module follows; 2 turns the guided-learning rules into errors (guide §1) */
    guide: z.union([z.literal(1), z.literal(2)]).optional(),
    /** 'code' (default): Math & Code with Python · 'journal': Math & Journal with entries, schedules, T-accounts */
    workbench: Workbench.optional(),
    /** currency symbol for journal amounts and the |money format (default ₱) */
    currency: z.string().min(1).max(4).optional(),
    /** what the learner can do after the module, each tied to skills (guide §5.1, shown on the Path tab) */
    objectives: z.array(z.object({ id: Id, text: z.string().min(1), skills: z.array(Id).optional() }).strict()).optional(),
    authoring: z.object({ generatedBy: z.string().optional(), generatedAt: z.string().optional(), notes: z.string().optional() }).strict().optional(),
  })
  .strict();

// ------------------------------------------------------------ datasets
const DsBase = {
  id: Id,
  title: z.string().optional(),
  source: z.string().optional(),
  description: Markdown.optional(),
};
export const Dataset = z.discriminatedUnion('kind', [
  z.object({
    ...DsBase,
    kind: z.literal('transactions'),
    labels: z.record(z.string(), z.string()).optional(),
    transactions: z.array(z.object({ id: z.union([z.string(), z.number()]), items: z.array(Id) }).strict()),
  }).strict(),
  z.object({
    ...DsBase,
    kind: z.literal('matrix'),
    labels: z.record(z.string(), z.string()).optional(),
    rows: z.array(z.string().regex(LABEL_RE, 'matrix labels: letters, digits, _ or - only')),
    cols: z.array(z.string().regex(LABEL_RE, 'matrix labels: letters, digits, _ or - only')),
    values: z.array(z.array(z.number().nullable())),
  }).strict(),
  z.object({ ...DsBase, kind: z.literal('table'), labels: z.record(z.string(), z.string()).optional(), columns: z.array(z.string()), rows: z.array(z.array(Value)) }).strict(),
  z.object({ ...DsBase, kind: z.literal('list'), labels: z.record(z.string(), z.string()).optional(), items: z.array(Value) }).strict(),
  z.object({ ...DsBase, kind: z.literal('json'), labels: z.record(z.string(), z.string()).optional(), value: Value }).strict(),
]).superRefine((d, ctx) => {
  if (d.kind !== 'matrix') return;
  if (d.values.length !== d.rows.length) ctx.addIssue({ code: 'custom', path: ['values'], message: `values has ${d.values.length} rows but rows lists ${d.rows.length}` });
  d.values.forEach((r, i) => {
    if (r.length !== d.cols.length) ctx.addIssue({ code: 'custom', path: ['values', i], message: `row ${i} has ${r.length} cells but cols lists ${d.cols.length}` });
  });
});

// ------------------------------------------------------------ examples
export const Example = z
  .object({
    id: Id,
    source: z.string(),
    page: z.number().int().optional(),
    fn: z.string(),
    in: z.record(z.string(), Prop),
    expect: z.record(z.string(), Value),
    tol: z.number().nonnegative().optional(),
    note: Markdown.optional(),
  })
  .strict();
export const ExamplesFile = z.object({ examples: z.array(Example).min(1) }).strict();

// ------------------------------------------------------------ glossary
export const Term = z
  .object({
    id: Id,
    term: z.string(),
    aka: z.array(z.string()).optional(),
    short: z.string(),
    long: Markdown.optional(),
    formula: Tex.optional(),
    related: z.array(Id).optional(),
    lessonRef: LessonRef.optional(),
    skills: z.array(Id).optional(),
  })
  .strict();
export const GlossaryFile = z.object({ terms: z.array(Term).min(1) }).strict();

// ------------------------------------------------------------ scenes
export const Derive = z.object({ fn: z.string(), in: z.record(z.string(), Prop), out: Ident }).strict();
export const StageWidget = z
  .object({
    id: Id,
    widget: z.string(),
    props: z.record(z.string(), Prop).optional(),
    bind: z.record(z.string(), Ident).optional(),
    region: z.enum(['main', 'side', 'top', 'bottom']).optional(),
    hidden: z.boolean().optional(),
  })
  .strict();
export const Gate = z.discriminatedUnion('type', [
  z.object({ type: z.literal('continue'), label: z.string().optional() }).strict(),
  z.object({
    type: z.literal('predict'),
    question: Markdown,
    options: z.array(Markdown).optional(),
    answer: z.union([z.number(), z.object({ value: z.number(), tol: z.number().optional() }).strict()]),
    explain: Markdown,
  }).strict(),
  z.object({ type: z.literal('when'), prompt: Markdown, when: z.string(), hint: Markdown.optional(), skippable: z.boolean().optional() }).strict(),
  z.object({ type: z.literal('event'), prompt: Markdown, target: Id, event: z.string(), hint: Markdown.optional(), skippable: z.boolean().optional() }).strict(),
  /** an inline quiz question (fresh numbers) the learner solves before moving on */
  z.object({ type: z.literal('practice'), template: Id, prompt: Markdown.optional(), skippable: z.boolean().optional() }).strict(),
  /** self-explanation: the learner writes an answer, then compares it with a model answer */
  z.object({ type: z.literal('reflect'), prompt: Markdown, model: Markdown, skippable: z.boolean().optional() }).strict(),
]);
export const Command = z.object({ target: Id, cmd: z.string(), args: Value.optional() }).strict();
export const Beat = z
  .object({
    id: Id.optional(),
    say: Markdown,
    set: z.record(z.string(), Prop).optional(),
    show: z.array(Id).optional(),
    hide: z.array(Id).optional(),
    do: z.array(Command).optional(),
    gate: Gate.optional(),
    /** glossary term ids this beat introduces: a definition card appears under the narration */
    define: z.array(Id).optional(),
  })
  .strict();
export const Scene = z
  .object({
    id: Id,
    title: z.string(),
    goal: z.string(),
    skills: z.array(Id).optional(),
    data: z.array(Id).optional(),
    state: z.record(Ident, Value).optional(),
    derive: z.array(Derive).optional(),
    stage: z.array(StageWidget),
    beats: z.array(Beat).min(1),
    takeaway: Markdown,
  })
  .strict();
export const IntuitionFile = z.object({ scenes: z.array(Scene).min(1) }).strict();

// ------------------------------------------------------------ journal workbench (accounting)
/** An amount: a number, a '@ref' to one, or null (shown blank). */
export const Amount = z.union([z.number(), z.string(), z.null()]);
/** A whole list supplied by logic.js through scope, e.g. entries: '@close.entries'. */
const ListRef = z.string().regex(/^@/, "expected a list or a '@ref' to one");
export const JournalLine = z
  .object({ account: z.string().min(1), debit: Amount.optional(), credit: Amount.optional(), anchor: AnchorName.optional(), note: Markdown.optional() })
  .strict()
  .refine((l) => (l.debit !== undefined) !== (l.credit !== undefined), { message: 'each journal line has exactly one of debit or credit' });
export const JournalEntry = z
  .object({ id: Id, date: z.string().optional(), lines: z.array(JournalLine).min(2), memo: Markdown.optional(), anchor: AnchorName.optional() })
  .strict();
export const ScheduleRow = z
  .object({
    id: Id.optional(),
    label: Markdown,
    /** one amount (single-column schedule) … */
    amount: Amount.optional(),
    /** … or one per column */
    amounts: z.array(Amount).optional(),
    indent: z.number().int().min(0).max(3).optional(),
    style: z.enum(['line', 'heading', 'subtotal', 'total']).optional(),
    /** how amounts print: money (default), number, pct (0.4 → 40%), ratio (2 dp), units */
    format: z.enum(['money', 'number', 'pct', 'ratio', 'units']).optional(),
    anchor: AnchorName.optional(),
  })
  .strict();
export const TPosting = z.object({ amount: Amount, ref: z.string().optional(), anchor: AnchorName.optional() }).strict();
export const TAccount = z
  .object({ id: Id, name: z.string().min(1), debits: z.array(TPosting), credits: z.array(TPosting), showBalance: z.boolean().optional(), anchor: AnchorName.optional() })
  .strict();
export const JournalBlock = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('entries'), title: z.string().optional(), entries: z.union([z.array(JournalEntry).min(1), ListRef]) }).strict(),
  z.object({ kind: z.literal('schedule'), title: z.string().optional(), columns: z.array(z.string()).optional(), rows: z.union([z.array(ScheduleRow).min(1), ListRef]) }).strict(),
  z.object({ kind: z.literal('taccounts'), title: z.string().optional(), accounts: z.union([z.array(TAccount).min(1), ListRef]) }).strict(),
]);
export const JournalPane = z
  .object({
    title: z.string().optional(),
    /** decimals for money amounts (default: 0 when every amount is whole, else 2) */
    decimals: z.number().int().min(0).max(4).optional(),
    blocks: z.array(JournalBlock).min(1),
  })
  .strict();

// ------------------------------------------------------------ math & code
const CodeBlock = z.object({ lang: z.string().optional(), title: z.string().optional(), source: z.string() }).strict();
export const Section = z
  .object({
    id: Id,
    title: z.string(),
    skills: z.array(Id),
    summary: Markdown,
    keyFormula: Tex.optional(),
    data: z.array(Id).optional(),
    state: z.record(Ident, Value).optional(),
    derive: z.array(Derive).optional(),
    /** widgets for the live-example panel (default: one widget per dataset in `data`); trace ops target them by id or role */
    live: z.array(StageWidget).optional(),
    steps: z.array(z.object({ tex: Tex, say: Markdown }).strict()).min(2),
    /** the code pane (workbench: code) */
    code: CodeBlock.optional(),
    /** the journal pane (workbench: journal): entries, schedules, T-accounts */
    journal: JournalPane.optional(),
    extraCode: z.array(z.object({ lang: z.string().optional(), title: z.string(), source: z.string() }).strict()).optional(),
    links: z.array(z.object({ anchor: z.string(), label: z.string(), say: Markdown.optional() }).strict()),
    trace: z.object({ fn: z.string(), in: z.record(z.string(), Prop) }).strict().optional(),
    examples: z.array(Id).optional(),
    pitfalls: z.array(Markdown).optional(),
    examTip: Markdown.optional(),
    errata: z.array(Markdown).optional(),
    beyondSlides: z.boolean().optional(),
    /** quiz template ids offered as "Your turn" practice under the section (fresh numbers each time) */
    tryIt: z.array(Id).optional(),
  })
  .strict()
  .refine((s) => !!s.code || !!s.journal, { message: 'a section needs `code` (workbench: code) or `journal` (workbench: journal)' });
export const MathCodeFile = z.object({ sections: z.array(Section).min(1) }).strict();

// ------------------------------------------------------------ application
export const Cell = z
  .object({
    id: Id,
    title: z.string().optional(),
    say: Markdown,
    stage: z.array(StageWidget).optional(),
    decision: z
      .object({
        prompt: Markdown,
        type: z.enum(['mcq', 'open']),
        options: z.array(Markdown).optional(),
        answer: z.number().int().optional(),
        model: Markdown,
      })
      .strict()
      .optional(),
  })
  .strict();
export const ApplicationFile = z
  .object({
    intro: Markdown,
    case: z
      .object({
        id: Id,
        title: z.string(),
        story: Markdown,
        data: z.array(Id).optional(),
        state: z.record(Ident, Value).optional(),
        derive: z.array(Derive).optional(),
        cells: z.array(Cell).min(1),
      })
      .strict(),
    atScale: z
      .object({ title: z.string(), body: Markdown, code: z.array(z.object({ lang: z.string().optional(), title: z.string(), source: z.string() }).strict()).optional() })
      .strict()
      .optional(),
    tradeoffs: z.object({ title: z.string(), columns: z.array(z.string()), rows: z.array(z.array(z.string())) }).strict().optional(),
    connections: z.array(z.object({ module: Id, note: Markdown }).strict()).optional(),
    explainBack: z.object({ prompt: Markdown, rubric: z.array(z.string()).min(1) }).strict(),
  })
  .strict();

// ------------------------------------------------------------ quiz
export const NumericAnswer = z
  .object({
    var: z.string().optional(),
    value: z.number().optional(),
    tol: z.number().nonnegative().optional(),
    relTol: z.number().nonnegative().optional(),
    accept: z.array(z.enum(['decimal', 'fraction', 'percent'])).optional(),
  })
  .strict()
  .refine((a) => a.var !== undefined || a.value !== undefined, { message: 'answer needs `var` or `value`' });
export const Misconception = z
  .object({ var: z.string().optional(), value: z.number().optional(), feedback: Markdown })
  .strict()
  .refine((m) => m.var !== undefined || m.value !== undefined, { message: 'misconception needs `var` or `value`' });
const QBase = {
  id: Id,
  skills: z.array(Id).min(1),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  tags: z.array(z.enum(['term', 'intuition', 'math', 'code', 'journal', 'application'])),
  lessonRef: LessonRef.optional(),
  generator: z.string().optional(),
  data: z.array(Id).optional(),
  prompt: Markdown,
  show: z.array(StageWidget).optional(),
  explanation: Markdown,
  /** progressive hints, revealed one at a time in practice (nudge → method → first step) */
  hints: z.array(Markdown).optional(),
};
const RefOr = <T extends z.ZodTypeAny>(t: T) => z.union([t, z.string().regex(/^@/, "a '@ref' to a generator var")]);
export const QuizJournalEntry = z
  .object({
    id: Id.optional(),
    date: z.string().optional(),
    prompt: Markdown.optional(),
    lines: z.array(z.object({ account: z.string().min(1), debit: Amount.optional(), credit: Amount.optional() }).strict()
      .refine((l) => (l.debit !== undefined) !== (l.credit !== undefined), { message: 'each line has exactly one of debit or credit' })).min(2),
  })
  .strict();
export const QuizScheduleRow = ScheduleRow.extend({ blank: z.boolean().optional(), tol: z.number().nonnegative().optional() }).strict();
export const Template = z.discriminatedUnion('type', [
  z.object({ ...QBase, type: z.literal('mcq'), options: z.array(Markdown).optional(), answer: z.number().int().optional(), shuffle: z.boolean().optional(), optionFeedback: z.record(z.string(), Markdown).optional() }).strict(),
  z.object({ ...QBase, type: z.literal('multi'), options: z.array(Markdown).optional(), answer: z.array(z.number().int()).optional(), shuffle: z.boolean().optional() }).strict(),
  z.object({ ...QBase, type: z.literal('numeric'), answer: NumericAnswer, misconceptions: z.array(Misconception).optional() }).strict(),
  z.object({
    ...QBase,
    type: z.literal('code-fill'),
    lang: z.string().optional(),
    code: z.string(),
    blanks: z.record(z.string(), z.object({ accept: z.array(z.string()).optional(), regex: z.string().optional(), hint: z.string().optional() }).strict()),
  }).strict(),
  z.object({ ...QBase, type: z.literal('match'), pairs: z.array(z.tuple([Markdown, Markdown])).min(2), pick: z.number().int().positive().optional() }).strict(),
  z.object({ ...QBase, type: z.literal('order'), items: z.array(Markdown).min(2) }).strict(),
  z.object({
    ...QBase,
    type: z.literal('hand-calc'),
    steps: z.array(z.object({ prompt: Markdown, answer: NumericAnswer, misconceptions: z.array(Misconception).optional(), hint: Markdown.optional() }).strict()).min(1),
  }).strict(),
  z.object({
    ...QBase,
    type: z.literal('journal-entry'),
    /** chart of accounts offered in the dropdowns (include plausible distractors) */
    accounts: RefOr(z.array(z.string().min(1)).min(2)),
    /** the expected entries; amounts may be '@vars' */
    entries: RefOr(z.array(QuizJournalEntry).min(1)),
    tol: z.number().nonnegative().optional(),
    relTol: z.number().nonnegative().optional(),
  }).strict(),
  z.object({
    ...QBase,
    type: z.literal('schedule-fill'),
    columns: z.array(z.string()).optional(),
    /** the statement; rows with `blank: true` become inputs */
    rows: RefOr(z.array(QuizScheduleRow).min(2)),
    tol: z.number().nonnegative().optional(),
    relTol: z.number().nonnegative().optional(),
  }).strict(),
]);
export const QuizFile = z.object({ templates: z.array(Template).min(1) }).strict();

// ------------------------------------------------------------ inferred types
export type Manifest = z.infer<typeof Manifest>;
export type Dataset = z.infer<typeof Dataset>;
export type Example = z.infer<typeof Example>;
export type ExamplesFile = z.infer<typeof ExamplesFile>;
export type Term = z.infer<typeof Term>;
export type GlossaryFile = z.infer<typeof GlossaryFile>;
export type Derive = z.infer<typeof Derive>;
export type StageWidget = z.infer<typeof StageWidget>;
export type Gate = z.infer<typeof Gate>;
export type Beat = z.infer<typeof Beat>;
export type Scene = z.infer<typeof Scene>;
export type IntuitionFile = z.infer<typeof IntuitionFile>;
export type Section = z.infer<typeof Section>;
export type MathCodeFile = z.infer<typeof MathCodeFile>;
export type Cell = z.infer<typeof Cell>;
export type ApplicationFile = z.infer<typeof ApplicationFile>;
export type NumericAnswer = z.infer<typeof NumericAnswer>;
export type Misconception = z.infer<typeof Misconception>;
export type Template = z.infer<typeof Template>;
export type QuizFile = z.infer<typeof QuizFile>;
export type LessonRef = z.infer<typeof LessonRef>;
export type JournalLine = z.infer<typeof JournalLine>;
export type JournalEntry = z.infer<typeof JournalEntry>;
export type ScheduleRow = z.infer<typeof ScheduleRow>;
export type TAccount = z.infer<typeof TAccount>;
export type JournalBlock = z.infer<typeof JournalBlock>;
export type JournalPane = z.infer<typeof JournalPane>;
/** A journal pane after '@refs' are resolved: every block holds real lists. */
export interface ResolvedJournalPane {
  title?: string;
  decimals?: number;
  blocks: (
    | { kind: 'entries'; title?: string; entries: JournalEntry[] }
    | { kind: 'schedule'; title?: string; columns?: string[]; rows: ScheduleRow[] }
    | { kind: 'taccounts'; title?: string; accounts: TAccount[] }
  )[];
}
export type Workbench = z.infer<typeof Workbench>;

/** The trace step emitted by logic fns (guide §5.4). Not validated by zod on the hot path. */
export interface TraceStep {
  label: string;
  code?: string;
  math?: string;
  vars?: Record<string, Value>;
  ops?: { role: string; cmd: string; args?: Value }[];
  patch?: Record<string, Value>;
}

export interface GeneratorOutput {
  vars: Record<string, Value>;
  options?: string[];
  answer?: number | number[];
  misconceptions?: { var?: string; value?: number; feedback: string }[];
}

/** Fixed file names (guide §3.1). */
export const REQUIRED_FILES = [
  'manifest.yaml',
  'SOURCE_NOTES.md',
  'logic.js',
  'examples.yaml',
  'glossary.yaml',
  'intuition.yaml',
  'math-code.yaml',
  'application.yaml',
  'quiz.yaml',
] as const;
export const OPTIONAL_FILES = ['WIDGET_REQUESTS.md'] as const;
export const OPTIONAL_DIRS = ['datasets/', 'assets/', 'sources/'] as const;
