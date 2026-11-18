/**
 * EPUB 3 export: one or more parsed modules → a reflowable ebook for Kindle (Send to Kindle) and Kobo.
 * Math is MathML (KaTeX), interactive widgets are left out or drawn as tables, and every question links
 * to its answer at the back of its module. Pure apart from the injected logic host, so a server route
 * can reuse it.
 */
import JSZip from 'jszip';
import type { LogicHost, ParsedModule } from '@kodigo/schema';
import { esc, type RenderLog } from './markdown';
import { moduleChapters, type Chapter, type ModuleBook } from './content';
import { CSS, moduleCss } from './style';

export interface EpubModule {
  parsed: ParsedModule;
  /** the module's files (for images in assets/) */
  files: Record<string, string | Uint8Array>;
}

export interface EpubOptions {
  /** book title (default: the module title, or the course name for several modules) */
  title?: string;
  /** stable identifier (default urn:kodigo:<ids>) */
  identifier?: string;
  /** dcterms:modified (default now); fixed in tests */
  modified?: Date;
  /** seed for generated questions (default 1) */
  seed?: number;
  hostFactory: (logic: string) => Promise<LogicHost>;
}

export interface EpubReport {
  bytes: Uint8Array;
  /** what was left out, by kind → count */
  skipped: Record<string, number>;
  mathErrors: string[];
  chapters: number;
}

const MEDIA: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml' };

const xhtml = (title: string, body: string, cls?: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en" xml:lang="en">
<head><meta charset="UTF-8" /><title>${esc(title)}</title><link rel="stylesheet" type="text/css" href="style.css" /></head>
<body${cls ? ` class="${cls}"` : ""}>
${body}
</body>
</html>
`;

const isoSeconds = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

export async function buildEpub(modules: EpubModule[], opts: EpubOptions): Promise<EpubReport> {
  if (!modules.length) throw new Error('no modules to export');
  const skipped: Record<string, number> = {};
  const skip = (k: string) => { skipped[k] = (skipped[k] ?? 0) + 1; };
  const log: RenderLog = { mathErrors: [] };
  const books: ModuleBook[] = [];
  for (const m of modules) {
    const host = await opts.hostFactory(m.parsed.logic);
    try {
      const assetFiles = new Set(Object.keys(m.files).filter((p) => p.startsWith('assets/')));
      books.push(await moduleChapters(m.parsed, host, { seed: opts.seed, skip, log, assetFiles }));
    } finally {
      host.dispose?.();
    }
  }

  const first = modules[0].parsed.manifest;
  const courses = [...new Set(modules.map((m) => m.parsed.manifest.course).filter(Boolean))];
  const title = opts.title ?? (modules.length === 1 ? first.title : courses.length === 1 ? courses[0]! : 'Qdigo modules');
  const identifier = opts.identifier ?? `urn:kodigo:${modules.map((m) => `${m.parsed.manifest.id}@${m.parsed.manifest.version}`).join('+')}`;
  const modified = isoSeconds(opts.modified ?? new Date());

  // a title page lists the modules when there are several
  const chapters: (Chapter & { module?: string })[] = [];
  if (books.length > 1) {
    chapters.push({
      file: 'title.xhtml',
      title,
      body: `<h1>${esc(title)}</h1><ol class="toc">${books.map((b) => `<li><a href="${b.chapters[0].file}">${esc(b.title)}</a></li>`).join('')}</ol>`,
    });
  }
  for (const b of books) for (const c of b.chapters) chapters.push({ ...c, module: b.id });

  const zip = new JSZip();
  // mimetype first and stored, as EPUB requires
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>
`);
  const manifest: string[] = [
    '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
    '<item id="css" href="style.css" media-type="text/css"/>',
  ];
  const spine: string[] = [];
  chapters.forEach((c, i) => {
    const html = xhtml(c.title, c.body, c.module ? `m-${c.module}` : undefined);
    zip.file(`OEBPS/${c.file}`, html);
    const props = html.includes('<math') ? ' properties="mathml"' : '';
    manifest.push(`<item id="c${i}" href="${esc(c.file)}" media-type="application/xhtml+xml"${props}/>`);
    spine.push(`<itemref idref="c${i}"/>`);
  });
  let img = 0;
  for (const [bi, b] of books.entries()) {
    for (const [src, out] of b.assets) {
      const data = modules[bi].files[src];
      if (data === undefined) continue;
      const ext = src.split('.').pop()!.toLowerCase();
      zip.file(`OEBPS/${out}`, data);
      manifest.push(`<item id="img${img++}" href="${esc(out)}" media-type="${MEDIA[ext]}"/>`);
    }
  }
  zip.file('OEBPS/style.css', CSS + books.map((b) => moduleCss(b.id, b.color)).join(''));

  // navigation: modules → their chapters
  const navItems = books.map((b) => {
    const inner = b.chapters.slice(1).map((c) => `<li><a href="${esc(c.file)}">${esc(c.title)}</a></li>`).join('');
    return `<li><a href="${esc(b.chapters[0].file)}">${esc(b.title)}</a>${inner ? `<ol>${inner}</ol>` : ''}</li>`;
  });
  const nav = books.length === 1
    ? books[0].chapters.map((c) => `<li><a href="${esc(c.file)}">${esc(c.title)}</a></li>`).join('')
    : navItems.join('');
  zip.file('OEBPS/nav.xhtml', xhtml('Contents', `<nav epub:type="toc" id="toc"><h1>Contents</h1><ol>${nav}</ol></nav>`));

  let order = 0;
  const point = (label: string, file: string, inner = '') => `<navPoint id="n${++order}" playOrder="${order}"><navLabel><text>${esc(label)}</text></navLabel><content src="${esc(file)}"/>${inner}</navPoint>`;
  const ncxPoints = books.length === 1
    ? books[0].chapters.map((c) => point(c.title, c.file)).join('')
    : books.map((b) => point(b.title, b.chapters[0].file, b.chapters.slice(1).map((c) => point(c.title, c.file)).join(''))).join('');
  zip.file('OEBPS/toc.ncx', `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
<head><meta name="dtb:uid" content="${esc(identifier)}"/></head>
<docTitle><text>${esc(title)}</text></docTitle>
<navMap>${ncxPoints}</navMap>
</ncx>
`);

  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid" xml:lang="en">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">${esc(identifier)}</dc:identifier>
    <dc:title>${esc(title)}</dc:title>
    <dc:language>en</dc:language>
    <dc:creator>Qdigo</dc:creator>
    <meta property="dcterms:modified">${modified}</meta>
  </metadata>
  <manifest>
    ${manifest.join('\n    ')}
  </manifest>
  <spine toc="ncx">
    ${spine.join('\n    ')}
  </spine>
</package>
`);

  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', mimeType: 'application/epub+zip' });
  return { bytes, skipped, mathErrors: log.mathErrors, chapters: chapters.length };
}
