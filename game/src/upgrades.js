// NEON VOID — the upgrade draft offered between waves.
// Pick 1 of 3. Every upgrade is a permanent, visible change to the ship,
// so the draft is the game's real build choice. Stacks are capped where
// a cap keeps the game fair.

export const UPGRADE_POOL = [
  {
    id: 'rapid',
    name: 'Rapid Trigger',
    desc: '+22% fire rate',
    color: '#ffd166',
    max: 5,
    apply(p) {
      p.fireRate *= 1.22;
    },
  },
  {
    id: 'heavy',
    name: 'Heavy Rounds',
    desc: '+30% bullet damage',
    color: '#ff4d6d',
    max: 5,
    apply(p) {
      p.damage *= 1.3;
    },
  },
  {
    id: 'split',
    name: 'Split Shot',
    desc: '+1 projectile per shot',
    color: '#4cc9f0',
    max: 3,
    apply(p) {
      p.multiShot += 1;
    },
  },
  {
    id: 'pierce',
    name: 'Piercing Rounds',
    desc: 'Bullets pass through +1 enemy',
    color: '#b5179e',
    max: 3,
    apply(p) {
      p.pierce += 1;
    },
  },
  {
    id: 'swift',
    name: 'Swift Thrusters',
    desc: '+12% move speed',
    color: '#80ed99',
    max: 4,
    apply(p) {
      p.speed *= 1.12;
    },
  },
  {
    id: 'hull',
    name: 'Hull Plating',
    desc: '+25 max hull, repair 25',
    color: '#f1fa8c',
    max: 4,
    apply(p) {
      p.maxHp += 25;
      p.hp = Math.min(p.maxHp, p.hp + 25);
    },
  },
  {
    id: 'dash',
    name: 'Phase Dash',
    desc: '-25% dash cooldown',
    color: '#c77dff',
    max: 4,
    apply(p) {
      p.dashCooldown *= 0.75;
    },
  },
  {
    id: 'magnet',
    name: 'Magnet Core',
    desc: '+60% pickup radius',
    color: '#ff9f1c',
    max: 3,
    apply(p) {
      p.magnet *= 1.6;
    },
  },
  {
    id: 'shield',
    name: 'Shield Cell',
    desc: '+25 max shield, recharge 25',
    color: '#4361ee',
    max: 4,
    apply(p) {
      p.maxShield += 25;
      p.shield = Math.min(p.maxShield, p.shield + 25);
    },
  },
  {
    id: 'velocity',
    name: 'Overdrive Rounds',
    desc: '+18% bullet speed, +8% damage',
    color: '#ff70a6',
    max: 4,
    apply(p) {
      p.bulletSpeed *= 1.18;
      p.damage *= 1.08;
    },
  },
];

// Roll 3 distinct upgrades the player has not maxed out yet.
export function rollDraft(rng, owned) {
  const available = UPGRADE_POOL.filter((u) => (owned[u.id] || 0) < u.max);
  const pool = available.length >= 3 ? available : UPGRADE_POOL;
  const draft = [];
  const bag = [...pool];
  while (draft.length < 3 && bag.length > 0) {
    const i = Math.floor(rng.next() * bag.length);
    draft.push(bag.splice(i, 1)[0]);
  }
  return draft;
}
