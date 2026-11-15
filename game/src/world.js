// NEON VOID — the world: story, difficulties, and the derelict scenery.
// One job: everything that gives the void a name and a place. The sim
// reads the difficulty table; the renderer reads the story and the debris.

export const SHIP_NAME = 'EMBERLIGHT';
export const GATE_NAME = 'VOID GATE';
export const STORY = `The last ember-ship ${SHIP_NAME} holds the ${GATE_NAME} against the Swarm.`;

// The Gate itself: a faint rift ring at the heart of the arena, drawn
// behind everything. It is the thing the player defends.
export const GATE = { x: 640, y: 360, r: 195 };

// Difficulties, picked on the title screen. Calm learns the gate, Standard
// is the true siege, Storm pays a score bonus for a harder swarm.
export const DIFFICULTIES = {
  calm: {
    id: 'calm',
    key: '1',
    name: 'CALM',
    tag: 'LEARN THE GATE',
    desc: 'Hull 130 · Swarm −15% hull',
    sub: 'Score ×1.0',
    hull: 130,
    enemyHp: 0.85,
    enemySpeed: 1,
    scoreMult: 1,
  },
  standard: {
    id: 'standard',
    key: '2',
    name: 'STANDARD',
    tag: 'THE TRUE SIEGE',
    desc: 'Hull 100 · Swarm at full strength',
    sub: 'Score ×1.0',
    hull: 100,
    enemyHp: 1,
    enemySpeed: 1,
    scoreMult: 1,
  },
  storm: {
    id: 'storm',
    key: '3',
    name: 'STORM',
    tag: 'FOR VETERANS',
    desc: 'Hull 80 · Swarm +20% hull, +10% speed',
    sub: 'Score ×1.25',
    hull: 80,
    enemyHp: 1.2,
    enemySpeed: 1.1,
    scoreMult: 1.25,
  },
};

export const DIFFICULTY_ORDER = ['calm', 'standard', 'storm'];

// Derelict station debris: broken hull plates, a wreck ring, antenna spars.
// Drawn faintly in the background so the arena reads as a place, not a void.
export function makeDebris(rng) {
  const debris = [];
  const kinds = ['plate', 'ring', 'spar', 'plate', 'spar', 'ring', 'plate', 'spar', 'plate'];
  for (let i = 0; i < kinds.length; i++) {
    debris.push({
      kind: kinds[i],
      x: rng.range(90, 1190),
      y: rng.range(80, 640),
      r: rng.range(16, 46),
      rot: rng.range(0, Math.PI * 2),
      spin: rng.range(-0.05, 0.05),
    });
  }
  return debris;
}
