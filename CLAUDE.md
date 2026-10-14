# Touché

1v1 stick-figure fencing game where one touch kills. HTML5 canvas and plain JavaScript (ES modules), no libraries, no build step. Repo: https://github.com/Eninja8/Touche. Live: https://eninja8.github.io/Touche/ (GitHub Pages serves `main` directly, so every push to main goes live).

## Goals, in order
1. Shareable on the web so friends can play. **Done.**
2. Online 1v1 with room codes (peer-to-peer WebRTC plus rollback netcode). Plan is in DEVLOG.md and waits for the owner's OK.
3. Windows EXE on Steam with Steam lobbies and friend invites.

## The owner
New to coding; Claude does most of the work. Explain things in plain language, avoid unexplained jargon, and say what each change means for the game. Give exact commands to run.

## Rules
- **Commit before any big change**, so there's always a known-good point to return to. Commit messages say what changed and why.
- **Keep files small and commented.** One clear job per file; a short header comment explaining it. Split a file once it grows past roughly 250 lines.
- **Ask before adding any dependency** (npm package, CDN library, external service). Approved so far: PeerJS 1.5.5 (vendored in `src/vendor/`) and its free public server.
- **Update DEVLOG.md at the end of every session**: refresh "Current state" and add a dated log entry.
- Run `npm test` after touching anything in `src/sim/`.

## Architecture (the important part)
- `src/sim/` is the **deterministic simulation**. `step(S, cmds)` advances the plain state object `S` by one fixed tick (1/120 s). Same `S` plus same commands must give the same result on every machine. Inside `src/sim/`:
  - never use `Math.random` (use `rand(S, a, b)` / `random(S)` from `rng.js`; the seed lives in `S.rng`)
  - never read clocks, the DOM, `settings`, or `localStorage`
  - keep all gameplay state inside `S` (so `snapshot(S)` = save, restoring = rewind)
  - don't play sounds or spawn particles; `emit()` an event instead (see `events.js`)
- `src/ui/input.js` turns keys and mouse into per-tick **commands** `{held, presses, aim}` (`aim` = mouse crosshair offset from the shoulder in whole pixels, or null for keyboard aiming; `src/ui/mouse.js` handles pointer lock). Those commands are the only way input reaches the sim, and they're what online play will send over the network.
- `src/view/` (render, fx, audio, theme) only reads the sim and reacts to its events. It may use `Math.random` because it's purely cosmetic.
- `src/main.js` runs the fixed-tick loop for local play. KO slow motion only changes how fast ticks are fed in; it never changes the tick itself.
- `src/net/` is online play. `rollback.js` (pure, testable in Node): 2-tick input delay, up to 12 ticks of prediction, rewind-and-replay, confirmed frames, state fingerprints. `codec.js` packs inputs. `transport.js` wraps PeerJS (swap this for Steam later). `online.js` runs the lobby, ready handshakes, the rollback loop, confirmed KOs (then a local slow-mo KO replay with no inputs) and rematches.
- Online rules: anything a rollback could undo must not be announced. Ragdolls show at once but are provisional; the TOUCHÉ callout, lamps and points wait for confirmation. `newMatch` wipes the whole state so both computers start identical.
- Maps are data in `src/sim/maps.js`; the match stores the map name in `S.map`.

## Commands
- `npm start`: local server at http://localhost:8080
- `npm test`: determinism test and netcode test (`tools/determinism-test.mjs`, `tools/netcode-test.mjs`)
