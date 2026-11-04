/**
 * Security headers per response (the CSP matrix in docs/ARCHITECTURE.md). Pure, so tests can call it
 * directly; app.ts applies it in one onSend hook. Vite dev sends none of these.
 */

/** no 'unsafe-eval': module logic evals only inside the logic worker, which has its own policy */
const PAGE_CSP = [
  "default-src 'self'",
  "script-src 'self' blob:",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'self'",
  "object-src 'self'",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

/** module logic runs here: eval for logic.js, but no script URLs, network or nested workers */
const LOGIC_WORKER_CSP = "default-src 'none'; script-src 'unsafe-eval'; connect-src 'none'; worker-src 'none'; base-uri 'none'";
/** Pyodide loads its .mjs/.wasm/packages from /pyodide/ and compiles WebAssembly */
const PYODIDE_WORKER_CSP = "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; worker-src 'none'; base-uri 'none'";
/** module files are untrusted: an SVG or HTML file must not run script on this origin */
const MODULE_FILE_CSP = "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'self'; sandbox";
const API_CSP = "default-src 'none'; frame-ancestors 'none'; sandbox";

export const isLogicWorkerAsset = (p: string) => /^\/assets\/logic\.worker-[\w-]+\.js$/.test(p);
export const isPyodideWorkerAsset = (p: string) => /^\/assets\/pyodide\.worker-[\w-]+\.js$/.test(p);
export const isModuleFile = (p: string) => /^\/api\/modules\/[^/]+\/files\/.+/.test(p);

export function securityHeaders(r: { path: string; contentType: string; status?: number; hsts?: boolean }): Record<string, string> {
  const h: Record<string, string> = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin' };
  if (r.hsts) h['strict-transport-security'] = 'max-age=31536000';
  if (r.contentType.includes('text/html')) {
    h['content-security-policy'] = PAGE_CSP;
    h['x-frame-options'] = 'SAMEORIGIN';
  } else if (isLogicWorkerAsset(r.path)) h['content-security-policy'] = LOGIC_WORKER_CSP;
  else if (isPyodideWorkerAsset(r.path)) h['content-security-policy'] = PYODIDE_WORKER_CSP;
  else if (isModuleFile(r.path)) {
    // Chromium's PDF viewer won't render under a sandbox CSP; PDF viewers don't run script on this origin
    if (r.contentType.startsWith('application/pdf')) h['content-disposition'] = 'inline';
    else h['content-security-policy'] = MODULE_FILE_CSP;
  } else if (r.path.startsWith('/api/')) h['content-security-policy'] = API_CSP;
  return h;
}
