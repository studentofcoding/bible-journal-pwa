import { useEffect, useRef, type RefObject } from 'react';
import type { TurnApi } from '../components/Journal';

interface Options {
  enabled: boolean;
  target: RefObject<HTMLElement | null>;
  turn: RefObject<TurnApi | null>;
  canGo: (dir: 1 | -1) => boolean;
  onPrev: () => void;
  onNext: () => void;
}

const isTextTarget = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable);

const SLOP = 10; // px before a touch becomes a page-turn drag

/**
 * Keyboard arrows (Alt+arrows while typing) and an interactive drag: the page being turned follows the finger
 * (pointer events; the stage has `touch-action: pan-y`, so horizontal moves are ours), and on release it
 * completes or springs back depending on how far / how fast it was flung.
 */
export function usePageNav({ enabled, target, turn, canGo, onPrev, onNext }: Options) {
  // Latest callbacks without re-binding listeners mid-gesture.
  const live = useRef({ canGo, onPrev, onNext });
  live.current = { canGo, onPrev, onNext };

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (isTextTarget(e.target) && !e.altKey) return; // arrows move the caret while typing
      e.preventDefault();
      (e.key === 'ArrowLeft' ? live.current.onPrev : live.current.onNext)();
    };
    window.addEventListener('keydown', onKey);

    const el = target.current;
    type G = { x: number; y: number; id: number; dir: 0 | 1 | -1; dist: number; samples: { t: number; v: number }[]; t: number; rejected: boolean };
    let g: G | null = null;

    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && (e.button !== 0 || isTextTarget(e.target))) return; // mouse drags in text = selection
      if ((e.target as HTMLElement).closest?.('button, a')) return;
      if (g) return;
      g = { x: e.clientX, y: e.clientY, id: e.pointerId, dir: 0, dist: 1, samples: [], t: 0, rejected: false };
    };
    const move = (e: PointerEvent) => {
      if (!g || g.id !== e.pointerId || g.rejected) return;
      const dx = e.clientX - g.x;
      const dy = e.clientY - g.y;
      if (g.dir === 0) {
        if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
        if (Math.abs(dx) < Math.abs(dy) * 1.2) { g.rejected = true; return; } // vertical: scrolling the textarea
        const dir: 1 | -1 = dx < 0 ? 1 : -1;
        if (!live.current.canGo(dir) || !turn.current?.begin(dir)) { g.rejected = true; return; }
        g.dir = dir;
        g.dist = turn.current.distance();
        try { el?.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
      }
      const t = Math.min(1, Math.max(0, (-dx * g.dir - SLOP * 0.5) / g.dist));
      const now = performance.now();
      g.t = t;
      g.samples.push({ t: now, v: t });
      while (g.samples.length > 2 && now - g.samples[0].t > 90) g.samples.shift();
      turn.current?.set(t);
      e.preventDefault();
    };
    const end = (e: PointerEvent, cancelled: boolean) => {
      if (!g || g.id !== e.pointerId) return;
      const gest = g;
      g = null;
      if (gest.dir === 0) return;
      try { el?.releasePointerCapture(e.pointerId); } catch { /* already released */ }
      const s = gest.samples;
      const vel = s.length > 1 ? (s[s.length - 1].v - s[0].v) / Math.max(16, s[s.length - 1].t - s[0].t) : 0; // progress / ms
      const projected = gest.t + vel * 140;
      const commit = !cancelled && projected > 0.5 && vel > -0.0015;
      turn.current?.release(commit);
      if (commit) (gest.dir > 0 ? live.current.onNext : live.current.onPrev)();
    };
    const up = (e: PointerEvent) => end(e, false);
    const cancel = (e: PointerEvent) => end(e, true);
    el?.addEventListener('pointerdown', down);
    el?.addEventListener('pointermove', move);
    el?.addEventListener('pointerup', up);
    el?.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('keydown', onKey);
      el?.removeEventListener('pointerdown', down);
      el?.removeEventListener('pointermove', move);
      el?.removeEventListener('pointerup', up);
      el?.removeEventListener('pointercancel', cancel);
      if (g && g.dir !== 0) turn.current?.release(false);
      g = null;
    };
  }, [enabled, target, turn]);
}
