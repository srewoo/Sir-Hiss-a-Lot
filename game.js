(() => {
"use strict";

// ==========================================
// 1. CONFIGURATION & TUNING
// ==========================================
const CFG = {
  speed: 175,          // base cruise speed px/s
  sprint: 285,         // base sprint speed px/s
  turn: 3.8,           // rad/sec turn rate
  cardinalTurn: 6.8,   // fast crisp turning when using 4-way arrow keys
  spacing: 4.8,        // distance between spine nodes
  startLen: 90,        // starting spine points
  growPer: 28,         // spine points gained per apple
  headR: 20,           // head radius
  bodyR: 19,           // body radius
  apples: 4,           // apples on screen
  wrapWalls: true,     // wrap boundaries
  passThroughSelf: false, // self collision
  controlScheme: 'cardinal', // 'cardinal', 'slither', 'mouse'
  screenShake: true,
  obstacles: 'standard', // 'none', 'standard', 'dense'
  difficulty: 'normal'   // 'easy', 'normal', 'hard'
};

// Difficulty tuning. Everything scaled off the Medium baseline above.
const DIFFICULTY = {
  easy:   { label: 'Easy',      short: 'Easy', speed: 0.80, turn: 1.15, obstacles: 0.5, growth: 0.55, score: 0.75, apples: 5 },
  normal: { label: 'Medium',    short: 'Med',  speed: 1.00, turn: 1.00, obstacles: 1.0, growth: 1.00, score: 1.00, apples: 4 },
  hard:   { label: 'Difficult', short: 'Hard', speed: 1.28, turn: 0.88, obstacles: 1.7, growth: 1.45, score: 1.60, apples: 3 }
};
const diff = () => DIFFICULTY[CFG.difficulty];

// Respect the OS "reduce motion" setting: no screen shake, no drifting fireflies.
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (REDUCED_MOTION) CFG.screenShake = false;

// ---- Persistence (localStorage; survives in an extension page just like a web page) ----
const SETTINGS_KEY = 'hiss_settings', STATS_KEY = 'hiss_stats';
const readJSON = (key, fallback) => {
  try { return Object.assign({}, fallback, JSON.parse(localStorage.getItem(key)) || {}); }
  catch { return Object.assign({}, fallback); }
};
const writeJSON = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };

const stats = readJSON(STATS_KEY, {
  games: 0, apples: 0, recent: [], bestBy: { easy: 0, normal: 0, hard: 0 }
});
// One-time migration from the pre-rename single high score.
const legacyBest = +(localStorage.getItem('viper_best_score') || 0);
if (legacyBest > stats.bestBy.normal) { stats.bestBy.normal = legacyBest; writeJSON(STATS_KEY, stats); }

function saveSettings() {
  writeJSON(SETTINGS_KEY, {
    difficulty: CFG.difficulty, controlScheme: CFG.controlScheme,
    obstacles: CFG.obstacles, wrapWalls: CFG.wrapWalls, skin: currentSkinKey
  });
}

// Skin Palettes & Ground Aesthetics
const SKINS = {
  green: {
    name: 'Emerald Viper',
    bodyTop: '#2f7f55', bodyBot: '#143d2a', rim: '150,240,185', dark: '8,40,26',
    headTop: '#3d9a67', headMid: '#2c7c52', headBot: '#123d28', eye: '#f6d64a',
    ground: ['#12281f', '#0c1c16', '#060f0c'], blade: '80,190,110', accent: '#5ef2a8',
    rune: 'rgba(94, 242, 168, 0.7)'
  },
  cyan: {
    name: 'Azure Cobra',
    bodyTop: '#286f9a', bodyBot: '#10273c', rim: '150,225,255', dark: '6,26,44',
    headTop: '#3a87b9', headMid: '#286a97', headBot: '#102e45', eye: '#7fe9ff',
    ground: ['#13202b', '#0c1620', '#060c13'], blade: '85,165,210', accent: '#5ec8f2',
    rune: 'rgba(94, 200, 242, 0.7)'
  },
  ruby: {
    name: 'Ruby Pit Viper',
    bodyTop: '#9e2d35', bodyBot: '#3d1217', rim: '255,170,180', dark: '48,10,14',
    headTop: '#b83b44', headMid: '#942630', headBot: '#451016', eye: '#ffd76b',
    ground: ['#281416', '#1c0c0e', '#100607'], blade: '200,90,100', accent: '#ff6b7d',
    rune: 'rgba(255, 107, 125, 0.7)'
  },
  gold: {
    name: 'Golden Python',
    bodyTop: '#a8812c', bodyBot: '#3d2e10', rim: '255,230,160', dark: '45,34,8',
    headTop: '#c49a37', headMid: '#a07823', headBot: '#45320c', eye: '#5ef2a8',
    ground: ['#241f12', '#1a160c', '#100d06'], blade: '195,165,75', accent: '#ffd76b',
    rune: 'rgba(255, 215, 107, 0.7)'
  }
};

let currentSkinKey = 'green';
let activeSkin = SKINS.green;

const COMBO_NOTES = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00];

// ==========================================
// 2. SYNTHESIZED PROCEDURAL WEB AUDIO SFX
// ==========================================
// Embedded hiss.ogg audio asset
const HISS_OGG_B64 = "data:audio/ogg;base64,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";

class SoundController {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.soundBusyUntil = 0;
    this.hissBuffer = null;
    this.hissSource = null;
    this.hissGain = null;
    this.isHissPlaying = false;
    this.hissAudio = null;
    this.lastHissTime = 0;
  }
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      this.ctx = new AudioCtx();
      this.loadHissAudio();
    }
  }
  loadHissAudio() {
    if (this.hissBuffer) return;
    try {
      const b64Data = HISS_OGG_B64.split(',')[1];
      const binaryStr = atob(b64Data);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binaryStr.charCodeAt(i);
      if (this.ctx) {
        this.ctx.decodeAudioData(bytes.buffer.slice(0), decoded => {
          this.hissBuffer = decoded;
        }, () => {
          this.hissAudio = new Audio(HISS_OGG_B64);
        });
      } else {
        this.hissAudio = new Audio(HISS_OGG_B64);
      }
    } catch(e) {
      try { this.hissAudio = new Audio(HISS_OGG_B64); } catch(err) {}
    }
  }
  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) this.stopHiss();
    return !this.muted;
  }
  isSoundBusy() {
    return (performance.now() < this.soundBusyUntil) || this.isHissPlaying;
  }
  stopHiss() {
    if (this.hissSource) {
      try {
        if (this.hissGain && this.ctx) {
          this.hissGain.gain.setValueAtTime(this.hissGain.gain.value, this.ctx.currentTime);
          this.hissGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.04);
        }
        this.hissSource.stop(this.ctx.currentTime + 0.05);
      } catch(e) {}
      this.hissSource = null;
    }
    if (this.hissAudio) {
      try {
        this.hissAudio.pause();
        this.hissAudio.currentTime = 0;
      } catch(e) {}
    }
    this.isHissPlaying = false;
  }
  playHissOgg(force = false) {
    if (!force && (this.muted || this.isSoundBusy())) return;
    if (this.muted) return;
    this.init();

    if (this.hissBuffer && this.ctx) {
      try {
        this.stopHiss();
        const source = this.ctx.createBufferSource();
        source.buffer = this.hissBuffer;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.38, this.ctx.currentTime);
        source.connect(gain);
        gain.connect(this.ctx.destination);

        this.hissSource = source;
        this.hissGain = gain;
        this.isHissPlaying = true;
        const duration = this.hissBuffer.duration || 1.8;
        this.soundBusyUntil = performance.now() + duration * 1000;

        source.onended = () => {
          if (this.hissSource === source) {
            this.isHissPlaying = false;
            this.hissSource = null;
          }
        };

        source.start(this.ctx.currentTime);
      } catch(e) {
        this.isHissPlaying = false;
      }
    } else if (this.hissAudio) {
      try {
        this.stopHiss();
        this.isHissPlaying = true;
        this.hissAudio.currentTime = 0;
        this.hissAudio.volume = 0.38;
        this.soundBusyUntil = performance.now() + 1800;
        this.hissAudio.onended = () => { this.isHissPlaying = false; };
        this.hissAudio.play().catch(() => { this.isHissPlaying = false; });
      } catch(e) {
        this.isHissPlaying = false;
      }
    }
  }
  eat(comboIndex = 0, isGold = false, isAmethyst = false) {
    if (!this.ctx || this.muted) return;
    this.stopHiss(); // Avoid overlapping hiss
    this.soundBusyUntil = performance.now() + 260;
    try {
      const t = this.ctx.currentTime;
      const baseFreq = COMBO_NOTES[Math.min(comboIndex, COMBO_NOTES.length - 1)];

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = isGold ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(baseFreq, t);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * (isGold ? 2.5 : 1.6), t + 0.14);
      gain.gain.setValueAtTime(isGold ? 0.35 : 0.28, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + (isGold ? 0.22 : 0.16));
      osc.connect(gain); gain.connect(this.ctx.destination);
      osc.start(t); osc.stop(t + 0.25);

      if (isAmethyst) {
        const osc2 = this.ctx.createOscillator();
        const g2 = this.ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(587.33, t);
        osc2.frequency.exponentialRampToValueAtTime(1174.66, t + 0.3);
        g2.gain.setValueAtTime(0.25, t);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
        osc2.connect(g2); g2.connect(this.ctx.destination);
        osc2.start(t); osc2.stop(t + 0.35);
      }

      const bufLen = Math.floor(this.ctx.sampleRate * 0.05);
      const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufLen);
      const noise = this.ctx.createBufferSource();
      noise.buffer = buf;
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.18, t);
      nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      noise.connect(nGain); nGain.connect(this.ctx.destination);
      noise.start(t);
    } catch(e) {}
  }
  recordFanfare() {
    if (!this.ctx || this.muted) return;
    this.stopHiss(); // Avoid overlapping hiss
    this.soundBusyUntil = performance.now() + 650;
    try {
      const t = this.ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t + idx * 0.08);
        gain.gain.setValueAtTime(0.25, t + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.08 + 0.28);
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(t + idx * 0.08); osc.stop(t + idx * 0.08 + 0.3);
      });
    } catch(e) {}
  }
  crash() {
    if (!this.ctx || this.muted) return;
    this.stopHiss(); // Avoid overlapping hiss
    this.soundBusyUntil = performance.now() + 500;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, t);
      osc.frequency.exponentialRampToValueAtTime(24, t + 0.35);
      gain.gain.setValueAtTime(0.55, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      osc.connect(gain); gain.connect(this.ctx.destination);
      osc.start(t); osc.stop(t + 0.4);
    } catch(e) {}
  }
  hiss(intensity = 1) {
    // If not busy, play hiss.ogg
    if (!this.isSoundBusy()) {
      this.playHissOgg();
    }
  }
}
const sfx = new SoundController();

// ==========================================
// 3. CANVAS, OBSTACLES & RICH BACKGROUND
// ==========================================
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const elScore = document.getElementById('score'), elLen = document.getElementById('len'),
      elBest = document.getElementById('best'), elSpeed = document.getElementById('speedChip'),
      overlay = document.getElementById('overlay'), elTitle = document.getElementById('title'),
      elSub = document.getElementById('sub'), playBtn = document.getElementById('playBtn'),
      soundBtn = document.getElementById('soundBtn'), pauseBtn = document.getElementById('pauseBtn'),
      ctrlToggleBtn = document.getElementById('ctrlToggleBtn'), modeToggleBtn = document.getElementById('modeToggleBtn'),
      obsToggleBtn = document.getElementById('obsToggleBtn'), onScreenControls = document.getElementById('onScreenControls'),
      comboBox = document.getElementById('comboBox'), comboLabel = document.getElementById('comboLabel'),
      comboBar = document.getElementById('comboBar'), buffBox = document.getElementById('buffBox'),
      buffSec = document.getElementById('buffSec'), shieldBox = document.getElementById('shieldBox'),
      elLevel = document.getElementById('levelChip'), diffBtn = document.getElementById('diffBtn'),
      fsBtn = document.getElementById('fsBtn'), statsStrip = document.getElementById('statsStrip');

let W = 0, H = 0, DPR = 1;
let ground = null;
let fireflies = [];
let obstacles = [];

let shakeMagnitude = 0;
function addScreenShake(amount) {
  if (CFG.screenShake) shakeMagnitude = Math.min(22, shakeMagnitude + amount);
}

function initFireflies() {
  fireflies = [];
  if (REDUCED_MOTION) return;
  for (let i = 0; i < 30; i++) {
    fireflies.push({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 16, vy: (Math.random() - 0.5) * 16,
      size: Math.random() * 2.2 + 1,
      phase: Math.random() * Math.PI * 2,
      glowRate: 0.8 + Math.random() * 1.5
    });
  }
}

// Generate Ancient Runic Stone Monolith Obstacles
function generateObstacles() {
  obstacles = [];
  if (CFG.obstacles === 'none') return;

  const count = Math.round(((CFG.obstacles === 'dense') ? 10 : 6) * diff().obstacles);
  if (count <= 0) return;
  for (let i = 0; i < count; i++) addObstacle();
}

// Place one monolith clear of the spawn point, the snake's head and its siblings.
function addObstacle() {
  const safeRadius = 160;
  const head = snake && snake.spine[0];

  for (let tries = 0; tries < 60; tries++) {
    const r = 22 + Math.random() * 12;
    const x = 70 + Math.random() * (W - 140);
    const y = 70 + Math.random() * (H - 140);

    if (Math.hypot(x - W / 2, y - H / 2) < safeRadius) continue;
    if (head && Math.hypot(x - head.x, y - head.y) < 220) continue;

    let tooClose = false;
    for (const ob of obstacles) {
      if (Math.hypot(x - ob.x, y - ob.y) < (r + ob.r + 90)) { tooClose = true; break; }
    }
    if (tooClose) continue;

    // Faceted polygon geometry for a natural ancient rock
    const sides = 6 + Math.floor(Math.random() * 3);
    const vertices = [];
    for (let i = 0; i < sides; i++) {
      const ang = (i / sides) * Math.PI * 2;
      const dist = r * (0.82 + Math.random() * 0.36);
      vertices.push({x: Math.cos(ang) * dist, y: Math.sin(ang) * dist});
    }

    obstacles.push({
      x, y, r, vertices,
      runePulse: Math.random() * Math.PI * 2,
      runeSymbol: ['᚛', 'ᚱ', 'ᛏ', 'ᛟ', 'ᚲ', 'ᛝ'][Math.floor(Math.random() * 6)]
    });
    return true;
  }
  return false;
}

function buildGround() {
  const g = document.createElement('canvas');
  g.width = Math.round(W * DPR); g.height = Math.round(H * DPR);
  const x = g.getContext('2d');
  x.setTransform(DPR, 0, 0, DPR, 0, 0);

  // Deep enchanted cavern gradient
  const grad = x.createRadialGradient(W/2, H*0.45, 50, W/2, H*0.5, Math.max(W,H)*0.82);
  grad.addColorStop(0, activeSkin.ground[0]);
  grad.addColorStop(0.55, activeSkin.ground[1]);
  grad.addColorStop(1, activeSkin.ground[2]);
  x.fillStyle = grad;
  x.fillRect(0, 0, W, H);

  // Soft atmospheric ethereal nebula clouds
  const nebulaPoints = [
    {x: W * 0.25, y: H * 0.35, r: Math.max(W,H) * 0.45},
    {x: W * 0.75, y: H * 0.65, r: Math.max(W,H) * 0.48},
    {x: W * 0.5, y: H * 0.2, r: Math.max(W,H) * 0.35}
  ];
  for (const np of nebulaPoints) {
    const ng = x.createRadialGradient(np.x, np.y, 10, np.x, np.y, np.r);
    ng.addColorStop(0, `rgba(${activeSkin.rim}, 0.045)`);
    ng.addColorStop(0.5, `rgba(${activeSkin.dark}, 0.02)`);
    ng.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = ng;
    x.beginPath(); x.arc(np.x, np.y, np.r, 0, Math.PI * 2); x.fill();
  }

  // Faint ancient floor ley-line circles & geometric runes
  x.strokeStyle = `rgba(${activeSkin.rim}, 0.035)`;
  x.lineWidth = 1.2;
  x.beginPath(); x.arc(W/2, H/2, Math.min(W,H) * 0.35, 0, Math.PI * 2); x.stroke();
  x.beginPath(); x.arc(W/2, H/2, Math.min(W,H) * 0.2, 0, Math.PI * 2); x.stroke();

  // Organic soil speckles
  for (let i = 0; i < Math.round(W * H / 850); i++) {
    const px = Math.random() * W, py = Math.random() * H, r = Math.random() * 1.6 + 0.2;
    x.fillStyle = `rgba(160, 190, 170, ${Math.random() * 0.045})`;
    x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
  }

  // Lush grass blades
  for (let i = 0; i < Math.round(W * H / 2400); i++) {
    const px = Math.random() * W, py = Math.random() * H;
    const h = 7 + Math.random() * 16, lean = (Math.random() - 0.5) * 9;
    x.strokeStyle = `rgba(${activeSkin.blade}, ${0.05 + Math.random() * 0.08})`;
    x.lineWidth = 1 + Math.random();
    x.lineCap = 'round';
    x.beginPath(); x.moveTo(px, py);
    x.quadraticCurveTo(px + lean * 0.4, py - h * 0.6, px + lean, py - h);
    x.stroke();
  }

  // Soft vignette
  const v = x.createRadialGradient(W/2, H/2, Math.min(W,H) * 0.3, W/2, H/2, Math.max(W,H) * 0.78);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.65)');
  x.fillStyle = v;
  x.fillRect(0, 0, W, H);

  ground = g;
}

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  buildGround();
  initFireflies();
  generateObstacles();
}
window.addEventListener('resize', resize);

// ==========================================
// 4. GAMEPLAY STATE, SPEED SCALING & COMBOS
// ==========================================
let snake = null, apples = [], particles = [], floatingTexts = [];
let score = 0, applesEaten = 0, best = 0;
let level = 1, shieldCharges = 0, invuln = 0;
let running = false, paused = false, dead = false, t0 = 0, tick = 0;
let newRecordCelebrated = false;

// Speed calculation: speeds up as snake grows longer!
function getCurrentSpeeds() {
  if (!snake) return { cruise: CFG.speed, sprint: CFG.sprint };
  // Each gained spine node adds speed, smoothly scaling from 175px/s up to 295px/s
  const d = diff();
  const growth = Math.max(0, snake.spine.length - CFG.startLen);
  const speedBonus = Math.min(120, growth * 0.45) * d.growth + (level - 1) * 6;
  return {
    cruise: CFG.speed * d.speed + speedBonus,
    sprint: CFG.sprint * d.speed + speedBonus * 1.35
  };
}

let comboCount = 0;
let comboTimer = 0;
const COMBO_DURATION = 3.2;

let magnetTimeLeft = 0;
let nextHissTime = performance.now() + 4500 + Math.random() * 2000;
let desiredAngle = 0;

function wrapDelta(d, size) {
  if (!CFG.wrapWalls) return d;
  d = ((d % size) + size) % size;
  return d > size / 2 ? d - size : d;
}

function resetGame() {
  const cx = W / 2, cy = H / 2;
  desiredAngle = 0;
  snake = {
    ang: 0, targetGrow: 0, spine: [], speed: CFG.speed, sprinting: false,
    tongue: 0, blink: 0
  };
  for (let i = 0; i < CFG.startLen; i++) {
    snake.spine.push({x: cx - i * CFG.spacing, y: cy});
  }
  apples = []; particles = []; floatingTexts = [];
  score = 0; applesEaten = 0; dead = false; paused = false;
  comboCount = 0; comboTimer = 0; magnetTimeLeft = 0;
  level = 1; shieldCharges = 0; invuln = 0;
  newRecordCelebrated = (best === 0);

  generateObstacles();
  for (let i = 0; i < diff().apples; i++) apples.push(spawnApple());
  syncHUD();
}

function spawnApple() {
  const margin = 55;
  const randType = Math.random();
  let type = 'normal';
  if (randType > 0.95) type = 'ward';
  else if (randType > 0.88) type = 'amethyst';
  else if (randType > 0.74) type = 'gold';

  for (let tries = 0; tries < 80; tries++) {
    const p = {
      x: margin + Math.random() * (W - 2 * margin),
      y: margin + Math.random() * (H - 2 * margin),
      born: tick, r: type === 'gold' ? 14 : (type === 'normal' ? 12 : 13),
      type: type
    };
    let ok = true;
    // Don't spawn on snake
    for (let i = 0; i < snake.spine.length; i += 4) {
      const s = snake.spine[i];
      if (Math.hypot(wrapDelta(s.x - p.x, W), wrapDelta(s.y - p.y, H)) < 70) {
        ok = false; break;
      }
    }
    // Don't spawn inside obstacles
    if (ok) {
      for (const ob of obstacles) {
        if (Math.hypot(wrapDelta(ob.x - p.x, W), wrapDelta(ob.y - p.y, H)) < (ob.r + p.r + 20)) {
          ok = false; break;
        }
      }
    }
    if (ok) return p;
  }
  return {
    x: margin + Math.random() * (W - 2 * margin),
    y: margin + Math.random() * (H - 2 * margin),
    born: tick, r: 12, type: type
  };
}

function addFloatingText(x, y, text, color, scale = 1) {
  floatingTexts.push({
    x, y, text, color,
    vy: -60, life: 1.1, maxLife: 1.1, scale
  });
}

function syncHUD() {
  elScore.textContent = score;
  elLen.textContent = snake ? snake.spine.length : 0;
  elLevel.textContent = level;
  elBest.textContent = best;
  shieldBox.classList.toggle('show', shieldCharges > 0);

  // Live Speed Chip
  if (snake) {
    elSpeed.innerHTML = `${Math.round(snake.speed)}<small>px/s</small>`;
  }

  // Combo UI
  if (comboCount > 1 && comboTimer > 0) {
    comboLabel.textContent = `COMBO x${comboCount}!`;
    comboBar.style.width = `${(comboTimer / COMBO_DURATION) * 100}%`;
    comboBox.style.opacity = '1';
  } else {
    comboLabel.textContent = 'COMBO x1';
    comboBar.style.width = '0%';
    comboBox.style.opacity = '0.45';
  }

  // Magnet UI
  if (magnetTimeLeft > 0) {
    buffBox.classList.add('show');
    buffSec.textContent = `${Math.ceil(magnetTimeLeft)}s`;
  } else {
    buffBox.classList.remove('show');
  }
}

// ==========================================
// 5. INPUT SYSTEM
// ==========================================
const keys = new Set();
const virtualInput = {
  up: false, down: false, left: false, right: false,
  steerLeft: false, steerRight: false, sprint: false,
  pointerActive: false, pointerX: 0, pointerY: 0
};

window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  const c = e.code;

  if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' ', 'w', 'a', 's', 'd', 'p', 'escape', 'r', 'f'].includes(k) ||
      ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyP', 'KeyR'].includes(c)) {
    e.preventDefault();
  }

  if (!running && ['enter', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) {
    startGame();
  }

  if (k === 'r') startGame();
  if (k === 'f') toggleFullscreen();
  if ((k === 'p' || k === 'escape') && running) togglePause();

  keys.add(k);
  if (c) keys.add(c.toLowerCase());

  if (k === 'arrowup' || k === 'w' || c === 'KeyW' || c === 'ArrowUp') setCardinalDirection(-Math.PI / 2);
  if (k === 'arrowdown' || k === 's' || c === 'KeyS' || c === 'ArrowDown') setCardinalDirection(Math.PI / 2);
  if (k === 'arrowleft' || k === 'a' || c === 'KeyA' || c === 'ArrowLeft') setCardinalDirection(Math.PI);
  if (k === 'arrowright' || k === 'd' || c === 'KeyD' || c === 'ArrowRight') setCardinalDirection(0);
});

window.addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  const c = e.code;
  keys.delete(k);
  if (c) keys.delete(c.toLowerCase());
});

function setCardinalDirection(rad) {
  if (CFG.controlScheme === 'cardinal') {
    if (desiredAngle !== rad && running && !paused) {
      sfx.hiss(1.2);
    }
    desiredAngle = rad;
  }
}

cv.addEventListener('pointerdown', e => {
  if (!running && overlay.classList.contains('hide')) startGame();
  virtualInput.pointerActive = true;
  virtualInput.pointerX = e.clientX;
  virtualInput.pointerY = e.clientY;
});
window.addEventListener('pointermove', e => {
  if (virtualInput.pointerActive) {
    virtualInput.pointerX = e.clientX;
    virtualInput.pointerY = e.clientY;
  }
});
window.addEventListener('pointerup', () => { virtualInput.pointerActive = false; });

function bindVirtualBtn(btnEl, stateProp, onCardinalRad = null) {
  if (!btnEl) return;
  const setBtn = (active) => {
    virtualInput[stateProp] = active;
    if (active) {
      btnEl.classList.add('pressed');
      if (!running) startGame();
      if (onCardinalRad !== null) setCardinalDirection(onCardinalRad);
    } else {
      btnEl.classList.remove('pressed');
    }
  };
  btnEl.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); setBtn(true); });
  btnEl.addEventListener('pointerup', e => { e.preventDefault(); setBtn(false); });
  btnEl.addEventListener('pointercancel', () => setBtn(false));
  btnEl.addEventListener('pointerleave', () => setBtn(false));
}

bindVirtualBtn(document.getElementById('btnUp'), 'up', -Math.PI / 2);
bindVirtualBtn(document.getElementById('btnDown'), 'down', Math.PI / 2);
bindVirtualBtn(document.getElementById('btnLeft'), 'left', Math.PI);
bindVirtualBtn(document.getElementById('btnRight'), 'right', 0);
bindVirtualBtn(document.getElementById('btnSteerLeft'), 'steerLeft');
bindVirtualBtn(document.getElementById('btnSteerRight'), 'steerRight');
bindVirtualBtn(document.getElementById('btnSprint'), 'sprint');

function getSprintInput() {
  return virtualInput.sprint ||
         keys.has('shift') || keys.has('shiftleft') || keys.has('shiftright') ||
         keys.has(' ') || keys.has('space') ||
         (CFG.controlScheme === 'slither' && (keys.has('arrowup') || keys.has('w')));
}

function getSteerOutput() {
  const head = snake.spine[0];

  if (CFG.controlScheme === 'mouse' || (virtualInput.pointerActive && CFG.controlScheme !== 'cardinal')) {
    if (virtualInput.pointerActive) {
      const targetAngle = Math.atan2(virtualInput.pointerY - head.y, virtualInput.pointerX - head.x);
      let diff = targetAngle - snake.ang;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      return Math.max(-1, Math.min(1, diff * 3.5));
    }
  }

  if (CFG.controlScheme === 'cardinal') {
    if (keys.has('arrowup') || keys.has('w') || virtualInput.up) desiredAngle = -Math.PI / 2;
    else if (keys.has('arrowdown') || keys.has('s') || virtualInput.down) desiredAngle = Math.PI / 2;
    else if (keys.has('arrowleft') || keys.has('a') || virtualInput.left) desiredAngle = Math.PI;
    else if (keys.has('arrowright') || keys.has('d') || virtualInput.right) desiredAngle = 0;

    if (virtualInput.steerLeft) return -1;
    if (virtualInput.steerRight) return 1;

    let diff = desiredAngle - snake.ang;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return Math.max(-1, Math.min(1, diff * 4.2));
  }

  let steer = 0;
  if (keys.has('arrowleft') || keys.has('a') || virtualInput.left || virtualInput.steerLeft) steer -= 1;
  if (keys.has('arrowright') || keys.has('d') || virtualInput.right || virtualInput.steerRight) steer += 1;
  return Math.max(-1, Math.min(1, steer));
}

// ==========================================
// 6. PROCEDURAL GEOMETRY
// ==========================================
function radiusAt(u) {
  let r;
  if (u < 0.08) r = CFG.bodyR * (0.82 + (u / 0.08) * 0.18);
  else if (u < 0.82) r = CFG.bodyR * (1 - 0.08 * (u - 0.08) / 0.74);
  else {
    const k = (u - 0.82) / 0.18;
    r = CFG.bodyR * 0.92 * Math.pow(1 - k, 0.85);
  }
  return r * (1 - 0.035 * Math.sin(u * Math.PI * 5));
}

function outline() {
  const sp = snake.spine, n = sp.length, left = [], right = [];
  const step = Math.max(1, Math.floor(n / 180));
  for (let i = 0; i < n; i += step) {
    const a = sp[Math.max(0, i - 1)], b = sp[Math.min(n - 1, i + 1)];
    let dx = b.x - a.x, dy = b.y - a.y;
    const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    const r = radiusAt(i / (n - 1));
    left.push({x: sp[i].x - dy * r, y: sp[i].y + dx * r});
    right.push({x: sp[i].x + dy * r, y: sp[i].y - dx * r});
  }
  return {left, right};
}

function curveThrough(pts, connect) {
  if (connect) ctx.lineTo(pts[0].x, pts[0].y);
  else ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i+1].x) / 2, my = (pts[i].y + pts[i+1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last.x, last.y);
}

function bodyPath() {
  const {left, right} = outline();
  ctx.beginPath();
  curveThrough(left, false);
  curveThrough(right.slice().reverse(), true);
  ctx.closePath();
}

function bodyBounds() {
  const sp = snake.spine;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let i = 0; i < sp.length; i += 4) {
    const s = sp[i];
    if (s.x < x0) x0 = s.x; if (s.y < y0) y0 = s.y;
    if (s.x > x1) x1 = s.x; if (s.y > y1) y1 = s.y;
  }
  const pad = CFG.bodyR + 6;
  return {x: x0 - pad, y: y0 - pad, w: (x1 - x0) + pad * 2, h: (y1 - y0) + pad * 2};
}

function recenterSpine() {
  const sp = snake.spine;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of sp) {
    if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x;
    if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y;
  }
  const sx = x0 >= W ? -W : (x1 < 0 ? W : 0);
  const sy = y0 >= H ? -H : (y1 < 0 ? H : 0);
  if (sx || sy) {
    for (const p of sp) { p.x += sx; p.y += sy; }
  }
}

// ==========================================
// 7. GRAPHICS ENGINE & OBSTACLES DRAWING
// ==========================================
function drawScales() {
  const sp = snake.spine, n = sp.length;
  ctx.lineWidth = 0.9;
  for (let i = 2; i < n - 2; i += 4) {
    const u = i / (n - 1), r = radiusAt(u);
    if (r < 2.2) continue;
    const a = sp[i - 2], b = sp[i + 2];
    let dx = b.x - a.x, dy = b.y - a.y;
    const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    const p = sp[i];
    for (let k = -2; k <= 2; k++) {
      const off = (k / 2.6) * r;
      const cx = p.x - dy * off, cy = p.y + dx * off;
      const s = r * 0.3 * (1 - Math.abs(k) / 3.4);
      if (s < 0.6) continue;
      ctx.strokeStyle = `rgba(200,255,220,${0.1 - Math.abs(k) * 0.018})`;
      ctx.beginPath();
      ctx.arc(cx, cy, s, Math.atan2(dy, dx) - 2.3, Math.atan2(dy, dx) + 2.3);
      ctx.stroke();
    }
  }
}

function drawHead(head) {
  const sp = snake.spine;
  const nx = sp[0].x - sp[Math.min(6, sp.length - 1)].x;
  const ny = sp[0].y - sp[Math.min(6, sp.length - 1)].y;
  const a = Math.atan2(ny, nx) || snake.ang;
  const R = CFG.headR;

  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(a);

  // Bioluminescent Lantern Beam
  const lantern = ctx.createRadialGradient(R * 1.8, 0, 10, R * 2.2, 0, R * 7.5);
  lantern.addColorStop(0, `rgba(${activeSkin.rim}, 0.16)`);
  lantern.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lantern;
  ctx.beginPath();
  ctx.arc(R * 1.5, 0, R * 7.5, -0.65, 0.65);
  ctx.lineTo(R, 0);
  ctx.closePath();
  ctx.fill();

  // Head shadow
  ctx.save(); ctx.translate(6, 9); ctx.filter = 'blur(5px)';
  ctx.beginPath(); ctx.ellipse(0, 0, R * 1.35, R * 0.95, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill(); ctx.restore();

  // Forked tongue
  const tg = Math.max(0, Math.sin(snake.tongue));
  if (tg > 0.05) {
    const L = R * 1.55 * tg;
    ctx.strokeStyle = '#ff5b7a'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    const wob = Math.sin(tick * 0.45) * 2.2;
    ctx.beginPath(); ctx.moveTo(R * 1.15, 0); ctx.lineTo(R * 1.15 + L * 0.62, wob * 0.4);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(R * 1.15 + L * 0.62, wob * 0.4); ctx.lineTo(R * 1.15 + L, wob - 3.2);
    ctx.moveTo(R * 1.15 + L * 0.62, wob * 0.4); ctx.lineTo(R * 1.15 + L, wob + 3.2);
    ctx.stroke();
  }

  // Skull
  ctx.beginPath();
  ctx.moveTo(R * 1.30, 0);
  ctx.bezierCurveTo(R * 1.26, -R * 0.42, R * 0.85, -R * 0.80, R * 0.18, -R * 0.92);
  ctx.bezierCurveTo(-R * 0.55, -R * 1.02, -R * 1.10, -R * 0.86, -R * 1.45, -R * 0.66);
  ctx.lineTo(-R * 1.45, R * 0.66);
  ctx.bezierCurveTo(-R * 1.10, R * 0.86, -R * 0.55, R * 1.02, R * 0.18, R * 0.92);
  ctx.bezierCurveTo(R * 0.85, R * 0.80, R * 1.26, R * 0.42, R * 1.30, 0);
  ctx.closePath();

  const hg = ctx.createLinearGradient(0, -R, 0, R);
  hg.addColorStop(0, activeSkin.headTop);
  hg.addColorStop(0.5, activeSkin.headMid);
  hg.addColorStop(1, activeSkin.headBot);
  ctx.fillStyle = hg; ctx.fill();
  ctx.strokeStyle = 'rgba(4,20,13,0.9)'; ctx.lineWidth = 1.6; ctx.stroke();

  // Head scutes
  ctx.save(); ctx.clip();
  ctx.strokeStyle = `rgba(${activeSkin.rim}, 0.14)`; ctx.lineWidth = 1;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath(); ctx.arc(-R * 0.2 + i * R * 0.26, 0, R * 0.55, -1.1, 1.1); ctx.stroke();
  }
  ctx.fillStyle = `rgba(${activeSkin.rim}, 0.12)`;
  ctx.beginPath(); ctx.ellipse(R * 0.1, -R * 0.45, R * 0.85, R * 0.28, -0.1, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Nostrils
  ctx.fillStyle = 'rgba(3,18,11,0.85)';
  ctx.beginPath(); ctx.ellipse(R * 0.92, -R * 0.28, 1.4, 0.95, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(R * 0.92, R * 0.28, 1.4, 0.95, 0, 0, Math.PI * 2); ctx.fill();

  // Eyes
  const blink = snake.blink > 0 ? Math.sin((1 - snake.blink) * Math.PI) : 0;
  for (const s of [-1, 1]) {
    const ex = R * 0.36, ey = s * R * 0.56, er = R * 0.30;
    ctx.beginPath(); ctx.ellipse(ex, ey, er * 1.12, er * (1 - blink * 0.92), 0, 0, Math.PI * 2);
    ctx.fillStyle = activeSkin.eye; ctx.fill();
    ctx.strokeStyle = 'rgba(4,20,13,0.85)'; ctx.lineWidth = 1.1; ctx.stroke();
    if (blink < 0.6) {
      ctx.beginPath(); ctx.ellipse(ex + er * 0.18, ey, er * 0.30, er * 0.80 * (1 - blink), 0, 0, Math.PI * 2);
      ctx.fillStyle = '#0a1a10'; ctx.fill();
      ctx.beginPath(); ctx.arc(ex + er * 0.45, ey - er * 0.38, er * 0.20, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
    }
  }
  ctx.restore();
}

function drawSnake() {
  const sp = snake.spine, n = sp.length, head = sp[0];

  ctx.save();
  ctx.translate(7, 10); ctx.filter = 'blur(6px)';
  bodyPath(); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill();
  ctx.restore();

  ctx.save();
  bodyPath(); ctx.clip();
  const bb = bodyBounds();
  const g = ctx.createLinearGradient(bb.x, bb.y, bb.x, bb.y + bb.h);
  g.addColorStop(0, activeSkin.bodyTop);
  g.addColorStop(1, activeSkin.bodyBot);
  ctx.fillStyle = g; ctx.fillRect(bb.x, bb.y, bb.w, bb.h);

  const step = Math.max(1, Math.floor(n / 150));
  for (let i = 0; i < n - step; i += step) {
    const u = i / (n - 1), r = radiusAt(u);
    const a = sp[i], b = sp[i + step];
    let dx = b.x - a.x, dy = b.y - a.y;
    const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;

    ctx.strokeStyle = `rgba(${activeSkin.rim}, 0.15)`;
    ctx.lineWidth = r * 0.5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x - dy * r * 0.55, a.y + dx * r * 0.55);
    ctx.lineTo(b.x - dy * r * 0.55, b.y + dx * r * 0.55);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(0,25,15,0.32)';
    ctx.beginPath();
    ctx.moveTo(a.x + dy * r * 0.6, a.y - dx * r * 0.6);
    ctx.lineTo(b.x + dy * r * 0.6, b.y - dx * r * 0.6);
    ctx.stroke();
  }

  for (let i = 0; i < n; i += 9) {
    const u = i / (n - 1), r = radiusAt(u);
    if (r < 1.6) continue;
    const a = sp[Math.max(0, i - 2)], b = sp[Math.min(n - 1, i + 2)];
    let dx = b.x - a.x, dy = b.y - a.y;
    const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    const p = sp[i], ph = i * 0.32;
    const sz = r * (0.62 + 0.3 * Math.sin(ph));

    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(dy, dx));
    ctx.fillStyle = `rgba(${activeSkin.dark}, ${0.44 + 0.14 * Math.sin(ph)})`;
    ctx.beginPath();
    ctx.moveTo(0, -sz); ctx.lineTo(sz * 1.25, 0); ctx.lineTo(0, sz); ctx.lineTo(-sz * 1.25, 0);
    ctx.closePath(); ctx.fill();

    ctx.fillStyle = `rgba(${activeSkin.rim}, 0.09)`;
    ctx.beginPath();
    ctx.moveTo(0, -sz * 0.5); ctx.lineTo(sz * 0.6, 0); ctx.lineTo(0, sz * 0.5); ctx.lineTo(-sz * 0.6, 0);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  drawScales();
  ctx.restore();

  bodyPath();
  ctx.strokeStyle = 'rgba(4,20,13,0.85)'; ctx.lineWidth = 1.6; ctx.stroke();

  drawHead(head);
}

function drawSnakeTiled() {
  if (!CFG.wrapWalls) return drawSnake();
  const bb = bodyBounds(), pad = 40;
  for (const oy of [-H, 0, H]) {
    for (const ox of [-W, 0, W]) {
      if (bb.x + ox > W + pad || bb.x + bb.w + ox < -pad) continue;
      if (bb.y + oy > H + pad || bb.y + bb.h + oy < -pad) continue;
      ctx.save();
      ctx.translate(ox, oy);
      drawSnake();
      ctx.restore();
    }
  }
}

// Draw Ancient Runic Monoliths
function drawObstacles() {
  for (const ob of obstacles) {
    ctx.save();
    ctx.translate(ob.x, ob.y);

    // Deep cast shadow
    ctx.save();
    ctx.translate(7, 10);
    ctx.filter = 'blur(6px)';
    ctx.beginPath();
    ctx.moveTo(ob.vertices[0].x, ob.vertices[0].y);
    for (let i = 1; i < ob.vertices.length; i++) ctx.lineTo(ob.vertices[i].x, ob.vertices[i].y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fill();
    ctx.restore();

    // Stone Base Face with Obsidian / Moss Gradient
    ctx.beginPath();
    ctx.moveTo(ob.vertices[0].x, ob.vertices[0].y);
    for (let i = 1; i < ob.vertices.length; i++) ctx.lineTo(ob.vertices[i].x, ob.vertices[i].y);
    ctx.closePath();

    const sg = ctx.createLinearGradient(-ob.r, -ob.r, ob.r, ob.r);
    sg.addColorStop(0, '#2d3e35');
    sg.addColorStop(0.5, '#192620');
    sg.addColorStop(1, '#0c1612');
    ctx.fillStyle = sg;
    ctx.fill();

    // Top rim highlight
    ctx.strokeStyle = 'rgba(160, 220, 185, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Inner glowing ancient rune inscription
    const pulse = 0.5 + 0.4 * Math.sin(tick * 0.05 + ob.runePulse);
    ctx.fillStyle = activeSkin.rune;
    ctx.shadowColor = activeSkin.accent;
    ctx.shadowBlur = 12 * pulse;
    ctx.font = `700 ${Math.round(ob.r * 0.95)}px ui-monospace, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ob.runeSymbol, 0, 1);

    ctx.restore();
  }
}

function drawApple(p) {
  const pulse = 1 + (p.type === 'gold' ? 0.12 : 0.07) * Math.sin((tick - p.born) * (p.type === 'gold' ? 0.14 : 0.09));
  const r = p.r * pulse;
  ctx.save();
  ctx.translate(p.x, p.y);

  ctx.save(); ctx.translate(4, 7); ctx.filter = 'blur(4px)';
  ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.7, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill(); ctx.restore();

  ctx.beginPath(); ctx.arc(0, 0, r * 2.5, 0, Math.PI * 2);
  const glow = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r * 2.5);
  if (p.type === 'gold') {
    glow.addColorStop(0, 'rgba(255, 215, 107, 0.45)');
    glow.addColorStop(1, 'rgba(255, 215, 107, 0)');
  } else if (p.type === 'amethyst') {
    glow.addColorStop(0, 'rgba(192, 132, 252, 0.45)');
    glow.addColorStop(1, 'rgba(192, 132, 252, 0)');
  } else if (p.type === 'ward') {
    glow.addColorStop(0, 'rgba(126, 200, 255, 0.45)');
    glow.addColorStop(1, 'rgba(126, 200, 255, 0)');
  } else {
    glow.addColorStop(0, 'rgba(255,110,90,0.25)');
    glow.addColorStop(1, 'rgba(255,110,90,0)');
  }
  ctx.fillStyle = glow; ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, -r * 0.85);
  ctx.bezierCurveTo(r * 1.1, -r * 1.15, r * 1.15, r * 0.6, 0, r);
  ctx.bezierCurveTo(-r * 1.15, r * 0.6, -r * 1.1, -r * 1.15, 0, -r * 0.85);
  ctx.closePath();

  const ag = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.15, 0, 0, r * 1.35);
  if (p.type === 'gold') {
    ag.addColorStop(0, '#fff4b8');
    ag.addColorStop(0.5, '#f59e0b');
    ag.addColorStop(1, '#92400e');
  } else if (p.type === 'amethyst') {
    ag.addColorStop(0, '#f3e8ff');
    ag.addColorStop(0.5, '#9333ea');
    ag.addColorStop(1, '#4c1d95');
  } else if (p.type === 'ward') {
    ag.addColorStop(0, '#e0f4ff');
    ag.addColorStop(0.5, '#2f8fd6');
    ag.addColorStop(1, '#0f3c63');
  } else {
    ag.addColorStop(0, '#ff8a6b');
    ag.addColorStop(0.5, '#e03a35');
    ag.addColorStop(1, '#8c1614');
  }
  ctx.fillStyle = ag; ctx.fill();

  ctx.strokeStyle = '#6b4a22'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, -r * 0.8);
  ctx.quadraticCurveTo(r * 0.2, -r * 1.35, r * 0.05, -r * 1.6);
  ctx.stroke();

  ctx.fillStyle = p.type === 'gold' ? '#eab308'
    : p.type === 'amethyst' ? '#c084fc'
    : p.type === 'ward' ? '#7ec8ff' : '#3f8a45';
  ctx.beginPath(); ctx.ellipse(r * 0.5, -r * 1.3, r * 0.42, r * 0.2, -0.5, 0, Math.PI * 2); ctx.fill();

  ctx.beginPath(); ctx.ellipse(-r * 0.36, -r * 0.36, r * 0.24, r * 0.36, -0.6, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill();

  if (p.type === 'gold') {
    ctx.fillStyle = '#fff';
    ctx.font = '700 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('★', 0, r * 0.4);
  } else if (p.type === 'amethyst') {
    ctx.fillStyle = '#fff';
    ctx.font = '700 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('🧲', 0, r * 0.4);
  } else if (p.type === 'ward') {
    ctx.fillStyle = '#fff';
    ctx.font = '700 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('🛡', 0, r * 0.4);
  }

  ctx.restore();
}

function spawnBurst(x, y, color, count, speedMult = 1) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, s = (40 + Math.random() * 200) * speedMult;
    particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 0.5 + Math.random() * 0.5, maxLife: 1,
      r: 1.5 + Math.random() * 3.5, color
    });
  }
}

function drawParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.93; p.vy *= 0.93; p.vy += 220 * dt;
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFireflies(dt) {
  for (const f of fireflies) {
    f.x += f.vx * dt; f.y += f.vy * dt;
    if (f.x < 0) f.x = W; else if (f.x > W) f.x = 0;
    if (f.y < 0) f.y = H; else if (f.y > H) f.y = 0;
    f.phase += f.glowRate * dt;

    const alpha = 0.2 + 0.35 * Math.sin(f.phase);
    if (alpha <= 0.05) continue;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = activeSkin.accent;
    ctx.beginPath(); ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2); ctx.fill();

    const halo = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.size * 5);
    halo.addColorStop(0, `rgba(${activeSkin.rim}, ${alpha * 0.4})`);
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(f.x, f.y, f.size * 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function drawFloatingTexts(dt) {
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.y += ft.vy * dt;
    ft.life -= dt;
    if (ft.life <= 0) { floatingTexts.splice(i, 1); continue; }

    const alpha = Math.min(1, ft.life * 1.5);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `700 ${Math.round(15 * ft.scale)}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = ft.color;
    ctx.shadowColor = ft.color;
    ctx.shadowBlur = 10;
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  }
}

// ==========================================
// 8. SIMULATION UPDATE & SPEED SCALING
// ==========================================
function update(dt) {
  const s = snake;
  if (invuln > 0) invuln -= dt;
  const steerRate = ((CFG.controlScheme === 'cardinal') ? CFG.cardinalTurn : CFG.turn) * diff().turn;
  const steerCmd = getSteerOutput();
  const oldAng = s.ang;
  s.ang += steerCmd * steerRate * dt;
  s.sprinting = getSprintInput();

  // Trigger hissing sound when the snake makes a noticeable turn
  if (Math.abs(s.ang - oldAng) > 0.025 && running && !paused) {
    sfx.hiss(Math.abs(steerCmd));
  }

  // Dynamic Speed: scales higher as the snake gets longer!
  const speeds = getCurrentSpeeds();
  const target = s.sprinting ? speeds.sprint : speeds.cruise;
  s.speed += (target - s.speed) * Math.min(1, dt * 6);

  // Sprint tail ember particles
  if (s.sprinting && s.spine.length > 5) {
    const tail = s.spine[s.spine.length - 1];
    if (Math.random() < 0.6) {
      particles.push({
        x: tail.x + (Math.random() - 0.5) * 10,
        y: tail.y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30,
        life: 0.35, maxLife: 0.35, r: 1.5 + Math.random() * 2,
        color: activeSkin.accent
      });
    }
  }

  // Slithering oscillation
  const slither = Math.sin(tick * 0.11) * 0.15;
  const ang = s.ang + slither;

  const head = s.spine[0];
  const nx = head.x + Math.cos(ang) * s.speed * dt;
  const ny = head.y + Math.sin(ang) * s.speed * dt;

  // Wall collisions (in Classic Mode)
  if (!CFG.wrapWalls) {
    if (nx < CFG.headR || nx > W - CFG.headR || ny < CFG.headR || ny > H - CFG.headR) {
      return triggerGameOver('YOU CRASHED INTO THE WALL');
    }
  }

  // Spine kinematics
  head.x = nx; head.y = ny;
  const nxt = s.spine[1];
  if (!nxt || Math.hypot(nx - nxt.x, ny - nxt.y) >= CFG.spacing) {
    s.spine.unshift({x: nx, y: ny});
    if (s.targetGrow > 0) s.targetGrow--;
    else s.spine.pop();
  }

  if (CFG.wrapWalls) recenterSpine();

  s.tongue += dt * (s.sprinting ? 7 : 4.5);
  s.blink -= dt * 2.2;
  if (s.blink < -1.5 && Math.random() < 0.02) s.blink = 1;

  const h = s.spine[0];

  // Periodic / Random Hiss Timer (~every 5 seconds, non-overlapping)
  const now = performance.now();
  if (now >= nextHissTime) {
    if (sfx.isSoundBusy()) {
      // Postpone by 0.5s to wait for quiet window
      nextHissTime = now + 500;
    } else {
      sfx.playHissOgg();
      // Schedule next random hiss around 5 seconds (4.2s to 6.2s)
      nextHissTime = now + 4200 + Math.random() * 2000;
    }
  }

  // Obstacle Collision Detection!
  for (const ob of obstacles) {
    const dx = wrapDelta(h.x - ob.x, W), dy = wrapDelta(h.y - ob.y, H);
    if (Math.hypot(dx, dy) < CFG.headR + ob.r * 0.85) {
      addScreenShake(15);
      return triggerGameOver('YOU CRASHED INTO AN ANCIENT MONOLITH');
    }
  }

  // Self bite
  if (!CFG.passThroughSelf) {
    const skip = Math.ceil(CFG.headR * 2.6 / CFG.spacing) + 12;
    for (let i = skip; i < s.spine.length; i += 2) {
      const p = s.spine[i];
      const r = CFG.headR * 0.72 + radiusAt(i / (s.spine.length - 1)) * 0.72;
      const dx = wrapDelta(h.x - p.x, W), dy = wrapDelta(h.y - p.y, H);
      if (dx * dx + dy * dy < r * r) {
        return triggerGameOver('YOU BIT YOURSELF');
      }
    }
  }

  // Combo timer decay
  if (comboTimer > 0) {
    comboTimer -= dt;
    if (comboTimer <= 0) {
      comboCount = 0;
      comboTimer = 0;
    }
  }

  // Magnet buff pulling
  if (magnetTimeLeft > 0) {
    magnetTimeLeft -= dt;
    for (const a of apples) {
      const dx = wrapDelta(h.x - a.x, W), dy = wrapDelta(h.y - a.y, H);
      const dist = Math.hypot(dx, dy);
      if (dist > 10 && dist < 320) {
        const pullSpeed = 190 * (1 - dist / 320);
        a.x += (dx / dist) * pullSpeed * dt;
        a.y += (dy / dist) * pullSpeed * dt;
        if (a.x < 0) a.x += W; if (a.x > W) a.x -= W;
        if (a.y < 0) a.y += H; if (a.y > H) a.y -= H;
      }
    }
  }

  // Apple consumption
  for (let i = apples.length - 1; i >= 0; i--) {
    const a = apples[i];
    const dx = wrapDelta(h.x - a.x, W), dy = wrapDelta(h.y - a.y, H);
    if (Math.hypot(dx, dy) < CFG.headR + a.r) {
      apples.splice(i, 1);

      comboCount++;
      comboTimer = COMBO_DURATION;
      comboBox.classList.remove('pop');
      void comboBox.offsetWidth;
      comboBox.classList.add('pop');

      let basePts = 10;
      let isGold = false, isAmethyst = false;
      let burstColor = '#ff6b52';

      if (a.type === 'gold') {
        basePts = 50;
        isGold = true;
        burstColor = '#ffd76b';
        addScreenShake(6);
      } else if (a.type === 'ward') {
        basePts = 25;
        shieldCharges = Math.min(2, shieldCharges + 1);
        burstColor = '#7ec8ff';
        addScreenShake(5);
        addFloatingText(a.x, a.y - 18, '🛡 SCALE WARD +1', '#bfe6ff', 1.3);
      } else if (a.type === 'amethyst') {
        basePts = 30;
        isAmethyst = true;
        magnetTimeLeft = 6.5;
        burstColor = '#c084fc';
        addScreenShake(5);
        addFloatingText(a.x, a.y - 18, '🧲 MAGNET ACTIVATED!', '#e9d5ff', 1.3);
      } else {
        addScreenShake(2.5);
      }

      const pointsGained = Math.round(basePts * Math.min(comboCount, 6) * diff().score);
      score += pointsGained;
      applesEaten++;
      s.targetGrow += (a.type === 'gold' ? CFG.growPer * 2 : CFG.growPer);

      const comboText = comboCount > 1 ? ` (+${pointsGained} x${comboCount})` : ` +${pointsGained}`;
      addFloatingText(a.x, a.y, comboText, burstColor, comboCount > 1 ? 1.25 : 1);

      sfx.eat(comboCount, isGold, isAmethyst);
      spawnBurst(a.x, a.y, burstColor, isGold ? 45 : 28, isGold ? 1.4 : 1);

      if (score > best && best > 0 && !newRecordCelebrated) {
        newRecordCelebrated = true;
        addFloatingText(W / 2, H / 2 - 40, '★ NEW HIGH SCORE RECORD! ★', '#ffd76b', 1.5);
        addScreenShake(8);
        sfx.recordFanfare();
        spawnBurst(W / 2, H / 2, '#ffd76b', 60, 1.5);
      }

      // Level up every 5 apples: faster, and the arena grows another monolith.
      const newLevel = 1 + Math.floor(applesEaten / 5);
      if (newLevel > level) {
        level = newLevel;
        addFloatingText(W / 2, H / 2 - 80, `LEVEL ${level}`, activeSkin.accent, 1.6);
        addScreenShake(6);
        sfx.recordFanfare();
        if (CFG.obstacles !== 'none') addObstacle();
      }

      apples.push(spawnApple());
      syncHUD();
    }
  }

  if (shakeMagnitude > 0) {
    shakeMagnitude *= Math.pow(0.05, dt);
    if (shakeMagnitude < 0.1) shakeMagnitude = 0;
  }

  syncHUD();
  tick++;
}

// ==========================================
// 9. GAME OVER & START
// ==========================================
function triggerGameOver(msg) {
  // Brief grace period after a ward absorbs a hit, so we don't die to the same rock twice.
  if (invuln > 0) return;

  if (shieldCharges > 0) {
    shieldCharges--;
    invuln = 1.6;
    // Bounce back the way we came, otherwise we just re-enter whatever we hit.
    snake.ang += Math.PI;
    desiredAngle = snake.ang;
    addScreenShake(12);
    spawnBurst(snake.spine[0].x, snake.spine[0].y, '#7ec8ff', 40, 1.2);
    addFloatingText(snake.spine[0].x, snake.spine[0].y - 24, '🛡 WARD ABSORBED IT!', '#bfe6ff', 1.3);
    sfx.crash();
    syncHUD();
    return;
  }

  sfx.stopHiss();
  dead = true; running = false;
  sfx.crash();
  addScreenShake(16);
  spawnBurst(snake.spine[0].x, snake.spine[0].y, activeSkin.accent, 55, 1.4);
  stats.games++;
  stats.apples += applesEaten;
  stats.recent.unshift({ score, difficulty: CFG.difficulty, level });
  stats.recent = stats.recent.slice(0, 5);
  if (score > (stats.bestBy[CFG.difficulty] || 0)) stats.bestBy[CFG.difficulty] = score;
  best = stats.bestBy[CFG.difficulty];
  writeJSON(STATS_KEY, stats);
  elBest.textContent = best;

  elTitle.textContent = 'GAME OVER';
  elSub.innerHTML = `${msg}<br><br>Final Score: <b style="color:var(--accent);font-size:22px">${score}</b> · Level <b>${level}</b> · Best (${diff().label}): <b>${best}</b> · Max Speed: <b>${Math.round(snake.speed)} px/s</b>`;
  renderStats();
  playBtn.textContent = 'Play Again [R]';
  overlay.classList.remove('hide');
}

// Career stats + last five runs, shown on the overlay.
function renderStats() {
  const runs = stats.recent.length
    ? stats.recent.map(r => `${r.score}<span style="opacity:.6">/${DIFFICULTY[r.difficulty] ? DIFFICULTY[r.difficulty].label[0] : '?'}</span>`).join(' · ')
    : '—';
  statsStrip.innerHTML =
    `<span>Runs <b>${stats.games}</b></span>` +
    `<span>Apples <b>${stats.apples}</b></span>` +
    `<span>Best E/M/D <b>${stats.bestBy.easy}/${stats.bestBy.normal}/${stats.bestBy.hard}</b></span>` +
    `<span>Last 5 <b>${runs}</b></span>`;
}

function applyDifficulty(key) {
  if (!DIFFICULTY[key]) return;
  CFG.difficulty = key;
  best = stats.bestBy[key] || 0;
  diffBtn.textContent = `🌡️ ${diff().short}`;
  document.querySelectorAll('[data-diff]').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-diff') === key);
  });
  elBest.textContent = best;
  generateObstacles();
  saveSettings();
}

diffBtn.addEventListener('click', () => {
  const order = ['easy', 'normal', 'hard'];
  applyDifficulty(order[(order.indexOf(CFG.difficulty) + 1) % order.length]);
});
document.querySelectorAll('[data-diff]').forEach(btn => {
  btn.addEventListener('click', () => applyDifficulty(btn.getAttribute('data-diff')));
});

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => {});
}
fsBtn.addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', () => {
  fsBtn.textContent = document.fullscreenElement ? '⛶ Exit [F]' : '⛶ [F]';
});

// Never let the snake keep running into a wall while the tab is in the background.
const autoPause = () => { if (running && !paused) togglePause(); };
window.addEventListener('blur', autoPause);
document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });

function startGame() {
  sfx.init();
  resetGame();
  running = true;
  elTitle.textContent = 'SIR HISS-A-LOT';
  playBtn.textContent = 'Resume';
  overlay.classList.add('hide');
  cv.focus();
  t0 = performance.now();
}

function togglePause() {
  if (!running) return;
  paused = !paused;
  pauseBtn.textContent = paused ? '▶ [P]' : '⏸ [P]';
}

playBtn.addEventListener('click', startGame);
pauseBtn.addEventListener('click', togglePause);

soundBtn.addEventListener('click', () => {
  sfx.init();
  const on = sfx.toggleMute();
  soundBtn.textContent = on ? '🔊 SFX: ON' : '🔇 SFX: OFF';
});

let showControls = true;
ctrlToggleBtn.addEventListener('click', () => {
  showControls = !showControls;
  onScreenControls.classList.toggle('hide', !showControls);
  ctrlToggleBtn.textContent = showControls ? '🎮 Pad: ON' : '🎮 Pad: OFF';
});

// Obstacles density toggle
obsToggleBtn.addEventListener('click', () => {
  const modes = ['standard', 'dense', 'none'];
  const next = modes[(modes.indexOf(CFG.obstacles) + 1) % modes.length];
  CFG.obstacles = next;
  saveSettings();
  obsToggleBtn.textContent = next === 'none' ? '🪨 Rocks: OFF' : (next === 'dense' ? '🪨 Rocks: DENSE' : '🪨 Rocks: ON');
  document.querySelectorAll('[data-obs]').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-obs') === next);
  });
  generateObstacles();
});

document.querySelectorAll('[data-obs]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-obs]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    CFG.obstacles = btn.getAttribute('data-obs');
    saveSettings();
    obsToggleBtn.textContent = CFG.obstacles === 'none' ? '🪨 Rocks: OFF' : (CFG.obstacles === 'dense' ? '🪨 Rocks: DENSE' : '🪨 Rocks: ON');
    generateObstacles();
  });
});

function setControlScheme(scheme) {
  CFG.controlScheme = scheme;
  saveSettings();
  document.querySelectorAll('[data-scheme]').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-scheme') === scheme);
  });
  if (scheme === 'cardinal') modeToggleBtn.textContent = '🕹️ 4-Way';
  else if (scheme === 'slither') modeToggleBtn.textContent = '🐍 Slither';
  else modeToggleBtn.textContent = '🖱️ Mouse';
}

modeToggleBtn.addEventListener('click', () => {
  const schemes = ['cardinal', 'slither', 'mouse'];
  const next = schemes[(schemes.indexOf(CFG.controlScheme) + 1) % schemes.length];
  setControlScheme(next);
});

document.querySelectorAll('[data-scheme]').forEach(btn => {
  btn.addEventListener('click', () => { setControlScheme(btn.getAttribute('data-scheme')); });
});

document.querySelectorAll('[data-mode]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    CFG.wrapWalls = (btn.getAttribute('data-mode') === 'wrap');
    saveSettings();
  });
});

function applySkin(key) {
  if (!SKINS[key]) return;
  currentSkinKey = key;
  activeSkin = SKINS[key];
  document.documentElement.style.setProperty('--accent', activeSkin.accent);
  document.querySelectorAll('[data-skin]').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-skin') === key);
  });
  buildGround();
  saveSettings();
}
document.querySelectorAll('[data-skin]').forEach(btn => {
  btn.addEventListener('click', () => applySkin(btn.getAttribute('data-skin')));
});

// ==========================================
// 10. MAIN ANIMATION LOOP
// ==========================================
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - t0) / 1000;
  t0 = now;
  if (dt > 0.05) dt = 0.05;

  if (running && !paused) update(dt);

  ctx.save();
  if (shakeMagnitude > 0) {
    const sx = (Math.random() - 0.5) * shakeMagnitude * 2;
    const sy = (Math.random() - 0.5) * shakeMagnitude * 2;
    ctx.translate(sx, sy);
  }

  ctx.clearRect(0, 0, W, H);
  if (ground) ctx.drawImage(ground, 0, 0, W, H);

  drawFireflies(paused ? 0 : dt);
  drawObstacles();

  for (const a of apples) drawApple(a);
  if (snake) drawSnakeTiled();
  drawParticles(paused ? 0 : dt);
  drawFloatingTexts(paused ? 0 : dt);

  ctx.restore();

  if (paused) {
    ctx.fillStyle = 'rgba(4, 12, 9, 0.65)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#d8f5e6';
    ctx.font = '700 32px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', W / 2, H / 2);
    ctx.font = '13px ui-monospace, monospace';
    ctx.fillStyle = '#7fae98';
    ctx.fillText('PRESS [P] OR CLICK PAUSE TO RESUME', W / 2, H / 2 + 30);
  }
}

// Debug/test hook: lets a browser console (or an automated check) drive the new
// systems — difficulty scaling, level-ups and the scale ward — without playing.
window.__hiss = {
  state: () => ({ score, level, applesEaten, shieldCharges, invuln, best,
                  difficulty: CFG.difficulty, obstacles: obstacles.length,
                  speeds: getCurrentSpeeds(), running, dead,
                  head: snake ? { x: snake.spine[0].x, y: snake.spine[0].y, ang: snake.ang } : null,
                  dpr: DPR }),
  feed: (type = 'normal', n = 1) => {
    for (let i = 0; i < n; i++) {
      apples[0] = { x: snake.spine[0].x, y: snake.spine[0].y, born: tick, r: 12, type };
      update(1 / 60);
    }
  },
  kill: () => triggerGameOver('TEST'),
  // Halt the simulation but keep drawing — a still frame for screenshots,
  // without the dimmed "PAUSED" overlay that togglePause() paints.
  freeze: () => { running = false; },
  setDifficulty: applyDifficulty
};

// Initial setup — restore saved preferences before the first layout.
const saved = readJSON(SETTINGS_KEY, {});
if (saved.wrapWalls !== undefined) {
  CFG.wrapWalls = saved.wrapWalls;
  document.querySelectorAll('[data-mode]').forEach(b => {
    b.classList.toggle('active', (b.getAttribute('data-mode') === 'wrap') === CFG.wrapWalls);
  });
}
if (saved.obstacles) {
  CFG.obstacles = saved.obstacles;
  obsToggleBtn.textContent = CFG.obstacles === 'none' ? '🪨 Rocks: OFF'
    : (CFG.obstacles === 'dense' ? '🪨 Rocks: DENSE' : '🪨 Rocks: ON');
  document.querySelectorAll('[data-obs]').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-obs') === CFG.obstacles);
  });
}
if (saved.controlScheme) setControlScheme(saved.controlScheme);
applySkin(saved.skin || currentSkinKey);
applyDifficulty(saved.difficulty || CFG.difficulty);
renderStats();

resize();
resetGame();
requestAnimationFrame(frame);
})();
