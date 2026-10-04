import { useCallback, useEffect, useState } from 'react';
import { GENTLE_K, defaultMotion, readStoredMotion, storeMotion, type MotionMode } from '../lib/motion';

/**
 * 'full' | 'gentle', persisted. Defaults to 'full' unless the OS asks for reduced motion, in which case 'gentle'
 * (shorter, smaller, but still animated). A stored choice always wins, so the user can force full motion.
 */
export function useMotion() {
  const [mode, setMode] = useState<MotionMode>(defaultMotion);

  // Follow OS changes only while the user has not made an explicit choice.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => { if (!readStoredMotion()) setMode(mq.matches ? 'gentle' : 'full'); };
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const toggle = useCallback(() => {
    setMode((m) => { const n: MotionMode = m === 'full' ? 'gentle' : 'full'; storeMotion(n); return n; });
  }, []);

  return { mode, gentle: mode === 'gentle', k: mode === 'gentle' ? GENTLE_K : 1, toggle };
}
