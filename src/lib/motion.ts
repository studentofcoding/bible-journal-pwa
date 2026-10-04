/**
 * Motion preference + shared easing helpers.
 *
 * `full`   - the complete choreography (camera pull-in, cover swing, 3D page flips, idle float).
 * `gentle` - what phones with "Reduce Motion" / "Remove animations" get by default: the cover still opens and
 *            pages still turn (they are the app), but shorter (GENTLE_K of the time), without the big camera
 *            sweep and without idle motion. The user can force `full` with the in-app toggle.
 */
export type MotionMode = 'full' | 'gentle';

const KEY = 'bible-journal:motion';
export const GENTLE_K = 0.45;

export const osPrefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function readStoredMotion(): MotionMode | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'full' || v === 'gentle' ? v : null;
  } catch { return null; }
}

export function storeMotion(m: MotionMode) {
  try { localStorage.setItem(KEY, m); } catch { /* storage unavailable */ }
}

export const defaultMotion = (): MotionMode => readStoredMotion() ?? (osPrefersReducedMotion() ? 'gentle' : 'full');

export type Ease = (t: number) => number;

/** CSS-style cubic-bezier(x1, y1, x2, y2) as a function of time fraction. */
export function bezier(x1: number, y1: number, x2: number, y2: number): Ease {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const e = sx(t) - x;
      if (Math.abs(e) < 1e-5) return sy(t);
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0, hi = 1;
    t = x;
    for (let i = 0; i < 20; i++) {
      const e = sx(t) - x;
      if (Math.abs(e) < 1e-5) break;
      if (e > 0) hi = t; else lo = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}

/** Page flips and the cover swing share one curve (fast start, long soft landing). */
export const PAPER_EASE = bezier(0.22, 0.8, 0.2, 1);
/** Camera moves: gentler start so the zoom reads as a pull-in. */
export const CAM_EASE = bezier(0.45, 0.05, 0.2, 1);
