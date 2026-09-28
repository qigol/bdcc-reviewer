# Kodigo widget reference (schema v1)

> Generated from `packages/schema/src/widgets.ts`. Do not edit by hand. Authoritative for module authors (see MODULE_AUTHORING_GUIDE.md §9).

Common commands on every widget: `highlight` {sel, tone?} — transient: lasts for the current beat or trace step; `pulse` {sel} — transient attention pulse; `annotate` {sel, text} — persistent small label next to the target; `clear` {sel?} — remove persistent marks (all, or for one selector).

Persistence rule: `highlight` and `pulse` are transient (current beat / trace step only); every other command persists until the scene or player resets.

| Widget | Summary |
|---|---|
| [TransactionTable](#transactiontable) | Transactions as rows of item chips. Rows containing `highlight` glow; items can be dragged between rows when editable; `project` shows a conditional (projected) database for FP-growth. |
| [ItemsetLattice](#itemsetlattice) | Hasse diagram of the itemset lattice with support under each node and minsup coloring (frequent = good, infrequent = muted). `prune` cascades grey over all supersets. |
| [Venn](#venn) | Two-set Venn diagram with counts or fractions: support, confidence and lift intuition. |
| [Matrix](#matrix) | Numeric matrix with missing cells, optional row means and heatmap; editable; animated `center`, `fill`, `transpose`. |
| [MatrixProduct](#matrixproduct) | U × V ≈ R layout (V is d×n as in the lectures). `focus` animates one row·column dot product into P. |
| [VectorPlot](#vectorplot) | Draggable 2-D vectors with the angle between two of them and a live cosine readout. |
| [FunctionPlot](#functionplot) | y = f(x) from a logic fn (called with {x, ...args}, returns {y}); draggable x, tangent, minimum marker. |
| [Chart](#chart) | Simple line, bar or scatter chart. |
| [RankList](#ranklist) | Drag-to-reorder ranking with relevance badges and live per-position gain / DCG. `sortIdeal` animates to the ideal order. |
| [DropBins](#dropbins) | Drag chips into labeled bins; self-checking against `solution`. |
| [Tree](#tree) | Expandable tree: projected-database recursion, FP-tree, decision paths. |
| [Formula](#formula) | KaTeX formula with anchors, {=var} interpolation and step-by-step build (`steps` + `step`). `highlight {sel: term:<anchor>}` glows a term. |
| [Code](#code) | Highlighted code (Shiki) with anchor markers stripped, anchor hover links and debugger-style value badges. |
| [StepPlayer](#stepplayer) | Runs a logic trace fn and plays it across other widgets by role (play / pause / step / scrub / speed). |
| [Slider](#slider) | Numeric slider bound to a state key. |
| [Choice](#choice) | Segmented control, dropdown or toggle bound to a state key. |
| [Readout](#readout) | Big live numbers. |
| [Callout](#callout) | Boxed note: note | tip | warn | exam | errata | beyond (beyond the slides). |
| [Text](#text) | Static Markdown on stage. |
| [Image](#image) | An image from the module’s assets/. |

## TransactionTable

Transactions as rows of item chips. Rows containing `highlight` glow; items can be dragged between rows when editable; `project` shows a conditional (projected) database for FP-growth. *(used by: fim)*

| Prop | Required | Description |
|---|---|---|
| `transactions` | yes | transactions payload (`@dataset` or generator var) |
| `itemOrder` |  | item order used by `project` and chip sorting (default: alphabetical) |
| `highlight` |  | itemset; rows containing every item glow |
| `strike` |  | row ids drawn struck-through |
| `editable` |  | drag chips between rows, add from `palette`, click a chip to remove it |
| `palette` |  | items offered for adding when editable |
| `selectable` |  | click chips to build a selection itemset (bind `selection`) |
| `showContainCount` |  | show "n of N rows contain the highlight" |
| `title` |  | optional caption |
| `selection` |  | controlled selection (bind `selection` to keep it in state) |

**Bind outputs:** `transactions` the edited transactions; `selection` the selected itemset (string[])

**Selectors:** `row:<id>`, `item:<item> (every chip of that item)`, `chip:<rowId>:<item>`

**Commands:** `strike` {sel} — strike rows (persistent); `project` {prefix: string[]} — keep rows containing the prefix and drop items ≤ the last prefix item in itemOrder (persistent); `unproject` {} — undo project

**Events:** `change` transactions edited; `select` selection changed

```yaml
- id: t
  widget: TransactionTable
  props: { transactions: '@grocery5', itemOrder: [bread, butter, cheese, eggs, milk, yogurt], highlight: '@A' }
```

## ItemsetLattice

Hasse diagram of the itemset lattice with support under each node and minsup coloring (frequent = good, infrequent = muted). `prune` cascades grey over all supersets. *(used by: fim)*

| Prop | Required | Description |
|---|---|---|
| `items` | yes | the items; also the key order (keys via sdk.key(set, items)) |
| `support` |  | map key → absolute support (e.g. `@freq.supportMap`) |
| `minsup` |  | nodes with support ≥ minsup are colored frequent |
| `maxLevel` |  | deepest level drawn (default: all, capped at 4 for readability) |
| `showSupport` |  | print the support under each node |
| `showEmpty` |  | draw the empty set at the top |
| `selection` |  | controlled selection (normally via bind) |

**Bind outputs:** `selection` clicked itemset (string[])

**Selectors:** `set:<a,b> (canonical key)`, `level:<k>`

**Commands:** `prune` {sel} — grey the set and every superset (persistent); `reveal` {level} — show levels ≤ level (persistent); `hideAbove` {level} — hide levels > level (persistent)

**Events:** `nodeClick` a node was clicked

```yaml
- id: lat
  widget: ItemsetLattice
  props: { items: [bread, butter, milk], support: '@freq.supportMap', minsup: '@minsup', showSupport: true }
```

## Venn

Two-set Venn diagram with counts or fractions: support, confidence and lift intuition. *(used by: fim)*

| Prop | Required | Description |
|---|---|---|
| `labels` | yes | [A label, B label] |
| `nA` | yes | \|A\| |
| `nB` | yes | \|B\| |
| `nAB` | yes | \|A ∩ B\| |
| `N` | yes | universe size |
| `mode` |  | count (default) or fraction of N |

**Selectors:** `A`, `B`, `AB`, `U`

```yaml
- id: v
  widget: Venn
  props: { labels: [bread, butter], nA: 2, nB: 1, nAB: 1, N: 5 }
```

## Matrix

Numeric matrix with missing cells, optional row means and heatmap; editable; animated `center`, `fill`, `transpose`. *(used by: nb-cf, lf-cf)*

| Prop | Required | Description |
|---|---|---|
| `data` |  | matrix payload {rows, cols, values} |
| `rows` |  | row labels (if not using data) |
| `cols` |  | column labels (if not using data) |
| `values` |  | number \| TeX string \| null (missing) |
| `format` |  | number format: 2 (default), 0..6, 'frac', 'int' |
| `editable` |  | true or {min, max, step}: click a cell to edit; empty input = missing |
| `heatmap` |  | none (default) \| seq \| div (diverging around 0) |
| `showRowMeans` |  | append a μ column (means over observed cells) |
| `meanLabel` |  | TeX for the mean column header (default \mu_u) |
| `emptyLabel` |  | what to print in missing cells (default blank) |
| `title` |  | optional caption |
| `rowHeader` |  | text for the top-left corner cell |

**Bind outputs:** `values` edited values; `selection` clicked cell {row, col}

**Selectors:** `cell:<row>,<col>`, `row:<row>`, `col:<col>`, `mean:<row>`, `missing`

**Commands:** `fill` {cell: "row,col", value} — animate a value into a cell (persistent); `center` {} — animate subtracting each row mean from its observed cells (persistent); `uncenter` {} — undo center; `transpose` {} — swap rows and columns (persistent); `mask` {sel} — dim everything except the selection (persistent)

**Events:** `change` a value was edited; `select` a cell was clicked

```yaml
- id: m
  widget: Matrix
  props: { data: '@hp4x7', showRowMeans: true, format: frac }
```

## MatrixProduct

U × V ≈ R layout (V is d×n as in the lectures). `focus` animates one row·column dot product into P. *(used by: lf-cf)*

| Prop | Required | Description |
|---|---|---|
| `U` | yes | m×d factor matrix payload |
| `V` | yes | d×n factor matrix payload |
| `R` |  | optional target ratings (null = missing) |
| `symbolic` |  | entries may be TeX strings (P is then shown symbolically) |
| `showError` |  | color P cells by (R − P) on observed cells |
| `format` |  | number format for entries |

**Selectors:** `U:<i>,<s>`, `V:<s>,<j>`, `P:<i>,<j>`, `R:<i>,<j>`, `Urow:<i>`, `Vcol:<j>`

**Commands:** `focus` {i, j} (0-based) — sweep U row i · V column j into P[i,j] (persistent); `unfocus` {}

**Events:** `hover` a P cell was hovered

```yaml
- id: mp
  widget: MatrixProduct
  props: { U: '@als.U', V: '@als.V', R: '@r5x5', showError: true }
```

## VectorPlot

Draggable 2-D vectors with the angle between two of them and a live cosine readout. *(used by: nb-cf, lf-cf)*

| Prop | Required | Description |
|---|---|---|
| `vectors` | yes | [{id, x, y, label?, draggable?, tone?}] |
| `domain` |  | [min, max] for both axes (default [-5, 5]) |
| `angleBetween` |  | [id, id] draw the angle arc |
| `showCosine` |  | show cos θ for angleBetween |
| `showProjection` |  | [id, id] project the first onto the second |
| `showCoords` |  | append (x, y) to labels (default: only when ≤ 3 vectors) |

**Bind outputs:** `vectors` vectors after dragging

**Selectors:** `vec:<id>`, `angle`

**Events:** `change` a vector was dragged

```yaml
- id: vp
  widget: VectorPlot
  props: { vectors: [{ id: a, x: 2, y: 1, draggable: true }, { id: b, x: 1, y: 2 }], angleBetween: [a, b], showCosine: true }
  bind: { vectors: vecs }
```

## FunctionPlot

y = f(x) from a logic fn (called with {x, ...args}, returns {y}); draggable x, tangent, minimum marker. *(used by: lf-cf)*

| Prop | Required | Description |
|---|---|---|
| `fn` | yes | name of a logic fn returning {y} |
| `args` |  | extra args merged into every call |
| `domain` | yes | [a, b] |
| `samples` |  | number of samples (default 80) |
| `x` |  | current x (bind it to let the learner drag) |
| `draggable` |  | drag the point along the curve |
| `showTangent` |  | draw the tangent at x (numeric derivative) |
| `showMin` |  | mark the sampled minimum |
| `xLabel` |  | TeX |
| `yLabel` |  | TeX |

**Bind outputs:** `x` the dragged x

**Selectors:** `point`, `min`, `curve`

**Commands:** `animateTo` {x} — move the point (persistent); `markMin` {} — reveal the minimum marker (persistent)

**Events:** `change` x changed by dragging

```yaml
- id: fp
  widget: FunctionPlot
  props: { fn: cgdRow1Sse, domain: [0, 5], x: '@x', draggable: true, showTangent: true }
  bind: { x: x }
```

## Chart

Simple line, bar or scatter chart. *(used by: all)*

| Prop | Required | Description |
|---|---|---|
| `kind` | yes | line \| bar \| scatter |
| `series` | yes | [{name, x?, y}] (x defaults to 1..n) |
| `xLabel` |  | axis label |
| `yLabel` |  | axis label |
| `logY` |  | log-scale y |
| `title` |  | optional caption |

**Selectors:** `series:<name>`, `point:<name>,<i>`

```yaml
- id: c
  widget: Chart
  props: { kind: line, series: [{ name: SSE, y: '@als.sseHistory' }], xLabel: iteration, yLabel: SSE }
```

## RankList

Drag-to-reorder ranking with relevance badges and live per-position gain / DCG. `sortIdeal` animates to the ideal order. *(used by: nb-cf)*

| Prop | Required | Description |
|---|---|---|
| `items` | yes | [{id, label}] in initial order |
| `relevance` |  | map id → relevance (true rating) |
| `showRelevance` |  | show the relevance badge (hide it to make learners guess) |
| `showGain` |  | show gain / log2(i+1) per position and running DCG |
| `gain` |  | exp2 (2^rel − 1, default, as in the lecture) or linear (rel) |
| `k` |  | only the top k positions count (others are dimmed) |
| `draggable` |  | allow reordering |
| `order` |  | controlled order (bind `order` to keep it in state) |

**Bind outputs:** `order` current order of ids

**Selectors:** `item:<id>`, `pos:<n> (1-based)`

**Commands:** `reveal` {} — show relevance badges (persistent); `sortIdeal` {} — animate to descending relevance (persistent); `setOrder` {order} — set the order (persistent)

**Events:** `change` the order changed

```yaml
- id: rl
  widget: RankList
  props: { items: '@dcgItems', relevance: '@dcgRel', showGain: true, k: 5, draggable: true }
  bind: { order: order }
```

## DropBins

Drag chips into labeled bins; self-checking against `solution`. *(used by: all)*

| Prop | Required | Description |
|---|---|---|
| `chips` | yes | [{id, label}] (labels are Markdown) |
| `bins` | yes | [{id, label}] |
| `solution` |  | map chip id → bin id |
| `check` |  | instant (default) or submit button |
| `shuffle` |  | shuffle chip order (default true) |

**Bind outputs:** `placement` map chip id → bin id

**Selectors:** `chip:<id>`, `bin:<id>`

**Commands:** `reset` {} — move chips back to the tray; `solve` {} — place every chip in its correct bin (persistent)

**Events:** `solved` all chips placed correctly; `change` placement changed

```yaml
- id: bins
  widget: DropBins
  props:
    chips: [{ id: milk, label: '{milk}' }, { id: bb, label: '{bread, butter}' }]
    bins: [{ id: freq, label: Frequent }, { id: infreq, label: Infrequent }]
    solution: { milk: freq, bb: infreq }
```

## Tree

Expandable tree: projected-database recursion, FP-tree, decision paths. *(used by: fim)*

| Prop | Required | Description |
|---|---|---|
| `root` |  | {id, label, note?, tone?, children?} (labels are Markdown) |
| `orientation` |  | down (default) or right |
| `collapsed` |  | start with everything below the root collapsed |

**Selectors:** `node:<id>`, `path:<id> (the node and its ancestors)`

**Commands:** `expand` {id | 'all'} (persistent); `collapse` {id | 'all'} (persistent)

**Events:** `nodeClick` a node was clicked

```yaml
- id: tree
  widget: Tree
  props: { root: '@fp.tree', orientation: right }
```

## Formula

KaTeX formula with anchors, {=var} interpolation and step-by-step build (`steps` + `step`). `highlight {sel: term:<anchor>}` glows a term. *(used by: all)*

| Prop | Required | Description |
|---|---|---|
| `tex` |  | a single TeX string |
| `steps` |  | TeX strings revealed cumulatively (only the current one is shown) |
| `step` |  | 0-based step (bind it or change it with set) |
| `size` |  | sm \| md (default) \| lg |

**Bind outputs:** `step` current step

**Selectors:** `term:<anchor>`

**Commands:** `step` {n} — go to step n (persistent); `next` {} — advance one step (persistent)

```yaml
- id: f
  widget: Formula
  props:
    steps:
      - '\text{Sup}(X)'
      - '\text{Sup}(X) = \anchor{abs}{ {=s.abs} }'
    step: 0
```

## Code

Highlighted code (Shiki) with anchor markers stripped, anchor hover links and debugger-style value badges. *(used by: all)*

| Prop | Required | Description |
|---|---|---|
| `source` | yes | code with `# @a name` … `# @end` or trailing `# @a:name` markers |
| `lang` |  | python (default), javascript, sql, bash |
| `lineNumbers` |  | show line numbers (default true) |
| `badges` |  | map anchor → text shown at the end of its first line |
| `maxHeight` |  | px |
| `title` |  | caption |

**Selectors:** `anchor:<name>`, `line:<n>`

**Commands:** `badges` {anchor: text, …} (persistent)

```yaml
- id: code
  widget: Code
  props: { source: '...', lang: python }
```

## StepPlayer

Runs a logic trace fn and plays it across other widgets by role (play / pause / step / scrub / speed). *(used by: all)*

| Prop | Required | Description |
|---|---|---|
| `fn` | yes | logic fn whose result has `trace` |
| `in` | yes | fn input (refs allowed) |
| `roles` | yes | map role → stage widget id (code/formula optional) |
| `autoplay` |  | start playing when shown |
| `speed` |  | steps per second (default 1) |
| `loop` |  | restart at the end |
| `showLabel` |  | show the step label (default true) |
| `out` |  | scope name that receives the full fn result |

**Commands:** `play` {}; `pause` {}; `step` {}; `reset` {}; `goto` {n}

**Events:** `done` reached the last step; `step` moved to a step

```yaml
- id: player
  widget: StepPlayer
  region: bottom
  props: { fn: aprioriRun, in: { transactions: '@grocery5', minsup: 2 }, roles: { lattice: lat, table: t } }
```

## Slider

Numeric slider bound to a state key. *(used by: all)*

| Prop | Required | Description |
|---|---|---|
| `label` | yes | Markdown label |
| `min` | yes | minimum |
| `max` | yes | maximum |
| `step` | yes | step |
| `format` |  | number format for the readout |
| `marks` |  | tick marks |
| `value` |  | controlled value (normally via bind) |

**Bind outputs:** `value` the slider value

**Events:** `change` value changed

```yaml
- id: s
  widget: Slider
  props: { label: minsup, min: 1, max: 5, step: 1 }
  bind: { value: minsup }
```

## Choice

Segmented control, dropdown or toggle bound to a state key. *(used by: all)*

| Prop | Required | Description |
|---|---|---|
| `label` |  | Markdown label |
| `options` | yes | [{value, label}] |
| `style` |  | segmented (default) \| dropdown \| toggle |
| `value` |  | controlled value (normally via bind) |

**Bind outputs:** `value` selected option value

**Events:** `change` selection changed

```yaml
- id: pick
  widget: Choice
  props: { label: Rule, options: [{ value: butter, label: 'bread → butter' }, { value: eggs, label: 'bread → eggs' }] }
  bind: { value: consequent }
```

## Readout

Big live numbers. *(used by: all)*

| Prop | Required | Description |
|---|---|---|
| `items` | yes | [{label, value (ref or Markdown with {=}), tone?, format?}] |

**Selectors:** `item:<index>`

```yaml
- id: r
  widget: Readout
  props: { items: [{ label: Confidence, value: '@c.conf', format: 2, tone: accent }] }
```

## Callout

Boxed note: note | tip | warn | exam | errata | beyond (beyond the slides). *(used by: all)*

| Prop | Required | Description |
|---|---|---|
| `kind` | yes | note \| tip \| warn \| exam \| errata \| beyond |
| `title` |  | optional title |
| `body` | yes | Markdown |

```yaml
- id: e
  widget: Callout
  props: { kind: errata, body: 'Slide 53 says DCG / NDCG; it should be DCG / IDCG.' }
```

## Text

Static Markdown on stage. *(used by: all)*

| Prop | Required | Description |
|---|---|---|
| `body` | yes | Markdown (with {=} interpolation) |

```yaml
- id: note
  widget: Text
  props: { body: 'Support of {=A|set} = {=s.abs}' }
```

## Image

An image from the module’s assets/. *(used by: all)*

| Prop | Required | Description |
|---|---|---|
| `src` | yes | assets/… |
| `alt` | yes | alt text |
| `caption` |  | Markdown caption |
| `width` |  | px |

```yaml
- id: img
  widget: Image
  props: { src: assets/fp-tree.svg, alt: FP-tree }
```
