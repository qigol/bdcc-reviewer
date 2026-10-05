/**
 * Widget catalog (schema v1). Single source of truth for:
 *  - the validator (names, props, bind outputs, commands, events)
 *  - docs/WIDGETS.md (generated: `pnpm widgets:doc`, and Admin → "Download widget reference")
 * The React implementations live in apps/web/src/widgets/<Name>.tsx and must honor these contracts.
 */
import { z } from 'zod';
import { Value, Tone } from './schemas';

export interface WidgetMeta {
  name: string;
  summary: string;
  usedBy?: string;
  props: z.ZodRawShape;
  /** prop docs, keyed by prop name */
  docs: Record<string, string>;
  bind: Record<string, string>;
  selectors: string[];
  commands: Record<string, string>;
  events: Record<string, string>;
  example: string;
}

const Str = z.string();
const Num = z.number();
const Bool = z.boolean();
const StrArr = z.array(z.string());
const Any = Value;

export const COMMON_COMMANDS: Record<string, string> = {
  highlight: '{sel, tone?} — transient: lasts for the current beat or trace step',
  pulse: '{sel} — transient attention pulse',
  annotate: '{sel, text} — persistent small label next to the target',
  clear: '{sel?} — remove persistent marks (all, or for one selector)',
};
export const TRANSIENT_COMMANDS = new Set(['highlight', 'pulse']);

const matrixValue = z.union([z.number(), z.string(), z.null()]);

export const WIDGETS: WidgetMeta[] = [
  {
    name: 'TransactionTable',
    summary: 'Transactions as rows of item chips. Rows containing `highlight` glow; items can be dragged between rows when editable; `project` shows a conditional (projected) database for FP-growth.',
    usedBy: 'fim',
    props: {
      transactions: z.array(z.object({ id: z.union([Str, Num]), items: StrArr })),
      itemOrder: StrArr.optional(),
      highlight: StrArr.optional(),
      strike: z.array(z.union([Str, Num])).optional(),
      editable: Bool.optional(),
      palette: StrArr.optional(),
      selectable: Bool.optional(),
      showContainCount: Bool.optional(),
      title: Str.optional(),
      selection: StrArr.optional(),
    },
    docs: {
      selection: 'controlled selection (bind `selection` to keep it in state)',
      transactions: 'transactions payload (`@dataset` or generator var)',
      itemOrder: 'item order used by `project` and chip sorting (default: alphabetical)',
      highlight: 'itemset; rows containing every item glow',
      strike: 'row ids drawn struck-through',
      editable: 'drag chips between rows, add from `palette`, click a chip to remove it',
      palette: 'items offered for adding when editable',
      selectable: 'click chips to build a selection itemset (bind `selection`)',
      showContainCount: 'show "n of N rows contain the highlight"',
      title: 'optional caption',
    },
    bind: { transactions: 'the edited transactions', selection: 'the selected itemset (string[])' },
    selectors: ['row:<id>', 'item:<item> (every chip of that item)', 'chip:<rowId>:<item>'],
    commands: {
      strike: '{sel} — strike rows (persistent)',
      project: '{prefix: string[]} — keep rows containing the prefix and drop items ≤ the last prefix item in itemOrder (persistent)',
      unproject: '{} — undo project',
    },
    events: { change: 'transactions edited', select: 'selection changed' },
    example: `- id: t\n  widget: TransactionTable\n  props: { transactions: '@grocery5', itemOrder: [bread, butter, cheese, eggs, milk, yogurt], highlight: '@A' }`,
  },
  {
    name: 'ItemsetLattice',
    summary: 'Hasse diagram of the itemset lattice with support under each node and minsup coloring (frequent = good, infrequent = muted). `prune` cascades grey over all supersets.',
    usedBy: 'fim',
    props: {
      items: StrArr,
      support: z.record(z.string(), Num).optional(),
      minsup: Num.optional(),
      maxLevel: Num.optional(),
      showSupport: Bool.optional(),
      showEmpty: Bool.optional(),
      selection: StrArr.optional(),
    },
    docs: {
      selection: 'controlled selection (normally via bind)',
      items: 'the items; also the key order (keys via sdk.key(set, items))',
      support: 'map key → absolute support (e.g. `@freq.supportMap`)',
      minsup: 'nodes with support ≥ minsup are colored frequent',
      maxLevel: 'deepest level drawn (default: all, capped at 4 for readability)',
      showSupport: 'print the support under each node',
      showEmpty: 'draw the empty set at the top',
    },
    bind: { selection: 'clicked itemset (string[])' },
    selectors: ['set:<a,b> (canonical key)', 'level:<k>'],
    commands: {
      prune: '{sel} — grey the set and every superset (persistent)',
      reveal: '{level} — show levels ≤ level (persistent)',
      hideAbove: '{level} — hide levels > level (persistent)',
    },
    events: { nodeClick: 'a node was clicked' },
    example: `- id: lat\n  widget: ItemsetLattice\n  props: { items: [bread, butter, milk], support: '@freq.supportMap', minsup: '@minsup', showSupport: true }`,
  },
  {
    name: 'Venn',
    summary: 'Two-set Venn diagram with counts or fractions: support, confidence and lift intuition.',
    usedBy: 'fim',
    props: { labels: StrArr, nA: Num, nB: Num, nAB: Num, N: Num, mode: z.enum(['count', 'fraction']).optional() },
    docs: { labels: '[A label, B label]', nA: '|A|', nB: '|B|', nAB: '|A ∩ B|', N: 'universe size', mode: 'count (default) or fraction of N' },
    bind: {},
    selectors: ['A', 'B', 'AB', 'U'],
    commands: {},
    events: {},
    example: `- id: v\n  widget: Venn\n  props: { labels: [bread, butter], nA: 2, nB: 1, nAB: 1, N: 5 }`,
  },
  {
    name: 'Matrix',
    summary: 'Numeric matrix with missing cells, optional row means and heatmap; editable; animated `center`, `fill`, `transpose`.',
    usedBy: 'nb-cf, lf-cf',
    props: {
      data: z.object({ rows: StrArr, cols: StrArr, values: z.array(z.array(matrixValue)) }).optional(),
      rows: StrArr.optional(),
      cols: StrArr.optional(),
      values: z.array(z.array(matrixValue)).optional(),
      format: z.union([Str, Num]).optional(),
      editable: z.union([Bool, z.object({ min: Num.optional(), max: Num.optional(), step: Num.optional() })]).optional(),
      heatmap: z.enum(['none', 'seq', 'div']).optional(),
      showRowMeans: Bool.optional(),
      meanLabel: Str.optional(),
      emptyLabel: Str.optional(),
      title: Str.optional(),
      rowHeader: Str.optional(),
    },
    docs: {
      data: 'matrix payload {rows, cols, values}',
      rows: 'row labels (if not using data)',
      cols: 'column labels (if not using data)',
      values: 'number | TeX string | null (missing)',
      format: "number format: 2 (default), 0..6, 'frac', 'int'",
      editable: 'true or {min, max, step}: click a cell to edit; empty input = missing',
      heatmap: 'none (default) | seq | div (diverging around 0)',
      showRowMeans: 'append a μ column (means over observed cells)',
      meanLabel: 'TeX for the mean column header (default \\mu_u)',
      emptyLabel: 'what to print in missing cells (default blank)',
      title: 'optional caption',
      rowHeader: 'text for the top-left corner cell',
    },
    bind: { values: 'edited values', selection: 'clicked cell {row, col}' },
    selectors: ['cell:<row>,<col>', 'row:<row>', 'col:<col>', 'mean:<row>', 'missing'],
    commands: {
      fill: '{cell: "row,col", value} — animate a value into a cell (persistent)',
      center: '{} — animate subtracting each row mean from its observed cells (persistent)',
      uncenter: '{} — undo center',
      transpose: '{} — swap rows and columns (persistent)',
      mask: '{sel} — dim everything except the selection (persistent)',
    },
    events: { change: 'a value was edited', select: 'a cell was clicked' },
    example: `- id: m\n  widget: Matrix\n  props: { data: '@hp4x7', showRowMeans: true, format: frac }`,
  },
  {
    name: 'MatrixProduct',
    summary: 'U × V ≈ R layout (V is d×n as in the lectures). `focus` animates one row·column dot product into P.',
    usedBy: 'lf-cf',
    props: {
      U: z.object({ rows: StrArr, cols: StrArr, values: z.array(z.array(matrixValue)) }),
      V: z.object({ rows: StrArr, cols: StrArr, values: z.array(z.array(matrixValue)) }),
      R: z.object({ rows: StrArr, cols: StrArr, values: z.array(z.array(matrixValue)) }).optional(),
      symbolic: Bool.optional(),
      showError: Bool.optional(),
      format: z.union([Str, Num]).optional(),
    },
    docs: {
      U: 'm×d factor matrix payload',
      V: 'd×n factor matrix payload',
      R: 'optional target ratings (null = missing)',
      symbolic: 'entries may be TeX strings (P is then shown symbolically)',
      showError: 'color P cells by (R − P) on observed cells',
      format: 'number format for entries',
    },
    bind: {},
    selectors: ['U:<i>,<s>', 'V:<s>,<j>', 'P:<i>,<j>', 'R:<i>,<j>', 'Urow:<i>', 'Vcol:<j>'],
    commands: { focus: '{i, j} (0-based) — sweep U row i · V column j into P[i,j] (persistent)', unfocus: '{}' },
    events: { hover: 'a P cell was hovered' },
    example: `- id: mp\n  widget: MatrixProduct\n  props: { U: '@als.U', V: '@als.V', R: '@r5x5', showError: true }`,
  },
  {
    name: 'VectorPlot',
    summary: 'Draggable 2-D vectors with the angle between two of them and a live cosine readout.',
    usedBy: 'nb-cf, lf-cf',
    props: {
      vectors: z.array(z.object({ id: Str, x: Num, y: Num, label: Str.optional(), draggable: Bool.optional(), tone: Tone.optional() })),
      domain: z.array(Num).optional(),
      angleBetween: StrArr.optional(),
      showCosine: Bool.optional(),
      showProjection: StrArr.optional(),
      showCoords: Bool.optional(),
    },
    docs: {
      vectors: '[{id, x, y, label?, draggable?, tone?}]',
      domain: '[min, max] for both axes (default [-5, 5])',
      angleBetween: '[id, id] draw the angle arc',
      showCosine: 'show cos θ for angleBetween',
      showProjection: '[id, id] project the first onto the second',
      showCoords: 'append (x, y) to labels (default: only when ≤ 3 vectors)',
    },
    bind: { vectors: 'vectors after dragging' },
    selectors: ['vec:<id>', 'angle'],
    commands: {},
    events: { change: 'a vector was dragged' },
    example: `- id: vp\n  widget: VectorPlot\n  props: { vectors: [{ id: a, x: 2, y: 1, draggable: true }, { id: b, x: 1, y: 2 }], angleBetween: [a, b], showCosine: true }\n  bind: { vectors: vecs }`,
  },
  {
    name: 'FunctionPlot',
    summary: 'y = f(x) from a logic fn (called with {x, ...args}, returns {y}); draggable x, tangent, minimum marker.',
    usedBy: 'lf-cf',
    props: {
      fn: Str,
      args: z.record(z.string(), Any).optional(),
      domain: z.array(Num),
      samples: Num.optional(),
      x: Num.optional(),
      draggable: Bool.optional(),
      showTangent: Bool.optional(),
      showMin: Bool.optional(),
      xLabel: Str.optional(),
      yLabel: Str.optional(),
    },
    docs: {
      fn: 'name of a logic fn returning {y}',
      args: 'extra args merged into every call',
      domain: '[a, b]',
      samples: 'number of samples (default 80)',
      x: 'current x (bind it to let the learner drag)',
      draggable: 'drag the point along the curve',
      showTangent: 'draw the tangent at x (numeric derivative)',
      showMin: 'mark the sampled minimum',
      xLabel: 'TeX',
      yLabel: 'TeX',
    },
    bind: { x: 'the dragged x' },
    selectors: ['point', 'min', 'curve'],
    commands: { animateTo: '{x} — move the point (persistent)', markMin: '{} — reveal the minimum marker (persistent)' },
    events: { change: 'x changed by dragging' },
    example: `- id: fp\n  widget: FunctionPlot\n  props: { fn: cgdRow1Sse, domain: [0, 5], x: '@x', draggable: true, showTangent: true }\n  bind: { x: x }`,
  },
  {
    name: 'Chart',
    summary: 'Simple line, bar or scatter chart.',
    usedBy: 'all',
    props: {
      kind: z.enum(['line', 'bar', 'scatter']),
      series: z.array(z.object({ name: Str, x: z.array(z.union([Num, Str])).optional(), y: z.array(Num) })),
      xLabel: Str.optional(),
      yLabel: Str.optional(),
      logY: Bool.optional(),
      title: Str.optional(),
    },
    docs: { kind: 'line | bar | scatter', series: '[{name, x?, y}] (x defaults to 1..n)', xLabel: 'axis label', yLabel: 'axis label', logY: 'log-scale y', title: 'optional caption' },
    bind: {},
    selectors: ['series:<name>', 'point:<name>,<i>'],
    commands: {},
    events: {},
    example: `- id: c\n  widget: Chart\n  props: { kind: line, series: [{ name: SSE, y: '@als.sseHistory' }], xLabel: iteration, yLabel: SSE }`,
  },
  {
    name: 'RankList',
    summary: 'Drag-to-reorder ranking with relevance badges and live per-position gain / DCG. `sortIdeal` animates to the ideal order.',
    usedBy: 'nb-cf',
    props: {
      items: z.array(z.object({ id: Str, label: Str })),
      relevance: z.record(z.string(), Num).optional(),
      showRelevance: Bool.optional(),
      showGain: Bool.optional(),
      gain: z.enum(['exp2', 'linear']).optional(),
      k: Num.optional(),
      draggable: Bool.optional(),
      order: StrArr.optional(),
    },
    docs: {
      items: '[{id, label}] in initial order',
      relevance: 'map id → relevance (true rating)',
      showRelevance: 'show the relevance badge (hide it to make learners guess)',
      showGain: 'show gain / log2(i+1) per position and running DCG',
      gain: 'exp2 (2^rel − 1, default, as in the lecture) or linear (rel)',
      k: 'only the top k positions count (others are dimmed)',
      draggable: 'allow reordering',
      order: 'controlled order (bind `order` to keep it in state)',
    },
    bind: { order: 'current order of ids' },
    selectors: ['item:<id>', 'pos:<n> (1-based)'],
    commands: { reveal: '{} — show relevance badges (persistent)', sortIdeal: '{} — animate to descending relevance (persistent)', setOrder: '{order} — set the order (persistent)' },
    events: { change: 'the order changed' },
    example: `- id: rl\n  widget: RankList\n  props: { items: '@dcgItems', relevance: '@dcgRel', showGain: true, k: 5, draggable: true }\n  bind: { order: order }`,
  },
  {
    name: 'DropBins',
    summary: 'Drag chips into labeled bins; self-checking against `solution`.',
    usedBy: 'all',
    props: {
      chips: z.array(z.object({ id: Str, label: Str })),
      bins: z.array(z.object({ id: Str, label: Str })),
      solution: z.record(z.string(), Str).optional(),
      check: z.enum(['instant', 'submit']).optional(),
      shuffle: Bool.optional(),
    },
    docs: { chips: '[{id, label}] (labels are Markdown)', bins: '[{id, label}]', solution: 'map chip id → bin id', check: 'instant (default) or submit button', shuffle: 'shuffle chip order (default true)' },
    bind: { placement: 'map chip id → bin id' },
    selectors: ['chip:<id>', 'bin:<id>'],
    commands: { reset: '{} — move chips back to the tray', solve: '{} — place every chip in its correct bin (persistent)' },
    events: { solved: 'all chips placed correctly', change: 'placement changed' },
    example: `- id: bins\n  widget: DropBins\n  props:\n    chips: [{ id: milk, label: '{milk}' }, { id: bb, label: '{bread, butter}' }]\n    bins: [{ id: freq, label: Frequent }, { id: infreq, label: Infrequent }]\n    solution: { milk: freq, bb: infreq }`,
  },
  {
    name: 'Tree',
    summary: 'Expandable tree: projected-database recursion, FP-tree, decision paths.',
    usedBy: 'fim',
    props: {
      root: z.any(),
      orientation: z.enum(['down', 'right']).optional(),
      collapsed: Bool.optional(),
    },
    docs: { root: '{id, label, note?, tone?, children?} (labels are Markdown)', orientation: 'down (default) or right', collapsed: 'start with everything below the root collapsed' },
    bind: {},
    selectors: ['node:<id>', 'path:<id> (the node and its ancestors)'],
    commands: { expand: "{id | 'all'} (persistent)", collapse: "{id | 'all'} (persistent)" },
    events: { nodeClick: 'a node was clicked' },
    example: `- id: tree\n  widget: Tree\n  props: { root: '@fp.tree', orientation: right }`,
  },
  {
    name: 'Formula',
    summary: 'KaTeX formula with anchors, {=var} interpolation and step-by-step build (`steps` + `step`). `highlight {sel: term:<anchor>}` glows a term.',
    usedBy: 'all',
    props: { tex: Str.optional(), steps: StrArr.optional(), step: Num.optional(), size: z.enum(['sm', 'md', 'lg']).optional() },
    docs: { tex: 'a single TeX string', steps: 'TeX strings revealed cumulatively (only the current one is shown)', step: '0-based step (bind it or change it with set)', size: 'sm | md (default) | lg' },
    bind: { step: 'current step' },
    selectors: ['term:<anchor>'],
    commands: { step: '{n} — go to step n (persistent)', next: '{} — advance one step (persistent)' },
    events: {},
    example: `- id: f\n  widget: Formula\n  props:\n    steps:\n      - '\\text{Sup}(X)'\n      - '\\text{Sup}(X) = \\anchor{abs}{ {=s.abs} }'\n    step: 0`,
  },
  {
    name: 'Code',
    summary: 'Highlighted code (Shiki) with anchor markers stripped, anchor hover links and debugger-style value badges.',
    usedBy: 'all',
    props: { source: Str, lang: Str.optional(), lineNumbers: Bool.optional(), badges: z.record(z.string(), Str).optional(), maxHeight: Num.optional(), title: Str.optional() },
    docs: { source: 'code with `# @a name` … `# @end` or trailing `# @a:name` markers', lang: 'python (default), javascript, sql, bash', lineNumbers: 'show line numbers (default true)', badges: 'map anchor → text shown at the end of its first line', maxHeight: 'px', title: 'caption' },
    bind: {},
    selectors: ['anchor:<name>', 'line:<n>'],
    commands: { badges: '{anchor: text, …} (persistent)' },
    events: {},
    example: `- id: code\n  widget: Code\n  props: { source: '...', lang: python }`,
  },
  {
    name: 'StepPlayer',
    summary: 'Runs a logic trace fn and plays it across other widgets by role (play / pause / step / scrub / speed).',
    usedBy: 'all',
    props: {
      fn: Str,
      in: z.record(z.string(), Any),
      roles: z.record(z.string(), Str),
      autoplay: Bool.optional(),
      speed: Num.optional(),
      loop: Bool.optional(),
      showLabel: Bool.optional(),
      out: Str.optional(),
    },
    docs: {
      fn: 'logic fn whose result has `trace`',
      in: 'fn input (refs allowed)',
      roles: 'map role → stage widget id (code/formula optional)',
      autoplay: 'start playing when shown',
      speed: 'steps per second (default 1)',
      loop: 'restart at the end',
      showLabel: 'show the step label (default true)',
      out: 'scope name that receives the full fn result',
    },
    bind: {},
    selectors: [],
    commands: { play: '{}', pause: '{}', step: '{}', reset: '{}', goto: '{n}' },
    events: { done: 'reached the last step', step: 'moved to a step' },
    example: `- id: player\n  widget: StepPlayer\n  region: bottom\n  props: { fn: aprioriRun, in: { transactions: '@grocery5', minsup: 2 }, roles: { lattice: lat, table: t } }`,
  },
  {
    name: 'Slider',
    summary: 'Numeric slider bound to a state key.',
    usedBy: 'all',
    props: { label: Str, min: Num, max: Num, step: Num, format: z.union([Str, Num]).optional(), marks: z.array(Num).optional(), value: Num.optional() },
    docs: { label: 'Markdown label', min: 'minimum', max: 'maximum', step: 'step', format: 'number format for the readout', marks: 'tick marks', value: 'controlled value (normally via bind)' },
    bind: { value: 'the slider value' },
    selectors: [],
    commands: {},
    events: { change: 'value changed' },
    example: `- id: s\n  widget: Slider\n  props: { label: minsup, min: 1, max: 5, step: 1 }\n  bind: { value: minsup }`,
  },
  {
    name: 'Choice',
    summary: 'Segmented control, dropdown or toggle bound to a state key.',
    usedBy: 'all',
    props: { label: Str.optional(), options: z.array(z.object({ value: Any, label: Str })), style: z.enum(['segmented', 'dropdown', 'toggle']).optional(), value: Any.optional() },
    docs: { label: 'Markdown label', options: '[{value, label}]', style: 'segmented (default) | dropdown | toggle', value: 'controlled value (normally via bind)' },
    bind: { value: 'selected option value' },
    selectors: [],
    commands: {},
    events: { change: 'selection changed' },
    example: `- id: pick\n  widget: Choice\n  props: { label: Rule, options: [{ value: butter, label: 'bread → butter' }, { value: eggs, label: 'bread → eggs' }] }\n  bind: { value: consequent }`,
  },
  {
    name: 'Readout',
    summary: 'Big live numbers.',
    usedBy: 'all',
    props: { items: z.array(z.object({ label: Str, value: Any, tone: Tone.optional(), format: z.union([Str, Num]).optional() })) },
    docs: { items: '[{label, value (ref or Markdown with {=}), tone?, format?}]' },
    bind: {},
    selectors: ['item:<index>'],
    commands: {},
    events: {},
    example: `- id: r\n  widget: Readout\n  props: { items: [{ label: Confidence, value: '@c.conf', format: 2, tone: accent }] }`,
  },
  {
    name: 'Callout',
    summary: 'Boxed note: note | tip | warn | exam | errata | beyond (beyond the slides) | define (a term definition).',
    usedBy: 'all',
    props: { kind: z.enum(['note', 'tip', 'warn', 'exam', 'errata', 'beyond', 'define']), title: Str.optional(), body: Str },
    docs: { kind: 'note | tip | warn | exam | errata | beyond | define', title: 'optional title', body: 'Markdown' },
    bind: {},
    selectors: [],
    commands: {},
    events: {},
    example: `- id: e\n  widget: Callout\n  props: { kind: errata, body: 'Slide 53 says DCG / NDCG; it should be DCG / IDCG.' }`,
  },
  {
    name: 'Journal',
    summary: 'General-journal entries (date · account · Dr · Cr) with credits indented. Entries can be revealed one at a time with `post`, and lines carry anchors that link to Formula terms.',
    usedBy: 'journal workbench (accounting)',
    props: {
      entries: z.array(z.object({ id: Str, date: Str.optional(), lines: z.array(z.object({ account: Str, debit: Any.optional(), credit: Any.optional(), anchor: Str.optional(), note: Str.optional() })), memo: Str.optional(), anchor: Str.optional() })),
      posted: z.union([StrArr, Num]).optional(),
      currency: Str.optional(),
      decimals: Num.optional(),
      showTotals: Bool.optional(),
      title: Str.optional(),
    },
    docs: {
      entries: '[{id, date?, lines: [{account, debit | credit, anchor?, note?}], memo?}] (amounts: numbers or refs)',
      posted: 'entry ids shown at the start, or a count of entries (default: all). `post` reveals more',
      currency: 'symbol (default: the module currency, ₱)',
      decimals: 'decimals for amounts (default: 0 if every amount is whole, else 2)',
      showTotals: 'show a Dr = Cr total row under each entry',
      title: 'caption',
    },
    bind: {},
    selectors: ['entry:<id>', 'line:<entryId>:<n> (1-based)', 'account:<account name>', 'anchor:<name>'],
    commands: { post: '{id} — reveal an entry (persistent)', unpost: '{id} — hide it again (persistent)' },
    events: {},
    example: `- id: jr\n  widget: Journal\n  props:\n    posted: 0\n    entries:\n      - id: e1\n        date: Jan 5\n        lines:\n          - { account: Work in Process, debit: '@j.applied', anchor: applied }\n          - { account: Manufacturing Overhead, credit: '@j.applied' }`,
  },
  {
    name: 'TAccounts',
    summary: 'T-accounts side by side: debits left, credits right, optional running balance. Feed postings from a derived fn to watch costs flow (Raw Materials → WIP → Finished Goods → COGS).',
    usedBy: 'journal workbench (accounting)',
    props: {
      accounts: z.array(z.object({ id: Str, name: Str, debits: z.array(z.object({ amount: Any, ref: Str.optional(), anchor: Str.optional() })), credits: z.array(z.object({ amount: Any, ref: Str.optional(), anchor: Str.optional() })), showBalance: Bool.optional(), anchor: Str.optional() })),
      showBalance: Bool.optional(),
      currency: Str.optional(),
      decimals: Num.optional(),
      title: Str.optional(),
    },
    docs: {
      accounts: '[{id, name, debits: [{amount, ref?, anchor?}], credits: [...], showBalance?}] (amounts: numbers or refs)',
      showBalance: 'show each account’s ending balance under the T (default true)',
      currency: 'symbol (default ₱)',
      decimals: 'decimals for amounts',
      title: 'caption',
    },
    bind: {},
    selectors: ['account:<id>', 'dr:<id>:<n> (1-based)', 'cr:<id>:<n>', 'bal:<id>', 'anchor:<name>'],
    commands: {},
    events: {},
    example: `- id: ta\n  widget: TAccounts\n  props: { accounts: '@flow.accounts' }`,
  },
  {
    name: 'Schedule',
    summary: 'A financial statement or cost schedule: indented labels, one or more amount columns, subtotal/total rules. Unfilled cells (null) stay blank, so a derived fn can fill it in step by step.',
    usedBy: 'journal workbench (accounting)',
    props: {
      rows: z.array(z.object({ id: Str.optional(), label: Str, amount: Any.optional(), amounts: z.array(Any).optional(), indent: Num.optional(), style: z.enum(['line', 'heading', 'subtotal', 'total']).optional(), format: z.enum(['money', 'number', 'pct', 'ratio', 'units']).optional(), anchor: Str.optional() })),
      columns: StrArr.optional(),
      currency: Str.optional(),
      decimals: Num.optional(),
      title: Str.optional(),
    },
    docs: {
      rows: '[{id?, label, amount | amounts, indent?, style?: line|heading|subtotal|total, format?: money|number|pct|ratio|units, anchor?}] (labels are Markdown)',
      columns: 'column headers for multi-column schedules (e.g. [Total, Per unit, Percent])',
      currency: 'symbol (default ₱)',
      decimals: 'decimals for money amounts',
      title: 'caption (e.g. the statement heading)',
    },
    bind: {},
    selectors: ['row:<id or 1-based index>', 'cell:<row>,<col> (col 1-based)', 'anchor:<name>'],
    commands: {},
    events: {},
    example: `- id: is\n  widget: Schedule\n  props:\n    title: Contribution margin income statement\n    columns: [Total, Per unit]\n    rows:\n      - { id: sales, label: Sales, amounts: ['@cm.sales', '@cm.price'] }\n      - { id: vc, label: 'Less: variable expenses', amounts: ['@cm.vc', '@cm.vcu'], indent: 1 }\n      - { id: cm, label: Contribution margin, amounts: ['@cm.cm', '@cm.cmu'], style: subtotal, anchor: cm }`,
  },
  {
    name: 'Text',
    summary: 'Static Markdown on stage.',
    usedBy: 'all',
    props: { body: Str },
    docs: { body: 'Markdown (with {=} interpolation)' },
    bind: {},
    selectors: [],
    commands: {},
    events: {},
    example: `- id: note\n  widget: Text\n  props: { body: 'Support of {=A|set} = {=s.abs}' }`,
  },
  {
    name: 'Image',
    summary: 'An image from the module’s assets/.',
    usedBy: 'all',
    props: { src: Str, alt: Str, caption: Str.optional(), width: Num.optional() },
    docs: { src: 'assets/…', alt: 'alt text', caption: 'Markdown caption', width: 'px' },
    bind: {},
    selectors: [],
    commands: {},
    events: {},
    example: `- id: img\n  widget: Image\n  props: { src: assets/fp-tree.svg, alt: FP-tree }`,
  },
];

export const WIDGET_BY_NAME: Record<string, WidgetMeta> = Object.fromEntries(WIDGETS.map((w) => [w.name, w]));
export const WIDGET_NAMES = WIDGETS.map((w) => w.name);

export function widgetsMarkdown(): string {
  const lines: string[] = [];
  lines.push('# Kodigo widget reference (schema v1)');
  lines.push('');
  lines.push('> Generated from `packages/schema/src/widgets.ts`. Do not edit by hand. Authoritative for module authors (see MODULE_AUTHORING_GUIDE.md §9).');
  lines.push('');
  lines.push('Common commands on every widget: ' + Object.entries(COMMON_COMMANDS).map(([k, v]) => `\`${k}\` ${v}`).join('; ') + '.');
  lines.push('');
  lines.push('Persistence rule: `highlight` and `pulse` are transient (current beat / trace step only); every other command persists until the scene or player resets.');
  lines.push('');
  lines.push('| Widget | Summary |');
  lines.push('|---|---|');
  for (const w of WIDGETS) lines.push(`| [${w.name}](#${w.name.toLowerCase()}) | ${w.summary} |`);
  for (const w of WIDGETS) {
    lines.push('');
    lines.push(`## ${w.name}`);
    lines.push('');
    lines.push(w.summary + (w.usedBy ? ` *(used by: ${w.usedBy})*` : ''));
    lines.push('');
    lines.push('| Prop | Required | Description |');
    lines.push('|---|---|---|');
    for (const [k, s] of Object.entries(w.props)) {
      const optional = (s as z.ZodTypeAny).isOptional();
      lines.push(`| \`${k}\` | ${optional ? '' : 'yes'} | ${(w.docs[k] ?? '').replace(/\|/g, '\\|')} |`);
    }
    const sec = (title: string, rec: Record<string, string>) => {
      const e = Object.entries(rec);
      if (!e.length) return;
      lines.push('');
      lines.push(`**${title}:** ` + e.map(([k, v]) => `\`${k}\` ${v}`).join('; '));
    };
    sec('Bind outputs', w.bind);
    if (w.selectors.length) {
      lines.push('');
      lines.push('**Selectors:** ' + w.selectors.map((s) => `\`${s}\``).join(', '));
    }
    sec('Commands', w.commands);
    sec('Events', w.events);
    lines.push('');
    lines.push('```yaml');
    lines.push(w.example);
    lines.push('```');
  }
  lines.push('');
  return lines.join('\n');
}
