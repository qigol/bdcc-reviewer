/// <reference lib="webworker" />
// Runs Python (Pyodide 0.27.8: Python 3.12 + pandas 2.2) for the coding exam. The files come from our own origin
// (/pyodide/, fetched by scripts/fetch-pyodide.mjs), so the CSP needs nothing extra. Kept apart from
// logic.worker.ts, which strips network APIs that Pyodide needs to load its wheels.
//
// Messages in:  { id, type: 'load' } | { id, type: 'run', code, cell, files? } | { id, type: 'reset' }
// Messages out: { id, ok: true, out, err } | { id, ok: false, error } | { type: 'progress', stage }

const INDEX_URL = `${self.location.origin}/pyodide/`;

// A notebook cell in Python: stdout plus the repr of a final bare expression; on an error, the traceback keeps the
// learner's own frames and folds library frames into one "  ..." line (the same format as the module recordings).
const KERNEL = `
import ast, contextlib, io, traceback
_NS = {"__name__": "__main__"}
_CODES = {}
def _fmt_tb(e):
    lines = ["Traceback (most recent call last):"]
    collapsed = False
    for fr in traceback.extract_tb(e.__traceback__)[1:]:
        if fr.filename.startswith("<cell "):
            src = _CODES.get(fr.filename, "").split("\\n")
            text = src[fr.lineno - 1].strip() if fr.lineno and fr.lineno <= len(src) else ""
            lines += [f'  File "{fr.filename}", line {fr.lineno}, in {fr.name}', f"    {text}"]
            collapsed = False
        elif not collapsed:
            lines.append("  ...")
            collapsed = True
    lines += [l.rstrip("\\n") for l in traceback.format_exception_only(type(e), e)]
    return "\\n".join(lines)
def _run_cell(src, n):
    fname = f"<cell {n}>"
    _CODES[fname] = src
    buf = io.StringIO()
    try:
        tree = ast.parse(src, fname)
        last = tree.body.pop() if tree.body and isinstance(tree.body[-1], ast.Expr) else None
        with contextlib.redirect_stdout(buf):
            exec(compile(tree, fname, "exec"), _NS)
            if last is not None:
                v = eval(compile(ast.Expression(last.value), fname, "eval"), _NS)
                if v is not None:
                    print(repr(v))
        return buf.getvalue(), ""
    except SyntaxError as e:
        return buf.getvalue(), "".join(traceback.format_exception_only(type(e), e)).rstrip("\\n")
    except BaseException as e:
        return buf.getvalue(), _fmt_tb(e)
def _reset():
    _NS.clear()
    _NS["__name__"] = "__main__"
    _CODES.clear()
`;

let pyodide: any = null;
let loading: Promise<any> | null = null;

function load(): Promise<any> {
  loading ??= (async () => {
    postMessage({ type: 'progress', stage: 'Loading Python…' });
    const { loadPyodide } = await import(/* @vite-ignore */ `${INDEX_URL}pyodide.mjs`);
    const py = await loadPyodide({ indexURL: INDEX_URL });
    postMessage({ type: 'progress', stage: 'Loading pandas…' });
    const failed: string[] = [];
    await py.loadPackage(['pandas'], { errorCallback: (m: string) => failed.push(m), messageCallback: () => {} });
    if (failed.length) throw new Error(failed.join('; '));
    py.runPython(KERNEL);
    py.runPython('import pandas, numpy');
    pyodide = py;
    postMessage({ type: 'progress', stage: 'ready' });
    return py;
  })();
  return loading;
}

function writeFiles(py: any, files: Record<string, string>) {
  for (const [p, text] of Object.entries(files)) {
    py.FS.mkdirTree(p.slice(0, p.lastIndexOf('/')) || '/');
    py.FS.writeFile(p, text);
  }
}

self.onmessage = async (e: MessageEvent) => {
  const { id, type } = e.data;
  try {
    const py = await load();
    if (type === 'load') return postMessage({ id, ok: true, out: '', err: '' });
    if (type === 'reset') { py.runPython('_reset()'); return postMessage({ id, ok: true, out: '', err: '' }); }
    if (type === 'run') {
      if (e.data.files) writeFiles(py, e.data.files);
      const run = py.globals.get('_run_cell');
      const res = run(e.data.code, e.data.cell);
      const [out, err] = res.toJs();
      res.destroy(); run.destroy();
      return postMessage({ id, ok: true, out, err });
    }
    postMessage({ id, ok: false, error: `unknown message ${type}` });
  } catch (err: any) {
    postMessage({ id, ok: false, error: String(err?.message ?? err) });
  }
};
