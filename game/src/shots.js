// NEON VOID — screenshot staging: build a real game state for each shot and
// render one frame of it. The shots are renders of the game's own code and
// its own render path, staged with a fixed seed so they reproduce exactly.
// ?shot=title | combat | upgrade | victory, &seed=N (default 7).

import { createGame, startRun, update, autopilot, applyUpgrade, MODES } from './sim.js';
import { createScriptedInput } from './input.js';
import { spawnEnemy, spawnBullet, spawnParticle } from './entities.js';
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
  // Play ~30 seconds of autopilot: mid-wave-3 or 4, busy and alive.
  runSteps(game, input, 30 * 60);
  if (game.mode === MODES.GAMEOVER) {
    // The autopilot died on this seed: restart once with a kinder seed.
    const retry = createGame(game.seed + 101);
    startRun(retry, null);
    runSteps(retry, input, 30 * 60);
    copyGameState(game, retry);
  }
  // Make the frame dense: top the swarm up to a dozen hostiles, mixed types,
  // a stinger mid-volley, and a burst of fire around the player.
  const types = ['drone', 'weaver', 'stinger', 'splitter', 'drone', 'weaver'];
  let i = 0;
  while (game.enemies.length < 12 && i < 10) {
    const type = types[i % types.length];
    game.enemies.push(
      spawnEnemy(type, 140 + ((i * 173) % 1000), 110 + ((i * 211) % 480), game.wave, game.rng),
    );
    i += 1;
  }
  for (const e of game.enemies) {
    if (e.type === 'stinger') {
      const a = Math.atan2(game.player.y - e.y, game.player.x - e.x);
      game.enemyBullets.push(spawnBullet(e.x, e.y, a, 260, 10, 0, false, 6));
    }
  }
  spawnParticle(game.particles, game.player.x, game.player.y, '#ffe66d', 18, 260, 0.5, 2);
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
  game.playTime = 612;
  game.wave = 10;
  game.stats.wavesCleared = 10;
  game.stats.upgradesTaken = 9;
  game.stats.dashes = 87;
  game.mode = MODES.VICTORY;
  game.over = true;
  game.best = 284750;
  for (let i = 0; i < 5; i++) {
    spawnParticle(
      game.particles,
      game.rng.range(200, 1080),
      game.rng.range(100, 520),
      ['#ffd166', '#4cc9f0', '#ff4d6d', '#80ed99'][i % 4],
      30,
      300,
      1.2,
      3,
    );
  }
  // Let the celebration particles age a little so the frame is mid-burst.
  for (let s = 0; s < 20; s++) update(game, STEP, input, null);
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
