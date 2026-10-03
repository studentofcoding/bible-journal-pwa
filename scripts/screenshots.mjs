// Dev-only helper (not part of the app bundle). Usage:
//   PW_DIR=/path/with/playwright-core/node_modules/.. node scripts/screenshots.mjs [device]
// Needs `playwright-core` installed outside this project and a Chrome/Chromium binary.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const { chromium } = createRequire((process.env.PW_DIR ?? process.cwd()) + '/')('playwright-core');
const APP_URL = process.env.URL ?? 'http://localhost:4173/';
const OUT = new globalThis.URL('../screenshots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const devices = [
  { name: 'desktop', w: 1440, h: 900, touch: false },
  { name: 'tablet', w: 820, h: 1180, touch: true },
  { name: 'phone', w: 390, h: 844, touch: true },
  { name: 'phone-landscape', w: 844, h: 390, touch: true }
];
const only = process.argv[2];
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
for (const d of devices) {
  if (only && only !== d.name) continue;
  const ctx = await browser.newContext({ viewport: { width: d.w, height: d.h }, deviceScaleFactor: d.touch ? 2 : 1, hasTouch: d.touch, isMobile: d.touch });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()));
  await page.goto(APP_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}${d.name}-1-landing.png` });
  await page.getByRole('button', { name: 'Open journal' }).first().click();
  await page.waitForTimeout(650);
  await page.screenshot({ path: `${OUT}${d.name}-2-opening.png` });
  await page.waitForTimeout(2600);
  const ta = page.locator('.leaf:not(.cover) .face:not([inert]) textarea').first();
  await ta.click();
  await ta.type('He leads me beside still waters; today I want to slow down and notice where I am being led. Rest is also obedience.', { delay: 4 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}${d.name}-3-writing.png` });
  console.log(d.name, 'effective font', await page.locator('.stage').getAttribute('data-effective-font'),
    'textarea css px', await ta.evaluate((el) => getComputedStyle(el).fontSize));
  // page turn: add a page, then capture mid-flip
  await page.getByRole('button', { name: 'Add a new page' }).click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${OUT}${d.name}-4-pageturn-mid.png` });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}${d.name}-5-newpage.png` });
  await ctx.close();
}
await browser.close();
