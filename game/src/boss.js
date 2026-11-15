// NEON VOID — the Warden: the wave-10 boss and its three phases.
// One job: how the boss fights. The sim asks for the phase and calls
// wardenFire when the boss's timer runs out; the renderer reads the phase
// for the boss bar. Phase I is a slow radial burst, Phase II a rotating
// spiral, Phase III a radial burst plus an aimed volley.

import { TAU, spawnBullet } from './entities.js';

const ROMAN = ['I', 'II', 'III'];

export function wardenPhase(enemy) {
  const frac = enemy.hp / enemy.maxHp;
  return frac > 2 / 3 ? 1 : frac > 1 / 3 ? 2 : 3;
}

export function wardenPhaseName(phase) {
  return `PHASE ${ROMAN[phase - 1] || 'I'}`;
}

function radial(game, e, count, speed, offset) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU + offset;
    game.enemyBullets.push(spawnBullet(e.x, e.y, a, speed, 14, 0, false, 7));
  }
}

function aimedVolley(game, e, count, spread) {
  const p = game.player;
  const base = Math.atan2(p.y - e.y, p.x - e.x);
  for (let i = 0; i < count; i++) {
    const a = base + (i - (count - 1) / 2) * spread;
    game.enemyBullets.push(spawnBullet(e.x, e.y, a, 300, 12, 0, false, 6));
  }
}

export function wardenFire(game, e) {
  const phase = wardenPhase(e);
  if (phase === 1) {
    // Slow, readable radial burst — learn the pattern.
    radial(game, e, 10, 170, e.t);
    e.fireTimer = 2.4;
  } else if (phase === 2) {
    // Rotating spiral: a fan that sweeps as the boss turns.
    const base = e.t * 1.4;
    for (let i = 0; i < 5; i++) {
      const a = base + (i - 2) * 0.28;
      game.enemyBullets.push(spawnBullet(e.x, e.y, a, 210, 12, 0, false, 6));
    }
    radial(game, e, 8, 120, e.t * 0.5);
    e.fireTimer = 1.7;
  } else {
    // Desperate: a dense ring plus a volley straight at the ship.
    radial(game, e, 14, 190, e.t);
    aimedVolley(game, e, 3, 0.22);
    e.fireTimer = 2.0;
  }
}
