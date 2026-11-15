// NEON VOID — the game itself: state, the fixed-step update, collisions,
// wave flow, the upgrade draft, scoring, win and loss. Rendering lives in
// render.js; input in input.js; sound in audio.js.

import { createRng } from './rng.js';
import {
  WORLD,
  TAU,
  clamp,
  dist2,
  createPlayer,
  spawnEnemy,
  makeElite,
  updateEnemy,
  spawnBullet,
  updateBullet,
  spawnParticle,
  updateParticle,
  spawnPickup,
  updatePickup,
  addFloatText,
  updateFloatText,
  ENEMY_TYPES,
} from './entities.js';
import { TOTAL_WAVES, waveComp, waveName, spawnInterval, isBossWave, eliteChance } from './waves.js';
import { rollDraft } from './upgrades.js';
import { DIFFICULTIES, makeDebris } from './world.js';
import { wardenPhase, wardenPhaseName, wardenFire } from './boss.js';

export const MODES = {
  TITLE: 'title',
  PLAYING: 'playing',
  UPGRADE: 'upgrade',
  PAUSED: 'paused',
  GAMEOVER: 'gameover',
  VICTORY: 'victory',
};

export const REPAIR_COST = 30;
export const REPAIR_AMOUNT = 40;
export const REROLL_COST = 15;

export function createGame(seed = 7) {
  const rng = createRng(seed);
  return {
    seed,
    rng,
    mode: MODES.TITLE,
    time: 0,
    playTime: 0,
    wave: 0,
    score: 0,
    combo: 1,
    comboTimer: 0,
    kills: 0,
    salvage: 0,
    salvageEarned: 0,
    shotsFired: 0,
    best: 0,
    difficulty: 'standard',
    diff: DIFFICULTIES.standard,
    titlePick: 'standard',
    muted: false,
    player: createPlayer(),
    bullets: [],
    enemyBullets: [],
    enemies: [],
    particles: [],
    pickups: [],
    texts: [],
    spawnQueue: [],
    spawnTimer: 0,
    bossSpawned: false,
    bossActive: false,
    draft: [],
    owned: {},
    shake: 0,
    hitStop: 0,
    waveBanner: '',
    waveBannerTimer: 0,
    stars: makeStars(rng),
    nebula: makeNebula(rng),
    debris: makeDebris(rng),
    stats: { wavesCleared: 0, upgradesTaken: 0, dashes: 0 },
    over: false,
  };
}

function makeStars(rng) {
  const stars = [];
  for (let i = 0; i < 130; i++) {
    stars.push({
      x: rng.range(0, WORLD.w),
      y: rng.range(0, WORLD.h),
      z: rng.range(0.2, 1),
      r: rng.range(0.6, 2),
      tw: rng.range(0, TAU),
    });
  }
  return stars;
}

function makeNebula(rng) {
  const blobs = [];
  const colors = ['#3a0ca3', '#7209b7', '#14213d', '#1d3557', '#4a1942'];
  for (let i = 0; i < 7; i++) {
    blobs.push({
      x: rng.range(0, WORLD.w),
      y: rng.range(0, WORLD.h),
      r: rng.range(160, 340),
      color: colors[i % colors.length],
    });
  }
  return blobs;
}

export function loadBest() {
  try {
    return Number(window.localStorage.getItem('neonvoid-best') || 0) || 0;
  } catch {
    return 0;
  }
}

export function saveBest(score) {
  try {
    window.localStorage.setItem('neonvoid-best', String(score));
  } catch {
    // Storage unavailable (private mode, sandbox): best score is session-only.
  }
}

export function startRun(game, audio, difficultyId) {
  const diff = DIFFICULTIES[difficultyId] || DIFFICULTIES.standard;
  game.difficulty = diff.id;
  game.diff = diff;
  game.titlePick = diff.id;
  const p = game.player;
  Object.assign(game, {
    mode: MODES.PLAYING,
    time: 0,
    playTime: 0,
    wave: 0,
    score: 0,
    combo: 1,
    comboTimer: 0,
    kills: 0,
    salvage: 0,
    salvageEarned: 0,
    shotsFired: 0,
    bullets: [],
    enemyBullets: [],
    enemies: [],
    particles: [],
    pickups: [],
    texts: [],
    spawnQueue: [],
    spawnTimer: 0,
    bossSpawned: false,
    bossActive: false,
    draft: [],
    owned: {},
    shake: 0,
    hitStop: 0,
    waveBanner: '',
    waveBannerTimer: 0,
    stats: { wavesCleared: 0, upgradesTaken: 0, dashes: 0 },
    over: false,
  });
  const fresh = createPlayer();
  fresh.maxHp = diff.hull;
  fresh.hp = diff.hull;
  Object.assign(p, fresh);
  game.best = loadBest();
  startWave(game, audio);
}

// Back to the title screen from the pause menu: clear the field and wait.
export function quitToTitle(game) {
  game.mode = MODES.TITLE;
  game.over = false;
  game.enemies = [];
  game.bullets = [];
  game.enemyBullets = [];
  game.pickups = [];
  game.texts = [];
  game.spawnQueue = [];
  game.bossActive = false;
  game.wave = 0;
  game.waveBanner = '';
  game.waveBannerTimer = 0;
  const fresh = createPlayer();
  Object.assign(game.player, fresh);
  game.best = loadBest();
}

export function startWave(game, audio) {
  game.wave += 1;
  game.spawnQueue = waveComp(game.wave);
  game.spawnTimer = 0.4;
  game.bossSpawned = false;
  game.bossActive = false;
  game.waveBanner = `WAVE ${game.wave} — ${waveName(game.wave)}`;
  game.waveBannerTimer = 2.2;
  if (isBossWave(game.wave) && audio) audio.bossAlarm();
}

function spawnPoint(game, rng) {
  // Spawn off-screen-ish, at the arena edge furthest from the player.
  const edge = rng.int(0, 3);
  const m = 30;
  const p = game.player;
  let x;
  let y;
  if (edge === 0) {
    x = rng.range(m, WORLD.w - m);
    y = m;
  } else if (edge === 1) {
    x = rng.range(m, WORLD.w - m);
    y = WORLD.h - m;
  } else if (edge === 2) {
    x = m;
    y = rng.range(m, WORLD.h - m);
  } else {
    x = WORLD.w - m;
    y = rng.range(m, WORLD.h - m);
  }
  // If that lands too close to the player, flip to the opposite edge.
  if (dist2(x, y, p.x, p.y) < 260 * 260) {
    x = WORLD.w - x;
    y = WORLD.h - y;
  }
  return { x, y };
}

function spawnNext(game) {
  const type = game.spawnQueue.shift();
  const at = spawnPoint(game, game.rng);
  const e = spawnEnemy(type, at.x, at.y, game.wave, game.rng, game.diff);
  if (game.rng.chance(eliteChance(game.wave))) makeElite(e);
  game.enemies.push(e);
  spawnParticle(game.particles, at.x, at.y, e.color, 8, 120, 0.4, 2);
}

function spawnBoss(game) {
  const at = spawnPoint(game, game.rng);
  const boss = spawnEnemy('warden', at.x, at.y, game.wave, game.rng, game.diff);
  game.enemies.push(boss);
  game.bossSpawned = true;
  game.bossActive = true;
  game.waveBanner = 'THE WARDEN HAS ARRIVED';
  game.waveBannerTimer = 2.5;
  spawnParticle(game.particles, at.x, at.y, '#f72585', 60, 320, 0.9, 3);
  game.shake = Math.max(game.shake, 10);
}

function clearWave(game, audio) {
  game.stats.wavesCleared += 1;
  const bonus = Math.round(250 * game.wave * game.diff.scoreMult);
  game.score += bonus;
  addFloatText(game.texts, 640, 300, `WAVE CLEAR  +${bonus}`, '#ffd166', 22);
  if (audio) audio.waveClear();
  if (game.wave >= TOTAL_WAVES) {
    winRun(game, audio);
    return;
  }
  game.draft = rollDraft(game.rng, game.owned);
  game.mode = MODES.UPGRADE;
}

export function applyUpgrade(game, upgrade, audio) {
  upgrade.apply(game.player);
  game.owned[upgrade.id] = (game.owned[upgrade.id] || 0) + 1;
  game.stats.upgradesTaken += 1;
  game.draft = [];
  if (audio) audio.upgrade();
  spawnParticle(game.particles, game.player.x, game.player.y, upgrade.color, 30, 260, 0.7, 3);
  game.mode = MODES.PLAYING;
  startWave(game, audio);
}

// Between-wave shop: spend salvage on a hull repair. Stays in the draft.
export function buyRepair(game, audio) {
  if (game.mode !== MODES.UPGRADE) return false;
  if (game.salvage < REPAIR_COST) return false;
  if (game.player.hp >= game.player.maxHp) return false;
  game.salvage -= REPAIR_COST;
  game.player.hp = Math.min(game.player.maxHp, game.player.hp + REPAIR_AMOUNT);
  addFloatText(game.texts, 640, 560, `HULL +${REPAIR_AMOUNT}`, '#80ed99', 16);
  if (audio) audio.heal();
  return true;
}

// Between-wave shop: spend salvage to roll a fresh draft of 3.
export function buyReroll(game, audio) {
  if (game.mode !== MODES.UPGRADE) return false;
  if (game.salvage < REROLL_COST) return false;
  game.salvage -= REROLL_COST;
  game.draft = rollDraft(game.rng, game.owned);
  if (audio) audio.click();
  return true;
}

function damagePlayer(game, amount, audio) {
  const p = game.player;
  if (p.invuln > 0 || p.dashTime > 0 || !p.alive) return;
  let rest = amount;
  if (p.shield > 0) {
    const absorbed = Math.min(p.shield, rest);
    p.shield -= absorbed;
    rest -= absorbed;
  }
  p.hp -= rest;
  p.invuln = 0.8;
  game.shake = Math.max(game.shake, 8);
  game.combo = 1;
  spawnParticle(game.particles, p.x, p.y, '#ff4d6d', 24, 300, 0.6, 3);
  if (audio) audio.hurt();
  if (p.hp <= 0) {
    p.hp = 0;
    p.alive = false;
    loseRun(game, audio);
  }
}

function killEnemy(game, e, audio) {
  e.dead = true;
  game.kills += 1;
  const gained = Math.round(e.score * game.combo * game.diff.scoreMult);
  game.score += gained;
  // Kills pay salvage: the between-wave economy. Elites pay triple.
  const salvageGain = e.salvage * (e.elite ? 3 : 1);
  game.salvage += salvageGain;
  game.salvageEarned += salvageGain;
  game.combo = Math.min(8, game.combo + 0.25);
  game.comboTimer = 3;
  addFloatText(game.texts, e.x, e.y, `+${gained}`, '#ffffff', 13);
  addFloatText(game.texts, e.x, e.y + 16, `+${salvageGain} SALVAGE`, '#ffd166', 11);
  spawnParticle(game.particles, e.x, e.y, e.color, e.type === 'warden' ? 90 : 22, 340, 0.7, 3);
  game.shake = Math.max(game.shake, e.type === 'warden' ? 16 : 4);
  game.hitStop = Math.max(game.hitStop, e.type === 'warden' ? 0.09 : 0.02);
  if (audio) audio.explode();
  // Drops: gems always, repair/cell sometimes, more from elites and the boss.
  const drops = e.elite ? 3 : e.type === 'warden' ? 8 : 1;
  for (let i = 0; i < drops; i++) {
    if (game.rng.chance(0.72)) spawnPickup(game.pickups, e.x, e.y, 'gem', game.rng);
  }
  if (e.type === 'splitter') {
    for (let i = 0; i < 2; i++) {
      const shard = spawnEnemy('shard', e.x + game.rng.range(-14, 14), e.y + game.rng.range(-14, 14), game.wave, game.rng);
      game.enemies.push(shard);
    }
  }
  if (e.type === 'warden') {
    game.bossActive = false;
    for (let i = 0; i < 3; i++) spawnPickup(game.pickups, e.x, e.y, 'repair', game.rng);
    spawnPickup(game.pickups, e.x, e.y, 'cell', game.rng);
  }
  if (game.rng.chance(0.06)) spawnPickup(game.pickups, e.x, e.y, 'repair', game.rng);
  if (game.rng.chance(0.04)) spawnPickup(game.pickups, e.x, e.y, 'cell', game.rng);
}

function loseRun(game, audio) {
  game.mode = MODES.GAMEOVER;
  game.over = true;
  spawnParticle(game.particles, game.player.x, game.player.y, '#ff4d6d', 80, 420, 1.1, 4);
  game.shake = 18;
  if (game.score > game.best) {
    game.best = game.score;
    saveBest(game.score);
  }
  if (audio) {
    audio.stopMusic();
    audio.gameOver();
  }
}

function winRun(game, audio) {
  game.mode = MODES.VICTORY;
  game.over = true;
  for (let i = 0; i < 5; i++) {
    spawnParticle(
      game.particles,
      game.rng.range(200, WORLD.w - 200),
      game.rng.range(100, WORLD.h - 200),
      ['#ffd166', '#4cc9f0', '#ff4d6d', '#80ed99'][i % 4],
      30,
      300,
      1.2,
      3,
    );
  }
  if (game.score > game.best) {
    game.best = game.score;
    saveBest(game.score);
  }
  if (audio) {
    audio.stopMusic();
    audio.victory();
  }
}

function firePlayer(game, audio) {
  const p = game.player;
  p.fireTimer = 1 / p.fireRate;
  game.shotsFired += 1;
  const spread = 0.09;
  const n = p.multiShot;
  for (let i = 0; i < n; i++) {
    const offset = n === 1 ? 0 : (i - (n - 1) / 2) * spread;
    const a = p.angle + offset;
    const mx = Math.cos(a) * 20;
    const my = Math.sin(a) * 20;
    game.bullets.push(
      spawnBullet(p.x + mx, p.y + my, a, p.bulletSpeed, p.damage, p.pierce, true, p.bulletSize),
    );
  }
  p.vx -= Math.cos(p.angle) * 14;
  p.vy -= Math.sin(p.angle) * 14;
  if (audio) audio.shoot();
}

function enemyShoot(game, e, audio) {
  const p = game.player;
  if (e.type === 'warden') {
    wardenFire(game, e);
    game.shake = Math.max(game.shake, 5);
    if (audio) audio.hit();
    return;
  }
  const a = Math.atan2(p.y - e.y, p.x - e.x);
  game.enemyBullets.push(spawnBullet(e.x, e.y, a, 260, 10, 0, false, 6));
  e.fireTimer = 2.2 + game.rng.range(0, 0.8);
  if (audio) audio.hit();
}

// One fixed step (1/60s). Input is the polled input object; audio may be null.
export function update(game, dt, input, audio) {
  game.time += dt;
  game.shake = Math.max(0, game.shake - dt * 26);
  game.waveBannerTimer = Math.max(0, game.waveBannerTimer - dt);
  if (game.hitStop > 0) {
    game.hitStop -= dt;
    return; // freeze-frame punch on big kills
  }

  // Particles and floating text always animate, even on menus.
  for (const pt of game.particles) updateParticle(pt, dt);
  game.particles = game.particles.filter((pt) => pt.life > 0);
  for (const t of game.texts) updateFloatText(t, dt);
  game.texts = game.texts.filter((t) => t.life > 0);

  if (game.mode === MODES.TITLE || game.mode === MODES.GAMEOVER || game.mode === MODES.VICTORY) {
    // Gentle drift on the end screens; the player can restart with R or click.
    for (const e of game.enemies) updateEnemy(e, game.player, dt, game.rng);
    return;
  }
  if (game.mode === MODES.PAUSED) return;
  if (game.mode === MODES.UPGRADE) return; // frozen while the draft is open

  game.playTime += dt;
  const p = game.player;
  if (!p.alive) return;

  // --- combo decay ---
  game.comboTimer -= dt;
  if (game.comboTimer <= 0) game.combo = 1;

  // --- movement (WASD / arrows) ---
  let mx = 0;
  let my = 0;
  if (input.down('w', 'arrowup')) my -= 1;
  if (input.down('s', 'arrowdown')) my += 1;
  if (input.down('a', 'arrowleft')) mx -= 1;
  if (input.down('d', 'arrowright')) mx += 1;
  const mag = Math.hypot(mx, my) || 1;
  const accel = 2600;
  p.vx += (mx / mag) * accel * dt * (mx || my ? 1 : 0);
  p.vy += (my / mag) * accel * dt * (mx || my ? 1 : 0);
  p.vx *= 1 - Math.min(1, 5.2 * dt);
  p.vy *= 1 - Math.min(1, 5.2 * dt);
  const sp = Math.hypot(p.vx, p.vy);
  if (sp > p.speed) {
    p.vx = (p.vx / sp) * p.speed;
    p.vy = (p.vy / sp) * p.speed;
  }

  // --- dash (Shift): burst + brief invulnerability ---
  p.dashTimer = Math.max(0, p.dashTimer - dt);
  p.dashTime = Math.max(0, p.dashTime - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  if (input.down('shift') && p.dashTimer <= 0 && (mx || my)) {
    p.dashTimer = p.dashCooldown;
    p.dashTime = 0.22;
    game.stats.dashes += 1;
    p.vx = (mx / mag) * p.speed * 2.6;
    p.vy = (my / mag) * p.speed * 2.6;
    spawnParticle(game.particles, p.x, p.y, '#c77dff', 16, 200, 0.4, 3);
    if (audio) audio.dash();
  }
  p.x = clamp(p.x + p.vx * dt, p.radius, WORLD.w - p.radius);
  p.y = clamp(p.y + p.vy * dt, p.radius, WORLD.h - p.radius);
  p.angle = Math.atan2(input.mouse.y - p.y, input.mouse.x - p.x);
  p.trail.push({ x: p.x, y: p.y, life: 0.25 });
  if (p.trail.length > 14) p.trail.shift();
  for (const t of p.trail) t.life -= dt;
  p.trail = p.trail.filter((t) => t.life > 0);

  // --- firing (hold mouse or Space) ---
  p.fireTimer -= dt;
  if ((input.mouse.down || input.down('space')) && p.fireTimer <= 0) {
    firePlayer(game, audio);
  }

  // --- spawning ---
  if (game.spawnQueue.length > 0) {
    game.spawnTimer -= dt;
    if (game.spawnTimer <= 0) {
      spawnNext(game);
      game.spawnTimer = spawnInterval(game.wave);
    }
  } else if (isBossWave(game.wave) && !game.bossSpawned) {
    spawnBoss(game);
  }

  // --- enemies ---
  for (const e of game.enemies) {
    updateEnemy(e, p, dt, game.rng);
    // Boss phase changes: new pattern, new banner, new alarm.
    if (e.type === 'warden' && e.hp > 0) {
      const phase = wardenPhase(e);
      if (phase !== e.phase) {
        e.phase = phase;
        game.waveBanner = `THE WARDEN RAGES — ${wardenPhaseName(phase)}`;
        game.waveBannerTimer = 2.2;
        game.shake = Math.max(game.shake, 10);
        if (audio) audio.bossAlarm();
      }
    }
    if ((e.kind === 'shooter' || e.kind === 'boss') && e.hp > 0) {
      e.fireTimer -= dt;
      const d = Math.hypot(p.x - e.x, p.y - e.y);
      if (e.fireTimer <= 0 && d < 560) enemyShoot(game, e, audio);
    }
    // Touch damage.
    if (dist2(e.x, e.y, p.x, p.y) < (e.radius + p.radius) * (e.radius + p.radius)) {
      damagePlayer(game, e.type === 'warden' ? 25 : 12, audio);
      // Knock the enemy back so one touch is not a chain of hits.
      const d = Math.hypot(p.x - e.x, p.y - e.y) || 1;
      e.vx -= ((p.x - e.x) / d) * 260;
      e.vy -= ((p.y - e.y) / d) * 260;
    }
  }

  // --- player bullets vs enemies ---
  for (const b of game.bullets) {
    updateBullet(b, dt);
    if (b.dead) continue;
    for (const e of game.enemies) {
      if (e.dead) continue;
      const rr = e.radius + b.radius;
      if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
        e.hp -= b.damage;
        e.hitFlash = 1;
        spawnParticle(game.particles, b.x, b.y, e.color, 4, 160, 0.3, 2);
        if (audio) audio.hit();
        if (e.hp <= 0) killEnemy(game, e, audio);
        if (b.pierce > 0) {
          b.pierce -= 1;
        } else {
          b.dead = true;
        }
        break;
      }
    }
  }
  game.bullets = game.bullets.filter((b) => !b.dead);
  game.enemies = game.enemies.filter((e) => !e.dead);

  // --- enemy bullets vs player ---
  for (const b of game.enemyBullets) {
    updateBullet(b, dt);
    if (b.dead) continue;
    const rr = p.radius + b.radius;
    if (dist2(b.x, b.y, p.x, p.y) < rr * rr) {
      damagePlayer(game, b.damage, audio);
      b.dead = true;
    }
  }
  game.enemyBullets = game.enemyBullets.filter((b) => !b.dead);

  // --- pickups ---
  for (const pk of game.pickups) {
    updatePickup(pk, p, dt);
    if (pk.dead) continue;
    const rr = p.radius + 16;
    if (dist2(pk.x, pk.y, p.x, p.y) < rr * rr) {
      pk.dead = true;
      if (pk.kind === 'gem') {
        const gemGain = Math.round(pk.value * game.combo);
        game.score += gemGain;
        addFloatText(game.texts, pk.x, pk.y, `+${gemGain}`, '#4cc9f0', 12);
        if (audio) audio.pickup();
      } else if (pk.kind === 'repair') {
        p.hp = Math.min(p.maxHp, p.hp + pk.value);
        addFloatText(game.texts, pk.x, pk.y, `+${pk.value} HULL`, '#80ed99', 13);
        if (audio) audio.heal();
      } else {
        p.shield = Math.min(p.maxShield, p.shield + pk.value);
        addFloatText(game.texts, pk.x, pk.y, `+${pk.value} SHIELD`, '#4361ee', 13);
        if (audio) audio.heal();
      }
      spawnParticle(game.particles, pk.x, pk.y, '#ffffff', 6, 140, 0.3, 2);
    }
  }
  game.pickups = game.pickups.filter((pk) => !pk.dead);

  // --- wave clear? ---
  if (
    game.spawnQueue.length === 0 &&
    game.enemies.length === 0 &&
    game.mode === MODES.PLAYING &&
    p.alive
  ) {
    clearWave(game, audio);
  }
}

// --- Autopilot: drives the game without a human, for screenshots and soak tests.
// It flies toward the nearest pickup when hurt, otherwise kites the nearest
// enemy at mid range while firing at it, and dashes away when crowded.
export function autopilot(game, input) {
  const p = game.player;
  const mouse = input.mouse;
  mouse.down = true;
  let target = null;
  let best = Infinity;
  for (const e of game.enemies) {
    const d = dist2(e.x, e.y, p.x, p.y);
    if (d < best) {
      best = d;
      target = e;
    }
  }
  if (target) {
    mouse.x = target.x;
    mouse.y = target.y;
  }
  input.keys.clear();
  if (!target) return;
  const d = Math.sqrt(best);
  const dx = (p.x - target.x) / (d || 1);
  const dy = (p.y - target.y) / (d || 1);
  // Desired range ~260: close in if far, back off if close.
  const want = d > 300 ? -1 : d < 170 ? 1 : 0;
  const strafe = Math.sin(game.time * 1.7) > 0 ? 1 : -1;
  const mx = dx * want + -dy * strafe * 0.7;
  const my = dy * want + dx * strafe * 0.7;
  if (mx < -0.3) input.keys.add('a');
  if (mx > 0.3) input.keys.add('d');
  if (my < -0.3) input.keys.add('w');
  if (my > 0.3) input.keys.add('s');
  // Dash away when an enemy is right on top of us.
  if (d < 70 && p.dashTimer <= 0) input.keys.add('shift');
  // Chase a repair pickup when badly hurt.
  if (p.hp < 40) {
    let pk = null;
    let bd = Infinity;
    for (const item of game.pickups) {
      if (item.kind !== 'repair') continue;
      const dd = dist2(item.x, item.y, p.x, p.y);
      if (dd < bd) {
        bd = dd;
        pk = item;
      }
    }
    if (pk) {
      const pdx = pk.x - p.x;
      const pdy = pk.y - p.y;
      input.keys.clear();
      if (pdx < -20) input.keys.add('a');
      if (pdx > 20) input.keys.add('d');
      if (pdy < -20) input.keys.add('w');
      if (pdy > 20) input.keys.add('s');
    }
  }
}

export { ENEMY_TYPES };
