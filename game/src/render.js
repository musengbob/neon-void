// NEON VOID — everything the player sees: the arena, the ships, the HUD,
// and the title / upgrade / game-over / victory screens. All art is drawn
// in code (no image files): the palette is deep-space violet with hot neon.

import { WORLD, TAU, clamp, ENEMY_TYPES } from './entities.js';
import { MODES, REPAIR_COST, REPAIR_AMOUNT, REROLL_COST } from './sim.js';
import { TOTAL_WAVES, waveName, waveCompCounts } from './waves.js';
import { UPGRADE_POOL } from './upgrades.js';
import { STORY, GATE, DIFFICULTIES, DIFFICULTY_ORDER } from './world.js';
import { wardenPhaseName } from './boss.js';

const FONT = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
const MONO = "'Cascadia Code', Consolas, monospace";

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function poly(ctx, x, y, radius, sides, rotation) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rotation + (i / sides) * TAU;
    const px = x + Math.cos(a) * radius;
    const py = y + Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// --- Click zones, single-sourced: the renderer draws them, main.js asks
// here whether a click landed on one. ---

// Title difficulty boxes: three boxes, 250x84, centred in a row.
export function titleDiffBoxes() {
  const w = 250;
  const h = 84;
  const gap = 20;
  const total = w * DIFFICULTY_ORDER.length + gap * (DIFFICULTY_ORDER.length - 1);
  const x0 = (WORLD.w - total) / 2;
  const y = 415;
  return DIFFICULTY_ORDER.map((id, i) => ({ id, x: x0 + i * (w + gap), y, w, h }));
}

export function titleDifficultyAt(x, y) {
  for (const b of titleDiffBoxes()) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.id;
  }
  return null;
}

// Pause menu buttons: three stacked buttons, 360x52, centred.
export function pauseButtons() {
  const w = 360;
  const h = 52;
  const x = (WORLD.w - w) / 2;
  return [
    { id: 'resume', x, y: 300, w, h },
    { id: 'restart', x, y: 368, w, h },
    { id: 'quit', x, y: 436, w, h },
  ];
}

export function pauseHit(x, y) {
  for (const b of pauseButtons()) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.id;
  }
  return null;
}

// Upgrade shop buttons, under the draft cards: repair and reroll.
export function shopButtons() {
  return [
    { id: 'repair', x: 390, y: 478, w: 240, h: 46 },
    { id: 'reroll', x: 650, y: 478, w: 240, h: 46 },
  ];
}

export function upgradeShopAt(x, y) {
  for (const b of shopButtons()) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.id;
  }
  return null;
}

function drawBackground(ctx, game) {
  const g = ctx.createLinearGradient(0, 0, 0, WORLD.h);
  g.addColorStop(0, '#070312');
  g.addColorStop(0.55, '#0d0524');
  g.addColorStop(1, '#12082e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);

  // Nebula blobs.
  ctx.globalCompositeOperation = 'lighter';
  for (const b of game.nebula) {
    const rg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
    rg.addColorStop(0, b.color + '30');
    rg.addColorStop(1, b.color + '00');
    ctx.fillStyle = rg;
    ctx.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
  }
  // Stars, twinkling with time.
  for (const s of game.stars) {
    const a = 0.35 + 0.3 * Math.sin(game.time * 1.5 + s.tw);
    ctx.fillStyle = `rgba(255,255,255,${a * s.z})`;
    ctx.fillRect(s.x, s.y, s.r, s.r);
  }
  ctx.globalCompositeOperation = 'source-over';

  // The VOID GATE: a faint rift ring at the arena's heart, the thing the
  // player defends. Slow swirl arcs + a dim label, never a collision object.
  ctx.save();
  ctx.translate(GATE.x, GATE.y);
  ctx.globalCompositeOperation = 'lighter';
  const gateGlow = ctx.createRadialGradient(0, 0, GATE.r * 0.4, 0, 0, GATE.r * 1.15);
  gateGlow.addColorStop(0, 'rgba(124, 77, 255, 0.05)');
  gateGlow.addColorStop(1, 'rgba(124, 77, 255, 0)');
  ctx.fillStyle = gateGlow;
  ctx.fillRect(-GATE.r * 1.2, -GATE.r * 1.2, GATE.r * 2.4, GATE.r * 2.4);
  ctx.strokeStyle = 'rgba(167, 139, 250, 0.28)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, GATE.r, game.time * 0.12, game.time * 0.12 + Math.PI * 1.4);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(76, 201, 240, 0.22)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, GATE.r * 0.82, -game.time * 0.2, -game.time * 0.2 + Math.PI * 1.1);
  ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
  // The label only while playing: on the title / draft / end screens the
  // headings sit where it would land.
  if (game.mode === MODES.PLAYING || game.mode === MODES.PAUSED) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = `bold 12px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText('V O I D   G A T E', 0, -GATE.r - 10);
  }
  ctx.restore();

  // Derelict station debris: broken plates, a wreck ring, antenna spars.
  for (const d of game.debris) {
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.rot + game.time * d.spin);
    ctx.strokeStyle = 'rgba(148, 140, 180, 0.35)';
    ctx.fillStyle = 'rgba(60, 50, 90, 0.35)';
    ctx.lineWidth = 2;
    if (d.kind === 'plate') {
      ctx.fillRect(-d.r, -d.r * 0.55, d.r * 2, d.r * 1.1);
      ctx.strokeRect(-d.r, -d.r * 0.55, d.r * 2, d.r * 1.1);
      ctx.beginPath();
      ctx.moveTo(-d.r * 0.4, -d.r * 0.55);
      ctx.lineTo(d.r * 0.2, d.r * 0.55);
      ctx.stroke();
    } else if (d.kind === 'ring') {
      ctx.beginPath();
      ctx.arc(0, 0, d.r, 0.4, Math.PI * 1.7);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, d.r * 0.6, 2.2, Math.PI * 1.2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(-d.r, 0);
      ctx.lineTo(d.r, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(d.r, 0, 4, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Faint grid, for motion reference.
  ctx.strokeStyle = 'rgba(120, 90, 255, 0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= WORLD.w; x += 80) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, WORLD.h);
  }
  for (let y = 0; y <= WORLD.h; y += 80) {
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD.w, y);
  }
  ctx.stroke();
}

function drawPlayer(ctx, game) {
  const p = game.player;
  if (!p.alive) return;
  // Engine trail.
  for (const t of p.trail) {
    ctx.globalAlpha = (t.life / 0.25) * 0.35;
    ctx.fillStyle = '#4cc9f0';
    ctx.beginPath();
    ctx.arc(t.x, t.y, 7, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.dashTime > 0 || p.invuln > 0) {
    ctx.globalAlpha = p.dashTime > 0 ? 0.55 : 0.6 + 0.4 * Math.sin(game.time * 30);
  }
  ctx.rotate(p.angle);
  // Glow.
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(76, 201, 240, 0.18)';
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, TAU);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  // Hull: a dart.
  ctx.fillStyle = '#e0fbfc';
  ctx.strokeStyle = '#4cc9f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(-12, -11);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-12, 11);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Cockpit.
  ctx.fillStyle = '#4361ee';
  ctx.beginPath();
  ctx.arc(5, 0, 4.5, 0, TAU);
  ctx.fill();
  ctx.restore();
  // Shield ring.
  if (p.shield > 0) {
    ctx.strokeStyle = `rgba(67, 97, 238, ${0.35 + 0.25 * Math.sin(game.time * 4)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 9, 0, TAU);
    ctx.stroke();
  }
}

function drawEnemy(ctx, e, game) {
  ctx.save();
  ctx.translate(e.x, e.y);
  const flash = e.hitFlash > 0.4;
  const color = flash ? '#ffffff' : e.color;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = e.color + '22';
  ctx.beginPath();
  ctx.arc(0, 0, e.radius + 12, 0, TAU);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.rotate(e.angle);
  ctx.fillStyle = color;
  ctx.strokeStyle = flash ? '#ffffff' : e.color;
  ctx.lineWidth = 2;
  if (e.type === 'drone' || e.type === 'shard') {
    poly(ctx, 0, 0, e.radius, 3, 0);
    ctx.fill();
    ctx.stroke();
  } else if (e.type === 'weaver') {
    poly(ctx, 0, 0, e.radius, 4, e.t * 2);
    ctx.fill();
    ctx.stroke();
  } else if (e.type === 'stinger') {
    poly(ctx, 0, 0, e.radius, 5, 0);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(e.radius * 0.45, 0, 3, 0, TAU);
    ctx.fill();
  } else if (e.type === 'splitter') {
    poly(ctx, 0, 0, e.radius, 6, e.t);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, e.radius * 0.5, 0, TAU);
    ctx.stroke();
  } else if (e.type === 'warden') {
    poly(ctx, 0, 0, e.radius, 6, e.t * 0.5);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffd166';
    poly(ctx, 0, 0, e.radius * 0.55, 6, -e.t * 0.8);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  // Elite marker + boss HP bar.
  if (e.elite) {
    ctx.fillStyle = '#ffd166';
    ctx.font = `bold 11px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText('ELITE', e.x, e.y - e.radius - 8);
  }
  if (e.type === 'warden') {
    const w = 260;
    const x = WORLD.w / 2 - w / 2;
    const y = 54;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    rr(ctx, x - 4, y - 4, w + 8, 16, 6);
    ctx.fill();
    ctx.fillStyle = '#f72585';
    rr(ctx, x, y, w * (e.hp / e.maxHp), 8, 4);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 12px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText(`THE WARDEN — ${wardenPhaseName(e.phase)}`, WORLD.w / 2, y + 28);
  } else if (e.hp < e.maxHp && e.maxHp > 30) {
    const w = e.radius * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 10, w, 4);
    ctx.fillStyle = e.color;
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 10, w * (e.hp / e.maxHp), 4);
  }
}

function drawBullets(ctx, game) {
  ctx.globalCompositeOperation = 'lighter';
  for (const b of game.bullets) {
    ctx.fillStyle = '#ffe66d';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius + 3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, TAU);
    ctx.fill();
  }
  for (const b of game.enemyBullets) {
    ctx.fillStyle = '#ff4d6d';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius + 3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * 0.6, 0, TAU);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

function drawPickups(ctx, game) {
  for (const pk of game.pickups) {
    const bob = Math.sin(pk.t * 4) * 3;
    const y = pk.y + bob;
    ctx.save();
    ctx.translate(pk.x, y);
    ctx.globalCompositeOperation = 'lighter';
    if (pk.kind === 'gem') {
      ctx.fillStyle = 'rgba(76, 201, 240, 0.25)';
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.rotate(pk.t);
      ctx.fillStyle = '#4cc9f0';
      poly(ctx, 0, 0, 7, 4, 0);
      ctx.fill();
    } else if (pk.kind === 'repair') {
      ctx.fillStyle = 'rgba(128, 237, 153, 0.25)';
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#80ed99';
      ctx.fillRect(-2.5, -8, 5, 16);
      ctx.fillRect(-8, -2.5, 16, 5);
    } else {
      ctx.fillStyle = 'rgba(67, 97, 238, 0.3)';
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = '#4361ee';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawParticles(ctx, game) {
  ctx.globalCompositeOperation = 'lighter';
  for (const pt of game.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function drawFloatTexts(ctx, game) {
  ctx.textAlign = 'center';
  for (const t of game.texts) {
    ctx.globalAlpha = clamp(t.life / t.maxLife, 0, 1);
    ctx.fillStyle = t.color;
    ctx.font = `bold ${t.size}px ${MONO}`;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}

function bar(ctx, x, y, w, h, frac, color, bg = 'rgba(255,255,255,0.14)') {
  ctx.fillStyle = bg;
  rr(ctx, x, y, w, h, h / 2);
  ctx.fill();
  if (frac > 0) {
    ctx.fillStyle = color;
    rr(ctx, x, y, Math.max(h, w * clamp(frac, 0, 1)), h, h / 2);
    ctx.fill();
  }
}

function drawHud(ctx, game) {
  const p = game.player;
  // Top-left: score + best + salvage economy + kills + combo.
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 26px ${MONO}`;
  ctx.fillText(`SCORE ${game.score.toLocaleString('en-US')}`, 22, 36);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = `13px ${MONO}`;
  ctx.fillText(`BEST ${Math.max(game.best, game.score).toLocaleString('en-US')}`, 22, 56);
  ctx.fillStyle = '#ffd166';
  ctx.font = `bold 15px ${MONO}`;
  ctx.fillText(`◆ SALVAGE ${game.salvage}  ·  KILLS ${game.kills}`, 22, 80);
  if (game.combo > 1.05) {
    ctx.fillStyle = '#ffd166';
    ctx.font = `bold 18px ${MONO}`;
    ctx.fillText(`COMBO x${game.combo.toFixed(2)}`, 22, 106);
  }
  // Top-center: wave + its name + enemies left.
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 20px ${MONO}`;
  const left = game.enemies.length + game.spawnQueue.length;
  ctx.fillText(`WAVE ${game.wave} / ${TOTAL_WAVES} — ${waveName(game.wave)}`, WORLD.w / 2, 34);
  if (!game.bossActive) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = `13px ${MONO}`;
    ctx.fillText(left > 0 ? `${left} HOSTILES REMAIN` : 'WAVE CLEAR', WORLD.w / 2, 54);
  }
  // Top-right: mute state + pause hint.
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = `12px ${MONO}`;
  ctx.fillText(`P PAUSE · M SOUND ${game.muted ? 'OFF' : 'ON'}`, WORLD.w - 22, 30);
  // Right panel: INCOMING — what the next wave brings, by name and count,
  // so the player can plan the draft. On the last wave it names the boss.
  drawIncoming(ctx, game);
  // Bottom-left: hull + shield bars.
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 13px ${MONO}`;
  ctx.fillText('HULL', 22, WORLD.h - 52);
  bar(ctx, 70, WORLD.h - 62, 220, 12, p.hp / p.maxHp, p.hp > 30 ? '#80ed99' : '#ff4d6d');
  ctx.fillText('SHIELD', 22, WORLD.h - 28);
  bar(ctx, 70, WORLD.h - 38, 220, 12, p.shield / Math.max(1, p.maxShield), '#4361ee');
  // Bottom-center: the build so far — what the drafts bought.
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = `12px ${MONO}`;
  ctx.fillText(buildLine(game), WORLD.w / 2, WORLD.h - 28);
  // Bottom-right: dash cooldown + weapon summary.
  const dashFrac = 1 - p.dashTimer / p.dashCooldown;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 13px ${MONO}`;
  ctx.fillText(p.dashTimer <= 0 ? 'DASH READY  [SHIFT]' : 'DASH …', WORLD.w - 22, WORLD.h - 52);
  bar(ctx, WORLD.w - 242, WORLD.h - 62, 220, 12, dashFrac, '#c77dff');
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = `12px ${MONO}`;
  ctx.fillText(
    `DMG ${Math.round(p.damage)} · x${p.multiShot} SHOT · ${p.fireRate.toFixed(1)}/s`,
    WORLD.w - 22,
    WORLD.h - 28,
  );
  // Wave banner.
  if (game.waveBannerTimer > 0) {
    ctx.globalAlpha = clamp(game.waveBannerTimer, 0, 1);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 40px ${FONT}`;
    ctx.fillText(game.waveBanner, WORLD.w / 2, 190);
    ctx.globalAlpha = 1;
  }
  // Low-hull warning.
  if (p.hp > 0 && p.hp <= 30) {
    const pulse = 0.25 + 0.2 * Math.sin(game.time * 8);
    ctx.fillStyle = `rgba(255, 77, 109, ${pulse})`;
    ctx.fillRect(0, 0, WORLD.w, 6);
    ctx.fillRect(0, WORLD.h - 6, WORLD.w, 6);
    ctx.fillRect(0, 0, 6, WORLD.h);
    ctx.fillRect(WORLD.w - 6, 0, 6, WORLD.h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff4d6d';
    ctx.font = `bold 16px ${MONO}`;
    ctx.fillText('HULL CRITICAL — FIND A REPAIR', WORLD.w / 2, WORLD.h - 84);
  }
}

// One line naming the build: the upgrades the drafts have bought so far.
function buildLine(game) {
  const parts = [];
  for (const u of UPGRADE_POOL) {
    const n = game.owned[u.id] || 0;
    if (n > 0) parts.push(`${u.name.toUpperCase()} x${n}`);
  }
  return parts.length > 0 ? `BUILD: ${parts.join(' · ')}` : 'BUILD: — CLEAR A WAVE TO DRAFT';
}

// Right-side INCOMING panel: the next wave's composition, named + counted.
function drawIncoming(ctx, game) {
  const x = 1052;
  const y = 64;
  const w = 206;
  const next = game.wave + 1;
  const isLast = game.wave >= TOTAL_WAVES;
  const rows = isLast ? [] : waveCompCounts(next);
  const h = 34 + rows.length * 24 + (isLast ? 64 : 30);
  ctx.fillStyle = 'rgba(7, 3, 18, 0.62)';
  rr(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(124, 77, 255, 0.45)';
  ctx.lineWidth = 1.5;
  rr(ctx, x, y, w, h, 10);
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd166';
  ctx.font = `bold 13px ${MONO}`;
  ctx.fillText(isLast ? 'FINAL WAVE' : `INCOMING — WAVE ${next}`, x + 12, y + 22);
  if (isLast) {
    ctx.fillStyle = '#f72585';
    ctx.font = `bold 14px ${MONO}`;
    ctx.fillText('THE WARDEN', x + 12, y + 50);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `12px ${MONO}`;
    ctx.fillText('3 PHASES: RADIAL', x + 12, y + 70);
    ctx.fillText('SPIRAL · VOLLEY', x + 12, y + 88);
  } else {
    const sides = { drone: 3, weaver: 4, stinger: 5, splitter: 6 };
    rows.forEach((row, i) => {
      const def = ENEMY_TYPES[row.type];
      const ry = y + 44 + i * 24;
      ctx.save();
      ctx.translate(x + 22, ry - 4);
      ctx.fillStyle = def.color;
      poly(ctx, 0, 0, 7, sides[row.type] || 3, 0);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#ffffff';
      ctx.font = `12px ${MONO}`;
      ctx.fillText(def.name, x + 36, ry);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffd166';
      ctx.font = `bold 12px ${MONO}`;
      ctx.fillText(`x${row.count}`, x + w - 12, ry);
      ctx.textAlign = 'left';
    });
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `11px ${MONO}`;
    ctx.fillText('KILLS PAY ◆ — SPEND IT', x + 12, y + h - 10);
  }
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(7, 3, 18, 0.82)';
  rr(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(124, 77, 255, 0.5)';
  ctx.lineWidth = 1.5;
  rr(ctx, x, y, w, h, 14);
  ctx.stroke();
}

function drawTitle(ctx, game) {
  ctx.fillStyle = 'rgba(7, 3, 18, 0.42)';
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  ctx.textAlign = 'center';
  // Logo.
  ctx.fillStyle = '#4cc9f0';
  ctx.font = `bold 84px ${FONT}`;
  ctx.shadowColor = '#4361ee';
  ctx.shadowBlur = 34;
  ctx.fillText('NEON VOID', WORLD.w / 2, 112);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffd166';
  ctx.font = `bold 20px ${MONO}`;
  ctx.fillText('SURVIVE THE SWARM  ·  HOLD THE VOID GATE', WORLD.w / 2, 146);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = `15px ${MONO}`;
  ctx.fillText(STORY, WORLD.w / 2, 176);
  // The rules panel: goal, fight, build, win, lose — the whole game in one read.
  panel(ctx, 240, 196, 800, 196);
  const rules = [
    ['GOAL', 'Hold the Void Gate — clear all 10 waves of the Swarm.'],
    ['FIGHT', 'WASD fly · mouse aim · hold click / Space to fire · Shift dash.'],
    ['BUILD', 'Kills pay salvage ◆ — repair your hull or reroll the draft.'],
    ['WIN', 'Destroy THE WARDEN, the 3-phase boss at wave 10.'],
    ['LOSE', 'Your hull reaches 0 — the Swarm takes the Gate.'],
  ];
  rules.forEach(([label, text], i) => {
    const y = 232 + i * 30;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd166';
    ctx.font = `bold 15px ${MONO}`;
    ctx.fillText(label, 268, y);
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.font = `15px ${MONO}`;
    ctx.fillText(text, 360, y);
  });
  // Difficulty choice: click a box or press 1 / 2 / 3 to begin.
  const boxes = titleDiffBoxes();
  boxes.forEach((b) => {
    const d = DIFFICULTIES[b.id];
    const picked = game.titlePick === b.id;
    const hover =
      game.mouseX >= b.x && game.mouseX <= b.x + b.w && game.mouseY >= b.y && game.mouseY <= b.y + b.h;
    ctx.save();
    if (picked || hover) {
      ctx.shadowColor = '#4cc9f0';
      ctx.shadowBlur = 22;
    }
    ctx.fillStyle = picked ? 'rgba(67, 97, 238, 0.4)' : 'rgba(7, 3, 18, 0.82)';
    rr(ctx, b.x, b.y, b.w, b.h, 12);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = picked ? '#4cc9f0' : 'rgba(124, 77, 255, 0.5)';
    ctx.lineWidth = picked ? 2.5 : 1.5;
    rr(ctx, b.x, b.y, b.w, b.h, 12);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 20px ${FONT}`;
    ctx.fillText(`[${d.key}] ${d.name}`, b.x + b.w / 2, b.y + 30);
    ctx.fillStyle = '#ffd166';
    ctx.font = `bold 12px ${MONO}`;
    ctx.fillText(d.tag, b.x + b.w / 2, b.y + 52);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `10px ${MONO}`;
    ctx.fillText(d.desc, b.x + b.w / 2, b.y + 70);
  });
  const pulse = 0.75 + 0.25 * Math.sin(game.time * 3);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 18px ${FONT}`;
  ctx.fillText('CLICK A DIFFICULTY TO BEGIN — OR PRESS ENTER FOR STANDARD', WORLD.w / 2, 540);
  ctx.globalAlpha = 1;
  if (game.best > 0) {
    ctx.fillStyle = '#ffd166';
    ctx.font = `bold 15px ${MONO}`;
    ctx.fillText(`BEST SCORE  ${game.best.toLocaleString('en-US')}`, WORLD.w / 2, 572);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = `13px ${MONO}`;
  ctx.fillText(
    'WASD / ARROWS FLY · MOUSE AIM · CLICK / SPACE FIRE · SHIFT DASH · P PAUSE · M SOUND',
    WORLD.w / 2,
    606,
  );
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = `12px ${MONO}`;
  ctx.fillText('An original game — art, sound and code made for this bounty.', WORLD.w / 2, 690);
}

function drawUpgrade(ctx, game) {
  drawHud(ctx, game);
  ctx.fillStyle = 'rgba(7, 3, 18, 0.6)';
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd166';
  ctx.font = `bold 34px ${FONT}`;
  ctx.fillText(`WAVE ${game.wave} CLEAR`, WORLD.w / 2, 150);
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 20px ${MONO}`;
  ctx.fillText('CHOOSE ONE UPGRADE  —  CLICK A CARD OR PRESS 1 / 2 / 3', WORLD.w / 2, 190);
  const cw = 300;
  const ch = 210;
  const gap = 28;
  const total = cw * 3 + gap * 2;
  const x0 = (WORLD.w - total) / 2;
  const y0 = 250;
  game.draft.forEach((u, i) => {
    const x = x0 + i * (cw + gap);
    const hover =
      game.mouseX >= x && game.mouseX <= x + cw && game.mouseY >= y0 && game.mouseY <= y0 + ch;
    ctx.save();
    if (hover) {
      ctx.shadowColor = u.color;
      ctx.shadowBlur = 26;
    }
    panel(ctx, x, y0, cw, ch);
    ctx.restore();
    ctx.fillStyle = u.color;
    ctx.font = `bold 15px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText(`[${i + 1}]`, x + cw / 2, y0 + 34);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 22px ${FONT}`;
    ctx.fillText(u.name, x + cw / 2, y0 + 78, cw - 24);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = `16px ${MONO}`;
    ctx.fillText(u.desc, x + cw / 2, y0 + 116, cw - 24);
    const owned = game.owned[u.id] || 0;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = `13px ${MONO}`;
    ctx.fillText(`OWNED ${owned} / ${u.max}`, x + cw / 2, y0 + 178);
  });
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = `14px ${MONO}`;
  ctx.fillText(
    `SCORE ${game.score.toLocaleString('en-US')} · KILLS ${game.kills} · SALVAGE ◆ ${game.salvage}`,
    WORLD.w / 2,
    548,
  );
  // Between-wave shop: spend salvage on a repair or a fresh draft.
  const shop = shopButtons();
  const repair = shop[0];
  const reroll = shop[1];
  const repairOk = game.salvage >= REPAIR_COST && game.player.hp < game.player.maxHp;
  const rerollOk = game.salvage >= REROLL_COST;
  const hoverRepair =
    game.mouseX >= repair.x && game.mouseX <= repair.x + repair.w &&
    game.mouseY >= repair.y && game.mouseY <= repair.y + repair.h;
  const hoverReroll =
    game.mouseX >= reroll.x && game.mouseX <= reroll.x + reroll.w &&
    game.mouseY >= reroll.y && game.mouseY <= reroll.y + reroll.h;
  for (const [b, ok, hover, label] of [
    [repair, repairOk, hoverRepair, `[4] REPAIR HULL +${REPAIR_AMOUNT} — ${REPAIR_COST}◆`],
    [reroll, rerollOk, hoverReroll, `[5] REROLL DRAFT — ${REROLL_COST}◆`],
  ]) {
    ctx.save();
    if (hover && ok) {
      ctx.shadowColor = '#ffd166';
      ctx.shadowBlur = 18;
    }
    ctx.fillStyle = ok ? 'rgba(7, 3, 18, 0.82)' : 'rgba(7, 3, 18, 0.45)';
    rr(ctx, b.x, b.y, b.w, b.h, 10);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = ok ? 'rgba(255, 209, 102, 0.7)' : 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    rr(ctx, b.x, b.y, b.w, b.h, 10);
    ctx.stroke();
    ctx.fillStyle = ok ? '#ffd166' : 'rgba(255,255,255,0.35)';
    ctx.font = `bold 13px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText(label, b.x + b.w / 2, b.y + 29);
  }
  // Next-wave preview: what is coming, by name.
  const next = game.wave + 1;
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = `14px ${MONO}`;
  ctx.fillText(
    next > TOTAL_WAVES
      ? `NEXT: THE WARDEN AWAITS — 3 PHASES, NO MERCY`
      : `NEXT: WAVE ${next} — ${waveName(next)} · INCOMING: ${waveCompCounts(next)
          .map((c) => `${ENEMY_TYPES[c.type].name} x${c.count}`)
          .join(' · ')}`,
    WORLD.w / 2,
    580,
  );
}

function drawEnd(ctx, game, victory) {
  ctx.fillStyle = victory ? 'rgba(7, 30, 12, 0.55)' : 'rgba(30, 3, 12, 0.6)';
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = victory ? '#80ed99' : '#ff4d6d';
  ctx.font = `bold 64px ${FONT}`;
  ctx.shadowColor = victory ? '#80ed99' : '#ff4d6d';
  ctx.shadowBlur = 28;
  ctx.fillText(victory ? 'VOID CLEARED!' : 'SHIP DESTROYED', WORLD.w / 2, 230);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 20px ${MONO}`;
  ctx.fillText(
    victory
      ? 'YOU SURVIVED ALL 10 WAVES — THE GATE HOLDS.'
      : `YOU FELL ON WAVE ${game.wave} OF 10 — THE SWARM TAKES THE GATE.`,
    WORLD.w / 2,
    276,
  );
  panel(ctx, WORLD.w / 2 - 260, 320, 520, 226);
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 17px ${MONO}`;
  const rows = [
    ['FINAL SCORE', game.score.toLocaleString('en-US')],
    ['BEST SCORE', Math.max(game.best, game.score).toLocaleString('en-US')],
    ['MODE', DIFFICULTIES[game.difficulty].name],
    ['WAVES CLEARED', `${game.stats.wavesCleared} / ${TOTAL_WAVES}`],
    ['KILLS', String(game.kills)],
    ['SALVAGE EARNED', `◆ ${game.salvageEarned}`],
    ['TIME SURVIVED', formatTime(game.playTime)],
    ['UPGRADES TAKEN', String(game.stats.upgradesTaken)],
  ];
  rows.forEach(([label, value], i) => {
    const y = 352 + i * 24;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText(label, WORLD.w / 2 - 230, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd166';
    ctx.fillText(value, WORLD.w / 2 + 230, y);
  });
  const pulse = 0.75 + 0.25 * Math.sin(game.time * 3);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 22px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('PRESS R OR CLICK TO PLAY AGAIN', WORLD.w / 2, 596);
  ctx.globalAlpha = 1;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function drawPaused(ctx, game) {
  ctx.fillStyle = 'rgba(7, 3, 18, 0.65)';
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 48px ${FONT}`;
  ctx.fillText('PAUSED', WORLD.w / 2, 240);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `16px ${MONO}`;
  ctx.fillText(
    `WAVE ${game.wave} / ${TOTAL_WAVES} — ${waveName(game.wave)} · SCORE ${game.score.toLocaleString('en-US')} · SALVAGE ◆ ${game.salvage}`,
    WORLD.w / 2,
    272,
  );
  const labels = {
    resume: 'RESUME  —  P / CLICK',
    restart: 'RESTART RUN  —  R',
    quit: 'QUIT TO TITLE  —  Q',
  };
  for (const b of pauseButtons()) {
    const hover =
      game.mouseX >= b.x && game.mouseX <= b.x + b.w && game.mouseY >= b.y && game.mouseY <= b.y + b.h;
    ctx.save();
    if (hover) {
      ctx.shadowColor = '#4cc9f0';
      ctx.shadowBlur = 18;
    }
    panel(ctx, b.x, b.y, b.w, b.h);
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 18px ${FONT}`;
    ctx.fillText(labels[b.id], WORLD.w / 2, b.y + 33);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = `14px ${MONO}`;
  ctx.fillText(
    `M — SOUND ${game.muted ? 'OFF' : 'ON'} · THE SWARM WAITS — THE GATE HOLDS`,
    WORLD.w / 2,
    540,
  );
}

// The one entry point: draw the whole frame for the game's current mode.
export function draw(ctx, game) {
  ctx.save();
  if (game.shake > 0.2) {
    ctx.translate(
      (Math.random() - 0.5) * game.shake,
      (Math.random() - 0.5) * game.shake,
    );
  }
  drawBackground(ctx, game);
  drawPickups(ctx, game);
  for (const e of game.enemies) drawEnemy(ctx, e, game);
  drawBullets(ctx, game);
  drawPlayer(ctx, game);
  drawParticles(ctx, game);
  drawFloatTexts(ctx, game);
  if (game.mode === MODES.TITLE) {
    drawTitle(ctx, game);
  } else if (game.mode === MODES.UPGRADE) {
    drawUpgrade(ctx, game);
  } else if (game.mode === MODES.GAMEOVER) {
    drawEnd(ctx, game, false);
  } else if (game.mode === MODES.VICTORY) {
    drawEnd(ctx, game, true);
  } else if (game.mode === MODES.PAUSED) {
    drawPaused(ctx, game);
  } else {
    drawHud(ctx, game);
  }
  ctx.restore();
}
