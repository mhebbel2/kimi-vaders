# Kimi-vaders

A faithful Space Invaders clone written from scratch in vanilla HTML, CSS, and JavaScript. Runs in any modern browser on both desktop and mobile (touchscreen).

> Written by **Kimi K3**.

---

## Play

**Live game:** https://mhebbel2.github.io/kimi-vaders/

Hosted for free via GitHub Pages. No install, no downloads, no dependencies. It's a full **PWA** — on iOS/Android (and desktop Chrome/Edge), add it to your home screen from the browser menu for a fullscreen, chromeless, **offline-capable** experience.

### Controls

| Action | Mobile | Desktop |
|---|---|---|
| Move | Drag your finger on the screen, or hold the `◀` / `▶` buttons | `←` / `→` arrow keys |
| Shoot | Tap the screen, or hold the **FIRE** button | `Space` |

---

## Architecture

Kimi-vaders is a **zero-dependency, single-page webapp** and **installable PWA**. There is no bundler, no framework, and no build step — the source files run directly in the browser:

```
kimi-vaders/
├── index.html       # Shell, canvas, control buttons, SW registration
├── style.css        # Mobile-first layout, pixelated upscaling
├── game.js          # Engine, gameplay, rendering, and audio (all in one file)
├── manifest.json    # Web app manifest (name, icons, standalone display)
├── sw.js            # Service worker — precaches the app shell for offline play
├── icons/           # App icons (192/512, maskable, apple-touch-icon)
└── tools/
    └── make-icons.mjs  # Regenerates icons from the crab sprite: node tools/make-icons.mjs
```

Everything in `game.js` lives inside a single `(() => { ... })();` IIFE — the engine, sprites, audio, and state are fully encapsulated in one closure and never leak to the global scope.

### Rendering

- Draws at the **original arcade resolution of 224×256** onto a backing `<canvas>`.
- The canvas is then **CSS-scaled** to fit the viewport (window height minus the on-screen control bar) using `image-rendering: pixelated` for crisp, upscaled pixels — no anti-aliasing.
- All sprites are encoded as ASCII bitmaps (`'X'` = pixel on) and pre-rendered once into offscreen `<canvas>` elements, then drawn via `drawImage` each frame for speed.
- The main loop uses `requestAnimationFrame` with a **clamped delta-time** (`max 50 ms`) so gameplay stays consistent across slow devices and paused tabs.

### Game state machine

The game runs in discrete states: `title → playing → (dying | waveclear) → playing | gameover → title`.

Transitions are explicit and managed by a single `update(dt)` dispatcher:

```js
if      (state === 'playing')   updatePlaying(dt);
else if (state === 'dying')     dyingT -= dt;        // then respawn or game over
else if (state === 'waveclear') clearT  -= dt;       // then next wave
```

### Entity model

Each frame, the engine ticks every entity in turn:

- **Player** — a single sprite that eases toward a target X (set by drag) or moves at a fixed velocity (set by held buttons), clamped to the play area.
- **Invaders** — a 5×11 grid of aliens (`squid` / `crab` / `octopus`, worth 30 / 20 / 10 pts). The whole grid steps horizontally on a timer; on edge contact, it drops 8 px and reverses. **The march tempo accelerates as aliens are killed**, exactly like the original 1978 arcade — a single remaining alien can march at breakneck speed.
- **Shields** — 4 destructible bunkers. Each is a 22×16 pixel array (an 11×8 grid of 2 px cells). Bullets and bombs carve circles out of them; invaders plow through them as they descend.
- **Bullets & bombs** — one player bullet at a time (classic), up to 3 invader bombs. Bombs fire from random bottom-most invaders; the player bullet can shoot them down for safety.
- **UFO** — a mystery ship that drifts across the top of the screen every ~15 s. Worth a randomized 50 / 100 / 150 / 300 points, accompanied by a wailing warble sound.
- **Particles & floating texts** — pixel particles for explosions and rising `+150` style score popups.

### Audio

All sound effects are **synthesized live with the Web Audio API** — no audio files, no asset hosting. The marching bassline, shoot zap (a `square` oscillator sweeping downward in pitch), explosions (a noise buffer through a lowpass filter), and the UFO's warbling siren (two `sawtooth` oscillators modulated by an LFO) are all generated procedurally on each user gesture, which unlocks the `AudioContext` on mobile.

### Touch & pointer input

A unified **pointer events** model handles touch and mouse identically:

- **Drag on the canvas** moves the ship to the touch's X coordinate.
- A **quick tap** (touch start → end in under 250 ms and 14 px) fires a shot.
- The **FIRE button** auto-repeats shots at ~6 Hz while held.
- The **`◀`** and **`▶`** buttons move the ship at a fixed velocity while held.
- The **keyboard** arrows + `Space` mirror the same actions for desktop testing.

All page scroll, pinch-zoom, double-tap-zoom, and long-press context menu are disabled globally so the page behaves like a fullscreen app rather than a webpage.

### Mobile-first design choices

- The `viewport` meta tag locks zoom and disables user scaling.
- `touch-action: none` is set everywhere to prevent browser gesture interception.
- The layout uses `100dvh` with safe-area insets for notched / Dynamic Island phones.
- On-screen buttons are 62 px tall and flex-sized so they're easy to hit with a thumb.
- High scores are persisted to `localStorage` per device.

### PWA

The app is installable and fully playable **offline**:

- `manifest.json` declares standalone display, a black theme, and maskable + regular icons (generated from the in-game crab sprite by `tools/make-icons.mjs`).
- `sw.js` precaches the entire app shell on install, serves static assets **cache-first**, and falls back to the cached shell for navigations when offline. Old caches are purged on activate; bump the `CACHE` constant in `sw.js` whenever any precached asset changes.

---

## Running locally

No build step is needed — just serve the directory with any static server:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/
```

You can also open `index.html` directly in a browser, though some browsers block `localStorage` under the `file://` protocol (the rest of the game still works). The service worker (offline mode) requires the app to be served over HTTP(S) — `localhost` counts.

---

**Repo:** https://github.com/mhebbel2/kimi-vaders
**Play:** https://mhebbel2.github.io/kimi-vaders/