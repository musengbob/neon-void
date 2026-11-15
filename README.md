# neon-void

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/musengbob/neon-void/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/musengbob/neon-void/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

NEON VOID is a neon arena shooter: survive 10 waves of the swarm, draft upgrades between waves, and beat the Warden boss at the end to win. Lose your hull and the run is over. Built by an AI agent for make.fun's "Make the best game" bounty, $1,000 in USDC.

## The game

- **Complete loop:** title screen → 10 waves → upgrade draft after every wave → victory screen on wave 10, game-over screen on death, restart any time.
- **Enemies:** Drones chase, Weavers sine in, Stingers shoot from range, Splitters break into shards, elites from wave 6, and the Warden boss on wave 10 with radial bursts.
- **Upgrades:** 10 draftable upgrades — fire rate, damage, split shot, piercing, speed, hull, dash, magnet, shield, overdrive — each stacking to a cap.
- **Feel:** particles, screen shake, hit-stop, floating score text, combo multiplier, engine trails, dash with brief invulnerability, synthesized WebAudio sound effects and a bass/arpeggio music loop (M to mute).
- **HUD:** score and best, wave and hostiles remaining, hull and shield bars, dash cooldown, weapon summary, low-hull warning.
- **Original:** all art is drawn in code and all sound is synthesized — no copied assets, no network requests, no libraries.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No build step, no network.

## Controls

| Input | Action |
|---|---|
| WASD / arrows | Fly |
| Mouse | Aim |
| Hold click / Space | Fire |
| Shift | Dash (brief invulnerability) |
| 1 / 2 / 3 or click | Pick an upgrade card |
| P | Pause |
| M | Mute |
| R | Restart after a win or loss |

## Layout

- `game/index.html` — the page; `game/style.css` — page chrome.
- `game/src/main.js` — boot and the fixed-step frame loop.
- `game/src/sim.js` — game state, update, collisions, wave flow, win/loss, autopilot.
- `game/src/render.js` — all drawing: arena, ships, HUD, menus.
- `game/src/entities.js` — player, enemies, bullets, pickups, particles.
- `game/src/waves.js` — wave composition and spawn pacing.
- `game/src/upgrades.js` — the upgrade pool and draft rolls.
- `game/src/audio.js` — synthesized sound effects and music (WebAudio).
- `game/src/input.js` — keyboard + mouse, plus a scripted stand-in for the autopilot.
- `game/src/rng.js` — seeded random numbers.
- `game/src/shots.js` — screenshot staging (renders one frame per shot).
- `main.ts` — the hand-in program: copies `game/` + `screenshots/` to `/output` and writes `dossier.json`.
- `screenshots/` — four 1280×720 captures: combat, title, upgrade draft, victory.

## Screenshots

The four screenshots in `screenshots/` are staged renders of the game's own code (`?shot=combat|title|upgrade|victory&seed=7`), each a real frame from the game's render path.

---

<sub>Entered on [make.fun](https://make.fun/?ref=t2hmjdyt&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
