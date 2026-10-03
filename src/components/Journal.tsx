import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
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
  onOpen: () => void;
  onChange: (index: number, patch: { ref?: string; text?: string }) => void;
  onActivate: (index: number) => void;
  onAdd: () => void;
  onCaret: (y: number) => void;
  onTyping: () => void;
}

/** How many leaves (flipped count) the book shows for the active page. */
export const flippedFor = (mode: PageMode, page: number) => (mode === 'spread' ? Math.ceil(page / 2) : page);

/**
 * The book is a fixed 3:2 box (two 3:4 pages). Every leaf hinges on the spine (left edge of the
 * right half) and rotates by `--flip` * -180deg; the cover is simply leaf -1. A leaf's front is a
 * right-hand page and its back is the following left-hand page. In `single` mode (phones) a leaf's
 * back is blank paper and the camera crops onto the right half, so the page still turns on the same hinge.
 */
export function Journal(props: JournalProps) {
  const { scene, mode, entries, page, verse, flipMs, onOpen, onChange, onActivate, onAdd, onCaret, onTyping } = props;
  const open = scene !== 'landing';
  const N = entries.length;
  const leafCount = mode === 'spread' ? Math.floor(N / 2) + 1 : N;
  const flipped = open ? flippedFor(mode, page) : 0;

  // Leaves currently turning get the top of the stack (z-index) and a shading animation.
  const prev = useRef(flipped);
  const [moving, setMoving] = useState<number[]>([]);
  useLayoutEffect(() => {
    const before = prev.current;
    prev.current = flipped;
    if (before === flipped || flipMs === 0) return;
    const lo = Math.min(before, flipped);
    const hi = Math.max(before, flipped);
    const ids: number[] = [];
    for (let j = lo; j < hi; j++) ids.push(j);
    setMoving((m) => [...m, ...ids]);
    window.setTimeout(() => setMoving((m) => m.filter((j) => !ids.includes(j))), flipMs + 100);
  }, [flipped, flipMs]);

  // The cover stays on top of the stack for the whole swing, then settles to its resting z-index.
  const prevOpen = useRef(open);
  const [coverMoving, setCoverMoving] = useState(false);
  useLayoutEffect(() => {
    if (prevOpen.current === open) return;
    prevOpen.current = open;
    setCoverMoving(true);
    const t = window.setTimeout(() => setCoverMoving(false), 1700);
    return () => window.clearTimeout(t);
  }, [open]);

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

  const leaves = Array.from({ length: leafCount }, (_, j) => {
    const isFlipped = j < flipped;
    const frontIdx = mode === 'spread' ? 2 * j : j;
    const backIdx = mode === 'spread' ? 2 * j + 1 : -1;
    const isMoving = moving.includes(j);
    const frontVisible = open && !isFlipped && visible.has(frontIdx);
    const backVisible = open && isFlipped && backIdx >= 0 && visible.has(backIdx);
    return (
      <div
        key={j}
        className={`leaf${isMoving ? ' moving' : ''}`}
        style={{ '--flip': isFlipped ? 1 : 0, zIndex: isMoving ? 1000 : isFlipped ? 10 + j : 10 + leafCount - j } as CSSProperties}
      >
        <div className="face front" inert={!frontVisible} aria-hidden={!frontVisible}>
          {renderPage(frontIdx, 'right', j)}
        </div>
        <div className="face back" inert={!backVisible} aria-hidden={!backVisible}>
          {backIdx >= 0 ? renderPage(backIdx, 'left', j) : <div className="page blank reverse left" />}
        </div>
      </div>
    );
  });

  return (
    <div className="journal" data-open={open} data-mode={mode}>
      <div className="book">
        <div className="shadow shadow-right" />
        <div className="shadow shadow-left" />
        <div className="back-board" />
        <div className="page-block" />
        <div className="ribbon" aria-hidden="true" />
        {leaves}
        <div
          className="leaf cover"
          style={{ '--flip': open ? 1 : 0, zIndex: coverMoving ? 1000 : open ? 5 : 10 + leafCount + 2 } as CSSProperties}
        >
          <div
            className="face front"
            role={open ? undefined : 'button'}
            tabIndex={open ? -1 : 0}
            aria-label={open ? undefined : 'Open journal'}
            onClick={open ? undefined : onOpen}
            onKeyDown={open ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
          >
            <CoverFront />
          </div>
          <div className="face back" aria-hidden={!open}>
            <CoverInside verse={verse} />
          </div>
        </div>
      </div>
      <datalist id="verse-suggestions">{VERSES.map((v) => <option key={v.ref} value={v.ref} />)}</datalist>
    </div>
  );
}
