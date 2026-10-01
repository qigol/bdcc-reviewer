import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { ExternalLink, Maximize2, Minimize2, X } from 'lucide-react';
import { cn } from './util';

/**
 * A floating window that shows another page of the site (lesson, glossary…) in an iframe,
 * so the page underneath (e.g. a running quiz) stays mounted and keeps its state.
 */

/** True when this copy of the app is running inside a popup iframe. */
export const isEmbedded = (() => {
  try { return typeof window !== 'undefined' && window.self !== window.top; } catch { return true; }
})();

/** Inside a popup: let Esc close the popup from within the iframe too. */
export function useEmbeddedEscape() {
  useEffect(() => {
    if (!isEmbedded) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') window.parent.postMessage({ kodigo: 'close-popup' }, location.origin); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
}

export interface PopupRequest { title: string; src: string; note?: string }
interface PopupCtx { open: (r: PopupRequest) => void; close: () => void }

const Ctx = createContext<PopupCtx | null>(null);

export function usePopup(): PopupCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePopup must be used inside <PopupProvider>');
  return c;
}

export function PopupProvider({ children }: { children: React.ReactNode }) {
  const [req, setReq] = useState<PopupRequest | null>(null);
  const [max, setMax] = useState(false);
  const open = useCallback((r: PopupRequest) => setReq(r), []);
  const close = useCallback(() => setReq(null), []);
  useEffect(() => {
    if (!req) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    // Esc pressed while focus is inside the iframe arrives as a message from the embedded app.
    const m = (e: MessageEvent) => { if (e.origin === location.origin && e.data?.kodigo === 'close-popup') close(); };
    window.addEventListener('keydown', h);
    window.addEventListener('message', m);
    return () => { window.removeEventListener('keydown', h); window.removeEventListener('message', m); };
  }, [req, close]);
  return (
    <Ctx.Provider value={{ open, close }}>
      {children}
      {req && (
        <div className={cn('no-print fixed inset-0 z-40 flex bg-black/40', max ? 'p-0' : 'items-center justify-center p-3 sm:p-6')} onClick={close} data-testid="popup">
          <div role="dialog" aria-label={req.title} onClick={(e) => e.stopPropagation()}
            className={cn('card flex flex-col overflow-hidden shadow-2xl', max ? 'h-full w-full rounded-none' : 'h-[85vh] w-full max-w-[1100px]')}>
            <div className="flex items-center gap-1 border-b border-line bg-panel2 px-3 py-1.5">
              <span className="mr-auto truncate text-sm font-semibold">{req.title}</span>
              {req.note && <span className="mr-2 hidden text-xs text-muted sm:inline">{req.note}</span>}
              <a className="btn-ghost btn-sm" href={req.src} target="_blank" rel="noreferrer" title="Open in a new tab"><ExternalLink size={15} /></a>
              <button className="btn-ghost btn-sm" onClick={() => setMax((m) => !m)} title={max ? 'Restore' : 'Maximize'} aria-label={max ? 'restore' : 'maximize'}>
                {max ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
              <button className="btn-ghost btn-sm" onClick={close} title="Close (Esc)" aria-label="close" data-testid="popup-close"><X size={16} /></button>
            </div>
            <iframe key={req.src} src={req.src} title={req.title} className="w-full flex-1 border-0 bg-bg" />
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
