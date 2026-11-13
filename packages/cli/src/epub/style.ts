/**
 * The book's stylesheet: black on white for e-ink, sizes in em (Kobo has bugs with %), no backgrounds,
 * borders instead of colour.
 */
export const CSS = `
body { font-size: 1em; line-height: 1.4; margin: 0 0.5em; }
h1 { font-size: 1.6em; margin: 0.5em 0; }
h2 { font-size: 1.35em; margin: 1em 0 0.4em; }
h3 { font-size: 1.1em; margin: 1em 0 0.3em; }
p { margin: 0.4em 0; }
.kind, .course { font-size: 0.8em; text-transform: uppercase; letter-spacing: 0.05em; margin: 0; }
.goal { font-style: italic; }
.muted { color: #555; font-size: 0.9em; }
.beat { margin: 0.6em 0; }
.stage { margin: 0.6em 0; }
.interactive { font-size: 0.85em; color: #555; font-style: italic; }
.define { border-left: 0.2em solid #000; padding-left: 0.6em; margin: 0.6em 0; }
.callout, .key-formula { border: 1px solid #000; padding: 0.4em 0.6em; margin: 0.8em 0; }
.callout.warn, .callout.errata { border-width: 2px; }
.callout-title, .q-label, .part-label { font-weight: bold; margin: 0 0 0.2em; }
.question { border-top: 1px solid #000; padding-top: 0.4em; margin: 1em 0; }
.answer { border-top: 1px solid #999; padding-top: 0.4em; margin: 1em 0; }
.to-answer { text-align: right; font-size: 0.9em; }
.blank { color: #333; }
.options { list-style: none; padding-left: 0.5em; }
.options li { margin: 0.25em 0; }
.letter { font-weight: bold; }
.part { margin: 0.6em 0 0.6em 0.6em; }
.model { border-left: 0.2em solid #000; padding-left: 0.6em; }
.explanation { margin-top: 0.4em; }
.caption { font-weight: bold; font-size: 0.9em; margin: 0.6em 0 0.2em; }
table { border-collapse: collapse; margin: 0.4em 0; font-size: 0.85em; }
th, td { border: 1px solid #000; padding: 0.15em 0.4em; vertical-align: top; text-align: left; }
td.num, th.num, .align-right { text-align: right; }
.align-center { text-align: center; }
td.credit { padding-left: 1.5em; }
table.schedule td, table.schedule th { border: none; }
table.schedule tr.subtotal td.num { border-top: 1px solid #000; }
table.schedule tr.total td { font-weight: bold; }
table.schedule tr.total td.num { border-top: 1px solid #000; border-bottom: 3px double #000; }
table.schedule tr.heading td { font-weight: bold; }
.indent1 { padding-left: 1em; } .indent2 { padding-left: 2em; } .indent3 { padding-left: 3em; }
table.taccount { display: inline-table; margin-right: 0.6em; }
pre.code { white-space: pre-wrap; font-size: 0.8em; border: 1px solid #000; padding: 0.3em; }
code { font-family: monospace; }
.math { margin: 0.4em 0; }
ol.derivation li { margin: 0.5em 0; }
dl.glossary dt { font-weight: bold; margin-top: 0.8em; }
dl.glossary dd { margin-left: 1em; }
figure { margin: 0.6em 0; text-align: center; }
figure img { max-width: 100%; }
figcaption { font-size: 0.85em; }
`;
