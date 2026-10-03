import type { Verse } from '../lib/verses';

/** Front of the leather cover (what the desk shows while the journal is closed). */
export function CoverFront() {
  return (
    <div className="cover-front">
      <div className="cover-spine" />
      <div className="cover-stitch" />
      <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
      <div className="cover-emblem">
        <svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">
          <g fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="60" cy="60" r="52" />
            <circle cx="60" cy="60" r="46" strokeDasharray="1.5 5" strokeLinecap="round" />
          </g>
          <path fill="currentColor" d="M54 22h12v26h26v12H66v40H54V60H28V48h26z" />
        </svg>
      </div>
      <h2 className="cover-title">Holy Bible<br />Journal</h2>
      <p className="cover-sub">Verba · Vita · Lux</p>
    </div>
  );
}

/** Inside of the front cover: leather board with an endpaper that carries the verse of the day. */
export function CoverInside({ verse }: { verse: Verse }) {
  return (
    <div className="cover-inside">
      <div className="endpaper">
        <p className="endpaper-label">Verse of the day</p>
        <blockquote className="endpaper-verse">{verse.text}</blockquote>
        <p className="endpaper-ref">— {verse.ref} <span>KJV</span></p>
        <div className="endpaper-orn" aria-hidden="true">✠</div>
        <p className="endpaper-note">Read slowly. Write what you notice, what you wonder, and how you will live it today.</p>
      </div>
    </div>
  );
}
