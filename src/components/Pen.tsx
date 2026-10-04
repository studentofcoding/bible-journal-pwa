import type { Ref } from 'react';

interface PenProps {
  penRef?: Ref<HTMLDivElement>;
  /** True while the user is typing: the nib scribbles. */
  writing: boolean;
}

/**
 * A fountain pen drawn in SVG. Its nib sits at the element origin and the barrel extends along +x,
 * so `translate(x, y) rotate(r)` places the *tip* in world space. The CameraRig writes that transform every
 * frame, so the pen travels with exactly the same easing and duration as the camera and journal.
 */
export function Pen({ writing, penRef }: PenProps) {
  return (
    <div className="pen" ref={penRef} data-writing={writing} aria-hidden="true">
      <svg className="pen-svg" viewBox="0 -16 372 32" width="372" height="32">
        <defs>
          <linearGradient id="pen-barrel" x1="0" y1="-1" x2="0" y2="1">
            <stop offset="0" stopColor="#9a3b2c" />
            <stop offset=".45" stopColor="#6a1f18" />
            <stop offset="1" stopColor="#2e0c09" />
          </linearGradient>
          <linearGradient id="pen-grip" x1="0" y1="-1" x2="0" y2="1">
            <stop offset="0" stopColor="#3b3b3d" />
            <stop offset="1" stopColor="#0f0f10" />
          </linearGradient>
          <linearGradient id="pen-gold" x1="0" y1="-1" x2="0" y2="1">
            <stop offset="0" stopColor="#f3dc9a" />
            <stop offset=".5" stopColor="#c99a3c" />
            <stop offset="1" stopColor="#8a6420" />
          </linearGradient>
        </defs>
        {/* pre-rendered cast shadow (a static shape; replaces a per-frame CSS drop-shadow filter) */}
        <g transform="translate(5 9)" fill="#000" opacity=".3">
          <path d="M0 0 L46 -7.5 Q52 -8 52 0 Q52 8 46 7.5 Z" />
          <rect x="52" y="-9" width="64" height="18" />
          <rect x="116" y="-12" width="232" height="24" rx="11" />
          <path d="M346 -11 Q372 -11 372 0 Q372 11 346 11 Z" />
        </g>
        <g className="pen-body">
          {/* nib */}
          <path d="M0 0 L46 -7.5 Q52 -8 52 0 Q52 8 46 7.5 Z" fill="url(#pen-gold)" stroke="#6b4c18" strokeWidth=".8" />
          <path d="M3 0 H40" stroke="#6b4c18" strokeWidth=".9" />
          <circle cx="30" cy="0" r="1.6" fill="#6b4c18" />
          {/* grip */}
          <path d="M52 -8.5 H112 Q116 -8.5 116 -10 V10 Q116 8.5 112 8.5 H52 Z" fill="url(#pen-grip)" />
          <rect x="116" y="-11" width="6" height="22" rx="1.5" fill="url(#pen-gold)" />
          {/* barrel */}
          <rect x="122" y="-12" width="226" height="24" rx="11" fill="url(#pen-barrel)" />
          <rect x="132" y="-8" width="190" height="3.5" rx="1.75" fill="#fff" opacity=".22" />
          <rect x="262" y="-12.5" width="5" height="25" fill="url(#pen-gold)" />
          <rect x="274" y="-12.5" width="2.5" height="25" fill="url(#pen-gold)" />
          {/* clip */}
          <path d="M214 -12 H300 Q306 -12 306 -15 Q306 -16 300 -16 H212 Z" fill="url(#pen-gold)" />
          {/* cap end */}
          <path d="M346 -11 Q372 -11 372 0 Q372 11 346 11 Z" fill="url(#pen-gold)" />
        </g>
      </svg>
    </div>
  );
}
