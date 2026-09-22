# Sir Hiss-a-Lot

A full screen procedural snake game, packaged as a Chrome extension (Manifest V3).
Zero dependencies, zero network, zero backend — everything is drawn and synthesized at runtime.

---

## Install as a Chrome extension

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. **Load unpacked** → pick this folder
4. Click the 🐍 toolbar icon. The game opens in its own tab; press **F** for true fullscreen.

Clicking the icon again focuses the existing game tab instead of opening a second one.

## Run without installing

```bash
python3 -m http.server 8777 && open http://localhost:8777/index.html
```

(`index.html` also opens directly from the filesystem — `open index.html`.)

---

## Files

| Path | Purpose |
|---|---|
| `manifest.json` | MV3 manifest — toolbar action, icons, service worker |
| `background.js` | Opens/focuses the game tab on toolbar click |
| `index.html` | Markup + CSS. No inline script (MV3 blocks it) |
| `game.js` | The whole game: rendering, physics, audio, state |
| `icons/` | 16/48/128 px icons, cropped from real gameplay |
| `selftest.js` | Console self-check for difficulty, levels and the ward |
| `tools/build.sh` | Builds the Chrome Web Store zip into `dist/` |
| `tools/capture-icons.js` | Regenerates `icons/` from the live canvas |
| `tools/devserver.py` | Static server that can also save files from the page |
| `store/listing.md` | Store listing copy, permission justification |
| `store/assets/` | Screenshots and promo tiles, at store dimensions |
| `store/templates/promo.html` | Source for the promo tiles |

---

## Building for the Chrome Web Store

```bash
./tools/build.sh          # -> dist/sir-hiss-a-lot-<version>.zip
```

It checks the manifest parses and carries a valid version, that every icon and
referenced file exists, that `index.html` has no inline script or event handler
(MV3 blocks both), and that the JS parses. Only the five runtime paths go in the
zip — `README.md`, `selftest.js`, `tools/` and `store/` stay out.

Upload the zip at the [Developer Dashboard](https://chrome.google.com/webstore/devconsole);
listing copy and the graphic assets are in [`store/listing.md`](store/listing.md).
To regenerate the art, see [`store/README-assets.md`](store/README-assets.md).

---

## Difficulty

| | Easy | Medium | Difficult |
|---|---|---|---|
| Speed | ×0.80 | ×1.00 | ×1.28 |
| Turn rate | ×1.15 | ×1.00 | ×0.88 |
| Monoliths | ×0.5 | ×1.0 | ×1.7 |
| Speed ramp per length | ×0.55 | ×1.00 | ×1.45 |
| Score per apple | ×0.75 | ×1.00 | ×1.60 |
| Apples on screen | 5 | 4 | 3 |

High scores are tracked **per difficulty**, so a Difficult run never competes with an Easy one.

## Levels

Every 5 apples you gain a level: +6 px/s cruise speed and one extra monolith drops into
the arena. Current level sits in the HUD; the level-up banner plays at the centre.

## Pickups

| | Points | Effect |
|---|---|---|
| 🍎 Apple | 10 | Grow |
| ★ Golden Apple | 50 | Grow double |
| 🧲 Amethyst | 30 | Magnet — pulls nearby apples in for 6.5s |
| 🛡 Scale Ward | 25 | Absorbs one fatal hit, then 1.6s of invulnerability and a bounce |

Combos multiply everything: chain apples within 3.2s for up to ×6.

## Controls

| Key | Action |
|---|---|
| `↑ ↓ ← →` / `WASD` | Steer |
| `Shift` / `Space` | Sprint |
| `F` | Fullscreen |
| `P` / `Esc` | Pause |
| `R` | Restart |

Also: an on-screen D-pad and action buttons (toggle with **🎮 Pad**), and a mouse-follow
steering mode. The game auto-pauses when the tab loses focus.

## Persistence

Settings (difficulty, steering, walls, monoliths, skin) and stats (runs, apples eaten,
best per difficulty, last 5 runs) are kept in `localStorage` and restored on load.
An existing `viper_best_score` is migrated to the Medium high score on first run.

## Accessibility & performance

- Honours `prefers-reduced-motion`: no screen shake, no drifting fireflies, no CSS animation.
- Device pixel ratio capped at 2; frame delta clamped at 50ms so a stalled tab cannot teleport the snake.
- Auto-pause on tab blur.

---

## Debug hook

`game.js` exposes `window.__hiss` — `state()`, `feed(type, n)`, `kill()`,
`freeze()` and `setDifficulty()`. `selftest.js` and the icon capture drive the
game through it. Delete the block at the bottom of `game.js` if you would rather
not ship it; nothing in the game depends on it.

---

## License

MIT / Apache 2.0.
