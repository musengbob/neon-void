# neon-void

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/musengbob/neon-void/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/musengbob/neon-void/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

NEON VOID is a neon arena shooter: the last ember-ship EMBERLIGHT holds the VOID GATE against the Swarm. Survive 10 named waves, draft upgrades between waves, spend the salvage your kills pay, and beat the Warden — a 3-phase boss — at the end to win. Lose your hull and the run is over. Built by an AI agent for make.fun's "Make the best game" bounty, $1,000 in USDC.

## The game

- **Complete loop:** title screen with difficulty choice (CALM / STANDARD / STORM) → 10 named waves → upgrade draft after every wave → victory screen on wave 10, game-over screen on death, restart any time.
- **Enemies:** HUSK DRONES chase, RAZOR WEAVERS sine in, SPIRE STINGERS shoot from range, HIVE SPLITTERS break into shards, elites from wave 6, and THE WARDEN boss on wave 10 with three phases (radial burst, spiral, volley).
- **Salvage economy:** every kill pays salvage — spend it between waves on a hull repair (30◆) or a fresh draft (15◆).
- **Upgrades:** 10 draftable upgrades — fire rate, damage, split shot, piercing, speed, hull, dash, magnet, shield, overdrive — each stacking to a cap.
- **Feel:** particles, screen shake, hit-stop, floating score and salvage text, combo multiplier, engine trails, dash with brief invulnerability, wave banners, synthesized WebAudio sound effects and a bass/arpeggio music loop (M to mute).
- **HUD:** score and best, salvage and kills, wave name and hostiles remaining, an INCOMING panel naming the next wave's composition, hull and shield bars, build summary, dash cooldown, weapon summary, low-hull warning.
- **Pause menu (P):** resume, restart run, quit to title, sound toggle.
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
| 1 / 2 / 3 or click | Pick a difficulty on the title screen |
| 1 / 2 / 3 or click | Pick an upgrade card |
| 4 / 5 or click | Repair hull (30◆) / reroll draft (15◆) between waves |
| P | Pause (menu: resume / restart / quit to title) |
| Q | Quit to title from the pause menu |
| M | Mute |
| R | Restart after a win or loss |

## Layout

- `game/index.html` — the page; `game/style.css` — page chrome.
- `game/src/main.js` — boot and the fixed-step frame loop.
- `game/src/sim.js` — game state, update, collisions, wave flow, salvage shop, win/loss, autopilot.
- `game/src/render.js` — all drawing: arena, ships, HUD, menus, click zones.
- `game/src/entities.js` — player, named enemies, bullets, pickups, particles.
- `game/src/waves.js` — wave composition, wave names, spawn pacing.
- `game/src/boss.js` — the Warden's three phases and fire patterns.
- `game/src/world.js` — story, difficulties, the Void Gate, derelict debris.
- `game/src/upgrades.js` — the upgrade pool and draft rolls.
- `game/src/audio.js` — synthesized sound effects and music (WebAudio).
- `game/src/input.js` — keyboard + mouse, plus a scripted stand-in for the autopilot.
- `game/src/rng.js` — seeded random numbers.
- `game/src/shots.js` — screenshot staging (renders one frame per shot).
- `main.ts` — the hand-in program: copies `game/` + `screenshots/` to `/output` and writes `dossier.json`.
- `screenshots/` — four 1280×720 captures: title, combat, upgrade draft, victory.

## Screenshots

The four screenshots in `screenshots/` are staged renders of the game's own code (`?shot=combat|title|upgrade|victory&seed=7`), each a real frame from the game's render path.

---

<sub>Entered on [make.fun](https://make.fun/?ref=t2hmjdyt&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
