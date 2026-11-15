// NEON VOID — wave composition: what spawns, how many, and when.
// 10 waves; wave 10 ends with the Warden boss. Difficulty ramps in count,
// speed and mix; elites appear from wave 6. The queue is drained over time
// so the player is never buried in one instant.

export const TOTAL_WAVES = 10;

// What each wave is called: the banner names it, so every wave feels
// like a chapter of the siege rather than a number.
export const WAVE_NAMES = [
  'FIRST CONTACT',
  'THE WEAVE TIGHTENS',
  'SPIRES ON THE HORIZON',
  'THE HIVE STIRS',
  'SWARM TIDE',
  'ELITES AWAKEN',
  'THE LONG NIGHT',
  'SIEGE OF THE GATE',
  'THE LAST CALM',
  'THE WARDEN AWAKENS',
];

export function waveName(wave) {
  return WAVE_NAMES[Math.min(Math.max(wave, 1), TOTAL_WAVES) - 1];
}

const MIX = [
  // wave: [drones, weavers, stingers, splitters]
  [6, 0, 0, 0],
  [9, 3, 0, 0],
  [10, 5, 2, 0],
  [12, 6, 3, 2],
  [14, 8, 4, 3],
  [16, 9, 5, 4],
  [18, 10, 6, 5],
  [20, 12, 7, 6],
  [22, 13, 8, 7],
  [10, 6, 4, 3], // wave 10: escort swarm, then the boss
];

export function waveComp(wave) {
  const row = MIX[Math.min(wave, TOTAL_WAVES) - 1];
  const queue = [];
  const types = ['drone', 'weaver', 'stinger', 'splitter'];
  row.forEach((count, i) => {
    for (let n = 0; n < count; n++) queue.push(types[i]);
  });
  // Shuffle the queue so the mix arrives interleaved, not in blocks.
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  return queue;
}

export function waveBudget(wave) {
  return MIX[Math.min(wave, TOTAL_WAVES) - 1].reduce((a, b) => a + b, 0);
}

export function waveCompCounts(wave) {
  const row = MIX[Math.min(wave, TOTAL_WAVES) - 1];
  const types = ['drone', 'weaver', 'stinger', 'splitter'];
  return row.map((count, i) => ({ type: types[i], count })).filter((c) => c.count > 0);
}

// Seconds between spawns: faster as waves rise, never below the floor.
export function spawnInterval(wave) {
  return Math.max(0.24, 0.72 - wave * 0.05);
}

export function isBossWave(wave) {
  return wave === TOTAL_WAVES;
}

export function eliteChance(wave) {
  return wave >= 6 ? 0.06 + (wave - 6) * 0.02 : 0;
}
