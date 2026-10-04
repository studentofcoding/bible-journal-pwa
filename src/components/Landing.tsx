import type { Verse } from '../lib/verses';
import type { MotionMode } from '../lib/motion';
import { MotionToggle } from './MotionToggle';

interface LandingProps {
  visible: boolean;
  verse: Verse;
  onOpen: () => void;
  motion: MotionMode;
  onToggleMotion: () => void;
}

/** Landing copy + call to action. Positioned in the margin the camera leaves free (see --safe-* vars). */
export function Landing({ visible, verse, onOpen, motion, onToggleMotion }: LandingProps) {
  return (
    <section className="landing" data-visible={visible} aria-hidden={!visible} inert={!visible}>
      <div className="landing-copy">
        <p className="eyebrow">A study journal</p>
        <h1>My Bible Journal</h1>
        <p className="tagline">A quiet place for Scripture and reflection.</p>
        <figure className="votd">
          <figcaption>Verse of the day</figcaption>
          <blockquote>“{verse.text}”</blockquote>
          <cite>{verse.ref} · KJV</cite>
        </figure>
      </div>
      <div className="landing-action">
        <button type="button" className="btn-primary" onClick={onOpen}>Open journal</button>
        <p className="hint">Works offline · saved on this device</p>
        <MotionToggle mode={motion} onToggle={onToggleMotion} />
      </div>
    </section>
  );
}
