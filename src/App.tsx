import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Hud } from './components/Hud';
import { Journal } from './components/Journal';
import { Landing } from './components/Landing';
import { Pen } from './components/Pen';
import { SCENE_MS, useCamera, type Scene } from './hooks/useCamera';
import { useJournalStore } from './hooks/useJournalStore';
import { usePageNav } from './hooks/usePageNav';
import { verseOfTheDay } from './lib/verses';

export default function App() {
  const store = useJournalStore();
  const { entries } = store;
  const N = entries.length;
  const verse = useMemo(() => verseOfTheDay(), []);

  const [scene, setScene] = useState<Scene>('landing');
  const [page, setPage] = useState(() => store.lastPage);
  const [caretY, setCaretY] = useState(0);
  const [typing, setTyping] = useState(false);

  const cam = useCamera(scene, page, caretY);
  const stageRef = useRef<HTMLDivElement>(null);

  // ---- scene flow: landing -> opening (cover swings, camera pulls in) -> writing (close-up)
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  const openJournal = useCallback(() => {
    if (scene !== 'landing') return;
    timers.current.forEach(window.clearTimeout);
    setScene('opening');
    later(() => setScene('writing'), cam.reduced ? 60 : SCENE_MS.opening + 150);
  }, [scene, cam.reduced]);

  const closeJournal = useCallback(() => {
    timers.current.forEach(window.clearTimeout);
    (document.activeElement as HTMLElement | null)?.blur?.();
    setScene('landing');
  }, []);

  // ---- page navigation. Spread mode moves by spread, single mode by page.
  const sMax = Math.ceil((N - 1) / 2);
  const spread = Math.ceil(page / 2);
  const single = cam.mode === 'single';
  const canPrev = single ? page > 0 : spread > 0;
  const canNext = single ? page < N - 1 : spread < sMax;

  const go = useCallback((dir: 1 | -1) => {
    if (scene !== 'writing') return;
    if (single) {
      setPage((p) => Math.min(N - 1, Math.max(0, p + dir)));
    } else {
      setPage((p) => {
        const s = Math.min(sMax, Math.max(0, Math.ceil(p / 2) + dir));
        return 2 * s < N ? 2 * s : N - 1;
      });
    }
    setCaretY(0);
  }, [scene, single, N, sMax]);
  const prev = useCallback(() => go(-1), [go]);
  const next = useCallback(() => go(1), [go]);
  usePageNav({ enabled: scene === 'writing', target: stageRef, onPrev: prev, onNext: next });

  const addPage = useCallback(() => {
    const idx = store.addEntry();
    setPage(idx);
    setCaretY(0);
    window.setTimeout(() => {
      document.querySelector<HTMLInputElement>(`[data-page="${idx}"] .page-ref`)?.focus({ preventScroll: true });
    }, 650);
  }, [store]);

  // Remember where the reader was.
  useEffect(() => { if (scene === 'writing') store.setLastPage(page); }, [scene, page, store]);

  // Typing makes the pen scribble for a moment.
  const typingTimer = useRef<number | undefined>(undefined);
  const onTyping = useCallback(() => {
    setTyping(true);
    window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => setTyping(false), 700);
  }, []);

  // Clicking/focusing a page makes it the active one (the pen follows).
  const activate = useCallback((i: number) => setPage((p) => (p === i ? p : i)), []);

  return (
    <div
      ref={stageRef}
      className="stage"
      style={cam.vars}
      data-scene={scene}
      data-bp={cam.bp}
      data-mode={cam.mode}
      data-layout={cam.layout}
      data-effective-font={cam.effectiveFontPx.toFixed(1)}
    >
      <div className="camera">
        <div className="desk" aria-hidden="true"><div className="blotter" /></div>
        <div className="tilt">
          <Journal
            scene={scene}
            mode={cam.mode}
            entries={entries}
            page={page}
            verse={verse}
            flipMs={cam.flipMs}
            onOpen={openJournal}
            onChange={store.updateEntry}
            onActivate={activate}
            onAdd={addPage}
            onCaret={setCaretY}
            onTyping={onTyping}
          />
          <Pen writing={typing && scene === 'writing'} />
        </div>
      </div>
      <div className="light" aria-hidden="true" />
      <Landing visible={scene === 'landing'} verse={verse} onOpen={openJournal} />
      <Hud
        visible={scene === 'writing'}
        mode={cam.mode}
        page={page}
        total={N}
        canPrev={canPrev}
        canNext={canNext}
        onPrev={prev}
        onNext={next}
        onAdd={addPage}
        onClose={closeJournal}
      />
    </div>
  );
}
