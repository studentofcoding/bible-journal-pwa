# My Bible Journal — React + Vite PWA

A small, offline-first Bible study journal. A closed leather journal sits on a desk beside a pen; tap
**Open journal**, the cover swings open while the camera pulls in, and you land in a close-up writing view where
each page is one entry (scripture reference + lined reflection). Pages turn with a 3D flip (buttons, swipe, arrow
keys). Everything is pure CSS/SVG — no images, no network, no external fonts.

* React 19 + Vite + TypeScript, `vite-plugin-pwa` (Workbox) — nothing else at runtime (no animation library).
* Entries live in `localStorage` (`bible-journal:v1`). One page per entry, **New page** appends one.
* A tiny hardcoded list of public-domain KJV verses (John 3:16, Psalm 23:1, Philippians 4:13, …). The *verse of the
  day* appears on the landing scene and on the inside of the front cover; when a page's reference matches a known
  verse the KJV text is quoted at the top of the page. The first page is seeded with today's reference.

## Run

```bash
npm install
npm run dev          # http://localhost:5173  (service worker is only active in the production build)
npm run build        # type-check + production build + service worker -> dist/
npm run preview      # serves dist/ at http://localhost:4173 (installable, works offline after first load)
```

`npm run icons` re-rasterises `scripts/src-icons/*.svg` into `public/icons/*.png` with a local headless Chrome
(`CHROME=/path/to/chrome` to override). `scripts/screenshots.mjs` is the dev-only screenshot helper used for
`screenshots/` (needs `playwright-core` installed outside this project; see the header of that file).

## Controls

| Action | Input |
| --- | --- |
| Open / close | **Open journal** button or tap the cover · **Close** (top-left) |
| Turn page | **Prev / Next** buttons · horizontal swipe · `←` `→` (use `Alt+←` / `Alt+→` while the caret is in a text field) |
| New page | **New page** (top-right) or the "Begin a new page" button on the blank page after the last entry |

## Code map

```
src/
  App.tsx                 scene state machine (landing → opening → writing), page navigation, wiring
  hooks/useCamera.ts      the camera model: frames per scene × breakpoint → CSS variables
  hooks/useJournalStore.ts entries + persistence (localStorage, debounced, flushed on pagehide)
  hooks/usePageNav.ts     keyboard arrows + swipe
  components/Landing.tsx  title, verse of the day, "Open journal" (sits in the margin the camera leaves free)
  components/Journal.tsx  the book: cover + leaves, 3D hinge/flip, z-ordering, single/spread page mapping
  components/Page.tsx     one lined page: reference input, KJV quote, textarea, caret measurement
  components/Pen.tsx      SVG fountain pen (nib at the origin so the pose variables place the *tip*)
  components/Cover.tsx    leather cover front and the inside-cover endpaper
  components/Hud.tsx      close / page indicator / new page / prev / next
  lib/verses.ts           KJV verse list, verse of the day, reference lookup
  styles/                 global (tokens, @property), scene (stage, camera, desk, landing, HUD), journal (book, pages)
```

## Camera / zoom model

There is **one scene container** (`.stage`) and **one world**. The world is measured in *design pixels*: the open
journal is a fixed `1200 × 800` box (`aspect-ratio: 3 / 2`, two `600 × 800` pages), centred on the origin. The closed
cover is simply the right half of that box (x 0…600). Nothing is ever restyled per device inside the world — the
journal never stretches, it is only seen through a different camera.

The camera is a handful of numbers computed in `computeCamera()` (`useCamera.ts`) from
`(scene, breakpoint, active page, caret)` and published as CSS custom properties on the stage:

| variable | meaning | consumed by |
| --- | --- | --- |
| `--cam-s`, `--cam-x`, `--cam-y` | scale and translate of the camera | `.camera` (`translate() scale()`) |
| `--tilt-x`, `--tilt-z` | desk-view tilt of the book | `.tilt` (`perspective() rotateX() rotateZ()`) |
| `--pen-x`, `--pen-y`, `--pen-r` | pen tip position + angle in *world* space | `.pen` |
| `--cam-ms`, `--flip-ms`, `--cover-ms` | shared durations | stage transition, leaf flip, cover swing |
| `--page-fs`, `--page-lh` | page font size / line height (design px) | every page, textarea ruled lines |
| `--safe-*` | screen margins reserved for copy/HUD | landing copy placement |

A frame is "fit this **world rectangle** into this **safe screen rectangle**": `scale = min(safeW / focusW,
safeH / focusH)` and the translate puts the focus centre at the safe-rect centre. Every number in the table below is
a frame definition in `useCamera.ts`, not a media-query hack.

Breakpoints come from `matchMedia`: desktop ≥ 1024, tablet 640–1023, phone < 640, and *landscape phone*
(`orientation: landscape` and height < 500 and width < 1000). Viewport size comes from a `ResizeObserver` +
`visualViewport` (so rotation and on-screen keyboards re-frame too).

| scene | desktop (≥1024) | tablet (640–1023) | phone (<640) | landscape phone |
| --- | --- | --- | --- | --- |
| **landing** (closed journal) | copy in the left 42 %; camera frames cover + pen in the right column; book tilted 12° | portrait: copy on top, button at bottom, cover fills the middle (~60 % of the width); landscape tablets use the desktop side layout | cover fills ~90 % of the width, pen stands against its edge; copy compacts on short screens | side layout, whole cover visible |
| **opening** (cover swings) | whole open spread + a little desk | whole spread, slightly wider than the close-up | camera crops to the spine/right page (about 0.5×) so the swing exits left instead of shrinking the book | whole book, minimal margins |
| **writing** (close-up) | **two pages**, fitted between the top and bottom HUD (~0.9×) | **two pages, closer**: the outer 24 px of each page margin is cropped off-screen so the spread fills the width (~0.7×) | **single page**: camera crops onto the active page, trimming 30 px margins; the page fills the width (~0.72×) | **single page**, capped at 0.95× and cropped vertically; the camera **follows the caret** and the pen rides along the bottom edge of what is shown |

### Readable text

`fontPx = clamp(round(targetEffective / writingScale), 20, 34)`, with a target of 19 px on desktop/tablet and 18 px
on phones. The page text therefore lands at ≈18–19 px *on screen* at every size (tablet portrait uses 27 design px ×
0.71), and the smallest page text (dates, labels) is 0.9em ≥ 16 px. The CSS font size of the `input`/`textarea` is
always ≥ 20 px, so iOS never zooms on focus. The stage exposes `data-effective-font` for quick inspection. When the
keyboard shrinks a phone's viewport the camera keeps the width-fit scale and follows the caret rather than shrinking
the page.

### Single-page mode and the page flip

Every leaf hinges on the spine (left edge of the right half) and is `rotateY(var(--flip) * -180deg)`; the cover is
leaf −1. In **spread** mode a leaf's front is a right-hand page and its back is the next left-hand page (so the
endpaper inside the cover is the left page of the first spread). In **single** mode a leaf's back is blank paper and
the camera is cropped onto the right half, so the page turns on the *same hinge* as on desktop — it just swings
away through the area the camera has cropped off. Because the camera, not the DOM, decides how much of the book you
see, resizing across a breakpoint keeps the same entry open (`page` is the single source of truth; the number of
flipped leaves is derived from it and the mode).

### Keeping camera, journal, pen and flip in step

* The camera variables are registered with `@property` (`global.css`) and transitioned on `.stage` with a shared
  duration/easing. Children inherit the *interpolated* values, so the camera, the book tilt and the pen's pose are
  literally the same animated numbers, not four separately timed animations.
* Scene changes use choreographed durations (`SCENE_MS`: opening 1.5 s, close-up 1.2 s, landing 1.1 s); the cover
  swing uses the same 1.4 s curve so it finishes with the camera move. Anything else (resize, rotation, breakpoint
  change, caret follow, switching page) retargets the same variables with a short 240 ms duration, so a rotation
  mid-animation simply bends the running transitions toward the new frame.
* The leaf being turned jumps to the top of the stack for the duration of its flip and gets a shading pass; the
  cover does the same for its swing. When the page mode changes (e.g. rotation) leaf transitions are muted for that
  single render so the book re-maps instantly instead of riffling.
* `prefers-reduced-motion`: durations collapse to ~1 ms (camera, pen, flips, cover), the scribble animation is
  disabled and the opening goes straight to the writing view.

## PWA

`vite.config.ts` configures `vite-plugin-pwa` (`registerType: 'autoUpdate'`, Workbox precache of all built assets with
an `index.html` navigation fallback). The web manifest has name, short name, `display: standalone`, theme/background
colours and 192/512 px PNG icons plus a maskable icon and an SVG icon; `apple-touch-icon` is linked from
`index.html`. After the first online load the app works fully offline (verified with Chrome offline mode).

## Known limitations

* The page flip is a rigid 3D leaf rotation with shading (no paper curl) and is triggered, not drag-interactive.
* Page text is plain `textarea`s: no rich text, no delete/reorder of pages, no export.
* Only ~10 hardcoded KJV verses; auto-quoting works for exact reference matches only.
* In single-page mode on a landscape phone a sliver of the turned pages' blank backs is visible at the left edge.
* Fonts are the system serif stack (Iowan Old Style / Palatino / Georgia), so exact glyphs vary by platform.
