# Touché

1v1 stick-figure fencing game where one touch kills. HTML5 canvas and plain JavaScript (ES modules), no libraries, no build step. Repo: https://github.com/Eninja8/Touche. Live: https://eninja8.github.io/Touche/ (GitHub Pages serves `main` directly, so every push to main goes live).

## Goals, in order
1. Shareable on the web so friends can play. **Done.**
2. Online 1v1 with room codes (peer-to-peer WebRTC plus rollback netcode). **Built**, being playtested.
3. Gameplay and polish in phases A–D (menus, combat tuning, maps and hazards, power-ups). The owner playtests after each phase; see the DEVLOG roadmap.
4. Windows EXE on Steam with Steam lobbies and friend invites. On hold until online is tested with a friend.

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
- `src/ui/input.js` turns keys and mouse into per-tick **commands** `{held, presses, aim}` (`aim` = direction from the shoulder to the mouse crosshair as a whole-pixel offset, or null for keyboard aiming; `src/ui/mouse.js` handles pointer lock and the aim styles: Free cursor in screen space, or Arrow/Off tied to the fencer. Online only the offset is sent, never a screen position). Presses only count once the fight is on (none carry over from the countdown or the last round). Those commands are the only way input reaches the sim, and they're what online play will send over the network.
- `src/view/` (render, fx, audio, theme) only reads the sim and reacts to its events. It may use `Math.random` because it's purely cosmetic.
- `src/main.js` runs the fixed-tick loop for local play. KO slow motion only changes how fast ticks are fed in; it never changes the tick itself.
- `src/net/` is online play. `rollback.js` (pure, testable in Node): 2-tick input delay, up to 12 ticks of prediction, rewind-and-replay, confirmed frames, state fingerprints. `codec.js` packs inputs. `netstats.js` measures ping, jitter, loss and rollbacks for the N overlay (`src/ui/netpanel.js`); `?delay=N` in the address tries a longer input delay. `transport.js` wraps PeerJS (swap this for Steam later). `online.js` runs the lobby (Ready, Start), messages and leaving; `match.js` runs the match: ready handshakes, the rollback loop, confirmed KOs (then a local slow-mo KO replay with no inputs) and rematches; `state.js` holds what both share.
- Online rules: anything a rollback could undo must not be announced. Ragdolls show at once but are provisional; the TOUCHÉ callout, lamps and points wait for confirmation. `newMatch` wipes the whole state so both computers start identical.
- Avoid assuming exactly two fencers where it is cheap (`foeOf` in `src/sim/foes.js`, loops over `S.F`); see the FFA plan in DEVLOG.md.
- Maps are data in `src/sim/maps.js`; the match stores the map name in `S.map` and the Hazards choice in `S.mode.hazards` (`getMap(S)` returns the map with hazards applied). Arena collision, ring-out and falls are in `src/sim/terrain.js`; each map is painted by `src/view/backdrops.js`.
- Power-ups are `src/sim/powerups.js` (state in `S.items`, `S.itemT`, `S.wave`, `S.knives`; spawned in fair mirrored-pair waves, one per fencer; and `f.power` on each fencer; on/off is `S.mode.powerups`, off unless `newMatch` gets `powerups: true`). The CPU's side is `src/sim/ai-power.js`; drawing is `src/view/items.js`. Shared readability looks: `src/view/edges.js` (haze, edge rims) and `src/view/hazards.js` (pits, spikes).
- Gameplay numbers worth tweaking live in `src/sim/constants.js` (`BLADE_TURN` = blade turn speed; lethality and beat speeds are shares of it, so they follow it; push, beats) and `src/sim/ai.js` (`DIFF`, per difficulty). DEVLOG.md lists the current values.

## Commands
- `npm start`: local server at http://localhost:8080
- `npm test`: determinism, map, power-up and netcode tests (`tools/determinism-test.mjs`, `tools/maps-test.mjs`, `tools/powerups-test.mjs`, `tools/netcode-test.mjs`)
