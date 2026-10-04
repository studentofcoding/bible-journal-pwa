import { CAM_EASE, type Ease } from './motion';

/**
 * One interpolated camera state, applied as plain transforms to three layers:
 *   .camera  translate3d(x, y) scale(s)                   (screen position + zoom)
 *   .tilt    translate3d(float) perspective rotateX rotateZ (desk tilt of the book)
 *   .pen     translate3d(px, py) rotate(pr) scale(lift)     (pen pose in world space)
 * A rAF loop interpolates the state and writes `style.transform` directly - React never re-renders per frame,
 * nothing relies on CSS custom-property transitions (flaky on iOS Safari), and only transform is animated.
 * `will-change: transform` is added while something moves and removed shortly after it settles (so the browser
 * re-rasterises the zoomed layers crisply).
 */
export interface CamState { s: number; x: number; y: number; tx: number; tz: number; px: number; py: number; pr: number }
const KEYS: (keyof CamState)[] = ['s', 'x', 'y', 'tx', 'tz', 'px', 'py', 'pr'];

export interface RigEls { camera: HTMLElement; tilt: HTMLElement; pen: HTMLElement }

export class CameraRig {
  private cur: CamState;
  private from: CamState;
  private goal: CamState;
  private t0 = 0;
  private dur = 0;
  private ease: Ease = CAM_EASE;
  private tweening = false;
  private raf = 0;
  private last = 0;
  private idleOn = false;
  private idleAmt = 0;
  private lift = 0;
  private liftCur = 0;
  private wc = false;
  private wcTimer = 0;
  private dead = false;

  constructor(private els: RigEls, init: CamState) {
    this.cur = { ...init };
    this.from = { ...init };
    this.goal = { ...init };
    this.apply(0);
  }

  get state(): CamState { return this.cur; }
  get moving(): boolean { return this.tweening; }

  /** Retarget. Always starts from whatever is currently displayed, so a retarget mid-flight bends smoothly. */
  to(state: CamState, ms: number, ease: Ease = CAM_EASE) {
    if (KEYS.every((k) => Math.abs(state[k] - this.goal[k]) < 1e-4)) return;
    this.goal = { ...state };
    if (ms <= 0) { this.cur = { ...state }; this.tweening = false; this.apply(this.last); this.kick(); return; }
    this.from = { ...this.cur };
    this.t0 = performance.now();
    this.dur = ms;
    this.ease = ease;
    this.tweening = true;
    this.kick();
  }

  snap(state: CamState) { this.to(state, 0); }

  setIdle(on: boolean) { this.idleOn = on; this.kick(); }

  /** 0..1: how far the pen has lifted away from the page (driven by the page flip). */
  setLift(v: number) { this.lift = v; this.kick(); }

  destroy() {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    window.clearTimeout(this.wcTimer);
  }

  private kick() {
    if (this.dead) return;
    window.clearTimeout(this.wcTimer);
    this.setWillChange(true);
    if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame(this.tick); }
  }

  private setWillChange(on: boolean) {
    if (this.wc === on) return;
    this.wc = on;
    const v = on ? 'transform' : '';
    this.els.camera.style.willChange = v;
    this.els.tilt.style.willChange = v;
    this.els.pen.style.willChange = v;
  }

  private tick = (now: number) => {
    this.raf = 0;
    if (this.dead) return;
    const dt = Math.min(64, Math.max(0, now - this.last));
    this.last = now;
    if (this.tweening) {
      const u = Math.min(1, (now - this.t0) / this.dur);
      const e = this.ease(u);
      for (const k of KEYS) this.cur[k] = this.from[k] + (this.goal[k] - this.from[k]) * e;
      if (u >= 1) { this.cur = { ...this.goal }; this.tweening = false; }
    }
    this.idleAmt += ((this.idleOn ? 1 : 0) - this.idleAmt) * Math.min(1, dt / 500);
    if (Math.abs(this.idleAmt) < 0.002 && !this.idleOn) this.idleAmt = 0;
    this.liftCur += (this.lift - this.liftCur) * Math.min(1, dt / 70);
    if (Math.abs(this.lift - this.liftCur) < 0.002) this.liftCur = this.lift;
    this.apply(now);
    const busy = this.tweening || this.idleOn || this.idleAmt > 0 || this.liftCur !== this.lift;
    if (busy) this.raf = requestAnimationFrame(this.tick);
    else this.wcTimer = window.setTimeout(() => this.setWillChange(false), 160);
  };

  private apply(now: number) {
    const c = this.cur;
    const r = (n: number) => Math.round(n * 1000) / 1000;
    const idle = this.idleAmt;
    const fy = idle * 4 * Math.sin(now / 1500);
    const penDy = idle * 5 * Math.sin(now / 1100 + 1);
    const penRot = idle * 1.4 * Math.sin(now / 1700);
    const L = this.liftCur;
    this.els.camera.style.transform = `translate3d(${r(c.x)}px, ${r(c.y)}px, 0) scale(${r(c.s)})`;
    this.els.tilt.style.transform = `translate3d(0, ${r(fy)}px, 0) perspective(2600px) rotateX(${r(c.tx)}deg) rotateZ(${r(c.tz)}deg)`;
    this.els.pen.style.transform = `translate3d(${r(c.px + L * 34)}px, ${r(c.py + penDy - L * 10)}px, 0) rotate(${r(c.pr + penRot + L * 9)}deg) scale(${r(1 + L * 0.08)})`;
  }
}
