import { PAPER_EASE, type Ease } from './motion';

/**
 * Imperative driver for the book's leaves (and the cover, which is just leaf "cover").
 * Every leaf has one number, progress p in 0..1 (0 = lying on the right, 1 = turned to the left). A single
 * rAF loop interpolates the active ones and writes ONE transform per leaf plus the opacity of its two shading
 * overlays - so a page turn is a continuous 0-180deg rotation with a mid-flip lift and a shade, finger-driven
 * drags use exactly the same code path (`place`), and React is not involved while anything moves.
 */
interface Anim { from: number; to: number; t0: number; dur: number; ease: Ease }
interface Entry { el: HTMLElement; shades: HTMLElement[]; restZ: number; }

const LIFT_PX = 46;     // translateZ at mid-flip (book perspective makes this a slight scale-up)
const LIFT_SCALE = 0.02;

export class LeafMotion {
  private entries = new Map<string, Entry>();
  private prog = new Map<string, number>();
  private restZ = new Map<string, number>();
  private anims = new Map<string, Anim>();
  private raf = 0;
  private amp = 1;
  /** lift amplitude 0..1 of the most-turned leaf, reported each frame (drives the pen). */
  onLift: (lift: number) => void = () => {};

  /** 1 for full motion; smaller values tone the mid-flip lift down. */
  setAmplitude(a: number) { this.amp = a; }

  register(id: string, el: HTMLElement) {
    const prev = this.entries.get(id);
    const shades = prev && prev.el === el ? prev.shades : Array.from(el.querySelectorAll<HTMLElement>(':scope > .face > .shade'));
    this.entries.set(id, { el, shades, restZ: this.restZ.get(id) ?? 0 });
    const p = this.prog.get(id);
    if (p !== undefined) this.paint(id, p);
    const z = this.restZ.get(id);
    if (z !== undefined && !this.anims.has(id)) el.style.zIndex = String(z);
  }
  unregister(id: string, el: HTMLElement) {
    if (this.entries.get(id)?.el === el) this.entries.delete(id);
  }

  has(id: string) { return this.prog.has(id); }
  get(id: string) { return this.prog.get(id) ?? 0; }
  animating(id: string) { return this.anims.has(id); }
  /** Where the leaf is heading (or resting). */
  goal(id: string) { return this.anims.get(id)?.to ?? this.prog.get(id) ?? 0; }

  setRestZ(id: string, z: number) {
    this.restZ.set(id, z);
    const e = this.entries.get(id);
    if (e && !this.anims.has(id) && !e.el.dataset.drag) e.el.style.zIndex = String(z);
  }

  /** Jump to p with no animation. */
  place(id: string, p: number) {
    this.anims.delete(id);
    this.prog.set(id, p);
    this.paint(id, p);
    this.report();
  }

  animate(id: string, to: number, ms: number, ease: Ease = PAPER_EASE) {
    const from = this.get(id);
    if (ms <= 0 || from === to) { this.place(id, to); this.settle(id); return; }
    const e = this.entries.get(id);
    if (e) { e.el.style.zIndex = '1000'; e.el.style.willChange = 'transform'; }
    this.anims.set(id, { from, to, t0: performance.now(), dur: ms, ease });
    if (!this.raf) this.raf = requestAnimationFrame(this.tick);
  }

  /** Begin a finger drag: stop animating, lift to the top of the stack. */
  grab(id: string) {
    this.anims.delete(id);
    const e = this.entries.get(id);
    if (e) { e.el.dataset.drag = '1'; e.el.style.zIndex = '1000'; e.el.style.willChange = 'transform'; }
  }
  drop(id: string) {
    const e = this.entries.get(id);
    if (e) delete e.el.dataset.drag;
  }

  /** Leaf is no longer moving: restore its resting z-order, drop will-change. */
  settle(id: string) {
    const e = this.entries.get(id);
    if (!e || e.el.dataset.drag) return;
    const z = this.restZ.get(id);
    if (z !== undefined) e.el.style.zIndex = String(z);
    window.setTimeout(() => { if (!this.anims.has(id) && !e.el.dataset.drag) e.el.style.willChange = ''; }, 140);
  }

  destroy() { cancelAnimationFrame(this.raf); this.raf = 0; this.anims.clear(); }

  private tick = (now: number) => {
    this.raf = 0;
    for (const [id, a] of this.anims) {
      const u = Math.min(1, (now - a.t0) / a.dur);
      const p = u >= 1 ? a.to : a.from + (a.to - a.from) * a.ease(u);
      this.prog.set(id, p);
      this.paint(id, p);
      if (u >= 1) { this.anims.delete(id); this.settle(id); }
    }
    this.report();
    if (this.anims.size) this.raf = requestAnimationFrame(this.tick);
  };

  private report() {
    let lift = 0;
    for (const id of this.entries.keys()) {
      if (id === 'cover') continue;
      const p = this.prog.get(id);
      if (p !== undefined && (this.anims.has(id) || this.entries.get(id)?.el.dataset.drag)) lift = Math.max(lift, Math.sin(Math.PI * p));
    }
    this.onLift(lift);
  }

  private paint(id: string, p: number) {
    const e = this.entries.get(id);
    if (!e) return;
    const s = Math.sin(Math.PI * p);
    const lift = s * this.amp;
    const a = Math.round(p * -180 * 100) / 100;
    e.el.style.transform = `translate3d(0, 0, ${Math.round(lift * LIFT_PX * 10) / 10}px) rotateY(${a}deg) scale(${Math.round((1 + lift * LIFT_SCALE) * 1000) / 1000})`;
    const shade = String(Math.round(s * 0.95 * 1000) / 1000 || 0);
    for (const sh of e.shades) sh.style.opacity = shade;
  }
}
