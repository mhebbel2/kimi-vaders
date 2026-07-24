/* ============================================================
   SPACE INVADERS — mobile web edition
   Classic arcade rules at the original 224x256 resolution.
   Controls: drag to move, tap (or FIRE button) to shoot.
   ============================================================ */
(() => {
'use strict';

/* ================= Canvas & scaling ================= */
const W = 224, H = 256;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  const controls = document.getElementById('controls');
  const availW = window.innerWidth - 4;
  const availH = window.innerHeight - controls.offsetHeight - 10;
  const scale = Math.max(0.4, Math.min(availW / W, availH / H));
  canvas.style.width  = Math.round(W * scale) + 'px';
  canvas.style.height = Math.round(H * scale) + 'px';
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 150));

/* ================= Audio (Web Audio, no assets) ================= */
let AC = null, master = null, noiseBuf = null, ufoNodes = null;

function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain();
    master.gain.value = 0.5;
    master.connect(AC.destination);
    noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { AC = null; }
}
function beep(freq, dur, type, vol, slideTo) {
  if (!AC) return;
  const t = AC.currentTime;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type || 'square';
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
  g.gain.setValueAtTime(vol || 0.2, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.03);
}
function noiseBurst(dur, vol, cutoff) {
  if (!AC) return;
  const t = AC.currentTime;
  const s = AC.createBufferSource(); s.buffer = noiseBuf;
  const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff || 1000;
  const g = AC.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t); s.stop(t + dur + 0.03);
}
function ufoSoundStart() {
  if (!AC || ufoNodes) return;
  const osc = AC.createOscillator(), g = AC.createGain();
  const lfo = AC.createOscillator(), lg = AC.createGain();
  osc.type = 'sawtooth'; osc.frequency.value = 260;
  lfo.type = 'sine'; lfo.frequency.value = 7; lg.gain.value = 140;
  lfo.connect(lg); lg.connect(osc.frequency);
  g.gain.value = 0.045;
  osc.connect(g); g.connect(master);
  osc.start(); lfo.start();
  ufoNodes = { osc, lfo };
}
function ufoSoundStop() {
  if (!ufoNodes) return;
  try { ufoNodes.osc.stop(); ufoNodes.lfo.stop(); } catch (e) {}
  ufoNodes = null;
}
const sfx = {
  shoot()      { beep(950, 0.12, 'square', 0.10, 140); },
  invaderDie() { noiseBurst(0.16, 0.30, 1600); },
  playerDie()  { noiseBurst(0.70, 0.40, 320); },
  march(i)     { beep([118, 110, 104, 98][i % 4], 0.08, 'triangle', 0.28); },
  ufoDie()     { beep(1500, 0.28, 'sawtooth', 0.18, 180); },
  extra()      { [660, 880, 1175].forEach((f, i) => setTimeout(() => beep(f, 0.1, 'square', 0.16), i * 100)); }
};
document.addEventListener('visibilitychange', () => {
  if (!AC) return;
  if (document.hidden) AC.suspend(); else AC.resume();
});

/* ================= Sprites (classic bitmaps) ================= */
function makeSprite(rows, color) {
  const c = document.createElement('canvas');
  c.width = rows[0].length;
  c.height = rows.length;
  const g = c.getContext('2d');
  g.fillStyle = color;
  for (let y = 0; y < rows.length; y++)
    for (let x = 0; x < rows[y].length; x++)
      if (rows[y][x] === 'X') g.fillRect(x, y, 1, 1);
  return c;
}

const COLORS = { squid: '#8df9ff', crab: '#7cff6b', octopus: '#ffd76b' };

const SPR = {
  squid: [
    makeSprite(['...XX...','..XXXX..','.XXXXXX.','XX.XX.XX','XXXXXXXX','..X..X..','.X.XX.X.','X.X..X.X'], COLORS.squid),
    makeSprite(['...XX...','..XXXX..','.XXXXXX.','XX.XX.XX','XXXXXXXX','.X.XX.X.','X......X','.X....X.'], COLORS.squid)
  ],
  crab: [
    makeSprite(['..X.....X..','...X...X...','..XXXXXXX..','.XX.XXX.XX.','XXXXXXXXXXX','X.XXXXXXX.X','X.X.....X.X','...XX.XX...'], COLORS.crab),
    makeSprite(['..X.....X..','X..X...X..X','X.XXXXXXX.X','XXX.XXX.XXX','XXXXXXXXXXX','.XXXXXXXXX.','..X.....X..','.X.......X.'], COLORS.crab)
  ],
  octopus: [
    makeSprite(['....XXXX....','.XXXXXXXXXX.','XXXXXXXXXXXX','XXX..XX..XXX','XXXXXXXXXXXX','...XX..XX...','..XX.XX.XX..','XX........XX'], COLORS.octopus),
    makeSprite(['....XXXX....','.XXXXXXXXXX.','XXXXXXXXXXXX','XXX..XX..XXX','XXXXXXXXXXXX','..XXX..XXX..','.XX..XX..XX.','..XX....XX..'], COLORS.octopus)
  ],
  player: makeSprite(['......X......','.....XXX.....','.....XXX.....','.XXXXXXXXXXX.','XXXXXXXXXXXXX','XXXXXXXXXXXXX','XXXXXXXXXXXXX','XXXXXXXXXXXXX'], '#3dff5c'),
  ufo: makeSprite(['.....XXXXXX.....','...XXXXXXXXXX...','..XXXXXXXXXXXX..','.XX.XXX..XXX.XX.','XXXXXXXXXXXXXXXX','..XXXX.XX.XXXX..','...XX......XX...'], '#ff4040')
};

const BOMB_SPR = {
  plunger: [
    makeSprite(['.X.','XXX','.X.','.X.','XXX','.X.'], '#ffffff'),
    makeSprite(['.X.','.X.','XXX','.X.','.X.','XXX'], '#ffffff')
  ],
  zig: [
    makeSprite(['..X','.X.','X..','.X.','..X','.X.'], '#ffffff'),
    makeSprite(['X..','.X.','..X','.X.','X..','.X.'], '#ffffff')
  ]
};

const SHIELD_ROWS = [
  '.XXXXXXXXX.',
  'XXXXXXXXXXX',
  'XXXXXXXXXXX',
  'XXXXXXXXXXX',
  'XXXXXXXXXXX',
  'XXXX...XXXX',
  'XXX.....XXX',
  'XXX.....XXX'
];

/* ================= Game state ================= */
const PLAYER_W = 13, PLAYER_H = 8, PLAYER_Y = 224;
const SHIELD_Y = 194;

let state = 'title';           // title | playing | dying | waveclear | gameover
let score = 0, hi = 0, lives = 3, wave = 1;
let extraGiven = false;
try { hi = parseInt(localStorage.getItem('si_hi') || '0', 10) || 0; } catch (e) {}

const player = { x: (W - PLAYER_W) / 2, targetX: (W - PLAYER_W) / 2 };
let invaders = [];
let invDir = 1, stepTimer = 0, stepInterval = 500, marchIdx = 0;
let bullet = null;
let bombs = [], bombTimer = 1;
let shields = [];
let ufo = null, ufoTimer = 10;
let particles = [], texts = [];
let dyingT = 0, clearT = 0, blinkT = 0;

/* input flags */
let keyL = false, keyR = false, btnL = false, btnR = false;
let fireHeld = false, fireCd = 0;

const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const pad4 = n => String(n).padStart(4, '0');

/* ================= Shields (destructible) ================= */
function buildShields() {
  shields = [];
  [17, 73, 129, 185].forEach(x => {
    const cells = [];
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 11; c++)
        cells.push(SHIELD_ROWS[r][c] === 'X' ? 1 : 0);
    const cv = document.createElement('canvas');
    cv.width = 22; cv.height = 16;
    const s = { x, y: SHIELD_Y, cells, cv };
    shields.push(s);
    drawShield(s);
  });
}
function drawShield(s) {
  const g = s.cv.getContext('2d');
  g.clearRect(0, 0, 22, 16);
  g.fillStyle = '#3dff5c';
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 11; c++)
      if (s.cells[r * 11 + c]) g.fillRect(c * 2, r * 2, 2, 2);
}
function carveShield(s, cx, cy) {
  for (let r = Math.max(0, cy - 3); r <= Math.min(7, cy + 3); r++)
    for (let c = Math.max(0, cx - 3); c <= Math.min(10, cx + 3); c++)
      if ((r - cy) * (r - cy) + (c - cx) * (c - cx) <= 6) s.cells[r * 11 + c] = 0;
  drawShield(s);
}
function clearShieldRect(s, rx, ry, rw, rh) {
  const c0 = clamp(Math.floor((rx - s.x) / 2), 0, 10);
  const c1 = clamp(Math.floor((rx + rw - 1 - s.x) / 2), 0, 10);
  const r0 = clamp(Math.floor((ry - s.y) / 2), 0, 7);
  const r1 = clamp(Math.floor((ry + rh - 1 - s.y) / 2), 0, 7);
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++) s.cells[r * 11 + c] = 0;
  drawShield(s);
}
function shieldHit(px, py) {
  for (const s of shields) {
    if (px >= s.x && px < s.x + 22 && py >= s.y && py < s.y + 16) {
      const cx = Math.floor((px - s.x) / 2), cy = Math.floor((py - s.y) / 2);
      if (s.cells[cy * 11 + cx]) { carveShield(s, cx, cy); return true; }
    }
  }
  return false;
}

/* ================= Wave / game setup ================= */
function initWave() {
  invaders = [];
  const top = 56 + Math.min(wave - 1, 4) * 8;
  for (let r = 0; r < 5; r++) {
    const type = r === 0 ? 'squid' : (r < 3 ? 'crab' : 'octopus');
    const img = SPR[type][0];
    const offX = Math.floor((16 - img.width) / 2);
    for (let c = 0; c < 11; c++) {
      invaders.push({
        col: c, x: 24 + c * 16 + offX, y: top + r * 16,
        w: img.width, h: img.height, type, frame: 0, alive: true,
        points: type === 'squid' ? 30 : type === 'crab' ? 20 : 10
      });
    }
  }
  invDir = 1; stepTimer = 0; marchIdx = 0;
  stepInterval = 500;
  bullet = null; bombs = [];
  bombTimer = 1.2;
  ufo = null; ufoTimer = 8 + Math.random() * 10;
  ufoSoundStop();
}

function startGame() {
  score = 0; lives = 3; wave = 1; extraGiven = false;
  player.x = (W - PLAYER_W) / 2; player.targetX = player.x;
  particles = []; texts = [];
  buildShields();
  initWave();
  state = 'playing';
}

function gameOver() {
  state = 'gameover';
  ufoSoundStop();
  if (score > hi) {
    hi = score;
    try { localStorage.setItem('si_hi', String(hi)); } catch (e) {}
  }
}

/* ================= FX helpers ================= */
function puff(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 20 + Math.random() * 50;
    particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, t: 0, life: 0.35 + Math.random() * 0.25, color });
  }
}
function bigBoom(x, y, color) {
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2, sp = 30 + Math.random() * 90;
    particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: 0.6 + Math.random() * 0.5, color });
  }
}
function floatText(x, y, str, color) {
  texts.push({ x, y, str, color, t: 0, life: 0.9 });
}
function updateFx(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 60 * dt;
    if (p.t >= p.life) particles.splice(i, 1);
  }
  for (let i = texts.length - 1; i >= 0; i--) {
    const t = texts[i];
    t.t += dt; t.y -= 14 * dt;
    if (t.t >= t.life) texts.splice(i, 1);
  }
}

/* ================= Gameplay ================= */
function tryShoot() {
  if (state !== 'playing' || bullet) return;
  bullet = { x: Math.round(player.x + 6), y: PLAYER_Y - 5 };
  sfx.shoot();
}

function checkExtraLife() {
  if (!extraGiven && score >= 1500) {
    extraGiven = true; lives++;
    sfx.extra();
    floatText(W / 2, 150, 'EXTRA SHIP!', '#3dff5c');
  }
}

function killInvader(inv) {
  inv.alive = false;
  score += inv.points;
  puff(inv.x + inv.w / 2, inv.y + inv.h / 2, COLORS[inv.type], 10);
  sfx.invaderDie();
  checkExtraLife();
  if (invaders.every(i => !i.alive)) {
    state = 'waveclear';
    clearT = 1.6;
    ufo = null;
    ufoSoundStop();
  }
}

function hitUfo() {
  const pts = [50, 100, 150, 300][Math.floor(Math.random() * 4)];
  score += pts;
  floatText(ufo.x + 8, ufo.y - 8, '+' + pts, '#ff4040');
  puff(ufo.x + 8, ufo.y + 4, '#ff4040', 14);
  sfx.ufoDie();
  ufo = null;
  ufoSoundStop();
  ufoTimer = 12 + Math.random() * 12;
  bullet = null;
  checkExtraLife();
}

function playerDie() {
  state = 'dying';
  dyingT = 1.2;
  bullet = null; bombs = [];
  bigBoom(player.x + 6, PLAYER_Y + 4, '#3dff5c');
  sfx.playerDie();
}

function stepInvaders() {
  let minX = 1e9, maxX = -1e9;
  for (const i of invaders) if (i.alive) {
    if (i.x < minX) minX = i.x;
    if (i.x + i.w > maxX) maxX = i.x + i.w;
  }
  const dx = 4;
  const drop = (invDir > 0 && maxX + dx > W - 8) || (invDir < 0 && minX - dx < 8);
  for (const i of invaders) {
    if (!i.alive) continue;
    if (drop) i.y += 8; else i.x += dx * invDir;
    i.frame ^= 1;
  }
  if (drop) invDir *= -1;

  // invaders plow through shields
  for (const s of shields)
    for (const i of invaders)
      if (i.alive && i.x < s.x + 22 && i.x + i.w > s.x && i.y < s.y + 16 && i.y + i.h > s.y)
        clearShieldRect(s, i.x, i.y, i.w, i.h);

  let bottom = 0, alive = 0;
  for (const i of invaders) if (i.alive) {
    alive++;
    if (i.y + i.h > bottom) bottom = i.y + i.h;
  }
  if (bottom >= PLAYER_Y + 2) { gameOver(); return; }   // invasion!

  sfx.march(marchIdx++);
  stepInterval = Math.max(30, (30 + 470 * alive / 55) * Math.pow(0.93, wave - 1));
}

function spawnBomb() {
  const byCol = {};
  for (const i of invaders)
    if (i.alive && (!byCol[i.col] || i.y > byCol[i.col].y)) byCol[i.col] = i;
  const cols = Object.keys(byCol);
  if (!cols.length) return;
  const src = byCol[cols[Math.floor(Math.random() * cols.length)]];
  bombs.push({
    x: Math.round(src.x + src.w / 2 - 1), y: src.y + src.h,
    speed: 95 + wave * 8, anim: Math.random(),
    type: Math.random() < 0.5 ? 'plunger' : 'zig'
  });
}

function updatePlaying(dt) {
  /* player movement: buttons/keys + drag target */
  let mv = 0;
  if (keyL || btnL) mv -= 1;
  if (keyR || btnR) mv += 1;
  if (mv !== 0) {
    player.x += mv * 165 * dt;
    player.targetX = player.x;
  } else {
    const d = player.targetX - player.x, s = 340 * dt;
    player.x += Math.abs(d) <= s ? d : Math.sign(d) * s;
  }
  player.x = clamp(player.x, 8, W - 8 - PLAYER_W);

  /* held fire button auto-repeats */
  fireCd -= dt;
  if (fireHeld && fireCd <= 0) { tryShoot(); fireCd = 0.16; }

  /* invader marching */
  stepTimer += dt * 1000;
  if (stepTimer >= stepInterval) {
    stepTimer = 0;
    stepInvaders();
    if (state !== 'playing') return;
  }

  /* player bullet */
  if (bullet) {
    bullet.y -= 260 * dt;
    if (bullet.y < 24) { puff(bullet.x, 24, '#fff', 3); bullet = null; }
    else if (ufo && bullet.x >= ufo.x && bullet.x <= ufo.x + 16 && bullet.y >= ufo.y && bullet.y <= ufo.y + 7) hitUfo();
    else {
      for (const i of invaders) {
        if (i.alive && bullet.x >= i.x - 1 && bullet.x <= i.x + i.w + 1 && bullet.y >= i.y && bullet.y <= i.y + i.h) {
          killInvader(i); bullet = null; break;
        }
      }
      if (bullet) {
        for (let k = bombs.length - 1; k >= 0; k--) {
          const b = bombs[k];
          if (bullet.x >= b.x - 1 && bullet.x <= b.x + 4 && bullet.y >= b.y && bullet.y <= b.y + 6) {
            puff(b.x + 1, b.y + 3, '#fff', 6);
            bombs.splice(k, 1); bullet = null; break;
          }
        }
      }
      if (bullet && (shieldHit(bullet.x, bullet.y) || shieldHit(bullet.x, bullet.y + 3))) bullet = null;
    }
  }

  /* invader bombs */
  for (let k = bombs.length - 1; k >= 0; k--) {
    const b = bombs[k];
    b.y += b.speed * dt;
    b.anim += dt;
    if (b.y > 238) { puff(b.x, 238, '#fff', 3); bombs.splice(k, 1); continue; }
    if (shieldHit(b.x + 1, b.y + 6)) { bombs.splice(k, 1); continue; }
    if (b.x + 3 > player.x && b.x < player.x + PLAYER_W && b.y + 6 > PLAYER_Y && b.y < PLAYER_Y + PLAYER_H) {
      bombs.splice(k, 1);
      playerDie();
      return;
    }
  }

  /* bomb spawning */
  bombTimer -= dt;
  if (bombTimer <= 0) {
    bombTimer = Math.max(0.35, 1.1 - wave * 0.08) * (0.5 + Math.random());
    if (bombs.length < Math.min(3, 1 + wave)) spawnBomb();
  }

  /* mystery UFO */
  if (ufo) {
    ufo.x += ufo.dir * ufo.speed * dt;
    if (ufo.x < -20 || ufo.x > W + 4) { ufo = null; ufoSoundStop(); ufoTimer = 12 + Math.random() * 12; }
  } else {
    ufoTimer -= dt;
    if (ufoTimer <= 0) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      ufo = { x: dir > 0 ? -18 : W + 2, y: 26, dir, speed: 50 + wave * 3 };
      ufoSoundStart();
    }
  }

  updateFx(dt);
}

function update(dt) {
  blinkT += dt;
  if (state === 'playing') updatePlaying(dt);
  else if (state === 'dying') {
    updateFx(dt);
    dyingT -= dt;
    if (dyingT <= 0) {
      lives--;
      if (lives <= 0) gameOver();
      else state = 'playing';
    }
  } else if (state === 'waveclear') {
    updateFx(dt);
    clearT -= dt;
    if (clearT <= 0) { wave++; initWave(); state = 'playing'; }
  }
}

/* ================= Rendering ================= */
function text(str, x, y, color, size, align) {
  ctx.font = 'bold ' + (size || 8) + 'px "Courier New", monospace';
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = color || '#3dff5c';
  ctx.fillText(str, x, y);
}

function render() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  if (state === 'title') { renderTitle(); return; }

  /* HUD */
  text('SCORE', 8, 2, '#3dff5c', 7);
  text(pad4(score), 8, 10, '#fff', 7);
  text('HI-SCORE', W / 2, 2, '#3dff5c', 7, 'center');
  text(pad4(hi), W / 2, 10, '#fff', 7, 'center');
  text('WAVE ' + wave, W - 8, 2, '#3dff5c', 7, 'right');

  if (ufo) ctx.drawImage(SPR.ufo, Math.round(ufo.x), ufo.y);

  for (const i of invaders)
    if (i.alive) ctx.drawImage(SPR[i.type][i.frame], Math.round(i.x), Math.round(i.y));

  for (const s of shields) ctx.drawImage(s.cv, s.x, s.y);

  for (const b of bombs) {
    const f = Math.floor(b.anim * 12) % 2;
    ctx.drawImage(BOMB_SPR[b.type][f], Math.round(b.x), Math.round(b.y));
  }

  if (bullet) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(Math.round(bullet.x), Math.round(bullet.y), 1, 4);
  }

  if (state !== 'dying') ctx.drawImage(SPR.player, Math.round(player.x), PLAYER_Y);

  for (const p of particles) {
    ctx.globalAlpha = 1 - p.t / p.life;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x | 0, p.y | 0, 2, 2);
  }
  ctx.globalAlpha = 1;

  for (const t of texts) {
    ctx.globalAlpha = 1 - t.t / t.life;
    text(t.str, t.x, t.y, t.color, 7, 'center');
  }
  ctx.globalAlpha = 1;

  /* ground line + lives */
  ctx.fillStyle = '#3dff5c';
  ctx.fillRect(8, 239, W - 16, 1);
  text(String(lives), 10, 244, '#3dff5c', 7);
  for (let i = 0; i < lives - 1 && i < 5; i++)
    ctx.drawImage(SPR.player, 24 + i * 15, 244);
  text('WAVE ' + wave, W - 10, 244, '#3dff5c', 7, 'right');

  if (state === 'waveclear' && Math.floor(blinkT * 3) % 2 === 0)
    text('WAVE ' + wave + ' CLEARED!', W / 2, 120, '#fff', 10, 'center');

  if (state === 'gameover') {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 90, W, 70);
    text('GAME OVER', W / 2, 100, '#ff4040', 16, 'center');
    text('SCORE ' + pad4(score), W / 2, 124, '#fff', 8, 'center');
    if (Math.floor(blinkT * 2) % 2 === 0)
      text('TAP TO RESTART', W / 2, 144, '#3dff5c', 8, 'center');
  }
}

function renderTitle() {
  text('PLAY', W / 2, 40, '#3dff5c', 12, 'center');
  text('SPACE', W / 2, 60, '#3dff5c', 20, 'center');
  text('INVADERS', W / 2, 82, '#fff', 20, 'center');

  text('*SCORE ADVANCE TABLE*', W / 2, 112, '#fff', 7, 'center');
  ctx.drawImage(SPR.ufo, 56, 124);
  text('= ? MYSTERY', 80, 124, '#fff', 8);
  ctx.drawImage(SPR.squid[0], 60, 136);
  text('= 30 PTS', 80, 136, COLORS.squid, 8);
  ctx.drawImage(SPR.crab[0], 59, 148);
  text('= 20 PTS', 80, 148, COLORS.crab, 8);
  ctx.drawImage(SPR.octopus[0], 58, 160);
  text('= 10 PTS', 80, 160, COLORS.octopus, 8);

  text('DRAG TO MOVE - TAP TO SHOOT', W / 2, 196, COLORS.squid, 7, 'center');
  if (Math.floor(blinkT * 2) % 2 === 0)
    text('TAP TO START', W / 2, 214, '#3dff5c', 10, 'center');
  text('HI-SCORE ' + pad4(hi), W / 2, 238, '#fff', 7, 'center');
}

/* ================= Input: touch / pointer ================= */
const btnLeft = document.getElementById('btnLeft');
const btnRight = document.getElementById('btnRight');
const btnFire = document.getElementById('btnFire');

let dragging = false, downT = 0, downX = 0;

function targetFromEvent(e) {
  const r = canvas.getBoundingClientRect();
  const lx = (e.clientX - r.left) / r.width * W;
  player.targetX = clamp(lx - PLAYER_W / 2, 8, W - 8 - PLAYER_W);
}
canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  initAudio();
  if (state === 'title' || state === 'gameover') { startGame(); return; }
  dragging = true; downT = performance.now(); downX = e.clientX;
  targetFromEvent(e);
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
});
canvas.addEventListener('pointermove', e => {
  if (!dragging) return;
  e.preventDefault();
  targetFromEvent(e);
});
canvas.addEventListener('pointerup', e => {
  if (!dragging) return;
  dragging = false;
  if (performance.now() - downT < 250 && Math.abs(e.clientX - downX) < 14) tryShoot();
});
canvas.addEventListener('pointercancel', () => { dragging = false; });

function bindHold(el, on, off) {
  el.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation();
    initAudio(); on();
    try { el.setPointerCapture(e.pointerId); } catch (err) {}
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev =>
    el.addEventListener(ev, e => { e.preventDefault(); off(); }));
}
bindHold(btnLeft,  () => { btnL = true; },  () => { btnL = false; });
bindHold(btnRight, () => { btnR = true; },  () => { btnR = false; });
bindHold(btnFire,
  () => {
    if (state === 'title' || state === 'gameover') { startGame(); return; }
    fireHeld = true; fireCd = 0; tryShoot();
  },
  () => { fireHeld = false; });

/* ================= Input: keyboard (desktop) ================= */
window.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === ' ') e.preventDefault();
  initAudio();
  if (e.key === 'ArrowLeft') keyL = true;
  else if (e.key === 'ArrowRight') keyR = true;
  else if (e.key === ' ') {
    if (state === 'title' || state === 'gameover') startGame();
    else { fireHeld = true; tryShoot(); }
  }
});
window.addEventListener('keyup', e => {
  if (e.key === 'ArrowLeft') keyL = false;
  else if (e.key === 'ArrowRight') keyR = false;
  else if (e.key === ' ') fireHeld = false;
});

/* stop page scroll / pinch-zoom / long-press menu */
document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());

/* ================= Main loop ================= */
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}
resize();
requestAnimationFrame(frame);

})();
