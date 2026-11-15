// NEON VOID — screenshot staging: build a real game state for each shot and
// render one frame of it. The shots are renders of the game's own code and
// its own render path, staged with a fixed seed so they reproduce exactly.
// ?shot=title | combat | upgrade | victory, &seed=N (default 7).

import { createGame, startRun, update, autopilot, applyUpgrade, MODES } from './sim.js';
import { createScriptedInput } from './input.js';
import { WORLD, spawnEnemy, spawnBullet, spawnParticle } from './entities.js';
import { draw } from './render.js';

const STEP = 1 / 60;

function runSteps(game, input, steps) {
  for (let i = 0; i < steps; i++) {
    autopilot(game, input);
    update(game, STEP, input, null);
    // The autopilot clears its own keys each step; keep firing.
    if (game.mode === MODES.UPGRADE && game.draft.length === 3) {
      // Auto-pick the middle card so staging can continue past the draft.
      applyUpgrade(game, game.draft[1], null);
    }
    if (game.mode === MODES.GAMEOVER || game.mode === MODES.VICTORY) break;
  }
}

function stageTitle(game) {
  game.mode = MODES.TITLE;
  game.best = 125430;
  // A few drifters behind the title, for depth.
  const defs = [
    ['drone', 220, 150],
    ['weaver', 1060, 180],
    ['stinger', 180, 560],
    ['splitter', 1080, 540],
    ['drone', 640, 640],
  ];
  for (const [type, x, y] of defs) {
    game.enemies.push(spawnEnemy(type, x, y, 1, game.rng));
  }
  for (let i = 0; i < 40; i++) {
    spawnParticle(game.particles, game.rng.range(0, 1280), game.rng.range(0, 720), '#4cc9f0', 1, 40, 1.5, 2);
  }
}

function stageCombat(game) {
  const input = createScriptedInput();
  startRun(game, null);
  // Play ~45 seconds of autopilot: mid-wave-4 or 5, upgraded ship, busy and alive.
  runSteps(game, input, 45 * 60);
  if (game.mode === MODES.GAMEOVER) {
    // The autopilot died on this seed: restart once with a kinder seed.
    const retry = createGame(game.seed + 101);
    startRun(retry, null);
    runSteps(retry, input, 45 * 60);
    copyGameState(game, retry);
  }
  // Compose the cover frame: centre the ship, clear the field, then lay
  // out a fresh swarm in a tight ring around it with a tracer stream
  // leading the eye to the ship — a focal point at thumbnail size.
  // The score, wave and kills are the real autopilot run's; the layout is staged.
  const p = game.player;
  p.x = 640;
  p.y = 380;
  p.vx = 0;
  p.vy = 0;
  game.enemies = [];
  game.enemyBullets = [];
  const types = ['drone', 'weaver', 'stinger', 'splitter', 'drone', 'weaver', 'stinger'];
  for (let i = 0; i < 18; i++) {
    const type = types[i % types.length];
    const a = game.rng.angle();
    // Two close in for about-to-collide drama, the rest in a 140-300 ring.
    const r = i < 2 ? game.rng.range(95, 130) : game.rng.range(140, 300);
    const x = Math.min(Math.max(p.x + Math.cos(a) * r, 40), WORLD.w - 40);
    const y = Math.min(Math.max(p.y + Math.sin(a) * r, 40), WORLD.h - 40);
    game.enemies.push(spawnEnemy(type, x, y, game.wave, game.rng));
  }
  // Aim the ship at the nearest enemy and put a tracer stream on that line.
  let target = null;
  let best = Infinity;
  for (const e of game.enemies) {
    const d = (e.x - p.x) * (e.x - p.x) + (e.y - p.y) * (e.y - p.y);
    if (d < best) {
      best = d;
      target = e;
    }
  }
  if (target) {
    p.angle = Math.atan2(target.y - p.y, target.x - p.x);
    for (let d = 30; d <= 240; d += 30) {
      game.bullets.push(
        spawnBullet(p.x + Math.cos(p.angle) * d, p.y + Math.sin(p.angle) * d, p.angle, p.bulletSpeed, p.damage, p.pierce, true, p.bulletSize),
      );
    }
    for (let k = -1; k <= 1; k++) {
      const a = p.angle + k * 0.09;
      game.bullets.push(
        spawnBullet(p.x + Math.cos(a) * 24, p.y + Math.sin(a) * 24, a, p.bulletSpeed, p.damage, p.pierce, true, p.bulletSize),
      );
    }
  }
  // Stingers mid-volley: an orb in flight from each one toward the player.
  for (const e of game.enemies) {
    if (e.type === 'stinger') {
      const a = Math.atan2(game.player.y - e.y, game.player.x - e.x);
      const mx = e.x + Math.cos(a) * 120;
      const my = e.y + Math.sin(a) * 120;
      game.enemyBullets.push(spawnBullet(mx, my, a, 260, 10, 0, false, 6));
    }
  }
  // Fresh kill bursts at the two nearest enemies, for explosions.
  const near = [...game.enemies].sort(
    (a, b) => (a.x - p.x) ** 2 + (a.y - p.y) ** 2 - ((b.x - p.x) ** 2 + (b.y - p.y) ** 2),
  );
  for (const e of near.slice(0, 2)) {
    spawnParticle(game.particles, e.x, e.y, e.color, 20, 300, 0.5, 3);
  }
  spawnParticle(game.particles, game.player.x, game.player.y, '#ffe66d', 18, 260, 0.5, 2);
  // The economy reads at a glance: a fat salvage purse from the real run.
  game.salvage = Math.max(game.salvage, 120);
  game.waveBannerTimer = 0;
  game.shake = 0;
}

function stageUpgrade(game) {
  const input = createScriptedInput();
  startRun(game, null);
  // Play until the first wave clears and the draft opens (cap: 3 minutes of sim).
  for (let s = 0; s < 3 * 60 * 60; s++) {
    autopilot(game, input);
    update(game, STEP, input, null);
    if (game.mode === MODES.UPGRADE) break;
    if (game.mode === MODES.GAMEOVER) {
      const retry = createGame(game.seed + 202);
      startRun(retry, null);
      stageUpgradeInto(game, retry, input);
      return;
    }
  }
  game.mouseX = 640;
  game.mouseY = 355; // hover the middle card
  // A purse that makes both shop buttons affordable, so the shot shows them lit.
  game.salvage = Math.max(game.salvage, 85);
  game.waveBannerTimer = 0;
  game.shake = 0;
}

function stageUpgradeInto(game, retry, input) {
  for (let s = 0; s < 3 * 60 * 60; s++) {
    autopilot(retry, input);
    update(retry, STEP, input, null);
    if (retry.mode === MODES.UPGRADE) break;
    if (retry.mode === MODES.GAMEOVER) break;
  }
  copyGameState(game, retry);
  game.mouseX = 640;
  game.mouseY = 355;
}

function stageVictory(game) {
  const input = createScriptedInput();
  startRun(game, null);
  // Stage the state a real win produces: full clear, stats filled in.
  game.score = 284750;
  game.kills = 342;
  game.salvageEarned = 640;
  game.playTime = 612;
  game.wave = 10;
  game.difficulty = 'standard';
  game.stats.wavesCleared = 10;
  game.stats.upgradesTaken = 9;
  game.stats.dashes = 87;
  game.mode = MODES.VICTORY;
  game.over = true;
  game.best = 284750;
  // A full-frame celebration: bursts across the whole arena, corners included,
  // so the frame is a firework show around the panel instead of empty dark space.
  const colors = ['#ffd166', '#4cc9f0', '#ff4d6d', '#80ed99', '#c77dff'];
  for (let i = 0; i < 9; i++) {
    spawnParticle(
      game.particles,
      game.rng.range(80, 1200),
      game.rng.range(60, 660),
      colors[i % colors.length],
      40,
      320,
      1.4,
      3,
    );
  }
  // Let the celebration particles age a little so the frame is mid-burst.
  for (let s = 0; s < 35; s++) update(game, STEP, input, null);
  game.time = 12;
}

function copyGameState(dst, src) {
  // Copy the live fields so a retry on another seed still renders here.
  const keep = { seed: dst.seed, rng: dst.rng, stars: dst.stars, nebula: dst.nebula };
  Object.assign(dst, src, keep);
  dst.rng = keep.rng;
}

export function stageShot(name, seed) {
  const game = createGame(seed);
  if (name === 'title') stageTitle(game);
  else if (name === 'combat') stageCombat(game);
  else if (name === 'upgrade') stageUpgrade(game);
  else if (name === 'victory') stageVictory(game);
  else throw new Error(`unknown shot: ${name}`);
  return game;
}

// Render one staged frame onto the canvas and mark it ready for capture.
export function renderShot(canvas, name, seed) {
  const ctx = canvas.getContext('2d');
  const game = stageShot(name, seed);
  draw(ctx, game);
  window.__NEONVOID__ = { game, shot: name, seed, shotReady: true };
  document.title = `NEON VOID — shot ${name} ready`;
  return game;
}
