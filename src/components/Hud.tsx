import type { PageMode } from '../hooks/useCamera';

interface HudProps {
  visible: boolean;
  mode: PageMode;
  page: number;
  total: number;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onAdd: () => void;
  onClose: () => void;
}

/** Writing-view controls: close, page indicator, new page, prev/next. */
export function Hud({ visible, mode, page, total, canPrev, canNext, onPrev, onNext, onAdd, onClose }: HudProps) {
  const label = mode === 'spread'
    ? (() => {
        const left = page % 2 === 1 ? page : page - 1; // entry index of the left page (may be -1)
        const a = left + 1;
        const b = left + 2;
        return a < 1 ? `Page 1 of ${total}` : b > total ? `Page ${a} of ${total}` : `Pages ${a}–${b} of ${total}`;
      })()
    : `Page ${page + 1} of ${total}`;
  return (
    <div className="hud" data-visible={visible} aria-hidden={!visible} inert={!visible}>
      <div className="hud-top">
        <button type="button" className="btn-ghost" onClick={onClose} aria-label="Close journal">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span>Close</span>
        </button>
        <p className="hud-status" aria-live="polite">{label}</p>
        <button type="button" className="btn-ghost" onClick={onAdd} aria-label="Add a new page">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
          <span>New page</span>
        </button>
      </div>
      <div className="hud-bottom">
        <button type="button" className="btn-turn prev" onClick={onPrev} disabled={!canPrev} aria-label="Previous page">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span>Prev</span>
        </button>
        <p className="hud-hint">Swipe or press ← → (Alt+← → while typing)</p>
        <button type="button" className="btn-turn next" onClick={onNext} disabled={!canNext} aria-label="Next page">
          <span>Next</span>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
    </div>
  );
}
