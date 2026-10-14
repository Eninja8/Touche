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
- **Ask before adding any dependency** (npm package, CDN library, external service). Today there are zero.
- **Update DEVLOG.md at the end of every session**: refresh "Current state" and add a dated log entry.
- Run `npm test` after touching anything in `src/sim/`.

## Architecture (the important part)
- `src/sim/` is the **deterministic simulation**. `step(S, cmds)` advances the plain state object `S` by one fixed tick (1/120 s). Same `S` plus same commands must give the same result on every machine. Inside `src/sim/`:
  - never use `Math.random` (use `rand(S, a, b)` / `random(S)` from `rng.js`; the seed lives in `S.rng`)
  - never read clocks, the DOM, `settings`, or `localStorage`
  - keep all gameplay state inside `S` (so `snapshot(S)` = save, restoring = rewind)
  - don't play sounds or spawn particles; `emit()` an event instead (see `events.js`)
- `src/ui/input.js` turns keys and mouse into per-tick **commands** `{held, presses, aim}`. Those commands are the only way input reaches the sim, and they're what online play will send over the network.
- `src/view/` (render, fx, audio, theme) only reads the sim and reacts to its events. It may use `Math.random` because it's purely cosmetic.
- `src/main.js` runs the fixed-tick loop. KO slow motion only changes how fast ticks are fed in; it never changes the tick itself.

## Commands
- `npm start`: local server at http://localhost:8080
- `npm test`: determinism test (`tools/determinism-test.mjs`)
