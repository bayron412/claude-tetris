'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#b0bec5', // Nut (tuerca) - gris metálico
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // Nut (tuerca)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const POWERUPS = {
  bomb:    { icon: '💣', color: '#e53935', label: 'Bomba: destruye 3×3' },
  ray:     { icon: '⚡', color: '#fdd835', label: 'Rayo: limpia fila y columna' },
  tint:    { icon: '🎨', color: '#8e24aa', label: 'Tinte: borra un color' },
  gravity: { icon: '⬇',  color: '#43a047', label: 'Gravedad: compacta huecos' },
  freeze:  { icon: '❄',  color: '#00acc1', label: 'Congelar: pausa la caída 5s' },
};
const POWERUP_TYPES = Object.keys(POWERUPS);
const POWERUP_CHANCE = 0.1;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeSwitch = document.getElementById('theme-switch');
const pauseMenu = document.getElementById('pause-menu');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const startLevelInput = document.getElementById('start-level-input');

const THEME_STORAGE_KEY = 'tetris-theme';
let gridColor = '#22222e';
let startLevel = 1;

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, freezeUntil;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function randomPowerUp() {
  const power = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
  return { type: 'power', power, shape: [[1]], x: Math.floor(COLS / 2), y: 0 };
}

function nextPiece() {
  return Math.random() < POWERUP_CHANCE ? randomPowerUp() : randomPiece();
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = startLevel + Math.floor(lines / 10);
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function applyGravity() {
  for (let c = 0; c < COLS; c++) {
    const values = [];
    for (let r = 0; r < ROWS; r++) {
      if (board[r][c]) values.push(board[r][c]);
    }
    for (let r = ROWS - 1; r >= 0; r--) {
      board[r][c] = values.length ? values.pop() : 0;
    }
  }
}

function powerBomb(x, y) {
  for (let r = y - 1; r <= y + 1; r++) {
    if (r < 0 || r >= ROWS) continue;
    for (let c = x - 1; c <= x + 1; c++) {
      if (c < 0 || c >= COLS) continue;
      board[r][c] = 0;
    }
  }
  applyGravity();
}

function powerRay(x, y) {
  if (y >= 0 && y < ROWS) board[y].fill(0);
  for (let r = 0; r < ROWS; r++) board[r][x] = 0;
}

function powerTint(x, y) {
  let targetColor = 0;
  for (let r = y; r < ROWS; r++) {
    if (board[r][x]) { targetColor = board[r][x]; break; }
  }
  if (!targetColor) return;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c] === targetColor) board[r][c] = 0;
  applyGravity();
}

function powerGravity() {
  applyGravity();
}

function powerFreeze() {
  freezeUntil = performance.now() + 5000;
}

function applyPowerUp(piece) {
  switch (piece.power) {
    case 'bomb': powerBomb(piece.x, piece.y); break;
    case 'ray': powerRay(piece.x, piece.y); break;
    case 'tint': powerTint(piece.x, piece.y); break;
    case 'gravity': powerGravity(); break;
    case 'freeze': powerFreeze(); break;
  }
}

function lockPiece() {
  if (current.power) {
    applyPowerUp(current);
  } else {
    merge();
  }
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = nextPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawNut(context, x, y, size, alpha) {
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      if (!(r === 1 && c === 1)) drawBlock(context, x + c, y + r, 8, size, alpha);
}

function drawPowerUp(context, x, y, size, power, alpha) {
  const info = POWERUPS[power];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = info.color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.font = `${Math.floor(size * 0.6)}px sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(info.icon, x * size + size / 2, y * size + size / 2 + 1);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  if (current.power) {
    drawPowerUp(ctx, current.x, gy, BLOCK, current.power, 0.2);
  } else if (current.type === 8) {
    drawNut(ctx, current.x, gy, BLOCK, 0.2);
  } else {
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);
  }

  // current piece
  if (current.power) {
    drawPowerUp(ctx, current.x, current.y, BLOCK, current.power);
  } else if (current.type === 8) {
    drawNut(ctx, current.x, current.y, BLOCK);
  } else {
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
  }
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  if (next.power) {
    drawPowerUp(nextCtx, offX, offY, NB, next.power);
  } else if (next.type === 8) {
    drawNut(nextCtx, offX, offY, NB);
  } else {
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
  }
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    pauseMenu.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    startLevelInput.value = startLevel;
    pauseMenu.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  if (ts < freezeUntil) {
    dropAccum = 0;
  } else {
    dropAccum += dt;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lockPiece();
      }
    }
  }
  if (gameOver || paused) return;
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  paused = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (startLevel - 1) * 90);
  dropAccum = 0;
  freezeUntil = 0;
  lastTime = performance.now();
  next = nextPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  pauseMenu.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

resumeBtn.addEventListener('click', () => {
  if (paused) togglePause();
});

pauseRestartBtn.addEventListener('click', () => {
  init();
});

startLevelInput.addEventListener('change', () => {
  let v = parseInt(startLevelInput.value, 10);
  if (Number.isNaN(v)) v = 1;
  v = Math.min(15, Math.max(1, v));
  startLevel = v;
  startLevelInput.value = v;
});

function applyTheme(theme) {
  document.body.classList.toggle('light-theme', theme === 'light');
  themeSwitch.checked = theme === 'light';
  gridColor = getComputedStyle(document.body).getPropertyValue('--grid-line-color').trim();
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

themeSwitch.addEventListener('change', () => {
  applyTheme(themeSwitch.checked ? 'light' : 'dark');
});

applyTheme(localStorage.getItem(THEME_STORAGE_KEY) || 'dark');

init();
