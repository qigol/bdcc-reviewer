/**
 * The book's stylesheet. Body text stays black for e-ink. Colour goes on headings, labels, borders and light tints,
 * so a colour screen (Kobo Libra Colour, Kindle Colorsoft) shows it and a grayscale one still reads cleanly.
 * Sizes are in em (Kobo has bugs with %). Every question starts a page and its answer fills the next one.
 */
export const CSS = `
body { font-size: 1em; line-height: 1.4; margin: 0 0.5em; color: #000; }
h1 { font-size: 1.6em; margin: 0.5em 0; color: #1e3a8a; }
h2 { font-size: 1.35em; margin: 1em 0 0.4em; color: #1e3a8a; }
h3 { font-size: 1.1em; margin: 1em 0 0.3em; color: #1e3a8a; }
p { margin: 0.4em 0; }
a { color: #1d4ed8; }
.kind, .course { font-size: 0.8em; text-transform: uppercase; letter-spacing: 0.05em; margin: 0; font-weight: bold; color: #1d4ed8; }
.goal { font-style: italic; color: #333; }
.muted { color: #555; font-size: 0.9em; }
.beat { margin: 0.6em 0; }
.stage { margin: 0.6em 0; }
.interactive { font-size: 0.85em; color: #555; font-style: italic; }

/* definitions and callouts: a coloured bar, a tinted box, a coloured title */
.define { border-left: 0.3em solid #1d4ed8; background-color: #eff6ff; padding: 0.3em 0.6em; margin: 0.6em 0; }
.callout, .key-formula { border-left: 0.3em solid #475569; background-color: #f8fafc; padding: 0.4em 0.6em; margin: 0.8em 0; }
.callout-title { font-weight: bold; margin: 0 0 0.2em; }
.callout.note { border-left-color: #1d4ed8; background-color: #eff6ff; } .callout.note .callout-title { color: #1d4ed8; }
.callout.tip, .callout.takeaway { border-left-color: #15803d; background-color: #f0fdf4; } .callout.tip .callout-title, .callout.takeaway .callout-title { color: #15803d; }
.callout.warn { border-left-color: #b91c1c; background-color: #fef2f2; } .callout.warn .callout-title { color: #b91c1c; }
.callout.errata { border-left-color: #c2410c; background-color: #fff7ed; } .callout.errata .callout-title { color: #c2410c; }
.callout.exam { border-left-color: #7e22ce; background-color: #faf5ff; } .callout.exam .callout-title { color: #7e22ce; }
.callout.beyond { border-left-color: #0f766e; background-color: #f0fdfa; } .callout.beyond .callout-title { color: #0f766e; }
.callout.define { border-left-color: #1d4ed8; background-color: #eff6ff; } .callout.define .callout-title { color: #1d4ed8; }
.key-formula { border-left-color: #1d4ed8; background-color: #eff6ff; } .key-formula .callout-title { color: #1d4ed8; }

/* a question on its own page, its answer alone on the next */
.question { page-break-before: always; break-before: page; margin: 0.5em 0; }
.q-label { font-weight: bold; font-size: 1.1em; color: #1d4ed8; border-bottom: 2px solid #1d4ed8; padding-bottom: 0.15em; margin: 0 0 0.5em; }
.turn { text-align: right; font-size: 0.85em; color: #555; font-style: italic; margin-top: 1em; }
.answer { page-break-before: always; break-before: page; page-break-after: always; break-after: page; border-left: 0.3em solid #15803d; background-color: #f0fdf4; padding: 0.4em 0.6em; margin: 0.5em 0; }
.a-label { font-weight: bold; font-size: 1.1em; color: #15803d; margin: 0 0 0.5em; }
.blank { color: #333; }
.options { list-style: none; padding-left: 0.5em; }
.options li { margin: 0.3em 0; }
.letter { font-weight: bold; color: #1d4ed8; }
.part { margin: 0.6em 0 0.6em 0.6em; }
.part-label { font-weight: bold; margin: 0 0 0.2em; color: #1d4ed8; }
.model { border-left: 0.2em solid #15803d; padding-left: 0.6em; }
.explanation { margin-top: 0.4em; }

.caption { font-weight: bold; font-size: 0.9em; margin: 0.6em 0 0.2em; }
table { border-collapse: collapse; margin: 0.4em 0; font-size: 0.85em; }
th, td { border: 1px solid #64748b; padding: 0.15em 0.4em; vertical-align: top; text-align: left; }
th { background-color: #e2e8f0; }
td.num, th.num, .align-right { text-align: right; }
.align-center { text-align: center; }
td.credit { padding-left: 1.5em; }
table.schedule td, table.schedule th { border: none; background-color: transparent; }
table.schedule tr.subtotal td.num { border-top: 1px solid #000; }
table.schedule tr.total td { font-weight: bold; }
table.schedule tr.total td.num { border-top: 1px solid #000; border-bottom: 3px double #000; }
table.schedule tr.heading td { font-weight: bold; }
.indent1 { padding-left: 1em; } .indent2 { padding-left: 2em; } .indent3 { padding-left: 3em; }
table.taccount { display: inline-table; margin-right: 0.6em; }
pre.code { white-space: pre-wrap; font-size: 0.8em; border-left: 0.3em solid #475569; background-color: #f1f5f9; padding: 0.3em 0.5em; }
code { font-family: monospace; }
.math { margin: 0.4em 0; }
ol.derivation li { margin: 0.5em 0; }
dl.glossary dt { font-weight: bold; margin-top: 0.8em; color: #1e3a8a; }
dl.glossary dd { margin-left: 1em; }
figure { margin: 0.6em 0; text-align: center; }
figure img { max-width: 100%; }
figcaption { font-size: 0.85em; }
`;

/** A colour darkened until it reads as text on white (contrast about 4.5:1 or better). */
export function textColor(hex: string): string {
  let m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())?.[1];
  if (!m) return '#1d4ed8';
  if (m.length === 3) m = m.split('').map((c) => c + c).join('');
  let rgb = [0, 2, 4].map((i) => parseInt(m!.slice(i, i + 2), 16));
  const lum = (c: number[]) => {
    const [r, g, b] = c.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  // contrast with white ≥ 4.5 ⇔ luminance ≤ 0.183
  for (let k = 0; k < 20 && lum(rgb) > 0.183; k++) rgb = rgb.map((v) => Math.round(v * 0.9));
  return `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** The module's accent on its headings and question labels. Answers stay green in every module. */
export function moduleCss(id: string, color?: string): string {
  if (!color) return '';
  const c = textColor(color);
  const m = `.m-${id}`;
  return `
${m} h1, ${m} h2, ${m} h3, ${m} .kind, ${m} .course, ${m} dl.glossary dt { color: ${c}; }
${m} .q-label { color: ${c}; border-bottom-color: ${c}; }
${m} .letter, ${m} .part-label { color: ${c}; }
${m} .define { border-left-color: ${c}; }
`;
}
