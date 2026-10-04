import type { MotionMode } from '../lib/motion';

/** Tiny "Motion: full / reduced" switch. 'reduced' is the app's gentle mode (shorter, still animated). */
export function MotionToggle({ mode, onToggle }: { mode: MotionMode; onToggle: () => void }) {
  const full = mode === 'full';
  return (
    <button
      type="button"
      className="motion-toggle"
      onClick={onToggle}
      aria-pressed={!full}
      aria-label={`Motion: ${full ? 'full' : 'reduced'}. Activate to switch to ${full ? 'reduced' : 'full'} motion.`}
    >
      Motion: <b>{full ? 'full' : 'reduced'}</b>
    </button>
  );
}
