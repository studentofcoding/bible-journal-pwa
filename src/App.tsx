import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Hud } from './components/Hud';
import { Journal, type TurnApi } from './components/Journal';
import { Landing } from './components/Landing';
import { Pen } from './components/Pen';
import { COVER_MS, FLIP_MS, RESIZE_MS, SCENE_MS, useCamera, type Scene } from './hooks/useCamera';
import { useMotion } from './hooks/useMotion';
import { CameraRig } from './lib/rig';
import { useJournalStore } from './hooks/useJournalStore';
import { usePageNav } from './hooks/usePageNav';
import { verseOfTheDay } from './lib/verses';

// Floating dust motes in the window light (landing, full motion only). Opacity/transform keyframes only.
const DUST = Array.from({ length: 14 }, (_, i) => ({
  x: (i * 37 + 11) % 97, y: (i * 53 + 17) % 91, s: 2 + (i % 3), t: 9 + (i % 5) * 2.2, d: -((i * 1.7) % 9)
}));

export default function App() {
  const store = useJournalStore();
  const { entries } = store;
  const N = entries.length;
  const verse = useMemo(() => verseOfTheDay(), []);

  const [scene, setScene] = useState<Scene>('landing');
  const [page, setPage] = useState(() => store.lastPage);
  const [caretY, setCaretY] = useState(0);
  const [typing, setTyping] = useState(false);

  const motion = useMotion();
  const { k, gentle } = motion;
  const cam = useCamera(scene, page, caretY, gentle);
  const stageRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const penRef = useRef<HTMLDivElement>(null);
  const turnRef = useRef<TurnApi | null>(null);
  const flipMs = Math.round(FLIP_MS * k);
  const coverMs = Math.round(COVER_MS * k);

  // ---- camera: ONE state object tweened by the rig and written as transforms (no React renders per frame)
  const rigRef = useRef<CameraRig | null>(null);
  const targetRef = useRef(cam.target);
  targetRef.current = cam.target;
  useLayoutEffect(() => {
    const rig = new CameraRig({ camera: cameraRef.current!, tilt: tiltRef.current!, pen: penRef.current! }, targetRef.current);
    rigRef.current = rig;
    return () => { rig.destroy(); rigRef.current = null; };
  }, []);
  const lastScene = useRef(scene);
  useEffect(() => {
    const rig = rigRef.current;
    if (!rig) return;
    const sceneChanged = lastScene.current !== scene;
    lastScene.current = scene;
    const ms = sceneChanged ? SCENE_MS[scene] * k : (RESIZE_MS + (scene === 'writing' ? 160 : 0)) * (gentle ? 0.8 : 1);
    rig.to(cam.target, ms);
  }, [cam.target, scene, k, gentle]);
  useEffect(() => { rigRef.current?.setIdle(scene === 'landing' && !gentle); }, [scene, gentle]);
  const onLift = useCallback((v: number) => rigRef.current?.setLift(v * (gentle ? 0.5 : 1)), [gentle]);

  // ---- scene flow: landing -> opening (cover swings, camera pulls in) -> writing (close-up)
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  const openJournal = useCallback(() => {
    if (scene !== 'landing') return;
    timers.current.forEach(window.clearTimeout);
    setScene('opening');
    later(() => setScene('writing'), gentle ? coverMs + 120 : SCENE_MS.opening + 150);
  }, [scene, gentle, coverMs]);

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
  const canGo = useCallback((dir: 1 | -1) => (dir > 0 ? canNext : canPrev), [canNext, canPrev]);
  usePageNav({ enabled: scene === 'writing', target: stageRef, turn: turnRef, canGo, onPrev: prev, onNext: next });

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
      data-motion={motion.mode}
      data-effective-font={cam.effectiveFontPx.toFixed(1)}
    >
      <div className="camera" ref={cameraRef}>
        <div className="desk" aria-hidden="true"><div className="blotter" /></div>
        <div className="tilt" ref={tiltRef}>
          <Journal
            scene={scene}
            mode={cam.mode}
            entries={entries}
            page={page}
            verse={verse}
            flipMs={flipMs}
            coverMs={coverMs}
            turnRef={turnRef}
            onLift={onLift}
            onOpen={openJournal}
            onChange={store.updateEntry}
            onActivate={activate}
            onAdd={addPage}
            onCaret={setCaretY}
            onTyping={onTyping}
          />
          <Pen penRef={penRef} writing={typing && scene === 'writing'} />
        </div>
      </div>
      <div className="light" aria-hidden="true" />
      <div className="atmos" aria-hidden="true">
        <i className="shaft" />
        {DUST.map((d, i) => (
          <i key={i} className="mote" style={{ left: `${d.x}%`, top: `${d.y}%`, width: d.s, height: d.s, animationDuration: `${d.t}s`, animationDelay: `${d.d}s` }} />
        ))}
      </div>
      <Landing visible={scene === 'landing'} verse={verse} onOpen={openJournal} motion={motion.mode} onToggleMotion={motion.toggle} />
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
        motion={motion.mode}
        onToggleMotion={motion.toggle}
      />
    </div>
  );
}
