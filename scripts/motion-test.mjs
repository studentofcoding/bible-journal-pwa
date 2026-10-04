// Dev-only motion verification (needs playwright-core installed at /workspace/_shot-tools and `npm run preview` running).
// Emulates phones/tablet with reducedMotion reduce|no-preference and logs transform progress + frame gaps.
import { createRequire } from 'node:module';
const { chromium } = createRequire('/workspace/_shot-tools/')('playwright-core');
const URL = process.argv[2] || 'http://localhost:4173/';
const profiles = {
  'iPhone14': { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' },
  'Pixel7': { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, hasTouch: true, isMobile: true },
  'SE-360x740': { viewport: { width: 360, height: 740 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true },
  'landscape-844x390': { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true },
  'iPad-820x1180': { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
};
const only = (process.env.ONLY || '').split(',').filter(Boolean);
const shots = process.env.SHOTS === '1';
const sampler = `(() => {
  const q = (s) => document.querySelector(s);
  const ang = (t) => { if (!t || t === 'none') return 0; const m = new DOMMatrix(t); return Math.round(Math.atan2(-m.m13, m.m11) * 180 / Math.PI * 10) / 10; };
  window.__rec = { on: false, rows: [], t0: 0 };
  const loop = (now) => {
    const r = window.__rec;
    if (r.on) {
      const cover = q('.leaf.cover'), cam = q('.camera'), pen = q('.pen');
      const leaves = [...document.querySelectorAll('.leaf:not(.cover)')];
      const m = new DOMMatrix(getComputedStyle(cam).transform);
      const pm = new DOMMatrix(getComputedStyle(pen).transform);
      r.rows.push({ t: Math.round(now - r.t0), cover: ang(getComputedStyle(cover).transform), leaf0: (() => { const a = leaves.map(l => ang(getComputedStyle(l).transform)); const m = a.find(v => Math.abs(v) > 0.5 && Math.abs(v) < 179.5); return m === undefined ? 0 : m; })(), leaf1: leaves.filter(l => Math.abs(ang(getComputedStyle(l).transform)) > 179.5).length,
        camS: Math.round(m.a * 1000) / 1000, camX: Math.round(m.e), camY: Math.round(m.f), penX: Math.round(pm.e), penY: Math.round(pm.f), shade: Math.max(0, ...leaves.map(l => +(l.querySelector('.shade')?.style.opacity || 0))) });
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  window.__start = () => { window.__rec.rows = []; window.__rec.t0 = performance.now(); window.__rec.on = true; };
  window.__stop = () => { window.__rec.on = false; return window.__rec.rows; };
})()`;
function summarize(rows, label) {
  const keys = ['cover', 'leaf0', 'camS', 'camX', 'penX'];
  const at = [100, 200, 300, 450, 600, 800, 1000, 1300];
  const out = [];
  for (const T of at) {
    const r = rows.reduce((a, b) => Math.abs(b.t - T) < Math.abs(a.t - T) ? b : a);
    out.push(`t=${String(r.t).padStart(4)}ms ` + keys.map(k => `${k}=${r[k]}`).join(' ') + ` shade=${r.shade}`);
  }
  let maxGap = 0, over50 = 0; for (let i = 1; i < rows.length; i++) { const g = rows[i].t - rows[i - 1].t; maxGap = Math.max(maxGap, g); if (g > 50) over50++; }
  const dur = rows.length ? rows[rows.length - 1].t : 0;
  const distinct = (k) => new Set(rows.map(r => r[k])).size;
  console.log(`  [${label}] frames=${rows.length} span=${dur}ms maxFrameGap=${maxGap}ms gaps>50ms=${over50} distinct cover=${distinct('cover')} leaf0=${distinct('leaf0')} camS=${distinct('camS')}`);
  out.forEach(l => console.log('    ' + l));
}
async function swipe(cdp, x0, y0, x1, y1, steps = 12, stepMs = 16, release = true) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * i / steps, y: y0 + (y1 - y0) * i / steps }] });
    await new Promise(r => setTimeout(r, stepMs));
  }
  if (release) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
let failures = 0;
for (const [name, prof] of Object.entries(profiles)) {
  if (only.length && !only.includes(name)) continue;
  for (const rm of ['reduce', 'no-preference']) {
    console.log(`\n=== ${name} reducedMotion=${rm} ===`);
    const ctx = await b.newContext({ ...prof, reducedMotion: rm });
    const p = await ctx.newPage();
    const errs = [];
    p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
    p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
    await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(1000);
    const motion = await p.evaluate(() => document.querySelector('.stage').dataset.motion);
    console.log('  data-motion =', motion);
    await p.evaluate(sampler);
    if (shots) await p.screenshot({ path: `/tmp/m-${name}-${rm}-0landing.png` });
    // idle motion
    await p.evaluate(() => window.__start()); await p.waitForTimeout(1500);
    const idle = await p.evaluate(() => window.__stop());
    console.log(`  idle landing: pen y values distinct=${new Set(idle.map(r => r.penY)).size}`);
    // OPEN
    await p.evaluate(() => window.__start());
    { const bb = await p.locator('.leaf.cover .face.front').boundingBox(); await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); }
    if (shots) for (const d of [150, 250, 300]) { await p.waitForTimeout(d); await p.screenshot({ path: `/tmp/m-${name}-${rm}-1open-${d}.png` }); }
    await p.waitForTimeout(2500);
    const open = await p.evaluate(() => window.__stop());
    summarize(open, 'OPEN landing->writing');
    const cdp = await ctx.newCDPSession(p);
    // PAGE TURN: 'New page' appends + turns
    await p.evaluate(() => window.__start());
    await p.getByRole('button', { name: 'Add a new page' }).tap();
    await p.waitForTimeout(1300);
    const next = await p.evaluate(() => window.__stop());
    summarize(next, 'PAGE TURN (New page -> flips to it)');
    for (let i = 0; i < 3; i++) { await p.getByRole('button', { name: 'Add a new page' }).tap(); await p.waitForTimeout(1300); }
    await p.getByRole('button', { name: 'Previous page' }).tap(); await p.waitForTimeout(1300);
    await p.evaluate(() => window.__start());
    await p.getByRole('button', { name: 'Previous page' }).tap();
    await p.waitForTimeout(1300);
    summarize(await p.evaluate(() => window.__stop()), 'PAGE TURN BACK (Prev button)');
    // drag turn: left swipe in the middle, live samples while finger is down
    const vw = prof.viewport.width, vh = prof.viewport.height;
    await p.evaluate(() => window.__start());
    await swipe(cdp, vw * 0.8, vh * 0.5, vw * 0.45, vh * 0.52, 10, 16, false);
    const mid = await p.evaluate(() => { const rows = window.__rec.rows; return rows[rows.length - 1]; });
    console.log(`  DRAG (finger held, ~35% of width): turning-leaf angle(deg, 0=none/rest) while held = ${mid.leaf0}`);
    await swipe(cdp, vw * 0.45, vh * 0.52, vw * 0.2, vh * 0.52, 8, 16, false);
    const mid2 = await p.evaluate(() => { const rows = window.__rec.rows; return rows[rows.length - 1]; });
    console.log(`  DRAG (further): turning-leaf angle = ${mid2.leaf0}`);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(1200);
    const drag = await p.evaluate(() => window.__stop());
    const pg = await p.locator('.hud-status').innerText();
    console.log('  after drag-commit status:', pg);
    // snap-back: short drag then release
    await p.evaluate(() => window.__start());
    await swipe(cdp, vw * 0.8, vh * 0.5, vw * 0.7, vh * 0.5, 4, 16, false);
    const held = await p.evaluate(() => window.__rec.rows.at(-1));
    await new Promise(r => setTimeout(r, 400));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(900);
    const back = await p.evaluate(() => window.__stop());
    const settled = back.at(-1);
    console.log(`  snap-back: held angle=${held.leaf0}; settled angle=${settled.leaf0}; status=${await p.locator('.hud-status').innerText()}`);
    // keyboard open emulation: focus textarea then shrink viewport
    await p.locator('.leaf .page-lines').first().focus().catch(() => {});
    await p.evaluate(() => window.__start());
    await p.setViewportSize({ width: vw, height: Math.round(vh * 0.55) });
    await p.waitForTimeout(700);
    await p.setViewportSize({ width: vw, height: vh });
    await p.waitForTimeout(700);
    const kb = await p.evaluate(() => window.__stop());
    let maxJump = 0; for (let i = 1; i < kb.length; i++) maxJump = Math.max(maxJump, Math.abs(kb[i].camY - kb[i - 1].camY), Math.abs(kb[i].camX - kb[i - 1].camX));
    let kg = 0; for (let i = 1; i < kb.length; i++) kg = Math.max(kg, kb[i].t - kb[i - 1].t);
    console.log(`  keyboard-resize: frames=${kb.length} maxFrameGap=${kg}ms max per-frame camera jump=${maxJump}px (viewport resize 100%->55%->100%)`);
    // close and reopen toggle
    const label = await p.locator('.motion-toggle').first().innerText();
    console.log('  toggle label (HUD):', label.replace(/\n/g, ' '));
    console.log('  console errors/warnings:', errs.length ? errs : 'none');
    if (errs.length) failures++;
    if (shots) await p.screenshot({ path: `/tmp/m-${name}-${rm}-2end.png` });
    await ctx.close();
  }
}
await b.close();
process.exit(failures ? 1 : 0);
