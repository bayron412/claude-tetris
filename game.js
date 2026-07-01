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

const PASTEL_COLORS = [
  null,
  '#b3e5fc', // I
  '#fff9c4', // O
  '#e1bee7', // T
  '#c8e6c9', // S
  '#ffcdd2', // Z
  '#bbdefb', // J
  '#ffe0b2', // L
  '#eceff1', // Nut
];

const NEON_COLORS = [
  null,
  '#00e5ff',
  '#ffea00',
  '#e040fb',
  '#00e676',
  '#ff1744',
  '#448aff',
  '#ff9100',
  '#e0e0e0',
];

const SKINS = {
  retro:  { label: 'Retro',      colors: COLORS,        glow: false, rounded: false, texture: null,      bg: null },
  neon:   { label: 'Neon',       colors: NEON_COLORS,   glow: true,  rounded: false, texture: null,      bg: '#000000' },
  pastel: { label: 'Pastel',     colors: PASTEL_COLORS, glow: false, rounded: true,  texture: null,      bg: null },
  pixel:  { label: 'Pixel Art',  colors: COLORS,        glow: false, rounded: false, texture: 'checker', bg: null },
};
const SKIN_STORAGE_KEY = 'tetris-skin';
let activeSkin = 'retro';

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
const skinSelect = document.getElementById('skin-select');

const highscorePanel = document.getElementById('highscore-panel');
const nameEntry = document.getElementById('name-entry');
const playerNameInput = document.getElementById('player-name');
const saveScoreBtn = document.getElementById('save-score-btn');
const resetScoresBtn = document.getElementById('reset-scores-btn');
const highscoreListEl = document.getElementById('highscore-list');
const highscoreListOverlayEl = document.getElementById('highscore-list-overlay');
const bestComboEl = document.getElementById('best-combo');
const maxLinesEl = document.getElementById('max-lines');
const bestComboOverlayEl = document.getElementById('best-combo-overlay');
const maxLinesOverlayEl = document.getElementById('max-lines-overlay');

const THEME_STORAGE_KEY = 'tetris-theme';
const HIGHSCORE_KEY = 'tetris-highscores';
const STATS_KEY = 'tetris-stats';
const MAX_HIGHSCORES = 5;
let gridColor = '#22222e';
let startLevel = 1;

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, freezeUntil;
let combo, highscores, bestCombo, maxLines, pendingEntry;

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
    combo++;
    if (combo > bestCombo) {
      bestCombo = combo;
      saveStats();
      updateStatsDisplay();
    }
    updateHUD();
  }
  return cleared;
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
  const cleared = clearLines();
  if (cleared === 0) combo = 0;
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

function fillSkinRect(context, x, y, w, h) {
  const skin = SKINS[activeSkin];
  if (skin.rounded) {
    const r = Math.min(6, w / 2, h / 2);
    if (context.roundRect) {
      context.beginPath();
      context.roundRect(x, y, w, h, r);
      context.fill();
    } else {
      context.beginPath();
      context.moveTo(x + r, y);
      context.arcTo(x + w, y, x + w, y + h, r);
      context.arcTo(x + w, y + h, x, y + h, r);
      context.arcTo(x, y + h, x, y, r);
      context.arcTo(x, y, x + w, y, r);
      context.closePath();
      context.fill();
    }
  } else {
    context.fillRect(x, y, w, h);
  }
}

function drawSkinTexture(context, x, y, w, h) {
  const skin = SKINS[activeSkin];
  if (skin.texture !== 'checker') return;
  const cell = Math.max(2, Math.floor(w / 4));
  context.fillStyle = 'rgba(0,0,0,0.15)';
  for (let ry = 0; ry < h; ry += cell) {
    for (let rx = 0; rx < w; rx += cell) {
      const parity = (Math.floor(rx / cell) + Math.floor(ry / cell)) % 2;
      if (parity === 0) context.fillRect(x + rx, y + ry, Math.min(cell, w - rx), Math.min(cell, h - ry));
    }
  }
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const skin = SKINS[activeSkin];
  const color = skin.colors[colorIndex] || COLORS[colorIndex];
  const px = x * size + 1, py = y * size + 1, s = size - 2;
  context.globalAlpha = alpha ?? 1;
  if (skin.glow) {
    context.shadowBlur = 12;
    context.shadowColor = color;
  }
  context.fillStyle = color;
  fillSkinRect(context, px, py, s, s);
  context.shadowBlur = 0;
  context.shadowColor = 'transparent';
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(px, py, s, 4);
  drawSkinTexture(context, px, py, s, s);
  context.globalAlpha = 1;
}

function drawNut(context, x, y, size, alpha) {
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      if (!(r === 1 && c === 1)) drawBlock(context, x + c, y + r, 8, size, alpha);
}

function drawPowerUp(context, x, y, size, power, alpha) {
  const info = POWERUPS[power];
  const skin = SKINS[activeSkin];
  const px = x * size + 1, py = y * size + 1, s = size - 2;
  context.globalAlpha = alpha ?? 1;
  if (skin.glow) {
    context.shadowBlur = 12;
    context.shadowColor = info.color;
  }
  context.fillStyle = info.color;
  fillSkinRect(context, px, py, s, s);
  context.shadowBlur = 0;
  context.shadowColor = 'transparent';
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(px, py, s, 4);
  drawSkinTexture(context, px, py, s, s);
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
  const skin = SKINS[activeSkin];
  if (skin.bg) {
    ctx.fillStyle = skin.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
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
  const skin = SKINS[activeSkin];
  if (skin.bg) {
    nextCtx.fillStyle = skin.bg;
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  }
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

/* ---- Highscores / stats persistence ---- */

function loadHighscores() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HIGHSCORE_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHighscores(list) {
  localStorage.setItem(HIGHSCORE_KEY, JSON.stringify(list));
}

function loadStats() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STATS_KEY)) || {};
    return {
      bestCombo: Number(parsed.bestCombo) || 0,
      maxLines: Number(parsed.maxLines) || 0,
    };
  } catch {
    return { bestCombo: 0, maxLines: 0 };
  }
}

function saveStats() {
  localStorage.setItem(STATS_KEY, JSON.stringify({ bestCombo, maxLines }));
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderHighscoreList(el, highlightEntry) {
  el.innerHTML = '';
  if (!highscores.length) {
    const li = document.createElement('li');
    li.className = 'highscore-empty';
    li.textContent = 'Sin récords todavía';
    el.appendChild(li);
    return;
  }
  highscores.forEach((entry, i) => {
    const li = document.createElement('li');
    li.className = 'highscore-row';
    if (highlightEntry && entry === highlightEntry) li.classList.add('highscore-highlight');
    li.innerHTML = `<span class="hs-rank">${i + 1}.</span><span class="hs-name">${escapeHtml(entry.name)}</span><span class="hs-score">${entry.score.toLocaleString()}</span>`;
    el.appendChild(li);
  });
}

function renderAllHighscores(highlightEntry) {
  renderHighscoreList(highscoreListEl, highlightEntry);
  renderHighscoreList(highscoreListOverlayEl, highlightEntry);
}

function updateStatsDisplay() {
  bestComboEl.textContent = bestCombo;
  maxLinesEl.textContent = maxLines;
  bestComboOverlayEl.textContent = bestCombo;
  maxLinesOverlayEl.textContent = maxLines;
}

function qualifiesForHighscore(candidateScore) {
  if (candidateScore <= 0) return false;
  if (highscores.length < MAX_HIGHSCORES) return true;
  return candidateScore > highscores[highscores.length - 1].score;
}

function saveHighscoreEntry() {
  if (!pendingEntry) return;
  const name = playerNameInput.value.trim().slice(0, 12) || 'AAA';
  pendingEntry.name = name;
  highscores.push(pendingEntry);
  highscores.sort((a, b) => b.score - a.score);
  highscores = highscores.slice(0, MAX_HIGHSCORES);
  saveHighscores(highscores);
  nameEntry.classList.add('hidden');
  renderAllHighscores(pendingEntry);
  pendingEntry = null;
}

function resetRecords() {
  highscores = [];
  saveHighscores(highscores);
  bestCombo = 0;
  maxLines = 0;
  saveStats();
  renderAllHighscores(null);
  updateStatsDisplay();
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  highscorePanel.classList.remove('hidden');

  if (lines > maxLines) {
    maxLines = lines;
    saveStats();
  }

  if (qualifiesForHighscore(score)) {
    pendingEntry = { name: '', score, lines, level, date: new Date().toISOString() };
    playerNameInput.value = '';
    nameEntry.classList.remove('hidden');
    renderAllHighscores(null);
    setTimeout(() => playerNameInput.focus(), 0);
  } else {
    pendingEntry = null;
    nameEntry.classList.add('hidden');
    renderAllHighscores(null);
  }

  updateStatsDisplay();
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
  combo = 0;
  paused = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (startLevel - 1) * 90);
  dropAccum = 0;
  freezeUntil = 0;
  pendingEntry = null;
  lastTime = performance.now();
  next = nextPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  nameEntry.classList.add('hidden');
  renderAllHighscores(null);
  pauseMenu.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (paused || gameOver) return;
  if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'Space'].includes(e.code)) {
    e.preventDefault();
  }
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
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

saveScoreBtn.addEventListener('click', saveHighscoreEntry);
playerNameInput.addEventListener('keydown', e => {
  e.stopPropagation();
  if (e.code === 'Enter') saveHighscoreEntry();
});
resetScoresBtn.addEventListener('click', resetRecords);

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

function applySkin(skin) {
  if (!SKINS[skin]) skin = 'retro';
  activeSkin = skin;
  if (skinSelect) skinSelect.value = skin;
  localStorage.setItem(SKIN_STORAGE_KEY, skin);
  if (current) draw();
  if (next) drawNext();
}

if (skinSelect) {
  skinSelect.addEventListener('change', () => {
    applySkin(skinSelect.value);
  });
}

applyTheme(localStorage.getItem(THEME_STORAGE_KEY) || 'dark');
applySkin(localStorage.getItem(SKIN_STORAGE_KEY) || 'retro');

highscores = loadHighscores();
({ bestCombo, maxLines } = loadStats());
renderAllHighscores(null);
updateStatsDisplay();

init();
