# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Classic Tetris implemented in vanilla JavaScript (ES6+), HTML5 Canvas, and CSS. No dependencies, no build step, no `package.json`. README is in Spanish.

## Running

No install/build needed.

```bash
open index.html        # macOS, just open the file
# or serve it:
python3 -m http.server 8000
npx serve .
php -S localhost:8000
```

There are no tests, linter, or build/bundling commands in this repo.

## Architecture

Three files, all logic lives in `game.js` (~300 lines):

- `index.html` — DOM structure: main `<canvas id="board">` (300×600, i.e. `COLS×BLOCK` by `ROWS×BLOCK`), a `<canvas id="next-canvas">` for the next-piece preview, HUD spans (`score`/`lines`/`level`), and an `#overlay` used for both PAUSE and GAME OVER states.
- `style.css` — dark/retro arcade visuals only.
- `game.js` — all game state and logic, no modules/classes, plain top-level functions and globals.

Key concepts in `game.js`:

- **Board model**: `board` is a `ROWS × COLS` matrix; each cell is `0` (empty) or a 1–7 color index (`createBoard`).
- **Pieces**: `PIECES` are square matrices indexed by type (1=I … 7=L); `randomPiece()` clones a shape and centers it at spawn. Rotation is `rotateCW` (transpose + reverse), no rotation-state table — it always rotates clockwise from current shape.
- **Collision**: `collide(shape, ox, oy)` checks board bounds and existing locked cells.
- **Wall kicks**: `tryRotate()` tries offsets `[0, -1, 1, -2, 2]` after rotating, keeping the first that doesn't collide.
- **Game loop**: `loop(ts)` runs via `requestAnimationFrame`, accumulates `dt` into `dropAccum`, and drops the piece one row (or locks it) once `dropAccum >= dropInterval`.
- **Locking/scoring**: `lockPiece()` → `merge()` (bakes piece into `board`) → `clearLines()` (sweeps full rows bottom-up, splices them out, unshifts empty rows) → `spawn()`. Score uses `LINE_SCORES = [0,100,300,500,800]` multiplied by `level`; hard drop adds 2 pts/row, soft drop adds 1 pt/row.
- **Level/speed**: level = `floor(lines / 10) + 1`; `dropInterval = max(100, 1000 - (level-1)*90)`.
- **Ghost piece**: `ghostY()` projects the current piece straight down to its landing row; drawn at `globalAlpha = 0.2`.
- **Game over**: triggered in `spawn()` when a freshly spawned piece immediately collides.
- Input is a single `keydown` listener (arrows move/rotate/soft-drop, Space hard-drops, `P` toggles pause); `restartBtn` click re-runs `init()`.

Tunable constants at the top of `game.js`: `COLS`, `ROWS`, `BLOCK`, `COLORS`, `LINE_SCORES`, `dropInterval`. If `COLS`/`ROWS`/`BLOCK` change, also update the `#board` canvas `width`/`height` in `index.html` to match (`COLS×BLOCK` and `ROWS×BLOCK`).
