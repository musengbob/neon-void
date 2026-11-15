// NEON VOID — boot and the frame loop. Fixed 60 Hz simulation, rendering on
// requestAnimationFrame; input and audio are wired here, the game lives in
// sim.js and the drawing in render.js.
//
// URL modes (for testing and screenshots; normal play has no query):
//   ?shot=title|combat|upgrade|victory&seed=N — render one staged frame
//   ?demo=1&seed=N — autopilot plays on its own (soak tests, screenshots)

import { createGame, startRun, update, applyUpgrade, autopilot, loadBest, MODES } from './sim.js';
import { createInput, createScriptedInput } from './input.js';
import { createAudio } from './audio.js';
import { draw } from './render.js';
import { renderShot } from './shots.js';

const STEP = 1 / 60;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || 7);
const shot = params.get('shot');
const demo = params.get('demo') === '1';

if (shot) {
  // Screenshot mode: one staged frame, then stop. No audio, no loop.
  document.body.classList.add('shot');
  renderShot(canvas, shot, seed);
} else {
  boot();
}

function boot() {
  const game = createGame(seed);
  game.best = loadBest();
  game.mouseX = 640;
  game.mouseY = 360;
  const input = demo ? createScriptedInput() : createInput(canvas);
  const audio = createAudio();

  window.__NEONVOID__ = {
    game,
    demo,
    stats() {
      return {
        mode: game.mode,
        wave: game.wave,
        score: game.score,
        kills: game.kills,
        hp: Math.round(game.player.hp),
        enemies: game.enemies.length,
        playTime: Math.round(game.playTime),
        shotsFired: game.shotsFired,
        upgradesTaken: game.stats.upgradesTaken,
      };
    },
  };

  function startPlaying() {
    audio.ensure();
    audio.startMusic();
    startRun(game, audio);
  }

  function onTitleAction() {
    if (game.mode !== MODES.TITLE) return;
    audio.ensure();
    audio.click();
    startPlaying();
  }

  function onEndAction() {
    if (game.mode !== MODES.GAMEOVER && game.mode !== MODES.VICTORY) return;
    audio.click();
    startPlaying();
  }

  canvas.addEventListener('mousedown', () => {
    if (game.mode === MODES.TITLE) onTitleAction();
    else if (game.mode === MODES.GAMEOVER || game.mode === MODES.VICTORY) onEndAction();
    else if (game.mode === MODES.PAUSED) togglePause();
  });
  window.addEventListener('keydown', (event) => {
    const k = event.key === ' ' ? 'space' : event.key.toLowerCase();
    if (k === 'm') {
      audio.ensure();
      audio.toggleMute();
      return;
    }
    if (game.mode === MODES.TITLE && (k === 'enter' || k === 'space')) {
      onTitleAction();
      return;
    }
    if ((game.mode === MODES.GAMEOVER || game.mode === MODES.VICTORY) && k === 'r') {
      onEndAction();
      return;
    }
    if (k === 'p' && (game.mode === MODES.PLAYING || game.mode === MODES.PAUSED)) {
      togglePause();
    }
  });

  function togglePause() {
    if (game.mode === MODES.PLAYING) {
      game.mode = MODES.PAUSED;
    } else if (game.mode === MODES.PAUSED) {
      game.mode = MODES.PLAYING;
    }
  }

  // The upgrade draft: click a card, or press 1 / 2 / 3.
  function draftChoiceAt(x, y) {
    if (game.mode !== MODES.UPGRADE || game.draft.length !== 3) return -1;
    const cw = 300;
    const ch = 210;
    const gap = 28;
    const total = cw * 3 + gap * 2;
    const x0 = (1280 - total) / 2;
    const y0 = 250;
    for (let i = 0; i < 3; i++) {
      const cx = x0 + i * (cw + gap);
      if (x >= cx && x <= cx + cw && y >= y0 && y <= y0 + ch) return i;
    }
    return -1;
  }

  let last = performance.now();
  let acc = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    acc += dt;

    // One-shot keys and clicks, handled before the sim steps.
    if (game.mode === MODES.UPGRADE && game.draft.length === 3 && demo) {
      // The demo autopilot takes the middle card so the soak keeps playing.
      applyUpgrade(game, game.draft[1], audio);
    }
    if (!demo) {
      game.mouseX = input.mouse.x;
      game.mouseY = input.mouse.y;
      if (game.mode === MODES.UPGRADE) {
        // Number keys pick a card: 1 / 2 / 3.
        for (const n of ['1', '2', '3']) {
          if (input.keys.has(n)) {
            input.keys.delete(n);
            applyUpgrade(game, game.draft[Number(n) - 1], audio);
            break;
          }
        }
        const click = input.takeClick();
        if (click) {
          const idx = draftChoiceAt(click.x, click.y);
          if (idx >= 0) applyUpgrade(game, game.draft[idx], audio);
        }
      } else {
        input.takeClick();
      }
    }

    let steps = 0;
    while (acc >= STEP && steps < 5) {
      if (demo) autopilot(game, input);
      if (game.mode === MODES.TITLE && demo) {
        // The demo starts playing on its own.
        startPlaying();
      }
      update(game, STEP, input, audio);
      acc -= STEP;
      steps += 1;
    }
    if (steps === 5) acc = 0; // drop backlog rather than spiral
    if (!demo) input.endFrame();
    draw(ctx, game);
  }

  requestAnimationFrame(frame);
}
