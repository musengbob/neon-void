// NEON VOID — the things that move: player, enemies, bullets, pickups, particles.
// Pure data + update functions; rendering lives in render.js, orchestration in sim.js.

export const WORLD = { w: 1280, h: 720 };
export const TAU = Math.PI * 2;

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function dist2(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

export function createPlayer() {
  return {
    x: 640,
    y: 360,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    radius: 14,
    hp: 100,
    maxHp: 100,
    shield: 0,
    maxShield: 50,
    speed: 340,
    fireRate: 7, // shots per second
    damage: 12,
    bulletSpeed: 720,
    bulletSize: 5,
    multiShot: 1,
    pierce: 0,
    magnet: 90,
    dashCooldown: 2.2,
    dashTimer: 0,
    dashTime: 0, // >0 while dashing (invulnerable)
    fireTimer: 0,
    invuln: 0, // seconds of post-hit protection
    alive: true,
    trail: [],
  };
}

export function resetPlayer(p) {
  const fresh = createPlayer();
  Object.assign(p, fresh);
}

// Enemy types: name, colour, hp, speed, radius, score, salvage, behaviour.
// The name is shown in the HUD's incoming list and the wave banner;
// salvage is the economy — kills pay it, and it is spent between waves.
export const ENEMY_TYPES = {
  drone: { name: 'HUSK DRONE', hp: 18, speed: 95, radius: 15, score: 50, salvage: 5, color: '#ff4d6d', kind: 'chaser' },
  weaver: { name: 'RAZOR WEAVER', hp: 14, speed: 130, radius: 13, score: 70, salvage: 7, color: '#ff9f1c', kind: 'weaver' },
  stinger: { name: 'SPIRE STINGER', hp: 24, speed: 70, radius: 16, score: 90, salvage: 9, color: '#b5179e', kind: 'shooter' },
  splitter: { name: 'HIVE SPLITTER', hp: 34, speed: 75, radius: 20, score: 120, salvage: 12, color: '#4cc9f0', kind: 'splitter' },
  shard: { name: 'HIVE SHARD', hp: 8, speed: 190, radius: 9, score: 25, salvage: 2, color: '#4cc9f0', kind: 'chaser' },
  warden: { name: 'THE WARDEN', hp: 900, speed: 42, radius: 52, score: 2500, salvage: 100, color: '#f72585', kind: 'boss' },
};

export function spawnEnemy(type, x, y, wave, rng, diff) {
  const def = ENEMY_TYPES[type];
  const hpScale = (1 + (wave - 1) * 0.14) * (diff ? diff.enemyHp : 1);
  return {
    type,
    name: def.name,
    kind: def.kind,
    x,
    y,
    vx: 0,
    vy: 0,
    angle: 0,
    radius: def.radius,
    hp: Math.round(def.hp * hpScale),
    maxHp: Math.round(def.hp * hpScale),
    speed: def.speed * rng.range(0.9, 1.15) * (diff ? diff.enemySpeed : 1),
    score: def.score,
    salvage: def.salvage,
    color: def.color,
    t: rng.range(0, TAU), // behaviour clock
    fireTimer: rng.range(1, 2.5),
    hitFlash: 0,
    dead: false,
    elite: false,
    phase: 1, // boss only: the Warden's current phase (boss.js)
  };
}

export function makeElite(enemy) {
  enemy.elite = true;
  enemy.hp = Math.round(enemy.hp * 2.2);
  enemy.maxHp = enemy.hp;
  enemy.radius = Math.round(enemy.radius * 1.25);
  enemy.score *= 3;
  enemy.speed *= 1.1;
  return enemy;
}

// Steer one enemy toward the player for dt seconds; returns nothing, mutates.
export function updateEnemy(e, player, dt, rng) {
  e.t += dt;
  e.hitFlash = Math.max(0, e.hitFlash - dt * 6);
  const dx = player.x - e.x;
  const dy = player.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d;
  const uy = dy / d;
  if (e.kind === 'chaser') {
    e.vx += ux * e.speed * 3 * dt;
    e.vy += uy * e.speed * 3 * dt;
  } else if (e.kind === 'weaver') {
    const px = -uy * Math.sin(e.t * 3.2);
    const py = ux * Math.sin(e.t * 3.2);
    e.vx += (ux * 0.8 + px * 0.9) * e.speed * 3 * dt;
    e.vy += (uy * 0.8 + py * 0.9) * e.speed * 3 * dt;
  } else if (e.kind === 'shooter') {
    // Keep a standoff ring around the player, strafe sideways.
    const want = 260;
    const radial = (d - want) / want;
    const px = -uy;
    const py = ux;
    e.vx += (ux * radial * 1.4 + px * 0.7) * e.speed * 3 * dt;
    e.vy += (uy * radial * 1.4 + py * 0.7) * e.speed * 3 * dt;
  } else if (e.kind === 'splitter') {
    e.vx += ux * e.speed * 2.4 * dt;
    e.vy += uy * e.speed * 2.4 * dt;
  } else if (e.kind === 'boss') {
    e.vx += ux * e.speed * 2.2 * dt;
    e.vy += uy * e.speed * 2.2 * dt;
  }
  // Drag + cap speed.
  e.vx *= 1 - Math.min(1, 2.4 * dt);
  e.vy *= 1 - Math.min(1, 2.4 * dt);
  const sp = Math.hypot(e.vx, e.vy);
  const cap = e.speed * 1.6;
  if (sp > cap) {
    e.vx = (e.vx / sp) * cap;
    e.vy = (e.vy / sp) * cap;
  }
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  e.x = clamp(e.x, e.radius, WORLD.w - e.radius);
  e.y = clamp(e.y, e.radius, WORLD.h - e.radius);
  e.angle = Math.atan2(dy, dx);
}

export function spawnBullet(x, y, angle, speed, damage, pierce, friendly, size) {
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: size,
    damage,
    pierce,
    friendly,
    life: 1.6,
    dead: false,
  };
}

export function updateBullet(b, dt) {
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.life -= dt;
  if (b.life <= 0 || b.x < -20 || b.x > WORLD.w + 20 || b.y < -20 || b.y > WORLD.h + 20) {
    b.dead = true;
  }
}

export function spawnParticle(list, x, y, color, count, speed, life, size) {
  for (let i = 0; i < count; i++) {
    if (list.length > 420) return;
    const a = Math.random() * TAU;
    const s = speed * (0.3 + Math.random() * 0.7);
    list.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: life * (0.5 + Math.random() * 0.5),
      maxLife: life,
      size: size * (0.6 + Math.random() * 0.8),
      color,
      drag: 0.92,
    });
  }
}

export function updateParticle(p, dt) {
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.vx *= Math.pow(p.drag, dt * 60);
  p.vy *= Math.pow(p.drag, dt * 60);
  p.life -= dt;
}

export function spawnPickup(list, x, y, kind, rng) {
  list.push({
    x: clamp(x, 20, WORLD.w - 20),
    y: clamp(y, 20, WORLD.h - 20),
    kind, // 'gem' | 'repair' | 'cell'
    value: kind === 'gem' ? rng.int(10, 25) : kind === 'repair' ? 25 : 25,
    t: rng.range(0, TAU),
    vx: rng.range(-30, 30),
    vy: rng.range(-30, 30),
    life: 14,
    dead: false,
  });
}

export function updatePickup(p, player, dt) {
  p.t += dt;
  p.life -= dt;
  if (p.life <= 0) p.dead = true;
  const d2 = dist2(p.x, p.y, player.x, player.y);
  const magnetR = player.magnet;
  if (d2 < magnetR * magnetR) {
    const d = Math.sqrt(d2) || 1;
    const pull = 900 * (1 - d / magnetR) + 200;
    p.vx += ((player.x - p.x) / d) * pull * dt;
    p.vy += ((player.y - p.y) / d) * pull * dt;
  }
  p.vx *= 1 - Math.min(1, 2 * dt);
  p.vy *= 1 - Math.min(1, 2 * dt);
  p.x = clamp(p.x + p.vx * dt, 12, WORLD.w - 12);
  p.y = clamp(p.y + p.vy * dt, 12, WORLD.h - 12);
}

export function addFloatText(list, x, y, text, color, size = 14) {
  if (list.length > 60) list.shift();
  list.push({ x, y, text, color, size, life: 0.9, maxLife: 0.9 });
}

export function updateFloatText(t, dt) {
  t.y -= 42 * dt;
  t.life -= dt;
}
