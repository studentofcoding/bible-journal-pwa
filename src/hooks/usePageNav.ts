import { useEffect, type RefObject } from 'react';

interface Options {
  enabled: boolean;
  target: RefObject<HTMLElement | null>;
  onPrev: () => void;
  onNext: () => void;
}

const isTextTarget = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable);

/** Keyboard arrows (Alt+arrows while typing) and horizontal swipes turn the page. */
export function usePageNav({ enabled, target, onPrev, onNext }: Options) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (isTextTarget(e.target) && !e.altKey) return; // arrows move the caret while typing
      e.preventDefault();
      (e.key === 'ArrowLeft' ? onPrev : onNext)();
    };
    window.addEventListener('keydown', onKey);

    const el = target.current;
    let start: { x: number; y: number; t: number; id: number } | null = null;
    const down = (e: PointerEvent) => {
      // With a mouse, dragging inside the text is selection, not a swipe.
      if (e.pointerType === 'mouse' && isTextTarget(e.target)) return;
      if ((e.target as HTMLElement).closest?.('button, a')) return;
      start = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
    };
    const up = (e: PointerEvent) => {
      if (!start || start.id !== e.pointerId) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      const dt = performance.now() - start.t;
      start = null;
      if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.6 && dt < 700) (dx < 0 ? onNext : onPrev)();
    };
    const cancel = () => { start = null; };
    el?.addEventListener('pointerdown', down);
    el?.addEventListener('pointerup', up);
    el?.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('keydown', onKey);
      el?.removeEventListener('pointerdown', down);
      el?.removeEventListener('pointerup', up);
      el?.removeEventListener('pointercancel', cancel);
    };
  }, [enabled, target, onPrev, onNext]);
}
