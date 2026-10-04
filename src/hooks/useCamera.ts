import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { CamState } from '../lib/rig';

/**
 * Camera model
 * ------------
 * The whole scene lives in one "world" measured in design pixels. The open journal is a fixed
 * 3:2 box (two 600x800 pages) whose centre is the world origin; the closed cover occupies the
 * right half (x: 0..600). The camera is nothing more than three numbers (scale, x, y) plus a
 * book tilt and a pen pose. They are derived from (scene, breakpoint, page mode, caret) and
 * handed to the CameraRig (src/lib/rig.ts), which interpolates ONE state object in a rAF loop and
 * writes it straight to the camera / tilt / pen transforms (no React renders, no CSS-variable
 * transitions - those are unreliable on iOS Safari). Camera, journal tilt and pen therefore share
 * exactly the same animated numbers.
 */

export const PAGE_W = 600;
export const PAGE_H = 800;

export type Scene = 'landing' | 'opening' | 'writing';
export type Breakpoint = 'desktop' | 'tablet' | 'phone' | 'phoneLandscape';
/** spread = two pages visible (desktop/tablet), single = camera is cropped onto one page (phones). */
export type PageMode = 'spread' | 'single';
export type Layout = 'side' | 'stack';

interface Rect { x0: number; y0: number; x1: number; y1: number }
interface Insets { t: number; r: number; b: number; l: number }
export interface PenPose { x: number; y: number; rot: number }

interface Frame {
  /** World rectangle that must be framed. */
  focus: Rect;
  /** Screen margins (px) kept free for HUD / landing copy; the focus is fitted in what remains. */
  insets: Insets;
  tiltX: number;
  tiltZ: number;
  pen: PenPose;
  /** Upper bound for scale (used where the page would otherwise be blown up too much). */
  maxScale?: number;
  /** Crop vertically and let the camera follow the caret instead of fitting the whole page. */
  followCaret?: boolean;
}

export interface CameraInput {
  vw: number;
  vh: number;
  bp: Breakpoint;
  scene: Scene;
  /** Active page (entry) index. */
  page: number;
  /** Caret offset from the top of the active page, in design px. */
  caretY: number;
}

export interface CameraState {
  bp: Breakpoint;
  mode: PageMode;
  layout: Layout;
  scale: number;
  x: number;
  y: number;
  fontPx: number;
  lineHeight: number;
  /** font size as the user sees it on screen. */
  effectiveFontPx: number;
  insets: Insets;
}

const px = (n: number) => `${Math.round(n * 100) / 100}px`;
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

export const modeFor = (bp: Breakpoint): PageMode => (bp === 'phone' || bp === 'phoneLandscape' ? 'single' : 'spread');

export function layoutFor(bp: Breakpoint, vw: number, vh: number): Layout {
  if (bp === 'desktop' || bp === 'phoneLandscape') return 'side';
  if (bp === 'tablet' && vw > vh * 1.1) return 'side';
  return 'stack';
}

const HUD_TOP = 64;
const HUD_BOTTOM = 104;
/** Target on-screen size for body text, per breakpoint (page text never drops below 0.9em of this). */
const TARGET_FONT: Record<Breakpoint, number> = { desktop: 19, tablet: 19, phone: 18, phoneLandscape: 18 };

function frame(bp: Breakpoint, scene: Scene, vw: number, vh: number, page: number): Frame {
  const layout = layoutFor(bp, vw, vh);
  const side = layout === 'side';
  const activeX = modeFor(bp) === 'spread' && page % 2 === 1 ? -PAGE_W / 2 : PAGE_W / 2;

  // ---------------------------------------------------------------- landing: closed journal on the desk
  if (scene === 'landing') {
    if (side) {
      const wide = bp !== 'phoneLandscape';
      return {
        focus: { x0: -20, y0: -425, x1: wide ? 860 : 840, y1: 425 },
        insets: { l: vw * (bp === 'phoneLandscape' ? 0.5 : 0.42), r: vw * 0.03, t: vh * 0.06, b: vh * 0.06 },
        tiltX: 12, tiltZ: -3,
        pen: { x: 735, y: 300, rot: -98 }
      };
    }
    if (bp === 'tablet') {
      return {
        focus: { x0: -20, y0: -425, x1: 745, y1: 425 },
        insets: { l: vw * 0.04, r: vw * 0.04, t: vh * 0.3, b: vh * 0.16 },
        tiltX: 12, tiltZ: -3,
        pen: { x: 680, y: 290, rot: -98 }
      };
    }
    const short = vh < 720; // compact copy on short phones (see scene.css), so the camera leaves a bit more room
    return { // phone portrait: cover fills ~85% of the width, pen stands against its right edge
      focus: { x0: -10, y0: -425, x1: 672, y1: 425 },
      insets: { l: vw * 0.03, r: vw * 0.03, t: vh * (short ? 0.34 : 0.31), b: vh * (short ? 0.16 : 0.15) },
      tiltX: 10, tiltZ: -2,
      pen: { x: 650, y: 280, rot: -96 }
    };
  }

  // ---------------------------------------------------------------- opening: cover swings, camera pulls in
  if (scene === 'opening') {
    if (bp === 'desktop') {
      return { focus: { x0: -650, y0: -440, x1: 740, y1: 440 }, insets: { l: vw * 0.03, r: vw * 0.03, t: 56, b: 80 }, tiltX: 6, tiltZ: 0, pen: { x: 700, y: 330, rot: -104 } };
    }
    if (bp === 'tablet') {
      return { focus: { x0: -640, y0: -440, x1: 700, y1: 440 }, insets: { l: vw * 0.02, r: vw * 0.02, t: 56, b: 90 }, tiltX: 6, tiltZ: 0, pen: { x: 660, y: 320, rot: -104 } };
    }
    if (bp === 'phone') {
      return { focus: { x0: -110, y0: -440, x1: 700, y1: 440 }, insets: { l: 0, r: 0, t: 60, b: 90 }, tiltX: 6, tiltZ: 0, pen: { x: 660, y: 330, rot: -100 } };
    }
    return { focus: { x0: -110, y0: -440, x1: 700, y1: 440 }, insets: { l: 0, r: 0, t: 8, b: 8 }, tiltX: 0, tiltZ: 0, pen: { x: 660, y: 330, rot: -100 } };
  }

  // ---------------------------------------------------------------- writing: close-up of the active page(s)
  if (bp === 'desktop') {
    return {
      focus: { x0: -610, y0: -400, x1: 610, y1: 400 },
      insets: { l: vw * 0.02, r: vw * 0.02, t: HUD_TOP, b: HUD_BOTTOM },
      tiltX: 0, tiltZ: 0,
      pen: { x: activeX + 90, y: 352, rot: 22 }
    };
  }
  if (bp === 'tablet') { // closer than desktop: the outer 24px of each page margin is cropped off-screen
    return {
      focus: { x0: -576, y0: -400, x1: 576, y1: 400 },
      insets: { l: 0, r: 0, t: HUD_TOP, b: HUD_BOTTOM },
      tiltX: 0, tiltZ: 0,
      pen: { x: activeX + 90, y: 352, rot: 22 }
    };
  }
  if (bp === 'phone') { // single page, margins trimmed, page fills the screen width
    return {
      focus: { x0: 30, y0: -400, x1: 570, y1: 400 },
      insets: { l: 0, r: 0, t: HUD_TOP, b: HUD_BOTTOM },
      tiltX: 0, tiltZ: 0,
      pen: { x: 372, y: 352, rot: 52 },
      followCaret: true // only matters when the keyboard shrinks the viewport: crop + follow instead of shrinking the page
    };
  }
  return { // landscape phone: single page, cropped vertically, camera follows the caret
    focus: { x0: 30, y0: -400, x1: 570, y1: 400 },
    insets: { l: 84, r: 84, t: 44, b: 0 },
    tiltX: 0, tiltZ: 0,
    pen: { x: 520, y: 0, rot: 32 },
    maxScale: 0.95,
    followCaret: true
  };
}

function fit(f: Frame, vw: number, vh: number, caretY: number) {
  const safeW = Math.max(120, vw - f.insets.l - f.insets.r);
  const safeH = Math.max(120, vh - f.insets.t - f.insets.b);
  const fw = f.focus.x1 - f.focus.x0;
  const fh = f.focus.y1 - f.focus.y0;
  let scale = f.followCaret ? safeW / fw : Math.min(safeW / fw, safeH / fh);
  if (f.maxScale) scale = Math.min(scale, f.maxScale);
  let fcx = (f.focus.x0 + f.focus.x1) / 2;
  let fcy = (f.focus.y0 + f.focus.y1) / 2;
  let penY = f.pen.y;
  if (f.followCaret) {
    const visibleH = safeH / scale;
    if (visibleH < PAGE_H) {
      const caretWorld = -PAGE_H / 2 + caretY;
      fcy = clamp(caretWorld + visibleH * 0.2, -PAGE_H / 2 + visibleH / 2, PAGE_H / 2 - visibleH / 2);
      penY = fcy + visibleH / 2 - 56; // pen tip rides along the bottom edge of what the camera shows
    } else {
      fcy = 0;
    }
  }
  const safeCx = (f.insets.l - f.insets.r) / 2;
  const safeCy = (f.insets.t - f.insets.b) / 2;
  return { scale, x: safeCx - fcx * scale, y: safeCy - fcy * scale, penY };
}

export function computeCamera(input: CameraInput): CameraState & { pen: PenPose; tiltX: number; tiltZ: number } {
  const { vw, vh, bp, scene, page, caretY } = input;
  // Font size is derived from the *writing* framing so it is stable across scene changes.
  const w = frame(bp, 'writing', vw, vh, page);
  const wFit = fit(w, vw, vh, 0);
  const fontPx = clamp(Math.round(TARGET_FONT[bp] / wFit.scale), 20, 34);
  const lineHeight = Math.round(fontPx * 1.6);

  const f = scene === 'writing' ? w : frame(bp, scene, vw, vh, page);
  const r = scene === 'writing' ? fit(w, vw, vh, caretY) : fit(f, vw, vh, 0);
  return {
    bp,
    mode: modeFor(bp),
    layout: layoutFor(bp, vw, vh),
    scale: r.scale,
    x: r.x,
    y: r.y,
    fontPx,
    lineHeight,
    effectiveFontPx: fontPx * wFit.scale,
    insets: f.insets,
    tiltX: f.tiltX,
    tiltZ: f.tiltZ,
    pen: { ...f.pen, y: r.penY }
  };
}

// ------------------------------------------------------------------ environment hooks

function useMedia(query: string): boolean {
  const [m, setM] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return m;
}

/** Viewport size, tracking the visual viewport (on-screen keyboards) and rotation. */
function useViewportSize() {
  const read = () => {
    const vv = window.visualViewport;
    return { w: Math.round(vv?.width ?? window.innerWidth), h: Math.round(vv?.height ?? window.innerHeight), top: Math.round(vv?.offsetTop ?? 0) };
  };
  const [size, setSize] = useState(read);
  useEffect(() => {
    const update = () => setSize((s) => { const n = read(); return n.w === s.w && n.h === s.h && n.top === s.top ? s : n; });
    const ro = new ResizeObserver(update);
    ro.observe(document.documentElement);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, []);
  return size;
}

export const SCENE_MS: Record<Scene, number> = { landing: 1100, opening: 1500, writing: 1200 };
export const FLIP_MS = 900;
export const COVER_MS = SCENE_MS.opening - 100;
export const RESIZE_MS = 240;

export interface UseCamera extends ReturnType<typeof computeCamera> {
  /** Static (non-animated) CSS variables + stage size. */
  vars: CSSProperties;
  size: { w: number; h: number; top: number };
  /** Animated camera state in screen/world numbers, ready for CameraRig. */
  target: CamState;
}

/**
 * `gentle` motion skips the intermediate "opening" camera stop (a big sweep) and goes straight to the
 * close-up, so only a short, small zoom remains.
 */
export function useCamera(scene: Scene, page: number, caretY: number, gentle: boolean): UseCamera {
  const size = useViewportSize();
  const isPhone = useMedia('(max-width: 639px)');
  const isTablet = useMedia('(max-width: 1023px)');
  const isShortLandscape = useMedia('(orientation: landscape) and (max-height: 499px) and (max-width: 999px)');
  const bp: Breakpoint = isShortLandscape ? 'phoneLandscape' : isPhone ? 'phone' : isTablet ? 'tablet' : 'desktop';

  const camScene: Scene = gentle && scene === 'opening' ? 'writing' : scene;
  const cam = useMemo(() => computeCamera({ vw: size.w, vh: size.h, bp, scene: camScene, page, caretY }), [size.w, size.h, bp, camScene, page, caretY]);

  // The camera anchor is the stage's top-left corner and the viewport centre is folded into x / y, so a
  // viewport change (rotation, on-screen keyboard) is just another retarget of the same tween: nothing
  // jumps when the stage resizes.
  const target: CamState = useMemo(() => ({
    s: cam.scale,
    x: size.w / 2 + cam.x,
    y: size.h / 2 + cam.y,
    tx: cam.tiltX,
    tz: cam.tiltZ,
    px: cam.pen.x,
    py: cam.pen.y,
    pr: cam.pen.rot
  }), [cam, size.w, size.h]);

  const vars = {
    '--page-fs': px(cam.fontPx),
    '--page-lh': px(cam.lineHeight),
    '--safe-l': px(cam.insets.l),
    '--safe-r': px(cam.insets.r),
    '--safe-t': px(cam.insets.t),
    '--safe-b': px(cam.insets.b),
    width: size.w,
    height: size.h,
    top: size.top
  } as CSSProperties;

  return { ...cam, vars, size, target };
}
