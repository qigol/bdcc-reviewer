/**
 * Security headers per response (the CSP matrix in docs/ARCHITECTURE.md). Pure, so tests can call it
 * directly; app.ts applies it in one onSend hook. Vite dev sends none of these.
 */

const PAGE_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' blob:",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'self'",
  "object-src 'self'",
].join('; ');

/** module logic runs here: eval for logic.js, but no script URLs, network or nested workers */
const LOGIC_WORKER_CSP = "default-src 'none'; script-src 'unsafe-eval'; connect-src 'none'; worker-src 'none'; base-uri 'none'";
/** module files are untrusted: an SVG or HTML file must not run script on this origin */
const MODULE_FILE_CSP = "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'self'; sandbox";

export const isLogicWorkerAsset = (p: string) => /^\/assets\/logic\.worker-[\w-]+\.js$/.test(p);
export const isModuleFile = (p: string) => /^\/api\/modules\/[^/]+\/files\/.+/.test(p);

export function securityHeaders(r: { path: string; contentType: string; status?: number; hsts?: boolean }): Record<string, string> {
  const h: Record<string, string> = { 'x-content-type-options': 'nosniff' };
  if (r.contentType.includes('text/html')) h['content-security-policy'] = PAGE_CSP;
  else if (isLogicWorkerAsset(r.path)) h['content-security-policy'] = LOGIC_WORKER_CSP;
  else if (isModuleFile(r.path)) {
    // Chromium's PDF viewer won't render under a sandbox CSP; PDF viewers don't run script on this origin
    if (r.contentType.startsWith('application/pdf')) h['content-disposition'] = 'inline';
    else h['content-security-policy'] = MODULE_FILE_CSP;
  }
  return h;
}
