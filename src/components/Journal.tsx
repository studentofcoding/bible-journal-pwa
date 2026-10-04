import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { LeafMotion } from '../lib/leaves';
import type { Entry } from '../hooks/useJournalStore';
import type { PageMode, Scene } from '../hooks/useCamera';
import { VERSES, type Verse } from '../lib/verses';
import { CoverFront, CoverInside } from './Cover';
import { BlankPage, Page, type PageSide } from './Page';

interface JournalProps {
  scene: Scene;
  mode: PageMode;
  entries: Entry[];
  /** Active page (entry index). */
  page: number;
  verse: Verse;
  flipMs: number;
  coverMs: number;
  turnRef: RefObject<TurnApi | null>;
  onLift?: (lift: number) => void;
  onOpen: () => void;
  onChange: (index: number, patch: { ref?: string; text?: string }) => void;
  onActivate: (index: number) => void;
  onAdd: () => void;
  onCaret: (y: number) => void;
  onTyping: () => void;
}

/** How many leaves (flipped count) the book shows for the active page. */
export const flippedFor = (mode: PageMode, page: number) => (mode === 'spread' ? Math.ceil(page / 2) : page);

export interface TurnApi {
  /** Start a finger drag turning one leaf in direction dir (+1 next, -1 previous). false if nothing to turn. */
  begin: (dir: 1 | -1) => boolean;
  /** t = 0..1: how far the leaf has been dragged towards its destination. */
  set: (t: number) => void;
  /** Finger lifted. commit=false springs the leaf back; commit=true leaves it where it is for the caller to turn (go()). */
  release: (commit: boolean) => void;
  /** Length of a full drag, in screen px (about the width of one page as seen through the camera). */
  distance: () => number;
}

/**
 * The book is a fixed 3:2 box (two 3:4 pages). Every leaf hinges on the spine (left edge of the
 * right half) and rotates by progress * -180deg (see lib/leaves.ts); the cover is simply leaf -1. A leaf's front is a
 * right-hand page and its back is the following left-hand page. In `single` mode (phones) a leaf's
 * back is blank paper and the camera crops onto the right half, so the page still turns on the same hinge.
 */
export function Journal(props: JournalProps) {
  const { scene, mode, entries, page, verse, flipMs, coverMs, onOpen, onChange, onActivate, onAdd, onCaret, onTyping, turnRef, onLift } = props;
  const open = scene !== 'landing';
  const N = entries.length;
  const leafCount = mode === 'spread' ? Math.floor(N / 2) + 1 : N;
  const flipped = open ? flippedFor(mode, page) : 0;

  // ---- motion: leaves are driven imperatively (see lib/leaves.ts); React only decides *targets*.
  const motion = useRef<LeafMotion | null>(null);
  if (!motion.current) motion.current = new LeafMotion();
  const lm = motion.current;
  const liftCb = useRef(onLift);
  liftCb.current = onLift;
  useEffect(() => { lm.onLift = (v) => liftCb.current?.(v); return () => lm.destroy(); }, [lm]);

  const prevMode = useRef(mode);
  const prevOpen = useRef(open);
  const flippedRef = useRef(flipped);
  flippedRef.current = flipped;
  const leafCountRef = useRef(leafCount);
  leafCountRef.current = leafCount;
  const msRef = useRef({ flipMs, coverMs });
  msRef.current = { flipMs, coverMs };

  useLayoutEffect(() => {
    const modeChanged = prevMode.current !== mode;
    const openChanged = prevOpen.current !== open;
    prevMode.current = mode;
    prevOpen.current = open;
    const base = openChanged ? coverMs : flipMs;
    const sync = (id: string, target: 0 | 1, restZ: number, ms: number) => {
      lm.setRestZ(id, restZ);
      if (!lm.has(id) || modeChanged) { lm.place(id, target); lm.settle(id); return; }
      if (lm.goal(id) === target) return;
      const dist = Math.abs(target - lm.get(id));
      lm.animate(id, target, ms * (0.4 + 0.6 * dist));
    };
    for (let j = 0; j < leafCount; j++) {
      const t = j < flipped ? 1 : 0;
      sync(`l${j}`, t, t ? 10 + j : 10 + leafCount - j, base);
    }
    sync('cover', open ? 1 : 0, open ? 5 : 10 + leafCount + 2, coverMs);
  }, [lm, open, flipped, mode, leafCount, flipMs, coverMs]);

  // ---- finger-driven page turn (usePageNav calls this)
  const drag = useRef<{ id: string; dir: 1 | -1; origin: 0 | 1 } | null>(null);
  const bookRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    turnRef.current = {
      begin: (dir) => {
        const j = dir > 0 ? flippedRef.current : flippedRef.current - 1;
        if (j < 0 || j >= leafCountRef.current) return false;
        const id = `l${j}`;
        drag.current = { id, dir, origin: dir > 0 ? 0 : 1 };
        lm.grab(id);
        return true;
      },
      set: (t) => {
        const d = drag.current;
        if (!d) return;
        const k = Math.min(1, Math.max(0, t));
        lm.place(d.id, d.dir > 0 ? k : 1 - k);
      },
      release: (commit) => {
        const d = drag.current;
        drag.current = null;
        if (!d) return;
        lm.drop(d.id);
        if (!commit) {
          lm.animate(d.id, d.origin, msRef.current.flipMs * (0.35 + 0.65 * Math.abs(lm.get(d.id) - d.origin)));
        } else {
          // React is about to retarget this leaf (go()); if that somehow doesn't happen, finish the turn ourselves.
          window.setTimeout(() => {
            const p = lm.get(d.id);
            if (!lm.animating(d.id) && p !== 0 && p !== 1) lm.animate(d.id, Math.round(p), msRef.current.flipMs * 0.5);
          }, 90);
        }
      },
      distance: () => {
        const r = bookRef.current?.getBoundingClientRect();
        const pageW = r ? r.width / 2 : 400;
        return Math.max(200, Math.min(pageW * 1.5, window.innerWidth * 0.85));
      }
    };
    return () => { turnRef.current = null; };
  }, [lm, turnRef]);

  // The left-hand drop shadow fades in half-way through the cover swing (fixed-length opacity fade, no layout).
  const shadowDelay = `${Math.round(coverMs * 0.5)}ms`;

  const visible = new Set<number>(mode === 'spread' ? [2 * flipped - 1, 2 * flipped] : [page]);

  const renderPage = (index: number, side: PageSide, leaf: number) => {
    const isVisible = open && visible.has(index);
    const near = Math.abs(leaf - flipped) <= 2;
    let body;
    if (index >= N) {
      body = <BlankPage index={index} side={side} onAdd={index === N && isVisible ? onAdd : undefined} />;
    } else if (!near) {
      body = <article className={`page stub ${side}`}><header className="page-head"><span className="page-no">№ {index + 1}</span></header></article>;
    } else {
      body = <Page entry={entries[index]} index={index} side={side} onChange={onChange} onActivate={onActivate} onCaret={onCaret} onTyping={onTyping} />;
    }
    return body;
  };

  const leafRef = (id: string) => (el: HTMLDivElement | null) => {
    if (!el) return;
    lm.register(id, el);
    return () => lm.unregister(id, el);
  };

  const leaves = Array.from({ length: leafCount }, (_, j) => {
    const isFlipped = j < flipped;
    const frontIdx = mode === 'spread' ? 2 * j : j;
    const backIdx = mode === 'spread' ? 2 * j + 1 : -1;
    const frontVisible = open && !isFlipped && visible.has(frontIdx);
    const backVisible = open && isFlipped && backIdx >= 0 && visible.has(backIdx);
    return (
      <div key={j} className="leaf" ref={leafRef(`l${j}`)}>
        <div className="face front" inert={!frontVisible} aria-hidden={!frontVisible}>
          {renderPage(frontIdx, 'right', j)}
          <i className="shade" />
        </div>
        <div className="face back" inert={!backVisible} aria-hidden={!backVisible}>
          {backIdx >= 0 ? renderPage(backIdx, 'left', j) : <div className="page blank reverse left" />}
          <i className="shade" />
        </div>
      </div>
    );
  });

  return (
    <div className="journal" data-open={open} data-mode={mode}>
      <div className="book" ref={bookRef}>
        <div className="shadow shadow-right" />
        <div className="shadow shadow-left" style={{ transitionDelay: open ? shadowDelay : '0ms' }} />
        <div className="back-board" />
        <div className="page-block" />
        <div className="ribbon" aria-hidden="true" />
        {leaves}
        <div className="leaf cover" ref={leafRef('cover')}>
          <div
            className="face front"
            role={open ? undefined : 'button'}
            tabIndex={open ? -1 : 0}
            aria-label={open ? undefined : 'Open journal'}
            onClick={open ? undefined : onOpen}
            onKeyDown={open ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
          >
            <CoverFront />
            <i className="shade" />
          </div>
          <div className="face back" aria-hidden={!open}>
            <CoverInside verse={verse} />
            <i className="shade" />
          </div>
        </div>
      </div>
      <datalist id="verse-suggestions">{VERSES.map((v) => <option key={v.ref} value={v.ref} />)}</datalist>
    </div>
  );
}
